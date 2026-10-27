"use client";

// All bills, with stage tabs. A row opens the bill (print, record cheque, cancel).

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatRupees } from "@/lib/api";
import { useFetch, BILL_STATUS, Badge, fyOptions } from "@/lib/billing";
import DataTable, { FilterBar, FilterSearch, FilterSelect, FilterInput, StatusTabs } from "@/app/components/table/DataTable";
import { useParties, useFunds, fundOptions } from "@/app/components/projects/useProjectList";
import { fmtDate, daysSince } from "@/app/components/projects/projectMeta";
import { PageHeader, Spinner } from "@/app/components/ui";

// unpaid for over a month: amber; over two months: red
const dueAge = (d) => (d > 60 ? "font-bold text-cc-bad" : d > 30 ? "font-bold text-cc-warn" : "text-cc-muted");

const TABS = [
  { key: "open", label: "Waiting for payment", kn: "ಪಾವತಿ ಬಾಕಿ", status: "issued,part_paid" },
  { key: "draft", label: "Drafts", kn: "ಕರಡು", status: "draft" },
  { key: "paid", label: "Paid", kn: "ಪಾವತಿಯಾಗಿದೆ", status: "paid" },
  { key: "cancelled", label: "Cancelled", kn: "ರದ್ದು", status: "cancelled" },
  { key: "all", label: "All", kn: "ಎಲ್ಲಾ", status: "" },
];

export default function BillsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BillsList />
    </Suspense>
  );
}

function BillsList() {
  const router = useRouter();
  const parties = useParties();
  const { funds } = useFunds();
  const wantedTab = useSearchParams().get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.key === wantedTab) ? wantedTab : "open");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const status = TABS.find((t) => t.key === tab).status;
  const params = Object.fromEntries(Object.entries({ ...filters, status, page, limit: 25 }).filter(([, v]) => v !== "" && v != null));
  const { data, extra, loading } = useFetch("/billing/bills", params);
  const c = extra?.counts || {};
  const counts = { open: (c.issued || 0) + (c.part_paid || 0), draft: c.draft || 0, paid: c.paid || 0, cancelled: c.cancelled || 0 };

  const columns = [
    { key: "number", header: "Bill no.", kn: "ಬಿಲ್ ಸಂಖ್ಯೆ", render: (b) => <span className="font-semibold">{b.number || <span className="text-cc-muted">Draft</span>}</span> },
    { key: "date", header: "Date", kn: "ದಿನಾಂಕ", className: "whitespace-nowrap", render: (b) => fmtDate(b.billDate) },
    { key: "party", header: "Party", kn: "ಸಂಸ್ಥೆ", render: (b) => b.party?.code },
    { key: "fund", header: "Fund", kn: "ಅನುದಾನ", hideBelow: "md", className: "max-w-[160px]", render: (b) => (b.fundName ? <span className="line-clamp-1">{b.fundName}</span> : "—") },
    {
      key: "group",
      header: "Statement",
      kn: "ಪಟ್ಟಿ",
      hideBelow: "lg",
      render: (b) => (b.group && b.group.status !== "cancelled" ? <span className="whitespace-nowrap text-xs font-semibold">{b.group.number}</span> : "—"),
    },
    { key: "apps", header: "Apps", kn: "ಅರ್ಜಿಗಳು", hideBelow: "xl", className: "text-right tabular-nums", render: (b) => b.lineCount },
    { key: "total", header: "Amount", kn: "ಮೊತ್ತ", className: "text-right tabular-nums whitespace-nowrap font-semibold", render: (b) => formatRupees(b.totals?.total) },
    { key: "settled", header: "Received", kn: "ಸ್ವೀಕರಿಸಿದ್ದು", hideBelow: "lg", className: "text-right tabular-nums whitespace-nowrap", render: (b) => (b.settled?.total ? formatRupees(b.settled.total) : "—") },
    { key: "due", header: "Due", kn: "ಬಾಕಿ", className: "text-right tabular-nums whitespace-nowrap", render: (b) => (b.outstanding ? <span className="font-semibold text-cc-warn">{formatRupees(b.outstanding)}</span> : "—") },
    {
      key: "age",
      header: "Days",
      kn: "ದಿನ",
      hideBelow: "lg",
      render: (b) => (["issued", "part_paid"].includes(b.status) ? <span className={dueAge(daysSince(b.billDate))}>{daysSince(b.billDate)}</span> : "—"),
    },
    { key: "status", header: "Status", kn: "ಸ್ಥಿತಿ", render: (b) => <Badge map={BILL_STATUS} status={b.status} /> },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader title="Bills" kn="ಬಿಲ್‌ಗಳು" sub="Bills sent to parties and what has come in against them." />
      <StatusTabs
        tabs={TABS}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
        counts={counts}
      />
      <FilterBar active={Object.values(filters).some(Boolean)} onClear={() => setFilters({})}>
        <FilterSearch value={filters.q || ""} onChange={(v) => setFilter("q", v)} placeholder="Bill no., application no., party…" />
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={filters.party || ""} onChange={(v) => setFilter("party", v)} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        <FilterSelect label="Fund" kn="ಅನುದಾನ" value={filters.fund || ""} onChange={(v) => setFilter("fund", v)} options={fundOptions(funds)} />
        <FilterSelect label="Year" kn="ವರ್ಷ" value={filters.fy || ""} onChange={(v) => setFilter("fy", v)} options={fyOptions()} allLabel="All years" />
        <FilterInput label="From" kn="ಇಂದ" type="date" value={filters.from || ""} onChange={(v) => setFilter("from", v)} />
        <FilterInput label="To" kn="ವರೆಗೆ" type="date" value={filters.to || ""} onChange={(v) => setFilter("to", v)} />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading}
        onRowClick={(b) => router.push(`/billing/bills/${b._id}`)}
        page={page}
        pages={Math.max(1, Math.ceil((extra?.total || 0) / 25))}
        total={extra?.total}
        onPage={setPage}
        emptyText="No bills here."
      />
    </div>
  );
}
