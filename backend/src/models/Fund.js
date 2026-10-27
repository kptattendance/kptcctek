// src/models/Fund.js
// Where the party's money for a work comes from (ಅನುದಾನ / ನಿಧಿ): MCC General
// Fund, Constituency Development Fund... The party pays one cheque per fund,
// so bills are grouped by fund into a Statement of Bills (BillGroup).

import mongoose from "mongoose";
import Counter from "./Counter.js";

const fundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 }, // printed, usually Kannada
    nameEn: { type: String, trim: true, default: "", maxlength: 120 },
    // Words on a letter that mean this fund, to pick it from a scanned letter.
    keywords: { type: [String], default: [] },
    order: { type: Number, default: 100 }, // position in the dropdown
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Fund = mongoose.models.Fund || mongoose.model("Fund", fundSchema);

// The funds (ಅನುದಾನ) on MCC's letters and the paper Statements of Bills, in
// the letters' order. The Manager adds, renames or hides them in Bill settings.
export const DEFAULT_FUNDS = [
  { name: "ಕ್ಷೇತ್ರಾಭಿವೃದ್ಧಿ ನಿಧಿ", nameEn: "Constituency Development Fund", keywords: ["ಕ್ಷೇತ್ರಾಭಿವೃದ್ಧಿ"] },
  { name: "ಮ.ನ.ಪಾ. ಸದಸ್ಯರ ಅನುದಾನ", nameEn: "Corporator's Grant", keywords: ["ಸದಸ್ಯರ"] },
  { name: "ಎಸ್.ಎಫ್.ಸಿ. ಅನುದಾನ", nameEn: "SFC Grant", keywords: ["ಎಸ್.ಎಫ್.ಸಿ"] },
  { name: "ಮಳೆಹಾನಿ ನಿಧಿ", nameEn: "Rain Damage Fund", keywords: ["ಮಳೆಹಾನಿ", "ಮಳೆ ಹಾನಿ"] },
  { name: "ಪ್ರೀಮಿಯಂ ಎಫ್.ಎ.ಆರ್. ನಿಧಿ", nameEn: "Premium FAR Fund", keywords: ["ಪ್ರೀಮಿಯಂ", "ಎಫ್.ಎ.ಆರ್"] },
  { name: "15ನೇ ಹಣಕಾಸು ನಿಧಿ", nameEn: "15th Finance Commission", keywords: ["15ನೇ ಹಣಕಾಸು", "15 ನೇ ಹಣಕಾಸು"] },
  { name: "ಮಹಾತ್ಮ ಗಾಂಧಿ ನಗರ ವಿಕಾಸ ಯೋಜನೆ", nameEn: "Mahatma Gandhi Nagara Vikasa Yojane", keywords: ["ಮಹಾತ್ಮ ಗಾಂಧಿ", "ಮಹಾತ್ಮಗಾಂಧಿ"] },
  { name: "ಮಹಾಪೌರರ ಅನುದಾನ", nameEn: "Mayor's Grant", keywords: ["ಮಹಾಪೌರರ"] },
  { name: "ಮನಪಾ ಸಾಮಾನ್ಯ ನಿಧಿ", nameEn: "MCC General Fund", keywords: ["ಸಾಮಾನ್ಯ ನಿಧಿ"] },
  { name: "ಮಹಾನಗರಪಾಲಿಕೆ ಅನುದಾನ", nameEn: "MCC Grant", keywords: ["ಮಹಾನಗರಪಾಲಿಕೆ ಅನುದಾನ", "ಮ.ನ.ಪಾ ಅನುದಾನ"] },
  { name: "ಗೇಲ್ ಗ್ಯಾಸ್ ಲಿಮಿಟೆಡ್ ಸಿ.ಎಸ್.ಆರ್. ನಿಧಿ", nameEn: "GAIL Gas Ltd CSR Fund", keywords: ["ಗೇಲ್", "ಸಿ.ಎಸ್.ಆರ್"] },
].map((f, i) => ({ ...f, order: i + 1 }));

// Bump when DEFAULT_FUNDS gains entries; each version is added once, so a
// fund the Manager renamed or hid is not brought back.
const SEED_VERSION = 2;

async function seedFunds() {
  const before = await Counter.findOneAndUpdate({ _id: "seed:funds" }, { $max: { seq: SEED_VERSION } }, { upsert: true, returnDocument: "before" }).lean();
  if ((before?.seq || 0) >= SEED_VERSION) return;
  for (const f of DEFAULT_FUNDS) {
    await Fund.updateOne({ name: f.name }, { $setOnInsert: f }, { upsert: true });
    // funds made before "order" existed (null also matches a missing field)
    await Fund.updateOne({ name: f.name, order: mongoose.trusted({ $in: [100, null] }) }, { $set: { order: f.order } });
  }
}

export async function listFunds({ all = false } = {}) {
  await seedFunds();
  return Fund.find(all ? {} : { isActive: true }).sort({ order: 1, name: 1 }).lean();
}

export default Fund;
