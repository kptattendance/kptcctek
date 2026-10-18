"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, Search, Pencil, Trash2, LoaderCircle, Power, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import Avatar from "@/app/components/users/Avatar";

const PAGE = 25;

export default function UsersPage() {
  const api = useApi();
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // user to delete

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users", { params: { q: q || undefined, role: role || undefined, active: active || undefined, page, limit: PAGE } });
      setItems(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      notifyError(err, { id: "users" });
    } finally {
      setLoading(false);
    }
  }, [api, q, role, active, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get("/users/options").then((r) => setRoles(r.data.data.roles)).catch(() => {});
  }, [api]);

  async function toggleActive(u) {
    setBusyId(u._id);
    try {
      const body = new FormData();
      body.append("isActive", String(u.isActive === false));
      await api.patch(`/users/${u._id}`, body);
      notifySuccess(u.isActive === false ? `${u.name} activated` : `${u.name} deactivated. They can no longer sign in.`);
      await load();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete() {
    setBusyId(confirm._id);
    try {
      const res = await api.delete(`/users/${confirm._id}`);
      notifySuccess(res.data.message || `${confirm.name} deleted`);
      setConfirm(null);
      await load();
    } catch (err) {
      notifyError(err, { duration: 12000 });
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const selectCls = "neu-inset px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-neu-accent";

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-neu-text">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Users & staff</h1>
          <p className="mt-1 text-sm text-neu-muted">{total} people</p>
        </div>
        <Link href="/admin/users/new" className="neu-primary neu-press flex items-center justify-center gap-2 px-5 py-3 text-sm">
          <UserPlus size={18} aria-hidden /> Add user
        </Link>
      </header>

      <section className="neu-raised grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <label className="neu-inset flex items-center gap-2 px-4 py-3">
          <Search size={16} className="text-neu-muted" aria-hidden />
          <span className="sr-only">Search</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name or email" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select aria-label="Status" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </section>


      <section className="neu-raised p-2">
        {loading ? (
          <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-neu-accent" aria-label="Loading" /></div>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-neu-muted">No users found.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {items.map((u) => {
              const inactive = u.isActive === false;
              return (
                <li key={u._id} className={`flex flex-wrap items-center gap-4 px-4 py-3 ${inactive ? "opacity-60" : ""}`}>
                  <Avatar name={u.name} src={u.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-sm text-neu-muted">{u.email}{u.designation ? ` · ${u.designation}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{u.roleLabel}</span>
                    {inactive ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-900">Inactive</span>
                    ) : u.linked ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">Active</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-800" title="Has not signed in yet">Not signed in yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${u._id}/edit`} aria-label={`Edit ${u.name}`} className="neu-raised-sm neu-press p-2.5"><Pencil size={16} /></Link>
                    <button type="button" onClick={() => toggleActive(u)} disabled={busyId === u._id} aria-label={inactive ? `Activate ${u.name}` : `Deactivate ${u.name}`} title={inactive ? "Activate" : "Deactivate"} className={`neu-raised-sm neu-press p-2.5 ${inactive ? "text-neu-ok" : "text-neu-warn"}`}>
                      {busyId === u._id ? <LoaderCircle size={16} className="animate-spin" /> : <Power size={16} />}
                    </button>
                    <button type="button" onClick={() => { setDeleteError(""); setConfirm(u); }} aria-label={`Delete ${u.name}`} className="neu-raised-sm neu-press p-2.5 text-neu-bad"><Trash2 size={16} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="neu-raised-sm neu-press px-4 py-2 font-semibold disabled:opacity-40">Previous</button>
          <span className="text-neu-muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="neu-raised-sm neu-press px-4 py-2 font-semibold disabled:opacity-40">Next</button>
        </div>
      )}

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="neu-raised w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="del-title" className="text-lg font-extrabold">Delete {confirm.name}?</h2>
              <button type="button" onClick={() => setConfirm(null)} aria-label="Close" className="text-neu-muted"><X size={18} /></button>
            </div>
            <p className="mt-3 text-sm text-neu-muted">
              This removes their CCTEK record, their Clerk login and their photo. It can&apos;t be undone.
              People with work records can only be deactivated.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirm(null)} className="neu-raised-sm neu-press px-5 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={doDelete} disabled={busyId === confirm._id} className="neu-raised-sm neu-press flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-neu-bad disabled:opacity-60">
                {busyId === confirm._id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
