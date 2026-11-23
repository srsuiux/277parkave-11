import * as THREE from 'three';
import { fixtureMats } from './mats.js';

/**
 * Wall-hung vitreous-china bathroom sink (single glossy white piece: thick rounded slab deck, shallow oval basin, tapered
 * skirt below, low raised back wall) with a 4" centerset chrome faucet: two cross handles + spout + pop-up knob.
 * Handles turn, water runs into the basin, splashes, makes sound (same behaviour as the kitchen sink).
 * Origin: centre of the 20" x 18" footprint, y = floor. The rim top is at RIM (about 31" off the floor), +z = towards the room.
 */
const IN = 0.0254, RIM = 0.8;
const W = 20 * IN, D = 18 * IN, SLAB = 1.5 * IN;
const BX = 7 * IN, BZ = 5 * IN, BCZ = 1.5 * IN, DEPTH = 5 * IN;     // basin radii (14" x 10"), centre offset, depth
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

function ring(w, d, zc, r, n = 8) {   // rounded-rectangle outline, same point count whatever the size
  const pts = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], k) => { for (let i = 0; i <= n; i++) { const a = (k + i / n) * Math.PI / 2; pts.push([sx * (w / 2 - r) + r * Math.cos(a), zc + sz * (d / 2 - r) + r * Math.sin(a)]); } });
  return pts;
}
function roundedShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const bowlY = (z) => { const q = Math.min(1, Math.abs((z - BCZ) / BZ)); return RIM - DEPTH * Math.sqrt(Math.max(0, 1 - q ** 4)); };

function flowTexture() { const c = document.createElement('canvas'); c.width = 16; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, 16, 128);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`; x.fillRect(Math.random() * 14, Math.random() * 128, 2 + Math.random() * 3, 4 + Math.random() * 22); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

export function buildCeramicSink() {
  const M = fixtureMats(), g = new THREE.Group();
  const china = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const add = (m, name, x = 0, y = 0, z = 0, parent = g) => { m.position.set(x, y, z); m.name = name; shadowed(m); parent.add(m); return m; };

  // deck: thick rounded slab with the basin cut out, soft rounded top edge
  const shape = roundedShape(W, D, 3 * IN), hole = new THREE.Path(); hole.absellipse(0, -BCZ, BX, BZ, 0, Math.PI * 2, true);   // shape y = -z after the rotation
  shape.holes.push(hole);
  const slabG = new THREE.ExtrudeGeometry(shape, { depth: SLAB - 0.008, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 4, curveSegments: 24 }); slabG.rotateX(-Math.PI / 2);
  add(new THREE.Mesh(slabG, china), 'sink-deck', 0, RIM - SLAB, 0);

  // tapered skirt: 20" x 18" at the deck down to 15" x 11" at the bottom, flat against the wall
  const N = 8, top = ring(W - 0.012, D - 0.012, 0, 3 * IN, N), bot = ring(15 * IN, 11 * IN, -D / 2 + 5.5 * IN, 2.2 * IN, N), yT = RIM - SLAB + 0.004, yB = RIM - 8 * IN;
  const pos = [], idx = [], n = top.length;
  top.forEach(([x, z]) => pos.push(x, yT, z)); bot.forEach(([x, z]) => pos.push(x, yB, z));
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + i, j, n + j, n + i); }
  const cy = pos.length / 3; pos.push(0, yB, -D / 2 + 5.5 * IN); for (let i = 0; i < n; i++) idx.push(cy, n + ((i + 1) % n), n + i);
  const skirtG = new THREE.BufferGeometry(); skirtG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); skirtG.setIndex(idx); skirtG.computeVertexNormals();
  add(new THREE.Mesh(skirtG, china), 'sink-skirt');

  // basin: shallow oval, flat-ish floor curving up to the rim
  const rings = 14, segs = 56, bp = [], bi = [];
  for (let r = 0; r <= rings; r++) { const q = r / rings; for (let s = 0; s <= segs; s++) { const a = (s / segs) * Math.PI * 2; bp.push(BX * q * Math.cos(a), RIM - DEPTH * Math.sqrt(1 - q ** 4) - 0.0005, BCZ + BZ * q * Math.sin(a)); } }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + segs + 1; bi.push(a, a + 1, b, a + 1, b + 1, b); }
  const bowlG = new THREE.BufferGeometry(); bowlG.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bowlG.setIndex(bi); bowlG.computeVertexNormals();
  add(new THREE.Mesh(bowlG, china), 'sink-basin');

  // low curved back wall (higher in the middle, blending into the sides)
  const rs = new THREE.Shape(); rs.moveTo(-W / 2 + 0.02, 0); rs.lineTo(W / 2 - 0.02, 0); rs.quadraticCurveTo(W / 2 - 0.04, 0.012, W / 4, 0.03); rs.quadraticCurveTo(0, 0.062, -W / 4, 0.03); rs.quadraticCurveTo(-W / 2 + 0.04, 0.012, -W / 2 + 0.02, 0);
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3 }), china), 'sink-back-wall', 0, RIM - 0.002, -D / 2 + 0.004);

  // drain: chrome ring + small grate + dark hole, 2.5" from the front of the basin
  const dz = BCZ + BZ - 2.5 * IN, dy = bowlY(dz);
  const dr = new THREE.Mesh(new THREE.TorusGeometry(0.0155, 0.0032, 10, 28), M.chrome); dr.rotation.x = Math.PI / 2; add(dr, 'drain-ring', 0, dy + 0.002, dz);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.002, 28), M.black), 'drain-hole', 0, dy + 0.001, dz);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.0015, 24), M.chrome), 'drain-grate', 0, dy + 0.0025, dz);

  // faucet: 3 holes at z = -5.5" ... on the back deck
  const faucet = new THREE.Group(); faucet.name = 'faucet'; faucet.userData.label = 'Chrome faucet (4" centerset)'; faucet.position.set(0, RIM, -D / 2 + 3.2 * IN); g.add(faucet);
  const fz = -D / 2 + 3.2 * IN;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0135, 0.007, 24), M.chrome), 'spout-base', 0, 0.0035, 0, faucet);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.0125, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.chrome), 'spout-dome', 0, 0.007, 0, faucet);
  const spout = new THREE.Group(); spout.position.set(0, 0.012, 0); faucet.add(spout);
  const body = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.056), M.chrome), 'spout-body', 0, 0.012, 0.02, spout); body.rotation.x = 0.28;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0135, 0.026, 16), M.chrome), 'spout-neck', 0, 0.006, 0, spout);
  const tipZ = 0.052, tipY = 0.012 + 0.004;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0075, 0.006, 18), M.chrome), 'aerator', 0, tipY, tipZ, spout);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.002, 16), M.black), 'aerator-face', 0, tipY - 0.0025, tipZ, spout);
  const handles = {};
  for (const [side, name, hex] of [[-1, 'hot', 0xd23b2f], [1, 'cold', 0x2f6fd2]]) {
    const hg = new THREE.Group(); hg.name = `faucet-handle-${name}`; hg.userData.label = `${name === 'hot' ? 'Hot' : 'Cold'} water handle`; hg.position.set(side * 2 * IN, 0, 0); faucet.add(hg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.0127, 0.0135, 0.0076, 24), M.chrome), `${name}-base`, 0, 0.0038, 0, hg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0125, 0.0254, 20), M.chrome), `${name}-column`, 0, 0.0203, 0, hg);
    const cross = new THREE.Group(); cross.name = `${name}-cross-handle`; cross.position.y = 0.037; hg.add(cross);
    for (let i = 0; i < 4; i++) { const a = new THREE.Group(); a.rotation.y = i * Math.PI / 2; cross.add(a);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0052, 0.015, 12), M.chrome), `${name}-arm-${i + 1}`, 0.0125, 0, 0, a).rotation.z = Math.PI / 2;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.0072, 14, 10), M.chrome), `${name}-arm-flare-${i + 1}`, 0.021, 0, 0, a); }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.0085, 16, 10), M.chrome), `${name}-hub`, 0, 0.0005, 0, cross);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 14), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4 })), `${name}-index`, 0, 0.0085, 0, cross);
    handles[name] = { open: false, t: 0, cross };
  }
  // pop-up knob behind the spout
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.026, 8), M.chrome), 'popup-stem', 0, 0.013, -0.02, faucet);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.0064, 14, 10), M.chrome), 'popup-knob', 0, 0.028, -0.02, faucet);

  // water
  const tipX = 0, tipWZ = fz + tipZ, tipTopY = RIM + tipY - 0.002, floorY = bowlY(tipWZ) + 0.001, len = tipTopY - floorY;
  const flow = flowTexture(); flow.repeat.set(1, 3);
  const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0, roughness: 0.05, clearcoat: 1, alphaMap: flow, depthWrite: false });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0042, len, 12, 1, true), streamMat); stream.position.set(tipX, (tipTopY + floorY) / 2, tipWZ); stream.visible = false; stream.name = 'water-stream'; g.add(stream);
  const filmMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0, roughness: 0.02, clearcoat: 1, depthWrite: false });
  const film = new THREE.Mesh(new THREE.CircleGeometry(1, 32), filmMat); film.scale.set(BX * 0.55, BZ * 0.55, 1); film.rotation.x = -Math.PI / 2; film.position.set(0, bowlY(BCZ) + 0.002, BCZ); film.visible = false; film.name = 'water-film'; g.add(film);
  const splashMat = new THREE.MeshStandardMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.75, roughness: 0.1 }), drops = [];
  for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 6, 5), splashMat); d.visible = false; d.name = 'water-splash-drop'; g.add(d); drops.push({ m: d, age: Math.random(), vx: 0, vy: 0, vz: 0 }); }

  let audio = null;
  const ensureAudio = () => { if (audio) return audio; const ctx = new (window.AudioContext || window.webkitAudioContext)(), buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.45;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const gain = ctx.createGain(); gain.gain.value = 0; src.connect(bp); bp.connect(hp); hp.connect(gain); gain.connect(ctx.destination); src.start(); audio = { ctx, gain }; return audio; };
  const anyOpen = () => handles.hot.open || handles.cold.open, wake = () => { try { ensureAudio().ctx.resume(); } catch { /* no audio */ } };
  for (const [name, h] of Object.entries(handles)) faucet.getObjectByName(`faucet-handle-${name}`).userData.interact = { prompt: () => `<kbd>E</kbd> turn ${name} water ${h.open ? 'off' : 'on'}`, run: () => { wake(); h.open = !h.open; } };
  faucet.userData.interact = { prompt: () => `<kbd>E</kbd> turn water ${anyOpen() ? 'off' : 'on'}`, run: () => { wake(); const v = !anyOpen(); handles.hot.open = handles.cold.open = v; } };

  const world = new THREE.Vector3(); let level = 0;
  g.userData.update = (dt, ctx) => {
    for (const h of Object.values(handles)) { h.t += ((h.open ? 1 : 0) - h.t) * Math.min(1, dt * 8); h.cross.rotation.y = h.t * Math.PI * 0.55; }
    level += ((handles.hot.open && handles.cold.open ? 1 : anyOpen() ? 0.7 : 0) - level) * Math.min(1, dt * 6);
    const on = level > 0.02; stream.visible = on; film.visible = on;
    if (on) { streamMat.opacity = 0.85 * level; const r = 0.55 + 0.45 * level; stream.scale.set(r, 1, r); flow.offset.y -= dt * 2.2; filmMat.opacity = 0.3 * level; }
    for (const d of drops) {
      if (!on) { d.m.visible = false; continue; }
      d.age += dt * 1.8; if (d.age >= 1) { d.age = 0; const a = Math.random() * 6.28, sp = (0.02 + Math.random() * 0.04) * level; d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 0.1 + Math.random() * 0.14; }
      const t = d.age * 0.4; d.m.visible = true; d.m.position.set(tipX + d.vx * t * 5, floorY + 0.003 + Math.max(0, d.vy * t - 4.9 * t * t), tipWZ + d.vz * t * 5); d.m.scale.setScalar(1 - d.age * 0.5);
    }
    if (audio) { g.getWorldPosition(world); audio.gain.gain.setTargetAtTime((0.22 * level) / (1 + ctx.camera.position.distanceTo(world) * 1.1), audio.ctx.currentTime, 0.08); }
  };
  g.userData.persist = { get: () => [handles.hot.open, handles.cold.open], set: (v) => { handles.hot.open = !!v[0]; handles.cold.open = !!v[1]; for (const h of Object.values(handles)) { h.t = h.open ? 1 : 0; h.cross.rotation.y = h.t * Math.PI * 0.55; } } };
  g.userData.size = { w: W, d: D, top: RIM };
  return g;
}
