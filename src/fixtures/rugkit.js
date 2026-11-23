import * as THREE from 'three';

/** Shared rug look-book: colours, fabric textures (with pile height) and printed designs. Used by the kitchen and bathroom rugs. */
export const RUG_COLORS = [['White', '#f6f5f1'], ['Cream', '#efe6d2'], ['Light grey', '#cfd1d3'], ['Sage', '#b7cdb9'], ['Sky blue', '#b8d4e8'], ['Blush pink', '#efcdd0'], ['Navy', '#3d4a6a'], ['Charcoal', '#4d4f53'], ['Terracotta', '#c9795a'], ['Mustard', '#d8b24a']];
export const RUG_TEXTURES = [
  { name: 'Plush shag', h: 0.032 }, { name: 'Terry towel loops', h: 0.02 }, { name: 'Waffle weave', h: 0.014 },
  { name: 'Chenille ridges', h: 0.02 }, { name: 'Flat cotton', h: 0.008 }, { name: 'Long fur', h: 0.04 },
];
export const RUG_DESIGNS = ['Solid', 'Stripes', 'Border frame', 'Diamonds', 'Checkerboard', 'Trellis', 'Polka dots', 'Chevron'];

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const cache = new Map();
export function rugTexture(color, kind, design = 0) {
  const key = `${color}|${kind}|${design}`; if (cache.has(key)) return cache.get(key);
  const base = new THREE.Color(color), lite = '#' + base.clone().lerp(new THREE.Color(1, 1, 1), 0.55).getHexString(), dark = '#' + base.clone().multiplyScalar(0.72).getHexString();
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, S, S); seed = 11 + kind * 7;
  // printed design first, pile on top so it still looks fibrous
  g.fillStyle = dark; g.strokeStyle = dark;
  if (design === 1) for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 32, S);
  if (design === 2) { g.lineWidth = 26; g.strokeRect(36, 36, S - 72, S - 72); g.lineWidth = 6; g.strokeRect(84, 84, S - 168, S - 168); }
  if (design === 3) for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.beginPath(); g.moveTo(x + 32, y + 6); g.lineTo(x + 58, y + 32); g.lineTo(x + 32, y + 58); g.lineTo(x + 6, y + 32); g.closePath(); g.fill(); }
  if (design === 4) for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) if (((x + y) / 64) % 2 === 0) g.fillRect(x, y, 64, 64);
  if (design === 5) { g.lineWidth = 7; for (let i = -S; i < S * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.moveTo(i + S, 0); g.lineTo(i, S); g.stroke(); } }
  if (design === 6) for (let y = 32; y < S; y += 64) for (let x = (y / 64) % 2 ? 32 : 64; x < S + 32; x += 64) { g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); }
  if (design === 7) { g.lineWidth = 12; for (let y = 0; y < S; y += 64) { g.beginPath(); for (let x = 0; x <= S; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 30 : 0)); g.stroke(); } }
  if (kind === 0 || kind === 5) {                       // shag / fur: many short soft strands
    const n = kind === 0 ? 9000 : 6500, len = kind === 0 ? 9 : 18;
    for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28; g.strokeStyle = rnd() < 0.5 ? lite : dark; g.globalAlpha = 0.22 + rnd() * 0.3; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
  } else if (kind === 1) {                              // terry loops
    for (let y = 4; y < S; y += 9) for (let x = (y / 9) % 2 ? 4 : 8; x < S; x += 9) { g.globalAlpha = 0.5; g.strokeStyle = dark; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.stroke(); g.strokeStyle = lite; g.beginPath(); g.arc(x - 0.8, y - 0.8, 2.4, 3.6, 5.6); g.stroke(); }
  } else if (kind === 2) {                              // waffle
    g.globalAlpha = 0.55;
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) { const gr = g.createLinearGradient(x, y, x + 32, y + 32); gr.addColorStop(0, lite); gr.addColorStop(1, dark); g.fillStyle = gr; g.fillRect(x + 3, y + 3, 26, 26); }
  } else if (kind === 3) {                              // chenille ridges
    g.globalAlpha = 0.6;
    for (let y = 0; y < S; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, lite); gr.addColorStop(0.55, color); gr.addColorStop(1, dark); g.fillStyle = gr; g.fillRect(0, y, S, 14); }
  } else {                                              // flat cotton weave
    g.globalAlpha = 0.22; g.strokeStyle = dark; g.lineWidth = 1; for (let i = 0; i < S; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache.set(key, t); return t;
}
