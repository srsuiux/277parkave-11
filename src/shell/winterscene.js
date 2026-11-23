import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { env } from '../daycycle.js';

/**
 * The view out of the bedroom window on a winter evening: a snowy pavement, a road with moving cars (headlights, tail lights,
 * wet light streaks), street lamps with halos, a snow-covered park (pines, bare trees, bench, snowman, fence) and lit apartment
 * blocks in the haze, under a heavy dusk sky. Snow falls in three depth layers (big soft flakes right at the glass, mid, far)
 * with gusting wind.
 *
 * Local space = the window group: x runs along the window, y up from the sill, -z is OUTSIDE. Ground is GY below the sill.
 * Everything is unlit (basic) or self-lit so it looks the same whether the room lights are on or off.
 */
const GY = -3.0;           // ground level relative to the sill
const ROAD_Z = -9.5;       // road centre line
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + rnd() * (b - a);

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } t.anisotropy = 4; return t; };
const radial = (stops, size = 128) => { const [c, g] = canvas(size, size); const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c); };
const glowMat = (map, color = 0xffffff, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

function skyTexture() {
  const [c, g] = canvas(1024, 512);
  const s = g.createLinearGradient(0, 0, 0, 512); s.addColorStop(0, '#1f2736'); s.addColorStop(0.45, '#3d4a60'); s.addColorStop(0.75, '#7b7f8c'); s.addColorStop(0.9, '#b49a8c'); s.addColorStop(1, '#c9ab94');   // dusk: slate cloud with city glow low down
  g.fillStyle = s; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) { const x = rnd() * 1024, y = rnd() * 330, r = 60 + rnd() * 140, a = 0.05 + rnd() * 0.09; const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, `rgba(150,160,180,${a})`); cg.addColorStop(1, 'rgba(150,160,180,0)'); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return tex(c);
}
function skylineTexture(density, tone, lit) {
  const W = 2048, H = 256, [c, g] = canvas(W, H);
  let x = 0; while (x < W) {
    const bw = 40 + rnd() * 110, bh = 60 + rnd() * (density ? 150 : 100); g.fillStyle = tone; g.fillRect(x, H - bh, bw, bh);
    if (rnd() < 0.3) g.fillRect(x + bw * 0.3, H - bh - 14, bw * 0.4, 14);
    for (let wy = H - bh + 10; wy < H - 8; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (rnd() < lit) { g.fillStyle = rnd() < 0.8 ? 'rgba(255,214,140,.95)' : 'rgba(190,225,255,.9)'; g.fillRect(wx, wy, 6, 8); }
    g.fillStyle = tone; x += bw + rnd() * 10;
  }
  return tex(c);
}
function snowTexture() {
  const [c, g] = canvas(512, 512); g.fillStyle = '#dde5ef'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 50; const b = rnd() < 0.5; const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, b ? 'rgba(186,200,222,.35)' : 'rgba(255,255,255,.45)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`; g.fillRect(rnd() * 512, rnd() * 512, 1.5, 1.5); }
  return tex(c, [28, 14]);
}
function roadTexture() {
  const W = 1024, H = 256, [c, g] = canvas(W, H); g.fillStyle = '#2b2d33'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${90 + rnd() * 50},${90 + rnd() * 40},${96 + rnd() * 40},${0.05 + rnd() * 0.12})`; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 10, 1 + rnd() * 3); }
  for (const v of [0.27, 0.73]) { const y = v * H; const gr = g.createLinearGradient(0, y - 22, 0, y + 22); gr.addColorStop(0, 'rgba(120,112,100,0)'); gr.addColorStop(0.5, 'rgba(120,112,100,.38)'); gr.addColorStop(1, 'rgba(120,112,100,0)'); g.fillStyle = gr; g.fillRect(0, y - 22, W, 44); }   // slushy wheel tracks
  g.fillStyle = 'rgba(210,175,60,.9)'; for (let x = 0; x < W; x += 128) g.fillRect(x + 8, H / 2 - 2, 70, 4);                                                          // centre dashes
  for (const [y0, y1, a] of [[0, 26, 0], [H - 26, H, 1]]) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(a ? 0 : 1, 'rgba(236,240,246,0)'); gr.addColorStop(a ? 1 : 0, 'rgba(236,240,246,.95)'); g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0); }   // snow banked at the kerbs
  return tex(c, [20, 1]);
}
function dropletTexture() {
  const [c, g] = canvas(512, 512);
  for (let i = 0; i < 90; i++) { const x = rnd() * 512, y = rnd() * 512, r = 1.5 + rnd() * 3.2; const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(170,195,225,.22)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 1.25, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
}
const flakeTexture = (() => { let t; return () => (t ??= radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']], 64)); })();

const std = (color, rough = 0.5, metal = 0, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

export function buildWinter(WL, h, t) {
  const group = new THREE.Group(); group.name = 'winter-view'; group.userData.label = 'Winter view (street, cars, park, snowfall)';
  const tints = [], glows = [];   // materials re-tinted when the room lights go off
  const add = (m, parent = group) => { parent.add(m); return m; };

  // ---- sky + distant blocks ----
  // the sky follows the time of day (gradient from env), with clouds, stars, the sun and the moon travelling their real arcs
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, fog: false, depthWrite: false,
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float vY; void main(){ float t = smoothstep(-6.0, 48.0, vY + 18.0); gl_FragColor = vec4(mix(hor, top, pow(t, 0.7)), 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }' });
  const sky = add(new THREE.Mesh(new THREE.PlaneGeometry(260, 110), skyMat)); sky.position.set(0, 18, -120);
  const cloudTex = (() => { const [c, g] = canvas(1024, 256); for (let i = 0; i < 120; i++) { const x = rnd() * 1024, y = 40 + rnd() * 170, r = 40 + rnd() * 90, cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, `rgba(255,255,255,${0.16 + rnd() * 0.2})`); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; })();
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, color: 0xffffff, opacity: 0.8 });
  const clouds = add(new THREE.Mesh(new THREE.PlaneGeometry(260, 52), cloudMat)); clouds.position.set(0, 22, -118);
  const starPos = new Float32Array(900); for (let i = 0; i < 300; i++) { starPos[i * 3] = rr(-120, 120); starPos[i * 3 + 1] = rr(6, 62); starPos[i * 3 + 2] = -116; }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = add(new THREE.Points(starGeo, starMat)); stars.frustumCulled = false;
  const discTex = radial([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,1)'], [0.62, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']], 128), bigGlow = radial([[0, 'rgba(255,255,255,.9)'], [0.2, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], 128);
  const mkBody = (size, glowSize) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, fog: false })); const gl = new THREE.Mesh(new THREE.PlaneGeometry(glowSize, glowSize), glowMat(bigGlow)); add(d); add(gl); return { d, gl }; };
  const sunB = mkBody(9, 90), moonB = mkBody(6.5, 36);
  const far = add(new THREE.Mesh(new THREE.PlaneGeometry(240, 30), basic(0xffffff, { map: skylineTexture(true, '#4a5468', 0.2), transparent: true, depthWrite: false }))); far.position.set(0, GY + 15, -95); tints.push([far.material, 0xcdd6e6, 0x5a6078]);
  const mid = add(new THREE.Mesh(new THREE.PlaneGeometry(170, 26), basic(0xffffff, { map: skylineTexture(false, '#39435a', 0.32), transparent: true, depthWrite: false }))); mid.position.set(6, GY + 13, -62); tints.push([mid.material, 0xd9e0ec, 0x4a5068]);

  // ---- ground: pavement + road + park, all snow ----
  const snowM = basic(0xffffff, { map: snowTexture() }); tints.push([snowM, 0xffffff, 0x8a97bd]);
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(300, 140), snowM)); ground.rotation.x = -Math.PI / 2; ground.position.set(0, GY, -70);
  const roadM = basic(0xffffff, { map: roadTexture() });
  const road = add(new THREE.Mesh(new THREE.PlaneGeometry(300, 5.6), roadM)); road.rotation.x = -Math.PI / 2; road.position.set(0, GY + 0.03, ROAD_Z);
  const berm = std(0xeef3fa, 0.9);
  for (const z of [ROAD_Z + 3.0, ROAD_Z - 3.0]) { const b = add(new THREE.Mesh(new RoundedBoxGeometry(300, 0.34, 0.9, 2, 0.12), berm)); b.position.set(0, GY + 0.1, z); b.material = basic(0xe9eef6); }
  // footprints / trampled path on the pavement
  const [pc, pg] = canvas(512, 64); pg.fillStyle = 'rgba(150,160,178,.0)'; pg.fillRect(0, 0, 512, 64); for (let i = 0; i < 90; i++) { pg.fillStyle = 'rgba(150,160,180,.35)'; pg.beginPath(); pg.ellipse(rnd() * 512, 14 + (i % 2) * 34 + rnd() * 6, 6, 10, 0.2, 0, 7); pg.fill(); }
  const path = add(new THREE.Mesh(new THREE.PlaneGeometry(120, 2.2), basic(0xffffff, { map: tex(pc, [3, 1]), transparent: true, depthWrite: false }))); path.rotation.x = -Math.PI / 2; path.position.set(0, GY + 0.015, -5.0);

  // ---- street lamps (park side of the road) ----
  const halo = radial([[0, 'rgba(255,214,150,1)'], [0.25, 'rgba(255,190,110,.55)'], [1, 'rgba(255,170,80,0)']], 128);
  const pool = radial([[0, 'rgba(255,205,140,.8)'], [0.5, 'rgba(255,190,120,.3)'], [1, 'rgba(255,180,100,0)']], 128);
  const poleM = std(0x23262b, 0.6, 0.5), headM = basic(0xffe2b0);
  for (const lx of [-26, -9, 8, 25]) {
    const lamp = add(new THREE.Group()); lamp.position.set(lx, GY, -13.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 12), poleM); pole.position.y = 2.3; lamp.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.3), poleM); arm.position.set(0, 4.55, 0.6); lamp.add(arm);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.1, 0.62, 2, 0.04), poleM); head.position.set(0, 4.52, 1.2); lamp.add(head);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.5), headM); bulb.position.set(0, 4.46, 1.2); lamp.add(bulb);
    const hm = glowMat(halo, 0xffffff, 0.95); glows.push([hm, 0.95]); const hs = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), hm); hs.position.set(0, 4.46, 1.3); lamp.add(hs);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4.4, 24, 1, true), glowMat(null, 0xffc880, 0.07)); cone.position.set(0, 2.3, 1.2); lamp.add(cone);
    const pm = glowMat(pool, 0xffffff, 0.9); glows.push([pm, 0.9]); const p = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), pm); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.04, 1.2); lamp.add(p);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 9), glowMat(pool, 0xffd9a0, 0.28)); wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.06 - (GY - GY), 1.2 + 4.8); wet.position.y = 0.05; lamp.add(wet);   // light streaking across the wet road
  }

  // ---- park: fence, pines, bare trees, bench, snowman, drifts ----
  const postM = std(0x2d3036, 0.6, 0.4), capM = basic(0xf4f8fc);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), postM, 60), caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), capM, 60), mtx = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { const x = -36 + i * 1.2; mtx.makeTranslation(x, GY + 0.5, -12.6); posts.setMatrixAt(i, mtx); mtx.makeTranslation(x, GY + 1.03, -12.6); mtx.scale(new THREE.Vector3(1, 0.6, 1)); caps.setMatrixAt(i, mtx); }
  add(posts); add(caps);
  const rail = add(new THREE.Mesh(new THREE.BoxGeometry(72, 0.04, 0.05), postM)); rail.position.set(0, GY + 0.85, -12.6);
  const railSnow = add(new THREE.Mesh(new THREE.BoxGeometry(72, 0.03, 0.08), capM)); railSnow.position.set(0, GY + 0.885, -12.6);

  const pineGreen = std(0x1f3b31, 0.9, 0, 0x0c1a15, 0.6), pineSnow = basic(0xe6edf6);
  const pine = (x, z, s) => { const g = add(new THREE.Group()); g.position.set(x, GY, z); g.scale.setScalar(s);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8), std(0x3a2a20)); trunk.position.y = 0.5; g.add(trunk);
    [[1.25, 1.7, 0.7], [1.0, 1.5, 1.7], [0.72, 1.3, 2.6]].forEach(([r, hh, y]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 14), pineGreen); c.position.y = y + hh / 2; g.add(c); const sn = new THREE.Mesh(new THREE.ConeGeometry(r * 1.035, hh * 0.86, 14), pineSnow); sn.position.y = y + hh * 0.14 + hh * 0.43; g.add(sn); });
    return g; };
  for (let i = 0; i < 26; i++) pine(rr(-34, 34), rr(-18, -50), rr(0.9, 1.9));
  const bare = (x, z, s) => { const g = add(new THREE.Group()); g.position.set(x, GY, z); g.scale.setScalar(s); const m = std(0x35353b, 0.9);
    const br = (px, py, dir, len, rad, d) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad, len, 6), m); const e = dir.clone().multiplyScalar(len); c.position.set(px + e.x / 2, py + e.y / 2, e.z / 2); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(c); if (d < 4) for (let k = 0; k < 2; k++) br(px + e.x, py + e.y, dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), (k ? 1 : -1) * rr(0.4, 0.7)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rr(0, 6)).normalize(), len * 0.72, rad * 0.65, d + 1); };
    br(0, 0, new THREE.Vector3(0, 1, 0), 2.6, 0.16, 0); return g; };
  for (let i = 0; i < 7; i++) bare(rr(-30, 30), rr(-16, -30), rr(0.9, 1.5));
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), basic(0xe7edf6)); m.scale.set(rr(1.2, 5), rr(0.18, 0.5), rr(0.9, 3)); m.position.set(rr(-40, 40), GY, rr(-15, -55)); add(m); }   // drifts

  const bench = add(new THREE.Group()); bench.position.set(-4.5, GY, -17);
  { const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.5), std(0x5a4130)); seat.position.y = 0.46; bench.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 0.06), std(0x5a4130)); back.position.set(0, 0.75, -0.22); back.rotation.x = -0.15; bench.add(back);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.46), postM); l.position.set(s * 0.75, 0.23, 0); bench.add(l); }
    const sn = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.12, 0.52, 2, 0.05), capM); sn.position.y = 0.53; bench.add(sn); const sb = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.06, 0.1, 2, 0.02), capM); sb.position.set(0, 0.96, -0.25); bench.add(sb); }
  const man = add(new THREE.Group()); man.position.set(5.5, GY, -16);
  { const w = basic(0xf6f9fc); [[0.55, 0.5], [0.4, 1.3], [0.28, 1.88]].forEach(([r, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), w); s.position.y = y; man.add(s); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 8), basic(0xe8761c)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.9, 0.3); man.add(nose);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), basic(0x111111)); e.position.set(s * 0.09, 1.96, 0.25); man.add(e); }
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 14), basic(0x23252b)); hat.position.y = 2.28; man.add(hat); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), basic(0x23252b)); brim.position.y = 2.14; man.add(brim); }

  // ---- cars ----
  const beamTex = (() => { const [c, g] = canvas(256, 64); const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,245,215,.95)'); gr.addColorStop(0.35, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); const m = g.createLinearGradient(0, 0, 0, 64); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, 256, 64); return new THREE.CanvasTexture(c); })();
  const glass = std(0x10161f, 0.15, 0.6), tire = std(0x151515, 0.9), headL = basic(0xfff4d6), tailL = basic(0xff2a1a), snowCap = basic(0xf1f5fa);
  const glowDot = radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], 64);
  function car(colorHex, kind = 'sedan', parked = false) {
    const g = new THREE.Group(), L = kind === 'van' ? 5.2 : 4.5, Hh = kind === 'van' ? 1.9 : 1.45, body = std(colorHex, 0.35, 0.45, colorHex, 0.22);
    const b = new THREE.Mesh(new RoundedBoxGeometry(L, 0.78, 1.82, 3, 0.2), body); b.position.y = 0.62; g.add(b);
    const cabL = kind === 'van' ? L - 0.5 : 2.4, cab = new THREE.Mesh(new RoundedBoxGeometry(cabL, Hh - 1.0, 1.62, 3, 0.22), body); cab.position.set(kind === 'van' ? 0 : -0.25, 1.0 + (Hh - 1.0) / 2 - 0.0, 0); g.add(cab);
    const win = new THREE.Mesh(new RoundedBoxGeometry(cabL * 0.92, (Hh - 1.0) * 0.6, 1.66, 2, 0.1), glass); win.position.set(cab.position.x, cab.position.y + 0.02, 0); g.add(win);
    const roof = new THREE.Mesh(new RoundedBoxGeometry(cabL * 0.95, parked ? 0.22 : 0.07, 1.5, 2, 0.03), snowCap); roof.position.set(cab.position.x, 1.0 + (Hh - 1.0) + (parked ? 0.02 : 0.0), 0); g.add(roof);
    const hood = new THREE.Mesh(new RoundedBoxGeometry(1.0, parked ? 0.14 : 0.04, 1.5, 2, 0.02), snowCap); hood.position.set(L / 2 - 0.9, 1.02 + (parked ? 0.04 : 0), 0); g.add(hood);
    for (const [x, z] of [[1.4, 0.9], [1.4, -0.9], [-1.4, 0.9], [-1.4, -0.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18), tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w); }
    for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.4), parked ? std(0x888a90) : headL); hl.position.set(L / 2, 0.68, s * 0.62); g.add(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.42), parked ? std(0x501010) : tailL); tl.position.set(-L / 2, 0.7, s * 0.66); g.add(tl); }
    if (!parked) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.4), glowMat(beamTex, 0xffffff, 0.6)); beam.rotation.x = -Math.PI / 2; beam.position.set(L / 2 + 5, 0.07, 0); g.add(beam); glows.push([beam.material, 0.6]);
      const wet = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.8), glowMat(beamTex, 0xffe9c0, 0.3)); wet.rotation.x = -Math.PI / 2; wet.position.set(L / 2 + 3.2, 0.06, 0); g.add(wet);
      for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), glowMat(glowDot, 0xfff1cc, 0.9)); f.position.set(L / 2 + 0.05, 0.7, s * 0.62); f.rotation.y = Math.PI / 2; g.add(f); const r = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), glowMat(glowDot, 0xff3a22, 0.85)); r.position.set(-L / 2 - 0.05, 0.7, s * 0.66); r.rotation.y = Math.PI / 2; g.add(r); }
      const redWash = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), glowMat(glowDot, 0xff2a18, 0.5)); redWash.rotation.x = -Math.PI / 2; redWash.position.set(-L / 2 - 1.0, 0.06, 0); g.add(redWash);
    }
    return g;
  }
  const palette = [0x8b1e24, 0x1f3a63, 0x2a2d33, 0xc9ccd1, 0x2d5a45, 0xb8a98c, 0x6b6f78, 0xd9d4c8];
  for (const [x, z, c, a] of [[-12, -5.6, 0xc9ccd1, 0.0], [-3, -5.5, 0x1f3a63, Math.PI]]) { const pk = car(c, 'sedan', true); pk.position.set(x, GY + 0.03, z); pk.rotation.y = a; add(pk); }
  const traffic = [];
  const lanes = [{ z: ROAD_Z + 1.4, dir: 1 }, { z: ROAD_Z - 1.4, dir: -1 }];
  const spawn = (lane, x) => { const c = car(palette[Math.floor(rnd() * palette.length)], rnd() < 0.2 ? 'van' : 'sedan'); c.position.set(x, GY + 0.04, lane.z); c.rotation.y = lane.dir > 0 ? 0 : Math.PI; add(c); return { c, lane, v: rr(4.5, 8.5), gap: 0 }; };
  [[0, -20], [0, 4], [0, 26], [1, -8], [1, 14], [1, 34]].forEach(([li, x]) => traffic.push(spawn(lanes[li], x)));

  // ---- the glass-side details: snow on the sill, melting droplets on the pane ----
  const ledge = add(new THREE.Mesh(new RoundedBoxGeometry(WL + 0.3, 0.08, 0.34, 2, 0.03), basic(0xf4f7fa))); ledge.position.set(0, -0.015, -t - 0.17);
  const drops = add(new THREE.Mesh(new THREE.PlaneGeometry(WL, h), basic(0xffffff, { map: dropletTexture(), transparent: true, opacity: 0.55, depthWrite: false, fog: false }))); drops.position.set(0, h / 2, -t - 0.02); drops.renderOrder = 5;

  // ---- falling snow: three depth layers (soft bokeh flakes at the glass, mid flakes, a haze of far ones) ----
  const layers = [
    { n: 90, x: 7, z: [-0.35, -3.5], y: [GY, 5], size: 0.2, op: 0.4, fall: [0.35, 0.7], sway: 0.45 },
    { n: 650, x: 16, z: [-3.5, -16], y: [GY, 7], size: 0.1, op: 0.9, fall: [0.5, 1.0], sway: 0.35 },
    { n: 1800, x: 38, z: [-16, -55], y: [GY, 14], size: 0.26, op: 0.6, fall: [0.6, 1.1], sway: 0.25 },
  ].map((L) => {
    const pos = new Float32Array(L.n * 3), ph = new Float32Array(L.n * 3), vel = new Float32Array(L.n);
    for (let i = 0; i < L.n; i++) { pos[i * 3] = (rnd() * 2 - 1) * L.x; pos[i * 3 + 1] = rr(L.y[0], L.y[1]); pos[i * 3 + 2] = rr(L.z[0], L.z[1]); ph[i * 3] = rnd() * 6.28; ph[i * 3 + 1] = rr(0.4, 1.4); ph[i * 3 + 2] = rnd() * 6.28; vel[i] = rr(...L.fall); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: flakeTexture(), size: L.size, transparent: true, depthWrite: false, opacity: L.op, sizeAttenuation: true, color: 0xf4f8ff });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3; group.add(pts);
    return { ...L, pos, ph, vel, geo, mat, base: L.size };
  });

  let tt = 0, nt = 0, sceneRef = null; const c1 = new THREE.Color(), c2 = new THREE.Color(), inv = new THREE.Matrix4(), v = new THREE.Vector3(), WARM = new THREE.Color(0xffb98a), SUNLOW = new THREE.Color(0xff8a3c), SUNHI = new THREE.Color(0xfff4d8), GREY = new THREE.Color(0x8a8d95), LAMP = new THREE.Color(0xffe2b0), FLAKE_N = new THREE.Color(0xc9d8ff), WHITE = new THREE.Color(0xffffff);
  return {
    group,
    update(dt, dark = 0, curtain = 1) {
      dt = Math.min(dt, 0.1); tt += dt; nt = env.nightK;
      group.updateWorldMatrix(true, false); inv.copy(group.matrixWorld).invert();
      if (!sceneRef) { let r = group; while (r.parent) r = r.parent; sceneRef = r; if (r.isScene && !r.fog) r.fog = new THREE.Fog(0x8d97aa, 22, 120); }
      for (const [m, a, b] of tints) m.color.copy(c1.set(a)).lerp(c2.set(b), nt).lerp(WARM, env.warm * 0.3);
      for (const [m, base] of glows) m.opacity = base * (0.04 + 0.96 * env.lampK) * (1 + 0.3 * nt);
      headM.color.copy(GREY).lerp(LAMP, env.lampK);
      skyU.top.value.copy(env.skyTop); skyU.hor.value.copy(env.skyHor);
      cloudMat.color.copy(c1.set(0x2c3550)).lerp(c2.set(0xf2f5fa), env.dayK).lerp(WARM, env.warm * 0.55); cloudMat.opacity = 0.35 + 0.5 * env.dayK; cloudTex.offset.x += dt * 0.0015;
      starMat.opacity = Math.max(0, env.nightK - 0.25) * (0.75 + 0.25 * Math.sin(tt * 2.1));
      const place = (dir, body, visible) => { v.copy(dir).transformDirection(inv); const show = visible && v.z < -0.05; body.d.visible = body.gl.visible = show; if (show) { body.d.position.copy(v).multiplyScalar(100); body.gl.position.copy(v).multiplyScalar(99); } return show; };
      if (place(env.sunDir, sunB, env.sunElev > -2)) { const k = Math.min(1, Math.max(0, env.sunElev / 22)); sunB.d.material.color.copy(SUNLOW).lerp(SUNHI, k); sunB.gl.material.color.copy(SUNLOW).lerp(SUNHI, k); sunB.gl.material.opacity = 0.25 + 0.5 * env.warm; }
      if (place(env.moonDir, moonB, env.moonElev > -2 && env.nightK > 0.2)) { moonB.d.material.color.set(0xe6edff); moonB.gl.material.color.set(0x9fb4ff); moonB.gl.material.opacity = 0.5 * env.nightK; }
      if (sceneRef?.fog) sceneRef.fog.color.copy(env.skyHor);
      const gust = 0.5 + 0.5 * Math.sin(tt * 0.23) * Math.sin(tt * 0.071 + 1.3);   // slow gusts: calm -> windy -> calm
      const wind = 0.15 + 0.9 * gust;
      for (const L of layers) {
        const p = L.pos, ph = L.ph;
        for (let i = 0; i < L.n; i++) {
          const k = i * 3, y0 = L.y[0];
          p[k + 1] -= L.vel[i] * dt * (0.8 + 0.2 * Math.sin(tt * 1.1 + ph[k + 2]));
          p[k] += (Math.sin(tt * ph[k + 1] + ph[k]) * L.sway * 0.6 + wind) * dt;
          p[k + 2] += Math.cos(tt * 0.8 * ph[k + 1] + ph[k + 2]) * L.sway * 0.25 * dt;
          if (p[k + 1] < y0) { p[k + 1] = L.y[1]; p[k] = (Math.random() * 2 - 1) * L.x; }
          if (p[k] > L.x) p[k] -= 2 * L.x;
        }
        L.geo.attributes.position.needsUpdate = true;
        L.mat.opacity = L.op * (0.9 + 0.1 * nt); L.mat.size = L.base * (1 + 0.18 * nt); L.mat.color.copy(WHITE).lerp(FLAKE_N, nt * 0.7);
      }
      for (const v of traffic) { v.c.position.x += v.lane.dir * v.v * dt; if (Math.abs(v.c.position.x) > 42) { v.c.position.x = -v.lane.dir * 40; v.v = rr(4.5, 8.5); v.c.children.forEach((m) => { if (m.material?.color && m.material === v.c.userData.body) m.material.color.setHex(palette[Math.floor(Math.random() * palette.length)]); }); } }
    },
  };
}
