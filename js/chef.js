const queueEl = document.getElementById('queue');
const emptyEl = document.getElementById('empty');
const pendingEl = document.getElementById('pending-pill');
const doneEl = document.getElementById('done-today');
const errorEl = document.getElementById('chef-error');

const suppressed = new Set();
let lastKey = '';

function ticket(item) {
  const row = document.createElement('article');
  row.className = 'ticket';
  row.dataset.id = String(item.id);

  const main = document.createElement('div');
  main.className = 'ticket-main';

  const qty = document.createElement('span');
  qty.className = 'ticket-qty';
  qty.textContent = `×${item.qty}`;
  qty.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'ticket-name';
  name.textContent = item.name;

  main.append(qty, name);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ticket-done';
  button.textContent = 'DONE';
  button.setAttribute('aria-label', `Mark ${item.qty} ${item.name} done`);
  button.addEventListener('click', () => finish(item.id, row, button));

  row.append(main, button);
  return row;
}

function paint(items, served) {
  pendingEl.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  doneEl.textContent = String(served ?? 0);
  emptyEl.hidden = items.length > 0;
  queueEl.hidden = items.length === 0;

  const key = items.map((item) => `${item.id}:${item.qty}`).join('|');
  if (key === lastKey) return;
  lastKey = key;
  queueEl.replaceChildren(...items.map(ticket));
}

async function refresh() {
  try {
    const res = await fetch('/api/chef/queue', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items.filter((item) => !suppressed.has(item.id));
    errorEl.textContent = '';
    paint(items, data.doneToday);
  } catch {
    errorEl.textContent = 'Connection lost — retrying…';
  }
}

async function finish(id, row, button) {
  suppressed.add(id);
  button.disabled = true;
  row.classList.add('is-done');

  try {
    const res = await fetch(`/api/chef/items/${id}/done`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    doneEl.textContent = String(data.doneToday ?? doneEl.textContent);
    errorEl.textContent = '';
    row.classList.add('is-gone');
    setTimeout(() => row.remove(), 320);
    setTimeout(refresh, 400);
  } catch {
    suppressed.delete(id);
    button.disabled = false;
    row.classList.remove('is-done');
    errorEl.textContent = 'Could not mark that done. Tap DONE again.';
  }
}

refresh();
setInterval(refresh, 3000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
