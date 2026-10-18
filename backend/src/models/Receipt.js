// src/models/Receipt.js
// Money received against a bill (cheque / NEFT / DD). Partial payments are
// normal for MCC, so one bill can have many receipts.

import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true }, // "RCT/2025-26/0007"
    financialYear: { type: String, required: true, index: true },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true },
    receivedOn: { type: Date, required: true },
    amount: { type: Number, required: true, min: 1 }, // paise
    tdsDeducted: { type: Number, default: 0, min: 0 }, // paise, deducted by the party
    mode: { type: String, enum: ["neft", "rtgs", "cheque", "dd", "cash", "upi"], required: true },
    reference: { type: String, trim: true, default: "" }, // UTR / cheque no.
    bankName: { type: String, trim: true, default: "" },
    remarks: { type: String, trim: true, default: "" },
    isReversed: { type: Boolean, default: false }, // bounced cheque etc.
    reversedReason: { type: String, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
