import * as THREE from 'three';
import { BATHROOM as B } from './config.js';
import { buildPhone } from './phone.js';

/**
 * GTA-style activities for the visitor: sit on any chair (wherever you've placed it), use the toilet, take a shower.
 * Y = start (look at a chair, or stand next to the toilet / inside the shower), Y or any move key = stand up, V = camera view.
 * While busy the third-person camera orbits the character and pulls in when a wall is in the way.
 */
const SEATS = { 'chair-north': { hip: 0.69 }, 'chair-west': { hip: 0.69 }, 'metal-chair': { hip: 0.52 }, 'orange-chair': { hip: 0.45 }, 'bedroom-sofa': { hip: 0.52, dz: 0.06 }, 'study-chair': { hip: 0.47 } };   // hip height of each chair's seat

export function initActivities({ scene, camera, player, getWalls, nearestFree }) {
  const view = { third: false };   // always false: the game is first person only
  const phone = buildPhone(); scene.add(phone.group); let lastDt = 0.016;
  let act = null, since = 0, needsFlush = false, toastMsg = '', toastUntil = 0;
  const toast = (msg, secs = 2.6) => { toastMsg = msg; toastUntil = performance.now() + secs * 1000; };
  const v3 = new THREE.Vector3(), dirV = new THREE.Vector3();

  // chairs: tag them so looking at one shows "Y sit down" (the Y key itself is handled in main.js)
  const seats = [];
  for (const [name, s] of Object.entries(SEATS)) {
    const o = scene.getObjectByName(name); if (!o) continue;
    o.userData.seat = s;
    const prev = o.userData.interact;   // keep e.g. the X-colours prompt
    o.userData.interact = { ...prev, prompt: () => '<kbd>Y</kbd> sit down' + (prev ? ' &nbsp; ' + prev.prompt() : ''), run: prev?.run ?? (() => {}) };
    seats.push(o);
  }
  const toilet = scene.getObjectByName('flush-lever')?.parent ?? null;
  const stall = scene.getObjectByName('shower-stall') ?? null;
  // realism rule: flushing is up to you, and the flush lever clears the "unflushed" state
  const lever = scene.getObjectByName('flush-lever');
  if (lever?.userData.interact) { const run = lever.userData.interact.run; lever.userData.interact.run = (...a) => { run(...a); if (needsFlush) { needsFlush = false; toast('Flushed. You can leave now.'); } }; }
  const yawOf = (o) => { o.getWorldDirection(dirV); return Math.atan2(dirV.x, dirV.z); };   // yaw of the object's local +z (the way a sitter faces)

  function begin(kind, pose, extra = {}) {
    since = 0;
    const target = { ...pose }, live = { ...pose, x: player.x, z: player.z, y: 0.92 };   // walk / lower yourself onto the seat over ~0.7 s
    act = { kind, pose: live, target, k: 0, ...extra };
    view.third = false;
    if (kind === 'toilet') { camera.rotation.set(-0.8, pose.yaw, 0); phone.show(true); }   // look down at your knees, take the phone out
    else camera.rotation.set(kind === 'sit' ? (extra.desk ? -0.4 : -0.2) : -0.1, kind === 'sit' ? pose.yaw : 0, 0);   // seated: facing the way the chair faces; shower: facing the wall
  }
  function sit(o) {
    if (act) return;
    o.updateMatrixWorld(true);
    const th = yawOf(o), p = o.localToWorld(new THREE.Vector3(0, 0, o.userData.seat.dz ?? 0));
    const fx = Math.sin(th), fz = Math.cos(th);
    // rule: two solid things never share space. Refuse if the sitter's body would overlap anything except this chair.
    const own = []; o.traverse((m) => { if (m.userData.collider) own.push(new THREE.Box3().setFromObject(m)); });
    const hx = p.x - fx * 0.03, hz = p.z - fz * 0.03, hy = o.userData.seat.hip;
    for (const b of getWalls()) {
      if (own.some((q) => q.min.distanceTo(b.min) < 1e-3 && q.max.distanceTo(b.max) < 1e-3)) continue;
      if (b.max.y < hy - 0.1 || b.min.y > hy + 0.55) continue;
      const cx = Math.max(b.min.x, Math.min(hx, b.max.x)), cz = Math.max(b.min.z, Math.min(hz, b.max.z));
      if ((hx - cx) ** 2 + (hz - cz) ** 2 < 0.15 * 0.15) { toast('Not enough room to sit there - something is in the way'); return; }
    }
    begin('sit', { kind: 'sit', x: p.x - fx * 0.03, z: p.z - fz * 0.03, y: o.userData.seat.hip, yaw: th + Math.PI }, { exit: { x: p.x + fx * 0.6, z: p.z + fz * 0.6 }, desk: ['chair-north', 'chair-west', 'study-chair'].includes(o.name) });
  }
  function useToilet() {
    if (!toilet.userData.persist?.get()[0]) { toast('The lid is closed - look at it and press E to open it first'); return; }
    toilet.updateMatrixWorld(true);
    const th = yawOf(toilet), p = toilet.localToWorld(new THREE.Vector3(0, 0, 0.07));   // centre of the seat ring, well in front of the tank
    const fx = Math.sin(th), fz = Math.cos(th);
    toilet.userData.persist?.set([true, false]);   // lid stays up, seat down
    begin('toilet', { kind: 'toilet', x: p.x, z: p.z, y: 0.5, yaw: th + Math.PI }, { exit: { x: p.x + fx * 0.65, z: p.z + fz * 0.65 }});
  }
  function useShower() {
    const prev = stall.userData.persist.get();
    stall.userData.persist.set({ ...prev, c: 1, hot: true, cold: true });   // curtain pulled back, water on
    begin('shower', { kind: 'shower', x: B.x1 - 0.42, z: B.z0 + 0.62, y: 0, yaw: 0 }, { exit: { x: B.x1 - 0.42, z: B.z0 + B.stall.d + 0.35 }, prev });
  }
  function stop() {
    if (!act) return;
    if (act.prev) stall.userData.persist.set(act.prev);                       // water off, curtain as it was
    if (act.kind === 'toilet') { needsFlush = true; toast("Don't forget to flush! (E on the lever)", 4); }
    const p = nearestFree(act.exit.x, act.exit.z) ?? act.exit; player.x = p.x; player.z = p.z;
    act = null; view.third = false; phone.show(false);
  }

  const inStall = () => stall && player.x > B.x1 - B.stall.w - 0.05 && player.x < B.x1 && player.z > B.z0 && player.z < B.z0 + B.stall.d + 0.05;
  const nearToilet = () => { if (!toilet) return false; const p = toilet.getObjectByName('toilet-seat').getWorldPosition(v3); return Math.hypot(player.x - p.x, player.z - p.z) < 0.95; };

  return {
    view,
    get active() { return act; },
    get pose() { return act?.pose ?? null; },
    sit, stop, toast, get needsFlush() { return needsFlush; },
    toastText() { return performance.now() < toastUntil ? toastMsg : null; },
    useNearby() { if (act) return; if (inStall()) useShower(); else if (nearToilet()) { if (needsFlush) toast('Flush first!'); else useToilet(); } },
    hint() {
      if (act) return `<kbd>Y</kbd> or move to stand up &nbsp; ${act.kind === 'toilet' ? ' <kbd>scroll</kbd> / <kbd>Space</kbd> next video &nbsp;' : ''} <span style="opacity:.7">${act.kind === 'shower' ? 'showering' : act.kind === 'toilet' ? 'on the toilet' : 'sitting'}</span>`;
      if (inStall()) return '<kbd>Y</kbd> take a shower';
      if (nearToilet()) return needsFlush ? '<kbd>E</kbd> flush the toilet (look at the lever)' : toilet.userData.persist?.get()[0] ? '<kbd>Y</kbd> use the toilet' : '<kbd>Y</kbd> use the toilet &nbsp; <span style="opacity:.7">(open the lid first: look at it, <kbd>E</kbd>)</span>';
      return null;
    },
    tick(dt) {
      lastDt = dt; if (!act) return; since += dt;
      if (act.k < 1) {
        act.k = Math.min(1, act.k + dt / 0.7); const e = act.k * act.k * (3 - 2 * act.k), T = act.target;
        act.pose.x = player.x + (T.x - player.x) * e; act.pose.z = player.z + (T.z - player.z) * e; act.pose.y = 0.92 + (T.y - 0.92) * e;
        if (act.k === 1) { player.x = T.x; player.z = T.z; }
      }
    },
    scroll(d) { if (act?.kind === 'toilet') phone.scroll(d); },
    wantsUp(keys) { return act && since > 0.6 && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => keys.has(k)); },
    /** Third-person camera: over-the-shoulder, pulled in by walls. Returns the head position used for interaction rays. */
    placeCamera(headY) {
      const head = new THREE.Vector3(player.x, headY, player.z);
      if (act) head.set(act.pose.x, headY, act.pose.z);
      phone.group.visible = act?.kind === 'toilet' && !view.third;
      if (!view.third) { camera.position.copy(head); phone.place(camera, lastDt); return head; }
      camera.getWorldDirection(dirV);
      const right = new THREE.Vector3(-dirV.z, 0, dirV.x).normalize();
      const origin = head.clone().addScaledVector(right, act ? 0.15 : 0.3); origin.y += 0.12;
      const back = dirV.clone().multiplyScalar(-1);
      let dist = act ? 1.7 : 2.3;
      const ray = new THREE.Ray(origin, back), hit = new THREE.Vector3();
      for (const b of getWalls()) if (ray.intersectBox(b, hit)) { const t = hit.distanceTo(origin); if (t < dist + 0.15) dist = Math.max(0.35, Math.min(dist, t - 0.15)); }
      camera.position.copy(origin).addScaledVector(back, dist);
      camera.position.y = Math.min(2.3, Math.max(0.25, camera.position.y));
      return head;
    },
  };
}
