import * as THREE from 'three';
import { BEDROOM as R, KITCHEN as K } from '../config.js';
import { box } from '../materials.js';
import { buildWall } from './wall.js';
import { createDoor } from '../parts/door.js';
import { std, wood, mk, bx, rb, cyl, finish, makeRadiator } from '../fixtures/furniture.js';
import { buildStorageTable } from '../fixtures/storagetable.js';
import { buildBathRug } from '../fixtures/bathrug.js';
import { paintable } from '../paint.js';
import { buildSocketPlate } from '../fixtures/power.js';
import { buildWinter } from './winterscene.js';
import { markGlow } from '../glowmarks.js';

/** Lights level of the bedroom (0 = bulbs off) - main.js dims the room's ambient light from it, the window turns the weather into a moonlit night. */
export const bedroomState = { level: 1, curtain: 0 };
/** Same for the closet bulb (pull-switch on the bedroom wall beside the closet door). */
export const closetState = { level: 1 };

/**
 * The bedroom, south of the kitchen. Entering through the kitchen's south door you face the far (south) wall:
 *   LEFT  (east wall): door to the closet / storage room      RIGHT (west wall): glass window with curtains, radiator, AC
 *   two single mattresses with blankets, a small brown sofa, a study table + chair, wall heater, ceiling fan with bulbs,
 *   and one soft rug over the whole floor. Everything loose is a movable object (Layout mode, L) and colours are editable (X).
 */
const wallCollider = (parent, w, h, d, x, y, z) => { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false })); c.position.set(x, y, z); c.userData.collider = true; c.name = 'collider'; parent.add(c); return c; };

export function buildBedroom(mats) {
  const root = new THREE.Group(); root.name = 'bedroom'; root.userData.label = R.label;
  const ctl = {};   // controls shared between the fan, the AC and the wall switch
  const { x0, x1, z0, z1, height: H, wallT: t } = R, W = K.width, cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
  const cl = R.closet, cx0 = x1 + t, cx1 = cx0 + cl.w, cz0 = z0 + cl.dz0, cz1 = cz0 + cl.d;
  const win = R.window, WL = z1 - z0 - 2 * win.pad, winZ = (z0 + z1) / 2, NCOL = 3, COLW = (WL - (NCOL - 1) * 0.05) / NCOL, doorZ = cz0 + cl.doorDz;

  // ---------------- shell ----------------
  const walls = new THREE.Group(); walls.name = 'bedroom-walls'; root.add(walls);
  const wall = (name, pos, rotY, length, ext, openings = [], fixtures = []) => {
    const w = buildWall({ length, height: H, t, ext, openings, mat: mats.kitchenWall, mats }); w.name = name; w.position.set(...pos); w.rotation.y = rotY;
    for (const f of fixtures) { f.position.x = f.userData.u; w.add(f); } walls.add(w); return w;
  };
  // north wall: the kitchen's south wall (with the bedroom door) covers x 0..3; on the left the bathroom's outside wall is dressed in bedroom paint (offset 4 mm so the faces never z-fight)
  wall('wall-N-left', [x0, 0, z0 + 0.004], 0, -t - x0, 0);
  wall('wall-N-right', [W + t, 0, z0 + 0.004], 0, x1 - (W + t), t);
  wall('wall-S', [x1, 0, z1], Math.PI, x1 - x0, t);
  // west wall: glass window
  const wu = z1 - winZ;
  const winObj = slidingWindow(WL, win.h, NCOL, t, mats); winObj.userData.u = wu; winObj.position.y = win.sill;
  wall('wall-W', [x0, 0, z1], Math.PI / 2, z1 - z0, 0, [{ u0: wu - WL / 2, u1: wu + WL / 2, y0: win.sill, y1: win.sill + win.h }], [winObj]);
  // east wall: closet door (opens into the bedroom, like the other doors)
  const eu = doorZ - z0, DW = cl.doorW, DH = cl.doorH;
  const cdoor = createDoor({ w: DW, h: DH, t, color: 0xf1efe8, hinge: 'left', hardware: 'entry', maxOpen: 100, label: 'Closet door (east wall)', mats }); cdoor.name = 'closet-door'; cdoor.userData.u = eu;
  wall('wall-E', [x1, 0, z0], -Math.PI / 2, z1 - z0, 0, [{ u0: eu - (DW + 0.04) / 2, u1: eu + (DW + 0.04) / 2, y0: 0, y1: DH + 0.02 }], [cdoor]);

  const floor = box(x1 - x0 + t * 2, 0.06, z1 - z0 + t * 2, mats.floor, { tile: 1 }); floor.position.set(cxm, -0.03, czm); floor.name = 'bedroom-floor'; root.add(floor);
  const ceil = box(x1 - x0 + t * 2, 0.08, z1 - z0 + t * 2, mats.ceiling); ceil.position.set(cxm, H + 0.04, czm); ceil.name = 'bedroom-ceiling'; root.add(ceil);

  // ---------------- closet room ----------------
  const closet = new THREE.Group(); closet.name = 'closet'; closet.userData.label = 'Closet / storage room'; root.add(closet);
  const cwall = (name, pos, rotY, length, ext) => { const w = buildWall({ length, height: H, t, ext, mat: mats.kitchenWall, mats }); w.name = name; w.position.set(...pos); w.rotation.y = rotY; closet.add(w); };
  cwall('closet-wall-N', [cx0, 0, cz0], 0, cl.w, t - 0.006); cwall('closet-wall-S', [cx1, 0, cz1], Math.PI, cl.w, t - 0.006); cwall('closet-wall-E', [cx1, 0, cz0], -Math.PI / 2, cl.d, 0);
  const cfloor = box(cl.w + t * 2, 0.06, cl.d + t * 2, mats.floor, { tile: 1 }); cfloor.position.set((cx0 + cx1) / 2, -0.03, (cz0 + cz1) / 2); closet.add(cfloor);
  const cceil = box(cl.w + t * 2, 0.08, cl.d + t * 2, mats.ceiling); cceil.position.set((cx0 + cx1) / 2, H + 0.04, (cz0 + cz1) / 2); closet.add(cceil);
  const cl1 = new THREE.PointLight(0xffe2b8, 2.4, 0, 2); cl1.position.set((cx0 + cx1) / 2, H - 0.3, (cz0 + cz1) / 2); closet.add(cl1);
  // hanging rail along the east wall with clothes, a shelf above, a bare bulb
  const steel = std(0xb9bcc0, 0.3, 0.8), rx = cx1 - 0.32;
  cyl(closet, 0.014, 0.014, cl.d - 0.1, steel, 'clothes-rail', rx, 1.72, (cz0 + cz1) / 2, [Math.PI / 2, 0, 0], 12);
  bx(closet, 0.5, 0.03, cl.d - 0.05, wood('#8a6a46', '#4a3320'), 'closet-top-shelf', cx1 - 0.27, 1.95, (cz0 + cz1) / 2);
  const palette = [0x2f3f6b, 0xd9d6cc, 0x7a2f2f, 0x2d2f33, 0x3f6b4a, 0xb8a27a, 0x4a4e57, 0x8fb0c8, 0xc98a3c, 0x5a3f6b];
  for (let i = 0; i < 22; i++) {
    const z = cz0 + 0.18 + i * ((cl.d - 0.36) / 21), len = 0.55 + (i % 3) * 0.14, c = palette[(i * 3) % palette.length];
    cyl(closet, 0.004, 0.004, 0.1, steel, 'hanger-hook', rx, 1.69, z, null, 6);
    rb(closet, 0.46, len, 0.05, 0.018, std(c, 0.9), 'garment', rx, 1.64 - len / 2, z);
  }
  for (let i = 0; i < 7; i++) rb(closet, 0.32, 0.18, 0.4, 0.012, std([0xc9b99a, 0xa8b8c8, 0xd8c8b0, 0x9aa88f, 0xbfae98, 0xd2c4a6, 0xa4b2a0][i], 0.9), 'storage-box', cx1 - 0.27, 2.06, cz0 + 0.35 + i * 0.4);
  // open shelving along the north wall
  for (let i = 0; i < 4; i++) bx(closet, 0.9, 0.025, 0.36, wood('#8a6a46', '#4a3320'), 'closet-shelf', cx0 + 0.5, 0.3 + i * 0.5, cz0 + 0.2);
  for (const sx of [-1, 1]) bx(closet, 0.025, 1.85, 0.36, wood('#7a5a3a', '#3a2412'), 'closet-upright', cx0 + 0.5 + sx * 0.455, 0.93, cz0 + 0.2);
  [[0.325, 0xd9d1c0], [0.325, 0xb9c4cf], [0.825, 0x8a6f55], [0.825, 0xcdbfa4], [1.325, 0x7d8f7a], [1.325, 0xd7c19a]].forEach(([y, c], i) => rb(closet, 0.36, 0.2, 0.3, 0.015, std(c, 0.9), 'folded-stack', cx0 + 0.28 + (i % 2) * 0.46, y + 0.115, cz0 + 0.2));
  wallCollider(closet, 0.95, 1.9, 0.38, cx0 + 0.5, 0.95, cz0 + 0.2);                       // shelving
  wallCollider(closet, 0.36, 2.0, cl.d - 0.1, rx + 0.06, 1.0, (cz0 + cz1) / 2);                   // hanging clothes
  const early = [];   // movables built before `out` exists
  // ceiling bulb in a porcelain holder; switched from the wall beside the closet door
  const cbx = (cx0 + cx1) / 2, cbz = cz0 + 1.1;
  const cbMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 2.4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), cbMat); bulb.name = 'closet-bulb'; bulb.position.set(cbx, H - 0.14, cbz); closet.add(bulb);
  cyl(closet, 0.03, 0.03, 0.03, std(0xf0ede4, 0.4), 'bulb-holder', cbx, H - 0.095, cbz, null, 20); cyl(closet, 0.045, 0.045, 0.01, std(0xf0ede4, 0.4), 'bulb-ceiling-rose', cbx, H - 0.005, cbz, null, 24);
  cl1.position.set(cbx, H - 0.25, cbz);
  let cOn = true, cLv = 1;
  closet.userData.update = (dt) => { cLv += ((cOn ? 1 : 0) - cLv) * Math.min(1, dt * 10); cbMat.emissiveIntensity = cLv * 2.4; cl1.intensity = cLv * 2.4; closetState.level = cLv; };
  {
    const g = new THREE.Group(), plate = markGlow(std(0xeeebe0, 0.5)), rockM = markGlow(std(0xf7f5ee, 0.35));
    bx(g, 0.08, 0.125, 0.008, plate, 'switch-plate', 0, 0, 0.004);
    const r = new THREE.Group(); r.name = 'rocker-closet'; r.position.set(0, 0, 0.008); g.add(r); bx(r, 0.026, 0.056, 0.012, rockM, 'rocker-cap', 0, 0, 0.006);
    const led = mk(r, new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffb050, emissiveIntensity: 0 }), 'rocker-led', 0, 0.036, 0.002);
    r.userData.interact = { prompt: () => `<kbd>E</kbd> closet light ${cOn ? 'off' : 'on'}`, run: () => { cOn = !cOn; } };
    r.userData.update = () => { r.rotation.x += ((cOn ? 0.22 : -0.22) - r.rotation.x) * 0.35; led.material.emissiveIntensity = cOn ? 2 : 0; };
    g.name = 'closet-switch'; g.userData.label = 'Closet light switch'; g.userData.movable = true; g.userData.wallMount = 'any'; g.userData.wallGap = 0.006;
    g.userData.persist = { get: () => cOn, set: (v) => { cOn = !!v; cLv = cOn ? 1 : 0; } };
    g.position.set(x1 - 0.006, 1.2, doorZ + 0.39 + 0.22); g.rotation.y = -Math.PI / 2; early.push(g);
  }

  // ---------------- movable objects ----------------
  const out = [...early];
  const place = (g, x, z, rotDeg = 0, y = 0) => { g.position.set(x, y, z); g.rotation.y = THREE.MathUtils.degToRad(rotDeg); out.push(g); return g; };

  // --- two single mattresses, each with pillow + blanket ---
  const bed = (id, label, blanketHex, stacked = false) => {
    const g = new THREE.Group(), L = 1.95, Bw = 0.95, up = stacked ? 0.15 : 0;
    const mat = std(0xf0ece2, 0.95), pil = std(0xffffff, 0.9), bl = std(blanketHex, 0.95), base = std(0x5a4636, 0.7);
    bx(g, Bw - 0.05, 0.03, L - 0.05, base, 'bed-base', 0, 0.015, 0);
    // stacked: a firm lower mattress with the softer sleeping mattress on top; each has its own seam, piping and tone
    const lowM = std(0xbdb8aa, 0.95), seam = std(0x8f8a7c, 0.9);
    if (stacked) {
      rb(g, Bw, 0.15, L, 0.045, lowM, 'mattress-lower', 0, 0.105, 0);
      rb(g, Bw + 0.004, 0.012, L + 0.004, 0.005, seam, 'mattress-lower-piping', 0, 0.185, 0);
      rb(g, Bw - 0.03, 0.17, L - 0.04, 0.05, mat, 'mattress', 0, 0.29, 0);
      rb(g, Bw - 0.026, 0.01, L - 0.036, 0.004, seam, 'mattress-upper-piping', 0, 0.2, 0);
    } else rb(g, Bw, 0.2, L, 0.05, mat, 'mattress', 0, 0.13, 0);
    rb(g, 0.52, 0.12, 0.34, 0.05, pil, 'pillow', 0, 0.29 + up, -L / 2 + 0.28);
    rb(g, Bw + 0.03, 0.06, 1.3, 0.03, bl, 'blanket', 0, 0.255 + up, 0.3);
    for (const s of [-1, 1]) rb(g, 0.035, 0.2, 1.3, 0.016, bl, 'blanket-drape', s * (Bw / 2 + 0.012), 0.16 + up, 0.3);
    rb(g, Bw + 0.03, 0.05, 0.2, 0.02, bl, 'blanket-fold', 0, 0.3 + up, -0.36);
    rb(g, Bw + 0.03, 0.2, 0.05, 0.016, bl, 'blanket-foot', 0, 0.16 + up, 0.3 + 0.65);
    finish(g, id, label, Bw + 0.06, 0.36 + up, L);
    return paintable(g, [{ label: 'Blanket', mats: [bl] }, { label: 'Mattress', mats: [mat] }, ...(stacked ? [{ label: 'Lower mattress', mats: [lowM] }] : []), { label: 'Pillow', mats: [pil] }]);
  };
  place(bed('bed-1', "Roommate's mattress (single, with blanket)", 0x7a8fb0), cxm - 0.65, z1 - 0.02 - 0.975, 180);
  place(bed('bed-2', 'My bed (two stacked mattresses, with blanket)', 0xb08a7a, true), cxm + 0.45, z1 - 0.02 - 0.975, 180);

  // --- bedside storage table with a hinged lid, beside my bed next to the east-wall USB outlet ---
  place(buildStorageTable(), x1 - 0.23, 6.12, -90);

  // --- small brown sofa ---
  {
    const g = new THREE.Group(), Sw = 1.5, Sd = 0.82, lea = std(0x6b3f26, 0.5), cus = std(0x7c4a2d, 0.6), leg = std(0x2a1a10, 0.6);
    rb(g, Sw, 0.28, Sd, 0.05, lea, 'sofa-base', 0, 0.26, 0);
    rb(g, Sw, 0.5, 0.18, 0.06, lea, 'sofa-back', 0, 0.62, -Sd / 2 + 0.09);
    for (const s of [-1, 1]) rb(g, 0.16, 0.32, Sd, 0.05, lea, 'sofa-arm', s * (Sw / 2 - 0.08), 0.5, 0);
    for (const s of [-1, 1]) rb(g, (Sw - 0.34) / 2 - 0.01, 0.12, Sd - 0.24, 0.04, cus, 'seat-cushion', s * (Sw - 0.34) / 4, 0.46, 0.08);
    for (const s of [-1, 1]) { const c = rb(g, (Sw - 0.34) / 2 - 0.02, 0.36, 0.13, 0.05, cus, 'back-cushion', s * (Sw - 0.34) / 4, 0.68, -Sd / 2 + 0.25); c.rotation.x = -0.18; }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.025, 0.02, 0.1, leg, 'sofa-leg', sx * (Sw / 2 - 0.08), 0.05, sz * (Sd / 2 - 0.08), null, 10);
    finish(g, 'bedroom-sofa', 'Small sofa (brown)', Sw, 0.85, Sd);
    paintable(g, [{ label: 'Sofa body', mats: [lea] }, { label: 'Cushions', mats: [cus] }]);
    place(g, x1 - 0.02 - Sd / 2, z1 - 0.02 - Sw / 2 - 0.05, -90);
  }

  // --- study table + chair ---
  {
    const g = new THREE.Group(), top = wood('#a07850', '#4a3018'), dark = wood('#7a5a3a', '#3a2412'), Tw = 1.1, Td = 0.55, Th = 0.74;
    bx(g, Tw, 0.04, Td, top, 'table-top', 0, Th - 0.02, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.05, Th - 0.04, 0.05, dark, 'table-leg', sx * (Tw / 2 - 0.04), (Th - 0.04) / 2, sz * (Td / 2 - 0.04));
    bx(g, Tw - 0.1, 0.1, 0.02, dark, 'table-apron', 0, Th - 0.1, -Td / 2 + 0.04);
    bx(g, 0.4, 0.12, Td - 0.08, dark, 'table-drawer', Tw / 2 - 0.3, Th - 0.1, 0); bx(g, 0.08, 0.02, 0.02, std(0xc9a24a, 0.3, 0.8), 'drawer-pull', Tw / 2 - 0.3, Th - 0.1, Td / 2 - 0.035);
    for (let i = 0; i < 3; i++) rb(g, 0.2 - i * 0.02, 0.03, 0.15, 0.006, std([0x3f5a80, 0x8a3f3f, 0x4a6b4a][i], 0.8), 'book', -0.35, Th + 0.015 + i * 0.03, -0.12);
    finish(g, 'study-table', 'Study table (small)', Tw, Th + 0.1, Td);
    paintable(g, [{ label: 'Table top', mats: [top] }, { label: 'Frame', mats: [dark] }]);
    place(g, -0.65, z0 + 0.02 + Td / 2, 0);
    const ch = new THREE.Group(), cw = wood('#6b4a2e', '#2a180c'), seatM = std(0x8a6a4a, 0.8);
    bx(ch, 0.4, 0.04, 0.4, seatM, 'seat', 0, 0.45, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(ch, 0.035, 0.45, 0.035, cw, 'leg', sx * 0.18, 0.225, sz * 0.18);
    for (const sx of [-1, 1]) bx(ch, 0.035, 0.4, 0.035, cw, 'back-post', sx * 0.18, 0.68, -0.18);
    bx(ch, 0.4, 0.14, 0.025, cw, 'back-panel', 0, 0.78, -0.18);
    finish(ch, 'study-chair', 'Study chair (wood)', 0.42, 0.9, 0.42);
    paintable(ch, [{ label: 'Wood', mats: [cw] }, { label: 'Seat', mats: [seatM] }]);
    place(ch, -0.65, z0 + 0.86, 180);
  }

  // --- floor radiator (west wall, under the window) like the kitchen one ---
  {
    const g = makeRadiator({ id: 'bedroom-radiator', label: 'Bedroom radiator (white cast iron, 7 sections)', n: 7, W: 0.6, H: 0.62, color: 0xe7e5dc });
    const sec = []; g.traverse((m) => { if (m.name === 'radiator-section') sec.push(m.material); });
    paintable(g, [{ label: 'Paint', mats: [...new Set(sec)] }]);
    place(g, x0 + 0.02 + 0.06, winZ, 90);   // under the middle pane
  }

  // --- wall-mounted gas heater (south wall, near the sofa and the foot of my bed) ---
  const gas = { open: true };   // shared with the gas valve on the pipework beside the heater
  {
    const g = new THREE.Group(), body = std(0xf1efe8, 0.5), dark = std(0x2b2d31, 0.6), glow = new THREE.MeshStandardMaterial({ color: 0x331a10, emissive: 0xff5a1a, emissiveIntensity: 0, roughness: 0.6 });
    rb(g, 0.95, 0.5, 0.09, 0.025, body, 'heater-body', 0, 0.5, 0.045);
    bx(g, 0.82, 0.24, 0.012, dark, 'heater-vent', 0, 0.58, 0.093);
    for (let i = 0; i < 6; i++) bx(g, 0.8, 0.01, 0.014, glow, 'heater-slat', 0, 0.48 + i * 0.04, 0.096);
    cyl(g, 0.022, 0.022, 0.02, dark, 'heater-knob', 0.38, 0.38, 0.1, [Math.PI / 2, 0, 0], 16);
    const lamp = new THREE.PointLight(0xff7a30, 0, 4, 2); lamp.position.set(0, 0.5, 0.35); g.add(lamp);
    let on = false, lv = 0;
    g.name = 'wall-heater'; g.userData.label = 'Wall-mounted gas heater - drag the orange dots to resize the width'; g.userData.movable = true; g.userData.wallMount = 'any'; g.userData.wallAnchorY = 0.5; g.userData.wallGap = 0.004; g.userData.resizable = true; g.userData.maxScaleX = 3;
    g.userData.interact = { prompt: () => gas.open ? `<kbd>E</kbd> heater ${on ? 'off' : 'on'}` : 'Gas valve is closed - open it on the pipe beside the heater', run: () => { on = !on; } };
    g.userData.persist = { get: () => on, set: (v) => { on = !!v; lv = on ? 1 : 0; } };
    g.userData.update = (dt) => { const burn = on && gas.open; lv += ((burn ? 1 : 0) - lv) * Math.min(1, dt * 1.5); glow.emissiveIntensity = lv * 2.2; lamp.intensity = lv * 1.6; };
    paintable(g, [{ label: 'Casing', mats: [body] }]);
    place(g, 1.2, z1 - 0.002, 180);   // south wall, between the foot of my bed and the sofa
  }

  // --- pipework beside the heater: copper hot-water riser flowing ceiling -> floor, and a gas line with a quarter-turn valve ---
  {
    const g = new THREE.Group(), copper = new THREE.MeshStandardMaterial({ color: 0xdde0e4, metalness: 0.1, roughness: 0.35 }), pvc = copper, pvc2 = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.1, roughness: 0.4 });
    const iron = std(0x2a2b2d, 0.55, 0.6), yellow = std(0xe3b212, 0.45, 0.1), brassM = std(0xb08a3c, 0.3, 0.85), red = std(0xc62828, 0.45), steel = std(0xbfc3c7, 0.3, 0.9);
    const bands = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#dde0e4'; x.fillRect(0, 0, 8, 128); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(120,180,255,0)'); gr.addColorStop(0.5, 'rgba(120,180,255,.5)'); gr.addColorStop(1, 'rgba(120,180,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(x.canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 5); return t; })();
    const flowMat = new THREE.MeshStandardMaterial({ map: bands, metalness: 0.1, roughness: 0.35, emissive: 0x1a3a6a, emissiveMap: bands, emissiveIntensity: 0.35 });
    const Zp = 0.03, H2 = H - 0.02;
    const tag = (txt, bg, fg) => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 128, 64); x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(3, 3, 122, 58); x.fillStyle = fg; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 64, 28); x.fillText(txt === 'WATER' ? '\u25BC \u25BC' : '\u25B2 OFF', 64, 54); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }); };
    // water riser: two fat, round, painted pipes (no bare copper) with ball joints, wall clamps and ceiling/floor collars
    const riser = cyl(g, 0.021, 0.021, H2, flowMat, 'water-riser-supply', 0.0, H2 / 2, Zp + 0.01, null, 36);
    cyl(g, 0.016, 0.016, H2, pvc2, 'water-riser-return', 0.085, H2 / 2, Zp + 0.005, null, 36);
    for (const [x, r] of [[0, 0.021], [0.085, 0.016]]) {
      cyl(g, r + 0.016, r + 0.016, 0.01, steel, 'escutcheon-floor', x, 0.005, Zp + 0.01, null, 32); cyl(g, r + 0.016, r + 0.016, 0.01, steel, 'escutcheon-ceiling', x, H2 - 0.005, Zp + 0.01, null, 32);
      for (const y of [0.35, 2.1]) mk(g, new THREE.SphereGeometry(r * 1.45, 24, 16), pvc, 'pipe-ball-joint', x, y, Zp + 0.01 - (r === 0.021 ? 0 : 0.005));
      for (const y of [0.9, 1.5]) { cyl(g, r + 0.004, r + 0.004, 0.022, steel, 'pipe-clamp', x, y, Zp + 0.01, null, 28); bx(g, 0.02, 0.01, Zp - 0.002, steel, 'clamp-arm', x, y, (Zp - 0.002) / 2); }
    }
    bx(g, 0.1, 0.05, 0.004, tag('WATER', '#1d5fa8', '#ffffff'), 'water-tag', 0.042, 1.2, 0.004);
    // gas: its own small yellow pipe, separate from the water pipes - up from the floor, a ball elbow, then across through the valve to the heater
    // (pipes stand on the sofa side of the heater; local -x points at the heater, so the gas line runs under it and up into its bottom)
    const GX = 0.15, GY = 0.62, HX = -0.38, HY = 0.86;
    cyl(g, 0.0115, 0.0115, GY, yellow, 'gas-pipe', GX, GY / 2, Zp, null, 20);
    cyl(g, 0.026, 0.026, 0.008, steel, 'gas-floor-collar', GX, 0.004, Zp, null, 24);
    mk(g, new THREE.SphereGeometry(0.0165, 20, 14), yellow, 'gas-elbow', GX, GY, Zp);
    cyl(g, 0.0115, 0.0115, GX - HX, yellow, 'gas-pipe-to-heater', (GX + HX) / 2, GY, Zp, [0, 0, Math.PI / 2], 20);
    mk(g, new THREE.SphereGeometry(0.0165, 20, 14), yellow, 'gas-elbow-2', HX, GY, Zp);
    cyl(g, 0.0115, 0.0115, HY - GY, yellow, 'gas-pipe-up', HX, (HY + GY) / 2, Zp, null, 20);
    bx(g, 0.05, 0.02, 0.004, tag('GAS', '#e3b212', '#222222'), 'gas-tag', GX, 0.75, 0.004);
    const valve = new THREE.Group(); valve.position.set(-0.1, GY, Zp); g.add(valve);
    mk(valve, new THREE.SphereGeometry(0.02, 28, 18), brassM, 'valve-body', 0, 0, 0);
    cyl(valve, 0.012, 0.012, 0.03, brassM, 'valve-bonnet', 0, 0, 0.02, [Math.PI / 2, 0, 0], 28); cyl(valve, 0.015, 0.015, 0.01, brassM, 'valve-nut', 0, 0, 0.002, [Math.PI / 2, 0, 0], 6);
        const lever = new THREE.Group(); lever.position.z = 0.038; valve.add(lever);
    bx(lever, 0.06, 0.01, 0.005, red, 'valve-lever', 0.025, 0, 0); cyl(lever, 0.007, 0.007, 0.012, red, 'valve-grip', 0.057, 0, 0, [Math.PI / 2, 0, 0], 12);
        // a gas drip leg / pressure test point and a small label arrow area omitted for clarity
    let t = gas.open ? 0 : 1;
    g.name = 'heater-pipes'; g.userData.label = 'Heater pipework (round water pipes + small gas pipe with valve)'; g.userData.movable = true; g.userData.wallMount = 'x';
    g.userData.interact = { prompt: () => `<kbd>E</kbd> ${gas.open ? 'close' : 'open'} gas valve`, run: () => { gas.open = !gas.open; } };
    g.userData.persist = { get: () => gas.open, set: (v) => { gas.open = v !== false; t = gas.open ? 0 : 1; lever.rotation.z = t * Math.PI / 2; } };
    g.userData.update = (dt) => { t += ((gas.open ? 0 : 1) - t) * Math.min(1, dt * 8); lever.rotation.z = t * Math.PI / 2; bands.offset.y += dt * 0.45; void riser; };
    place(g, 1.2 + 0.5, z1 - 0.002, 180);
  }

  // --- window AC: only the front panel is inside the room, the rest of the unit sits outside the window ---
  {
    const g = new THREE.Group(), body = std(0xf1f1ee, 0.45), dark = std(0x2b2d31, 0.5), grey = std(0xb9bcc0, 0.6, 0.3), led = new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x00ff66, emissiveIntensity: 0 });
    // inside: slim front panel with vent + controls (local +z = into the room)
    rb(g, 0.6, 0.4, 0.14, 0.03, body, 'ac-front', 0, 0, 0.07);
    bx(g, 0.5, 0.1, 0.012, dark, 'ac-vent', 0, 0.1, 0.142);
    for (let k = 0; k < 5; k++) bx(g, 0.5, 0.008, 0.014, grey, 'ac-vent-slat', 0, 0.075 + k * 0.02, 0.145);
    const flap = new THREE.Group(); flap.position.set(0, 0.05, 0.14); g.add(flap); bx(flap, 0.5, 0.012, 0.06, body, 'ac-louver', 0, 0, 0.025);
    bx(g, 0.5, 0.1, 0.012, dark, 'ac-intake', 0, -0.1, 0.142);
    bx(g, 0.14, 0.05, 0.012, dark, 'ac-display', -0.18, -0.01, 0.142);
    mk(g, new THREE.SphereGeometry(0.008, 8, 6), led, 'ac-led', 0.2, -0.01, 0.146);
    for (let k = 0; k < 3; k++) cyl(g, 0.012, 0.012, 0.01, grey, 'ac-button', 0.08 + k * 0.045, -0.01, 0.146, [Math.PI / 2, 0, 0], 12);
    // through the wall + outside: the big condenser / compressor body
    rb(g, 0.54, 0.37, 0.16, 0.02, body, 'ac-through-wall', 0, 0, -0.08);
    rb(g, 0.6, 0.42, 0.46, 0.03, body, 'ac-outdoor-body', 0, 0, -0.38);
    for (let k = 0; k < 9; k++) bx(g, 0.5, 0.012, 0.012, grey, 'ac-outdoor-fin', 0, -0.17 + k * 0.042, -0.62);
    bx(g, 0.05, 0.06, 0.5, grey, 'ac-drain-lip', 0, -0.22, -0.4);
    let on = false, op = 0;
    g.name = 'bedroom-ac'; g.userData.label = 'Window AC (most of the unit sits outside)'; g.userData.movable = true; g.userData.wallMount = true;
    g.userData.interact = { prompt: () => `<kbd>E</kbd> AC ${on ? 'off' : 'on'}`, run: () => { on = !on; } };
    ctl.ac = { get: () => on, toggle: () => { on = !on; } };
    g.userData.persist = { get: () => on, set: (v) => { on = !!v; op = on ? 1 : 0; } };
    g.userData.update = (dt) => { op += ((on ? 1 : 0) - op) * Math.min(1, dt * 3); flap.rotation.x = op * 0.8; led.emissiveIntensity = on ? 2 : 0; };
    paintable(g, [{ label: 'Casing', mats: [body] }]);
    place(g, x0 + 0.005, winZ - WL / 2 + COLW / 2, 90, win.sill + 0.325);   // lower half of the north pane (the right-hand pane when you face the window)
  }

  // --- curtains (west wall, across the whole window) ---
  {
    const g = new THREE.Group(), cloth = new THREE.MeshStandardMaterial({ color: 0xb9a58a, roughness: 0.95, side: THREE.DoubleSide }), CH = 2.15, rodY = 2.3, CWID = WL + 0.3, half = CWID / 2;
    cyl(g, 0.012, 0.012, CWID + 0.1, std(0x3a2b1f, 0.5, 0.4), 'curtain-rod', 0, rodY, 0, [0, 0, Math.PI / 2], 12);
    for (const s of [-1, 1]) mk(g, new THREE.SphereGeometry(0.03, 10, 8), std(0x3a2b1f, 0.5, 0.4), 'finial', s * (half + 0.06), rodY, 0);
    const panels = [-1, 1].map((s) => {
      const geo = new THREE.PlaneGeometry(1, CH, 60, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 0.5) * Math.PI * 16) * 0.03); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, cloth); m.name = 'curtain-panel'; m.castShadow = true; m.position.y = rodY - CH / 2 - 0.02; g.add(m); return { m, s };
    });
    let open = 0, tgt = 0;
    const pose = () => { for (const { m, s } of panels) { const w = half + 0.05 * (1 - open) + (0.6 - half) * open; m.scale.x = w; m.position.x = s * (half - w / 2); m.position.z = s * 0.012; } bedroomState.curtain = open; };
    g.name = 'bedroom-curtains'; g.userData.label = 'Curtains (full window) - drag the dots to resize'; g.userData.movable = true; g.userData.wallMount = true; g.userData.resizable = true; g.userData.maxScaleX = 1.1;
    g.userData.interact = { prompt: () => `<kbd>E</kbd> ${tgt > 0.5 ? 'close' : 'open'} curtains`, run: () => { tgt = tgt > 0.5 ? 0 : 1; } };
    g.userData.persist = { get: () => tgt, set: (v) => { tgt = open = v; pose(); } };
    g.userData.update = (dt) => { if (Math.abs(tgt - open) > 0.002) { open += (tgt - open) * Math.min(1, dt * 3); pose(); } };
    pose(); paintable(g, [{ label: 'Fabric', mats: [cloth] }]);
    place(g, x0 + 0.26, winZ, 90);   // hangs in front of the AC's room-side panel
  }

  // --- ceiling fan with the bulbs built into it ---
  {
    const g = new THREE.Group(), metal = std(0xcfcac0, 0.4, 0.5), blade = wood('#9a7a52', '#4a3018'), glass = new THREE.MeshStandardMaterial({ color: 0xfff3da, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.92 });
    cyl(g, 0.02, 0.02, 0.2, metal, 'fan-downrod', 0, -0.1, 0, null, 10); cyl(g, 0.1, 0.12, 0.1, metal, 'fan-motor', 0, -0.25, 0, null, 24); cyl(g, 0.12, 0.12, 0.02, metal, 'fan-canopy', 0, -0.01, 0, null, 24);
    const blades = new THREE.Group(); blades.position.y = -0.27; g.add(blades);
    for (let k = 0; k < 4; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI / 2; blades.add(a); bx(a, 0.46, 0.012, 0.13, blade, 'fan-blade', 0.36, 0, 0); bx(a, 0.1, 0.02, 0.03, metal, 'blade-arm', 0.14, 0, 0); }
    cyl(g, 0.07, 0.08, 0.08, metal, 'light-kit', 0, -0.35, 0, null, 20);
    const bulbs = [];
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5; const arm = bx(g, 0.1, 0.012, 0.012, metal, 'bulb-arm', Math.cos(a) * 0.1, -0.36, Math.sin(a) * 0.1); arm.rotation.y = -a; const b = mk(g, new THREE.SphereGeometry(0.038, 14, 12), glass, 'fan-bulb', Math.cos(a) * 0.17, -0.4, Math.sin(a) * 0.17); b.castShadow = false; bulbs.push(b); }
    const light = new THREE.PointLight(0xffd9a8, 0, 0, 2); light.position.set(0, -0.5, 0); g.add(light);
    const SPEEDS = [0, 1.6, 3.8, 7], NAMES = ['off', 'low', 'medium', 'high']; let sp = 0, lit = true, ang = 0, li = 1;
    g.name = 'ceiling-fan'; g.userData.label = 'Ceiling fan with 3 built-in bulbs'; g.userData.movable = true;
    g.userData.interact = { prompt: () => `<kbd>E</kbd> fan: ${NAMES[sp]} → ${NAMES[(sp + 1) % 4]} &nbsp; <kbd>B</kbd> bulbs ${lit ? 'off' : 'on'}`, run: () => { sp = (sp + 1) % 4; }, keys: { KeyB: () => { lit = !lit; } } };
    g.userData.persist = { get: () => [sp, lit], set: (v) => { sp = v[0]; lit = !!v[1]; li = lit ? 1 : 0; } };
    ctl.light = { get: () => lit, toggle: () => { lit = !lit; } }; ctl.fan = { get: () => sp, toggle: () => { sp = sp ? 0 : 2; } };
    g.userData.update = (dt) => { bedroomState.level = li; ang += SPEEDS[sp] * dt; blades.rotation.y = ang; li += ((lit ? 1 : 0) - li) * Math.min(1, dt * 8); glass.emissiveIntensity = li * 2.4; light.intensity = li * 3.4; };
    paintable(g, [{ label: 'Blades', mats: [blade] }, { label: 'Fan body', mats: [metal] }]);
    place(g, cxm, czm - 0.1, 0, H);
  }

  // --- 3-gang wall switch by the door: ceiling light, fan, AC (each rocker works on its own) ---
  {
    const g = new THREE.Group(), plate = markGlow(std(0xeeebe0, 0.5)), rockM = markGlow(std(0xf7f5ee, 0.35)), dim = std(0x9a9689, 0.6);
    bx(g, 0.125, 0.12, 0.008, plate, 'switch-plate', 0, 0, 0.004);
    const rockers = [['Light', 'bedroom light (fan bulbs)', () => ctl.light], ['Fan', 'ceiling fan', () => ctl.fan], ['AC', 'window AC', () => ctl.ac]].map(([nm, label, ref], i) => {
      const r = new THREE.Group(); r.name = 'rocker-' + nm.toLowerCase(); r.position.set((i - 1) * 0.036, 0, 0.008); g.add(r);
      const cap = bx(r, 0.024, 0.05, 0.012, rockM, 'rocker-cap', 0, 0, 0.006); void cap;
      const led = mk(r, new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffb050, emissiveIntensity: 0 }), 'rocker-led', 0, 0.034, 0.002);
      r.userData.interact = { prompt: () => `<kbd>E</kbd> ${label} ${ref().get() ? 'off' : 'on'}`, run: () => ref().toggle() };
      r.userData.update = () => { const on = !!ref().get(); r.rotation.x += ((on ? 0.22 : -0.22) - r.rotation.x) * 0.35; led.material.emissiveIntensity = on ? 2 : 0; };
      return r;
    });
    void dim; void rockers;
    g.name = 'bedroom-switch'; g.userData.label = 'Bedroom switch (light · fan · AC)'; g.userData.movable = true; g.userData.wallMount = 'any'; g.userData.wallGap = 0.006;
    place(g, 1.85, z0 + 0.006, 0, 1.2);
  }

  // --- power + charging outlets: drag any of them onto any wall of the room (Layout mode) ---
  [['bedroom-outlet-desk', 'Outlet - study desk', 'duplex', -0.3, z0 + 0.006, 0, 0.32],
   ['bedroom-usb-bed', 'USB charging outlet - bedside (my bed)', 'usb', x1 - 0.006, 6.2, -90, 0.55],
   ['bedroom-outlet-south', 'Outlet - south wall', 'duplex', 2.2, z1 - 0.006, 180, 0.32],
   ['bedroom-usb-sofa', 'USB charging outlet - sofa', 'usb', -0.9, z1 - 0.006, 180, 0.5],
   ['bedroom-outlet-west', 'Outlet - window wall', 'duplex', x0 + 0.006, 7.3, 90, 0.32]].forEach(([id, label, kind, x, z, rot, y]) => {
    const o = buildSocketPlate({ id, label, kind }); place(o, x, z, rot, y);
  });

  // --- one soft rug over the whole floor (C colour · T texture · G design · E remove) ---
  out.push(buildBedRug(x0, x1, z0, z1));

  // --- closet extras (movable) ---
  {
    const g = new THREE.Group(), shell = std(0x2f4a66, 0.5, 0.1), trim = std(0x1c1c1e, 0.5, 0.5);
    rb(g, 0.55, 0.72, 0.25, 0.04, shell, 'suitcase-shell', 0, 0.38, 0); for (const s of [-1, 1]) bx(g, 0.03, 0.6, 0.012, trim, 'suitcase-rib', s * 0.14, 0.38, 0.13);
    bx(g, 0.16, 0.02, 0.03, trim, 'suitcase-handle', 0, 0.76, 0); for (const sx of [-1, 1]) cyl(g, 0.02, 0.02, 0.02, trim, 'suitcase-wheel', sx * 0.2, 0.02, 0.08, [0, 0, Math.PI / 2], 10);
    finish(g, 'closet-suitcase', 'Suitcase (closet)', 0.57, 0.78, 0.27); paintable(g, [{ label: 'Shell', mats: [shell] }]);
    place(g, cx0 + 0.38, cz1 - 0.3, 180);
    const b = new THREE.Group(), bin = std(0x8fa4b8, 0.6);
    for (let i = 0; i < 2; i++) { rb(b, 0.55, 0.3, 0.4, 0.025, bin, 'storage-bin', 0, 0.15 + i * 0.31, 0); bx(b, 0.5, 0.02, 0.1, std(0xdfe5ea, 0.5), 'bin-label', 0, 0.17 + i * 0.31, 0.205); }
    finish(b, 'closet-bins', 'Storage bins (closet)', 0.57, 0.62, 0.42); paintable(b, [{ label: 'Bins', mats: [bin] }]);
    place(b, cx0 + 0.95, cz1 - 0.28, 180);
  }

  for (const o of out) root.add(o);
  return root;
}

function buildBedRug(x0, x1, z0, z1) {
  return buildBathRug({ id: 'bedroom-rug', label: 'Bedroom rug (whole floor)', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0 - 0.1, d: z1 - z0 - 0.1, tile: [5, 4] });
}

/**
 * Wide window made of NCOL columns. Each column: a fixed pane on top and a lower sash that slides UP in front of it (E).
 * The last column (north end) has a solid panel in its lower half instead, which is where the AC unit is mounted.
 * Origin: centre of the opening, bottom edge, middle of the wall thickness. Local +z = room side.
 */
function slidingWindow(WL, h, N, t, mats) {
  const g = new THREE.Group(); g.name = 'bedroom-window'; g.userData.label = 'Wide window (sliding lower sashes, AC under the north pane)';
  const fr = 0.05, mull = 0.05, cw = (WL - (N - 1) * mull) / N, hl = 0.65, hu = h - hl, trim = mats.trim;
  for (const face of [1, -1]) {
    const z = face === 1 ? 0.0125 : -t - 0.0125;
    for (const [bw, bh, x, y] of [[WL + fr * 2, fr, 0, h + fr / 2], [WL + fr * 2, fr, 0, -fr / 2], [fr, h, -(WL / 2 + fr / 2), h / 2], [fr, h, WL / 2 + fr / 2, h / 2]]) { const b = box(bw, bh, 0.025, trim, { tile: 1 }); b.position.set(x, y, z); g.add(b); }
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfeeff, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.14, depthWrite: false });   // clear glass: you see straight through it
  const outside = buildWinter(WL, h, t); g.add(outside.group);
  const sashes = [], paint = new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.45 });
  for (let i = 0; i < N; i++) {
    const cx = -WL / 2 + cw / 2 + i * (cw + mull);
    if (i < N - 1) { const m = box(mull, h, 0.04, trim, { tile: 1 }); m.position.set(cx + cw / 2 + mull / 2, h / 2, -t / 2); g.add(m); }
    const up = new THREE.Mesh(new THREE.PlaneGeometry(cw, hu), glassMat); up.renderOrder = 4; up.position.set(cx, hl + hu / 2, -t / 2); g.add(up);
    const rail = box(cw, 0.04, 0.045, trim, { tile: 1 }); rail.position.set(cx, hl, -t / 2); g.add(rail);
    if (i === N - 1) { const f = new THREE.Mesh(new THREE.BoxGeometry(cw, hl, 0.02), paint); f.position.set(cx, hl / 2, -t / 2); g.add(f); continue; }   // AC column
    const sg = new THREE.Group(); sg.position.set(cx, 0, -t / 2 + 0.03); g.add(sg);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.04, hl - 0.04), glassMat); gl.renderOrder = 4; gl.position.y = hl / 2; sg.add(gl);
    for (const [bw, bh, x, y] of [[cw, 0.035, 0, hl - 0.0175], [cw, 0.035, 0, 0.0175], [0.035, hl, -(cw / 2 - 0.0175), hl / 2], [0.035, hl, cw / 2 - 0.0175, hl / 2]]) { const b = box(bw, bh, 0.035, paint, { tile: 1 }); b.position.set(x, y, 0); sg.add(b); }
    const latch = box(0.1, 0.018, 0.03, std(0xc9a24a, 0.3, 0.8), { tile: 1 }); latch.position.set(0, hl - 0.05, 0.03); sg.add(latch);
    const s = { sg, t: 0, tgt: 0 }; sashes.push(s);
    sg.userData.interact = { prompt: () => `<kbd>E</kbd> slide window ${s.tgt > 0.5 ? 'down (close)' : 'up (open)'}`, run: () => { s.tgt = s.tgt > 0.5 ? 0 : 1; } };
  }
  g.userData.persist = { get: () => sashes.map((s) => s.tgt), set: (v) => sashes.forEach((s, i) => { s.tgt = s.t = v?.[i] ?? 0; s.sg.position.y = s.t * 0.6; }) };
  g.userData.update = (dt) => { outside.update(dt, 1 - bedroomState.level, bedroomState.curtain); for (const s of sashes) { if (Math.abs(s.tgt - s.t) > 0.002) { s.t += (s.tgt - s.t) * Math.min(1, dt * 4); s.sg.position.y = s.t * 0.6; } } };
  return g;
}
