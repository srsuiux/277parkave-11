import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { KITCHEN as K, HALLWAY as Hc, PLAYER as P, BATHROOM as BATH, BEDROOM as BED } from './config.js';
import { setDarkness } from './glowmarks.js';
import { env as dayEnv, initSun, update as updateDay } from './daycycle.js';
import { initClockUI } from './clockui.js';
import { makeMaterials } from './materials.js';
import { buildKitchen } from './shell/kitchen.js';
import { buildHallway } from './shell/hallway.js';
import { buildRooms } from './shell/rooms.js';
import { buildBathroom } from './shell/bathroom.js';
import { buildBedroom, bedroomState, closetState } from './shell/bedroom.js';
import { paintUI, openPaint } from './paint.js';
import { makeWallsPaintable } from './wallpaint.js';
import { initFeedback } from './feedback.js';
import { initLayout } from './layout.js';
import { autoPlacePower } from './fixtures/power.js';
import { lightState } from './fixtures/lights.js';
import { initSession } from './session.js';
import { buildVisitor } from './visitor.js';
import { initActivities } from './activity.js';
import { monitor, initMonitorUI } from './monitor.js';
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
renderer.shadowMap.autoUpdate = false;   // the shadow map is re-rendered every 3rd frame (see the frame loop): the scene is mostly static
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
const gated = [];
scene.updateMatrixWorld(true);
scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) { const w = o.getWorldPosition(new THREE.Vector3()); const room = roomOf(w.x, w.z); if (room) gated.push({ light: o, room, f: 1, raw: o.intensity, last: o.intensity }); } });
function applyRoomLights(dt) {
  const here = roomOf(player.x, player.z);
  for (const g of gated) {
    let f = 1;
    if (here && g.room !== here) {
      f = 0;
      const link = LINKS.find(([a, b]) => (a === here && b === g.room) || (b === here && a === g.room));
      const d = link && doors.find((dd) => dd.name === link[2]);
      if (d && d.userData.angle > 2) f = 0.12 + 0.5 * Math.min(1, d.userData.angle / 45);
    }
    g.f += (f - g.f) * Math.min(1, dt * 7);
    if (g.light.intensity !== g.last) g.raw = g.light.intensity;   // the fixture updated itself this frame
    g.last = g.light.intensity = g.raw * (g.f < 0.002 ? 0 : g.f);
  }
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
const walls = [];
const hiddenAbove = (m) => { for (let p = m.parent; p; p = p.parent) if (!p.visible) return true; return false; };
function rebuildColliders() {
  walls.length = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.isMesh && o.userData.collider && !hiddenAbove(o)) walls.push(new THREE.Box3().setFromObject(o));
  });
}
rebuildColliders();

function blocked(x, z) {
  const r = P.radius;
  const test = (b) => {
    const cx = Math.max(b.min.x, Math.min(x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(z, b.max.z));
    return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
  };
  for (const b of walls) if (test(b)) return true;
  for (const d of doors) if (d.userData.angle < 12 && test(doorBoxes.get(d))) return true;
  return false;
}

/** Nearest spot where the player fits (spiral search), or null. Used to get you out if you ever end up stuck inside something. */
function nearestFree(x, z) {
  if (!blocked(x, z)) return { x, z };
  for (let r = 0.05; r <= 2.5; r += 0.05) {
    for (let a = 0; a < 24; a++) {
      const px = x + Math.cos((a / 24) * Math.PI * 2) * r, pz = z + Math.sin((a / 24) * Math.PI * 2) * r;
      if (!blocked(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}
const KITCHEN_SPAWN = { x: 1.5, z: 1.7 };   // middle of the kitchen, on the rug
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
const dayClock = initClockUI({ toast: (m, s) => activities.toast(m, s), isBusy: () => fb.state.edit || layout.state.on || monitor.open || paintUI.open });
const layout = initLayout({
  scene, camera, renderer, roots: [kitchen, bathroom, bedroom], fb, wallPaints,
  extraObstacles: () => doorSwingBoxes(),
  onChange: rebuildColliders,
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
startEl.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { startEl.style.display = 'none'; });
controls.addEventListener('unlock', () => { startEl.style.display = fb.state.edit || layout.state.on || monitor.open || paintUI.open ? 'none' : 'grid'; });

const keys = new Set();
addEventListener('keydown', (e) => {
  if (fb.isTyping(e) || monitor.open || paintUI.open) return;
  keys.add(e.code);
  if (!layout.state.on && !fb.state.edit) {
    if (e.code === 'KeyY') { if (activities.active) activities.stop(); else { const it = lookedAt()?.item; if (it?.userData.seat) activities.sit(it); else activities.useNearby(); } }
    if (e.code === 'KeyQ' && lookedAt()?.door === bathDoor) toggleBolt();
    if (e.code === 'Space' && activities.active) { activities.scroll(1); e.preventDefault(); }
    if (e.code === 'KeyV') activities.view.third = !activities.view.third;   // first / third person
  }
  if (e.code === 'KeyE' && !layout.state.on) toggleDoor();
  if (!layout.state.on && !fb.state.edit) { const act = lookedAt()?.item?.userData.interact.keys?.[e.code]; if (act) act(); }   // extra per-object keys, e.g. C / T on the shower curtain
  if (e.code === 'KeyK' && !layout.state.on && !fb.state.edit) toKitchen();   // stuck? K takes you to the kitchen
});
addEventListener('keyup', (e) => keys.delete(e.code));
// scroll wheel while looking at something turnable (the sink-light bulb)
addEventListener('wheel', (e) => {
  if (layout.state.on || fb.state.edit || monitor.open || paintUI.open) return;
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
    if (o.userData.isDoor) return { door: o };
    if (o.userData.interact) return { item: o };
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
function toggleBolt() {
  if (!bathDoor || !inBath()) return;
  if (bathDoor.userData.angle > 8) { activities.toast('Close the door first, then lock it'); return; }
  bathDoor.userData.bolt = !bathDoor.userData.bolt;
  activities.toast(bathDoor.userData.bolt ? 'Door locked' : 'Door unlocked', 1.6);
}
function toggleDoor() {
  const hit = lookedAt();
  if (hit?.item) { hit.item.userData.interact.run(); return; }
  const d = hit?.door;
  if (!d || d.userData.locked) return;
  if (d.userData.bolt) { activities.toast(inBath() ? 'The door is locked - press Q to unlock it' : 'Locked from the inside - someone is in there'); return; }
  if (d === bathDoor && inBath() && activities.needsFlush && d.userData.target < 5) { activities.toast('Flush the toilet before you leave!'); return; }
  d.userData.target = d.userData.target > 5 ? 0 : clearAngle(d);
  // don't close a door on the player
  if (d.userData.target === 0) {
    const b = doorBoxes.get(d);
    const cx = Math.max(b.min.x, Math.min(player.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(player.z, b.max.z));
    if ((player.x - cx) ** 2 + (player.z - cz) ** 2 < (P.radius + 0.1) ** 2) d.userData.target = d.userData.maxOpen;
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
let visitorFacing = null;

function step(dt) {
  // arrow-key look (fallback when the mouse isn't captured)
  const turn = 1.8 * dt;
  if (keys.has('ArrowLeft')) camera.rotation.y += turn;
  if (keys.has('ArrowRight')) camera.rotation.y -= turn;
  if (keys.has('ArrowUp')) camera.rotation.x = Math.min(1.4, camera.rotation.x + turn);
  if (keys.has('ArrowDown')) camera.rotation.x = Math.max(-1.4, camera.rotation.x - turn);

  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  right.set(-fwd.z, 0, fwd.x);

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
    // axis-separated so you slide along walls
    if (!blocked(player.x + mx, player.z)) player.x += mx;
    if (!blocked(player.x, player.z + mz)) player.z += mz;
    player.bob += dt * (keys.has('ShiftLeft') ? 11 : 7.5);
  }
  const bobY = P.eye + (moving ? Math.sin(player.bob) * 0.012 : 0), seatedY = activities.pose && activities.pose.kind !== 'shower' ? activities.pose.y - 0.87 + P.eye : P.eye;
  activities.placeCamera(activities.pose ? seatedY : bobY);
  if (!activities.active && blocked(player.x, player.z)) { const p = nearestFree(player.x, player.z); if (p) { player.x = p.x; player.z = p.z; } }   // never stay stuck inside a wall or object
  const facing = moving ? Math.atan2(-mx, -mz) : null;
  visitor.update(dt, player, camera, moving, !(layout.state.on || fb.state.edit), { pose: activities.pose, third: activities.view.third, facing: facing ?? visitorFacing });
  if (facing != null) visitorFacing = facing;

  // doors
  if (boltMesh) boltMesh.rotation.z += ((bathDoor.userData.bolt ? Math.PI / 2 : 0) - boltMesh.rotation.z) * Math.min(1, dt * 12);
  for (const d of doors) {
    const u = d.userData;
    u.angle += (u.target - u.angle) * Math.min(1, dt * 5);
    if (Math.abs(u.target - u.angle) < 0.1) u.angle = u.target;
    u.pivot.rotation.y = u.swing * u.dir * -THREE.MathUtils.degToRad(u.angle);
  }
  updateDay(dt); dayClock.refresh(); if ((shadowTick = (shadowTick + 1) % 3) === 0) renderer.shadowMap.needsUpdate = true;
  for (const o of updaters) o.userData.update(dt, { camera });
  { const inBed = player.z > 4.1 && camera.position.x > -1.4; const inCloset = inBed && camera.position.x > 3.27; const want = inCloset ? closetState.level : inBed ? bedroomState.level : kitchenLevel; ambLevel += (want - ambLevel) * Math.min(1, dt * 6); const l = ambLevel < 0.003 ? 0 : ambLevel; const win = { bedroom: 0.55, bath: 0.3, closet: 0.06, hall: 0.1, kitchen: 0.08 }[roomOf(player.x, player.z)] ?? 0.1, dl = dayEnv.dayAmb * win;   // daylight reaching this room's ambient light
    hemi.color.copy(dayEnv.ambSky); hemi.groundColor.copy(dayEnv.ambGround);
    hemi.intensity = 0.06 + 0.29 * l + 0.5 * dl; scene.environmentIntensity = 0.05 + 0.2 * l + 0.3 * dl; }
  setDarkness(1 - Math.min(1, ambLevel * 1.6));   // light-switch plates glow faintly in a dark room
  applyRoomLights(dt);
  const looked = fb.state.edit || layout.state.on ? null : lookedAt();
  const ah = fb.state.edit || layout.state.on ? null : activities.toastText() ?? activities.hint();
  if (ah && !looked?.item) { promptEl.innerHTML = ah; promptEl.style.opacity = 1; }
  else if (looked?.item) promptEl.innerHTML = looked.item.userData.interact.prompt();
  else promptEl.innerHTML = looked?.door?.userData.locked
    ? '🔒 Locked — this door opens to the hallway'
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

window.__fp = { snapshot, activities, blocked, clearAngle, doorSwingBoxes, layout, lookedAt, interactives, updaters, fb, player, camera, doors, walls, teleport(x, z, yaw = 0) { player.x = x; player.z = z; camera.rotation.y = yaw; } };
