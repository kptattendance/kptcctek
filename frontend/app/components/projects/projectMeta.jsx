// Shared labels and small helpers for application (project) tables.

export const STATUS = {
  received: { label: "Received", kn: "ಸ್ವೀಕರಿಸಲಾಗಿದೆ", cls: "bg-sky-100 text-sky-900" },
  assigned: { label: "Assigned", kn: "ನಿಯೋಜಿಸಲಾಗಿದೆ", cls: "bg-violet-100 text-violet-900" },
  inspected: { label: "Inspected", kn: "ತಪಾಸಣೆ ಆಗಿದೆ", cls: "bg-indigo-100 text-indigo-900" },
  report_issued: { label: "Report issued", kn: "ವರದಿ ನೀಡಲಾಗಿದೆ", cls: "bg-teal-100 text-teal-900" },
  billed: { label: "Billed", kn: "ಬಿಲ್ ಆಗಿದೆ", cls: "bg-amber-100 text-amber-900" },
  paid: { label: "Paid", kn: "ಪಾವತಿಯಾಗಿದೆ", cls: "bg-emerald-100 text-emerald-900" },
  on_hold: { label: "On hold", kn: "ತಡೆಹಿಡಿಯಲಾಗಿದೆ", cls: "bg-orange-100 text-orange-900" },
  cancelled: { label: "Cancelled", kn: "ರದ್ದು", cls: "bg-red-100 text-red-900" },
};

export const WORK_TYPES = [
  { value: "civil", label: "Civil", kn: "ಸಿವಿಲ್" },
  { value: "electrical", label: "Electrical", kn: "ವಿದ್ಯುತ್" },
  { value: "mechanical", label: "Mechanical", kn: "ಯಾಂತ್ರಿಕ" },
  { value: "other", label: "Other", kn: "ಇತರೆ" },
];

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: "" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
export const isoToday = () => new Date().toISOString().slice(0, 10);

// Amber after a week, red after two: for work still waiting on someone.
export const ageClass = (days) => (days > 14 ? "text-cc-bad font-bold" : days > 7 ? "text-cc-warn font-bold" : "text-cc-muted");
