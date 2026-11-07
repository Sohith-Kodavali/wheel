# The Milkshake Factory — tablet app

A deliberately small kiosk for the stall tablet. Three screens only:

1. **Menu** — tap drinks to add them.
2. **Total + Spin & Win** — review the order; on orders with 3 or more drinks spin the rigged wheel for a discount or pay without spinning. With 2 or fewer drinks it goes straight to payment.
3. **Pay** — a UPI QR for the exact amount.

No admin panel for customers, and the tablet UI stays plain HTML, CSS and JavaScript. Orders, the kitchen queue, sales numbers and the shared menu/settings live in a small backend (Supabase, with a local SQLite fallback), and the QR is generated in the browser from the configured UPI ID and the exact payable amount.

## Run it

```bash
cd milkshake-tablet
npm start
```

- **Order screen (tablet):** <http://localhost:5173>
- **Kitchen queue:** <http://localhost:5173/chef>
- **Analytics:** <http://localhost:5173/analytics>
- **Settings (admin):** <http://localhost:5173/settings>

There are no dependencies to install.

`npm start` loads `.env` automatically if it exists (Node 22.5+). Without Supabase settings the server falls back to the local SQLite file.

> Use `serve.js` for every screen. Menu prices, UPI details and the wheel are stored once in Supabase, so changing them from the settings page updates every device within about five seconds. Orders, the kitchen queue and analytics are shared the same way.

For a stall:

1. Open the order screen in Chrome on the tablet.
2. Tap the fullscreen button in the top-right corner.
3. Set the tablet to landscape and keep it on charge.
4. Optionally enable Chrome kiosk mode / keep the screen awake in Android settings.
5. Open the server's **Other devices** URL (printed on startup) on the kitchen phone, the admin phone and any extra order tablets — not `localhost`.

## Deploy on Vercel

Vercel serves the pages statically and runs the API through `api/index.js`; `vercel.json` rewrites every `/api/*` request to it, because Vercel's catch-all function routes only match one path segment. `vercel.json` also enables clean URLs, so `/chef`, `/analytics` and `/settings` work without `.html`.

1. Import the GitHub repo into Vercel (framework preset **Other**, no build command).
2. Add these Environment Variables for Production and Preview:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
3. Deploy.

Every `/api/*` request goes to the same serverless function, so orders, the chef queue, analytics and settings work exactly like the local server. Vercel's filesystem is read-only and stateless, so the SQLite fallback is not used there — Supabase is required.

**GitHub Pages cannot run this project.** It only serves files, so `/api/*` would 404 and the chef, settings and order screens would show connection errors.

## Supabase

Orders, analytics and the shared settings live in Supabase. To connect it:

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
3. Copy `.env.example` to `.env` and set:
   - `SUPABASE_URL` — Project Settings → Data API → Project URL.
   - `SUPABASE_SECRET_KEY` — Project Settings → API Keys → **Secret keys** (starts with `sb_secret_`).
   - On older projects, use the legacy `service_role` key as `SUPABASE_SERVICE_ROLE_KEY` instead.
4. Run `npm start` and check that the server prints `Storage : Supabase` and `Supabase : connected`.

The schema creates `orders`, `order_items` and `app_settings`, and enables row-level security with no public policies. The **secret / service role key bypasses RLS**, so keep it only in the server's `.env` — never in the browser, the tablet app, or git. Tables are not readable with the publishable key.

The `/settings` page has no password; anyone who can reach the URL can change the shared config. Keep it on the stall's network, or put the deployment behind access control if it is public.

If `SUPABASE_URL` or the key is missing, the server quietly uses the local SQLite fallback (`data/orders.db`) so the stall can keep selling.

### Local SQLite fallback

- Data lives in `data/orders.db` (SQLite, WAL mode). The `data/` folder is git-ignored.
- Back it up to keep the sales history; delete it to start fresh.
- Order numbers restart from 1 on a fresh database. In Supabase, the `orders.id` identity column is used internally; the chef screen never shows it.

## Kitchen queue

The chef screen is deliberately minimal — it shows **only the drinks to prepare**, never order numbers, prices or customer details.

- An order reaches the kitchen when the tablet opens its payment screen, so the staff can start preparing while the customer pays.
- Each pending order line appears as a big row: `×2 Oreo Milkshake` with a **DONE** button.
- Tapping **DONE** removes that drink from the queue and adds it to the "served today" counter.
- The page refreshes itself every 3 seconds, so new orders pop up without a reload.
- A chime plays when new tickets arrive. Tap **Enable sound** once (browsers block audio until a tap); afterwards it can be toggled with the same button.

The chef and analytics pages have no login. Keep them on the stall's local network and do not expose this server to the internet.

## Analytics

`/analytics` shows today's revenue, orders, drinks sold, pending drinks, average order value and discounts given, plus the top drinks today and a seven-day revenue chart. It also lists every order with its items and total; use **Remove** on a cancelled order to delete it and its items. It refreshes every 10 seconds.

## How orders behave

- Orders are upserted by an unguessable client token: if the customer goes back and edits the order before the kitchen starts it, the same order is updated instead of duplicated.
- Once a drink is marked done, later tablet edits cannot recreate it.
- The tablet posts the order when the payment screen opens. There is no payment verification in this app — staff still confirm the UPI payment manually.

## Settings — shared across devices

Open <http://localhost:5173/settings> on the admin phone or any device.

- There is no sign-in; anyone with the URL can change the settings.
- Saving pushes the configuration to Supabase. Every order screen polls every five seconds and re-renders, so a price or wheel change reaches all devices without a reload.
- The settings page never shows orders or customer details.

You can change:

- **UPI ID and display name.**
- **The UPI QR photo** — upload a PNG/JPG/WebP of the stall's scanner. It is resized in the browser and stored as a data URL in the shared settings.
- **QR mode on the payment screen** — use the uploaded stall QR, or the generated QR that already contains the exact amount.
- **Menu prices** — one price for every drink.
- **Out of stock / Special** — tick these per drink in the menu list. Out-of-stock drinks show a blocked card and cannot be added; special drinks get a badge on the order screen.
- **Wheel offers** — add, edit or remove the slices on the wheel (label, discount, wheel share and colour).
- **Spin sequence** — a separate ordered list of offers that decides what each spin lands on, plus the max-discount / minimum-payable limits.

### The QR photo, explained

A photo of a normal stall QR does **not** contain the order amount. If you choose the uploaded photo, the pay screen shows the amount and tells the customer to enter it in their UPI app. The **generated QR** encodes the UPI ID and the exact amount, so the customer does not have to type it.

- The photo is part of the shared settings and is served to every device.
- The settings page has no password; it is not encryption.

## Defaults in code

The shared settings override the fallbacks in `js/config.js`. The default menu, prices, wheel offers and spin sequence live there in `DEFAULT_MENU`, `DEFAULT_WHEEL` and `DEFAULT_SETTINGS`.

- **Rigging:** the wheel does not use random probabilities. Each spin takes the next offer from the saved sequence and stops on that slice. Every spin wins. Both the offers and the sequence are edited from the settings page.
- **Wheel area:** each offer has a **Wheel %** that sets its slice size. The settings page shows the running total and scales the slices to fill the wheel when you save.
- **Spin minimum:** the wheel unlocks at 3 drinks. With fewer, the bottom bar shows how many more are needed, and the total screen goes straight to payment.
- **Discount:** taken from the order total, then capped by the max discount and minimum payable settings.
- **Prices and menu:** every item has a single `price` in paise (`7500` = ₹75). The settings page edits the live prices; the defaults are in `DEFAULT_MENU`.

### Prices

| Drink | Price |
|---|---:|
| Milkshakes (Oreo / KitKat / Dark Fantasy) | ₹75 |
| Mojitos (Orange / Sweet Lime / Blue) | ₹39 |
| Cold Coffee | ₹65 |

- **Fewer than 3 drinks** → no wheel; the total screen continues straight to payment.
- **3 or more drinks** → the customer can spin for a discount on the order total, or pay without spinning.

The menu cards, bottom bar, summary and payment screen show that single price.

### Effects

A win triggers the weighted wheel, confetti, a radial spark/coin blast, a gold flash, screen shake, very loud tick/fanfare sounds with mute, and haptics. A 20% or 25% win gets the extra-loud jackpot treatment and a pulsing result card.

- Every button, drink card, stepper and admin control has a tap sound.
- The audio master is boosted (about 5× the original) with a limiter, so it stays loud without turning into harsh clipping.
- The wheel overlay has animated spotlights, carnival rays, a starfield, drifting bokeh, a gold rim, chasing bulbs, a gloss sweep and a bottom marquee.
- Use the speaker button in the wheel overlay to mute everything; the choice is remembered.

## What each screen does

- The menu is split into three sections — **Milkshakes**, **Mojitos** and **Cold Coffee** — with a live total bar and a **Clear** button. It is locked to the tablet screen and does not scroll between sections.
- Every card shows the drink's single price.
- Tapping a drink (or its Add button) adds one. The stepper changes quantities. Max 20 per drink.
- **Review order** opens the total screen. On orders with 3+ drinks it shows a **Spin & Win** button and a **Pay ₹X without spinning** link. With fewer it shows how many more drinks unlock the spin and a **Continue to payment** button instead.
- The wheel overlay is a weighted canvas wheel with real deceleration, tick sounds, mute, confetti, a spark/coin blast, a flash, screen shake, haptics, and a result panel.
- The result is locked for the order. Changing the order clears it and returns to the full order total.
- After spinning, **Pay ₹X** goes straight to the QR. The QR encodes the exact discounted amount, and the payment screen lists order total → discount → final.
- On the payment screen, **New order** requires two taps, so staff can clear the tablet after the customer pays.

## Notes

- No payment verification and no fake “payment received” state. The customer pays, then shows the screen to the staff.
- The app does not talk to Supabase yet. When you add it later, the menu, UPI settings and spin results can be moved into a Supabase table; the current config is intentionally a single local object.
- Fonts are loaded from Google Fonts. If the tablet is offline, it falls back to the system font; the layout and wheel still work.
- The QR library is the MIT-licensed `qrcode-generator` bundled in `js/qrcode.js`.
