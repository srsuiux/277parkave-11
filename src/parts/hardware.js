import * as THREE from 'three';

// Entry-door hardware, modelled from IMG_1280 (kitchen side) and IMG_1281 (hallway side).
// Each builder returns a group that faces +z; the caller rotates it for the other face.

let cache;
function m() {
  if (cache) return cache;
  cache = {
    brass:    new THREE.MeshStandardMaterial({ color: 0x9a8350, roughness: 0.38, metalness: 0.85 }),
    darkHole: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
    knob:     new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.3, metalness: 0.2 }),
    plateIn:  new THREE.MeshStandardMaterial({ color: 0xe4e0d2, roughness: 0.55, metalness: 0.1 }), // cream/white cast plate
    plateOut: new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.45, metalness: 0.35 }),  // dark bronze
    steel:    new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.45, metalness: 0.7 }),
    hinge:    new THREE.MeshStandardMaterial({ color: 0xb9b9b3, roughness: 0.5, metalness: 0.5 }),
    sticker:  new THREE.MeshStandardMaterial({ map: stickerTexture(), roughness: 0.4, transparent: true }),
  };
  return cache;
}

function stickerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fillStyle = '#d8232a'; x.fill();
  x.beginPath(); x.arc(128, 128, 98, 0, Math.PI * 2); x.fillStyle = '#f4f1ea'; x.fill();
  x.fillStyle = '#c8202a'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center';
  x.fillText('SEALED', 128, 108); x.fillText('FOR YOUR', 128, 140); x.fillText('SAFETY', 128, 172);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function disc(r, h, mat) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mat);
  g.rotation.x = Math.PI / 2;
  g.castShadow = true;
  return g;
}

/** Brass deadbolt rose. Inside: thumb-turn. Outside: key cylinder. */
export function deadbolt(inside) {
  const M = m();
  const g = new THREE.Group();
  const base = disc(0.037, 0.01, M.brass); base.position.z = 0.005; g.add(base);
  const ring = disc(0.027, 0.006, M.brass); ring.position.z = 0.012; g.add(ring);
  if (inside) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.014), M.brass);
    bar.position.z = 0.02; bar.rotation.z = 0.1; bar.castShadow = true; g.add(bar);
  } else {
    const hole = disc(0.011, 0.004, M.darkHole); hole.position.z = 0.015; g.add(hole);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.004), M.darkHole);
    slit.position.set(0, -0.012, 0.015); g.add(slit);
  }
  return g;
}

/** Steel plate with the "SEALED FOR YOUR SAFETY" sticker (kitchen side). */
export function stickerPlate(withPlate = true) {
  const M = m();
  const g = new THREE.Group();
  if (withPlate) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.004), M.steel);
    p.position.set(-0.012, 0, 0.002); g.add(p);
  }
  const s = new THREE.Mesh(new THREE.CircleGeometry(0.036, 40), M.sticker);
  s.position.set(0, 0, withPlate ? 0.0046 : 0.0012);
  g.add(s);
  return g;
}

function plateShape() {
  const half = [
    [0, 0.088], [0.015, 0.085], [0.026, 0.072], [0.025, 0.056], [0.017, 0.042], [0.014, 0.022],
    [0.016, 0.0], [0.014, -0.022], [0.017, -0.042], [0.025, -0.056], [0.026, -0.072], [0.015, -0.085], [0, -0.088],
  ];
  const pts = [...half.map(([x, y]) => new THREE.Vector2(x, y)),
    ...half.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector2(-x, y))];
  let poly = pts;
  for (let it = 0; it < 3; it++) { // Chaikin corner cutting: smooth, no overshoot
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      out.push(p0.clone().lerp(p1, 0.25), p0.clone().lerp(p1, 0.75));
    }
    poly = out;
  }
  return new THREE.Shape(poly);
}

/** Black knob on a Victorian escutcheon plate. Inside: cream cast plate. Outside: dark bronze. */
export function knobSet(inside, knobColor) {
  const M = m();
  const knobMat = knobColor ? new THREE.MeshStandardMaterial({ color: knobColor, roughness: 0.25 }) : M.knob;
  const g = new THREE.Group();
  const shape = plateShape();
  const mat = inside ? M.plateIn : M.plateOut;

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.005, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2, curveSegments: 4 }),
    mat);
  plate.castShadow = true; g.add(plate);
  // raised inner field for the embossed look
  const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: false }), mat);
  inner.scale.set(0.62, 0.8, 1); inner.position.z = 0.0068; g.add(inner);
  for (const y of [0.066, -0.066]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 8, 20), mat);
    r.position.set(0, y, 0.0075); g.add(r);
  }

  const keyhole = disc(0.0055, 0.003, M.darkHole); keyhole.position.set(0, -0.045, 0.0075); g.add(keyhole);
  const kslit = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.014, 0.003), M.darkHole);
  kslit.position.set(0, -0.054, 0.0075); g.add(kslit);

  // knob + neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.034, 20), knobMat);
  neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.018, 0.024); g.add(neck);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 24), knobMat);
  ball.scale.z = 0.88; ball.position.set(0, 0.018, 0.058); ball.castShadow = true; g.add(ball);
  return g;
}

/** Door viewer: brass barrel + dark fisheye lens. Inside has a larger housing. */
export function peephole(inside) {
  const M = m();
  const g = new THREE.Group();
  const r = inside ? 0.017 : 0.011;
  const ring = disc(r, 0.008, M.brass); ring.position.z = 0.004; g.add(ring);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.darkHole);
  lens.rotation.x = Math.PI / 2; lens.scale.set(1, 1, 0.5); lens.position.z = 0.008; g.add(lens);
  return g;
}

/** Butt hinge on the room-side face, at the hinge edge. x is the hinge edge in leaf space. */
export function hinge(dir) {
  const M = m();
  const g = new THREE.Group();
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.09, 14), M.hinge);
  pin.position.set(0, 0, 0.0); g.add(pin);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.003), M.hinge);
  plate.position.set(dir * 0.015, 0, 0.0); g.add(plate);
  return g;
}

/**
 * Adds the full entry-door hardware set to a leaf group.
 * reverse: the room-side face (+z) shows the "outside" variant (we're looking at the door's back).
 * sticker: add the red SEALED sticker. peephole: add a viewer above the knob.
 */
export function addEntryHardware(leaf, { w, h, dir, face = 0.02, sticker = false, reverse = false, peephole: pe = false, knobColor = null }) {
  const x = dir * (w / 2 - 0.066); // free (latch) edge, opposite the hinge
  for (const side of [1, -1]) {
    const inside = (side === 1) !== reverse;
    const set = new THREE.Group();
    set.name = side === 1 ? 'hardware-room-side' : 'hardware-far-side';
    set.position.set(x, 0, side * face);
    set.rotation.y = side === 1 ? 0 : Math.PI;

    const bolt = deadbolt(inside); bolt.name = 'deadbolt'; bolt.position.y = 1.12; set.add(bolt);
    if (sticker) {
      const sp = stickerPlate(inside); sp.name = inside ? 'sticker-plate' : 'sticker'; sp.position.y = 0.98; set.add(sp);
    }
    const k = knobSet(inside, knobColor); k.name = 'knob-and-plate'; k.position.y = 0.69; set.add(k);
    if (pe) { const p = peephole(inside); p.name = 'peephole'; p.position.y = 1.52; set.add(p); }
    leaf.add(set);
  }
}

export function addHinges(leaf, { w, dir, face = 0.02 }) {
  for (const y of [0.22, 1.0, 1.84]) {
    const hg = hinge(dir); hg.name = 'hinge';
    hg.position.set(-dir * (w / 2 - 0.004), y, face + 0.001); // hinge edge
    leaf.add(hg);
  }
}
