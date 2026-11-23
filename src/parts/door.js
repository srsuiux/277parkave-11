import * as THREE from 'three';
import { box as rawBox } from '../materials.js';
const box = (w, h, d, m, o = {}) => rawBox(w, h, d, m, { round: 0.004, ...o });
import { addEntryHardware, addHinges } from './hardware.js';

/**
 * Five-panel door with casing on both faces, built to sit in a wall of thickness `t`.
 * Origin: centre of the opening, floor level, middle of the wall thickness.
 * Local +z is the room side. `hinge` is as seen from inside the room.
 * `open` is degrees, swinging into the room.
 */
export const GAP = 0.02; // jamb reveal each side

export function doorOpening(w, h) {
  return { w: w + GAP * 2, h: h + GAP };
}

export function createDoor({ w = 0.82, h = 2.03, t = 0.14, color = 0xf1efe8, open = 0, hinge = 'left', hardware = 'default', sticker = false, reverse = false, peephole = false, knobColor = null, locked = false, maxOpen = 95, swing = 1, label = '', mats }) {
  const g = new THREE.Group();
  g.name = 'door';
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const casingW = 0.085, casingD = 0.025;
  const ow = w + GAP * 2, oh = h + GAP;

  // jambs lining the reveal
  const jambT = 0.02;
  for (const s of [-1, 1]) {
    const j = box(jambT, oh, t, mats.trim, { tile: 1 });
    j.name = 'door-jamb';
    j.position.set(s * (ow / 2 - jambT / 2), oh / 2, -t / 2);
    g.add(j);
  }
  const head = box(ow, jambT, t, mats.trim, { tile: 1 });
  head.position.set(0, oh - jambT / 2, -t / 2);
  g.add(head);

  // casing on both faces
  for (const face of [1, -1]) {
    const z = face === 1 ? casingD / 2 : -t - casingD / 2;
    for (const s of [-1, 1]) {
      const c = box(casingW, oh + casingW, casingD, mats.trim, { tile: 1 });
      c.name = 'door-casing';
      c.position.set(s * (ow / 2 + casingW / 2), (oh + casingW) / 2, z);
      g.add(c);
    }
    const hd = box(ow + casingW * 2 + 0.03, casingW + 0.015, casingD + 0.012, mats.trim, { tile: 1 });
    hd.position.set(0, oh + casingW / 2 + 0.005, z + (face === 1 ? 0.006 : -0.006));
    g.add(hd);
  }

  // leaf (pivot at hinge edge)
  const pivot = new THREE.Group();
  const dir = hinge === 'left' ? 1 : -1;
  pivot.position.set(-dir * (w / 2), 0, -t / 2);
  const leaf = new THREE.Group();
  leaf.name = 'door-leaf';
  leaf.position.x = dir * (w / 2);
  const slab = box(w, h, 0.04, paint, { tile: 1 });
  slab.name = 'door-slab';
  slab.position.y = h / 2;
  leaf.add(slab);

  const stile = 0.115, rail = 0.13, gap = 0.09;
  const pw = w - stile * 2;
  const ph = (h - rail * 2 - gap * 4) / 5;
  for (let i = 0; i < 5; i++) {
    const y = rail + ph / 2 + i * (ph + gap);
    for (const side of [1, -1]) {
      const p = box(pw, ph, 0.02, paint, { tile: 1 });
      p.name = 'door-panel';
      p.position.set(0, y, side * 0.026);
      leaf.add(p);
    }
  }
  addHinges(leaf, { w, dir, face: swing < 0 ? -0.02 : 0.02 }); // hinge knuckles sit on the face the door swings toward
  if (hardware === 'entry') {
    addEntryHardware(leaf, { w, h, dir, sticker, reverse, peephole, knobColor });
  } else {
    // plain brass knob (free edge)
    for (const side of [1, -1]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), mats.brass);
      k.position.set(dir * (w / 2 - 0.07), 0.98, side * 0.075);
      k.castShadow = true;
      leaf.add(k);
    }
  }
  pivot.add(leaf);
  // positive rotation.y swings local +x toward -z; we want into the room (+z)
  pivot.rotation.y = swing * dir * -THREE.MathUtils.degToRad(open);
  g.add(pivot);
  g.userData.pivot = pivot;
  g.userData.leaf = leaf;
  g.userData.slab = slab;
  g.userData.dir = dir;
  g.userData.angle = open;
  g.userData.target = open;
  g.userData.isDoor = true;
  g.userData.locked = locked;
  g.userData.maxOpen = maxOpen;
  g.userData.swing = swing;
  g.userData.label = label;
  return g;
}

/** Simple two-sash window with casing and a bright "outside" backdrop. */
export function createWindow({ w = 1.1, h = 0.55, t = 0.14, mats }) {
  const g = new THREE.Group();
  g.name = 'window';
  const fr = 0.05;
  for (const face of [1, -1]) {
    const z = face === 1 ? 0.0125 : -t - 0.0125;
    for (const [bw, bh, x, y] of [
      [w + fr * 2, fr, 0, h + fr / 2],
      [w + fr * 2, fr, 0, -fr / 2],
      [fr, h, -(w / 2 + fr / 2), h / 2],
      [fr, h, w / 2 + fr / 2, h / 2],
    ]) {
      const b = box(bw, bh, 0.025, mats.trim, { tile: 1 });
      b.position.set(x, y, z);
      g.add(b);
    }
  }
  const mull = box(0.04, h, 0.04, mats.trim, { tile: 1 });
  mull.position.set(0, h / 2, -t / 2);
  g.add(mull);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glass);
  glass.position.set(0, h / 2, -t / 2);
  g.add(glass);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, h + 0.2), mats.outside);
  bg.position.set(0, h / 2, -t - 0.06);
  bg.rotation.y = Math.PI;
  g.add(bg);
  return g;
}
