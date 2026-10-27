"use client";

// Office staff: register an incoming application.
//   1. Photograph / upload the letter: its text is read for free in the
//      browser (PDF text layer or Tesseract OCR) and the form fills itself.
//      Pasting text from Google Lens is a fallback for poor photos.
//   2. Check the filled-in details   3. Register
// Nothing is saved until staff press "Register application".

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Upload, FileText, LoaderCircle, CircleCheck, TriangleAlert, RotateCcw, Save, ScanLine, IndianRupee,
  ClipboardPaste, Wand2, Sparkles,
} from "lucide-react";
import { useApi, apiError, formatRupees } from "@/lib/api";
import { notifyError, notifySuccess, notifyInfo, notifyWarning } from "@/lib/notify";
import { parseMccLetter } from "@/lib/parseMccLetter";
import { bestMatches, transliterate } from "@/lib/kannada";
import { readLetterText } from "@/lib/readLetter";
import { matchFund } from "@/lib/billing";
import { useFunds } from "@/app/components/projects/useProjectList";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  partyId: "", appNo: "", appDate: today(), ledgerNo: "", pageNo: "",
  letterRefNo: "", letterDate: "", ward: "", fileNo: "", workYear: "", mbNo: "",
  workType: "civil", appDetails: "", fundId: "", fundSource: "", workStartedOn: "", workCompletedOn: "",
  contractorName: "", contractorOnLetter: "",
  partyEngineer: "", engineerOnLetter: "", partyEngineerDesignation: "", partyEngineerPhone: "",
  estimateAmount: "", projectBillAmount: "", km: "", gstMode: "", lumpsum: false, lumpsumFee: "", remarks: "",
};

// Parser / AI field -> form field (for the amber "check" tags)
const FLAG_MAP = {
  partyCode: "partyId", partyNameAsWritten: "partyId", workDescription: "appDetails", fundSource: "fundId",
  contractorRaw: "contractorName", contractorName: "contractorName",
  engineerRaw: "partyEngineer", engineerName: "partyEngineer", engineerDesignation: "partyEngineerDesignation",
};

const SURE = 0.86; // name-match score above which we fill without a "check" tag

async function shrinkImage(file, maxSide = 2200) {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size < 4.5 * 1024 * 1024) return new File([blob], "letter.jpg", { type: "image/jpeg" });
  }
  throw new Error("The photo is too large. Please retake it.");
}

function Field({ label, kn, flagged, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-wide text-cc-muted">
        {label}
        {kn && <span className="text-[13px] font-semibold normal-case tracking-normal text-cc-text/70">{kn}</span>}
        {flagged && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-900">
            <TriangleAlert size={11} aria-hidden /> check
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cc-muted">{hint}</span>}
    </label>
  );
}

const inputCls = (flagged) =>
  `cc-field w-full px-4 py-3 text-sm text-cc-text outline-none placeholder:text-cc-muted/70 focus-visible:ring-2 focus-visible:ring-cc-primary ${
    flagged ? "ring-2 ring-amber-400" : ""
  }`;

// English name field + what the letter said + matches from the register
function NameField({ label, kn, value, onChange, onLetter, matches, onPick, flagged }) {
  return (
    <Field label={label} kn={kn} flagged={flagged}>
      <input value={value} onChange={onChange} className={inputCls(flagged)} />
      {onLetter && (
        <span className="mt-1.5 block text-xs text-cc-muted">
          On letter / ಪತ್ರದಲ್ಲಿ: <span className="font-semibold text-cc-text">{onLetter}</span>
        </span>
      )}
      {matches.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-2">
          {matches.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => onPick(m.name)}
              className={`cc-chip cc-press px-3 py-1 text-xs font-semibold ${m.name === value ? "text-cc-ok" : "text-cc-text"}`}
            >
              {m.name}
              {m.learned ? " ✓" : ""}
            </button>
          ))}
        </span>
      )}
    </Field>
  );
}

export default function IncomingApplication() {
  const api = useApi();
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  const [parties, setParties] = useState([]);
  const { funds } = useFunds();
  const [directory, setDirectory] = useState({ contractors: [], engineers: [] });
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState("capture"); // capture | reading | review | saved
  const [letterText, setLetterText] = useState("");
  const [scanId, setScanId] = useState(null);
  const [preview, setPreview] = useState(null); // { url, isPdf }
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(""); // OCR progress message
  const [flags, setFlags] = useState(new Set());
  const [notice, setNotice] = useState("");
  const [charges, setCharges] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [duplicate, setDuplicate] = useState(false);
  const [recent, setRecent] = useState([]);

  const setValue = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setFlags((s) => {
      if (!s.has(name)) return s;
      const n = new Set(s);
      n.delete(name); // edited = checked
      return n;
    });
  };
  const set = (name) => (e) => setValue(name, e.target.type === "checkbox" ? e.target.checked : e.target.value);

  const loadDefaults = useCallback(async () => {
    try {
      const [p, n, r, d] = await Promise.all([
        api.get("/projects/parties"),
        api.get("/projects/next-numbers"),
        api.get("/projects", { params: { mine: "true", limit: 5 } }),
        api.get("/projects/directory"),
      ]);
      setParties(p.data.data);
      setDirectory(d.data.data);
      const mcc = p.data.data.find((x) => x.code === "MCC");
      setForm((f) => ({
        ...f,
        partyId: f.partyId || mcc?._id || "",
        ledgerNo: f.ledgerNo || n.data.data.ledgerNo,
        pageNo: f.pageNo || n.data.data.pageNo,
        appNo: f.appNo || n.data.data.appNo,
      }));
      setRecent(r.data.data);
    } catch (err) {
      notifyError(err, { id: "defaults" });
    }
  }, [api]);

  useEffect(() => {
    // Data fetch on mount: state is set after the requests finish, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDefaults();
  }, [loadDefaults]);

  useEffect(() => () => preview?.url && URL.revokeObjectURL(preview.url), [preview]);

  // Next 16 keeps this page alive when you leave. A half-filled entry is kept
  // (so work isn't lost), but a finished one starts fresh on the next visit.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useLayoutEffect(
    () => () => {
      if (stepRef.current !== "saved") return;
      setForm(EMPTY);
      setLetterText("");
      setScanId(null);
      setPreview(null);
      setFlags(new Set());
      setNotice("");
      setCharges(null);
      setSaved(null);
      setStep("capture");
    },
    []
  );

  // ------------------------------------------------------------ names
  const pickName = (raw, list) => {
    const m = bestMatches(raw, list, 1)[0];
    if (m && m.score >= SURE) return { name: m.name, sure: true };
    return { name: /[ಀ-೿]/.test(raw) ? transliterate(raw) : raw, sure: false };
  };

  const contractorMatches = useMemo(
    () => bestMatches(form.contractorOnLetter || form.contractorName, directory.contractors),
    [form.contractorOnLetter, form.contractorName, directory.contractors]
  );
  const engineerMatches = useMemo(
    () => bestMatches(form.engineerOnLetter || form.partyEngineer, directory.engineers),
    [form.engineerOnLetter, form.partyEngineer, directory.engineers]
  );

  // ------------------------------------------------------------ fill from pasted text (free)
  function fillFromText(text = letterText, source = "text") {
    if (text.trim().length < 40) {
      notifyError(source === "ocr" ? "Could not read text from this image. Try a sharper photo, or paste the text." : "Paste the full text of the letter first.");
      return false;
    }
    const x = parseMccLetter(text);
    const flagged = new Set((x.uncertain || []).map((k) => FLAG_MAP[k] || k));
    const party = parties.find((p) => p.code === x.partyCode);
    if (!party) flagged.add("partyId");

    const contractor = x.contractorRaw ? pickName(x.contractorRaw, directory.contractors) : null;
    const engineer = x.engineerRaw ? pickName(x.engineerRaw, directory.engineers) : null;
    if (contractor && !contractor.sure) flagged.add("contractorName");
    if (engineer && !engineer.sure) flagged.add("partyEngineer");
    // the letter names a fund: pick it from the list, or ask staff to choose
    const fund = matchFund(x.fundSource, funds);
    if (x.fundSource && !fund) flagged.add("fundId");

    setForm((f) => ({
      ...f,
      partyId: party?._id || f.partyId,
      letterRefNo: x.letterRefNo || f.letterRefNo,
      ward: x.ward || f.ward,
      fileNo: x.fileNo || f.fileNo,
      workYear: x.workYear || f.workYear,
      workType: x.workType || f.workType,
      appDetails: x.workDescription || f.appDetails,
      fundSource: x.fundSource || f.fundSource,
      fundId: fund?._id || f.fundId,
      workStartedOn: x.workStartedOn || f.workStartedOn,
      workCompletedOn: x.workCompletedOn || f.workCompletedOn,
      estimateAmount: x.estimateAmount != null ? String(x.estimateAmount) : f.estimateAmount,
      projectBillAmount: x.projectBillAmount != null ? String(x.projectBillAmount) : f.projectBillAmount,
      contractorName: contractor?.name || f.contractorName,
      contractorOnLetter: x.contractorRaw || f.contractorOnLetter,
      partyEngineer: engineer?.name || f.partyEngineer,
      engineerOnLetter: x.engineerRaw || f.engineerOnLetter,
      partyEngineerDesignation: x.engineerDesignation || f.partyEngineerDesignation,
      partyEngineerPhone: x.engineerPhone || f.partyEngineerPhone,
    }));
    setFlags(flagged);
    const how = source === "pdf-text" ? "Read from the PDF." : source === "ocr" ? "Read from the photo." : "Filled from the letter text.";
    const msg = flagged.size ? `${how} Fields marked “check” need a look.` : `${how} Please check before registering.`;
    setNotice(msg);
    (flagged.size ? notifyWarning : notifyInfo)(msg, { id: "filled" });
    setStep("review");
    return true;
  }

  // ------------------------------------------------------------ attach photo (optional AI reading)
  async function handleFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const fromCapture = step === "capture";
    try {
      const file = await shrinkImage(picked);
      setPreview({ url: URL.createObjectURL(file), isPdf: file.type === "application/pdf" });
      setUploading(true);
      setReading("Reading the letter…");
      if (fromCapture) setStep("reading");

      // Store the scan on the server and read its text here, at the same time.
      const body = new FormData();
      body.append("file", file);
      const upload = api.post("/projects/scan", body);
      const local = readLetterText(picked, (m) => {
        if (m.status === "recognizing text") setReading(`Reading the letter… ${Math.round(m.progress * 100)}%`);
        else if (/load|initializ/i.test(m.status)) setReading("Preparing the Kannada reader (first time only)…");
      }).catch(() => null);

      const [up, read] = await Promise.all([upload.then((r) => ({ ok: r }), (err) => ({ err })), local]);
      // A failed upload only loses the stored copy; the details can still be filled.
      if (up.err && !read?.text) throw up.err;
      setScanId(up.ok?.data.data?.scanId || null);

      if (read?.text) {
        setLetterText(read.text);
        if (!fillFromText(read.text, read.method)) setStep("review");
        if (up.err) notifyWarning(`The details were read, but the copy of the scan was not saved: ${apiError(up.err)}`);
      } else {
        setNotice("Photo attached, but its text could not be read. Paste the text from Google Lens, or type the details.");
        notifyWarning("The text of this photo could not be read. Paste it from Google Lens, or type the details.");
        setStep("review");
      }
    } catch (err) {
      notifyError(err);
      if (fromCapture) setStep("capture");
    } finally {
      setUploading(false);
      setReading("");
    }
  }

  // ------------------------------------------------------------ live fee
  const feeInput = useMemo(
    () => ({
      projectBillAmount: form.projectBillAmount,
      km: form.km,
      partyId: form.partyId,
      gstMode: form.gstMode || undefined,
      lumpsumFee: form.lumpsum ? form.lumpsumFee : undefined,
      appDate: form.appDate,
    }),
    [form.projectBillAmount, form.km, form.partyId, form.gstMode, form.lumpsum, form.lumpsumFee, form.appDate]
  );

  useEffect(() => {
    if (!(Number(feeInput.projectBillAmount) > 0)) return; // nothing to price; see shownCharges
    const t = setTimeout(async () => {
      try {
        const res = await api.post("/projects/preview-charges", feeInput);
        setCharges(res.data.data);
      } catch (err) {
        setCharges(null);
        notifyError(err, { id: "fee" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [api, feeInput]);

  // ------------------------------------------------------------ save
  async function save(e, force = false) {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, scanId, confirmDuplicate: force || duplicate || undefined };
      if (!form.lumpsum) delete payload.lumpsumFee;
      if (!form.gstMode) delete payload.gstMode;
      delete payload.lumpsum;
      const res = await api.post("/projects", payload);
      setSaved(res.data.data);
      setStep("saved");
      setDuplicate(false);
      notifySuccess(`Registered as Sl. No. ${res.data.data.serialNo}`);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.details?.duplicateOf) {
        setDuplicate(true);
        notifyWarning(apiError(err), {
          id: "duplicate",
          duration: 15000,
          action: { label: "Register anyway", onClick: () => save(null, true) },
        });
      } else {
        notifyError(err, { id: "save" });
      }
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(EMPTY);
    setLetterText("");
    setScanId(null);
    setPreview(null);
    setFlags(new Set());
    setNotice("");
    setCharges(null);
    setSaved(null);
    setDuplicate(false);
    setStep("capture");
    loadDefaults();
  }

  const party = parties.find((p) => p._id === form.partyId);
  const shownCharges = Number(form.projectBillAmount) > 0 ? charges : null;

  const pasteBox = (
    <div className="space-y-3">
      <textarea
        value={letterText}
        onChange={(e) => setLetterText(e.target.value)}
        rows={8}
        placeholder="Paste the letter text here…"
        className="cc-field w-full p-4 text-sm leading-6 text-cc-text outline-none focus-visible:ring-2 focus-visible:ring-cc-primary"
      />
      <button type="button" onClick={() => fillFromText()} className="cc-btn-primary cc-press flex w-full items-center justify-center gap-2 px-5 py-3 text-sm">
        <Wand2 size={18} aria-hidden /> Fill the form
      </button>
    </div>
  );

  // ------------------------------------------------------------ render
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-cc-text">Incoming application</h1>
        <p className="mt-1 text-sm text-cc-muted">
          ಒಳಬಂದ ಅರ್ಜಿ · Scan the letter, check the details, register.
        </p>
      </header>


      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFile} />

      {step === "capture" && (
        <section className="space-y-6">
          <div className="cc-card p-6 sm:p-10">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto flex h-20 w-20 bg-cc-primary-soft items-center justify-center rounded-full text-cc-primary">
                <ScanLine size={36} aria-hidden />
              </div>
              <h2 className="mt-5 text-lg font-bold text-cc-text">Scan the letter · ಪತ್ರವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ</h2>
              <p className="mt-2 text-sm text-cc-muted">
                Take a photo or upload the PDF. The details are read and filled in for you to check. Free, and the letter is read on this device.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="cc-btn-primary cc-press flex items-center justify-center gap-2 px-5 py-3.5 text-sm">
                  <Camera size={18} aria-hidden /> Take photo
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="cc-chip cc-press flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-cc-text">
                  <Upload size={18} aria-hidden /> Upload photo / PDF
                </button>
              </div>
              <p className="mt-4 text-xs text-cc-muted">Tip: lay the sheet flat in good light, whole page in the frame, no shadows.</p>
              <button type="button" onClick={() => setStep("review")} className="mt-5 text-sm font-semibold text-cc-muted underline underline-offset-4 hover:text-cc-text">
                Enter details by hand
              </button>
            </div>
          </div>

          <details className="cc-card p-5">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-cc-text">
              <ClipboardPaste size={16} aria-hidden /> Photo hard to read? Paste the text from Google Lens instead
            </summary>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-cc-muted">
              <li>Google Lens → <span className="font-semibold text-cc-text">Text</span> → <span className="font-semibold text-cc-text">Select all</span> → <span className="font-semibold text-cc-text">Copy</span></li>
              <li>Paste below and press <span className="font-semibold text-cc-text">Fill the form</span></li>
            </ol>
            <div className="mt-3">{pasteBox}</div>
          </details>
        </section>
      )}

      {step === "reading" && (
        <section className="cc-card flex flex-col items-center gap-4 p-10 text-center" aria-live="polite">
          <LoaderCircle size={36} className="animate-spin text-cc-primary" aria-hidden />
          <p className="font-semibold text-cc-text">{reading || "Uploading the letter…"}</p>
          <p className="text-sm text-cc-muted">Usually 5–15 seconds.</p>
        </section>
      )}

      {step === "saved" && saved && (
        <section className="cc-card p-8 text-center" aria-live="polite">
          <CircleCheck size={44} className="mx-auto text-cc-ok" aria-hidden />
          <h2 className="mt-4 text-xl font-extrabold text-cc-text">Registered as Sl. No. {saved.serialNo}</h2>
          <p className="mt-2 text-sm text-cc-muted">
            Application {saved.appNo} · {saved.financialYear} · CCTEK fee {formatRupees(saved.charges?.invoiceTotal)}
          </p>
          <button type="button" onClick={reset} className="cc-btn-primary cc-press mx-auto mt-7 flex items-center gap-2 px-6 py-3.5 text-sm">
            <ScanLine size={18} aria-hidden /> Next letter
          </button>
        </section>
      )}

      {step === "review" && (
        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* left: letter + fee */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="cc-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-cc-text">Scan · ಸ್ಕ್ಯಾನ್ ಪ್ರತಿ</h2>
                <button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className="cc-chip cc-press flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cc-text disabled:opacity-60">
                  {uploading ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : preview ? <RotateCcw size={14} aria-hidden /> : <Camera size={14} aria-hidden />}
                  {preview ? "Retake" : "Attach photo"}
                </button>
              </div>
              {preview ? (
                preview.isPdf ? (
                  <iframe title="Scanned letter" src={preview.url} className="cc-field h-[360px] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.url} alt="Scanned letter" className="cc-field max-h-[460px] w-full object-contain p-2" />
                )
              ) : (
                <div className="cc-field flex h-24 items-center justify-center gap-2 text-sm text-cc-muted">
                  <FileText size={18} aria-hidden /> No scan attached
                </div>
              )}
              {notice && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{notice}</p>}
            </section>

            <details className="cc-card p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-cc-text">
                <Sparkles size={16} aria-hidden /> {letterText ? "Text read from the letter (edit and fill again)" : "Fill from letter text (Google Lens)"}
              </summary>
              <div className="mt-3">{pasteBox}</div>
            </details>

            <section className="cc-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-cc-text">
                <IndianRupee size={16} aria-hidden /> CCTEK fee · ಸಿಸಿಟೆಕ್ ಶುಲ್ಕ
              </h2>
              {shownCharges ? (
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ["Service charge", shownCharges.lumpsum ? "Lumpsum" : `${shownCharges.servicePercent}% of bill`],
                    ["Fee", formatRupees(shownCharges.net)],
                    [`GST 18% (${shownCharges.gstMode})`, formatRupees(shownCharges.gst)],
                    ["Party pays", formatRupees(shownCharges.invoiceTotal)],
                    ["TA", formatRupees(shownCharges.ta)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-cc-muted">{k}</dt>
                      <dd className="font-semibold tabular-nums text-cc-text">{v}</dd>
                    </div>
                  ))}
                  <div className="cc-field mt-3 grid grid-cols-2 gap-2 p-3 text-xs">
                    <span className="text-cc-muted">Inspectors 45%</span><span className="text-right tabular-nums">{formatRupees(shownCharges.shares?.inspectors)}</span>
                    <span className="text-cc-muted">Support 10%</span><span className="text-right tabular-nums">{formatRupees(shownCharges.shares?.support)}</span>
                    <span className="text-cc-muted">Admin & infra 25%</span><span className="text-right tabular-nums">{formatRupees(shownCharges.shares?.admin_infra)}</span>
                    <span className="text-cc-muted">Profit 20%</span><span className="text-right tabular-nums">{formatRupees(shownCharges.shares?.profit)}</span>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-cc-muted">Enter the bill amount to see the fee.</p>
              )}
            </section>
          </div>

          {/* right: details */}
          <div className="space-y-6">
            <section className="cc-card space-y-5 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-cc-text">From · ಕಳುಹಿಸಿದವರು</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Party" kn="ಕಳುಹಿಸಿದ ಸಂಸ್ಥೆ" flagged={flags.has("partyId")}>
                  <select required value={form.partyId} onChange={set("partyId")} className={inputCls(flags.has("partyId"))}>
                    <option value="">Choose…</option>
                    {parties.map((p) => (
                      <option key={p._id} value={p._id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Letter ref. no." kn="ಪತ್ರ ಸಂಖ್ಯೆ" flagged={flags.has("letterRefNo")}>
                  <input value={form.letterRefNo} onChange={set("letterRefNo")} className={inputCls(flags.has("letterRefNo"))} />
                </Field>
                <NameField
                  label="Engineer" kn="ಅಭಿಯಂತರರ ಹೆಸರು"
                  value={form.partyEngineer}
                  onChange={set("partyEngineer")}
                  onLetter={form.engineerOnLetter}
                  matches={engineerMatches}
                  onPick={(n) => setValue("partyEngineer", n)}
                  flagged={flags.has("partyEngineer")}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Designation" kn="ಹುದ್ದೆ" flagged={flags.has("partyEngineerDesignation")}>
                    <input value={form.partyEngineerDesignation} onChange={set("partyEngineerDesignation")} placeholder="Assistant Engineer" className={inputCls(flags.has("partyEngineerDesignation"))} />
                  </Field>
                  <Field label="Engineer mobile" kn="ಮೊಬೈಲ್ ನಂ.">
                    <input type="tel" inputMode="tel" value={form.partyEngineerPhone} onChange={set("partyEngineerPhone")} className={inputCls(false)} />
                  </Field>
                </div>
                <Field label="Letter date" kn="ಪತ್ರದ ದಿನಾಂಕ" flagged={flags.has("letterDate")}>
                  <input type="date" value={form.letterDate} onChange={set("letterDate")} className={inputCls(flags.has("letterDate"))} />
                </Field>
              </div>
            </section>

            <section className="cc-card space-y-5 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-cc-text">Work · ಕಾಮಗಾರಿ</h2>
              <Field label="Name of work" kn="ಕಾಮಗಾರಿಯ ಹೆಸರು" flagged={flags.has("appDetails")}>
                <textarea rows={3} value={form.appDetails} onChange={set("appDetails")} className={inputCls(flags.has("appDetails"))} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <NameField
                  label="Contractor" kn="ಗುತ್ತಿಗೆದಾರರ ಹೆಸರು"
                  value={form.contractorName}
                  onChange={set("contractorName")}
                  onLetter={form.contractorOnLetter}
                  matches={contractorMatches}
                  onPick={(n) => setValue("contractorName", n)}
                  flagged={flags.has("contractorName")}
                />
                <Field label="Type of work" kn="ಕಾಮಗಾರಿಯ ವಿಧ">
                  <select value={form.workType} onChange={set("workType")} className={inputCls(false)}>
                    <option value="civil">Civil</option>
                    <option value="electrical">Electrical</option>
                    <option value="mechanical">Mechanical</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Ward" kn="ವಾರ್ಡ್ ನಂ." flagged={flags.has("ward")}>
                  <input value={form.ward} onChange={set("ward")} inputMode="numeric" className={inputCls(flags.has("ward"))} />
                </Field>
                <Field
                  label="Fund"
                  kn="ಅನುದಾನ"
                  flagged={flags.has("fundId")}
                  hint={form.fundId && form.fundSource ? `On the letter: ${form.fundSource}` : "Bills are grouped by fund for one cheque."}
                >
                  <select value={form.fundId} onChange={set("fundId")} className={inputCls(flags.has("fundId"))}>
                    <option value="">{funds.length ? "Choose the fund…" : "Loading funds…"}</option>
                    {funds.map((f) => (
                      <option key={f._id} value={f._id}>{f.name}{f.nameEn ? ` · ${f.nameEn}` : ""}</option>
                    ))}
                  </select>
                  {!form.fundId && (
                    <input
                      value={form.fundSource}
                      onChange={set("fundSource")}
                      placeholder="Not in the list? Type it as on the letter"
                      aria-label="Fund as written on the letter"
                      className={`${inputCls(false)} mt-2`}
                    />
                  )}
                </Field>
                <Field label="File / work order no." kn="ಅ.ಪ. ನಂಬ್ರ" flagged={flags.has("fileNo")}>
                  <input value={form.fileNo} onChange={set("fileNo")} className={inputCls(flags.has("fileNo"))} />
                </Field>
                <Field label="Work order year" kn="ಕಾರ್ಯಾದೇಶ ವರ್ಷ" flagged={flags.has("workYear")}>
                  <input value={form.workYear} onChange={set("workYear")} placeholder="2025-2026" className={inputCls(flags.has("workYear"))} />
                </Field>
                <Field label="Work started" kn="ಪ್ರಾರಂಭಿಸಿದ ದಿನಾಂಕ" flagged={flags.has("workStartedOn")}>
                  <input type="date" value={form.workStartedOn} onChange={set("workStartedOn")} className={inputCls(flags.has("workStartedOn"))} />
                </Field>
                <Field label="Work completed" kn="ಪೂರ್ಣಗೊಂಡ ದಿನಾಂಕ" flagged={flags.has("workCompletedOn")}>
                  <input type="date" value={form.workCompletedOn} onChange={set("workCompletedOn")} className={inputCls(flags.has("workCompletedOn"))} />
                </Field>
                <Field label="Estimate (₹)" kn="ಅಂದಾಜು ಮೊತ್ತ" flagged={flags.has("estimateAmount")}>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={form.estimateAmount} onChange={set("estimateAmount")} className={inputCls(flags.has("estimateAmount"))} />
                </Field>
                <Field label="Bill amount (₹)" kn="ಬಿಲ್ಲಿನ ಮೊತ್ತ" flagged={flags.has("projectBillAmount")} hint="The CCTEK fee is calculated on this amount">
                  <input required type="number" min="0" step="0.01" inputMode="decimal" value={form.projectBillAmount} onChange={set("projectBillAmount")} className={inputCls(flags.has("projectBillAmount"))} />
                </Field>
                <Field label="MB no." kn="ಅಳತೆ ಪುಸ್ತಕ ಸಂಖ್ಯೆ">
                  <input value={form.mbNo} onChange={set("mbNo")} className={inputCls(false)} />
                </Field>
                <Field label="Distance (km)" kn="ದೂರ (ಕಿ.ಮೀ)" hint="TA is ₹15 per km">
                  <input type="number" min="0" inputMode="numeric" value={form.km} onChange={set("km")} className={inputCls(false)} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="GST" kn="ಜಿ.ಎಸ್.ಟಿ" hint={party ? `Default for ${party.code}: ${party.gstMode}` : undefined}>
                  <select value={form.gstMode} onChange={set("gstMode")} className={inputCls(false)}>
                    <option value="">Party default</option>
                    <option value="inclusive">Included in fee</option>
                    <option value="exclusive">Added on top</option>
                  </select>
                </Field>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cc-muted">
                    <input type="checkbox" checked={form.lumpsum} onChange={set("lumpsum")} className="h-4 w-4 accent-amber-600" /> Lumpsum fee
                    <span className="text-[13px] font-semibold normal-case tracking-normal text-cc-text/70">ಒಟ್ಟು ಮೊತ್ತದ ಶುಲ್ಕ</span>
                  </label>
                  {form.lumpsum && (
                    <input type="number" min="0" step="0.01" required value={form.lumpsumFee} onChange={set("lumpsumFee")} placeholder="Fee in ₹" className={inputCls(false)} />
                  )}
                </div>
              </div>
            </section>

            <section className="cc-card space-y-5 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-cc-text">Register entry · ನೋಂದಣಿ ವಿವರ</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="App no." kn="ಅರ್ಜಿ ಸಂಖ್ಯೆ">
                  <input required value={form.appNo} onChange={set("appNo")} className={inputCls(false)} />
                </Field>
                <Field label="App date" kn="ಅರ್ಜಿ ದಿನಾಂಕ">
                  <input required type="date" value={form.appDate} onChange={set("appDate")} className={inputCls(false)} />
                </Field>
                <Field label="Ledger no." kn="ಲೆಡ್ಜರ್ ಸಂಖ್ಯೆ">
                  <input value={form.ledgerNo} onChange={set("ledgerNo")} className={inputCls(false)} />
                </Field>
                <Field label="Page no." kn="ಪುಟ ಸಂಖ್ಯೆ">
                  <input value={form.pageNo} onChange={set("pageNo")} className={inputCls(false)} />
                </Field>
              </div>
              <Field label="Remarks" kn="ಷರಾ">
                <input value={form.remarks} onChange={set("remarks")} className={inputCls(false)} />
              </Field>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={reset} className="cc-chip cc-press px-6 py-3.5 text-sm font-semibold text-cc-text">
                Cancel
              </button>
              <button type="submit" disabled={saving || uploading} className="cc-btn-primary cc-press flex items-center justify-center gap-2 px-6 py-3.5 text-sm disabled:opacity-60">
                {saving ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
                {duplicate ? "Register anyway" : "Register application"}
              </button>
            </div>
          </div>
        </form>
      )}

      {recent.length > 0 && step !== "reading" && (
        <section className="cc-card p-5">
          <h2 className="mb-3 text-sm font-bold text-cc-text">Registered by you recently</h2>
          <ul className="divide-y divide-black/5">
            {recent.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">Sl. {p.serialNo}</span>
                  <span className="text-cc-muted"> · App {p.appNo} · {p.party?.code} · {p.contractorName || "—"}</span>
                </span>
                <span className="shrink-0 tabular-nums text-cc-muted">{formatRupees(p.projectBillAmount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
