// scripts/importNames.js
// Fill the contractor / engineer name directory from the old Excel register.
//
//   node scripts/importNames.js "C:\path\Register.xlsx" --dry   (preview only)
//   node scripts/importNames.js "C:\path\Register.xlsx"         (save)
//
// Which column holds what changed over the years:
//   2018-19 .. 2022-23   "Engg Name" = engineers, "Contractor Name" = contractors
//   2023-24              mixed in both columns
//   2024-25 onward       swapped: "Engg Name" = contractors, "Contractor Name" = engineers
// For the mixed year a name is only filed if the clear years already know it
// as a contractor or an engineer; otherwise it is skipped, not guessed.
// Several spellings of the same person are merged; the most used one wins.

import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";
import connectDB from "../src/config/db.js";
import NameDirectory, { nameKeyOf } from "../src/models/NameDirectory.js";

dotenv.config({ quiet: true });

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/importNames.js "Register.xlsx" [--dry]');
  process.exit(1);
}
const dry = flag === "--dry";

const tidy = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const usable = (v) => v.length >= 3 && /[a-z]/i.test(v) && !/^(nil|na|n\/a|-+|bill (prepared|recieved|received)|pending bill)$/i.test(v);

const wb = XLSX.readFile(file);
const counts = { contractor: new Map(), engineer: new Map() }; // key -> Map(spelling -> n)

const add = (kind, name) => {
  const key = nameKeyOf(name);
  const spellings = counts[kind].get(key) || new Map();
  spellings.set(name, (spellings.get(name) || 0) + 1);
  counts[kind].set(key, spellings);
};

const mixed = []; // names from the mixed year, resolved once the clear years are read
for (const sheetName of wb.SheetNames) {
  const startYear = parseInt(sheetName, 10);
  if (!startYear) continue;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  const headerAt = rows.findIndex((r) => r.some((c) => tidy(c).toLowerCase() === "engg name"));
  if (headerAt < 0) continue;
  const header = rows[headerAt].map((c) => tidy(c).toLowerCase());
  const colL = header.indexOf("engg name");
  const colM = header.indexOf("contractor name");
  let n = 0;
  for (const row of rows.slice(headerAt + 1)) {
    const l = tidy(row[colL]);
    const m = tidy(row[colM]);
    if (startYear <= 2022) {
      if (usable(l)) (add("engineer", l), n++);
      if (usable(m)) (add("contractor", m), n++);
    } else if (startYear >= 2024) {
      if (usable(l)) (add("contractor", l), n++);
      if (usable(m)) (add("engineer", m), n++);
    } else {
      for (const v of [l, m]) if (usable(v)) mixed.push(v);
    }
  }
  console.log(`${sheetName}: ${startYear === 2023 ? "mixed columns, resolved below" : `${n} names`}`);
}

let resolved = 0;
let skipped = 0;
for (const name of mixed) {
  const key = nameKeyOf(name);
  const asC = counts.contractor.has(key);
  const asE = counts.engineer.has(key);
  if (asC === asE) {
    skipped++;
    continue; // unknown, or known as both
  }
  add(asC ? "contractor" : "engineer", name);
  resolved++;
}
console.log(`2023-2024: ${resolved} names filed by matching known people, ${skipped} skipped`);

const entries = [];
for (const kind of ["contractor", "engineer"]) {
  for (const [key, spellings] of counts[kind]) {
    const [name] = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0];
    const uses = [...spellings.values()].reduce((a, b) => a + b, 0);
    entries.push({ kind, key, name, uses });
  }
}
const top = (kind) => entries.filter((e) => e.kind === kind).sort((a, b) => b.uses - a.uses);
console.log(`\nContractors: ${top("contractor").length}, engineers: ${top("engineer").length}`);
console.log("Top contractors:", top("contractor").slice(0, 8).map((e) => `${e.name} (${e.uses})`).join(", "));
console.log("Top engineers:  ", top("engineer").slice(0, 8).map((e) => `${e.name} (${e.uses})`).join(", "));

if (dry) {
  console.log("\n--dry: nothing saved.");
  process.exit(0);
}

await connectDB();
const ops = entries.map((e) => ({
  updateOne: {
    filter: { kind: e.kind, key: e.key },
    update: { $setOnInsert: { kind: e.kind, key: e.key, name: e.name }, $max: { uses: e.uses } },
    upsert: true,
  },
}));
const res = await NameDirectory.bulkWrite(ops, { ordered: false });
console.log(`\nSaved: ${res.upsertedCount} new, ${res.modifiedCount} updated.`);
await mongoose.disconnect();
