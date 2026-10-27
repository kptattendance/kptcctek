// src/models/Bill.js
// A service bill sent to one party for one or more inspected applications.
//
//   draft  -> issued (gets its number CCTEK/2026-27/0001, applications become "billed")
//   issued -> part_paid -> paid (receipts; applications become "paid" and are
//             handed to distribution)
//   draft / issued (nothing received) -> cancelled (applications go back to "ready to bill")
//
// Usually one application per bill. Issued bills of one party and one fund
// are put on a Statement of Bills (BillGroup) and paid with one cheque there.
//
// Every line is a frozen copy of the application's fee, so a later change to
// the application or the fee rule never changes a bill already sent.

import mongoose from "mongoose";

export const BILL_STATUSES = ["draft", "issued", "part_paid", "paid", "cancelled"];

const money = { type: Number, default: 0, min: 0 }; // paise

const lineSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    appNo: String,
    appDate: Date,
    ward: String,
    fileNo: String,
    workYear: String,
    description: String,
    contractorName: String,
    certificateNo: String,
    letterRefNo: String, // the party's letter (ಉಲ್ಲೇಖ)
    letterDate: Date,
    estimateAmount: { type: Number, default: null }, // ಅಂದಾಜು ಪಟ್ಟಿ ಮೊತ್ತ
    projectBillAmount: money,
    servicePercent: Number, // null when lumpsum
    lumpsum: Boolean,
    ruleCode: String,
    net: money, // fee without GST
    gst: money,
    total: money, // net + gst, what the party pays for this line
    km: Number,
    ta: money,
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    number: { type: String, default: null }, // set on issue: ಸಂ.ಕೆಪಿಎಂ/ಸಿಸಿಟೆಕ್/3ನೇ ಪಾರ್ಟಿ ತಪಾಸಣೆ/2026-27/895
    financialYear: { type: String, default: null },
    seq: { type: Number, default: null }, // the running number at the end
    status: { type: String, enum: BILL_STATUSES, default: "draft", index: true },

    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true, index: true },
    fund: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null, index: true },
    fundName: { type: String, default: "" },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "BillGroup", default: null, index: true }, // Statement of Bills
    // copy of the party at issue time (the printed bill must not change)
    partySnapshot: {
      code: String,
      name: String,
      billingAddress: String,
      gstin: String,
    },
    gstMode: { type: String, enum: ["inclusive", "exclusive"], required: true },
    billDate: { type: Date, required: true },
    dueDate: { type: Date, default: null },
    subject: { type: String, trim: true, default: "", maxlength: 300 },
    remarks: { type: String, trim: true, default: "", maxlength: 1000 },

    lines: { type: [lineSchema], validate: [(v) => v.length > 0, "A bill needs at least one application."] },
    totals: {
      net: money,
      cgst: money,
      sgst: money,
      gst: money,
      total: money,
    },
    // kept in step by the receipts controller
    settled: {
      received: money, // money that reached the bank
      tds: money, // income-tax TDS + GST TDS deducted by the party
      other: money, // other deductions
      total: money, // received + tds + other
      lastReceiptOn: { type: Date, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    issuedAt: { type: Date, default: null },
    sentOn: { type: Date, default: null }, // date given to the party / dispatched
    dispatchRef: { type: String, trim: true, default: "", maxlength: 120 },
    paidAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

billSchema.index({ number: 1 }, { unique: true, partialFilterExpression: { number: { $type: "string" } } });
// the running number is unique within a year (the date in the number may differ)
billSchema.index({ financialYear: 1, seq: 1 }, { unique: true, partialFilterExpression: { seq: { $type: "number" } } });
billSchema.index({ financialYear: 1, status: 1 });
billSchema.index({ billDate: -1 });

billSchema.virtual("outstanding").get(function () {
  if (["draft", "cancelled"].includes(this.status)) return 0;
  return Math.max(0, (this.totals?.total || 0) - (this.settled?.total || 0));
});
billSchema.set("toJSON", { virtuals: true });

export default mongoose.models.Bill || mongoose.model("Bill", billSchema);
