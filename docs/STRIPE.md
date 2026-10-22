# Adding Stripe later (outline)

Today the site runs in **request mode** (`config.checkout.mode = "request"`): customers send an order request and
the shop replies with a final price and invoice. When you're ready for online card payments:

## 0. Prerequisites
- Create a Stripe account at stripe.com and finish business verification (bank account, etc.).
- Work in **test mode** first (test keys and test cards such as `4242 4242 4242 4242`).

## Option A: Payment Links (no server, easiest)
1. In the Stripe Dashboard, create a **Payment Link** for each product (or bundle). Enable *Collect shipping address*
   and add a **custom field** called "Personalization" (text), because a link can't carry the text typed on the site.
2. Paste the URLs into `js/config.js`:
   ```js
   checkout: { mode: "stripe", stripe: { paymentLinks: { "custom-tee": "https://buy.stripe.com/..." } } }
   ```
3. Fill in `startStripeCheckout(cart)` in `js/checkout.js` to redirect to the matching link.
- **Limitations:** one product per link (no real multi-item cart); options with price changes need a link per variant;
  personalization must be re-entered on Stripe's page; quantity is chosen on Stripe.

## Option B: Checkout Session via a serverless function (full cart)
1. Write a small function (Vercel, Netlify, or Supabase Edge Function) that accepts the cart (ids, options, qty only).
2. **Server-side**: look up each item in `data/products.json`, recompute prices (never trust client prices), and create a
   Stripe Checkout Session (`stripe.checkout.sessions.create`) with line items, shipping options, and the
   personalization text in line-item/session `metadata`. Return `{ url }`.
3. Put the function URL in `config.checkout.stripe.sessionEndpoint`; `startStripeCheckout(cart)` POSTs the cart and
   redirects to `url`.
4. Add a **webhook** endpoint for `checkout.session.completed` (verify the signature) that emails the shop the order
   (items, options, personalization, address) and optionally the customer a receipt.
5. Keep the Stripe **secret key** only in the function's environment variables, never in this repo.

## Go live
Set `config.checkout.mode` to `"stripe"` (the cart page then shows a Checkout button instead of the request form).

## Checklist
- [ ] Stripe account created and verified
- [ ] Products/prices decided (shipping, tax settings, local pickup option)
- [ ] Option chosen (A or B) and built in test mode
- [ ] Personalization captured (custom field or session metadata) and visible in the order email
- [ ] Prices validated server-side (Option B)
- [ ] Webhook set up and order notification email tested
- [ ] Success and cancel pages added; refund and shipping policy text published
- [ ] Test purchase end to end with a test card
- [ ] Switch to live keys; set `config.checkout.mode = "stripe"`; make one real small purchase
