// Cart stored in localStorage (key mch_cart_v1). Line item shape (see SPEC.md):
// { key, type: "product"|"bundle", id, qty, options: {Size: "M"}, personalization: "text", unitPrice }
const KEY = "mch_cart_v1";
const MAX_QTY = 99;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: cart just won't persist */
  }
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: { items } }));
}

export function lineKey({ type, id, options = {}, personalization = "" }) {
  return [type, id, JSON.stringify(options || {}), (personalization || "").trim()].join("|");
}

export const getCart = () => read();

export function addItem({ type = "product", id, qty = 1, options = {}, personalization = "", unitPrice = 0 }) {
  const items = read();
  const personal = (personalization || "").trim();
  const key = lineKey({ type, id, options, personalization: personal });
  const existing = items.find((i) => i.key === key);
  const n = Math.max(1, Math.floor(Number(qty)) || 1);
  if (existing) {
    existing.qty = Math.min(MAX_QTY, existing.qty + n);
    existing.unitPrice = unitPrice;
  } else {
    items.push({ key, type, id, qty: Math.min(MAX_QTY, n), options, personalization: personal, unitPrice });
  }
  write(items);
  return items;
}

export function removeItem(key) {
  write(read().filter((i) => i.key !== key));
}

export function updateQty(key, qty) {
  const n = Math.floor(Number(qty)) || 0;
  if (n <= 0) return removeItem(key);
  write(read().map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_QTY, n) } : i)));
}

export function clear() {
  write([]);
}

export const count = () => read().reduce((n, i) => n + i.qty, 0);
export const subtotal = () => read().reduce((s, i) => s + i.qty * (Number(i.unitPrice) || 0), 0);

// Keep tabs in sync.
window.addEventListener("storage", (e) => {
  if (e.key === KEY) window.dispatchEvent(new CustomEvent("cart:changed", { detail: { items: read() } }));
});
