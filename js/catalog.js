// Data access layer. This is the only module that knows where catalog data lives.
// To move to Supabase later, change loadCatalog() (see docs/SUPABASE.md).
import { config } from "./config.js";

// Base URL of the site root, derived from this module's location (js/catalog.js → ../).
const SITE_ROOT = new URL("../", import.meta.url);

export function resolveAsset(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return new URL(path, SITE_ROOT).href;
}

export async function loadCatalog() {
  if (config.dataSource === "supabase") {
    throw new Error("Supabase data source not implemented yet — see docs/SUPABASE.md");
  }
  const res = await fetch(resolveAsset(config.github.catalogPath), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load catalog (${res.status})`);
  const data = await res.json();
  return {
    categories: data.categories || [],
    products: data.products || [],
    bundles: data.bundles || [],
  };
}

export const getActiveProducts = (c) => c.products.filter((p) => p.active !== false);
export const getActiveBundles = (c) => c.bundles.filter((b) => b.active !== false);
export const findProduct = (c, id) => c.products.find((p) => p.id === id);
export const findBundle = (c, id) => c.bundles.find((b) => b.id === id);
export const findCategory = (c, id) => c.categories.find((k) => k.id === id);

export function bundleRetailTotal(c, bundle) {
  return bundle.items.reduce((sum, it) => {
    const p = findProduct(c, it.productId);
    return sum + (p ? p.price * (it.qty || 1) : 0);
  }, 0);
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: config.currency });
export const formatPrice = (n) => fmt.format(Number(n) || 0);
