"use client";

import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import { HOME_BY_ROLE, DEFAULT_DASHBOARD } from "@/app/shell/menus";

export default function Navbar() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);

  useEffect(() => {
    let cancelled = false;

    async function getDashboard() {
      if (!isLoaded || !isSignedIn) {
        setDashboard(DEFAULT_DASHBOARD);
        return;
      }

      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!token || !apiUrl) {
          if (!cancelled) setDashboard(DEFAULT_DASHBOARD);
          return;
        }

        // NEXT_PUBLIC_API_URL includes /api, so do not append /api again.
        const response = await axios.get(`${apiUrl}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const role = response.data?.data?.role;

        if (!cancelled) {
          setDashboard(HOME_BY_ROLE[role] || DEFAULT_DASHBOARD);
        }
      } catch (error) {
        console.error("Failed to determine CCTEK dashboard:", error);

        if (!cancelled) {
          setDashboard(DEFAULT_DASHBOARD);
        }
      }
    }

    getDashboard();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <nav className="sticky top-0 z-50 border-b border-cc-border bg-white/95 backdrop-blur-md">
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