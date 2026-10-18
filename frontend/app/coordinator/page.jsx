"use client";

// Work coordinator: allot the inspection team for each application and follow
// it through inspection to the report. Table + filters; row opens details.

import { useCallback, useEffect, useState } from "react";
import { UsersRound, ClipboardCheck, FileCheck2, PauseCircle, XCircle, Inbox } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import Avatar from "@/app/components/users/Avatar";
import DataTable, { FilterBar, FilterSearch, FilterSelect, FilterInput, StatusTabs } from "@/app/components/table/DataTable";
import { useProjectList, useParties } from "@/app/components/projects/useProjectList";
import ProjectDrawer from "@/app/components/projects/ProjectDrawer";
import { AssignDialog, StatusDialog } from "@/app/components/projects/dialogs";
import { StatusBadge, fmtDate, daysSince, ageClass, WORK_TYPES } from "@/app/components/projects/projectMeta";

const TABS = [
  { key: "assign", label: "To assign", kn: "ನಿಯೋಜಿಸಬೇಕು", status: "received,on_hold" },
  { key: "inspect", label: "Awaiting inspection", kn: "ತಪಾಸಣೆ ಬಾಕಿ", status: "assigned" },
  { key: "report", label: "Report pending", kn: "ವರದಿ ಬಾಕಿ", status: "inspected" },
  { key: "done", label: "Done", kn: "ಮುಗಿದಿದೆ", status: "report_issued,billed,paid" },
  { key: "cancelled", label: "Cancelled", kn: "ರದ್ದು", status: "cancelled" },
];

function TeamStack({ team }) {
  if (!team?.length) return <span className="text-cc-muted">—</span>;
  return (
    <span className="flex items-center" title={team.map((m) => `${m.user?.name} (${m.role})`).join(", ")}>
      {team.slice(0, 3).map((m, i) => (
        <span key={m.user?._id || i} className={i ? "-ml-2" : ""}>
          <Avatar name={m.user?.name || "?"} src={m.user?.imageUrl} size={28} />
        </span>
      ))}
      {team.length > 3 && <span className="ml-1 text-xs font-bold text-cc-muted">+{team.length - 3}</span>}
    </span>
  );
}

export default function CoordinatorPage() {
  const api = useApi();
  const parties = useParties();
  const [tab, setTab] = useState("assign");
  const [summary, setSummary] = useState({ byStatus: {}, workload: [] });
  const [staff, setStaff] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assigning, setAssigning] = useState(null);
  const [action, setAction] = useState(null); // { project, to }

  const current = TABS.find((t) => t.key === tab);
  const list = useProjectList({ status: current.status }, { key: "appDate", dir: "asc" });

  const loadSummary = useCallback(() => {
    api.get("/projects/coordinator/summary").then((r) => setSummary(r.data.data)).catch((err) => notifyError(err, { id: "summary" }));
  }, [api]);
  useEffect(() => {
    loadSummary();
    api.get("/users/staff-options").then((r) => setStaff(r.data.data)).catch((err) => notifyError(err, { id: "staff" }));
  }, [api, loadSummary]);

  const s = summary.byStatus || {};
  const counts = {
    assign: (s.received || 0) + (s.on_hold || 0),
    inspect: s.assigned || 0,
    report: s.inspected || 0,
    done: (s.report_issued || 0) + (s.billed || 0) + (s.paid || 0),
    cancelled: s.cancelled || 0,
  };

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  // The one most likely next step, shown in the table row.
  function primaryAction(p) {
    if (["received", "on_hold"].includes(p.status))
      return (
        <button type="button" onClick={stop(() => setAssigning(p))} className="cc-btn-primary cc-press flex items-center gap-1.5 px-3 py-1.5 text-sm">
          <UsersRound size={15} aria-hidden /> Assign
        </button>
      );
    if (p.status === "assigned")
      return (
        <button type="button" onClick={stop(() => setAction({ project: p, to: "inspected" }))} className="cc-chip cc-press flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold">
          <ClipboardCheck size={15} aria-hidden /> Inspected
        </button>
      );
    if (p.status === "inspected")
      return (
        <button type="button" onClick={stop(() => setAction({ project: p, to: "report_issued" }))} className="cc-btn-primary cc-press flex items-center gap-1.5 px-3 py-1.5 text-sm">
          <FileCheck2 size={15} aria-hidden /> Report
        </button>
      );
    return null;
  }

  // Everything allowed for this job, in the details panel.
  function allActions(p) {
    const btn = "cc-chip cc-press flex items-center gap-2 px-4 py-2 text-sm font-semibold";
    return (
      <>
        {["received", "assigned", "on_hold"].includes(p.status) && (
          <button type="button" onClick={() => setAssigning(p)} className="cc-btn-primary cc-press flex items-center gap-2 px-4 py-2 text-sm">
            <UsersRound size={16} aria-hidden /> {p.team?.length ? "Change team" : "Assign team"}
          </button>
        )}
        {p.status === "assigned" && (
          <button type="button" onClick={() => setAction({ project: p, to: "inspected" })} className={btn}>
            <ClipboardCheck size={16} aria-hidden /> Mark inspected
          </button>
        )}
        {p.status === "inspected" && (
          <button type="button" onClick={() => setAction({ project: p, to: "report_issued" })} className="cc-btn-primary cc-press flex items-center gap-2 px-4 py-2 text-sm">
            <FileCheck2 size={16} aria-hidden /> Report issued
          </button>
        )}
        {p.status === "on_hold" && !p.team?.length && (
          <button type="button" onClick={() => setAction({ project: p, to: "received" })} className={btn}>
            <Inbox size={16} aria-hidden /> Resume
          </button>
        )}
        {["received", "assigned", "inspected"].includes(p.status) && (
          <button type="button" onClick={() => setAction({ project: p, to: "on_hold" })} className={`${btn} text-cc-warn`}>
            <PauseCircle size={16} aria-hidden /> Hold
          </button>
        )}
        {["received", "assigned", "on_hold"].includes(p.status) && (
          <button type="button" onClick={() => setAction({ project: p, to: "cancelled" })} className={`${btn} text-cc-bad`}>
            <XCircle size={16} aria-hidden /> Cancel
          </button>
        )}
      </>
    );
  }

  const waiting = tab !== "done" && tab !== "cancelled";
  const columns = [
    { key: "serialNo", header: "Sl.", sortKey: "serialNo", render: (p) => <span className="font-bold tabular-nums">{p.serialNo}</span> },
    { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (p) => <span className="font-semibold">{p.appNo}</span> },
    {
      key: "appDate", header: "Received", kn: "ಸ್ವೀಕೃತಿ", sortKey: "appDate",
      render: (p) => (
        <span className="whitespace-nowrap">
          {fmtDate(p.appDate)}
          {waiting && <span className={`block text-xs ${ageClass(daysSince(p.appDate))}`}>{daysSince(p.appDate)} days</span>}
        </span>
      ),
    },
    { key: "party", header: "Party", render: (p) => p.party?.code },
    { key: "ward", header: "Ward", kn: "ವಾರ್ಡ್", sortKey: "ward", hideBelow: "md", render: (p) => p.ward || "—" },
    { key: "contractor", header: "Contractor", kn: "ಗುತ್ತಿಗೆದಾರ", hideBelow: "lg", className: "max-w-[200px]", render: (p) => <span className="line-clamp-1">{p.contractorName || "—"}</span> },
    { key: "bill", header: "Bill", kn: "ಬಿಲ್", sortKey: "bill", hideBelow: "xl", className: "text-right tabular-nums whitespace-nowrap", render: (p) => formatRupees(p.projectBillAmount) },
    {
      key: "team", header: "Team", kn: "ತಂಡ", hideBelow: tab === "assign" ? "xl" : undefined,
      render: (p) => (
        <span>
          <TeamStack team={p.team} />
          {tab === "inspect" && p.plannedInspectionDate && <span className="block text-xs text-cc-muted">visit {fmtDate(p.plannedInspectionDate)}</span>}
        </span>
      ),
    },
    { key: "status", header: "Status", hideBelow: "md", render: (p) => <StatusBadge status={p.status} /> },
    { key: "act", header: "", className: "text-right", render: (p) => primaryAction(p) },
  ];

  const afterChange = () => {
    setAssigning(null);
    setAction(null);
    setRefreshKey((k) => k + 1);
    list.reload();
    loadSummary();
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">Assign & track</h1>
        <p className="text-sm text-cc-muted">ನಿಯೋಜನೆ ಮತ್ತು ಅನುಸರಣೆ · Oldest first. Tap a row for details and all actions.</p>
      </header>

      <StatusTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />

      <FilterBar active={list.hasFilters} onClear={list.clearFilters}>
        <FilterSearch value={list.filters.q || ""} onChange={(v) => list.setFilter("q", v)} placeholder="App no., contractor, engineer, file no.…" />
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={list.filters.party || ""} onChange={(v) => list.setFilter("party", v)} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        <FilterInput label="Ward" kn="ವಾರ್ಡ್" value={list.filters.ward || ""} onChange={(v) => list.setFilter("ward", v)} inputMode="numeric" />
        <FilterSelect label="Work" kn="ವಿಧ" value={list.filters.workType || ""} onChange={(v) => list.setFilter("workType", v)} options={WORK_TYPES.map((w) => ({ value: w.value, label: w.label }))} />
        <FilterSelect label="Inspector" kn="ತಪಾಸಕರು" value={list.filters.member || ""} onChange={(v) => list.setFilter("member", v)} options={staff.map((u) => ({ value: u._id, label: u.name }))} />
        <FilterInput label="From" kn="ಇಂದ" type="date" value={list.filters.from || ""} onChange={(v) => list.setFilter("from", v)} />
        <FilterInput label="To" kn="ವರೆಗೆ" type="date" value={list.filters.to || ""} onChange={(v) => list.setFilter("to", v)} />
      </FilterBar>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_260px]">
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
          emptyText={tab === "assign" ? "Nothing to assign. New applications from the office appear here." : "Nothing here."}
        />

        <aside className="cc-card h-fit p-4">
          <h2 className="text-sm font-bold">Open jobs per person</h2>
          <p className="text-xs text-cc-muted">ಬಾಕಿ ಕೆಲಸ · click to filter</p>
          {summary.workload.length === 0 ? (
            <p className="mt-3 text-sm text-cc-muted">No open jobs.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              {summary.workload.map((w) => (
                <li key={w.user._id}>
                  <button
                    type="button"
                    onClick={() => list.setFilter("member", list.filters.member === w.user._id ? "" : w.user._id)}
                    aria-pressed={list.filters.member === w.user._id}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${list.filters.member === w.user._id ? "rounded-[10px] border border-cc-primary/40 bg-cc-primary-soft text-cc-primary" : "cc-press rounded-xl hover:bg-cc-subtle"}`}
                  >
                    <Avatar name={w.user.name} src={w.user.imageUrl} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{w.user.name}</span>
                    <span className="text-xs font-bold tabular-nums">{w.open}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {openId && <ProjectDrawer projectId={openId} refreshKey={refreshKey} onClose={() => setOpenId(null)} actions={allActions} />}
      {assigning && <AssignDialog project={assigning} staff={staff} workload={summary.workload} onClose={() => setAssigning(null)} onSaved={afterChange} />}
      {action && <StatusDialog project={action.project} to={action.to} onClose={() => setAction(null)} onSaved={afterChange} />}
    </div>
  );
}
