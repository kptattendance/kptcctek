"use client";

// One axios client for the CCTEK API. Every request carries a fresh Clerk
// session token (Clerk refreshes it silently, so there is no re-login or OTP).

import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

// NEXT_PUBLIC_API_URL is the backend's address WITHOUT /api, e.g.
//   http://localhost:5000                  (your computer)
//   https://kptcctek-backend.vercel.app    (Vercel)
// It is baked in when the site is built, so after changing it on Vercel
// the frontend must be redeployed.
//
// On an https page the browser blocks any http:// call ("Mixed Content"),
// so a non-local http:// address is upgraded to https:// here. A trailing
// "/api" is removed so it is never doubled.
export function apiOrigin() {
  let base = String(process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
  if (typeof window !== "undefined" && window.location.protocol === "https:" && base.startsWith("http://") && !local) {
    base = `https://${base.slice("http://".length)}`;
  }
  return base;
}

let warned = false;
function checkConfig(origin) {
  if (warned || typeof window === "undefined") return;
  warned = true;
  if (!origin) console.error("CCTEK: NEXT_PUBLIC_API_URL is not set, so the app cannot reach the backend.");
  else if (origin === window.location.origin)
    console.error(`CCTEK: NEXT_PUBLIC_API_URL (${origin}) is this website's own address. It must be the BACKEND's address.`);
}

export function useApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const origin = apiOrigin();
    checkConfig(origin);
    const client = axios.create({ baseURL: `${origin}/api`, timeout: 120_000 });
    client.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }, [getToken]);
}

// Readable message from any axios error
export function apiError(err, fallback = "Something went wrong. Please try again.") {
  if (err?.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
  if (!err?.response) return "Cannot reach the CCTEK server. Check your internet connection, or tell the administrator if this keeps happening.";
  return err.response.data?.message || fallback;
}

// Money comes from the API in paise.
export const formatRupees = (paise) =>
  paise == null
    ? "-"
    : (Number(paise) / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
