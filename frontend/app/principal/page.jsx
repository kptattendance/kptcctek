"use client";

// Principal's home: statements waiting for approval (with enough detail to
// approve here), the year in brief, and the college funds the fee has built.

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, ExternalLink, AlertTriangle, Landmark } from "lucide-react";
import { useApi, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, fyOptions, fyOf, monthLabel, rupeesShort, STATEMENT_STATUS, Badge, can, amountInWords } from "@/lib/billing";
import { fmtDate } from "@/app/components/projects/projectMeta";
import { PageHeader, Card, StatCard, Spinner, Empty, Button, ConfirmDialog } from "@/app/components/ui";

export default function PrincipalDeskPage() {
  const api = useApi();
  const { me } = useMe();
  const [fy, setFy] = useState(fyOf());
  const { data: d, loading, reload } = useFetch("/desk/principal", { fy });
  const [approving, setApproving] = useState(null);
  const canApprove = can(me, "payouts.approve");

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <PageHeader title="Principal's desk" kn="ಪ್ರಾಂಶುಪಾಲರ ಮೇಜು" sub="Approvals, the year in brief, and the college funds from inspection fees.">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-cc-muted">Year · ವರ್ಷ</span>
          <select value={fy} onChange={(e) => setFy(e.target.value)} className="cc-field px-3 py-2 text-sm font-semibold">
            {fyOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </PageHeader>

      {loading && !d ? (
        <Spinner />
      ) : !d ? (
        <Empty>Could not load the desk.</Empty>
      ) : (
        <>
          <section aria-label="Waiting for your approval" className="space-y-3">
            <h2 className="flex items-baseline gap-2 text-lg font-bold">
              Waiting for your approval <span className="text-sm font-normal text-cc-muted">· ನಿಮ್ಮ ಅನುಮೋದನೆಗೆ</span>
            </h2>
            {d.approvals.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {d.approvals.map((s) => (
                  <ApprovalCard key={s._id} s={s} canApprove={canApprove} onApprove={() => setApproving(s)} />
                ))}
              </div>
            ) : (
              <div className="cc-card flex items-center gap-3 border-l-4 border-l-cc-ok p-4">
                <CheckCircle2 className="text-cc-ok" aria-hidden />
                <p className="text-sm">
                  <span className="font-semibold">Nothing is waiting for you.</span> Monthly remuneration statements appear here when the coordinator prepares them.
                </p>
              </div>
            )}
          </section>

          <section aria-label="Year in brief" className="space-y-3">
            <h2 className="text-lg font-bold">
              {fy} in brief <span className="text-sm font-normal text-cc-muted">· ವರ್ಷದ ಸಾರಾಂಶ</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Applications" kn="ಅರ್ಜಿಗಳು" value={d.year.applications} hint={`${d.year.completed} completed · ${d.year.inProgress} in progress`} tone="primary" />
              <StatCard label="Billed" kn="ಬಿಲ್ ಮೊತ್ತ" value={rupeesShort(d.year.billed)} hint={`${d.year.bills} bills · GST ${rupeesShort(d.year.gst)}`} />
              <StatCard label="Received" kn="ಸ್ವೀಕರಿಸಿದ್ದು" value={rupeesShort(d.year.received)} hint={d.year.tds ? `+ TDS ${rupeesShort(d.year.tds)}` : "by cheque / transfer"} tone="ok" />
              <StatCard label="Outstanding now" kn="ಬಾಕಿ" value={rupeesShort(d.year.outstanding)} hint={`${d.year.outstandingBills} unpaid bill${d.year.outstandingBills === 1 ? "" : "s"}, all years`} tone={d.year.outstanding ? "warn" : "ok"} />
              <StatCard label="Paid to resource persons" kn="ಸಂಭಾವನೆ" value={rupeesShort(d.year.toPeople)} hint={`${d.year.peopleCount} people · approved statements`} tone="accent" />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-5">
            <Funds funds={d.funds} fy={fy} className="xl:col-span-3" />
            <Card title="Recently approved" kn="ಇತ್ತೀಚೆಗೆ ಅನುಮೋದಿಸಿದವು" className="xl:col-span-2" bodyClass="p-0">
              {d.recent.length ? (
                <ul className="divide-y divide-cc-border">
                  {d.recent.map((s) => (
                    <li key={s._id}>
                      <Link href={`/billing/distribution/${s._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-cc-primary-soft/50">
                        <span>
                          <span className="font-semibold">{monthLabel(s.month)}</span>
                          <span className="block text-xs text-cc-muted">
                            {s.number} · approved {fmtDate(s.approvedAt)} by {s.approvedBy?.name}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">{formatRupees(s.totals.amount + s.totals.ta)}</span>
                          <Badge map={STATEMENT_STATUS} status={s.status} short />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No approved statements yet.</Empty>
              )}
              <div className="border-t border-cc-border px-4 py-3 text-sm">
                <Link href="/overview" className="font-semibold text-cc-primary hover:underline">
                  Full money overview (bills, parties, months) →
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}

      {approving && (
        <ConfirmDialog
          title={`Approve ${approving.number}?`}
          message={
            <span className="block space-y-1">
              <span className="block">
                {monthLabel(approving.month)}: <b>{formatRupees(approving.totals.amount + approving.totals.ta)}</b> to {approving.people} person(s) and the fund heads, from {approving.totals.applications} paid application(s).
              </span>
              <span className="block text-xs">{amountInWords(approving.totals.amount + approving.totals.ta)}</span>
            </span>
          }
          confirmLabel="Approve"
          onClose={() => setApproving(null)}
          onConfirm={async () => {
            try {
              await api.post(`/billing/statements/${approving._id}/approve`);
              notifySuccess(`${approving.number} approved.`);
              setApproving(null);
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

function ApprovalCard({ s, canApprove, onApprove }) {
  const shared = s.totals.amount + s.totals.ta;
  const toPeople = s.topPeople.reduce((a, p) => a + p.total, 0);
  const fund = s.heads.filter((h) => h.group === "fund").reduce((a, h) => a + h.amount, 0);
  const balance = s.heads.filter((h) => h.group === "balance").reduce((a, h) => a + h.amount, 0);
  return (
    <article className="cc-card border-l-4 border-l-cc-primary p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-cc-muted">Remuneration statement · {s.number}</p>
          <h3 className="text-lg font-bold">{monthLabel(s.month)}</h3>
          <p className="text-xs text-cc-muted">
            Prepared by {s.preparedBy} on {fmtDate(s.preparedOn)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{formatRupees(shared)}</p>
          <p className="text-xs text-cc-muted">to share, from {s.totals.applications} paid application{s.totals.applications > 1 ? "s" : ""}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-cc-subtle p-2">
          <dt className="text-cc-muted">Fee received</dt>
          <dd className="font-semibold tabular-nums">{rupeesShort(s.totals.fee)}</dd>
        </div>
        <div className="rounded-lg bg-cc-subtle p-2">
          <dt className="text-cc-muted">GST (not shared)</dt>
          <dd className="font-semibold tabular-nums">{rupeesShort(s.totals.gst)}</dd>
        </div>
        <div className="rounded-lg bg-cc-subtle p-2">
          <dt className="text-cc-muted">TA</dt>
          <dd className="font-semibold tabular-nums">{rupeesShort(s.totals.ta)}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-cc-muted">
            {s.people} resource person{s.people > 1 ? "s" : ""}
            {s.people > s.topPeople.length ? ` (top ${s.topPeople.length})` : ""}
          </p>
          <ul className="space-y-1 text-sm">
            {s.topPeople.map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="tabular-nums">{formatRupees(p.total)}</span>
              </li>
            ))}
          </ul>
          {s.people > s.topPeople.length && <p className="mt-1 text-xs text-cc-muted">Shown: {formatRupees(toPeople)}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-1 text-xs font-semibold text-cc-muted">Funds</p>
          <p className="flex justify-between gap-2"><span>Admin & infrastructure</span><span className="tabular-nums">{formatRupees(fund)}</span></p>
          <p className="flex justify-between gap-2"><span>Balance (9 heads incl. DTE)</span><span className="tabular-nums">{formatRupees(balance)}</span></p>
          {s.unallotted > 0 && (
            <p className="mt-2 flex items-start gap-1 text-xs font-semibold text-cc-warn">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
              {formatRupees(s.unallotted)} not allotted (a job had no accompanying staff). See the statement.
            </p>
          )}
        </div>
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Link href={`/billing/distribution/${s._id}`} className="cc-btn cc-press inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          <ExternalLink size={15} aria-hidden /> Review full statement
        </Link>
        {canApprove &&
          (s.mine ? (
            <span className="text-xs text-cc-muted">You prepared this, so someone else must approve it.</span>
          ) : (
            <Button primary onClick={onApprove}>
              <BadgeCheck size={16} aria-hidden /> Approve
            </Button>
          ))}
      </footer>
    </article>
  );
}

function Funds({ funds, fy, className }) {
  const admin = funds.filter((f) => f.group === "fund");
  const balance = funds.filter((f) => f.group === "balance");
  const dte = balance.find((f) => f.key === "dte");
  const college = balance.filter((f) => f.key !== "dte");
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  const max = Math.max(1, ...college.map((f) => f.allYears));

  const Row = ({ f, bar }) => (
    <tr className="border-t border-cc-border">
      <td className="px-4 py-2">
        {f.label}
        {bar && (
          <span className="mt-1 block h-1.5 rounded-full bg-cc-primary" style={{ width: `${Math.max(2, (f.allYears / max) * 100)}%` }} aria-hidden />
        )}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">{f.year ? formatRupees(f.year) : "—"}</td>
      <td className="px-4 py-2 text-right tabular-nums text-cc-muted">{f.pending ? formatRupees(f.pending) : "—"}</td>
      <td className="px-4 py-2 text-right font-semibold tabular-nums">{f.allYears ? formatRupees(f.allYears) : "—"}</td>
    </tr>
  );

  return (
    <Card title="College funds from inspection fees" kn="ಕಾಲೇಜು ನಿಧಿಗಳು" className={className} bodyClass="overflow-x-auto">
      {funds.length ? (
        <>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
              <tr>
                <th className="px-4 py-2">Head</th>
                <th className="px-4 py-2 text-right">Credited {fy}</th>
                <th className="px-4 py-2 text-right">Awaiting approval</th>
                <th className="px-4 py-2 text-right">All years</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-cc-subtle/60">
                <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-cc-muted">College heads (balance 20%)</td>
              </tr>
              {college.map((f) => (
                <Row key={f.key} f={f} bar />
              ))}
              <tr className="bg-cc-subtle/60">
                <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-cc-muted">Administrative & infrastructure support (25%)</td>
              </tr>
              {admin.map((f) => (
                <Row key={f.key} f={f} />
              ))}
            </tbody>
            <tfoot className="border-t-2 border-cc-border font-bold">
              <tr>
                <td className="px-4 py-2">Total with the college</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum([...college, ...admin], "year"))}</td>
                <td className="px-4 py-2 text-right tabular-nums text-cc-muted">{formatRupees(sum([...college, ...admin], "pending"))}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatRupees(sum([...college, ...admin], "allYears"))}</td>
              </tr>
            </tfoot>
          </table>
          {dte && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cc-border bg-amber-50 px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <Landmark size={16} className="text-amber-700" aria-hidden />
                <span>
                  <span className="font-semibold">DTE share (25% of balance)</span>
                  <span className="block text-xs text-cc-muted">Payable to the Department of Technical Education</span>
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className="font-bold">{formatRupees(dte.allYears)}</span>
                <span className="block text-xs text-cc-muted">
                  {fy}: {formatRupees(dte.year)}
                  {dte.pending ? ` · awaiting ${formatRupees(dte.pending)}` : ""}
                </span>
              </span>
            </div>
          )}
          <p className="border-t border-cc-border px-4 py-2 text-xs text-cc-muted">
            Credited = in approved statements. These are amounts set aside from fees; spending from the funds is not recorded in CCTEK yet.
          </p>
        </>
      ) : (
        <Empty>No fees have been shared out yet.</Empty>
      )}
    </Card>
  );
}
