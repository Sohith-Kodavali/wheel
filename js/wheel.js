const TAU = Math.PI * 2;
const PALETTE = ['#FF4F86', '#FFC24B', '#4FD1B0', '#8FD3FF', '#C7A6FF', '#FF8A5C', '#FFFFFF', '#FFD9E6'];

function textColorFor(hex) {
  const value = String(hex || '#FF7FB0').replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.62 ? '#3B2231' : '#FFFFFF';
}

function truncateLabel(label, max = 15) {
  const text = String(label ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function drawWheel(canvas, segments, { compact = false } = {}) {
  if (!canvas || !segments || segments.length < 2) return;
  const parent = canvas.parentElement;
  const size = Math.max(200, Math.round(parent?.clientWidth || canvas.clientWidth || 480));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const c = size / 2;
  const outer = c - 6;
  const segRadius = outer - (compact ? 12 : 30);
  const angle = TAU / segments.length;
  const fontBase = compact ? size * 0.075 : Math.max(11, Math.min(20, size * 0.042));

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, outer, 0, TAU);
  ctx.fillStyle = '#FFF3E0';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFD3E2';
  ctx.stroke();

  segments.forEach((segment, index) => {
    const start = index * angle;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, segRadius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = segment.color || PALETTE[index % PALETTE.length];
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.arc(c, c, segRadius, 0, TAU);
  ctx.lineWidth = compact ? 8 : 12;
  ctx.strokeStyle = '#FFF9EF';
  ctx.stroke();
  ctx.lineWidth = compact ? 2 : 3;
  ctx.strokeStyle = '#FFCFE0';
  ctx.stroke();

  const bulbCount = Math.max(12, segments.length * 2);
  const bulbRadius = outer - (compact ? 6 : 18);
  for (let i = 0; i < bulbCount; i += 1) {
    const a = (i / bulbCount) * TAU;
    const x = c + Math.cos(a) * bulbRadius;
    const y = c + Math.sin(a) * bulbRadius;
    ctx.beginPath();
    ctx.arc(x, y, compact ? 2 : 4.4, 0, TAU);
    ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#FFC24B';
    ctx.fill();
  }

  segments.forEach((segment, index) => {
    const mid = index * angle + angle / 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColorFor(segment.color);
    ctx.font = `800 ${fontBase}px "Baloo 2", "Nunito", system-ui, sans-serif`;
    const pad = compact ? 12 : 34;
    ctx.fillText(truncateLabel(segment.label, compact ? 9 : 15), segRadius - pad, 0);
    ctx.restore();
  });

  const hub = size * (compact ? 0.14 : 0.13);
  ctx.beginPath();
  ctx.arc(c, c, hub, 0, TAU);
  ctx.fillStyle = '#FFF6EA';
  ctx.fill();
  ctx.lineWidth = compact ? 3 : 5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.restore();
}

export class WheelSound {
  constructor(muted = false) {
    this.muted = muted;
    this.ctx = null;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx && muted && this.ctx.state === 'running') this.ctx.suspend();
  }

  ensure() {
    if (this.muted) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!this.ctx) this.ctx = new AudioCtor();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  blip(freq, duration = 0.05, type = 'square', gainValue = 0.035, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  tick() {
    this.blip(1180 + Math.random() * 180, 0.035, 'square', 0.02);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => this.blip(freq, 0.28, 'triangle', 0.08, i * 0.12));
    this.blip(1318.5, 0.5, 'sine', 0.05, 0.5);
  }

  lose() {
    this.blip(392, 0.24, 'triangle', 0.06, 0);
    this.blip(294, 0.36, 'triangle', 0.05, 0.18);
  }
}

export class PrizeWheel {
  constructor(stage, segments, { muted = false } = {}) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    this.rotor = stage.querySelector('[data-rotor]');
    this.pointer = stage.querySelector('[data-pointer]');
    this.segments = segments;
    this.rotation = 0;
    this.sound = new WheelSound(muted);
    this.lastTickIndex = -1;
    this.animating = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.redraw();
    this.resizeObserver = new ResizeObserver(() => this.redraw());
    this.resizeObserver.observe(stage);
  }

  redraw() {
    drawWheel(this.canvas, this.segments);
    this.applyRotation();
  }

  applyRotation() {
    if (this.rotor) this.rotor.style.transform = `rotate(${this.rotation}deg)`;
  }

  reset() {
    this.rotation = 0;
    this.lastTickIndex = -1;
    this.applyRotation();
  }

  setMuted(muted) {
    this.sound.setMuted(muted);
  }

  pointerIndex(rotation = this.rotation) {
    const seg = 360 / this.segments.length;
    const angle = (((270 - rotation) % 360) + 360) % 360;
    return Math.min(this.segments.length - 1, Math.floor(angle / seg));
  }

  snapToIndex(index) {
    const seg = 360 / this.segments.length;
    const center = index * seg + seg / 2;
    this.rotation = ((270 - center) % 360 + 360) % 360;
    this.applyRotation();
  }

  spinToIndex(index, { duration } = {}) {
    if (this.animating) return Promise.resolve();
    this.animating = true;
    this.sound.ensure();

    const seg = 360 / this.segments.length;
    const center = index * seg + seg / 2;
    const jitter = (Math.random() - 0.5) * seg * 0.42;
    const targetMod = ((270 - center - jitter) % 360 + 360) % 360;
    const currentMod = ((this.rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const turns = this.reducedMotion ? 1 : 6 + Math.floor(Math.random() * 2);
    const travel = turns * 360 + delta;
    const start = this.rotation;
    const totalDuration = duration || (this.reducedMotion ? 1400 : 5400 + Math.random() * 500);
    const startTime = performance.now();

    return new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - startTime) / totalDuration);
        const eased = 1 - Math.pow(1 - t, 4);
        this.rotation = start + travel * eased;
        this.applyRotation();

        const idx = this.pointerIndex();
        if (idx !== this.lastTickIndex) {
          this.lastTickIndex = idx;
          if (this.pointer) {
            this.pointer.classList.remove('is-ticking');
            void this.pointer.offsetWidth;
            this.pointer.classList.add('is-ticking');
          }
          if (t < 0.985) this.sound.tick();
        }

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          this.rotation = start + travel;
          this.applyRotation();
          this.animating = false;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  destroy() {
    this.resizeObserver?.disconnect();
  }
}

export function celebrate({ count = 140, spread = 1 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const originX = width / 2;
  const originY = height * 0.38;
  const particles = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6 * spread;
    const speed = 9 + Math.random() * 13;
    return {
      x: originX + (Math.random() - 0.5) * 40,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 6 + Math.random() * 8,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      life: 0,
    };
  });

  const start = performance.now();
  const duration = 3600;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    const fade = Math.max(0, 1 - Math.max(0, elapsed - 2200) / 1400);
    ctx.globalAlpha = fade;
    for (const p of particles) {
      p.vy += 0.32;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}
