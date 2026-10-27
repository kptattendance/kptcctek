// src/models/Fund.js
// Where the party's money for a work comes from (ಅನುದಾನ / ನಿಧಿ): MCC General
// Fund, Constituency Development Fund... The party pays one cheque per fund,
// so bills are grouped by fund into a Statement of Bills (BillGroup).

import mongoose from "mongoose";

const fundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 }, // printed, usually Kannada
    nameEn: { type: String, trim: true, default: "", maxlength: 120 },
    // Words on a letter that mean this fund, to pick it from a scanned letter.
    keywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Fund = mongoose.models.Fund || mongoose.model("Fund", fundSchema);

// The funds on the paper Statements of Bills; the Manager adds more.
export const DEFAULT_FUNDS = [
  { name: "ಮನಪಾ ಸಾಮಾನ್ಯ ನಿಧಿ", nameEn: "MCC General Fund", keywords: ["ಸಾಮಾನ್ಯ ನಿಧಿ"] },
  { name: "ಕ್ಷೇತ್ರಾಭಿವೃದ್ಧಿ ನಿಧಿ", nameEn: "Constituency Development Fund", keywords: ["ಕ್ಷೇತ್ರಾಭಿವೃದ್ಧಿ"] },
];

export async function listFunds({ all = false } = {}) {
  if (!(await Fund.estimatedDocumentCount())) await Fund.insertMany(DEFAULT_FUNDS, { ordered: false }).catch(() => {});
  return Fund.find(all ? {} : { isActive: true }).sort({ name: 1 }).lean();
}

export default Fund;
