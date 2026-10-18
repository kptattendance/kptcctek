// src/models/RemunerationStatement.js
// The monthly "Resource Persons Remuneration Bill": all applications paid up
// to the month end and not yet shared out, with the amount for every person
// and every fund head. The totals are calculated by the server from the
// distributions; nobody types them, so the May-2023 kind of slip (GST left in
// the total) cannot happen.
//
//   draft (prepared) -> approved (by Principal / Manager, never the preparer)
//                    -> disbursed (paid out)
//   draft -> cancelled (its applications go back to "waiting")

import mongoose from "mongoose";

const money = { type: Number, default: 0 }; // paise

const statementSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // REM/2026-27/01
    financialYear: { type: String, required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // 2026-10
    status: { type: String, enum: ["draft", "approved", "disbursed", "cancelled"], default: "draft", index: true },

    distributions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Distribution" }],
    totals: {
      applications: { type: Number, default: 0 },
      fee: money, // net + gst
      gst: money,
      net: money,
      ta: money,
      amount: money,
    },
    people: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: String,
        designation: String,
        inspector: money, // from the 45% pool
        support: money, // from the 10% pool
        ta: money,
        total: money,
        jobs: { type: Number, default: 0 },
      },
    ],
    heads: [{ _id: false, key: String, label: String, amount: money, group: String }],

    remarks: { type: String, trim: true, default: "", maxlength: 1000 },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    disbursedAt: { type: Date, default: null },
    disbursedRef: { type: String, trim: true, default: "" }, // cheque / transfer reference
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.RemunerationStatement || mongoose.model("RemunerationStatement", statementSchema);
