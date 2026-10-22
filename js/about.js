import { config } from "./config.js";
import { esc, $ } from "./ui.js";

const s = config.social || {};
const rows = [
  `<li><span>Email</span> <a href="mailto:${esc(config.shopEmail)}">${esc(config.shopEmail)}</a></li>`,
  config.phone && `<li><span>Phone</span> <a href="tel:${esc(config.phone)}">${esc(config.phone)}</a></li>`,
  config.location && `<li><span>Location</span> ${esc(config.location)}</li>`,
  ...[["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["etsy", "Etsy"]]
    .filter(([k]) => s[k])
    .map(([k, l]) => `<li><span>${l}</span> <a href="${esc(s[k])}" target="_blank" rel="noopener noreferrer">${esc(s[k])}</a></li>`),
].filter(Boolean);
$("#contact-list").innerHTML = rows.join("");
