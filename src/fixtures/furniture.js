import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FURNITURE } from '../config.js';
import { DESK_BUILDERS } from './desk.js';

/**
 * Loose furniture, each an independent group (front faces local +z, origin = floor centre of the footprint).
 * Every group is `userData.movable` so Layout mode (L) can drag / rotate / resize it.
 */
const cache = {};
function woodMap(base, streak) {
  const key = base + streak; if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = streak; g.globalAlpha = 0.04 + Math.random() * 0.1; g.lineWidth = 0.5 + Math.random() * 2;
    const x = Math.random() * 256; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 2, 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[key] = t);
}
export const wood = (base, streak, rough = 0.55) => new THREE.MeshStandardMaterial({ map: woodMap(base, streak), roughness: rough, metalness: 0.02 });
export const std = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

export function mk(parent, geo, mat, name, x, y, z, rot) {
  const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
export const bx = (p, w, h, d, mat, name, x, y, z, rot) => mk(p, rBox(w, h, d), mat, name, x, y, z, rot);
export const rb = (p, w, h, d, r, mat, name, x, y, z) => mk(p, new RoundedBoxGeometry(w, h, d, 3, r), mat, name, x, y, z);
export const cyl = (p, r0, r1, h, mat, name, x, y, z, rot, seg = 18) => mk(p, new THREE.CylinderGeometry(r0, r1, h, seg), mat, name, x, y, z, rot);

export function finish(g, id, label, w, h, d, collide = true) {
  g.name = id; g.userData.label = label; g.userData.movable = true;
  if (collide) {
    const c = new THREE.Mesh(rBox(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    c.position.y = h / 2; c.visible = false; c.name = 'collider'; c.userData.collider = true; g.add(c);
  }
  return g;
}

function bookshelf() {
  const g = new THREE.Group(), W = 0.9, D = 0.33, H = 1.05, t = 0.025;
  const oak = wood('#8a5a2c', '#4a2c12');
  for (const s of [-1, 1]) bx(g, t, H, D, oak, 'shelf-side', s * (W / 2 - t / 2), H / 2, 0);
  for (const y of [0.04, 0.37, 0.7]) bx(g, W - 2 * t, 0.022, D - 0.02, oak, 'shelf-board', 0, y, 0.005);
  bx(g, W, 0.03, D + 0.02, oak, 'shelf-top', 0, H - 0.015, 0.01);
  bx(g, W - 2 * t, H - 0.04, 0.008, wood('#6b4220', '#2e1a0a'), 'shelf-back', 0, H / 2, -D / 2 + 0.004);
  // microwave on the middle shelf
  const mw = new THREE.Group(); mw.name = 'microwave';
  bx(mw, 0.45, 0.27, 0.33, std(0x151515, 0.35, 0.3), 'microwave-body', 0, 0.135, 0);
  bx(mw, 0.3, 0.19, 0.004, std(0x050505, 0.1, 0.6), 'microwave-window', -0.055, 0.135, 0.167);
  bx(mw, 0.09, 0.19, 0.004, std(0x222222, 0.5), 'microwave-panel', 0.165, 0.135, 0.167);
  bx(mw, 0.05, 0.016, 0.003, new THREE.MeshStandardMaterial({ color: 0x22ff44, emissive: 0x11aa22, emissiveIntensity: 0.9 }), 'microwave-display', 0.165, 0.2, 0.17);
  mw.position.set(-0.08, 0.381, 0.0); g.add(mw);
  // clutter
  const items = [[0.7, 0.13, 0.07, 0.07, 0x4a8a3a], [0.12, 0.2, 0.07, 0.07, 0xd8d8d8], [0.14, 0.12, 0.17, 0.12, 0x5b3a22], [0.17, 0.3, 0.07, 0.09, 0xb08040]];
  for (const [x, , , , c] of items) cyl(g, 0.03, 0.03, 0.18, std(c, 0.4), 'jar', -0.3 + x * 0.9, H + 0.09, 0.0);
  bx(g, 0.2, 0.16, 0.12, std(0xb52a2a, 0.5), 'coffee-maker', 0.05, H + 0.08, -0.06);
  bx(g, 0.16, 0.22, 0.09, std(0xc9a06a, 0.8), 'cereal-box', -0.3, 0.7 + 0.12 + 0.011, 0.0);
  bx(g, 0.2, 0.1, 0.14, std(0x3a3f45, 0.6), 'plastic-tub', 0.2, 0.04 + 0.061, 0.0);
  bx(g, 0.18, 0.04, 0.12, std(0xd8c78a, 0.8), 'noodle-packs', -0.15, 0.7 + 0.031, 0.02);
  return finish(g, 'bookshelf', 'Wooden bookshelf (3 shelves, microwave)', W, H, D);
}

function xBackChair(id, label) {
  const g = new THREE.Group(), dark = wood('#3b1f16', '#1a0c08', 0.5), SH = 0.66, S = 0.42;
  bx(g, S, 0.035, S, dark, 'seat', 0, SH, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, SH, 0.04, dark, 'leg', sx * (S / 2 - 0.02), SH / 2, sz * (S / 2 - 0.02));
  for (const sz of [-1, 1]) bx(g, S - 0.04, 0.025, 0.025, dark, 'stretcher-x', 0, 0.22, sz * (S / 2 - 0.02));
  bx(g, 0.025, 0.025, S - 0.04, dark, 'stretcher-z', 0, 0.3, 0).position.x = S / 2 - 0.02;
  for (const sx of [-1, 1]) bx(g, 0.04, 0.42, 0.04, dark, 'back-post', sx * (S / 2 - 0.02), SH + 0.21, -S / 2 + 0.02);
  bx(g, S, 0.05, 0.035, dark, 'back-top-rail', 0, SH + 0.42, -S / 2 + 0.02);
  bx(g, S - 0.04, 0.03, 0.03, dark, 'back-low-rail', 0, SH + 0.08, -S / 2 + 0.02);
  for (const s of [-1, 1]) bx(g, 0.028, 0.4, 0.02, dark, 'back-x-slat', 0, SH + 0.26, -S / 2 + 0.02, [0, 0, s * 0.62]);
  return finish(g, id, label, S, SH + 0.45, S);
}

function table() {
  const g = new THREE.Group(), W = 1.1, D = 0.75, H = 0.9, dark = wood('#3a1c12', '#170a06', 0.45);
  bx(g, W, 0.05, D, dark, 'table-top', 0, H - 0.025, 0);
  bx(g, W - 0.1, 0.07, D - 0.1, dark, 'table-apron', 0, H - 0.085, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.065, H - 0.05, 0.065, dark, 'table-leg', sx * (W / 2 - 0.05), (H - 0.05) / 2, sz * (D / 2 - 0.05));
  for (const sz of [-1, 1]) bx(g, W - 0.12, 0.03, 0.03, dark, 'foot-rail', 0, 0.22, sz * (D / 2 - 0.05));
  bx(g, 0.03, 0.03, D - 0.12, dark, 'foot-rail-mid', 0, 0.22, 0);
  bx(g, 0.2, 0.006, 0.15, std(0xc9c19a, 0.8), 'worn-placemat', -0.02, H + 0.003, 0.2);
  return finish(g, 'dining-table', 'Dining table (counter height, dark wood)', W, H, D);
}

function metalChair() {
  const g = new THREE.Group(), blk = std(0x1a1a1a, 0.45, 0.6), W = 0.42, SH = 0.46;
  rb(g, W, 0.07, W - 0.02, 0.025, new THREE.MeshStandardMaterial({ color: 0x4a463d, roughness: 0.9 }), 'seat-cushion', 0, SH, 0.0);
  bx(g, W + 0.02, 0.02, W, blk, 'seat-frame', 0, SH - 0.045, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.014, 0.02, SH - 0.05, blk, 'chair-leg', sx * (W / 2 - 0.01) * 1.06, (SH - 0.05) / 2, sz * (W / 2 - 0.02) * 1.15, [sz * 0.1, 0, -sx * 0.1], 10);
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, 0.52, blk, 'back-post', sx * (W / 2), SH + 0.28, -W / 2 + 0.01, null, 10);
  bx(g, W, 0.02, 0.02, blk, 'back-top-rail', 0, SH + 0.54, -W / 2 + 0.01);
  bx(g, W, 0.015, 0.015, blk, 'back-low-rail', 0, SH + 0.06, -W / 2 + 0.01);
  for (const sx of [-0.1, 0.1]) { const t = mk(g, new THREE.TorusGeometry(0.075, 0.007, 8, 24), blk, 'scroll-loop', sx, SH + 0.3, -W / 2 + 0.01); t.scale.set(1, 1.5, 1); }
  return finish(g, 'metal-chair', 'Wrought-iron scroll-back chair', W + 0.04, SH + 0.56, W);
}

function orangeChair() {
  const g = new THREE.Group(), grey = std(0x3d3f42, 0.4, 0.7), org = new THREE.MeshStandardMaterial({ color: 0xe0583e, roughness: 0.85 }), W = 0.55, SH = 0.44;
  for (const s of [-1, 1]) {
    cyl(g, 0.013, 0.013, SH, grey, 'front-leg', s * W / 2, SH / 2, 0.25, null, 10);
    cyl(g, 0.013, 0.013, 0.95, grey, 'back-leg', s * W / 2, 0.47, -0.27, [-0.14, 0, 0], 10);
    bx(g, 0.02, 0.02, 0.5, grey, 'arm', s * W / 2, SH + 0.22, -0.02);
    cyl(g, 0.013, 0.013, 0.24, grey, 'arm-post', s * W / 2, SH + 0.11, 0.24, null, 10);
  }
  bx(g, W - 0.03, 0.012, 0.46, org, 'sling-seat', 0, SH, 0.0);
  bx(g, W - 0.04, 0.4, 0.012, org, 'sling-back', 0, SH + 0.3, -0.27, [-0.14, 0, 0]);
  return finish(g, 'orange-chair', 'Orange folding sling chair', W + 0.04, 0.95, 0.58);
}

function dresser() {
  const g = new THREE.Group(), W = 0.64, D = 0.42, H = 1.12;
  const body = wood('#6a4526', '#2e1c0e', 0.6), face = wood('#7a5230', '#3a2410', 0.5), dark = std(0x1a110b, 0.9), brass = std(0xb08a3c, 0.3, 0.8);
  for (const s of [-1, 1]) bx(g, 0.025, H - 0.1, D, body, 'dresser-side', s * (W / 2 - 0.0125), 0.1 + (H - 0.1) / 2 - 0.02, 0);
  bx(g, W, 0.04, D + 0.03, face, 'dresser-top', 0, H - 0.02, 0.01);
  bx(g, W - 0.04, H - 0.14, 0.01, dark, 'dresser-back', 0, 0.1 + (H - 0.14) / 2, -D / 2 + 0.01);
  bx(g, W - 0.05, 0.02, D - 0.02, body, 'dresser-shelf-low', 0, 0.36, 0);
  bx(g, W - 0.05, 0.02, D - 0.02, body, 'dresser-shelf-mid', 0, 0.56, 0);
  // scalloped apron (approximated by three bumps)
  bx(g, W, 0.08, 0.03, body, 'dresser-apron', 0, 0.06, D / 2 - 0.02);
  for (const x of [-0.2, 0, 0.2]) cyl(g, 0.045, 0.045, 0.03, body, 'apron-scallop', x, 0.03, D / 2 - 0.02, [Math.PI / 2, 0, 0], 16);
  // bottom drawer
  bx(g, W - 0.04, 0.2, 0.025, face, 'drawer-front', 0, 0.22, D / 2 - 0.005);
  bx(g, 0.07, 0.03, 0.02, brass, 'drawer-pull', 0, 0.24, D / 2 + 0.015);
  // open compartment with onions
  bx(g, W - 0.06, 0.2, 0.02, dark, 'open-compartment-shadow', 0, 0.46, D / 2 - 0.08);
  for (const x of [-0.14, 0.0, 0.12]) mk(g, new THREE.SphereGeometry(0.045, 14, 10), std(0x6a2a4a, 0.5), 'onion', x, 0.43, D / 2 - 0.1);
  mk(g, new THREE.SphereGeometry(0.06, 12, 8), std(0xd8c9a0, 0.8), 'bag', 0.18, 0.45, D / 2 - 0.1).scale.set(1, 0.8, 0.8);
  // two arched raised-panel doors
  for (const s of [-1, 1]) {
    bx(g, W / 2 - 0.03, 0.5, 0.025, face, 'dresser-door', s * (W / 4), 0.82, D / 2 - 0.005);
    bx(g, W / 2 - 0.1, 0.4, 0.012, wood('#8a5c34', '#3a2410', 0.45), 'door-raised-panel', s * (W / 4), 0.82, D / 2 + 0.012);
    mk(g, new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), wood('#8a5c34', '#3a2410', 0.45), 'door-arch', s * (W / 4), 1.02, D / 2 + 0.012).scale.set(1.05, 0.5, 0.2);
    bx(g, 0.012, 0.07, 0.012, brass, 'door-knob', -s * 0.012 + s * 0.0, 0.8, D / 2 + 0.025);
  }
  cyl(g, 0.035, 0.035, 0.22, new THREE.MeshStandardMaterial({ color: 0xcfe4f0, transparent: true, opacity: 0.55, roughness: 0.1 }), 'water-bottle', -0.2, H + 0.11, -0.05);
  return finish(g, 'dresser', 'Wooden dresser / cabinet', W, H, D);
}

export function makeRadiator({ id = 'radiator', label = 'Cast-iron radiator (9 sections)', n = 9, W = 0.62, H = 0.6, color = 0xbdbbae } = {}) {
  const g = new THREE.Group(), cast = std(color, 0.7, 0.1);
  const sw = W / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + sw * (i + 0.5);
    rb(g, sw - 0.008, H - 0.1, 0.1, 0.02, cast, 'radiator-section', x, 0.09 + (H - 0.1) / 2, 0);
    bx(g, sw - 0.025, H - 0.2, 0.03, std(new THREE.Color(color).multiplyScalar(0.88).getHex(), 0.8), 'section-groove', x, 0.09 + (H - 0.1) / 2, 0.055);
  }
  cyl(g, 0.03, 0.03, W, cast, 'radiator-top-header', 0, H - 0.04, 0, [0, 0, Math.PI / 2]);
  cyl(g, 0.03, 0.03, W, cast, 'radiator-bottom-header', 0, 0.12, 0, [0, 0, Math.PI / 2]);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) cyl(g, 0.02, 0.025, 0.07, cast, 'radiator-foot', x, 0.035, 0);
  cyl(g, 0.015, 0.015, 0.08, std(0xb08a3c, 0.35, 0.8), 'radiator-valve', W / 2 + 0.02, 0.12, 0, [0, 0, Math.PI / 2], 10);
  return finish(g, id, label, W + 0.06, H, 0.12);
}
const radiator = () => makeRadiator();

const BUILDERS = {
  'bookshelf': bookshelf,
  'metal-chair': metalChair,
  'dining-table': table,
  ...DESK_BUILDERS,
  'chair-north': () => xBackChair('chair-north', 'Wooden X-back chair (north side of table)'),
  'chair-west': () => xBackChair('chair-west', 'Wooden X-back chair (west end of table)'),
  'dresser': dresser,
  'radiator': radiator,
  'orange-chair': orangeChair,
};

export function buildFurniture() {
  return FURNITURE.map((f) => {
    const g = BUILDERS[f.id]();
    g.position.set(f.x, f.y ?? 0, f.z);
    g.rotation.y = THREE.MathUtils.degToRad(f.rot ?? 0);
    return g;
  });
}
