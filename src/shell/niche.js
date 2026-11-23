import * as THREE from 'three';
import { box } from '../materials.js';

/**
 * A recess cut into the kitchen's NORTH wall (inner face at z=0, wall body to z=-t).
 * `depth` is measured from the inner face, so depth > t pushes a "chase" out behind the wall.
 * The opening itself is cut by kitchen.js; this builds the walls/floor/ceiling/shelves of the recess.
 */
export function buildNiche(n, { mats, H, t }) {
  const g = new THREE.Group();
  g.name = n.id;
  g.userData.label = n.label;
  const w = n.x1 - n.x0, h = n.y1 - n.y0;
  const wallMat = mats.kitchenWall;
  const solid = (b, collide = true) => { b.userData.collider = collide; g.add(b); return b; };

  // back wall
  const back = box(w + n.sideT * 2, h, 0.04, wallMat);
  back.position.set((n.x0 + n.x1) / 2, n.y0 + h / 2, -n.depth - 0.02);
  back.name = 'niche-back-wall';
  solid(back);

  // side walls (from the back of the wall body to the back panel)
  const sideLen = n.depth - t + 0.04;
  for (const [side, x] of [['L', n.x0 - n.sideT / 2], ['R', n.x1 + n.sideT / 2]]) {
    const s = box(n.sideT, h, sideLen, wallMat);
    s.position.set(x, n.y0 + h / 2, -t - sideLen / 2 + 0.0);
    s.name = side === 'L' ? 'niche-side-wall-left' : 'niche-side-wall-right';
    solid(s);
  }

  // top
  if (n.y1 >= H - 0.01) {
    const top = box(w + n.sideT * 2, 0.08, n.depth - t + 0.05, mats.ceiling);
    top.position.set((n.x0 + n.x1) / 2, H + 0.04, -t - (n.depth - t + 0.05) / 2 + 0.01);
    top.name = 'niche-ceiling';
    solid(top, false);
  } else {
    const top = box(w, 0.04, n.depth, wallMat);
    top.position.set((n.x0 + n.x1) / 2, n.y1 + 0.02, -n.depth / 2);
    top.name = 'niche-top';
    solid(top, false);
  }

  // bottom
  if (n.y0 <= 0.001) {
    const fl = box(w + n.sideT * 2, 0.06, n.depth - t + 0.05, mats.floor, { tile: 1 });
    fl.position.set((n.x0 + n.x1) / 2, -0.03, -t - (n.depth - t + 0.05) / 2 + 0.01);
    fl.name = 'niche-floor';
    solid(fl, false);
  }

  // shelves (flush with the wall face, painted white)
  (n.shelves ?? []).forEach((y, i) => {
    const sh = box(w, 0.028, n.depth - 0.01, mats.trim, { tile: 1 });
    sh.position.set((n.x0 + n.x1) / 2, y, -(n.depth - 0.01) / 2 - 0.005);
    sh.name = `shelf-${i + 1}-of-${n.shelves.length}`;
    solid(sh, false);
  });

  // Trim that follows the recess inward (side -> back -> side) instead of bridging the opening.
  if (n.trim) {
    const trim = (w2, h2, d2, x, y, z, name) => {
      const b = box(w2, h2, d2, mats.trim, { tile: 1 });
      b.position.set(x, y, z); b.name = name; g.add(b);
    };
    const cx = (n.x0 + n.x1) / 2;
    if (n.y1 >= H - 0.01) {
      trim(w, 0.07, 0.04, cx, H - 0.035, -n.depth + 0.02, 'recess-crown-back');
      trim(0.04, 0.07, n.depth, n.x0 + 0.02, H - 0.035, -n.depth / 2, 'recess-crown-left');
      trim(0.04, 0.07, n.depth, n.x1 - 0.02, H - 0.035, -n.depth / 2, 'recess-crown-right');
    }
    if (n.y0 <= 0.001) {
      trim(w, 0.14, 0.022, cx, 0.07, -n.depth + 0.011, 'recess-baseboard-back');
      trim(0.022, 0.14, n.depth, n.x0 + 0.011, 0.07, -n.depth / 2, 'recess-baseboard-left');
      trim(0.022, 0.14, n.depth, n.x1 - 0.011, 0.07, -n.depth / 2, 'recess-baseboard-right');
    }
  }
  return g;
}
