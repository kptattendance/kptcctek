"use client";

// After sign-in: ask the API who this is and send them to their home page.
// Not registered / deactivated -> explain and sign out.
// Server unreachable -> explain and offer "Try again" (do NOT sign out:
// the person is fine, the connection is not).

import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApi, apiError } from "@/lib/api";
import FullPageStatus from "../../components/shell/FullPageStatus";
import { HOME_BY_ROLE } from "../../shell/menus";

export default function AuthCheckPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const api = useApi();
  const router = useRouter();
  const [state, setState] = useState({ title: "Please wait", message: "Verifying your account...", retry: false });
  const [attempt, setAttempt] = useState(0);

  const leave = useCallback(
    async (title, message, delay = 2500) => {
      setState({ title, message, retry: false });
      await signOut();
      setTimeout(() => router.replace("/"), delay);
    },
    [signOut, router]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }
    let cancelled = false;

    api
      .get("/users/me")
      .then((res) => {
        if (cancelled) return;
        const home = HOME_BY_ROLE[res.data?.data?.role];
        if (home) router.replace(home);
        else leave("No access", "Your account does not have a CCTEK role. Please contact the administrator.");
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 403) leave("No access", err.response.data?.message || "You are not registered in CCTEK.", 4000);
        else if (status === 401) leave("Signed out", "Your session has expired. Please sign in again.");
        else setState({ title: "Can't reach CCTEK", message: apiError(err), retry: true });
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, api, router, leave, attempt]);

  return (
    <div>
      <FullPageStatus title={state.title} message={state.message} />
      {state.retry && (
        <div className="-mt-[18vh] flex justify-center gap-2 pb-10">
          <button
            type="button"
            onClick={() => {
              setState({ title: "Please wait", message: "Trying again...", retry: false });
              setAttempt((n) => n + 1);
            }}
            className="cc-btn-primary cc-press px-5 py-2.5 text-sm"
          >
            Try again
          </button>
          <button type="button" onClick={() => leave("Signed out", "Signing you out...", 500)} className="cc-btn cc-press px-5 py-2.5 text-sm">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
