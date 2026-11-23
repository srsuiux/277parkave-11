import * as THREE from 'three';
import { std, wood, mk, bx, rb, cyl, finish } from './furniture.js';
import { paintable } from '../paint.js';

/**
 * Compact bedside storage table with a hinged lid: the whole top swings up on a back hinge and reveals a hollow compartment
 * holding a few small belongings. Faces +z (front); the hinge is at the back edge.
 */
export function buildStorageTable() {
  const g = new THREE.Group(), W = 0.42, D = 0.4, H = 0.46, t = 0.022, LT = 0.03;
  const body = wood('#8b6a46', '#3a2514'), lidM = wood('#9a7650', '#3a2514'), inner = std(0x3b2a1c, 0.85), steel = std(0xb9bcc0, 0.3, 0.85);
  // carcass: four sides + floor of the compartment (open on top)
  bx(g, W, H - 0.05, t, body, 'table-front', 0, (H - 0.05) / 2 + 0.05, D / 2 - t / 2);
  bx(g, W, H - 0.05, t, body, 'table-back', 0, (H - 0.05) / 2 + 0.05, -D / 2 + t / 2);
  for (const s of [-1, 1]) bx(g, t, H - 0.05, D - 2 * t, body, 'table-side', s * (W / 2 - t / 2), (H - 0.05) / 2 + 0.05, 0);
  bx(g, W - 2 * t, 0.018, D - 2 * t, inner, 'compartment-floor', 0, 0.2, 0);
  bx(g, W, 0.02, D, body, 'table-base', 0, 0.06, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.02, 0.016, 0.05, std(0x2a1c10, 0.6), 'table-foot', sx * (W / 2 - 0.035), 0.025, sz * (D / 2 - 0.035), null, 12);
  // inner lining so the hollow reads as a compartment, not the outside colour
  for (const s of [-1, 1]) bx(g, 0.004, H - 0.28, D - 2 * t, inner, 'lining-side', s * (W / 2 - t - 0.002), 0.2 + (H - 0.28) / 2 + 0.01, 0);
  bx(g, W - 2 * t, H - 0.28, 0.004, inner, 'lining-back', 0, 0.2 + (H - 0.28) / 2 + 0.01, -D / 2 + t + 0.002);
  bx(g, W - 2 * t, H - 0.28, 0.004, inner, 'lining-front', 0, 0.2 + (H - 0.28) / 2 + 0.01, D / 2 - t - 0.002);
  // small belongings inside (kept within the compartment: x ±0.17, z ±0.16, resting on the floor at y 0.209)
  const fy = 0.209;
  rb(g, 0.13, 0.02, 0.18, 0.004, std(0x2f4f7a, 0.8), 'stored-notebook', -0.08, fy + 0.01, -0.04, [0, 0.12, 0]);
  rb(g, 0.07, 0.008, 0.145, 0.006, std(0x16171a, 0.35, 0.4), 'stored-phone', 0.09, fy + 0.004, -0.05, [0, -0.25, 0]);
  cyl(g, 0.02, 0.02, 0.006, steel, 'stored-key-ring', 0.08, fy + 0.003, 0.09, null, 18);
  cyl(g, 0.014, 0.014, 0.05, std(0xd9822b, 0.5), 'stored-bottle', -0.12, fy + 0.025, 0.1, null, 14);
  cyl(g, 0.015, 0.015, 0.012, std(0xf2f2f2, 0.5), 'stored-bottle-cap', -0.12, fy + 0.056, 0.1, null, 14);
  // lid, hinged at the back top edge, swings up and slightly past vertical
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2 - 0.004); g.add(lid);
  bx(lid, W + 0.02, LT, D + 0.012, lidM, 'table-lid', 0, LT / 2 - 0.004, D / 2 + 0.006);
  bx(lid, 0.06, 0.012, 0.012, steel, 'lid-pull', 0, LT / 2, D + 0.012);
  for (const s of [-1, 1]) bx(g, 0.04, 0.012, 0.01, steel, 'hinge', s * 0.13, H + 0.002, -D / 2 - 0.004);
  const OPEN = -1.62;
  let open = false, ang = 0;
  g.userData.interact = { prompt: () => `<kbd>E</kbd> ${open ? 'close' : 'open'} the table lid`, run: () => { open = !open; } };
  g.userData.update = (dt) => { ang += ((open ? OPEN : 0) - ang) * Math.min(1, dt * 5); lid.rotation.x = ang; };
  g.userData.persist = { get: () => open, set: (v) => { open = !!v; ang = open ? OPEN : 0; lid.rotation.x = ang; } };
  finish(g, 'bedside-storage-table', 'Bedside storage table (lid opens)', W, H, D);
  return paintable(g, [{ label: 'Table body', mats: [body] }, { label: 'Lid', mats: [lidM] }]);
}
