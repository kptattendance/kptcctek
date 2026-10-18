// src/models/User.js

import mongoose from "mongoose";

import { ROLES } from "../config/roles.js";

const userSchema = new mongoose.Schema(
  {
    // Empty until the person's first Google sign-in; the admin registers the
    // email first and the account is linked by verified email on first login.
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      trim: true,
      required: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    role: {
      type: String,
      enum: ROLES,
      required: true,
    },

    // Switch off to block access immediately (no delete; history stays).
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },

    // For remuneration statements and TDS
    pan: { type: String, trim: true, uppercase: true, default: "", match: [/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN"] },

    department: {
      type: String,
      enum: [
        "at",
        "ch",
        "ce",
        "cs",
        "ec",
        "ee",
        "me",
        "ps",
        "sc",
        "ot",
        "",
      ],
      default: "",
    },

    // Lecturer, Senior / Selection Grade Lecturer, HOD, Vice-Principal, Principal, Guest Lecturer (see DESIGNATIONS)
    designation: { type: String, trim: true, default: "" },

    // The examiner's institution. Empty = our own college (see collegeOf)
    collegeCode: { type: String, trim: true, default: "" },
    collegeName: { type: String, trim: true, default: "" },

    imageUrl: {
      type: String,
      default: "",
    },

    imagePublicId: {
      type: String,
      default: "",
    },
  },

  {
    timestamps: true,
  }
);

export const DESIGNATIONS = [
  "Lecturer",
  "Senior Grade Lecturer",
  "Selection Grade Lecturer",
  "HOD",
  "Vice-Principal",
  "Principal",
  "Guest Lecturer",
  "Office Superintendent",
  "Accounts Staff",
  "Technical Staff",
  "Office Staff",
];

// Codes stored in `department`, with the names shown in forms.
export const DEPARTMENTS = [
  { code: "ce", label: "Civil Engineering" },
  { code: "me", label: "Mechanical Engineering" },
  { code: "ee", label: "Electrical & Electronics Engineering" },
  { code: "ec", label: "Electronics & Communication" },
  { code: "cs", label: "Computer Science" },
  { code: "at", label: "Automobile Engineering" },
  { code: "ch", label: "Chemical Engineering" },
  { code: "ps", label: "Polymer Science" },
  { code: "sc", label: "Science" },
  { code: "ot", label: "Office / Other" },
];

// "SELECTION GRADE LECTURER" / "selection grade" -> "Selection Grade Lecturer";
// "" stays ""; anything else -> null (invalid)
export function normalizeDesignation(value) {
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!v) return "";
  if (v.startsWith("selection")) return "Selection Grade Lecturer";
  if (v.startsWith("senior")) return "Senior Grade Lecturer";
  if (v === "lecturer") return "Lecturer";
  if (v === "hod" || v === "head of department" || v === "head of the department") return "HOD";
  if (v === "vice principal" || v === "vp") return "Vice-Principal";
  if (v === "principal") return "Principal";
  if (v === "guest lecturer" || v === "guest faculty") return "Guest Lecturer";
  const exact = DESIGNATIONS.find((d) => d.toLowerCase() === v);
  if (exact) return exact;
  return null;
}

// Everyone already in the database is from our college
export const HOME_COLLEGE = { code: "103", name: "Karnataka (Govt.) Polytechnic, Mangaluru" };
export const collegeOf = (u) =>
  !u?.collegeCode || u.collegeCode === HOME_COLLEGE.code
    ? { ...HOME_COLLEGE, external: false }
    : { code: u.collegeCode, name: u.collegeName || "", external: true };

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

export default User;