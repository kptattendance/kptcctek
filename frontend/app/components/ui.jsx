"use client";

// Small building blocks in the CCTEK theme, shared by the newer screens.

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "./projects/dialogs";

export const inputCls = "cc-field w-full px-3 py-2.5 text-sm outline-none";
export const labelCls = "mb-1 block text-xs font-semibold text-cc-muted";

export function PageHeader({ title, kn, sub, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-cc-muted">
          {kn}
          {kn && sub ? " · " : ""}
          {sub}
        </p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

const TONES = {
  primary: "border-l-cc-primary",
  accent: "border-l-cc-accent",
  ok: "border-l-cc-ok",
  warn: "border-l-cc-warn",
  bad: "border-l-cc-bad",
  plain: "border-l-cc-border",
};

export function StatCard({ label, kn, value, hint, tone = "plain", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`cc-card border-l-4 p-4 text-left ${TONES[tone]} ${onClick ? "cc-press hover:border-cc-primary/40" : ""}`}
    >
      <p className="text-xs font-semibold text-cc-muted">
        {label}
        {kn && <span className="block font-normal">{kn}</span>}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-cc-muted">{hint}</p>}
    </Tag>
  );
}

export function Card({ title, kn, actions, children, className = "", bodyClass = "p-4" }) {
  return (
    <section className={`cc-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cc-border px-4 py-3">
          <h2 className="text-sm font-bold">
            {title}
            {kn && <span className="ml-1.5 font-normal text-cc-muted">· {kn}</span>}
          </h2>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Field({ label, kn, children, className = "", hint }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>
        {label}
        {kn && <span className="font-normal"> · {kn}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cc-muted">{hint}</span>}
    </label>
  );
}

export function Button({ primary, busy, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={busy || rest.disabled}
      className={`${primary ? "cc-btn-primary" : "cc-btn"} cc-press inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm ${className}`}
    >
      {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// "Are you sure?" with an optional required reason.
export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, needReason, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      {message && <div className="mb-4 text-sm text-cc-muted">{message}</div>}
      {needReason && (
        <Field label="Reason" kn="ಕಾರಣ" className="mb-4">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className={inputCls} />
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Back</Button>
        <Button
          primary
          busy={busy}
          disabled={needReason && !reason.trim()}
          onClick={go}
          className={danger ? "!border-cc-bad !bg-cc-bad hover:!bg-red-800" : ""}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Empty({ children }) {
  return <p className="p-8 text-center text-sm text-cc-muted">{children}</p>;
}

export function Spinner() {
  return (
    <div className="flex justify-center p-10">
      <LoaderCircle className="animate-spin text-cc-primary" aria-label="Loading" />
    </div>
  );
}
