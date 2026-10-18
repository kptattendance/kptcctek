"use client";

// Office: the inward register (replaces the Excel year sheet). Table with
// filters; a row opens the full entry.

import Link from "next/link";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { formatRupees } from "@/lib/api";
import DataTable, { FilterBar, FilterSearch, FilterSelect, FilterInput } from "@/app/components/table/DataTable";
import { useProjectList, useParties } from "@/app/components/projects/useProjectList";
import ProjectDrawer from "@/app/components/projects/ProjectDrawer";
import { StatusBadge, STATUS, fmtDate } from "@/app/components/projects/projectMeta";

export default function RegisterPage() {
  const parties = useParties();
  const [openId, setOpenId] = useState(null);
  const list = useProjectList({}, { key: "serialNo", dir: "desc" });

  const columns = [
    { key: "serialNo", header: "Sl.", sortKey: "serialNo", render: (p) => <span className="font-bold tabular-nums">{p.serialNo}</span> },
    { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (p) => <span className="font-semibold">{p.appNo}</span> },
    { key: "appDate", header: "Date", kn: "ದಿನಾಂಕ", sortKey: "appDate", className: "whitespace-nowrap", render: (p) => fmtDate(p.appDate) },
    { key: "party", header: "Party", render: (p) => p.party?.code },
    { key: "ward", header: "Ward", kn: "ವಾರ್ಡ್", sortKey: "ward", hideBelow: "md", render: (p) => p.ward || "—" },
    { key: "file", header: "Work order", kn: "ಅ.ಪ.", hideBelow: "xl", render: (p) => (p.fileNo ? `${p.fileNo}${p.workYear ? ` / ${p.workYear}` : ""}` : "—") },
    { key: "contractor", header: "Contractor", kn: "ಗುತ್ತಿಗೆದಾರ", hideBelow: "lg", className: "max-w-[200px]", render: (p) => <span className="line-clamp-1">{p.contractorName || "—"}</span> },
    { key: "engineer", header: "Engineer", kn: "ಅಭಿಯಂತರ", hideBelow: "xl", className: "max-w-[180px]", render: (p) => <span className="line-clamp-1">{p.partyEngineer || "—"}</span> },
    { key: "bill", header: "Bill", kn: "ಬಿಲ್", sortKey: "bill", className: "text-right tabular-nums whitespace-nowrap", render: (p) => formatRupees(p.projectBillAmount) },
    { key: "fee", header: "Party pays", kn: "ಶುಲ್ಕ", hideBelow: "lg", className: "text-right tabular-nums whitespace-nowrap", render: (p) => formatRupees(p.charges?.invoiceTotal) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Register</h1>
          <p className="text-sm text-cc-muted">ನೋಂದಣಿ ಪುಸ್ತಕ · This financial year. Tap a row to see the full entry.</p>
        </div>
        <Link href="/office/incoming" className="cc-btn-primary cc-press flex items-center gap-2 px-4 py-2.5 text-sm">
          <ScanLine size={16} aria-hidden /> New letter
        </Link>
      </header>

      <FilterBar active={list.hasFilters} onClear={list.clearFilters}>
        <FilterSearch value={list.filters.q || ""} onChange={(v) => list.setFilter("q", v)} placeholder="App no., contractor, engineer, file no.…" />
        <FilterSelect label="Status" kn="ಸ್ಥಿತಿ" value={list.filters.status || ""} onChange={(v) => list.setFilter("status", v)} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={list.filters.party || ""} onChange={(v) => list.setFilter("party", v)} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        <FilterInput label="Ward" kn="ವಾರ್ಡ್" value={list.filters.ward || ""} onChange={(v) => list.setFilter("ward", v)} inputMode="numeric" />
        <FilterInput label="From" kn="ಇಂದ" type="date" value={list.filters.from || ""} onChange={(v) => list.setFilter("from", v)} />
        <FilterInput label="To" kn="ವರೆಗೆ" type="date" value={list.filters.to || ""} onChange={(v) => list.setFilter("to", v)} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        sort={list.sort}
        onSort={list.toggleSort}
        onRowClick={(p) => setOpenId(p._id)}
        page={list.page}
        pages={list.pages}
        total={list.total}
        onPage={list.setPage}
        emptyText="No applications match."
      />

      {openId && <ProjectDrawer projectId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
