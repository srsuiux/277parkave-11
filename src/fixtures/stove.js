import * as THREE from 'three';
import { box as rawBox } from '../materials.js';
const box = (w, h, d, m, o = {}) => rawBox(w, h, d, m, { round: 0.004, ...o });
import { fixtureMats } from './mats.js';

/**
 * 20" white electric coil range (IMG_1284). Unit-local space: x centred on the unit,
 * z=0 at the wall, z grows toward the room (front), y up from the floor.
 */
export function buildStove({ w = 0.51, d = 0.6, label }) {
  const M = fixtureMats();
  const g = new THREE.Group();
  g.name = 'stove'; g.userData.label = label;
  const add = (m, name, collide = false) => { m.name = name; m.userData.collider = collide; g.add(m); return m; };
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

  const top = 0.9;
  add(at(box(w, top - 0.04, d - 0.02, M.enamel, { tile: 1 }), 0, 0.04 + (top - 0.04) / 2, (d - 0.02) / 2), 'stove-body', true);
  add(at(box(w - 0.06, 0.04, d - 0.1, M.black, { tile: 1 }), 0, 0.02, (d - 0.1) / 2 + 0.02), 'stove-kick');
  add(at(box(w + 0.01, 0.025, d, M.enamel, { tile: 1 }), 0, top + 0.0125, d / 2), 'stove-cooktop-deck');

  // coil burners on dark drip pans
  for (const [bx, bz, r] of [[-0.12, 0.2, 0.072], [0.12, 0.2, 0.072], [-0.12, 0.44, 0.072], [0.12, 0.44, 0.072]]) {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.008, 0.008, 28), M.coil);
    at(pan, bx, top + 0.027, bz); add(pan, 'stove-drip-pan');
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 0.007, 8, 28), M.coil);
    coil.rotation.x = Math.PI / 2; at(coil, bx, top + 0.036, bz); add(coil, 'stove-coil-burner');
    const coil2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.38, 0.006, 8, 24), M.coil);
    coil2.rotation.x = Math.PI / 2; at(coil2, bx, top + 0.036, bz); add(coil2, 'stove-coil-burner-inner');
  }

  // backguard
  add(at(box(w + 0.01, 0.11, 0.04, M.enamel, { tile: 1 }), 0, top + 0.025 + 0.055, 0.02), 'stove-backguard');

  // control console with knobs just under the cooktop lip
  const front = d - 0.01;
  add(at(box(w - 0.01, 0.1, 0.025, M.enamel, { tile: 1 }), 0, 0.81, front + 0.005), 'stove-control-console');
  const knobs = [[-0.185, 0.026], [-0.095, 0.018], [-0.025, 0.018], [0.045, 0.018], [0.115, 0.018]];
  knobs.forEach(([kx, r], i) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.03, 20), M.cream);
    k.rotation.x = Math.PI / 2; at(k, kx, 0.815, front + 0.03); add(k, `stove-knob-${i + 1}`);
  });

  // oven door, handle, bottom drawer
  add(at(box(w - 0.02, 0.5, 0.03, M.enamel, { tile: 1 }), 0, 0.48, front + 0.003), 'stove-oven-door');
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, w - 0.1, 14), M.enamelDim);
  bar.rotation.z = Math.PI / 2; at(bar, 0, 0.71, front + 0.045); add(bar, 'stove-oven-handle');
  for (const sx of [-1, 1]) {
    const post = box(0.014, 0.014, 0.03, M.enamelDim, { tile: 1 });
    add(at(post, sx * (w / 2 - 0.05), 0.71, front + 0.028), 'stove-handle-post');
  }
  add(at(box(w - 0.02, 0.005, 0.02, M.black, { tile: 1 }), 0, 0.224, front + 0.012), 'stove-door-gap');
  add(at(box(w - 0.02, 0.17, 0.03, M.enamel, { tile: 1 }), 0, 0.13, front + 0.003), 'stove-bottom-drawer');
  return g;
}
