// Mama Craft Haus admin: boot, sign-in, shell and router.
import { h, toast, confirmBox, clear } from "./ui.js";
import { app, onChange, go, setDirty, notify, errorMessage } from "./state.js";
import { loadSettings, createStore, getToken, setToken, clearToken, getMode, setMode } from "./store.js";
import { GitHubError } from "./github.js";
import { signInView } from "./view-signin.js";
import { productsView } from "./view-products.js";
import { productEditView } from "./view-product-edit.js";
import { bundlesView, bundleEditView } from "./view-bundles.js";
import { categoriesView } from "./view-categories.js";
import { settingsView } from "./view-settings.js";
import { downloadText, toJSON } from "./util.js";

const root = document.getElementById("app");
app.settings = loadSettings();

// Match the browser/phone toolbar to the theme without hard-coding a color.
try {
  const meta = document.querySelector('meta[name="theme-color"]');
  const c = getComputedStyle(document.documentElement).getPropertyValue("--cream-50").trim();
  if (meta && c) meta.setAttribute("content", c);
} catch { /* optional */ }

app.actions = {
  async signOut() {
    if (app.dirty && !(await confirmBox({ title: "Sign out without saving?", message: "You have changes that haven't been saved yet.", confirmLabel: "Sign out anyway", cancelLabel: "Stay", danger: true }))) return;
    setDirty(false);
    clearToken();
    setMode("");
    app.store = app.catalog = null;
    location.hash = "";
    showSignIn();
  },
  async reconnect() {
    setDirty(false);
    await boot();
  },
};

// ---------------- Boot ----------------
async function boot() {
  const token = getToken();
  if (token) return connectGitHub(token, { fromStorage: true });
  if (getMode() === "demo") return startDemo();
  showSignIn();
}

async function connectGitHub(token, { fromStorage = false } = {}) {
  const store = createStore("github", app.settings, token);
  try {
    await store.verify();
    app.catalog = await store.load();
  } catch (e) {
    const msg = errorMessage(e);
    if (e instanceof GitHubError && e.kind === "network" && fromStorage) return showProblem(msg);
    if (fromStorage && e instanceof GitHubError && ["auth", "permission"].includes(e.kind)) clearToken();
    if (fromStorage) return showSignIn(msg);
    return msg; // returned to the sign-in form
  }
  setToken(token);
  setMode("github");
  app.store = store;
  app.mode = "github";
  showShell();
}

async function startDemo() {
  try {
    const store = createStore("demo");
    app.catalog = await store.load();
    app.store = store;
  } catch (e) {
    return showProblem(`Demo couldn't load the sample shop: ${errorMessage(e)}`);
  }
  setMode("demo");
  app.mode = "demo";
  showShell();
}

function showSignIn(message) {
  window.onbeforeunload = null;
  document.title = "Shop admin · Mama Craft Haus";
  clear(root).append(signInView({
    settings: app.settings, message,
    onConnect: (token) => connectGitHub(token),
    onDemo: () => { clearToken(); startDemo(); },
  }));
}

function showProblem(message) {
  clear(root).append(h("main", { class: "signin" }, h("div", { class: "signin-inner" },
    h("h1", "Can't open your shop"),
    h("p", { class: "lead" }, message),
    h("div", { class: "btn-row" },
      h("button", { type: "button", class: "btn btn-primary", onclick: boot }, "Try again"),
      h("button", { type: "button", class: "btn btn-ghost-danger", onclick: app.actions.signOut }, "Sign out"),
    ),
  )));
}

// ---------------- Shell ----------------
const TABS = [
  ["products", "Products", () => app.catalog.products.length],
  ["bundles", "Bundles", () => app.catalog.bundles.length],
  ["categories", "Categories", () => app.catalog.categories.length],
  ["settings", "Settings", null],
];
let main, nav, shell;
let currentHash = "";

function showShell() {
  const demo = app.mode === "demo";
  main = h("main", { id: "main", class: "main" });
  nav = h("nav", { class: "tabs", "aria-label": "Sections" });
  shell = h("div", { class: "shell" },
    h("a", { class: "skip", href: "#main", onclick: (e) => { e.preventDefault(); main.focus(); } }, "Skip to content"),
    h("header", { class: "topbar" },
      h("div", { class: "topbar-in" },
        h("span", { class: "brand" }, "Mama Craft Haus ", h("small", "Admin")),
        h("span", { class: `pill ${demo ? "pill-demo" : "pill-live"}`, id: "mode-pill" }, demo ? "Demo mode" : `${app.settings.owner}/${app.settings.repo}`),
        h("a", { class: "toplink", href: "../", target: "_blank", rel: "noopener" }, "View site"),
        h("button", { type: "button", class: "toplink", id: "signout-top", onclick: () => app.actions.signOut() }, demo ? "Exit demo" : "Sign out"),
      ),
      nav,
    ),
    demo && h("div", { class: "demo-banner", role: "note" },
      h("span", "Demo mode: your changes stay in this browser and are not published."),
      h("button", { type: "button", class: "btn btn-small btn-secondary", id: "banner-download", onclick: () => downloadText("products.json", toJSON(app.catalog)) }, "Download products.json"),
    ),
    main,
  );
  clear(root).append(shell);
  if (!location.hash || location.hash === "#") history.replaceState(null, "", "#/products");
  currentHash = location.hash;
  window.onbeforeunload = (e) => (app.dirty ? ((e.returnValue = ""), "") : undefined);
  renderRoute();
}

function renderNav(active) {
  nav.replaceChildren(
    ...TABS.map(([key, label, count]) =>
      h("a", { class: `tab ${key === active ? "is-active" : ""}`, href: `#/${key}`, "aria-current": key === active ? "page" : null },
        h("span", label), count ? h("span", { class: "count" }, count()) : null),
    ),
  );
}

let live = false;
let activeTab = "products";
function renderRoute({ keepScroll = false } = {}) {
  if (!app.catalog || !main) return;
  const parts = location.hash.replace(/^#\/?/, "").split("/").map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const [tab = "products", action, id] = parts;
  let view, title = "Products";
  live = false;
  let editor = false;
  activeTab = tab;
  if (tab === "bundles") {
    if (action === "new") (view = bundleEditView({})), (editor = true), (title = "New bundle");
    else if (action === "edit" && id) (view = bundleEditView({ id })), (editor = true), (title = "Edit bundle");
    else (view = bundlesView()), (live = true), (title = "Bundles");
  } else if (tab === "categories") (view = categoriesView()), (title = "Categories");
  else if (tab === "settings") (view = settingsView()), (live = true), (title = "Settings");
  else {
    activeTab = "products";
    if (action === "new") (view = productEditView({})), (editor = true), (title = "Add product");
    else if (action === "edit" && id) (view = productEditView({ id, mode: "edit" })), (editor = true), (title = "Edit product");
    else if (action === "copy" && id) (view = productEditView({ id, mode: "copy" })), (editor = true), (title = "Duplicate product");
    else (view = productsView()), (live = true);
  }
  const y = window.scrollY;
  main.replaceChildren(view);
  shell.classList.toggle("is-editor", editor);
  document.title = `${title} · Mama Craft Haus admin`;
  renderNav(activeTab);
  if (keepScroll) window.scrollTo(0, y);
  else {
    window.scrollTo(0, 0);
    const t = main.querySelector("#view-title");
    t?.focus({ preventScroll: true });
  }
}

window.addEventListener("hashchange", () => {
  if (!app.catalog) return;
  if (app.dirty && location.hash !== currentHash) {
    const target = location.hash;
    history.replaceState(null, "", currentHash || "#/products"); // undo the move, then ask
    go(target);
    return;
  }
  currentHash = location.hash;
  renderRoute();
});

onChange(() => {
  if (!app.catalog || !main) return;
  if (live) renderRoute({ keepScroll: true });
  else renderNav(activeTab);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
  toast("Something unexpected went wrong. Please try again.", "error");
});

boot();
