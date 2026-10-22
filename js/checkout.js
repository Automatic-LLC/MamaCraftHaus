// Checkout helpers. Mode is chosen by config.checkout.mode ("request" now, "stripe" later).
import { config } from "./config.js";
import { formatPrice } from "./catalog.js";

const line = (label, value) => (value ? `${label}: ${value}` : "");

/** Plain-text summary of cart lines. Lines may carry an optional `name` (the cart page adds it). */
export function formatCartText(cart) {
  const lines = cart.map((i, n) => {
    const opts = Object.entries(i.options || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
    return [
      `${n + 1}. ${i.name || i.id}${i.type === "bundle" ? " (bundle)" : ""}  x${i.qty}  @ ${formatPrice(i.unitPrice)} = ${formatPrice(i.qty * i.unitPrice)}`,
      opts && `   Options: ${opts}`,
      i.personalization && `   Personalization: ${i.personalization}`,
    ].filter(Boolean).join("\n");
  });
  const total = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  return `${lines.join("\n")}\n\nEstimated subtotal: ${formatPrice(total)} (final price confirmed by the shop)`;
}

/**
 * Deliver a request: POST JSON to config.forms.endpoint when set, else open a mailto: to config.shopEmail.
 * Returns { via: "endpoint" | "mailto" }. Throws if the endpoint rejects the request.
 */
export async function sendRequest({ kind, subject, fields, bodyText }) {
  const endpoint = config.forms.endpoint;
  if (endpoint) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ _subject: subject, kind, ...fields, summary: bodyText }),
    });
    if (!res.ok) throw new Error("The request could not be sent. Please try again or email us directly.");
    return { via: "endpoint" };
  }
  const href = `mailto:${config.shopEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  const a = document.createElement("a");
  a.href = href;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { via: "mailto" };
}

/** Send the cart as an order request. customer: {name,email,phone,neededBy,fulfillment,address,notes} */
export function submitOrderRequest(cart, customer) {
  const text = [
    "NEW ORDER REQUEST",
    "",
    line("Name", customer.name),
    line("Email", customer.email),
    line("Phone", customer.phone),
    line("Needed by", customer.neededBy),
    line("Pickup or shipping", customer.fulfillment),
    line("Address", customer.address),
    line("Notes", customer.notes),
    "",
    "ITEMS",
    formatCartText(cart),
  ].join("\n").replace(/\n{3,}/g, "\n\n");
  return sendRequest({
    kind: "order",
    subject: `Order request from ${customer.name}`,
    fields: { ...customer, items: cart },
    bodyText: text,
  });
}

/** Send the custom-order form. */
export function submitCustomRequest(data) {
  const text = [
    "NEW CUSTOM ORDER REQUEST",
    "",
    line("Name", data.name),
    line("Email", data.email),
    line("Phone", data.phone),
    line("Product type", data.productType),
    line("Quantity", data.quantity),
    line("Needed by", data.neededBy),
    line("Inspiration link", data.inspiration),
    "",
    "Idea:",
    data.description,
  ].join("\n").replace(/\n{3,}/g, "\n\n");
  return sendRequest({ kind: "custom", subject: `Custom order request from ${data.name}`, fields: data, bodyText: text });
}

/**
 * STUB: online card payment is not set up yet. See docs/STRIPE.md.
 *
 * Future approach A, Payment Links (no server):
 *   - Create a Payment Link per product in Stripe; paste URLs into config.checkout.stripe.paymentLinks as { productId: url }.
 *   - For a single-product cart, redirect to that link. Personalization can't ride along, so use a Payment Link
 *     custom field (e.g. "Personalization") and ask for it again there.
 *
 * Future approach B, Checkout Session (small serverless function):
 *   - POST the cart (ids, options, qty only) to config.checkout.stripe.sessionEndpoint.
 *   - The function re-prices items from products.json server-side, creates a Checkout Session
 *     (personalization in line-item metadata) and returns { url }; then we redirect to it.
 *   - A webhook (checkout.session.completed) emails the shop the order.
 */
export async function startStripeCheckout(cart) { // eslint-disable-line no-unused-vars
  throw new Error("Online payment coming soon");
}
