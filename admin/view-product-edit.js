// Add / edit / duplicate a product.
import { h, field, switchEl, toast, fillErrors, autoClearErrors } from "./ui.js";
import { app, commit, go, setDirty, errorsToText } from "./state.js";
import { photoManager, itemsFromPaths, isBusy, hasPending, pathsOf, uploadPending } from "./photos.js";
import { optionsBuilder } from "./options.js";
import { slugify, uniqueSlug, parseMoney, todayISO, uid, round2 } from "./util.js";
import { formatPrice } from "../js/catalog.js";
import { normalizeProduct } from "./validate.js";

const BLANK_PERS = { enabled: false, label: "Name or message", placeholder: "", maxLength: "80", required: false };

function toDraft(p, mode) {
  const dup = mode === "copy";
  const base = p || {};
  const pers = { ...BLANK_PERS, ...(base.personalization || {}) };
  return {
    isNew: !p || dup,
    id: dup || !p ? "" : p.id,
    createdAt: dup || !p ? todayISO() : base.createdAt || "",
    name: dup ? `${base.name} (copy)` : base.name || "",
    category: base.category || "",
    price: base.price ?? "",
    compareAtPrice: base.compareAtPrice ?? "",
    description: base.description || "",
    images: itemsFromPaths(base.images),
    options: (base.options || []).map((o) => ({ name: o.name, values: o.values.map((v) => ({ label: v.label, priceDelta: v.priceDelta ? String(v.priceDelta) : "" })) })),
    personalization: { ...pers, maxLength: String(pers.maxLength ?? 80) },
    tagsText: (base.tags || []).join(", "),
    featured: dup ? false : !!base.featured,
    active: dup ? true : base.active !== false,
    leadTimeDays: String(base.leadTimeDays ?? 7),
    extra: p ? Object.fromEntries(Object.entries(p).filter(([k]) => !(k in normalizeProduct({})))) : {},
  };
}

// Returns { product, errors:[{field,message}] }
function fromDraft(d, catalog) {
  const errors = [];
  const err = (field, message) => errors.push({ field, message });
  const name = d.name.trim();
  if (!name) err("name", "Please give this product a name.");
  if (!d.category) err("category", "Please pick a category.");
  const price = parseMoney(d.price);
  if (!Number.isFinite(price) || price < 0) err("price", "Please enter a price, like 24 or 24.50.");
  let compare = null;
  if (String(d.compareAtPrice).trim() !== "") {
    compare = parseMoney(d.compareAtPrice);
    if (!Number.isFinite(compare)) err("compareAtPrice", 'Enter a "was" price like 30, or leave it empty.');
    else if (Number.isFinite(price) && compare <= price) err("compareAtPrice", 'The "was" price should be higher than the price.');
  }
  const lead = Number(d.leadTimeDays);
  if (!Number.isInteger(lead) || lead < 0 || String(d.leadTimeDays).trim() === "") err("leadTimeDays", "Enter a whole number of days, like 7.");

  const options = [];
  d.options.forEach((o, i) => {
    const oname = o.name.trim();
    const values = o.values
      .map((v) => ({ label: v.label.trim(), priceDelta: String(v.priceDelta).trim() === "" ? 0 : parseMoney(v.priceDelta) }))
      .filter((v, idx) => v.label || String(o.values[idx].priceDelta).trim() !== "");
    if (!oname && !values.length) return; // totally empty -> ignore
    if (!oname) err("options", `Option ${i + 1} needs a name (like "Size").`);
    if (!values.length) err("options", `Option "${oname}" needs at least one choice.`);
    if (values.some((v) => !v.label)) err("options", `Every choice in "${oname}" needs a name.`);
    if (values.some((v) => !Number.isFinite(v.priceDelta))) err("options", `Check the extra prices in "${oname}".`);
    const seen = new Set();
    for (const v of values) {
      if (seen.has(v.label.toLowerCase())) err("options", `"${oname}" lists "${v.label}" twice.`);
      seen.add(v.label.toLowerCase());
    }
    options.push({ name: oname, values });
  });
  const names = options.map((o) => o.name.toLowerCase());
  if (new Set(names).size !== names.length) err("options", "Two options have the same name.");

  const pers = d.personalization;
  const maxLength = Number(pers.maxLength);
  if (pers.enabled) {
    if (!pers.label.trim()) err("persLabel", "Tell customers what to type, e.g. “Name & date”.");
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 1000) err("persMax", "Enter a number from 1 to 1000.");
  }

  const tags = [...new Set(d.tagsText.split(",").map((t) => t.trim()).filter(Boolean))];
  let id = d.id;
  if (d.isNew) {
    const taken = catalog.products.map((p) => p.id);
    id = uniqueSlug(slugify(name) || "product", taken);
  }
  const product = {
    ...d.extra,
    id,
    name,
    category: d.category,
    price: Number.isFinite(price) ? price : 0,
    compareAtPrice: compare,
    description: d.description.replace(/\r\n/g, "\n").trim(),
    images: pathsOf(d.images),
    options,
    personalization: {
      enabled: !!pers.enabled,
      label: pers.label.trim(),
      placeholder: pers.placeholder.trim(),
      maxLength: Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 80,
      required: !!pers.enabled && !!pers.required,
    },
    tags,
    featured: !!d.featured,
    active: !!d.active,
    leadTimeDays: Number.isInteger(lead) ? lead : 7,
    createdAt: d.createdAt || todayISO(),
  };
  return { product, errors };
}

function sectionCard(title, ...kids) {
  return h("section", { class: "card section" }, h("h2", title), kids);
}

export function productEditView({ id, mode }) {
  const existing = id ? app.catalog.products.find((p) => p.id === id) : null;
  if (id && !existing) {
    return h("section", { class: "view" }, h("h1", { id: "view-title", tabindex: "-1" }, "Product not found"), h("p", "That product isn't in your shop (it may have been deleted)."), h("a", { class: "btn btn-primary", href: "#/products" }, "Back to products"));
  }
  const draft = toDraft(existing, mode);
  const dirty = () => setDirty(true);
  const heading = draft.isNew ? (mode === "copy" ? "Duplicate product" : "Add a product") : "Edit product";

  // ---- Basics
  const idNote = h("p", { class: "hint" });
  const updateIdNote = () => {
    if (!draft.isNew) idNote.textContent = `Product ID: ${draft.id} (stays the same)`;
    else {
      const slug = uniqueSlug(slugify(draft.name) || "product", app.catalog.products.map((p) => p.id));
      idNote.textContent = draft.name.trim() ? `Product ID (made for you): ${slug}` : "The product ID is made automatically from the name.";
    }
  };
  const nameIn = h("input", { type: "text", id: "pe-name", value: draft.name, autocomplete: "off", maxlength: "120", oninput: (e) => { draft.name = e.target.value; updateIdNote(); refreshPreview(); dirty(); } });
  const catIn = h("select", { id: "pe-category", onchange: (e) => { draft.category = e.target.value; refreshPreview(); dirty(); } },
    h("option", { value: "" }, "Choose a category…"),
    app.catalog.categories.map((c) => h("option", { value: c.id, selected: c.id === draft.category }, c.name)),
  );
  const priceIn = h("input", { type: "number", id: "pe-price", inputmode: "decimal", step: "0.01", min: "0", value: draft.price, placeholder: "0.00", oninput: (e) => { draft.price = e.target.value; refreshPreview(); dirty(); } });
  const compareIn = h("input", { type: "number", id: "pe-compare", inputmode: "decimal", step: "0.01", min: "0", value: draft.compareAtPrice, placeholder: "optional", oninput: (e) => { draft.compareAtPrice = e.target.value; refreshPreview(); dirty(); } });
  const descIn = h("textarea", { id: "pe-desc", rows: "6", oninput: (e) => { draft.description = e.target.value; refreshPreview(); dirty(); } });
  descIn.value = draft.description;
  const leadIn = h("input", { type: "number", id: "pe-lead", inputmode: "numeric", step: "1", min: "0", value: draft.leadTimeDays, oninput: (e) => { draft.leadTimeDays = e.target.value; refreshPreview(); dirty(); } });
  const tagsIn = h("input", { type: "text", id: "pe-tags", value: draft.tagsText, placeholder: "wedding, gift, kids", oninput: (e) => { draft.tagsText = e.target.value; dirty(); } });

  const basics = sectionCard("The basics",
    field("Name", nameIn, { errKey: "name" }),
    idNote,
    field("Category", catIn, { errKey: "category" }),
    field("Description", descIn, { hint: "Tell customers what it is and what makes it special. Leave a blank line to start a new paragraph." }),
    field("How many days to make it?", leadIn, { hint: "Shown to customers as “Ships in about N days”.", errKey: "leadTimeDays" }),
    field("Tags", tagsIn, { hint: "Words that help people find it, separated by commas." }),
  );

  // ---- Price
  const priceSec = sectionCard("Price",
    h("div", { class: "row2" },
      field("Price ($)", priceIn, { errKey: "price" }),
      field("Regular price ($)", compareIn, { hint: "Optional. Fill this in to show a crossed-out “was” price.", errKey: "compareAtPrice" }),
    ),
  );

  // ---- Photos
  const photos = photoManager(draft.images, { onChange: () => { refreshPreview(); dirty(); } });
  const photoSec = sectionCard("Photos",
    h("p", { class: "hint" }, "The first photo is the main one. Square photos in good light look best. Photos are shrunk automatically."),
    photos,
  );

  // ---- Options
  const optsBuilder = optionsBuilder(draft.options, { onChange: () => { refreshPreview(); dirty(); } });
  const optSec = sectionCard("Options",
    h("p", { class: "hint" }, "Choices customers pick from, like a size or color. Add an extra cost for a choice if it costs more."),
    optsBuilder,
    h("p", { class: "field-error", "data-err": "options", role: "alert" }),
  );

  // ---- Personalization
  const pers = draft.personalization;
  const persFields = h("div", { class: "pers-fields" },
    field("What should customers type?", h("input", { type: "text", id: "pe-pl", value: pers.label, oninput: (e) => { pers.label = e.target.value; refreshPreview(); dirty(); } }), { hint: "The label above the box, e.g. “Names & date”.", errKey: "persLabel" }),
    field("Example text inside the box", h("input", { type: "text", id: "pe-pp", value: pers.placeholder, oninput: (e) => { pers.placeholder = e.target.value; dirty(); } }), { hint: "e.g. “Mr. Smith · Mrs. Smith · 06.14.2027”" }),
    h("div", { class: "row2" },
      field("Longest allowed (letters)", h("input", { type: "number", id: "pe-pm", inputmode: "numeric", min: "1", step: "1", value: pers.maxLength, oninput: (e) => { pers.maxLength = e.target.value; dirty(); } }), { errKey: "persMax" }),
      h("div", { class: "field" }, h("span", { class: "label-like" }, "Is it required?"),
        switchEl({ label: "Customer must fill it in", checked: pers.required, onChange: (v) => { pers.required = v; dirty(); } })),
    ),
  );
  const syncPers = () => { persFields.hidden = !pers.enabled; };
  const persSec = sectionCard("Personalization",
    switchEl({ label: "Let customers personalize this", hint: "Adds a text box for names, dates or a message.", checked: pers.enabled, onChange: (v) => { pers.enabled = v; syncPers(); refreshPreview(); dirty(); } }),
    persFields,
  );
  syncPers();

  // ---- Visibility
  const visSec = sectionCard("Show in the shop",
    switchEl({ label: "Showing in the shop", hint: "Turn off to hide it (for example when it's sold out).", checked: draft.active, onChange: (v) => { draft.active = v; refreshPreview(); dirty(); } }),
    switchEl({ label: "Featured", hint: "Featured items appear on the home page.", checked: draft.featured, onChange: (v) => { draft.featured = v; refreshPreview(); dirty(); } }),
  );

  // ---- Preview
  const previewBox = h("div", { class: "preview-card" });
  function refreshPreview() {
    const price = parseMoney(draft.price);
    const compare = parseMoney(draft.compareAtPrice);
    const cat = app.catalog.categories.find((c) => c.id === draft.category);
    const img = draft.images.find((i) => i.preview);
    const optNames = draft.options.filter((o) => o.name.trim());
    const lead = Number(draft.leadTimeDays);
    previewBox.replaceChildren(
      h("div", { class: "pv-img" },
        img ? h("img", { src: img.preview, alt: "" }) : h("span", { class: "pv-noimg" }, "Photo goes here"),
        draft.featured && h("span", { class: "pv-flag" }, "Featured"),
        !draft.active && h("span", { class: "pv-flag pv-hidden" }, "Hidden"),
      ),
      h("div", { class: "pv-body" },
        h("p", { class: "muted" }, cat ? cat.name : "Category"),
        h("h3", draft.name.trim() || "Product name"),
        h("p", { class: "price" }, Number.isFinite(price) ? formatPrice(price) : "$0.00", Number.isFinite(compare) && compare > price ? h("s", { class: "was" }, formatPrice(compare)) : null),
        draft.description.trim() && h("p", { class: "pv-desc" }, draft.description.trim().split(/\n\s*\n/)[0]),
        optNames.length ? h("p", { class: "muted" }, "Choose: " + optNames.map((o) => o.name.trim()).join(", ")) : null,
        pers.enabled && h("p", { class: "muted" }, "Personalize: " + (pers.label || "…")),
        Number.isInteger(lead) && lead > 0 ? h("p", { class: "muted" }, `Ships in about ${lead} days`) : null,
      ),
    );
  }
  refreshPreview();
  const previewSec = h("aside", { class: "card section preview-sec", "aria-label": "Preview" }, h("h2", "How it will look"), previewBox, h("p", { class: "hint" }, "A rough preview. The real shop page may look a little different."));

  // ---- Save bar
  const errBox = h("div", { class: "error-summary", role: "alert", hidden: true, tabindex: "-1" });
  const progress = h("p", { class: "save-progress", "aria-live": "polite" });
  const saveBtn = h("button", { type: "button", class: "btn btn-primary btn-lg", id: "pe-save", onclick: save }, "Save");
  const bar = h("div", { class: "savebar" }, progress, h("div", { class: "savebar-row" },
    h("button", { type: "button", class: "btn btn-ghost", onclick: () => go("#/products") }, "Cancel"), saveBtn));

  async function save() {
    errBox.hidden = true;
    if (isBusy(draft.images)) { toast("Hold on, your photos are still getting ready.", "info"); return; }
    const { product, errors } = fromDraft(draft, app.catalog);
    fillErrors(root, errors);
    if (errors.length) {
      showSummary(errors.map((e) => e.message));
      root.querySelector('[aria-invalid="true"]')?.focus?.();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (hasPending(draft.images)) {
        await uploadPending(draft.images, app.store, product.id, (done, total) => {
          progress.textContent = `Uploading photo ${Math.min(done + 1, total)} of ${total}…`;
          photos.refresh();
        });
        product.images = pathsOf(draft.images);
        photos.refresh();
        if (app.mode === "demo") toast("Demo mode: photos are kept inside the file, not uploaded anywhere.", "info");
      }
      progress.textContent = "Saving…";
      const wasNew = draft.isNew;
      const afterId = mode === "copy" ? id : null;
      const r = await commit((c) => {
        const i = c.products.findIndex((p) => p.id === product.id);
        if (!wasNew && i >= 0) c.products[i] = product;
        else if (afterId && c.products.some((p) => p.id === afterId)) c.products.splice(c.products.findIndex((p) => p.id === afterId) + 1, 0, product);
        else c.products.unshift(product);
      }, wasNew ? `Admin: add ${product.name}` : `Admin: update ${product.name}`);
      if (r.ok) {
        setDirty(false);
        location.hash = "#/products";
      } else if (r.errors) {
        showSummary(errorsToText(r.errors));
      } else if (r.conflict) {
        // keep the draft; refresh category choices from the newest data
        showSummary(["The shop changed somewhere else. Your edits are still here. Tap Save again."]);
      }
    } catch (e) {
      toast(e.message || "Couldn't save. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      progress.textContent = "";
    }
  }
  function showSummary(lines) {
    errBox.replaceChildren(h("strong", "Please fix this:"), h("ul", lines.map((l) => h("li", l))));
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
    errBox.focus({ preventScroll: true });
  }

  updateIdNote();
  const root = h("form", { class: "view editor", novalidate: true, onsubmit: (e) => e.preventDefault() },
    h("div", { class: "view-head" },
      h("a", { class: "back", href: "#/products", onclick: (e) => { e.preventDefault(); go("#/products"); } }, "← Products"),
      h("h1", { id: "view-title", tabindex: "-1" }, heading),
    ),
    errBox,
    h("div", { class: "editor-grid" },
      h("div", { class: "editor-main" }, basics, photoSec, priceSec, optSec, persSec, visSec),
      previewSec,
    ),
    bar,
  );
  return autoClearErrors(root);
}
