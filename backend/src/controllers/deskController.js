// src/controllers/deskController.js
// Home pages for the CCTEK Manager and the Principal.
//
//   Manager desk:   what needs attention today, delayed work, team load,
//                   this month vs last month, recent activity.
//   Principal desk: statements to approve, the year in brief, college funds
//                   built up from the fee, DTE share.

import mongoose from "mongoose";
import Project from "../models/Project.js";
import Bill from "../models/Bill.js";
import BillGroup from "../models/BillGroup.js";
import Fund from "../models/Fund.js";
import Receipt from "../models/Receipt.js";
import Distribution from "../models/Distribution.js";
import RemunerationStatement from "../models/RemunerationStatement.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { financialYear } from "../models/Counter.js";
import { summarise } from "../services/distributionService.js";
import { str } from "../utils/validate.js";

const t = mongoose.trusted;
const DAY = 86_400_000;
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : 0);

// How long a job may sit in a stage before it counts as delayed.
export const DELAY_RULES = {
  received: { days: 3, label: "Not assigned", kn: "ನಿಯೋಜನೆ ಬಾಕಿ", who: "Work coordinator" },
  assigned: { days: 14, label: "Not inspected", kn: "ತಪಾಸಣೆ ಬಾಕಿ", who: "Inspection team" },
  inspected: { days: 7, label: "Report not issued", kn: "ವರದಿ ಬಾಕಿ", who: "Work coordinator" },
  report_issued: { days: 15, label: "Not billed", kn: "ಬಿಲ್ ಬಾಕಿ", who: "Work coordinator" },
};
const BILL_OVERDUE_DAYS = 60;

function fyBounds(fy) {
  const y = Number(fy.slice(0, 4));
  return { start: new Date(Date.UTC(y, 3, 1)), end: new Date(Date.UTC(y + 1, 3, 1)) };
}
function monthStart(offset = 0) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 1));
}

// When did the job enter its current stage?
const stageSince = (p) => {
  const h = p.statusHistory?.[p.statusHistory.length - 1];
  if (p.status === "assigned" && p.plannedInspectionDate) return null; // judged by planned date
  return h?.at || p.createdAt;
};

function delayOf(p) {
  const rule = DELAY_RULES[p.status];
  if (!rule) return null;
  if (p.status === "assigned" && p.plannedInspectionDate) {
    const late = daysSince(p.plannedInspectionDate);
    return late > 0 ? { late, waited: daysSince(p.statusHistory?.at(-1)?.at || p.createdAt), label: "Inspection date passed", rule } : null;
  }
  const waited = daysSince(stageSince(p));
  return waited > rule.days ? { late: waited - rule.days, waited, label: rule.label, rule } : null;
}

// -------------------------------------------------------------- activity text

const ACTION_TEXT = {
  "project.create": "registered application",
  "project.assign": "assigned the team for",
  "project.status": "changed the stage of",
  "bill.create": "made a draft bill for",
  "bill.issue": "issued bill",
  "bill.sent": "marked sent",
  "bill.cancel": "cancelled bill",
  "receipt.create": "recorded payment",
  "receipt.reverse": "reversed payment",
  "group.create": "made statement of bills",
  "group.receipt": "recorded cheque on statement",
  "group.reverse": "reversed cheque on statement",
  "group.sent": "marked statement sent",
  "group.cancel": "cancelled statement of bills",
  "fund.create": "added fund",
  "fund.update": "updated fund",
  "statement.create": "prepared statement",
  "statement.approve": "approved statement",
  "statement.disburse": "marked paid out",
  "statement.cancel": "cancelled statement",
  "statement.delete": "deleted statement",
  "settings.update": "updated bill settings",
  "party.update": "updated party",
  "user.create": "added user",
  "user.update": "updated user",
  "user.delete": "removed user",
};

async function recentActivity(limit = 15) {
  const rows = await AuditLog.find({ action: t({ $in: Object.keys(ACTION_TEXT) }) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actor", "name")
    .lean();
  const ids = (entity) => rows.filter((r) => r.entity === entity).map((r) => r.entityId);
  const [projects, bills, receipts, statements, users] = await Promise.all([
    Project.find({ _id: t({ $in: ids("Project") }) }).select("appNo").lean(),
    Bill.find({ _id: t({ $in: ids("Bill") }) }).select("number partySnapshot.code").lean(),
    Receipt.find({ _id: t({ $in: ids("Receipt") }) }).select("number instrumentNo").lean(),
    RemunerationStatement.find({ _id: t({ $in: ids("RemunerationStatement") }) }).select("number month").lean(),
    User.find({ _id: t({ $in: ids("User") }) }).select("name").lean(),
  ]);
  const [groups, funds] = await Promise.all([
    BillGroup.find({ _id: t({ $in: ids("BillGroup") }) }).select("number fundName").lean(),
    Fund.find({ _id: t({ $in: ids("Fund") }) }).select("name").lean(),
  ]);
  const label = new Map([
    ...projects.map((x) => [String(x._id), { text: x.appNo, href: null, projectId: String(x._id) }]),
    ...bills.map((x) => [String(x._id), { text: x.number || `draft (${x.partySnapshot?.code || ""})`, href: `/billing/bills/${x._id}` }]),
    ...receipts.map((x) => [String(x._id), { text: `${x.number} · ${x.instrumentNo}` }]),
    ...statements.map((x) => [String(x._id), { text: x.number, href: `/billing/distribution/${x._id}` }]),
    ...users.map((x) => [String(x._id), { text: x.name }]),
    ...groups.map((x) => [String(x._id), { text: `${x.number}${x.fundName ? ` · ${x.fundName}` : ""}`, href: `/billing/groups/${x._id}` }]),
    ...funds.map((x) => [String(x._id), { text: x.name }]),
  ]);
  return rows.map((r) => {
    const target = label.get(String(r.entityId)) || {};
    let detail = "";
    if (r.action === "project.status" && r.after?.status) detail = `→ ${String(r.after.status).replace("_", " ")}`;
    if (["receipt.create", "group.receipt"].includes(r.action) && r.after?.amount) detail = `₹${(r.after.amount / 100).toLocaleString("en-IN")}${r.after.instrumentNo ? ` · ${r.after.instrumentNo}` : ""}`;
    return {
      _id: r._id,
      at: r.createdAt,
      who: r.actor?.name || r.actorEmail,
      action: r.action,
      verb: ACTION_TEXT[r.action],
      target: target.text || r.before?.number || r.before?.name || "", // deleted records: name kept in the log
      href: target.href || null,
      projectId: target.projectId || null,
      detail,
      note: r.note || "",
    };
  });
}

// -------------------------------------------------------------- manager desk

export const managerDesk = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7, pattern: /^\d{4}-\d{2}$/ }) || financialYear();
  const { start: fyStart } = fyBounds(fy);
  const thisMonth = monthStart(0);
  const lastMonth = monthStart(-1);

  const [open, toApprove, drafts, overdueBills, monthly, team, earnings, activity, yearCounts] = await Promise.all([
    Project.find({ status: t({ $in: Object.keys(DELAY_RULES) }) })
      .select("appNo appDate party ward contractorName status plannedInspectionDate inspectionDate report.issuedOn bill team createdAt statusHistory")
      .slice("statusHistory", -1)
      .populate("party", "code")
      .populate("team.user", "name")
      .lean(),
    RemunerationStatement.find({ status: "draft" }).select("number month totals preparedBy createdAt").populate("preparedBy", "name").lean(),
    Bill.countDocuments({ status: "draft" }),
    Bill.find({ status: t({ $in: ["issued", "part_paid"] }), billDate: t({ $lt: new Date(Date.now() - BILL_OVERDUE_DAYS * DAY) }) })
      .select("number billDate totals settled party")
      .populate("party", "code")
      .sort({ billDate: 1 })
      .lean(),
    monthlyCounts(lastMonth, thisMonth),
    Project.aggregate([
      { $match: { financialYear: fy } },
      { $unwind: "$team" },
      {
        $group: {
          _id: "$team.user",
          jobs: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ["$status", ["assigned", "inspected"]] }, 1, 0] } },
          inspectedThisMonth: { $sum: { $cond: [{ $gte: ["$inspectionDate", thisMonth] }, 1, 0] } },
          done: { $sum: { $cond: [{ $in: ["$status", ["report_issued", "billed", "paid"]] }, 1, 0] } },
        },
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $project: { _id: 0, user: "$_id", name: "$u.name", designation: "$u.designation", imageUrl: "$u.imageUrl", jobs: 1, open: 1, inspectedThisMonth: 1, done: 1 } },
      { $sort: { open: -1, jobs: -1 } },
    ]),
    Distribution.aggregate([
      { $match: { financialYear: fy } },
      { $unwind: "$people" },
      { $group: { _id: "$people.user", total: { $sum: { $add: ["$people.share", "$people.ta"] } } } },
    ]),
    recentActivity(15),
    Project.aggregate([{ $match: { financialYear: fy } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  // delayed work, worst first
  const delayed = [];
  const stageCounts = Object.fromEntries(Object.keys(DELAY_RULES).map((k) => [k, { open: 0, delayed: 0 }]));
  for (const p of open) {
    if (p.status === "report_issued" && p.bill) continue; // on a draft bill
    stageCounts[p.status].open += 1;
    const d = delayOf(p);
    if (!d) continue;
    stageCounts[p.status].delayed += 1;
    delayed.push({
      _id: p._id,
      appNo: p.appNo,
      party: p.party?.code,
      ward: p.ward,
      status: p.status,
      problem: d.label,
      who: d.rule.who,
      waited: d.waited,
      late: d.late,
      team: (p.team || []).map((m) => m.user?.name).filter(Boolean),
    });
  }
  delayed.sort((a, b) => b.late - a.late);

  const earned = new Map(earnings.map((e) => [String(e._id), e.total]));
  const counts = Object.fromEntries(yearCounts.map((c) => [c._id, c.n]));

  res.json({
    success: true,
    data: {
      fy,
      attention: {
        toApprove: toApprove.map((s) => ({ _id: s._id, number: s.number, month: s.month, amount: s.totals.amount + s.totals.ta, applications: s.totals.applications, preparedBy: s.preparedBy?.name, mine: String(s.preparedBy?._id) === String(req.user.dbId) })),
        draftBills: drafts,
        readyToBill: stageCounts.report_issued.open,
        overdueBills: overdueBills.map((b) => ({ _id: b._id, number: b.number, party: b.party?.code, billDate: b.billDate, due: b.totals.total - b.settled.total, days: daysSince(b.billDate) })),
        stages: Object.entries(stageCounts).map(([key, v]) => ({ key, ...v, limit: DELAY_RULES[key].days, label: DELAY_RULES[key].label, kn: DELAY_RULES[key].kn })),
      },
      delayed: delayed.slice(0, 30),
      delayedTotal: delayed.length,
      months: monthly,
      team: team.map((m) => ({ ...m, earned: earned.get(String(m.user)) || 0 })),
      year: { applications: Object.values(counts).reduce((a, b) => a + b, 0), counts, since: fyStart },
      activity,
    },
  });
};

// New work, inspections, reports, bills and money for last month and this month.
async function monthlyCounts(lastMonth, thisMonth) {
  const next = monthStart(1);
  const ranges = [
    { key: "last", from: lastMonth, to: thisMonth },
    { key: "this", from: thisMonth, to: next },
  ];
  const out = {};
  for (const r of ranges) {
    const between = t({ $gte: r.from, $lt: r.to });
    const [apps, inspections, reports, bills, receipts] = await Promise.all([
      Project.countDocuments({ appDate: between }),
      Project.countDocuments({ inspectionDate: between }),
      Project.countDocuments({ "report.issuedOn": between }),
      Bill.aggregate([{ $match: { status: { $in: ["issued", "part_paid", "paid"] }, billDate: { $gte: r.from, $lt: r.to } } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$totals.total" } } }]),
      Receipt.aggregate([{ $match: { status: "active", receivedOn: { $gte: r.from, $lt: r.to } } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
    ]);
    out[r.key] = {
      month: `${r.from.getUTCFullYear()}-${String(r.from.getUTCMonth() + 1).padStart(2, "0")}`,
      applications: apps,
      inspections,
      reports,
      bills: bills[0]?.n || 0,
      billed: bills[0]?.amount || 0,
      cheques: receipts[0]?.n || 0,
      received: receipts[0]?.amount || 0,
    };
  }
  return out;
}

// -------------------------------------------------------------- principal desk

export const principalDesk = async (req, res) => {
  const fy = str(req.query.fy, { name: "Year", max: 7, pattern: /^\d{4}-\d{2}$/ }) || financialYear();
  const { start, end } = fyBounds(fy);

  const [toApprove, recent, yearCounts, bills, receipts, outstanding, distYear, distAll] = await Promise.all([
    RemunerationStatement.find({ status: "draft" }).populate("preparedBy", "name").sort({ month: 1 }).lean(),
    RemunerationStatement.find({ status: t({ $in: ["approved", "disbursed"] }) })
      .select("number month status totals approvedBy approvedAt disbursedAt")
      .populate("approvedBy", "name")
      .sort({ month: -1 })
      .limit(6)
      .lean(),
    Project.aggregate([{ $match: { financialYear: fy } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Bill.aggregate([
      { $match: { financialYear: fy, status: { $in: ["issued", "part_paid", "paid"] } } },
      { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$totals.total" }, gst: { $sum: "$totals.gst" } } },
    ]),
    Receipt.aggregate([
      { $match: { status: "active", receivedOn: { $gte: start, $lt: end } } },
      { $group: { _id: null, amount: { $sum: "$amount" }, tds: { $sum: { $add: ["$tdsIncomeTax", "$tdsGst"] } } } },
    ]),
    Bill.aggregate([
      { $match: { status: { $in: ["issued", "part_paid"] } } },
      { $group: { _id: null, n: { $sum: 1 }, due: { $sum: { $subtract: ["$totals.total", "$settled.total"] } } } },
    ]),
    Distribution.find({ financialYear: fy }).select("net ta amount people heads statement").populate("statement", "status").lean(),
    Distribution.find({}).select("net ta amount people heads statement").populate("statement", "status").lean(),
  ]);

  // Funds: approved (or paid out) statements only count as credited.
  const approved = (d) => d.statement && ["approved", "disbursed"].includes(d.statement.status);
  const yearHeads = summarise(distYear.filter(approved)).heads;
  const pendingHeads = summarise(distYear.filter((d) => !approved(d))).heads;
  const allHeads = summarise(distAll.filter(approved)).heads;
  const pendingByKey = new Map(pendingHeads.map((h) => [h.key, h.amount]));
  const allByKey = new Map(allHeads.map((h) => [h.key, h.amount]));
  const keys = [...new Map([...allHeads, ...yearHeads, ...pendingHeads].map((h) => [h.key, h])).values()];
  const funds = keys
    .filter((h) => h.group !== "unallotted")
    .map((h) => ({
      key: h.key,
      label: h.label,
      group: h.group,
      year: yearHeads.find((x) => x.key === h.key)?.amount || 0,
      pending: pendingByKey.get(h.key) || 0,
      allYears: allByKey.get(h.key) || 0,
    }));
  const people = summarise(distYear.filter(approved));
  const counts = Object.fromEntries(yearCounts.map((c) => [c._id, c.n]));

  // the details the Principal needs to approve without opening every row
  const approvals = toApprove.map((s) => ({
    _id: s._id,
    number: s.number,
    month: s.month,
    preparedBy: s.preparedBy?.name,
    preparedOn: s.createdAt,
    mine: String(s.preparedBy?._id) === String(req.user.dbId),
    totals: s.totals,
    people: s.people.length,
    topPeople: s.people.slice(0, 5).map((p) => ({ name: p.name, total: p.total })),
    heads: s.heads,
    unallotted: s.heads.filter((h) => h.group === "unallotted").reduce((a, h) => a + h.amount, 0),
  }));

  res.json({
    success: true,
    data: {
      fy,
      approvals,
      recent,
      year: {
        applications: Object.values(counts).reduce((a, b) => a + b, 0),
        completed: (counts.report_issued || 0) + (counts.billed || 0) + (counts.paid || 0),
        inProgress: (counts.received || 0) + (counts.assigned || 0) + (counts.inspected || 0),
        billed: bills[0]?.total || 0,
        bills: bills[0]?.n || 0,
        gst: bills[0]?.gst || 0,
        received: receipts[0]?.amount || 0,
        tds: receipts[0]?.tds || 0,
        outstanding: outstanding[0]?.due || 0,
        outstandingBills: outstanding[0]?.n || 0,
        toPeople: people.people.reduce((a, p) => a + p.total, 0),
        peopleCount: people.people.length,
      },
      funds,
    },
  });
};
