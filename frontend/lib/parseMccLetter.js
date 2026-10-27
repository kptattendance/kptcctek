// Reads the text of an MCC "3rd party inspection" request letter (as copied
// from Google Lens / Google Docs OCR) into register fields. Free and offline:
// it relies on the fixed labels every MCC letter uses, not on AI.
//
// Lens may return the table cells in a different order, so every field is
// found by its own label or pattern, never by line position.

import { toAsciiDigits } from "./kannada";

const DESIGNATIONS = {
  "ಸ.ಅ": "Assistant Engineer",
  "ಸ.ಇಂ": "Assistant Engineer",
  "ಕಿ.ಅ": "Junior Engineer",
  "ಕಿ.ಇಂ": "Junior Engineer",
  "ಸ.ಕಾ.ಅ": "Assistant Executive Engineer",
  "ಸ.ಕಾ.ಇಂ": "Assistant Executive Engineer",
  "ಕಾ.ಅ": "Executive Engineer",
  "ಕಾ.ಇಂ": "Executive Engineer",
};

const HONORIFIC = /^(ಶ್ರೀಮತಿ|ಶ್ರೀ|ಕುಮಾರಿ|ಕು\.|ಡಾ\.?|Smt\.?|Shri\.?|Sri\.?|Mr\.?|Mrs\.?)\s*/i;

function cleanName(raw) {
  let name = String(raw || "").split(/\n/)[0];
  let designation = "";
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const key = paren[1].replace(/\s+/g, "").replace(/\.$/, "");
    designation = DESIGNATIONS[key] || paren[1].trim();
    name = name.replace(paren[0], "");
  }
  name = name.replace(/[.,;:]+$/, "").trim();
  while (HONORIFIC.test(name)) name = name.replace(HONORIFIC, "").trim();
  return { name, designation };
}

// "10-6-2026" / "09.07.2026" -> "2026-07-09"
function isoDate(d, m, y) {
  const year = y.length === 2 ? `20${y}` : y;
  // OCR can turn handwriting into "3024" / "2036": keep only plausible years
  const now = new Date().getFullYear();
  if (+year < 2015 || +year > now + 1) return "";
  const dt = new Date(Date.UTC(+year, +m - 1, +d));
  if (dt.getUTCDate() !== +d || dt.getUTCMonth() !== +m - 1) return "";
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const money = (s) => Number(String(s).replace(/,/g, ""));

export function parseMccLetter(rawText) {
  const text = toAsciiDigits(rawText).normalize("NFC").replace(/‌|‍/g, "").replace(/[ \t]+/g, " ");
  const out = { partyCode: "", uncertain: [] };
  const found = (key, value) => {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  };

  // Party: letterhead "ಮಂಗಳೂರು ಮಹಾನಗರಪಾಲಿಕೆ" / ಮ.ನ.ಪಾ
  if (/ಮಹಾನಗರ\s*ಪಾಲಿಕೆ|ಮ\.\s*ನ\.\s*ಪಾ/.test(text)) out.partyCode = "MCC";

  // Reference line: starts with ಮ.ನ.ಪಾ and mentions ತಪಾಸಣೆ
  const ref = text.match(/(?:ಸಂಖ್ಯೆ\s*[:;]\s*)?(ಮ\.\s*ನ\.\s*ಪಾ\.?\s*\/[^\n]*?ತಪಾಸಣೆ[^\n]*)/);
  if (ref) found("letterRefNo", ref[1].replace(/\s*ದಿನಾಂಕ.*$/, "").trim());
  const division = text.match(/ವಿಭಾಗ\s*[-–]\s*(\d+)/);
  if (division) found("division", division[1]);

  // Work order: 2446/2025-26, 2118/25-26  -> file no. + work year
  const wo = text.match(/(?<![\d/])(\d{2,5})\s*\/\s*(20\d{2}|\d{2})\s*[-–]\s*(\d{2,4})(?!\d)/);
  if (wo) {
    const start = wo[2].length === 2 ? `20${wo[2]}` : wo[2];
    const end = wo[3].length === 2 ? `${start.slice(0, 2)}${wo[3]}` : wo[3];
    if (+end === +start + 1) {
      found("fileNo", wo[1]);
      found("workYear", `${start}-${end}`);
    }
  }

  // Ward: ವಾರ್ಡ್.ನಂ. 05 / ವಾರ್ಡ್ ಸಂಖ್ಯೆ 5 / ವಾರ್ಡ್ ನಂ:5
  const ward = text.match(/ವಾರ್ಡ್\s*\.?\s*(?:ನಂ|ಸಂಖ್ಯೆ|ನಂಬ್ರ)?\s*\.?\s*[:-]?\s*(\d{1,3})/);
  if (ward) found("ward", String(parseInt(ward[1], 10)));

  // Name of work: from the work's opening words up to the first "ಕಾಮಗಾರಿ"
  const work =
    text.match(/((?:ಮ\.\s*ನ\.\s*ಪಾ\.?\s*ವ್ಯಾಪ್ತಿಯ|ಮಂಗಳೂರು\s*ಮಹಾನಗರ\s*ಪಾಲಿಕೆ\s*ವಾರ್ಡ್)[\s\S]{5,500}?ಕಾಮಗಾರಿ)/) ||
    text.match(/((?:ವಾರ್ಡ್\s*\.?\s*(?:ನಂ|ಸಂಖ್ಯೆ))[\s\S]{5,500}?ಕಾಮಗಾರಿ)/);
  if (work) found("workDescription", work[1].replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim());

  // Fund (ಅನುದಾನ): "ಮ.ನ.ಪಾ ಅನುದಾನ", "2025-26 ನೇ ಸಾಲಿನ ಮ.ನ.ಪಾ ಸಾಮಾನ್ಯ ನಿಧಿ",
  // "15ನೇ ಹಣಕಾಸು ಅನುದಾನ", "ಎಸ್.ಎಫ್.ಸಿ ಅನುದಾನ"... Lens often splits the cell
  // over lines, so \s here spans line breaks.
  const fund =
    text.match(/((?:\d{4}\s*[-–]\s*\d{2,4}\s*ನೇ\s*ಸಾಲಿನ\s*)?(?:ಮ\.\s*ನ\.\s*ಪಾ\.?\s*)?ಸಾಮಾನ್ಯ\s*ನಿಧಿ)/) ||
    text.match(/((?:\d{4}\s*[-–]\s*\d{2,4}\s*ನೇ\s*ಸಾಲಿನ\s*)?(?:15\s*ನೇ\s*ಹಣಕಾಸು|ಎಸ್\.?\s*ಎಫ್\.?\s*ಸಿ\.?|ಸ್ಮಾರ್ಟ್\s*ಸಿಟಿ|ಅಮೃತ್|ನಗರೋತ್ಥಾನ|ಮುಖ್ಯಮಂತ್ರಿ|ಕ್ಷೇತ್ರಾಭಿವೃದ್ಧಿ|ಶಾಸಕರ|ಮಳೆ\s*ಹಾನಿ|ಪ್ರೀಮಿಯಂ|(?:ಮ\.\s*ನ\.\s*ಪಾ\.?\s*)?ಸದಸ್ಯರ|ಮಹಾತ್ಮ\s*ಗಾಂಧಿ|ಮಹಾಪೌರರ|ಗೇಲ್|ಮಹಾನಗರ\s*ಪಾಲಿಕೆ\s*ಅನುದಾನ)(?:[^\n]{0,30}?(?:ಅನುದಾನ|ನಿಧಿ|ಯೋಜನೆ))?)/) ||
    text.match(/(ಮ\.\s*ನ\.\s*ಪಾ\.?\s*ಅನುದಾನ)/);
  if (fund) found("fundSource", fund[1].replace(/\s+/g, " ").trim());

  // Dates: first = work started, second = work completed
  const dates = [...text.matchAll(/(?<!\d)(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(20\d{2}|\d{2})(?!\d)/g)]
    .map((m) => isoDate(m[1], m[2], m[3]))
    .filter(Boolean);
  if (dates[0]) found("workStartedOn", dates[0]);
  if (dates[1]) found("workCompletedOn", dates[1]);

  // Amounts always carry paise: 5,00,000.00 / 498,000.00 / 495597.60
  const amounts = [...text.matchAll(/(?<![\d,])(\d{1,3}(?:,\d{2,3})+|\d{4,9})\.(\d{2})(?!\d)/g)].map((m) => money(`${m[1]}.${m[2]}`));
  if (amounts.length >= 2) {
    // printed order: ಅಂದಾಜು ಮೊತ್ತ (estimate) then ಬಿಲ್ಲಿನ ಮೊತ್ತ (bill)
    found("estimateAmount", amounts[amounts.length - 2]);
    found("projectBillAmount", amounts[amounts.length - 1]);
    if (out.projectBillAmount > out.estimateAmount * 1.25) out.uncertain.push("projectBillAmount");
  } else if (amounts.length === 1) {
    // Only one readable amount: we can't tell estimate from bill, and a wrong
    // bill means a wrong fee. Keep it as the estimate; staff type the bill.
    found("estimateAmount", amounts[0]);
    out.uncertain.push("estimateAmount", "projectBillAmount");
  }

  // Engineer: "ಅಭಿಯಂತರರು: ..." / "ಅಭಿಯಂತರರ ಹೆಸರು; ..." / "ಇಂಜಿನಿಯರ್ ಹೆಸರು: ..."
  const eng = text.match(/(?:ಅಭಿಯಂತರ(?:ರು|ರ\s*ಹೆಸರು|ರ\s*ಹೆಸರು)|ಇಂಜಿನಿಯರ್\s*ಹೆಸರು)\s*[:;]\s*([^\n]+)/);
  if (eng) {
    const { name, designation } = cleanName(eng[1]);
    found("engineerRaw", name);
    found("engineerDesignation", designation);
  }
  const mobile = text.match(/(?<!\d)([6-9]\d{9})(?!\d)/);
  if (mobile) found("engineerPhone", mobile[1]);

  // Contractor: "ಗುತ್ತಿಗೆದಾರರ ಹೆಸರು: ..."
  const con = text.match(/ಗುತ್ತಿಗೆದಾರ(?:ರ)?\s*(?:ಹೆಸರು)?\s*[:;]\s*([^\n]+)/);
  if (con) found("contractorRaw", cleanName(con[1]).name);

  // Type of work from keywords
  const desc = out.workDescription || "";
  out.workType = /ವಿದ್ಯುತ್|ವಿದ್ಯುದ್ದೀಕರಣ|ಬೀದಿ\s*ದೀಪ|ದೀಪ|ಎಲೆಕ್ಟ್ರಿಕ|ವಿದ್ಯುದೀಕರಣ/.test(desc)
    ? "electrical"
    : /ಪಂಪ್|ಮೋಟಾರ್|ಯಂತ್ರ/.test(desc)
      ? "mechanical"
      : "civil";

  for (const key of ["projectBillAmount", "contractorRaw", "engineerRaw", "workDescription", "workStartedOn", "workCompletedOn"])
    if (!out[key] && !out.uncertain.includes(key)) out.uncertain.push(key);

  return out;
}
