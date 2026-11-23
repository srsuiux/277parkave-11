import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Box with softly rounded edges (no razor-sharp corners on objects). Falls back to a plain box for very thin parts. */
export function rBox(w, h, d, r = 0.004) {
  const m = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
  if (m < 0.008) return new THREE.BoxGeometry(w, h, d);
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, m * 0.3));
  g.parameters = { width: w, height: h, depth: d };
  return g;
}
