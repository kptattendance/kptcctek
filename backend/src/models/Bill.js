// src/models/Bill.js
// A service bill sent to one party, covering one or more reported projects.
// Once approved, its lines and totals are frozen; corrections are made by
// cancelling and re-issuing, never by editing (audit-safe).

import mongoose from "mongoose";

export const BILL_STATUSES = ["draft", "approved", "sent", "partially_paid", "paid", "cancelled"];

const money = { type: Number, default: 0, min: 0 }; // paise

const billLineSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    appNo: String,
    certificateNo: String,
    contractorName: String,
    projectBillAmount: money,
    servicePercent: Number,
    net: money,
    gst: money,
    total: money,
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, unique: true }, // "CCTEK/2025-26/0042"
    financialYear: { type: String, required: true, index: true },
    billDate: { type: Date, required: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true, index: true },
    gstMode: { type: String, enum: ["inclusive", "exclusive"], required: true },
    lines: { type: [billLineSchema], validate: [(v) => v.length > 0, "A bill needs at least one project."] },

    subtotal: money, // sum of net
    gstTotal: money,
    grandTotal: money, // what the party pays
    amountReceived: money,

    status: { type: String, enum: BILL_STATUSES, default: "draft", index: true },
    pdfUrl: { type: String, default: "" },
    pdfPublicId: { type: String, default: "" },

    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true }
);

billSchema.virtual("balance").get(function () {
  return Math.max(0, this.grandTotal - this.amountReceived);
});
billSchema.set("toJSON", { virtuals: true });

export default mongoose.models.Bill || mongoose.model("Bill", billSchema);
