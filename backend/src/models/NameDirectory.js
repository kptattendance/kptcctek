// src/models/NameDirectory.js
// Known contractors and party engineers, with the Kannada spellings seen on
// letters. Seeded from the old Excel register (scripts/importNames.js) and
// learnt every time staff confirm a name, so the same Kannada name is filled
// in automatically next time.

import mongoose from "mongoose";

export const nameKeyOf = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const nameDirectorySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["contractor", "engineer"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 }, // English, as in the register
    key: { type: String, required: true }, // nameKeyOf(name)
    aliases: { type: [String], default: [] }, // Kannada spellings from letters
    uses: { type: Number, default: 0 },
  },
  { timestamps: true }
);

nameDirectorySchema.index({ kind: 1, key: 1 }, { unique: true });

const NameDirectory = mongoose.models.NameDirectory || mongoose.model("NameDirectory", nameDirectorySchema);

// Record a confirmed name (+ the Kannada text it came from).
export async function learnName(kind, name, alias, session) {
  const key = nameKeyOf(name);
  if (!key) return;
  const update = { $setOnInsert: { kind, name: String(name).trim(), key }, $inc: { uses: 1 } };
  if (alias) update.$addToSet = { aliases: String(alias).trim().slice(0, 150) };
  await NameDirectory.updateOne({ kind, key }, update, { upsert: true, session });
}

export default NameDirectory;
