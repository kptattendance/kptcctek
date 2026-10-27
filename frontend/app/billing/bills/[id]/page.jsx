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
import { useFetch, BILL_STATUS, Badge, can, amountInKannada, RECEIPT_MODES } from "@/lib/billing";
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

// Laid out like the paper "3ನೇ ಪಾರ್ಟಿ ತಪಾಸಣಾ ಬಿಲ್ಲು": letterhead, number and date,
// addressee, the party's letter as ಉಲ್ಲೇಖ, one row per work, total in Kannada
// words, signature. A fee with GST added on top shows the GST rows too.
function BillDocument({ bill, settings }) {
  const s = settings;
  // a draft shows the party as it is now; an issued bill shows the copy taken at issue
  const p = (bill.status === "draft" ? bill.party : bill.partySnapshot) || {};
  const extraGst = bill.gstMode === "exclusive";
  const fee = (l) => (extraGst ? l.net : l.total); // MCC's fee already includes GST
  const rates = [...new Set(bill.lines.map((l) => (l.lumpsum ? "lumpsum" : l.servicePercent)))];
  const rate = rates.length === 1 && rates[0] != null && rates[0] !== "lumpsum" ? `${Number(rates[0]).toFixed(2)}%` : "";
  const sum = (f) => bill.lines.reduce((a, l) => a + (f(l) || 0), 0);
  const ref = refs(bill.lines);
  const cell = "border border-black px-2 py-1.5";
  const money = (paise) => (
    <span className="flex justify-between gap-3 tabular-nums">
      <span>ರೂ</span>
      <span>{plain(paise)}</span>
    </span>
  );
  return (
    <article className="cc-card bg-white p-6 text-[13px] leading-relaxed text-black print:border-0 print:p-0 print:shadow-none sm:p-10">
      <header className="border-b-2 border-black pb-1 text-center">
        <p className="text-[15px] font-bold">{s.orgName}</p>
        {s.orgSubtitle && <p className="font-bold">{s.orgSubtitle}</p>}
        <p className="whitespace-pre-line font-bold">{s.address}</p>
        <p className="mt-0.5 flex flex-wrap justify-between gap-x-6 text-[12px] font-bold">
          <span>{[s.email && `Email : ${s.email}`, s.phone && `Ph: ${s.phone}`].filter(Boolean).join(" · ")}</span>
          {s.gstin && <span>C.G.S.T. / S.G.S.T. No.{s.gstin}</span>}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <p className="break-all">{bill.number || "DRAFT (number given on issue)"}</p>
        <p className="whitespace-nowrap">ದಿನಾಂಕ: {dmy(bill.billDate)}</p>
      </div>

      <div className="mt-3">
        <p>ರಿಗೆ,</p>
        <p className="whitespace-pre-line">{p.billingAddress || p.name}</p>
        {!p.billingAddress && <p className="no-print text-xs text-cc-bad">Address not set (Bill settings → Parties)</p>}
        {p.gstin && <p>GSTIN: {p.gstin}</p>}
      </div>
      <p className="mt-3">ಮಾನ್ಯರೇ,</p>

      <p className="mt-3 text-center font-semibold underline underline-offset-4">3ನೇ ಪಾರ್ಟಿ ತಪಾಸಣಾ ಬಿಲ್ಲು</p>
      {ref && <p className="mt-1 text-center">ಉಲ್ಲೇಖ:- ತಮ್ಮ ಪತ್ರ ಸಂಖ್ಯೆ {ref}</p>}
      {bill.fundName && <p className="no-print mt-1 text-center text-xs text-gray-500">ಅನುದಾನ: {bill.fundName}</p>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[12px]">
          <thead>
            <tr className="align-bottom font-bold">
              <th className={`${cell} w-12 text-left`}>ಕ್ರ.ಸಂ.</th>
              <th className={`${cell} text-center`}>ಕಾಮಗಾರಿಯ ಹೆಸರು</th>
              <th className={`${cell} w-36 text-center`}>ಅಂದಾಜು ಪಟ್ಟಿ ಮೊತ್ತ</th>
              <th className={`${cell} w-36 text-center`}>ಬಿಲ್ಲಿನ ಮೊತ್ತ</th>
              <th className={`${cell} w-32 text-center`}>
                ತಪಾಸಣಾ ಶುಲ್ಕ
                {rate && <span className="block">{rate}</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l, i) => (
              <tr key={String(l.project)} className="align-top">
                <td className={cell}>{i + 1}</td>
                <td className={cell}>
                  {l.description || "Third party inspection"}
                  {l.fileNo && <span className="mt-3 block">ಅ.ಪ.ಸಂ.{l.fileNo}{l.workYear ? `/${l.workYear}` : ""}</span>}
                  <span className="no-print block text-xs text-gray-500">
                    App {l.appNo}
                    {l.lumpsum ? " · lumpsum fee" : !rate && l.servicePercent != null ? ` · ${l.servicePercent}%` : ""}
                  </span>
                </td>
                <td className={`${cell} align-middle`}>{l.estimateAmount != null ? money(l.estimateAmount) : ""}</td>
                <td className={`${cell} align-middle`}>{money(l.projectBillAmount)}</td>
                <td className={`${cell} align-middle`}>{money(fee(l))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold">
            <tr>
              <td className={cell} />
              <td className={`${cell} text-center`}>ಒಟ್ಟು</td>
              <td className={cell}>{sum((l) => l.estimateAmount) ? money(sum((l) => l.estimateAmount)) : ""}</td>
              <td className={cell}>{money(sum((l) => l.projectBillAmount))}</td>
              <td className={cell}>{money(extraGst ? bill.totals.net : bill.totals.total)}</td>
            </tr>
            {extraGst && (
              <>
                <tr>
                  <td colSpan={4} className={`${cell} text-right`}>CGST @ 9%</td>
                  <td className={cell}>{money(bill.totals.cgst)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className={`${cell} text-right`}>SGST @ 9%</td>
                  <td className={cell}>{money(bill.totals.sgst)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className={`${cell} text-right`}>ಒಟ್ಟು ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ</td>
                  <td className={cell}>{money(bill.totals.total)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>
      <p className="mt-3">({amountInKannada(bill.totals.total)})</p>
      {bill.remarks && <p className="mt-2">{bill.remarks}</p>}

      <footer className="mt-10 flex flex-wrap items-end justify-between gap-6">
        <div className="text-xs">
          {(s.bankName || s.accountNo) && (
            <>
              <p className="font-semibold">Payment to</p>
              {s.accountName && <p>A/c name: {s.accountName}</p>}
              {s.accountNo && <p>A/c no.: {s.accountNo}</p>}
              {s.bankName && <p>Bank: {s.bankName}{s.bankBranch ? `, ${s.bankBranch}` : ""}</p>}
              {s.ifsc && <p>IFSC: {s.ifsc}</p>}
              {s.billNote && <p className="mt-1 text-gray-600">{s.billNote}</p>}
            </>
          )}
        </div>
        <div className="ml-auto text-center">
          <div className="h-12" />
          <p className="uppercase">{s.billSignatory}</p>
        </div>
      </footer>
    </article>
  );
}

const plain = (paise) => (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 14.10.2026, in Indian time
const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, ".") : "");

// The party's letter(s): "ಮ.ನ.ಪಾ./ಕಾ.ಅ.ವಿಭಾಗ-2/3ನೇ ಪಾರ್ಟಿ ತಪಾಸಣೆ/2024-25 ದಿ:16.09.2026"
const refs = (lines) =>
  [...new Set(lines.filter((l) => l.letterRefNo).map((l) => `${l.letterRefNo}${l.letterDate ? ` ದಿ:${dmy(l.letterDate)}` : ""}`))].join("; ");

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
