"use client";

// Add / edit a CCTEK user. Saving creates (or updates) the Clerk login,
// the MongoDB record and the profile photo together.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, LoaderCircle, Save, Trash2, Info } from "lucide-react";
import { useApi } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import Avatar from "./Avatar";

const EMPTY = { name: "", email: "", phone: "", role: "faculty", department: "", designation: "", pan: "" };
const MAX_PHOTO = 3 * 1024 * 1024;

const inputCls =
  "cc-field w-full px-4 py-3 text-sm text-cc-text outline-none placeholder:text-cc-muted/70 focus-visible:ring-2 focus-visible:ring-cc-primary disabled:opacity-60";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-cc-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cc-muted">{hint}</span>}
    </label>
  );
}

export default function UserForm({ userId }) {
  const editing = Boolean(userId);
  const api = useApi();
  const router = useRouter();
  const photoRef = useRef(null);

  const [options, setOptions] = useState({ roles: [], departments: [], designations: [] });
  const [form, setForm] = useState(EMPTY);
  const [isActive, setIsActive] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [photo, setPhoto] = useState(null); // { file, url }
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Next 16 (cacheComponents) keeps this page alive after you leave it and
  // shows the same state when you come back. Start clean every time.
  function resetState() {
    setForm(EMPTY);
    setIsActive(true);
    setCurrentPhoto("");
    setPhoto(null);
    setRemovePhoto(false);
    setSaving(false);
    setLoading(true);
  }

  // Cleanup runs when the page is hidden (navigating away), so the next
  // visit to "Add user" is empty and "Edit" reloads fresh data.
  useLayoutEffect(() => () => resetState(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [o, u] = await Promise.all([api.get("/users/options"), editing ? api.get(`/users/${userId}`) : null]);
        setOptions(o.data.data);
        if (u) {
          const d = u.data.data;
          setForm({
            name: d.name || "", email: d.email || "", phone: d.phone || "", role: d.role,
            department: d.department || "", designation: d.designation || "", pan: d.pan || "",
          });
          setIsActive(d.isActive !== false);
          setCurrentPhoto(d.imageUrl || "");
        }
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [api, editing, userId]);

  useEffect(() => () => photo?.url && URL.revokeObjectURL(photo.url), [photo]);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return notifyError("Photo must be a JPG, PNG or WEBP image.");
    if (file.size > MAX_PHOTO) return notifyError("Photo must be smaller than 3 MB.");
    setRemovePhoto(false);
    setPhoto({ file, url: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    setPhoto(null);
    if (currentPhoto) setRemovePhoto(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (editing && k === "email") return; // email is the login; not editable
        body.append(k, v.trim());
      });
      if (editing) body.append("isActive", String(isActive));
      if (photo) body.append("photo", photo.file);
      else if (removePhoto) body.append("removePhoto", "true");

      if (editing) await api.patch(`/users/${userId}`, body);
      else await api.post("/users", body);
      notifySuccess(editing ? `${form.name} updated` : `${form.name} added. They can now sign in with Google.`);
      resetState();
      router.push("/admin/users");
    } catch (err) {
      notifyError(err);
      setSaving(false);
    }
  }

  const shownPhoto = photo?.url || (removePhoto ? "" : currentPhoto);

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <LoaderCircle className="animate-spin text-cc-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-cc-muted hover:text-cc-text">
        <ArrowLeft size={16} aria-hidden /> All users
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold text-cc-text">{editing ? "Edit user" : "Add user"}</h1>
        <p className="mt-1 text-sm text-cc-muted">
          {editing
            ? "Changes are saved to CCTEK and to the person's Clerk login."
            : "Creates the person's Clerk login and CCTEK record. They sign in with Google using this email; no password or OTP."}
        </p>
      </header>


      <form onSubmit={submit} className="space-y-6">
        <section className="cc-card flex flex-col items-center gap-5 p-6 sm:flex-row">
          <Avatar name={form.name} src={shownPhoto} size={104} />
          <div className="text-center sm:text-left">
            <h2 className="text-sm font-bold text-cc-text">Profile photo</h2>
            <p className="mt-1 text-xs text-cc-muted">JPG, PNG or WEBP, up to 3 MB. Cropped to a square around the face.</p>
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
            <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
              <button type="button" onClick={() => photoRef.current?.click()} className="cc-chip cc-press flex items-center gap-2 px-4 py-2 text-sm font-semibold text-cc-text">
                <Camera size={16} aria-hidden /> {shownPhoto ? "Change photo" : "Add photo"}
              </button>
              {shownPhoto && (
                <button type="button" onClick={clearPhoto} className="cc-chip cc-press flex items-center gap-2 px-4 py-2 text-sm font-semibold text-cc-bad">
                  <Trash2 size={16} aria-hidden /> Remove
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="cc-card grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Full name">
            <input required maxLength={120} value={form.name} onChange={set("name")} className={inputCls} />
          </Field>
          <Field label="Google email" hint={editing ? "The login email can't be changed. Add a new user instead." : "The Gmail / Google Workspace address they sign in with."}>
            <input required type="email" disabled={editing} value={form.email} onChange={set("email")} className={inputCls} />
          </Field>
          <Field label="Mobile">
            <input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="98450 12345" className={inputCls} />
          </Field>
          <Field label="PAN" hint="For remuneration and TDS statements">
            <input maxLength={10} value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" className={inputCls} />
          </Field>
        </section>

        <section className="cc-card grid gap-5 p-6 sm:grid-cols-3">
          <Field label="Role">
            <select required value={form.role} onChange={set("role")} className={inputCls}>
              {options.roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select value={form.department} onChange={set("department")} className={inputCls}>
              <option value="">None</option>
              {options.departments.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Designation">
            <select value={form.designation} onChange={set("designation")} className={inputCls}>
              <option value="">None</option>
              {options.designations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          {editing && (
            <label className="flex items-center gap-3 sm:col-span-3">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-amber-600" />
              <span className="text-sm font-semibold text-cc-text">Active</span>
              <span className="text-xs text-cc-muted">Unticking blocks sign-in immediately (also banned in Clerk).</span>
            </label>
          )}
        </section>

        <p className="flex items-start gap-2 text-xs text-cc-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          Permissions come from the role here, not from Clerk. Changing the role takes effect on the person&apos;s next action.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/admin/users" className="cc-chip cc-press px-6 py-3.5 text-center text-sm font-semibold text-cc-text">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="cc-btn-primary cc-press flex items-center justify-center gap-2 px-6 py-3.5 text-sm disabled:opacity-60">
            {saving ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
            {editing ? "Save changes" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
