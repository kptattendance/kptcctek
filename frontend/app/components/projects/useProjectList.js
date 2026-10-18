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
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const baseKey = JSON.stringify(baseParams);
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
  }, []);
  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);
  const toggleSort = useCallback((key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }, []);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  // switching tab (base params) starts from page 1
  useEffect(() => {
    setPage(1);
  }, [baseKey]);

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
