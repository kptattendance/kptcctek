"use client";

// Shared bits for the billing, distribution and overview screens.

import { useCallback, useEffect, useState } from "react";
import { useApi } from "./api";
import { notifyError } from "./notify";

export const BILL_STATUS = {
  draft: { label: "Draft", kn: "ಕರಡು", cls: "bg-slate-100 text-slate-700" },
  issued: { label: "Sent · unpaid", kn: "ಬಾಕಿ", cls: "bg-amber-100 text-amber-900" },
  part_paid: { label: "Part paid", kn: "ಭಾಗಶಃ ಪಾವತಿ", cls: "bg-sky-100 text-sky-900" },
  paid: { label: "Paid", kn: "ಪಾವತಿಯಾಗಿದೆ", cls: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "Cancelled", kn: "ರದ್ದು", cls: "bg-red-100 text-red-900" },
};

export const STATEMENT_STATUS = {
  draft: { label: "Prepared · awaiting approval", short: "Prepared", kn: "ಅನುಮೋದನೆ ಬಾಕಿ", cls: "bg-amber-100 text-amber-900" },
  approved: { label: "Approved · to be paid out", short: "Approved", kn: "ಅನುಮೋದಿಸಲಾಗಿದೆ", cls: "bg-sky-100 text-sky-900" },
  disbursed: { label: "Paid out", short: "Paid out", kn: "ವಿತರಿಸಲಾಗಿದೆ", cls: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "Cancelled", short: "Cancelled", kn: "ರದ್ದು", cls: "bg-red-100 text-red-900" },
};

export const RECEIPT_MODES = [
  { value: "cheque", label: "Cheque" },
  { value: "dd", label: "Demand draft" },
  { value: "neft", label: "NEFT" },
  { value: "rtgs", label: "RTGS" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

export function Badge({ map, status, short }) {
  const s = map[status] || { label: status, cls: "bg-slate-100" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{short && s.short ? s.short : s.label}</span>;
}

export const can = (me, permission) => Boolean(me?.permissions?.includes(permission));

// Indian financial year of a date: Apr-Mar
export function fyOf(d = new Date()) {
  const x = new Date(d);
  const y = x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export function fyOptions(count = 5, from = new Date()) {
  const start = Number(fyOf(from).slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    const v = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    return { value: v, label: v };
  });
}

export const monthLabel = (m) => {
  if (!m) return "—";
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

// ₹ 12.3 L style for cards
export function rupeesShort(paise) {
  const r = Number(paise || 0) / 100;
  if (Math.abs(r) >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(r) >= 1_00_000) return `₹${(r / 1_00_000).toFixed(2)} L`;
  return `₹${r.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// 12345.50 -> "Rupees Twelve Thousand Three Hundred Forty Five and Fifty Paise Only"
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}
export function amountInWords(paise) {
  const total = Math.round(Number(paise || 0));
  let r = Math.floor(total / 100);
  const p = total % 100;
  if (!r && !p) return "Rupees Zero Only";
  const parts = [];
  const crore = Math.floor(r / 1_00_00_000);
  r %= 1_00_00_000;
  const lakh = Math.floor(r / 1_00_000);
  r %= 1_00_000;
  const thousand = Math.floor(r / 1000);
  r %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (r) parts.push(threeDigits(r));
  const rupees = parts.length ? `Rupees ${parts.join(" ")}` : "Rupees Zero";
  return `${rupees}${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
}

// GET with loading state + reload(); errors become a popup.
export function useFetch(url, params) {
  const api = useApi();
  const [state, setState] = useState({ data: null, extra: null, loading: true });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await api.get(url, { params: JSON.parse(key) });
        if (!cancelled) setState({ data: res.data.data, extra: res.data, loading: false });
      } catch (err) {
        if (!cancelled) {
          notifyError(err, { id: url });
          setState((s) => ({ ...s, loading: false }));
        }
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [api, url, key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

export const toRupeesInput = (paise) => (paise ? (paise / 100).toFixed(2) : "");
