// Shared header + footer, rendered once from here for every page.
import { config } from "./config.js";
import { resolveAsset } from "./catalog.js";
import { count } from "./cart.js";
import { esc } from "./ui.js";

const NAV = [
  { href: "shop.html", label: "Shop", id: "shop" },
  { href: "custom-order.html", label: "Custom Orders", id: "custom" },
  { href: "about.html", label: "About", id: "about" },
];

const cartIcon = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.1"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg>`;

function headerHtml(active) {
  const links = NAV.map(
    (n) => `<a href="${n.href}"${n.id === active ? ' aria-current="page"' : ""}>${n.label}</a>`
  ).join("");
  return `<div class="container header-inner">
    <a class="logo" href="index.html" aria-label="${esc(config.shopName)} home">
      <img src="${resolveAsset("images/favicon.svg")}" alt="" width="40" height="40" class="logo-mark">
      <span class="logo-text">${esc(config.shopName)}</span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Main">${links}</nav>
    <a class="cart-link" href="cart.html" aria-label="Cart, 0 items">
      ${cartIcon}<span class="cart-badge" data-cart-badge hidden>0</span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Menu">
      <span class="menu-bars" aria-hidden="true"></span>
    </button>
  </div>`;
}

function footerHtml() {
  const s = config.social || {};
  const socials = [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["etsy", "Etsy"]]
    .filter(([k]) => s[k])
    .map(([k, label]) => `<li><a href="${esc(s[k])}" target="_blank" rel="noopener noreferrer">${label}</a></li>`)
    .join("");
  return `<div class="container footer-inner">
    <div class="footer-brand">
      <p class="footer-name">${esc(config.shopName)}</p>
      <p>${esc(config.tagline)}</p>
    </div>
    <div>
      <p class="footer-heading">Contact</p>
      <ul class="footer-list">
        <li><a href="mailto:${esc(config.shopEmail)}">${esc(config.shopEmail)}</a></li>
        ${config.phone ? `<li><a href="tel:${esc(config.phone)}">${esc(config.phone)}</a></li>` : ""}
        ${config.location ? `<li>${esc(config.location)}</li>` : ""}
      </ul>
      ${socials ? `<ul class="footer-list footer-social" aria-label="Social links">${socials}</ul>` : ""}
    </div>
    <div>
      <p class="footer-heading">Explore</p>
      <ul class="footer-list">
        <li><a href="shop.html">Shop</a></li>
        <li><a href="custom-order.html">Custom orders</a></li>
        <li><a href="about.html">About</a></li>
        <li><a href="cart.html">Cart</a></li>
      </ul>
    </div>
    <p class="footer-legal">&copy; ${new Date().getFullYear()} ${esc(config.shopName)}. Handmade with love. <a class="admin-link" href="admin/">Admin</a></p>
  </div>`;
}

let liveEl;
/** Announce a message to screen readers (polite live region). */
export function announce(message) {
  if (!liveEl) return;
  liveEl.textContent = "";
  setTimeout(() => (liveEl.textContent = message), 30);
}

function updateBadge() {
  const n = count();
  document.querySelectorAll("[data-cart-badge]").forEach((b) => {
    b.textContent = n > 99 ? "99+" : String(n);
    b.hidden = n === 0;
  });
  const link = document.querySelector(".cart-link");
  if (link) link.setAttribute("aria-label", `Cart, ${n} ${n === 1 ? "item" : "items"}`);
}

export function initLayout(active = "") {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) header.innerHTML = headerHtml(active);
  if (footer) footer.innerHTML = footerHtml();

  liveEl = document.createElement("div");
  liveEl.className = "sr-only";
  liveEl.setAttribute("aria-live", "polite");
  liveEl.setAttribute("role", "status");
  document.body.appendChild(liveEl);

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) {
    const set = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("open", open);
    };
    toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        set(false);
        toggle.focus();
      }
    });
    nav.addEventListener("click", (e) => e.target.closest("a") && set(false));
  }

  updateBadge();
  window.addEventListener("cart:changed", updateBadge);
}
