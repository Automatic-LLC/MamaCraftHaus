import {
  loadCatalog, getActiveProducts, findProduct, findBundle, findCategory,
  bundleRetailTotal, formatPrice, resolveAsset,
} from "./catalog.js";
import { addItem } from "./cart.js";
import { announce } from "./layout.js";
import {
  esc, $, $$, paragraphs, setMeta, showError, friendlyLoadError,
  productCard, productImage, bundleImage, productUrl,
} from "./ui.js";

const root = $("#product");
const params = new URLSearchParams(location.search);

function notFound(what = "item") {
  setMeta("Not found | MamaCraftHouz", "That item could not be found.");
  root.removeAttribute("aria-busy");
  root.innerHTML = `<div class="notice center"><h1>We couldn't find that ${what}</h1>
    <p>It may have been removed or the link may be old.</p>
    <p><a class="btn btn-primary" href="shop.html">Browse the shop</a></p></div>`;
}

function galleryHtml(images, name) {
  const thumbs = images.length > 1
    ? `<div class="thumbs" role="group" aria-label="Product photos">${images
        .map((src, i) => `<button type="button" class="thumb" data-src="${esc(src)}" aria-label="Show photo ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(src)}" alt="" width="80" height="80"></button>`)
        .join("")}</div>`
    : "";
  return `<div class="gallery"><div class="gallery-main"><img id="main-img" src="${esc(images[0] || "")}" alt="${esc(name)}" width="600" height="600"></div>${thumbs}</div>`;
}

function bindGallery() {
  $$(".thumb").forEach((t) =>
    t.addEventListener("click", () => {
      $("#main-img").src = t.dataset.src;
      $$(".thumb").forEach((o) => o.setAttribute("aria-pressed", String(o === t)));
    })
  );
}

function personalizationHtml({ enabled, label, placeholder, maxLength, required }) {
  if (!enabled) return "";
  return `<div class="field">
    <label for="personal">${esc(label)} ${required ? '<span class="req" aria-hidden="true">*</span>' : '<span class="optional">(optional)</span>'}</label>
    <textarea id="personal" rows="3" maxlength="${maxLength}" placeholder="${esc(placeholder)}" ${required ? "required aria-required=\"true\"" : ""} aria-describedby="personal-count"></textarea>
    <p class="hint counter" id="personal-count"><span id="count-n">0</span> / ${maxLength} characters</p>
    <p class="form-error" id="personal-error" role="alert" hidden></p>
  </div>`;
}

function bindBuyForm({ getOptions, getUnitPrice, type, id, personalization, onPrice }) {
  const form = $("#buy");
  const ta = $("#personal");
  if (ta) ta.addEventListener("input", () => ($("#count-n").textContent = ta.value.length));
  const qty = $("#qty");
  const setQty = (n) => (qty.value = Math.max(1, Math.min(99, n)));
  $("#qty-minus").addEventListener("click", () => setQty((+qty.value || 1) - 1));
  $("#qty-plus").addEventListener("click", () => setQty((+qty.value || 1) + 1));
  $$("select", form).forEach((s) => s.addEventListener("change", onPrice));
  onPrice();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = ta ? ta.value.trim() : "";
    if (personalization.enabled && personalization.required && !text) {
      const er = $("#personal-error");
      er.textContent = `Please fill in "${personalization.label}" so we can make it just right.`;
      er.hidden = false;
      ta.focus();
      return;
    }
    if ($("#personal-error")) $("#personal-error").hidden = true;
    addItem({ type, id, qty: +qty.value || 1, options: getOptions(), personalization: text, unitPrice: getUnitPrice() });
    const msg = "Added to your cart.";
    $("#add-status").innerHTML = `${msg} <a href="cart.html">View cart</a>`;
    announce(msg);
    const btn = $("#add-btn");
    btn.textContent = "Added ✓";
    setTimeout(() => (btn.textContent = "Add to cart"), 1800);
  });
}

const qtyHtml = `<div class="field qty-field"><label for="qty">Quantity</label>
  <div class="stepper"><button type="button" id="qty-minus" aria-label="Decrease quantity">&minus;</button>
  <input id="qty" type="number" min="1" max="99" value="1" inputmode="numeric"><button type="button" id="qty-plus" aria-label="Increase quantity">+</button></div></div>`;

function renderProduct(catalog, p) {
  const cat = findCategory(catalog, p.category);
  setMeta(`${p.name} | MamaCraftHouz`, (p.description || "").split("\n")[0].slice(0, 155));
  const og = document.querySelector('meta[property="og:image"]');
  if (og) og.setAttribute("content", productImage(p));
  const images = (p.images || []).map(resolveAsset);
  const opts = p.options || [];
  const pers = p.personalization || { enabled: false };

  root.innerHTML = `<div class="product-layout">
    ${galleryHtml(images, p.name)}
    <div class="product-info">
      ${cat ? `<p class="eyebrow"><a href="shop.html?category=${encodeURIComponent(cat.id)}">${esc(cat.name)}</a></p>` : ""}
      <h1>${esc(p.name)}</h1>
      <p class="price-line"><span class="price" id="price">${formatPrice(p.price)}</span> ${p.compareAtPrice > p.price ? `<s class="price-was">${formatPrice(p.compareAtPrice)}</s>` : ""}</p>
      <div class="prose">${paragraphs(p.description)}</div>
      <form id="buy" novalidate>
        ${opts.map((o, i) => `<div class="field"><label for="opt-${i}">${esc(o.name)}</label>
          <select id="opt-${i}" data-name="${esc(o.name)}">${o.values
            .map((v, j) => `<option value="${j}">${esc(v.label)}${v.priceDelta ? ` (${v.priceDelta > 0 ? "+" : "−"}${formatPrice(Math.abs(v.priceDelta))})` : ""}</option>`)
            .join("")}</select></div>`).join("")}
        ${personalizationHtml(pers)}
        ${qtyHtml}
        <p class="lead-time">Ships in ~${p.leadTimeDays || 7} days &middot; made to order</p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="add-btn">Add to cart</button>
        <p class="add-status" id="add-status" role="status"></p>
      </form>
    </div>
  </div>`;
  bindGallery();

  const selected = () => opts.map((o, i) => o.values[+$(`#opt-${i}`).value]);
  bindBuyForm({
    type: "product",
    id: p.id,
    personalization: pers,
    getOptions: () => Object.fromEntries(opts.map((o, i) => [o.name, selected()[i].label])),
    getUnitPrice: () => p.price + selected().reduce((s, v) => s + (v.priceDelta || 0), 0),
    onPrice() {
      $("#price").textContent = formatPrice(p.price + selected().reduce((s, v) => s + (v.priceDelta || 0), 0));
    },
  });

  const related = getActiveProducts(catalog).filter((x) => x.id !== p.id);
  return [...related.filter((x) => x.category === p.category), ...related.filter((x) => x.category !== p.category)].slice(0, 4);
}

function renderBundle(catalog, b) {
  setMeta(`${b.name} | MamaCraftHouz`, (b.description || "").slice(0, 155));
  const og = document.querySelector('meta[property="og:image"]');
  if (og) og.setAttribute("content", bundleImage(catalog, b));
  const retail = bundleRetailTotal(catalog, b);
  const save = retail - b.price;
  const items = b.items.map((it) => ({ ...it, p: findProduct(catalog, it.productId) })).filter((it) => it.p);
  const images = b.images && b.images.length ? b.images.map(resolveAsset) : [bundleImage(catalog, b)];
  const lead = Math.max(7, ...items.map((it) => it.p.leadTimeDays || 0));
  const pers = {
    enabled: true,
    label: "Personalization for each item",
    placeholder: items.map((it) => `${it.p.name}: names / dates / text`).join("\n").slice(0, 200),
    maxLength: 500,
    required: false,
  };

  root.innerHTML = `<div class="product-layout">
    ${galleryHtml(images, b.name)}
    <div class="product-info">
      <p class="eyebrow">Bundle &amp; gift set</p>
      <h1>${esc(b.name)}</h1>
      <p class="price-line"><span class="price">${formatPrice(b.price)}</span>
        ${retail > b.price ? `<s class="price-was">${formatPrice(retail)}</s> <span class="badge badge-save">You save ${formatPrice(save)}</span>` : ""}</p>
      <div class="prose">${paragraphs(b.description)}</div>
      <h2 class="mini-title">What's included</h2>
      <ul class="included">${items
        .map((it) => `<li><a href="${productUrl(it.p.id)}"><img src="${esc(productImage(it.p))}" alt="" width="56" height="56"><span>${it.qty > 1 ? `${it.qty} &times; ` : ""}${esc(it.p.name)}</span></a></li>`)
        .join("")}</ul>
      <form id="buy" novalidate>
        ${personalizationHtml(pers)}
        ${qtyHtml}
        <p class="lead-time">Ships in ~${lead} days &middot; made to order</p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="add-btn">Add to cart</button>
        <p class="add-status" id="add-status" role="status"></p>
      </form>
    </div>
  </div>`;
  bindGallery();
  bindBuyForm({ type: "bundle", id: b.id, personalization: pers, getOptions: () => ({}), getUnitPrice: () => b.price, onPrice() {} });

  const inBundle = new Set(items.map((it) => it.p.id));
  return getActiveProducts(catalog).filter((x) => !inBundle.has(x.id)).sort((a, b2) => !!b2.featured - !!a.featured).slice(0, 4);
}

try {
  const catalog = await loadCatalog();
  const bundleId = params.get("bundle");
  const productId = params.get("id");
  let related = null;
  if (bundleId) {
    const b = findBundle(catalog, bundleId);
    if (!b || b.active === false) notFound("bundle");
    else related = renderBundle(catalog, b);
  } else if (productId) {
    const p = findProduct(catalog, productId);
    if (!p || p.active === false) notFound("product");
    else related = renderProduct(catalog, p);
  } else notFound();
  root.removeAttribute("aria-busy");
  if (related && related.length) {
    const names = (id) => (findCategory(catalog, id) || {}).name || "";
    $("#related").innerHTML = related.map((x) => productCard(x, names(x.category))).join("");
    $("#related-section").hidden = false;
  }
} catch (err) {
  console.warn(err);
  showError(root, friendlyLoadError);
}
