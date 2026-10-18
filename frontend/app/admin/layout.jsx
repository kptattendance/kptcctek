
import { Suspense } from "react";
import AdminSidebar from "./components/AdminSidebar";
import RoleGate from "../components/shell/RoleGate";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-neu text-neu-text">
      {/* the sidebar reads the URL; dynamic routes (e.g. /users/[id]/edit) need it in Suspense */}
      <Suspense fallback={null}>
        <AdminSidebar />
      </Suspense>

      <div className="min-h-screen lg:pl-[270px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-amber-100 bg-white/95 px-5 shadow-sm backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 pl-12 lg:pl-0">
            <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 sm:flex">
              <LayoutDashboard size={19} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">
                CCTEK Admin
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Project, people and finance management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Management Portal
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-amber-500" />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-900 shadow-sm">
              <ShieldCheck size={21} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link
              href="/admin/dashboard"
              className="transition hover:text-amber-700"
            >
              Admin
            </Link>
            <ChevronRight size={14} />
            <span className="text-slate-600">Workspace</span>
          </div>

          <RoleGate allow={["manager"]}>{children}</RoleGate>
        </main>

        <footer className="border-t border-amber-100 bg-white px-6 py-4 text-center text-xs text-slate-400">
          © 2026 CCTEK · Work and Project Management System
        </footer>
      </div>
    </div>
  );
}
