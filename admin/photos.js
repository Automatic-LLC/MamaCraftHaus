// Photo picker/manager used by products, bundles and categories.
import { h, toast } from "./ui.js";
import { processImage } from "./images.js";
import { resolveAsset } from "../js/catalog.js";
import { uid } from "./util.js";

export const itemsFromPaths = (paths) =>
  (paths || []).filter(Boolean).map((path) => ({ key: uid("p"), path, blob: null, preview: resolveAsset(path), status: "ready" }));

export const isBusy = (items) => items.some((i) => i.status === "processing");
export const hasPending = (items) => items.some((i) => i.blob && !i.path);
export const pathsOf = (items) => items.filter((i) => i.path).map((i) => i.path);

// Upload every not-yet-uploaded photo. onProgress(doneCount, total, item).
export async function uploadPending(items, store, slug, onProgress) {
  const todo = items.filter((i) => i.blob && !i.path);
  let done = 0;
  for (const it of todo) {
    it.status = "uploading";
    onProgress?.(done, todo.length, it);
    try {
      it.path = await store.uploadImage(it.blob, { slug });
      it.status = "ready";
    } catch (e) {
      it.status = "error";
      onProgress?.(done, todo.length, it);
      throw e;
    }
    done++;
    onProgress?.(done, todo.length, it);
  }
}

export function photoManager(items, { onChange, single = false, addLabel, emptyText } = {}) {
  const input = h("input", {
    type: "file",
    accept: "image/*",
    multiple: !single,
    class: "file-input",
    "aria-label": single ? "Choose a photo" : "Choose photos",
    onchange: async () => {
      const files = [...input.files];
      input.value = ""; // allow choosing the same picture again
      await addFiles(files);
    },
  });
  const grid = h("ul", { class: "photo-grid" });
  const root = h(
    "div",
    { class: "photos" },
    h("label", { class: "btn btn-secondary btn-block add-photos" }, input, h("span", addLabel || (single ? "Choose photo" : "Add photos"))),
    grid,
  );

  async function addFiles(files) {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
    if (files.length && !imgs.length) toast("Please choose picture files (JPG or PNG).", "error");
    if (single && imgs.length) {
      items.splice(0, items.length); // replace the one photo
      imgs.length = 1;
    }
    const placeholders = imgs.map((file) => {
      const it = { key: uid("p"), path: null, blob: null, preview: "", status: "processing", name: file.name };
      items.push(it);
      return { it, file };
    });
    render();
    onChange?.();
    for (const { it, file } of placeholders) {
      try {
        const { blob } = await processImage(file);
        it.blob = blob;
        it.preview = URL.createObjectURL(blob);
        it.status = "ready";
      } catch (e) {
        items.splice(items.indexOf(it), 1);
        toast(`${file.name || "Photo"}: ${e.message}`, "error");
      }
      render();
      onChange?.();
    }
  }

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
    onChange?.();
  };
  const makeMain = (i) => {
    const [it] = items.splice(i, 1);
    items.unshift(it);
    render();
    onChange?.();
  };
  const remove = (i) => {
    const [it] = items.splice(i, 1);
    if (it?.blob && it.preview.startsWith("blob:")) URL.revokeObjectURL(it.preview);
    render();
    onChange?.();
  };

  function render() {
    grid.replaceChildren();
    if (!items.length) {
      grid.append(h("li", { class: "photo-empty" }, emptyText || "No photos yet. Tap the button above to take or choose one."));
      return;
    }
    items.forEach((it, i) => {
      const first = i === 0;
      grid.append(
        h(
          "li",
          { class: `photo ${first ? "is-main" : ""}`, "data-status": it.status },
          h(
            "div",
            { class: "photo-img" },
            it.preview ? h("img", { src: it.preview, alt: single ? "Selected photo" : `Photo ${i + 1}${first ? " (main)" : ""}` }) : h("span", { class: "photo-wait" }, "Preparing…"),
            first && !single && h("span", { class: "photo-tag" }, "Main photo"),
            it.blob && !it.path && it.status === "ready" && h("span", { class: "photo-new" }, "Not saved yet"),
            it.status === "uploading" && h("span", { class: "photo-new photo-up" }, "Uploading…"),
            it.status === "error" && h("span", { class: "photo-new photo-err" }, "Upload failed"),
          ),
          h(
            "div",
            { class: "photo-actions" },
            !single && h("button", { type: "button", class: "icon-btn", "aria-label": `Move photo ${i + 1} earlier`, disabled: first, onclick: () => move(i, -1) }, "←"),
            !single && h("button", { type: "button", class: "icon-btn", "aria-label": `Move photo ${i + 1} later`, disabled: i === items.length - 1, onclick: () => move(i, 1) }, "→"),
            !single && !first && h("button", { type: "button", class: "btn btn-small", onclick: () => makeMain(i) }, "Make main"),
            h("button", { type: "button", class: "btn btn-small btn-ghost-danger", "aria-label": `Remove photo ${i + 1}`, onclick: () => remove(i) }, "Remove"),
          ),
        ),
      );
    });
  }
  render();
  root.refresh = render;
  return root;
}
