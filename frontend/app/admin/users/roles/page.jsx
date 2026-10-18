
import Link from "next/link";
import {
  ShieldCheck,
  Crown,
  ClipboardList,
  Building2,
  GraduationCap,
  Wallet,
  BadgeCheck,
  Eye,
  ArrowRight,
  LockKeyhole,
  Users,
  ChevronRight,
} from "lucide-react";

const roles = [
  {
    value: "admin",
    title: "System Administrator",
    description:
      "Manages system configuration, users, roles and overall application access.",
    icon: ShieldCheck,
    color: "bg-rose-100 text-rose-700",
    border: "border-rose-200",
    badge: "Highest access",
    permissions: [
      "Manage users and roles",
      "Configure the application",
      "Access all modules",
      "Review audit records",
    ],
  },
  {
    value: "manager",
    title: "CCTEK Manager",
    description:
      "Oversees incoming projects, work allocation, progress and operational decisions.",
    icon: Crown,
    color: "bg-amber-100 text-amber-800",
    border: "border-amber-200",
    badge: "Management",
    permissions: [
      "Review registered projects",
      "Assign work coordinators",
      "Monitor project progress",
      "Review billing information",
    ],
  },
  {
    value: "office_staff",
    title: "CCTEK Office Staff",
    description:
      "Registers incoming work and maintains project correspondence and office records.",
    icon: Building2,
    color: "bg-blue-100 text-blue-700",
    border: "border-blue-200",
    badge: "Office operations",
    permissions: [
      "Register incoming work",
      "Maintain project details",
      "Manage correspondence",
      "View permitted records",
    ],
  },
  {
    value: "work_coordinator",
    title: "Work Coordinator",
    description:
      "Coordinates technical work and distributes tasks among assigned faculty members.",
    icon: ClipboardList,
    color: "bg-violet-100 text-violet-700",
    border: "border-violet-200",
    badge: "Work allocation",
    permissions: [
      "View allocated projects",
      "Assign faculty tasks",
      "Track task completion",
      "Review submitted reports",
    ],
  },
  {
    value: "faculty",
    title: "College Staff / Faculty",
    description:
      "Carries out assigned technical work, updates progress and submits reports.",
    icon: GraduationCap,
    color: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-200",
    badge: "Technical work",
    permissions: [
      "View assigned projects",
      "Update own task progress",
      "Upload work reports",
      "View own assignments",
    ],
  },
  {
    value: "accounts",
    title: "Accounts and Billing Staff",
    description:
      "Maintains bill preparation, receipt records and financial documentation.",
    icon: Wallet,
    color: "bg-cyan-100 text-cyan-700",
    border: "border-cyan-200",
    badge: "Finance",
    permissions: [
      "View permitted project details",
      "Prepare bills",
      "Maintain receipts",
      "Generate financial reports",
    ],
  },
  {
    value: "approver",
    title: "Authorized Approver",
    description:
      "Reviews submitted financial or operational records and records authorized decisions.",
    icon: BadgeCheck,
    color: "bg-orange-100 text-orange-700",
    border: "border-orange-200",
    badge: "Approval",
    permissions: [
      "Review pending submissions",
      "Approve or reject authorized items",
      "View approval history",
      "Access relevant reports",
    ],
  },
  {
    value: "auditor",
    title: "Auditor / Read-only Reviewer",
    description:
      "Examines records, reports and audit history without modifying business data.",
    icon: Eye,
    color: "bg-slate-100 text-slate-700",
    border: "border-slate-200",
    badge: "Read-only",
    permissions: [
      "View authorized records",
      "Review financial reports",
      "Inspect audit history",
      "No routine data modification",
    ],
  },
];

export default function RolesPage() {
  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
          <Link
            href="/admin/dashboard"
            className="hover:text-amber-800"
          >
            Admin
          </Link>
          <ChevronRight size={14} />
          <Link
            href="/admin/users"
            className="hover:text-amber-800"
          >
            Faculty & Staff
          </Link>
          <ChevronRight size={14} />
          <span className="text-amber-800">Roles & Access</span>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-100 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-white/30" />

          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-extrabold text-amber-900">
                <LockKeyhole size={14} />
                ACCESS MANAGEMENT
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Roles & Permissions
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                CCTEK uses role-based access to separate administration,
                project management, technical work, finance and review
                responsibilities.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-amber-800 shadow-sm">
              <ShieldCheck size={32} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-800">
              <Users size={21} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">
                {roles.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Defined application roles
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <ClipboardList size={21} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-800">
                Work-focused
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Project and task access
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
              <LockKeyhole size={21} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-800">
                Restricted
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Access based on assigned role
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-slate-800">
            Available Roles
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the responsibilities planned for each application role.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {roles.map((role) => {
            const Icon = role.icon;

            return (
              <article
                key={role.value}
                className={`rounded-2xl border ${role.border} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${role.color}`}
                  >
                    <Icon size={23} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-800">
                        {role.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${role.color}`}
                      >
                        {role.badge}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-400">
                      Role key: {role.value}
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {role.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Intended permissions
                  </p>

                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {role.permissions.map((permission) => (
                      <li
                        key={permission}
                        className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-extrabold text-slate-800">
            Need to register a staff member?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Add the user and assign the appropriate role.
          </p>
        </div>

        <Link
          href="/admin/users/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-amber-500"
        >
          Add User
          <ArrowRight size={17} />
        </Link>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        These role descriptions document the intended access policy. Enforce
        permissions on the backend APIs and for individual records; hiding
        buttons in the frontend alone is not sufficient security.
      </p>
    </div>
  );
}
