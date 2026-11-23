import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { KITCHEN as K } from '../config.js';
import { fixtureMats } from './mats.js';
import { RUG_COLORS, RUG_TEXTURES, RUG_DESIGNS, rugTexture } from './rugkit.js';

/** Albedo for a used, off-white / light-grey shag rug: fibre variation, brown spots, a reddish stain, specks. */
function rugAlbedo() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#bab6ac'; x.fillRect(0, 0, 1024, 1024);
  // fibre mottling
  for (let i = 0; i < 26000; i++) {
    const v = 150 + Math.random() * 70;
    x.fillStyle = `rgba(${v},${v - 3},${v - 10},0.35)`;
    x.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const blot = (cx, cy, r, rgb, a) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  };
  for (let i = 0; i < 14; i++) blot(Math.random() * 1024, Math.random() * 1024, 18 + Math.random() * 46, '96,74,52', 0.28);   // brownish
  for (let i = 0; i < 40; i++) blot(Math.random() * 1024, Math.random() * 1024, 4 + Math.random() * 9, '40,34,30', 0.55);      // dark specks / debris
  blot(900, 905, 58, '150,60,52', 0.5);                                                                                          // reddish stain, bottom-left as seen from the room
  blot(215, 610, 70, '120,96,70', 0.16);                                                                                         // general soiling
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Light grey shag rug on the kitchen floor, in front of the counter. */
export function buildRug() {
  const R = K.rug;
  const h = 0.04;
  const mat = fixtureMats().rug.clone();
  mat.color.set(0xffffff);
  mat.map = rugAlbedo();
  mat.bumpMap = mat.bumpMap.clone();
  mat.bumpMap.repeat.set(R.w / 0.25, R.l / 0.25);
  mat.bumpMap.needsUpdate = true;
  const m = new THREE.Mesh(new RoundedBoxGeometry(R.w, h, R.l, 3, 0.018), mat);
  m.position.set(R.x, h / 2, R.z);
  m.rotation.y = R.rot;
  m.name = 'rug'; m.userData.movable = true; m.userData.label = R.label;
  m.receiveShadow = true; m.castShadow = true;

  // look-book: C colour · T texture · G design. Everything at 0 = the original worn grey shag.
  const orig = { map: mat.map, bump: mat.bumpMap };
  let ci = 0, ti = 0, gi = 0;
  const look = () => {
    const original = !ci && !ti && !gi;
    const color = ci ? RUG_COLORS[ci - 1][1] : '#bab6ac', tex = ti ? ti - 1 : 0, hh = original ? h : RUG_TEXTURES[tex].h + 0.01;
    mat.map = original ? orig.map : rugTexture(color, tex, gi).clone(); if (!original) { mat.map.repeat.set(R.w / 0.9, R.l / 0.9); mat.map.needsUpdate = true; }
    mat.bumpMap = original || tex === 0 || tex === 5 ? orig.bump : null; mat.needsUpdate = true;
    m.geometry.dispose(); m.geometry = new RoundedBoxGeometry(R.w, hh, R.l, 3, Math.min(0.018, hh / 2.2)); m.position.y = hh / 2;
    m.userData.label = `${R.label.replace(/ \(.*/, '')} (${ci ? RUG_COLORS[ci - 1][0].toLowerCase() : 'original grey'}, ${ti ? RUG_TEXTURES[tex].name.toLowerCase() : 'shag'}, ${RUG_DESIGNS[gi].toLowerCase()})`;
  };
  m.userData.interact = {
    prompt: () => `<kbd>C</kbd> colour <span style="opacity:.7">(${ci ? RUG_COLORS[ci - 1][0] : 'Original'})</span> &nbsp; <kbd>T</kbd> texture <span style="opacity:.7">(${ti ? RUG_TEXTURES[ti - 1].name : 'Original shag'})</span> &nbsp; <kbd>G</kbd> design <span style="opacity:.7">(${RUG_DESIGNS[gi]})</span>`,
    run: () => {},
    keys: { KeyC: () => { ci = (ci + 1) % (RUG_COLORS.length + 1); look(); }, KeyT: () => { ti = (ti + 1) % (RUG_TEXTURES.length + 1); look(); }, KeyG: () => { gi = (gi + 1) % RUG_DESIGNS.length; look(); } },
  };
  m.userData.persist = { get: () => [ci, ti, gi], set: (v) => { [ci, ti, gi] = v; look(); } };
  return m;
}
