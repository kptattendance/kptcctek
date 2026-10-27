"use client";

// Statements of Bills: the issued bills of one party under one fund, listed
// together so the party pays them with one cheque. "New statement" picks the
// party and fund, then the unpaid bills to put on it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, GROUP_STATUS, Badge, can, fyOptions } from "@/lib/billing";
import DataTable, { FilterBar, FilterSelect, StatusTabs } from "@/app/components/table/DataTable";
import { useParties, useFunds, fundOptions } from "@/app/components/projects/useProjectList";
import { fmtDate, isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import { PageHeader, Field, Button, inputCls, Spinner } from "@/app/components/ui";

const TABS = [
  { key: "open", label: "Waiting for cheque", kn: "ಚೆಕ್ ಬಾಕಿ", status: "issued,part_paid" },
  { key: "paid", label: "Paid", kn: "ಪಾವತಿಯಾಗಿದೆ", status: "paid" },
  { key: "cancelled", label: "Cancelled", kn: "ರದ್ದು", status: "cancelled" },
  { key: "all", label: "All", kn: "ಎಲ್ಲಾ", status: "" },
];

export default function GroupsPage() {
  const router = useRouter();
  const { me } = useMe();
  const parties = useParties();
  const { funds } = useFunds();
  const [tab, setTab] = useState("open");
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const status = TABS.find((t) => t.key === tab).status;
  const params = Object.fromEntries(Object.entries({ ...filters, status, page, limit: 25 }).filter(([, v]) => v !== "" && v != null));
  const { data, extra, loading } = useFetch("/billing/groups", params);

  const columns = [
    { key: "number", header: "Statement", kn: "ಪಟ್ಟಿ", render: (g) => <span className="whitespace-nowrap font-semibold">{g.number}</span> },
    { key: "date", header: "Date", kn: "ದಿನಾಂಕ", className: "whitespace-nowrap", render: (g) => fmtDate(g.date) },
    { key: "party", header: "Party", kn: "ಸಂಸ್ಥೆ", render: (g) => g.party?.code },
    { key: "fund", header: "Fund", kn: "ಅನುದಾನ", className: "max-w-[200px]", render: (g) => <span className="line-clamp-1">{g.fundName || "—"}</span> },
    { key: "bills", header: "Bills", kn: "ಬಿಲ್ಲುಗಳು", className: "text-right tabular-nums", render: (g) => g.totals?.bills },
    { key: "total", header: "Amount", kn: "ಮೊತ್ತ", className: "text-right tabular-nums whitespace-nowrap font-semibold", render: (g) => formatRupees(g.totals?.total) },
    { key: "due", header: "Due", kn: "ಬಾಕಿ", hideBelow: "md", className: "text-right tabular-nums whitespace-nowrap", render: (g) => (g.outstanding ? <span className="font-semibold text-cc-warn">{formatRupees(g.outstanding)}</span> : "—") },
    { key: "status", header: "Status", kn: "ಸ್ಥಿತಿ", render: (g) => <Badge map={GROUP_STATUS} status={g.status} /> },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader title="Statements of Bills" kn="ಬಿಲ್ಲುಗಳ ಪಟ್ಟಿ" sub="Bills of one party under one fund, paid with one cheque. The cheque is entered on every bill in it.">
        {can(me, "billing.prepare") && (
          <Button primary onClick={() => setCreating(true)}>
            <Layers size={16} aria-hidden /> New statement
          </Button>
        )}
      </PageHeader>
      <StatusTabs
        tabs={TABS}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
      />
      <FilterBar active={Object.values(filters).some(Boolean)} onClear={() => setFilters({})}>
        <FilterSelect label="Party" kn="ಸಂಸ್ಥೆ" value={filters.party || ""} onChange={(v) => setFilter("party", v)} options={parties.map((p) => ({ value: p._id, label: p.code }))} />
        <FilterSelect label="Fund" kn="ಅನುದಾನ" value={filters.fund || ""} onChange={(v) => setFilter("fund", v)} options={fundOptions(funds)} />
        <FilterSelect label="Year" kn="ವರ್ಷ" value={filters.fy || ""} onChange={(v) => setFilter("fy", v)} options={fyOptions()} allLabel="All years" />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading}
        onRowClick={(g) => router.push(`/billing/groups/${g._id}`)}
        page={page}
        pages={Math.max(1, Math.ceil((extra?.total || 0) / 25))}
        total={extra?.total}
        onPage={setPage}
        emptyText="No statements here."
      />
      {creating && <NewGroupDialog parties={parties} funds={funds} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/billing/groups/${id}`)} />}
    </div>
  );
}

function NewGroupDialog({ parties, funds, onClose, onCreated }) {
  const api = useApi();
  const [party, setParty] = useState(() => parties.find((p) => p.code === "MCC")?._id || "");
  const [fund, setFund] = useState(""); // fund id, or "none"
  const [picked, setPicked] = useState(() => new Set());
  const [when, setWhen] = useState(isoToday());
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = Boolean(party && fund);
  const candidates = useFetch(ready ? "/billing/groups/candidates" : null, { party, fund });
  const bills = useMemo(() => (ready ? candidates.data || [] : []), [ready, candidates.data]);
  const chosen = bills.filter((b) => picked.has(b._id));
  const total = chosen.reduce((a, b) => a + b.outstanding, 0);
  const choose = (setter) => (e) => {
    setter(e.target.value);
    setPicked(new Set());
  };
  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function create() {
    setBusy(true);
    try {
      const res = await api.post("/billing/groups", { partyId: party, fundId: fund === "none" ? undefined : fund, billIds: [...picked], date: when, remarks });
      notifySuccess(`Statement ${res.data.data.number} made. Print it and send it to the party.`);
      onCreated(res.data.data._id);
    } catch (err) {
      notifyError(err);
      setBusy(false);
    }
  }

  return (
    <Modal title="New Statement of Bills" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Party" kn="ಸಂಸ್ಥೆ">
            <select value={party} onChange={choose(setParty)} className={inputCls}>
              <option value="">Choose…</option>
              {parties.map((p) => (
                <option key={p._id} value={p._id}>{p.code}</option>
              ))}
            </select>
          </Field>
          <Field label="Fund" kn="ಅನುದಾನ">
            <select value={fund} onChange={choose(setFund)} className={inputCls}>
              <option value="">Choose…</option>
              {funds.map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
              <option value="none">No fund</option>
            </select>
          </Field>
        </div>

        {ready &&
          (candidates.loading && !candidates.data ? (
            <Spinner />
          ) : bills.length === 0 ? (
            <p className="rounded-lg bg-cc-subtle p-3 text-sm text-cc-muted">No unpaid bills of this party and fund that are not already on a statement. Issue the bills first.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-cc-border">
              <div className="flex items-center justify-between border-b border-cc-border bg-cc-subtle px-3 py-2 text-xs">
                <span className="font-semibold">{bills.length} unpaid bill{bills.length > 1 ? "s" : ""}</span>
                <button type="button" onClick={() => setPicked(new Set(bills.map((b) => b._id)))} className="font-semibold text-cc-primary hover:underline">
                  Tick all
                </button>
              </div>
              <ul className="divide-y divide-cc-border">
                {bills.map((b) => (
                  <li key={b._id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-cc-subtle">
                      <input type="checkbox" checked={picked.has(b._id)} onChange={() => toggle(b._id)} className="mt-1 h-4 w-4 accent-[var(--cc-primary)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-all font-semibold">{b.number}</span>
                        <span className="block text-xs text-cc-muted">
                          {fmtDate(b.billDate)} · App {b.lines.map((l) => l.appNo).join(", ")}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{formatRupees(b.outstanding)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Statement date" kn="ದಿನಾಂಕ">
            <input type="date" value={when} max={isoToday()} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Remarks (optional)" kn="ಟಿಪ್ಪಣಿ">
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} className={inputCls} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            {chosen.length > 0 && (
              <>
                <b>{chosen.length}</b> bill{chosen.length > 1 ? "s" : ""} · <b className="tabular-nums">{formatRupees(total)}</b>
              </>
            )}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Back</Button>
            <Button primary busy={busy} disabled={!chosen.length} onClick={create}>
              Make statement
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
