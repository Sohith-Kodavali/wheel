import { drinkArt, logoMark } from './art.js';
import { PrizeWheel, celebrate } from './wheel.js';

/* ==================================================================
   CONFIG — edit these three blocks only
   ================================================================== */

const UPI = {
  id: 'milkshakefactory@upi',
  name: 'The Milkshake Factory',
};

// The wheel is intentionally rigged. Every spin wins.
// These are the percentages in the order they will be awarded. Edit freely.
const RIGGED_SEQUENCE = [10, 10, 15, 10, 20, 10, 25, 10, 15, 10];

// Discount safety limits, in paise. 6000 = ₹60.
const LIMITS = {
  maxDiscount: 6000,
  minPayable: 3000,
};

const MENU = [
  {
    id: 'oreo',
    name: 'Oreo Milkshake',
    flavour: 'Oreo',
    category: 'Milkshake',
    price: 7000,
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
    tint: 'caramel',
    art: 'coffee',
    desc: 'Bold coffee, shaken ice cold.',
  },
];

// The wheel's visible prizes. Every percentage in RIGGED_SEQUENCE must exist here.
const SEGMENTS = [
  { label: '10% OFF', percent: 10, color: '#FF7FB0' },
  { label: '15% OFF', percent: 15, color: '#FFC24B' },
  { label: '20% OFF', percent: 20, color: '#9BD9FF' },
  { label: '10% OFF', percent: 10, color: '#6FE0C2' },
  { label: '25% OFF', percent: 25, color: '#D3A8FF' },
];

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

let wheel = null;
let spinning = false;
let muted = localStorage.getItem('msf-tablet-muted') === '1';
let resetArmed = false;
let resetTimer = 0;

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
  return MENU.filter((item) => state.cart.has(item.id)).map((item) => ({
    ...item,
    qty: state.cart.get(item.id),
    lineTotal: item.price * state.cart.get(item.id),
  }));
}

function conicGradient(segments) {
  const step = 100 / segments.length;
  return `conic-gradient(${segments
    .map((segment, index) => `${segment.color} ${index * step}% ${(index + 1) * step}%`)
    .join(', ')})`;
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
        <span class="eyebrow">Every order gets one spin</span>
        <h3>SPIN &amp; WIN</h3>
        <p>Win up to 25% off your total. One spin, instantly applied.</p>
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

function totalCardTemplate() {
  const total = cartTotal();
  const count = countItems();
  const spin = state.spin;

  if (spin) {
    return `
      <span class="total-label">Amount to pay</span>
      <strong class="total-amount">${money(spin.final)}</strong>
      <span class="total-sub">${spin.percent}% Spin &amp; Win discount applied</span>
      <div class="total-rule"></div>
      <div class="discline"><span>Your total</span><strong>${money(spin.total)}</strong></div>
      <div class="discline is-discount"><span>Spin &amp; Win · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>
      <div class="discline"><span>You pay</span><strong>${money(spin.final)}</strong></div>
      <div class="spin-done">
        <div class="spin-done-head">
          <div>
            <span class="spin-done-kicker">Spin locked in</span>
            <h3>${spin.percent}% OFF</h3>
          </div>
          <span class="chip-mint">${icon('check')} Saved ${money(spin.discount)}</span>
        </div>
        <p>One spin per order. This discount is already applied.</p>
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
    <strong class="total-amount">${money(total)}</strong>
    <span class="total-sub">${count} drink${count === 1 ? '' : 's'} · freshly made</span>
    <div class="total-rule"></div>
    <div class="spin-nudge">
      <div class="spin-nudge-top">
        <span class="nudge-wheel" style="background:${conicGradient(SEGMENTS)}" aria-hidden="true"></span>
        <div>
          <h3>Feeling lucky?</h3>
          <p>Spin once to win up to 25% off this order.</p>
        </div>
      </div>
      <button class="btn spin-btn-main" type="button" data-open-wheel>
        ${icon('wheel')} SPIN &amp; WIN
      </button>
      <button class="skip-spin" type="button" data-pay>Pay without spinning →</button>
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
    pa: UPI.id,
    pn: UPI.name,
    am: UPI_AMOUNT(amount),
    cu: 'INR',
    tn: 'The Milkshake Factory order',
  });
  return `upi://pay?${params.toString()}`;
}

function renderQr(amount) {
  qrCode.innerHTML = '';
  if (typeof window.qrcode !== 'function') {
    qrCode.innerHTML = `<p style="padding:20px;text-align:center;font-size:.85rem;color:#7b6266">QR library missing. Pay to <strong>${UPI.id}</strong></p>`;
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
  } catch (error) {
    qrCode.innerHTML = `<p style="padding:20px;text-align:center;font-size:.85rem;color:#7b6266">Could not generate the QR. Pay to <strong>${UPI.id}</strong></p>`;
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

  const total = cartTotal();
  const spin = state.spin && state.spin.total === total ? state.spin : null;
  const final = spin ? spin.final : total;

  $('#pay-amount').textContent = money(final);
  $('#pay-note').textContent = spin
    ? `${spin.percent}% Spin & Win discount applied`
    : 'No spin discount · regular total';
  $('#pay-upi').textContent = UPI.id;
  $('#qr-amount').textContent = money(final);

  let breakdown = `<div class="discline"><span>Subtotal</span><strong>${money(total)}</strong></div>`;
  if (spin) {
    breakdown += `<div class="discline is-discount"><span>Spin &amp; Win · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>`;
  }
  breakdown += `<div class="discline"><span>Amount to pay</span><strong>${money(final)}</strong></div>`;
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
  spinBtn.disabled = false;
  spinBtn.classList.remove('is-spinning', 'is-locked');
  spinBtn.querySelector('span').textContent = 'SPIN';
  spinBtn.querySelector('small').textContent = 'tap to win';
  overlay.classList.remove('is-spinning', 'has-result');
}

function ensureWheel() {
  if (!wheel) {
    wheel = new PrizeWheel($('#wheel-stage'), SEGMENTS, { muted });
    wheel.setMuted(muted);
  }
  return wheel;
}

function openWheel() {
  if (!countItems()) return;
  ensureWheel();
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
  wheelIntro.hidden = true;
  wheelResult.hidden = false;
  wheelResult.innerHTML = `
    <div class="result-badge">${icon('sparkle')}</div>
    <span class="result-kicker">${restore ? 'Your spin result' : 'You won'}</span>
    <h3>${spin.percent}% OFF</h3>
    <p class="result-copy">That's ${money(spin.discount)} off your order.</p>
    <div class="result-lines">
      <div class="discline"><span>Your total</span><strong>${money(spin.total)}</strong></div>
      <div class="discline is-discount"><span>Discount · ${spin.percent}% OFF</span><strong>− ${money(spin.discount)}</strong></div>
      <div class="discline is-final"><span>You pay</span><strong>${money(spin.final)}</strong></div>
    </div>
    <button class="btn btn-primary result-pay" type="button" data-result-pay>
      Pay ${money(spin.final)} ${icon('arrow')}
    </button>
    <button class="result-back" type="button" data-result-back>Back to order</button>`;

  overlay.classList.add('has-result');
  spinBtn.disabled = true;
  spinBtn.classList.remove('is-spinning');
  spinBtn.classList.add('is-locked');
  spinBtn.querySelector('span').textContent = 'SPUN';
  spinBtn.querySelector('small').textContent = 'locked in';
}

async function doSpin() {
  if (spinning || state.spin) return;
  if (!countItems()) return;

  const total = cartTotal();
  const rigged = pickRiggedResult();

  spinning = true;
  overlay.classList.add('is-spinning');
  spinBtn.disabled = true;
  spinBtn.classList.add('is-spinning');
  spinBtn.querySelector('small').textContent = 'good luck';
  closeBtnDisable(true);

  wheel.sound.ensure();
  if (navigator.vibrate) navigator.vibrate([18, 30, 18]);

  try {
    await wheel.spinToIndex(rigged.index);
    const { discount, final } = discountFor(total, rigged.percent);
    state.spin = {
      percent: rigged.percent,
      index: rigged.index,
      total,
      discount,
      final,
      at: Date.now(),
    };

    spinning = false;
    overlay.classList.remove('is-spinning');
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
    celebrate({ count: 180 });
    wheel.sound.win();
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);

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
  if (wheel) wheel.setMuted(muted);
  updateMuteButton();
});

function updateMuteButton() {
  muteBtn.innerHTML = muted ? icon('mute') : icon('sound');
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && overlay.classList.contains('is-open')) closeWheel();
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
