// src/services/distributionService.js
// Shares out the fee of one paid application, as the monthly
// "Resource Persons Remuneration Bill" sheets do, but per application and
// to the paisa. All money is integer paise.
//
//   amount = net fee (GST removed) - TA
//   45% Inspection officers   equal shares among the job's inspectors
//   10% Accompanying staff     equal shares among the job's support members
//   25% Administrative & infrastructure support
//   20% Balance -> DTE 25 | Reserve 10 | Student Welfare 15 | Staff Welfare 18 |
//                  Infrastructure 20 | WID 5 | Environment 2 | R&M 2 | Contingencies 3
//   TA (Rs 15/km) to the inspectors
//
// If a job had no support member, the 10% is kept as "Accompanying staff -
// not allotted" so the statement shows it instead of losing it.

import { DEFAULT_RULE, splitExact, splitAmong } from "./billingService.js";

export const HEAD_GROUPS = { people: "people", fund: "fund", balance: "balance", unallotted: "unallotted" };

export function distribute({ net, ta, team = [] }, rule = DEFAULT_RULE) {
  const safeTa = Math.min(Math.max(0, ta || 0), Math.max(0, net || 0));
  const amount = Math.max(0, (net || 0) - safeTa);
  const shares = splitExact(amount, rule.shares);
  const byPayTo = (payTo) => rule.shares.filter((s) => s.payTo === payTo);

  const inspectors = team.filter((m) => m.role === "inspector");
  const support = team.filter((m) => m.role === "support");
  const people = new Map();
  const person = (m, role) => {
    const id = String(m.user?._id || m.user);
    if (!people.has(id)) people.set(id, { user: id, name: m.user?.name || m.name || "", role, share: 0, ta: 0 });
    return people.get(id);
  };
  const heads = [];

  for (const s of byPayTo("inspectors")) {
    if (inspectors.length) for (const { person: m, amount: a } of splitAmong(shares[s.key], inspectors)) person(m, "inspector").share += a;
    else heads.push({ key: `${s.key}_unallotted`, label: `${s.label} - not allotted`, amount: shares[s.key], group: HEAD_GROUPS.unallotted });
  }
  if (inspectors.length) for (const { person: m, amount: a } of splitAmong(safeTa, inspectors)) person(m, "inspector").ta += a;
  else if (safeTa) heads.push({ key: "ta_unallotted", label: "Transportation (TA) - not allotted", amount: safeTa, group: HEAD_GROUPS.unallotted });

  for (const s of byPayTo("support")) {
    if (support.length) for (const { person: m, amount: a } of splitAmong(shares[s.key], support)) person(m, "support").share += a;
    else heads.push({ key: `${s.key}_unallotted`, label: `${s.label} - not allotted`, amount: shares[s.key], group: HEAD_GROUPS.unallotted });
  }

  for (const s of byPayTo("fund")) heads.push({ key: s.key, label: s.label, amount: shares[s.key], group: HEAD_GROUPS.fund });

  const profitKey = byPayTo("profit")[0]?.key;
  const balance = profitKey ? shares[profitKey] : 0;
  const split = splitExact(balance, rule.profitSplit);
  for (const p of rule.profitSplit) heads.push({ key: p.key, label: p.label, amount: split[p.key], group: HEAD_GROUPS.balance });

  const list = [...people.values()];
  // every paisa is accounted for
  const check = list.reduce((a, p) => a + p.share + p.ta, 0) + heads.reduce((a, h) => a + h.amount, 0);
  if (check !== amount + safeTa) throw new Error(`Distribution does not add up (${check} vs ${amount + safeTa}).`);

  return { net: net || 0, ta: safeTa, amount, people: list, heads };
}

// Add up many distributions into person and head totals (for a statement or a report).
export function summarise(distributions, userInfo = new Map()) {
  const people = new Map();
  const heads = new Map();
  const totals = { applications: 0, net: 0, ta: 0, amount: 0 };
  for (const d of distributions) {
    totals.applications += 1;
    totals.net += d.net;
    totals.ta += d.ta;
    totals.amount += d.amount;
    for (const p of d.people) {
      const id = String(p.user);
      const row = people.get(id) || { user: id, name: userInfo.get(id)?.name || p.name, designation: userInfo.get(id)?.designation || "", inspector: 0, support: 0, ta: 0, total: 0, jobs: 0 };
      if (p.role === "support") row.support += p.share;
      else row.inspector += p.share;
      row.ta += p.ta;
      row.total += p.share + p.ta;
      row.jobs += 1;
      people.set(id, row);
    }
    for (const h of d.heads) {
      const row = heads.get(h.key) || { key: h.key, label: h.label, amount: 0, group: h.group };
      row.amount += h.amount;
      heads.set(h.key, row);
    }
  }
  const GROUP_ORDER = ["unallotted", "fund", "balance"];
  return {
    totals,
    people: [...people.values()].sort((a, b) => b.total - a.total),
    heads: [...heads.values()].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)),
  };
}
