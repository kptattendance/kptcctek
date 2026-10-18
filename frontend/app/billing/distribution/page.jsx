"use client";

// Distribution: paid applications are shared out automatically. Once a
// month the coordinator prepares the Remuneration Statement (all waiting
// applications up to that month), the Principal approves it, and it is
// marked paid out.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, STATEMENT_STATUS, Badge, can, monthLabel, fyOptions, fyOf } from "@/lib/billing";
import DataTable, { FilterBar, FilterSelect } from "@/app/components/table/DataTable";
import { fmtDate } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import { PageHeader, Card, Field, Button, inputCls, StatCard } from "@/app/components/ui";
import { PeopleTable, HeadsTable } from "@/app/components/billing/DistributionTables";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function DistributionPage() {
  const api = useApi();
  const router = useRouter();
  const { me } = useMe();
  const [fy, setFy] = useState(fyOf());
  const pending = useFetch("/billing/distribution/pending");
  const statements = useFetch("/billing/statements", fy ? { fy } : {});
  const [preparing, setPreparing] = useState(false);
  const p = pending.extra || { totals: { applications: 0, amount: 0, ta: 0 }, people: [], heads: [] };
  const waitingRows = pending.data || [];

  const columns = [
    { key: "number", header: "Statement", kn: "ಪಟ್ಟಿ", render: (s) => <span className="font-semibold">{s.number}</span> },
    { key: "month", header: "Month", kn: "ತಿಂಗಳು", render: (s) => monthLabel(s.month) },
    { key: "apps", header: "Applications", kn: "ಅರ್ಜಿಗಳು", className: "text-right tabular-nums", render: (s) => s.totals?.applications },
    { key: "fee", header: "Fee received", kn: "ಶುಲ್ಕ", hideBelow: "md", className: "text-right tabular-nums whitespace-nowrap", render: (s) => formatRupees(s.totals?.fee) },
    { key: "shared", header: "Shared out", kn: "ಹಂಚಿದ ಮೊತ್ತ", className: "text-right tabular-nums whitespace-nowrap font-semibold", render: (s) => formatRupees((s.totals?.amount || 0) + (s.totals?.ta || 0)) },
    { key: "by", header: "Prepared by", kn: "ತಯಾರಿಸಿದವರು", hideBelow: "lg", render: (s) => s.preparedBy?.name },
    { key: "approved", header: "Approved", kn: "ಅನುಮೋದನೆ", hideBelow: "lg", render: (s) => (s.approvedBy ? `${s.approvedBy.name}, ${fmtDate(s.approvedAt)}` : "—") },
    { key: "status", header: "Status", kn: "ಸ್ಥಿತಿ", render: (s) => <Badge map={STATEMENT_STATUS} status={s.status} short /> },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader title="Distribution" kn="ಹಣ ಹಂಚಿಕೆ" sub="Fees of paid bills, shared among people and fund heads. One statement a month.">
        {can(me, "payouts.prepare") && (
          <Button primary onClick={() => setPreparing(true)} disabled={!p.totals.applications}>
            <HandCoins size={16} aria-hidden /> Prepare monthly statement
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Paid applications waiting" kn="ಹಂಚಿಕೆ ಬಾಕಿ ಅರ್ಜಿಗಳು" value={p.totals.applications} tone="accent" hint={waitingRows[0] ? `Oldest paid ${fmtDate(waitingRows[0].paidOn)}` : "Nothing waiting"} />
        <StatCard label="To be shared" kn="ಹಂಚಬೇಕಾದ ಮೊತ್ತ" value={formatRupees(p.totals.amount + p.totals.ta)} tone="primary" hint={`incl. TA ${formatRupees(p.totals.ta)}`} />
        <StatCard label="People in the waiting pool" kn="ವ್ಯಕ್ತಿಗಳು" value={p.people.length} />
      </div>

      {p.totals.applications > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Waiting · by person" kn="ವ್ಯಕ್ತಿವಾರು" bodyClass="overflow-x-auto">
            <PeopleTable people={p.people} />
          </Card>
          <Card title="Waiting · by head" kn="ಶೀರ್ಷಿಕೆವಾರು" bodyClass="overflow-x-auto">
            <HeadsTable heads={p.heads} />
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <h2 className="text-lg font-bold">
          Monthly statements <span className="text-sm font-normal text-cc-muted">· ಮಾಸಿಕ ಸಂಭಾವನೆ ಪಟ್ಟಿ</span>
        </h2>
      </div>
      <FilterBar>
        <FilterSelect label="Year" kn="ವರ್ಷ" value={fy} onChange={setFy} options={fyOptions()} allLabel="All years" />
      </FilterBar>
      <DataTable columns={columns} rows={statements.data || []} loading={statements.loading} onRowClick={(s) => router.push(`/billing/distribution/${s._id}`)} emptyText="No statements yet." />

      {preparing && (
        <PrepareDialog
          onClose={() => setPreparing(false)}
          onSave={async (body) => {
            try {
              const res = await api.post("/billing/statements", body);
              notifySuccess("Statement prepared. Send it to the Principal for approval.");
              router.push(`/billing/distribution/${res.data.data._id}`);
            } catch (err) {
              notifyError(err);
            }
          }}
        />
      )}
    </div>
  );
}

function PrepareDialog({ onClose, onSave }) {
  const [month, setMonth] = useState(thisMonth());
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Prepare monthly statement" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-cc-muted">
          Takes every paid application not yet shared out, paid up to the end of the month you choose. The amounts are worked out by the system; you only check and send for approval.
        </p>
        <Field label="Month" kn="ತಿಂಗಳು">
          <input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Remarks (optional)" kn="ಟಿಪ್ಪಣಿ">
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} maxLength={1000} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            disabled={!month}
            onClick={async () => {
              setBusy(true);
              await onSave({ month, remarks });
              setBusy(false);
            }}
          >
            Prepare
          </Button>
        </div>
      </div>
    </Modal>
  );
}
