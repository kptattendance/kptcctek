"use client";

// One Statement of Bills: printable as on paper (fund, bill numbers, estimate,
// bill amount, inspection fee, total in words, slab note, signature), plus on
// screen its bills, the cheque(s) entered on it, and its actions.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, Send, Wallet, Ban, Undo2 } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, GROUP_STATUS, BILL_STATUS, Badge, can, amountInWords, RECEIPT_MODES } from "@/lib/billing";
import { fmtDate, isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import ReceiptDialog from "@/app/components/billing/ReceiptDialog";
import { Button, ConfirmDialog, Field, inputCls, StatCard, Card, Spinner, Empty } from "@/app/components/ui";

export default function GroupPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GroupView />
    </Suspense>
  );
}

function GroupView() {
  const { id } = useParams();
  const api = useApi();
  const { me } = useMe();
  const { data: g, extra, loading, reload } = useFetch(`/billing/groups/${id}`);
  const [dialog, setDialog] = useState(null); // sent | receipt | cancel | {reverse}

  if (loading && !g) return <Spinner />;
  if (!g) return <Empty>Statement not found.</Empty>;
  const prepare = can(me, "billing.prepare");
  const receipts = can(me, "receipts.manage");
  const open = ["issued", "part_paid"].includes(g.status);
  const activeCheques = g.cheques.filter((c) => c.status === "active");

  const post = async (path, body, ok) => {
    try {
      await api.post(`/billing/groups/${g._id}${path}`, body);
      notifySuccess(ok);
      setDialog(null);
      reload();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/billing/groups" className="cc-chip cc-press p-2" aria-label="Back to statements">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{g.number}</h1>
            <p className="text-sm text-cc-muted">
              {g.party?.code}
              {g.fundName ? ` · ${g.fundName}` : ""} · {g.totals.bills} bill{g.totals.bills > 1 ? "s" : ""} · <Badge map={GROUP_STATUS} status={g.status} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Print
          </Button>
          {prepare && open && (
            <Button onClick={() => setDialog("sent")}>
              <Send size={16} aria-hidden /> {g.sentOn ? "Edit dispatch" : "Mark sent"}
            </Button>
          )}
          {receipts && open && (
            <Button primary onClick={() => setDialog("receipt")}>
              <Wallet size={16} aria-hidden /> Record cheque
            </Button>
          )}
          {prepare && open && activeCheques.length === 0 && (
            <Button onClick={() => setDialog("cancel")} className="!text-cc-bad">
              <Ban size={16} aria-hidden /> Cancel
            </Button>
          )}
        </div>
      </div>

      {g.status === "cancelled" && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Cancelled on {fmtDate(g.cancelledAt)} by {g.cancelledBy?.name}: {g.cancelReason}. Its bills can go on another statement.
        </p>
      )}

      {g.status !== "cancelled" && (
        <div className="no-print grid gap-3 sm:grid-cols-3">
          <StatCard label="Statement amount" kn="ಒಟ್ಟು ಮೊತ್ತ" value={formatRupees(g.totals.total)} tone="primary" hint={g.sentOn ? `Sent ${fmtDate(g.sentOn)}${g.dispatchRef ? ` · ${g.dispatchRef}` : ""}` : "Not marked sent"} />
          <StatCard label="Received + TDS" kn="ಸ್ವೀಕರಿಸಿದ್ದು" value={formatRupees(g.settled.total)} tone="ok" hint={g.settled.tds ? `incl. TDS ${formatRupees(g.settled.tds)}` : undefined} />
          <StatCard label="Still due" kn="ಬಾಕಿ" value={formatRupees(g.outstanding)} tone={g.outstanding ? "warn" : "ok"} hint={g.status === "paid" ? `Paid ${fmtDate(g.paidAt)} · shared out automatically` : undefined} />
        </div>
      )}

      <GroupDocument g={g} settings={extra?.settings || {}} slabs={extra?.slabs || []} />

      <Card title="Bills on this statement" kn="ಪಟ್ಟಿಯಲ್ಲಿರುವ ಬಿಲ್ಲುಗಳು" className="no-print" bodyClass="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
            <tr>
              <th className="px-4 py-2">Bill</th>
              <th className="px-4 py-2">Applications</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Due</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {g.bills.map((b) => (
              <tr key={b._id} className="border-t border-cc-border">
                <td className="px-4 py-2">
                  <Link href={`/billing/bills/${b._id}`} className="break-all font-semibold underline">{b.number}</Link>
                  <span className="block text-xs text-cc-muted">{fmtDate(b.billDate)}</span>
                </td>
                <td className="px-4 py-2">{b.lines.map((l) => l.appNo).join(", ")}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatRupees(b.totals.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{b.outstanding ? formatRupees(b.outstanding) : "—"}</td>
                <td className="px-4 py-2"><Badge map={BILL_STATUS} status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {g.cheques.length > 0 && (
        <Card title="Cheques received" kn="ಸ್ವೀಕರಿಸಿದ ಚೆಕ್‌ಗಳು" className="no-print" bodyClass="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
              <tr>
                <th className="px-4 py-2">Cheque / ref.</th>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">TDS / other</th>
                <th className="px-4 py-2">Entered on bills</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {g.cheques.map((c) => (
                <tr key={c.batch} className={`border-t border-cc-border align-top ${c.status === "reversed" ? "text-cc-muted line-through" : ""}`}>
                  <td className="px-4 py-2 font-semibold">
                    {RECEIPT_MODES.find((m) => m.value === c.mode)?.label} {c.instrumentNo}
                    <span className="block text-xs font-normal text-cc-muted">{fmtDate(c.instrumentDate)}{c.bankName ? ` · ${c.bankName}` : ""}</span>
                  </td>
                  <td className="px-4 py-2">{fmtDate(c.receivedOn)}<span className="block text-xs text-cc-muted">by {c.recordedBy?.name}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRupees(c.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRupees(c.tdsIncomeTax + c.tdsGst + c.otherDeduction)}</td>
                  <td className="px-4 py-2 text-xs">
                    {c.bills.map((x) => (
                      <span key={x.receipt} className="block">{x.bill}: {formatRupees(x.settles)}</span>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-right no-underline">
                    {c.status === "reversed" ? (
                      <span className="text-xs" title={c.reverseReason}>Reversed</span>
                    ) : (
                      receipts && (
                        <button type="button" onClick={() => setDialog({ reverse: c })} className="inline-flex items-center gap-1 text-xs font-semibold text-cc-bad hover:underline">
                          <Undo2 size={13} aria-hidden /> Reverse
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {dialog === "sent" && <SentDialog g={g} onClose={() => setDialog(null)} onSave={(body) => post("/sent", body, "Dispatch details saved.")} />}
      {dialog === "receipt" && (
        <ReceiptDialog title={`Record cheque · ${g.number}`} due={g.outstanding} statement onClose={() => setDialog(null)} onSave={(body) => post("/receipts", body, "Cheque entered on every bill of the statement.")} />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel this statement?"
          message="The bills stay issued and can be put on another statement."
          confirmLabel="Cancel statement"
          danger
          needReason
          onClose={() => setDialog(null)}
          onConfirm={(reason) => post("/cancel", { reason }, "Statement cancelled.")}
        />
      )}
      {dialog?.reverse && (
        <ConfirmDialog
          title={`Reverse cheque ${dialog.reverse.instrumentNo}?`}
          message="Use this for a bounced cheque or a wrong entry. It is undone on every bill of the statement, and their distribution (if not yet in a remuneration statement) is withdrawn."
          confirmLabel="Reverse cheque"
          danger
          needReason
          onClose={() => setDialog(null)}
          onConfirm={(reason) => post(`/receipts/${dialog.reverse.batch}/reverse`, { reason }, "Cheque reversed.")}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the statement itself

const plain = (paise) => (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lakhs = (paise) => `${Number(paise) / 100 / 1_00_000} Lakh${Number(paise) === 1_00_000_00 ? "" : "s"}`;

// "Upto 2 Lakhs - 0.5%", "Above 2 Lakhs to 10 Lakhs - 0.7%", "Above 10 Lakhs - 0.8%"
function slabNote(slabs) {
  const s = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
  return s.map((x, i) => {
    const next = s[i + 1];
    if (!x.minAmount) return `Upto ${lakhs(next?.minAmount || 0)} - ${x.percent}%`;
    return next ? `Above ${lakhs(x.minAmount)} to ${lakhs(next.minAmount)} - ${x.percent}%` : `Above ${lakhs(x.minAmount)} - ${x.percent}%`;
  });
}

function GroupDocument({ g, settings: s, slabs }) {
  const sum = (b, k) => b.lines.reduce((a, l) => a + (l[k] || 0), 0);
  const cell = "border border-gray-400 px-2 py-1.5";
  return (
    <article className="cc-card bg-white p-6 text-[13px] leading-relaxed text-black print:border-0 print:p-0 print:shadow-none sm:p-10">
      <header className="text-center">
        <p className="text-base font-bold">{s.orgName}</p>
        {s.orgSubtitle && <p className="font-semibold">{s.orgSubtitle}</p>}
        <p className="whitespace-pre-line">{s.address}</p>
        <p className="mt-1 font-bold">STATEMENT OF BILLS ({g.financialYear})</p>
      </header>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[15px] font-bold">{g.fundName || g.partySnapshot?.name}</p>
        <p className="text-xs">
          {g.number} · {fmtDate(g.date)}
        </p>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[12px]">
          <thead>
            <tr className="text-left align-bottom">
              <th className={`${cell} w-14`}>ಕ್ರಮ ಸಂಖ್ಯೆ</th>
              <th className={cell}>ತಪಾಸಣಾ ವರದಿಯ ಬಿಲ್ಲಿನ ಸಂಖ್ಯೆ</th>
              <th className={`${cell} text-right`}>ಅಂದಾಜು ಪಟ್ಟಿ ಮೊತ್ತ<br />(ರೂ.ಗಳಲ್ಲಿ)</th>
              <th className={`${cell} text-right`}>ಬಿಲ್ಲಿನ ಮೊತ್ತ (ರೂ.ಗಳಲ್ಲಿ)</th>
              <th className={`${cell} text-right`}>ತಪಾಸಣಾ ಶುಲ್ಕ<br />(ರೂ.ಗಳಲ್ಲಿ)</th>
            </tr>
          </thead>
          <tbody>
            {g.bills.map((b, i) => (
              <tr key={b._id}>
                <td className={cell}>{i + 1}</td>
                <td className={`${cell} break-all`}>{b.number}</td>
                <td className={`${cell} text-right tabular-nums`}>{plain(sum(b, "estimateAmount"))}</td>
                <td className={`${cell} text-right tabular-nums`}>{plain(sum(b, "projectBillAmount"))}</td>
                <td className={`${cell} text-right tabular-nums`}>{plain(b.totals.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold">
            <tr>
              <td className={cell} />
              <td className={cell}>Total</td>
              <td className={`${cell} text-right tabular-nums`}>{plain(g.totals.estimate)}</td>
              <td className={`${cell} text-right tabular-nums`}>{plain(g.totals.projectBill)}</td>
              <td className={`${cell} text-right tabular-nums`}>{plain(g.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2">({amountInWords(g.totals.total)})</p>
      {g.remarks && <p className="mt-2">{g.remarks}</p>}

      <footer className="mt-10 flex flex-wrap items-end justify-between gap-6">
        {slabs.length > 0 && (
          <div className="flex gap-2 text-xs">
            <span>Note:</span>
            <span>
              {slabNote(slabs).map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </span>
          </div>
        )}
        <div className="ml-auto text-center">
          <div className="h-12" />
          <p className="font-bold uppercase">{s.groupSignatory || "Principal"}</p>
          <p className="text-xs">{s.orgName}</p>
        </div>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------- dialogs

function SentDialog({ g, onClose, onSave }) {
  const [sentOn, setSentOn] = useState(g.sentOn?.slice(0, 10) || isoToday());
  const [dispatchRef, setDispatchRef] = useState(g.dispatchRef || "");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Sent to the party" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sent on" kn="ಕಳುಹಿಸಿದ ದಿನ">
            <input type="date" value={sentOn} max={isoToday()} onChange={(e) => setSentOn(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Outward / letter no." kn="ಹೊರಹೋದ ಸಂಖ್ಯೆ">
            <input value={dispatchRef} onChange={(e) => setDispatchRef(e.target.value)} maxLength={120} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            onClick={async () => {
              setBusy(true);
              await onSave({ sentOn, dispatchRef });
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
