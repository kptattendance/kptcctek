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

export const GROUP_STATUS = {
  issued: { label: "Sent · unpaid", kn: "ಬಾಕಿ", cls: "bg-amber-100 text-amber-900" },
  part_paid: { label: "Part paid", kn: "ಭಾಗಶಃ ಪಾವತಿ", cls: "bg-sky-100 text-sky-900" },
  paid: { label: "Paid", kn: "ಪಾವತಿಯಾಗಿದೆ", cls: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "Cancelled", kn: "ರದ್ದು", cls: "bg-red-100 text-red-900" },
};

// The fund in the list that a letter's wording means ("2025-26 ನೇ ಸಾಲಿನ ಮ.ನ.ಪಾ
// ಸಾಮಾನ್ಯ ನಿಧಿ" -> ಮನಪಾ ಸಾಮಾನ್ಯ ನಿಧಿ). Spaces and dots are ignored.
export function matchFund(text, funds) {
  const squash = (s) => String(s || "").replace(/[\s.]/g, "");
  const t = squash(text);
  if (!t) return null;
  return funds.find((f) => [f.name, ...(f.keywords || [])].some((k) => squash(k) && t.includes(squash(k)))) || null;
}

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

// 2947 -> "ಒಟ್ಟು ರೂಪಾಯಿ ಎರಡು ಸಾವಿರದ ಒಂಭೈನೂರ ನಲವತ್ತೇಳು ಮಾತ್ರ", as on the paper
// bills (their spelling: ಒಂಭತ್ತು, ಒಂಭೈನೂರ).
const KN_ONES = ["", "ಒಂದು", "ಎರಡು", "ಮೂರು", "ನಾಲ್ಕು", "ಐದು", "ಆರು", "ಏಳು", "ಎಂಟು", "ಒಂಭತ್ತು", "ಹತ್ತು", "ಹನ್ನೊಂದು", "ಹನ್ನೆರಡು", "ಹದಿಮೂರು", "ಹದಿನಾಲ್ಕು", "ಹದಿನೈದು", "ಹದಿನಾರು", "ಹದಿನೇಳು", "ಹದಿನೆಂಟು", "ಹತ್ತೊಂಭತ್ತು"];
const KN_TENS = ["", "", "ಇಪ್ಪತ್ತು", "ಮೂವತ್ತು", "ನಲವತ್ತು", "ಐವತ್ತು", "ಅರವತ್ತು", "ಎಪ್ಪತ್ತು", "ಎಂಬತ್ತು", "ತೊಂಭತ್ತು"];
// a unit joined to the tens word without its last "ು": ಇಪ್ಪತ್ತ + ೊಂದು = ಇಪ್ಪತ್ತೊಂದು
const KN_JOINED = ["", "ೊಂದು", "ೆರಡು", "ಮೂರು", "ನಾಲ್ಕು", "ೈದು", "ಾರು", "ೇಳು", "ೆಂಟು", "ೊಂಭತ್ತು"];
const KN_HUNDREDS = ["", "ನೂರು", "ಇನ್ನೂರು", "ಮುನ್ನೂರು", "ನಾನೂರು", "ಐನೂರು", "ಆರುನೂರು", "ಏಳುನೂರು", "ಎಂಟುನೂರು", "ಒಂಭೈನೂರು"];
const dropU = (w) => w.slice(0, -1); // ನೂರು -> ನೂರ, ಇಪ್ಪತ್ತು -> ಇಪ್ಪತ್ತ

function knBelow100(n) {
  if (n < 20) return KN_ONES[n];
  const t = KN_TENS[Math.floor(n / 10)];
  return n % 10 ? dropU(t) + KN_JOINED[n % 10] : t;
}
function knBelow1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? (r ? dropU(KN_HUNDREDS[h]) : KN_HUNDREDS[h]) : "", r ? knBelow100(r) : ""].filter(Boolean).join(" ");
}

export function amountInKannada(paise) {
  const total = Math.round(Number(paise || 0));
  let r = Math.floor(total / 100);
  const p = total % 100;
  const groups = [];
  const crore = Math.floor(r / 1_00_00_000);
  r %= 1_00_00_000;
  const lakh = Math.floor(r / 1_00_000);
  r %= 1_00_000;
  const thousand = Math.floor(r / 1000);
  r %= 1000;
  // "ಸಾವಿರ" alone at the end, "ಸಾವಿರದ" when more follows
  if (crore) groups.push([knBelow1000(crore), "ಕೋಟಿ", "ಕೋಟಿಯ"]);
  if (lakh) groups.push([knBelow100(lakh), "ಲಕ್ಷ", "ಲಕ್ಷದ"]);
  if (thousand) groups.push([knBelow100(thousand), "ಸಾವಿರ", "ಸಾವಿರದ"]);
  const words = groups.map(([n, last, more], i) => `${n} ${i < groups.length - 1 || r ? more : last}`);
  if (r) words.push(knBelow1000(r));
  const rupees = words.length ? words.join(" ") : "ಸೊನ್ನೆ";
  return `ಒಟ್ಟು ರೂಪಾಯಿ ${rupees}${p ? ` ಮತ್ತು ${knBelow100(p)} ಪೈಸೆ` : ""} ಮಾತ್ರ`;
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
