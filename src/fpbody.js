import * as THREE from 'three';
import { rBox } from './rbox.js';
import { AVATAR } from './avatar.js';

/**
 * First-person embodiment: the avatar's own torso, shoulders, long-sleeved arms and hands, seen only through the player's eyes.
 *  - The rig follows the HEAD POSITION and the body YAW (not the camera pitch), so looking down reveals chest, sleeves and hands
 *    exactly where they are instead of sticking to the screen. Everything lives on render layer 1 (the main camera sees it; mirrors,
 *    raycasts for interaction and layout picking do not).
 *  - Arms are two-bone IK chains (shoulder -> elbow -> wrist) with fixed bone lengths and an outward / downward elbow pole.
 *  - Hands have a palm, four three-joint fingers and a thumb, driven by five curl values.
 *  - Pose states (stand / sit / desk typing / toilet / shower) set where each wrist goes; walking sway, breathing, look-around lag and
 *    reach overlays (press a switch, grab a handle) are layered on top, and everything is smoothed, never snapped.
 * The rig never touches world objects; main.js only tells it the state and, on interaction, where to reach.
 */
const L1 = 0.30, L2 = 0.265;                           // upper arm, forearm (shoulder -> elbow -> wrist)
const SHOULDER = new THREE.Vector3(0.155, -0.235, 0.07);   // relative to the eye, x mirrored for the left arm
const HAND_LEN = 0.175;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

function fabricMaps() {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 8; return t; };
  const hex = '#' + new THREE.Color(AVATAR.shirt).getHexString();
  const map = mk((g) => { g.fillStyle = hex; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 4) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, 0, 1.6, 256); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 2, 0, 1, 256); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,20'},${Math.random() * 0.07})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } });
  const bump = mk((g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 4) { g.fillStyle = '#5a5a5a'; g.fillRect(x, 0, 2, 256); }
    for (let i = 0; i < 9; i++) { const y = Math.random() * 256, gr = g.createLinearGradient(0, y - 14, 0, y + 14); gr.addColorStop(0, 'rgba(128,128,128,0)'); gr.addColorStop(0.5, `rgba(${Math.random() < 0.5 ? '40,40,40' : '230,230,230'},.8)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(0, y - 14, 256, 28); } });
  return { map, bump };
}

function buildHand(side, skin, nailMat) {
  const hand = new THREE.Group(), curlK = [1.2, 1.55, 1.0];
  const cast = (m) => { m.castShadow = true; m.receiveShadow = true; m.layers.set(1); return m; };
  const mesh = (geo, mat, parent, x, y, z) => { const m = cast(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); parent.add(m); return m; };
  const cap = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2 + r * 0.0); return g; };
  mesh(new THREE.CylinderGeometry(0.029, 0.031, 0.05, 16).rotateX(Math.PI / 2), skin, hand, 0, 0, 0.0);                       // wrist
  const palm = mesh(rBox(0.082, 0.026, 0.1, 0.011), skin, hand, 0, 0, 0.065);
  mesh(new THREE.SphereGeometry(0.02, 12, 8), skin, hand, side * 0.032, -0.004, 0.065).scale.set(1.2, 0.8, 1.4);               // thumb pad (palm side)
  mesh(new THREE.SphereGeometry(0.0125, 10, 8), skin, hand, 0, 0.012, 0.03).scale.set(2.4, 0.5, 1.3);                        // back-of-hand tendons
  const fingers = [], lens = [[0.04, 0.026, 0.02], [0.044, 0.029, 0.021], [0.04, 0.027, 0.02], [0.032, 0.021, 0.018]];
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Group(); root.position.set(side * (0.031 - i * 0.0205), 0.002, 0.113); hand.add(root);
    const joints = []; let parent = root;
    lens[i].forEach((len, j) => { const r = 0.0098 - j * 0.0011 - i * 0.0003; const jg = new THREE.Group(); jg.position.z = j === 0 ? 0 : lens[i][j - 1]; parent.add(jg); jg.position.z = j === 0 ? 0 : lens[i][j - 1];
      mesh(cap(r, len - r), skin, jg, 0, 0, 0); mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), skin, jg, 0, 0.001, 0); joints.push(jg); parent = jg;
      if (j === 2) { const n = mesh(new THREE.SphereGeometry(r * 0.8, 8, 6), nailMat, jg, 0, r * 0.62, len * 0.72); n.scale.set(0.85, 0.28, 1.3); } });
    fingers.push(joints);
  }
  const tb = new THREE.Group(); tb.position.set(side * 0.036, -0.006, 0.03); hand.add(tb);
  const tj = []; let tp = tb; [0.04, 0.033, 0.027].forEach((len, j) => { const jg = new THREE.Group(); jg.position.z = j === 0 ? 0 : [0.04, 0.033][j - 1]; tp.add(jg); const r = 0.0112 - j * 0.0012;
    mesh(cap(r, len - r), skin, jg, 0, 0, 0); mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), skin, jg, 0, 0, 0); tj.push(jg); tp = jg;
    if (j === 2) { const n = mesh(new THREE.SphereGeometry(r * 0.8, 8, 6), nailMat, jg, 0, r * 0.62, len * 0.7); n.scale.set(0.9, 0.28, 1.3); } });
  // the brass door key (shown only while locking / unlocking from outside): bow, shank and cut blade pointing along the fingers
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8964a, roughness: 0.3, metalness: 0.9 });
  const key = new THREE.Group(); key.visible = false; key.position.set(side * 0.004, 0.004, 0.158); hand.add(key); hand.userData.key = key;
  mesh(new THREE.TorusGeometry(0.0125, 0.0028, 8, 20), brass, key, 0, 0, -0.044);
  mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.07, 10).rotateX(Math.PI / 2), brass, key, 0, 0, -0.005);
  const blade = mesh(new THREE.BoxGeometry(0.0022, 0.0125, 0.032), brass, key, 0, -0.005, 0.045);
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.0024, 0.004, 0.004), brass, key, 0, -0.0125, 0.034 + i * 0.01);
  void palm; void blade;
  hand.userData.curl = [0, 0, 0, 0, 0];
  hand.userData.apply = (c) => {
    fingers.forEach((js, i) => js.forEach((jg, j) => { jg.rotation.x = c[i + 1] * curlK[j]; }));
    tb.rotation.y = side * (0.55 - 0.75 * c[0]); tb.rotation.x = c[0] * 0.25;
    tj.forEach((jg, j) => { jg.rotation.x = c[0] * (j === 0 ? 0.25 : 0.55); });
  };
  return hand;
}

export function buildFirstPersonBody(scene, camera) {
  camera.layers.enable(1);
  const rig = new THREE.Group(); rig.name = 'first-person-body'; scene.add(rig);
  const { map, bump } = fabricMaps();
  const cloth = new THREE.MeshPhysicalMaterial({ color: 0x8c93b4, map, bumpMap: bump, bumpScale: 2.2, roughness: 0.95, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x4f6bd0) });
  const cuffMat = cloth.clone(); cuffMat.color = new THREE.Color(0x777f9c); cuffMat.map = map;
  const skin = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(AVATAR.skin).multiplyScalar(0.82), roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xff9a7a), emissive: 0x2a0d06, emissiveIntensity: 0.18 });
  const nail = new THREE.MeshStandardMaterial({ color: 0xe0b19a, roughness: 0.35 });
  const place = (m) => { m.castShadow = true; m.receiveShadow = true; m.layers.set(1); return m; };

  // torso (visible when looking down) + shoulder caps
  const torso = place(new THREE.Mesh(rBox(0.29, 0.58, 0.18, 0.09), cloth)); torso.position.set(0, -0.53, 0.115); rig.add(torso);
  const chest = place(new THREE.Mesh(rBox(0.27, 0.2, 0.17, 0.08), cloth)); chest.position.set(0, -0.3, 0.1); rig.add(chest);
  const arms = [-1, 1].map((side) => {
    const shoulder = SHOULDER.clone(); shoulder.x *= side;
    const cap = place(new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), cloth)); cap.position.copy(shoulder); rig.add(cap);
    const seg = (len, rA, rB) => { const g = new THREE.Group(); const c = place(new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, 20, 1).rotateX(Math.PI / 2).translate(0, 0, len / 2), cloth)); g.add(c); rig.add(g); return g; };
    const upper = seg(L1, 0.05, 0.045), fore = seg(L2, 0.045, 0.037);
    const ring = (parent, z, r, tube = 0.0045) => { const t = place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 22), cloth)); t.position.z = z; parent.add(t); return t; };
    ring(fore, 0.04, 0.046, 0.005); ring(fore, L2 * 0.55, 0.041, 0.0025); ring(fore, L2 - 0.07, 0.039, 0.0045);   // soft bunching at the elbow and the wrist
    const elbowBall = place(new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), cloth)); rig.add(elbowBall);
    const cuff = place(new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0405, 0.04, 20).rotateX(Math.PI / 2).translate(0, 0, L2 - 0.012), cuffMat)); fore.add(cuff);
    const hand = buildHand(side, skin, nail); rig.add(hand);
    return { side, shoulder, upper, fore, elbowBall, hand, wrist: V(side * 0.2, -0.36, -0.3), fd: V(-side * 0.15, -0.35, -1).normalize(), up: V(side * 0.8, 0.5, 0), curl: [0.3, 0.35, 0.4, 0.45, 0.5], overlay: null, phase: side > 0 ? 0 : Math.PI };
  });

  const Z = V(0, 0, 1), tmp = V(), tmp2 = V(), pole = V(), m4 = new THREE.Matrix4();
  function solveArm(a, target) {
    const S = a.shoulder; tmp.copy(target).sub(S); let dist = tmp.length(); tmp.normalize();
    dist = Math.min(L1 + L2 - 0.004, Math.max(0.14, dist));
    const W = tmp2.copy(S).addScaledVector(tmp, dist);
    const aa = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - aa * aa));
    pole.set(a.side * 0.55, -1, 0.45); pole.addScaledVector(tmp, -pole.dot(tmp)).normalize();
    const E = V().copy(S).addScaledVector(tmp, aa).addScaledVector(pole, h);
    a.upper.position.copy(S); a.upper.quaternion.setFromUnitVectors(Z, V().subVectors(E, S).normalize());
    a.fore.position.copy(E); a.fore.quaternion.setFromUnitVectors(Z, V().subVectors(W, E).normalize());
    a.elbowBall.position.copy(E);
    return W.clone();
  }

  const MODES = ['auto', 'up', 'natural', 'down']; let mode = 'auto'; try { const m = localStorage.getItem('hand-mode'); if (MODES.includes(m)) mode = m; } catch { /* no storage */ }
  const st = { aim: 0, walk: 0, yawV: 0, pitchV: 0, lastYaw: null, lastPitch: 0, lagX: 0, lagY: 0, t: 0, typingUntil: 0 };
  addEventListener('keydown', (e) => { if (!/^(Key[WASDYQEVRKPLXCT]|Arrow|Shift|Space|Escape|Tab)/.test(e.code)) st.typingUntil = performance.now() + 450; else if (e.code === 'KeyT' || e.code === 'KeyC') st.typingUntil = 0; });

  function rest(a, ctx) {
    const s = a.side, t = st.t, k = ctx.kind, tg = { w: V(), fd: V(), up: V(), curl: [0.3, 0.35, 0.4, 0.45, 0.5] };
    if (k === 'sit' && ctx.desk) {   // hands on the desk / keyboard
      tg.w.set(s * 0.11, -0.50, -0.40); tg.fd.set(-s * 0.05, -0.22, -1); tg.up.set(0, 1, 0); tg.curl = [0.25, 0.4, 0.45, 0.5, 0.55];
      if (performance.now() < st.typingUntil) { const i0 = s > 0 ? 0 : 3; tg.curl = tg.curl.map((c, i) => c + 0.28 * Math.max(0, Math.sin(t * (10 + i * 1.7) + i * 2.1 + i0))); tg.w.y += Math.sin(t * 13 + a.phase) * 0.004; tg.w.z += Math.sin(t * 7 + a.phase) * 0.006; }
    } else if (k === 'sit') { tg.w.set(s * 0.17, -0.53, -0.27); tg.fd.set(-s * 0.15, -0.5, -1); tg.up.set(s * 0.3, 1, 0); tg.curl = [0.3, 0.4, 0.45, 0.5, 0.55]; }
    else if (k === 'toilet') { tg.w.set(s * 0.085, -0.43, -0.29); tg.fd.set(-s * 0.35, 0.35, -1); tg.up.set(s * 0.6, 0.8, 0); tg.curl = [0.55, 0.55, 0.6, 0.65, 0.7]; }
    else if (k === 'shower') { const sc = Math.sin(t * 5 + a.phase); tg.w.set(s * (0.2 + sc * 0.02), 0.03 + Math.abs(sc) * 0.02, -0.2 + sc * 0.03); tg.fd.set(-s * 0.7, 0.8, -0.25); tg.up.set(s * 0.4, 0.2, -1); tg.curl = [0.35, 0.5, 0.55, 0.55, 0.6]; }
    else {
      // standing / walking: where the hands are depends on the chosen position (blended continuously, never snapped)
      const up = mode === 'up' ? 1 : mode === 'auto' ? st.aim : 0, nat = mode === 'natural' ? 1 : 0, down = Math.max(0, 1 - up - nat);
      const P_UP = [s * 0.19, -0.36, -0.30], P_NAT = [s * 0.20, -0.52, -0.19], P_DN = [s * 0.225, -0.68, -0.03];
      const F_UP = [-s * 0.16, -0.36, -1], F_NAT = [-s * 0.08, -0.75, -0.55], F_DN = [-s * 0.02, -1, -0.12];
      const U_UP = [s * 0.8, 0.5, 0], U_NAT = [s * 0.9, 0.3, 0], U_DN = [s, 0.08, 0];
      const mix = (u, n, d) => u.map((v, i) => v * up + n[i] * nat + d[i] * down);
      tg.w.set(...mix(P_UP, P_NAT, P_DN)); tg.fd.set(...mix(F_UP, F_NAT, F_DN)); tg.up.set(...mix(U_UP, U_NAT, U_DN));
      tg.curl = [0.3 + 0.1 * down, 0.35 + 0.1 * down, 0.4 + 0.1 * down, 0.45 + 0.1 * down, 0.5 + 0.1 * down];
      // walking: subtle opposite arm swing, a little more when the arms hang down
      const amp = 0.03 + 0.04 * down + 0.01 * nat, sw = Math.cos(ctx.bob + a.phase) * amp * st.walk, lift = Math.abs(Math.sin(ctx.bob)) * 0.01 * st.walk;
      tg.w.z += -sw; tg.w.y += lift - 0.008 * st.walk; tg.w.x += s * 0.01 * st.walk; tg.fd.z += -sw * 1.2;
    }
    tg.w.y += Math.sin(t * 1.5 + a.phase) * 0.0022;                // breathing
    tg.w.x += st.lagX * s * 0.0 + st.lagX; tg.w.y += st.lagY;       // hands trail a quick head turn a little
    return tg;
  }
  function overlay(a, tg, dt) {
    const o = a.overlay; a.hand.userData.key.visible = !!(o && o.kind === 'key' && o.useKey); if (!o) return; o.t += dt / o.dur; if (o.t >= 1) { a.overlay = null; a.hand.userData.key.visible = false; return; }
    if (o.kind === 'key') {
      const t = o.t, w = sstep(t / 0.22) * (1 - sstep((t - 0.84) / 0.16)), fd = V().subVectors(o.point, a.shoulder).normalize();
      const ins = sstep((t - 0.22) / 0.12) * (1 - sstep((t - 0.76) / 0.1)) * 0.022, roll = o.turnDir * 1.45 * sstep((t - 0.4) / 0.14) * (1 - sstep((t - 0.62) / 0.14));
      if (!o.fired && t > 0.5) { o.fired = true; o.onTurn(); }
      const reach = o.useKey ? HAND_LEN + 0.045 : 0.1, wr = V().copy(o.point).addScaledVector(fd, -reach + ins);
      const up = V(0.1, 1, 0); up.addScaledVector(fd, -up.dot(fd)).normalize().applyAxisAngle(fd, roll);
      tg.w.lerp(wr, w); tg.fd.lerp(fd, w); tg.up.lerp(up, w);
      const c = o.useKey ? [0.55, 0.75, 0.6, 0.8, 0.85] : [0.5, 0.55, 0.85, 0.9, 0.9];
      tg.curl = tg.curl.map((v, i) => v + (c[i] - v) * w); return;
    }
    const t = o.t, w = sstep(t / 0.32) * (1 - sstep((t - 0.66) / 0.34)), fd = V().subVectors(o.point, a.shoulder).normalize();
    const press = o.kind === 'press' ? sstep((t - 0.28) / 0.1) * (1 - sstep((t - 0.46) / 0.12)) : 0;
    const wr = V().copy(o.point).addScaledVector(fd, o.kind === 'press' ? -HAND_LEN + 0.014 * press : -0.095);
    if (o.kind === 'grab') { const pull = sstep((t - 0.5) / 0.15) * (1 - sstep((t - 0.62) / 0.1)); wr.z += 0.07 * pull; }
    tg.w.lerp(wr, w); tg.fd.lerp(fd, w); tg.up.lerp(V(a.side * 0.2, 1, 0), w);
    const grip = sstep((t - 0.3) / 0.12) * (1 - sstep((t - 0.62) / 0.14));
    const c = o.kind === 'press' ? [0.45, 0.02, 0.85, 0.9, 0.9] : [0.55, 0.12 + 0.75 * grip, 0.12 + 0.78 * grip, 0.12 + 0.8 * grip, 0.15 + 0.8 * grip];
    tg.curl = tg.curl.map((v, i) => v + (c[i] - v) * w);
  }

  return {
    rig,
    /** Reach a hand toward a world point (press = poke a switch / button, grab = take hold of a handle). The nearer-sided hand goes. */
    reach(worldPoint, kind = 'press') {
      const p = rig.worldToLocal(worldPoint.clone()); const a = p.x >= 0 ? arms[1] : arms[0];
      if (a.overlay) return; a.overlay = { point: p, kind, t: 0, dur: kind === 'grab' ? 1.25 : 0.95 };
    },
    /** Right hand takes the key (or pinches the thumb-turn), puts it in the lock, turns it (turnDir +1 = lock, -1 = unlock) and withdraws. onTurn fires at the moment the bolt moves. */
    keyAction(worldPoint, { useKey = true, turnDir = 1, onTurn = () => {} } = {}) {
      const a = arms[1]; if (a.overlay) return false;
      a.overlay = { point: rig.worldToLocal(worldPoint.clone()), kind: 'key', useKey, turnDir, onTurn, fired: false, t: 0, dur: 2.4 }; return true;
    },
    modes: MODES, get mode() { return mode; },
    setMode(m) { if (!MODES.includes(m)) return; mode = m; try { localStorage.setItem('hand-mode', m); } catch { /* no storage */ } },
    get busy() { return arms.some((a) => a.overlay?.kind === 'key'); },
    update(dt, ctx) {
      rig.visible = ctx.visible; if (!ctx.visible) return;
      dt = Math.min(dt, 0.1); st.t += dt;
      const yaw = camera.rotation.y, pitch = camera.rotation.x;
      if (st.lastYaw == null) st.lastYaw = yaw;
      let dy = yaw - st.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.lastYaw = yaw;
      const dp = pitch - st.lastPitch; st.lastPitch = pitch;
      st.lagX += (Math.max(-0.05, Math.min(0.05, dy * 0.12)) - st.lagX) * Math.min(1, dt * 9);
      st.lagY += (Math.max(-0.04, Math.min(0.04, -dp * 0.1)) - st.lagY) * Math.min(1, dt * 9);
      st.aim += ((ctx.aim ? 1 : 0) - st.aim) * Math.min(1, dt * (ctx.aim ? 5 : 2.2));   // auto mode: hands come up when you look at something to use, drift down after
      st.walk += ((ctx.moving ? 1 : 0) * (ctx.running ? 1.4 : 1) - st.walk) * Math.min(1, dt * 6);
      rig.position.copy(camera.position); rig.rotation.set(0, yaw, 0); rig.updateMatrixWorld(true);
      const k = 1 - Math.exp(-dt * 12);
      for (const a of arms) {
        const tg = rest(a, ctx); overlay(a, tg, dt);
        a.wrist.lerp(tg.w, k); a.fd.lerp(tg.fd, k).normalize(); a.up.lerp(tg.up, k);
        for (let i = 0; i < 5; i++) a.curl[i] += (tg.curl[i] - a.curl[i]) * Math.min(1, dt * 14);
        const W = solveArm(a, a.wrist);
        const zA = V().copy(a.fd).normalize(), yA = V().copy(a.up).addScaledVector(zA, -a.up.dot(zA)).normalize(), xA = V().crossVectors(yA, zA);
        a.hand.position.copy(W); a.hand.quaternion.setFromRotationMatrix(m4.makeBasis(xA, yA, zA)); a.hand.userData.apply(a.curl);
      }
    },
  };
}
