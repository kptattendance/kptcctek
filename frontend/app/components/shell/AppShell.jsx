"use client";

// Sidebar layout for every signed-in screen.
// Desktop: fixed deep-teal sidebar under the top bar. Phone: menu button + slide-in panel.
// Only the sections the person's role can use are listed.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  ScanLine, ListChecks, UsersRound, ClipboardCheck, LayoutDashboard, Users, Menu, X, LogOut,
  FilePlus2, FileText, Layers, Wallet, HandCoins, Settings, PieChart, Gauge, Landmark,
} from "lucide-react";
import { useMe } from "@/lib/useMe";
import { sectionsFor } from "@/app/shell/menus";
import Avatar from "../users/Avatar";

const ICONS = {
  ScanLine, ListChecks, UsersRound, ClipboardCheck, LayoutDashboard, Users, FilePlus2, FileText, Layers, Wallet, HandCoins, Settings, PieChart, Gauge, Landmark,
};

function NavLinks({ sections, onNavigate }) {
  const pathname = usePathname();
  // the longest matching link wins, so /billing/bills does not also light up /billing
  const all = sections.flatMap((s) => s.items.map((i) => i.href));
  const current = all
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Main" className="space-y-5">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-200/70">
            {s.title} <span className="normal-case tracking-normal">· {s.kn}</span>
          </p>
          <ul className="space-y-0.5">
            {s.items.map((item) => {
              const Icon = ICONS[item.icon] || LayoutDashboard;
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-cc-accent ${
                      active ? "bg-white/12 font-semibold text-white" : "text-teal-50/80 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-cc-accent" />}
                    <Icon size={18} className={active ? "text-cc-accent" : "text-teal-200/80"} aria-hidden />
                    <span className="leading-tight">
                      {item.label}
                      <span className="block text-[11px] font-normal text-teal-100/60">{item.kn}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }) {
  const { me } = useMe();
  const { signOut } = useClerk();
  const sections = me ? sectionsFor(me.role) : [];
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <Suspense fallback={null}>
          <NavLinks sections={sections} onNavigate={onNavigate} />
        </Suspense>
      </div>
      {me && (
        <div className="m-2 flex items-center gap-3 rounded-xl bg-white/8 p-3">
          <Avatar name={me.name} src={me.imageUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{me.name}</p>
            <p className="truncate text-xs text-teal-100/70">{me.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/" })}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-2 text-teal-100/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cc-bg text-cc-text lg:flex">
      <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 bg-cc-sidebar lg:block">
        <SidebarBody />
      </aside>

      {/* phone / tablet */}
      <div className="no-print sticky top-16 z-30 flex items-center gap-3 border-b border-cc-border bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="cc-chip cc-press p-2">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold">Menu · ಮೆನು</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-cc-sidebar shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="text-sm font-bold text-white">CCTEK</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-teal-100 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarBody onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
