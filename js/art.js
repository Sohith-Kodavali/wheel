const CONFIG = {
  'shake-oreo': {
    kind: 'shake',
    label: 'Oreo milkshake',
    liquid: ['#A06A4E', '#4E2C1D'],
    surface: '#BE8A6A',
    cream: ['#FFFEF9', '#FFE6C2'],
    accent: '#2B1710',
    topping: 'oreo',
  },
  'shake-kitkat': {
    kind: 'shake',
    label: 'KitKat milkshake',
    liquid: ['#A96F42', '#4A2814'],
    surface: '#C08A5C',
    cream: ['#FFFCF4', '#FFE2B3'],
    accent: '#5A2E12',
    topping: 'kitkat',
  },
  'shake-dark': {
    kind: 'shake',
    label: 'Dark fantasy milkshake',
    liquid: ['#6B3D2A', '#25120C'],
    surface: '#8C563D',
    cream: ['#FFF9F0', '#F3D9B8'],
    accent: '#180B06',
    topping: 'dark',
  },
  'mojito-mint': {
    kind: 'mojito',
    label: 'Cuban mint mojito',
    liquid: ['#63E3C6', '#1C9F86'],
    surface: '#9BF3DE',
    accent: '#0E7C69',
    fruit: 'lime',
  },
  'mojito-lime': {
    kind: 'mojito',
    label: 'Lime mojito',
    liquid: ['#D8F582', '#8FC63F'],
    surface: '#EEFFB8',
    accent: '#5B8C1D',
    fruit: 'lime',
  },
  'mojito-blue': {
    kind: 'mojito',
    label: 'Blue mojito',
    liquid: ['#8CDFFF', '#3597E8'],
    surface: '#C4F0FF',
    accent: '#1567A8',
    fruit: 'lemon',
  },
  coffee: {
    kind: 'coffee',
    label: 'Cold coffee',
    liquid: ['#8A5A3C', '#3D2417'],
    surface: '#B58A68',
    cream: ['#FFF9F0', '#F6E1C4'],
    accent: '#3A2114',
  },
};

function uid(key, suffix) {
  return `${key.replace(/[^a-z0-9]/g, '')}-${suffix}`;
}

function shakeSvg(key, cfg) {
  const liq = uid(key, 'liq');
  const cream = uid(key, 'cream');
  const surface = cfg.surface;

  const toppings = {
    oreo: `
      <g transform="translate(152 100) rotate(14)">
        <circle r="15" fill="#2E1B14"/>
        <circle r="9" fill="#FFF3DF"/>
        <circle cx="-3" cy="-3" r="2.4" fill="#2E1B14"/>
        <circle cx="4" cy="2" r="2.4" fill="#2E1B14"/>
        <circle cx="-4" cy="5" r="2" fill="#2E1B14"/>
      </g>
      <g fill="#2E1B14" opacity=".9">
        <circle cx="88" cy="130" r="3.2"/>
        <circle cx="97" cy="120" r="2.2"/>
        <circle cx="106" cy="134" r="2.6"/>
        <circle cx="146" cy="126" r="2.4"/>
      </g>
      <g transform="translate(88 102) rotate(-18)">
        <rect x="-11" y="-9" width="22" height="18" rx="5" fill="#3A241A"/>
        <rect x="-8" y="-6" width="16" height="7" rx="3" fill="#EADCC8" opacity=".85"/>
      </g>`,
    kitkat: `
      <g transform="translate(148 98) rotate(16)">
        <rect x="-26" y="-12" width="52" height="24" rx="6" fill="#D79A45"/>
        <rect x="-26" y="-12" width="52" height="24" rx="6" fill="none" stroke="#B4762C" stroke-width="2"/>
        <g stroke="#B4762C" stroke-width="2">
          <line x1="-13" y1="-12" x2="-13" y2="12"/>
          <line x1="0" y1="-12" x2="0" y2="12"/>
          <line x1="13" y1="-12" x2="13" y2="12"/>
        </g>
        <rect x="-22" y="-8" width="44" height="4" rx="2" fill="#F7CE8B" opacity=".8"/>
      </g>
      <g fill="#7A4A22">
        <circle cx="92" cy="120" r="2.4"/>
        <circle cx="101" cy="132" r="3"/>
        <circle cx="150" cy="128" r="2.4"/>
      </g>`,
    dark: `
      <g transform="translate(152 100) rotate(18)">
        <path d="M-4 -20 L26 -12 L18 22 L-10 12 Z" fill="#2A1510"/>
        <path d="M0 -13 L18 -9 L13 12 L-3 8 Z" fill="#4A2A1E"/>
      </g>
      <g transform="translate(90 104) rotate(-20)">
        <path d="M-3 -16 L20 -9 L14 17 L-8 10 Z" fill="#2A1510"/>
      </g>
      <g fill="#3A2118" opacity=".75">
        <circle cx="112" cy="118" r="2.2"/>
        <circle cx="120" cy="108" r="1.8"/>
        <circle cx="130" cy="122" r="2.2"/>
        <circle cx="140" cy="112" r="1.6"/>
      </g>`,
  };

  return `
<svg viewBox="0 0 240 280" role="img" aria-label="${cfg.label}" class="drink-svg">
  <defs>
    <linearGradient id="${liq}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cfg.liquid[0]}"/>
      <stop offset="1" stop-color="${cfg.liquid[1]}"/>
    </linearGradient>
    <linearGradient id="${cream}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cfg.cream[0]}"/>
      <stop offset="1" stop-color="${cfg.cream[1]}"/>
    </linearGradient>
  </defs>

  <ellipse cx="120" cy="260" rx="68" ry="12" fill="#5A3140" opacity=".13"/>

  <g transform="rotate(-15 128 110)">
    <rect x="120" y="26" width="22" height="126" rx="11" fill="#FF6E9E"/>
    <g fill="#FFE4EE" opacity=".9">
      <rect x="120" y="46" width="22" height="10"/>
      <rect x="120" y="74" width="22" height="10"/>
      <rect x="120" y="102" width="22" height="10"/>
      <rect x="120" y="130" width="22" height="10"/>
    </g>
  </g>

  <path d="M70 84 L86 238 Q89 254 120 254 Q151 254 154 238 L170 84 Z" fill="#FFFDF8" opacity=".55" stroke="#C79E88" stroke-opacity=".3" stroke-width="2"/>

  <path d="M79 132 L89 232 Q92 243 120 243 Q148 243 151 232 L161 132 Z" fill="url(#${liq})"/>
  <ellipse cx="120" cy="132" rx="41" ry="8" fill="${surface}"/>
  <path d="M91 152 L99 228" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" opacity=".16"/>

  <g fill="url(#${cream})" stroke="#E7C9A9" stroke-width="1.6">
    <circle cx="99" cy="112" r="23"/>
    <circle cx="129" cy="103" r="26"/>
    <circle cx="155" cy="118" r="19"/>
    <circle cx="119" cy="125" r="28"/>
    <rect x="84" y="118" width="72" height="20" rx="10"/>
  </g>
  <path d="M88 129 q14 11 28 1 t30 3 t16 -3" fill="none" stroke="#E2C19C" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
  <path d="M102 106 q7 -7 15 -1" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".8"/>

  <path d="M90 120 q10 14 22 2 t24 5 t20 -3" fill="none" stroke="${cfg.accent}" stroke-width="5.5" stroke-linecap="round" opacity=".95"/>
  <path d="M112 128 q4 10 -1 15" fill="none" stroke="${cfg.accent}" stroke-width="4.5" stroke-linecap="round" opacity=".9"/>
  <path d="M92 142 L152 142" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".22"/>

  ${toppings[cfg.topping] || ''}

  <path d="M70 84 L86 238 Q89 254 120 254 Q151 254 154 238 L170 84" fill="none" stroke="#D9B7A3" stroke-width="4" opacity=".75"/>
  <path d="M74 92 L88 234 Q91 247 120 247 Q149 247 152 234 L166 92" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".65"/>
  <ellipse cx="120" cy="84" rx="50" ry="8" fill="#FFFDF8" opacity=".85"/>
  <path d="M85 102 L96 230" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity=".4"/>
</svg>`;
}

function mojitoSvg(key, cfg) {
  const liq = uid(key, 'liq');

  return `
<svg viewBox="0 0 240 280" role="img" aria-label="${cfg.label}" class="drink-svg">
  <defs>
    <linearGradient id="${liq}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cfg.liquid[0]}"/>
      <stop offset="1" stop-color="${cfg.liquid[1]}"/>
    </linearGradient>
  </defs>

  <ellipse cx="120" cy="260" rx="62" ry="11" fill="#2F6A67" opacity=".14"/>

  <g transform="rotate(12 150 120)">
    <rect x="146" y="40" width="18" height="128" rx="9" fill="#FFFFFF" opacity=".9"/>
    <g fill="${cfg.accent}" opacity=".55">
      <rect x="146" y="58" width="18" height="10"/>
      <rect x="146" y="86" width="18" height="10"/>
      <rect x="146" y="114" width="18" height="10"/>
    </g>
  </g>

  <path d="M76 68 L88 238 Q90 252 120 252 Q150 252 152 238 L164 68 Z" fill="#FFFFFF" opacity=".5"/>

  <path d="M83 104 L91 232 Q93 242 120 242 Q147 242 149 232 L157 104 Z" fill="url(#${liq})"/>
  <ellipse cx="120" cy="104" rx="37" ry="7" fill="${cfg.surface}" opacity=".95"/>

  <g fill="#FFFFFF" opacity=".38" stroke="#FFFFFF" stroke-width="2" stroke-opacity=".55">
    <rect x="94" y="150" width="34" height="34" rx="8" transform="rotate(-14 111 167)"/>
    <rect x="126" y="120" width="28" height="28" rx="7" transform="rotate(18 140 134)"/>
    <rect x="103" y="188" width="30" height="30" rx="8" transform="rotate(8 118 203)"/>
  </g>

  <g transform="translate(148 132)">
    <circle r="19" fill="#E9F7A6" stroke="#FFFFFF" stroke-width="3"/>
    <circle r="14" fill="none" stroke="#B6D867" stroke-width="2"/>
    <g stroke="#B6D867" stroke-width="2">
      <line x1="0" y1="-14" x2="0" y2="14"/>
      <line x1="-14" y1="0" x2="14" y2="0"/>
      <line x1="-10" y1="-10" x2="10" y2="10"/>
      <line x1="-10" y1="10" x2="10" y2="-10"/>
    </g>
  </g>

  <g fill="#3FA968">
    <path d="M100 94 C86 84 84 68 96 56 C108 68 110 84 100 94Z"/>
    <path d="M104 96 C116 86 132 88 138 100 C126 112 110 110 104 96Z" fill="#57C57F"/>
    <path d="M92 100 C80 96 72 88 72 78 C84 78 94 86 92 100Z" fill="#2F8E55"/>
  </g>

  <g fill="#FFFFFF" opacity=".8">
    <circle cx="102" cy="146" r="2.6"/>
    <circle cx="134" cy="168" r="2"/>
    <circle cx="112" cy="178" r="1.8"/>
    <circle cx="128" cy="206" r="2.4"/>
    <circle cx="100" cy="214" r="1.6"/>
  </g>

  <path d="M76 68 L88 238 Q90 252 120 252 Q150 252 152 238 L164 68" fill="none" stroke="#CFE9E4" stroke-width="4" opacity=".8"/>
  <path d="M79 76 L90 234 Q92 246 120 246 Q148 246 150 234 L161 76" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".7"/>
  <ellipse cx="120" cy="68" rx="44" ry="8" fill="#FFFFFF" opacity=".8"/>
  <path d="M88 84 L97 230" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".45"/>

  <g fill="#FFFFFF" opacity=".55">
    <circle cx="156" cy="180" r="2.5"/>
    <circle cx="160" cy="196" r="1.8"/>
  </g>
</svg>`;
}

function coffeeSvg(key, cfg) {
  const liq = uid(key, 'liq');
  const cream = uid(key, 'cream');

  return `
<svg viewBox="0 0 240 280" role="img" aria-label="${cfg.label}" class="drink-svg">
  <defs>
    <linearGradient id="${liq}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cfg.liquid[0]}"/>
      <stop offset="1" stop-color="${cfg.liquid[1]}"/>
    </linearGradient>
    <linearGradient id="${cream}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cfg.cream[0]}"/>
      <stop offset="1" stop-color="${cfg.cream[1]}"/>
    </linearGradient>
  </defs>

  <ellipse cx="120" cy="260" rx="64" ry="11" fill="#4A2A1E" opacity=".14"/>

  <g transform="rotate(-12 140 110)">
    <rect x="142" y="30" width="20" height="120" rx="10" fill="#F4B942"/>
    <g fill="#FFF3D2" opacity=".85">
      <rect x="142" y="52" width="20" height="10"/>
      <rect x="142" y="82" width="20" height="10"/>
      <rect x="142" y="112" width="20" height="10"/>
    </g>
  </g>

  <path d="M74 72 L87 238 Q90 252 120 252 Q150 252 153 238 L166 72 Z" fill="#FFFFFF" opacity=".5"/>

  <path d="M82 118 L91 232 Q93 242 120 242 Q147 242 149 232 L158 118 Z" fill="url(#${liq})"/>
  <path d="M88 160 C104 150 126 168 152 154 L148 210 Q140 232 120 232 Q100 232 92 210 Z" fill="#E8CDB0" opacity=".35"/>
  <ellipse cx="120" cy="118" rx="38" ry="7" fill="${cfg.surface}"/>

  <g fill="#FFFFFF" opacity=".4" stroke="#FFFFFF" stroke-width="2" stroke-opacity=".6">
    <rect x="98" y="132" width="30" height="30" rx="7" transform="rotate(10 113 147)"/>
    <rect x="126" y="176" width="26" height="26" rx="6" transform="rotate(-16 139 189)"/>
  </g>

  <g fill="url(#${cream})" stroke="#EFD6B9" stroke-width="1.4">
    <circle cx="100" cy="108" r="21"/>
    <circle cx="130" cy="100" r="24"/>
    <circle cx="152" cy="114" r="18"/>
    <circle cx="119" cy="118" r="25"/>
    <rect x="86" y="112" width="66" height="18" rx="9"/>
  </g>

  <path d="M96 108 q10 12 20 2 t22 4 t16 -2" fill="none" stroke="#7A4A2E" stroke-width="4" stroke-linecap="round" opacity=".75"/>

  <g fill="#4A2A1E" opacity=".75">
    <circle cx="104" cy="96" r="2"/>
    <circle cx="119" cy="88" r="1.6"/>
    <circle cx="136" cy="94" r="2.2"/>
    <circle cx="146" cy="104" r="1.6"/>
    <circle cx="112" cy="105" r="1.5"/>
  </g>

  <g transform="translate(166 196)">
    <ellipse rx="10" ry="13" fill="#3A2114" transform="rotate(-20)"/>
    <path d="M-6 0 q6 -8 12 0" fill="none" stroke="#C89B6C" stroke-width="2"/>
  </g>

  <path d="M74 72 L87 238 Q90 252 120 252 Q150 252 153 238 L166 72" fill="none" stroke="#DCC3AE" stroke-width="4" opacity=".8"/>
  <path d="M77 80 L89 234 Q92 246 120 246 Q148 246 151 234 L163 80" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".6"/>
  <ellipse cx="120" cy="72" rx="46" ry="8" fill="#FFFFFF" opacity=".8"/>
  <path d="M86 90 L96 230" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".42"/>
</svg>`;
}

export function drinkArt(key) {
  const cfg = CONFIG[key];
  if (!cfg) return '';
  if (cfg.kind === 'shake') return shakeSvg(key, cfg);
  if (cfg.kind === 'mojito') return mojitoSvg(key, cfg);
  return coffeeSvg(key, cfg);
}

export const ART_KEYS = Object.keys(CONFIG);

export function productArt(product, extraClass = '') {
  const image = product?.image || '';
  if (image.startsWith('art:')) {
    return `<div class="art ${extraClass}" aria-hidden="true">${drinkArt(image.slice(4))}</div>`;
  }
  if (image) {
    return `<div class="art ${extraClass}"><img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}" loading="lazy"></div>`;
  }
  return `<div class="art ${extraClass}" aria-hidden="true">${drinkArt('shake-dark')}</div>`;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const DECOR = {
  strawberry: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <path d="M32 17C20 17 11 25 11 35c0 12 12 21 21 24 9-3 21-12 21-24 0-10-9-18-21-18Z" fill="#FF5577"/>
  <path d="M20 32c2-7 8-10 12-10" fill="none" stroke="#FF90A6" stroke-width="4" stroke-linecap="round"/>
  <g fill="#FFE6EC">
    <ellipse cx="24" cy="34" rx="1.8" ry="2.6" transform="rotate(-20 24 34)"/>
    <ellipse cx="33" cy="30" rx="1.8" ry="2.6" transform="rotate(-20 33 30)"/>
    <ellipse cx="42" cy="35" rx="1.8" ry="2.6" transform="rotate(20 42 35)"/>
    <ellipse cx="28" cy="44" rx="1.8" ry="2.6"/>
    <ellipse cx="38" cy="46" rx="1.8" ry="2.6"/>
    <ellipse cx="33" cy="52" rx="1.8" ry="2.6"/>
  </g>
  <path d="M32 19 24 9l7 2 1-7 4 6 6-5-2 8 8 1-9 6Z" fill="#5FBF6B"/>
  <path d="M32 16c0-5 2-8 5-10" fill="none" stroke="#3E8E4C" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  cookie: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <circle cx="32" cy="32" r="24" fill="#D79B62"/>
  <circle cx="32" cy="32" r="24" fill="none" stroke="#B87B43" stroke-width="3"/>
  <g fill="#5A3729">
    <circle cx="23" cy="24" r="4"/>
    <circle cx="38" cy="20" r="3.2"/>
    <circle cx="44" cy="34" r="4"/>
    <circle cx="30" cy="38" r="3.6"/>
    <circle cx="19" cy="40" r="2.6"/>
    <circle cx="34" cy="48" r="2.8"/>
  </g>
</svg>`,
  mint: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <path d="M32 56C20 46 18 28 30 12c12 12 16 32 2 44Z" fill="#4FBF7E"/>
  <path d="M32 52C30 40 30 26 32 16" fill="none" stroke="#2F8E55" stroke-width="3" stroke-linecap="round"/>
  <path d="M16 48c-6-8-4-20 6-26 4 12 2 22-6 26Z" fill="#6BD394"/>
  <path d="M48 48c8-6 8-18 0-26-6 10-6 20 0 26Z" fill="#3FAF6F"/>
</svg>`,
  ice: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <rect x="12" y="12" width="40" height="40" rx="10" fill="#BEEBFF" stroke="#FFFFFF" stroke-width="3"/>
  <rect x="19" y="19" width="20" height="20" rx="5" fill="#FFFFFF" opacity=".55"/>
  <path d="M40 16 24 48" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".7"/>
</svg>`,
  choco: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <rect x="12" y="12" width="40" height="40" rx="7" fill="#6B4230"/>
  <rect x="16" y="16" width="32" height="32" rx="4" fill="#8A5A3F"/>
  <g stroke="#5A3526" stroke-width="2.5">
    <line x1="27" y1="16" x2="27" y2="48"/>
    <line x1="38" y1="16" x2="38" y2="48"/>
    <line x1="16" y1="27" x2="48" y2="27"/>
    <line x1="16" y1="38" x2="48" y2="38"/>
  </g>
</svg>`,
  sparkle: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <path d="M32 6c3 15 11 23 26 26-15 3-23 11-26 26-3-15-11-23-26-26C21 29 29 21 32 6Z" fill="#FFC24B"/>
</svg>`,
  splash: `
<svg viewBox="0 0 120 120" class="deco-svg" aria-hidden="true">
  <path d="M14 66c8-18 26-30 44-28 10 1 14 6 24 4 14-3 24 6 22 18-2 15-18 26-36 28-20 2-40-4-48-14-4-4-8-5-6-8Z" fill="#FFFFFF" opacity=".9"/>
  <circle cx="26" cy="34" r="7" fill="#FFFFFF" opacity=".85"/>
  <circle cx="46" cy="20" r="4.5" fill="#FFFFFF" opacity=".75"/>
  <circle cx="96" cy="30" r="5" fill="#FFFFFF" opacity=".8"/>
  <circle cx="104" cy="48" r="3" fill="#FFFFFF" opacity=".7"/>
</svg>`,
  cherry: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <path d="M33 20c-2-7 0-12 6-15" fill="none" stroke="#4E8A44" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="26" cy="38" r="13" fill="#E8314F"/>
  <circle cx="42" cy="44" r="10" fill="#C61E3C"/>
  <path d="M34 22c4 6 6 10 8 14" fill="none" stroke="#4E8A44" stroke-width="3" stroke-linecap="round"/>
  <circle cx="21" cy="33" r="3" fill="#FF8FA0" opacity=".8"/>
</svg>`,
  star: `
<svg viewBox="0 0 64 64" class="deco-svg" aria-hidden="true">
  <path d="M32 8l6.5 16L56 26l-13 11 4 18-15-9-15 9 4-18L8 26l17.5-2Z" fill="#FFD15C"/>
</svg>`,
};

export function deco(name, className = '') {
  const svg = DECOR[name] || '';
  if (!svg) return '';
  return svg.replace('class="deco-svg"', `class="deco-svg ${className}"`);
}

export function logoMark() {
  return `
<svg viewBox="0 0 48 48" class="logo-svg" aria-hidden="true">
  <rect x="1.5" y="1.5" width="45" height="45" rx="14" fill="#FFFFFF" opacity=".25"/>
  <path d="M15 12h18l-2 24a5 5 0 0 1-5 4.5h-4A5 5 0 0 1 17 36Z" fill="#FFF6EA"/>
  <path d="M16.4 21h15.2l-1.4 15a3.5 3.5 0 0 1-3.5 3.2h-5.4a3.5 3.5 0 0 1-3.5-3.2Z" fill="#6B4230"/>
  <path d="M17 18c1.5-3 4-4.5 7-4.5S29.5 15 31 18Z" fill="#FFD9E6"/>
  <circle cx="21" cy="15.5" r="3.6" fill="#FFF6EA"/>
  <circle cx="27" cy="14" r="3.2" fill="#FFF6EA"/>
  <circle cx="24" cy="17.5" r="3.4" fill="#FFF6EA"/>
  <rect x="27" y="4" width="3.6" height="16" rx="1.8" fill="#FFC24B" transform="rotate(14 28.8 12)"/>
  <circle cx="22" cy="27" r="1.4" fill="#FFF6EA"/>
  <circle cx="28" cy="31" r="1.2" fill="#FFF6EA"/>
</svg>`;
}
