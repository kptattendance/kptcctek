"use client";

// Person-wise and head-wise tables of a distribution (waiting pool,
// monthly statement, overview).

import { formatRupees } from "@/lib/api";
import { Empty } from "../ui";

export function PeopleTable({ people }) {
  if (!people.length) return <Empty>No one.</Empty>;
  const sum = (k) => people.reduce((a, p) => a + p[k], 0);
  return (
    <table className="w-full min-w-[520px] text-sm">
      <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
        <tr>
          <th className="px-4 py-2">Name</th>
          <th className="px-4 py-2 text-right">Jobs</th>
          <th className="px-4 py-2 text-right">Inspection 45%</th>
          <th className="px-4 py-2 text-right">Accompanying 10%</th>
          <th className="px-4 py-2 text-right">TA</th>
          <th className="px-4 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {people.map((p) => (
          <tr key={p.user} className="border-t border-cc-border">
            <td className="px-4 py-2">
              <span className="font-semibold">{p.name}</span>
              {p.designation && <span className="block text-xs text-cc-muted">{p.designation}</span>}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{p.jobs}</td>
            <td className="px-4 py-2 text-right tabular-nums">{p.inspector ? formatRupees(p.inspector) : "—"}</td>
            <td className="px-4 py-2 text-right tabular-nums">{p.support ? formatRupees(p.support) : "—"}</td>
            <td className="px-4 py-2 text-right tabular-nums">{p.ta ? formatRupees(p.ta) : "—"}</td>
            <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRupees(p.total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-cc-border font-bold">
        <tr>
          <td className="px-4 py-2">Total</td>
          <td />
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum("inspector"))}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum("support"))}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum("ta"))}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum("total"))}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const GROUP_LABEL = {
  unallotted: "Not allotted to anyone (no team member in that role)",
  fund: "Administrative & infrastructure support (25%)",
  balance: "Balance 20% · allocation of funds",
};

export function HeadsTable({ heads }) {
  if (!heads.length) return <Empty>Nothing.</Empty>;
  const groups = ["unallotted", "fund", "balance"].map((g) => ({ g, rows: heads.filter((h) => h.group === g) })).filter((x) => x.rows.length);
  const balance = heads.filter((h) => h.group === "balance").reduce((a, h) => a + h.amount, 0);
  return (
    <table className="w-full min-w-[360px] text-sm">
      <tbody>
        {groups.map(({ g, rows }) => [
          <tr key={g} className="bg-cc-subtle">
            <td colSpan={3} className={`px-4 py-1.5 text-xs font-semibold ${g === "unallotted" ? "text-cc-warn" : "text-cc-muted"}`}>{GROUP_LABEL[g]}</td>
          </tr>,
          ...rows.map((h) => (
            <tr key={h.key} className="border-t border-cc-border">
              <td className="px-4 py-2">{h.label}</td>
              <td className="px-4 py-2 text-right text-xs text-cc-muted tabular-nums">{g === "balance" && balance ? `${Math.round((h.amount / balance) * 100)}%` : ""}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRupees(h.amount)}</td>
            </tr>
          )),
        ])}
      </tbody>
      <tfoot className="border-t-2 border-cc-border font-bold">
        <tr>
          <td className="px-4 py-2">Total to heads</td>
          <td />
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(heads.reduce((a, h) => a + h.amount, 0))}</td>
        </tr>
      </tfoot>
    </table>
  );
}
