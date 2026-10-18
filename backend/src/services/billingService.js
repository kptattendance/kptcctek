// src/services/billingService.js
//
// Reproduces the CCTEK register formulas (2025-2026 sheet) for one
// application. All money is integer PAISE so totals never drift.
//
//   Service Charge %   O = slab on Project Bill Amount (>=10L 0.8, >=2L 0.7, else 0.5)
//   3rd Party Amt      P = ROUND(N * O / 100, 0)          (GST inclusive, whole rupees)
//   Remain Amount      R = P * 100 / 118                   (net of GST)
//   GST 18%            Q = P - R
//   TA                 T = KM * 15
//   AMOUNT             U = R - T
//   shares             V/W/X/Y = U * 45% / 10% / 25% / 20%  (from the rule)
//   balance split      the 20% balance is shared out as in the monthly
//                      "Resource Persons Remuneration Bill" sheets:
//                      DTE 25, Reserve 10, Student Welfare 15, Staff Welfare 18,
//                      Infrastructure 20, WID 5, Environment 2, R&M 2,
//                      Contingencies 3  (% of the balance, total 100)
//
// The percentages live in a BillingRule document, so a change in policy
// (e.g. 2024-25 used 42/10/3/5/20) is a new rule, never a code change, and
// old applications keep the rule they were billed under.

export const DEFAULT_RULE = {
  code: "TPI-2025",
  slabs: [
    // checked top-down; minAmount in paise
    { minAmount: 10_00_000_00, percent: 0.8 },
    { minAmount: 2_00_000_00, percent: 0.7 },
    { minAmount: 0, percent: 0.5 },
  ],
  gstPercent: 18,
  taPerKm: 15_00, // paise
  // Shares of AMOUNT (U). Must total 100.
  shares: [
    { key: "inspectors", label: "Resource Person Remuneration", percent: 45, payTo: "inspectors" },
    { key: "support", label: "Support / Accompanying Staff", percent: 10, payTo: "support" },
    { key: "admin_infra", label: "Administrative & Infrastructure", percent: 25, payTo: "fund" },
    { key: "profit", label: "Balance (allocation of funds)", percent: 20, payTo: "profit" },
  ],
  // Split of the balance ("profit") share. Must total 100.
  profitSplit: [
    { key: "dte", label: "DTE Share", percent: 25 },
    { key: "reserve", label: "Reserve", percent: 10 },
    { key: "student_welfare", label: "Student Welfare", percent: 15 },
    { key: "staff_welfare", label: "Staff Welfare", percent: 18 },
    { key: "infrastructure", label: "Infrastructure", percent: 20 },
    { key: "wid", label: "WID", percent: 5 },
    { key: "environment", label: "Environment", percent: 2 },
    { key: "repair", label: "Repair & Maintenance", percent: 2 },
    { key: "contingency", label: "Contingencies", percent: 3 },
  ],
};

const round = (n) => Math.round(n);

export function serviceChargePercent(projectBillPaise, rule = DEFAULT_RULE) {
  const slab = [...rule.slabs]
    .sort((a, b) => b.minAmount - a.minAmount)
    .find((s) => projectBillPaise >= s.minAmount);
  return slab ? slab.percent : 0;
}

// Split `total` paise by percentages so the parts always add back to total
// (largest-remainder method; Excel rounds each part independently and can be
// off by a paisa, we can't be).
export function splitExact(total, parts) {
  const raw = parts.map((p) => (total * p.percent) / 100);
  const floored = raw.map(Math.floor);
  let left = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floored[order[k].i] += 1;
  return Object.fromEntries(parts.map((p, i) => [p.key, floored[i]]));
}

export function validateRule(rule) {
  const sum = (arr) => arr.reduce((a, b) => a + Number(b.percent), 0);
  if (Math.abs(sum(rule.shares) - 100) > 1e-9) throw new Error("Rule shares must total 100%.");
  if (Math.abs(sum(rule.profitSplit) - 100) > 1e-9) throw new Error("Profit split must total 100%.");
  if (!rule.slabs?.length) throw new Error("Rule needs at least one service-charge slab.");
}

/**
 * @param {object} input                 all money in paise
 * @param {number} input.projectBillAmount  contractor's bill under inspection
 * @param {number} [input.km]               travel distance for TA
 * @param {"inclusive"|"exclusive"} [input.gstMode]
 *        inclusive: GST is carved out of the fee (MCC)
 *        exclusive: GST is added on top of the fee (Pilikula and other direct clients)
 * @param {number} [input.lumpsumFee]       fixed fee instead of the slab percentage
 * @param {number} [input.servicePercentOverride]
 * @returns breakdown in paise; `invoiceTotal` is what the client pays
 */
export function calculateCharges(input, rule = DEFAULT_RULE) {
  const bill = Math.trunc(Number(input.projectBillAmount));
  if (!Number.isFinite(bill) || bill < 0) throw new Error("Project bill amount must be a positive number.");
  const km = Math.max(0, Number(input.km) || 0);
  const gstMode = input.gstMode === "exclusive" ? "exclusive" : "inclusive";
  const lumpsum = input.lumpsumFee != null && input.lumpsumFee !== "" ? Math.trunc(Number(input.lumpsumFee)) : null;

  const percent = lumpsum != null ? null : input.servicePercentOverride ?? serviceChargePercent(bill, rule);
  // P: whole rupees, rounded half-up like Excel ROUND. Percent goes to basis
  // points first so 423500 x 0.7% is exactly 2964.50 (floats give 2964.4999).
  const basisPoints = percent == null ? 0 : Math.round(percent * 100);
  const claimed = lumpsum != null ? lumpsum : round((bill * basisPoints) / 1_000_000) * 100;

  let net, gst;
  if (gstMode === "inclusive") {
    net = round((claimed * 100) / (100 + rule.gstPercent));
    gst = claimed - net;
  } else {
    net = claimed;
    gst = round((claimed * rule.gstPercent) / 100);
  }
  const ta = round(km * rule.taPerKm);
  const amount = Math.max(0, net - ta);

  const shares = splitExact(amount, rule.shares);
  const profitKey = rule.shares.find((s) => s.payTo === "profit")?.key;
  const profitSplit = splitExact(profitKey ? shares[profitKey] : 0, rule.profitSplit);

  return {
    ruleCode: rule.code,
    gstMode,
    servicePercent: percent,
    lumpsum: lumpsum != null,
    projectBillAmount: bill,
    claimed,
    gst,
    net,
    invoiceTotal: net + gst,
    km,
    ta,
    amount,
    shares,
    profitSplit,
  };
}

// Equal split of a pool among people; remainder paise go to the first ones
// so the pool is paid out exactly.
export function splitAmong(pool, people) {
  if (!people.length) return [];
  const each = Math.floor(pool / people.length);
  let left = pool - each * people.length;
  return people.map((p) => ({ person: p, amount: each + (left-- > 0 ? 1 : 0) }));
}

export const rupeesToPaise = (r) => Math.round(Number(r) * 100);
export const paiseToRupees = (p) => (Number(p) / 100).toFixed(2);
