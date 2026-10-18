"use client";

// My remuneration: my share of every paid application I inspected, and
// whether it has been approved / paid out.

import { useState } from "react";
import { formatRupees } from "@/lib/api";
import { useFetch, fyOptions, fyOf, monthLabel, STATEMENT_STATUS, Badge } from "@/lib/billing";
import DataTable, { FilterBar, FilterSelect } from "@/app/components/table/DataTable";
import { fmtDate } from "@/app/components/projects/projectMeta";
import { PageHeader, StatCard } from "@/app/components/ui";

export default function MyEarningsPage() {
  const [fy, setFy] = useState(fyOf());
  const { data, extra, loading } = useFetch("/billing/my-earnings", { fy });
  const t = extra?.totals || { all: 0, paidOut: 0, approved: 0, waiting: 0 };

  const columns = [
    { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (r) => <span className="font-semibold">{r.appNo}</span> },
    { key: "party", header: "Party", kn: "ಸಂಸ್ಥೆ", render: (r) => r.party },
    { key: "paid", header: "Party paid on", kn: "ಪಾವತಿ ದಿನ", hideBelow: "md", render: (r) => fmtDate(r.paidOn) },
    { key: "role", header: "As", kn: "ಪಾತ್ರ", hideBelow: "md", render: (r) => (r.role === "support" ? "Accompanying" : "Inspector") },
    { key: "share", header: "Share", kn: "ಪಾಲು", hideBelow: "lg", className: "text-right tabular-nums", render: (r) => formatRupees(r.share) },
    { key: "ta", header: "TA", kn: "ಪ್ರಯಾಣ ಭತ್ಯೆ", hideBelow: "lg", className: "text-right tabular-nums", render: (r) => (r.ta ? formatRupees(r.ta) : "—") },
    { key: "total", header: "Total", kn: "ಒಟ್ಟು", className: "text-right tabular-nums font-semibold", render: (r) => formatRupees(r.total) },
    {
      key: "statement",
      header: "Statement",
      kn: "ಪಟ್ಟಿ",
      render: (r) =>
        r.statement ? (
          <span className="flex flex-col items-start gap-1">
            <Badge map={STATEMENT_STATUS} status={r.statement.status} short />
            <span className="text-xs text-cc-muted">{monthLabel(r.statement.month)}</span>
          </span>
        ) : (
          <span className="text-xs text-cc-muted">Waiting</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <PageHeader title="My remuneration" kn="ನನ್ನ ಸಂಭಾವನೆ" sub="Your share of the fee for each job, once the party has paid." />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="This year" kn="ಈ ವರ್ಷ" value={formatRupees(t.all)} tone="primary" />
        <StatCard label="Paid out" kn="ವಿತರಿಸಲಾಗಿದೆ" value={formatRupees(t.paidOut)} tone="ok" />
        <StatCard label="Approved, to be paid" kn="ಅನುಮೋದಿತ" value={formatRupees(t.approved)} tone="accent" />
        <StatCard label="Waiting for statement" kn="ಬಾಕಿ" value={formatRupees(t.waiting)} />
      </div>
      <FilterBar>
        <FilterSelect label="Year" kn="ವರ್ಷ" value={fy} onChange={setFy} options={fyOptions()} allLabel="This year" />
      </FilterBar>
      <DataTable columns={columns} rows={data || []} loading={loading} total={data?.length} emptyText="Nothing yet. Your share appears when the party pays the bill." />
    </div>
  );
}
