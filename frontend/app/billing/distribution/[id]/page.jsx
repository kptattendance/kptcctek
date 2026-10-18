"use client";

// One monthly Resource Persons Remuneration statement: printable, with
// approve (Principal / Manager), paid out, and cancel.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, BadgeCheck, Banknote, Ban } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, STATEMENT_STATUS, Badge, can, monthLabel, amountInWords } from "@/lib/billing";
import { fmtDate, isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import { PeopleTable, HeadsTable } from "@/app/components/billing/DistributionTables";
import { Button, ConfirmDialog, Field, inputCls, Spinner, Empty, StatCard } from "@/app/components/ui";

export default function StatementPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <StatementView />
    </Suspense>
  );
}

function StatementView() {
  const { id } = useParams();
  const api = useApi();
  const { me } = useMe();
  const { data: st, extra, loading, reload } = useFetch(`/billing/statements/${id}`);
  const [dialog, setDialog] = useState(null);

  if (loading && !st) return <Spinner />;
  if (!st) return <Empty>Statement not found.</Empty>;
  const settings = extra?.settings || {};
  const mine = String(st.preparedBy?._id) === String(me?._id);
  const t = st.totals;
  const shared = t.amount + t.ta;

  const post = async (path, body, ok) => {
    try {
      await api.post(`/billing/statements/${st._id}${path}`, body);
      notifySuccess(ok);
      setDialog(null);
      reload();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/billing/distribution" className="cc-chip cc-press p-2" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{st.number} · {monthLabel(st.month)}</h1>
            <p className="text-sm text-cc-muted">
              <Badge map={STATEMENT_STATUS} status={st.status} /> · prepared by {st.preparedBy?.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Print
          </Button>
          {st.status === "draft" && can(me, "payouts.approve") && (
            <Button primary onClick={() => setDialog("approve")} disabled={mine} title={mine ? "You prepared this; someone else must approve it." : undefined}>
              <BadgeCheck size={16} aria-hidden /> Approve
            </Button>
          )}
          {st.status === "approved" && (can(me, "payouts.prepare") || can(me, "payouts.approve")) && (
            <Button primary onClick={() => setDialog("disburse")}>
              <Banknote size={16} aria-hidden /> Mark paid out
            </Button>
          )}
          {((st.status === "draft" && can(me, "payouts.prepare")) || (st.status === "approved" && can(me, "payouts.approve"))) && (
            <Button onClick={() => setDialog("cancel")} className="!text-cc-bad">
              <Ban size={16} aria-hidden /> Cancel
            </Button>
          )}
        </div>
      </div>

      {st.status === "draft" && mine && (
        <p className="no-print rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Prepared. Print it or ask the Principal / Manager to open this page and approve. You can&apos;t approve your own statement.
        </p>
      )}
      {st.status === "disbursed" && (
        <p className="no-print rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Paid out on {fmtDate(st.disbursedAt)} ({st.disbursedRef}) by {st.disbursedBy?.name}.
        </p>
      )}
      {st.status === "cancelled" && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Cancelled by {st.cancelledBy?.name}: {st.cancelReason}. Its applications went back to waiting.
        </p>
      )}

      <div className="no-print grid gap-3 sm:grid-cols-4">
        <StatCard label="Applications" kn="ಅರ್ಜಿಗಳು" value={t.applications} />
        <StatCard label="Fee received (with GST)" kn="ಸ್ವೀಕರಿಸಿದ ಶುಲ್ಕ" value={formatRupees(t.fee)} tone="primary" />
        <StatCard label="GST (to be paid to Govt.)" kn="ಜಿಎಸ್‌ಟಿ" value={formatRupees(t.gst)} tone="warn" hint="Not shared out" />
        <StatCard label="Shared out (net of GST)" kn="ಹಂಚಿದ ಮೊತ್ತ" value={formatRupees(shared)} tone="ok" />
      </div>

      <article className="cc-card space-y-5 bg-white p-6 text-[13px] text-black print:border-0 print:p-0 print:shadow-none sm:p-8">
        <header className="border-b-2 border-cc-primary pb-3 text-center">
          <p className="text-base font-bold">{settings.orgName}</p>
          <p>{settings.orgSubtitle}</p>
          <p className="mt-2 text-sm font-bold uppercase tracking-wide">Resource Persons Remuneration Bill · {monthLabel(st.month)}</p>
          <p className="text-xs">
            {st.number} · prepared {fmtDate(st.createdAt)}
            {st.approvedAt ? ` · approved ${fmtDate(st.approvedAt)} by ${st.approvedBy?.name}` : " · not yet approved"}
          </p>
        </header>

        <section>
          <h2 className="mb-2 font-bold">1. Applications paid · ಪಾವತಿಯಾದ ಅರ್ಜಿಗಳು</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-cc-primary-soft text-left print:bg-gray-100">
                  {["Sl.", "App no.", "Party", "Bill no.", "Paid on", "Fee", "GST", "Net", "TA", "To share"].map((h, i) => (
                    <th key={h} className={`border border-gray-300 px-2 py-1.5 ${i >= 5 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {st.rows.map((d, i) => (
                  <tr key={d._id}>
                    <td className="border border-gray-300 px-2 py-1">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-1">{d.appNo}</td>
                    <td className="border border-gray-300 px-2 py-1">{d.party?.code}</td>
                    <td className="border border-gray-300 px-2 py-1">{d.billNumber}</td>
                    <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{fmtDate(d.paidOn)}</td>
                    {[d.fee, d.gst, d.net, d.ta, d.amount].map((v, k) => (
                      <td key={k} className="border border-gray-300 px-2 py-1 text-right tabular-nums">{plain(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">Total</td>
                  {[t.fee, t.gst, t.net, t.ta, t.amount].map((v, k) => (
                    <td key={k} className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(v)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-1 text-xs text-gray-600">To share = Net (fee without GST) − TA. TA is paid to the inspectors on top of their share.</p>
        </section>

        <section>
          <h2 className="mb-2 font-bold">2. Remuneration to persons · ವ್ಯಕ್ತಿಗಳಿಗೆ ಸಂಭಾವನೆ</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <PeopleTable people={st.people} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-bold">3. Fund heads · ನಿಧಿ ಶೀರ್ಷಿಕೆಗಳು</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <HeadsTable heads={st.heads} />
          </div>
        </section>

        <p className="font-semibold">
          Total shared out: {formatRupees(shared)} ({amountInWords(shared)})
        </p>
        {st.remarks && <p>Remarks: {st.remarks}</p>}

        <footer className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
          {(settings.statementSignatories?.length ? settings.statementSignatories : ["Prepared by", "CCTEK Manager", "Principal"]).map((s) => (
            <p key={s} className="border-t border-gray-400 pt-1 font-semibold">{s}</p>
          ))}
        </footer>
      </article>

      {dialog === "approve" && (
        <ConfirmDialog
          title="Approve this statement?"
          message={`Approves ${formatRupees(shared)} to ${st.people.length} person(s) and the fund heads for ${monthLabel(st.month)}.`}
          confirmLabel="Approve"
          onClose={() => setDialog(null)}
          onConfirm={() => post("/approve", {}, "Statement approved.")}
        />
      )}
      {dialog === "disburse" && <DisburseDialog onClose={() => setDialog(null)} onSave={(body) => post("/disburse", body, "Marked as paid out.")} />}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel this statement?"
          message="Its applications go back to waiting and can be put on a new statement."
          confirmLabel="Cancel statement"
          danger
          needReason
          onClose={() => setDialog(null)}
          onConfirm={(reason) => post("/cancel", { reason }, "Statement cancelled.")}
        />
      )}
    </div>
  );
}

const plain = (paise) => (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DisburseDialog({ onClose, onSave }) {
  const [disbursedOn, setOn] = useState(isoToday());
  const [reference, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Mark paid out" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Paid out on" kn="ವಿತರಿಸಿದ ದಿನ">
          <input type="date" value={disbursedOn} max={isoToday()} onChange={(e) => setOn(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Cheque / transfer reference" kn="ಉಲ್ಲೇಖ" hint="e.g. cheque nos., or the bank transfer batch no.">
          <input value={reference} onChange={(e) => setRef(e.target.value)} maxLength={120} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            disabled={!reference.trim()}
            onClick={async () => {
              setBusy(true);
              await onSave({ disbursedOn, reference });
              setBusy(false);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
