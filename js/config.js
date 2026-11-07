export const DEFAULT_MENU = [
  {
    id: 'kitkat',
    name: 'KitKat Milkshake',
    flavour: 'KitKat',
    category: 'Milkshake',
    price: 7500,
    tint: 'pink',
    art: 'shake-kitkat',
    desc: 'Chocolate overload with crunch.',
  },
  {
    id: 'oreo',
    name: 'Oreo Milkshake',
    flavour: 'Oreo',
    category: 'Milkshake',
    price: 7500,
    tint: 'pink',
    art: 'shake-oreo',
    desc: 'Cookies and cream, blended thick.',
  },
  {
    id: 'dark',
    name: 'Dark Fantasy Milkshake',
    flavour: 'Dark Fantasy',
    category: 'Milkshake',
    price: 7500,
    tint: 'pink',
    art: 'shake-dark',
    desc: 'Dark chocolate, extra decadent.',
  },
  {
    id: 'blue',
    name: 'Blue Mojito',
    flavour: 'Blue',
    category: 'Mojito',
    price: 3900,
    tint: 'mint',
    art: 'mojito-blue',
    desc: 'Icy blue fizz, extra refreshing.',
  },
  {
    id: 'cuban',
    name: 'Orange Mojito',
    flavour: 'Orange',
    category: 'Mojito',
    price: 3900,
    tint: 'orange',
    art: 'mojito-orange',
    desc: 'Orange, lime and crushed ice.',
  },
  {
    id: 'lime',
    name: 'Sweet Lime Mojito',
    flavour: 'Sweet Lime',
    category: 'Mojito',
    price: 3900,
    tint: 'mint',
    art: 'mojito-lime',
    desc: 'Sweet citrus fizz over ice.',
  },
  {
    id: 'coffee',
    name: 'Cold Coffee',
    flavour: 'Classic',
    category: 'Cold Coffee',
    price: 6500,
    tint: 'caramel',
    art: 'coffee',
    desc: 'Bold coffee, shaken ice cold.',
  },
];

export const OFFER_COLORS = ['#FF7FB0', '#FFC24B', '#6FE0C2', '#9BD9FF', '#D3A8FF', '#FF9A6C', '#FF6B8B', '#8FD3FF'];

// The wheel's default offers. `weight` controls the physical slice size.
export const DEFAULT_WHEEL = [
  { id: 'off-1', label: '10% OFF', percent: 10, weight: 34, color: '#FF7FB0' },
  { id: 'off-2', label: '15% OFF', percent: 15, weight: 24, color: '#FFC24B' },
  { id: 'off-3', label: '10% OFF', percent: 10, weight: 18, color: '#6FE0C2' },
  { id: 'off-4', label: '20% OFF', percent: 20, weight: 14, color: '#9BD9FF' },
  { id: 'off-5', label: '25% OFF', percent: 25, weight: 10, color: '#D3A8FF' },
];

export const SPIN_MIN_TOTAL = 10000;
export const SETTINGS_KEY = 'msf-tablet-settings-v1';
export const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/;

export const DEFAULT_SETTINGS = {
  version: 3,
  upi: { id: 'milkshakefactory@upi', name: 'The Milkshake Factory' },
  qr: { mode: 'dynamic', image: '' },
  menu: {},
  wheel: { segments: DEFAULT_WHEEL },
  spin: {
    sequence: ['off-1', 'off-3', 'off-2', 'off-1', 'off-4', 'off-3', 'off-5', 'off-1', 'off-2', 'off-1'],
    maxDiscount: 6000,
    minPayable: 3000,
  },
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function normalizeSettings(raw) {
  const base = clone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;

  if (typeof raw.upi?.id === 'string' && UPI_PATTERN.test(raw.upi.id.trim())) base.upi.id = raw.upi.id.trim();
  if (typeof raw.upi?.name === 'string' && raw.upi.name.trim()) {
    base.upi.name = raw.upi.name.trim().slice(0, 60);
  }
  if (raw.qr && ['dynamic', 'uploaded'].includes(raw.qr.mode)) base.qr.mode = raw.qr.mode;
  if (typeof raw.qr?.image === 'string' && raw.qr.image.startsWith('data:image/')) base.qr.image = raw.qr.image;

  if (raw.version === DEFAULT_SETTINGS.version && raw.wheel && Array.isArray(raw.wheel.segments)) {
    const segments = raw.wheel.segments
      .filter((segment) => segment && typeof segment.id === 'string' && typeof segment.label === 'string')
      .map((segment) => {
        const percent = Number(segment.percent);
        const label = segment.label.trim().slice(0, 24);
        const standardLabel = /^(\d+(?:\.\d+)?)?%\s*OFF$/i.test(label);
        return {
          id: segment.id.slice(0, 40),
          label: standardLabel && Number.isFinite(percent) ? `${percent}% OFF` : label,
          percent,
          weight: Number(segment.weight) > 0 ? Number(segment.weight) : 10,
          color: /^#[0-9a-fA-F]{6}$/.test(segment.color) ? segment.color : '#FF7FB0',
        };
      })
      .filter(
        (segment) =>
          segment.id && segment.label && Number.isFinite(segment.percent) && segment.percent >= 0 && segment.percent <= 100,
      );
    if (segments.length >= 2) base.wheel.segments = segments;
  }

  if (raw.version === DEFAULT_SETTINGS.version && raw.spin && Array.isArray(raw.spin.sequence)) {
    const offerIds = new Set(base.wheel.segments.map((segment) => segment.id));
    const sequence = raw.spin.sequence.map(String).filter((id) => offerIds.has(id));
    if (sequence.length) base.spin.sequence = sequence.slice(0, 60);
  }
  if (Number.isFinite(Number(raw.spin?.maxDiscount)) && Number(raw.spin.maxDiscount) >= 0) {
    base.spin.maxDiscount = Math.round(Number(raw.spin.maxDiscount));
  }
  if (Number.isFinite(Number(raw.spin?.minPayable)) && Number(raw.spin.minPayable) >= 0) {
    base.spin.minPayable = Math.round(Number(raw.spin.minPayable));
  }

  if (raw.version === DEFAULT_SETTINGS.version && raw.menu && typeof raw.menu === 'object') {
    for (const item of DEFAULT_MENU) {
      const override = raw.menu[item.id];
      if (!override || typeof override !== 'object') continue;
      const entry = {};
      if (Number.isInteger(override.price) && override.price > 0 && override.price <= 1_000_000) {
        entry.price = override.price;
      }
      if (override.outOfStock === true) entry.outOfStock = true;
      if (override.special === true) entry.special = true;
      if (Object.keys(entry).length) base.menu[item.id] = entry;
    }
  }

  return base;
}
