import * as THREE from 'three';
import { rBox } from '../rbox.js';
import { KITCHEN as K } from '../config.js';

/**
 * Power set-up on the east wall, in the gap between the bookshelf and the fridge (IMG_1288):
 *   wall outlet  ->  power strip (5 sockets)  ->  fridge (cord from the back) + microwave
 *   the other 3 sockets are left OPEN.
 * Outlet and strip are independent, draggable objects. The cords are rebuilt live from wherever the
 * fridge, the microwave and the strip currently are, so they follow when you move things.
 */
const mat = (color, rough = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const M = {
  ivory: mat(0xe9e5d6, 0.55), cream: mat(0xe8e6dc, 0.45), dark: mat(0x161616, 0.5), slot: mat(0x050505, 0.9),
  black: mat(0x1b1b1b, 0.45), red: mat(0xd0281c, 0.4, { emissive: 0x801008, emissiveIntensity: 0.6 }), green: mat(0x2bd24a, 0.4, { emissive: 0x18a030, emissiveIntensity: 0.9 }),
};
const box = (p, w, h, d, m, name, x, y, z) => { const b = new THREE.Mesh(rBox(w, h, d), m); b.name = name; b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; p.add(b); return b; };

const SOCKET_X = [-0.1, -0.05, 0, 0.05, 0.1];   // 5 sockets along the strip
const USED = { fridge: 3, microwave: 4 };        // socket index each appliance uses (nearest the wall first)
const STRIP_L = 0.33, STRIP_H = 0.03;

function receptacle(p, y, name) {
  const face = box(p, 0.036, 0.042, 0.002, mat(0xdad6c6, 0.6), name, 0, y, 0.0085);
  for (const s of [-1, 1]) box(face, 0.0035, 0.012, 0.002, M.slot, 'slot', s * 0.008, 0.007, 0.0012);
  box(face, 0.005, 0.005, 0.002, M.slot, 'ground-hole', 0, -0.011, 0.0012);
  return face;
}
export function buildOutlet() {
  const g = new THREE.Group(); g.name = 'wall-outlet'; g.userData.label = 'Wall outlet (between bookshelf and fridge)';
  g.userData.movable = true; g.userData.wallMount = 'any'; g.userData.wallGap = 0.004;
  box(g, 0.075, 0.12, 0.008, M.ivory, 'outlet-plate', 0, 0, 0.004);
  receptacle(g, 0.03, 'receptacle-upper'); receptacle(g, -0.03, 'receptacle-lower');
  for (const y of [0.052, -0.052]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 10), mat(0xbfb9a8, 0.5, { metalness: 0.5 })); s.rotation.x = Math.PI / 2; s.position.set(0, y, 0.0085); g.add(s); }
  // the strip's plug sits in the lower receptacle
  box(g, 0.04, 0.058, 0.03, M.dark, 'strip-plug', 0, -0.036, 0.024);
  g.rotation.y = -Math.PI / 2; g.position.set(K.width, 0.3, 1.49);
  return g;
}

export function buildStrip() {
  const g = new THREE.Group(); g.name = 'power-strip'; g.userData.label = 'Power strip (5 sockets: fridge, microwave, 3 open)';
  g.userData.movable = true;
  box(g, STRIP_L, STRIP_H, 0.058, M.cream, 'strip-body', 0, STRIP_H / 2, 0);
  const top = STRIP_H + 0.001;
  SOCKET_X.forEach((x, i) => {
    const used = Object.values(USED).includes(i);
    const s = box(g, 0.04, 0.002, 0.044, used ? M.dark : mat(0x2a2a2a, 0.7), used ? `socket-${i + 1}-in-use` : `socket-${i + 1}-open`, x, top, 0);
    s.userData.label = used ? `Socket ${i + 1} (in use)` : `Socket ${i + 1} (OPEN)`;
    if (!used) {
      for (const sx of [-1, 1]) box(g, 0.004, 0.0016, 0.013, M.slot, 'slot', x + sx * 0.0085, top + 0.0012, -0.004);
      box(g, 0.005, 0.0016, 0.005, M.slot, 'ground-hole', x, top + 0.0012, 0.012);
    } else {
      box(g, 0.036, 0.03, 0.026, M.black, 'plug-head', x, top + 0.016, 0);   // plug inserted
    }
  });
  box(g, 0.016, 0.007, 0.026, M.red, 'power-switch', -0.145, top + 0.002, 0);
  box(g, 0.006, 0.003, 0.006, M.green, 'power-led', -0.145, top + 0.0015, 0.021);
  const grommet = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10), M.cream); grommet.rotation.z = Math.PI / 2; grommet.position.set(STRIP_L / 2 + 0.002, 0.012, 0); g.add(grommet);
  g.position.set(2.82, 0, 1.49);
  return g;
}

const sockWorld = (strip, i) => { strip.updateWorldMatrix(true, false); return strip.localToWorld(new THREE.Vector3(SOCKET_X[i], STRIP_H + 0.032, 0)); };

/** Cords: rebuilt only when one of the things they connect has moved. */
export function buildCords() {
  const g = new THREE.Group(); g.name = 'power-cords'; g.userData.label = 'Power cords (follow the appliances)';
  const cordMat = { strip: mat(0xdcd8c8, 0.6), fridge: mat(0xe9e9e4, 0.6), microwave: mat(0x161616, 0.5) };
  const meshes = {};
  let lastKey = '';
  const rootOf = () => { let r = g; while (r.parent) r = r.parent; return r; };
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return !!o; };
  const tube = (name, pts, m) => {
    const clamp = pts.map((p) => new THREE.Vector3(p.x, Math.max(0.006, p.y), p.z));
    const curve = new THREE.CatmullRomCurve3(clamp, false, 'catmullrom', 0.4);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.0042, 6, false), m);
    mesh.name = name; mesh.castShadow = true;
    if (meshes[name]) { g.remove(meshes[name]); meshes[name].geometry.dispose(); }
    meshes[name] = mesh; g.add(mesh);
  };
  const wallX = K.width - 0.016;

  g.userData.update = () => {
    const root = rootOf();
    const outlet = root.getObjectByName('wall-outlet'), strip = root.getObjectByName('power-strip');
    const fridge = root.getObjectByName('fridge'), shelf = root.getObjectByName('bookshelf');
    const mw = shelf?.getObjectByName('microwave');
    if (!outlet || !strip) return;
    const parts = [outlet, strip, fridge, shelf].filter(Boolean);
    parts.forEach((o) => o.updateWorldMatrix(true, false));
    const key = parts.map((o) => o.matrixWorld.elements.map((v) => v.toFixed(3)).join(',') + o.visible).join('|');
    if (key === lastKey) return;
    lastKey = key;

    const sOn = shown(strip);
    // wall outlet -> strip
    if (shown(outlet) && sOn) {
      const A = outlet.localToWorld(new THREE.Vector3(0, -0.068, 0.026));
      const B = strip.localToWorld(new THREE.Vector3(STRIP_L / 2 + 0.006, 0.012, 0));
      tube('cord-outlet-to-strip', [A, A.clone().add(new THREE.Vector3(-0.004, -0.05, 0)), new THREE.Vector3((A.x + B.x) / 2, 0.02, (A.z + B.z) / 2), B], cordMat.strip);
    } else if (meshes['cord-outlet-to-strip']) { g.remove(meshes['cord-outlet-to-strip']); delete meshes['cord-outlet-to-strip']; }

    // fridge back -> socket 4
    if (fridge && shown(fridge) && sOn) {
      const A = fridge.localToWorld(new THREE.Vector3(-0.27, 0.22, 0.004));   // exit near the north edge of the fridge back
      const B = sockWorld(strip, USED.fridge);
      tube('cord-fridge', [A, new THREE.Vector3(wallX, A.y - 0.1, A.z + (B.z - A.z) * 0.3), new THREE.Vector3(wallX - 0.01, 0.025, B.z + (A.z - B.z) * 0.1), new THREE.Vector3(B.x, B.y + 0.04, B.z), B], cordMat.fridge);
    } else if (meshes['cord-fridge']) { g.remove(meshes['cord-fridge']); delete meshes['cord-fridge']; }

    // microwave back -> socket 5 (runs down behind the bookshelf, out through the gap)
    if (mw && shown(mw) && sOn) {
      const A = mw.localToWorld(new THREE.Vector3(0.14, 0.05, -0.165));
      const B = sockWorld(strip, USED.microwave);
      tube('cord-microwave', [A, new THREE.Vector3(wallX, A.y - 0.03, A.z), new THREE.Vector3(wallX, 0.3, A.z + (B.z - A.z) * 0.5), new THREE.Vector3(wallX - 0.004, 0.06, B.z - 0.012), new THREE.Vector3(B.x, B.y + 0.04, B.z), B], cordMat.microwave);
    } else if (meshes['cord-microwave']) { g.remove(meshes['cord-microwave']); delete meshes['cord-microwave']; }
  };
  return g;
}

/** Put the outlet + strip in the middle of the gap between the bookshelf and the fridge (unless the layout already saved them). */
export function autoPlacePower(root, saved = {}) {
  const outlet = root.getObjectByName('wall-outlet'), strip = root.getObjectByName('power-strip');
  const fridge = root.getObjectByName('fridge'), shelf = root.getObjectByName('bookshelf');
  if (!outlet || !strip || !fridge || !shelf) return;
  const zr = (o) => { const b = new THREE.Box3(); o.updateWorldMatrix(true, true); o.traverse((m) => { if (m.isMesh && m.userData.collider) b.union(new THREE.Box3().setFromObject(m)); }); return b; };
  const sb = zr(shelf), fb = zr(fridge);
  const north = sb.max.z <= fb.min.z + 0.2 ? sb : fb, south = north === sb ? fb : sb;
  const gz = (north.max.z + south.min.z) / 2;
  if (!saved['wall-outlet']) outlet.position.z = gz;
  if (!saved['power-strip']) strip.position.z = gz;
}

export function buildPower() { return [buildOutlet(), buildStrip(), buildCords()]; }

/**
 * A plain wall plate you can drag onto any wall (Layout mode, wallMount 'any'):
 *   kind 'duplex' = two 3-pin receptacles; kind 'usb' = one receptacle + two USB-A + one USB-C charging ports with a small LED.
 * Origin = back of the plate at the wall, +z points into the room.
 */
export function buildSocketPlate({ id, label, kind = 'duplex' }) {
  const g = new THREE.Group(); g.name = id; g.userData.label = label;
  g.userData.movable = true; g.userData.wallMount = 'any'; g.userData.wallGap = 0.006;
  box(g, 0.08, 0.125, 0.008, M.ivory, 'outlet-plate', 0, 0, 0.004);
  const screw = (y) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 14), mat(0xbfb9a8, 0.5, { metalness: 0.5 })); s.rotation.x = Math.PI / 2; s.position.set(0, y, 0.0085); g.add(s); };
  screw(0.054); screw(-0.054);
  if (kind === 'duplex') { receptacle(g, 0.026, 'receptacle-upper'); receptacle(g, -0.026, 'receptacle-lower'); return g; }
  receptacle(g, 0.03, 'receptacle');
  const port = (x, y, w, h, name, inner) => { box(g, w + 0.004, h + 0.004, 0.002, mat(0xbdbab0, 0.4, { metalness: 0.6 }), name + '-rim', x, y, 0.0085); box(g, w, h, 0.002, M.slot, name, x, y, 0.0098); if (inner) box(g, w * 0.8, h * 0.22, 0.002, mat(0x2f6fd0, 0.5), name + '-tongue', x, y, 0.0108); };
  port(-0.017, -0.012, 0.014, 0.0065, 'usb-a-1', true); port(0.017, -0.012, 0.014, 0.0065, 'usb-a-2', true);
  port(0, -0.034, 0.009, 0.0032, 'usb-c', false);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), M.green); led.position.set(0.028, -0.034, 0.0098); led.name = 'charge-led'; g.add(led);
  return g;
}
