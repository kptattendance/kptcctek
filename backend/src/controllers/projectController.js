// src/controllers/projectController.js
// Inward register: scan a letter, review, save as a Project.

import mongoose from "mongoose";
import Project, { STATUS_FLOW } from "../models/Project.js";
import User from "../models/User.js";
import Party from "../models/Party.js";
import Fund from "../models/Fund.js";
import Bill from "../models/Bill.js";
import Receipt from "../models/Receipt.js";
import IntakeScan from "../models/IntakeScan.js";
import NameDirectory, { learnName } from "../models/NameDirectory.js";
import { ruleForDate } from "../models/BillingRule.js";
import { nextSequence, financialYear } from "../models/Counter.js";
import { audit } from "../models/AuditLog.js";
import { calculateCharges, DEFAULT_RULE } from "../services/billingService.js";
import { storePrivately, signedViewUrl } from "../middlewares/uploadScan.js";
import { hasPermission } from "../config/roles.js";
import {
  HttpError, str, oneOf, rupees, num, date, compact, objectId, escapeRegex, paging,
} from "../utils/validate.js";

const WORK_TYPES = ["civil", "electrical", "mechanical", "other"];

async function chargesFor({ projectBillAmount, km, gstMode, lumpsumFee, appDate }) {
  const rule = (await ruleForDate(appDate)) || DEFAULT_RULE;
  return { ...calculateCharges({ projectBillAmount, km, gstMode, lumpsumFee }, rule), calculatedAt: new Date() };
}

// ---------------------------------------------------------------- parties

export const listParties = async (req, res) => {
  const items = await Party.find({ isActive: true }).select("code name gstMode").sort({ code: 1 }).lean();
  res.json({ success: true, data: items });
};

// ---------------------------------------------------------------- scan

export const scanInward = async (req, res) => {
  const { buffer, originalname, size } = req.file;
  const { format } = req.fileType;

  const stored = await storePrivately(buffer, { folder: "cctek/inward", resourceType: "image" });
  const scan = await IntakeScan.create({
    uploadedBy: req.user.dbId,
    publicId: stored.public_id,
    resourceType: "image",
    format,
    bytes: size,
    originalName: String(originalname || "").slice(0, 120),
  });

  // The letter is read in the browser (free OCR); the server only keeps the copy.
  res.status(201).json({ success: true, data: { scanId: scan._id } });
};

export const getScanUrl = async (req, res) => {
  const scan = await IntakeScan.findById(objectId(req.params.scanId)).lean();
  if (!scan) throw new HttpError(404, "Scan not found.");
  const own = String(scan.uploadedBy) === String(req.user.dbId);
  const inTeam = scan.project && (await Project.exists({ _id: scan.project, "team.user": req.user.dbId }));
  if (!own && !inTeam && !hasPermission(req.user.role, "projects.read")) throw new HttpError(403, "Not allowed.");
  res.json({ success: true, data: { url: signedViewUrl(scan), format: scan.format, expiresIn: 300 } });
};

// ---------------------------------------------------------------- helpers for the form

// Suggest the next numbers from the last entry (the paper register continues).
export const nextNumbers = async (req, res) => {
  const fy = financialYear();
  const last = await Project.findOne({ financialYear: fy }).sort({ serialNo: -1 }).select("ledgerNo pageNo appNo serialNo").lean();
  const lastApp = parseInt(String(last?.appNo || "").split("/")[0], 10);
  res.json({
    success: true,
    data: {
      financialYear: fy,
      ledgerNo: last?.ledgerNo || "",
      pageNo: last?.pageNo || "",
      appNo: Number.isFinite(lastApp) ? String(lastApp + 1) : "",
      serialNo: (last?.serialNo || 0) + 1,
    },
  });
};

export const previewCharges = async (req, res) => {
  const b = req.body || {};
  const projectBillAmount = rupees(b.projectBillAmount, { name: "Project bill amount", required: true });
  let gstMode = oneOf(b.gstMode, ["inclusive", "exclusive"], { name: "GST mode" });
  if (!gstMode && b.partyId) gstMode = (await Party.findById(objectId(b.partyId, "party")).lean())?.gstMode;
  const charges = await chargesFor({
    projectBillAmount,
    km: num(b.km, { name: "KM", max: 2000 }) || 0,
    gstMode,
    lumpsumFee: rupees(b.lumpsumFee, { name: "Lumpsum fee" }) ?? null,
    appDate: date(b.appDate, { name: "Application date" }) || new Date(),
  });
  res.json({ success: true, data: charges });
};

// ---------------------------------------------------------------- create

function readProjectInput(b) {
  return compact({
    ledgerNo: str(b.ledgerNo, { name: "Ledger no.", max: 20 }),
    pageNo: str(b.pageNo, { name: "Page no.", max: 20 }),
    appNo: str(b.appNo, { name: "Application no.", required: true, max: 30 }),
    appDate: date(b.appDate, { name: "Application date", required: true }),
    appDetails: str(b.appDetails, { name: "Work description", max: 1000 }),
    workType: oneOf(b.workType, WORK_TYPES, { name: "Work type" }),
    ward: str(b.ward, { name: "Ward", max: 20 }),
    fileNo: str(b.fileNo, { name: "File no.", max: 40 }),
    workYear: str(b.workYear, { name: "Work year", max: 20 }),
    mbNo: str(b.mbNo, { name: "MB no.", max: 40 }),
    contractorName: str(b.contractorName, { name: "Contractor", max: 150 }),
    partyEngineer: str(b.partyEngineer, { name: "Engineer", max: 150 }),
    partyEngineerDesignation: str(b.partyEngineerDesignation, { name: "Engineer designation", max: 80 }),
    partyEngineerPhone: str(b.partyEngineerPhone, { name: "Engineer mobile", max: 20, pattern: /^[0-9+\-\s]{7,20}$/ }),
    fundSource: str(b.fundSource, { name: "Fund", max: 200 }),
    estimateAmount: rupees(b.estimateAmount, { name: "Estimate amount" }),
    workStartedOn: date(b.workStartedOn, { name: "Work start date" }),
    workCompletedOn: date(b.workCompletedOn, { name: "Work completion date" }),
    projectBillAmount: rupees(b.projectBillAmount, { name: "Project bill amount", required: true }),
    km: num(b.km, { name: "KM", max: 2000 }),
    gstMode: oneOf(b.gstMode, ["inclusive", "exclusive"], { name: "GST mode" }),
    lumpsumFee: rupees(b.lumpsumFee, { name: "Lumpsum fee" }),
    remarks: str(b.remarks, { name: "Remarks", max: 1000 }),
    letterRefNo: str(b.letterRefNo, { name: "Letter reference", max: 80 }),
    letterDate: date(b.letterDate, { name: "Letter date" }),
  });
}

export const createProject = async (req, res) => {
  const b = req.body || {};
  const input = readProjectInput(b);
  const party = await Party.findById(objectId(b.partyId, "party")).lean();
  if (!party?.isActive) throw new HttpError(400, "Please choose the party the work came from.");
  const fund = b.fundId ? await Fund.findOne({ _id: objectId(b.fundId, "fund"), isActive: true }).lean() : null;
  if (b.fundId && !fund) throw new HttpError(400, "Please choose the fund from the list.");

  // A scan can be attached only by the person who uploaded it, and only once.
  let scan = null;
  if (b.scanId) {
    scan = await IntakeScan.findById(objectId(b.scanId, "scan"));
    if (!scan || String(scan.uploadedBy) !== String(req.user.dbId)) throw new HttpError(400, "Scan not found.");
    if (scan.project) throw new HttpError(409, "This scan is already registered.");
  }

  const fy = financialYear(input.appDate);
  if (!b.confirmDuplicate) {
    const dup = await Project.findOne({ financialYear: fy, party: party._id, appNo: input.appNo }).select("serialNo").lean();
    if (dup) throw new HttpError(409, `Application ${input.appNo} from ${party.code} is already registered (Sl. No. ${dup.serialNo}).`, { duplicateOf: dup._id });
  }

  const gstMode = input.gstMode || party.gstMode;
  const charges = await chargesFor({ ...input, km: input.km || 0, gstMode, lumpsumFee: input.lumpsumFee ?? null });
  const { letterRefNo, letterDate, ...fields } = input;

  const session = await mongoose.startSession();
  let project;
  try {
    await session.withTransaction(async () => {
      const serialNo = await nextSequence(`project:${fy}`, session);
      [project] = await Project.create(
        [{
          ...fields,
          financialYear: fy,
          serialNo,
          party: party._id,
          fund: fund?._id || null,
          gstMode,
          charges,
          inward: { letterRefNo: letterRefNo || "", letterDate: letterDate || null, scan: scan?._id || null },
          status: "received",
          statusHistory: [{ from: "", to: "received", by: req.user.dbId }],
          createdBy: req.user.dbId,
        }],
        { session }
      );
      if (scan) {
        scan.project = project._id;
        await scan.save({ session });
      }
      // Remember the names (and the Kannada spelling on the letter) for next time.
      const alias = (v) => str(v, { name: "Name on letter", max: 150 }) || null;
      if (project.contractorName) await learnName("contractor", project.contractorName, alias(b.contractorOnLetter), session);
      if (project.partyEngineer) await learnName("engineer", project.partyEngineer, alias(b.engineerOnLetter), session);
      await audit(req, { action: "project.create", entity: "Project", entityId: project._id, after: { serialNo, appNo: project.appNo, party: party.code, projectBillAmount: project.projectBillAmount } }, session);
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({ success: true, data: project });
};

// ---------------------------------------------------------------- name directory

// Known contractors / engineers for matching names read from letters
// (a few hundred rows; the form matches them in the browser).
export const getDirectory = async (req, res) => {
  const rows = await NameDirectory.find().select("kind name aliases uses -_id").sort({ uses: -1 }).lean();
  res.json({
    success: true,
    data: {
      contractors: rows.filter((r) => r.kind === "contractor"),
      engineers: rows.filter((r) => r.kind === "engineer"),
    },
  });
};

// ---------------------------------------------------------------- read

// Sortable columns of the register / job tables.
const SORTS = { serialNo: "serialNo", appDate: "appDate", bill: "projectBillAmount", planned: "plannedInspectionDate", inspected: "inspectionDate", ward: "ward" };

export const listProjects = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const qy = req.query;
  const filter = { financialYear: str(qy.fy, { name: "Year", max: 7 }) || financialYear() };
  if (qy.status) {
    const wanted = str(qy.status, { name: "Status", max: 120 }).split(",").filter(Boolean);
    filter.status = wanted.length > 1 ? mongoose.trusted({ $in: wanted }) : wanted[0];
  }
  if (qy.party) filter.party = objectId(qy.party, "party");
  if (qy.ward) filter.ward = str(qy.ward, { name: "Ward", max: 20 });
  if (qy.workType) filter.workType = oneOf(qy.workType, WORK_TYPES, { name: "Work type" });
  if (qy.member) filter["team.user"] = objectId(qy.member, "person");
  const from = date(qy.from, { name: "From date" });
  const to = date(qy.to, { name: "To date" });
  if (from || to) filter.appDate = mongoose.trusted({ ...(from ? { $gte: from } : {}), ...(to ? { $lte: new Date(to.getTime() + 86_399_999) } : {}) });
  if (qy.q) {
    const rx = new RegExp(escapeRegex(str(qy.q, { name: "Search", max: 60 })), "i");
    filter.$or = [{ appNo: rx }, { contractorName: rx }, { partyEngineer: rx }, { appDetails: rx }, { fileNo: rx }];
  }
  if (qy.mine === "true") filter.createdBy = req.user.dbId;
  // People without projects.read (faculty) only ever see jobs they are in.
  // "assigned=me" lets anyone ask for just their own jobs.
  if (!hasPermission(req.user.role, "projects.read") || qy.assigned === "me") filter["team.user"] = req.user.dbId;

  const sortField = SORTS[qy.sort] || "serialNo";
  const dir = qy.dir === "asc" || (qy.oldest === "true" && !qy.dir) ? 1 : -1;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .select("serialNo ledgerNo pageNo appNo appDate appDetails party ward fileNo workYear contractorName partyEngineer projectBillAmount charges.invoiceTotal charges.claimed status workType team plannedInspectionDate inspectionDate km report.certificateNo inward.scan createdAt")
      .populate("party", "code")
      .populate("team.user", "name imageUrl")
      .sort({ [sortField]: dir, serialNo: dir })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, page, limit, total });
};

export const getProject = async (req, res) => {
  const project = await Project.findById(objectId(req.params.id))
    .populate("party", "code name gstMode")
    .populate("fund", "name nameEn")
    .populate("team.user", "name designation")
    .populate("createdBy", "name")
    .populate("statusHistory.by", "name");
  if (!project) throw new HttpError(404, "Project not found.");
  const inTeam = project.team.some((m) => String(m.user?._id) === String(req.user.dbId));
  if (!hasPermission(req.user.role, "projects.read") && !inTeam) throw new HttpError(404, "Project not found.");

  // Its bill, the Statement of Bills it went on, and the cheque(s) that paid it.
  let billing = null;
  if (project.bill) {
    const [bill, receipts] = await Promise.all([
      Bill.findById(project.bill).select("number status billDate totals settled group").populate("group", "number status").lean(),
      Receipt.find({ bill: project.bill }).select("number mode instrumentNo instrumentDate bankName receivedOn amount tdsIncomeTax tdsGst otherDeduction status").sort({ receivedOn: 1 }).lean(),
    ]);
    billing = { bill, receipts };
  }
  res.json({ success: true, data: { ...project.toJSON(), billing } });
};

// ---------------------------------------------------------------- coordinator

// Counts per status + each person's open jobs, for the coordinator dashboard.
export const coordinatorSummary = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7 }) || financialYear();
  const [byStatus, workload] = await Promise.all([
    Project.aggregate([{ $match: { financialYear: fy } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Project.aggregate([
      { $match: { status: { $in: ["assigned", "inspected"] } } },
      { $unwind: "$team" },
      { $group: { _id: { user: "$team.user", status: "$status" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.user", byStatus: { $push: { k: "$_id.status", v: "$n" } }, open: { $sum: "$n" } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          user: { _id: "$user._id", name: "$user.name", imageUrl: "$user.imageUrl" },
          open: 1,
          byStatus: { $arrayToObject: "$byStatus" },
        },
      },
      { $sort: { open: -1 } },
    ]),
  ]);
  res.json({
    success: true,
    data: { financialYear: fy, byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])), workload },
  });
};

// Choose the inspection team. Inspectors share the 45% pool, support staff the 10%.
export const assignTeam = async (req, res) => {
  const id = objectId(req.params.id);
  const b = req.body || {};
  if (!Array.isArray(b.team) || b.team.length === 0 || b.team.length > 14) throw new HttpError(400, "Choose between 1 and 14 people.");

  const team = b.team.map((m) => ({
    user: objectId(m?.user, "person"),
    role: oneOf(m?.role, ["inspector", "support"], { name: "Team role", required: true }),
  }));
  const ids = team.map((m) => String(m.user));
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "The same person is listed twice.");
  if (!team.some((m) => m.role === "inspector")) throw new HttpError(400, "At least one inspector is needed.");

  const people = await User.find({ _id: mongoose.trusted({ $in: team.map((m) => m.user) }) })
    .select("name role isActive")
    .lean();
  if (people.length !== team.length) throw new HttpError(400, "Someone in the team was not found.");
  const inactive = people.find((p) => p.isActive === false);
  if (inactive) throw new HttpError(400, `${inactive.name} is deactivated and cannot be assigned.`);

  const project = await Project.findById(id);
  if (!project) throw new HttpError(404, "Project not found.");
  if (!["received", "assigned", "on_hold"].includes(project.status))
    throw new HttpError(409, `The team can't be changed once the job is ${project.status.replace("_", " ")}.`);

  const before = { team: project.team.map((m) => ({ user: String(m.user), role: m.role })), status: project.status };
  const plannedDate = date(b.plannedInspectionDate, { name: "Planned inspection date" });
  project.team = team.map((m) => ({ ...m, assignedBy: req.user.dbId, assignedAt: new Date() }));
  if (plannedDate !== undefined) project.plannedInspectionDate = plannedDate;
  if (project.status !== "assigned") {
    project.statusHistory.push({ from: project.status, to: "assigned", by: req.user.dbId, note: str(b.note, { name: "Note", max: 300 }) || "" });
    project.status = "assigned";
  }
  project.updatedBy = req.user.dbId;
  await project.save();
  await audit(req, { action: "project.assign", entity: "Project", entityId: id, before, after: { team: ids, status: project.status } });

  await project.populate("team.user", "name designation imageUrl");
  res.json({ success: true, data: project });
};

// Move a job along the workflow (STATUS_FLOW in models/Project.js).
// Billing statuses are set by the bill / receipt screens, never here.
export const changeStatus = async (req, res) => {
  const id = objectId(req.params.id);
  const b = req.body || {};
  const to = oneOf(b.to, ["received", "assigned", "inspected", "report_issued", "on_hold", "cancelled"], { name: "Status", required: true });
  const note = str(b.note, { name: "Note", max: 300 }) || "";

  const project = await Project.findById(id);
  if (!project) throw new HttpError(404, "Project not found.");
  const coordinator = hasPermission(req.user.role, "assignments.manage") || hasPermission(req.user.role, "projects.assign");
  if (!coordinator) {
    const inTeam = project.team.some((m) => String(m.user) === String(req.user.dbId));
    if (!inTeam) throw new HttpError(404, "Project not found.");
    if (to !== "inspected") throw new HttpError(403, "Only the coordinator can do this. You can mark your own job inspected.");
  }
  if (!STATUS_FLOW[project.status]?.includes(to))
    throw new HttpError(409, `A job that is ${project.status.replace("_", " ")} can't be moved to ${to.replace("_", " ")}.`);
  if (["on_hold", "cancelled"].includes(to) && !note) throw new HttpError(400, "Please give a reason.");
  if (project.bill) throw new HttpError(409, "This job is on a bill. Cancel the bill first.");
  if (to === "assigned" && !project.team.some((m) => m.role === "inspector")) throw new HttpError(400, "Assign the team first.");

  if (to === "inspected") {
    const when = date(b.inspectionDate, { name: "Inspection date", required: true });
    if (when > new Date()) throw new HttpError(400, "Inspection date can't be in the future.");
    project.inspectionDate = when;
    const km = num(b.km, { name: "KM", max: 2000 });
    if (km !== undefined && km !== project.km) {
      project.km = km; // TA changes the fee split
      project.charges = await chargesFor({
        projectBillAmount: project.projectBillAmount,
        km,
        gstMode: project.gstMode,
        lumpsumFee: project.lumpsumFee,
        appDate: project.appDate,
      });
    }
  }
  if (to === "report_issued") {
    project.report.certificateNo = str(b.certificateNo, { name: "Certificate no.", max: 40 }) || project.report.certificateNo;
    project.report.issuedOn = date(b.issuedOn, { name: "Report date" }) || new Date();
  }

  const from = project.status;
  project.status = to;
  project.statusHistory.push({ from, to, by: req.user.dbId, note });
  project.updatedBy = req.user.dbId;
  await project.save();
  await audit(req, { action: "project.status", entity: "Project", entityId: id, before: { status: from }, after: { status: to }, note });
  res.json({ success: true, data: project });
};

// Counts of the signed-in person's own jobs (faculty dashboard).
export const mySummary = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7 }) || financialYear();
  const rows = await Project.aggregate([
    { $match: { financialYear: fy, "team.user": new mongoose.Types.ObjectId(String(req.user.dbId)) } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  res.json({ success: true, data: { financialYear: fy, byStatus: Object.fromEntries(rows.map((r) => [r._id, r.n])) } });
};
