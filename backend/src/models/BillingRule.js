// src/models/BillingRule.js
// Versioned fee policy. A project stores the rule it was calculated with, so
// changing percentages next year never rewrites last year's bills.

import mongoose from "mongoose";
import { validateRule } from "../services/billingService.js";

const percentPart = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    // inspectors | support | fund | profit
    payTo: { type: String, enum: ["inspectors", "support", "fund", "profit"], default: "fund" },
  },
  { _id: false }
);

const billingRuleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    effectiveFrom: { type: Date, required: true },
    slabs: [
      {
        _id: false,
        minAmount: { type: Number, required: true, min: 0 }, // paise
        percent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    gstPercent: { type: Number, default: 18, min: 0, max: 100 },
    taPerKm: { type: Number, default: 1500, min: 0 }, // paise
    shares: [percentPart],
    profitSplit: [percentPart],
    // How the CCTEK share is used (Reserve 10%, Student Welfare 15%, ...)
    fundAllocation: [percentPart],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

billingRuleSchema.pre("validate", function () {
  validateRule(this);
});

const BillingRule = mongoose.models.BillingRule || mongoose.model("BillingRule", billingRuleSchema);

// The rule in force on a date (latest effectiveFrom <= date).
export function ruleForDate(date = new Date()) {
  return BillingRule.findOne({ isActive: true, effectiveFrom: mongoose.trusted({ $lte: date }) })
    .sort({ effectiveFrom: -1 })
    .lean();
}

export default BillingRule;
