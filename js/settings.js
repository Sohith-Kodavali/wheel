import {
  DEFAULT_MENU,
  DEFAULT_SETTINGS,
  OFFER_COLORS,
  UPI_PATTERN,
  escapeHtml,
  normalizeSettings,
} from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const adminLock = $('#admin-lock');
const adminContent = $('#admin-content');
const adminForm = $('#admin-form');
const pinForm = $('#pin-form');
const pinInput = $('#pin-input');
const pinError = $('#pin-error');
const adminError = $('#admin-error');
const adminQrPreview = $('#admin-qr-preview');
const adminMenuRows = $('#admin-menu-rows');
const adminOfferRows = $('#admin-offer-rows');
const adminSequenceRows = $('#admin-sequence-rows');
const toast = $('#toast');

let SETTINGS = normalizeSettings({});
let adminImage = '';
let adminOffers = [];
let adminSequence = [];

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-on'), 2800);
}

function menuItems() {
  return DEFAULT_MENU.map((item) => {
    const override = SETTINGS.menu[item.id];
    return override ? { ...item, price: override.price } : { ...item };
  });
}

function showLock() {
  adminLock.hidden = false;
  adminContent.hidden = true;
  pinError.textContent = '';
  pinInput.value = '';
  setTimeout(() => pinInput.focus(), 80);
}

async function loadSettings() {
  const response = await fetch('/api/settings', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load settings.');
  const data = await response.json();
  SETTINGS = normalizeSettings(data.settings);
}

async function hasSession() {
  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.authed);
  } catch {
    return false;
  }
}

async function enterAdmin() {
  try {
    await loadSettings();
  } catch {
    pinError.textContent = 'Could not load settings. Check the server connection.';
    return;
  }
  adminLock.hidden = true;
  adminContent.hidden = false;
  populateForm();
}

function populateForm() {
  adminError.textContent = '';
  $('#admin-upi-id').value = SETTINGS.upi.id;
  $('#admin-upi-name').value = SETTINGS.upi.name;
  $('#admin-qr-mode').value = SETTINGS.qr.mode;
  $('#admin-max').value = SETTINGS.spin.maxDiscount / 100;
  $('#admin-min').value = SETTINGS.spin.minPayable / 100;
  $('#admin-new-pin').value = '';
  adminImage = SETTINGS.qr.image || '';
  adminOffers = SETTINGS.wheel.segments.map((offer) => ({ ...offer }));
  adminSequence = SETTINGS.spin.sequence.slice();
  renderAdminMenuRows();
  renderAdminOffers();
  renderAdminSequence();
  renderAdminQrPreview();
}

function renderAdminMenuRows() {
  adminMenuRows.innerHTML = menuItems()
    .map(
      (item) => `
    <div class="admin-menu-row" data-menu-id="${item.id}">
      <span class="admin-drink">${escapeHtml(item.name)}<small>${escapeHtml(item.flavour)}</small></span>
      <input
        class="admin-input"
        type="number"
        min="1"
        step="1"
        data-price="price"
        value="${item.price / 100}"
        aria-label="${escapeHtml(item.name)} price"
      />
    </div>`,
    )
    .join('');
}

function newOfferId() {
  let id;
  do {
    id = `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  } while (adminOffers.some((offer) => offer.id === id));
  return id;
}

function readAdminOffers() {
  return $$('.admin-offer-row', adminOfferRows).map((row) => {
    const id = row.dataset.offerId;
    const percent = Number(row.querySelector('[data-offer="percent"]').value);
    const label = row.querySelector('[data-offer="label"]').value.trim();
    const standardLabel = /^\d+(?:\.\d+)?%\s*OFF$/i.test(label);
    const weight = Number(row.querySelector('[data-offer="weight"]').value);
    return {
      id,
      label: standardLabel && Number.isFinite(percent) ? `${percent}% OFF` : label,
      percent,
      color: row.querySelector('[data-offer="color"]').value,
      weight: Number.isFinite(weight) ? weight : 0,
    };
  });
}

function readAdminSequence() {
  return $$('[data-sequence-select]', adminSequenceRows).map((select) => select.value);
}

function updateWheelTotal() {
  const total = $$('[data-offer="weight"]', adminOfferRows).reduce(
    (sum, input) => sum + (Number(input.value) || 0),
    0,
  );
  const element = $('#admin-wheel-total');
  if (!element) return;
  const rounded = Math.round(total * 10) / 10;
  const scaled = Math.abs(rounded - 100) > 0.5;
  element.textContent = scaled ? `Wheel total: ${rounded}% · scaled to fit` : 'Wheel total: 100%';
  element.classList.toggle('is-off', scaled);
}

function renderAdminOffers() {
  adminOfferRows.innerHTML = adminOffers
    .map(
      (offer) => `
    <div class="admin-offer-row" data-offer-id="${escapeHtml(offer.id)}">
      <input
        class="admin-input"
        type="text"
        data-offer="label"
        maxlength="24"
        value="${escapeHtml(offer.label)}"
        aria-label="Offer label"
      />
      <div class="admin-percent">
        <input
          class="admin-input"
          type="number"
          data-offer="percent"
          min="0"
          max="100"
          step="1"
          value="${offer.percent}"
          aria-label="Discount percent"
        />
        <span>%</span>
      </div>
      <input
        class="admin-input"
        type="number"
        data-offer="weight"
        min="1"
        step="1"
        value="${offer.weight}"
        aria-label="Wheel percentage"
      />
      <input class="admin-color" type="color" data-offer="color" value="${escapeHtml(offer.color)}" aria-label="Offer colour" />
      <button class="remove-line" type="button" data-remove-offer="${escapeHtml(offer.id)}" aria-label="Remove offer">×</button>
    </div>`,
    )
    .join('');
  updateWheelTotal();
}

function renderAdminSequence() {
  if (!adminOffers.length) {
    adminSequenceRows.innerHTML = '<p class="admin-hint">Add an offer first.</p>';
    return;
  }
  const ids = new Set(adminOffers.map((offer) => offer.id));
  adminSequence = adminSequence.filter((id) => ids.has(id));
  if (!adminSequence.length) adminSequence = [adminOffers[0].id];

  adminSequenceRows.innerHTML = adminSequence
    .map(
      (id, index) => `
    <div class="admin-sequence-row">
      <span class="admin-seq-index">${index + 1}</span>
      <select class="admin-input" data-sequence-select aria-label="Offer for spin ${index + 1}">
        ${adminOffers
          .map(
            (offer) =>
              `<option value="${escapeHtml(offer.id)}"${offer.id === id ? ' selected' : ''}>${escapeHtml(offer.label)} · ${offer.percent}%</option>`,
          )
          .join('')}
      </select>
      <button class="remove-line" type="button" data-remove-sequence="${index}" aria-label="Remove spin ${index + 1}">×</button>
    </div>`,
    )
    .join('');
}

function addAdminOffer() {
  adminOffers = readAdminOffers();
  adminSequence = readAdminSequence();
  adminOffers.push({
    id: newOfferId(),
    label: '10% OFF',
    percent: 10,
    color: OFFER_COLORS[adminOffers.length % OFFER_COLORS.length],
    weight: 10,
  });
  renderAdminOffers();
  renderAdminSequence();
}

function addAdminSequenceStep() {
  adminOffers = readAdminOffers();
  adminSequence = readAdminSequence();
  if (!adminOffers.length) return;
  adminSequence.push(adminOffers[0].id);
  renderAdminSequence();
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
    showToast('That image is too large. Use one under 12 MB.');
    return;
  }
  try {
    adminImage = await resizeImage(file);
    $('#admin-qr-mode').value = 'uploaded';
    renderAdminQrPreview();
    adminError.textContent = '';
  } catch (error) {
    console.error('QR upload failed', error);
    showToast('Could not read that image. Try a PNG or JPG.');
  }
}

async function submitPin(event) {
  event.preventDefault();
  pinError.textContent = '';
  const pin = pinInput.value.trim();
  if (!/^\d{4,8}$/.test(pin)) {
    pinError.textContent = 'Enter your 4–8 digit PIN.';
    return;
  }

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      pinError.textContent = data.error || 'Wrong PIN. Try again.';
      pinInput.value = '';
      pinInput.focus();
      return;
    }
    pinInput.value = '';
    await enterAdmin();
  } catch {
    pinError.textContent = 'Could not reach the server.';
  }
}

function buildSettings() {
  adminError.textContent = '';

  const upiId = $('#admin-upi-id').value.trim();
  const upiName = $('#admin-upi-name').value.trim();
  const qrMode = $('#admin-qr-mode').value;
  const offers = readAdminOffers();
  const sequence = readAdminSequence();
  const maxDiscount = Math.round(Number($('#admin-max').value) * 100);
  const minPayable = Math.round(Number($('#admin-min').value) * 100);
  const newPin = $('#admin-new-pin').value.trim();

  if (!UPI_PATTERN.test(upiId)) return { error: 'Enter a valid UPI ID, for example stall@bank.' };
  if (upiName.length < 2 || upiName.length > 60) return { error: 'UPI display name must be 2–60 characters.' };
  if (qrMode === 'uploaded' && !adminImage) return { error: 'Upload a QR photo, or choose the generated QR.' };
  if (offers.length < 2) return { error: 'Add at least two wheel offers.' };
  if (offers.length > 16) return { error: 'Keep the wheel to 16 offers or fewer.' };

  for (const offer of offers) {
    if (!offer.label || offer.label.length > 24) {
      return { error: 'Each offer needs a label of 1–24 characters.' };
    }
    if (!Number.isFinite(offer.percent) || offer.percent < 0 || offer.percent > 100) {
      return { error: `"${offer.label}": enter a discount between 0 and 100.` };
    }
    if (!Number.isFinite(offer.weight) || offer.weight <= 0) {
      return { error: `"${offer.label}": set a wheel size above 0.` };
    }
  }

  const totalWeight = offers.reduce((sum, offer) => sum + offer.weight, 0);
  const normalizedOffers = offers.map((offer) => ({
    ...offer,
    weight: Math.max(0.1, Math.round((offer.weight / totalWeight) * 1000) / 10),
  }));
  const offerIds = new Set(offers.map((offer) => offer.id));
  const steps = sequence.filter((id) => offerIds.has(id));
  if (!steps.length || steps.length > 60) return { error: 'Add between 1 and 60 steps to the spin sequence.' };
  if (!Number.isFinite(maxDiscount) || maxDiscount < 0 || maxDiscount > 1_000_000) {
    return { error: 'Enter a valid maximum discount.' };
  }
  if (!Number.isFinite(minPayable) || minPayable < 0 || minPayable > 1_000_000) {
    return { error: 'Enter a valid minimum payable amount.' };
  }
  if (newPin && !/^\d{4,8}$/.test(newPin)) return { error: 'The admin PIN must be 4–8 digits.' };

  const menu = {};
  for (const row of adminMenuRows.querySelectorAll('.admin-menu-row')) {
    const id = row.dataset.menuId;
    const item = DEFAULT_MENU.find((entry) => entry.id === id);
    if (!item) continue;
    const price = Math.round(Number(row.querySelector('[data-price="price"]').value) * 100);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      return { error: `${item.name}: enter a valid price.` };
    }
    menu[id] = { price };
  }

  return {
    settings: {
      version: DEFAULT_SETTINGS.version,
      upi: { id: upiId, name: upiName },
      qr: { mode: qrMode, image: adminImage },
      menu,
      wheel: { segments: normalizedOffers },
      spin: { sequence: steps, maxDiscount, minPayable },
    },
    pin: newPin,
  };
}

async function saveAdminSettings(event) {
  event.preventDefault();
  const built = buildSettings();
  if (built.error) {
    adminError.textContent = built.error;
    return;
  }

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: built.settings, pin: built.pin || undefined }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      showLock();
      pinError.textContent = 'Session expired. Sign in again.';
      return;
    }
    if (!response.ok) {
      adminError.textContent = data.error || 'Could not save settings.';
      return;
    }

    SETTINGS = normalizeSettings(data.settings);
    populateForm();
    showToast('Saved · every device will update');
  } catch {
    adminError.textContent = 'Could not reach the server.';
  }
}

async function resetDefaults() {
  if (!window.confirm('Reset menu prices and wheel settings for every device?')) return;

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: normalizeSettings(DEFAULT_SETTINGS) }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      showLock();
      pinError.textContent = 'Session expired. Sign in again.';
      return;
    }
    if (!response.ok) {
      adminError.textContent = data.error || 'Could not reset settings.';
      return;
    }

    SETTINGS = normalizeSettings(data.settings);
    populateForm();
    showToast('Defaults restored on every device');
  } catch {
    adminError.textContent = 'Could not reach the server.';
  }
}

async function logout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } catch {
    /* the cookie may still be valid; the lock screen is shown anyway */
  }
  showLock();
  showToast('Signed out');
}

pinForm.addEventListener('submit', submitPin);
adminForm.addEventListener('submit', saveAdminSettings);
$('#admin-logout').addEventListener('click', logout);
$('#admin-reset').addEventListener('click', resetDefaults);

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

$('#admin-add-offer').addEventListener('click', addAdminOffer);
$('#admin-add-sequence').addEventListener('click', addAdminSequenceStep);

adminOfferRows.addEventListener('input', (event) => {
  const row = event.target.closest('.admin-offer-row');
  if (!row) return;
  const label = row.querySelector('[data-offer="label"]');
  const percent = row.querySelector('[data-offer="percent"]');

  if (event.target === percent) {
    const value = percent.value.trim();
    if (!value || !Number.isFinite(Number(value))) return;
    if (/^(\d+(?:\.\d+)?)?%\s*OFF$/i.test(label.value.trim())) label.value = `${value}% OFF`;
    return;
  }
  if (event.target === label) {
    const match = label.value.trim().match(/^(\d+(?:\.\d+)?)%\s*OFF$/i);
    if (match) percent.value = String(Number(match[1]));
    return;
  }
  if (event.target.matches('[data-offer="weight"]')) updateWheelTotal();
});

adminOfferRows.addEventListener('change', () => {
  adminOffers = readAdminOffers();
  adminSequence = readAdminSequence();
  renderAdminSequence();
});

adminOfferRows.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-offer]');
  if (!remove) return;
  adminOffers = readAdminOffers();
  adminSequence = readAdminSequence();
  const id = remove.dataset.removeOffer;
  adminOffers = adminOffers.filter((offer) => offer.id !== id);
  adminSequence = adminSequence.filter((offerId) => offerId !== id);
  renderAdminOffers();
  renderAdminSequence();
});

adminSequenceRows.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-sequence]');
  if (!remove) return;
  adminSequence = readAdminSequence();
  adminSequence.splice(Number(remove.dataset.removeSequence), 1);
  renderAdminSequence();
});

async function boot() {
  if (await hasSession()) await enterAdmin();
  else showLock();
}

boot();
