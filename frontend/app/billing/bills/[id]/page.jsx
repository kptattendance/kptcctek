"use client";

// One bill: the printable bill itself, plus (on screen only) its actions and
// the cheques recorded against it.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, Send, Wallet, Ban, BadgeCheck, Undo2 } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, BILL_STATUS, Badge, can, amountInWords, RECEIPT_MODES } from "@/lib/billing";
import { fmtDate, isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import ReceiptDialog from "@/app/components/billing/ReceiptDialog";
import { Button, ConfirmDialog, Field, inputCls, StatCard, Card, Spinner, Empty } from "@/app/components/ui";

export default function BillPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BillView />
    </Suspense>
  );
}

function BillView() {
  const { id } = useParams();
  const api = useApi();
  const { me } = useMe();
  const { data: bill, extra, loading, reload } = useFetch(`/billing/bills/${id}`);
  const [dialog, setDialog] = useState(null); // issue | sent | receipt | cancel | {reverse}

  if (loading && !bill) return <Spinner />;
  if (!bill) return <Empty>Bill not found.</Empty>;
  const settings = extra?.settings || {};
  const prepare = can(me, "billing.prepare");
  const receipts = can(me, "receipts.manage");
  const open = ["issued", "part_paid"].includes(bill.status);
  const group = bill.group && bill.group.status !== "cancelled" ? bill.group : null; // paid through its Statement of Bills

  const post = async (path, body, ok) => {
    try {
      await api.post(`/billing/bills/${bill._id}${path}`, body);
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
          <Link href="/billing/bills" className="cc-chip cc-press p-2" aria-label="Back to bills">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{bill.number || "Draft bill"}</h1>
            <p className="text-sm text-cc-muted">
              {bill.party?.code}
              {bill.fundName ? ` · ${bill.fundName}` : ""} · {bill.lines.length} application{bill.lines.length > 1 ? "s" : ""} · <Badge map={BILL_STATUS} status={bill.status} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Print
          </Button>
          {prepare && bill.status === "draft" && (
            <Button primary onClick={() => setDialog("issue")}>
              <BadgeCheck size={16} aria-hidden /> Issue bill
            </Button>
          )}
          {prepare && open && (
            <Button onClick={() => setDialog("sent")}>
              <Send size={16} aria-hidden /> {bill.sentOn ? "Edit dispatch" : "Mark sent"}
            </Button>
          )}
          {receipts && open && !group && (
            <Button primary onClick={() => setDialog("receipt")}>
              <Wallet size={16} aria-hidden /> Record cheque
            </Button>
          )}
          {prepare && ["draft", "issued"].includes(bill.status) && !bill.settled?.total && !group && (
            <Button onClick={() => setDialog("cancel")} className="!text-cc-bad">
              <Ban size={16} aria-hidden /> Cancel
            </Button>
          )}
        </div>
      </div>

      {bill.status === "draft" && (
        <p className="no-print rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This is a draft. Check the details and the party&apos;s address, then <b>Issue bill</b> to give it a number. Wrong jobs? Cancel the draft; they go back to Ready to bill.
        </p>
      )}
      {group && (
        <p className="no-print rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          On Statement of Bills{" "}
          <Link href={`/billing/groups/${group._id}`} className="font-bold underline">
            {group.number}
          </Link>
          . {open ? "Record the party's cheque on the statement; it is entered on this bill automatically." : "Paid through that statement."}
        </p>
      )}
      {bill.status === "cancelled" && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Cancelled on {fmtDate(bill.cancelledAt)} by {bill.cancelledBy?.name}: {bill.cancelReason}
        </p>
      )}

      {!["draft", "cancelled"].includes(bill.status) && (
        <div className="no-print grid gap-3 sm:grid-cols-3">
          <StatCard label="Bill amount" kn="ಬಿಲ್ ಮೊತ್ತ" value={formatRupees(bill.totals.total)} tone="primary" hint={bill.sentOn ? `Sent ${fmtDate(bill.sentOn)}${bill.dispatchRef ? ` · ${bill.dispatchRef}` : ""}` : "Not marked sent"} />
          <StatCard label="Received + TDS" kn="ಸ್ವೀಕರಿಸಿದ್ದು" value={formatRupees(bill.settled.total)} tone="ok" hint={bill.settled.tds ? `incl. TDS ${formatRupees(bill.settled.tds)}` : undefined} />
          <StatCard label="Still due" kn="ಬಾಕಿ" value={formatRupees(bill.outstanding)} tone={bill.outstanding ? "warn" : "ok"} hint={bill.status === "paid" ? `Paid ${fmtDate(bill.paidAt)} · shared out automatically` : undefined} />
        </div>
      )}

      <BillDocument bill={bill} settings={settings} />

      {bill.receipts?.length > 0 && (
        <Card title="Payments recorded" kn="ದಾಖಲಾದ ಪಾವತಿಗಳು" className="no-print" bodyClass="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
              <tr>
                <th className="px-4 py-2">Receipt</th>
                <th className="px-4 py-2">Cheque / ref.</th>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">TDS / other</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {bill.receipts.map((r) => (
                <tr key={r._id} className={`border-t border-cc-border ${r.status === "reversed" ? "text-cc-muted line-through" : ""}`}>
                  <td className="px-4 py-2 font-semibold">{r.number}</td>
                  <td className="px-4 py-2">
                    {RECEIPT_MODES.find((m) => m.value === r.mode)?.label} {r.instrumentNo}
                    <span className="block text-xs text-cc-muted">{fmtDate(r.instrumentDate)}{r.bankName ? ` · ${r.bankName}` : ""}</span>
                  </td>
                  <td className="px-4 py-2">{fmtDate(r.receivedOn)}<span className="block text-xs text-cc-muted">by {r.recordedBy?.name}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRupees(r.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRupees(r.tdsIncomeTax + r.tdsGst + r.otherDeduction)}</td>
                  <td className="px-4 py-2 text-right no-underline">
                    {r.status === "reversed" ? (
                      <span className="text-xs" title={r.reverseReason}>Reversed</span>
                    ) : r.batch ? (
                      <span className="text-xs text-cc-muted">via statement</span>
                    ) : (
                      receipts && (
                        <button type="button" onClick={() => setDialog({ reverse: r })} className="inline-flex items-center gap-1 text-xs font-semibold text-cc-bad hover:underline">
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

      {dialog === "issue" && (
        <IssueDialog bill={bill} onClose={() => setDialog(null)} onSave={(body) => post("/issue", body, "Bill issued. Print it and send it to the party.")} />
      )}
      {dialog === "sent" && <SentDialog bill={bill} onClose={() => setDialog(null)} onSave={(body) => post("/sent", body, "Dispatch details saved.")} />}
      {dialog === "receipt" && (
        <ReceiptDialog title={`Record payment · ${bill.number}`} due={bill.outstanding} onClose={() => setDialog(null)} onSave={(body) => post("/receipts", body, "Payment recorded.")} />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel this bill?"
          message="Its applications go back to Ready to bill. The bill number (if any) stays used, marked cancelled."
          confirmLabel="Cancel bill"
          danger
          needReason
          onClose={() => setDialog(null)}
          onConfirm={(reason) => post("/cancel", { reason }, "Bill cancelled.")}
        />
      )}
      {dialog?.reverse && (
        <ConfirmDialog
          title={`Reverse ${dialog.reverse.number}?`}
          message="Use this for a bounced cheque or a wrong entry. The bill goes back to unpaid and its distribution (if not yet in a statement) is withdrawn."
          confirmLabel="Reverse receipt"
          danger
          needReason
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            try {
              await api.post(`/billing/receipts/${dialog.reverse._id}/reverse`, { reason });
              notifySuccess("Receipt reversed.");
              setDialog(null);
              reload();
            } catch (err) {
              notifyError(err);
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the bill itself

function BillDocument({ bill, settings }) {
  const s = settings;
  // a draft shows the party as it is now; an issued bill shows the copy taken at issue
  const p = (bill.status === "draft" ? bill.party : bill.partySnapshot) || {};
  const halfRate = 9; // CGST 9% + SGST 9%
  return (
    <article className="cc-card bg-white p-6 text-[13px] leading-relaxed text-black print:border-0 print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-cc-primary pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cc-sidebar text-base font-extrabold text-cc-accent print:border print:border-black">CC</span>
          <div>
            <p className="text-lg font-bold">{s.orgName}</p>
            <p>{s.orgSubtitle}</p>
            <p className="whitespace-pre-line text-xs">{s.address}</p>
            <p className="text-xs">
              {[s.phone && `Ph: ${s.phone}`, s.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-bold tracking-wide text-cc-primary print:text-black">{s.gstin ? "TAX INVOICE" : "BILL"}</p>
          {s.gstin && <p>GSTIN: {s.gstin}</p>}
          {s.pan && <p>PAN: {s.pan}</p>}
          {s.sacCode && <p>SAC: {s.sacCode}</p>}
        </div>
      </header>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Bill to</p>
          <p className="font-semibold">{p.name}</p>
          <p className="whitespace-pre-line">{p.billingAddress || <span className="no-print text-cc-bad">Address not set (Bill settings → Parties)</span>}</p>
          {p.gstin && <p>GSTIN: {p.gstin}</p>}
        </div>
        <div className="sm:text-right">
          <p>
            <span className="text-gray-500">Bill no.: </span>
            <b>{bill.number || "DRAFT"}</b>
          </p>
          <p>
            <span className="text-gray-500">Date: </span>
            {fmtDate(bill.billDate)}
          </p>
        </div>
      </section>

      <p className="mt-4">
        <span className="text-gray-500">Subject: </span>
        {bill.subject}
      </p>
      {refs(bill.lines) && (
        <p>
          <span className="text-gray-500">Ref. · ಉಲ್ಲೇಖ: </span>
          {refs(bill.lines)}
        </p>
      )}
      {bill.fundName && (
        <p>
          <span className="text-gray-500">Fund · ಅನುದಾನ: </span>
          {bill.fundName}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-cc-primary-soft text-left print:bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5">Sl.</th>
              <th className="border border-gray-300 px-2 py-1.5">Application</th>
              <th className="border border-gray-300 px-2 py-1.5">Work / Contractor</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Estimate (₹)</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Work bill (₹)</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Rate</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Fee (₹)</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l, i) => (
              <tr key={String(l.project)} className="align-top">
                <td className="border border-gray-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">
                  {l.appNo}
                  <span className="block text-gray-500">{fmtDate(l.appDate)}</span>
                  {l.certificateNo && <span className="block text-gray-500">Report {l.certificateNo}</span>}
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {l.description || "Third party inspection"}
                  <span className="block text-gray-500">
                    {[l.ward && `Ward ${l.ward}`, l.fileNo && `File ${l.fileNo}${l.workYear ? `/${l.workYear}` : ""}`, l.contractorName].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{l.estimateAmount != null ? plain(l.estimateAmount) : "—"}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(l.projectBillAmount)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{l.lumpsum ? "Lumpsum" : `${l.servicePercent}%`}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(l.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold">
            <tr>
              <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right">Taxable value</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(bill.totals.net)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right">CGST @ {halfRate}%</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(bill.totals.cgst)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="border border-gray-300 px-2 py-1.5 text-right">SGST @ {halfRate}%</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{plain(bill.totals.sgst)}</td>
            </tr>
            <tr className="bg-cc-primary-soft text-[13px] print:bg-gray-100">
              <td colSpan={6} className="border border-gray-300 px-2 py-2 text-right">Total payable</td>
              <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">{plain(bill.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 font-semibold">{amountInWords(bill.totals.total)}</p>
      {bill.gstMode === "inclusive" && <p className="text-xs text-gray-500">Fee as per the agreed rate, inclusive of GST.</p>}
      {bill.remarks && <p className="mt-2">{bill.remarks}</p>}

      <footer className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="text-xs">
          {(s.bankName || s.accountNo) && (
            <>
              <p className="font-semibold uppercase text-gray-500">Payment to</p>
              {s.accountName && <p>A/c name: {s.accountName}</p>}
              {s.accountNo && <p>A/c no.: {s.accountNo}</p>}
              {s.bankName && <p>Bank: {s.bankName}{s.bankBranch ? `, ${s.bankBranch}` : ""}</p>}
              {s.ifsc && <p>IFSC: {s.ifsc}</p>}
            </>
          )}
          {s.billNote && <p className="mt-2 text-gray-600">{s.billNote}</p>}
        </div>
        <div className="flex flex-col items-end justify-end">
          <div className="h-14" />
          <p className="border-t border-gray-400 px-6 pt-1 text-center font-semibold">{s.billSignatory}</p>
          <p className="text-xs">{s.orgName}</p>
        </div>
      </footer>
    </article>
  );
}

const plain = (paise) => (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "Your letter no. X dt. Y" for each application that has one
const refs = (lines) =>
  [...new Set(lines.filter((l) => l.letterRefNo).map((l) => `${l.letterRefNo}${l.letterDate ? ` dt. ${fmtDate(l.letterDate)}` : ""}`))].join("; ");

// ---------------------------------------------------------------- dialogs

function IssueDialog({ bill, onClose, onSave }) {
  const [billDate, setBillDate] = useState(bill.billDate?.slice(0, 10) || isoToday());
  const [seq, setSeq] = useState(""); // empty = the next number
  const [sentOn, setSentOn] = useState("");
  const [dispatchRef, setDispatchRef] = useState("");
  const [busy, setBusy] = useState(false);
  const next = useFetch("/billing/bills/next-number", { date: billDate || undefined }).data;
  const number = next ? next.number.replace(/\d+$/, seq || String(next.seq)) : "";
  return (
    <Modal title="Issue bill" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-cc-muted">
          The bill gets its number, and its {bill.lines.length} application{bill.lines.length > 1 ? "s are" : " is"} marked billed. Amount {formatRupees(bill.totals.total)}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bill date" kn="ಬಿಲ್ ದಿನಾಂಕ">
            <input type="date" value={billDate} max={isoToday()} onChange={(e) => setBillDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Running no." kn="ಕ್ರಮ ಸಂಖ್ಯೆ" hint={next ? `Next is ${next.seq}. Change it only to match the outward register.` : undefined}>
            <input inputMode="numeric" value={seq} placeholder={next ? String(next.seq) : ""} onChange={(e) => setSeq(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputCls} />
          </Field>
        </div>
        {number && (
          <p className="rounded-lg bg-cc-primary-soft p-3 text-sm">
            Bill no. <b className="break-all">{number}</b>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sent on (optional)" kn="ಕಳುಹಿಸಿದ ದಿನ">
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
              await onSave({ billDate, seq: seq || undefined, sentOn: sentOn || undefined, dispatchRef });
              setBusy(false);
            }}
          >
            Issue bill
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SentDialog({ bill, onClose, onSave }) {
  const [sentOn, setSentOn] = useState(bill.sentOn?.slice(0, 10) || isoToday());
  const [dispatchRef, setDispatchRef] = useState(bill.dispatchRef || "");
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
