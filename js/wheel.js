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

function shadeColor(hex, amount) {
  const value = String(hex || '#FF7FB0').replace('#', '');
  const number = parseInt(value, 16);
  const target = amount < 0 ? 0 : 255;
  const ratio = Math.abs(amount);
  const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255].map((channel) =>
    Math.round((target - channel) * ratio + channel),
  );
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function segmentAngles(segments) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0.001, Number(segment.weight) || 1), 0);
  let cursor = 0;
  return segments.map((segment, index) => {
    const span = TAU * (Math.max(0.001, Number(segment.weight) || 1) / total);
    const start = cursor;
    cursor += span;
    return { start, span, mid: start + span / 2, index };
  });
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
  const arcs = segmentAngles(segments);
  const fontBase = compact ? size * 0.075 : Math.max(11, Math.min(20, size * 0.042));

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, outer, 0, TAU);
  ctx.fillStyle = '#FFF3E0';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFD3E2';
  ctx.stroke();

  arcs.forEach((arc, index) => {
    const segment = segments[index];
    const baseColor = segment.color || PALETTE[index % PALETTE.length];
    const gradient = ctx.createRadialGradient(c, c, segRadius * 0.06, c, c, segRadius);
    gradient.addColorStop(0, shadeColor(baseColor, 0.16));
    gradient.addColorStop(0.68, baseColor);
    gradient.addColorStop(1, shadeColor(baseColor, -0.14));

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, segRadius, arc.start, arc.start + arc.span);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 250, 236, 0.8)';
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

  const bulbCount = Math.max(18, segments.length * 4);
  const bulbRadius = outer - (compact ? 6 : 18);
  ctx.save();
  ctx.shadowColor = '#FFDE9B';
  ctx.shadowBlur = compact ? 0 : 9;
  for (let i = 0; i < bulbCount; i += 1) {
    const a = (i / bulbCount) * TAU;
    const x = c + Math.cos(a) * bulbRadius;
    const y = c + Math.sin(a) * bulbRadius;
    ctx.beginPath();
    ctx.arc(x, y, compact ? 2 : 4.6, 0, TAU);
    ctx.fillStyle = i % 2 === 0 ? '#FFFDF5' : '#FFC24B';
    ctx.fill();
  }
  ctx.restore();

  const hub = size * (compact ? 0.14 : 0.13);
  const labelRadius = (hub + segRadius) / 2;

  arcs.forEach((arc, index) => {
    const segment = segments[index];
    const flip = Math.cos(arc.mid) < 0;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(flip ? arc.mid + Math.PI : arc.mid);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(30, 10, 20, 0.25)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = textColorFor(segment.color);
    ctx.font = `800 ${fontBase}px "Baloo 2", "Nunito", system-ui, sans-serif`;
    ctx.fillText(
      truncateLabel(segment.label, compact ? 9 : 15),
      flip ? -labelRadius : labelRadius,
      0,
    );
    ctx.restore();
  });

  const gloss = ctx.createRadialGradient(
    size * 0.32,
    size * 0.22,
    size * 0.02,
    size * 0.32,
    size * 0.22,
    segRadius * 1.08,
  );
  gloss.addColorStop(0, 'rgba(255,255,255,.4)');
  gloss.addColorStop(0.4, 'rgba(255,255,255,.08)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, segRadius, 0, TAU);
  ctx.clip();
  ctx.fillStyle = gloss;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(c, c, segRadius - 5, 0, TAU);
  ctx.lineWidth = compact ? 2 : 3;
  ctx.strokeStyle = 'rgba(232, 188, 102, 0.8)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c, c, hub, 0, TAU);
  ctx.fillStyle = '#FFF6EA';
  ctx.fill();
  ctx.lineWidth = compact ? 3 : 5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, hub + (compact ? 3 : 7), 0, TAU);
  ctx.lineWidth = compact ? 2 : 3;
  ctx.strokeStyle = 'rgba(232, 188, 102, 0.9)';
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
    if (!this.ctx) {
      this.ctx = new AudioCtor();
      // Master boost with a limiter so everything can be loud without harsh clipping.
      this.master = this.ctx.createGain();
      this.master.gain.value = 2.8;
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -18;
      this.limiter.knee.value = 18;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.25;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  blip(freq, duration = 0.05, type = 'square', gainValue = 0.105, delay = 0) {
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
    osc.connect(gain).connect(this.master || ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  tick() {
    this.blip(1180 + Math.random() * 180, 0.04, 'square', 0.06);
  }

  spinStart() {
    for (let i = 0; i < 8; i += 1) {
      this.blip(170 + i * 65, 0.18, 'sawtooth', 0.055, i * 0.055);
    }
  }

  win(level = 1) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => this.blip(freq, 0.3, 'triangle', 0.24, i * 0.11));
    this.blip(1318.5, 0.55, 'sine', 0.16, 0.45);
    this.blip(78, 0.75, 'sine', 0.3, 0.02);

    if (level >= 2) {
      [1318.5, 1567.98, 2093].forEach((freq, i) =>
        this.blip(freq, 0.36, 'triangle', 0.2, 0.55 + i * 0.1),
      );
      this.blip(65, 0.9, 'sine', 0.32, 0.08);
    }
    if (level >= 3) {
      [1046.5, 1318.5, 1567.98, 2093].forEach((freq, i) =>
        this.blip(freq, 0.42, 'sine', 0.16, 0.9 + i * 0.08),
      );
    }
  }

  lose() {
    this.blip(392, 0.24, 'triangle', 0.18, 0);
    this.blip(294, 0.36, 'triangle', 0.15, 0.18);
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

  arcs() {
    return segmentAngles(this.segments);
  }

  pointerIndex(rotation = this.rotation) {
    const arcs = this.arcs();
    const angle = (((((270 - rotation) % 360) + 360) % 360) * Math.PI) / 180;
    for (let i = arcs.length - 1; i >= 0; i -= 1) {
      if (angle >= arcs[i].start) return i;
    }
    return 0;
  }

  snapToIndex(index) {
    const arc = this.arcs()[index];
    if (!arc) return;
    const centerDeg = (arc.mid * 180) / Math.PI;
    this.rotation = (((270 - centerDeg) % 360) + 360) % 360;
    this.applyRotation();
  }

  spinToIndex(index, { duration } = {}) {
    if (this.animating) return Promise.resolve();
    this.animating = true;
    this.sound.ensure();

    const arc = this.arcs()[index];
    if (!arc) {
      this.animating = false;
      return Promise.resolve();
    }
    const center = (arc.mid * 180) / Math.PI;
    const spanDeg = (arc.span * 180) / Math.PI;
    const jitter = (Math.random() - 0.5) * spanDeg * 0.5;
    const targetMod = (((270 - center - jitter) % 360) + 360) % 360;
    const currentMod = (((this.rotation % 360) + 360) % 360);
    const delta = (targetMod - currentMod + 360) % 360;
    const turns = this.reducedMotion ? 1 : 6 + Math.floor(Math.random() * 2);
    const travel = turns * 360 + delta;
    const start = this.rotation;
    const totalDuration = duration || (this.reducedMotion ? 1400 : 5600 + Math.random() * 500);
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

function drawStar(ctx, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** A radial explosion from the wheel. intensity: 1 = normal, 3 = jackpot. */
export function blast({ intensity = 1 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'blast-canvas';
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

  const stage = document.querySelector('#wheel-stage');
  const rect = stage?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : width / 2;
  const cy = rect ? rect.top + rect.height / 2 : height * 0.42;
  const extraOrigins =
    intensity >= 2
      ? [
          [width * 0.24, height * 0.3],
          [width * 0.78, height * 0.36],
        ]
      : [];
  const origins = [[cx, cy], ...extraOrigins];
  const perOrigin = intensity >= 3 ? 110 : intensity >= 2 ? 75 : 55;

  const particles = [];
  origins.forEach(([ox, oy], originIndex) => {
    const count = originIndex === 0 ? perOrigin : Math.round(perOrigin * 0.65);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const speed = (3 + Math.random() * 17) * (0.8 + intensity * 0.25);
      const gold = Math.random() < 0.38;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 5.5,
        color: gold ? (Math.random() < 0.5 ? '#FFD15C' : '#FFE9A8') : PALETTE[Math.floor(Math.random() * 6)],
        life: 0,
        ttl: 65 + Math.random() * 45,
        rotation: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 0.35,
        shape: gold ? 'coin' : Math.random() < 0.3 ? 'star' : 'spark',
      });
    }
  });

  const start = performance.now();
  const duration = 2700;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);

    const rings = intensity >= 2 ? 3 : 2;
    for (let r = 0; r < rings; r += 1) {
      const p = Math.min(1, elapsed / (620 + r * 180));
      if (p >= 1) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, 24 + p * Math.min(width, height) * (0.55 + r * 0.08), 0, TAU);
      ctx.strokeStyle = `rgba(255, 224, 150, ${(1 - p) * 0.7})`;
      ctx.lineWidth = 12 * (1 - p) + 2;
      ctx.stroke();
    }

    for (const particle of particles) {
      particle.life += 1;
      particle.vy += 0.18;
      particle.vx *= 0.985;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;
      const fade = Math.max(0, 1 - particle.life / particle.ttl);
      if (fade <= 0) continue;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      if (particle.shape === 'coin') {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 80, 0, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (particle.shape === 'star') {
        drawStar(ctx, particle.size * 1.4);
      } else {
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size * 2, particle.size * 0.6);
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
