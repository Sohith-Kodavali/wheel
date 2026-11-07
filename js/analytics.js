const statsEl = document.getElementById('stats');
const topEl = document.getElementById('top-list');
const topEmpty = document.getElementById('top-empty');
const weekEl = document.getElementById('week-chart');
const allTimeEl = document.getElementById('all-time');
const errorEl = document.getElementById('analytics-error');

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

async function load() {
  try {
    const res = await fetch('/api/analytics', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    errorEl.textContent = '';
    paint(await res.json());
  } catch {
    errorEl.textContent = 'Could not load analytics — retrying…';
  }
}

load();
setInterval(load, 10000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load();
});
