"use client";

// Side panel with everything about one application, so tables can stay short.
// `actions(project)` renders the buttons the current screen allows.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, FileText, LoaderCircle, ExternalLink } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { BILL_STATUS } from "@/lib/billing";
import Avatar from "../users/Avatar";
import { StatusBadge, STATUS, fmtDate, WORK_TYPES } from "./projectMeta";

function Row({ label, kn, children }) {
  if (children == null || children === "" || children === "—") return null;
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-1.5">
      <dt className="text-xs font-semibold text-cc-muted">
        {label}
        {kn && <span className="block font-medium">{kn}</span>}
      </dt>
      <dd className="text-sm font-semibold text-cc-text">{children}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="cc-chip p-4">
      <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-cc-muted">{title}</h3>
      <dl className="divide-y divide-black/5">{children}</dl>
    </section>
  );
}

export default function ProjectDrawer({ projectId, onClose, actions, refreshKey }) {
  const api = useApi();
  const [p, setP] = useState(null);
  const [opening, setOpening] = useState(false);
  // Pages pass onClose inline; keep the latest without re-running the effects.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/projects/${projectId}`)
      .then((r) => !cancelled && setP(r.data.data))
      .catch((err) => {
        notifyError(err);
        closeRef.current();
      });
    return () => {
      cancelled = true;
    };
  }, [api, projectId, refreshKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openScan() {
    setOpening(true);
    try {
      const r = await api.get(`/projects/scans/${p.inward.scan}/url`);
      window.open(r.data.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      notifyError(err);
    } finally {
      setOpening(false);
    }
  }

  const c = p?.charges;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Application details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-cc-bg shadow-2xl">
        <header className="flex items-start justify-between gap-4 p-5">
          {p ? (
            <div>
              <p className="text-lg font-extrabold">
                App {p.appNo} · Sl. {p.serialNo}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-cc-muted">
                <StatusBadge status={p.status} /> {p.party?.code} · {fmtDate(p.appDate)}
              </p>
            </div>
          ) : (
            <LoaderCircle className="animate-spin text-cc-primary" aria-label="Loading" />
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="cc-chip cc-press p-2">
            <X size={18} />
          </button>
        </header>

        {p && (
          <>
            {actions && <div className="flex flex-wrap gap-2 px-5 pb-4">{actions(p)}</div>}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6">
              <Section title="Work · ಕಾಮಗಾರಿ">
                <Row label="Name of work" kn="ಕಾಮಗಾರಿಯ ಹೆಸರು">{p.appDetails}</Row>
                <Row label="Type" kn="ವಿಧ">{WORK_TYPES.find((w) => w.value === p.workType)?.label}</Row>
                <Row label="Ward" kn="ವಾರ್ಡ್">{p.ward}</Row>
                <Row label="Contractor" kn="ಗುತ್ತಿಗೆದಾರ">{p.contractorName}</Row>
                <Row label="Fund" kn="ಅನುದಾನ">
                  {p.fund?.name || p.fundSource ? (
                    <>
                      {p.fund?.name || "Not chosen"}
                      {p.fundSource && p.fundSource !== p.fund?.name && <span className="block text-xs font-normal text-cc-muted">On the letter: {p.fundSource}</span>}
                    </>
                  ) : null}
                </Row>
                <Row label="Work order" kn="ಅ.ಪ. ನಂಬ್ರ">{[p.fileNo, p.workYear].filter(Boolean).join(" / ")}</Row>
                <Row label="Work period" kn="ಕಾಮಗಾರಿ ಅವಧಿ">
                  {p.workStartedOn || p.workCompletedOn ? `${fmtDate(p.workStartedOn)} → ${fmtDate(p.workCompletedOn)}` : null}
                </Row>
              </Section>

              <Section title="From · ಕಳುಹಿಸಿದವರು">
                <Row label="Party" kn="ಸಂಸ್ಥೆ">{p.party?.name}</Row>
                <Row label="Engineer" kn="ಅಭಿಯಂತರರು">
                  {[p.partyEngineer, p.partyEngineerDesignation].filter(Boolean).join(", ")}
                </Row>
                <Row label="Mobile" kn="ಮೊಬೈಲ್">
                  {p.partyEngineerPhone ? <a className="underline" href={`tel:${p.partyEngineerPhone}`}>{p.partyEngineerPhone}</a> : null}
                </Row>
                <Row label="Letter ref." kn="ಪತ್ರ ಸಂಖ್ಯೆ">{p.inward?.letterRefNo}</Row>
              </Section>

              <Section title="Inspection · ತಪಾಸಣೆ">
                <Row label="Team" kn="ತಂಡ">
                  {p.team?.length ? (
                    <span className="flex flex-wrap gap-2">
                      {p.team.map((m) => (
                        <span key={m.user?._id} className="cc-chip flex items-center gap-2 py-1 pl-1 pr-3 text-xs">
                          <Avatar name={m.user?.name || "?"} src={m.user?.imageUrl} size={22} />
                          {m.user?.name} <span className="text-cc-muted">{m.role}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    "Not assigned yet"
                  )}
                </Row>
                <Row label="Planned visit" kn="ನಿಗದಿತ ದಿನಾಂಕ">{p.plannedInspectionDate ? fmtDate(p.plannedInspectionDate) : null}</Row>
                <Row label="Inspected on" kn="ತಪಾಸಣೆ ದಿನಾಂಕ">{p.inspectionDate ? fmtDate(p.inspectionDate) : null}</Row>
                <Row label="Distance" kn="ದೂರ">{p.km ? `${p.km} km` : null}</Row>
                <Row label="Certificate" kn="ದೃಢಪತ್ರ">{p.report?.certificateNo}</Row>
              </Section>

              <Section title="Amount · ಮೊತ್ತ">
                <Row label="Bill amount" kn="ಬಿಲ್ಲಿನ ಮೊತ್ತ">{formatRupees(p.projectBillAmount)}</Row>
                <Row label="Estimate" kn="ಅಂದಾಜು ಮೊತ್ತ">{p.estimateAmount != null ? formatRupees(p.estimateAmount) : null}</Row>
                {c && (
                  <>
                    <Row label="CCTEK fee" kn="ಶುಲ್ಕ">{`${formatRupees(c.net)}${c.lumpsum ? " (lumpsum)" : ` (${c.servicePercent}%)`}`}</Row>
                    <Row label="GST" kn="ಜಿ.ಎಸ್.ಟಿ">{`${formatRupees(c.gst)} (${c.gstMode})`}</Row>
                    <Row label="Party pays" kn="ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ">{formatRupees(c.invoiceTotal)}</Row>
                  </>
                )}
              </Section>

              {p.billing?.bill && (
                <Section title="Bill & payment · ಬಿಲ್ ಮತ್ತು ಪಾವತಿ">
                  <Row label="Bill" kn="ಬಿಲ್">
                    <Link href={`/billing/bills/${p.billing.bill._id}`} className="underline">{p.billing.bill.number || "Draft bill"}</Link>
                    {p.billing.bill.billDate && <span className="block text-xs font-normal text-cc-muted">{fmtDate(p.billing.bill.billDate)} · {BILL_STATUS[p.billing.bill.status]?.label || p.billing.bill.status}</span>}
                  </Row>
                  <Row label="Statement of bills" kn="ಬಿಲ್ಲುಗಳ ಪಟ್ಟಿ">
                    {p.billing.bill.group ? <Link href={`/billing/groups/${p.billing.bill.group._id}`} className="underline">{p.billing.bill.group.number}</Link> : null}
                  </Row>
                  {p.billing.receipts.map((r) => (
                    <Row key={r._id} label={r.status === "reversed" ? "Cheque (reversed)" : "Cheque"} kn="ಚೆಕ್">
                      <span className={r.status === "reversed" ? "text-cc-muted line-through" : ""}>
                        {r.instrumentNo} · {fmtDate(r.instrumentDate)}
                        <span className="block text-xs font-normal text-cc-muted">
                          {formatRupees(r.amount)} received {fmtDate(r.receivedOn)}{r.bankName ? ` · ${r.bankName}` : ""}
                        </span>
                      </span>
                    </Row>
                  ))}
                </Section>
              )}

              {p.inward?.scan && (
                <button type="button" onClick={openScan} disabled={opening} className="cc-chip cc-press flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
                  {opening ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />} Open scanned letter <ExternalLink size={14} className="text-cc-muted" />
                </button>
              )}

              {p.statusHistory?.length > 0 && (
                <section className="cc-chip p-4">
                  <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-cc-muted">History · ಇತಿಹಾಸ</h3>
                  <ol className="space-y-3 border-l-2 border-black/10 pl-4">
                    {[...p.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-semibold">{STATUS[h.to]?.label || h.to}</span>
                        <span className="text-cc-muted"> · {fmtDate(h.at)}{h.by?.name ? ` · ${h.by.name}` : ""}</span>
                        {h.note && <span className="block text-xs text-cc-muted">{h.note}</span>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
