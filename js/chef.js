const queueEl = document.getElementById('queue');
const emptyEl = document.getElementById('empty');
const pendingEl = document.getElementById('pending-pill');
const doneEl = document.getElementById('done-today');
const errorEl = document.getElementById('chef-error');
const soundBtn = document.getElementById('sound-toggle');

const suppressed = new Set();
let lastKey = '';
let knownIds = null;
let soundOn = true;
let audio = null;
let master = null;

function ensureAudio() {
  if (!soundOn) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audio) {
    audio = new AudioCtor();
    master = audio.createGain();
    master.gain.value = 5;
    const limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 10;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(audio.destination);
  }
  if (audio.state === 'suspended') {
    audio
      .resume()
      .then(updateSoundButton)
      .catch(() => {});
  }
  return audio;
}

function updateSoundButton() {
  if (!soundOn) {
    soundBtn.textContent = 'Sound off';
    soundBtn.setAttribute('aria-pressed', 'false');
    return;
  }
  soundBtn.setAttribute('aria-pressed', 'true');
  soundBtn.textContent = audio?.state === 'running' ? 'Sound on' : 'Enable sound';
}

function blip(ctx, freq, at, duration, gainValue) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainValue, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(master || ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function newOrderChime() {
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime + 0.02;
  blip(ctx, 1046.5, now, 0.18, 0.22);
  blip(ctx, 1318.5, now + 0.16, 0.45, 0.2);
  blip(ctx, 523.25, now, 0.3, 0.16);
}

function checkNewItems(items) {
  const ids = new Set(items.map((item) => item.id));
  if (knownIds) {
    for (const id of ids) {
      if (!knownIds.has(id)) {
        newOrderChime();
        break;
      }
    }
  }
  knownIds = ids;
}

soundBtn.addEventListener('click', () => {
  if (!audio || audio.state !== 'running') {
    soundOn = true;
    ensureAudio();
  } else {
    soundOn = !soundOn;
    if (soundOn) audio.resume().then(updateSoundButton).catch(() => {});
    else audio.suspend();
  }
  updateSoundButton();
});

document.addEventListener(
  'pointerdown',
  (event) => {
    if (soundOn && event.target !== soundBtn) ensureAudio();
    updateSoundButton();
  },
  { capture: true },
);

document.addEventListener('keydown', (event) => {
  if (soundOn && event.target !== soundBtn) ensureAudio();
  updateSoundButton();
});

updateSoundButton();

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
    checkNewItems(items);
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
