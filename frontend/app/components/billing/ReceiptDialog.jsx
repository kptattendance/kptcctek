"use client";

// Enter a cheque / transfer: on one bill, or on a Statement of Bills (then it
// is spread over its bills and entered on each of them).

import { useState } from "react";
import { formatRupees } from "@/lib/api";
import { RECEIPT_MODES, toRupeesInput } from "@/lib/billing";
import { isoToday } from "@/app/components/projects/projectMeta";
import { Modal } from "@/app/components/projects/dialogs";
import { Button, Field, inputCls } from "@/app/components/ui";

export default function ReceiptDialog({ title, due, statement = false, onClose, onSave }) {
  const [f, setF] = useState({
    mode: "cheque",
    instrumentNo: "",
    instrumentDate: "",
    bankName: "",
    receivedOn: isoToday(),
    amount: toRupeesInput(due),
    tdsIncomeTax: "",
    tdsGst: "",
    otherDeduction: "",
    remarks: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const paise = (v) => Math.round(Number(v || 0) * 100);
  const settles = paise(f.amount) + paise(f.tdsIncomeTax) + paise(f.tdsGst) + paise(f.otherDeduction);
  const left = due - settles;
  const cheque = ["cheque", "dd"].includes(f.mode);
  const what = statement ? "statement" : "bill";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg bg-cc-primary-soft p-3 text-sm">
          Due on this {what}: <b className="tabular-nums">{formatRupees(due)}</b>
          {statement && <span className="mt-1 block text-xs">The cheque is entered on every bill in the statement, in proportion to what each one owes.</span>}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mode" kn="ವಿಧಾನ">
            <select value={f.mode} onChange={set("mode")} className={inputCls}>
              {RECEIPT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label={cheque ? "Cheque / DD no." : "UTR / reference no."} kn="ಸಂಖ್ಯೆ">
            <input value={f.instrumentNo} onChange={set("instrumentNo")} maxLength={40} className={inputCls} autoFocus />
          </Field>
          <Field label={cheque ? "Cheque date" : "Transfer date"} kn="ದಿನಾಂಕ">
            <input type="date" value={f.instrumentDate} onChange={set("instrumentDate")} className={inputCls} />
          </Field>
          <Field label="Bank" kn="ಬ್ಯಾಂಕ್">
            <input value={f.bankName} onChange={set("bankName")} maxLength={120} className={inputCls} />
          </Field>
          <Field label="Received on" kn="ಸ್ವೀಕರಿಸಿದ ದಿನ">
            <input type="date" value={f.receivedOn} max={isoToday()} onChange={set("receivedOn")} className={inputCls} />
          </Field>
          <Field label="Amount (₹)" kn="ಮೊತ್ತ">
            <input inputMode="decimal" value={f.amount} onChange={set("amount")} className={`${inputCls} font-semibold tabular-nums`} />
          </Field>
        </div>
        <details className="rounded-lg border border-cc-border p-3" open={Boolean(f.tdsIncomeTax || f.tdsGst || f.otherDeduction)}>
          <summary className="cursor-pointer text-sm font-semibold">Deducted by the party (TDS etc.) · ಕಡಿತ</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Income-tax TDS (₹)">
              <input inputMode="decimal" value={f.tdsIncomeTax} onChange={set("tdsIncomeTax")} className={inputCls} />
            </Field>
            <Field label="GST TDS (₹)">
              <input inputMode="decimal" value={f.tdsGst} onChange={set("tdsGst")} className={inputCls} />
            </Field>
            <Field label="Other (₹)">
              <input inputMode="decimal" value={f.otherDeduction} onChange={set("otherDeduction")} className={inputCls} />
            </Field>
          </div>
        </details>
        <Field label="Remarks" kn="ಟಿಪ್ಪಣಿ">
          <input value={f.remarks} onChange={set("remarks")} maxLength={500} className={inputCls} />
        </Field>
        <p className={`text-sm font-semibold ${left < 0 ? "text-cc-bad" : left === 0 ? "text-cc-ok" : "text-cc-warn"}`}>
          {left < 0
            ? `This is ${formatRupees(-left)} more than is due.`
            : left === 0
              ? `Settles the ${what} in full. The money will be shared out automatically.`
              : `${formatRupees(left)} will still be due (part payment).`}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            disabled={left < 0 || !f.instrumentNo || !f.instrumentDate || !f.amount}
            onClick={async () => {
              setBusy(true);
              await onSave(f);
              setBusy(false);
            }}
          >
            Save payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
