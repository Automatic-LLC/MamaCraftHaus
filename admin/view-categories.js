// Categories tab: edit the whole list, then Save once.
import { h, field, toast, confirmBox, fillErrors, autoClearErrors } from "./ui.js";
import { app, commit, setDirty, errorsToText } from "./state.js";
import { photoManager, itemsFromPaths, isBusy, hasPending, pathsOf, uploadPending } from "./photos.js";
import { productsIn } from "./validate.js";
import { slugify, uniqueSlug, plural } from "./util.js";

export function categoriesView() {
  const drafts = app.catalog.categories.map((c) => ({
    isNew: false, id: c.id, name: c.name, description: c.description || "", images: itemsFromPaths(c.image ? [c.image] : []),
    extra: Object.fromEntries(Object.entries(c).filter(([k]) => !["id", "name", "description", "image"].includes(k))),
  }));
  const list = h("div", { class: "cards cat-list" });
  const errBox = h("div", { class: "error-summary", role: "alert", hidden: true, tabindex: "-1" });
  const progress = h("p", { class: "save-progress", "aria-live": "polite" });
  const dirty = () => setDirty(true);
  let focusIdx = -1;

  function render() {
    list.replaceChildren();
    if (!drafts.length) list.append(h("div", { class: "empty" }, h("p", "No categories yet. Add one so products have a home.")));
    drafts.forEach((d, i) => {
      const used = d.isNew ? [] : productsIn(app.catalog, d.id);
      const photo = photoManager(d.images, { single: true, onChange: dirty, addLabel: d.images.length ? "Change photo" : "Choose photo", emptyText: "No photo yet." });
      const nameIn = h("input", { type: "text", id: `cat-name-${i}`, class: "cat-name", value: d.name, placeholder: "e.g. Easter Baskets", autocomplete: "off", oninput: (e) => { d.name = e.target.value; dirty(); } });
      const descIn = h("textarea", { id: `cat-desc-${i}`, rows: "3", class: "cat-desc", oninput: (e) => { d.description = e.target.value; dirty(); } });
      descIn.value = d.description;
      const delBtn = h("button", {
        type: "button", class: "btn btn-small btn-ghost-danger", disabled: used.length > 0, "aria-describedby": used.length ? `cat-used-${i}` : null,
        onclick: async () => {
          if (!(await confirmBox({ title: "Delete this category?", message: `Remove "${d.name || "this category"}"? It will go away when you tap Save.`, confirmLabel: "Yes, remove it", danger: true }))) return;
          drafts.splice(i, 1); render(); dirty();
        },
      }, "Delete");
      list.append(h("section", { class: "card section cat-card", "data-idx": i },
        h("div", { class: "cat-top" },
          h("strong", `Category ${i + 1}`),
          h("span", { class: "cat-order" },
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move ${d.name || "category"} up`, disabled: i === 0, onclick: () => { [drafts[i - 1], drafts[i]] = [drafts[i], drafts[i - 1]]; focusIdx = i - 1; render(); dirty(); } }, "↑"),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move ${d.name || "category"} down`, disabled: i === drafts.length - 1, onclick: () => { [drafts[i + 1], drafts[i]] = [drafts[i], drafts[i + 1]]; focusIdx = i + 1; render(); dirty(); } }, "↓"),
          ),
        ),
        field("Name", nameIn, { errKey: `cat${i}` }),
        field("Description", descIn, { hint: "Shown on the category tile and page." }),
        h("div", { class: "field" }, h("span", { class: "label-like" }, "Photo"), photo),
        h("div", { class: "cat-foot" },
          h("p", { class: "muted", id: `cat-used-${i}` }, d.isNew ? "New category" : used.length ? `${plural(used.length, "product")} use this category, so it can't be deleted. Move them to another category first.` : "No products use this category."),
          delBtn,
        ),
      ));
    });
    if (focusIdx >= 0) { list.querySelector(`[data-idx="${focusIdx}"] .cat-name`)?.focus(); focusIdx = -1; }
  }

  const saveBtn = h("button", { type: "button", class: "btn btn-primary btn-lg", id: "cat-save", onclick: save }, "Save categories");
  async function save() {
    errBox.hidden = true;
    if (drafts.some((d) => isBusy(d.images))) return toast("Hold on, your photo is still getting ready.", "info");
    const errors = [];
    drafts.forEach((d, i) => { if (!d.name.trim()) errors.push({ field: `cat${i}`, message: `Category ${i + 1} needs a name.` }); });
    const lower = drafts.map((d) => d.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(lower).size !== lower.length) errors.push({ field: "", message: "Two categories have the same name." });
    fillErrors(list, errors);
    if (errors.length) {
      errBox.replaceChildren(h("strong", "Please fix this:"), h("ul", errors.map((e) => h("li", e.message))));
      errBox.hidden = false; errBox.scrollIntoView({ block: "center" }); errBox.focus({ preventScroll: true });
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    try {
      const taken = drafts.filter((d) => !d.isNew).map((d) => d.id);
      for (const d of drafts) {
        if (d.isNew) { d.id = uniqueSlug(slugify(d.name) || "category", taken); taken.push(d.id); }
        if (hasPending(d.images)) {
          await uploadPending(d.images, app.store, `cat-${d.id}`, () => { progress.textContent = "Uploading photo…"; });
        }
      }
      progress.textContent = "Saving…";
      const cats = drafts.map((d) => ({ ...d.extra, id: d.id, name: d.name.trim(), description: d.description.trim(), image: pathsOf(d.images)[0] || "" }));
      const r = await commit((c) => { c.categories = cats; }, "Admin: update categories");
      if (r.ok) { setDirty(false); location.hash = "#/categories"; window.dispatchEvent(new HashChangeEvent("hashchange")); }
      else if (r.errors) { errBox.replaceChildren(h("strong", "Please fix this:"), h("ul", errorsToText(r.errors).map((l) => h("li", l)))); errBox.hidden = false; errBox.focus(); }
    } catch (e) {
      toast(e.message || "Couldn't save. Please try again.", "error");
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = "Save categories"; progress.textContent = "";
    }
  }

  render();
  return autoClearErrors(h("section", { class: "view editor" },
    h("div", { class: "view-head" },
      h("h1", { tabindex: "-1", id: "view-title" }, "Categories"),
      h("button", { type: "button", class: "btn btn-primary btn-lg add-btn", id: "cat-add", onclick: () => { drafts.push({ isNew: true, id: "", name: "", description: "", images: [], extra: {} }); focusIdx = drafts.length - 1; render(); dirty(); } }, "+ Add category"),
    ),
    h("p", { class: "muted" }, "Categories are the groups customers browse, like Glassware or Shirts. Change the order here too. Tap Save when you're done."),
    errBox,
    list,
    h("div", { class: "savebar in-tabs" }, progress, h("div", { class: "savebar-row" }, saveBtn)),
  ));
}
