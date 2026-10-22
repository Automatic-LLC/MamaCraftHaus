// "Connect to your shop" screen.
import { h, field } from "./ui.js";

export function signInView({ settings, message, onConnect, onDemo }) {
  const tokenIn = h("input", {
    type: "password", id: "token", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "Paste your key here",
    "aria-describedby": "token-msg",
  });
  const msg = h("p", { class: "field-error", id: "token-msg", role: "alert" }, message || "");
  const btn = h("button", { type: "submit", class: "btn btn-primary btn-lg btn-block", id: "connect-btn" }, "Connect");
  const show = h("label", { class: "check" }, h("input", { type: "checkbox", onchange: (e) => (tokenIn.type = e.target.checked ? "text" : "password") }), " Show what I typed");

  const form = h("form", {
    class: "card section signin-card", novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      const token = tokenIn.value.trim();
      if (!token) { msg.textContent = "Please paste your key first."; tokenIn.focus(); return; }
      msg.textContent = "";
      btn.disabled = true;
      btn.textContent = "Connecting…";
      const err = await onConnect(token);
      btn.disabled = false;
      btn.textContent = "Connect";
      if (err) { msg.textContent = err; tokenIn.focus(); }
    },
  },
    field("Your shop key", tokenIn),
    show,
    msg,
    btn,
    h("p", { class: "hint" }, "Your key is saved only on this device. You can sign out any time."),
  );

  return h("main", { class: "signin" },
    h("div", { class: "signin-inner" },
      h("p", { class: "brand-mark" }, "MamaCraftHouz"),
      h("h1", "Connect to your shop"),
      h("p", { class: "lead" }, "Paste your shop key to add and edit products. You only do this once on each phone or computer."),
      form,
      h("details", { class: "card section steps", open: true },
        h("summary", "How do I get a key?"),
        h("ol", {},
          h("li", "Open ", h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "github.com/settings/personal-access-tokens/new"), " and sign in to GitHub."),
          h("li", "Give it a name, like ", h("em", "MamaCraftHouz admin"), ". Pick an expiration (1 year is fine)."),
          h("li", h("strong", "Repository access"), ": choose “Only select repositories”, then pick ", h("strong", `${settings.owner}/${settings.repo}`), "."),
          h("li", h("strong", "Permissions"), ": open “Repository permissions”, find ", h("strong", "Contents"), " and set it to ", h("strong", "Read and write"), "."),
          h("li", "Tap “Generate token”, copy the long code, and paste it above."),
        ),
        h("p", { class: "hint" }, "The full walk-through with tips is in docs/ADMIN-GUIDE.md."),
      ),
      h("div", { class: "demo-box" },
        h("p", "Just looking around?"),
        h("button", { type: "button", class: "btn btn-secondary btn-block", id: "demo-btn", onclick: onDemo }, "Try demo mode"),
        h("p", { class: "hint" }, "Demo mode lets you try everything without connecting. Nothing is published."),
      ),
    ),
  );
}
