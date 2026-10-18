"use client";

// Every cheque / transfer received. Payments are recorded from the bill
// ("Record cheque"); this list is for finding and checking them.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/api";
import { useFetch, RECEIPT_MODES, fyOptions, fyOf } from "@/lib/billing";
import DataTable, { FilterBar, FilterSearch, FilterSelect, FilterInput } from "@/app/components/table/DataTable";
import { useParties } from "@/app/components/projects/useProjectList";
import { fmtDate } from "@/app/components/projects/projectMeta";
import { PageHeader, StatCard } from "@/app/components/ui";

export default function ReceiptsPage() {
  const router = useRouter();
  const parties = useParties();
  const [filters, setFilters] = useState({ fy: fyOf() });
  const [page, setPage] = useState(1);
  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 25 }).filter(([, v]) => v !== "" && v != null));
  const { data, extra, loading } = useFetch("/billing/receipts", params);
  const sums = extra?.sums || { amount: 0, tds: 0, other: 0 };

  const columns = [
    { key: "number", header: "Receipt", kn: "ರಸೀದಿ", render: (r) => <span className="font-semibold">{r.number}</span> },
    { key: "received", header: "Received", kn: "ಸ್ವೀಕರಿಸಿದ ದಿನ", className: "whitespace-nowrap", render: (r) => fmtDate(r.receivedOn) },
    { key: "party", header: "Party", kn: "ಸಂಸ್ಥೆ", render: (r) => r.party?.code },
    {
      key: "instrument",
      header: "Cheque / ref.",
      kn: "ಚೆಕ್ ಸಂಖ್ಯೆ",
      render: (r) => (
        <span>
          <span className="text-cc-muted">{RECEIPT_MODES.find((m) => m.value === r.mode)?.label}</span> {r.instrumentNo}
          <span className="block text-xs text-cc-muted">{fmtDate(r.instrumentDate)}</span>
        </span>
      ),
    },
    { key: "bank", header: "Bank", kn: "ಬ್ಯಾಂಕ್", hideBelow: "lg", render: (r) => r.bankName || "—" },
    { key: "bill", header: "Bill", kn: "ಬಿಲ್", hideBelow: "md", render: (r) => r.bill?.number },
    { key: "amount", header: "Amount", kn: "ಮೊತ್ತ", className: "text-right tabular-nums whitespace-nowrap font-semibold", render: (r) => formatRupees(r.amount) },
    { key: "tds", header: "TDS", kn: "ಟಿಡಿಎಸ್", hideBelow: "lg", className: "text-right tabular-nums whitespace-nowrap", render: (r) => (r.tdsIncomeTax + r.tdsGst ? formatRupees(r.tdsIncomeTax + r.tdsGst) : "—") },
    {
      key: "status",
      header: "Status",
      kn: "ಸ್ಥಿತಿ",
      render: (r) =>
        r.status === "reversed" ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900" title={r.reverseReason}>Reversed</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">OK</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader title="Cheques received" kn="ಸ್ವೀಕರಿಸಿದ ಚೆಕ್‌ಗಳು" sub="To record a new cheque, open the bill and press Record cheque." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Received (filtered)" kn="ಸ್ವೀಕರಿಸಿದ ಮೊತ್ತ" value={formatRupees(sums.amount)} tone="ok" />
        <StatCard label="TDS deducted by parties" kn="ಟಿಡಿಎಸ್" value={formatRupees(sums.tds)} tone="accent" hint="Claim this in the income-tax / GST returns" />
        <StatCard label="Other deductions" kn="ಇತರೆ ಕಡಿತ" value={formatRupees(sums.other)} />
      </div>
      <FilterBar active={Object.values(filters).some(Boolean)} onClear={() => setFilters({})}>
        <FilterSearch value={filters.q || ""} onChange={(v) => setFilter("q", v)} placeholder="Cheque no., receipt no., bank…" />
        <FilterSelect label="Year" kn="ವರ್ಷ" value={filters.fy || ""} onChange={(v) => setFilter("fy", v)} options={fyOptions()} allLabel="All years" />
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={filters.party || ""} onChange={(v) => setFilter("party", v)} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        <FilterSelect label="Mode" kn="ವಿಧಾನ" value={filters.mode || ""} onChange={(v) => setFilter("mode", v)} options={RECEIPT_MODES} />
        <FilterSelect label="Status" kn="ಸ್ಥಿತಿ" value={filters.status || ""} onChange={(v) => setFilter("status", v)} options={[{ value: "active", label: "OK" }, { value: "reversed", label: "Reversed" }]} />
        <FilterInput label="From" kn="ಇಂದ" type="date" value={filters.from || ""} onChange={(v) => setFilter("from", v)} />
        <FilterInput label="To" kn="ವರೆಗೆ" type="date" value={filters.to || ""} onChange={(v) => setFilter("to", v)} />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading}
        onRowClick={(r) => router.push(`/billing/bills/${r.bill?._id}`)}
        page={page}
        pages={Math.max(1, Math.ceil((extra?.total || 0) / 25))}
        total={extra?.total}
        onPage={setPage}
        emptyText="No payments recorded."
      />
    </div>
  );
}
