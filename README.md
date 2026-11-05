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

## Change the important bits

Everything is in **`js/app.js`**, at the very top:

```js
const UPI = {
  id: 'milkshakefactory@upi',   // ← put the stall's real UPI ID here
  name: 'The Milkshake Factory',
};

// The wheel is rigged: these are the prizes in the exact order they appear.
const RIGGED_SEQUENCE = [10, 10, 15, 10, 20, 10, 25, 10, 15, 10];

const LIMITS = {
  maxDiscount: 6000, // ₹60, in paise
  minPayable: 3000,  // ₹30, in paise
};
```

- **Rigging:** the wheel does not use random probabilities. Each spin takes the next percentage from `RIGGED_SEQUENCE`, then the animation stops on a matching segment. Every spin wins. Change the list to control the order; for example, `[10, 15, 10, 20]` alternates.
- **Discount:** taken from the current cart total, then capped by `maxDiscount` and `minPayable`.
- **Prices and menu:** the `MENU` array below the config. Each item has a price in paise (`7000` = ₹70).
- **Prizes on the wheel:** the `SEGMENTS` array. Every percentage in the rigged sequence must have a matching segment.

## What each screen does

- The menu has all seven drinks, a live total bar, and a **Clear** button.
- Tapping a drink (or its Add button) adds one. The stepper changes quantities. Max 20 per drink.
- **Review order** opens the total screen. The total screen shows the order, a **Spin & Win** card, and a **Pay without spinning** link.
- The wheel overlay has a canvas prize wheel with real deceleration, tick sounds, mute, confetti, a flash, screen shake, haptics, and a result panel.
- The result is locked for the order. Changing the order clears it and returns to the normal total.
- After spinning, **Pay ₹X** goes straight to the QR. The QR encodes the exact discounted amount.
- On the payment screen, **New order** requires two taps, so staff can clear the tablet after the customer pays.

## Notes

- No payment verification and no fake “payment received” state. The customer pays, then shows the screen to the staff.
- The app does not talk to Supabase yet. When you add it later, the menu, UPI settings and spin results can be moved into a Supabase table; the current config is intentionally a single local object.
- Fonts are loaded from Google Fonts. If the tablet is offline, it falls back to the system font; the layout and wheel still work.
- The QR library is the MIT-licensed `qrcode-generator` bundled in `js/qrcode.js`.
