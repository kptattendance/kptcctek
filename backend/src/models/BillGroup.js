// src/models/BillGroup.js
// Statement of Bills: issued bills of one party under one fund, listed
// together so the party pays them with one cheque (as on the paper
// "STATEMENT OF BILLS (2023-24)"). The cheque entered here is recorded on
// every bill in it, so each bill and application shows the cheque number.
//
//   issued -> part_paid -> paid
//   issued (nothing received) -> cancelled (its bills are free again)

import mongoose from "mongoose";

const money = { type: Number, default: 0, min: 0 }; // paise

const billGroupSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true }, // SOB/2026-27/001
    financialYear: { type: String, required: true, index: true },
    seq: { type: Number, required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["issued", "part_paid", "paid", "cancelled"], default: "issued", index: true },

    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true, index: true },
    partySnapshot: { code: String, name: String, billingAddress: String },
    fund: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null, index: true },
    fundName: { type: String, default: "" },

    bills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill" }],
    totals: {
      bills: { type: Number, default: 0 },
      estimate: money,
      projectBill: money,
      net: money,
      gst: money,
      total: money, // what the party pays: sum of the bills
    },
    // kept in step with its bills
    settled: {
      received: money,
      tds: money,
      other: money,
      total: money,
      lastReceiptOn: { type: Date, default: null },
    },

    remarks: { type: String, trim: true, default: "", maxlength: 1000 },
    sentOn: { type: Date, default: null },
    dispatchRef: { type: String, trim: true, default: "", maxlength: 120 },
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

billGroupSchema.virtual("outstanding").get(function () {
  if (this.status === "cancelled") return 0;
  return Math.max(0, (this.totals?.total || 0) - (this.settled?.total || 0));
});
billGroupSchema.set("toJSON", { virtuals: true });

export default mongoose.models.BillGroup || mongoose.model("BillGroup", billGroupSchema);
