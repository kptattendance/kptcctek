"use client";

// CCTEK Manager's home: what needs a decision today, where work is stuck,
// how the team is loaded, and what happened recently.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ArrowRight, FileWarning, Clock3, FilePlus2, BadgeCheck } from "lucide-react";
import { formatRupees } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { useFetch, fyOptions, fyOf, monthLabel, rupeesShort } from "@/lib/billing";
import DataTable from "@/app/components/table/DataTable";
import ProjectDrawer from "@/app/components/projects/ProjectDrawer";
import { StatusBadge, fmtDate } from "@/app/components/projects/projectMeta";
import Avatar from "@/app/components/users/Avatar";
import { PageHeader, Card, Spinner, Empty } from "@/app/components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function ManagerDeskPage() {
  const router = useRouter();
  const { me } = useMe();
  const [fy, setFy] = useState(fyOf());
  const [openId, setOpenId] = useState(null);
  const { data: d, loading } = useFetch("/desk/manager", { fy });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader title={`${greeting()}, ${me?.name?.split(" ")[0] || ""}`} kn="ವ್ಯವಸ್ಥಾಪಕರ ಮೇಜು" sub="Manager desk: what needs you today, and how the work is moving.">
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
          <Attention d={d} onGo={(href) => router.push(href)} />

          <Card title="Work stages" kn="ಕೆಲಸದ ಹಂತಗಳು" bodyClass="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {d.attention.stages.map((s) => (
                <div key={s.key} className={`rounded-lg border p-3 ${s.delayed ? "border-amber-200 bg-amber-50" : "border-cc-border bg-cc-subtle"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={s.key} />
                    <span className="text-xs text-cc-muted">limit {s.limit} days</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{s.open}</p>
                  <p className="text-xs text-cc-muted">
                    waiting in this stage
                    {s.delayed ? (
                      <span className="mt-0.5 flex items-center gap-1 font-semibold text-cc-warn">
                        <Clock3 size={12} aria-hidden /> {s.delayed} delayed · {s.label}
                      </span>
                    ) : (
                      <span className="mt-0.5 flex items-center gap-1 font-semibold text-cc-ok">
                        <CheckCircle2 size={12} aria-hidden /> on time
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-3 xl:col-span-2">
              <h2 className="flex items-baseline gap-2 text-lg font-bold">
                Delayed work <span className="text-sm font-normal text-cc-muted">· ತಡವಾದ ಕೆಲಸ · {d.delayedTotal} job{d.delayedTotal === 1 ? "" : "s"}</span>
              </h2>
              <DataTable
                columns={[
                  { key: "appNo", header: "App no.", kn: "ಅರ್ಜಿ", render: (r) => <span className="font-semibold">{r.appNo}<span className="block text-xs font-normal text-cc-muted">{r.party}{r.ward ? ` · Ward ${r.ward}` : ""}</span></span> },
                  { key: "stage", header: "Stage", kn: "ಹಂತ", render: (r) => <StatusBadge status={r.status} /> },
                  { key: "problem", header: "Problem", kn: "ಸಮಸ್ಯೆ", render: (r) => <span>{r.problem}<span className="block text-xs text-cc-muted">{r.who}</span></span> },
                  { key: "team", header: "Team", kn: "ತಂಡ", hideBelow: "lg", className: "max-w-[200px]", render: (r) => <span className="line-clamp-1 text-xs">{r.team.join(", ") || "—"}</span> },
                  { key: "late", header: "Late by", kn: "ತಡ", className: "text-right whitespace-nowrap", render: (r) => <span className={r.late > 14 ? "font-bold text-cc-bad" : "font-bold text-cc-warn"}>{r.late} d</span> },
                ]}
                rows={d.delayed}
                onRowClick={(r) => setOpenId(r._id)}
                emptyText="No delayed work. Everything is within its time limit."
              />
            </div>
            <MonthCompare months={d.months} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title="Team this year" kn="ತಂಡ" className="xl:col-span-2" bodyClass="overflow-x-auto">
              {d.team.length ? (
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2 text-right">Open now</th>
                      <th className="px-4 py-2 text-right">Inspected this month</th>
                      <th className="px-4 py-2 text-right">Completed</th>
                      <th className="px-4 py-2 text-right">Jobs this year</th>
                      <th className="px-4 py-2 text-right">Remuneration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.team.map((m) => (
                      <tr key={m.user} className="border-t border-cc-border">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            <Avatar name={m.name} src={m.imageUrl} size={28} />
                            <span>
                              <span className="font-semibold">{m.name}</span>
                              {m.designation && <span className="block text-xs text-cc-muted">{m.designation}</span>}
                            </span>
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${m.open >= 5 ? "font-bold text-cc-warn" : ""}`}>{m.open}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.inspectedThisMonth}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.done}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.jobs}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.earned ? formatRupees(m.earned) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>No one has been assigned work this year.</Empty>
              )}
            </Card>
            <Activity rows={d.activity} onProject={setOpenId} />
          </div>
        </>
      )}

      {openId && <ProjectDrawer projectId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Attention({ d, onGo }) {
  const a = d.attention;
  const overdueDue = a.overdueBills.reduce((s, b) => s + b.due, 0);
  const items = [
    {
      key: "approve",
      show: a.toApprove.length > 0,
      icon: BadgeCheck,
      title: `${a.toApprove.length} statement${a.toApprove.length > 1 ? "s" : ""} waiting for approval`,
      kn: "ಅನುಮೋದನೆ ಬಾಕಿ",
      text: a.toApprove.map((s) => `${s.number} · ${monthLabel(s.month)} · ${formatRupees(s.amount)}${s.mine ? " (prepared by you)" : ""}`).join("; "),
      href: a.toApprove.length === 1 ? `/billing/distribution/${a.toApprove[0]._id}` : "/billing/distribution",
      tone: "primary",
    },
    {
      key: "overdue",
      show: a.overdueBills.length > 0,
      icon: FileWarning,
      title: `${a.overdueBills.length} bill${a.overdueBills.length > 1 ? "s" : ""} unpaid for over 60 days`,
      kn: "60 ದಿನ ಮೀರಿದ ಬಾಕಿ",
      text: `${formatRupees(overdueDue)} due. Oldest: ${a.overdueBills[0]?.number} (${a.overdueBills[0]?.party}, ${a.overdueBills[0]?.days} days). Send a reminder.`,
      href: "/billing/bills",
      tone: "bad",
    },
    {
      key: "delayed",
      show: d.delayedTotal > 0,
      icon: AlertTriangle,
      title: `${d.delayedTotal} job${d.delayedTotal > 1 ? "s" : ""} past the time limit`,
      kn: "ತಡವಾದ ಕೆಲಸ",
      text: a.stages.filter((s) => s.delayed).map((s) => `${s.delayed} ${s.label.toLowerCase()}`).join(" · "),
      href: "/coordinator",
      tone: "warn",
    },
    {
      key: "bill",
      show: a.readyToBill > 0 || a.draftBills > 0,
      icon: FilePlus2,
      title: `${a.readyToBill} report${a.readyToBill === 1 ? "" : "s"} ready to bill`,
      kn: "ಬಿಲ್ ಮಾಡಬೇಕಾದವು",
      text: a.draftBills ? `${a.draftBills} draft bill(s) still to be issued.` : "Ask the coordinator to bill them.",
      href: a.readyToBill ? "/billing" : "/billing/bills",
      tone: "accent",
    },
  ].filter((i) => i.show);

  const TONE = {
    primary: "border-l-cc-primary",
    bad: "border-l-cc-bad",
    warn: "border-l-cc-warn",
    accent: "border-l-cc-accent",
  };
  const ICON_TONE = { primary: "text-cc-primary", bad: "text-cc-bad", warn: "text-cc-warn", accent: "text-amber-600" };

  if (!items.length)
    return (
      <div className="cc-card flex items-center gap-3 border-l-4 border-l-cc-ok p-4">
        <CheckCircle2 className="text-cc-ok" aria-hidden />
        <p className="text-sm">
          <span className="font-semibold">All clear.</span> Nothing is waiting for you: no approvals, no delayed work, no overdue bills.
        </p>
      </div>
    );

  return (
    <section aria-label="Needs your attention" className="space-y-2">
      <h2 className="text-sm font-bold text-cc-muted">Needs your attention · ನಿಮ್ಮ ಗಮನಕ್ಕೆ</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(({ key, icon: Icon, title, kn, text, href, tone }) => (
          <button key={key} type="button" onClick={() => onGo(href)} className={`cc-card cc-press flex items-start gap-3 border-l-4 p-4 text-left hover:border-cc-primary/40 ${TONE[tone]}`}>
            <Icon size={20} className={`mt-0.5 shrink-0 ${ICON_TONE[tone]}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{title}</span>
              <span className="block text-xs text-cc-muted">{kn}</span>
              <span className="mt-1 block text-sm text-cc-muted">{text}</span>
            </span>
            <ArrowRight size={16} className="mt-1 shrink-0 text-cc-muted" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}

function MonthCompare({ months }) {
  const rows = [
    ["applications", "New applications", "ಹೊಸ ಅರ್ಜಿಗಳು", (v) => v],
    ["inspections", "Inspections done", "ತಪಾಸಣೆಗಳು", (v) => v],
    ["reports", "Reports issued", "ವರದಿಗಳು", (v) => v],
    ["billed", "Billed", "ಬಿಲ್ ಮೊತ್ತ", rupeesShort],
    ["received", "Cheques received", "ಸ್ವೀಕರಿಸಿದ್ದು", rupeesShort],
  ];
  return (
    <Card title="This month vs last month" kn="ಈ ತಿಂಗಳು / ಹಿಂದಿನ ತಿಂಗಳು" bodyClass="p-0">
      <table className="w-full text-sm">
        <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
          <tr>
            <th className="px-4 py-2" />
            <th className="px-4 py-2 text-right">{monthLabel(months.last.month).split(" ")[0]}</th>
            <th className="px-4 py-2 text-right">{monthLabel(months.this.month).split(" ")[0]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, label, kn, fmt]) => {
            const a = months.last[k];
            const b = months.this[k];
            return (
              <tr key={k} className="border-t border-cc-border">
                <td className="px-4 py-2.5">
                  {label}
                  <span className="block text-xs text-cc-muted">{kn}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-cc-muted">{fmt(a)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {fmt(b)}
                  {a > 0 && b !== a && (
                    <span className={`ml-1 text-xs font-normal ${b > a ? "text-cc-ok" : "text-cc-muted"}`} title="change from last month">
                      {b > a ? "▲" : "▼"} {Math.abs(Math.round(((b - a) / a) * 100))}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-cc-border px-4 py-2 text-xs text-cc-muted">This month is still running.</p>
    </Card>
  );
}

function Activity({ rows, onProject }) {
  return (
    <Card title="Recent activity" kn="ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ" bodyClass="p-0">
      {rows.length ? (
        <ol className="max-h-[440px] divide-y divide-cc-border overflow-y-auto">
          {rows.map((r) => {
            const target = r.href ? (
              <Link href={r.href} className="font-semibold text-cc-primary hover:underline">{r.target}</Link>
            ) : r.projectId ? (
              <button type="button" onClick={() => onProject(r.projectId)} className="font-semibold text-cc-primary hover:underline">{r.target}</button>
            ) : (
              <span className="font-semibold">{r.target}</span>
            );
            return (
              <li key={r._id} className="px-4 py-2.5 text-sm">
                <p>
                  <span className="font-semibold">{r.who}</span> {r.verb} {target} {r.detail && <span className="text-cc-muted">{r.detail}</span>}
                </p>
                <p className="text-xs text-cc-muted">
                  {fmtDate(r.at)} · {new Date(r.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>No activity yet.</Empty>
      )}
    </Card>
  );
}
