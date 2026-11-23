import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Everything stored in the refrigerator, all procedural: Coca-Cola and Pepsi cans and bottles, eggs, milk, juice, condiments, butter,
 * cheese, yogurt, leftovers, raw chicken and pork on foam trays under cling film, a frozen chicken, peas, ice cream, and the vegetables
 * (cabbage, lettuce, tomatoes, carrots, cucumbers, peppers, onions, broccoli) in the two crisper drawers.
 * Positions are in the cabinet's local frame (door items in each door's own frame, which swings with the door).
 */
const SPH = new THREE.SphereGeometry(1, 22, 16), CYL = new THREE.CylinderGeometry(1, 1, 1, 24), BOX = new THREE.BoxGeometry(1, 1, 1);
const rb = (w, h, d, r = 0.006) => new RoundedBoxGeometry(w, h, d, 3, r);
const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function put(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rot) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (rot) m.rotation.set(...rot); m.receiveShadow = true; parent.add(m); return m;
}
const wrap = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, roughness: 0.05, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });

// ---------- label textures ----------
function cokeCan() {
  const [c, x] = cv(1024, 560); x.fillStyle = '#d3121a'; x.fillRect(0, 0, 1024, 560);
  const sh = x.createLinearGradient(0, 0, 1024, 0); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = sh; x.fillRect(0, 0, 1024, 560);
  x.fillStyle = '#fff'; x.fillRect(0, 36, 1024, 5); x.fillRect(0, 519, 1024, 5);
  x.fillStyle = '#fff'; x.font = 'italic 700 82px "Snell Roundhand","Brush Script MT","Apple Chancery",cursive'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Coca-Cola', 512, 215);
  x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(380, 300); x.bezierCurveTo(450, 270, 480, 340, 540, 305); x.bezierCurveTo(580, 285, 610, 300, 640, 318); x.stroke();
  x.font = '600 26px Arial'; x.fillText('ORIGINAL TASTE', 512, 450); x.font = '20px Arial'; x.fillText('12 FL OZ (355 mL)', 512, 490); return tex(c);
}
function pepsiCan() {
  const [c, x] = cv(1024, 560); const bg = x.createLinearGradient(0, 0, 0, 560); bg.addColorStop(0, '#0a3f94'); bg.addColorStop(1, '#06285f'); x.fillStyle = bg; x.fillRect(0, 0, 1024, 560);
  const sh = x.createLinearGradient(0, 0, 1024, 0); sh.addColorStop(0, 'rgba(0,0,0,.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = sh; x.fillRect(0, 0, 1024, 560);
  const cx = 512, cy = 215, r = 118;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, r + 9, 0, 7); x.fill();
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
  x.fillStyle = '#e32934'; x.fillRect(cx - r, cy - r, 2 * r, r + 8); x.fillStyle = '#0a52a6'; x.fillRect(cx - r, cy, 2 * r, r + 8);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx - r, cy + 20); x.bezierCurveTo(cx - 50, cy - 40, cx + 30, cy + 70, cx + r, cy - 18); x.lineTo(cx + r, cy + 14); x.bezierCurveTo(cx + 30, cy + 110, cx - 50, cy + 0, cx - r, cy + 58); x.closePath(); x.fill(); x.restore();
  x.fillStyle = '#fff'; x.font = '800 104px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PEPSI', 512, 410);
  x.font = '20px Arial'; x.fillText('12 FL OZ (355 mL)', 512, 492); return tex(c);
}
function textLabel(w, h, bg, lines) {   // lines: [text, size, color, y, weight]
  const [c, x] = cv(w, h); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const [t, s, col, y, wt = 700] of lines) { x.fillStyle = col; x.font = `${wt} ${s}px "Helvetica Neue", Arial, sans-serif`; x.fillText(t, w / 2, y); } return tex(c);
}
function cabbageTex() {
  const [c, x] = cv(512, 512); x.fillStyle = '#a9cd82'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { const px = Math.random() * 512, py = Math.random() * 512, r = 30 + Math.random() * 90, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${200 + Math.random() * 40},${230},${170},.45)`); g.addColorStop(1, 'rgba(160,200,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  x.lineCap = 'round';
  for (let i = 0; i < 170; i++) { const px = Math.random() * 512, a = Math.random() * 0.5 - 0.25; x.strokeStyle = Math.random() < 0.6 ? 'rgba(238,248,222,.55)' : 'rgba(90,130,60,.32)'; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); x.moveTo(px, 512); x.quadraticCurveTo(px + a * 260, 256, 256 + (px - 256) * 0.1, 0); x.stroke(); }
  return tex(c, true);
}
function eggMat(col) { return new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }); }

// ---------- primitives ----------
function can(parent, kind, x, y, z) {
  const t = kind === 'coke' ? CAN_COKE() : CAN_PEPSI(), r = 0.033, h = 0.122;
  const side = new THREE.MeshStandardMaterial({ map: t, metalness: 0.55, roughness: 0.32 }), alu = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.9, roughness: 0.3 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1), [side, alu, alu]); m.position.set(x, y + h / 2, z); m.rotation.y = Math.PI; m.receiveShadow = true; parent.add(m);
  put(parent, CYL, alu, x, y + h + 0.002, z, r * 0.82, 0.005, r * 0.82); put(parent, BOX, alu, x, y + h + 0.006, z, 0.016, 0.002, 0.008);
  return m;
}
let _ck, _pp; const CAN_COKE = () => (_ck ??= cokeCan()), CAN_PEPSI = () => (_pp ??= pepsiCan());
/** Plastic bottle: lathe body + wrap-around label + cap. */
function bottle(parent, o) {
  const { r, h, nr = r * 0.34, color, opacity = 0.8, label, lh, ly, cap = 0xe33, x, y, z, rough = 0.15 } = o;
  const sh = h * 0.7, pts = [[0.001, 0], [r * 0.82, 0], [r, 0.008], [r, sh], [r * 0.82, sh + h * 0.07], [nr * 1.15, sh + h * 0.13], [nr, h - 0.018], [nr * 1.12, h - 0.014], [nr * 1.12, h - 0.004], [0.001, h - 0.004]].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshPhysicalMaterial({ color, transparent: opacity < 1, opacity, roughness: rough, clearcoat: 0.6, depthWrite: opacity >= 1 })); body.receiveShadow = true; g.add(body);
  if (label) { const lab = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0007, r + 0.0007, lh, 24, 1, true), new THREE.MeshStandardMaterial({ map: label, roughness: 0.5, side: THREE.DoubleSide })); lab.position.y = ly; lab.rotation.y = Math.PI; g.add(lab); }
  put(g, CYL, std(cap, 0.4), 0, h - 0.002, 0, nr * 1.2, 0.022, nr * 1.2);
  return g;
}
function jar(parent, x, y, z, r, h, glassCol, lidCol, label, lh, contents) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  put(g, CYL, new THREE.MeshPhysicalMaterial({ color: glassCol, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }), 0, h / 2, 0, r, h, r);
  if (contents) put(g, CYL, std(contents, 0.5), 0, (h - 0.01) / 2, 0, r * 0.93, h - 0.01, r * 0.93);
  put(g, CYL, std(lidCol, 0.35), 0, h + 0.008, 0, r * 1.02, 0.018, r * 1.02);
  if (label) { const l = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0007, r + 0.0007, lh, 24, 1, true), new THREE.MeshStandardMaterial({ map: label, roughness: 0.5, side: THREE.DoubleSide })); l.position.y = h * 0.48; l.rotation.y = Math.PI; g.add(l); }
  return g;
}
function carton(parent, x, y, z, w, h, d, label, roofCol) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const mat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.45 });
  put(g, new THREE.BoxGeometry(w, h, d), [mat, mat, std(0xffffff, 0.5), std(0xffffff, 0.5), mat, mat], 0, h / 2, 0);
  const roof = new THREE.Shape(); roof.moveTo(-d / 2, 0); roof.lineTo(d / 2, 0); roof.lineTo(0.005, h * 0.26); roof.lineTo(-0.005, h * 0.26); roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, { depth: w, bevelEnabled: false }); rg.translate(0, 0, -w / 2);
  const rm = put(g, rg, mat, 0, h, 0); rm.rotation.y = Math.PI / 2; put(g, CYL, std(roofCol, 0.4), 0, h + h * 0.28, 0, 0.011, 0.014, 0.011);
  return g;
}
function meatTray(parent, kind, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const foam = std(0xf1efe8, 0.95);
  put(g, rb(0.25, 0.022, 0.17, 0.006), foam, 0, 0.011, 0);
  put(g, BOX, std(0xe9d3cb, 1), 0, 0.0235, 0, 0.22, 0.003, 0.14);
  const meat = new THREE.MeshPhysicalMaterial({ color: kind === 'pork' ? 0xdd8a86 : 0xefc2a6, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  if (kind === 'pork') {
    for (const [mx, mz, ry2] of [[-0.075, -0.025, 0.1], [0.0, 0.03, -0.08], [0.075, -0.02, 0.05]]) {
      put(g, rb(0.07, 0.026, 0.085, 0.01), meat, mx, 0.038, mz, 1, 1, 1, [0, ry2, 0]);
      put(g, rb(0.072, 0.02, 0.014, 0.006), std(0xf6e8e2, 0.5), mx, 0.036, mz + 0.045, 1, 1, 1, [0, ry2, 0]);
      put(g, CYL, std(0xf3e9df, 0.5), mx + 0.01, 0.052, mz - 0.01, 0.009, 0.004, 0.009);
    }
  } else {
    for (const [mx, mz, sc] of [[-0.06, -0.02, 1], [0.045, 0.025, 0.95]]) { put(g, SPH, meat, mx, 0.04, mz, 0.052 * sc, 0.02, 0.04 * sc); put(g, SPH, std(0xf2d6b4, 0.45), mx + 0.01, 0.052, mz - 0.01, 0.03 * sc, 0.007, 0.022 * sc); }
    for (const [mx, mz, a] of [[0.085, -0.04, 0.5], [-0.085, 0.045, -0.4]]) { put(g, SPH, meat, mx, 0.037, mz, 0.04, 0.017, 0.017, [0, a, 0]); put(g, SPH, std(0xf6ead9, 0.4), mx + Math.cos(a) * 0.036, 0.037, mz - Math.sin(a) * 0.036, 0.009, 0.009, 0.009); }
  }
  const film = new THREE.Mesh(rb(0.262, 0.05, 0.182, 0.018), wrap()); film.position.y = 0.036; g.add(film);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshStandardMaterial({ map: textLabel(280, 180, '#fbfaf5', kind === 'pork'
    ? [['PORK CHOPS', 44, '#b3262b', 38], ['bone-in  1.6 lb', 30, '#222', 84, 500], ['SELL BY 11/29', 30, '#222', 122, 500], ['$7.49', 46, '#111', 158]]
    : [['CHICKEN', 44, '#b3262b', 38], ['breast & drumsticks', 26, '#222', 84, 500], ['SELL BY 11/27', 30, '#222', 122, 500], ['$5.99', 46, '#111', 158]]), roughness: 0.6 }));
  sticker.rotation.x = -Math.PI / 2; sticker.position.set(0.068, 0.0625, 0.05); g.add(sticker);
  return g;
}
function eggCarton(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const pulp = std(0xb7ae9f, 0.95);
  put(g, rb(0.26, 0.012, 0.105, 0.004), pulp, 0, 0.006, 0);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const ex = -0.108 + i * 0.0435, ez = -0.026 + j * 0.052, brown = (i + j * 3) % 4 !== 1;
    put(g, CYL, pulp, ex, 0.017, ez, 0.021, 0.022, 0.021);
    put(g, SPH, eggMat(brown ? 0xb48556 : 0xf3eee4), ex, 0.037, ez, 0.0195, 0.026, 0.0195, [0.08 * (j ? 1 : -1), 0, 0]);
  }
  const lid = new THREE.Group(); lid.position.set(0, 0.011, -0.052); lid.rotation.x = -1.7; g.add(lid);
  put(lid, rb(0.26, 0.007, 0.105, 0.004), pulp, 0, 0, 0.0525);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.07), new THREE.MeshStandardMaterial({ map: textLabel(360, 140, '#f3e9c8', [['FARM FRESH', 50, '#7a4a1a', 44], ['LARGE EGGS  -  1 DOZEN', 28, '#3a2a14', 100, 600]]), roughness: 0.7 }));
  lab.rotation.x = Math.PI / 2; lab.position.set(0, 0.0045, 0.055); lab.rotation.x = -Math.PI / 2; lab.rotation.y = Math.PI; lid.add(lab);
  return g;
}

// ---------- vegetables ----------
function cabbage(parent, x, y, z, r) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const t = cabbageTex(); const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 2.2, roughness: 0.8 });
  put(g, SPH, m, 0, r * 0.9, 0, r, r * 0.9, r);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.4; put(g, SPH, std(0x7fae5a, 0.8, { bumpMap: t, bumpScale: 1 }), Math.cos(a) * r * 0.78, r * 0.38, Math.sin(a) * r * 0.78, r * 0.42, r * 0.34, r * 0.18, [0.5, -a, 0.2]); }
  return g;
}
function lettuce(parent, x, y, z, r) {
  const geo = new THREE.IcosahedronGeometry(1, 4), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.16 * Math.sin(v.x * 9 + v.y * 5) * Math.cos(v.z * 8) + 0.1 * Math.sin(v.y * 17 + v.z * 6); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); const t = cabbageTex();
  const m = put(parent, geo, new THREE.MeshStandardMaterial({ color: 0xa7e06b, map: t, bumpMap: t, bumpScale: 1.5, roughness: 0.7 }), x, y + r * 0.85, z, r, r * 0.85, r);
  return m;
}
function tomato(parent, x, y, z, r, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  put(g, SPH, new THREE.MeshPhysicalMaterial({ color: 0xcf2a1c, roughness: 0.32, clearcoat: 0.5 }), 0, r * 0.82, 0, r, r * 0.84, r);
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; put(g, SPH, std(0x3f8a2c, 0.6), Math.cos(a) * r * 0.22, r * 1.6, Math.sin(a) * r * 0.22, r * 0.34, r * 0.05, r * 0.1, [0, -a, 0.35]); }
  put(g, CYL, std(0x4a8a2a, 0.6), 0, r * 1.68, 0, r * 0.07, r * 0.2, r * 0.07); return g;
}
function carrot(parent, x, y, z, ry, len = 0.17) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const m = put(g, new THREE.ConeGeometry(0.017, len, 14), std(0xe8741b, 0.7), 0, 0.017, 0, 1, 1, 1, [0, 0, -Math.PI / 2]); m.position.x = 0;
  put(g, CYL, std(0x4c8a2c, 0.7), len / 2 + 0.012, 0.017, 0, 0.007, 0.03, 0.007, [0, 0, Math.PI / 2]); return g;
}
function cucumber(parent, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const geo = new THREE.CapsuleGeometry(0.0285, 0.2, 6, 16); put(g, geo, std(0x2f6b2a, 0.45), 0, 0.03, 0, 1, 1, 1, [0, 0, Math.PI / 2]);
  put(g, geo, std(0x7db35a, 0.5, { transparent: true, opacity: 0.35 }), 0, 0.03, 0, 1.0, 1.01, 1.01, [0, 0, Math.PI / 2]); return g;
}
function pepper(parent, x, y, z, col, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.28, clearcoat: 0.6 });
  for (const [dx, dz] of [[-0.02, 0], [0.018, -0.016], [0.018, 0.016]]) put(g, SPH, mat, dx, 0.045, dz, 0.034, 0.048, 0.034);
  put(g, CYL, std(0x3f7a2a, 0.6), 0, 0.098, 0, 0.007, 0.03, 0.007); return g;
}
function onion(parent, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  put(g, SPH, new THREE.MeshStandardMaterial({ color: 0xc88a3c, roughness: 0.5 }), 0, 0.035, 0, 0.042, 0.036, 0.042);
  put(g, new THREE.ConeGeometry(0.012, 0.03, 10), std(0xb9863e, 0.7), 0, 0.075, 0, 1, 1, 1); return g;
}
function broccoli(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  put(g, CYL, std(0x9fc46a, 0.7), 0, 0.03, 0, 0.012, 0.06, 0.012); put(g, CYL, std(0x9fc46a, 0.7), 0.02, 0.05, 0, 0.007, 0.05, 0.007, [0, 0, -0.5]); put(g, CYL, std(0x9fc46a, 0.7), -0.02, 0.05, 0, 0.007, 0.05, 0.007, [0, 0, 0.5]);
  const t = cabbageTex();
  for (const [dx, dy, dz, s] of [[0, 0.09, 0, 0.034], [-0.034, 0.078, 0.01, 0.028], [0.034, 0.078, -0.008, 0.028], [0.01, 0.075, 0.03, 0.026], [-0.01, 0.074, -0.03, 0.026]]) put(g, SPH, new THREE.MeshStandardMaterial({ color: 0x2f7a30, bumpMap: t, bumpScale: 3, roughness: 0.85 }), dx, dy, dz, s, s * 0.8, s);
  return g;
}

// ---------- the stock ----------
export function fridgeFood(o) {
  const { g, dFridge, dFreezer, basket, Y, cw, innerZ0, shelfD } = o;
  const sY = (s) => Y[s] + 0.003, zf = (k) => innerZ0 + 0.04 + k * (shelfD - 0.08);   // k: 0 = back .. 1 = front of a shelf
  const food = new THREE.Group(); food.name = 'fridge-food'; g.add(food);

  // shelf C: cold drinks, Coca-Cola and Pepsi (two rows each)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    can(food, 'coke', -0.285 + i * 0.0705, sY('shC'), zf(0.28 + j * 0.16));
    can(food, 'pepsi', 0.0 + i * 0.0705, sY('shC'), zf(0.28 + j * 0.16));
  }
  // shelf B: eggs, butter, cheese, yogurt, leftovers
  eggCarton(food, -0.17, sY('shB'), zf(0.42)); eggCarton(food, -0.17, sY('shB'), zf(0.84)).scale.set(0.97, 1, 0.97);
  const butter = new THREE.MeshStandardMaterial({ map: textLabel(360, 140, '#f0c94a', [['BUTTER', 58, '#8a2a14', 44], ['salted  -  1 lb', 28, '#5a3a14', 100, 600]]), roughness: 0.5 });
  put(food, BOX, [butter, butter, butter, butter, butter, butter], 0.0, sY('shB') + 0.018, zf(0.9), 0.11, 0.036, 0.055);
  put(food, rb(0.14, 0.032, 0.085, 0.004), std(0xf0be3d, 0.5), 0.0, sY('shB') + 0.016, zf(0.55), 1, 1, 1);
  put(food, rb(0.145, 0.034, 0.09, 0.006), wrap(), 0.0, sY('shB') + 0.017, zf(0.55));
  const yog = textLabel(240, 120, '#fff', [['Greek', 34, '#2b4f9c', 36], ['YOGURT', 30, '#d33a68', 76]]);
  for (let i = 0; i < 4; i++) { const y = new THREE.Group(); y.position.set(0.09 + (i % 2) * 0.075, sY('shB'), zf(0.4 + Math.floor(i / 2) * 0.35)); food.add(y);
    put(y, new THREE.CylinderGeometry(0.035, 0.028, 0.075, 22), std(0xffffff, 0.4), 0, 0.0375, 0); put(y, new THREE.CylinderGeometry(0.0356, 0.0356, 0.05, 22, 1, true), new THREE.MeshStandardMaterial({ map: yog, roughness: 0.5, side: THREE.DoubleSide }), 0, 0.04, 0, 1, 1, 1, [0, Math.PI, 0]);
    put(y, CYL, std(0xd9dcdf, 0.3, { metalness: 0.7 }), 0, 0.077, 0, 0.036, 0.004, 0.036); }
  const lo = new THREE.Group(); lo.position.set(0.215, sY('shB'), zf(0.6)); food.add(lo);
  put(lo, rb(0.12, 0.07, 0.2, 0.01), new THREE.MeshPhysicalMaterial({ color: 0xdfeee8, transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false }), 0, 0.035, 0);
  put(lo, rb(0.108, 0.05, 0.188, 0.008), std(0xc9552b, 0.6), 0, 0.028, 0); put(lo, rb(0.124, 0.012, 0.204, 0.004), std(0x3b6fb6, 0.4), 0, 0.074, 0);

  // shelf A: raw meat on the lowest shelf
  meatTray(food, 'chicken', -0.14, sY('shA'), zf(0.42), 0.05); meatTray(food, 'pork', 0.13, sY('shA'), zf(0.42), -0.06);
  const bacon = new THREE.Mesh(rb(0.2, 0.025, 0.1, 0.005), new THREE.MeshStandardMaterial({ map: textLabel(400, 200, '#c0262d', [['SMOKEHOUSE', 40, '#fff', 40], ['BACON', 82, '#fff', 105], ['thick cut  -  16 oz', 28, '#fde', 168, 500]]), roughness: 0.4 }));
  bacon.position.set(-0.02, sY('shA') + 0.0125, zf(0.82)); bacon.receiveShadow = true; food.add(bacon);
  jar(food, 0.2, sY('shA'), zf(0.8), 0.04, 0.12, 0xe9d9a0, 0xb02a2a, textLabel(256, 128, '#fbf1d6', [['PICKLES', 40, '#2a6a2a', 64]]), 0.07, 0x7fa84a);

  // crisper drawers: vegetables
  const dN = o.drawerOf('N'), dS = o.drawerOf('S');
  cabbage(dN, -0.045, 0.004, -0.12, 0.1); lettuce(dN, 0.075, 0.004, -0.04, 0.085);
  cucumber(dN, 0.0, 0.004, 0.14, 0.08); cucumber(dN, 0.03, 0.004, 0.2, -0.05); broccoli(dN, -0.07, 0.004, 0.17);
  const tp = [[-0.09, -0.16], [-0.045, -0.16], [0, -0.16], [0.045, -0.16], [0.09, -0.16], [-0.07, -0.105], [-0.02, -0.105], [0.03, -0.105], [0.08, -0.105], [-0.03, -0.14], [0.03, -0.14]];
  tp.forEach(([x, z], i) => tomato(dS, x, i > 8 ? 0.062 : 0.004, z, 0.038, i));
  for (let i = 0; i < 5; i++) carrot(dS, -0.02 + (i - 2) * 0.004, 0.004 + (i % 2) * 0.034, 0.0 + i * 0.002 + 0.02, -0.15 + i * 0.07);
  pepper(dS, -0.075, 0.004, 0.16, 0xc7201a, 0.4); pepper(dS, 0.0, 0.004, 0.18, 0xf0b81a, 1.2); pepper(dS, 0.07, 0.004, 0.14, 0x3f9a2e, 2.0);
  onion(dS, 0.09, 0.004, 0.05, 0.3); onion(dS, 0.05, 0.004, 0.08, 1); onion(dS, 0.1, 0.004, 0.1, 2);

  // ---- freezer ----
  const fzY = Y.fz + 0.003;
  // frozen whole chicken in a bag + pork shoulder in butcher paper on the freezer shelf
  const bag = new THREE.Group(); bag.position.set(-0.13, fzY, zf(0.45)); food.add(bag);
  put(bag, SPH, new THREE.MeshPhysicalMaterial({ color: 0xe8c79a, roughness: 0.55 }), 0, 0.055, 0, 0.1, 0.055, 0.075);
  for (const s of [-1, 1]) { put(bag, SPH, std(0xe4be90, 0.5), s * 0.05, 0.043, -0.07, 0.022, 0.02, 0.05, [0.3, s * 0.4, 0]); put(bag, SPH, std(0xf2e5cf, 0.4), s * 0.06, 0.045, -0.115, 0.01, 0.01, 0.01); }
  put(bag, rb(0.27, 0.12, 0.2, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xe6f0f8, transparent: true, opacity: 0.3, roughness: 0.12, clearcoat: 1, depthWrite: false }), 0, 0.06, 0);
  put(bag, new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ map: textLabel(300, 180, '#f4c542', [['WHOLE', 46, '#a01c1c', 44], ['CHICKEN', 56, '#a01c1c', 100], ['frozen  4.2 lb', 28, '#333', 150, 500]]), roughness: 0.6 }), 0.0, 0.122, 0.0, 1, 1, 1, [-Math.PI / 2, 0, 0]);
  const pork = new THREE.MeshStandardMaterial({ map: textLabel(400, 240, '#ddd0b4', [['PORK', 88, '#7a1f1f', 80], ['SHOULDER', 52, '#7a1f1f', 150], ['frozen  3 lb', 30, '#444', 200, 500]]), roughness: 0.9 });
  put(food, BOX, pork, 0.13, fzY + 0.05, zf(0.5), 0.2, 0.1, 0.15).rotation.y = 0.12;
  // basket: peas, dumplings, fish sticks, ice cream, ice tray
  const peas = new THREE.MeshStandardMaterial({ map: textLabel(300, 380, '#3f9b3a', [['GARDEN', 44, '#fff', 60], ['PEAS', 100, '#fff', 150], ['frozen  -  2 lb', 30, '#e8ffe0', 230, 500]]), roughness: 0.5 });
  put(basket, rb(0.19, 0.05, 0.25, 0.02), peas, -0.1, 0.03, -0.12, 1, 1, 1, [0, 0.1, 0]);
  const fish = new THREE.MeshStandardMaterial({ map: textLabel(300, 380, '#1c5da8', [['CRISPY', 40, '#fff', 60], ['FISH STICKS', 54, '#ffd23a', 130], ['wild caught', 28, '#cfe6ff', 200, 500]]), roughness: 0.5 });
  put(basket, BOX, fish, 0.12, 0.04, -0.12, 0.15, 0.065, 0.1, [0, -0.1, 0]);
  const ice = textLabel(512, 200, '#f6e3ea', [['Vanilla', 52, '#8a3b62', 70], ['ICE CREAM', 36, '#5a2a46', 140]]);
  for (const [x, z, c] of [[-0.05, 0.08, 0xf7ecd8], [0.09, 0.06, 0xf4d0dc]]) { put(basket, new THREE.CylinderGeometry(0.075, 0.062, 0.11, 28), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }), x, 0.058, z); put(basket, new THREE.CylinderGeometry(0.0765, 0.0765, 0.08, 28, 1, true), new THREE.MeshStandardMaterial({ map: ice, roughness: 0.5, side: THREE.DoubleSide }), x, 0.062, z, 1, 1, 1, [0, Math.PI, 0]); put(basket, CYL, std(0xffffff, 0.4), x, 0.117, z, 0.077, 0.008, 0.077); }
  const tray = new THREE.Group(); tray.position.set(-0.12, 0.004, 0.14); basket.add(tray);
  put(tray, rb(0.2, 0.014, 0.1, 0.004), std(0x7aa7d6, 0.4), 0, 0.007, 0);
  for (let i = 0; i < 8; i++) put(tray, rb(0.021, 0.02, 0.021, 0.004), new THREE.MeshPhysicalMaterial({ color: 0xe6f4fa, transparent: true, opacity: 0.8, roughness: 0.05, clearcoat: 1 }), -0.078 + (i % 4) * 0.052, 0.022, -0.023 + Math.floor(i / 4) * 0.046);

  // ---- fridge door bins (door frame: x from the hinge, y from the door centre, z negative = into the cabinet) ----
  const H = o.fridgeH, dw = o.dw;
  // door contents live in a group turned to face the cabinet interior (fronts toward -z, i.e. toward you when the door is open)
  const mkFace = (door) => { const f = new THREE.Group(); f.rotation.y = Math.PI; f.position.x = dw; door.add(f); return f; };
  const fdoor = mkFace(dFridge), zdoor = mkFace(dFreezer);
  const bin = (door, y, w = dw - 0.08) => {
    const plastic = new THREE.MeshStandardMaterial({ color: 0xe1eaee, roughness: 0.25, transparent: true, opacity: 0.6, depthWrite: false });
    put(door, BOX, plastic, dw / 2, y, 0.05, w, 0.006, 0.08); put(door, BOX, plastic, dw / 2, y + 0.025, 0.089, w, 0.05, 0.006); put(door, BOX, plastic, dw / 2 - w / 2, y + 0.025, 0.05, 0.006, 0.05, 0.08); put(door, BOX, plastic, dw / 2 + w / 2, y + 0.025, 0.05, 0.006, 0.05, 0.08);
  };
  const bY = [-H / 2 + 0.1, -H / 2 + 0.4, -H / 2 + 0.7];
  bY.forEach((y) => bin(fdoor, y));
  const X = (u) => 0.04 + u * (dw - 0.08), Z = 0.05;
  const cokeLab = textLabel(256, 150, '#d3121a', [['Coca-Cola', 56, '#fff', 56, 700], ['1 LITER', 26, '#fff', 110, 500]]);
  const pepsiLab = textLabel(256, 150, '#0a3f94', [['PEPSI', 66, '#fff', 56, 800], ['1 LITER', 26, '#fff', 110, 500]]);
  const waterLab = textLabel(256, 150, '#e8f4fa', [['SPRING', 34, '#1d6fa8', 40], ['WATER', 40, '#1d6fa8', 84], ['0.5 L', 24, '#456', 124, 500]]);
  bottle(fdoor, { r: 0.04, h: 0.3, color: 0x2a1408, opacity: 0.82, label: cokeLab, lh: 0.1, ly: 0.12, cap: 0xcc1a1a, x: X(0.12), y: bY[0] + 0.003, z: Z });
  bottle(fdoor, { r: 0.04, h: 0.3, color: 0x1a2438, opacity: 0.82, label: pepsiLab, lh: 0.1, ly: 0.12, cap: 0x1651a8, x: X(0.34), y: bY[0] + 0.003, z: Z });
  bottle(fdoor, { r: 0.03, h: 0.23, color: 0xcfe9f5, opacity: 0.5, label: waterLab, lh: 0.07, ly: 0.1, cap: 0x2a7ab8, x: X(0.55), y: bY[0] + 0.003, z: Z });
  bottle(fdoor, { r: 0.03, h: 0.23, color: 0xcfe9f5, opacity: 0.5, label: waterLab, lh: 0.07, ly: 0.1, cap: 0x2a7ab8, x: X(0.7), y: bY[0] + 0.003, z: Z });
  bottle(fdoor, { r: 0.03, h: 0.23, color: 0xcfe9f5, opacity: 0.5, label: waterLab, lh: 0.07, ly: 0.1, cap: 0x2a7ab8, x: X(0.85), y: bY[0] + 0.003, z: Z });
  const milk = new THREE.Group(); milk.position.set(X(0.15), bY[1] + 0.003, Z); fdoor.add(milk);
  put(milk, rb(0.095, 0.2, 0.075, 0.015), new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, transparent: true, opacity: 0.88, roughness: 0.2, clearcoat: 0.5 }), 0, 0.1, 0);
  put(milk, CYL, std(0x2d62c9, 0.35), 0.02, 0.208, 0, 0.018, 0.02, 0.018); put(milk, rb(0.098, 0.1, 0.02, 0.006), new THREE.MeshStandardMaterial({ map: textLabel(240, 260, '#fff', [['Whole', 44, '#1d4fa8', 40], ['MILK', 86, '#1d4fa8', 110], ['1 gallon', 28, '#555', 178, 500]]), roughness: 0.5 }), 0, 0.1, 0.0375, 1, 1, 1);
  carton(fdoor, X(0.45), bY[1] + 0.003, Z, 0.07, 0.19, 0.07, textLabel(256, 256, '#f2992e', [['Orange', 50, '#fff', 60], ['JUICE', 70, '#fff', 120], ['no pulp', 28, '#fff3d6', 180, 500]]), 0xf2992e);
  carton(fdoor, X(0.68), bY[1] + 0.003, Z, 0.07, 0.19, 0.07, textLabel(256, 256, '#8a3b9c', [['Grape', 50, '#fff', 60], ['JUICE', 70, '#fff', 120]]), 0x8a3b9c);
  jar(fdoor, X(0.9), bY[1] + 0.003, Z, 0.04, 0.12, 0xd8e8f0, 0x2f7a2f, textLabel(256, 128, '#f4f0d8', [['SALSA', 44, '#b3262b', 64]]), 0.07, 0xc23b22);
  // condiments on the top bin
  bottle(fdoor, { r: 0.034, h: 0.2, color: 0xc01f1a, opacity: 1, label: textLabel(256, 150, '#c01f1a', [['KETCHUP', 50, '#fff', 74, 800]]), lh: 0.08, ly: 0.09, cap: 0xf1f1ec, x: X(0.12), y: bY[2] + 0.003, z: Z, rough: 0.3 });
  bottle(fdoor, { r: 0.03, h: 0.18, color: 0xf2d34a, opacity: 1, label: textLabel(256, 150, '#f2d34a', [['MUSTARD', 46, '#7a4a00', 74, 800]]), lh: 0.07, ly: 0.08, cap: 0xf2d34a, x: X(0.3), y: bY[2] + 0.003, z: Z, rough: 0.3 });
  jar(fdoor, X(0.48), bY[2] + 0.003, Z, 0.04, 0.12, 0xf3efe2, 0xe5c83a, textLabel(256, 128, '#fffbe8', [['MAYO', 54, '#2b4f9c', 64, 800]]), 0.08, 0xf5f0dc);
  bottle(fdoor, { r: 0.022, h: 0.17, color: 0x2a1408, opacity: 0.95, label: textLabel(200, 150, '#8a1a1a', [['SOY', 56, '#fff', 54, 800], ['SAUCE', 40, '#fff', 104]]), lh: 0.07, ly: 0.07, cap: 0x111111, x: X(0.64), y: bY[2] + 0.003, z: Z });
  jar(fdoor, X(0.78), bY[2] + 0.003, Z, 0.032, 0.09, 0xd8e8f0, 0xc23b22, textLabel(256, 128, '#8a1a3a', [['JAM', 54, '#fff', 64, 800]]), 0.06, 0x8a1a3a);
  bottle(fdoor, { r: 0.021, h: 0.16, color: 0xc2271a, opacity: 1, label: textLabel(200, 150, '#e86a1a', [['HOT', 54, '#fff', 54, 800], ['SAUCE', 40, '#fff', 104]]), lh: 0.07, ly: 0.07, cap: 0x2a8a2a, x: X(0.91), y: bY[2] + 0.003, z: Z, rough: 0.3 });
  // freezer door: two shallow bins with small frozen goods and ice packs
  const FH = o.freezerH; [-FH / 2 + 0.07, -FH / 2 + 0.3].forEach((y) => bin(zdoor, y));
  for (const [u, col, txt] of [[0.2, 0xf7ecd8, 'Vanilla'], [0.42, 0xd9a07a, 'Choc']]) { const pint = new THREE.Group(); pint.position.set(X(u), -FH / 2 + 0.073, Z); zdoor.add(pint);
    put(pint, new THREE.CylinderGeometry(0.037, 0.03, 0.09, 22), new THREE.MeshStandardMaterial({ map: textLabel(256, 128, '#f6e3ea', [[txt, 44, '#6a2a4a', 40], ['ICE CREAM', 30, '#6a2a4a', 90]]), roughness: 0.5 }), 0, 0.045, 0, 1, 1, 1, [0, Math.PI, 0]); put(pint, CYL, std(col, 0.5), 0, 0.092, 0, 0.038, 0.006, 0.038); }
  for (let i = 0; i < 3; i++) put(zdoor, rb(0.06, 0.012, 0.1, 0.004), std(0x7ec1e8, 0.3), X(0.6 + i * 0.12), -FH / 2 + 0.082, Z, 1, 1, 1);
  put(zdoor, rb(0.12, 0.05, 0.06, 0.008), new THREE.MeshStandardMaterial({ map: textLabel(240, 100, '#ffffff', [['ICE', 40, '#1d6fa8', 30], ['CUBES', 40, '#1d6fa8', 72]]), roughness: 0.5 }), X(0.35), -FH / 2 + 0.33, Z);

  food.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  fdoor.traverse((m) => { if (m.isMesh && m.parent !== fdoor && m.name === '') m.castShadow = false; });
}
