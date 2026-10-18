"use client";

// Faculty: the inspections I am part of. Mark my job inspected; everything
// else (team, report, billing) is the coordinator's and accounts' job.

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import DataTable, { FilterBar, FilterSearch, FilterSelect, FilterInput, StatusTabs } from "@/app/components/table/DataTable";
import { useProjectList, useParties } from "@/app/components/projects/useProjectList";
import ProjectDrawer from "@/app/components/projects/ProjectDrawer";
import { StatusDialog } from "@/app/components/projects/dialogs";
import { StatusBadge, fmtDate, daysSince, ageClass } from "@/app/components/projects/projectMeta";

const TABS = [
  { key: "todo", label: "To inspect", kn: "ತಪಾಸಣೆ ಬಾಕಿ", status: "assigned" },
  { key: "inspected", label: "Inspected", kn: "ತಪಾಸಣೆ ಆಗಿದೆ", status: "inspected" },
  { key: "done", label: "Completed", kn: "ಪೂರ್ಣಗೊಂಡಿದೆ", status: "report_issued,billed,paid" },
];

export default function FacultyPage() {
  const api = useApi();
  const { me } = useMe();
  const parties = useParties();
  const [tab, setTab] = useState("todo");
  const [counts, setCounts] = useState({});
  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [marking, setMarking] = useState(null);

  const current = TABS.find((t) => t.key === tab);
  const list = useProjectList({ status: current.status, assigned: "me" }, { key: "planned", dir: "asc" });

  const loadCounts = useCallback(() => {
    api.get("/projects/my/summary").then((r) => {
      const s = r.data.data.byStatus;
      setCounts({ todo: s.assigned || 0, inspected: s.inspected || 0, done: (s.report_issued || 0) + (s.billed || 0) + (s.paid || 0) });
    }).catch(() => {});
  }, [api]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const myRole = (p) => p.team?.find((m) => String(m.user?._id) === String(me?._id))?.role;

  const markButton = (p, compact) =>
    p.status === "assigned" && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMarking(p);
        }}
        className={`cc-btn-primary cc-press flex items-center gap-1.5 text-sm ${compact ? "px-3 py-1.5" : "px-4 py-2"}`}
      >
        <ClipboardCheck size={15} aria-hidden /> {compact ? "Inspected" : "Mark inspected"}
      </button>
    );

  const columns = [
    { key: "serialNo", header: "Sl.", sortKey: "serialNo", render: (p) => <span className="font-bold tabular-nums">{p.serialNo}</span> },
    { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (p) => <span className="font-semibold">{p.appNo}</span> },
    { key: "party", header: "Party", render: (p) => p.party?.code },
    { key: "ward", header: "Ward", kn: "ವಾರ್ಡ್", sortKey: "ward", hideBelow: "md", render: (p) => p.ward || "—" },
    { key: "work", header: "Work", kn: "ಕಾಮಗಾರಿ", hideBelow: "lg", className: "max-w-[280px]", render: (p) => <span className="line-clamp-1">{p.appDetails || "—"}</span> },
    {
      key: "planned", header: tab === "todo" ? "Visit on" : "Inspected", kn: tab === "todo" ? "ಭೇಟಿ" : "ತಪಾಸಣೆ", sortKey: tab === "todo" ? "planned" : "inspected",
      render: (p) => (tab === "todo" ? (p.plannedInspectionDate ? fmtDate(p.plannedInspectionDate) : <span className={ageClass(daysSince(p.appDate))}>Not set</span>) : fmtDate(p.inspectionDate)),
    },
    { key: "role", header: "My role", hideBelow: "md", render: (p) => <span className="capitalize">{myRole(p) || "—"}</span> },
    { key: "bill", header: "Bill", sortKey: "bill", hideBelow: "xl", className: "text-right tabular-nums", render: (p) => formatRupees(p.projectBillAmount) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "act", header: "", className: "text-right", render: (p) => markButton(p, true) || null },
  ];

  const afterChange = () => {
    setMarking(null);
    setRefreshKey((k) => k + 1);
    list.reload();
    loadCounts();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">My inspections</h1>
        <p className="text-sm text-cc-muted">ನನ್ನ ತಪಾಸಣೆಗಳು · Jobs you are on. Tap a row for full details and the scanned letter.</p>
      </header>

      <StatusTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />

      <FilterBar active={list.hasFilters} onClear={list.clearFilters}>
        <FilterSearch value={list.filters.q || ""} onChange={(v) => list.setFilter("q", v)} placeholder="App no., contractor, work…" />
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
        emptyText={tab === "todo" ? "No inspections waiting for you." : "Nothing here yet."}
      />

      {openId && (
        <ProjectDrawer
          projectId={openId}
          refreshKey={refreshKey}
          onClose={() => setOpenId(null)}
          actions={(p) => markButton(p, false)}
        />
      )}
      {marking && <StatusDialog project={marking} to="inspected" onClose={() => setMarking(null)} onSaved={afterChange} />}
    </div>
  );
}
