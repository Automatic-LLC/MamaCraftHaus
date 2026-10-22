import { loadCatalog, getActiveProducts, getActiveBundles } from "./catalog.js";
import { esc, $, $$, productCard, bundleCard, showError, friendlyLoadError } from "./ui.js";

const params = new URLSearchParams(location.search);
let category = params.get("category") || "all";
let query = params.get("q") || "";

try {
  const catalog = await loadCatalog();
  const products = getActiveProducts(catalog);
  const bundles = getActiveBundles(catalog);
  const catName = (id) => (catalog.categories.find((c) => c.id === id) || {}).name || "";
  const validCats = new Set(["all", ...catalog.categories.map((c) => c.id), ...(bundles.length ? ["bundles"] : [])]);
  if (!validCats.has(category)) category = "all";

  const chips = [{ id: "all", name: "All" }, ...catalog.categories, ...(bundles.length ? [{ id: "bundles", name: "Bundles & Gift Sets" }] : [])];
  $("#chips").innerHTML = chips.map((c) => `<button type="button" class="chip" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join("");
  $("#search").value = query;

  const matches = (text) => text.toLowerCase().includes(query.trim().toLowerCase());
  const pHay = (p) => [p.name, p.description, catName(p.category), (p.tags || []).join(" ")].join(" ");
  const bHay = (b) => [b.name, b.description, "bundle gift set"].join(" ");

  function render() {
    $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === category)));
    const showProducts = category !== "bundles";
    const showBundles = category === "all" || category === "bundles";
    const ps = showProducts ? products.filter((p) => (category === "all" || p.category === category) && matches(pHay(p))) : [];
    const bs = showBundles ? bundles.filter((b) => matches(bHay(b))) : [];

    $("#products").innerHTML = ps.map((p) => productCard(p, catName(p.category))).join("");
    $("#products").hidden = !ps.length;
    $("#products").removeAttribute("aria-busy");
    $("#bundles").innerHTML = bs.map((b) => bundleCard(catalog, b)).join("");
    $("#bundles-block").hidden = !bs.length;
    $("#empty").hidden = ps.length + bs.length > 0;
    const total = ps.length + bs.length;
    $("#result-count").textContent = total ? `${total} ${total === 1 ? "item" : "items"}` : "";

    const next = new URLSearchParams();
    if (category !== "all") next.set("category", category);
    if (query.trim()) next.set("q", query.trim());
    const qs = next.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }

  $("#chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    category = btn.dataset.cat;
    render();
  });
  $("#search").addEventListener("input", (e) => {
    query = e.target.value;
    render();
  });
  render();
} catch (err) {
  console.warn(err);
  showError($("#products"), friendlyLoadError);
}
