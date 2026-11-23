import * as THREE from 'three';
import './ui/glass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { KITCHEN as K, HALLWAY as Hc, PLAYER as P, BATHROOM as BATH, BEDROOM as BED } from './config.js';
import { setDarkness } from './glowmarks.js';
import { env as dayEnv, initSun, update as updateDay, clockText, phaseName } from './daycycle.js';
import { weather, startWeather, LOCATION } from './weather.js';
import { makeMaterials } from './materials.js';
import { buildKitchen } from './shell/kitchen.js';
import { buildHallway } from './shell/hallway.js';
import { buildRooms } from './shell/rooms.js';
import { buildBathroom } from './shell/bathroom.js';
import { buildBedroom, bedroomState, closetState } from './shell/bedroom.js';
import { bathState } from './shell/bathroom.js';
import { patchShaders, solveAmbient, roomAmbient, AMBIENT_REF } from './lighting.js';
import { paintUI, openPaint } from './paint.js';
import { makeWallsPaintable } from './wallpaint.js';
import { initFeedback } from './feedback.js';
import { initLayout } from './layout.js';
import { autoPlacePower } from './fixtures/power.js';
import { lightState } from './fixtures/lights.js';
import { initSession } from './session.js';
import { buildVisitor } from './visitor.js';
import { buildFirstPersonBody } from './fpbody.js';
import { initActivities } from './activity.js';
import { monitor, initMonitorUI } from './monitor.js';
import { initDevices } from './devices.js';
import { initCameras } from './cameras.js';
import { initDashboard } from './dashboard.js';
import { initPlacer } from './placer.js';
import { setFixtureEnv } from './fixtures/mats.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;   // per-light control: see updateLighting()
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
// soft studio reflections so brass / bronze / steel hardware reads as metal
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;
setFixtureEnv(scene.environment);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.04, 400);
scene.add(camera);

// ---------- world ----------
const mats = makeMaterials();
const kitchen = buildKitchen(mats);
const hallway = buildHallway(mats);
const rooms = buildRooms(mats);
const bathroom = buildBathroom(mats);
const bedroom = buildBedroom(mats);
scene.add(kitchen, hallway, rooms, bathroom, bedroom);
const wallPaints = makeWallsPaintable([kitchen, hallway, rooms, bathroom, bedroom], openPaint);   // every wall: look at it + X to paint

// ---------- lighting (placeholders; real fixtures become their own assets later) ----------
const sun = initSun(scene);   // sun by day, moon by night: a shadow-casting directional light that crosses the sky (see daycycle.js)
const hemi = new THREE.HemisphereLight(0xfff2de, 0x4a3a2a, 0.35);
scene.add(hemi);
// the room's ambient light follows the ceiling light (switch off = properly dark)
let kitchenLevel = 1, ambLevel = 1;
lightState.onLevel = (l) => { kitchenLevel = l; };   // (the bedroom has its own switch: see the frame loop)

// (the ceiling light is a real fixture now: see fixtures/lights.js)

const hallLight = new THREE.PointLight(0xffe0b0, 6, 0, 2);
hallLight.position.set(1.0, Hc.height - 0.2, -K.wallT - Hc.length * 0.4);
scene.add(hallLight);

// (no daylight: the kitchen has no window)

// ---------- ambient occlusion: darkens corners, wall/ceiling/floor joints and contact points ----------
const dpr = renderer.getPixelRatio();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.blendIntensity = 1;
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.5, scale: 1.6, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(gtao);
composer.addPass(new OutputPass());
window.__ao = { gtao, composer, enabled: true };

// ---------- doors ----------
scene.updateMatrixWorld(true);
const doors = [];
scene.traverse((o) => { if (o.userData.isDoor) doors.push(o); });
const doorBoxes = new Map();
for (const d of doors) {
  const { pivot, slab, angle } = d.userData;
  const keep = pivot.rotation.y;
  pivot.rotation.y = 0; scene.updateMatrixWorld(true);
  doorBoxes.set(d, new THREE.Box3().setFromObject(slab).expandByScalar(0.01));
  pivot.rotation.y = keep; scene.updateMatrixWorld(true);
  void angle;
}


// ---------- light physics: a room's lamps only light that room (no glow through walls); they spill into the next room only through an open door ----------
const ROOM_RECTS = {
  kitchen: [0, K.width, 0, K.depth], bath: [BATH.x0, BATH.x1, BATH.z0, BATH.z1], bedroom: [BED.x0, BED.x1, BED.z0, BED.z1],
  closet: [BED.x1 + BED.wallT, BED.x1 + BED.wallT + BED.closet.w, BED.z0 + BED.closet.dz0, BED.z0 + BED.closet.dz0 + BED.closet.d],
  hall: [K.doors[0].at - Hc.doorShift - Hc.width / 2, K.doors[0].at - Hc.doorShift + Hc.width / 2, -K.wallT - Hc.length, 0],
};
const roomOf = (x, z) => Object.keys(ROOM_RECTS).find((k) => { const r = ROOM_RECTS[k]; return x >= r[0] - 0.05 && x <= r[1] + 0.05 && z >= r[2] - 0.05 && z <= r[3] + 0.05; }) ?? null;
const LINKS = [['kitchen', 'bedroom', 'living-room-door'], ['kitchen', 'bath', 'bathroom-door'], ['bedroom', 'closet', 'closet-door'], ['kitchen', 'hall', 'north-door']];
patchShaders(ROOM_RECTS);   // per-room ambient light (see lighting.js); must run before the first material compiles

// ---------- lighting: one connected environment. Nothing below depends on where the player is. ----------
// Direct light: every lamp that can be seen from another room casts a real shadow map, so walls and closed doors block it and open doorways let it through.
const lampOwner = (o) => { for (let p = o.parent; p; p = p.parent) { if (p.name === 'wall-sconce' || p.name === 'wall-heater' || p.name === 'fridge') return null; } return roomOf(...(() => { const w = o.getWorldPosition(new THREE.Vector3()); return [w.x, w.z]; })()); };
const shadowLamps = [];
const DOORS_OF = { kitchen: ['north-door', 'living-room-door', 'bathroom-door'], bedroom: ['living-room-door', 'closet-door'], bath: ['bathroom-door'], closet: ['closet-door'], hall: ['north-door'] };
scene.updateMatrixWorld(true);
scene.traverse((o) => { if (o.isMesh && o.castShadow) { for (let p = o.parent; p; p = p.parent) if (p.userData.noShadow) { o.castShadow = false; break; } } });   // (spinning fan blades would need a shadow re-render every frame)
scene.traverse((o) => {
  if (!o.isPointLight) return;
  const room = lampOwner(o);
  if (o.parent === scene) { /* hallway lamp */ }
  if (!room) { o.distance = Math.max(o.distance, 0) || 2.6; return; }          // small fixtures (wall sconce): short range, no shadow map
  o.castShadow = true; o.shadow.autoUpdate = false; o.shadow.needsUpdate = true;
  o.shadow.mapSize.set(1024, 1024); o.shadow.bias = -0.0006; o.shadow.normalBias = 0.025; o.shadow.radius = 3; o.shadow.camera.near = 0.05;
  shadowLamps.push({ light: o, room, sig: NaN });
});
sun.shadow.autoUpdate = false;
renderer.shadowMap.autoUpdate = true;      // (each light decides for itself through shadow.needsUpdate)
let shadowDirtyAll = true, lightFrame = 0;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const doorOpen = (name) => { const d = doors.find((dd) => dd.name === name); return d ? sstep(2, 40, d.userData.angle) : 0; };
const LINK_DEFS = [['kitchen', 'bedroom', 'living-room-door'], ['kitchen', 'bath', 'bathroom-door'], ['bedroom', 'closet', 'closet-door'], ['kitchen', 'hall', 'north-door']];
function updateLighting() {
  lightFrame++;
  // ambient / indirect light per room, from the real state of lamps, windows and doors
  solveAmbient({
    dayAmb: dayEnv.dayAmb, skyColor: dayEnv.ambSky,
    lamp: { kitchen: lightState.level, bedroom: bedroomState.level, closet: closetState.level, bath: bathState.level * 0.9, hall: 0.45 },
    window: { bedroom: 0.04 + 0.96 * bedroomState.curtain, bath: 1, hall: 1 },
    links: LINK_DEFS.map(([a, b, d]) => [a, b, doorOpen(d)]),
  });
  hemi.intensity = AMBIENT_REF; hemi.color.set(0xfff2de); hemi.groundColor.set(0x4a3a2a); scene.environmentIntensity = AMBIENT_REF * 0.7;
  // shadow maps are only re-rendered when something that can change them has moved (cheap: the apartment is mostly static)
  if (lightFrame % 3 === 0) sun.shadow.needsUpdate = true;
  for (const s of shadowLamps) {
    let sig = Math.round(s.light.visible ? 1 : 0);
    for (const n of DOORS_OF[s.room] ?? []) { const d = doors.find((dd) => dd.name === n); if (d) sig += Math.round(d.userData.angle) * 7; }
    if (s.room === 'bedroom') sig += Math.round(bedroomState.curtain * 20) * 131;
    if (sig !== s.sig) { s.sig = sig; s.pending = true; }
    if (shadowDirtyAll || (s.pending && lightFrame % 3 === 0) || lightFrame % 180 === 0) { s.light.shadow.needsUpdate = true; s.pending = false; }
  }
  shadowDirtyAll = false;
}

// ---------- activities (sit / toilet / shower, third-person camera) ----------
// Start in the hallway, facing the entrance door, like photo IMG_1277.
const player = { x: K.doors[0].at + 0.05, z: -K.wallT - 3.3, bob: 0 };
const activities = initActivities({ scene, camera, player, getWalls: () => walls, nearestFree: (x, z) => nearestFree(x, z) });

// ---------- interactives (sink handles etc.) and per-frame updaters ----------
const interactives = [];
const updaters = [];
scene.traverse((o) => {
  if (o.userData.interact) interactives.push(o);
  if (typeof o.userData.update === 'function') updaters.push(o);
});

// ---------- colliders ----------
const walls = [], dynSolids = [], dynBoxes = [];   // dynSolids: colliders that only exist while active (e.g. an open cupboard door), re-boxed every frame
const hiddenAbove = (m) => { for (let p = m.parent; p; p = p.parent) if (!p.visible) return true; return false; };
function rebuildColliders() {
  walls.length = 0; dynSolids.length = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.isMesh && o.userData.collider === 'dyn') dynSolids.push(o);
    else if (o.isMesh && o.userData.collider && !hiddenAbove(o)) walls.push(new THREE.Box3().setFromObject(o));
  });
}
rebuildColliders();

const doorSegs = []; let ignoreOpenDoors = false; const _h = new THREE.Vector3(), _t = new THREE.Vector3();
function refreshDoorSegs() {
  dynBoxes.length = 0; for (const m of dynSolids) if (m.userData.active?.() && !hiddenAbove(m)) { m.updateWorldMatrix(true, false); dynBoxes.push(new THREE.Box3().setFromObject(m)); }
  doorSegs.length = 0;
  for (const d of doors) { const { pivot, slab, dir } = d.userData; pivot.updateWorldMatrix(true, false); pivot.getWorldPosition(_h); _t.set(dir * slab.geometry.parameters.width, 0, 0).applyMatrix4(pivot.matrixWorld); doorSegs.push({ door: d, ax: _h.x, az: _h.z, bx: _t.x, bz: _t.z }); }
}
function blocked(x, z) {
  const r = P.radius;
  const test = (b) => {
    const cx = Math.max(b.min.x, Math.min(x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(z, b.max.z));
    return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
  };
  for (const b of walls) if (test(b)) return true;
  for (const b of dynBoxes) if (test(b)) return true;
  // doors: the leaf is a thick line from its hinge to its free edge, re-read every frame, so a door blocks you wherever it is
  // (closed, mid-swing or open) and never lets you stand inside it
  for (const s of doorSegs) {
    if (ignoreOpenDoors && !s.door.userData.locked) continue;
    const abx = s.bx - s.ax, abz = s.bz - s.az, t = Math.max(0, Math.min(1, ((x - s.ax) * abx + (z - s.az) * abz) / (abx * abx + abz * abz)));
    const dx = x - (s.ax + abx * t), dz = z - (s.az + abz * t), rr = r + 0.02;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

// ---------- apartment interior (anti-escape safety net) ----------
// Flood-fill the floor from the kitchen with every ordinary door open: whatever is reachable is the apartment (walls are sealed,
// the sealed east door stays shut). Anything farther than 0.2 m from that area is "outside", and the player is never allowed there.
const GRID = 0.05, GX0 = -3, GX1 = 5.4, GZ0 = -5.2, GZ1 = 8.2, GNX = Math.round((GX1 - GX0) / GRID), GNZ = Math.round((GZ1 - GZ0) / GRID);
let interior = null;
function computeInterior() {
  ignoreOpenDoors = true;   // flood with every ordinary door open
  const seen = new Uint8Array(GNX * GNZ), q = [];
  const start = nearestFreeRaw(KITCHEN_SPAWN.x, KITCHEN_SPAWN.z); if (start) { const i0 = Math.round((start.x - GX0) / GRID), j0 = Math.round((start.z - GZ0) / GRID); seen[j0 * GNX + i0] = 1; q.push(j0 * GNX + i0); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % GNX, j = (c - i) / GNX;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GNX || b >= GNZ || seen[b * GNX + a]) continue; if (blocked(GX0 + a * GRID, GZ0 + b * GRID)) continue; seen[b * GNX + a] = 1; q.push(b * GNX + a); }
  }
  ignoreOpenDoors = false;
  interior = seen;
}
function insideApartment(x, z) {
  if (!interior) return true;
  const R = Math.ceil(0.2 / GRID), ci = Math.round((x - GX0) / GRID), cj = Math.round((z - GZ0) / GRID);
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const a = ci + di, b = cj + dj; if (a >= 0 && b >= 0 && a < GNX && b < GNZ && interior[b * GNX + a] && (di * di + dj * dj) * GRID * GRID <= 0.04) return true; }
  return false;
}
function nearestFreeRaw(x, z) {
  if (!blocked(x, z)) return { x, z };
  for (let r = 0.05; r <= 1.5; r += 0.05) for (let a = 0; a < 24; a++) { const px = x + Math.cos((a / 24) * Math.PI * 2) * r, pz = z + Math.sin((a / 24) * Math.PI * 2) * r; if (!blocked(px, pz)) return { x: px, z: pz }; }
  return null;
}
/** Nearest spot INSIDE the apartment where the player fits (spiral search), or null. Used to get you out if you ever end up stuck inside something. */
function nearestFree(x, z) {
  if (!blocked(x, z) && insideApartment(x, z)) return { x, z };
  for (let r = 0.05; r <= 2.5; r += 0.05) {
    for (let a = 0; a < 24; a++) {
      const px = x + Math.cos((a / 24) * Math.PI * 2) * r, pz = z + Math.sin((a / 24) * Math.PI * 2) * r;
      if (!blocked(px, pz) && insideApartment(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}
const KITCHEN_SPAWN = { x: 1.5, z: 1.7 };   // middle of the kitchen, on the rug
refreshDoorSegs(); computeInterior();
const lastGood = { x: player.x, z: player.z };
function toKitchen() { const p = nearestFree(KITCHEN_SPAWN.x, KITCHEN_SPAWN.z); player.x = p.x; player.z = p.z; camera.rotation.set(0, Math.PI, 0); }

// ---------- player ----------
// Start in the hallway, facing the entrance door, like photo IMG_1277.
const controls = new PointerLockControls(camera, renderer.domElement);
camera.position.set(player.x, P.eye, player.z);
camera.rotation.order = 'YXZ';
camera.rotation.set(-0.03, 0, 0); // looking +z (toward the kitchen)
camera.rotation.y = Math.PI;      // PointerLock's default faces -z; flip to face +z
const visitor = buildVisitor();   // your own legs and shoes, planted on the floor
scene.add(visitor.group);
const fpBody = buildFirstPersonBody(scene, camera);   // your own torso, sleeves and hands (first person only, see fpbody.js)
const session = initSession({ scene, doors, lightState, player, camera });   // restores this session's state, if any
window.__session = session;
if (blocked(player.x, player.z)) toKitchen();   // a restored position inside something solid -> kitchen
camera.position.set(player.x, P.eye, player.z);

const startEl = document.getElementById('start');
const fb = initFeedback({
  scene, camera, renderer, roots: [kitchen, hallway, rooms, bathroom, bedroom],
  onEnter: () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; },
  onExit: () => { startEl.style.display = 'grid'; },
});
let shadowTick = 0;
startWeather();   // live Youngstown, OH weather (Open-Meteo), refreshed every 10 minutes
const hud = document.createElement('div');
hud.className = 'g-glass g-pill'; hud.style.cssText = 'left:50%;bottom:16px;transform:translateX(-50%);z-index:12;text-align:center;pointer-events:none;line-height:1.45;animation:none';
document.body.appendChild(hud); let hudT = 0;
function updateHud(dt) { hudT -= dt; if (hudT > 0) return; hudT = 1; hud.innerHTML = `<b class="g-head">${LOCATION.name}</b> &middot; ${LOCATION.city}<br>${clockText()} &middot; ${phaseName()} &middot; ${weather.loaded ? weather.label + ', ' + Math.round(weather.tempF) + '\u00b0F' : 'weather loading\u2026'}`; }
const layout = initLayout({
  scene, camera, renderer, roots: [kitchen, bathroom, bedroom], fb, wallPaints,
  extraObstacles: () => doorSwingBoxes(),
  onChange: () => { rebuildColliders(); shadowDirtyAll = true; },
  onEnter: () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; },
  onExit: () => { startEl.style.display = 'grid'; },
});
initMonitorUI();
paintUI.hooks.onOpen = () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; };
paintUI.hooks.onClose = () => { startEl.style.display = 'grid'; };
paintUI.save = () => layout.save();
monitor.hooks.onOpen = () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; };
monitor.hooks.onClose = (relock) => { if (relock) controls.lock(); else startEl.style.display = 'grid'; };
layout.ready.then(() => { autoPlacePower(kitchen, layout.state.saved); rebuildColliders(); });
// ---------- Smart Home Command Center (Tab): dashboard over the same device state as the 3D objects ----------
const devices = initDevices({ scene, doors, operateDoor });
const cameras = initCameras({ scene, renderer, mainCamera: camera });
let fpsV = 0, fpsN = 0, fpsT = performance.now();
const dash = initDashboard({
  devices, cameras, layout, renderer, scene, clock: { fps: () => fpsV },
  weatherInfo: () => ({ live: weather.loaded && weather.source !== 'default', tempF: weather.tempF, label: weather.label, clock: clockText(), zone: LOCATION.tz, simulated: dayEnv.override != null, day: dayEnv.sunElev > -4, phase: phaseName() }),
  hooks: { onOpen: () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; }, onClose: (relock) => { if (relock) controls.lock(); else startEl.style.display = 'grid'; } },
});
const placer = initPlacer({ scene, camera, layout, toast: (t, s) => activities.toast(t, s),
  hooks: { onOpen: () => { if (controls.isLocked) controls.unlock(); startEl.style.display = 'none'; }, onClose: (relock) => { if (relock) controls.lock(); else startEl.style.display = 'grid'; } } });
startEl.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { startEl.style.display = 'none'; dash.openBtn.style.display = 'none'; });
controls.addEventListener('unlock', () => { startEl.style.display = fb.state.edit || layout.state.on || monitor.open || paintUI.open || dash.open || placer.open ? 'none' : 'grid'; dash.openBtn.style.display = ''; });

const keys = new Set();
addEventListener('keydown', (e) => {
  if (fb.isTyping(e) || monitor.open || paintUI.open || dash.open || placer.open) return;
  keys.add(e.code);
  if (!layout.state.on && !fb.state.edit) {
    if (e.code === 'KeyY') { if (activities.active) activities.stop(); else { const it = lookedAt()?.item; if (it?.userData.seat) activities.sit(it); else activities.useNearby(); } }
    if (e.code === 'KeyQ' && lookedAt()?.door === bathDoor) toggleBolt();
    if (e.code === 'KeyG') entryLockAction();
    if (e.code === 'KeyH') cycleHands();
    if (e.code === 'KeyN' && !e.repeat) placer.openPicker();
    if (e.code === 'Space' && activities.active) { activities.scroll(1); e.preventDefault(); }
  }
  if (e.code === 'KeyE' && !layout.state.on && !fpBody.busy) toggleDoor();
  if (!layout.state.on && !fb.state.edit) { const h = lookedAt(), act = h?.item?.userData.interact.keys?.[e.code]; if (act) { if (h.point) fpBody.reach(h.point, 'press'); act(); } }   // extra per-object keys, e.g. C / T on the shower curtain
  if (e.code === 'KeyK' && !layout.state.on && !fb.state.edit) toKitchen();   // stuck? K takes you to the kitchen
});
addEventListener('keyup', (e) => keys.delete(e.code));
// scroll wheel while looking at something turnable (the sink-light bulb)
addEventListener('wheel', (e) => {
  if (layout.state.on || fb.state.edit || monitor.open || paintUI.open || dash.open) return;
  if (activities.active?.kind === 'toilet') { activities.scroll(e.deltaY); e.preventDefault(); return; }
  const w = lookedAt()?.item?.userData.interact.wheel;
  if (w) { w(e.deltaY); e.preventDefault(); }
}, { passive: false });

// door interaction
const ray = new THREE.Raycaster();
ray.far = 1.9;
const promptEl = document.getElementById('prompt');
let headPos = new THREE.Vector3();
function lookedAt() {
  if (activities.active) return null;
  if (activities.view.third) { camera.getWorldDirection(headPos.set(0, 0, 0)); ray.set(new THREE.Vector3(player.x, P.eye, player.z), headPos); }
  else ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [...doors.map((d) => d.userData.leaf), ...interactives];
  const hits = ray.intersectObjects(targets, true).filter((h) => !hiddenAbove(h.object) && h.object.visible !== false);
  if (!hits.length) return null;
  for (let o = hits[0].object; o; o = o.parent) {
    if (o.userData.isDoor) return { door: o, point: hits[0].point };
    if (o.userData.interact) return { item: o, point: hits[0].point };
  }
  return null;
}
function lookedAtDoor() { return lookedAt()?.door ?? null; }
// ---------- door swing vs. objects: a door never opens through anything ----------
const solidsNow = () => {
  const out = []; scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.userData.collider || hiddenAbove(o)) return;
    for (let p = o.parent; p; p = p.parent) if (p.userData.movable) { out.push(new THREE.Box3().setFromObject(o)); return; }
  });
  return out;
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
/** Largest opening angle (<= maxOpen) at which the leaf stays clear of every movable object. */
function clearAngle(d) {
  const { pivot, slab, dir, swing, maxOpen } = d.userData, keep = pivot.rotation.y;
  const w = slab.geometry.parameters.width, h = slab.geometry.parameters.height, boxes = solidsNow();
  let best = 0;
  for (let a = 0; a <= maxOpen; a += 2) {
    pivot.rotation.y = swing * dir * -THREE.MathUtils.degToRad(a); pivot.updateMatrixWorld(true);
    pivot.getWorldPosition(_a); _b.set(dir * w, 0, 0).applyMatrix4(pivot.matrixWorld);
    let hit = false;
    for (let s = 0.04; s <= 1 && !hit; s += 0.04) {
      const x = _a.x + (_b.x - _a.x) * s, z = _a.z + (_b.z - _a.z) * s;
      hit = boxes.some((b) => x > b.min.x - 0.03 && x < b.max.x + 0.03 && z > b.min.z - 0.03 && z < b.max.z + 0.03 && b.min.y < h && b.max.y > 0.02);
    }
    if (hit) break;
    best = a;
  }
  pivot.rotation.y = keep; pivot.updateMatrixWorld(true);
  return best;
}
/** The floor area each door sweeps, as a fan of slices (exact shape, not one big square). Used by Layout mode. */
function doorSwingShapes() {
  const out = [];
  for (const d of doors) {
    if (d.userData.locked) continue;
    const { pivot, slab, dir, swing, maxOpen } = d.userData, keep = pivot.rotation.y, w = slab.geometry.parameters.width, h = slab.geometry.parameters.height;
    const tips = [];
    for (let a = 0; a <= maxOpen; a += 5) { pivot.rotation.y = swing * dir * -THREE.MathUtils.degToRad(a); pivot.updateMatrixWorld(true); pivot.getWorldPosition(_a); _b.set(dir * w, 0, 0).applyMatrix4(pivot.matrixWorld); tips.push(_b.clone()); }
    pivot.rotation.y = keep; pivot.updateMatrixWorld(true);
    pivot.getWorldPosition(_a);
    out.push({ door: d, hinge: _a.clone(), tips, h });
  }
  return out;
}
const swingShapes = doorSwingShapes();
function doorSwingBoxes() {
  const out = [];
  for (const sh of swingShapes) for (let i = 0; i + 1 < sh.tips.length; i++) {
    const bb = new THREE.Box3().expandByPoint(sh.hinge).expandByPoint(sh.tips[i]).expandByPoint(sh.tips[i + 1]);
    bb.min.y = 0; bb.max.y = sh.h; bb.expandByScalar(0.02);
    bb.label = `the swing area of the ${sh.door.userData.label || sh.door.name}`; out.push(bb);
  }
  return out;
}
// red floor decal showing each door's swing area while you are in Layout mode
const swingDecals = new THREE.Group(); swingDecals.visible = false; scene.add(swingDecals);
for (const sh of swingShapes) {
  const pos = [];
  for (let i = 0; i + 1 < sh.tips.length; i++) pos.push(sh.hinge.x, 0.006, sh.hinge.z, sh.tips[i].x, 0.006, sh.tips[i].z, sh.tips[i + 1].x, 0.006, sh.tips[i + 1].z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  m.name = 'door-swing-area'; swingDecals.add(m);
}

// bathroom door: a thumb-turn lock on the inside (Q). Locked = nobody can open it from the kitchen side either.
const bathDoor = doors.find((d) => d.name === 'bathroom-door');
const inBath = () => player.x < -K.wallT / 2 - 0.05;
let boltMesh = null;
if (bathDoor) {
  const dirB = bathDoor.userData.dir, w = K.doors.find((x) => x.id === 'bathroom-door').w;
  const base = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.3 });
  boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.012), base); boltMesh.castShadow = true;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 18), base); plate.rotation.x = Math.PI / 2;
  const holder = new THREE.Group(); holder.position.set(dirB * (w / 2 - 0.07), 1.2, -0.05); holder.add(plate, boltMesh); bathDoor.userData.leaf.add(holder);
}
// ---------- hand position control: chips bottom-left + H key (saved in localStorage, so it survives rooms and reloads) ----------
const HAND_LABEL = { auto: 'Auto (up when interacting)', up: 'Hands up', natural: 'Natural rest', down: 'Hands down' };
const handUI = document.createElement('div');
handUI.className = 'g-glass g-pill g-row'; handUI.style.cssText = 'left:16px;bottom:16px;z-index:12;padding:5px 8px 5px 14px;gap:10px';
handUI.innerHTML = '<span class="g-sub g-small">Hands <kbd>H</kbd></span><span class="g-seg">' + fpBody.modes.map((m) => `<button data-m="${m}" title="${HAND_LABEL[m]}">${{ auto: 'Auto', up: 'Up', natural: 'Natural', down: 'Down' }[m]}</button>`).join('') + '</span>';
document.body.appendChild(handUI);
const refreshHandUI = () => handUI.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === fpBody.mode));
function setHands(m) { fpBody.setMode(m); refreshHandUI(); activities.toast('Hands: ' + HAND_LABEL[m], 1.6); }
function cycleHands() { setHands(fpBody.modes[(fpBody.modes.indexOf(fpBody.mode) + 1) % fpBody.modes.length]); }
handUI.addEventListener('pointerdown', (e) => e.stopPropagation()); handUI.addEventListener('keydown', (e) => e.stopPropagation());
handUI.querySelectorAll('button').forEach((b) => { b.onclick = () => { setHands(b.dataset.m); b.blur(); }; }); refreshHandUI();

// ---------- entrance door: key deadbolt (G). From the hallway you use your key, from inside the thumb-turn ----------
const entry = doors.find((d) => d.name === 'north-door');
let entryBolt = null, entryThumb = null; const EB = { out: -0.03, inn: -0.005 };
if (entry) {
  const dirE = entry.userData.dir, wE = K.doors.find((x) => x.id === 'north-door').w;
  entryBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 14).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8964a, roughness: 0.3, metalness: 0.9 }));
  entryBolt.castShadow = true; entryBolt.userData.dir = dirE; entryBolt.userData.w = wE; entryBolt.position.set(dirE * (wE / 2 + EB.out), 1.12, 0); entry.userData.leaf.add(entryBolt);
  entryThumb = entry.getObjectByName('hardware-room-side')?.getObjectByName('deadbolt')?.children.find((c) => c.geometry?.parameters?.width === 0.05) ?? null;
  try { if (localStorage.getItem('entry-bolt') === '1') { entry.userData.bolt = true; entry.userData.target = 0; entry.userData.angle = 0; } } catch { /* no storage */ }
}
function entryLockAction() {
  if (!entry || fpBody.busy) return;
  if (lookedAt()?.door !== entry) return;
  if (entry.userData.angle > 8) { activities.toast('Close the door first, then lock it'); return; }
  const outside = player.z < -0.07;
  const dead = entry.getObjectByName(outside ? 'hardware-far-side' : 'hardware-room-side')?.getObjectByName('deadbolt'); if (!dead) return;
  scene.updateMatrixWorld(true); const pt = dead.getWorldPosition(new THREE.Vector3()); pt.z += outside ? -0.02 : 0.02;
  const dist = Math.hypot(player.x - pt.x, player.z - pt.z);
  if (dist > 1.7) { activities.toast('Step closer to the lock'); return; }
  const lock = !entry.userData.bolt;
  const go = () => fpBody.keyAction(pt, { useKey: outside, turnDir: lock ? 1 : -1, onTurn: () => {
    entry.userData.bolt = lock; try { localStorage.setItem('entry-bolt', lock ? '1' : '0'); } catch { /* no storage */ }
    activities.toast(lock ? (outside ? 'Door locked with your key' : 'Deadbolt locked') : (outside ? 'Door unlocked with your key' : 'Deadbolt unlocked'), 1.8);
  } });
  if (dist <= 0.62) go();
  else { const ux = (player.x - pt.x) / dist, uz = (player.z - pt.z) / dist; approach = { x: pt.x + ux * 0.5, z: pt.z + uz * 0.5, go }; }   // walk up to the lock first, like a person would
}
let approach = null;
function toggleBolt() {
  if (!bathDoor || !inBath()) return;
  if (bathDoor.userData.angle > 8) { activities.toast('Close the door first, then lock it'); return; }
  bathDoor.userData.bolt = !bathDoor.userData.bolt;
  activities.toast(bathDoor.userData.bolt ? 'Door locked' : 'Door unlocked', 1.6);
}
function toggleDoor() {
  const hit = lookedAt();
  if (hit?.item) { const why = hit.item.userData.interact.guard?.(player.x, player.z); if (why) { activities.toast(why); return; } if (hit.point) fpBody.reach(hit.point, hit.item.userData.interact.reach ?? 'press'); hit.item.userData.interact.run(); return; }
  const d = hit?.door;
  if (!d) return;
  if (hit.point) fpBody.reach(hit.point, 'grab');
  operateDoor(d);
}
/** Open/close a door the way a person would (used by the E key and by the dashboard). Returns a reason string if it refused. */
function operateDoor(d) {
  if (d.userData.locked) return 'sealed';
  if (d.userData.bolt && d === entry) { activities.toast(player.z < -0.07 ? 'Locked. Press G to unlock it with your key' : 'Locked. Press G to turn the deadbolt'); return 'locked'; }
  if (d.userData.bolt) { activities.toast(inBath() ? 'The door is locked - press Q to unlock it' : 'Locked from the inside - someone is in there'); return 'locked'; }
  if (d === bathDoor && inBath() && activities.needsFlush && d.userData.target < 5) { activities.toast('Flush the toilet before you leave!'); return 'locked'; }
  d.userData.target = d.userData.target > 5 ? 0 : clearAngle(d);
  // don't close a door on the player
  if (d.userData.target === 0) {
    const b = doorBoxes.get(d);
    const cx = Math.max(b.min.x, Math.min(player.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(player.z, b.max.z));
    if ((player.x - cx) ** 2 + (player.z - cz) ** 2 < (P.radius + 0.1) ** 2) d.userData.target = d.userData.maxOpen;
  }
  return null;
}

// ---------- loop ----------
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
let visitorFacing = null, lookedNow = null;

function step(dt) {
  refreshDoorSegs();
  // arrow-key look (fallback when the mouse isn't captured)
  const turn = 1.8 * dt;
  if (keys.has('ArrowLeft')) camera.rotation.y += turn;
  if (keys.has('ArrowRight')) camera.rotation.y -= turn;
  if (keys.has('ArrowUp')) camera.rotation.x = Math.min(1.4, camera.rotation.x + turn);
  if (keys.has('ArrowDown')) camera.rotation.x = Math.max(-1.4, camera.rotation.x - turn);

  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  right.set(-fwd.z, 0, fwd.x);

  if (approach) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => keys.has(k))) approach = null;
    else { const dx = approach.x - player.x, dz = approach.z - player.z, dd = Math.hypot(dx, dz), st = 1.4 * dt;
      if (dd <= st) { player.x = approach.x; player.z = approach.z; const g = approach.go; approach = null; g(); }
      else if (!blocked(player.x + dx / dd * st, player.z + dz / dd * st)) { player.x += dx / dd * st; player.z += dz / dd * st; player.bob += dt * 6; } else approach = null; }
  }
  if (activities.wantsUp(keys)) activities.stop();
  activities.tick(dt);
  let mx = 0, mz = 0;
  if (keys.has('KeyW')) { mx += fwd.x; mz += fwd.z; }
  if (keys.has('KeyS')) { mx -= fwd.x; mz -= fwd.z; }
  if (keys.has('KeyD')) { mx += right.x; mz += right.z; }
  if (keys.has('KeyA')) { mx -= right.x; mz -= right.z; }
  if (activities.active) { mx = 0; mz = 0; }
  const len = Math.hypot(mx, mz);
  const moving = len > 0;
  if (moving) {
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? P.run : P.walk) * dt;
    mx = (mx / len) * speed; mz = (mz / len) * speed;
    // small sub-steps (never more than 4 cm at a time, so no frame hitch can skip over a wall), axis-separated so you slide along walls
    const n = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.04)), sx = mx / n, sz = mz / n;
    for (let i = 0; i < n; i++) { if (!blocked(player.x + sx, player.z)) player.x += sx; if (!blocked(player.x, player.z + sz)) player.z += sz; }
    player.bob += dt * (keys.has('ShiftLeft') ? 11 : 7.5);
  }
  const bobY = P.eye + (moving ? Math.sin(player.bob) * 0.012 : 0), seatedY = activities.pose && activities.pose.kind !== 'shower' ? activities.pose.y - 0.87 + P.eye : P.eye;
  activities.placeCamera(activities.pose ? seatedY : bobY);
  if (!activities.active && blocked(player.x, player.z)) { const p = nearestFree(player.x, player.z); if (p) { player.x = p.x; player.z = p.z; } }   // never stay stuck inside a wall or object
  if (!activities.active) { if (insideApartment(player.x, player.z)) { lastGood.x = player.x; lastGood.z = player.z; } else { player.x = lastGood.x; player.z = lastGood.z; } }   // never end up outside the apartment
  const facing = moving ? Math.atan2(-mx, -mz) : null;
  visitor.update(dt, player, camera, moving, !(layout.state.on || fb.state.edit), { pose: activities.pose, third: false, facing: facing ?? visitorFacing });
  if (facing != null) visitorFacing = facing;
  fpBody.update(dt, { aim: !!lookedNow, visible: !(layout.state.on || fb.state.edit), moving, running: keys.has('ShiftLeft') || keys.has('ShiftRight'), bob: player.bob, kind: activities.active?.kind ?? 'stand', desk: !!activities.active?.desk });

  // doors
  if (entryBolt) { const tx = entryBolt.userData.dir * (entryBolt.userData.w / 2 + (entry.userData.bolt ? EB.inn : EB.out)); entryBolt.position.x += (tx - entryBolt.position.x) * Math.min(1, dt * 10); if (entryThumb) entryThumb.rotation.z += ((entry.userData.bolt ? Math.PI / 2 + 0.1 : 0.1) - entryThumb.rotation.z) * Math.min(1, dt * 10); }
  if (boltMesh) boltMesh.rotation.z += ((bathDoor.userData.bolt ? Math.PI / 2 : 0) - boltMesh.rotation.z) * Math.min(1, dt * 12);
  for (const d of doors) {
    const u = d.userData;
    u.angle += (u.target - u.angle) * Math.min(1, dt * 5);
    if (Math.abs(u.target - u.angle) < 0.1) u.angle = u.target;
    u.pivot.rotation.y = u.swing * u.dir * -THREE.MathUtils.degToRad(u.angle);
  }
  updateDay(); updateHud(dt); 
  for (const o of updaters) o.userData.update(dt, { camera });
  { const ri = ['kitchen', 'bath', 'bedroom', 'closet', 'hall'].indexOf(roomOf(player.x, player.z)), a = ri < 0 ? roomAmbient[5] : roomAmbient[ri]; setDarkness(1 - Math.min(1, (a.x + a.y + a.z) / 3 * 0.8)); }   // light-switch plates glow faintly in a dark room
  updateLighting();
  const looked = fb.state.edit || layout.state.on ? null : lookedAt(); lookedNow = looked && looked.point && looked.point.distanceTo(camera.position) < 1.6 ? looked : null;
  const ah = fb.state.edit || layout.state.on ? null : activities.toastText() ?? activities.hint();
  if (ah && !looked?.item) { promptEl.innerHTML = ah; promptEl.style.opacity = 1; }
  else if (looked?.item) promptEl.innerHTML = looked.item.userData.interact.prompt();
  else promptEl.innerHTML = looked?.door?.userData.locked
    ? '🔒 Locked — this door opens to the hallway'
    : looked?.door === entry ? (entry.userData.bolt ? `🔒 Locked &nbsp; <kbd>G</kbd> unlock ${player.z < -0.07 ? 'with your key' : '(deadbolt)'}` : `<kbd>E</kbd> open / close door &nbsp; <kbd>G</kbd> lock ${player.z < -0.07 ? 'with your key' : '(deadbolt)'}`)
    : looked?.door === bathDoor && inBath() ? `<kbd>E</kbd> open / close door &nbsp; <kbd>Q</kbd> ${bathDoor.userData.bolt ? 'unlock' : 'lock'}`
    : looked?.door === bathDoor && bathDoor.userData.bolt ? '🔒 Locked from the inside'
    : '<kbd>E</kbd> open / close door';
  if (!ah || looked?.item) promptEl.style.opacity = looked || ah ? 1 : 0;
  fb.update();
  swingDecals.visible = layout.state.on;
  layout.update();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  step(Math.min(clock.getDelta(), 0.05));
  if (window.__ao.enabled) composer.render(); else renderer.render(scene, camera);
  dash.frame(); fpsN++; const tn = performance.now(); if (tn - fpsT > 1000) { fpsV = Math.round(fpsN * 1000 / (tn - fpsT)); fpsN = 0; fpsT = tn; }
});

// debug hook for testing
/** Save a screenshot of the current view to docs/screenshots/<name>.jpg (dev server only). Press P, or call __fp.snapshot('name'). */
async function snapshot(name = 'snapshot-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)) {
  if (window.__ao.enabled) composer.render(); else renderer.render(scene, camera);
  const src = renderer.domElement, w = Math.min(1600, src.width), c = document.createElement('canvas'); c.width = w; c.height = Math.round((src.height * w) / src.width);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  const r = await fetch('/__snapshot', { method: 'POST', body: JSON.stringify({ name, image: c.toDataURL('image/jpeg', 0.88) }) });
  const j = await r.json(); activities.toast(j.ok ? 'Saved ' + j.file : 'Snapshot failed', 2.2); return j.file;
}
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && !e.repeat && !fb.isTyping(e) && !paintUI.open && !layout.state.on) snapshot(); });

window.__fp = { placer, dash, devices, cameras, inside: insideApartment, setTime(ms) { dayEnv.override = ms; }, setWeather: (o) => Object.assign(weather, o), snapshot, activities, blocked, clearAngle, doorSwingBoxes, layout, lookedAt, interactives, updaters, fb, player, camera, doors, walls, teleport(x, z, yaw = 0) { player.x = x; player.z = z; camera.rotation.y = yaw; } };
