// src/models/Counter.js
// Gap-free running numbers (application no., bill no., receipt no.) per
// financial year. findOneAndUpdate with $inc is atomic, so two clerks saving
// at the same moment never get the same number.

import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String }, // e.g. "application:2025-26"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export async function nextSequence(key, session) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, session }
  );
  return doc.seq;
}

// Indian financial year: April to March. 2025-07-10 -> "2025-26"
export function financialYear(date = new Date()) {
  const d = new Date(date);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export default Counter;
