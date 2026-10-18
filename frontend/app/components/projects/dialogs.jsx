"use client";

// Dialogs that change an application: assign team, and status changes
// (inspected / report issued / hold / cancel / resume).

import { useEffect, useMemo, useState } from "react";
import { UsersRound, ClipboardCheck, FileCheck2, PauseCircle, XCircle, Inbox, LoaderCircle, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import Avatar from "../users/Avatar";
import { STATUS, isoToday } from "./projectMeta";

const inputCls = "neu-inset w-full px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-neu-accent";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-neu-muted";

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
      <div className="neu-raised max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neu-muted"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AssignDialog({ project, staff, workload = [], onClose, onSaved }) {
  const api = useApi();
  const [roles, setRoles] = useState(() => Object.fromEntries((project.team || []).map((m) => [m.user?._id || m.user, m.role])));
  const [planned, setPlanned] = useState(project.plannedInspectionDate ? project.plannedInspectionDate.slice(0, 10) : "");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const openJobs = useMemo(() => Object.fromEntries(workload.map((w) => [w.user._id, w.open])), [workload]);

  const shown = staff.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = Object.entries(roles).filter(([, r]) => r);

  async function save() {
    setSaving(true);
    try {
      await api.post(`/projects/${project._id}/assign`, {
        team: chosen.map(([user, role]) => ({ user, role })),
        plannedInspectionDate: planned || null,
      });
      notifySuccess(`Team assigned for application ${project.appNo}`);
      onSaved();
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Assign team · App ${project.appNo}`} onClose={onClose}>
      <p className="mb-4 text-sm text-neu-muted">Inspectors share the 45%; support staff share the 10%. The number is each person&apos;s open jobs.</p>
      <label className="neu-inset mb-3 flex items-center gap-2 px-4 py-2.5">
        <Search size={15} className="text-neu-muted" aria-hidden />
        <span className="sr-only">Search staff</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff" className="w-full bg-transparent text-sm outline-none" />
      </label>
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {shown.map((s) => {
          const role = roles[s._id] || "";
          return (
            <li key={s._id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <Avatar name={s.name} src={s.imageUrl} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-neu-muted">{s.designation || "—"} · {openJobs[s._id] || 0} open</span>
              </span>
              <span className="flex shrink-0 gap-1" role="group" aria-label={`Role for ${s.name}`}>
                {[["", "—"], ["inspector", "Inspector"], ["support", "Support"]].map(([v, l]) => (
                  <button
                    key={v || "none"}
                    type="button"
                    onClick={() => setRoles((r) => ({ ...r, [s._id]: v }))}
                    aria-pressed={role === v}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${role === v ? (v ? "neu-primary" : "neu-inset") : "neu-raised-sm"}`}
                  >
                    {l}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
        {shown.length === 0 && <li className="p-4 text-center text-sm text-neu-muted">No staff found. Add faculty in Users first.</li>}
      </ul>
      <label className="mt-5 block">
        <span className={labelCls}>Planned inspection date · ತಪಾಸಣೆ ದಿನಾಂಕ</span>
        <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} className={inputCls} />
      </label>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-sm text-neu-muted">{chosen.length} selected</span>
        <button type="button" disabled={saving || !chosen.some(([, r]) => r === "inspector")} onClick={save} className="neu-primary neu-press flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <UsersRound size={16} />} Save team
        </button>
      </div>
    </Modal>
  );
}

export const STATUS_ACTIONS = {
  inspected: { title: "Mark inspected", button: "Mark inspected", icon: ClipboardCheck },
  report_issued: { title: "Report issued", button: "Save", icon: FileCheck2 },
  on_hold: { title: "Put on hold", button: "Put on hold", icon: PauseCircle },
  cancelled: { title: "Cancel application", button: "Cancel application", icon: XCircle },
  received: { title: "Resume", button: "Resume", icon: Inbox },
};

export function StatusDialog({ project, to, onClose, onSaved }) {
  const api = useApi();
  const [f, setF] = useState({ inspectionDate: isoToday(), km: project.km || "", certificateNo: "", issuedOn: isoToday(), note: "" });
  const [saving, setSaving] = useState(false);
  const a = STATUS_ACTIONS[to];
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const needsReason = to === "on_hold" || to === "cancelled";

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${project._id}/status`, { to, ...f, km: f.km === "" ? undefined : f.km });
      notifySuccess(`App ${project.appNo}: ${STATUS[to].label.toLowerCase()}`);
      onSaved();
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  }

  return (
    <Modal title={`${a.title} · App ${project.appNo}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {to === "inspected" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Inspection date · ತಪಾಸಣೆ ದಿನಾಂಕ</span>
              <input type="date" required max={isoToday()} value={f.inspectionDate} onChange={set("inspectionDate")} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Distance km · ದೂರ</span>
              <input type="number" min="0" inputMode="numeric" value={f.km} onChange={set("km")} className={inputCls} />
              <span className="mt-1 block text-xs text-neu-muted">TA ₹15/km</span>
            </label>
          </div>
        )}
        {to === "report_issued" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Certificate no. · ದೃಢಪತ್ರ ಸಂಖ್ಯೆ</span>
              <input value={f.certificateNo} onChange={set("certificateNo")} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Report date · ವರದಿ ದಿನಾಂಕ</span>
              <input type="date" value={f.issuedOn} onChange={set("issuedOn")} className={inputCls} />
            </label>
          </div>
        )}
        <label className="block">
          <span className={labelCls}>{needsReason ? "Reason · ಕಾರಣ" : "Note (optional) · ಟಿಪ್ಪಣಿ"}</span>
          <textarea rows={2} required={needsReason} value={f.note} onChange={set("note")} placeholder={to === "cancelled" ? "e.g. date mismatch" : ""} className={inputCls} />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="neu-raised-sm neu-press px-5 py-2.5 text-sm font-semibold">Back</button>
          <button type="submit" disabled={saving} className={`neu-press flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${to === "cancelled" ? "neu-raised-sm text-neu-bad" : "neu-primary"}`}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <a.icon size={16} />} {a.button}
          </button>
        </div>
      </form>
    </Modal>
  );
}
