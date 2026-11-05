import { drinkArt, logoMark } from './art.js';
import { PrizeWheel, WheelSound, blast, celebrate } from './wheel.js';

/* ==================================================================
   DEFAULT CONFIG — staff can change the live values from the gear menu
   ================================================================== */

const DEFAULT_MENU = [
  {
    id: 'oreo',
    name: 'Oreo Milkshake',
    flavour: 'Oreo',
    category: 'Milkshake',
    price: 7000,
    spinPrice: 8000,
    tint: 'pink',
    art: 'shake-oreo',
    desc: 'Cookies and cream, blended thick.',
  },
  {
    id: 'kitkat',
    name: 'KitKat Milkshake',
    flavour: 'KitKat',
    category: 'Milkshake',
    price: 7000,
    spinPrice: 8000,
    tint: 'pink',
    art: 'shake-kitkat',
    desc: 'Chocolate overload with crunch.',
  },
  {
    id: 'dark',
    name: 'Dark Fantasy Milkshake',
    flavour: 'Dark Fantasy',
    category: 'Milkshake',
    price: 7000,
    spinPrice: 8000,
    tint: 'pink',
    art: 'shake-dark',
    desc: 'Dark chocolate, extra decadent.',
  },
  {
    id: 'cuban',
    name: 'Cuban Mint Mojito',
    flavour: 'Cuban Mint',
    category: 'Mojito',
    price: 4000,
    spinPrice: 5000,
    tint: 'mint',
    art: 'mojito-mint',
    desc: 'Mint, lime and crushed ice.',
  },
  {
    id: 'lime',
    name: 'Lime Mojito',
    flavour: 'Lime',
    category: 'Mojito',
    price: 4000,
    spinPrice: 5000,
    tint: 'mint',
    art: 'mojito-lime',
    desc: 'Sharp citrus fizz over ice.',
  },
  {
    id: 'blue',
    name: 'Blue Mojito',
    flavour: 'Blue',
    category: 'Mojito',
    price: 4000,
    spinPrice: 5000,
    tint: 'mint',
    art: 'mojito-blue',
    desc: 'Icy blue fizz, extra refreshing.',
  },
  {
    id: 'coffee',
    name: 'Cold Coffee',
    flavour: 'Classic',
    category: 'Cold Coffee',
    price: 6000,
    spinPrice: 7000,
    tint: 'caramel',
    art: 'coffee',
    desc: 'Bold coffee, shaken ice cold.',
  },
];

// The wheel's visible prizes. Every percentage in RIGGED_SEQUENCE must exist here.
// `weight` controls the physical slice size: low offers get the biggest slices.
const SEGMENTS = [
  { label: '10% OFF', percent: 10, weight: 34, color: '#FF7FB0' },
  { label: '15% OFF', percent: 15, weight: 24, color: '#FFC24B' },
  { label: '10% OFF', percent: 10, weight: 18, color: '#6FE0C2' },
  { label: '20% OFF', percent: 20, weight: 14, color: '#9BD9FF' },
  { label: '25% OFF', percent: 25, weight: 10, color: '#D3A8FF' },
];

/* ==================================================================
   LOCAL SETTINGS — persisted in this tablet's localStorage
   ================================================================== */

const SETTINGS_KEY = 'msf-tablet-settings-v1';
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/;
const ALLOWED_PERCENTS = [...new Set(SEGMENTS.map((segment) => segment.percent))];

const DEFAULT_SETTINGS = {
  upi: { id: 'milkshakefactory@upi', name: 'The Milkshake Factory' },
  qr: { mode: 'dynamic', image: '' },
  menu: {},
  spin: {
    sequence: [10, 10, 15, 10, 20, 10, 25, 10, 15, 10],
    maxDiscount: 6000,
    minPayable: 3000,
  },
  adminPin: '1234',
};

let SETTINGS = loadSettings();
let MENU = [];
let RIGGED_SEQUENCE = [];
let LIMITS = { maxDiscount: 6000, minPayable: 3000 };
let adminImage = '';
let adminUnlocked = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadSettings() {
  const base = clone(DEFAULT_SETTINGS);
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;

    if (typeof raw.upi?.id === 'string' && UPI_PATTERN.test(raw.upi.id.trim())) base.upi.id = raw.upi.id.trim();
    if (typeof raw.upi?.name === 'string' && raw.upi.name.trim()) {
      base.upi.name = raw.upi.name.trim().slice(0, 60);
    }
    if (raw.qr && ['dynamic', 'uploaded'].includes(raw.qr.mode)) base.qr.mode = raw.qr.mode;
    if (typeof raw.qr?.image === 'string' && raw.qr.image.startsWith('data:image/')) base.qr.image = raw.qr.image;

    if (raw.spin && Array.isArray(raw.spin.sequence)) {
      const sequence = raw.spin.sequence.map(Number).filter((percent) => ALLOWED_PERCENTS.includes(percent));
      if (sequence.length) base.spin.sequence = sequence.slice(0, 60);
    }
    if (Number.isFinite(Number(raw.spin?.maxDiscount)) && Number(raw.spin.maxDiscount) >= 0) {
      base.spin.maxDiscount = Math.round(Number(raw.spin.maxDiscount));
    }
    if (Number.isFinite(Number(raw.spin?.minPayable)) && Number(raw.spin.minPayable) >= 0) {
      base.spin.minPayable = Math.round(Number(raw.spin.minPayable));
    }
    if (typeof raw.adminPin === 'string' && /^\d{4,8}$/.test(raw.adminPin)) base.adminPin = raw.adminPin;

    if (raw.menu && typeof raw.menu === 'object') {
      for (const item of DEFAULT_MENU) {
        const override = raw.menu[item.id];
        if (
          override &&
          Number.isInteger(override.price) &&
          override.price > 0 &&
          override.price <= 1_000_000 &&
          Number.isInteger(override.spinPrice) &&
          override.spinPrice >= override.price &&
          override.spinPrice <= 1_000_000
        ) {
          base.menu[item.id] = { price: override.price, spinPrice: override.spinPrice };
        }
      }
    }
    return base;
  } catch {
    return base;
  }
}

function applySettings() {
  MENU = DEFAULT_MENU.map((item) => {
    const override = SETTINGS.menu[item.id];
    return override ? { ...item, price: override.price, spinPrice: override.spinPrice } : { ...item };
  });
  RIGGED_SEQUENCE = SETTINGS.spin.sequence.slice();
  LIMITS = {
    maxDiscount: SETTINGS.spin.maxDiscount,
    minPayable: SETTINGS.spin.minPayable,
  };
  state.sequenceIndex = 0;
}

function persistSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

/* ==================================================================
   STATE & ELEMENTS
   ================================================================== */

const state = {
  cart: new Map(),
  spin: null,
  sequenceIndex: 0,
  screen: 'menu',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const menuGrid = $('#menu-grid');
const orderBar = $('#order-bar');
const barCount = $('#bar-count');
const barTotal = $('#bar-total');
const barSpin = $('#bar-spin');
const reviewBtn = $('#review-btn');
const clearBtn = $('#clear-cart');
const summaryLines = $('#summary-lines');
const totalCard = $('#total-card');
const overlay = $('#wheel-overlay');
const wheelIntro = $('#wheel-intro');
const wheelResult = $('#wheel-result');
const spinBtn = $('#spin-btn');
const muteBtn = $('#mute-btn');
const flash = $('#flash');
const qrCode = $('#qr-code');
const newOrderBtn = $('#new-order');
const adminOverlay = $('#admin-overlay');
const adminLock = $('#admin-lock');
const adminContent = $('#admin-content');
const adminForm = $('#admin-form');
const pinForm = $('#pin-form');
const pinInput = $('#pin-input');
const pinError = $('#pin-error');
const adminError = $('#admin-error');
const adminQrPreview = $('#admin-qr-preview');
const adminMenuRows = $('#admin-menu-rows');
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

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
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

function playError() {
  uiSound.blip(190, 0.16, 'sawtooth', 0.16);
  uiSound.blip(140, 0.2, 'sawtooth', 0.14, 0.12);
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

function spinCartTotal() {
  let total = 0;
  for (const [id, qty] of state.cart) {
    const item = MENU.find((entry) => entry.id === id);
    if (item) total += item.spinPrice * qty;
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
      spinLine: item.spinPrice * qty,
    };
  });
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
          <div class="card-price-stack">
            <span class="card-price">${money(item.price)}</span>
            <span class="card-spin-price">Spin ${money(item.spinPrice)}</span>
          </div>
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
        <span class="eyebrow">Every order gets one spin</span>
        <h3>SPIN &amp; WIN</h3>
        <p>Win up to 25% off the Spin &amp; Win total. One spin, instantly applied.</p>
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
  const spinTotal = spinCartTotal();
  barCount.textContent = count
    ? `${count} drink${count === 1 ? '' : 's'} in this order`
    : 'Tap a drink to start';
  barTotal.textContent = money(total);
  if (barSpin) barSpin.textContent = count ? `Spin ${money(spinTotal)}` : '';
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
        <small>${money(item.price)} each · spin ${money(item.spinPrice)}</small>
      </div>
    </article>`;
}

function totalCardTemplate() {
  const normal = cartTotal();
  const spinBase = spinCartTotal();
  const count = countItems();
  const spin = state.spin;

  if (spin) {
    return `
      <span class="total-label">Amount to pay</span>
      <strong class="total-amount">${money(spin.final)}</strong>
      <span class="total-sub">${spin.percent}% off the Spin &amp; Win total</span>
      <div class="total-rule"></div>
      <div class="discline"><span>Normal total</span><strong>${money(spin.normalTotal)}</strong></div>
      <div class="discline"><span>Spin &amp; Win starting total</span><strong>${money(spin.total)}</strong></div>
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
        <p>Discount applied to the Spin &amp; Win total. The normal price would have been ${money(spin.normalTotal)}.</p>
        <button class="btn btn-primary pay-now" type="button" data-pay>
          Pay ${money(spin.final)} ${icon('arrow')}
        </button>
      </div>
      <div class="back-row">
        <button class="btn btn-text" type="button" data-open-wheel>${icon('wheel')} View spin result</button>
      </div>
      <p class="total-foot">One spin per order · discount applied instantly</p>`;
  }

  return `
    <span class="total-label">Your total</span>
    <strong class="total-amount">${money(normal)}</strong>
    <span class="total-sub">${count} drink${count === 1 ? '' : 's'} · normal price</span>
    <div class="total-rule"></div>
    <div class="spin-base-row">
      <span>Spin &amp; Win starting total</span>
      <strong>${money(spinBase)}</strong>
    </div>
    <p class="spin-base-note">
      That's ${money(spinBase - normal)} more for the spin — the discount applies to ${money(spinBase)}.
    </p>
    <div class="spin-nudge">
      <div class="spin-nudge-top">
        <span class="nudge-wheel" style="background:${conicGradient(SEGMENTS)}" aria-hidden="true"></span>
        <div>
          <h3>Feeling lucky?</h3>
          <p>Win up to 25% off the Spin &amp; Win total.</p>
        </div>
      </div>
      <button class="btn spin-btn-main" type="button" data-open-wheel>
        ${icon('wheel')} SPIN &amp; WIN
      </button>
      <button class="skip-spin" type="button" data-pay>Pay normal ${money(normal)} without spinning →</button>
    </div>
    <p class="total-foot">One spin per order · discount applied instantly</p>`;
}

function renderSummary() {
  const items = lines();
  if (!items.length) {
    showScreen('menu');
    return;
  }
  summaryLines.innerHTML = items.map(lineTemplate).join('');
  totalCard.innerHTML = totalCardTemplate();
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

function renderPay() {
  const items = lines();
  if (!items.length) {
    showScreen('menu');
    return;
  }

  const normal = cartTotal();
  const spinBase = spinCartTotal();
  const spin = state.spin && state.spin.total === spinBase ? state.spin : null;
  const final = spin ? spin.final : normal;

  $('#pay-amount').textContent = money(final);
  $('#pay-note').textContent = spin
    ? `${spin.percent}% off the Spin & Win total`
    : 'Normal price · no spin';
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
    breakdown += `<div class="discline"><span>Normal total</span><strong>${money(normal)}</strong></div>`;
    breakdown += `<div class="discline"><span>Spin &amp; Win starting total</span><strong>${money(spinBase)}</strong></div>`;
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
  const normal = cartTotal();
  const spinBase = spinCartTotal();
  const normalEl = $('#wheel-normal');
  const spinEl = $('#wheel-spin');
  if (normalEl) normalEl.textContent = money(normal);
  if (spinEl) spinEl.textContent = money(spinBase);
}

function openWheel() {
  if (!countItems()) return;
  ensureWheel();
  updateWheelTotals();
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  requestAnimationFrame(() => {
    wheel.redraw();
    if (state.spin) {
      wheel.snapToIndex(state.spin.index);
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
  const percent = RIGGED_SEQUENCE[state.sequenceIndex % RIGGED_SEQUENCE.length];
  state.sequenceIndex += 1;
  const candidates = SEGMENTS.map((segment, index) => (segment.percent === percent ? index : -1)).filter(
    (index) => index >= 0,
  );
  const pool = candidates.length ? candidates : [0];
  return { percent, index: pool[Math.floor(Math.random() * pool.length)] };
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
    <p class="result-copy">That's ${money(spin.discount)} off the Spin &amp; Win total.</p>
    <div class="result-lines">
      <div class="discline"><span>Normal total</span><strong>${money(spin.normalTotal)}</strong></div>
      <div class="discline"><span>Spin &amp; Win total</span><strong>${money(spin.total)}</strong></div>
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
  if (!countItems()) return;

  const normalTotal = cartTotal();
  const spinBase = spinCartTotal();
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
    const { discount, final } = discountFor(spinBase, rigged.percent);
    state.spin = {
      percent: rigged.percent,
      index: rigged.index,
      total: spinBase,
      normalTotal,
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
   LOCAL ADMIN
   ================================================================== */

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-on'), 2600);
}

function openAdmin() {
  adminImage = SETTINGS.qr.image || '';
  adminOverlay.classList.add('is-open');
  adminOverlay.setAttribute('aria-hidden', 'false');
  if (adminUnlocked) showAdminForm();
  else showAdminLock();
}

function closeAdmin() {
  adminUnlocked = false;
  adminOverlay.classList.remove('is-open');
  adminOverlay.setAttribute('aria-hidden', 'true');
  adminError.textContent = '';
}

function showAdminLock() {
  adminLock.hidden = false;
  adminContent.hidden = true;
  pinError.textContent = '';
  pinInput.value = '';
  setTimeout(() => pinInput.focus(), 90);
}

function showAdminForm() {
  adminLock.hidden = true;
  adminContent.hidden = false;
  populateAdminForm();
}

function populateAdminForm() {
  adminError.textContent = '';
  $('#admin-upi-id').value = SETTINGS.upi.id;
  $('#admin-upi-name').value = SETTINGS.upi.name;
  $('#admin-qr-mode').value = SETTINGS.qr.mode;
  $('#admin-sequence').value = SETTINGS.spin.sequence.join(', ');
  $('#admin-max').value = SETTINGS.spin.maxDiscount / 100;
  $('#admin-min').value = SETTINGS.spin.minPayable / 100;
  $('#admin-new-pin').value = '';
  adminImage = SETTINGS.qr.image || '';
  renderAdminMenuRows();
  renderAdminQrPreview();
}

function renderAdminMenuRows() {
  adminMenuRows.innerHTML = MENU.map(
    (item) => `
    <div class="admin-menu-row" data-menu-id="${item.id}">
      <span class="admin-drink">${escapeHtml(item.name)}<small>${escapeHtml(item.flavour)}</small></span>
      <input
        class="admin-input"
        type="number"
        min="1"
        step="1"
        data-price="normal"
        value="${item.price / 100}"
        aria-label="${escapeHtml(item.name)} normal price"
      />
      <input
        class="admin-input"
        type="number"
        min="1"
        step="1"
        data-price="spin"
        value="${item.spinPrice / 100}"
        aria-label="${escapeHtml(item.name)} spin price"
      />
    </div>`,
  ).join('');
}

function renderAdminQrPreview() {
  adminQrPreview.innerHTML = adminImage
    ? `<img src="${escapeHtml(adminImage)}" alt="UPI QR preview">`
    : '<span>No QR photo</span>';
}

async function resizeImage(file, max = 640) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Could not decode the image'));
    element.src = dataUrl;
  });

  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function handleQrUpload(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    adminError.textContent = 'That image is too large. Use one under 12 MB.';
    return;
  }
  try {
    adminImage = await resizeImage(file);
    $('#admin-qr-mode').value = 'uploaded';
    renderAdminQrPreview();
    adminError.textContent = '';
  } catch (error) {
    console.error('QR upload failed', error);
    adminError.textContent = 'Could not read that image. Try a PNG or JPG.';
  }
}

function submitPin(event) {
  event.preventDefault();
  if (pinInput.value === SETTINGS.adminPin) {
    adminUnlocked = true;
    pinError.textContent = '';
    playSuccess();
    showAdminForm();
  } else {
    pinError.textContent = 'Wrong PIN. Try again.';
    pinInput.value = '';
    pinInput.focus();
    playError();
  }
}

function saveAdminSettings(event) {
  event.preventDefault();
  adminError.textContent = '';

  const upiId = $('#admin-upi-id').value.trim();
  const upiName = $('#admin-upi-name').value.trim();
  const qrMode = $('#admin-qr-mode').value;
  const sequence = $('#admin-sequence')
    .value.split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  const maxDiscount = Math.round(Number($('#admin-max').value) * 100);
  const minPayable = Math.round(Number($('#admin-min').value) * 100);
  const newPin = $('#admin-new-pin').value.trim();

  if (!UPI_PATTERN.test(upiId)) {
    adminError.textContent = 'Enter a valid UPI ID, for example stall@bank.';
    return;
  }
  if (upiName.length < 2 || upiName.length > 60) {
    adminError.textContent = 'UPI display name must be 2–60 characters.';
    return;
  }
  if (qrMode === 'uploaded' && !adminImage) {
    adminError.textContent = 'Upload a QR photo, or choose the generated QR.';
    return;
  }
  if (!sequence.length || sequence.length > 60 || sequence.some((value) => !ALLOWED_PERCENTS.includes(value))) {
    adminError.textContent = `Prize sequence must use only ${ALLOWED_PERCENTS.join(', ')}.`;
    return;
  }
  if (!Number.isFinite(maxDiscount) || maxDiscount < 0 || maxDiscount > 1_000_000) {
    adminError.textContent = 'Enter a valid maximum discount.';
    return;
  }
  if (!Number.isFinite(minPayable) || minPayable < 0 || minPayable > 1_000_000) {
    adminError.textContent = 'Enter a valid minimum payable amount.';
    return;
  }
  if (newPin && !/^\d{4,8}$/.test(newPin)) {
    adminError.textContent = 'The admin PIN must be 4–8 digits.';
    return;
  }

  const menu = {};
  for (const row of adminMenuRows.querySelectorAll('.admin-menu-row')) {
    const id = row.dataset.menuId;
    const item = DEFAULT_MENU.find((entry) => entry.id === id);
    if (!item) continue;
    const normal = Math.round(Number(row.querySelector('[data-price="normal"]').value) * 100);
    const spin = Math.round(Number(row.querySelector('[data-price="spin"]').value) * 100);

    if (!Number.isFinite(normal) || normal <= 0 || normal > 1_000_000) {
      adminError.textContent = `${item.name}: enter a valid normal price.`;
      return;
    }
    if (!Number.isFinite(spin) || spin < normal || spin > 1_000_000) {
      adminError.textContent = `${item.name}: the spin price must be at least the normal price.`;
      return;
    }
    menu[id] = { price: normal, spinPrice: spin };
  }

  const next = {
    upi: { id: upiId, name: upiName },
    qr: { mode: qrMode, image: adminImage },
    menu,
    spin: { sequence, maxDiscount, minPayable },
    adminPin: newPin || SETTINGS.adminPin,
  };

  try {
    persistSettings(next);
  } catch {
    adminError.textContent = 'Could not save. The QR photo may be too large for this browser.';
    return;
  }

  SETTINGS = next;
  applySettings();
  renderMenu();
  resetOrder();
  closeAdmin();
  showToast('Settings saved');
  playSuccess();
}

function resetAdminSettings() {
  if (!window.confirm('Reset all local settings to defaults? This also clears the current order.')) return;
  SETTINGS = clone(DEFAULT_SETTINGS);
  try {
    persistSettings(SETTINGS);
  } catch {
    adminError.textContent = 'Could not reset the saved settings.';
    return;
  }
  applySettings();
  renderMenu();
  resetOrder();
  closeAdmin();
  showToast('Defaults restored');
  playSuccess();
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

$('#admin-btn').addEventListener('click', openAdmin);
document.querySelectorAll('[data-admin-close]').forEach((element) => {
  element.addEventListener('click', closeAdmin);
});
pinForm.addEventListener('submit', submitPin);
adminForm.addEventListener('submit', saveAdminSettings);

$('#admin-qr-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await handleQrUpload(file);
  event.target.value = '';
});

$('#admin-qr-remove').addEventListener('click', () => {
  adminImage = '';
  $('#admin-qr-mode').value = 'dynamic';
  renderAdminQrPreview();
  adminError.textContent = '';
});

$('#admin-reset').addEventListener('click', resetAdminSettings);

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
    if (!event.target.closest('button, .drink-card, .file-btn, [data-admin-close]')) return;
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
  if (adminOverlay.classList.contains('is-open')) {
    closeAdmin();
    return;
  }
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

function boot() {
  applySettings();
  $('#brand-mark').innerHTML = logoMark();
  updateMuteButton();

  $('#prize-preview').innerHTML = SEGMENTS.map(
    (segment) =>
      `<li><span class="prize-dot" style="background:${segment.color}"></span>${segment.label}</li>`,
  ).join('');

  renderMenu();
  showScreen('menu');
  resetWheelUI();
}

boot();
