import { drinkArt, logoMark } from './art.js';
import {
  DEFAULT_MENU,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SPIN_MIN_TOTAL,
  escapeHtml,
  normalizeSettings,
} from './config.js';
import { PrizeWheel, WheelSound, blast, celebrate } from './wheel.js';

/* ==================================================================
   SHARED SETTINGS — fetched from the server and cached for offline use
   ================================================================== */

let SETTINGS = normalizeSettings(readSettingsCache());
let MENU = [];
let SEGMENTS = DEFAULT_SETTINGS.wheel.segments.map((segment) => ({ ...segment }));
let RIGGED_SEQUENCE = [];
let LIMITS = { maxDiscount: 6000, minPayable: 3000 };
let settingsSignature = JSON.stringify(SETTINGS);

function readSettingsCache() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  } catch {
    return null;
  }
}

function cacheSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A large QR photo can exceed localStorage; the server still has it.
  }
}

function applySettings() {
  MENU = DEFAULT_MENU.map((item) => {
    const override = SETTINGS.menu[item.id];
    return override ? { ...item, price: override.price } : { ...item };
  });
  SEGMENTS = SETTINGS.wheel.segments.map((segment) => ({
    ...segment,
    label: /^(\d+(?:\.\d+)?)?%\s*OFF$/i.test(segment.label) ? `${segment.percent}% OFF` : segment.label,
  }));
  RIGGED_SEQUENCE = SETTINGS.spin.sequence.slice();
  LIMITS = {
    maxDiscount: SETTINGS.spin.maxDiscount,
    minPayable: SETTINGS.spin.minPayable,
  };
  if (wheel) {
    wheel.destroy();
    wheel = null;
  }
  renderPrizePreview();
  state.sequenceIndex = 0;
}

async function pullSettings() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    const next = normalizeSettings(data?.settings);
    const signature = JSON.stringify(next);
    if (signature === settingsSignature) return false;

    settingsSignature = signature;
    SETTINGS = next;
    cacheSettings(next);
    return true;
  } catch {
    return false;
  }
}

async function syncSettings({ initial = false } = {}) {
  if (spinning) return;

  const changed = await pullSettings();
  if (!changed || initial) return;

  if (state.spin) clearSpin();
  if (overlay.classList.contains('is-open')) closeWheel();

  applySettings();
  renderMenu();
  if (state.screen === 'summary') renderSummary();
  if (state.screen === 'pay') renderPay();
}

/* ==================================================================
   STATE & ELEMENTS
   ================================================================== */

const state = {
  cart: new Map(),
  spin: null,
  sequenceIndex: 0,
  screen: 'menu',
  orderToken: '',
  orderSignature: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const menuGrid = $('#menu-grid');
const orderBar = $('#order-bar');
const barCount = $('#bar-count');
const barTotal = $('#bar-total');
const barUnlock = $('#bar-unlock');
const reviewBtn = $('#review-btn');
const clearBtn = $('#clear-cart');
const summaryLines = $('#summary-lines');
const totalCard = $('#total-card');
const summaryUpsell = $('#summary-upsell');
const upsellRow = $('#upsell-row');
const overlay = $('#wheel-overlay');
const wheelIntro = $('#wheel-intro');
const wheelResult = $('#wheel-result');
const spinBtn = $('#spin-btn');
const muteBtn = $('#mute-btn');
const flash = $('#flash');
const qrCode = $('#qr-code');
const newOrderBtn = $('#new-order');
const toast = $('#toast');

let wheel = null;
let spinning = false;
let muted = localStorage.getItem('msf-tablet-muted') === '1';
let resetArmed = false;
let resetTimer = 0;

const uiSound = new WheelSound(muted);

/* ==================================================================
   SMALL HELPERS
   ================================================================== */

function icon(name) {
  return `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function money(paise) {
  const value = Number(paise) / 100;
  return `₹${Number.isInteger(value) ? value.toLocaleString('en-IN') : value.toFixed(2)}`;
}

function playClick() {
  uiSound.blip(660 + Math.random() * 90, 0.045, 'triangle', 0.16);
}

function playPop() {
  uiSound.blip(520, 0.06, 'sine', 0.2);
  uiSound.blip(820, 0.08, 'triangle', 0.16, 0.035);
}

function playSuccess() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    uiSound.blip(freq, 0.22, 'triangle', 0.2, index * 0.08);
  });
}

function playWhoosh() {
  [0, 1, 2, 3].forEach((index) => {
    uiSound.blip(320 + index * 90, 0.12, 'sine', 0.1, index * 0.04);
  });
}

function countItems() {
  let count = 0;
  for (const qty of state.cart.values()) count += qty;
  return count;
}

function cartTotal() {
  let total = 0;
  for (const [id, qty] of state.cart) {
    const item = MENU.find((entry) => entry.id === id);
    if (item) total += item.price * qty;
  }
  return total;
}

function lines() {
  return MENU.filter((item) => state.cart.has(item.id)).map((item) => {
    const qty = state.cart.get(item.id);
    return {
      ...item,
      qty,
      lineTotal: item.price * qty,
    };
  });
}

function spinUnlocked() {
  return cartTotal() >= SPIN_MIN_TOTAL;
}

function spinShortfall() {
  return Math.max(0, SPIN_MIN_TOTAL - cartTotal());
}

function updateSpinGate() {
  const total = cartTotal();
  const count = countItems();
  const unlocked = total >= SPIN_MIN_TOTAL;
  const shortfall = Math.max(0, SPIN_MIN_TOTAL - total);

  if (barUnlock) {
    barUnlock.hidden = count === 0;
    barUnlock.textContent =
      count === 0 ? '' : unlocked ? 'Spin & Win unlocked' : `Add ${money(shortfall)} to unlock Spin & Win`;
    barUnlock.classList.toggle('is-unlocked', unlocked && count > 0);
  }

  const stepLabel = $('#step-summary-label');
  if (stepLabel) stepLabel.textContent = unlocked ? 'Total & Spin' : 'Total';

  const summarySub = $('#summary-sub');
  if (summarySub) {
    summarySub.textContent = unlocked
      ? 'Check the drinks, then spin for a discount or pay as is.'
      : `Add ${money(shortfall)} more to unlock Spin & Win, or continue to payment.`;
  }
}

function conicGradient(segments) {
  const total = segments.reduce((sum, segment) => sum + (Number(segment.weight) || 1), 0);
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = (cursor / total) * 100;
    cursor += Number(segment.weight) || 1;
    const end = (cursor / total) * 100;
    return `${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function maxWheelPercent() {
  return Math.max(0, ...SEGMENTS.map((segment) => segment.percent));
}

function renderPrizePreview() {
  const preview = $('#prize-preview');
  if (!preview) return;
  preview.innerHTML = SEGMENTS.map(
    (segment) =>
      `<li><span class="prize-dot" style="background:${segment.color}"></span>${escapeHtml(segment.label)}</li>`,
  ).join('');
  const sticker = $('#wheel-sticker');
  if (sticker) sticker.textContent = `UP TO ${maxWheelPercent()}% OFF`;
}

function discountFor(total, percent) {
  let discount = Math.round((total * percent) / 100);
  discount = Math.min(discount, LIMITS.maxDiscount);
  discount = Math.min(discount, Math.max(0, total - LIMITS.minPayable));
  discount = Math.max(0, discount);
  return { discount, final: total - discount };
}

/* ==================================================================
   MENU
   ================================================================== */

function controlsFor(item) {
  const qty = state.cart.get(item.id) || 0;
  if (qty === 0) {
    return `
      <span class="tap-hint">Tap card to add</span>
      <button class="add-pill" type="button" data-add="${item.id}">
        ${icon('plus')} Add
      </button>`;
  }
  return `
    <div class="stepper" role="group" aria-label="Quantity for ${item.name}">
      <button class="step-btn" type="button" data-step="-1" data-id="${item.id}" aria-label="Remove one ${item.name}">
        ${icon('minus')}
      </button>
      <span class="step-qty">${qty}</span>
      <button class="step-btn" type="button" data-step="1" data-id="${item.id}" aria-label="Add one ${item.name}">
        ${icon('plus')}
      </button>
    </div>
    <span class="line-total">${money(item.price * qty)}</span>`;
}

function cardTemplate(item) {
  return `
    <article class="drink-card" data-id="${item.id}">
      <div class="card-media tint-${item.tint}">
        <span class="card-flavor">${item.flavour}</span>
        <span class="card-count" data-count hidden>0</span>
        <div class="card-art" aria-hidden="true">${drinkArt(item.art)}</div>
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <h3>${item.name}</h3>
          <span class="card-price">${money(item.price)}</span>
        </div>
        <p class="card-desc">${item.desc}</p>
        <div class="card-controls" data-controls>${controlsFor(item)}</div>
      </div>
    </article>`;
}

function promoWideTemplate() {
  return `
    <article class="promo-tile promo-wide" aria-hidden="true">
      <span class="mini-wheel" style="background:${conicGradient(SEGMENTS)}"></span>
      <div>
        <span class="eyebrow">Orders ${money(SPIN_MIN_TOTAL)}+ get one spin</span>
        <h3>SPIN &amp; WIN</h3>
        <p>Win up to ${maxWheelPercent()}% off your total. One spin, instantly applied.</p>
      </div>
    </article>`;
}

function categorySection(index, title, tagline, items, extra = '') {
  return `
    <section class="category-section">
      <div class="category-head">
        <div class="category-title">
          <span class="category-index">0${index}</span>
          <h2>${title}</h2>
          <span class="category-tagline">${tagline}</span>
        </div>
        <span class="category-count">${items.length} drink${items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="category-row">
        ${items.map(cardTemplate).join('')}
        ${extra}
      </div>
    </section>`;
}

function renderMenu() {
  const milkshakes = MENU.filter((item) => item.category === 'Milkshake');
  const mojitos = MENU.filter((item) => item.category === 'Mojito');
  const coffee = MENU.filter((item) => item.category === 'Cold Coffee');

  menuGrid.innerHTML = [
    categorySection(1, 'Milkshakes', 'Thick, creamy, loaded', milkshakes),
    categorySection(2, 'Mojitos', 'Fizzy and ice cold', mojitos),
    categorySection(3, 'Cold coffee', 'Bold and smooth', coffee, promoWideTemplate()),
  ].join('');

  renderAllCards();
  renderBar();
}

function updateCard(id) {
  const card = menuGrid.querySelector(`.drink-card[data-id="${id}"]`);
  if (!card) return;
  const item = MENU.find((entry) => entry.id === id);
  if (!item) return;
  const qty = state.cart.get(id) || 0;
  card.classList.toggle('is-added', qty > 0);
  const badge = card.querySelector('[data-count]');
  if (badge) {
    badge.textContent = String(qty);
    badge.hidden = qty === 0;
  }
  const controls = card.querySelector('[data-controls]');
  if (controls) controls.innerHTML = controlsFor(item);
}

function renderAllCards() {
  for (const item of MENU) updateCard(item.id);
}

function renderBar() {
  const count = countItems();
  const total = cartTotal();
  barCount.textContent = count
    ? `${count} drink${count === 1 ? '' : 's'} in this order`
    : 'Tap a drink to start';
  barTotal.textContent = money(total);
  updateSpinGate();
  reviewBtn.disabled = count === 0;
  clearBtn.hidden = count === 0;
}

function bumpCard(id) {
  const card = menuGrid.querySelector(`.drink-card[data-id="${id}"]`);
  if (!card) return;
  card.classList.remove('is-bumped');
  void card.offsetWidth;
  card.classList.add('is-bumped');
  setTimeout(() => card.classList.remove('is-bumped'), 340);
}

function clearSpin({ resetPanel = true } = {}) {
  if (!state.spin) return;
  state.spin = null;
  if (resetPanel) resetWheelUI();
}

function changeQty(id, delta) {
  const current = state.cart.get(id) || 0;
  const next = Math.max(0, Math.min(20, current + delta));
  if (next === current) return;
  if (next === 0) state.cart.delete(id);
  else state.cart.set(id, next);

  clearSpin();
  updateCard(id);
  renderBar();

  if (state.screen === 'summary') renderSummary();
}

function addItem(id) {
  const current = state.cart.get(id) || 0;
  if (current >= 20) return;
  changeQty(id, 1);
  bumpCard(id);
  playPop();
}

function clearCart() {
  state.cart.clear();
  clearSpin();
  renderAllCards();
  renderBar();
}

/* ==================================================================
   SUMMARY
   ================================================================== */

function lineTemplate(item) {
  return `
    <article class="order-line" data-line="${item.id}">
      <div class="line-thumb tint-${item.tint}">
        <div class="card-art" aria-hidden="true">${drinkArt(item.art)}</div>
      </div>
      <div class="line-info">
        <span class="line-cat">${item.category} · ${item.flavour}</span>
        <h3>${item.name}</h3>
        <div class="line-actions">
          <div class="stepper" role="group" aria-label="Quantity for ${item.name}">
            <button class="step-btn" type="button" data-line-step="-1" data-id="${item.id}" aria-label="Remove one ${item.name}">
              ${icon('minus')}
            </button>
            <span class="step-qty">${item.qty}</span>
            <button class="step-btn" type="button" data-line-step="1" data-id="${item.id}" aria-label="Add one ${item.name}">
              ${icon('plus')}
            </button>
          </div>
          <button class="remove-line" type="button" data-remove="${item.id}" aria-label="Remove ${item.name}">
            ${icon('trash')}
          </button>
        </div>
      </div>
      <div class="line-price">
        <strong>${money(item.lineTotal)}</strong>
        <small>${money(item.price)} each</small>
      </div>
    </article>`;
}

function upsellCardTemplate(item) {
  const qty = state.cart.get(item.id) || 0;
  const controls =
    qty === 0
      ? `<button class="upsell-add" type="button" data-add="${item.id}" aria-label="Add ${item.name}">
          ${icon('plus')} Add
        </button>`
      : `<div class="stepper" role="group" aria-label="Quantity for ${item.name}">
          <button class="step-btn" type="button" data-line-step="-1" data-id="${item.id}" aria-label="Remove one ${item.name}">
            ${icon('minus')}
          </button>
          <span class="step-qty">${qty}</span>
          <button class="step-btn" type="button" data-line-step="1" data-id="${item.id}" aria-label="Add one ${item.name}">
            ${icon('plus')}
          </button>
        </div>`;

  return `
    <article class="upsell-card${qty ? ' is-added' : ''}" data-id="${item.id}">
      <div class="upsell-thumb tint-${item.tint}">
        <div class="card-art" aria-hidden="true">${drinkArt(item.art)}</div>
      </div>
      <div class="upsell-info">
        <h3>${item.name}</h3>
        <div class="upsell-foot">
          <span class="upsell-price">${money(item.price)}</span>
          ${controls}
        </div>
      </div>
    </article>`;
}

function renderSummaryUpsell() {
  if (!summaryUpsell || !upsellRow) return;
  const total = cartTotal();
  if (total >= SPIN_MIN_TOTAL) {
    summaryUpsell.hidden = true;
    upsellRow.innerHTML = '';
    return;
  }
  summaryUpsell.hidden = false;
  const title = $('#upsell-title');
  if (title) title.textContent = `Add ${money(SPIN_MIN_TOTAL - total)} more to unlock the wheel`;
  upsellRow.innerHTML = MENU.map(upsellCardTemplate).join('');
}

function totalCardTemplate() {
  const total = cartTotal();
  const count = countItems();
  const spin = state.spin && total >= SPIN_MIN_TOTAL ? state.spin : null;

  if (spin) {
    return `
      <span class="total-label">Amount to pay</span>
      <strong class="total-amount">${money(spin.final)}</strong>
      <span class="total-sub">${spin.percent}% off your total</span>
      <div class="total-rule"></div>
      <div class="discline"><span>Order total</span><strong>${money(spin.total)}</strong></div>
      <div class="discline is-discount"><span>Spin &amp; Win · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>
      <div class="discline"><span>You pay</span><strong>${money(spin.final)}</strong></div>
      <div class="spin-done">
        <div class="spin-done-head">
          <div>
            <span class="spin-done-kicker">Spin locked in</span>
            <h3>${spin.percent}% OFF</h3>
          </div>
          <span class="chip-mint">${icon('check')} −${money(spin.discount)}</span>
        </div>
        <p>Discount applied to your order total.</p>
        <button class="btn btn-primary pay-now" type="button" data-pay>
          Pay ${money(spin.final)} ${icon('arrow')}
        </button>
      </div>
      <div class="back-row">
        <button class="btn btn-text" type="button" data-open-wheel>${icon('wheel')} View spin result</button>
      </div>
      <p class="total-foot">One spin per order · discount applied instantly</p>`;
  }

  if (total < SPIN_MIN_TOTAL) {
    return `
      <span class="total-label">Your total</span>
      <strong class="total-amount">${money(total)}</strong>
      <span class="total-sub">${count} drink${count === 1 ? '' : 's'}</span>
      <div class="total-rule"></div>
      <div class="spin-nudge spin-nudge-locked">
        <div class="spin-nudge-top">
          <span class="nudge-wheel is-locked" style="background:${conicGradient(SEGMENTS)}" aria-hidden="true"></span>
          <div>
            <h3>Spin &amp; Win unlocks at ${money(SPIN_MIN_TOTAL)}</h3>
            <p>Add ${money(SPIN_MIN_TOTAL - total)} more to spin the wheel.</p>
          </div>
        </div>
        <button class="btn spin-btn-main" type="button" data-pay>
          Continue to payment · ${money(total)} ${icon('arrow')}
        </button>
      </div>
      <p class="total-foot">No spin for orders under ${money(SPIN_MIN_TOTAL)}</p>`;
  }

  return `
    <span class="total-label">Your total</span>
    <strong class="total-amount">${money(total)}</strong>
    <span class="total-sub">${count} drink${count === 1 ? '' : 's'}</span>
    <div class="total-rule"></div>
    <div class="spin-nudge">
      <div class="spin-nudge-top">
        <span class="nudge-wheel" style="background:${conicGradient(SEGMENTS)}" aria-hidden="true"></span>
        <div>
          <h3>Feeling lucky?</h3>
          <p>Win up to ${maxWheelPercent()}% off your total.</p>
        </div>
      </div>
      <button class="btn spin-btn-main" type="button" data-open-wheel>
        ${icon('wheel')} SPIN &amp; WIN
      </button>
      <button class="skip-spin" type="button" data-pay>Pay ${money(total)} without spinning →</button>
    </div>
    <p class="total-foot">One spin per order · discount applied instantly</p>`;
}

function renderSummary() {
  const items = lines();
  if (!items.length) {
    showScreen('menu');
    return;
  }
  if (state.spin && cartTotal() < SPIN_MIN_TOTAL) clearSpin();
  summaryLines.innerHTML = items.map(lineTemplate).join('');
  totalCard.innerHTML = totalCardTemplate();
  renderSummaryUpsell();
  updateSpinGate();
}

/* ==================================================================
   PAYMENT
   ================================================================== */

const UPI_AMOUNT = (paise) => (paise / 100).toFixed(2);

function upiLink(amount) {
  const params = new URLSearchParams({
    pa: SETTINGS.upi.id,
    pn: SETTINGS.upi.name,
    am: UPI_AMOUNT(amount),
    cu: 'INR',
    tn: 'The Milkshake Factory order',
  });
  return `upi://pay?${params.toString()}`;
}

function renderQr(amount) {
  qrCode.innerHTML = '';
  const caption = $('#qr-caption');

  if (SETTINGS.qr.mode === 'uploaded' && SETTINGS.qr.image) {
    qrCode.innerHTML = `<img src="${escapeHtml(SETTINGS.qr.image)}" alt="Stall UPI QR code">`;
    if (caption) caption.textContent = `Scan the stall QR · enter ${money(amount)} manually`;
    return;
  }

  if (typeof window.qrcode !== 'function') {
    qrCode.innerHTML = `<p style="padding:20px;text-align:center;font-size:.85rem;color:#7b6266">QR library missing. Pay to <strong>${escapeHtml(
      SETTINGS.upi.id,
    )}</strong></p>`;
    if (caption) caption.textContent = 'Scan with any UPI app';
    return;
  }
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(upiLink(amount));
    qr.make();
    qrCode.innerHTML = qr.createSvgTag({
      cellSize: 8,
      margin: 8,
      scalable: true,
      alt: 'UPI QR code',
    });
    if (caption) caption.textContent = 'Scan with any UPI app · exact amount included';
  } catch (error) {
    qrCode.innerHTML = `<p style="padding:20px;text-align:center;font-size:.85rem;color:#7b6266">Could not generate the QR. Pay to <strong>${escapeHtml(
      SETTINGS.upi.id,
    )}</strong></p>`;
    if (caption) caption.textContent = 'Scan with any UPI app';
  }
}

function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  if (!newOrderBtn) return;
  newOrderBtn.classList.remove('is-armed');
  newOrderBtn.innerHTML = `${icon('refresh')} New order`;
}

function newOrderToken() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function submitOrder(items, total, spin) {
  const signature = JSON.stringify({
    items: items.map((item) => [item.id, item.qty, item.price]),
    total,
    discount: spin ? spin.discount : 0,
    percent: spin ? spin.percent : 0,
  });
  if (signature === state.orderSignature) return;

  if (!state.orderToken) state.orderToken = newOrderToken();
  state.orderSignature = signature;

  const payload = {
    token: state.orderToken,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
    })),
    total,
    discount: spin ? spin.discount : 0,
    percent: spin ? spin.percent : 0,
  };

  fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    state.orderSignature = '';
  });
}

function renderPay() {
  const items = lines();
  if (!items.length) {
    showScreen('menu');
    return;
  }

  const total = cartTotal();
  const spin = state.spin && state.spin.total === total && total >= SPIN_MIN_TOTAL ? state.spin : null;
  const final = spin ? spin.final : total;

  submitOrder(items, total, spin);

  $('#pay-amount').textContent = money(final);
  $('#pay-note').textContent = spin
    ? `${spin.percent}% off your total`
    : 'No spin discount';
  $('#pay-upi').textContent = SETTINGS.upi.id;
  $('#qr-amount').textContent = money(final);
  const paySub = $('#pay-sub');
  if (paySub) {
    paySub.textContent =
      SETTINGS.qr.mode === 'uploaded' && SETTINGS.qr.image
        ? `Scan the stall QR, then enter ${money(final)} in your UPI app.`
        : 'Point your phone camera at the QR and pay the exact amount.';
  }

  let breakdown = '';
  if (spin) {
    breakdown += `<div class="discline"><span>Order total</span><strong>${money(total)}</strong></div>`;
    breakdown += `<div class="discline is-discount"><span>Spin &amp; Win · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>`;
    breakdown += `<div class="discline"><span>Amount to pay</span><strong>${money(final)}</strong></div>`;
  } else {
    breakdown += `<div class="discline"><span>Total to pay</span><strong>${money(final)}</strong></div>`;
  }
  $('#pay-breakdown').innerHTML = breakdown;

  renderQr(final);
  disarmReset();
}

/* ==================================================================
   WHEEL
   ================================================================== */

function resetWheelUI() {
  if (!wheelIntro || !wheelResult || !spinBtn) return;
  wheelIntro.hidden = false;
  wheelResult.hidden = true;
  wheelResult.innerHTML = '';
  wheelResult.classList.remove('is-big');
  spinBtn.disabled = false;
  spinBtn.classList.remove('is-spinning', 'is-locked');
  spinBtn.querySelector('span').textContent = 'SPIN';
  spinBtn.querySelector('small').textContent = 'tap to win';
  overlay.classList.remove('is-spinning', 'has-result', 'is-big-win');
}

function ensureWheel() {
  if (!wheel) {
    wheel = new PrizeWheel($('#wheel-stage'), SEGMENTS, { muted });
    wheel.sound = uiSound;
    uiSound.setMuted(muted);
  }
  return wheel;
}

function updateWheelTotals() {
  const total = cartTotal();
  const totalEl = $('#wheel-total');
  if (totalEl) totalEl.textContent = money(total);
}

function openWheel() {
  if (!countItems()) return;
  if (!spinUnlocked()) {
    showToast(`Add ${money(spinShortfall())} more to unlock Spin & Win`);
    return;
  }
  ensureWheel();
  updateWheelTotals();
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  requestAnimationFrame(() => {
    wheel.redraw();
    if (state.spin) {
      const index = SEGMENTS.findIndex((segment) => segment.id === state.spin.id);
      if (index >= 0) wheel.snapToIndex(index);
      showResult(state.spin, { restore: true });
    } else {
      resetWheelUI();
    }
  });
}

function closeWheel() {
  if (spinning) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

function pickRiggedResult() {
  if (!RIGGED_SEQUENCE.length || !SEGMENTS.length) return { percent: 0, index: 0, id: '' };
  const offerId = RIGGED_SEQUENCE[state.sequenceIndex % RIGGED_SEQUENCE.length];
  state.sequenceIndex += 1;
  let index = SEGMENTS.findIndex((segment) => segment.id === offerId);
  if (index < 0) index = 0;
  return { percent: SEGMENTS[index].percent, index, id: SEGMENTS[index].id };
}

function showResult(spin, { restore = false } = {}) {
  const big = spin.percent >= 20;
  const kicker = restore
    ? 'Your spin result'
    : spin.percent >= 25
      ? 'JACKPOT!'
      : spin.percent >= 20
        ? 'HUGE WIN!'
        : 'You won';

  wheelIntro.hidden = true;
  wheelResult.hidden = false;
  wheelResult.classList.toggle('is-big', big);
  wheelResult.innerHTML = `
    <div class="result-badge">${icon('sparkle')}</div>
    <span class="result-kicker">${kicker}</span>
    <h3>${spin.percent}% OFF</h3>
    <p class="result-copy">That's ${money(spin.discount)} off your total.</p>
    <div class="result-lines">
      <div class="discline"><span>Order total</span><strong>${money(spin.total)}</strong></div>
      <div class="discline is-discount"><span>Discount · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>
      <div class="discline is-final"><span>You pay</span><strong>${money(spin.final)}</strong></div>
    </div>
    <button class="btn btn-primary result-pay" type="button" data-result-pay>
      Pay ${money(spin.final)} ${icon('arrow')}
    </button>
    <button class="result-back" type="button" data-result-back>Back to order</button>`;

  overlay.classList.add('has-result');
  overlay.classList.toggle('is-big-win', big);
  spinBtn.disabled = true;
  spinBtn.classList.remove('is-spinning');
  spinBtn.classList.add('is-locked');
  spinBtn.querySelector('span').textContent = 'SPUN';
  spinBtn.querySelector('small').textContent = 'locked in';
}

async function doSpin() {
  if (spinning || state.spin) return;
  if (!countItems() || !spinUnlocked()) return;

  const total = cartTotal();
  const rigged = pickRiggedResult();

  spinning = true;
  overlay.classList.add('is-spinning');
  spinBtn.disabled = true;
  spinBtn.classList.add('is-spinning');
  spinBtn.querySelector('small').textContent = 'good luck';
  closeBtnDisable(true);

  wheel.sound.ensure();
  wheel.sound.spinStart();
  if (navigator.vibrate) navigator.vibrate([24, 40, 24]);

  try {
    await wheel.spinToIndex(rigged.index);
    const { discount, final } = discountFor(total, rigged.percent);
    state.spin = {
      percent: rigged.percent,
      index: rigged.index,
      id: rigged.id,
      total,
      discount,
      final,
      at: Date.now(),
    };

    const level = rigged.percent >= 25 ? 3 : rigged.percent >= 20 ? 2 : rigged.percent >= 15 ? 1.5 : 1;

    spinning = false;
    overlay.classList.remove('is-spinning');
    flash.classList.remove('is-on', 'is-strong');
    void flash.offsetWidth;
    flash.classList.add('is-on');
    if (level >= 2) flash.classList.add('is-strong');
    blast({ intensity: level });
    celebrate({ count: 150 + Math.round(rigged.percent * 8), spread: 1.1 });
    wheel.sound.win(level);
    if (navigator.vibrate) {
      navigator.vibrate(level >= 2 ? [90, 45, 180, 45, 260] : [60, 40, 120]);
    }

    showResult(state.spin);
  } catch (error) {
    spinning = false;
    overlay.classList.remove('is-spinning');
    spinBtn.disabled = false;
    spinBtn.classList.remove('is-spinning');
    spinBtn.querySelector('small').textContent = 'try again';
    closeBtnDisable(false);
    resetWheelUI();
  } finally {
    closeBtnDisable(false);
    if (state.screen === 'summary') renderSummary();
  }
}

function closeBtnDisable(disabled) {
  const close = $('#close-wheel');
  if (close) close.disabled = disabled;
}

/* ==================================================================
   FEEDBACK
   ================================================================== */

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-on'), 2600);
}

/* ==================================================================
   NAVIGATION
   ================================================================== */

function updateSteps(name) {
  const order = ['menu', 'summary', 'pay'];
  const activeIndex = order.indexOf(name);
  $$('.step').forEach((step) => {
    const index = order.indexOf(step.dataset.step);
    step.classList.toggle('is-active', index === activeIndex);
    step.classList.toggle('is-done', index < activeIndex);
  });
}

function showScreen(name) {
  const previous = state.screen;
  state.screen = name;
  $$('.screen').forEach((screen) => {
    screen.classList.toggle('is-active', screen.id === `screen-${name}`);
  });
  orderBar.hidden = name !== 'menu';
  updateSteps(name);

  if (name === 'menu') {
    renderAllCards();
    renderBar();
    document.body.classList.remove('no-scroll');
  }
  if (name === 'summary') renderSummary();
  if (name === 'pay') renderPay();

  if (previous !== name) {
    if (name === 'pay') playSuccess();
    else playWhoosh();
  }

  window.scrollTo(0, 0);
}

function resetOrder() {
  clearSpin();
  state.cart.clear();
  state.orderToken = '';
  state.orderSignature = '';
  resetWheelUI();
  if (wheel) wheel.reset();
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  disarmReset();
  renderAllCards();
  renderBar();
  showScreen('menu');
}

/* ==================================================================
   EVENTS
   ================================================================== */

menuGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.drink-card');
  if (!card) return;
  const id = card.dataset.id;

  const step = event.target.closest('[data-step]');
  if (step) {
    changeQty(id, Number(step.dataset.step));
    return;
  }
  if (event.target.closest('[data-add]')) {
    addItem(id);
    return;
  }
  if (event.target.closest('button')) return;
  addItem(id);
});

reviewBtn.addEventListener('click', () => {
  if (!countItems()) return;
  showScreen('summary');
});

clearBtn.addEventListener('click', () => {
  clearCart();
});

$('#back-to-menu').addEventListener('click', () => showScreen('menu'));

summaryLines.addEventListener('click', (event) => {
  const step = event.target.closest('[data-line-step]');
  if (step) {
    changeQty(step.dataset.id, Number(step.dataset.lineStep));
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    state.cart.delete(remove.dataset.remove);
    clearSpin();
    updateCard(remove.dataset.remove);
    renderBar();
    if (countItems()) renderSummary();
    else showScreen('menu');
  }
});

upsellRow.addEventListener('click', (event) => {
  const step = event.target.closest('[data-line-step]');
  if (step) {
    changeQty(step.dataset.id, Number(step.dataset.lineStep));
    return;
  }
  const add = event.target.closest('[data-add]');
  if (add) {
    addItem(add.dataset.add);
    return;
  }
  const card = event.target.closest('.upsell-card');
  if (card && !event.target.closest('button')) addItem(card.dataset.id);
});

totalCard.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-wheel]')) {
    openWheel();
    return;
  }
  if (event.target.closest('[data-pay]')) {
    showScreen('pay');
    return;
  }
  if (event.target.closest('[data-back-menu]')) showScreen('menu');
});

$('#pay-back').addEventListener('click', () => {
  showScreen('summary');
});

newOrderBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    newOrderBtn.classList.add('is-armed');
    newOrderBtn.innerHTML = `${icon('check')} Tap again to clear`;
    resetTimer = setTimeout(disarmReset, 3500);
    return;
  }
  resetOrder();
});

$('#close-wheel').addEventListener('click', closeWheel);

$('#wheel-stage').addEventListener('click', (event) => {
  if (event.target.closest('#spin-btn')) {
    doSpin();
  }
});

wheelResult.addEventListener('click', (event) => {
  if (event.target.closest('[data-result-pay]')) {
    closeWheel();
    showScreen('pay');
    return;
  }
  if (event.target.closest('[data-result-back]')) {
    closeWheel();
    showScreen('summary');
  }
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('msf-tablet-muted', muted ? '1' : '0');
  uiSound.setMuted(muted);
  if (wheel) wheel.setMuted(muted);
  updateMuteButton();
  if (!muted) playClick();
});

document.addEventListener(
  'pointerdown',
  (event) => {
    if (!event.target.closest('button, .drink-card')) return;
    playClick();
  },
  { capture: true },
);

function updateMuteButton() {
  muteBtn.innerHTML = muted ? icon('mute') : icon('sound');
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (overlay.classList.contains('is-open')) closeWheel();
});

$('#fullscreen-btn').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    /* fullscreen may be blocked */
  }
});

document.addEventListener('fullscreenchange', () => {
  const button = $('#fullscreen-btn');
  const expanded = Boolean(document.fullscreenElement);
  button.innerHTML = expanded ? icon('shrink') : icon('expand');
  button.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

document.querySelectorAll('[data-home]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

/* ==================================================================
   BOOT
   ================================================================== */

async function boot() {
  SETTINGS = normalizeSettings(readSettingsCache());
  settingsSignature = JSON.stringify(SETTINGS);
  await syncSettings({ initial: true });

  applySettings();
  $('#brand-mark').innerHTML = logoMark();
  updateMuteButton();

  renderMenu();
  showScreen('menu');
  resetWheelUI();

  setInterval(() => syncSettings(), 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncSettings();
  });
}

boot();
