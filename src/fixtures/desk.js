import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { screenTexture, monitor, openMonitor, tickMonitor } from '../monitor.js';
import { click } from '../audio.js';

/** Things on the study table. Each is an independent, movable group (front faces +z, origin on the table top). */
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const mk = (p, geo, mat, name, x = 0, y = 0, z = 0, rot) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); if (rot) m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
const bx = (p, w, h, d, mat, name, x, y, z, rot) => mk(p, rBox(w, h, d), mat, name, x, y, z, rot);
const rbx = (p, w, h, d, r, mat, name, x, y, z) => mk(p, new RoundedBoxGeometry(w, h, d, 3, r), mat, name, x, y, z);
const cyl = (p, r0, r1, h, mat, name, x, y, z, rot, seg = 24) => mk(p, new THREE.CylinderGeometry(r0, r1, h, seg), mat, name, x, y, z, rot);
const hitBox = (g, w, h, d, y = h / 2) => { const m = new THREE.Mesh(rBox(w, h, d), new THREE.MeshBasicMaterial({ visible: false })); m.visible = false; m.position.y = y; m.name = 'hit-area'; g.add(m); };
const done = (g, id, label) => { g.name = id; g.userData.label = label; g.userData.movable = true; return g; };
const screenMat = (k = 0.85) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture, emissiveIntensity: k, roughness: 0.25, metalness: 0.1 });
const label = (draw, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function monitorObj() {
  const g = new THREE.Group();
  cyl(g, 0.09, 0.09, 0.012, std(0x151515, 0.4), 'monitor-base', 0, 0.006, 0);
  bx(g, 0.04, 0.17, 0.02, std(0x151515, 0.4), 'monitor-neck', 0, 0.1, -0.01);
  bx(g, 0.57, 0.33, 0.014, std(0x0a0a0a, 0.25), 'monitor-bezel', 0, 0.27, 0.0);
  const scr = bx(g, 0.55, 0.31, 0.004, screenMat(), 'monitor-screen', 0, 0.27, 0.0085);
  scr.userData.label = 'Monitor screen (desktop + media player)';
  hitBox(g, 0.6, 0.38, 0.14, 0.27);
  g.userData.interact = { prompt: () => '<kbd>E</kbd> use the monitor (wallpaper · YouTube · music)', run: () => openMonitor() };
  const wp = new THREE.Vector3();
  g.userData.update = (dt, { camera }) => { g.getWorldPosition(wp); wp.y += 0.3; tickMonitor(dt, camera, wp); };
  return done(g, 'monitor', 'Computer monitor');
}

function laptopObj() {
  const g = new THREE.Group(), alu = std(0x8d9096, 0.35, 0.8);
  bx(g, 0.31, 0.012, 0.215, alu, 'laptop-base', 0, 0.006, 0);
  bx(g, 0.27, 0.002, 0.09, std(0x1c1c1e, 0.7), 'laptop-keyboard', 0, 0.0135, -0.03);
  bx(g, 0.09, 0.0015, 0.055, std(0x76797e, 0.4, 0.7), 'laptop-trackpad', 0, 0.0132, 0.065);
  const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.105); g.add(lid);
  bx(lid, 0.31, 0.205, 0.006, alu, 'laptop-lid', 0, 0.1025, 0);
  bx(lid, 0.295, 0.19, 0.002, screenMat(0.8), 'laptop-screen', 0, 0.1, 0.0035);
  const OPEN = -0.28, CLOSED = 1.54;
  let open = true, ang = OPEN; lid.rotation.x = ang;
  hitBox(g, 0.36, 0.3, 0.28, 0.12);
  g.userData.interact = { prompt: () => `<kbd>E</kbd> ${open ? 'close' : 'open'} the laptop`, run: () => { open = !open; click(open ? 700 : 520, 0.05); } };
  g.userData.update = (dt) => { ang += ((open ? OPEN : CLOSED) - ang) * Math.min(1, dt * 7); lid.rotation.x = ang; };
  g.userData.persist = { get: () => open, set: (v) => { open = !!v; ang = open ? OPEN : CLOSED; lid.rotation.x = ang; } };
  return done(g, 'laptop', 'Laptop (opens and closes)');
}

function dellObj() {
  const g = new THREE.Group(), body = std(0x2e3033, 0.55, 0.3);
  rbx(g, 0.34, 0.026, 0.235, 0.006, body, 'dell-body', 0, 0.015, 0);
  bx(g, 0.336, 0.003, 0.232, std(0x1a1b1d, 0.7), 'dell-seam', 0, 0.0145, 0);
  const logo = label((c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#b9bcc2'; c.lineWidth = 6; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.4, h * 0.38, 0, 0, 7); c.stroke(); c.fillStyle = '#b9bcc2'; c.font = 'bold 46px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DELL', w / 2, h / 2 + 2); }, 256, 128);
  const plane = mk(g, new THREE.PlaneGeometry(0.09, 0.045), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.4, metalness: 0.6 }), 'dell-logo', 0, 0.0282, 0.0, [-Math.PI / 2, 0, 0]);
  plane.castShadow = false;
  for (const [x, z] of [[-0.14, -0.09], [0.14, -0.09], [-0.14, 0.09], [0.14, 0.09]]) cyl(g, 0.007, 0.007, 0.004, std(0x050505, 0.9), 'rubber-foot', x, 0.0015, z, null, 10);
  cyl(g, 0.006, 0.006, 0.22, std(0x1a1a1a, 0.5, 0.5), 'dell-hinge', 0, 0.022, -0.118, [0, 0, Math.PI / 2], 10);
  bx(g, 0.04, 0.0006, 0.03, std(0xd8d2b4, 0.9), 'worn-sticker', 0.11, 0.0283, 0.07);
  return done(g, 'dell-laptop', 'Dell laptop (old, closed, kept aside)');
}

function diaryObj() {
  const g = new THREE.Group(), cover = std(0x0d0d0f, 0.78, 0.05);
  rbx(g, 0.15, 0.024, 0.21, 0.004, cover, 'diary-cover', 0, 0.012, 0);
  bx(g, 0.138, 0.017, 0.2, std(0xe8dfc6, 0.9), 'diary-pages', 0.004, 0.012, 0.0, null);
  rbx(g, 0.152, 0.025, 0.211, 0.004, cover, 'diary-cover-top', 0, 0.0125, 0).scale.set(1, 0.18, 1);
  mk(g, rBox(0.152, 0.002, 0.211), cover, 'diary-front-board', 0, 0.0245, 0);
  bx(g, 0.012, 0.0018, 0.21, std(0x1a1a1c, 0.6), 'elastic-band', 0.048, 0.0256, 0);
  bx(g, 0.004, 0.0015, 0.06, std(0xa02020, 0.7), 'ribbon-bookmark', -0.03, 0.001, 0.12);
  bx(g, 0.012, 0.0004, 0.02, std(0x55555a, 0.5, 0.6), 'spine-emboss', -0.065, 0.0252, 0);
  return done(g, 'diary', 'Diary notebook (black cover)');
}

function iphoneObj() {
  const g = new THREE.Group(), W = 0.0719, L = 0.15, T = 0.0088;
  const alu = std(0x2f4163, 0.32, 0.8), glass = std(0x33466b, 0.22, 0.35), lens = std(0x0a0a0c, 0.08, 0.3), ring = std(0x9aa6bd, 0.25, 0.95);
  rbx(g, W, T, L, 0.011, alu, 'iphone-frame', 0, T / 2, 0);
  rbx(g, W - 0.0016, 0.0006, L - 0.0016, 0.01, glass, 'iphone-back-glass', 0, T + 0.0001, 0);
  // camera plateau across the top of the back
  rbx(g, W - 0.0016, 0.0017, 0.047, 0.008, std(0x2f4163, 0.28, 0.85), 'camera-plateau', 0, T + 0.001, -L / 2 + 0.0295);
  const py = T + 0.0027;
  for (const [x, z] of [[-0.0165, -0.0425], [0.0165, -0.0425], [0, -0.0295 + 0.0125]].map(([x, z]) => [x, z + 0.0115 - 0.003])) {
    cyl(g, 0.0112, 0.0112, 0.0014, ring, 'lens-ring', x, py, z, null, 28);
    cyl(g, 0.0088, 0.0088, 0.0018, lens, 'lens-glass', x, py + 0.0002, z, null, 28);
    cyl(g, 0.0035, 0.0035, 0.002, std(0x1b2a55, 0.05, 0.4), 'lens-reflection', x + 0.0018, py + 0.0004, z - 0.0018, null, 16);
  }
  cyl(g, 0.0032, 0.0032, 0.0012, std(0xfff2cf, 0.3), 'flash', 0.0285, py, -0.0555, null, 14);
  cyl(g, 0.0024, 0.0024, 0.0012, std(0x151515, 0.3), 'lidar', 0.0285, py, -0.0415, null, 14);
  const logo = label((c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(210,220,240,.9)'; c.beginPath(); c.arc(w / 2, h / 2 + 4, w * 0.26, 0, 7); c.fill(); c.clearRect(w * 0.55, h * 0.1, w * 0.2, h * 0.16); }, 64, 64);
  mk(g, new THREE.PlaneGeometry(0.014, 0.014), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.3, metalness: 0.7 }), 'apple-logo', 0, T + 0.0008, 0.018, [-Math.PI / 2, 0, 0]);
  return done(g, 'iphone', 'iPhone 17 Pro (deep blue, face down)');
}

function bottleObj() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, roughness: 0.08, transparent: true, opacity: 0.32, side: THREE.DoubleSide, metalness: 0 });
  const water = new THREE.MeshStandardMaterial({ color: 0x9cd3ff, roughness: 0.05, transparent: true, opacity: 0.45 });
  const R = 0.033;
  cyl(g, R, R, 0.15, plastic, 'bottle-body', 0, 0.085, 0, null, 28);
  cyl(g, R * 0.98, R * 0.98, 0.012, plastic, 'bottle-base', 0, 0.006, 0, null, 28);
  for (let i = 0; i < 3; i++) cyl(g, R * 1.04, R * 1.04, 0.004, plastic, 'bottle-ridge', 0, 0.02 + i * 0.012, 0, null, 28);
  mk(g, new THREE.CylinderGeometry(0.0125, R, 0.045, 28), plastic, 'bottle-shoulder', 0, 0.1825, 0);
  cyl(g, 0.0125, 0.0125, 0.02, plastic, 'bottle-neck', 0, 0.2175, 0, null, 20);
  cyl(g, 0.0155, 0.0155, 0.016, std(0x2f7de1, 0.45), 'bottle-cap', 0, 0.2355, 0, null, 20);
  cyl(g, R * 0.93, R * 0.93, 0.125, water, 'water', 0, 0.075, 0, null, 24);
  mk(g, new THREE.CylinderGeometry(R * 1.01, R * 1.01, 0.05, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, map: label((c, w, h) => { c.fillStyle = '#f4f8ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e6fd9'; c.fillRect(0, h * 0.62, w, h * 0.12); c.font = 'bold 30px system-ui'; c.fillStyle = '#1e6fd9'; c.textAlign = 'center'; c.fillText('PURE WATER', w * 0.5, h * 0.4); }, 256, 64) }), 'bottle-label', 0, 0.095, 0);
  return done(g, 'water-bottle', 'Water bottle');
}

export const DESK_BUILDERS = { monitor: monitorObj, laptop: laptopObj, 'dell-laptop': dellObj, diary: diaryObj, iphone: iphoneObj, 'water-bottle': bottleObj };
void monitor;
