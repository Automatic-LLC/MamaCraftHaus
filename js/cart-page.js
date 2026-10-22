import { config } from "./config.js";
import { loadCatalog, findProduct, findBundle, formatPrice } from "./catalog.js";
import { getCart, updateQty, removeItem, clear, subtotal } from "./cart.js";
import { submitOrderRequest, startStripeCheckout } from "./checkout.js";
import { announce } from "./layout.js";
import { esc, $, productImage, bundleImage, productUrl, bundleUrl, showError, friendlyLoadError } from "./ui.js";

const root = $("#cart-root");
let done = false;

function describe(catalog, item) {
  const isBundle = item.type === "bundle";
  const ref = isBundle ? findBundle(catalog, item.id) : findProduct(catalog, item.id);
  return {
    name: ref ? ref.name : "Item no longer available",
    missing: !ref,
    img: ref ? (isBundle ? bundleImage(catalog, ref) : productImage(ref)) : "",
    url: ref ? (isBundle ? bundleUrl(item.id) : productUrl(item.id)) : "",
  };
}

const today = new Date().toISOString().slice(0, 10);
const stripeMode = config.checkout.mode === "stripe";

function shell() {
  root.innerHTML = `
  <div id="cart-empty" class="notice center" hidden>
    <h2>Your cart is empty</h2>
    <p>Browse our handmade pieces, or tell us about something custom.</p>
    <p><a class="btn btn-primary" href="shop.html">Shop now</a> <a class="btn btn-secondary" href="custom-order.html">Request something custom</a></p>
  </div>
  <div id="cart-full" class="cart-layout" hidden>
    <section aria-labelledby="items-h">
      <h2 id="items-h" class="sr-only">Cart items</h2>
      <ul class="cart-lines" id="lines"></ul>
    </section>
    <aside class="summary card-form" aria-labelledby="sum-h">
      <h2 id="sum-h">Order summary</h2>
      <p class="summary-row"><span>Estimated subtotal</span> <strong id="subtotal"></strong></p>
      <p class="hint">Final price (including any shipping) is confirmed by the shop before you pay.</p>
      ${stripeMode ? `<button type="button" class="btn btn-primary btn-lg btn-block" id="stripe-btn">Checkout</button><p class="form-error" id="stripe-error" role="alert" hidden></p>` : ""}
    </aside>
    ${stripeMode ? "" : `
    <form id="order-form" class="form card-form checkout-form" novalidate aria-labelledby="req-h">
      <h2 id="req-h">Send your order request</h2>
      <p class="hint">No payment now. We'll review your request and email you a final price &amp; invoice within 1&ndash;2 days.</p>
      <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
      <div class="field-row">
        <div class="field"><label for="o-name">Your name <span class="req" aria-hidden="true">*</span></label><input id="o-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="o-email">Email <span class="req" aria-hidden="true">*</span></label><input id="o-email" name="email" type="email" autocomplete="email" required></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="o-phone">Phone <span class="optional">(optional)</span></label><input id="o-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="o-date">Needed by <span class="optional">(optional)</span></label><input id="o-date" name="neededBy" type="date" min="${today}"></div>
      </div>
      <fieldset class="field fieldset">
        <legend>Pickup or shipping</legend>
        <label class="radio"><input type="radio" name="fulfillment" value="Pickup" checked> Local pickup</label>
        <label class="radio"><input type="radio" name="fulfillment" value="Shipping"> Ship to me</label>
      </fieldset>
      <div class="field" id="addr-field" hidden><label for="o-addr">Shipping address <span class="req" aria-hidden="true">*</span></label>
        <textarea id="o-addr" name="address" rows="3" autocomplete="street-address"></textarea></div>
      <div class="field"><label for="o-notes">Notes <span class="optional">(optional)</span></label>
        <textarea id="o-notes" name="notes" rows="3" placeholder="Anything else we should know?"></textarea></div>
      <p class="form-error" id="o-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-lg btn-block" type="submit" id="o-submit">Send order request</button>
    </form>`}
  </div>`;
}

function renderLines(catalog) {
  const items = getCart();
  $("#cart-empty").hidden = items.length > 0;
  $("#cart-full").hidden = items.length === 0;
  $("#lines").innerHTML = items
    .map((item) => {
      const d = describe(catalog, item);
      const opts = Object.entries(item.options || {});
      return `<li class="cart-line" data-key="${esc(item.key)}">
        ${d.img ? `<img src="${esc(d.img)}" alt="" width="88" height="88">` : `<span class="img-missing"></span>`}
        <div class="line-main">
          <h3 class="line-name">${d.url ? `<a href="${d.url}">${esc(d.name)}</a>` : esc(d.name)}${item.type === "bundle" ? ' <span class="badge">Bundle</span>' : ""}</h3>
          ${opts.length ? `<p class="line-meta">${opts.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" &middot; ")}</p>` : ""}
          ${item.personalization ? `<p class="line-meta line-personal"><strong>Personalization:</strong> ${esc(item.personalization)}</p>` : ""}
          <p class="line-meta">${formatPrice(item.unitPrice)} each</p>
          <div class="line-actions">
            <div class="stepper" role="group" aria-label="Quantity for ${esc(d.name)}">
              <button type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button>
              <output aria-live="polite">${item.qty}</output>
              <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="link-btn" data-act="remove" aria-label="Remove ${esc(d.name)}">Remove</button>
          </div>
        </div>
        <p class="line-total">${formatPrice(item.qty * item.unitPrice)}</p>
      </li>`;
    })
    .join("");
  $("#subtotal").textContent = formatPrice(subtotal());
}

function confirmation(name, via) {
  root.innerHTML = `<div class="notice notice-success" role="status" tabindex="-1" id="done-msg">
    <h2>Thanks${name ? ", " + esc(name) : ""}!</h2>
    <p>We'll email you a final price &amp; invoice within 1&ndash;2 days.</p>
    ${via === "mailto" ? `<p>Your email app should have opened with your order request. Please press <strong>Send</strong> to finish. If nothing opened, email us at <a href="mailto:${esc(config.shopEmail)}">${esc(config.shopEmail)}</a>.</p>` : ""}
    <p><a class="btn btn-primary" href="shop.html">Keep browsing</a></p></div>`;
  $("#done-msg").focus();
}

try {
  const catalog = await loadCatalog();
  root.removeAttribute("aria-busy");
  shell();
  renderLines(catalog);
  window.addEventListener("cart:changed", () => {
    if (!done) renderLines(catalog);
  });

  $("#lines").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const key = btn.closest(".cart-line").dataset.key;
    const item = getCart().find((i) => i.key === key);
    if (!item) return;
    const act = btn.dataset.act;
    if (act === "remove") {
      removeItem(key);
      announce("Item removed from cart.");
      (getCart().length ? $(".cart-line [data-act]") : $("#cart-empty a"))?.focus();
    } else {
      updateQty(key, item.qty + (act === "inc" ? 1 : -1));
      announce(`Quantity updated. Subtotal ${$("#subtotal").textContent}.`);
      const again = [...document.querySelectorAll(".cart-line")].find((l) => l.dataset.key === key);
      if (again) again.querySelector(`[data-act="${act}"]`)?.focus();
    }
  });

  const cartWithNames = () => getCart().map((i) => ({ ...i, name: describe(catalog, i).name }));

  if (stripeMode) {
    $("#stripe-btn").addEventListener("click", async () => {
      try {
        await startStripeCheckout(cartWithNames());
      } catch (ex) {
        const er = $("#stripe-error");
        er.textContent = ex.message;
        er.hidden = false;
      }
    });
  } else {
    const form = $("#order-form");
    const addr = $("#addr-field");
    form.addEventListener("change", () => {
      addr.hidden = form.fulfillment.value !== "Shipping";
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const er = $("#o-error");
      er.hidden = true;
      const fail = (msg, field) => {
        er.textContent = msg;
        er.hidden = false;
        field && field.focus();
      };
      if (!form.name.value.trim()) return fail("Please enter your name.", form.name);
      if (!form.email.value.trim() || !form.email.checkValidity()) return fail("Please enter a valid email address.", form.email);
      if (form.fulfillment.value === "Shipping" && !form.address.value.trim()) return fail("Please enter a shipping address.", form.address);
      if (form._gotcha.value) return; // spam trap
      const customer = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        neededBy: form.neededBy.value,
        fulfillment: form.fulfillment.value,
        address: form.fulfillment.value === "Shipping" ? form.address.value.trim() : "",
        notes: form.notes.value.trim(),
      };
      const btn = $("#o-submit");
      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const { via } = await submitOrderRequest(cartWithNames(), customer);
        done = true;
        clear();
        confirmation(customer.name, via);
      } catch (ex) {
        fail(ex.message);
        btn.disabled = false;
        btn.textContent = "Send order request";
      }
    });
  }
} catch (err) {
  console.warn(err);
  showError(root, friendlyLoadError);
}
