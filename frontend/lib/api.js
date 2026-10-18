"use client";

// One axios client for the CCTEK API. Every request carries a fresh Clerk
// session token (Clerk refreshes it silently, so there is no re-login or OTP).

import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function useApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const client = axios.create({ baseURL: `${BASE}/api`, timeout: 120_000 });
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
  if (!err?.response) return "Cannot reach the server. Check your internet connection.";
  return err.response.data?.message || fallback;
}

// Money comes from the API in paise.
export const formatRupees = (paise) =>
  paise == null
    ? "-"
    : (Number(paise) / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
