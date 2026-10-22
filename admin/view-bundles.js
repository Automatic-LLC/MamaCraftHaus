// Bundles tab: list + builder.
import { h, field, switchEl, badge, confirmBox, toast, fillErrors, autoClearErrors } from "./ui.js";
import { app, commit, go, setDirty, errorsToText } from "./state.js";
import { photoManager, itemsFromPaths, isBusy, hasPending, pathsOf, uploadPending } from "./photos.js";
import { thumb } from "./view-products.js";
import { formatPrice, bundleRetailTotal, resolveAsset } from "../js/catalog.js";
import { slugify, uniqueSlug, parseMoney, suggestPrice, round2, plural } from "./util.js";

const bundleThumbImages = (b) => (b.images?.length ? b.images : (() => {
  const first = b.items.map((i) => app.catalog.products.find((p) => p.id === i.productId)).find((p) => p?.images?.[0]);
  return first ? [first.images[0]] : [];
})());

// ---------------- List ----------------
export function bundlesView() {
  const cat = app.catalog;
  return h("section", { class: "view" },
    h("div", { class: "view-head" },
      h("h1", { tabindex: "-1", id: "view-title" }, "Bundles"),
      h("a", { class: "btn btn-primary btn-lg add-btn", href: "#/bundles/new" }, "+ Add bundle"),
    ),
    h("p", { class: "muted" }, "A bundle is a set of products sold together for one price."),
    cat.bundles.length
      ? h("div", { class: "cards" }, cat.bundles.map(bundleCard))
      : h("div", { class: "empty" }, h("p", "No bundles yet."), h("a", { class: "btn btn-primary", href: "#/bundles/new" }, "+ Create your first bundle")),
  );
}

function bundleCard(b) {
  const total = bundleRetailTotal(app.catalog, b);
  const save = round2(total - b.price);
  const hiddenNow = b.active === false;
  const href = `#/bundles/edit/${encodeURIComponent(b.id)}`;
  const quick = async (patch, el, msg) => {
    el.disabled = true;
    const r = await commit((c) => Object.assign(c.bundles.find((x) => x.id === b.id), patch), `Admin: ${msg} ${b.name}`);
    if (!r.ok) {
      el.checked = !el.checked;
      if (r.errors) toast(errorsToText(r.errors)[0], "error");
    }
    el.disabled = false;
  };
  return h("article", { class: `card pcard ${hiddenNow ? "is-hidden" : ""}` },
    h("a", { class: "pcard-main", href, "aria-label": `Edit ${b.name}` },
      thumb(bundleThumbImages(b)),
      h("div", { class: "pcard-body" },
        h("h2", b.name),
        h("p", { class: "price" }, formatPrice(b.price), total > b.price ? h("s", { class: "was" }, formatPrice(total)) : null),
        h("p", { class: "muted" }, `${plural(b.items.reduce((n, i) => n + i.qty, 0), "item")}${save > 0 ? ` · customer saves ${formatPrice(save)}` : ""}`),
        h("div", { class: "badges" }, hiddenNow ? badge("Hidden", "hidden") : badge("Active", "ok"), b.featured && badge("Featured", "feat")),
      ),
    ),
    h("div", { class: "pcard-controls" },
      switchEl({ label: "Showing in shop", checked: !hiddenNow, onChange: (v, el) => quick({ active: v }, el, v ? "show" : "hide") }),
      switchEl({ label: "Featured", checked: !!b.featured, onChange: (v, el) => quick({ featured: v }, el, v ? "feature" : "unfeature") }),
      h("div", { class: "card-buttons" },
        h("a", { class: "btn btn-small btn-secondary", href }, "Edit"),
        h("button", { type: "button", class: "btn btn-small btn-ghost-danger", onclick: async () => {
          if (!(await confirmBox({ title: "Delete this bundle?", message: `Delete "${b.name}"? The products inside stay in your shop. This can't be undone.`, confirmLabel: "Yes, delete it", danger: true }))) return;
          await commit((c) => { c.bundles = c.bundles.filter((x) => x.id !== b.id); }, `Admin: delete bundle ${b.name}`);
        } }, "Delete"),
      ),
    ),
  );
}

// ---------------- Editor ----------------
export function bundleEditView({ id }) {
  const existing = id ? app.catalog.bundles.find((b) => b.id === id) : null;
  if (id && !existing) {
    return h("section", { class: "view" }, h("h1", { id: "view-title", tabindex: "-1" }, "Bundle not found"), h("a", { class: "btn btn-primary", href: "#/bundles" }, "Back to bundles"));
  }
  const b = existing || { name: "", description: "", items: [], price: "", images: [], featured: false, active: true };
  const draft = {
    isNew: !existing,
    id: existing?.id || "",
    name: b.name, description: b.description,
    items: b.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    price: existing ? String(b.price) : "",
    priceTouched: !!existing,
    pct: "10",
    images: itemsFromPaths(b.images),
    featured: !!b.featured, active: b.active !== false,
    extra: existing ? Object.fromEntries(Object.entries(existing).filter(([k]) => !["id", "name", "description", "items", "price", "images", "featured", "active"].includes(k))) : {},
  };
  const dirty = () => setDirty(true);
  const productOf = (pid) => app.catalog.products.find((p) => p.id === pid);
  const totalNow = () => bundleRetailTotal(app.catalog, { items: draft.items });

  const nameIn = h("input", { type: "text", id: "be-name", value: draft.name, oninput: (e) => { draft.name = e.target.value; dirty(); } });
  const descIn = h("textarea", { id: "be-desc", rows: "4", oninput: (e) => { draft.description = e.target.value; dirty(); } });
  descIn.value = draft.description;

  // ---- picker
  const itemsEl = h("ul", { class: "bundle-items" });
  const resultsEl = h("ul", { class: "picker-results" });
  const searchIn = h("input", { type: "search", id: "be-search", placeholder: "Search your products…", autocomplete: "off", "aria-label": "Search products to add", oninput: renderResults });

  function renderResults() {
    const term = searchIn.value.trim().toLowerCase();
    const list = app.catalog.products.filter((p) => !term || `${p.name} ${p.id} ${(p.tags || []).join(" ")}`.toLowerCase().includes(term));
    resultsEl.replaceChildren();
    if (!list.length) resultsEl.append(h("li", { class: "muted pad" }, "No products found."));
    for (const p of list) {
      const have = draft.items.find((i) => i.productId === p.id);
      resultsEl.append(h("li", { class: "pick" },
        thumb(p.images, "thumb-sm"),
        h("span", { class: "pick-name" }, p.name, h("small", formatPrice(p.price))),
        h("button", { type: "button", class: "btn btn-small btn-secondary", "aria-label": `Add ${p.name}`, onclick: () => { addItem(p.id); } }, have ? `Added ×${have.qty} · +1` : "+ Add"),
      ));
    }
  }
  function addItem(pid) {
    const have = draft.items.find((i) => i.productId === pid);
    if (have) have.qty = Math.min(99, have.qty + 1);
    else draft.items.push({ productId: pid, qty: 1 });
    itemsChanged();
  }
  function renderItems() {
    itemsEl.replaceChildren();
    if (!draft.items.length) itemsEl.append(h("li", { class: "photo-empty" }, "Nothing added yet. Search above and tap “+ Add”."));
    draft.items.forEach((it, i) => {
      const p = productOf(it.productId);
      itemsEl.append(h("li", { class: "bitem" },
        thumb(p?.images, "thumb-sm"),
        h("span", { class: "pick-name" }, p ? p.name : `Missing product (${it.productId})`, h("small", p ? formatPrice(p.price) + " each" : "Remove this")),
        h("div", { class: "stepper", role: "group", "aria-label": `Quantity of ${p?.name || it.productId}` },
          h("button", { type: "button", class: "icon-btn", "aria-label": "One less", disabled: it.qty <= 1, onclick: () => { it.qty--; itemsChanged(); } }, "−"),
          h("input", { type: "number", min: "1", max: "99", inputmode: "numeric", value: it.qty, "aria-label": "Quantity", onchange: (e) => { it.qty = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)); itemsChanged(); } }),
          h("button", { type: "button", class: "icon-btn", "aria-label": "One more", disabled: it.qty >= 99, onclick: () => { it.qty++; itemsChanged(); } }, "+"),
        ),
        h("button", { type: "button", class: "icon-btn icon-danger", "aria-label": `Remove ${p?.name || "item"}`, onclick: () => { draft.items.splice(i, 1); itemsChanged(); } }, "×"),
      ));
    });
  }
  function itemsChanged() {
    renderItems();
    renderResults();
    refreshMoney(true);
    dirty();
  }

  // ---- money
  const totalOut = h("strong", { id: "be-total" });
  const suggestOut = h("strong", { id: "be-suggest" });
  const saveOut = h("p", { class: "savings", "aria-live": "polite", id: "be-saves" });
  const priceIn = h("input", { type: "number", id: "be-price", inputmode: "decimal", step: "0.01", min: "0", value: draft.price, placeholder: "0.00", oninput: (e) => { draft.price = e.target.value; draft.priceTouched = true; refreshMoney(false); dirty(); } });
  const pctIn = h("input", { type: "number", id: "be-pct", inputmode: "numeric", min: "0", max: "90", step: "1", value: draft.pct, "aria-label": "Discount percent", oninput: (e) => { draft.pct = e.target.value; refreshMoney(false, true); } });
  function refreshMoney(itemsJustChanged, pctJustChanged) {
    const total = round2(totalNow());
    const sugg = suggestPrice(total, parseFloat(draft.pct) || 0);
    totalOut.textContent = formatPrice(total);
    suggestOut.textContent = formatPrice(sugg);
    if ((itemsJustChanged || pctJustChanged) && !draft.priceTouched && draft.items.length) {
      draft.price = String(sugg);
      priceIn.value = draft.price;
    }
    const price = parseMoney(draft.price);
    if (!draft.items.length || !Number.isFinite(price)) saveOut.textContent = "";
    else if (price < total) { const s = round2(total - price); saveOut.textContent = `Customer saves ${formatPrice(s)} (${Math.round((s / total) * 100)}% off)`; saveOut.className = "savings good"; }
    else if (price === total) { saveOut.textContent = "Same as buying separately. No savings."; saveOut.className = "savings"; }
    else { saveOut.textContent = `Heads up: this costs ${formatPrice(round2(price - total))} more than buying the items separately.`; saveOut.className = "savings warn"; }
  }

  const photos = photoManager(draft.images, { onChange: dirty, emptyText: "Optional. If you skip this, the shop shows the first product's photo." });

  const errBox = h("div", { class: "error-summary", role: "alert", hidden: true, tabindex: "-1" });
  const progress = h("p", { class: "save-progress", "aria-live": "polite" });
  const saveBtn = h("button", { type: "button", class: "btn btn-primary btn-lg", id: "be-save", onclick: save }, "Save");

  const showSummary = (lines) => {
    errBox.replaceChildren(h("strong", "Please fix this:"), h("ul", lines.map((l) => h("li", l))));
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
    errBox.focus({ preventScroll: true });
  };

  async function save() {
    errBox.hidden = true;
    if (isBusy(draft.images)) return toast("Hold on, your photos are still getting ready.", "info");
    const errors = [];
    const name = draft.name.trim();
    if (!name) errors.push({ field: "name", message: "Please give this bundle a name." });
    const price = parseMoney(draft.price);
    if (!Number.isFinite(price) || price < 0) errors.push({ field: "price", message: "Please enter the bundle price." });
    if (!draft.items.length) errors.push({ field: "items", message: "Add at least one product to the bundle." });
    for (const it of draft.items) if (!productOf(it.productId)) errors.push({ field: "items", message: `A product in this bundle no longer exists. Remove "${it.productId}".` });
    fillErrors(root, errors);
    if (errors.length) return showSummary(errors.map((e) => e.message));

    const bid = draft.isNew ? uniqueSlug(slugify(name) || "bundle", app.catalog.bundles.map((x) => x.id)) : draft.id;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (hasPending(draft.images)) {
        await uploadPending(draft.images, app.store, bid, (done, total) => { progress.textContent = `Uploading photo ${Math.min(done + 1, total)} of ${total}…`; photos.refresh(); });
        photos.refresh();
      }
      progress.textContent = "Saving…";
      const bundle = { ...draft.extra, id: bid, name, description: draft.description.trim(), items: draft.items.map((i) => ({ productId: i.productId, qty: i.qty })), price, images: pathsOf(draft.images), featured: draft.featured, active: draft.active };
      const wasNew = draft.isNew;
      const r = await commit((c) => {
        const i = c.bundles.findIndex((x) => x.id === bid);
        if (!wasNew && i >= 0) c.bundles[i] = bundle; else c.bundles.unshift(bundle);
      }, wasNew ? `Admin: add bundle ${name}` : `Admin: update bundle ${name}`);
      if (r.ok) { setDirty(false); location.hash = "#/bundles"; }
      else if (r.errors) showSummary(errorsToText(r.errors));
      else if (r.conflict) showSummary(["The shop changed somewhere else. Your edits are still here. Tap Save again."]);
    } catch (e) {
      toast(e.message || "Couldn't save. Please try again.", "error");
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = "Save"; progress.textContent = "";
    }
  }

  const card = (title, ...kids) => h("section", { class: "card section" }, h("h2", title), kids);
  const root = h("form", { class: "view editor", novalidate: true, onsubmit: (e) => e.preventDefault() },
    h("div", { class: "view-head" },
      h("a", { class: "back", href: "#/bundles", onclick: (e) => { e.preventDefault(); go("#/bundles"); } }, "← Bundles"),
      h("h1", { id: "view-title", tabindex: "-1" }, draft.isNew ? "Create a bundle" : "Edit bundle"),
    ),
    errBox,
    h("div", { class: "editor-main single" },
      card("The basics", field("Bundle name", nameIn, { errKey: "name" }), field("Description", descIn, { hint: "What's in the set and why it makes a great gift." })),
      card("What's in it?",
        h("p", { class: "field-error", "data-err": "items", role: "alert" }),
        itemsEl,
        h("h3", { class: "sub" }, "Add products"),
        searchIn,
        resultsEl,
      ),
      card("Price",
        h("div", { class: "money-box" },
          h("p", "Items total (bought separately): ", totalOut),
          h("div", { class: "row-inline" }, h("label", { for: "be-pct" }, "Discount"), pctIn, h("span", "%")),
          h("p", "Suggested bundle price: ", suggestOut, h("button", { type: "button", class: "btn btn-small btn-secondary", onclick: () => { const s = suggestPrice(round2(totalNow()), parseFloat(draft.pct) || 0); draft.price = String(s); draft.priceTouched = true; priceIn.value = draft.price; refreshMoney(); dirty(); } }, "Use this price")),
        ),
        field("Bundle price ($)", priceIn, { errKey: "price" }),
        saveOut,
      ),
      card("Photos (optional)", photos),
      card("Show in the shop",
        switchEl({ label: "Showing in the shop", hint: "Turn off to hide this bundle.", checked: draft.active, onChange: (v) => { draft.active = v; dirty(); } }),
        switchEl({ label: "Featured", hint: "Featured bundles appear on the home page.", checked: draft.featured, onChange: (v) => { draft.featured = v; dirty(); } }),
      ),
    ),
    h("div", { class: "savebar" }, progress, h("div", { class: "savebar-row" }, h("button", { type: "button", class: "btn btn-ghost", onclick: () => go("#/bundles") }, "Cancel"), saveBtn)),
  );
  renderItems();
  renderResults();
  refreshMoney();
  return autoClearErrors(root);
}
