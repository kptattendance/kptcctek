"use client";

// Renders a section only for the roles allowed to use it.
//   signed out / not registered / deactivated -> /auth/check (explains and signs out)
//   wrong role                                 -> /unauthorized
// This keeps people out of screens they can't use; the API still checks
// every request, so hiding a page is never the only protection.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import FullPageStatus from "./FullPageStatus";

export default function RoleGate({ allow, children }) {
  const router = useRouter();
  const { me, loading, error } = useMe();
  const allowed = Boolean(me && (me.role === "admin" || allow.includes(me.role)));

  useEffect(() => {
    if (loading) return;
    if (error) {
      if (error.status === 401 || error.status === 403) router.replace("/auth/check");
      return;
    }
    if (!allowed) router.replace(`/unauthorized?role=${encodeURIComponent(me?.role || "")}`);
  }, [loading, error, allowed, me, router]);

  if (loading) return <FullPageStatus message="Checking your access…" />;
  if (error && error.status !== 401 && error.status !== 403)
    return <FullPageStatus title="Can't reach CCTEK" message="The server didn't respond. Check your connection and refresh the page." />;
  if (!allowed) return <FullPageStatus message="Redirecting…" />;
  return children;
}
