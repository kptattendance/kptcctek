// scripts/seed.js
// One-time setup:  ADMIN_EMAIL=you@gmail.com ADMIN_NAME="Your Name" npm run seed
// Safe to run again: parties and users are left as they are; the fee rule is updated.

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Party from "../src/models/Party.js";
import BillingRule from "../src/models/BillingRule.js";
import User from "../src/models/User.js";
import Settings from "../src/models/Settings.js";
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

async function main() {
  await connectDB();

  for (const p of PARTIES) {
    await Party.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  }
  console.log(`Parties: ${await Party.countDocuments()}`);

  // The rule is kept in step with the code (no bills are made under it yet
  // when it changes; later policy changes get a new code instead).
  await BillingRule.updateOne(
    { code: DEFAULT_RULE.code },
    {
      $set: {
        ...DEFAULT_RULE,
        description: "Slabs 0.5/0.7/0.8%, GST 18%, TA Rs 15/km, 45/10/25/20 split, balance in 9 heads (DTE 25%)",
        effectiveFrom: new Date("2025-04-01"),
        isActive: true,
      },
      $unset: { fundAllocation: 1 },
    },
    { upsert: true, runValidators: true }
  );
  console.log(`Billing rule ${DEFAULT_RULE.code} is up to date.`);

  // Details printed on bills; edit them in the app (Billing > Settings).
  await Settings.updateOne({ _id: "cctek" }, { $setOnInsert: { _id: "cctek" } }, { upsert: true });

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
