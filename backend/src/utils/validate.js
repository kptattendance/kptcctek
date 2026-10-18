// src/utils/validate.js
// Small whitelist validators. Every handler builds its update object ONLY
// from fields listed here, so a request can never set role, createdBy,
// charges, status etc. by adding extra JSON keys (mass assignment).

import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const isObjectId = (v) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

export function objectId(v, name = "id") {
  if (!isObjectId(v)) throw new HttpError(400, `Invalid ${name}.`);
  return v;
}

export function str(v, { name, required = false, max = 200, pattern } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required.`);
    return v === undefined ? undefined : "";
  }
  if (typeof v !== "string" && typeof v !== "number") throw new HttpError(400, `${name} must be text.`);
  const s = String(v).trim();
  if (required && !s) throw new HttpError(400, `${name} is required.`);
  if (s.length > max) throw new HttpError(400, `${name} is too long (max ${max}).`);
  if (pattern && s && !pattern.test(s)) throw new HttpError(400, `${name} is not valid.`);
  return s;
}

export const email = (v, opts = {}) =>
  str(v, { max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, ...opts })?.toLowerCase();

export function oneOf(v, values, { name, required = false } = {}) {
  if (v === undefined || v === "") {
    if (required) throw new HttpError(400, `${name} is required.`);
    return undefined;
  }
  if (!values.includes(v)) throw new HttpError(400, `${name} must be one of: ${values.join(", ")}.`);
  return v;
}

export function bool(v) {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new HttpError(400, "Expected true or false.");
}

// Rupees from the form -> integer paise
export function rupees(v, { name, required = false, max = 1_000_000_000 } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required.`);
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new HttpError(400, `${name} must be a valid amount.`);
  return Math.round(n * 100);
}

export function num(v, { name, min = 0, max = 100_000, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required.`);
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${name} must be between ${min} and ${max}.`);
  return n;
}

export function date(v, { name, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required.`);
    return v === undefined ? undefined : null;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100)
    throw new HttpError(400, `${name} is not a valid date.`);
  return d;
}

// Drop undefined keys so partial updates only touch what was sent.
export const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Safe text search: escape regex metacharacters (prevents ReDoS / injection).
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function paging(query) {
  const page = Math.max(1, Math.min(10_000, parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}
