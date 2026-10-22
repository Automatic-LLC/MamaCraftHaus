// Shared app state + the single save pipeline every screen uses.
import { toast, confirmBox } from "./ui.js";
import { clone } from "./util.js";
import { normalizeCatalog, validateCatalog } from "./validate.js";
import { ConflictError, GitHubError } from "./github.js";

export const app = {
  store: null,
  mode: "", // "github" | "demo"
  catalog: null,
  dirty: false,
  settings: null,
};

const listeners = new Set();
export const onChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notify = () => listeners.forEach((fn) => fn());

export function setDirty(v) {
  app.dirty = !!v;
}

// Navigate, asking first if there are unsaved edits.
export async function go(hash) {
  if (app.dirty) {
    const leave = await confirmBox({
      title: "Leave without saving?",
      message: "You have changes that haven't been saved yet. If you leave now, they will be lost.",
      confirmLabel: "Leave without saving",
      cancelLabel: "Keep editing",
      danger: true,
    });
    if (!leave) return false;
    app.dirty = false;
  }
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
  return true;
}

export function errorMessage(e) {
  if (e instanceof GitHubError) return e.message;
  return e?.message || "Something went wrong. Please try again.";
}

export const savedMessage = () =>
  app.mode === "demo"
    ? "Saved in demo mode. Nothing was published, and it only lives in this browser."
    : "Saved! Your website will update in about a minute.";

// All writes are queued so two quick taps can never use a stale GitHub "sha".
let queue = Promise.resolve();

/**
 * commit(mutator, message): applies `mutator(draftCatalog)` to a copy, validates, saves.
 * Resolves { ok: true } | { ok: false, errors } | { ok: false, conflict: true } | { ok: false, error }.
 * `mutator` may return a string "note" that is appended to the success toast.
 */
export function commit(mutator, message, { silent = false } = {}) {
  const run = async () => {
    const next = clone(app.catalog);
    let note = "";
    try {
      note = mutator(next) || "";
    } catch (e) {
      toast(errorMessage(e), "error");
      return { ok: false, error: e };
    }
    const catalog = normalizeCatalog(next);
    const errors = validateCatalog(catalog);
    if (errors.length) return { ok: false, errors };
    try {
      await app.store.save(catalog, message);
      app.catalog = catalog;
      if (!silent) toast(savedMessage() + (note ? " " + note : ""), "ok");
      if (app.store.kind === "demo" && app.store.persisted === false) {
        toast("Heads up: this browser is full, so your demo changes won't survive a refresh. Use Download products.json.", "info", 9000);
      }
      notify();
      return { ok: true };
    } catch (e) {
      if (e instanceof ConflictError) {
        app.catalog = e.latest;
        toast(e.message, "error", 14000);
        notify();
        return { ok: false, conflict: true, error: e };
      }
      toast(errorMessage(e), "error");
      return { ok: false, error: e };
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

export function errorsToText(errors) {
  return errors.map((e) => `${e.where} ${e.message}`);
}
