// Small shared helpers for storefront pages.
import { resolveAsset, findProduct, formatPrice, bundleRetailTotal } from "./catalog.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const paragraphs = (text) =>
  String(text || "")
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export function setMeta(title, description) {
  document.title = title;
  const set = (sel, attr, val) => {
    const m = document.querySelector(sel);
    if (m) m.setAttribute(attr, val);
  };
  set('meta[name="description"]', "content", description);
  set('meta[property="og:title"]', "content", title);
  set('meta[property="og:description"]', "content", description);
}

export function showError(container, message) {
  container.innerHTML = `<div class="notice notice-error" role="alert"><strong>Oops!</strong> ${esc(message)}
    <p><button type="button" class="btn btn-secondary" data-reload>Try again</button></p></div>`;
  container.querySelector("[data-reload]").addEventListener("click", () => location.reload());
}

export const friendlyLoadError = "We couldn't load the shop right now. Please check your connection and try again.";

export function productImage(p) {
  return resolveAsset((p.images && p.images[0]) || "");
}

export function bundleImage(catalog, b) {
  if (b.images && b.images.length) return resolveAsset(b.images[0]);
  const first = b.items.map((it) => findProduct(catalog, it.productId)).find(Boolean);
  return first ? productImage(first) : "";
}

export const productUrl = (id) => `product.html?id=${encodeURIComponent(id)}`;
export const bundleUrl = (id) => `product.html?bundle=${encodeURIComponent(id)}`;

export function productCard(p, categoryName) {
  const was = p.compareAtPrice && p.compareAtPrice > p.price ? `<s class="price-was">${formatPrice(p.compareAtPrice)}</s>` : "";
  const hasOpts = p.options && p.options.some((o) => o.values.some((v) => v.priceDelta > 0));
  return `<article class="card product-card">
    <a class="card-media" href="${productUrl(p.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(productImage(p))}" alt="" loading="lazy" width="600" height="600"></a>
    <div class="card-body">
      ${categoryName ? `<p class="card-eyebrow">${esc(categoryName)}</p>` : ""}
      <h3 class="card-title"><a href="${productUrl(p.id)}">${esc(p.name)}</a></h3>
      <p class="card-price">${hasOpts ? '<span class="price-from">from </span>' : ""}${formatPrice(p.price)} ${was}</p>
    </div>
  </article>`;
}

export function bundleCard(catalog, b) {
  const retail = bundleRetailTotal(catalog, b);
  const save = retail - b.price;
  const names = b.items
    .map((it) => {
      const p = findProduct(catalog, it.productId);
      return p ? `${it.qty > 1 ? it.qty + "× " : ""}${p.name}` : "";
    })
    .filter(Boolean)
    .join(", ");
  return `<article class="card product-card bundle-card">
    <a class="card-media" href="${bundleUrl(b.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(bundleImage(catalog, b))}" alt="" loading="lazy" width="600" height="600"></a>
    <div class="card-body">
      <p class="card-eyebrow">Bundle</p>
      <h3 class="card-title"><a href="${bundleUrl(b.id)}">${esc(b.name)}</a></h3>
      <p class="card-note">${esc(names)}</p>
      <p class="card-price">${formatPrice(b.price)} ${save > 0.005 ? `<span class="badge badge-save">You save ${formatPrice(save)}</span>` : ""}</p>
    </div>
  </article>`;
}
