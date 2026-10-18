"use client";

// Sidebar layout for the working screens (office, coordination, faculty).
// Desktop: fixed sidebar under the top bar. Phone: menu button + slide-in panel.
// Only the sections the person's role can use are listed.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  ScanLine, ListChecks, UsersRound, ClipboardCheck, LayoutDashboard, Users, Menu, X, LogOut,
} from "lucide-react";
import { useMe } from "@/lib/useMe";
import { sectionsFor } from "@/app/shell/menus";
import Avatar from "../users/Avatar";

const ICONS = { ScanLine, ListChecks, UsersRound, ClipboardCheck, LayoutDashboard, Users };

function NavLinks({ sections, onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-neu-muted">
            {s.title} <span className="normal-case tracking-normal">· {s.kn}</span>
          </p>
          <ul className="space-y-2">
            {s.items.map((item) => {
              const Icon = ICONS[item.icon] || LayoutDashboard;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm ${active ? "neu-inset font-bold text-neu-text" : "neu-press rounded-xl font-semibold text-neu-text/80 hover:text-neu-text"}`}
                  >
                    <Icon size={18} className={active ? "text-neu-accent" : ""} aria-hidden />
                    <span className="leading-tight">
                      {item.label}
                      <span className="block text-[11px] font-medium text-neu-muted">{item.kn}</span>
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
      <div className="flex-1 overflow-y-auto p-1">
        <Suspense fallback={null}>
          <NavLinks sections={sections} onNavigate={onNavigate} />
        </Suspense>
      </div>
      {me && (
        <div className="neu-raised-sm mt-4 flex items-center gap-3 p-3">
          <Avatar name={me.name} src={me.imageUrl} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me.name}</p>
            <p className="truncate text-xs text-neu-muted">{me.roleLabel}</p>
          </div>
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })} aria-label="Sign out" title="Sign out" className="neu-press rounded-lg p-2 text-neu-muted hover:text-neu-bad">
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
    <div className="min-h-[calc(100vh-4rem)] bg-neu text-neu-text lg:flex">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 p-4 lg:block">
        <div className="neu-raised h-full p-4">
          <SidebarBody />
        </div>
      </aside>

      {/* phone / tablet */}
      <div className="sticky top-16 z-30 flex items-center gap-3 bg-neu/95 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="neu-raised-sm neu-press p-2.5">
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold">Menu · ಮೆನು</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs bg-neu p-4 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="neu-raised-sm neu-press p-2">
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">
              <SidebarBody onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
