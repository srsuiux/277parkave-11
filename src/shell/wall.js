import * as THREE from 'three';
import { box } from '../materials.js';

/**
 * Wall in local space: runs along +x from u=0 (inner corner) to u=length.
 * Inner face is the plane z=0 (normal +z); the body extends toward -z by `t`.
 * `openings`: [{ u0, u1, y0, y1 }] — rectangular cut-outs.
 * `ext`: extra body length past each end (to cover corners).
 */
export function buildWall({ length, height, t, ext = 0, openings = [], mat, mats, baseboard = true, crown = true }) {
  ext = Math.max(ext, 0.03);   // always overlap into the neighbouring wall: a butt joint leaves a hairline crack at the corner that shows the lit outer face behind it
  const g = new THREE.Group();
  const wallMat = mat.clone(); wallMat.shadowSide = THREE.FrontSide; /* thin walls: the default back-face shadow pass lets light leak through at corners */ g.userData.isWall = true; g.userData.wallMat = wallMat;   // every wall owns its material so it can be painted on its own
  const ops = [...openings].sort((a, b) => a.u0 - b.u0);

  const add = (u0, u1, y0, y1, collide = false) => {
    const w = u1 - u0, h = y1 - y0;
    if (w < 1e-4 || h < 1e-4) return;
    const m = box(w, h, t, wallMat);
    m.position.set(u0 + w / 2, y0 + h / 2, -t / 2);
    m.userData.collider = collide;
    m.name = collide ? (y0 > 0 ? 'wall-below-sill' : 'wall-section') : 'wall-header';
    g.add(m);
  };

  let cursor = -ext;
  for (const o of ops) {
    add(cursor, o.u0, 0, height, true);    // full-height pier
    if (cursor < o.u0) addTrim(g, mats, cursor, o.u0, height, baseboard, false);
    add(o.u0, o.u1, 0, o.y0, true);        // below sill
    add(o.u0, o.u1, o.y1, height);         // header
    cursor = o.u1;
  }
  add(cursor, length + ext, 0, height, true);
  addTrim(g, mats, cursor, length + ext, height, baseboard, false);

  if (crown) {
    // Crown molding is interrupted by any opening that reaches the ceiling (e.g. a full-height recess);
    // the recess builds its own trim that runs inward along its sides and back.
    const cuts = ops.filter((o) => o.y1 >= height - 0.07);
    let from = 0;
    const piece = (u0, u1) => {
      if (u1 - u0 < 0.01) return;
      const c = box(u1 - u0, 0.07, 0.04, mats.trim, { tile: 1 });
      c.position.set((u0 + u1) / 2, height - 0.035, 0.02);
      c.name = 'crown-molding';
      g.add(c);
    };
    for (const o of cuts) { piece(from, o.u0); from = o.u1; }
    piece(from, length);
  }
  return g;
}

function addTrim(g, mats, u0, u1, _h, baseboard) {
  if (!baseboard) return;
  const w = u1 - u0;
  if (w < 0.02) return;
  const b = box(w, 0.14, 0.022, mats.trim, { tile: 1 });
  b.name = 'baseboard';
  b.position.set(u0 + w / 2, 0.07, 0.011);
  g.add(b);
  const cap = box(w, 0.015, 0.03, mats.trim, { tile: 1 });
  cap.position.set(u0 + w / 2, 0.145, 0.015);
  g.add(cap);
}
