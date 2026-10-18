// src/models/Distribution.js
// How the fee of ONE paid application is shared out. Made automatically when
// its bill is fully paid, then picked up by a monthly remuneration statement.
//
//   net (fee without GST) - TA = amount
//   amount -> 45% inspectors (equal shares) | 10% accompanying staff (equal)
//             25% administrative & infrastructure | 20% balance
//   balance -> DTE 25, Reserve 10, Student Welfare 15, Staff Welfare 18,
//              Infrastructure 20, WID 5, Environment 2, R&M 2, Contingencies 3
//   TA -> the inspectors (equal shares)

import mongoose from "mongoose";

const money = { type: Number, default: 0 }; // paise

const distributionSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, unique: true },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
    party: { type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true },
    financialYear: { type: String, required: true, index: true }, // of the payment
    paidOn: { type: Date, required: true, index: true },
    appNo: String,
    billNumber: String,
    ruleCode: String,

    fee: money, // what the party paid for this application (net + gst)
    gst: money,
    net: money,
    ta: money,
    amount: money, // net - ta, the amount shared out

    people: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: String,
        role: { type: String, enum: ["inspector", "support"] },
        share: money, // from the 45% or 10% pool
        ta: money,
      },
    ],
    // pools and fund heads: [{ key, label, amount }]
    // keys: inspectors, support, admin_infra, profit, support_unallotted, inspectors_unallotted,
    //       and the balance heads (dte, reserve, student_welfare, ...)
    heads: [{ _id: false, key: String, label: String, amount: money, group: String }],

    // set when a monthly statement takes it; a receipt can only be reversed
    // while none of the bill's distributions is in a statement
    statement: { type: mongoose.Schema.Types.ObjectId, ref: "RemunerationStatement", default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Distribution || mongoose.model("Distribution", distributionSchema);
