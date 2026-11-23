import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { KITCHEN as K } from '../config.js';
import { fixtureMats } from './mats.js';
import { click } from '../audio.js';
import { fridgeFood } from './fridgefood.js';

/**
 * ARCTICA top-freezer refrigerator against the EAST wall, front facing west into the kitchen.
 * Built in a local frame where the front faces +z (x = right when facing it = south, y up), then rotated.
 *  - hollow cabinet with a liner, divider, glass shelves, two crisper drawers and a freezer shelf + basket
 *  - two real doors (E to open / close, hinges on the north edge) with gaskets and door bins; the interior light comes on while a door is open
 *  - everything stored inside is modelled in fridgefood.js (cans, bottles, eggs, meat, vegetables...)
 * Each door owns its own `interact` and `persist`, so the Command Center and the session saver see them like any other device.
 */
export function buildFridge() {
  const F = K.fridge;
  const M = fixtureMats();
  const g = new THREE.Group();
  g.name = 'fridge'; g.userData.label = F.label; g.userData.movable = true;

  const add = (parent, m, name, x, y, z, collide = false) => {
    m.position.set(x, y, z); m.name = name; m.castShadow = m.receiveShadow = true; m.userData.collider = collide; parent.add(m); return m;
  };
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  const liner = new THREE.MeshStandardMaterial({ color: 0xdde4e7, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.75 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6e4, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe4ecef, roughness: 0.25, transparent: true, opacity: 0.28, depthWrite: false });
  

  const kick = 0.07, bodyD = F.d - 0.03, T = 0.035;
  const freezerH = 0.56, seam = 0.016, doorT = 0.03;
  const doorsTop = F.h - 0.015, doorsBottom = kick + 0.012;
  const fridgeH = doorsTop - doorsBottom - freezerH - seam;
  const fridgeY = doorsBottom + fridgeH / 2, freezerY = doorsTop - freezerH / 2;
  const divY = doorsTop - freezerH - seam / 2;                 // centre of the divider between the two compartments
  const floorTop = kick + 0.04, fTop = divY - 0.02, zTop = divY + 0.02, ceil = F.h - T;
  const cw = F.w - 2 * T;                                       // cavity width

  // ---- cabinet shell (hollow): outer enamel, inner liner face ----
  const panel = (name, w, h, d, x, y, z, inner) => {
    const mats = [M.enamel, M.enamel, M.enamel, M.enamel, M.enamel, M.enamel]; for (const i of inner) mats[i] = liner;
    return add(g, new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.006), mats), name, x, y, z);
  };
  panel('fridge-side-north', T, F.h - kick, bodyD, -(F.w / 2 - T / 2), kick + (F.h - kick) / 2, bodyD / 2, [0]);
  panel('fridge-side-south', T, F.h - kick, bodyD, F.w / 2 - T / 2, kick + (F.h - kick) / 2, bodyD / 2, [1]);
  panel('fridge-back', F.w, F.h - kick, 0.03, 0, kick + (F.h - kick) / 2, 0.015, [4]);
  panel('fridge-top', F.w, T, bodyD, 0, F.h - T / 2, bodyD / 2, [3]);
  panel('fridge-floor', F.w, 0.04, bodyD, 0, kick + 0.02, bodyD / 2, [2]);
  panel('fridge-divider', F.w, 0.04, bodyD, 0, divY, bodyD / 2, [2, 3]);
  add(g, new THREE.Mesh(rBox(F.w - 0.08, kick, bodyD - 0.1), M.black), 'fridge-kick-grille', 0, kick / 2, (bodyD - 0.1) / 2 + 0.03);
  // one invisible box is what you bump into (the shell is hollow)
  const col = new THREE.Mesh(new THREE.BoxGeometry(F.w, F.h, bodyD), new THREE.MeshBasicMaterial({ visible: false }));
  col.visible = false; add(g, col, 'fridge-collider', 0, F.h / 2, bodyD / 2, true); col.castShadow = col.receiveShadow = false;

  // ---- interior fittings ----
  const innerZ0 = 0.03, shelfD = bodyD - innerZ0 - 0.1, shelfZ = innerZ0 + shelfD / 2;
  const shelf = (name, y, w = cw - 0.01) => {
    add(g, new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, shelfD), glass), name, 0, y, shelfZ).castShadow = false;
    add(g, new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.008), M.enamelDim), name + '-lip', 0, y + 0.003, shelfZ + shelfD / 2);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, shelfD), M.enamelDim), name + '-rail-n', -w / 2, y + 0.002, shelfZ);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, shelfD), M.enamelDim), name + '-rail-s', w / 2, y + 0.002, shelfZ);
  };
  const Y = { crisper: floorTop, shA: 0.395, shB: 0.64, shC: 0.88, fz: zTop + 0.255 };
  shelf('fridge-shelf-A', Y.shA); shelf('fridge-shelf-B', Y.shB); shelf('fridge-shelf-C', Y.shC); shelf('freezer-shelf', Y.fz);
  // crisper drawers (frosted fronts, so you can see the vegetables through them)
  const drawerW = cw / 2 - 0.012, drawerH = 0.2, drawerD = shelfD - 0.02;
  for (const [i, sx] of [['N', -1], ['S', 1]]) {
    const dg = new THREE.Group(); dg.name = 'crisper-drawer-' + i; dg.position.set(sx * (drawerW / 2 + 0.006), Y.crisper + 0.005, innerZ0 + drawerD / 2 + 0.02); g.add(dg);
    add(dg, new THREE.Mesh(new THREE.BoxGeometry(drawerW, 0.006, drawerD), plastic), 'drawer-bottom', 0, 0, 0).castShadow = false;
    add(dg, new THREE.Mesh(new THREE.BoxGeometry(drawerW, drawerH, 0.006), plastic), 'drawer-front', 0, drawerH / 2, drawerD / 2).castShadow = false;
    add(dg, new THREE.Mesh(new THREE.BoxGeometry(0.006, drawerH, drawerD), plastic), 'drawer-side-a', -drawerW / 2, drawerH / 2, 0).castShadow = false;
    add(dg, new THREE.Mesh(new THREE.BoxGeometry(0.006, drawerH, drawerD), plastic), 'drawer-side-b', drawerW / 2, drawerH / 2, 0).castShadow = false;
    add(dg, new THREE.Mesh(new THREE.BoxGeometry(drawerW, 0.006, drawerD), plastic), 'drawer-back-top', 0, drawerH, 0).visible = false;
    add(dg, rbox(drawerW * 0.5, 0.02, 0.02, 0.008, M.enamelDim), 'drawer-handle', 0, drawerH - 0.03, drawerD / 2 + 0.012);
    dg.userData.drawer = { w: drawerW, h: drawerH, d: drawerD, sx };
  }
  // freezer basket + frost on the freezer back wall
  const fbW = cw - 0.02, fbD = shelfD - 0.02, fbH = 0.13;
  const basket = new THREE.Group(); basket.name = 'freezer-basket'; basket.position.set(0, zTop + 0.004, innerZ0 + fbD / 2 + 0.02); g.add(basket);
  add(basket, new THREE.Mesh(new THREE.BoxGeometry(fbW, 0.006, fbD), plastic), 'basket-bottom', 0, 0, 0);
  add(basket, new THREE.Mesh(new THREE.BoxGeometry(fbW, fbH, 0.006), plastic), 'basket-front', 0, fbH / 2, fbD / 2);
  add(basket, new THREE.Mesh(new THREE.BoxGeometry(0.006, fbH, fbD), plastic), 'basket-side-a', -fbW / 2, fbH / 2, 0);
  add(basket, new THREE.Mesh(new THREE.BoxGeometry(0.006, fbH, fbD), plastic), 'basket-side-b', fbW / 2, fbH / 2, 0);
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 256; const fx = fc.getContext('2d');
  for (let i = 0; i < 260; i++) { const x = Math.random() * 512, y = Math.random() * 256, r = 4 + Math.random() * 26, gr = fx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(235,245,250,.55)'); gr.addColorStop(1, 'rgba(235,245,250,0)'); fx.fillStyle = gr; fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill(); }
  const frostTex = new THREE.CanvasTexture(fc); frostTex.colorSpace = THREE.SRGBColorSpace;
  const fz = new THREE.Mesh(new THREE.PlaneGeometry(cw, ceil - zTop), new THREE.MeshStandardMaterial({ map: frostTex, transparent: true, depthWrite: false, roughness: 0.9 }));
  add(g, fz, 'freezer-frost', 0, (zTop + ceil) / 2, innerZ0 + 0.002).castShadow = false;

  // interior light (LED strip + a short-range lamp that only glows while a door is open) and the temperature dial
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d4, emissiveIntensity: 0, roughness: 0.4 });
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.03), ledMat), 'fridge-led', 0, fTop - 0.004, bodyD - 0.1).castShadow = false;
  const lamp = new THREE.PointLight(0xfff0d8, 0, 1.3, 2); lamp.name = 'fridge-lamp'; lamp.position.set(0, fTop - 0.08, bodyD - 0.14); g.add(lamp);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5 }));
  dial.rotation.x = Math.PI / 2; add(g, dial, 'temperature-dial', cw / 2 - 0.05, fTop - 0.06, innerZ0 + 0.01).castShadow = false;
  const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true }));
  add(g, dp, 'temperature-dial-scale', cw / 2 - 0.05, fTop - 0.06, innerZ0 + 0.0035).castShadow = false;

  // ---- doors ----
  const dw = F.w - 0.012, hingeX = -dw / 2, OPEN = 1.75;
  const doors = [];
  function makeDoor(id, label, h, yc, openName) {
    const pivot = new THREE.Group(); pivot.name = id; pivot.position.set(hingeX, yc, bodyD + 0.002); g.add(pivot);
    add(pivot, rbox(dw, h, doorT, 0.012, M.enamel), id + '-slab', dw / 2, 0, doorT / 2);
    add(pivot, new THREE.Mesh(rBox(dw - 0.05, h - 0.05, 0.008), liner), id + '-inner', dw / 2, 0, -0.004);
    // gasket frame
    for (const [w, hh, x, y] of [[dw - 0.03, 0.02, dw / 2, h / 2 - 0.02], [dw - 0.03, 0.02, dw / 2, -h / 2 + 0.02], [0.02, h - 0.03, 0.03, 0], [0.02, h - 0.03, dw - 0.03, 0]])
      add(pivot, new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.012), rubber), id + '-gasket', x, y, -0.008).castShadow = false;
    // grip channel + lip on the free (south) edge
    const gh = id === 'fridge-door-freezer' ? 0.3 : 0.4, gy = id === 'fridge-door-freezer' ? h / 2 - 0.2 : h / 2 - 0.25;
    add(pivot, new THREE.Mesh(rBox(0.03, gh, 0.012), M.black), id + '-grip-channel', dw - 0.033, gy - (id === 'fridge-door-freezer' ? 0 : gh / 2 - 0.1), doorT - 0.002);
    add(pivot, rbox(0.012, gh + 0.01, 0.016, 0.005, M.enamelDim), id + '-grip-lip', dw - 0.021, gy - (id === 'fridge-door-freezer' ? 0 : gh / 2 - 0.1), doorT + 0.0005);
    // an invisible swept box: while the door is open it is solid for the walking code
    const c = new THREE.Mesh(new THREE.BoxGeometry(dw, h, 0.04), new THREE.MeshBasicMaterial({ visible: false }));
    c.visible = false; c.position.set(dw / 2, 0, doorT / 2); c.userData.collider = 'dyn'; c.userData.active = () => d.ang < -0.35; pivot.add(c);
    const d = { id, pivot, h, open: false, ang: 0 };
    pivot.userData.interact = {
      reach: 'grab',
      prompt: () => `<kbd>E</kbd> ${d.open ? 'close' : 'open'} the ${openName}`,
      guard: (wx, wz) => {
        if (d.open) return null;
        g.updateWorldMatrix(true, false); const p = new THREE.Vector3(wx, 0, wz); g.worldToLocal(p);
        return p.z > bodyD - 0.05 && p.z < bodyD + dw + 0.12 && p.x > hingeX - 0.1 && p.x < hingeX + dw + 0.05 && Math.hypot(p.x - hingeX, p.z - bodyD) < dw + 0.1 ? `Step back first - the ${openName} swings out` : null;
      },
      run: () => { d.open = !d.open; click(d.open ? 640 : 480, 0.05); },
    };
    pivot.userData.persist = { get: () => d.open, set: (v) => { d.open = !!v; d.ang = d.open ? -OPEN : 0; pivot.rotation.y = d.ang; } };
    pivot.userData.label = label;
    doors.push(d); return pivot;
  }
  const dFridge = makeDoor('fridge-door-lower', 'Refrigerator door', fridgeH, fridgeY, 'fridge door');
  const dFreezer = makeDoor('fridge-door-freezer', 'Freezer door', freezerH, freezerY, 'freezer door');

  // hinge covers on the north edge (fixed to the cabinet)
  const hinge = new THREE.MeshStandardMaterial({ color: 0xcfcdc4, roughness: 0.5 });
  for (const y of [doorsTop - 0.04, divY - 0.03, doorsBottom + 0.1]) add(g, new THREE.Mesh(rBox(0.014, 0.075, 0.012), hinge), 'fridge-hinge-cover', -F.w / 2 + 0.004, y, bodyD + doorT + 0.003);

  // ---- branding: chrome wordmark badge, model plate, no-frost label ----
  const z0 = doorT + 0.002;
  add(dFreezer, new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshStandardMaterial({ map: brandTexture(), metalness: 0.25, roughness: 0.35, transparent: true })), 'fridge-brand-badge', dw / 2 - 0.02, freezerH / 2 - 0.075, z0).castShadow = false;
  add(dFreezer, new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.024), new THREE.MeshStandardMaterial({ map: plateTexture('NO-FROST  FREEZER'), roughness: 0.4, metalness: 0.5 })), 'freezer-label', dw / 2 - 0.02, freezerH / 2 - 0.145, z0).castShadow = false;
  add(dFridge, new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.024), new THREE.MeshStandardMaterial({ map: plateTexture('FRESH FOOD  18 cu ft'), roughness: 0.4, metalness: 0.5 })), 'fridge-label', dw / 2 - 0.02, h2(fridgeH) - 0.07, z0).castShadow = false;
  add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshStandardMaterial({ map: stickerTexture(), roughness: 0.8 })), 'fridge-model-sticker', -cw / 2 + 0.06, fTop - 0.1, innerZ0 + 0.0015).castShadow = false;
  function h2(v) { return v / 2; }

  // ---- food ----
  fridgeFood({ g, dFridge, dFreezer, basket, Y, cw, innerZ0, shelfD, drawerOf: (n) => g.getObjectByName('crisper-drawer-' + n), fridgeH, freezerH, dw, floorTop, zTop, fTop });

  // ---- behaviour ----
  g.userData.update = (dt) => {
    let any = false;
    for (const d of doors) { const t = d.open ? -OPEN : 0; d.ang += (t - d.ang) * Math.min(1, dt * 5); if (Math.abs(d.ang - t) < 0.002) d.ang = t; d.pivot.rotation.y = d.ang; any ||= d.ang < -0.05; }
    const target = any ? 1 : 0; lamp.intensity += (target * 0.6 - lamp.intensity) * Math.min(1, dt * 12); ledMat.emissiveIntensity = lamp.intensity * 1.2;
  };

  // place against the east wall, front toward the room (west)
  g.rotation.y = -Math.PI / 2;          // local +z (front) -> world -x (west, into the room)
  g.position.set(K.width - 0.025, 0, F.z); // back plane just clear of the east wall's baseboard
  return g;
}

// ---------- small canvas textures ----------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function brandTexture() {
  const [c, x] = cv(800, 240);
  const gr = x.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#f6f7f8'); gr.addColorStop(0.5, '#9aa2a8'); gr.addColorStop(1, '#dfe3e6');
  x.fillStyle = gr; x.font = '700 120px "Helvetica Neue", Arial, sans-serif'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 5; x.shadowOffsetY = 3;
  // spaced wordmark
  const word = 'ARCTICA'; let px = 190; for (const ch of word) { x.fillText(ch, px, 120); px += x.measureText(ch).width + 14; }
  // snowflake mark
  x.save(); x.translate(100, 120); x.strokeStyle = '#8fb7d6'; x.lineWidth = 10; x.lineCap = 'round'; x.shadowBlur = 3;
  for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -62); x.moveTo(0, -38); x.lineTo(-17, -52); x.moveTo(0, -38); x.lineTo(17, -52); x.stroke(); }
  x.restore(); return toTex(c);
}
function plateTexture(text) {
  const [c, x] = cv(400, 96); x.fillStyle = '#c9ced1'; x.fillRect(0, 0, 400, 96); x.fillStyle = '#6a7378'; x.fillRect(0, 0, 400, 5); x.fillRect(0, 91, 400, 5);
  x.fillStyle = '#2c3438'; x.font = '600 38px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 200, 50); return toTex(c);
}
function stickerTexture() {
  const [c, x] = cv(280, 200); x.fillStyle = '#f3f1e6'; x.fillRect(0, 0, 280, 200); x.fillStyle = '#c9a400'; x.fillRect(0, 0, 280, 34);
  x.fillStyle = '#1a1a1a'; x.font = 'bold 24px Arial'; x.fillText('ARCTICA  TF-18', 12, 25); x.font = '15px Arial';
  ['Model TF18W  Top-freezer', '115 V ~ 60 Hz   R600a', 'Fresh food 12.4 cu ft', 'Freezer 5.6 cu ft', 'Energy use 380 kWh / yr', 'Made for 277 Park Ave #11'].forEach((s, i) => x.fillText(s, 12, 62 + i * 22));
  return toTex(c);
}
function dialTexture() {
  const [c, x] = cv(128, 128); x.strokeStyle = 'rgba(30,30,30,.85)'; x.fillStyle = 'rgba(30,30,30,.85)'; x.lineWidth = 3; x.font = 'bold 15px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 7; i++) { const a = -2.4 + i * (4.8 / 6), r = 52; x.beginPath(); x.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); x.lineTo(64 + Math.sin(a) * r, 64 - Math.cos(a) * r); x.stroke(); if (i % 2 === 0) x.fillText(String(i + 1), 64 + Math.sin(a) * 36, 64 - Math.cos(a) * 36); }
  return toTex(c);
}
