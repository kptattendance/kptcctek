"use client";

// Ready to bill: jobs whose report is issued and that are on no bill yet.
// Tick the jobs of one party -> "Create bill" makes a draft to check and issue.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useFetch, fyOf } from "@/lib/billing";
import DataTable, { FilterBar, FilterSearch, FilterSelect } from "@/app/components/table/DataTable";
import { useParties } from "@/app/components/projects/useProjectList";
import { fmtDate, daysSince, ageClass, isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import { PageHeader, Field, Button, inputCls } from "@/app/components/ui";

export default function ReadyToBillPage() {
  const api = useApi();
  const router = useRouter();
  const parties = useParties();
  const [filters, setFilters] = useState({ party: "", q: "" });
  const { data, loading, reload } = useFetch("/billing/ready", filters);
  const rows = useMemo(() => data || [], [data]);
  const [picked, setPicked] = useState(() => new Set());
  const [dialog, setDialog] = useState(false);

  const chosen = rows.filter((r) => picked.has(r._id));
  const party = chosen[0]?.party;
  const total = chosen.reduce((a, r) => a + (r.charges?.net || 0) + (r.charges?.gst || 0), 0);

  function toggle(row) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(row._id)) next.delete(row._id);
      else {
        if (party && row.party?._id !== party._id) {
          notifyError(`A bill is for one party. You have ${party.code} jobs ticked; this one is ${row.party?.code}.`, { id: "one-party" });
          return s;
        }
        next.add(row._id);
      }
      return next;
    });
  }
  function selectAllOfParty() {
    const target = party?._id || rows[0]?.party?._id;
    setPicked(new Set(rows.filter((r) => r.party?._id === target).map((r) => r._id)));
  }

  const columns = [
    {
      key: "pick",
      header: "",
      render: (r) => (
        <input
          type="checkbox"
          aria-label={`Select application ${r.appNo}`}
          checked={picked.has(r._id)}
          onChange={() => toggle(r)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-[var(--cc-primary)]"
        />
      ),
    },
    { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (r) => <span className="font-semibold">{r.appNo}<span className="block text-xs font-normal text-cc-muted">{r.financialYear}</span></span> },
    { key: "party", header: "Party", kn: "ಸಂಸ್ಥೆ", render: (r) => r.party?.code },
    { key: "ward", header: "Ward", kn: "ವಾರ್ಡ್", hideBelow: "md", render: (r) => r.ward || "—" },
    { key: "contractor", header: "Contractor", kn: "ಗುತ್ತಿಗೆದಾರ", hideBelow: "lg", className: "max-w-[220px]", render: (r) => <span className="line-clamp-1">{r.contractorName || "—"}</span> },
    { key: "cert", header: "Report", kn: "ವರದಿ", hideBelow: "md", render: (r) => <span>{r.report?.certificateNo || "—"}<span className="block text-xs text-cc-muted">{fmtDate(r.report?.issuedOn)}</span></span> },
    { key: "waiting", header: "Waiting", kn: "ದಿನಗಳು", hideBelow: "lg", render: (r) => (r.report?.issuedOn ? <span className={ageClass(daysSince(r.report.issuedOn))}>{daysSince(r.report.issuedOn)} d</span> : "—") },
    { key: "bill", header: "Work bill", kn: "ಕಾಮಗಾರಿ ಬಿಲ್", hideBelow: "xl", className: "text-right tabular-nums whitespace-nowrap", render: (r) => formatRupees(r.projectBillAmount) },
    { key: "fee", header: "Fee + GST", kn: "ಶುಲ್ಕ", className: "text-right tabular-nums whitespace-nowrap font-semibold", render: (r) => formatRupees((r.charges?.net || 0) + (r.charges?.gst || 0)) },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-24">
      <PageHeader title="Ready to bill" kn="ಬಿಲ್ ಮಾಡಬೇಕಾದ ಅರ್ಜಿಗಳು" sub="Reports issued, not billed yet. Tick the jobs of one party and create the bill." />

      <FilterBar active={Boolean(filters.party || filters.q)} onClear={() => setFilters({ party: "", q: "" })}>
        <FilterSearch value={filters.q} onChange={(v) => setFilters((f) => ({ ...f, q: v }))} placeholder="App no., contractor, ward, report no.…" />
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={filters.party} onChange={(v) => setFilters((f) => ({ ...f, party: v }))} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        {rows.length > 0 && (
          <button type="button" onClick={selectAllOfParty} className="cc-btn cc-press px-4 py-2.5 text-sm">
            Tick all of {party?.code || rows[0]?.party?.code}
          </button>
        )}
      </FilterBar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={toggle} total={rows.length} emptyText="Nothing waiting. Jobs appear here when their report is issued." />

      {chosen.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-cc-border bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-bold">{chosen.length}</span> application{chosen.length > 1 ? "s" : ""} of <span className="font-bold">{party?.code}</span> ·{" "}
              <span className="font-bold tabular-nums">{formatRupees(total)}</span>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setPicked(new Set())}>Clear</Button>
              <Button primary onClick={() => setDialog(true)}>
                <FilePlus2 size={16} aria-hidden /> Create bill
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <CreateBillDialog
          party={party}
          rows={chosen}
          total={total}
          onClose={() => setDialog(false)}
          onCreate={async (body) => {
            try {
              const res = await api.post("/billing/bills", { ...body, projectIds: chosen.map((r) => r._id) });
              notifySuccess("Draft bill created. Check it and issue.");
              setPicked(new Set());
              reload();
              router.push(`/billing/bills/${res.data.data._id}`);
            } catch (err) {
              notifyError(err);
            }
          }}
        />
      )}
    </div>
  );
}

function CreateBillDialog({ party, rows, total, onClose, onCreate }) {
  const [billDate, setBillDate] = useState(isoToday());
  const [subject, setSubject] = useState(`Third party inspection charges - ${rows.length} application${rows.length > 1 ? "s" : ""}`);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const mixed = new Set(rows.map((r) => r.financialYear)).size > 1;
  return (
    <Modal title={`New bill to ${party?.name || party?.code}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-cc-primary-soft p-3 text-sm">
          {rows.length} application{rows.length > 1 ? "s" : ""} · total <span className="font-bold tabular-nums">{formatRupees(total)}</span>
          {party?.gstMode === "exclusive" ? " (GST added on top)" : " (GST included in the fee)"}
          {mixed && <span className="mt-1 block text-cc-warn">Includes applications from more than one year.</span>}
        </div>
        <Field label="Bill date" kn="ಬಿಲ್ ದಿನಾಂಕ" hint={`Bill number is given when you issue it (year ${fyOf(billDate || new Date())}).`}>
          <input type="date" value={billDate} max={isoToday()} onChange={(e) => setBillDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Subject" kn="ವಿಷಯ">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} className={inputCls} />
        </Field>
        <Field label="Remarks (optional)" kn="ಟಿಪ್ಪಣಿ">
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} maxLength={1000} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            onClick={async () => {
              setBusy(true);
              await onCreate({ billDate, subject, remarks });
              setBusy(false);
            }}
          >
            Create draft
          </Button>
        </div>
      </div>
    </Modal>
  );
}
