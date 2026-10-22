# Moving to Supabase later (outline)

Today the catalog is `data/products.json` in the repo and the admin commits to it through the GitHub API. Supabase gives you a real database, image storage and proper logins, with no GitHub token on the owner's phone. Nothing in the storefront or admin UI needs a rewrite: only `loadCatalog()` and one new admin store change.

## 1. Create the project

1. Create a Supabase project. Note the **Project URL** and the **anon (public) key**. The anon key is safe in the browser because RLS protects the data.
2. Run the SQL below in the SQL editor.
3. Create the owner's login: Authentication, Users, "Add user" (email and password). Disable public sign-ups under Authentication, Providers, Email, so nobody else can register.

## 2. SQL schema

```sql
create table categories (
  id          text primary key,           -- slug
  name        text not null,
  description text not null default '',
  image       text not null default '',
  position    int  not null default 0
);

create table products (
  id               text primary key,      -- slug
  name             text not null,
  category         text not null references categories(id) on update cascade,
  price            numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2),
  description      text not null default '',
  images           text[] not null default '{}',
  options          jsonb  not null default '[]',   -- [{name, values:[{label, priceDelta}]}]
  personalization  jsonb  not null default '{"enabled":false}',
  tags             text[] not null default '{}',
  featured         boolean not null default false,
  active           boolean not null default true,
  lead_time_days   int not null default 7,
  created_at       date not null default current_date,
  position         int not null default 0
);

create table bundles (
  id          text primary key,
  name        text not null,
  description text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  images      text[] not null default '{}',
  featured    boolean not null default false,
  active      boolean not null default true,
  position    int not null default 0
);

create table bundle_items (
  bundle_id  text not null references bundles(id)  on delete cascade,
  product_id text not null references products(id) on delete restrict,  -- blocks deleting a bundled product
  qty        int  not null default 1 check (qty >= 1),
  primary key (bundle_id, product_id)
);
```

Keep the JSON field names identical to SPEC.md (`compareAtPrice`, `leadTimeDays`, `createdAt`) in `loadCatalog()` by mapping the snake_case columns (see section 4), so the rest of the site doesn't change.

## 3. Row Level Security

```sql
alter table categories   enable row level security;
alter table products     enable row level security;
alter table bundles      enable row level security;
alter table bundle_items enable row level security;

-- Public (anon) can read active rows only
create policy "public read categories" on categories for select using (true);
create policy "public read products"   on products   for select using (active);
create policy "public read bundles"    on bundles    for select using (active);
create policy "public read bundle items" on bundle_items for select
  using (exists (select 1 from bundles b where b.id = bundle_id and b.active));

-- Only the signed-in admin can write (and see inactive rows).
-- Put the owner's user id in a table or use a custom claim; simplest: one admin email.
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'owner@example.com'
$$;

create policy "admin all categories"   on categories   for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin all products"     on products     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin all bundles"      on bundles      for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin all bundle items" on bundle_items for all to authenticated using (is_admin()) with check (is_admin());
```

The admin lists inactive rows too, and the admin policy covers that because it applies to `select` as well.

## 4. Storage

Create a **public** bucket `product-images` (Storage, New bucket, Public).

```sql
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin write images" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());
```

Product `images` then hold the public URL (`https://<ref>.supabase.co/storage/v1/object/public/product-images/<file>.jpg`). `resolveAsset()` already passes `https:` URLs through untouched.

## 5. Storefront: `loadCatalog()` in `js/catalog.js`

Set `config.dataSource = "supabase"` and fill `config.supabase.url` and `anonKey`. Then replace the `throw` in `loadCatalog()`:

```js
if (config.dataSource === "supabase") {
  const { url, anonKey } = config.supabase;
  const get = async (table, qs = "") => {
    const r = await fetch(`${url}/rest/v1/${table}?select=*${qs}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },   // admin passes its session token instead
    });
    if (!r.ok) throw new Error(`Could not load ${table} (${r.status})`);
    return r.json();
  };
  const [cats, prods, bundles, items] = await Promise.all([
    get("categories", "&order=position"), get("products", "&order=position"),
    get("bundles", "&order=position"), get("bundle_items"),
  ]);
  return {
    categories: cats,
    products: prods.map(p => ({ ...p, compareAtPrice: p.compare_at_price, leadTimeDays: p.lead_time_days, createdAt: p.created_at })),
    bundles: bundles.map(b => ({ ...b, items: items.filter(i => i.bundle_id === b.id).map(i => ({ productId: i.product_id, qty: i.qty })) })),
  };
}
```

Either load the tiny `@supabase/supabase-js` ES module from a CDN, or use plain `fetch` as above. Keep prices as numbers (`Number(p.price)`), since PostgREST returns `numeric` as a number by default but check it.

## 6. Admin: `SupabaseStore` in `admin/store.js`

Implement the same interface as `GitHubStore` and `DemoStore`:

- `kind = "supabase"`; `load()` reuses the mapping above but with the **user's session token** (so inactive rows are included).
- `signIn(email, password)` calls `POST {url}/auth/v1/token?grant_type=password` and keeps `access_token` and `refresh_token` (localStorage), refreshing with `grant_type=refresh_token`. The sign-in screen swaps the token box for an email and password form when `config.dataSource === "supabase"`.
- `save(catalog, message)` diffs against the last loaded catalog and sends upserts (`POST /rest/v1/products` with `Prefer: resolution=merge-duplicates`) and deletes. Rewrite `bundle_items` for each changed bundle. Row-level saves mean **no more sha conflicts**. Keep `position` equal to array index so ordering persists.
- `uploadImage(blob, {slug})` does `POST {url}/storage/v1/object/product-images/<slug>-<ts>.jpg` with the user's token and returns the public URL.
- `createStore()` picks it when `config.dataSource === "supabase"`.

Validation (`admin/validate.js`), the editors, photos pipeline and bundle builder stay as they are.

## 7. Migration steps

1. Create tables, policies and the bucket.
2. Write a one-off script (Node or SQL `insert`s) that reads `data/products.json` and inserts rows. Upload existing `images/products/*` into the bucket and rewrite the paths, or leave them as repo-relative paths (still works).
3. Flip `config.dataSource` to `"supabase"` on a branch, test the storefront, then merge.
4. Keep `data/products.json` as a backup (the admin's **Export backup** still works in any mode).
