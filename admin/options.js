// Options builder: "Size", "Color" etc. Each option has choices with an optional + price.
import { h, toast } from "./ui.js";

export const PRESETS = [
  {
    button: "Shirt sizes (Youth S–Adult 3XL)",
    option: {
      name: "Size",
      values: [
        ["Youth S", 0], ["Youth M", 0], ["Youth L", 0], ["Adult S", 0], ["Adult M", 0], ["Adult L", 0],
        ["Adult XL", 0], ["Adult 2XL", 3], ["Adult 3XL", 5],
      ],
    },
  },
  {
    button: "Colors",
    option: { name: "Color", values: [["White", 0], ["Black", 0], ["Gray", 0], ["Navy", 0], ["Red", 0], ["Pink", 0], ["Sage Green", 0]] },
  },
];

export function optionsBuilder(options, { onChange }) {
  const list = h("div", { class: "options-list" });
  const root = h("div", { class: "options" }, list);
  let focusSel = null;

  const changed = () => onChange?.();
  const rerender = () => {
    render();
    changed();
  };

  function addOption(opt) {
    options.push(opt);
    focusSel = `[data-opt="${options.length - 1}"] .opt-name`;
    rerender();
  }

  function render() {
    list.replaceChildren();
    if (!options.length) list.append(h("p", { class: "muted" }, "No options yet. Add one if customers can choose things like size or color."));
    options.forEach((o, oi) => {
      const valuesEl = h("ul", { class: "value-list" });
      o.values.forEach((v, vi) => {
        valuesEl.append(
          h(
            "li",
            { class: "value-row" },
            h("input", {
              type: "text", class: "val-label", value: v.label, placeholder: "Choice, e.g. Large", "aria-label": `${o.name || "Option"} choice ${vi + 1} name`,
              oninput: (e) => { v.label = e.target.value; changed(); },
            }),
            h(
              "span",
              { class: "plus-wrap" },
              h("span", { "aria-hidden": "true" }, "+$"),
              h("input", {
                type: "number", inputmode: "decimal", step: "0.01", min: "0", class: "val-price", value: v.priceDelta, placeholder: "0",
                "aria-label": `Extra price for ${v.label || "this choice"}`,
                oninput: (e) => { v.priceDelta = e.target.value; changed(); },
              }),
            ),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move ${v.label || "choice"} up`, disabled: vi === 0, onclick: () => { swap(o.values, vi, vi - 1); rerender(); } }, "↑"),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move ${v.label || "choice"} down`, disabled: vi === o.values.length - 1, onclick: () => { swap(o.values, vi, vi + 1); rerender(); } }, "↓"),
            h("button", { type: "button", class: "icon-btn icon-danger", "aria-label": `Remove ${v.label || "choice"}`, onclick: () => { o.values.splice(vi, 1); rerender(); } }, "×"),
          ),
        );
      });
      list.append(
        h(
          "section",
          { class: "option-card", "data-opt": oi },
          h(
            "div",
            { class: "option-head" },
            h("input", {
              type: "text", class: "opt-name", value: o.name, placeholder: "Option name, e.g. Size", "aria-label": `Option ${oi + 1} name`,
              oninput: (e) => { o.name = e.target.value; changed(); },
            }),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move option ${o.name || oi + 1} up`, disabled: oi === 0, onclick: () => { swap(options, oi, oi - 1); rerender(); } }, "↑"),
            h("button", { type: "button", class: "icon-btn", "aria-label": `Move option ${o.name || oi + 1} down`, disabled: oi === options.length - 1, onclick: () => { swap(options, oi, oi + 1); rerender(); } }, "↓"),
            h("button", { type: "button", class: "icon-btn icon-danger", "aria-label": `Remove option ${o.name || oi + 1}`, onclick: () => { options.splice(oi, 1); rerender(); } }, "×"),
          ),
          o.values.length ? h("div", { class: "value-head muted" }, h("span", "Choice"), h("span", "Extra cost")) : null,
          valuesEl,
          h("button", {
            type: "button", class: "btn btn-small btn-secondary",
            onclick: () => { o.values.push({ label: "", priceDelta: "" }); focusSel = `[data-opt="${oi}"] .value-row:last-child .val-label`; rerender(); },
          }, "+ Add a choice"),
        ),
      );
    });
    if (focusSel) {
      list.querySelector(focusSel)?.focus();
      focusSel = null;
    }
  }

  const buttons = h(
    "div",
    { class: "option-actions" },
    h("button", { type: "button", class: "btn btn-secondary", onclick: () => addOption({ name: "", values: [{ label: "", priceDelta: "" }] }) }, "+ Add an option"),
    h("div", { class: "presets" }, h("span", { class: "muted" }, "Quick add:"),
      PRESETS.map((p) =>
        h("button", {
          type: "button", class: "btn btn-small btn-chip",
          onclick: () => {
            if (options.some((o) => o.name.trim().toLowerCase() === p.option.name.toLowerCase())) {
              toast(`You already have a "${p.option.name}" option.`, "info");
              return;
            }
            addOption({ name: p.option.name, values: p.option.values.map(([label, d]) => ({ label, priceDelta: d ? String(d) : "" })) });
          },
        }, p.button),
      ),
    ),
  );
  root.append(buttons);
  render();
  return root;
}

function swap(arr, i, j) {
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
