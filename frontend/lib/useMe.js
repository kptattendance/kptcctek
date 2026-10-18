"use client";

// The signed-in person's CCTEK record (role, name, photo), fetched once per
// Clerk user and shared by every component that asks.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useApi } from "./api";

const cache = new Map(); // clerk userId -> Promise<me>

export function useMe() {
  const api = useApi();
  const { isLoaded, userId } = useAuth();
  const [state, setState] = useState({ me: null, loading: true, error: null });

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    if (!userId) {
      Promise.resolve().then(() => !cancelled && setState({ me: null, loading: false, error: { status: 401 } }));
      return () => {
        cancelled = true;
      };
    }
    if (!cache.has(userId)) {
      cache.set(
        userId,
        api.get("/users/me").then((r) => r.data.data).catch((err) => {
          cache.delete(userId); // retry next time
          throw err;
        })
      );
    }
    cache
      .get(userId)
      .then((me) => !cancelled && setState({ me, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ me: null, loading: false, error: { status: err.response?.status || 0, code: err.response?.data?.code } }));
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, userId]);

  return state;
}

// After an admin changes someone's role, the next page load should re-check.
export const forgetMe = () => cache.clear();
