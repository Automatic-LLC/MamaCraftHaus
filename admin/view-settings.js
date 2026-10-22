// Settings tab: repo details, live-site link, backup/restore, sign out.
import { h, field, toast, confirmBox, alertBox } from "./ui.js";
import { app, commit, errorsToText } from "./state.js";
import { saveSettings } from "./store.js";
import { downloadText, toJSON, plural } from "./util.js";
import { normalizeCatalog, validateCatalog } from "./validate.js";

export function settingsView() {
  const s = app.settings;
  const demo = app.mode === "demo";
  const owner = h("input", { type: "text", id: "st-owner", value: s.owner, autocapitalize: "none", autocomplete: "off", spellcheck: "false" });
  const repo = h("input", { type: "text", id: "st-repo", value: s.repo, autocapitalize: "none", autocomplete: "off", spellcheck: "false" });
  const branch = h("input", { type: "text", id: "st-branch", value: s.branch, autocapitalize: "none", autocomplete: "off", spellcheck: "false" });
  const siteUrl = new URL("../", location.href).href;
  const fileIn = h("input", { type: "file", accept: "application/json,.json", class: "file-input", "aria-label": "Choose a backup file", onchange: importFile });

  async function importFile() {
    const file = fileIn.files[0];
    fileIn.value = "";
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast("That file isn't a valid backup (it isn't readable JSON).", "error");
    }
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories)) {
      return toast("That file doesn't look like a shop backup. It needs “categories” and “products”.", "error");
    }
    const next = normalizeCatalog({ ...data, bundles: data.bundles || [] });
    const errors = validateCatalog(next);
    if (errors.length) {
      return alertBox("This backup has problems", h("div", h("p", "Fix these in the file and try again:"), h("ul", errorsToText(errors).slice(0, 8).map((l) => h("li", l)))));
    }
    const ok = await confirmBox({
      title: "Replace everything with this backup?",
      message: `This backup has ${plural(next.products.length, "product")}, ${plural(next.bundles.length, "bundle")} and ${plural(next.categories.length, "category", "categories")}. Your current shop (${plural(app.catalog.products.length, "product")}) will be replaced.${demo ? "" : " Tip: tap “Export backup” first if you want to keep the current one."}`,
      confirmLabel: "Yes, replace it", danger: true,
    });
    if (!ok) return;
    await commit((c) => { c.categories = next.categories; c.products = next.products; c.bundles = next.bundles; }, "Admin: import backup");
  }

  const stamp = () => new Date().toISOString().slice(0, 10);
  const card = (title, ...kids) => h("section", { class: "card section" }, h("h2", title), kids);
  return h("section", { class: "view" },
    h("div", { class: "view-head" }, h("h1", { tabindex: "-1", id: "view-title" }, "Settings")),
    card("Your shop connection",
      demo
        ? h("p", "You're in demo mode. Nothing here is connected to a real website yet.")
        : h("p", "Where your products are saved. You normally never need to change these."),
      h("div", { class: "row2" }, field("GitHub owner", owner), field("Repository", repo)),
      field("Branch", branch, { hint: "Usually “main”." }),
      h("button", { type: "button", class: "btn btn-secondary", id: "st-save", onclick: async () => {
        const next = { owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() };
        if (!next.owner || !next.repo || !next.branch) return toast("Please fill in all three boxes.", "error");
        saveSettings(next);
        Object.assign(app.settings, next);
        toast(demo ? "Settings saved." : "Settings saved. Reconnecting…", "ok");
        if (!demo) await app.actions.reconnect();
      } }, "Save settings"),
    ),
    card("Your website",
      h("p", h("a", { class: "btn btn-secondary", href: siteUrl, target: "_blank", rel: "noopener" }, "View my live website")),
      h("p", { class: "hint" }, "Changes appear about a minute after you save."),
    ),
    card("Backup",
      h("p", "Download a copy of everything in your shop, or restore one."),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn btn-secondary", id: "st-export", onclick: () => downloadText(`mamacrafthaus-backup-${stamp()}.json`, toJSON(app.catalog)) }, "Export backup"),
        h("label", { class: "btn btn-secondary", id: "st-import-label" }, fileIn, h("span", "Import JSON")),
      ),
      demo && h("p", { class: "hint" }, "In demo mode this is also how you keep your work: download the file."),
    ),
    demo && card("Demo mode",
      h("p", "Your changes are kept only in this browser and are not published. Photos stay inside the file."),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn btn-secondary", id: "st-download", onclick: () => downloadText("products.json", toJSON(app.catalog)) }, "Download products.json"),
        h("button", { type: "button", class: "btn btn-ghost-danger", onclick: async () => {
          if (!(await confirmBox({ title: "Reset demo?", message: "This throws away your demo changes and starts over with the sample shop.", confirmLabel: "Reset", danger: true }))) return;
          app.store.reset();
          await app.actions.reconnect();
          toast("Demo reset.", "ok");
        } }, "Reset demo"),
      ),
    ),
    card("Account",
      h("p", demo ? "Leave demo mode and go back to the sign-in screen." : "This removes your key from this device. Your shop is not affected."),
      h("button", { type: "button", class: "btn btn-ghost-danger", id: "st-signout", onclick: () => app.actions.signOut() }, demo ? "Exit demo" : "Sign out"),
    ),
  );
}
