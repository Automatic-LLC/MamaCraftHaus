# Mama Craft Haus

Website for Mama Craft Haus: handmade custom champagne glasses, Christmas ornaments, Easter baskets,
custom shirts and gifts.

- **Storefront:** home, shop with category filters, product and bundle pages, cart, custom-order form, about.
- **Admin panel:** at `/admin/`. Add and edit products, upload photos from a phone, build bundles, change
  descriptions and prices. Saves straight to this repo, and the site updates in about a minute.
  See [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md).
- **Checkout:** customers send an order request, and the shop replies with the final price or invoice.
  Online card payment is outlined in [docs/STRIPE.md](docs/STRIPE.md).
- **Database later:** product data is all read through `js/catalog.js`.
  Plan: [docs/SUPABASE.md](docs/SUPABASE.md).

Plain HTML, CSS and JavaScript with no build step. The shared design contract is in [SPEC.md](SPEC.md).

## Quick edits

| Want to change… | Edit |
| --- | --- |
| Colors and fonts | `css/theme.css` (all colors are variables at the top) |
| Shop name, email, social links, checkout mode | `js/config.js` |
| Products, bundles, categories | Use the admin panel, or edit `data/products.json` |
| About story | `about.html` |

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000  (admin: http://localhost:8000/admin/ → "Try demo mode")
```

Pages must be served over http rather than opened as files, because the browser blocks `fetch` from `file://`.

## Publish with GitHub Pages (free)

1. Merge this branch into `Main`.
2. Repo **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **Main**, folder **/ (root)**.
3. After about a minute the site is live at `https://<owner>.github.io/MamaCraftHouz/`.
4. Check that `js/config.js → github.branch` matches the branch Pages publishes from (here `Main`),
   so admin saves go live.

> GitHub Pages on a **private** repo needs a paid GitHub plan. For free hosting, make the repo public. It
> contains no secrets, because the admin token lives only in her browser.

### Custom domain

1. Settings → Pages → **Custom domain**: enter `www.yourdomain.com` and save. GitHub adds a `CNAME` file.
2. At your domain registrar, add DNS records:
   - `www`: **CNAME** to `<owner>.github.io`
   - apex (`yourdomain.com`): **A** records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Once DNS resolves, tick **Enforce HTTPS**.

## Before going live

- [ ] Set the real `shopEmail`, phone and social links in `js/config.js`
- [ ] Optional: create a free [Formspree](https://formspree.io) form and paste its URL into `config.forms.endpoint`,
      so order requests arrive without the customer's email app opening
- [ ] Replace the sample products and placeholder images through the admin panel
- [ ] Write the real story in `about.html`
- [ ] Pick final colors in `css/theme.css`
