// src/models/Receipt.js
// Money received against a bill: usually a cheque from the party.
// A receipt is never edited or deleted. A wrong entry or a bounced cheque is
// "reversed" with a reason, and the bill goes back to unpaid.

import mongoose from "mongoose";

export const RECEIPT_MODES = ["cheque", "dd", "neft", "rtgs", "upi", "other"];

const money = { type: Number, default: 0, min: 0 }; // paise

const receiptSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // RCPT/2026-27/0001
    financialYear: { type: String, required: true, index: true },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true, index: true },

    mode: { type: String, enum: RECEIPT_MODES, default: "cheque" },
    instrumentNo: { type: String, trim: true, required: true, maxlength: 40 }, // cheque / UTR number
    instrumentDate: { type: Date, required: true }, // date on the cheque
    bankName: { type: String, trim: true, default: "", maxlength: 120 },
    receivedOn: { type: Date, required: true, index: true }, // date the office got it

    amount: { ...money, required: true }, // cheque amount
    tdsIncomeTax: money, // TDS u/s 194J deducted by the party
    tdsGst: money, // GST TDS deducted by the party
    otherDeduction: money,
    remarks: { type: String, trim: true, default: "", maxlength: 500 },

    status: { type: String, enum: ["active", "reversed"], default: "active", index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversedAt: { type: Date, default: null },
    reverseReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

receiptSchema.virtual("settles").get(function () {
  return (this.amount || 0) + (this.tdsIncomeTax || 0) + (this.tdsGst || 0) + (this.otherDeduction || 0);
});
receiptSchema.set("toJSON", { virtuals: true });

export default mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
