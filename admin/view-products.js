// Products tab: searchable list with quick toggles.
import { h, switchEl, badge, confirmBox, toast } from "./ui.js";
import { app, commit, go, errorsToText } from "./state.js";
import { bundlesUsing } from "./validate.js";
import { formatPrice, resolveAsset } from "../js/catalog.js";
import { plural } from "./util.js";

const filters = { q: "", cat: "", status: "" };

export function thumb(images, cls = "") {
  const src = images?.[0];
  return src
    ? h("img", { class: `thumb ${cls}`, src: resolveAsset(src), alt: "", loading: "lazy" })
    : h("span", { class: `thumb thumb-empty ${cls}`, "aria-hidden": "true" }, "No photo");
}

export function productsView() {
  const cat = app.catalog;
  const results = h("div", { class: "cards", id: "product-results" });
  const countLine = h("p", { class: "muted", id: "product-count", "aria-live": "polite" });

  const q = h("input", {
    type: "search", id: "p-search", value: filters.q, placeholder: "Search products…", "aria-label": "Search products", autocomplete: "off",
    oninput: (e) => { filters.q = e.target.value; renderList(); },
  });
  const catSel = h("select", { id: "p-cat", "aria-label": "Filter by category", onchange: (e) => { filters.cat = e.target.value; renderList(); } },
    h("option", { value: "" }, "All categories"),
    cat.categories.map((c) => h("option", { value: c.id, selected: c.id === filters.cat }, c.name)),
  );
  const statusSel = h("select", { id: "p-status", "aria-label": "Filter by status", onchange: (e) => { filters.status = e.target.value; renderList(); } },
    [["", "All"], ["active", "Showing"], ["hidden", "Hidden"], ["featured", "Featured"]].map(([v, l]) => h("option", { value: v, selected: v === filters.status }, l)),
  );

  function renderList() {
    const term = filters.q.trim().toLowerCase();
    const list = cat.products.filter((p) => {
      if (filters.cat && p.category !== filters.cat) return false;
      if (filters.status === "active" && p.active === false) return false;
      if (filters.status === "hidden" && p.active !== false) return false;
      if (filters.status === "featured" && !p.featured) return false;
      if (term && !`${p.name} ${(p.tags || []).join(" ")} ${p.id}`.toLowerCase().includes(term)) return false;
      return true;
    });
    const hidden = cat.products.filter((p) => p.active === false).length;
    countLine.textContent = `${plural(cat.products.length, "product")} · ${cat.products.length - hidden} showing · ${hidden} hidden${list.length !== cat.products.length ? ` · ${list.length} match` : ""}`;
    results.replaceChildren();
    if (!cat.products.length) {
      results.append(h("div", { class: "empty" }, h("p", "No products yet."), h("a", { class: "btn btn-primary", href: "#/products/new" }, "+ Add your first product")));
      return;
    }
    if (!list.length) results.append(h("div", { class: "empty" }, h("p", "Nothing matches that search."), h("button", { type: "button", class: "btn btn-secondary", onclick: () => { Object.assign(filters, { q: "", cat: "", status: "" }); q.value = ""; catSel.value = ""; statusSel.value = ""; renderList(); } }, "Clear search")));
    for (const p of list) results.append(productCard(p));
  }

  renderList();
  return h(
    "section",
    { class: "view" },
    h("div", { class: "view-head" },
      h("h1", { tabindex: "-1", id: "view-title" }, "Products"),
      h("a", { class: "btn btn-primary btn-lg add-btn", href: "#/products/new" }, "+ Add product"),
    ),
    countLine,
    h("div", { class: "filters" }, q, catSel, statusSel),
    results,
  );
}

function productCard(p) {
  const cat = app.catalog.categories.find((c) => c.id === p.category);
  const hiddenNow = p.active === false;
  return h(
    "article",
    { class: `card pcard ${hiddenNow ? "is-hidden" : ""}`, "data-id": p.id },
    h("a", { class: "pcard-main", href: `#/products/edit/${encodeURIComponent(p.id)}`, "aria-label": `Edit ${p.name}` },
      thumb(p.images),
      h("div", { class: "pcard-body" },
        h("h2", p.name),
        h("p", { class: "price" }, formatPrice(p.price), p.compareAtPrice ? h("s", { class: "was" }, formatPrice(p.compareAtPrice)) : null),
        h("p", { class: "muted" }, cat ? cat.name : "No category"),
        h("div", { class: "badges" },
          hiddenNow ? badge("Hidden", "hidden") : badge("Active", "ok"),
          p.featured && badge("Featured", "feat"),
        ),
      ),
    ),
    h("div", { class: "pcard-controls" },
      switchEl({
        label: "Showing in shop", checked: !hiddenNow,
        onChange: (v, el) => quick(p, { active: v }, el, `${v ? "Show" : "Hide"} ${p.name}`),
      }),
      switchEl({ label: "Featured", checked: !!p.featured, onChange: (v, el) => quick(p, { featured: v }, el, `${v ? "Feature" : "Unfeature"} ${p.name}`) }),
      h("div", { class: "card-buttons" },
        h("a", { class: "btn btn-small btn-secondary", href: `#/products/edit/${encodeURIComponent(p.id)}` }, "Edit"),
        h("a", { class: "btn btn-small btn-secondary", href: `#/products/copy/${encodeURIComponent(p.id)}` }, "Duplicate"),
        h("button", { type: "button", class: "btn btn-small btn-ghost-danger", onclick: () => deleteProduct(p) }, "Delete"),
      ),
    ),
  );
}

async function quick(p, patch, el, message) {
  el.disabled = true;
  const r = await commit((c) => {
    const t = c.products.find((x) => x.id === p.id);
    if (!t) throw new Error("That product isn't in the shop any more. Try reloading.");
    Object.assign(t, patch);
  }, `Admin: ${message}`);
  if (!r.ok && r.errors) toast(errorsToText(r.errors)[0], "error");
  if (!r.ok) el.checked = !el.checked;
  el.disabled = false;
}

export async function deleteProduct(p) {
  const used = bundlesUsing(app.catalog, p.id);
  const message = used.length
    ? `"${p.name}" is part of ${plural(used.length, "bundle")}: ${used.map((b) => b.name).join(", ")}. If you delete it, it will also be taken out of ${used.length === 1 ? "that bundle" : "those bundles"}, and any bundle left empty will be hidden. This can't be undone.`
    : `Delete "${p.name}"? This can't be undone.`;
  const ok = await confirmBox({ title: "Delete this product?", message, confirmLabel: "Yes, delete it", danger: true });
  if (!ok) return;
  await commit((c) => {
    c.products = c.products.filter((x) => x.id !== p.id);
    const emptied = [];
    for (const b of c.bundles) {
      const before = b.items.length;
      b.items = b.items.filter((i) => i.productId !== p.id);
      if (before !== b.items.length && !b.items.length) {
        b.active = false;
        emptied.push(b.name);
      }
    }
    return emptied.length ? `Hidden because they're now empty: ${emptied.join(", ")}.` : "";
  }, `Admin: delete ${p.name}`);
}
