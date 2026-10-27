// src/controllers/billGroupController.js
// Statement of Bills: issued bills of one party under one fund, paid with one
// cheque. The cheque is recorded on every bill in the statement (one receipt
// per bill, sharing a batch id), so each bill and application shows it, and
// each bill that becomes fully paid is shared out as usual.
// Also the fund list (ಅನುದಾನ / ನಿಧಿ) used on applications and bills.

import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import BillGroup from "../models/BillGroup.js";
import Fund, { listFunds } from "../models/Fund.js";
import Party from "../models/Party.js";
import Receipt from "../models/Receipt.js";
import { getSettings } from "../models/Settings.js";
import { nextSequence, financialYear } from "../models/Counter.js";
import { audit } from "../models/AuditLog.js";
import { DEFAULT_RULE } from "../services/billingService.js";
import { inTransaction, fundFilter, readReceiptInput, applyReceipt, undoReceipt } from "./billingController.js";
import { HttpError, str, date, objectId, paging, bool } from "../utils/validate.js";

const t = mongoose.trusted;
const pad = (n, w) => String(n).padStart(w, "0");
const endOfDay = (d) => new Date(d.getTime() + 86_399_999);
const OPEN = ["issued", "part_paid"];

// Split `total` paise in proportion to `weights` so the parts add back exactly
// (largest remainder; BigInt so big amounts don't lose paise).
function shareOut(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!total || !sum) return weights.map(() => 0);
  const T = BigInt(total);
  const S = BigInt(sum);
  const parts = weights.map((w, i) => ({ i, q: (T * BigInt(w)) / S, r: (T * BigInt(w)) % S }));
  const out = parts.map((p) => Number(p.q));
  let left = total - out.reduce((a, n) => a + n, 0);
  for (const p of [...parts].sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i))) {
    if (left <= 0) break;
    out[p.i] += 1;
    left -= 1;
  }
  return out;
}

// Keep the statement's totals and status in step with its bills.
async function resettleGroup(group, session) {
  const bills = await Bill.find({ _id: t({ $in: group.bills }) }).select("status settled paidAt").session(session).lean();
  const s = { received: 0, tds: 0, other: 0, total: 0, lastReceiptOn: null };
  for (const b of bills) {
    s.received += b.settled.received;
    s.tds += b.settled.tds;
    s.other += b.settled.other;
    s.total += b.settled.total;
    if (b.settled.lastReceiptOn && (!s.lastReceiptOn || b.settled.lastReceiptOn > s.lastReceiptOn)) s.lastReceiptOn = b.settled.lastReceiptOn;
  }
  group.settled = s;
  const paid = bills.length > 0 && bills.every((b) => b.status === "paid");
  group.status = paid ? "paid" : s.total > 0 ? "part_paid" : "issued";
  group.paidAt = paid ? s.lastReceiptOn : null;
}

const GROUP_POPULATE = [
  { path: "party", select: "code name billingAddress" },
  { path: "createdBy", select: "name" },
  { path: "cancelledBy", select: "name" },
];

// ================================================================ funds

export const getFunds = async (req, res) => {
  res.json({ success: true, data: await listFunds({ all: bool(req.query.all) === true }) });
};

function readFund(b) {
  const keywords = Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(",");
  return {
    name: str(b.name, { name: "Fund name", required: true, max: 120 }),
    nameEn: str(b.nameEn, { name: "English name", max: 120 }) || "",
    keywords: keywords.map((k) => str(k, { name: "Keyword", max: 60 })).filter(Boolean).slice(0, 10),
  };
}

export const createFund = async (req, res) => {
  const input = readFund(req.body || {});
  if (await Fund.exists({ name: input.name })) throw new HttpError(409, `${input.name} is already in the list.`);
  const fund = await Fund.create(input);
  await audit(req, { action: "fund.create", entity: "Fund", entityId: fund._id, after: input });
  res.status(201).json({ success: true, data: fund });
};

export const updateFund = async (req, res) => {
  const id = objectId(req.params.id, "fund");
  const b = req.body || {};
  const input = readFund(b);
  const isActive = bool(b.isActive);
  const before = await Fund.findById(id).lean();
  if (!before) throw new HttpError(404, "Fund not found.");
  if (await Fund.exists({ name: input.name, _id: t({ $ne: id }) })) throw new HttpError(409, `${input.name} is already in the list.`);
  const after = await Fund.findByIdAndUpdate(id, { $set: { ...input, ...(isActive !== undefined ? { isActive } : {}) } }, { returnDocument: "after", runValidators: true }).lean();
  await audit(req, { action: "fund.update", entity: "Fund", entityId: id, before, after });
  res.json({ success: true, data: after });
};

// ================================================================ statements of bills

export const listGroups = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = req.query;
  const filter = {};
  if (q.fy) filter.financialYear = str(q.fy, { name: "Year", max: 7 });
  if (q.party) filter.party = objectId(q.party, "party");
  if (q.fund) filter.fund = fundFilter(q.fund);
  if (q.status) {
    const wanted = str(q.status, { name: "Status", max: 60 }).split(",").filter(Boolean);
    filter.status = wanted.length > 1 ? t({ $in: wanted }) : wanted[0];
  }
  const [items, total] = await Promise.all([
    BillGroup.find(filter).populate("party", "code").populate("createdBy", "name").sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    BillGroup.countDocuments(filter),
  ]);
  res.json({ success: true, data: items.map((g) => g.toJSON()), page, limit, total });
};

// Issued, unpaid bills of a party + fund that are on no statement yet.
export const groupCandidates = async (req, res) => {
  const party = objectId(req.query.party, "party");
  const filter = { party, status: t({ $in: OPEN }), group: null };
  if (req.query.fund !== undefined && req.query.fund !== "") filter.fund = fundFilter(req.query.fund);
  const items = await Bill.find(filter)
    .select("number billDate fund fundName totals settled status lines.appNo lines.description lines.estimateAmount lines.projectBillAmount")
    .sort({ billDate: 1, seq: 1 });
  res.json({ success: true, data: items.map((b) => b.toJSON()) });
};

export const createGroup = async (req, res) => {
  const b = req.body || {};
  const partyId = objectId(b.partyId, "party");
  const fundId = b.fundId ? objectId(b.fundId, "fund") : null;
  const ids = Array.isArray(b.billIds) ? [...new Set(b.billIds.map((x) => objectId(x, "bill")))] : [];
  if (!ids.length) throw new HttpError(400, "Select at least one bill.");
  if (ids.length > 300) throw new HttpError(400, "A statement can have at most 300 bills.");
  const when = date(b.date, { name: "Date" }) || new Date();
  if (when > endOfDay(new Date())) throw new HttpError(400, "Date can't be in the future.");
  const remarks = str(b.remarks, { name: "Remarks", max: 1000 }) || "";

  const group = await inTransaction(async (session) => {
    const bills = await Bill.find({ _id: t({ $in: ids }) }).session(session);
    if (bills.length !== ids.length) throw new HttpError(404, "Some bills were not found.");
    const wrong = bills.filter((x) => !OPEN.includes(x.status) || x.group || String(x.party) !== String(partyId) || String(x.fund || "") !== String(fundId || ""));
    if (wrong.length) throw new HttpError(409, `These can't go on this statement (already paid, on another statement, or another party / fund): ${wrong.map((x) => x.number || "draft").join(", ")}.`);
    const party = await Party.findById(partyId).session(session).lean();
    const fund = fundId ? await Fund.findById(fundId).session(session).lean() : null;
    if (fundId && !fund) throw new HttpError(400, "Fund not found.");

    bills.sort((a, b2) => a.billDate - b2.billDate || (a.seq || 0) - (b2.seq || 0));
    const sum = (f) => bills.reduce((a, x) => a + f(x), 0);
    const lineSum = (k) => sum((x) => x.lines.reduce((a, l) => a + (l[k] || 0), 0));
    const fy = financialYear(when);
    const seq = await nextSequence(`billgroup:${fy}`, session);
    const [doc] = await BillGroup.create(
      [{
        number: `SOB/${fy}/${pad(seq, 3)}`,
        financialYear: fy,
        seq,
        date: when,
        party: party._id,
        partySnapshot: { code: party.code, name: party.name, billingAddress: party.billingAddress },
        fund: fund?._id || null,
        fundName: fund?.name || "",
        bills: bills.map((x) => x._id),
        totals: {
          bills: bills.length,
          estimate: lineSum("estimateAmount"),
          projectBill: lineSum("projectBillAmount"),
          net: sum((x) => x.totals.net),
          gst: sum((x) => x.totals.gst),
          total: sum((x) => x.totals.total),
        },
        remarks,
        createdBy: req.user.dbId,
      }],
      { session }
    );
    await Bill.updateMany({ _id: t({ $in: ids }) }, { $set: { group: doc._id } }, { session });
    await resettleGroup(doc, session); // a bill may already be part paid
    await doc.save({ session });
    await audit(req, { action: "group.create", entity: "BillGroup", entityId: doc._id, after: { number: doc.number, fund: doc.fundName, bills: bills.map((x) => x.number), total: doc.totals.total } }, session);
    return doc;
  });
  res.status(201).json({ success: true, data: group });
};

// Cheques on a statement, one row per cheque (its per-bill receipts summed).
async function groupCheques(groupId) {
  const rows = await Receipt.find({ group: groupId, batch: t({ $ne: null }) }).populate("recordedBy", "name").populate("reversedBy", "name").populate("bill", "number").sort({ receivedOn: 1, createdAt: 1 }).lean();
  const byBatch = new Map();
  for (const r of rows) {
    const k = String(r.batch);
    if (!byBatch.has(k)) {
      byBatch.set(k, {
        batch: k, mode: r.mode, instrumentNo: r.instrumentNo, instrumentDate: r.instrumentDate, bankName: r.bankName, receivedOn: r.receivedOn,
        status: r.status, recordedBy: r.recordedBy, reversedBy: r.reversedBy, reverseReason: r.reverseReason, remarks: r.remarks,
        amount: 0, tdsIncomeTax: 0, tdsGst: 0, otherDeduction: 0, bills: [],
      });
    }
    const c = byBatch.get(k);
    c.amount += r.amount;
    c.tdsIncomeTax += r.tdsIncomeTax;
    c.tdsGst += r.tdsGst;
    c.otherDeduction += r.otherDeduction;
    c.bills.push({ bill: r.bill?.number, receipt: r.number, amount: r.amount, settles: r.amount + r.tdsIncomeTax + r.tdsGst + r.otherDeduction });
  }
  return [...byBatch.values()];
}

export const getGroup = async (req, res) => {
  const doc = await BillGroup.findById(objectId(req.params.id)).populate(GROUP_POPULATE);
  if (!doc) throw new HttpError(404, "Statement not found.");
  const [bills, cheques, settings] = await Promise.all([
    Bill.find({ _id: t({ $in: doc.bills }) })
      .select("number billDate status totals settled sentOn lines.project lines.appNo lines.description lines.estimateAmount lines.projectBillAmount lines.total")
      .sort({ billDate: 1, seq: 1 }),
    groupCheques(doc._id),
    getSettings(),
  ]);
  res.json({
    success: true,
    data: { ...doc.toJSON(), bills: bills.map((x) => x.toJSON()), cheques },
    settings,
    slabs: DEFAULT_RULE.slabs,
  });
};

// One cheque for the statement: spread over its unpaid bills in proportion to
// what each still owes, and recorded on each of them.
export const recordGroupReceipt = async (req, res) => {
  const id = objectId(req.params.id);
  const input = readReceiptInput(req.body || {});
  const out = await inTransaction(async (session) => {
    const group = await BillGroup.findById(id).session(session);
    if (!group) throw new HttpError(404, "Statement not found.");
    if (!OPEN.includes(group.status)) throw new HttpError(409, group.status === "paid" ? "This statement is already fully paid." : "This statement is cancelled.");
    if (await Receipt.exists({ group: id, status: "active", instrumentNo: input.instrumentNo }).session(session))
      throw new HttpError(409, `Cheque / reference ${input.instrumentNo} is already recorded on this statement.`);

    const bills = (await Bill.find({ _id: t({ $in: group.bills }), status: t({ $in: OPEN }) }).session(session))
      .map((b) => ({ b, due: b.totals.total - b.settled.total }))
      .filter((x) => x.due > 0)
      .sort((x, y) => x.b.billDate - y.b.billDate || (x.b.seq || 0) - (y.b.seq || 0));
    const due = bills.reduce((a, x) => a + x.due, 0);
    const settles = input.amount + input.tdsIncomeTax + input.tdsGst + input.otherDeduction;
    if (!due) throw new HttpError(409, "Nothing is due on this statement.");
    if (settles > due) throw new HttpError(400, `This settles ₹${(settles / 100).toFixed(2)} but only ₹${(due / 100).toFixed(2)} is due on the statement.`);

    const shares = shareOut(settles, bills.map((x) => x.due));
    const split = (k) => shareOut(input[k], shares);
    const tdsIncomeTax = split("tdsIncomeTax");
    const tdsGst = split("tdsGst");
    const otherDeduction = split("otherDeduction");
    const batch = new mongoose.Types.ObjectId();
    const perBill = [];
    for (let i = 0; i < bills.length; i++) {
      if (!shares[i]) continue;
      const amount = shares[i] - tdsIncomeTax[i] - tdsGst[i] - otherDeduction[i];
      if (amount < 0) throw new HttpError(400, "The deductions are too large to split across the bills. Check the amounts.");
      const slice = { ...input, amount, tdsIncomeTax: tdsIncomeTax[i], tdsGst: tdsGst[i], otherDeduction: otherDeduction[i] };
      const r = await applyReceipt(req, bills[i].b, slice, session, { group: group._id, batch });
      perBill.push({ bill: bills[i].b.number, receipt: r.receipt.number, settles: shares[i], paid: r.paid });
    }
    await resettleGroup(group, session);
    await group.save({ session });
    await audit(req, { action: "group.receipt", entity: "BillGroup", entityId: group._id, after: { number: group.number, ...input, bills: perBill } }, session);
    return { group, bills: perBill };
  });
  res.status(201).json({ success: true, data: out });
};

// Undo a cheque on every bill of the statement (bounced cheque / wrong entry).
export const reverseGroupReceipt = async (req, res) => {
  const id = objectId(req.params.id);
  const batch = objectId(req.params.batch, "cheque");
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const out = await inTransaction(async (session) => {
    const group = await BillGroup.findById(id).session(session);
    if (!group) throw new HttpError(404, "Statement not found.");
    const receipts = await Receipt.find({ group: id, batch, status: "active" }).session(session);
    if (!receipts.length) throw new HttpError(404, "Cheque not found or already reversed.");
    for (const r of receipts) await undoReceipt(req, r, reason, session);
    await resettleGroup(group, session);
    await group.save({ session });
    await audit(req, { action: "group.reverse", entity: "BillGroup", entityId: group._id, before: { cheque: receipts[0].instrumentNo, receipts: receipts.map((r) => r.number) }, after: { status: group.status }, note: reason }, session);
    return group;
  });
  res.json({ success: true, data: out });
};

export const markGroupSent = async (req, res) => {
  const b = req.body || {};
  const doc = await BillGroup.findById(objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Statement not found.");
  if (doc.status === "cancelled") throw new HttpError(409, "This statement is cancelled.");
  const before = { sentOn: doc.sentOn, dispatchRef: doc.dispatchRef };
  doc.sentOn = date(b.sentOn, { name: "Sent on", required: true });
  doc.dispatchRef = str(b.dispatchRef, { name: "Dispatch ref.", max: 120 }) || "";
  await doc.save();
  await audit(req, { action: "group.sent", entity: "BillGroup", entityId: doc._id, before, after: { sentOn: doc.sentOn, dispatchRef: doc.dispatchRef } });
  res.json({ success: true, data: doc });
};

// Undo the grouping; the bills stay issued and can go on another statement.
export const cancelGroup = async (req, res) => {
  const id = objectId(req.params.id);
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const out = await inTransaction(async (session) => {
    const doc = await BillGroup.findById(id).session(session);
    if (!doc) throw new HttpError(404, "Statement not found.");
    if (doc.status === "cancelled") throw new HttpError(409, "Already cancelled.");
    if (await Receipt.exists({ group: id, status: "active" }).session(session)) throw new HttpError(409, "Reverse the cheques recorded on this statement first.");
    Object.assign(doc, { status: "cancelled", cancelledBy: req.user.dbId, cancelledAt: new Date(), cancelReason: reason });
    await doc.save({ session });
    await Bill.updateMany({ group: id }, { $set: { group: null } }, { session });
    await audit(req, { action: "group.cancel", entity: "BillGroup", entityId: doc._id, before: { status: "issued" }, after: { status: "cancelled" }, note: reason }, session);
    return doc;
  });
  res.json({ success: true, data: out });
};
