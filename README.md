# The Milkshake Factory — tablet app

A deliberately small kiosk for the stall tablet. Three screens only:

1. **Menu** — tap drinks to add them.
2. **Total + Spin & Win** — review the order, spin the rigged wheel for a discount, or pay without spinning.
3. **Pay** — a UPI QR for the exact amount.

No admin panel, no database, no order history, no backend. Everything is plain HTML, CSS and JavaScript. The QR is generated in the browser from the configured UPI ID and the exact payable amount.

## Run it

```bash
cd milkshake-tablet
npm start
```

Open <http://localhost:5173> on the tablet. There are no dependencies to install.

> If you prefer, any static file server works (for example `python -m http.server 5173`). Opening `index.html` directly from the filesystem will not work because the app uses ES modules.

For a stall:

1. Open the site in Chrome.
2. Tap the fullscreen button in the top-right corner.
3. Set the tablet to landscape and keep it on charge.
4. Optionally enable Chrome kiosk mode / keep the screen awake in Android settings.

## Local admin — no backend needed

Tap the **Settings** button (gear icon) in the top-right corner.

- Default PIN: **`1234`** — change it in the admin panel after the first login.
- Everything is stored in this tablet's browser `localStorage`. There is no server and no database.

You can change:

- **UPI ID and display name.**
- **The UPI QR photo** — upload a PNG/JPG/WebP of the stall's scanner. It is resized locally and saved as a data URL in the browser.
- **QR mode on the payment screen** — use the uploaded stall QR, or the generated QR that already contains the exact amount.
- **Menu prices** — normal and Spin & Win price for every drink.
- **Spin & Win** — the rigged prize sequence and the max-discount / minimum-payable limits.
- **Admin PIN** (4–8 digits).

### The QR photo, explained

A photo of a normal stall QR does **not** contain the order amount. If you choose the uploaded photo, the pay screen shows the amount and tells the customer to enter it in their UPI app. The **generated QR** encodes the UPI ID and the exact amount, so the customer does not have to type it.

- The photo lives on that one tablet. Clearing Chrome's site data removes it.
- For multiple tablets, either upload the photo on each one, or connect Supabase later so all tablets share the same settings.
- The PIN is only a local staff gate (it keeps customers out of the settings screen); it is not encryption.

If the PIN is forgotten, clear the site's localStorage/history for the page; the defaults (including PIN `1234`) return.

## Defaults in code

The admin panel overrides the fallbacks in `js/app.js`. The default menu, prices, wheel weights and spin sequence live at the top of that file in `DEFAULT_MENU`, `DEFAULT_SETTINGS` and `SEGMENTS`.

- **Rigging:** the wheel does not use random probabilities. Each spin takes the next percentage from the saved sequence, then the animation stops on a matching segment. Every spin wins. Change the sequence from the admin panel.
- **Wheel area:** `weight` sets the slice size. 10% has 34% + 18% of the wheel, 15% has 24%, 20% has 14%, and the 25% jackpot is the narrowest slice.
- **Discount:** taken from the **Spin & Win total**, then capped by the max discount and minimum payable settings.
- **Prices and menu:** every item has `price` (normal) and `spinPrice` in paise (`7000` = ₹70, `8000` = ₹80). The admin panel edits the live prices; the defaults are in `DEFAULT_MENU`.
- **Prizes on the wheel:** the `SEGMENTS` array. Every percentage in the rigged sequence must have a matching segment.

### Spin & Win pricing

Every drink has two prices: the normal price and a higher Spin & Win price (+₹10 by default).

| Order | Normal total | Spin & Win starting total |
|---|---:|---:|
| Oreo ₹70 + Lime ₹40 | ₹110 | ₹130 |
| Oreo + KitKat + Cold Coffee | ₹200 | ₹230 |

- **Pay without spinning** → the customer pays the normal total.
- **Spin & Win** → the base becomes the higher Spin & Win total. The discount is calculated on **that** amount.
- Example: normal ₹110, Spin & Win ₹130. Win 10% → ₹13 off ₹130 → **pay ₹117**. Win 25% → ₹32.50 off (capped at ₹60) → **pay ₹97.50**.

The menu cards, bottom bar, summary and payment screen all show both prices so the higher spin price is never hidden.

### Effects

A win triggers the weighted wheel, confetti, a radial spark/coin blast, a gold flash, screen shake, very loud tick/fanfare sounds with mute, and haptics. A 20% or 25% win gets the extra-loud jackpot treatment and a pulsing result card.

- Every button, drink card, stepper and admin control has a tap sound.
- The audio master is boosted (about 5× the original) with a limiter, so it stays loud without turning into harsh clipping.
- The wheel overlay has animated spotlights, carnival rays, a starfield, drifting bokeh, a gold rim, chasing bulbs, a gloss sweep and a bottom marquee.
- Use the speaker button in the wheel overlay to mute everything; the choice is remembered.

## What each screen does

- The menu is split into three sections — **Milkshakes**, **Mojitos** and **Cold Coffee** — with a live total bar and a **Clear** button. It is locked to the tablet screen and does not scroll between sections.
- Every card shows the normal price and the higher Spin & Win price.
- Tapping a drink (or its Add button) adds one. The stepper changes quantities. Max 20 per drink.
- **Review order** opens the total screen. The total screen shows the normal total, the higher Spin & Win starting total, a **Spin & Win** button, and a **Pay normal ₹X without spinning** link.
- The wheel overlay is a weighted canvas wheel with real deceleration, tick sounds, mute, confetti, a spark/coin blast, a flash, screen shake, haptics, and a result panel.
- The result is locked for the order. Changing the order clears it and returns to the normal total.
- After spinning, **Pay ₹X** goes straight to the QR. The QR encodes the exact discounted amount, and the payment screen lists normal total → Spin & Win starting total → discount → final.
- On the payment screen, **New order** requires two taps, so staff can clear the tablet after the customer pays.

## Notes

- No payment verification and no fake “payment received” state. The customer pays, then shows the screen to the staff.
- The app does not talk to Supabase yet. When you add it later, the menu, UPI settings and spin results can be moved into a Supabase table; the current config is intentionally a single local object.
- Fonts are loaded from Google Fonts. If the tablet is offline, it falls back to the system font; the layout and wheel still work.
- The QR library is the MIT-licensed `qrcode-generator` bundled in `js/qrcode.js`.
