const ORDERS = 'orders';
const ITEMS = 'order_items';
const SETTINGS = 'app_settings';

const baseUrl = (process.env.SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const apiKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  '';

function restUrl(path) {
  return `${baseUrl}/rest/v1/${path}`;
}

async function rest(path, { method = 'GET', body, prefer, count = false } = {}) {
  if (!baseUrl || !apiKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const preferences = [prefer, count ? 'count=exact' : ''].filter(Boolean);
  if (preferences.length) headers.Prefer = preferences.join(',');

  const response = await fetch(restUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object'
        ? data.message || data.hint || data.error || JSON.stringify(data)
        : String(text || response.statusText);
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${detail}`);
  }

  return { data, response };
}

async function insertItems(orderId, items) {
  if (!items.length) return;
  await rest(ITEMS, {
    method: 'POST',
    prefer: 'return=minimal',
    body: items.map((item) => ({
      order_id: orderId,
      menu_id: item.id,
      name: item.name,
      qty: item.qty,
      unit_price: item.price,
    })),
  });
}

export async function createOrder(order) {
  const now = new Date().toISOString();
  const { data: existingRows } = await rest(
    `${ORDERS}?client_token=eq.${encodeURIComponent(order.token)}&select=id&limit=1`,
  );
  const existing = existingRows?.[0];

  if (existing) {
    const { data: doneRows } = await rest(
      `${ITEMS}?order_id=eq.${existing.id}&done=eq.true&select=id&limit=1`,
    );

    // Once the kitchen has started an order, later tablet edits must not
    // recreate items that were already served.
    if (doneRows?.length) return { number: existing.id, updated: false };

    await rest(`${ITEMS}?order_id=eq.${existing.id}`, { method: 'DELETE' });
    await rest(`${ORDERS}?id=eq.${existing.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        total: order.total,
        discount: order.discount,
        final_total: order.final,
        percent: order.percent,
        updated_at: now,
      },
    });
    await insertItems(existing.id, order.items);
    return { number: existing.id, updated: true };
  }

  const { data: createdRows } = await rest(ORDERS, {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      client_token: order.token,
      total: order.total,
      discount: order.discount,
      final_total: order.final,
      percent: order.percent,
      created_at: now,
      updated_at: now,
    },
  });
  const orderId = createdRows[0].id;

  await insertItems(orderId, order.items);
  return { number: orderId, updated: false };
}

export async function pendingItems() {
  const { data } = await rest(
    `${ITEMS}?done=eq.false&select=id,name,qty&order=created_at.asc,id.asc`,
  );
  return data || [];
}

function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function doneToday() {
  const { data } = await rest(
    `${ITEMS}?done=eq.true&done_at=gte.${encodeURIComponent(startOfDay().toISOString())}&select=qty`,
  );
  return (data || []).reduce((sum, row) => sum + Number(row.qty), 0);
}

export async function markItemDone(id) {
  const { data } = await rest(`${ITEMS}?id=eq.${Number(id)}&done=eq.false`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { done: true, done_at: new Date().toISOString() },
  });
  return Array.isArray(data) && data.length > 0;
}

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function analytics() {
  const todayStart = startOfDay();
  const weekStart = startOfDay();
  weekStart.setDate(weekStart.getDate() - 6);

  const [{ data: orders }, { data: todayItems }, { data: pending }] = await Promise.all([
    rest(`${ORDERS}?select=created_at,total,discount,final_total`),
    rest(
      `${ITEMS}?created_at=gte.${encodeURIComponent(todayStart.toISOString())}&select=name,qty`,
    ),
    rest(`${ITEMS}?done=eq.false&select=qty`),
  ]);

  const allOrders = orders || [];
  const itemsToday = todayItems || [];
  const pendingRows = pending || [];

  let ordersToday = 0;
  let gross = 0;
  let discounts = 0;
  let revenue = 0;
  for (const order of allOrders) {
    if (new Date(order.created_at) < todayStart) continue;
    ordersToday += 1;
    gross += Number(order.total) || 0;
    discounts += Number(order.discount) || 0;
    revenue += Number(order.final_total) || 0;
  }

  const byItem = new Map();
  let drinks = 0;
  for (const item of itemsToday) {
    const qty = Number(item.qty) || 0;
    drinks += qty;
    byItem.set(item.name, (byItem.get(item.name) || 0) + qty);
  }

  const top = [...byItem.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, 8);

  const byDay = new Map();
  let revenueAllTime = 0;
  for (const order of allOrders) {
    const amount = Number(order.final_total) || 0;
    revenueAllTime += amount;
    const created = new Date(order.created_at);
    if (created < weekStart) continue;
    const day = localDay(created);
    const entry = byDay.get(day) || { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += amount;
    byDay.set(day, entry);
  }

  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = localDay(date);
    const entry = byDay.get(key);
    week.push({ day: key, orders: entry?.orders ?? 0, revenue: entry?.revenue ?? 0 });
  }

  return {
    today: {
      orders: ordersToday,
      gross,
      discounts,
      revenue,
      drinks,
      pendingRows: pendingRows.length,
      pendingDrinks: pendingRows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0),
    },
    top,
    week,
    allTime: {
      orders: allOrders.length,
      revenue: revenueAllTime,
    },
  };
}

export async function health() {
  await rest(`${ORDERS}?select=id&limit=1`);
  return true;
}

export async function getSettings() {
  const { data } = await rest(`${SETTINGS}?id=eq.1&select=data`);
  return data?.[0]?.data || {};
}

export async function getPinRecord() {
  const { data } = await rest(`${SETTINGS}?id=eq.1&select=pin_hash,pin_salt`);
  const row = data?.[0];
  if (!row?.pin_hash || !row?.pin_salt) return null;
  return { hash: row.pin_hash, salt: row.pin_salt };
}

export async function saveSettings(settings, pin) {
  const body = { id: 1, data: settings, updated_at: new Date().toISOString() };
  if (pin) {
    body.pin_hash = pin.hash;
    body.pin_salt = pin.salt;
  }
  await rest(`${SETTINGS}?on_conflict=id`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body,
  });
}
