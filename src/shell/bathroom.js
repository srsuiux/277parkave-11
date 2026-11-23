import * as THREE from 'three';
import { KITCHEN as K, BATHROOM as B } from '../config.js';
import { box } from '../materials.js';
import { buildWall } from './wall.js';
import { std, mk, bx, rb, cyl, finish, makeRadiator, wood } from '../fixtures/furniture.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { visitor } from '../visitor.js';
import { buildBathRugs } from '../fixtures/bathrug.js';
import { buildToilet } from '../fixtures/toilet.js';
import { buildScrewBulb } from '../fixtures/lights.js';
import { click } from '../audio.js';
import { fixtureMats } from '../fixtures/mats.js';
import { buildCeramicSink } from '../fixtures/ceramicsink.js';
import { buildVanityCabinet } from '../fixtures/vanity.js';

/**
 * The bathroom (IMG_1293-1298), west of the kitchen. Shell: floor, ceiling, 3 walls + a lining on the kitchen wall,
 * embossed-tile wainscot with a chair rail, arched window. Then independent objects: toilet, radiator, vanity,
 * white cabinet, trash bin, shower stall, curtain, mirrors, sconce, towel bars, toilet-roll holder.
 */
const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
let sd = 5; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

/** Clean silver tile: smooth glossy face with a faint brushed sheen and thin grout lines. No bump map, no embossing (nothing to shimmer). */
function silverTexture(n, grout = '#9ea4a8') {
  return cv(512, 512, (g, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s, y = j * s, gr = g.createLinearGradient(x, y, x + s, y + s);
      gr.addColorStop(0, '#d3d8dc'); gr.addColorStop(0.5, '#c4cace'); gr.addColorStop(1, '#cdd2d6');
      g.fillStyle = gr; g.fillRect(x, y, s, s);
    }
    g.strokeStyle = grout; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  });
}
const CURTAIN_COLORS = [['Butter yellow', '#e9d98c'], ['White', '#f2f1ec'], ['Sky blue', '#9cc6e4'], ['Sage green', '#9fc4a8'], ['Rose', '#e0a0a6'], ['Lavender', '#b9a9d6'], ['Navy', '#40527a'], ['Charcoal', '#4a4d52']];
const CURTAIN_FABRICS = [['Floral print', 0.78], ['Plain cotton', 0.8], ['Stripes', 0.78], ['Gingham check', 0.8], ['Polka dots', 0.78], ['Waves', 0.75], ['Frosted vinyl', 0.5], ['Linen weave', 0.82]];
/** Curtain fabric texture: base colour + a pattern in a darker / lighter shade of it. */
function curtainTexture(color, fabric) {
  const base = new THREE.Color(color), dark = '#' + base.clone().multiplyScalar(0.45).getHexString(), light = '#' + base.clone().lerp(new THREE.Color(1, 1, 1), 0.6).getHexString();
  const t = cv(256, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = dark; g.fillStyle = dark; g.lineWidth = 1.6;
    if (fabric === 0) { sd = 5; for (let i = 0; i < 9; i++) { const x = 30 + rnd() * 200, y = 40 + i * 52 + rnd() * 20; g.beginPath(); g.arc(x, y, 12 + rnd() * 10, 0, 7); g.stroke(); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.26) * 18, y + Math.sin(k * 1.26) * 18, 9, 4, k * 1.26, 0, 7); g.stroke(); } } }
    if (fabric === 2) for (let x = 0; x < w; x += 32) { g.fillStyle = light; g.fillRect(x, 0, 16, h); }
    if (fabric === 3) { g.globalAlpha = 0.35; g.fillStyle = dark; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h); for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 32); g.globalAlpha = 1; }
    if (fabric === 4) { g.fillStyle = light; for (let y = 20; y < h; y += 44) for (let x = (y / 44) % 2 ? 20 : 42; x < w; x += 44) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); } }
    if (fabric === 5) { g.strokeStyle = light; g.lineWidth = 3; for (let y = 10; y < h; y += 26) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 20) * 6); g.stroke(); } }
    if (fabric === 6) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, h); sd = 9; for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.18})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6); } }
    if (fabric === 7) { g.globalAlpha = 0.18; g.strokeStyle = dark; g.lineWidth = 1; for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.globalAlpha = 1; }
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);   // soft hem shadow only: clean, not dirty
  });
  return t;
}
function grimeTexture() { return cv(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const r = g.createRadialGradient(0, 0, 0, 0, 0, 12 + rnd() * 40); r.addColorStop(0, 'rgba(50,40,20,.5)'); r.addColorStop(1, 'rgba(50,40,20,0)'); g.save(); g.translate(rnd() * w, rnd() * h); g.fillStyle = r; g.fillRect(-60, -60, 120, 120); g.restore(); } }); }


/** Real planar mirror (reflects the live scene). Only re-renders its reflection when the player is near. */
function makeMirror(w, h, name) {
  const m = new Reflector(new THREE.PlaneGeometry(w, h), { color: 0xcfd6da, textureWidth: 512, textureHeight: 512, clipBias: 0.003 });
  m.name = name; m.userData.label = 'Mirror';
  const orig = m.onBeforeRender;
  const p = new THREE.Vector3();
  m.onBeforeRender = function (renderer, scene, camera, ...rest) {
    m.getWorldPosition(p);
    if (camera.position.distanceTo(p) > 6) return;
    const was = visitor.upper?.visible;
    if (visitor.upper) visitor.upper.visible = true;   // you can see yourself in the mirror
    orig.call(this, renderer, scene, camera, ...rest);
    if (visitor.upper) visitor.upper.visible = was;
  };
  return m;
}

const porcelain = () => std(0xf4f3ee, 0.14);
const brass = () => std(0x8a6a35, 0.35, 0.85);
const chrome = () => fixtureMats().chrome;

export function buildBathroom(mats) {
  const root = new THREE.Group(); root.name = 'bathroom'; root.userData.label = B.label;
  const { x0, x1, z0, z1, height: H, wallT: t, wainscot: WH } = B;
  const paint = mats.kitchenWall.clone(); paint.color.set(0xcdd3d6);
  const ceilMat = mats.ceiling.clone(); ceilMat.color.set(0xb5c1d0);
  const tileMat = new THREE.MeshStandardMaterial({ map: silverTexture(4), roughness: 0.26, metalness: 0.55 });
  const railMat = std(0xb9bbb4, 0.45);

  // ---------- walls ----------
  const wz = B.window.z, ww = B.window.w;
  const frames = {
    N: { pos: [x0, 0, z0], rotY: 0, length: x1 - x0, ext: t - 0.006, ops: [] },
    W: { pos: [x0, 0, z1], rotY: Math.PI / 2, length: z1 - z0, ext: 0, ops: [{ u0: z1 - wz - ww / 2, u1: z1 - wz + ww / 2, y0: B.window.sill, y1: B.window.top, win: true }] },
    S: { pos: [x1, 0, z1 + 0.008], rotY: Math.PI, length: x1 - x0, ext: t, ops: [] },
    E: { pos: [x1 - 0.004, 0, z0], rotY: -Math.PI / 2, length: z1 - z0, ext: 0, lining: true, ops: [{ u0: 3.25 - 0.43 - z0, u1: 3.25 + 0.43 - z0, y0: 0, y1: 2.05 }] },
  };
  const walls = new THREE.Group(); walls.name = 'walls';
  for (const [key, f] of Object.entries(frames)) {
    const wall = buildWall({ length: f.length, height: H, t: f.lining ? 0.03 : t, ext: f.ext, openings: f.ops, mat: paint, mats, baseboard: false, crown: false });
    wall.name = `wall-${key}`; wall.userData.label = `Bathroom ${ { N: 'north', S: 'south', W: 'west (window)', E: 'east (kitchen side)' }[key] } wall`;
    if (f.lining) wall.traverse((m) => { if (m.isMesh) m.userData.collider = false; });   // the kitchen wall already collides
    // tile wainscot + chair rail, skipping door cut-outs
    const cuts = f.ops.filter((o) => o.y0 < WH).sort((a, b) => a.u0 - b.u0);
    const e = { N: 0, W: 0.0008, S: 0.0016, E: 0.0024 }[key];   // distinct heights: coplanar tops overlapping at the corners would flicker
    let cur = -f.ext; const segs = [];
    for (const o of cuts) { segs.push([cur, o.u0]); cur = o.u1; } segs.push([cur, f.length + f.ext]);
    for (const [u0, u1] of segs) {
      if (u1 - u0 < 0.02) continue;
      const tile = box(u1 - u0, WH + e, 0.012, tileMat, { tile: 0.6 }); tile.position.set((u0 + u1) / 2, (WH + e) / 2, 0.006); tile.name = 'tile-wainscot'; wall.add(tile);
      const rail = box(u1 - u0, 0.05 + e, 0.03 + e, railMat, { tile: 1 }); rail.position.set((u0 + u1) / 2, WH + (0.05 + e) / 2, 0.015 + e / 2); rail.name = 'chair-rail'; wall.add(rail);
      const base = box(u1 - u0, 0.07 + e, 0.018 + e, railMat, { tile: 1 }); base.position.set((u0 + u1) / 2, (0.07 + e) / 2, 0.015 + e / 2); base.name = 'baseboard'; wall.add(base);
    }
    if (key === 'W') wall.add(arched_window(f.ops[0], t));
    wall.position.set(...f.pos); wall.rotation.y = f.rotY; walls.add(wall);
  }
  root.add(walls);

  // ---------- floor + ceiling ----------
  const floor = box(x1 - x0 + 2 * t, 0.06, z1 - z0 + t, new THREE.MeshStandardMaterial({ map: silverTexture(2, '#8f959a'), roughness: 0.3, metalness: 0.45 }), { tile: 0.6 });
  floor.position.set((x0 + x1) / 2 - t / 2 + t / 2, -0.03, (z0 + z1) / 2 - t / 2 + t / 2); floor.name = 'floor'; floor.userData.label = 'Bathroom floor (clean silver tile)'; root.add(floor);
  const ceil = box(x1 - x0 + 2 * t, 0.08, z1 - z0 + 2 * t, ceilMat); ceil.position.set((x0 + x1) / 2, H + 0.04, (z0 + z1) / 2); ceil.name = 'ceiling'; root.add(ceil);

  root.add(stall(), ...bathObjects(), sconce(), ...buildBathRugs(B));
  for (const z of [z0 + (z1 - z0) * 0.25, z0 + (z1 - z0) * 0.75]) { const fill = new THREE.PointLight(0xffe6c4, 2.2, 0, 2); fill.position.set((x0 + x1) / 2, H - 0.25, z); root.add(fill); }
  return root;

  // ---------- helpers (closures over the room) ----------
  function arched_window(o, wt) {
    const g = new THREE.Group(); g.name = 'arched-window'; g.userData.label = 'Arched window with sunburst fanlight';
    const uc = (o.u0 + o.u1) / 2, r = (o.u1 - o.u0) / 2 - 0.004, yA = o.y1 - r - 0.004, white = std(0xf2f0e8, 0.4);
    // wall-coloured spandrels fill the corners above the springing line so the opening is arched
    const sp = new THREE.Shape(); sp.moveTo(o.u0, yA); sp.lineTo(o.u0, o.y1); sp.lineTo(o.u1, o.y1); sp.lineTo(o.u1, yA); sp.absarc(uc, yA, r, 0, Math.PI, false);
    const spm = new THREE.Mesh(new THREE.ExtrudeGeometry(sp, { depth: wt, bevelEnabled: false, curveSegments: 24 }), paint); spm.position.z = -wt; spm.name = 'window-spandrels'; g.add(spm);
    // glass (dark night outside)
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1118, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 });
    const gs = new THREE.Shape(); gs.moveTo(o.u0 + 0.03, o.y0 + 0.03); gs.lineTo(o.u1 - 0.03, o.y0 + 0.03); gs.lineTo(o.u1 - 0.03, yA); gs.absarc(uc, yA, r - 0.03, 0, Math.PI, false); gs.lineTo(o.u0 + 0.03, o.y0 + 0.03);
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gs, 24), glass); gm.position.z = -wt / 2; gm.name = 'window-glass'; g.add(gm);
    // sunburst muntins
    for (let k = 1; k <= 7; k++) { const a = (k * Math.PI) / 8; const m = bx(g, 0.012, r - 0.02, 0.016, white, 'sunburst-bar', uc + Math.cos(a) * (r - 0.02) / 2, yA + Math.sin(a) * (r - 0.02) / 2, -wt / 2 + 0.005); m.rotation.z = a - Math.PI / 2; }
    bx(g, o.u1 - o.u0 - 0.04, 0.03, 0.03, white, 'sash-meeting-rail', uc, yA, -wt / 2 + 0.01);
    bx(g, o.u1 - o.u0 - 0.04, 0.045, 0.03, white, 'sash-bottom-rail', uc, o.y0 + 0.05, -wt / 2 + 0.01);
    for (const s of [-1, 1]) bx(g, 0.04, yA - o.y0, 0.03, white, 'sash-stile', uc + s * ((o.u1 - o.u0) / 2 - 0.03), (yA + o.y0) / 2, -wt / 2 + 0.01);
    // arched casing (ring) + jambs on the room side
    const ring = new THREE.Shape(); ring.absarc(uc, yA, r + 0.075, 0, Math.PI, false); ring.lineTo(uc - r, yA); ring.absarc(uc, yA, r, Math.PI, 0, true); ring.lineTo(uc + r + 0.075, yA);
    const rm = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 24 }), white); rm.position.z = 0.0; rm.name = 'arched-casing'; g.add(rm);
    for (const s of [-1, 1]) bx(g, 0.07, yA - o.y0 + 0.02, 0.03, white, 'window-jamb-casing', uc + s * (r + 0.036), (yA + o.y0) / 2, 0.015);
    bx(g, o.u1 - o.u0 + 0.3, 0.04, 0.09, std(0xe8e6dc, 0.5), 'window-sill', uc, o.y0 - 0.02, 0.045);
    mk(g, new THREE.DodecahedronGeometry(0.02, 0), std(0x9c8470, 0.9), 'sill-pebble', uc - 0.12, o.y0 + 0.02, 0.05);
    return g;
  }

  function towelBar(len, name, label) {
    const g = new THREE.Group(); g.name = name; g.userData.label = label; const b = brass();
    cyl(g, 0.0095, 0.0095, len, b, 'towel-bar', 0, 0, 0.065, [0, 0, Math.PI / 2], 14);
    for (const s of [-1, 1]) { cyl(g, 0.022, 0.026, 0.012, b, 'bar-bracket-plate', s * (len / 2 + 0.01), 0, 0.006, [Math.PI / 2, 0, 0], 16); cyl(g, 0.012, 0.012, 0.06, b, 'bar-bracket-arm', s * (len / 2), 0, 0.035, [Math.PI / 2, 0, 0], 10); }
    return g;
  }

  function stall() {
    const g = new THREE.Group(); g.name = 'shower-stall'; g.userData.label = 'Shower stall (white fibreglass, rod + curtain)';
    const sx0 = x1 - B.stall.w, sz1 = z0 + B.stall.d, gloss = std(0xf1eee4, 0.2);
    // pan, curb, drain
    bx(g, B.stall.w, 0.09, B.stall.d, gloss, 'shower-pan', (sx0 + x1) / 2, 0.045, (z0 + sz1) / 2);
    cyl(g, 0.045, 0.045, 0.004, chrome(), 'drain-plate', x1 - 0.42, 0.092, z0 + 0.5, null, 24);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cyl(g, 0.005, 0.005, 0.006, std(0x111111, 0.9), 'drain-hole', x1 - 0.42 + Math.cos(a) * 0.022, 0.0925, z0 + 0.5 + Math.sin(a) * 0.022, null, 8); }
    // fibreglass walls (north, east, and the inside of the partition)
    const fh = 1.9;
    bx(g, B.stall.w, fh, 0.014, gloss, 'stall-wall-north', (sx0 + x1) / 2, fh / 2 + 0.09, z0 + 0.007);
    bx(g, 0.014, fh, B.stall.d, gloss, 'stall-wall-east', x1 - 0.007, fh / 2 + 0.09, (z0 + sz1) / 2);
    bx(g, 0.014, fh, B.stall.d, gloss, 'stall-wall-west-inside', sx0 + 0.007, fh / 2 + 0.09, (z0 + sz1) / 2);
    // west wall of the stall (faces the toilet alcove): painted panel + tile + chair rail. The SOUTH side is the open curtain side.
    const wx = sx0 - 0.03, wd = B.stall.d;
    const panel = bx(g, 0.06, H, wd, paint, 'stall-west-wall', wx, H / 2, (z0 + sz1) / 2); panel.userData.collider = true;
    const tile = box(0.012, WH, wd - 0.02, tileMat, { tile: 0.6 }); tile.position.set(wx - 0.036, WH / 2, (z0 + sz1) / 2); tile.name = 'stall-west-tile'; g.add(tile);
    bx(g, 0.03, 0.05, wd, railMat, 'stall-west-rail', wx - 0.04, WH + 0.025, (z0 + sz1) / 2);
    // curb across the open (south) edge + trim column at the corner
    bx(g, B.stall.w, 0.14, 0.05, gloss, 'shower-curb', (sx0 + x1) / 2, 0.07, sz1 - 0.025);
    bx(g, 0.075, H - 0.05, 0.075, std(0xeeeae0, 0.5), 'stall-trim-column', sx0 - 0.03, (H - 0.05) / 2, sz1 + 0.02); bx(g, 0.09, 0.05, 0.09, std(0xdedacd, 0.5), 'column-cap', sx0 - 0.03, WH + 0.06, sz1 + 0.02);
    // small roof so the stall reads as a little room
    bx(g, B.stall.w, 0.03, B.stall.d, std(0xc4ccd2, 0.9), 'stall-roof', (sx0 + x1) / 2, 2.03, (z0 + sz1) / 2);
    // fixtures: overhead shower head (faces DOWN) on a wall arm, hot + cold handles like the kitchen sink, shelf + shampoo
    const hx = x1 - 0.42, hz = z0 + 0.5, headY = 1.86;
    const sh = new THREE.Group(); sh.name = 'shower-head'; sh.userData.label = 'Overhead shower head';
    cyl(sh, 0.011, 0.011, 0.42, chrome(), 'shower-arm-horizontal', x1 - 0.21, 1.94, hz, [0, 0, Math.PI / 2], 10);
    cyl(sh, 0.011, 0.011, 0.08, chrome(), 'shower-arm-drop', hx, 1.9, hz, null, 10);
    cyl(sh, 0.018, 0.018, 0.03, chrome(), 'shower-swivel', hx, headY + 0.015, hz, null, 14);
    cyl(sh, 0.065, 0.06, 0.014, chrome(), 'shower-head-face', hx, headY - 0.005, hz, null, 28);
    cyl(sh, 0.052, 0.052, 0.002, std(0x222222, 0.6), 'shower-nozzle-plate', hx, headY - 0.0125, hz, null, 24);
    g.add(sh);
    const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f8, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1 });
    const taps = {};
    for (const [z, nm, hex] of [[z0 + 0.34, 'hot', 0xd23b2f], [z0 + 0.66, 'cold', 0x2f6fd2]]) {
      const h = new THREE.Group(); h.name = `shower-${nm}-handle`; h.userData.label = `Shower ${nm} water handle`; h.position.set(x1 - 0.002, 1.1, z); g.add(h);
      cyl(h, 0.03, 0.03, 0.012, chrome(), 'escutcheon', -0.006, 0, 0, [0, 0, Math.PI / 2], 24);
      cyl(h, 0.019, 0.023, 0.026, chrome(), 'valve-body', -0.02, 0, 0, [0, 0, Math.PI / 2], 20);
      cyl(h, 0.009, 0.009, 0.03, chrome(), 'valve-stem', -0.045, 0, 0, [0, 0, Math.PI / 2], 12);
      const cross = new THREE.Group(); cross.name = `${nm}-cross-handle`; cross.position.set(-0.07, 0, 0); h.add(cross);
      for (let i = 0; i < 2; i++) bx(cross, 0.014, 0.056, 0.013, acrylic, 'acrylic-arm', 0, 0, 0, [i * Math.PI / 2, 0, 0]);
      cyl(cross, 0.014, 0.016, 0.014, acrylic, 'acrylic-hub', 0, 0, 0, [0, 0, Math.PI / 2], 18);
      cyl(cross, 0.0065, 0.0065, 0.002, std(hex, 0.4), 'index-disc', -0.008, 0, 0, [0, 0, Math.PI / 2], 14);
      taps[nm] = { open: false, t: 0, cross };
      h.userData.interact = { prompt: () => `<kbd>E</kbd> turn ${nm} water ${taps[nm].open ? 'off' : 'on'}`, run: () => { wakeShower(); taps[nm].open = !taps[nm].open; } };
    }
    // spray: translucent streak cone + drops
    const flowTex = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#707070'; x.fillRect(0, 0, 32, 128); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`; x.fillRect(rnd() * 30, rnd() * 128, 1.5, 6 + rnd() * 26); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xdcefff, transparent: true, opacity: 0, alphaMap: flowTex, depthWrite: false, side: THREE.DoubleSide });
    const sprayH = headY - 0.12 - 0.1;
    const spray = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.19, sprayH, 24, 1, true), sprayMat); spray.name = 'shower-spray'; spray.position.set(hx, 0.1 + sprayH / 2, hz); spray.visible = false; g.add(spray);
    flowTex.repeat.set(2, 2);
    const pan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0, depthWrite: false })); pan.rotation.x = -Math.PI / 2; pan.position.set(hx, 0.095, hz); pan.visible = false; g.add(pan);
    let sAudio = null, level = 0;
    const wakeShower = () => { try {
      if (!sAudio) { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.4; const gain = ctx.createGain(); gain.gain.value = 0; src.connect(bp); bp.connect(gain); gain.connect(ctx.destination); src.start(); sAudio = { ctx, gain }; }
      sAudio.ctx.resume(); } catch { /* no audio */ } };
    const wp = new THREE.Vector3();
    g.userData.updateShower = (dt, ctx) => {
      for (const t of Object.values(taps)) { t.t += ((t.open ? 1 : 0) - t.t) * Math.min(1, dt * 8); t.cross.rotation.x = t.t * Math.PI * 0.55; }
      const target = taps.hot.open && taps.cold.open ? 1 : (taps.hot.open || taps.cold.open) ? 0.6 : 0;
      level += (target - level) * Math.min(1, dt * 5);
      const on = level > 0.02; spray.visible = on; pan.visible = on;
      if (on) { sprayMat.opacity = 0.28 * level; flowTex.offset.y -= dt * 2.4; pan.material.opacity = 0.35 * level; }
      if (sAudio) { spray.getWorldPosition(wp); sAudio.gain.gain.value = on ? 0.05 * level / (1 + ctx.camera.position.distanceTo(wp) * 0.8) : 0; }
    };
    bx(g, 0.2, 0.014, 0.2, gloss, 'corner-shelf', x1 - 0.12, 1.28, z0 + 0.12);
    const shampoo = new THREE.Group(); shampoo.name = 'shampoo-bottle'; shampoo.position.set(x1 - 0.12, 1.28, z0 + 0.12);
    cyl(shampoo, 0.03, 0.03, 0.17, std(0x1f3a8a, 0.35), 'bottle', 0, 0.085, 0, null, 18); cyl(shampoo, 0.012, 0.012, 0.03, std(0xdedede, 0.4), 'pump', 0, 0.185, 0, null, 10); g.add(shampoo);

    // rod + draggable curtain (anchored at the west end beside the trim column; E or scroll wheel slides it open / closed)
    cyl(g, 0.011, 0.011, B.stall.w, brass(), 'curtain-rod', (sx0 + x1) / 2, 1.9, sz1 - 0.03, [0, 0, Math.PI / 2], 14);
    const CH = 1.78, SEG = 40, curtainGeo = new THREE.PlaneGeometry(1, CH, SEG, 1);
    let ci = 0, fi = 0;
    const curtainMat = new THREE.MeshStandardMaterial({ map: curtainTexture(CURTAIN_COLORS[0][1], 0), roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: CURTAIN_FABRICS[0][1], depthWrite: false });
    const look = () => { curtainMat.map?.dispose(); curtainMat.map = curtainTexture(CURTAIN_COLORS[ci][1], fi); curtainMat.opacity = CURTAIN_FABRICS[fi][1]; curtainMat.needsUpdate = true; cm.userData.label = `Shower curtain (${CURTAIN_COLORS[ci][0].toLowerCase()}, ${CURTAIN_FABRICS[fi][0].toLowerCase()})`; };
    const cm = new THREE.Mesh(curtainGeo, curtainMat);
    cm.name = 'shower-curtain'; cm.userData.label = 'Shower curtain (butter yellow, floral print)'; g.add(cm); cm.renderOrder = 2;
    const rings = []; for (let i = 0; i < 10; i++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 6, 14), std(0xd8d8d0, 0.3, 0.6)); g.add(rg); rings.push(rg); }
    let cOpen = 0, cTarget = 0; const FULL = B.stall.w - 0.06, BUNCH = 0.2;
    const pose = () => {
      const w = FULL + (BUNCH - FULL) * cOpen, amp = 0.02 + 0.05 * cOpen, p = curtainGeo.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 0.5; p.setZ(i, Math.sin(u * Math.PI * 9) * amp * (1 - (p.getY(i) + CH / 2) / CH * 0.25)); }
      p.needsUpdate = true; curtainGeo.computeVertexNormals();
      cm.scale.x = w; cm.position.set(sx0 + 0.04 + w / 2, 1.9 - CH / 2, sz1 - 0.03);
      rings.forEach((rg, i) => rg.position.set(sx0 + 0.04 + (i / 9) * w, 1.9, sz1 - 0.03));
    };
    pose();
    cm.userData.interact = {
      prompt: () => `<kbd>E</kbd> ${cTarget > 0.5 ? 'close' : 'open'} curtain &nbsp; <kbd>scroll</kbd> slide &nbsp; <kbd>C</kbd> colour <span style="opacity:.7">(${CURTAIN_COLORS[ci][0]})</span> &nbsp; <kbd>T</kbd> fabric <span style="opacity:.7">(${CURTAIN_FABRICS[fi][0]})</span>`,
      keys: { KeyC: () => { ci = (ci + 1) % CURTAIN_COLORS.length; look(); }, KeyT: () => { fi = (fi + 1) % CURTAIN_FABRICS.length; look(); } },
      run: () => { cTarget = cTarget > 0.5 ? 0 : 1; },
      wheel: (dy) => { cTarget = Math.min(1, Math.max(0, cTarget + (dy > 0 ? 0.25 : -0.25))); },
    };
    g.userData.persist = {
      get: () => ({ c: +cTarget.toFixed(2), hot: taps.hot.open, cold: taps.cold.open, ci, fi }),
      set: (v) => { ci = v.ci ?? 0; fi = v.fi ?? 0; look(); cTarget = cOpen = v.c; pose(); taps.hot.open = v.hot; taps.cold.open = v.cold; for (const t of Object.values(taps)) { t.t = t.open ? 1 : 0; t.cross.rotation.x = t.t * Math.PI * 0.55; } },
    };
    g.userData.update = (dt, ctx) => {
      if (Math.abs(cTarget - cOpen) > 0.002) { cOpen += (cTarget - cOpen) * Math.min(1, dt * 6); pose(); }
      g.userData.updateShower(dt, ctx);
    };
    return g;
  }

  function bathObjects() {
    const out = [];
    // --- toilet (north wall, in the alcove west of the stall): detailed, interactive ---
    { const g = buildToilet(); g.position.set(-1.49, 0, z0 + 0.02 + 0.36); out.push(g); }
    // --- radiator on the west wall ---
    { const g = makeRadiator({ id: 'bath-radiator', label: 'Bathroom radiator (white cast iron, 6 sections)', n: 6, W: 0.46, H: 0.64, color: 0xe7e5dc });
      g.rotation.y = Math.PI / 2; g.position.set(x0 + 0.02 + 0.06, 0, z0 + 1.0); out.push(g);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 10), std(0xdad4be, 0.6)); pipe.rotation.x = Math.PI / 2; pipe.position.set(x0 + 0.03, 0.1, z0 + 2.0); pipe.name = 'wall-pipe'; out.push(pipe); }
    // --- wall-hung white ceramic sink (as in the owner's photo): glossy china slab + oval basin + tapered skirt, chrome 4" centerset faucet ---
    { const g = buildCeramicSink(); const { w, d } = g.userData.size; g.rotation.y = Math.PI; g.position.set(-1.453, 0, z1 - 0.012 - d / 2);
      g.add(buildVanityCabinet({ sinkW: w, sinkD: d, top: g.userData.size.top }));   // wooden cupboard under the (unchanged) sink; moves with it
      g.userData.wallMount = true; finish(g, 'bath-sink', 'Bathroom sink on wooden vanity (white ceramic, hot + cold)', w, 0.82, d); out.push(g); }
    // --- small white cabinet between the door and the vanity ---
    { const g = new THREE.Group(), W = 0.46, D = 0.38, white = std(0xf1f0ea, 0.4);
      bx(g, W, 0.78, D, white, 'cabinet-carcass', 0, 0.39, 0); bx(g, W - 0.06, 0.62, 0.016, std(0xe6e5de, 0.4), 'cabinet-door', 0, 0.38, D / 2 + 0.004);
      mk(g, new THREE.SphereGeometry(0.01, 10, 8), std(0xd0d0cb, 0.3, 0.8), 'cabinet-knob', 0.16, 0.3, D / 2 + 0.02);
      bx(g, 0.26, 0.012, 0.16, std(0xdfe1e2, 0.5), 'tray', -0.05, 0.786, 0.0); bx(g, 0.05, 0.1, 0.04, std(0x2d5fa0, 0.5), 'bottle', 0.1, 0.84, -0.05); bx(g, 0.09, 0.03, 0.06, std(0x3a3a3c, 0.5), 'razor-box', -0.08, 0.81, 0.02);
      out.push(finish(g, 'bath-cabinet', 'White cabinet (beside the vanity)', W, 0.8, D)); g.position.set(x0 + 0.02 + D / 2, 0, 2.2); g.rotation.y = Math.PI / 2; }
    // --- pedal bin ---
    { const g = new THREE.Group(); cyl(g, 0.13, 0.115, 0.3, std(0xeceae4, 0.5), 'bin-body', 0, 0.15, 0, null, 28); cyl(g, 0.135, 0.135, 0.025, std(0xe2e0d8, 0.5), 'bin-lid', 0, 0.312, 0, null, 28);
      bx(g, 0.04, 0.02, 0.05, std(0xc8c6be, 0.5), 'bin-pedal', 0, 0.01, 0.14);
      out.push(finish(g, 'trash-bin', 'Pedal bin (white)', 0.28, 0.32, 0.3)); g.position.set(-0.9, 0, z0 + B.stall.d + 0.25); }
    // --- east wall (the kitchen side), just north of the door, as in IMG_1295: tile panel with a horizontal mirror strip above and a towel bar with the white hose ---
    { const g = new THREE.Group(); g.name = 'east-mirror-strip'; g.userData.label = 'Horizontal mirror strip (mirror 2 of 2) - drag the orange dots to resize'; g.userData.movable = true; g.userData.wallMount = true; g.userData.resizable = true; g.userData.maxScaleX = 1.09;
      const MW = 1.45, MH = 0.34;
      const strip = makeMirror(MW, MH, 'strip-mirror'); strip.position.z = 0.018; g.add(strip);
      bx(g, MW + 0.04, 0.02, 0.03, railMat, 'mirror-frame-top', 0, MH / 2 + 0.01, 0.015); bx(g, MW + 0.04, 0.02, 0.03, railMat, 'mirror-frame-bottom', 0, -MH / 2 - 0.01, 0.015);
      for (const sx of [-1, 1]) bx(g, 0.02, MH + 0.04, 0.03, railMat, 'mirror-frame-side', sx * (MW / 2 + 0.01), 0, 0.015);
      bx(g, MW + 0.04, MH + 0.04, 0.008, std(0x6d7276, 0.6), 'mirror-backing', 0, 0, 0.004);
      g.rotation.y = -Math.PI / 2; g.position.set(x1 - 0.018, WH + 0.05 + 0.02 + MH / 2, 1.92); out.push(g); }
    { const g = new THREE.Group(); g.name = 'towel-bar'; g.userData.label = 'Towel bar / clothes hanger (brass, full width) - drag the orange dots to resize'; g.userData.movable = true; g.userData.wallMount = true; g.userData.resizable = true; g.userData.maxScaleX = 1.09;
      const LEN = 1.45, bar = towelBar(LEN, 'towel-bar-rod', 'Towel bar'); g.add(bar);
      const ends = bar.children.filter((c) => c.name.startsWith('bar-bracket'));
      g.userData.update = () => { const k = 1 / Math.max(0.05, g.scale.x); for (const c of ends) c.scale.x = k; };   // keep the end brackets round while the bar stretches
      g.rotation.y = -Math.PI / 2; g.position.set(x1 - 0.018, 0.85, 1.92); out.push(g); }
    // --- fixed accessories ---
    { const tb = towelBar(0.6, 'window-towel-bar', 'Towel bar under the window'); tb.rotation.y = Math.PI / 2; tb.position.set(x0 + 0.002, 0.92, wz); out.push(tb);
      const tp = new THREE.Group(); tp.name = 'toilet-roll-holder'; tp.userData.label = 'Toilet-roll holder (brass) + roll';
      cyl(tp, 0.02, 0.025, 0.012, brass(), 'tp-plate', 0, 0, 0.006, [Math.PI / 2, 0, 0], 14); cyl(tp, 0.007, 0.007, 0.1, brass(), 'tp-arm', 0, 0, 0.055, [Math.PI / 2, 0, 0], 8);
      const roll = cyl(tp, 0.055, 0.055, 0.1, std(0xf7f7f3, 0.9), 'tp-roll', 0.06, 0.0, 0.06, [0, 0, Math.PI / 2], 24); void roll;
      cyl(tp, 0.016, 0.016, 0.102, std(0xc8b78a, 0.9), 'tp-core', 0.06, 0, 0.06, [0, 0, Math.PI / 2], 12);
      tp.rotation.y = Math.PI / 2; tp.position.set(x0, 0.78, z0 + 0.95); out.push(tp); }
    // --- mirror 1 of 2: tall framed mirror on the south wall, right of centre over the vanity (movable: slides along its wall) ---
    { const g = new THREE.Group(); g.name = 'vanity-mirror'; g.userData.label = 'Bathroom mirror (tall, over the vanity)';
      g.userData.movable = true; g.userData.wallMount = 'x';
      const MW = 0.5, MH = 0.86, steel = std(0x9aa1a6, 0.3, 0.8);
      const mir = makeMirror(MW, MH, 'mirror-glass'); mir.position.z = 0.012; g.add(mir);
      for (const [w, h, x, y] of [[MW + 0.04, 0.02, 0, MH / 2 + 0.01], [MW + 0.04, 0.02, 0, -MH / 2 - 0.01], [0.02, MH, -MW / 2 - 0.01, 0], [0.02, MH, MW / 2 + 0.01, 0]]) bx(g, w, h, 0.022, steel, 'mirror-frame', x, y, 0.011);
      bx(g, MW + 0.04, MH + 0.04, 0.006, std(0x6d7276, 0.6), 'mirror-backing', 0, 0, 0.003);
      g.rotation.y = Math.PI; g.position.set(-1.4, 1.66, z1 - 0.002); out.push(g); }
    return out;
  }

  /**
   * The bathroom light is a plug-in sconce: no switch. A cord runs from the sconce to a power port beside the mirror and the light is
   * on only while the plug sits in that port. Look at the plug and press E to pull it out / push it back in.
   * (Local frame: x along the wall, y up, +z out of the wall. The group faces into the room.)
   */
  function sconce() {
    const g = new THREE.Group(); g.name = 'bath-sconce'; g.userData.label = 'Plug-in wall sconce (grey) with power port and cord';
    const gr = std(0x8f969c, 0.4, 0.5), dark = std(0x2b2d30, 0.5, 0.4), ivory = std(0xe9e5d6, 0.5), slot = std(0x050505, 0.9), brass = std(0xc9a24a, 0.3, 0.9), cordM = std(0xe6e3da, 0.6);
    rb(g, 0.09, 0.11, 0.025, 0.02, gr, 'sconce-backplate', 0, 0, 0.0125);
    cyl(g, 0.014, 0.016, 0.07, gr, 'sconce-arm', 0, 0, 0.06, [Math.PI / 2, 0, 0], 12);
    mk(g, new THREE.SphereGeometry(0.026, 14, 10), gr, 'sconce-elbow', 0, 0, 0.095);
    cyl(g, 0.02, 0.022, 0.07, dark, 'sconce-socket', 0, 0.045, 0.095, null, 14);
    // cord grommet where the cable leaves the base of the sconce
    cyl(g, 0.007, 0.008, 0.012, dark, 'cord-grommet', 0, -0.058, 0.03, null, 10);

    // ---- electrical state: the plug IS the switch ----
    const st = { u: 0, target: 0, delay: 0, power: 1 };    // u: 0 = plug in the port, 1 = hanging free
    const bulb = buildScrewBulb({ theta0: 300, power: () => st.power }); bulb.position.set(0, 0.08, 0.095); g.add(bulb);

    // ---- power port beside the mirror (world x -1.0, y 1.30) ----
    const PX = 0.28, PY = -0.22;
    const port = new THREE.Group(); port.name = 'light-power-port'; port.userData.label = 'Power port (bathroom light)'; port.position.set(PX, PY, 0); g.add(port);
    rb(port, 0.075, 0.12, 0.008, 0.006, ivory, 'port-plate', 0, 0, 0.004);
    const face = rb(port, 0.04, 0.05, 0.002, 0.004, std(0xdad6c6, 0.6), 'port-face', 0, 0, 0.0085); void face;
    for (const s of [-1, 1]) bx(port, 0.0035, 0.013, 0.003, slot, 'port-slot', s * 0.008, 0.004, 0.0095);
    cyl(port, 0.0035, 0.0035, 0.003, slot, 'port-ground', 0, -0.013, 0.0095, [Math.PI / 2, 0, 0], 8);
    for (const y of [0.048, -0.048]) cyl(port, 0.0045, 0.0045, 0.002, std(0xbfb9a8, 0.5, 0.5), 'port-screw', 0, y, 0.0085, [Math.PI / 2, 0, 0], 10);

    // ---- plug: prongs point to -z, cord leaves from the rear-bottom ----
    const plug = new THREE.Group(); plug.name = 'light-plug'; plug.userData.label = 'Light plug';
    rb(plug, 0.036, 0.05, 0.028, 0.008, ivory, 'plug-body', 0, 0, 0.026);
    rb(plug, 0.03, 0.044, 0.006, 0.003, std(0xd8d4c4, 0.5), 'plug-collar', 0, 0, 0.0095);
    for (const s of [-1, 1]) bx(plug, 0.0032, 0.013, 0.02, brass, 'plug-prong', s * 0.008, 0.004, -0.004);
    bx(plug, 0.003, 0.003, 0.018, brass, 'plug-ground-pin', 0, -0.013, -0.003);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), new THREE.MeshBasicMaterial({ visible: false })); hit.visible = false; hit.position.set(0, 0, 0.025); hit.name = 'plug-hit'; plug.add(hit);
    g.add(plug);
    const ANCH = new THREE.Vector3(0, -0.02, 0.04);          // where the cord enters the plug (plug-local)
    const cord = new THREE.Mesh(new THREE.BufferGeometry(), cordM); cord.name = 'light-cord'; cord.castShadow = true; g.add(cord);
    const S = new THREE.Vector3(0, -0.062, 0.03);            // cord start at the sconce base
    const E_HANG = new THREE.Vector3(0.1, -0.5, 0.06);       // where the cord end hangs when unplugged
    const LEN = 0.56;                                        // cord length
    const P0 = new THREE.Vector3(PX, PY, 0.0095), P1 = new THREE.Vector3(PX, PY - 0.012, 0.15);
    const ease = (x) => x * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
    const tmpE = new THREE.Vector3(), tmpA = new THREE.Vector3(), eul = new THREE.Euler();
    function pose() {
      const u = st.u, s1 = ease(Math.min(1, u / 0.35)), s2 = ease(Math.max(0, (u - 0.35) / 0.65));
      // hanging pose: plug upside-down-ish (prongs down), cord end at E_HANG
      const th = -Math.PI / 2 * s2; eul.set(th, 0, 0); plug.rotation.copy(eul);
      const hangPos = tmpA.copy(ANCH).applyEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).multiplyScalar(-1).add(E_HANG).clone();
      const pos = new THREE.Vector3().lerpVectors(P0, P1, s1); pos.lerp(hangPos, s2); plug.position.copy(pos);
      // cord: from the sconce base to the plug anchor, with slack that sags under gravity (never past the length)
      const E = tmpE.copy(ANCH).applyEuler(eul).add(plug.position);
      const d = Math.max(0.02, E.distanceTo(S)), sag = Math.sqrt(Math.max(0, 3 * d * Math.max(0, LEN - d) / 8));
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, p = new THREE.Vector3().lerpVectors(S, E, t), bow = 4 * t * (1 - t);
        p.y -= sag * bow * 0.9; p.x += sag * bow * 0.25; p.z = Math.max(0.034, p.z + 0.012 * bow);   // stays off the wall and the tile rail
        if (i === 0) p.copy(S); pts.push(p);
      }
      cord.geometry.dispose(); cord.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0034, 6, false);
    }
    pose();
    const inPort = () => st.u < 0.08 && st.target === 0;
    plug.userData.interact = {
      reach: 'grab',
      prompt: () => st.target === 0 ? '<kbd>E</kbd> pull the plug out (light off)' : '<kbd>E</kbd> plug the light back in',
      run: () => { st.target = 1 - st.target; st.delay = 0.5; },   // the hand gets there first, then the plug moves
    };
    g.userData.update = (dt) => {
      if (st.delay > 0) st.delay -= dt;
      else if (st.u !== st.target) {
        const before = st.u; st.u += Math.sign(st.target - st.u) * dt / 1.1; if ((st.target - before) * (st.target - st.u) <= 0) st.u = st.target;
        if (before < 0.12 && st.u >= 0.12 || before > 0.04 && st.u <= 0.04) click(before < st.u ? 1100 : 1500, 0.06);
        pose();
      }
      st.power += ((st.u < 0.12 ? 1 : 0) - st.power) * Math.min(1, dt * 20);   // contact is made only while the prongs are in the slots
    };
    g.userData.persist = undefined;
    g.rotation.y = Math.PI; g.position.set(-0.72, 1.52, z1 - 0.002);
    return g;
  }
}
