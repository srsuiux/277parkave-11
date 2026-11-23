import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { KITCHEN as K } from '../config.js';
import { fixtureMats } from './mats.js';

/**
 * White top-freezer refrigerator against the EAST wall, front facing west into the kitchen.
 * Built in a local frame where the front faces +z (x = right when facing it, y up), then rotated.
 * Door handles are recessed grips on the south edge; hinges on the north edge.
 */
export function buildFridge() {
  const F = K.fridge;
  const M = fixtureMats();
  const g = new THREE.Group();
  g.name = 'fridge'; g.userData.label = F.label; g.userData.movable = true;

  const add = (m, name, x, y, z, collide = false) => {
    m.position.set(x, y, z); m.name = name; m.castShadow = m.receiveShadow = true; m.userData.collider = collide; g.add(m); return m;
  };
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);

  const kick = 0.07, bodyD = F.d - 0.03;
  // cabinet shell (slightly set back so the doors stand proud)
  add(rbox(F.w, F.h - kick, bodyD, 0.012, M.enamel), 'fridge-body', 0, kick + (F.h - kick) / 2, bodyD / 2, true);
  add(new THREE.Mesh(rBox(F.w - 0.08, kick, bodyD - 0.1), M.black), 'fridge-kick-grille', 0, kick / 2, (bodyD - 0.1) / 2 + 0.03);

  // doors
  const freezerH = 0.56, seam = 0.016, doorT = 0.03;
  const doorsTop = F.h - 0.015, doorsBottom = kick + 0.012;
  const fridgeH = doorsTop - doorsBottom - freezerH - seam;
  const dw = F.w - 0.012, dz = bodyD + doorT / 2 - 0.002;
  const fridgeY = doorsBottom + fridgeH / 2, freezerY = doorsTop - freezerH / 2;
  add(rbox(dw, fridgeH, doorT, 0.012, M.enamel), 'fridge-door-lower', 0, fridgeY, dz);
  add(rbox(dw, freezerH, doorT, 0.012, M.enamel), 'fridge-door-freezer', 0, freezerY, dz);
  add(new THREE.Mesh(rBox(dw - 0.01, seam, 0.02), M.black), 'fridge-door-seam', 0, doorsTop - freezerH - seam / 2, bodyD + 0.006);

  // recessed grip handles on the south (right) edge: dark channel + front lip
  const hx = F.w / 2 - 0.045;
  for (const [name, y, hh] of [['freezer', freezerY - 0.06, 0.3], ['lower', fridgeY + fridgeH / 2 - 0.2, 0.4]]) {
    add(new THREE.Mesh(rBox(0.03, hh, 0.012), M.black), `fridge-handle-channel-${name}`, hx, y, dz + doorT / 2 - 0.002);
    add(rbox(0.012, hh + 0.01, 0.016, 0.005, M.enamelDim), `fridge-handle-lip-${name}`, hx + 0.012, y, dz + doorT / 2 - 0.0005);
  }

  // hinge covers on the north (left) edge
  const hinge = new THREE.MeshStandardMaterial({ color: 0xcfcdc4, roughness: 0.5 });
  for (const y of [doorsTop - 0.04, doorsTop - freezerH - seam - 0.04, doorsBottom + 0.1]) {
    add(new THREE.Mesh(rBox(0.014, 0.075, 0.012), hinge), 'fridge-hinge-cover', -F.w / 2 + 0.004, y, dz + doorT / 2 + 0.001);
  }

  // small badge plate on the lower door
  add(new THREE.Mesh(rBox(0.07, 0.016, 0.003), M.brushed), 'fridge-badge', -0.1, fridgeY + fridgeH / 2 - 0.07, dz + doorT / 2 + 0.001);

  // place against the east wall, front toward the room (west)
  g.rotation.y = -Math.PI / 2;          // local +z (front) -> world -x (west, into the room)
  g.position.set(K.width - 0.025, 0, F.z); // back plane just clear of the east wall's baseboard
  return g;
}
