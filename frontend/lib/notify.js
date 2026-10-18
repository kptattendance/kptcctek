"use client";

// Popup messages for the whole app (Sonner). Errors stay until closed or
// 8 s, so nobody misses why something didn't save.
//   notifyError(err)                 axios error or plain text
//   notifySuccess("User added")
//   notifyError(err, { id: "fee" })  same id = replace, not stack

import { toast } from "sonner";
import { apiError } from "./api";

export function notifyError(err, options = {}) {
  const message = typeof err === "string" ? err : err?.response || err?.code ? apiError(err) : err?.message || apiError(err);
  toast.error(message, { duration: 8000, ...options });
  return message;
}

export const notifySuccess = (message, options = {}) => toast.success(message, { duration: 4000, ...options });
export const notifyInfo = (message, options = {}) => toast.info(message, { duration: 5000, ...options });
export const notifyWarning = (message, options = {}) => toast.warning(message, { duration: 7000, ...options });
