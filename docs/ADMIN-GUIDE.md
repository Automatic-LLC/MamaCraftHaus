# Mama Craft Haus Shop Admin: Owner's Guide

This is your private control panel. You can add products, change prices and descriptions, upload photos, and make bundles, all from your phone. No computer skills needed.

Your admin page lives at your website address with `/admin/` on the end, for example:
`https://yourshop.com/admin/` (or `https://<your-github-name>.github.io/MamaCraftHouz/admin/` until you have your own domain).

## Put it on your phone's home screen

This makes it open like an app.

- **iPhone (Safari):** open the admin page, tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** open the admin page, tap the three dots menu, then **Add to Home screen**.

## Step 1: Make your shop key (one time only)

Your "key" is a long secret code that lets the admin page save changes to your website. You make it once on GitHub, then paste it into the admin page on each phone or computer you use.

1. Go to **github.com/settings/personal-access-tokens/new** and sign in.
2. **Token name:** type `Mama Craft Haus admin`.
3. **Expiration:** choose 1 year. (When it runs out, just make a new one the same way.)
4. **Repository access:** choose **Only select repositories**, then pick **MamaCraftHouz**.
5. **Permissions:** tap **Repository permissions**, find **Contents**, and change it to **Read and write**. Leave everything else alone.
6. Tap **Generate token**.
7. **Copy the long code** that appears. GitHub only shows it once. Paste it into a note to yourself until you finish step 2.

Keep the key private, like a password. Never post it or send it in a text to someone you don't trust.

## Step 2: Connect

1. Open your admin page.
2. Paste the key into the box under **Connect to your shop** and tap **Connect**.
3. You'll see your products. You're in!

The key is saved on that device only. Tap **Sign out** in the top corner (or in Settings) to remove it.

Want to look around first? Tap **Try demo mode**. You can try everything, and nothing gets published.

## Add a product with photos (from your phone)

1. Tap **Products**, then **+ Add product**.
2. Type the **Name**, choose a **Category**, and type the **Price**.
3. Write a **Description**. Leave a blank line between paragraphs.
4. Tap **Add photos**. Your phone asks if you want to take a photo or pick from your gallery. You can choose several at once. The first photo is the main one. Use the arrows to reorder, or **Make main** to pick a different main photo.
5. Add **Options** if customers choose things like a size or color. Tap **Shirt sizes** or **Colors** for a ready-made list. If a choice costs more (like a 3XL), type the extra amount in the **+$** box.
6. Turn on **Personalization** if customers should type names or a message. Say what to ask (like "Names & date").
7. Check the **How it will look** preview, then tap **Save** at the bottom.

You'll see: **"Saved! Your website will update in about a minute."**

Tip: if a similar product already exists (like another color or design), open the product list and tap **Duplicate**, then change just what's different.

## Hide a sold-out item

On the **Products** list, flip the **Showing in shop** switch off for that item. It disappears from the website but isn't deleted. Flip it back on when it's available again. (**Featured** puts it on the home page.)

## Make a bundle

1. Tap **Bundles**, then **+ Add bundle**.
2. Give it a **name** and a **description**.
3. In **Add products**, search for a product and tap **+ Add**. Use the **−** and **+** buttons to set how many.
4. The page adds up the **Items total** and suggests a price with 10% off. Change the discount, or type your own **Bundle price**. It shows **Customer saves $X**.
5. Add a photo if you like (otherwise the first product's photo is used), then tap **Save**.

If you delete a product that's inside a bundle, the admin warns you first and takes it out of the bundle for you.

## Categories

Tap **Categories** to rename groups, change descriptions or pictures, add a new group, or change the order (↑ ↓). A category that still has products can't be deleted. Move those products to another category first. Tap **Save categories** when done.

## How long until changes show on the website?

About **one minute** after you see "Saved!". If you don't see it yet, wait a little and refresh the page. Photos can take a moment too.

## Backups

In **Settings**, tap **Export backup** to download a copy of everything. **Import JSON** puts a backup back. It's a good idea to export a backup now and then.

## Photo tips

- Use **natural light**: near a window, not in direct sun, and no flash.
- Use a **plain, uncluttered background** (a table, a white sheet, or wood).
- Take **square photos** (or leave space around the product). They look best in the shop.
- Take a **close-up of the personalization** so customers see the detail.
- Wipe glass and wipe your phone lens first.
- Photos are shrunk automatically, so there's no need to resize them.

## If something goes wrong

- **"GitHub didn't accept your key"**: it may have expired. Make a new one (Step 1), sign out, and connect again.
- **"Can't reach GitHub"**: check your internet and try again.
- **"The shop was changed somewhere else"**: this happens if you edited on two devices at once. The newest version loads, your edits stay on screen, and you just tap **Save** again.
- **Not saving?** Make sure the key's **Contents** permission is **Read and write**.
- Your edits are never lost if you leave by accident: the admin asks first.
