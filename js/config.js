// Shop-wide settings. Edit these values; no code changes needed.
export const config = {
  shopName: "Mama Craft Haus",
  tagline: "Handmade custom gifts, glassware & shirts — made with love at home.",
  shopEmail: "hello@mamacrafthaus.com", // TODO: replace with the real inbox
  phone: "",
  location: "", // e.g. "Springfield, MO — local pickup available"
  social: { facebook: "", instagram: "", tiktok: "", etsy: "" },
  currency: "USD",

  checkout: {
    // "request" = customer sends an order request, shop replies with invoice.
    // "stripe"  = online card checkout (not set up yet — see docs/STRIPE.md).
    mode: "request",
    stripe: {
      publishableKey: "",
      // Option A (simplest): Stripe Payment Links per product id → URL
      paymentLinks: {},
      // Option B: serverless endpoint that creates a Checkout Session
      sessionEndpoint: "",
    },
  },

  forms: {
    // Optional: a Formspree (or similar) endpoint, e.g. "https://formspree.io/f/xxxx".
    // If empty, order/custom requests open the customer's email app instead.
    endpoint: "",
  },

  // Used by the admin panel to save changes back to GitHub.
  github: {
    owner: "Automatic-LLC",
    repo: "MamaCraftHouz",
    branch: "Main",
    catalogPath: "data/products.json",
    imageDir: "images/products",
  },

  // Where catalog data comes from: "json" now, "supabase" later.
  dataSource: "json",
  supabase: { url: "", anonKey: "" },
};
