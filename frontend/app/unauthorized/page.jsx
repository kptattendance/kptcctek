"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ShieldX, LayoutDashboard, LogOut } from "lucide-react";
import { useMe } from "@/lib/useMe";
import { HOME_BY_ROLE, DEFAULT_DASHBOARD } from "../shell/menus";

export default function UnauthorizedPage() {
  const { me } = useMe();
  const { signOut } = useClerk();
  const home = (me && HOME_BY_ROLE[me.role]) || DEFAULT_DASHBOARD;

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-cc-bg px-4 text-cc-text">
      <section className="cc-card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-cc-bad">
          <ShieldX size={36} aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-extrabold">You don&apos;t have access to this page</h1>
        <p className="mt-1 text-sm font-semibold text-cc-muted">ಈ ಪುಟವನ್ನು ನೋಡಲು ನಿಮಗೆ ಅನುಮತಿ ಇಲ್ಲ</p>
        <p className="mt-4 text-sm text-cc-muted">
          {me ? (
            <>
              You are signed in as <span className="font-semibold text-cc-text">{me.name}</span> ({me.roleLabel}). If you need this page, ask the
              administrator to change your role.
            </>
          ) : (
            "Ask the administrator if you need this page."
          )}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href={home} className="cc-btn-primary cc-press flex items-center justify-center gap-2 px-5 py-3 text-sm">
            <LayoutDashboard size={17} aria-hidden /> My dashboard
          </Link>
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })} className="cc-chip cc-press flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold">
            <LogOut size={17} aria-hidden /> Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
