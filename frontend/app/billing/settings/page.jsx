"use client";

// What is printed on bills: CCTEK's own details, bank, signatory; and each
// party's billing address / GSTIN.

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useApi } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useMe } from "@/lib/useMe";
import { useFetch, can } from "@/lib/billing";
import { Modal } from "@/app/components/projects/dialogs";
import { PageHeader, Card, Field, Button, inputCls, Spinner } from "@/app/components/ui";

const FIELDS = [
  ["orgName", "Name", "ಹೆಸರು"],
  ["orgSubtitle", "Sub-title", "ಉಪಶೀರ್ಷಿಕೆ"],
  ["address", "Address", "ವಿಳಾಸ", "textarea"],
  ["phone", "Phone", "ದೂರವಾಣಿ"],
  ["email", "Email", "ಇಮೇಲ್"],
  ["gstin", "GSTIN", "ಜಿಎಸ್‌ಟಿ ಸಂಖ್ಯೆ"],
  ["pan", "PAN", "ಪ್ಯಾನ್"],
  ["sacCode", "SAC code", "ಎಸ್‌ಎಸಿ"],
  ["accountName", "Account name", "ಖಾತೆ ಹೆಸರು"],
  ["accountNo", "Account no.", "ಖಾತೆ ಸಂಖ್ಯೆ"],
  ["bankName", "Bank", "ಬ್ಯಾಂಕ್"],
  ["bankBranch", "Branch", "ಶಾಖೆ"],
  ["ifsc", "IFSC", "ಐಎಫ್‌ಎಸ್‌ಸಿ"],
  ["billSignatory", "Bill signed by", "ಸಹಿ"],
  ["billNote", "Note printed on the bill", "ಟಿಪ್ಪಣಿ", "textarea"],
];

export default function BillSettingsPage() {
  const { me } = useMe();
  const settings = useFetch("/billing/settings");
  const parties = useFetch("/billing/parties");
  const [editParty, setEditParty] = useState(null);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Bill settings" kn="ಬಿಲ್ ವಿವರಗಳು" sub="Printed on every bill and remuneration statement." />
      {settings.loading && !settings.data ? (
        <Spinner />
      ) : (
        settings.data && <SettingsForm key={settings.data.updatedAt || "new"} initial={settings.data} canEdit={can(me, "settings.manage")} onSaved={settings.reload} />
      )}

      <Card title="Parties" kn="ಸಂಸ್ಥೆಗಳು" bodyClass="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-cc-subtle text-left text-xs text-cc-muted">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name & billing address</th>
              <th className="px-4 py-2">GSTIN</th>
              <th className="px-4 py-2">GST</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(parties.data || []).map((p) => (
              <tr key={p._id} className="border-t border-cc-border align-top">
                <td className="px-4 py-2 font-semibold">{p.code}</td>
                <td className="px-4 py-2">
                  {p.name}
                  <span className={`block whitespace-pre-line text-xs ${p.billingAddress ? "text-cc-muted" : "text-cc-bad"}`}>{p.billingAddress || "Address missing: needed on bills"}</span>
                </td>
                <td className="px-4 py-2">{p.gstin || "—"}</td>
                <td className="px-4 py-2">{p.gstMode === "exclusive" ? "Added on top" : "Included in fee"}</td>
                <td className="px-4 py-2 text-right">
                  {can(me, "parties.manage") && (
                    <button type="button" onClick={() => setEditParty(p)} className="cc-chip cc-press p-2" aria-label={`Edit ${p.code}`}>
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editParty && (
        <PartyDialog
          party={editParty}
          onClose={() => setEditParty(null)}
          onSaved={() => {
            setEditParty(null);
            parties.reload();
          }}
        />
      )}
    </div>
  );
}

function SettingsForm({ initial, canEdit, onSaved }) {
  const api = useApi();
  const [f, setF] = useState(() => ({ ...initial, statementSignatories: (initial.statementSignatories || []).join(", ") }));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const body = Object.fromEntries(FIELDS.map(([k]) => [k, f[k] ?? ""]));
      body.statementSignatories = String(f.statementSignatories || "").split(",").map((s) => s.trim()).filter(Boolean);
      await api.put("/billing/settings", body);
      notifySuccess("Saved.");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="CCTEK details" kn="ಸಿಸಿಟೆಕ್ ವಿವರಗಳು">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, label, kn, type]) => (
          <Field key={k} label={label} kn={kn} className={type === "textarea" ? "sm:col-span-2" : ""}>
            {type === "textarea" ? (
              <textarea value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} rows={2} className={inputCls} />
            ) : (
              <input value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={inputCls} />
            )}
          </Field>
        ))}
        <Field label="Statement signatories (comma separated)" kn="ಪಟ್ಟಿಗೆ ಸಹಿ ಮಾಡುವವರು" className="sm:col-span-2">
          <input value={f.statementSignatories} onChange={(e) => setF((x) => ({ ...x, statementSignatories: e.target.value }))} className={inputCls} />
        </Field>
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button primary busy={busy} onClick={save}>
            Save details
          </Button>
        </div>
      )}
    </Card>
  );
}

function PartyDialog({ party, onClose, onSaved }) {
  const api = useApi();
  const [f, setF] = useState({
    name: party.name || "",
    billingAddress: party.billingAddress || "",
    gstin: party.gstin || "",
    gstMode: party.gstMode || "inclusive",
    contactPerson: party.contactPerson || "",
    contactEmail: party.contactEmail || "",
    contactPhone: party.contactPhone || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal title={`Party · ${party.code}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name" kn="ಹೆಸರು">
          <input value={f.name} onChange={set("name")} className={inputCls} />
        </Field>
        <Field label="Billing address (bill goes to)" kn="ಬಿಲ್ ವಿಳಾಸ" hint="e.g. The Commissioner, Mangaluru City Corporation, Lalbagh, Mangaluru - 575003">
          <textarea value={f.billingAddress} onChange={set("billingAddress")} rows={3} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="GSTIN" kn="ಜಿಎಸ್‌ಟಿ">
            <input value={f.gstin} onChange={set("gstin")} maxLength={15} className={inputCls} />
          </Field>
          <Field label="GST on the fee" kn="ಜಿಎಸ್‌ಟಿ">
            <select value={f.gstMode} onChange={set("gstMode")} className={inputCls}>
              <option value="inclusive">Included in the fee (MCC)</option>
              <option value="exclusive">Added on top</option>
            </select>
          </Field>
          <Field label="Contact person" kn="ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ">
            <input value={f.contactPerson} onChange={set("contactPerson")} className={inputCls} />
          </Field>
          <Field label="Phone" kn="ದೂರವಾಣಿ">
            <input value={f.contactPhone} onChange={set("contactPhone")} className={inputCls} />
          </Field>
          <Field label="Email" kn="ಇಮೇಲ್" className="sm:col-span-2">
            <input type="email" value={f.contactEmail} onChange={set("contactEmail")} className={inputCls} />
          </Field>
        </div>
        <p className="text-xs text-cc-muted">Changing GST mode affects only new applications; bills already made keep their amounts.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Back</Button>
          <Button
            primary
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.put(`/billing/parties/${party._id}`, f);
                notifySuccess("Party saved.");
                onSaved();
              } catch (err) {
                notifyError(err);
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
