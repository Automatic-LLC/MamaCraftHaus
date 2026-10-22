// Tiny DOM helpers, toasts and dialogs. No innerHTML anywhere, so user text can never inject markup.
const PROPS = new Set(["value", "checked", "disabled", "selected", "hidden", "multiple", "readOnly", "indeterminate"]);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) {
      if (PROPS.has(k)) el[k] = false;
      continue;
    }
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const clear = (el) => {
  el.replaceChildren();
  return el;
};

// ---------- Toasts ----------
export function toast(message, type = "ok", ms) {
  let box = document.getElementById("toasts");
  if (!box) {
    box = h("div", { id: "toasts", "aria-live": "polite", "aria-atomic": "false" });
    document.body.append(box);
  }
  const t = h(
    "div",
    { class: `toast toast-${type}`, role: type === "error" ? "alert" : "status" },
    h("span", { class: "toast-msg" }, message),
    h("button", { type: "button", class: "toast-x", "aria-label": "Dismiss", onclick: () => t.remove() }, "×"),
  );
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove(); // don't let toasts pile up
  setTimeout(() => t.remove(), ms || (type === "error" ? 9000 : 5000));
  return t;
}

// ---------- Dialogs ----------
// actions: [{label, value, kind: "primary"|"danger"|"plain"}]. Resolves with the chosen value, or null if dismissed.
export function dialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { class: "dialog", "aria-labelledby": "dlg-title" });
    let result = null;
    const bodyEl = h("div", { class: "dialog-body" });
    append(bodyEl, [typeof body === "string" ? h("p", body) : body]);
    dlg.append(
      h("h2", { id: "dlg-title" }, title),
      bodyEl,
      h(
        "div",
        { class: "dialog-actions" },
        (actions || [{ label: "OK", value: true, kind: "primary" }]).map((a) =>
          h(
            "button",
            {
              type: "button",
              class: `btn ${a.kind === "primary" ? "btn-primary" : a.kind === "danger" ? "btn-danger" : "btn-ghost"}`,
              onclick: () => {
                result = a.value;
                dlg.close();
              },
            },
            a.label,
          ),
        ),
      ),
    );
    dlg.addEventListener("close", () => {
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
    const first = dlg.querySelector(".btn-primary, .btn-danger") || dlg.querySelector("button");
    first?.focus();
  });
}

export async function confirmBox({ title, message, confirmLabel = "Yes", cancelLabel = "Cancel", danger = false }) {
  const r = await dialog({
    title,
    body: message,
    actions: [
      { label: cancelLabel, value: false, kind: "plain" },
      { label: confirmLabel, value: true, kind: danger ? "danger" : "primary" },
    ],
  });
  return r === true;
}

export const alertBox = (title, message) => dialog({ title, body: message, actions: [{ label: "OK", value: true, kind: "primary" }] });

// ---------- Form building blocks ----------
let fid = 0;
export function field(labelText, input, { hint, errKey } = {}) {
  const id = input.id || (input.id = `f${++fid}`);
  const hintId = hint ? `${id}-hint` : null;
  if (hintId) input.setAttribute("aria-describedby", hintId);
  return h(
    "div",
    { class: "field" },
    h("label", { for: id }, labelText),
    input,
    hint && h("p", { class: "hint", id: hintId }, hint),
    errKey && h("p", { class: "field-error", "data-err": errKey, role: "alert" }),
  );
}

export function switchEl({ label, checked, onChange, disabled, hint }) {
  const input = h("input", { type: "checkbox", role: "switch", checked: !!checked, disabled: !!disabled, onchange: (e) => onChange?.(e.target.checked, e.target) });
  return h(
    "label",
    { class: "switch" },
    input,
    h("span", { class: "switch-track", "aria-hidden": "true" }, h("span", { class: "switch-thumb" })),
    h("span", { class: "switch-label" }, label, hint && h("small", hint)),
  );
}

export function badge(text, kind = "") {
  return h("span", { class: `badge ${kind ? "badge-" + kind : ""}` }, text);
}

export function fillErrors(root, errors) {
  root.querySelectorAll("[data-err]").forEach((n) => (n.textContent = ""));
  root.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  for (const e of errors) {
    if (!e.field) continue;
    const slot = root.querySelector(`[data-err="${e.field}"]`);
    if (slot) {
      slot.textContent = e.message;
      if (slot.parentElement.classList.contains("field")) slot.parentElement.querySelector("input, select, textarea")?.setAttribute("aria-invalid", "true");
    }
  }
}

// Clear a field's error message as soon as the person edits it.
export function autoClearErrors(root) {
  const clearIt = (e) => {
    const f = e.target.closest?.(".field");
    if (!f) return;
    f.querySelectorAll("[data-err]").forEach((n) => (n.textContent = ""));
    e.target.removeAttribute?.("aria-invalid");
  };
  root.addEventListener("input", clearIt);
  root.addEventListener("change", clearIt);
  return root;
}
