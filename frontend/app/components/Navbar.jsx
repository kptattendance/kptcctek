"use client";

import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useMe } from "@/lib/useMe";
import { HOME_BY_ROLE, DEFAULT_DASHBOARD } from "@/app/shell/menus";

export default function Navbar() {
  const { isSignedIn } = useAuth();
  const { me } = useMe(); // shared, cached /users/me (same call the pages use)
  const dashboard = (isSignedIn && me && HOME_BY_ROLE[me.role]) || DEFAULT_DASHBOARD;

  return (
    <nav className="no-print sticky top-0 z-50 border-b border-cc-border bg-white/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cc-sidebar text-sm font-extrabold text-cc-accent">
            CC
          </span>

          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight text-cc-text">
              CCTEK
            </span>
            <span className="hidden text-xs text-cc-muted sm:block">
              Third-party inspection · KPT Mangaluru
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Show when="signed-in">
            <Link
              href={dashboard}
              className="cc-btn-primary cc-press px-4 py-2 text-sm"
            >
              My dashboard
            </Link>

            <div className="flex h-10 w-10 items-center justify-center">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </div>
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="cc-btn-primary cc-press px-5 py-2 text-sm">
                Sign in
              </button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </nav>
  );
}