import * as THREE from 'three';
import { KITCHEN as K } from '../config.js';
import { box as rawBox } from '../materials.js';
const box = (w, h, d, m, o = {}) => rawBox(w, h, d, m, { round: 0.004, ...o });
import { fixtureMats } from './mats.js';
import { buildStove } from './stove.js';
import { buildScrewBulb } from './lights.js';
import { buildSink, SINK } from './sink.js';

// Cabinet unit-local space: x centred on the unit, z=0 at the wall, z grows into the room, y up.
const CARCASS_H = 0.87, KICK = 0.1, FRONT_Z = 0.58;

function pullBar({ vertical, len = 0.13 }) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = 'cabinet-pull';
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, len, 12), M.brushed);
  bar.position.z = 0.03;
  if (!vertical) bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), M.brushed);
    p.rotation.x = Math.PI / 2; p.position.z = 0.015;
    if (vertical) p.position.y = s * (len / 2 - 0.015); else p.position.x = s * (len / 2 - 0.015);
    g.add(p);
  }
  return g;
}

/** Raised-panel door front. Origin at the centre of the door's back face. */
function raisedDoor(w, h, name) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = name;
  g.add(Object.assign(box(w, h, 0.02, M.cabinet, { tile: 1 }), { name: 'door-frame' }));
  const p = Object.assign(box(w - 0.1, h - 0.1, 0.01, M.cabinetDark, { tile: 1 }), { name: 'door-raised-panel' });
  p.position.z = 0.012; g.add(p);
  return g;
}

/** Door with an arched slatted panel (the lower door of the drawer cabinet in IMG_1284). */
function archedSlatDoor(w, h, name) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = name;
  g.add(Object.assign(box(w, h, 0.02, M.cabinet, { tile: 1 }), { name: 'door-frame' }));
  const iw = w - 0.09, ih = h - 0.09, rise = 0.07;
  const s = new THREE.Shape();
  s.moveTo(-iw / 2, -ih / 2); s.lineTo(iw / 2, -ih / 2); s.lineTo(iw / 2, ih / 2 - rise);
  s.quadraticCurveTo(0, ih / 2 + rise * 0.6, -iw / 2, ih / 2 - rise); s.lineTo(-iw / 2, -ih / 2);
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }), M.cabinetDark);
  panel.position.z = 0.01; panel.name = 'door-arched-panel'; panel.castShadow = panel.receiveShadow = true; g.add(panel);
  const n = Math.round(iw / 0.075);
  for (let i = 1; i < n; i++) {
    const gr = box(0.003, ih - 0.05, 0.002, M.black, { tile: 1 });
    gr.position.set(-iw / 2 + (i * iw) / n, -0.01, 0.0195); gr.name = 'door-slat-groove'; g.add(gr);
  }
  return g;
}

function carcass(w, name) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = name;
  const body = box(w, CARCASS_H - KICK, FRONT_Z, M.cabinetDark, { tile: 1 });
  body.position.set(0, KICK + (CARCASS_H - KICK) / 2, FRONT_Z / 2); body.name = 'cabinet-carcass'; body.userData.collider = true;
  const kick = box(w, KICK, FRONT_Z - 0.06, M.kick, { tile: 1 });
  kick.position.set(0, KICK / 2, (FRONT_Z - 0.06) / 2); kick.name = 'cabinet-toe-kick';
  g.add(body, kick);
  return g;
}

function place(obj, x, y, z, name) { obj.position.set(x, y, z); if (name) obj.name = name; return obj; }

export function buildDrawerCabinet({ w, label }) {
  const g = carcass(w, 'drawer-cabinet'); g.userData.label = label;
  const dh = 0.19;
  const drawer = raisedDoor(w - 0.02, dh, 'drawer-front');
  drawer.position.set(0, CARCASS_H - 0.01 - dh / 2, FRONT_Z + 0.01); g.add(drawer);
  const dp = pullBar({ vertical: false, len: 0.14 }); dp.position.set(0, CARCASS_H - 0.01 - dh / 2, FRONT_Z + 0.02); g.add(dp);

  const doorH = CARCASS_H - 0.01 - dh - 0.01 - (KICK + 0.005);
  const door = archedSlatDoor(w - 0.02, doorH, 'arched-door');
  door.position.set(0, KICK + 0.005 + doorH / 2, FRONT_Z + 0.01); g.add(door);
  const pull = pullBar({ vertical: true, len: 0.13 });
  pull.position.set(w / 2 - 0.05, KICK + 0.005 + doorH * 0.62, FRONT_Z + 0.02); g.add(pull);
  for (const y of [0.2, doorH - 0.02]) { // hinges on the left edge
    const h = box(0.012, 0.07, 0.006, fixtureMats().brushed, { tile: 1 });
    h.position.set(-w / 2 + 0.012, KICK + y, FRONT_Z + 0.021); h.name = 'cabinet-hinge'; g.add(h);
  }
  return g;
}

/** Sink cabinet: an open-topped carcass (side/back/bottom panels + top stretchers) so the bowl has real depth. */
function hollowCarcass(w, name) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = name;
  const t = 0.018, H = CARCASS_H - KICK;
  const panel = (pw, ph, pd, x, y, z, n) => {
    const b = box(pw, ph, pd, M.cabinetDark, { tile: 1 });
    b.position.set(x, y, z); b.name = n; g.add(b); return b;
  };
  panel(w, H, t, 0, KICK + H / 2, t / 2, 'cabinet-back-panel');
  for (const s of [-1, 1]) panel(t, H, FRONT_Z, s * (w / 2 - t / 2), KICK + H / 2, FRONT_Z / 2, 'cabinet-side-panel');
  panel(w, t, FRONT_Z - 0.02, 0, KICK + t / 2, (FRONT_Z - 0.02) / 2 + 0.01, 'cabinet-bottom-panel');
  // top stretchers frame the sink hole
  const holeW = SINK.bowlW + 0.02, holeD0 = 0.03 + SINK.rimD / 2 - (SINK.bowlD + 0.02) / 2, holeD1 = holeD0 + SINK.bowlD + 0.02;
  const topY = CARCASS_H - 0.01;
  panel(w, 0.02, holeD0, 0, topY, holeD0 / 2, 'cabinet-top-stretcher-back');
  panel(w, 0.02, FRONT_Z - holeD1, 0, topY, holeD1 + (FRONT_Z - holeD1) / 2, 'cabinet-top-stretcher-front');
  const sideW = (w - holeW) / 2;
  for (const s of [-1, 1]) panel(sideW, 0.02, holeD1 - holeD0, s * (holeW / 2 + sideW / 2), topY, (holeD0 + holeD1) / 2, 'cabinet-top-stretcher-side');
  // dark under-sink interior reads as depth
  const kick = box(w, KICK, FRONT_Z - 0.06, M.kick, { tile: 1 });
  kick.position.set(0, KICK / 2, (FRONT_Z - 0.06) / 2); kick.name = 'cabinet-toe-kick'; g.add(kick);
  // invisible collision volume
  const col = box(w, CARCASS_H, FRONT_Z, M.cabinetDark, { tile: 1 });
  col.position.set(0, CARCASS_H / 2, FRONT_Z / 2); col.visible = false; col.userData.collider = true; col.name = 'cabinet-collider'; g.add(col);
  return g;
}

export function buildSinkCabinet({ w, label }) {
  const g = hollowCarcass(w, 'sink-cabinet'); g.userData.label = label;
  const railH = 0.1;
  const rail = raisedDoor(w - 0.02, railH, 'false-drawer-front');
  rail.position.set(0, CARCASS_H - 0.01 - railH / 2, FRONT_Z + 0.01); g.add(rail);
  const doorH = CARCASS_H - 0.01 - railH - 0.01 - (KICK + 0.005);
  const dw = (w - 0.03) / 2;
  for (const s of [-1, 1]) {
    const d = raisedDoor(dw, doorH, s < 0 ? 'door-left' : 'door-right');
    d.position.set(s * (dw / 2 + 0.005), KICK + 0.005 + doorH / 2, FRONT_Z + 0.01); g.add(d);
    const p = pullBar({ vertical: true, len: 0.13 });
    p.position.set(s * 0.045, KICK + 0.005 + doorH * 0.78, FRONT_Z + 0.02); g.add(p);
  }
  return g;
}

function sconce(label) {
  const M = fixtureMats();
  const g = new THREE.Group(); g.name = 'wall-sconce'; g.userData.label = label;
  const add = (m, name) => { m.name = name; m.castShadow = true; g.add(m); };
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.014, 24), M.porcelain);
  plate.rotation.x = Math.PI / 2; plate.position.z = 0.007; add(plate, 'sconce-plate');
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.07, 14), M.porcelain);
  stub.rotation.x = Math.PI / 2; stub.position.z = 0.05; add(stub, 'sconce-arm');
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), M.porcelain);
  elbow.position.z = 0.085; add(elbow, 'sconce-elbow');
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.07, 16), M.porcelain);
  sock.position.set(0, 0.04, 0.085); add(sock, 'sconce-socket');
  const bulb = buildScrewBulb();
  bulb.position.set(0, 0.075, 0.085);   // top of the socket
  g.add(bulb);
  return g;
}

/** Whole counter run on the west wall. Group is placed so run-local +x = north, +z = into the room. */
export function buildCounterRun() {
  const M = fixtureMats();
  const C = K.counter;
  const root = new THREE.Group();
  root.name = 'counter-run'; root.userData.movable = true; root.userData.label = 'Kitchen counter run (west wall)';
  // west-wall frame: local +x runs north (u = D - z), local +z points east into the room
  root.position.set(0.02, 0, K.depth);
  root.rotation.y = Math.PI / 2;
  // wall plane is at local z = -0.02 (we're offset off the baseboard)

  let u = K.depth - C.startZ;
  const spans = {};
  for (const unit of C.units) {
    // the sink cabinet runs on to the north wall, leaving only `northGap`
    if (unit.type === 'sink-cabinet') unit.w = K.depth - C.northGap - u;
    const cx = u + unit.w / 2;
    let g;
    if (unit.type === 'stove') g = buildStove({ w: unit.w, d: C.depth, label: unit.label });
    if (unit.type === 'drawer-cabinet') g = buildDrawerCabinet({ w: unit.w, label: unit.label });
    if (unit.type === 'sink-cabinet') g = buildSinkCabinet({ w: unit.w, label: unit.label });
    g.position.set(cx, 0, 0.0);
    root.add(g);
    spans[unit.type] = [u, u + unit.w];
    u += unit.w;
  }

  // granite top over the two cabinets, with a hole for the sink
  const x0 = spans['drawer-cabinet'][0], x1 = spans['sink-cabinet'][1];
  const over = 0.04, td = C.depth + over - 0.02, t = 0.04;
  const sinkC = (spans['sink-cabinet'][0] + spans['sink-cabinet'][1]) / 2;
  const bw = SINK.bowlW + 0.012, bd = SINK.bowlD + 0.012, bz = 0.03 + SINK.rimD / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0, 0); shape.lineTo(x1, 0); shape.lineTo(x1, -td); shape.lineTo(x0, -td); shape.lineTo(x0, 0);
  const hole = new THREE.Path();
  hole.moveTo(sinkC - bw / 2, -(bz - bd / 2)); hole.lineTo(sinkC - bw / 2, -(bz + bd / 2));
  hole.lineTo(sinkC + bw / 2, -(bz + bd / 2)); hole.lineTo(sinkC + bw / 2, -(bz - bd / 2)); hole.lineTo(sinkC - bw / 2, -(bz - bd / 2));
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(geo, M.granite);
  top.position.set(0, C.topH - t, 0); top.name = 'granite-countertop'; top.castShadow = top.receiveShadow = true;
  top.userData.label = 'Granite countertop';
  root.add(top);

  const sink = buildSink();
  sink.position.set(sinkC, C.topH, bz);
  root.add(sink);

  // porcelain wall sconce (run-local x from its world z)
  const sc = sconce('White porcelain wall light');
  sc.position.set(K.depth - C.sconceZ, C.sconceY, -0.02);
  root.add(sc);
  return root;
}
