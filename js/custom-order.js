import { config } from "./config.js";
import { submitCustomRequest } from "./checkout.js";
import { esc, $ } from "./ui.js";

const form = $("#custom-form");
const err = $("#c-error");
const date = $("#c-date");
date.min = new Date().toISOString().slice(0, 10);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  const missing = [...form.querySelectorAll("[required]")].find((f) => !f.value.trim());
  const emailBad = !form.email.checkValidity();
  if (missing || emailBad) {
    err.textContent = emailBad && !missing ? "Please enter a valid email address." : "Please fill in the required fields.";
    err.hidden = false;
    (missing || form.email).focus();
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  Object.keys(data).forEach((k) => (data[k] = String(data[k]).trim()));
  const btn = $("#c-submit");
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    const { via } = await submitCustomRequest(data);
    $("#custom-root").innerHTML = `<div class="notice notice-success" role="status" tabindex="-1" id="c-done">
      <h2>Thanks, ${esc(data.name)}!</h2>
      <p>We'll email you a final price &amp; proof within 1&ndash;2 days.</p>
      ${via === "mailto" ? `<p>Your email app should have opened with your request. Please press <strong>Send</strong> to finish. If nothing opened, email us at <a href="mailto:${esc(config.shopEmail)}">${esc(config.shopEmail)}</a>.</p>` : ""}
      <p>Have photos for inspiration? Just email them to <a href="mailto:${esc(config.shopEmail)}">${esc(config.shopEmail)}</a>.</p>
      <p><a class="btn btn-secondary" href="shop.html">Keep browsing</a></p></div>`;
    $("#c-done").focus();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = "Send request";
  }
});
