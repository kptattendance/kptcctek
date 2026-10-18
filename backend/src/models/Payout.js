// src/models/Payout.js
// Monthly "Resource Persons Remuneration Bill": distribution of PAID
// projects' shares among inspectors, support staff, funds, DTE and CCTEK.
// Replaces the per-month sheets (Apr 23, May 23, ...) and the per-person
// summary (Sheet14 / VM TDS / VM TA).
//
// A project is paid out once: its id is stored here, and a unique index on
// lines.project prevents paying the same job twice.

import mongoose from "mongoose";

const payoutLineSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    amount: { type: Number, required: true }, // U, paise
    ta: { type: Number, default: 0 },
  },
  { _id: false }
);

const personShareSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pool: { type: String, enum: ["inspectors", "support"], required: true },
    gross: { type: Number, default: 0 }, // paise
    ta: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
  },
  { _id: false }
);

const payoutSchema = new mongoose.Schema(
  {
    period: { type: String, required: true }, // "2025-07"
    financialYear: { type: String, required: true, index: true },
    lines: [payoutLineSchema],
    people: [personShareSchema],
    // fund / profit totals by rule key: admin_infra, dte, cctek, reserve...
    funds: { type: Map, of: Number, default: {} },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "approved", "disbursed", "cancelled"], default: "draft" },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: Date,
  },
  { timestamps: true }
);

payoutSchema.index(
  { "lines.project": 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["draft", "approved", "disbursed"] } } }
);

export default mongoose.models.Payout || mongoose.model("Payout", payoutSchema);
