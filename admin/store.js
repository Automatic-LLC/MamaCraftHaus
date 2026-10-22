// Storage interface for the admin. Anything that implements these can be swapped in
// (see docs/SUPABASE.md for a SupabaseStore):
//
//   store.kind                       "github" | "demo" | "supabase"
//   await store.load()            -> { categories, products, bundles }   newest data
//   await store.save(catalog, msg)   persist the whole catalog (throws ConflictError if it changed elsewhere)
//   await store.uploadImage(blob, { slug, blobToBase64 }) -> string  path/URL to put in product.images
//
import { config } from "../js/config.js";
import { loadCatalog } from "../js/catalog.js";
import { GitHubStore } from "./github.js";
import { blobToDataURL } from "./images.js";

const K = { token: "mch_admin_token", settings: "mch_admin_settings", mode: "mch_admin_mode", demo: "mch_admin_demo_catalog" };

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};

export function loadSettings() {
  const d = config.github;
  let saved = {};
  try {
    saved = JSON.parse(read(K.settings) || "{}");
  } catch {
    /* ignore */
  }
  return {
    owner: saved.owner || d.owner,
    repo: saved.repo || d.repo,
    branch: saved.branch || d.branch,
    catalogPath: d.catalogPath,
    imageDir: d.imageDir,
  };
}
export const saveSettings = ({ owner, repo, branch }) => write(K.settings, JSON.stringify({ owner, repo, branch }));
export const getToken = () => read(K.token) || "";
export const setToken = (t) => write(K.token, t);
export const clearToken = () => write(K.token, null);
export const getMode = () => read(K.mode) || "";
export const setMode = (m) => write(K.mode, m || null);

// ---------- Demo mode ----------
export class DemoStore {
  constructor() {
    this.kind = "demo";
    this.persisted = true;
  }
  async load() {
    const saved = read(K.demo);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        return { ...d, categories: d.categories || [], products: d.products || [], bundles: d.bundles || [] };
      } catch {
        /* fall back to the shipped catalog */
      }
    }
    return loadCatalog();
  }
  async save(catalog) {
    this.persisted = write(K.demo, JSON.stringify(catalog)); // may fail when photos make it too big
    return {};
  }
  async uploadImage(blob) {
    return blobToDataURL(blob); // demo photos live inside the JSON as data URLs
  }
  reset() {
    write(K.demo, null);
  }
}

export function createStore(mode, settings, token) {
  if (mode === "demo") return new DemoStore();
  return new GitHubStore({ ...settings, token });
}
