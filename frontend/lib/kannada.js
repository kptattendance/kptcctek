// Kannada helpers for reading MCC letters without any paid service.
//   toAsciiDigits("೧೨")       -> "12"
//   transliterate("ರೂಪಾ ಶಿವಯ್ಯನ ಮಠ") -> "Roopa Shivayyana Matha"
//   bestMatches(kannadaName, ["Roopa Shivayyana Mata", ...]) -> ranked English names

const KN_DIGITS = "೦೧೨೩೪೫೬೭೮೯";
export const toAsciiDigits = (s) => String(s ?? "").replace(/[೦-೯]/g, (d) => String(KN_DIGITS.indexOf(d)));

const CONSONANTS = {
  ಕ: "k", ಖ: "kh", ಗ: "g", ಘ: "gh", ಙ: "n", ಚ: "ch", ಛ: "chh", ಜ: "j", ಝ: "jh", ಞ: "n",
  ಟ: "t", ಠ: "th", ಡ: "d", ಢ: "dh", ಣ: "n", ತ: "t", ಥ: "th", ದ: "d", ಧ: "dh", ನ: "n",
  ಪ: "p", ಫ: "ph", ಬ: "b", ಭ: "bh", ಮ: "m", ಯ: "y", ರ: "r", ಱ: "r", ಲ: "l", ವ: "v",
  ಶ: "sh", ಷ: "sh", ಸ: "s", ಹ: "h", ಳ: "l", ೞ: "l",
};
const NUKTA = { ಫ: "f", ಜ: "z" }; // ಫ಼ ಜ಼ used for f / z in names
const VOWELS = { ಅ: "a", ಆ: "aa", ಇ: "i", ಈ: "ee", ಉ: "u", ಊ: "oo", ಋ: "ru", ಎ: "e", ಏ: "e", ಐ: "ai", ಒ: "o", ಓ: "o", ಔ: "au" };
const SIGNS = { "ಾ": "aa", "ಿ": "i", "ೀ": "ee", "ು": "u", "ೂ": "oo", "ೃ": "ru", "ೆ": "e", "ೇ": "e", "ೈ": "ai", "ೊ": "o", "ೋ": "o", "ೌ": "au" };
const VIRAMA = "್";
const NUKTA_SIGN = "಼";

export function transliterate(text) {
  const s = toAsciiDigits(text).normalize("NFC");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (CONSONANTS[ch]) {
      let base = CONSONANTS[ch];
      if (s[i + 1] === NUKTA_SIGN) {
        base = NUKTA[ch] || base;
        i++;
      }
      const next = s[i + 1];
      if (next === VIRAMA) {
        out += base;
        i++;
      } else if (SIGNS[next]) {
        out += base + SIGNS[next];
        i++;
      } else {
        out += base + "a"; // inherent vowel
      }
    } else if (VOWELS[ch]) out += VOWELS[ch];
    else if (ch === "ಂ") out += /^[pbm]/.test(CONSONANTS[s[i + 1]] || "") ? "m" : "n";
    else if (ch === "ಃ") out += "h";
    else if (ch === "‌" || ch === "‍") continue; // joiners
    else out += ch;
  }
  // English-style names: "Roopaa" -> "Roopa", "Mohammad"
  return out
    .replace(/aa\b/g, "a")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

// Spelling-insensitive key: Mohammad/Mahammadh/Mohamad, Fayaz/Phayaj,
// Shetty/Shetti, Mata/Matha all collapse to the same skeleton.
export function nameKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\b(sri|shri|shree|smt|srimati|shrimati|mr|mrs|ms|dr|ku)\.?\s+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/ph/g, "f")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/([kgcjtdpb])h/g, "$1")
    .replace(/sh/g, "s")
    .replace(/ee|ie/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/aa/g, "a")
    .replace(/y\b/g, "i")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  // vowel-free comparison catches "Mahammad" vs "Mohammad"
  const strip = (s) => s.replace(/[aeiou]/g, "");
  const full = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const cons = 1 - levenshtein(strip(x), strip(y)) / Math.max(strip(x).length, strip(y).length, 1);
  return Math.max(full, cons * 0.95);
}

/**
 * Rank known English names for a name read from the letter (Kannada or English).
 * directory: [{ name, uses, aliases: [kannada strings] }]
 */
export function bestMatches(raw, directory, limit = 3) {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  // exact Kannada spelling seen before = certain
  const exact = directory.find((d) => d.aliases?.includes(text));
  if (exact) return [{ name: exact.name, score: 1, learned: true }];

  const english = /[ಀ-೿]/.test(text) ? transliterate(text) : text;
  const ranked = directory
    .map((d) => ({ name: d.name, uses: d.uses || 0, score: similarity(english, d.name) }))
    .filter((d) => d.score >= 0.72)
    .sort((a, b) => b.score - a.score || b.uses - a.uses);

  // Same person spelled several ways in the old register: keep the most used.
  const seen = new Set();
  const out = [];
  for (const r of ranked) {
    const k = nameKey(r.name).replace(/[aeiou]/g, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length === limit) break;
  }
  return out;
}
