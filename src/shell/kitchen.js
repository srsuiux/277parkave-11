import * as THREE from 'three';
import { KITCHEN as K } from '../config.js';
import { box } from '../materials.js';
import { buildWall } from './wall.js';
import { buildNiche } from './niche.js';
import { buildCounterRun } from '../fixtures/counter.js';
import { buildRug } from '../fixtures/rug.js';
import { buildFridge } from '../fixtures/fridge.js';
import { buildFurniture } from '../fixtures/furniture.js';
import { buildPower } from '../fixtures/power.js';
import { buildCeilingLight, buildWallSwitch } from '../fixtures/lights.js';
import { createDoor, createWindow, doorOpening } from '../parts/door.js';

/** Kitchen / living area shell: floor, 4 walls with openings, doors, window, ceiling, soffit. */
export function buildKitchen(mats) {
  const root = new THREE.Group();
  root.name = 'kitchen-shell';
  root.userData.label = K.label;
  const { width: W, depth: D, height: H, wallT: t } = K;

  // wall frames: world placement + mapping from world coordinate to local u
  const frames = {
    N: { pos: [0, 0, 0],  rotY: 0,           length: W, ext: t, u: (x) => x },
    E: { pos: [W, 0, 0],  rotY: -Math.PI / 2, length: D, ext: 0, u: (z) => z },
    S: { pos: [W, 0, D],  rotY: Math.PI,      length: W, ext: t, u: (x) => W - x },
    W: { pos: [0, 0, D],  rotY: Math.PI / 2,  length: D, ext: 0, u: (z) => D - z },
  };

  const walls = new THREE.Group();
  walls.name = 'walls';
  for (const [key, f] of Object.entries(frames)) {
    const openings = [];
    const fixtures = [];
    for (const d of K.doors.filter((d) => d.wall === key)) {
      const o = doorOpening(d.w, d.h);
      const uc = f.u(d.at);
      openings.push({ u0: uc - o.w / 2, u1: uc + o.w / 2, y0: 0, y1: o.h });
      fixtures.push({ kind: 'door', d, uc });
    }
    for (const w of K.windows.filter((w) => w.wall === key)) {
      const uc = f.u(w.at);
      openings.push({ u0: uc - w.w / 2, u1: uc + w.w / 2, y0: w.sill, y1: w.sill + w.h });
      fixtures.push({ kind: 'window', w, uc });
    }
    if (key === 'N') {
      for (const n of K.niches ?? []) openings.push({ u0: n.x0, u1: n.x1, y0: n.y0, y1: n.y1 });
    }
    const wall = buildWall({ length: f.length, height: H, t, ext: f.ext, openings, mat: mats.kitchenWall, mats });
    wall.name = `wall-${key}`;
    wall.userData.label = K.wallLabels?.[key];
    for (const fx of fixtures) {
      if (fx.kind === 'door') {
        const door = createDoor({ ...fx.d, t, mats });
        door.name = fx.d.id;
        door.position.set(fx.uc, 0, 0);
        wall.add(door);
      } else {
        const win = createWindow({ ...fx.w, t, mats });
        win.name = fx.w.id;
        win.position.set(fx.uc, fx.w.sill, 0);
        wall.add(win);
      }
    }
    wall.position.set(...f.pos);
    wall.rotation.y = f.rotY;
    walls.add(wall);
  }
  root.add(walls);
  for (const n of K.niches ?? []) root.add(buildNiche(n, { mats, H, t }));

  // floor (top at y=0)
  const floor = box(W + t * 2, 0.06, D + t * 2, mats.floor, { tile: 1 });
  floor.position.set(W / 2, -0.03, D / 2);
  floor.name = 'floor';
  floor.userData.label = 'Kitchen floor';
  root.add(floor);

  // fixtures from IMG_1284: counter run (stove, cabinets, granite, sink, sconce) + rug
  root.add(buildCounterRun(), buildRug(), buildFridge(), ...buildFurniture(), ...buildPower(), buildCeilingLight(), buildWallSwitch());

  // ceiling group (toggle-able)
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  ceiling.userData.label = 'Kitchen ceiling';
  const slab = box(W + t * 2, 0.08, D + t * 2, mats.ceiling);
  slab.position.set(W / 2, H + 0.04, D / 2);
  slab.name = 'ceiling-slab';
  ceiling.add(slab);
  if (K.soffit) {
    const s = K.soffit;
    const len = s.to - s.from;
    const b = box(s.width, s.drop, len, mats.ceiling);
    b.name = 'soffit';
    b.position.set(s.width / 2, H - s.drop / 2, s.from + len / 2);
    ceiling.add(b);
  }
  root.add(ceiling);

  return root;
}
