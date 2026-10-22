// Small helpers with no DOM dependencies (safe to unit-test in Node).

export function slugify(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// Make `base` unique among `taken` (an iterable of existing ids): x, x-2, x-3 ...
export function uniqueSlug(base, taken) {
  const used = new Set(taken);
  const root = base || "item";
  if (!used.has(root)) return root;
  let n = 2;
  while (used.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

// "24", "$24.50", "24,50" -> number, otherwise NaN. Blank -> NaN.
export function parseMoney(text) {
  if (typeof text === "number") return text;
  const s = String(text ?? "").replace(/[$\s]/g, "").replace(/,/g, ".");
  if (s === "" || !/^-?\d*\.?\d+$|^-?\d+\.?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100) / 100;
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function clone(obj) {
  return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Pretty JSON used for products.json (2-space indent + trailing newline).
export const toJSON = (data) => JSON.stringify(data, null, 2) + "\n";

export function downloadText(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

let counter = 0;
export const uid = (prefix = "k") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

// Suggested bundle price: pct% off, rounded to a "nice" whole dollar when that still saves money.
export function suggestPrice(total, pct) {
  const raw = total * (1 - (Number(pct) || 0) / 100);
  const whole = Math.round(raw);
  return whole < total && whole > 0 ? whole : round2(raw);
}
