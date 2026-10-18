"use client";

// Money overview for Admin, CCTEK Manager and Principal: the whole year on
// one page. Work -> bills -> cheques -> distribution.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/api";
import { useFetch, fyOptions, fyOf, rupeesShort, monthLabel, STATEMENT_STATUS, Badge } from "@/lib/billing";
import { STATUS } from "@/app/components/projects/projectMeta";
import { fmtDate } from "@/app/components/projects/projectMeta";
import { PeopleTable, HeadsTable } from "@/app/components/billing/DistributionTables";
import { PageHeader, StatCard, Card, Spinner, Empty } from "@/app/components/ui";

const PIPELINE = ["received", "assigned", "inspected", "report_issued", "billed", "paid"];

export default function OverviewPage() {
  const router = useRouter();
  const [fy, setFy] = useState(fyOf());
  const { data: d, loading } = useFetch("/billing/overview", { fy });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title="Money overview" kn="ಹಣಕಾಸು ಸಾರಾಂಶ" sub="Bills, cheques received and how the money was shared out.">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-cc-muted">Financial year · ಆರ್ಥಿಕ ವರ್ಷ</span>
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
        <Empty>Could not load the overview.</Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Billed this year" kn="ಬಿಲ್ ಮಾಡಿದ ಮೊತ್ತ" value={rupeesShort(d.cards.billed)} hint={`${d.cards.bills} bills · ${formatRupees(d.cards.billed)}`} tone="primary" onClick={() => router.push("/billing/bills")} />
            <StatCard label="Received this year" kn="ಸ್ವೀಕರಿಸಿದ ಮೊತ್ತ" value={rupeesShort(d.cards.received)} hint={`+ TDS ${formatRupees(d.cards.tds)}`} tone="ok" onClick={() => router.push("/billing/receipts")} />
            <StatCard label="Outstanding now (all years)" kn="ಬಾಕಿ ಮೊತ್ತ" value={rupeesShort(d.cards.outstanding)} hint={formatRupees(d.cards.outstanding)} tone={d.cards.outstanding ? "warn" : "ok"} onClick={() => router.push("/billing/bills")} />
            <StatCard
              label="Reports issued, not billed"
              kn="ಬಿಲ್ ಮಾಡಬೇಕಾದವು"
              value={d.cards.readyToBill.n}
              hint={`${formatRupees(d.cards.readyToBill.amount)}${d.cards.drafts ? ` · ${d.cards.drafts} draft bill(s)` : ""}`}
              tone={d.cards.readyToBill.n ? "accent" : "plain"}
              onClick={() => router.push("/billing")}
            />
            <StatCard label="GST on bills" kn="ಜಿಎಸ್‌ಟಿ" value={rupeesShort(d.cards.gst)} hint="Payable to Government, not shared" />
            <StatCard label="Shared out (approved)" kn="ಹಂಚಿದ ಮೊತ್ತ" value={rupeesShort(d.cards.distributed)} hint={`Paid out ${formatRupees(d.cards.paidOut)}`} tone="ok" onClick={() => router.push("/billing/distribution")} />
            <StatCard label="Waiting to be shared" kn="ಹಂಚಿಕೆ ಬಾಕಿ" value={rupeesShort(d.cards.pendingDistribution)} hint={`${d.distribution.stages.waiting.applications} waiting · ${d.distribution.stages.prepared.applications} awaiting approval`} tone={d.cards.pendingDistribution ? "accent" : "plain"} onClick={() => router.push("/billing/distribution")} />
            <StatCard label="Fee without GST" kn="ನಿವ್ವಳ ಶುಲ್ಕ" value={rupeesShort(d.cards.net)} hint="Basis of distribution (after TA)" />
          </div>

          <Card title="Work pipeline this year" kn="ಕೆಲಸದ ಹಂತಗಳು" bodyClass="p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PIPELINE.map((s, i) => (
                <div key={s} className="relative rounded-lg bg-cc-subtle p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums">{d.pipeline[s] || 0}</p>
                  <p className="text-xs font-semibold">{STATUS[s].label}</p>
                  <p className="text-[11px] text-cc-muted">{STATUS[s].kn}</p>
                  {i < PIPELINE.length - 1 && <span aria-hidden className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-cc-muted sm:block">›</span>}
                </div>
              ))}
            </div>
            {(d.pipeline.on_hold || d.pipeline.cancelled) && (
              <p className="mt-2 text-xs text-cc-muted">
                On hold {d.pipeline.on_hold || 0} · Cancelled {d.pipeline.cancelled || 0}
              </p>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-5">
            <Card title="Month by month" kn="ತಿಂಗಳುವಾರು" className="xl:col-span-3" bodyClass="overflow-x-auto">
              <MonthTable months={d.months} />
            </Card>
            <Card title="Outstanding by age" kn="ಬಾಕಿ ಅವಧಿ" className="xl:col-span-2" bodyClass="p-0">
              <div className="grid grid-cols-4 gap-px bg-cc-border">
                {Object.entries(d.aging).map(([k, v]) => (
                  <div key={k} className="bg-white p-3 text-center">
                    <p className={`text-xs font-semibold ${k === "90+" && v.n ? "text-cc-bad" : k === "61-90" && v.n ? "text-cc-warn" : "text-cc-muted"}`}>{k} days</p>
                    <p className="text-sm font-bold tabular-nums">{rupeesShort(v.amount)}</p>
                    <p className="text-xs text-cc-muted">{v.n} bill{v.n === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
              <p className="border-t border-cc-border px-4 pt-3 text-xs font-semibold text-cc-muted">Oldest unpaid bills · ಹಳೆಯ ಬಾಕಿ</p>
              {d.oldestOpen.length ? (
                <ul className="divide-y divide-cc-border px-4 pb-2">
                  {d.oldestOpen.map((b) => (
                    <li key={b._id}>
                      <Link href={`/billing/bills/${b._id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-cc-primary">
                        <span>
                          <span className="font-semibold">{b.number}</span> <span className="text-cc-muted">· {b.party} · {fmtDate(b.billDate)}</span>
                        </span>
                        <span className="font-semibold tabular-nums">{formatRupees(b.due)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No unpaid bills.</Empty>
              )}
            </Card>
          </div>

          <Card title="Party-wise" kn="ಸಂಸ್ಥೆವಾರು" bodyClass="overflow-x-auto">
            {d.parties.length ? (
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
                  <tr>
                    <th className="px-4 py-2">Party</th>
                    <th className="px-4 py-2 text-right">Bills</th>
                    <th className="px-4 py-2 text-right">Billed</th>
                    <th className="px-4 py-2 text-right">Received</th>
                    <th className="px-4 py-2 text-right">TDS</th>
                    <th className="px-4 py-2 text-right">Outstanding now</th>
                  </tr>
                </thead>
                <tbody>
                  {d.parties.map((p) => (
                    <tr key={p.party} className="border-t border-cc-border">
                      <td className="px-4 py-2"><span className="font-semibold">{p.party}</span> <span className="text-xs text-cc-muted">{p.name}</span></td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.bills}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatRupees(p.billed)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatRupees(p.received)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatRupees(p.tds)}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${p.outstanding ? "text-cc-warn" : ""}`}>{formatRupees(p.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No bills this year yet.</Empty>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Fund heads this year" kn="ನಿಧಿ ಶೀರ್ಷಿಕೆಗಳು" bodyClass="overflow-x-auto">
              <p className="px-4 pt-3 text-xs text-cc-muted">All applications paid this year (approved, awaiting approval and waiting).</p>
              <HeadsTable heads={d.distribution.heads} />
            </Card>
            <Card title="Remuneration to persons this year" kn="ವ್ಯಕ್ತಿಗಳ ಸಂಭಾವನೆ" bodyClass="overflow-x-auto">
              <PeopleTable people={d.distribution.people} />
            </Card>
          </div>

          <Card title="Monthly statements" kn="ಮಾಸಿಕ ಪಟ್ಟಿಗಳು" bodyClass="p-0">
            {d.statements.length ? (
              <ul className="divide-y divide-cc-border">
                {d.statements.map((s) => (
                  <li key={s._id}>
                    <Link href={`/billing/distribution/${s._id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-cc-primary-soft/50">
                      <span>
                        <span className="font-semibold">{s.number}</span> · {monthLabel(s.month)} · {s.totals.applications} applications
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">{formatRupees(s.totals.amount + s.totals.ta)}</span>
                        <Badge map={STATEMENT_STATUS} status={s.status} short />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No statements this year yet.</Empty>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MonthTable({ months }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.billed, m.received)));
  const tot = months.reduce((a, m) => ({ billed: a.billed + m.billed, received: a.received + m.received, bills: a.bills + m.bills }), { billed: 0, received: 0, bills: 0 });
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
        <tr>
          <th className="px-4 py-2">Month</th>
          <th className="px-4 py-2 text-right">Bills</th>
          <th className="px-4 py-2 text-right">Billed</th>
          <th className="px-4 py-2 text-right">Received</th>
          <th className="w-[30%] px-4 py-2">
            <span className="mr-3 inline-flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-sm bg-cc-primary" /> billed</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-sm bg-cc-accent" /> received</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {months.map((m) => (
          <tr key={m.month} className="border-t border-cc-border">
            <td className="px-4 py-1.5 whitespace-nowrap">{monthLabel(m.month)}</td>
            <td className="px-4 py-1.5 text-right tabular-nums">{m.bills || "—"}</td>
            <td className="px-4 py-1.5 text-right tabular-nums">{m.billed ? formatRupees(m.billed) : "—"}</td>
            <td className="px-4 py-1.5 text-right tabular-nums">{m.received ? formatRupees(m.received) : "—"}</td>
            <td className="px-4 py-1.5">
              <div className="space-y-0.5" aria-hidden>
                <div className="h-1.5 rounded-full bg-cc-primary" style={{ width: `${(m.billed / max) * 100}%` }} />
                <div className="h-1.5 rounded-full bg-cc-accent" style={{ width: `${(m.received / max) * 100}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-cc-border font-bold">
        <tr>
          <td className="px-4 py-2">Year</td>
          <td className="px-4 py-2 text-right tabular-nums">{tot.bills}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(tot.billed)}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatRupees(tot.received)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
