import * as THREE from 'three';

/**
 * Soft bathroom rugs. White by default. Each rug is its own movable / resizable object (Layout mode), and in first person:
 *   look at a rug:  E remove it · C change colour · T change texture
 *   anywhere in the bathroom:  R  brings back removed rugs (or removes them all when none are missing)
 */
import { RUG_COLORS, RUG_TEXTURES, RUG_DESIGNS, rugTexture } from './rugkit.js';

function rugGeometry(w, d, h, notch) {
  const r = Math.min(0.1, w / 4, d / 4), s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  if (notch) {   // cut-out for the shower stall in the north-east corner (shape +y ends up as north)
    s.lineTo(w / 2, d / 2 - notch.d); s.lineTo(w / 2 - notch.w, d / 2 - notch.d); s.lineTo(w / 2 - notch.w, d / 2); s.lineTo(-w / 2 + r, d / 2);
  } else { s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2); }
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const bevel = Math.min(0.012, h * 0.45), geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, h - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);   // shape y -> -z, extrusion -> up
  return geo;
}

const all = [];
export function buildBathRug({ id, label, x, z, w, d, rot = 0, notch = null, tile = [2, 2] }) {
  const g = new THREE.Group(); g.name = id; g.userData.label = label; g.userData.movable = true;
  let ci = 0, ti = 0, gi = 0;
  const mat = new THREE.MeshStandardMaterial({ map: rugTexture(RUG_COLORS[0][1], 0, 0), roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(rugGeometry(w, d, RUG_TEXTURES[0].h, notch), mat); mesh.name = 'rug-body'; mesh.receiveShadow = true; mesh.position.y = 0.002; g.add(mesh);
  const look = () => {
    mat.map = rugTexture(RUG_COLORS[ci][1], ti, gi).clone(); mat.map.repeat.set(tile[0], tile[1]); mat.map.needsUpdate = true; mat.needsUpdate = true;
    mesh.geometry.dispose(); mesh.geometry = rugGeometry(w, d, RUG_TEXTURES[ti].h, notch);
    g.userData.label = `${label.replace(/ \(.*/, '')} (${RUG_COLORS[ci][0].toLowerCase()}, ${RUG_TEXTURES[ti].name.toLowerCase()}, ${RUG_DESIGNS[gi].toLowerCase()})`;
  };
  g.userData.interact = {
    prompt: () => `<kbd>E</kbd> remove rug &nbsp; <kbd>C</kbd> colour <span style="opacity:.7">(${RUG_COLORS[ci][0]})</span> &nbsp; <kbd>T</kbd> texture <span style="opacity:.7">(${RUG_TEXTURES[ti].name})</span> &nbsp; <kbd>G</kbd> design <span style="opacity:.7">(${RUG_DESIGNS[gi]})</span>`,
    run: () => { g.visible = false; },
    keys: { KeyC: () => { ci = (ci + 1) % RUG_COLORS.length; look(); }, KeyT: () => { ti = (ti + 1) % RUG_TEXTURES.length; look(); }, KeyG: () => { gi = (gi + 1) % RUG_DESIGNS.length; look(); } },
  };
  g.userData.persist = { get: () => [ci, ti, g.visible, gi], set: (v) => { ci = v[0]; ti = v[1]; g.visible = !!v[2]; gi = v[3] ?? 0; look(); } };
  g.position.set(x, 0, z); g.rotation.y = THREE.MathUtils.degToRad(rot);
  look(); all.push(g);
  return g;
}

/** ONE soft rug for the whole bathroom floor, with a cut-out where the shower stall stands. */
export function buildBathRugs(B) {
  const { x0, x1, z0, z1 } = B, m = 0.045;
  const rugs = [
    buildBathRug({ id: 'bath-rug', label: 'Bathroom rug (whole floor)', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0 - 2 * m, d: z1 - z0 - 2 * m, notch: { w: B.stall.w + m, d: B.stall.d + m } }),
  ];
  // R: bring removed rugs back, or take them all away when none are missing
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.repeat) return;
    const fp = window.__fp; if (!fp || fp.layout.state.on || fp.fb.state.edit || fp.player.x > x1 + 0.05 || fp.player.z < z0 - 0.2) return;
    const missing = rugs.filter((r) => !r.visible);
    for (const r of rugs) r.visible = missing.length ? true : false;
  });
  return rugs;
}
