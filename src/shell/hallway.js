import * as THREE from 'three';
import { HALLWAY as Hc, KITCHEN as K } from '../config.js';
import { box } from '../materials.js';
import { buildWall } from './wall.js';
import { doorOpening } from '../parts/door.js';

/**
 * Corridor outside the entrance. Local space: x 0..width, z 0..length, with the entrance
 * at z=0 and the stairwell railing on the x=0 side. The group is rotated 180° and attached
 * to the outside of the kitchen's north door, so it runs north (-z) from the apartment.
 */
export function buildHallway(mats) {
  const root = new THREE.Group();
  root.name = 'hallway-shell';
  root.userData.label = Hc.label;
  const { width: W, length: L, height: H, wallT: t } = Hc;
  const entrance = K.doors.find((d) => d.id === 'north-door');

  // thin tan cladding over the kitchen wall's outer face, with a hole for the door casing
  const o = doorOpening(entrance.w, entrance.h);
  const uc = W / 2 + Hc.doorShift;
  const hole = o.w / 2 + 0.085 + 0.015;
  const end = buildWall({
    length: W, height: H, t: 0.02, ext: t, mat: mats.hallWall, mats,
    openings: [{ u0: uc - hole, u1: uc + hole, y0: 0, y1: o.h + 0.085 + 0.03 }],
  });
  end.traverse((m) => { if (m.userData) m.userData.collider = false; });
  end.name = 'hallway-entrance-cladding';
  root.add(end);

  // "11" transom board above the entrance (IMG_1281): white board with two dark slots
  const boardH = 0.15;
  const boardY = o.h + 0.085 + 0.045;
  const board = box(hole * 2 + 0.2, boardH, 0.02, mats.trim, { tile: 1 });
  board.position.set(uc, boardY + boardH / 2, 0.01);
  board.name = 'number-11-board';
  root.add(board);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 1 });
  for (const [dx, tilt] of [[-0.035, 0.18], [0.035, -0.18]]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.004), slotMat);
    slot.position.set(uc + dx, boardY + boardH / 2, 0.021);
    slot.rotation.z = tilt;
    root.add(slot);
  }

  // east-of-hallway wall (local x=W), full length
  const solid = buildWall({ length: L, height: H, t, ext: 0, mat: mats.hallWall, mats });
  solid.position.set(W, 0, 0); solid.rotation.y = -Math.PI / 2;
  solid.name = 'hallway-wall-west';
  root.add(solid);

  // stairwell side (local x=0): wall up to the railing
  const westLen = Hc.railFrom;
  const west = buildWall({ length: westLen, height: H, t, ext: 0, mat: mats.hallWall, mats });
  west.position.set(0, 0, westLen); west.rotation.y = Math.PI / 2;
  west.name = 'hallway-wall-east-partial';
  root.add(west);

  // far end closed off (placeholder for the rest of the building)
  const far = buildWall({ length: W, height: H, t, ext: t, mat: mats.hallWall, mats });
  far.position.set(W, 0, L); far.rotation.y = Math.PI;
  far.name = 'hallway-far-wall';
  far.userData.label = 'Hallway far wall (placeholder)';
  root.add(far);

  // railing
  const rail = new THREE.Group();
  rail.name = 'railing';
  rail.userData.label = 'Stairwell railing';
  const len = L - Hc.railFrom;
  const hr = box(0.07, 0.06, len, mats.railing, { tile: 1 });
  hr.position.set(0, 0.96, Hc.railFrom + len / 2);
  hr.userData.collider = true; hr.name = 'handrail';
  rail.add(hr);
  const br = box(0.05, 0.04, len, mats.railing, { tile: 1 });
  br.position.set(0, 0.12, Hc.railFrom + len / 2);
  br.name = 'bottom-rail';
  rail.add(br);
  const n = Math.floor(len / 0.12);
  for (let i = 0; i < n; i++) {
    const b = box(0.035, 0.82, 0.035, mats.railing, { tile: 1 });
    b.position.set(0, 0.54, Hc.railFrom + 0.1 + i * ((len - 0.1) / n));
    b.name = `baluster-${i + 1}`;
    rail.add(b);
  }
  const newel = box(0.12, 1.1, 0.12, mats.railing, { tile: 1 });
  newel.position.set(0, 0.55, Hc.railFrom);
  newel.userData.collider = true; newel.name = 'newel-post';
  rail.add(newel);
  root.add(rail);

  const floor = box(W + t, 0.06, L, mats.floor, { tile: 1 });
  floor.position.set(W / 2, -0.03, L / 2);
  floor.name = 'floor';
  root.add(floor);

  const slab = box(W + t, 0.08, L, mats.hallCeiling);
  slab.position.set(W / 2, H + 0.04, L / 2);
  slab.name = 'ceiling-slab';
  root.add(slab);

  // attach: local x=W/2 -> world door x, local z=0 -> just outside the kitchen's north wall
  root.rotation.y = Math.PI;
  root.position.set(entrance.at + W / 2 + Hc.doorShift, 0, -K.wallT - 0.002);
  return root;
}
