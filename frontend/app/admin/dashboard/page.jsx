
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  IndianRupee,
  Plus,
  ReceiptText,
  Users,
  Wallet,
  FolderKanban,
  ChartNoAxesCombined,
  CircleDashed,
} from "lucide-react";

const stats = [
  {
    title: "Total Projects",
    value: "128",
    note: "All registered projects",
    change: "+12%",
    icon: FolderKanban,
    color: "bg-blue-50 text-blue-700",
    accent: "border-blue-200",
    trend: "up",
  },
  {
    title: "Active Assignments",
    value: "36",
    note: "Work currently in progress",
    change: "+8%",
    icon: ClipboardList,
    color: "bg-violet-50 text-violet-700",
    accent: "border-violet-200",
    trend: "up",
  },
  {
    title: "Registered Users",
    value: "54",
    note: "Faculty and office staff",
    change: "+5%",
    icon: Users,
    color: "bg-emerald-50 text-emerald-700",
    accent: "border-emerald-200",
    trend: "up",
  },
  {
    title: "Pending Approvals",
    value: "09",
    note: "Require review",
    change: "Needs attention",
    icon: Clock3,
    color: "bg-orange-50 text-orange-700",
    accent: "border-orange-200",
    trend: "down",
  },
];

const workflows = [
  {
    label: "New work received",
    description: "Projects registered by office staff",
    count: "04",
    color: "bg-blue-500",
    light: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    label: "Manager review",
    description: "Awaiting review and allocation",
    count: "06",
    color: "bg-amber-500",
    light: "bg-amber-50",
    text: "text-amber-700",
  },
  {
    label: "Work in progress",
    description: "Assigned to coordinators and faculty",
    count: "18",
    color: "bg-violet-500",
    light: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    label: "Completed work",
    description: "Submitted for final verification",
    count: "08",
    color: "bg-emerald-500",
    light: "bg-emerald-50",
    text: "text-emerald-700",
  },
];

const quickActions = [
  {
    title: "Register Project",
    description: "Create a new work record",
    href: "/admin/projects/new",
    icon: Plus,
    color: "bg-amber-100 text-amber-800",
  },
  {
    title: "Manage Users",
    description: "Users, roles and access",
    href: "/admin/users",
    icon: Users,
    color: "bg-blue-100 text-blue-700",
  },
  {
    title: "Review Billing",
    description: "View bills and billing status",
    href: "/admin/billing",
    icon: IndianRupee,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "View Reports",
    description: "Project and finance reports",
    href: "/admin/reports",
    icon: ChartNoAxesCombined,
    color: "bg-violet-100 text-violet-700",
  },
];

const recentActivities = [
  {
    title: "Project registration",
    detail: "New work entered by office staff",
    time: "Awaiting live data",
    icon: BriefcaseBusiness,
    color: "bg-blue-100 text-blue-700",
  },
  {
    title: "Faculty assignment",
    detail: "Work allocation and progress updates",
    time: "Awaiting live data",
    icon: ClipboardList,
    color: "bg-violet-100 text-violet-700",
  },
  {
    title: "Billing and receipts",
    detail: "Financial records and approvals",
    time: "Awaiting live data",
    icon: ReceiptText,
    color: "bg-emerald-100 text-emerald-700",
  },
];

function SectionHeading({ title, subtitle, action, href }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {action && (
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
        >
          {action}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-16 h-56 w-56 rounded-full border-[28px] border-white/20" />
        <div className="pointer-events-none absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-white/15" />

        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/40 px-3 py-1.5 text-xs font-bold text-amber-950">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              ADMINISTRATOR WORKSPACE
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Welcome to CCTEK
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-800 sm:text-base">
              Manage projects, coordinate faculty assignments, monitor billing,
              and oversee the complete workflow from one place.
            </p>
          </div>

          <Link
            href="/admin/projects/new"
            className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <Plus size={18} />
            Register New Project
          </Link>
        </div>
      </section>

      {/* Summary cards */}
      <section>
        <SectionHeading
          title="Overview"
          subtitle="A snapshot of your project management workspace"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            const TrendIcon =
              item.trend === "up" ? ArrowUpRight : ArrowDownRight;

            return (
              <div
                key={item.title}
                className={`group rounded-2xl border ${item.accent} bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {item.title}
                    </p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-slate-800">
                      {item.value}
                    </p>
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color} transition group-hover:scale-105`}
                  >
                    <Icon size={23} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">{item.note}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      item.trend === "up"
                        ? "text-emerald-700"
                        : "text-orange-700"
                    }`}
                  >
                    {item.trend === "up" && <TrendIcon size={14} />}
                    {item.change}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Dashboard figures are placeholders until connected to the backend.
        </p>
      </section>

      {/* Workflow and finance */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <SectionHeading
            title="Project Workflow"
            subtitle="Track work from registration to completion"
            action="View projects"
            href="/admin/projects"
          />

          <div className="space-y-4">
            {workflows.map((item, index) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50/40 sm:gap-4 sm:p-4"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.light} ${item.text}`}
                >
                  {index === 0 && <BriefcaseBusiness size={21} />}
                  {index === 1 && <Clock3 size={21} />}
                  {index === 2 && <CircleDashed size={21} />}
                  {index === 3 && <CheckCircle2 size={21} />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-extrabold text-slate-800">
                    {item.count}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${item.color}`}
                    />
                    <span className="text-[10px] font-semibold text-slate-400">
                      Projects
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet size={22} />
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
              Finance
            </span>
          </div>

          <h2 className="mt-5 text-lg font-extrabold text-slate-800">
            Billing Overview
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review bills, receipts, pending amounts and financial approvals.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">
                Bills awaiting review
              </p>
              <p className="mt-1 text-2xl font-black text-slate-800">--</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">
                Outstanding receipts
              </p>
              <p className="mt-1 text-2xl font-black text-slate-800">--</p>
            </div>
          </div>

          <Link
            href="/admin/billing"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            Open Billing
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <SectionHeading
          title="Quick Actions"
          subtitle="Jump directly to frequently used functions"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.color} transition group-hover:scale-105`}
                >
                  <Icon size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-800">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <ArrowRight
                  size={17}
                  className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-amber-700"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Activity */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          title="Activity Centre"
          subtitle="Areas where recent system activity will appear"
        />

        <div className="divide-y divide-slate-100">
          {recentActivities.map((activity) => {
            const Icon = activity.icon;

            return (
              <div
                key={activity.title}
                className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activity.color}`}
                >
                  <Icon size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {activity.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.detail}
                  </p>
                </div>

                <span className="hidden text-xs text-slate-400 sm:block">
                  {activity.time}
                </span>
                <FileCheck2
                  size={17}
                  className="shrink-0 text-slate-300"
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
