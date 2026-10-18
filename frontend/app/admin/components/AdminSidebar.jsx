
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardList,
  IndianRupee,
  ReceiptText,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Building2,
  ShieldCheck,
  FileText,
  UserRoundCog,
  Wallet,
  BriefcaseBusiness,
} from "lucide-react";

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
        color: "text-amber-700",
        bg: "bg-amber-100",
      },
    ],
  },
  {
    title: "WORK MANAGEMENT",
    items: [
      {
        label: "Projects",
        icon: FolderKanban,
        color: "text-blue-600",
        bg: "bg-blue-50",
        children: [
          { label: "All Projects", href: "/admin/projects" },
          { label: "New Project", href: "/admin/projects/new" },
        ],
      },
      {
        label: "Assignments",
        icon: ClipboardList,
        color: "text-violet-600",
        bg: "bg-violet-50",
        children: [
          { label: "All Assignments", href: "/admin/assignments" },
          { label: "Task Tracking", href: "/admin/tasks" },
        ],
      },
      {
        label: "Faculty & Staff",
        icon: Users,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        children: [
          { label: "All Users", href: "/admin/users" },
          { label: "Add User", href: "/admin/users/new" },
          { label: "Roles & Access", href: "/admin/roles" },
        ],
      },
    ],
  },
  {
    title: "FINANCE",
    items: [
      {
        label: "Billing",
        href: "/admin/billing",
        icon: IndianRupee,
        color: "text-green-700",
        bg: "bg-green-50",
      },
      {
        label: "Receipts",
        href: "/admin/receipts",
        icon: ReceiptText,
        color: "text-cyan-700",
        bg: "bg-cyan-50",
      },
      {
        label: "Expenses & Payments",
        href: "/admin/payments",
        icon: Wallet,
        color: "text-orange-600",
        bg: "bg-orange-50",
      },
    ],
  },
  {
    title: "INSIGHTS & SYSTEM",
    items: [
      {
        label: "Reports",
        href: "/admin/reports",
        icon: ChartNoAxesCombined,
        color: "text-pink-600",
        bg: "bg-pink-50",
      },
      {
        label: "Documents",
        href: "/admin/documents",
        icon: FileText,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
      },
      {
        label: "Departments",
        href: "/admin/departments",
        icon: Building2,
        color: "text-teal-700",
        bg: "bg-teal-50",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        color: "text-slate-600",
        bg: "bg-slate-100",
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({
    Projects: true,
    Assignments: false,
    "Faculty & Staff": false,
  });

  const isActive = (href) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const toggleGroup = (label) => {
    setExpanded((previous) => ({
      ...previous,
      [label]: !previous[label],
    }));
  };

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-[78px] items-center justify-between border-b border-amber-100 px-5">
        <Link
          href="/admin/dashboard"
          onClick={closeMobile}
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-slate-900 shadow-sm">
            <BriefcaseBusiness size={23} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-xl font-extrabold tracking-tight text-slate-800">
              CCTEK
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
              Work Management
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={closeMobile}
          className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 lg:hidden"
          aria-label="Close sidebar"
        >
          <X size={21} />
        </button>
      </div>

      <div className="border-b border-slate-100 bg-amber-50/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
            <ShieldCheck size={21} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Administration</p>
            <p className="text-xs text-slate-500">System control centre</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navigation.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-extrabold tracking-[0.16em] text-slate-400">
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children?.length);
                const active = item.href
                  ? isActive(item.href)
                  : item.children?.some((child) => isActive(child.href));
                const open = Boolean(expanded[item.label]);

                return (
                  <div key={item.label}>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                          active
                            ? "bg-amber-100 text-slate-900"
                            : "text-slate-600 hover:bg-amber-50 hover:text-slate-900"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} ${item.color}`}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {open ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={closeMobile}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          active
                            ? "bg-amber-400 text-slate-900 shadow-sm"
                            : "text-slate-600 hover:bg-amber-50 hover:text-slate-900"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            active ? "bg-white/60" : item.bg
                          } ${item.color}`}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-slate-800" />
                        )}
                      </Link>
                    )}

                    {hasChildren && open && (
                      <div className="ml-7 mt-1 space-y-1 border-l-2 border-amber-100 pl-4">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href);

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              className={`block rounded-lg px-3 py-2 text-[13px] transition ${
                                childActive
                                  ? "bg-amber-50 font-bold text-amber-800"
                                  : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                              }`}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <UserRoundCog size={18} className="text-amber-700" />
            <span className="text-xs font-extrabold text-slate-800">
              Administrator
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Manage users, projects, workflows and system access from one place.
          </p>
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-400">
          CCTEK Management Portal
        </p>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-[92px] z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-white text-slate-700 shadow-md lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={21} />
      </button>

      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[270px] border-r border-amber-100 bg-white lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={closeMobile}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <aside className="absolute bottom-0 left-0 top-0 w-[285px] max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
