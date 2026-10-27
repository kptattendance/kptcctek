"use client";

// Server-side filtered / sorted / paged list of applications.
//   const list = useProjectList({ status: "assigned" }, { key: "appDate", dir: "asc" });
//   list.rows, list.loading, list.filters, list.setFilter("ward", "5"), list.toggleSort("bill") ...

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/api";
import { notifyError } from "@/lib/notify";

export const PAGE_SIZE = 25;

export function useProjectList(baseParams, defaultSort = { key: "serialNo", dir: "desc" }) {
  const api = useApi();
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(defaultSort);
  // Page is remembered per tab (base params): switching tab starts at page 1.
  const baseKey = JSON.stringify(baseParams);
  const [pageState, setPageState] = useState({ key: baseKey, page: 1 });
  const page = pageState.key === baseKey ? pageState.page : 1;
  const setPage = useCallback((p) => setPageState({ key: baseKey, page: p }), [baseKey]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const params = useMemo(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v != null));
    return { ...JSON.parse(baseKey), ...clean, sort: sort.key, dir: sort.dir, page, limit: PAGE_SIZE };
  }, [baseKey, filters, sort, page]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/projects", { params });
        if (cancelled) return;
        setRows(res.data.data);
        setTotal(res.data.total);
      } catch (err) {
        if (!cancelled) notifyError(err, { id: "project-list" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [api, params, tick]);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, [setPage]);
  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, [setPage]);
  const toggleSort = useCallback((key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }, [setPage]);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  return {
    rows, total, loading, page, setPage, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    filters, setFilter, clearFilters, hasFilters: Object.values(filters).some((v) => v !== "" && v != null),
    sort, toggleSort, reload,
  };
}

// Party list for filters (cached per page load).
let partiesPromise = null;
export function useParties() {
  const api = useApi();
  const [parties, setParties] = useState([]);
  useEffect(() => {
    partiesPromise ??= api.get("/projects/parties").then((r) => r.data.data).catch((e) => {
      partiesPromise = null;
      throw e;
    });
    let cancelled = false;
    partiesPromise.then((p) => !cancelled && setParties(p)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);
  return parties;
}

// Active funds (ಅನುದಾನ) for dropdowns and filters. `refresh()` after the list
// is edited in Bill settings.
let fundsPromise = null;
export function useFunds() {
  const api = useApi();
  const [funds, setFunds] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    fundsPromise ??= api.get("/projects/funds").then((r) => r.data.data).catch((e) => {
      fundsPromise = null;
      throw e;
    });
    let cancelled = false;
    fundsPromise.then((f) => !cancelled && setFunds(f)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, tick]);
  const refresh = useCallback(() => {
    fundsPromise = null;
    setTick((n) => n + 1);
  }, []);
  return { funds, refresh };
}

// Filter options: every fund plus "no fund".
export const fundOptions = (funds) => [...funds.map((f) => ({ value: f._id, label: f.name })), { value: "none", label: "No fund" }];
