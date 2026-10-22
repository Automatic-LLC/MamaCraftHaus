# MamaCraftHouz — Build Spec (shared contract)

Static site hosted on **GitHub Pages** (later a custom domain). **No build step**: plain HTML, CSS, and
vanilla JS ES modules. Must work when served from a sub-path (`https://user.github.io/MamaCraftHouz/`),
so **every URL is relative** (`css/site.css`, `../data/products.json`) — never start a path with `/`.

## Layout

```
index.html            Home: hero, category tiles, featured products + bundles, "how custom orders work"
shop.html             Catalog grid; ?category=<id> filter, search box, bundles section
product.html          Product or bundle detail: ?id=<productId> or ?bundle=<bundleId>
cart.html             Cart + checkout (order request now; Stripe later)
custom-order.html     Custom request form (anything not in the catalog)
about.html            About the maker + contact info
css/theme.css         Color/font TOKENS ONLY (shared by site + admin). Change the color scheme here.
css/site.css          Storefront styles
js/config.js          Shop settings (name, email, checkout, GitHub repo for admin)
js/catalog.js         Data access layer — the ONLY code that knows where products come from
js/*.js               Storefront modules (cart.js, checkout.js, ui.js, etc.)
admin/                Admin panel (index.html, admin.js, admin.css, ...)
data/products.json    The catalog (categories, products, bundles)
images/products/      Product photos (admin uploads go here)
docs/                 STRIPE.md, SUPABASE.md, ADMIN-GUIDE.md
```

## Data: `data/products.json`

```jsonc
{
  "categories": [ { "id": "glassware", "name": "...", "description": "...", "image": "images/..." } ],
  "products": [{
    "id": "slug-unique",               // URL-safe, unique across products
    "name": "string",
    "category": "glassware",           // categories[].id
    "price": 24.0,                     // USD number (base price)
    "compareAtPrice": null,            // optional "was" price
    "description": "string",           // plain text; blank lines = paragraphs
    "images": ["images/products/x.svg"],// first = main image; relative paths
    "options": [ { "name": "Size", "values": [ { "label": "M", "priceDelta": 0 } ] } ],
    "personalization": { "enabled": true, "label": "Name(s) & date", "placeholder": "...", "maxLength": 80, "required": false },
    "tags": ["wedding"],
    "featured": false,
    "active": true,                    // false = hidden from storefront
    "leadTimeDays": 7,                 // shown as "Ships in ~N days"
    "createdAt": "2026-10-22"
  }],
  "bundles": [{
    "id": "slug-unique",               // unique across bundles
    "name": "string",
    "description": "string",
    "items": [ { "productId": "...", "qty": 2 } ],
    "price": 50.0,                     // bundle price (usually < sum of items)
    "images": [],                      // if empty, storefront uses first item's image
    "featured": false,
    "active": true
  }]
}
```

## `js/catalog.js` API (storefront and admin both use it for reads)

- `loadCatalog()` → `Promise<{categories, products, bundles}>` (all items, including inactive)
- `getActiveProducts(catalog)`, `getActiveBundles(catalog)`
- `findProduct(catalog, id)`, `findBundle(catalog, id)`, `findCategory(catalog, id)`
- `bundleRetailTotal(catalog, bundle)`: the summed item prices, used to show "You save $X"
- `formatPrice(number)` → `"$24.00"`
- `resolveAsset(path)`: prefixes paths so they work from both the root pages and `/admin/`

Swapping to Supabase later means changing `loadCatalog()` only (see docs/SUPABASE.md).

## Cart (localStorage key `mch_cart_v1`)

Line item: `{ key, type: "product"|"bundle", id, qty, options: {Size:"M"}, personalization: "text", unitPrice }`
`key` = type + id + JSON of options + personalization (same config merges qty).

## Checkout

- `config.checkout.mode = "request"` (current): the cart submits an **order request** (name, email, phone,
  needed-by date, notes, plus the line items). It sends to `config.forms.endpoint` (Formspree-style POST JSON)
  when that's set, and otherwise opens a prefilled `mailto:` to `config.shopEmail`. The confirmation tells the
  customer she'll reply with a final price/invoice.
- `config.checkout.mode = "stripe"` (future): `js/checkout.js` holds a `startStripeCheckout(cart)` stub.
  docs/STRIPE.md outlines the steps (Payment Links first, then a Checkout Session through a serverless function).

## Admin (`admin/`)

Static page. Auth = a GitHub fine-grained personal access token (Contents: read/write on this repo only),
pasted once and kept in localStorage. It reads and writes `data/products.json` and uploads images to
`images/products/` through the GitHub REST Contents API. A commit triggers a Pages rebuild (about 1 minute).
**Demo mode** (no token) lets you edit in memory and **Download products.json**.

## Design

Warm, handmade, cozy boutique. Brown, cream, and tan, with a muted sage/rose accent. Use tokens from `css/theme.css` only
(no hard-coded colors elsewhere). Headings use a serif ("Fraunces" from Google Fonts) and body text uses "Nunito Sans".
Mobile-first, so it should work great on a phone, with a 16px gutter and no horizontal scroll. Accessible: alt text, labels, focus styles,
and good contrast.
