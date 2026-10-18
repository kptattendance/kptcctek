// scripts/seed.js
// One-time setup:  ADMIN_EMAIL=you@gmail.com ADMIN_NAME="Your Name" npm run seed
// Safe to run again: existing records are left as they are.

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Party from "../src/models/Party.js";
import BillingRule from "../src/models/BillingRule.js";
import User from "../src/models/User.js";
import { DEFAULT_RULE } from "../src/services/billingService.js";

dotenv.config();

// GST mode seen in the 2025-26 register: MCC carves GST out of the fee,
// direct clients pay GST on top. Check these and edit in the app later.
const PARTIES = [
  { code: "MCC", name: "Mangaluru City Corporation", gstMode: "inclusive" },
  { code: "MCC-ENV", name: "Mangaluru City Corporation - Environment", gstMode: "inclusive" },
  { code: "PILIKULA", name: "Pilikula", gstMode: "exclusive" },
  { code: "KATEELU", name: "Kateelu", gstMode: "exclusive" },
  { code: "NMPA", name: "New Mangalore Port Authority", gstMode: "inclusive" },
  { code: "AMBEDKAR", name: "Ambedkar", gstMode: "inclusive" },
  { code: "VENLOC", name: "Venloc", gstMode: "inclusive" },
];

// CCTEK share use, from the monthly remuneration sheets.
const FUND_ALLOCATION = [
  { key: "reserve", label: "Reserve", percent: 10 / 0.75 },
  { key: "student_welfare", label: "Student Welfare", percent: 15 / 0.75 },
  { key: "staff_welfare", label: "Staff Welfare", percent: 18 / 0.75 },
  { key: "infrastructure", label: "Infrastructure", percent: 20 / 0.75 },
  { key: "wid", label: "WID", percent: 5 / 0.75 },
  { key: "environment", label: "Environment", percent: 2 / 0.75 },
  { key: "repair", label: "Repair & Maintenance", percent: 2 / 0.75 },
  { key: "contingency", label: "Contingencies", percent: 3 / 0.75 },
];

async function main() {
  await connectDB();

  for (const p of PARTIES) {
    await Party.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  }
  console.log(`Parties: ${await Party.countDocuments()}`);

  if (!(await BillingRule.exists({ code: DEFAULT_RULE.code }))) {
    await BillingRule.create({
      ...DEFAULT_RULE,
      description: "Slabs 0.5/0.7/0.8%, GST 18%, TA Rs 15/km, 45/10/25/20 split, profit 25% DTE / 75% CCTEK",
      effectiveFrom: new Date("2025-04-01"),
      fundAllocation: FUND_ALLOCATION,
    });
    console.log(`Billing rule ${DEFAULT_RULE.code} created.`);
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email) {
    const res = await User.updateOne(
      { email },
      { $setOnInsert: { email, name: process.env.ADMIN_NAME || "CCTEK Admin", role: "admin", isActive: true } },
      { upsert: true }
    );
    console.log(res.upsertedCount ? `Admin ${email} registered. Sign in with that Google account.` : `${email} already exists.`);
  } else {
    console.log("Set ADMIN_EMAIL to register the first admin.");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
