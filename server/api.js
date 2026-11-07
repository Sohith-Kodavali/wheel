import { store } from './store.js';

const MAX_BODY = 64 * 1024;
const MAX_SETTINGS_BODY = 2 * 1024 * 1024;
const SETTINGS_VERSION = 3;
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req, limit = MAX_BODY) {
  if (req.body !== undefined) {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (body === null || body === '') return Promise.resolve(null);
    if (typeof body === 'string') {
      if (body.length > limit) return Promise.reject(new Error('Payload too large'));
      try {
        return Promise.resolve(JSON.parse(body));
      } catch {
        return Promise.reject(new Error('Invalid JSON'));
      }
    }
    if (typeof body === 'object') {
      if (JSON.stringify(body).length > limit) return Promise.reject(new Error('Payload too large'));
      return Promise.resolve(body);
    }
    return Promise.reject(new Error('Invalid JSON'));
  }

  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function validateOrder(body) {
  if (!body || typeof body !== 'object') return { error: 'Send an order.' };

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(token)) return { error: 'Invalid order token.' };

  if (!Array.isArray(body.items) || body.items.length === 0) return { error: 'Add at least one item.' };
  if (body.items.length > 20) return { error: 'Too many items.' };

  const items = [];
  let total = 0;

  for (const raw of body.items) {
    const id = typeof raw?.id === 'string' ? raw.id.trim().slice(0, 40) : '';
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) : '';
    const qty = Math.trunc(Number(raw?.qty));
    const price = Math.trunc(Number(raw?.price));

    if (!id || !name) return { error: 'Invalid item.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: 'Invalid item quantity.' };
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return { error: 'Invalid item price.' };

    total += qty * price;
    items.push({ id, name, qty, price });
  }

  const percent = Number(body.percent ?? 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: 'Invalid discount.' };

  const discount = Math.trunc(Number(body.discount ?? 0));
  if (!Number.isInteger(discount) || discount < 0 || discount > total) return { error: 'Invalid discount.' };

  return {
    value: {
      token,
      items,
      total,
      discount,
      final: total - discount,
      percent,
    },
  };
}

function validateSettings(body) {
  if (!body || typeof body !== 'object') return { error: 'Send settings.' };

  const settings = body.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { error: 'Invalid settings.' };
  }

  const upiId = typeof settings.upi?.id === 'string' ? settings.upi.id.trim() : '';
  if (!UPI_PATTERN.test(upiId)) return { error: 'Invalid UPI ID.' };

  const upiName = typeof settings.upi?.name === 'string' ? settings.upi.name.trim() : '';
  if (upiName.length < 2 || upiName.length > 60) return { error: 'UPI name must be 2–60 characters.' };

  const qrMode = settings.qr?.mode;
  if (!['dynamic', 'uploaded'].includes(qrMode)) return { error: 'Invalid QR mode.' };
  const qrImage = typeof settings.qr?.image === 'string' ? settings.qr.image : '';
  if (qrImage && !qrImage.startsWith('data:image/')) return { error: 'Invalid QR image.' };
  if (qrImage.length > 1_800_000) return { error: 'QR image is too large.' };
  if (qrMode === 'uploaded' && !qrImage) return { error: 'Upload a QR photo first.' };

  if (!settings.menu || typeof settings.menu !== 'object' || Array.isArray(settings.menu)) {
    return { error: 'Invalid menu.' };
  }
  const menuKeys = Object.keys(settings.menu);
  if (menuKeys.length > 40) return { error: 'Too many menu overrides.' };
  const menu = {};
  for (const id of menuKeys) {
    if (!/^[a-zA-Z0-9-]{1,40}$/.test(id)) return { error: 'Invalid menu item.' };
    const price = Math.trunc(Number(settings.menu[id]?.price));
    if (!Number.isInteger(price) || price <= 0 || price > 1_000_000) {
      return { error: 'Invalid menu price.' };
    }
    menu[id] = { price };
  }

  if (!Array.isArray(settings.wheel?.segments)) return { error: 'Invalid wheel.' };
  if (settings.wheel.segments.length < 2 || settings.wheel.segments.length > 16) {
    return { error: 'Add 2–16 wheel offers.' };
  }

  const segments = [];
  const offerIds = new Set();
  for (const segment of settings.wheel.segments) {
    const id = typeof segment?.id === 'string' ? segment.id.trim().slice(0, 40) : '';
    const label = typeof segment?.label === 'string' ? segment.label.trim().slice(0, 24) : '';
    const percent = Number(segment?.percent);
    const weight = Number(segment?.weight);
    const color = typeof segment?.color === 'string' ? segment.color : '';

    if (!id || offerIds.has(id) || !label) return { error: 'Invalid wheel offer.' };
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: 'Invalid offer discount.' };
    if (!Number.isFinite(weight) || weight <= 0) return { error: 'Invalid offer weight.' };
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: 'Invalid offer colour.' };

    offerIds.add(id);
    segments.push({ id, label, percent, weight, color });
  }

  if (!Array.isArray(settings.spin?.sequence)) return { error: 'Invalid spin sequence.' };
  const sequence = settings.spin.sequence.map(String).filter((id) => offerIds.has(id));
  if (sequence.length < 1 || sequence.length > 60) return { error: 'Add 1–60 spin steps.' };

  const maxDiscount = Math.trunc(Number(settings.spin.maxDiscount));
  const minPayable = Math.trunc(Number(settings.spin.minPayable));
  if (!Number.isInteger(maxDiscount) || maxDiscount < 0 || maxDiscount > 1_000_000) {
    return { error: 'Invalid max discount.' };
  }
  if (!Number.isInteger(minPayable) || minPayable < 0 || minPayable > 1_000_000) {
    return { error: 'Invalid minimum payable.' };
  }

  return {
    value: {
      settings: {
        version: SETTINGS_VERSION,
        upi: { id: upiId, name: upiName },
        qr: { mode: qrMode, image: qrImage },
        menu,
        wheel: { segments },
        spin: { sequence, maxDiscount, minPayable },
      },
    },
  };
}

export async function handleApi(req, res, url) {
  const { pathname } = url;

  try {
    if (pathname === '/api/orders' && req.method === 'GET') {
      sendJson(res, 200, { orders: await store.listOrders() });
      return;
    }

    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await readJson(req);
      const parsed = validateOrder(body);
      if (parsed.error) {
        sendJson(res, 400, { error: parsed.error });
        return;
      }
      const order = await store.createOrder(parsed.value);
      sendJson(res, 200, { ok: true, number: order.number });
      return;
    }

    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (orderMatch && req.method === 'DELETE') {
      const deleted = await store.deleteOrder(Number(orderMatch[1]));
      if (!deleted) {
        sendJson(res, 404, { error: 'Order not found.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/settings' && req.method === 'GET') {
      sendJson(res, 200, { settings: await store.getSettings() });
      return;
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const body = await readJson(req, MAX_SETTINGS_BODY);
      const parsed = validateSettings(body);
      if (parsed.error) {
        sendJson(res, 400, { error: parsed.error });
        return;
      }
      await store.saveSettings(parsed.value.settings);
      sendJson(res, 200, { ok: true, settings: parsed.value.settings });
      return;
    }

    if (pathname === '/api/chef/queue' && req.method === 'GET') {
      sendJson(res, 200, {
        items: await store.pendingItems(),
        doneToday: await store.doneToday(),
      });
      return;
    }

    const doneMatch = pathname.match(/^\/api\/chef\/items\/(\d+)\/done$/);
    if (doneMatch && req.method === 'POST') {
      const ok = await store.markItemDone(Number(doneMatch[1]));
      if (!ok) {
        sendJson(res, 404, { error: 'Item not found or already done.' });
        return;
      }
      sendJson(res, 200, { ok: true, doneToday: await store.doneToday() });
      return;
    }

    if (pathname === '/api/analytics' && req.method === 'GET') {
      sendJson(res, 200, await store.analytics());
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error.message === 'Invalid JSON') {
      if (!res.headersSent) sendJson(res, 400, { error: 'Invalid JSON body.' });
      return;
    }
    if (error.message === 'Payload too large') {
      if (!res.headersSent) sendJson(res, 413, { error: 'Request payload is too large.' });
      return;
    }
    console.error('API error:', error.message);
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
    else res.end();
  }
}

export default { handleApi };
