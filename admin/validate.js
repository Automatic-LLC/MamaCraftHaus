// Catalog normalising + validation (pure functions, no DOM).
import { round2 } from "./util.js";

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeProduct(p) {
  const pers = p.personalization || {};
  const out = {
    id: p.id,
    name: String(p.name ?? "").trim(),
    category: p.category ?? "",
    price: round2(num(p.price)),
    compareAtPrice: p.compareAtPrice === null || p.compareAtPrice === undefined || p.compareAtPrice === "" ? null : round2(num(p.compareAtPrice)),
    description: String(p.description ?? "").trim(),
    images: (p.images || []).filter((x) => typeof x === "string" && x),
    options: (p.options || []).map((o) => ({
      name: String(o.name ?? "").trim(),
      values: (o.values || []).map((v) => ({ label: String(v.label ?? "").trim(), priceDelta: round2(num(v.priceDelta)) })),
    })),
    personalization: {
      enabled: !!pers.enabled,
      label: String(pers.label ?? ""),
      placeholder: String(pers.placeholder ?? ""),
      maxLength: Math.round(num(pers.maxLength, 80)),
      required: !!pers.required,
    },
    tags: (p.tags || []).map((t) => String(t).trim()).filter(Boolean),
    featured: !!p.featured,
    active: p.active !== false,
    leadTimeDays: Math.round(num(p.leadTimeDays, 7)),
    createdAt: p.createdAt || "",
  };
  // keep any extra fields someone added by hand
  for (const k of Object.keys(p)) if (!(k in out)) out[k] = p[k];
  return out;
}

export function normalizeBundle(b) {
  const out = {
    id: b.id,
    name: String(b.name ?? "").trim(),
    description: String(b.description ?? "").trim(),
    items: (b.items || []).map((i) => ({ productId: i.productId, qty: Math.max(1, Math.round(num(i.qty, 1))) })),
    price: round2(num(b.price)),
    images: (b.images || []).filter((x) => typeof x === "string" && x),
    featured: !!b.featured,
    active: b.active !== false,
  };
  for (const k of Object.keys(b)) if (!(k in out)) out[k] = b[k];
  return out;
}

export function normalizeCategory(c) {
  const out = { id: c.id, name: String(c.name ?? "").trim(), description: String(c.description ?? "").trim(), image: c.image || "" };
  for (const k of Object.keys(c)) if (!(k in out)) out[k] = c[k];
  return out;
}

export function normalizeCatalog(c) {
  return {
    ...c,
    categories: (c.categories || []).map(normalizeCategory),
    products: (c.products || []).map(normalizeProduct),
    bundles: (c.bundles || []).map(normalizeBundle),
  };
}

// Returns [{ where, message }]. Empty array = good to save.
export function validateCatalog(c) {
  const errs = [];
  const add = (where, message) => errs.push({ where, message });

  const catIds = new Set();
  for (const k of c.categories) {
    const w = `Category "${k.name || k.id}"`;
    if (!k.name) add(w, "needs a name.");
    if (!k.id || !ID_RE.test(k.id)) add(w, "has an invalid id.");
    if (catIds.has(k.id)) add(w, `shares the id "${k.id}" with another category.`);
    catIds.add(k.id);
  }

  const prodIds = new Set();
  for (const p of c.products) {
    const w = `Product "${p.name || p.id}"`;
    if (!p.id || !ID_RE.test(p.id)) add(w, "has an invalid id.");
    if (prodIds.has(p.id)) add(w, `shares the id "${p.id}" with another product. Ids must be unique.`);
    prodIds.add(p.id);
    if (!p.name) add(w, "needs a name.");
    if (!(Number.isFinite(p.price) && p.price >= 0)) add(w, "needs a price.");
    if (!p.category) add(w, "needs a category.");
    else if (!catIds.has(p.category)) add(w, `uses a category that doesn't exist ("${p.category}").`);
    if (p.compareAtPrice !== null && !(p.compareAtPrice > p.price)) add(w, 'has a "was" price that is not higher than the price.');
    for (const o of p.options) {
      if (!o.name) add(w, "has an option without a name.");
      if (!o.values.length) add(w, `option "${o.name}" has no choices.`);
      const seen = new Set();
      for (const v of o.values) {
        if (!v.label) add(w, `option "${o.name}" has a choice without a name.`);
        if (seen.has(v.label.toLowerCase())) add(w, `option "${o.name}" lists "${v.label}" twice.`);
        seen.add(v.label.toLowerCase());
      }
    }
    const names = p.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) add(w, "has two options with the same name.");
  }

  const bundleIds = new Set();
  for (const b of c.bundles) {
    const w = `Bundle "${b.name || b.id}"`;
    if (!b.id || !ID_RE.test(b.id)) add(w, "has an invalid id.");
    if (bundleIds.has(b.id)) add(w, `shares the id "${b.id}" with another bundle.`);
    bundleIds.add(b.id);
    if (!b.name) add(w, "needs a name.");
    if (!(Number.isFinite(b.price) && b.price >= 0)) add(w, "needs a price.");
    if (b.active && !b.items.length) add(w, "has no products in it. Add some or hide the bundle.");
    const seen = new Set();
    for (const it of b.items) {
      if (!prodIds.has(it.productId)) add(w, `includes a product that no longer exists ("${it.productId}").`);
      if (seen.has(it.productId)) add(w, `lists "${it.productId}" twice.`);
      seen.add(it.productId);
      if (!(it.qty >= 1)) add(w, "has an item with a quantity below 1.");
    }
  }
  return errs;
}

export const bundlesUsing = (catalog, productId) => catalog.bundles.filter((b) => b.items.some((i) => i.productId === productId));
export const productsIn = (catalog, categoryId) => catalog.products.filter((p) => p.category === categoryId);
