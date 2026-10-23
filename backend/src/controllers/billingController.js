// src/controllers/billingController.js
// Bills -> cheques (receipts) -> automatic distribution -> monthly
// remuneration statement -> approval -> disbursement. Plus the overview
// for Admin / Manager / Principal.
//
// Every money change runs in a transaction and writes an audit entry.

import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Receipt, { RECEIPT_MODES } from "../models/Receipt.js";
import Distribution from "../models/Distribution.js";
import RemunerationStatement from "../models/RemunerationStatement.js";
import Project from "../models/Project.js";
import Party from "../models/Party.js";
import User from "../models/User.js";
import Settings, { getSettings } from "../models/Settings.js";
import { ruleByCode } from "../models/BillingRule.js";
import { nextSequence, financialYear } from "../models/Counter.js";
import { audit } from "../models/AuditLog.js";
import { DEFAULT_RULE } from "../services/billingService.js";
import { distribute, summarise } from "../services/distributionService.js";
import { hasPermission } from "../config/roles.js";
import {
  HttpError, str, oneOf, rupees, date, compact, objectId, escapeRegex, paging, email,
} from "../utils/validate.js";

const t = mongoose.trusted;
const pad = (n, w) => String(n).padStart(w, "0");
const endOfDay = (d) => new Date(d.getTime() + 86_399_999);

async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

function pushStatus(project, to, by, note = "") {
  const from = project.status;
  project.status = to;
  project.statusHistory.push({ from, to, by, note });
  project.updatedBy = by;
}

// ================================================================ ready to bill

// Jobs whose report is issued and that are not on any bill yet (all years).
export const readyToBill = async (req, res) => {
  const filter = { status: "report_issued", bill: null };
  if (req.query.party) filter.party = objectId(req.query.party, "party");
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(str(req.query.q, { name: "Search", max: 60 })), "i");
    filter.$or = [{ appNo: rx }, { contractorName: rx }, { fileNo: rx }, { ward: rx }, { "report.certificateNo": rx }];
  }
  const items = await Project.find(filter)
    .select("serialNo financialYear appNo appDate appDetails party ward fileNo workYear contractorName projectBillAmount km charges report inspectionDate team")
    .populate("party", "code name gstMode")
    .populate("team.user", "name")
    .sort({ "report.issuedOn": 1, serialNo: 1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: items, total: items.length });
};

// ================================================================ bills

const BILL_POPULATE = [
  { path: "party", select: "code name billingAddress gstin gstMode" },
  { path: "createdBy", select: "name" },
  { path: "issuedBy", select: "name" },
  { path: "cancelledBy", select: "name" },
];

export const listBills = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = req.query;
  const filter = {};
  if (q.fy) filter.$or = [{ financialYear: str(q.fy, { name: "Year", max: 7 }) }, { financialYear: null }];
  if (q.party) filter.party = objectId(q.party, "party");
  if (q.status) {
    const wanted = str(q.status, { name: "Status", max: 80 }).split(",").filter(Boolean);
    filter.status = wanted.length > 1 ? t({ $in: wanted }) : wanted[0];
  }
  const from = date(q.from, { name: "From date" });
  const to = date(q.to, { name: "To date" });
  if (from || to) filter.billDate = t({ ...(from ? { $gte: from } : {}), ...(to ? { $lte: endOfDay(to) } : {}) });
  if (q.q) {
    const rx = new RegExp(escapeRegex(str(q.q, { name: "Search", max: 60 })), "i");
    filter.$and = [{ $or: [{ number: rx }, { "lines.appNo": rx }, { "partySnapshot.name": rx }, { subject: rx }] }];
  }
  const [items, total, counts] = await Promise.all([
    Bill.find(filter)
      .select("number status party partySnapshot billDate totals settled lines.appNo sentOn createdAt")
      .populate("party", "code name")
      .sort({ billDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Bill.countDocuments(filter),
    Bill.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    data: items.map((b) => ({ ...b.toJSON(), lineCount: b.lines.length, lines: undefined })),
    page,
    limit,
    total,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
};

export const getBill = async (req, res) => {
  const bill = await Bill.findById(objectId(req.params.id)).populate(BILL_POPULATE);
  if (!bill) throw new HttpError(404, "Bill not found.");
  const [receipts, settings] = await Promise.all([
    Receipt.find({ bill: bill._id }).populate("recordedBy", "name").populate("reversedBy", "name").sort({ receivedOn: 1 }).lean(),
    getSettings(),
  ]);
  res.json({
    success: true,
    data: { ...bill.toJSON(), receipts: receipts.map((r) => ({ ...r, settles: r.amount + r.tdsIncomeTax + r.tdsGst + r.otherDeduction })) },
    settings,
  });
};

function lineFrom(p) {
  const c = p.charges || {};
  return {
    project: p._id,
    appNo: p.appNo,
    appDate: p.appDate,
    ward: p.ward,
    fileNo: p.fileNo,
    workYear: p.workYear,
    description: p.appDetails,
    contractorName: p.contractorName,
    certificateNo: p.report?.certificateNo || "",
    projectBillAmount: p.projectBillAmount,
    servicePercent: c.servicePercent ?? null,
    lumpsum: Boolean(c.lumpsum),
    ruleCode: c.ruleCode,
    net: c.net || 0,
    gst: c.gst || 0,
    total: (c.net || 0) + (c.gst || 0),
    km: c.km || 0,
    ta: c.ta || 0,
  };
}

function totalsOf(lines) {
  const net = lines.reduce((a, l) => a + l.net, 0);
  const gst = lines.reduce((a, l) => a + l.gst, 0);
  const cgst = Math.floor(gst / 2);
  return { net, gst, cgst, sgst: gst - cgst, total: net + gst };
}

// Create a DRAFT bill for some ready jobs of one party.
export const createBill = async (req, res) => {
  const b = req.body || {};
  const ids = Array.isArray(b.projectIds) ? [...new Set(b.projectIds.map((x) => objectId(x, "application")))] : [];
  if (!ids.length) throw new HttpError(400, "Select at least one application.");
  if (ids.length > 200) throw new HttpError(400, "A bill can have at most 200 applications.");
  const billDate = date(b.billDate, { name: "Bill date" }) || new Date();
  const subject = str(b.subject, { name: "Subject", max: 300 }) || "";
  const remarks = str(b.remarks, { name: "Remarks", max: 1000 }) || "";

  const bill = await inTransaction(async (session) => {
    const projects = await Project.find({ _id: t({ $in: ids }) }).session(session);
    if (projects.length !== ids.length) throw new HttpError(404, "Some applications were not found.");
    const notReady = projects.filter((p) => p.status !== "report_issued" || p.bill);
    if (notReady.length) throw new HttpError(409, `Not ready to bill: ${notReady.map((p) => p.appNo).join(", ")}.`);
    const partyIds = new Set(projects.map((p) => String(p.party)));
    if (partyIds.size > 1) throw new HttpError(400, "All applications on a bill must be from the same party.");
    const noFee = projects.filter((p) => !p.charges?.net);
    if (noFee.length) throw new HttpError(400, `No fee calculated for: ${noFee.map((p) => p.appNo).join(", ")}.`);
    const gstModes = new Set(projects.map((p) => p.charges.gstMode || "inclusive"));
    if (gstModes.size > 1) throw new HttpError(400, "These applications mix GST-inclusive and GST-extra fees. Bill them separately.");

    const party = await Party.findById(projects[0].party).session(session).lean();
    projects.sort((a, b2) => a.appDate - b2.appDate || a.serialNo - b2.serialNo);
    const lines = projects.map(lineFrom);
    const [doc] = await Bill.create(
      [{
        status: "draft",
        party: party._id,
        partySnapshot: { code: party.code, name: party.name, billingAddress: party.billingAddress, gstin: party.gstin },
        gstMode: [...gstModes][0],
        billDate,
        subject: subject || `Third party inspection charges - ${lines.length} application${lines.length > 1 ? "s" : ""}`,
        remarks,
        lines,
        totals: totalsOf(lines),
        createdBy: req.user.dbId,
      }],
      { session }
    );
    // reserve the jobs so nobody puts them on a second bill
    await Project.updateMany({ _id: t({ $in: ids }) }, { $set: { bill: doc._id, updatedBy: req.user.dbId } }, { session });
    await audit(req, { action: "bill.create", entity: "Bill", entityId: doc._id, after: { lines: lines.length, total: doc.totals.total } }, session);
    return doc;
  });
  res.status(201).json({ success: true, data: bill });
};

// Give the draft its number and send it.
export const issueBill = async (req, res) => {
  const id = objectId(req.params.id);
  const b = req.body || {};
  const bill = await inTransaction(async (session) => {
    const doc = await Bill.findById(id).session(session);
    if (!doc) throw new HttpError(404, "Bill not found.");
    if (doc.status !== "draft") throw new HttpError(409, "Only a draft can be issued.");
    const billDate = date(b.billDate, { name: "Bill date" }) || doc.billDate;
    if (billDate > endOfDay(new Date())) throw new HttpError(400, "Bill date can't be in the future.");
    // refresh the party copy: the address may have been filled in since the draft
    const party = await Party.findById(doc.party).session(session).lean();
    const fy = financialYear(billDate);
    const seq = await nextSequence(`bill:${fy}`, session);
    Object.assign(doc, {
      status: "issued",
      billDate,
      financialYear: fy,
      seq,
      number: `CCTEK/${fy}/${pad(seq, 4)}`,
      partySnapshot: { code: party.code, name: party.name, billingAddress: party.billingAddress, gstin: party.gstin },
      issuedBy: req.user.dbId,
      issuedAt: new Date(),
      sentOn: date(b.sentOn, { name: "Sent on" }) || null,
      dispatchRef: str(b.dispatchRef, { name: "Dispatch ref.", max: 120 }) || "",
    });
    await doc.save({ session });
    const projects = await Project.find({ _id: t({ $in: doc.lines.map((l) => l.project) }) }).session(session);
    for (const p of projects) {
      pushStatus(p, "billed", req.user.dbId, doc.number);
      await p.save({ session });
    }
    await audit(req, { action: "bill.issue", entity: "Bill", entityId: doc._id, after: { number: doc.number, total: doc.totals.total } }, session);
    return doc;
  });
  res.json({ success: true, data: bill });
};

// Record when / how the bill went to the party.
export const markSent = async (req, res) => {
  const b = req.body || {};
  const doc = await Bill.findById(objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Bill not found.");
  if (["draft", "cancelled"].includes(doc.status)) throw new HttpError(409, "Issue the bill first.");
  const before = { sentOn: doc.sentOn, dispatchRef: doc.dispatchRef };
  doc.sentOn = date(b.sentOn, { name: "Sent on", required: true });
  doc.dispatchRef = str(b.dispatchRef, { name: "Dispatch ref.", max: 120 }) || "";
  await doc.save();
  await audit(req, { action: "bill.sent", entity: "Bill", entityId: doc._id, before, after: { sentOn: doc.sentOn, dispatchRef: doc.dispatchRef } });
  res.json({ success: true, data: doc });
};

export const cancelBill = async (req, res) => {
  const id = objectId(req.params.id);
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const bill = await inTransaction(async (session) => {
    const doc = await Bill.findById(id).session(session);
    if (!doc) throw new HttpError(404, "Bill not found.");
    if (!["draft", "issued"].includes(doc.status)) throw new HttpError(409, "A bill with money received can't be cancelled. Reverse its receipts first.");
    if (await Receipt.exists({ bill: id, status: "active" }).session(session)) throw new HttpError(409, "Reverse the receipts of this bill first.");
    const wasIssued = doc.status === "issued";
    Object.assign(doc, { status: "cancelled", cancelledBy: req.user.dbId, cancelledAt: new Date(), cancelReason: reason });
    await doc.save({ session });
    const projects = await Project.find({ _id: t({ $in: doc.lines.map((l) => l.project) }), bill: id }).session(session);
    for (const p of projects) {
      p.bill = null;
      if (wasIssued && p.status === "billed") pushStatus(p, "report_issued", req.user.dbId, `Bill ${doc.number} cancelled: ${reason}`);
      else p.updatedBy = req.user.dbId;
      await p.save({ session });
    }
    await audit(req, { action: "bill.cancel", entity: "Bill", entityId: doc._id, before: { status: wasIssued ? "issued" : "draft" }, after: { status: "cancelled" }, note: reason }, session);
    return doc;
  });
  res.json({ success: true, data: bill });
};

// ================================================================ receipts

// Bill is fully paid: applications -> paid, and each one's fee is shared out.
async function distributeBill(req, bill, paidOn, session) {
  const projects = await Project.find({ _id: t({ $in: bill.lines.map((l) => l.project) }) })
    .populate("team.user", "name")
    .session(session);
  const byId = new Map(projects.map((p) => [String(p._id), p]));
  const rules = new Map();
  const docs = [];
  for (const line of bill.lines) {
    const p = byId.get(String(line.project));
    if (!rules.has(line.ruleCode)) rules.set(line.ruleCode, (await ruleByCode(line.ruleCode)) || DEFAULT_RULE);
    const d = distribute({ net: line.net, ta: line.ta, team: p?.team || [] }, rules.get(line.ruleCode));
    docs.push({
      project: line.project,
      bill: bill._id,
      party: bill.party,
      financialYear: financialYear(paidOn),
      paidOn,
      appNo: line.appNo,
      billNumber: bill.number,
      ruleCode: line.ruleCode,
      fee: line.total,
      gst: line.gst,
      ...d,
    });
    if (p) {
      pushStatus(p, "paid", req.user.dbId, bill.number);
      await p.save({ session });
    }
  }
  await Distribution.create(docs, { session, ordered: true });
}

async function resettle(bill, session) {
  const active = await Receipt.find({ bill: bill._id, status: "active" }).session(session).lean();
  const received = active.reduce((a, r) => a + r.amount, 0);
  const tds = active.reduce((a, r) => a + r.tdsIncomeTax + r.tdsGst, 0);
  const other = active.reduce((a, r) => a + r.otherDeduction, 0);
  bill.settled = {
    received,
    tds,
    other,
    total: received + tds + other,
    lastReceiptOn: active.length ? new Date(Math.max(...active.map((r) => new Date(r.receivedOn).getTime()))) : null,
  };
}

export const recordReceipt = async (req, res) => {
  const id = objectId(req.params.id);
  const b = req.body || {};
  const input = {
    mode: oneOf(b.mode, RECEIPT_MODES, { name: "Mode" }) || "cheque",
    instrumentNo: str(b.instrumentNo, { name: "Cheque / reference no.", required: true, max: 40, pattern: /^[A-Za-z0-9/-]+$/ }),
    instrumentDate: date(b.instrumentDate, { name: "Cheque date", required: true }),
    bankName: str(b.bankName, { name: "Bank", max: 120 }) || "",
    receivedOn: date(b.receivedOn, { name: "Received on", required: true }),
    amount: rupees(b.amount, { name: "Amount", required: true }),
    tdsIncomeTax: rupees(b.tdsIncomeTax, { name: "Income-tax TDS" }) || 0,
    tdsGst: rupees(b.tdsGst, { name: "GST TDS" }) || 0,
    otherDeduction: rupees(b.otherDeduction, { name: "Other deduction" }) || 0,
    remarks: str(b.remarks, { name: "Remarks", max: 500 }) || "",
  };
  if (input.amount <= 0) throw new HttpError(400, "Amount must be more than zero.");
  if (input.receivedOn > endOfDay(new Date())) throw new HttpError(400, "Received date can't be in the future.");
  if (input.otherDeduction && !input.remarks) throw new HttpError(400, "Please say what the other deduction is for (remarks).");

  const out = await inTransaction(async (session) => {
    const bill = await Bill.findById(id).session(session);
    if (!bill) throw new HttpError(404, "Bill not found.");
    if (!["issued", "part_paid"].includes(bill.status)) throw new HttpError(409, bill.status === "paid" ? "This bill is already fully paid." : "Issue the bill before recording payment.");
    if (input.receivedOn < new Date(bill.billDate.toDateString())) throw new HttpError(400, "Received date can't be before the bill date.");
    if (await Receipt.exists({ bill: id, status: "active", instrumentNo: input.instrumentNo }).session(session))
      throw new HttpError(409, `Cheque / reference ${input.instrumentNo} is already recorded on this bill.`);
    const settles = input.amount + input.tdsIncomeTax + input.tdsGst + input.otherDeduction;
    const outstanding = bill.totals.total - bill.settled.total;
    if (settles > outstanding)
      throw new HttpError(400, `This settles ₹${(settles / 100).toFixed(2)} but only ₹${(outstanding / 100).toFixed(2)} is due on the bill.`);

    const fy = financialYear(input.receivedOn);
    const seq = await nextSequence(`receipt:${fy}`, session);
    const [receipt] = await Receipt.create(
      [{ ...input, number: `RCPT/${fy}/${pad(seq, 4)}`, financialYear: fy, bill: bill._id, party: bill.party, recordedBy: req.user.dbId }],
      { session }
    );
    await resettle(bill, session);
    const paid = bill.settled.total >= bill.totals.total;
    bill.status = paid ? "paid" : "part_paid";
    bill.paidAt = paid ? input.receivedOn : null;
    await bill.save({ session });
    if (paid) await distributeBill(req, bill, input.receivedOn, session);
    await audit(req, { action: "receipt.create", entity: "Receipt", entityId: receipt._id, after: { bill: bill.number, ...input } }, session);
    return { receipt, bill, paid };
  });
  res.status(201).json({ success: true, data: out });
};

export const reverseReceipt = async (req, res) => {
  const id = objectId(req.params.id);
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const out = await inTransaction(async (session) => {
    const receipt = await Receipt.findById(id).session(session);
    if (!receipt) throw new HttpError(404, "Receipt not found.");
    if (receipt.status === "reversed") throw new HttpError(409, "Already reversed.");
    const bill = await Bill.findById(receipt.bill).session(session);
    if (bill.status === "paid") {
      const taken = await Distribution.findOne({ bill: bill._id, statement: t({ $ne: null }) }).populate("statement", "number").session(session);
      if (taken) throw new HttpError(409, `This bill's money is already in remuneration statement ${taken.statement?.number}. Cancel that statement first.`);
      await Distribution.deleteMany({ bill: bill._id }, { session });
      const projects = await Project.find({ _id: t({ $in: bill.lines.map((l) => l.project) }), status: "paid" }).session(session);
      for (const p of projects) {
        pushStatus(p, "billed", req.user.dbId, `Receipt ${receipt.number} reversed: ${reason}`);
        await p.save({ session });
      }
    }
    Object.assign(receipt, { status: "reversed", reversedBy: req.user.dbId, reversedAt: new Date(), reverseReason: reason });
    await receipt.save({ session });
    await resettle(bill, session);
    bill.status = bill.settled.total > 0 ? "part_paid" : "issued";
    bill.paidAt = null;
    await bill.save({ session });
    await audit(req, { action: "receipt.reverse", entity: "Receipt", entityId: receipt._id, before: { status: "active" }, after: { status: "reversed" }, note: reason }, session);
    return { receipt, bill };
  });
  res.json({ success: true, data: out });
};

export const listReceipts = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = req.query;
  const filter = {};
  if (q.fy) filter.financialYear = str(q.fy, { name: "Year", max: 7 });
  if (q.party) filter.party = objectId(q.party, "party");
  if (q.mode) filter.mode = oneOf(q.mode, RECEIPT_MODES, { name: "Mode" });
  if (q.status) filter.status = oneOf(q.status, ["active", "reversed"], { name: "Status" });
  const from = date(q.from, { name: "From date" });
  const to = date(q.to, { name: "To date" });
  if (from || to) filter.receivedOn = t({ ...(from ? { $gte: from } : {}), ...(to ? { $lte: endOfDay(to) } : {}) });
  if (q.q) {
    const rx = new RegExp(escapeRegex(str(q.q, { name: "Search", max: 60 })), "i");
    filter.$or = [{ number: rx }, { instrumentNo: rx }, { bankName: rx }];
  }
  const [items, total, sums] = await Promise.all([
    Receipt.find(filter).populate("party", "code").populate("bill", "number").populate("recordedBy", "name").sort({ receivedOn: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Receipt.countDocuments(filter),
    Receipt.aggregate([
      { $match: { ...filter, status: "active" } },
      { $group: { _id: null, amount: { $sum: "$amount" }, tds: { $sum: { $add: ["$tdsIncomeTax", "$tdsGst"] } }, other: { $sum: "$otherDeduction" } } },
    ]),
  ]);
  res.json({ success: true, data: items, page, limit, total, sums: sums[0] || { amount: 0, tds: 0, other: 0 } });
};

// ================================================================ distribution

function monthBounds(month) {
  const m = str(month, { name: "Month", required: true, pattern: /^\d{4}-(0[1-9]|1[0-2])$/ });
  const [y, mm] = m.split("-").map(Number);
  return { month: m, start: new Date(Date.UTC(y, mm - 1, 1)), end: new Date(Date.UTC(y, mm, 1)) };
}

// Paid applications not yet in any statement (the "waiting" pool).
export const pendingDistribution = async (req, res) => {
  const filter = { statement: null };
  if (req.query.month) filter.paidOn = t({ $lt: monthBounds(req.query.month).end });
  const items = await Distribution.find(filter).populate("party", "code").sort({ paidOn: 1 }).lean();
  const sum = summarise(items);
  res.json({ success: true, data: items, ...sum });
};

async function userInfo(ids) {
  const users = await User.find({ _id: t({ $in: ids }) }).select("name designation").lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

export const createStatement = async (req, res) => {
  const { month, end } = monthBounds(req.body?.month);
  const remarks = str(req.body?.remarks, { name: "Remarks", max: 1000 }) || "";
  const statement = await inTransaction(async (session) => {
    if (await RemunerationStatement.exists({ month, status: t({ $ne: "cancelled" }) }).session(session))
      throw new HttpError(409, `A statement for ${month} already exists.`);
    const items = await Distribution.find({ statement: null, paidOn: t({ $lt: end }) }).session(session).lean();
    if (!items.length) throw new HttpError(400, "No paid applications are waiting to be shared out up to this month.");
    const info = await userInfo([...new Set(items.flatMap((d) => d.people.map((p) => String(p.user))))]);
    const sum = summarise(items, info);
    const fy = financialYear(new Date(end.getTime() - 1));
    const seq = await nextSequence(`statement:${fy}`, session);
    const [doc] = await RemunerationStatement.create(
      [{
        number: `REM/${fy}/${pad(seq, 2)}`,
        financialYear: fy,
        month,
        distributions: items.map((d) => d._id),
        totals: {
          ...sum.totals,
          fee: items.reduce((a, d) => a + (d.fee || 0), 0),
          gst: items.reduce((a, d) => a + (d.gst || 0), 0),
        },
        people: sum.people,
        heads: sum.heads,
        remarks,
        preparedBy: req.user.dbId,
      }],
      { session }
    );
    const upd = await Distribution.updateMany({ _id: t({ $in: items.map((d) => d._id) }), statement: null }, { $set: { statement: doc._id } }, { session });
    if (upd.modifiedCount !== items.length) throw new HttpError(409, "Someone else is preparing a statement right now. Please try again.");
    await audit(req, { action: "statement.create", entity: "RemunerationStatement", entityId: doc._id, after: { month, applications: items.length, amount: sum.totals.amount } }, session);
    return doc;
  });
  res.status(201).json({ success: true, data: statement });
};

export const listStatements = async (req, res) => {
  const filter = {};
  if (req.query.fy) filter.financialYear = str(req.query.fy, { name: "Year", max: 7 });
  if (req.query.status) filter.status = oneOf(req.query.status, ["draft", "approved", "disbursed", "cancelled"], { name: "Status" });
  const items = await RemunerationStatement.find(filter)
    .select("number month financialYear status totals preparedBy approvedBy approvedAt disbursedAt createdAt")
    .populate("preparedBy", "name")
    .populate("approvedBy", "name")
    .sort({ month: -1, createdAt: -1 })
    .limit(120)
    .lean();
  res.json({ success: true, data: items });
};

export const getStatement = async (req, res) => {
  const doc = await RemunerationStatement.findById(objectId(req.params.id))
    .populate("preparedBy", "name")
    .populate("approvedBy", "name")
    .populate("disbursedBy", "name")
    .populate("cancelledBy", "name")
    .lean();
  if (!doc) throw new HttpError(404, "Statement not found.");
  const [rows, settings] = await Promise.all([
    Distribution.find({ _id: t({ $in: doc.distributions }) }).populate("party", "code").sort({ paidOn: 1 }).lean(),
    getSettings(),
  ]);
  res.json({ success: true, data: { ...doc, distributions: undefined, rows }, settings });
};

export const approveStatement = async (req, res) => {
  const doc = await RemunerationStatement.findById(objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Statement not found.");
  if (doc.status !== "draft") throw new HttpError(409, "Only a prepared (draft) statement can be approved.");
  if (String(doc.preparedBy) === String(req.user.dbId)) throw new HttpError(403, "The person who prepared a statement can't approve it.");
  Object.assign(doc, { status: "approved", approvedBy: req.user.dbId, approvedAt: new Date() });
  await doc.save();
  await audit(req, { action: "statement.approve", entity: "RemunerationStatement", entityId: doc._id, before: { status: "draft" }, after: { status: "approved" } });
  res.json({ success: true, data: doc });
};

export const disburseStatement = async (req, res) => {
  const doc = await RemunerationStatement.findById(objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Statement not found.");
  if (doc.status !== "approved") throw new HttpError(409, "Only an approved statement can be marked paid out.");
  const on = date(req.body?.disbursedOn, { name: "Paid out on", required: true });
  if (on > endOfDay(new Date())) throw new HttpError(400, "Date can't be in the future.");
  Object.assign(doc, {
    status: "disbursed",
    disbursedBy: req.user.dbId,
    disbursedAt: on,
    disbursedRef: str(req.body?.reference, { name: "Reference", required: true, max: 120 }),
  });
  await doc.save();
  await audit(req, { action: "statement.disburse", entity: "RemunerationStatement", entityId: doc._id, before: { status: "approved" }, after: { status: "disbursed", ref: doc.disbursedRef } });
  res.json({ success: true, data: doc });
};

export const cancelStatement = async (req, res) => {
  const id = objectId(req.params.id);
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const out = await inTransaction(async (session) => {
    const doc = await RemunerationStatement.findById(id).session(session);
    if (!doc) throw new HttpError(404, "Statement not found.");
    // Paid out: only the Admin can reopen it, to correct a mistake. Whatever was
    // already paid to people is settled outside the system.
    if (doc.status === "disbursed" && req.user.role !== "admin") throw new HttpError(403, "Only the Admin can cancel a statement that is already paid out.");
    if (doc.status === "cancelled") throw new HttpError(409, "Already cancelled.");
    if (doc.status === "approved" && !hasPermission(req.user.role, "payouts.approve"))
      throw new HttpError(403, "Only an approver can cancel an approved statement.");
    const before = { status: doc.status, ...(doc.status === "disbursed" ? { disbursedAt: doc.disbursedAt, disbursedRef: doc.disbursedRef, amount: doc.totals.amount + doc.totals.ta } : {}) };
    Object.assign(doc, { status: "cancelled", cancelledBy: req.user.dbId, cancelledAt: new Date(), cancelReason: reason });
    await doc.save({ session });
    await Distribution.updateMany({ statement: doc._id }, { $set: { statement: null } }, { session });
    await audit(req, { action: "statement.cancel", entity: "RemunerationStatement", entityId: doc._id, before, after: { status: "cancelled" }, note: reason }, session);
    return doc;
  });
  res.json({ success: true, data: out });
};

// Admin only (checked in the route): remove a statement completely, in any
// status. Its applications go back to waiting; the audit log keeps a copy.
export const deleteStatement = async (req, res) => {
  const id = objectId(req.params.id);
  const reason = str(req.body?.reason, { name: "Reason", required: true, max: 300 });
  const doc = await inTransaction(async (session) => {
    const doc = await RemunerationStatement.findById(id).session(session).lean();
    if (!doc) throw new HttpError(404, "Statement not found.");
    await Distribution.updateMany({ statement: id }, { $set: { statement: null } }, { session });
    await RemunerationStatement.deleteOne({ _id: id }, { session });
    await audit(req, {
      action: "statement.delete",
      entity: "RemunerationStatement",
      entityId: id,
      before: {
        number: doc.number, month: doc.month, status: doc.status, totals: doc.totals, people: doc.people,
        preparedBy: doc.preparedBy, approvedBy: doc.approvedBy, disbursedAt: doc.disbursedAt, disbursedRef: doc.disbursedRef,
      },
      note: reason,
    }, session);
    return doc;
  });
  res.json({ success: true, message: `Statement ${doc.number} deleted. Its applications are waiting again.` });
};

// The signed-in person's own remuneration, application by application.
export const myEarnings = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7 }) || financialYear();
  const me = new mongoose.Types.ObjectId(String(req.user.dbId));
  const items = await Distribution.find({ financialYear: fy, "people.user": me })
    .select("appNo billNumber paidOn people statement party")
    .populate("statement", "number month status")
    .populate("party", "code")
    .sort({ paidOn: -1 })
    .lean();
  const rows = items.map((d) => {
    const p = d.people.find((x) => String(x.user) === String(me));
    const st = d.statement;
    return {
      _id: d._id,
      appNo: d.appNo,
      party: d.party?.code,
      billNumber: d.billNumber,
      paidOn: d.paidOn,
      role: p.role,
      share: p.share,
      ta: p.ta,
      total: p.share + p.ta,
      statement: st ? { number: st.number, month: st.month, status: st.status } : null,
    };
  });
  const sum = (f) => rows.filter(f).reduce((a, r) => a + r.total, 0);
  res.json({
    success: true,
    data: rows,
    totals: {
      all: sum(() => true),
      paidOut: sum((r) => r.statement?.status === "disbursed"),
      approved: sum((r) => r.statement?.status === "approved"),
      waiting: sum((r) => !r.statement || r.statement.status === "draft"),
    },
  });
};

// ================================================================ overview

const AGE_BUCKETS = [
  { key: "0-30", max: 30 },
  { key: "31-60", max: 60 },
  { key: "61-90", max: 90 },
  { key: "90+", max: Infinity },
];

export const overview = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7, pattern: /^\d{4}-\d{2}$/ }) || financialYear();
  const startYear = Number(fy.slice(0, 4));
  const fyStart = new Date(Date.UTC(startYear, 3, 1));
  const fyEnd = new Date(Date.UTC(startYear + 1, 3, 1));

  const [bills, openBills, receipts, dists, statements, ready, pipeline, parties] = await Promise.all([
    Bill.find({ financialYear: fy, status: t({ $in: ["issued", "part_paid", "paid"] }) }).select("party billDate totals settled status").lean(),
    Bill.find({ status: t({ $in: ["issued", "part_paid"] }) }).select("number party billDate totals settled").populate("party", "code").lean(),
    Receipt.find({ status: "active", receivedOn: t({ $gte: fyStart, $lt: fyEnd }) }).select("party receivedOn amount tdsIncomeTax tdsGst otherDeduction").lean(),
    Distribution.find({ financialYear: fy }).select("net ta amount people heads statement").populate("statement", "status").lean(),
    RemunerationStatement.find({ financialYear: fy, status: t({ $ne: "cancelled" }) }).select("number month status totals").sort({ month: 1 }).lean(),
    Project.aggregate([
      { $match: { status: "report_issued", bill: null } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: { $add: [{ $ifNull: ["$charges.net", 0] }, { $ifNull: ["$charges.gst", 0] }] } } } },
    ]),
    Project.aggregate([{ $match: { financialYear: fy } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Party.find().select("code name").lean(),
  ]);
  const drafts = await Bill.countDocuments({ status: "draft" });

  const partyName = new Map(parties.map((p) => [String(p._id), p]));
  const byParty = new Map();
  const partyRow = (id) => {
    const k = String(id);
    if (!byParty.has(k)) byParty.set(k, { party: partyName.get(k)?.code || "?", name: partyName.get(k)?.name || "", bills: 0, billed: 0, received: 0, tds: 0, outstanding: 0 });
    return byParty.get(k);
  };
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(startYear, 3 + i, 1));
    return { month: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}`, billed: 0, received: 0, bills: 0 };
  });
  const monthOf = (d) => {
    const x = new Date(d);
    return months.find((m) => m.month === `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1, 2)}`);
  };

  let billed = 0, gst = 0, net = 0;
  for (const b of bills) {
    billed += b.totals.total;
    gst += b.totals.gst;
    net += b.totals.net;
    const r = partyRow(b.party);
    r.bills += 1;
    r.billed += b.totals.total;
    const m = monthOf(b.billDate);
    if (m) { m.billed += b.totals.total; m.bills += 1; }
  }
  let received = 0, tds = 0, other = 0;
  for (const r of receipts) {
    received += r.amount;
    tds += r.tdsIncomeTax + r.tdsGst;
    other += r.otherDeduction;
    const p = partyRow(r.party);
    p.received += r.amount;
    p.tds += r.tdsIncomeTax + r.tdsGst;
    const m = monthOf(r.receivedOn);
    if (m) m.received += r.amount;
  }
  const now = Date.now();
  const aging = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, { n: 0, amount: 0 }]));
  let outstanding = 0;
  for (const b of openBills) {
    const due = b.totals.total - b.settled.total;
    outstanding += due;
    partyRow(b.party._id).outstanding += due;
    const days = Math.floor((now - new Date(b.billDate).getTime()) / 86_400_000);
    const bucket = AGE_BUCKETS.find((x) => days <= x.max).key;
    aging[bucket].n += 1;
    aging[bucket].amount += due;
  }

  // distribution: where the money of this year's paid applications went
  const stage = (d) => (!d.statement ? "waiting" : d.statement.status === "draft" ? "prepared" : d.statement.status);
  const byStage = { waiting: [], prepared: [], approved: [], disbursed: [] };
  for (const d of dists) byStage[stage(d)]?.push(d);
  const all = summarise(dists);
  const info = await userInfo(all.people.map((p) => p.user));
  const allNamed = summarise(dists, info);
  const stageTotals = Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, { applications: v.length, amount: v.reduce((a, d) => a + d.amount + d.ta, 0) }]));
  const peopleTotal = allNamed.people.reduce((a, p) => a + p.total, 0);

  res.json({
    success: true,
    data: {
      fy,
      cards: {
        billed, net, gst, received, tds, other, outstanding, bills: bills.length, drafts,
        readyToBill: { n: ready[0]?.n || 0, amount: ready[0]?.amount || 0 },
        distributed: stageTotals.approved.amount + stageTotals.disbursed.amount,
        paidOut: stageTotals.disbursed.amount,
        pendingDistribution: stageTotals.waiting.amount + stageTotals.prepared.amount,
      },
      parties: [...byParty.values()].sort((a, b) => b.billed - a.billed),
      months,
      aging,
      distribution: {
        totals: allNamed.totals,
        stages: stageTotals,
        people: allNamed.people,
        peopleTotal,
        heads: allNamed.heads,
      },
      statements,
      pipeline: Object.fromEntries(pipeline.map((p) => [p._id, p.n])),
      oldestOpen: openBills
        .map((b) => ({ _id: b._id, number: b.number, party: b.party.code, billDate: b.billDate, due: b.totals.total - b.settled.total }))
        .sort((a, b) => new Date(a.billDate) - new Date(b.billDate))
        .slice(0, 8),
    },
  });
};

// ================================================================ settings & parties

const SETTINGS_FIELDS = {
  orgName: 200, orgSubtitle: 200, address: 500, phone: 40, gstin: 15, pan: 10, sacCode: 10,
  bankName: 120, bankBranch: 120, accountName: 120, accountNo: 30, ifsc: 11, billNote: 500, billSignatory: 80,
};

export const readSettings = async (req, res) => {
  res.json({ success: true, data: await getSettings() });
};

export const updateSettings = async (req, res) => {
  const b = req.body || {};
  const set = compact(Object.fromEntries(Object.entries(SETTINGS_FIELDS).map(([k, max]) => [k, str(b[k], { name: k, max })])));
  if (b.email !== undefined) set.email = email(b.email, { name: "Email" }) || "";
  if (b.statementSignatories !== undefined) {
    if (!Array.isArray(b.statementSignatories) || b.statementSignatories.length > 5) throw new HttpError(400, "Up to 5 signatories.");
    set.statementSignatories = b.statementSignatories.map((s) => str(s, { name: "Signatory", max: 60 })).filter(Boolean);
  }
  const before = await getSettings();
  const after = await Settings.findOneAndUpdate(
    { _id: "cctek" },
    { $set: { ...set, updatedBy: req.user.dbId } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();
  await audit(req, { action: "settings.update", entity: "Settings", entityId: req.user.dbId, before, after: set });
  res.json({ success: true, data: after });
};

export const listAllParties = async (req, res) => {
  res.json({ success: true, data: await Party.find().sort({ code: 1 }).lean() });
};

export const updateParty = async (req, res) => {
  const id = objectId(req.params.id);
  const b = req.body || {};
  const set = compact({
    name: str(b.name, { name: "Name", max: 200 }),
    gstMode: oneOf(b.gstMode, ["inclusive", "exclusive"], { name: "GST" }),
    gstin: str(b.gstin, { name: "GSTIN", max: 15 }),
    billingAddress: str(b.billingAddress, { name: "Address", max: 500 }),
    contactPerson: str(b.contactPerson, { name: "Contact person", max: 120 }),
    contactEmail: b.contactEmail === undefined ? undefined : email(b.contactEmail, { name: "Email" }) || "",
    contactPhone: str(b.contactPhone, { name: "Phone", max: 20 }),
  });
  if (set.name === "") throw new HttpError(400, "Name is required.");
  const before = await Party.findById(id).lean();
  if (!before) throw new HttpError(404, "Party not found.");
  const after = await Party.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true }).lean();
  await audit(req, { action: "party.update", entity: "Party", entityId: id, before, after: set });
  res.json({ success: true, data: after });
};
