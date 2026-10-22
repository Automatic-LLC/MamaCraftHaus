import { loadCatalog, getActiveProducts, getActiveBundles, resolveAsset } from "./catalog.js";
import { esc, $, productCard, bundleCard, showError, friendlyLoadError } from "./ui.js";

try {
  const catalog = await loadCatalog();
  const products = getActiveProducts(catalog);
  const catName = (id) => (catalog.categories.find((c) => c.id === id) || {}).name || "";

  $("#categories").innerHTML = catalog.categories
    .map(
      (c) => `<a class="tile" href="shop.html?category=${encodeURIComponent(c.id)}">
        <img src="${esc(resolveAsset(c.image))}" alt="" loading="lazy" width="600" height="600">
        <span class="tile-body"><span class="tile-name">${esc(c.name)}</span><span class="tile-desc">${esc(c.description)}</span></span>
      </a>`
    )
    .join("");

  let featured = products.filter((p) => p.featured);
  if (!featured.length) featured = products.slice(0, 4);
  $("#featured").innerHTML = featured.slice(0, 8).map((p) => productCard(p, catName(p.category))).join("");

  const bundles = getActiveBundles(catalog).filter((b) => b.featured);
  if (bundles.length) {
    $("#bundles").innerHTML = bundles.map((b) => bundleCard(catalog, b)).join("");
    $("#bundles-section").hidden = false;
  }
  ["#categories", "#featured"].forEach((s) => $(s).removeAttribute("aria-busy"));
} catch (err) {
  console.warn(err);
  for (const s of ["#categories", "#featured"]) showError($(s), friendlyLoadError);
}
