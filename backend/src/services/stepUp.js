// src/services/stepUp.js
//
// "Step-up" verification: before a sensitive action the user types a one-time
// code sent to his mobile (SMS) – or to his email while SMS is not set up.
// A correct code gives a short-lived pass for one kind of work (a "scope"),
// so a fee clerk is asked once per half hour, not for every receipt.
//
//   router.post("/x", authenticateUser, requireStepUp("fees"), handler)
//
// The browser sends its passes in the "X-Step-Up" header. Without a valid
// pass the server answers 428 { stepUp: { scope } } and the browser asks for
// the code, then repeats the request (frontend: components/StepUpGate.jsx).
//
// Env:
//   STEP_UP_SECRET          signing key for the passes (falls back to a hash of CLERK_SECRET_KEY)
//   STEP_UP_DISABLED=true   switch the whole thing off (testing only)
//   MSG91_AUTH_KEY          MSG91 account key            ┐ when both are set,
//   MSG91_OTP_TEMPLATE_ID   DLT-approved OTP template id ┘ codes go by SMS
//   MSG91_OTP_VAR           name of the code variable in the template (default "otp")

import crypto from "node:crypto";
import axios from "axios";

// Scopes and how long one verification lasts (minutes)
export const SCOPES = {
  qp: { label: "question papers", minutes: 10 },
  results: { label: "results", minutes: 10 },
  users: { label: "user accounts", minutes: 15 },
  ia: { label: "IA and attendance", minutes: 30 },
  fees: { label: "fee verification", minutes: 30 },
  marks: { label: "marks entry", minutes: 30 },
};

const secret = () =>
  crypto
    .createHash("sha256")
    .update(`step-up:${process.env.STEP_UP_SECRET || process.env.CLERK_SECRET_KEY || "dev-only"}`)
    .digest();

const sign = (userId, scope, exp) =>
  crypto.createHmac("sha256", secret()).update(`${userId}|${scope}|${exp}`).digest("base64url");

// Pass = "scope.expiryMs.signature"
export function issuePass(userId, scope) {
  const exp = Date.now() + SCOPES[scope].minutes * 60 * 1000;
  return { token: `${scope}.${exp}.${sign(userId, scope, exp)}`, scope, expiresAt: new Date(exp) };
}

export function hasPass(header, userId, scope) {
  for (const raw of String(header || "").split(",")) {
    const [s, exp, sig] = raw.trim().split(".");
    if (s !== scope || !exp || !sig || Number(exp) < Date.now()) continue;
    const expected = sign(userId, scope, exp);
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
  }
  return false;
}

export const requireStepUp = (scope) => (req, res, next) => {
  if (process.env.STEP_UP_DISABLED === "true") return next();
  if (hasPass(req.headers["x-step-up"], req.user?.id, scope)) return next();
  return res.status(428).json({
    error: `Verification needed for ${SCOPES[scope].label}.`,
    stepUp: { scope, label: SCOPES[scope].label },
  });
};

// ------------------------------------------------------------------ SMS

export const smsReady = () => Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);

// "98450 12345" / "+91-9845012345" -> "919845012345"; null if not an Indian mobile
export function indianMobile(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : null;
}

// MSG91 "Flow" API with a DLT-approved template, e.g.
//   "##otp## is your KPT Exams verification code. Valid for 10 minutes. -KPTMNG"
export async function sendOtpSms(mobile, code) {
  const variable = process.env.MSG91_OTP_VAR || "otp";
  const r = await axios.post(
    "https://control.msg91.com/api/v5/flow",
    { template_id: process.env.MSG91_OTP_TEMPLATE_ID, short_url: "0", recipients: [{ mobiles: mobile, [variable]: code }] },
    { headers: { authkey: process.env.MSG91_AUTH_KEY, "content-type": "application/json" }, timeout: 8000 }
  );
  if (r.data?.type === "error") throw new Error(r.data?.message || "MSG91 refused the message");
  return true;
}

export const maskMobile = (m) => `+91 ••••• ${String(m).slice(-5)}`;
export const maskEmail = (e = "") => e.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
