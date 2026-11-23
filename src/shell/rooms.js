import * as THREE from 'three';
import { KITCHEN as K, ROOMS } from '../config.js';
import { box } from '../materials.js';
import { buildWall } from './wall.js';

/**
 * Empty placeholder rooms behind the bedroom / east / west doors, so the doors open onto
 * something instead of a void. Each room shares one kitchen wall and adds the other three.
 */
export function buildRooms(mats) {
  const root = new THREE.Group();
  root.name = 'rooms';
  const { width: W, depth: D, height: H, wallT: t } = K;

  for (const r of ROOMS) {
    let x0, x1, z0, z1, skip;
    if (r.side === 'S') { x0 = 0; x1 = W; z0 = D + t; z1 = z0 + r.depth; skip = 'N'; }
    if (r.side === 'E') { x0 = W + t; x1 = x0 + r.width; z0 = r.z0; z1 = D; skip = 'W'; }
    if (r.side === 'W') { x1 = -t; x0 = x1 - r.width; z0 = r.z0; z1 = D; skip = 'E'; }

    const g = new THREE.Group();
    g.name = r.id;
    g.userData.label = r.label;
    const frames = {
      N: { pos: [x0, 0, z0], rotY: 0, length: x1 - x0, ext: t },
      E: { pos: [x1, 0, z0], rotY: -Math.PI / 2, length: z1 - z0, ext: 0 },
      S: { pos: [x1, 0, z1], rotY: Math.PI, length: x1 - x0, ext: t },
      W: { pos: [x0, 0, z1], rotY: Math.PI / 2, length: z1 - z0, ext: 0 },
    };
    for (const [key, f] of Object.entries(frames)) {
      if (key === skip) continue;
      const wall = buildWall({ length: f.length, height: H, t, ext: f.ext, mat: mats.kitchenWall, mats });
      wall.name = `wall-${key}`;
      wall.position.set(...f.pos);
      wall.rotation.y = f.rotY;
      g.add(wall);
    }
    const floor = box(x1 - x0 + t * 2, 0.06, z1 - z0 + t * 2, mats.floor, { tile: 1 });
    floor.position.set((x0 + x1) / 2, -0.03, (z0 + z1) / 2);
    floor.name = 'floor';
    g.add(floor);
    const ceil = box(x1 - x0 + t * 2, 0.08, z1 - z0 + t * 2, mats.ceiling);
    ceil.position.set((x0 + x1) / 2, H + 0.04, (z0 + z1) / 2);
    ceil.name = 'ceiling';
    g.add(ceil);

    const light = new THREE.PointLight(0xffd9a8, 3, 0, 2);
    light.position.set((x0 + x1) / 2, H - 0.3, (z0 + z1) / 2);
    g.add(light);
    root.add(g);
  }
  return root;
}
