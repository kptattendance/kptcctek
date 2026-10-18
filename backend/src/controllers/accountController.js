// src/controllers/accountController.js
//
// People who use CCTEK. Every user exists in three places, kept in step here:
//   Clerk      - the login (Google sign-in with the same email)
//   MongoDB    - role, department, active flag (the only source of permissions)
//   Cloudinary - optional profile photo (also copied to Clerk for the avatar)
//
// Create: Clerk -> photo -> MongoDB, rolling back the earlier steps on failure.
// Delete: only for users with no work history; otherwise deactivate, so
// bills, payouts and the audit trail keep a real person behind every entry.

import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";
import User, { DESIGNATIONS, DEPARTMENTS, normalizeDesignation } from "../models/User.js";
import Project from "../models/Project.js";
import Bill from "../models/Bill.js";
import Receipt from "../models/Receipt.js";
import Payout from "../models/Payout.js";
import IntakeScan from "../models/IntakeScan.js";
import AuditLog, { audit } from "../models/AuditLog.js";
import { ROLES, ROLE_LABELS } from "../config/roles.js";
import { storeAvatar, destroyAvatar } from "../middlewares/uploadAvatar.js";
import { HttpError, str, email, oneOf, bool, compact, objectId, escapeRegex, paging } from "../utils/validate.js";

const PUBLIC_FIELDS = "name email phone role department designation pan imageUrl isActive lastLoginAt createdAt clerkId";
const DEPT_CODES = DEPARTMENTS.map((d) => d.code);

const shape = (u) => ({
  ...u,
  clerkId: undefined,
  linked: Boolean(u.lastLoginAt), // has signed in at least once
  roleLabel: ROLE_LABELS[u.role] || u.role,
});

const splitName = (name) => {
  const [firstName, ...rest] = String(name).trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || undefined };
};

// Clerk errors carry a readable message in errors[0].longMessage.
function clerkError(err, action) {
  const detail = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message;
  const status = err?.status >= 400 && err?.status < 500 ? 400 : 502;
  return new HttpError(status, `Clerk could not ${action}: ${detail}`);
}

// Copies of the photo / name / role into Clerk are for display only; if
// Clerk hiccups the change in MongoDB still stands.
async function bestEffort(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`Clerk sync (${label}) failed:`, err?.errors?.[0]?.message || err.message);
  }
}

const photoBlob = (req) => new Blob([req.file.buffer], { type: req.photoType.mime });

function readUserInput(body, { creating }) {
  const designation = body.designation === undefined ? undefined : normalizeDesignation(body.designation);
  if (designation === null) throw new HttpError(400, `Designation must be one of: ${DESIGNATIONS.join(", ")}.`);
  const department = body.department === undefined ? undefined : body.department === "" ? "" : oneOf(body.department, DEPT_CODES, { name: "Department" });
  return compact({
    name: str(body.name, { name: "Name", required: creating, max: 120 }),
    email: creating ? email(body.email, { name: "Email", required: true }) : undefined, // email is the login identity; not editable
    phone: str(body.phone, { name: "Phone", max: 20, pattern: /^[0-9+\-\s]{7,20}$/ }),
    role: oneOf(body.role, ROLES, { name: "Role", required: creating }),
    department,
    designation,
    pan: str(body.pan, { name: "PAN", max: 10, pattern: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/ })?.toUpperCase(),
    isActive: creating ? undefined : bool(body.isActive),
  });
}

// ---------------------------------------------------------------- read

export const getOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      roles: ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
      departments: DEPARTMENTS,
      designations: DESIGNATIONS,
    },
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user.dbId).select(PUBLIC_FIELDS).lean();
  res.json({ success: true, data: shape(user) });
};

export const listUsers = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (req.query.role) filter.role = oneOf(req.query.role, ROLES, { name: "Role" });
  if (req.query.active !== undefined && req.query.active !== "") filter.isActive = bool(req.query.active);
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(str(req.query.q, { name: "Search", max: 60 })), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total, counts] = await Promise.all([
    User.find(filter).select(PUBLIC_FIELDS).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: { role: "$role", active: { $ne: ["$isActive", false] } }, n: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data: items.map(shape), page, limit, total, counts });
};

// Lightweight list for pickers (assign inspectors).
export const listStaffOptions = async (req, res) => {
  const items = await User.find({ isActive: mongoose.trusted({ $ne: false }), role: mongoose.trusted({ $in: ["faculty", "work_coordinator", "manager"] }) })
    .select("name designation role imageUrl")
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, data: items });
};

export const getUser = async (req, res) => {
  const user = await User.findById(objectId(req.params.id)).select(PUBLIC_FIELDS).lean();
  if (!user) throw new HttpError(404, "User not found.");
  res.json({ success: true, data: shape(user) });
};

// ---------------------------------------------------------------- create

export const createUser = async (req, res) => {
  const data = readUserInput(req.body, { creating: true });
  if (data.role === "admin" && req.user.role !== "admin") throw new HttpError(403, "Only an Admin can add another Admin.");
  if (await User.exists({ email: data.email })) throw new HttpError(409, "A user with this email already exists.");

  // 1. Clerk: reuse an existing login with this email, otherwise create one.
  //    No password: they sign in with Google using this email.
  let clerkUser;
  let createdInClerk = false;
  try {
    const found = await clerkClient.users.getUserList({ emailAddress: [data.email], limit: 1 });
    clerkUser = found.data?.[0];
    if (!clerkUser) {
      clerkUser = await clerkClient.users.createUser({
        emailAddress: [data.email],
        ...splitName(data.name),
        skipPasswordRequirement: true,
        publicMetadata: { role: data.role }, // display only; permissions come from MongoDB
      });
      createdInClerk = true;
    }
  } catch (err) {
    throw clerkError(err, "create the login");
  }
  if (await User.exists({ clerkId: clerkUser.id })) throw new HttpError(409, "This Clerk login is already linked to another user.");

  // 2. Photo  3. MongoDB. Undo 1 and 2 if anything fails.
  let photo = null;
  try {
    if (req.file) photo = await storeAvatar(req.file.buffer);
    const user = await User.create({
      ...data,
      clerkId: clerkUser.id,
      imageUrl: photo?.secure_url || "",
      imagePublicId: photo?.public_id || "",
      isActive: true,
    });
    if (photo) await bestEffort("photo", () => clerkClient.users.updateUserProfileImage(clerkUser.id, { file: photoBlob(req) }));
    await audit(req, { action: "user.create", entity: "User", entityId: user._id, after: { email: user.email, role: user.role, clerkId: clerkUser.id } });
    res.status(201).json({ success: true, data: shape(user.toObject()) });
  } catch (err) {
    if (photo) await destroyAvatar(photo.public_id);
    if (createdInClerk) await bestEffort("rollback", () => clerkClient.users.deleteUser(clerkUser.id));
    throw err;
  }
};

// ---------------------------------------------------------------- update

export const updateUser = async (req, res) => {
  const id = objectId(req.params.id);
  const data = readUserInput(req.body, { creating: false });
  const removePhoto = bool(req.body.removePhoto) === true;
  const before = await User.findById(id).lean();
  if (!before) throw new HttpError(404, "User not found.");

  const self = String(before._id) === String(req.user.dbId);
  if (self && data.role && data.role !== before.role) throw new HttpError(400, "You cannot change your own role.");
  if (self && data.isActive === false) throw new HttpError(400, "You cannot deactivate yourself.");
  if ((data.role === "admin" || before.role === "admin") && req.user.role !== "admin")
    throw new HttpError(403, "Only an Admin can change an Admin.");

  const losingAdmin = before.role === "admin" && ((data.role && data.role !== "admin") || data.isActive === false);
  if (losingAdmin && (await User.countDocuments({ role: "admin", isActive: mongoose.trusted({ $ne: false }), _id: mongoose.trusted({ $ne: id }) })) === 0)
    throw new HttpError(400, "At least one active Admin is required.");

  let photo = null;
  if (req.file) {
    photo = await storeAvatar(req.file.buffer);
    data.imageUrl = photo.secure_url;
    data.imagePublicId = photo.public_id;
  } else if (removePhoto) {
    data.imageUrl = "";
    data.imagePublicId = "";
  }

  let after;
  try {
    after = await User.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true }).select(PUBLIC_FIELDS).lean();
  } catch (err) {
    if (photo) await destroyAvatar(photo.public_id);
    throw err;
  }
  if ((photo || removePhoto) && before.imagePublicId) await destroyAvatar(before.imagePublicId);

  // Keep Clerk in step (display + access).
  if (before.clerkId) {
    const cid = before.clerkId;
    if (data.name && data.name !== before.name) await bestEffort("name", () => clerkClient.users.updateUser(cid, splitName(data.name)));
    if (data.role && data.role !== before.role) await bestEffort("role", () => clerkClient.users.updateUserMetadata(cid, { publicMetadata: { role: data.role } }));
    if (photo) await bestEffort("photo", () => clerkClient.users.updateUserProfileImage(cid, { file: photoBlob(req) }));
    else if (removePhoto) await bestEffort("photo", () => clerkClient.users.deleteUserProfileImage(cid));
    // Banned in Clerk = can't even get a session; MongoDB isActive is still the real check.
    if (data.isActive === false && before.isActive !== false) await bestEffort("ban", () => clerkClient.users.banUser(cid));
    if (data.isActive === true && before.isActive === false) await bestEffort("unban", () => clerkClient.users.unbanUser(cid));
  }

  await audit(req, {
    action: "user.update",
    entity: "User",
    entityId: id,
    before: { name: before.name, role: before.role, isActive: before.isActive, photo: Boolean(before.imagePublicId) },
    after: { name: after.name, role: after.role, isActive: after.isActive, photo: Boolean(after.imageUrl) },
  });
  res.json({ success: true, data: shape(after) });
};

// ---------------------------------------------------------------- delete

// Anything this person did or was part of. If there is any, they are
// deactivated instead of deleted.
async function workHistory(uid) {
  const t = mongoose.trusted;
  const [projects, bills, receipts, payouts, scans, actions] = await Promise.all([
    Project.countDocuments(t({ $or: [{ createdBy: uid }, { "team.user": uid }] })),
    Bill.countDocuments(t({ $or: [{ preparedBy: uid }, { approvedBy: uid }] })),
    Receipt.countDocuments({ recordedBy: uid }),
    Payout.countDocuments(t({ $or: [{ preparedBy: uid }, { "people.user": uid }] })),
    IntakeScan.countDocuments({ uploadedBy: uid }),
    AuditLog.countDocuments({ actor: uid }),
  ]);
  return { projects, bills, receipts, payouts, scans, actions, total: projects + bills + receipts + payouts + scans + actions };
}

export const deleteUser = async (req, res) => {
  const id = objectId(req.params.id);
  const user = await User.findById(id).lean();
  if (!user) throw new HttpError(404, "User not found.");
  if (String(user._id) === String(req.user.dbId)) throw new HttpError(400, "You cannot delete yourself.");
  if (user.role === "admin" && req.user.role !== "admin") throw new HttpError(403, "Only an Admin can delete an Admin.");
  if (user.role === "admin" && (await User.countDocuments({ role: "admin", isActive: mongoose.trusted({ $ne: false }), _id: mongoose.trusted({ $ne: id }) })) === 0)
    throw new HttpError(400, "At least one active Admin is required.");

  const history = await workHistory(id);
  if (history.total > 0) {
    throw new HttpError(
      409,
      `${user.name} has work records in CCTEK (${history.projects} applications, ${history.bills} bills, ${history.payouts} payouts, ${history.actions} actions). Deactivate instead, so those records keep their name.`,
      { history }
    );
  }

  // Clerk first: if it fails, nothing is lost and the admin can retry.
  if (user.clerkId) {
    try {
      await clerkClient.users.deleteUser(user.clerkId);
    } catch (err) {
      if (err?.status !== 404) throw clerkError(err, "delete the login"); // 404 = already gone
    }
  }
  await User.deleteOne({ _id: id });
  await destroyAvatar(user.imagePublicId);

  await audit(req, {
    action: "user.delete",
    entity: "User",
    entityId: id,
    before: { name: user.name, email: user.email, role: user.role, clerkId: user.clerkId || "" },
  });
  res.json({ success: true, message: `${user.name} was deleted from CCTEK, Clerk and the photo store.` });
};
