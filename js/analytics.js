const statsEl = document.getElementById('stats');
const topEl = document.getElementById('top-list');
const topEmpty = document.getElementById('top-empty');
const weekEl = document.getElementById('week-chart');
const allTimeEl = document.getElementById('all-time');
const errorEl = document.getElementById('analytics-error');
const orderListEl = document.getElementById('order-list');
const ordersCountEl = document.getElementById('orders-count');
const ordersEmptyEl = document.getElementById('orders-empty');

function money(paise) {
  const rupees = Number(paise) / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toLocaleString('en-IN') : rupees.toFixed(2)}`;
}

function stat(label, value) {
  const card = document.createElement('div');
  card.className = 'stat';

  const name = document.createElement('span');
  name.className = 'stat-label';
  name.textContent = label;

  const amount = document.createElement('strong');
  amount.className = 'stat-value';
  amount.textContent = value;

  card.append(name, amount);
  return card;
}

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function paint(data) {
  const today = data.today;

  statsEl.replaceChildren(
    stat('Revenue today', money(today.revenue)),
    stat('Orders today', String(today.orders)),
    stat('Drinks sold', String(today.drinks)),
    stat(
      'Pending now',
      `${today.pendingDrinks} drink${today.pendingDrinks === 1 ? '' : 's'}`,
    ),
    stat('Average order', today.orders ? money(Math.round(today.revenue / today.orders)) : '—'),
    stat('Discounts given', money(today.discounts)),
  );

  const topMax = Math.max(1, ...data.top.map((row) => row.qty));
  topEl.replaceChildren(
    ...data.top.map((row) => {
      const li = document.createElement('li');
      li.className = 'top-row';

      const name = document.createElement('span');
      name.className = 'top-name';
      name.textContent = row.name;

      const track = document.createElement('span');
      track.className = 'top-track';
      const fill = document.createElement('span');
      fill.className = 'top-fill';
      fill.style.width = `${(row.qty / topMax) * 100}%`;
      track.append(fill);

      const qty = document.createElement('strong');
      qty.className = 'top-qty';
      qty.textContent = String(row.qty);

      li.append(name, track, qty);
      return li;
    }),
  );
  topEmpty.hidden = data.top.length > 0;

  const weekMax = Math.max(1, ...data.week.map((day) => day.revenue));
  const todayIso = todayKey();

  weekEl.replaceChildren(
    ...data.week.map((day) => {
      const col = document.createElement('div');
      col.className = 'week-col';
      if (day.day === todayIso) col.classList.add('is-today');

      const value = document.createElement('span');
      value.className = 'week-value';
      value.textContent = day.revenue ? money(day.revenue) : '';

      const wrap = document.createElement('div');
      wrap.className = 'week-barwrap';
      const bar = document.createElement('div');
      bar.className = 'week-bar';
      if (!day.revenue) bar.classList.add('is-empty');
      bar.style.height = `${Math.max(4, (day.revenue / weekMax) * 100)}%`;
      bar.title = `${day.orders} order${day.orders === 1 ? '' : 's'} · ${money(day.revenue)}`;
      wrap.append(bar);

      const label = document.createElement('span');
      label.className = 'week-day';
      label.textContent = new Date(`${day.day}T12:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short',
      });

      col.append(value, wrap, label);
      return col;
    }),
  );

  allTimeEl.textContent = `All time: ${data.allTime.orders} orders · ${money(data.allTime.revenue)}`;
}

function orderTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return time;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

function orderRow(order) {
  const row = document.createElement('article');
  row.className = 'order-row';

  const head = document.createElement('div');
  head.className = 'order-head';

  const number = document.createElement('strong');
  number.className = 'order-number';
  number.textContent = `#${order.number}`;

  const time = document.createElement('span');
  time.className = 'order-time';
  time.textContent = orderTime(order.createdAt);

  head.append(number, time);

  const items = document.createElement('p');
  items.className = 'order-items';
  items.textContent = order.items.map((item) => `${item.qty}× ${item.name}`).join(' · ') || '—';

  const foot = document.createElement('div');
  foot.className = 'order-foot';

  const amount = document.createElement('span');
  amount.className = 'order-money';
  amount.textContent = money(order.final);
  if (order.discount > 0) {
    const was = document.createElement('s');
    was.textContent = money(order.total);
    amount.append(' ', was);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'order-remove';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove order ${order.number}`);
  remove.addEventListener('click', () => removeOrder(order, remove));

  foot.append(amount, remove);
  row.append(head, items, foot);
  return row;
}

function paintOrders(orders) {
  orderListEl.replaceChildren(...orders.map(orderRow));
  ordersEmptyEl.hidden = orders.length > 0;
  ordersCountEl.textContent = orders.length === 1 ? '1 order' : `${orders.length} orders`;
}

async function removeOrder(order, button) {
  if (!window.confirm(`Remove order #${order.number}? Only use this for cancelled orders.`)) return;

  button.disabled = true;
  button.textContent = 'Removing…';
  try {
    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await load();
  } catch {
    button.disabled = false;
    button.textContent = 'Remove';
    errorEl.textContent = 'Could not remove that order — try again.';
  }
}

async function load() {
  try {
    const [analyticsRes, ordersRes] = await Promise.all([
      fetch('/api/analytics', { cache: 'no-store' }),
      fetch('/api/orders', { cache: 'no-store' }),
    ]);
    if (!analyticsRes.ok || !ordersRes.ok) throw new Error('HTTP error');
    const [analytics, orders] = await Promise.all([analyticsRes.json(), ordersRes.json()]);
    errorEl.textContent = '';
    paint(analytics);
    paintOrders(orders.orders || []);
  } catch {
    errorEl.textContent = 'Could not load analytics — retrying…';
  }
}

load();
setInterval(load, 10000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load();
});
