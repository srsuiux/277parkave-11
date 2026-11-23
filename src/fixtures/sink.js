import * as THREE from 'three';
import { fixtureMats } from './mats.js';

/**
 * Standard 27" x 22" stainless single-bowl drop-in sink with a traditional chrome centerset faucet
 * (one spout, two clear-acrylic cross handles). Water runs: handles turn, a stream falls into the bowl,
 * splashes, a thin film collects, and it makes sound.
 *
 * Space: run-local (x along the counter, z out from the wall, y up). Origin of the returned group is the
 * centre of the sink on the countertop surface.
 */
export const SINK = {
  rimW: 0.686, rimD: 0.559,   // 27" x 22" outer rim
  bowlW: 0.6, bowlD: 0.47,    // opening of the bowl
  bowlH: 0.2,                 // 8" deep
  cornerR: 0.04,
};

function rr(w, d, r) { // rounded rectangle in the XY plane (x = width, y = depth)
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const rrPath = rr; // a Shape is a Path, so it works directly as a hole
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

function flowTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, 16, 128);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
    x.fillRect(Math.random() * 14, Math.random() * 128, 2 + Math.random() * 3, 4 + Math.random() * 22);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function strainerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#9a9ea2'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#16181a';
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
    x.beginPath(); x.arc(16 + i * 16 + (j % 2) * 8, 16 + j * 16, 3.4, 0, 7); x.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function buildSink(label = 'Stainless sink + chrome faucet') {
  const M = fixtureMats();
  const g = new THREE.Group();
  g.name = 'sink'; g.userData.label = label;
  const S = SINK;
  const add = (parent, m, name, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.name = name; shadowed(m); parent.add(m); return m; };

  // ---- bowl: walls (rounded plan corners, darkening toward the bottom), dished floor, rim flange + bead ----
  const inner = M.sink.clone(); inner.vertexColors = true;
  const shade = (geo, fn) => {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const v = fn(pos.getX(i), pos.getY(i), pos.getZ(i)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };

  const wallGeo = new THREE.ExtrudeGeometry(
    (() => { const s = rr(S.bowlW + 0.008, S.bowlD + 0.008, S.cornerR + 0.004); s.holes.push(rrPath(S.bowlW, S.bowlD, S.cornerR)); return s; })(),
    { depth: S.bowlH, bevelEnabled: false, curveSegments: 10 });
  wallGeo.rotateX(Math.PI / 2); // plan y -> world z, extrusion goes DOWN (y from 0 to -bowlH)
  shade(wallGeo, (x, y) => 0.38 + 0.62 * Math.max(0, 1 + y / S.bowlH) ** 1.4); // ambient-occlusion-like falloff
  add(g, new THREE.Mesh(wallGeo, inner), 'sink-bowl-walls');

  // floor dips toward the drain so you can see the outlet at the bottom
  const drainZ = 0.03, baseY = -S.bowlH + 0.006, dish = 0.016;
  const floorGeo = new THREE.PlaneGeometry(S.bowlW - 0.006, S.bowlD - 0.006, 56, 42);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getZ(i) - drainZ);
      pos.setY(i, baseY - dish * (1 - Math.min(d / 0.27, 1)) ** 2);
    }
    floorGeo.computeVertexNormals();
    shade(floorGeo, (x, y, z) => 0.42 + 0.3 * Math.min(Math.hypot(x, z - drainZ) / 0.3, 1));
  }
  add(g, new THREE.Mesh(floorGeo, inner), 'sink-bowl-floor');

  const flange = new THREE.ExtrudeGeometry(
    (() => { const s = rr(S.rimW, S.rimD, 0.02); s.holes.push(rrPath(S.bowlW - 0.004, S.bowlD - 0.004, S.cornerR)); return s; })(),
    { depth: 0.004, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 10 });
  flange.rotateX(Math.PI / 2);
  add(g, new THREE.Mesh(flange, M.sink), 'sink-rim-flange', 0, 0.006, 0);

  const bead = new THREE.ExtrudeGeometry(
    (() => { const s = rr(S.rimW, S.rimD, 0.02); s.holes.push(rrPath(S.rimW - 0.012, S.rimD - 0.012, 0.016)); return s; })(),
    { depth: 0.003, bevelEnabled: false, curveSegments: 10 });
  bead.rotateX(Math.PI / 2);
  add(g, new THREE.Mesh(bead, M.sink), 'sink-rim-bead', 0, 0.0085, 0);

  // overflow slot high on the back wall
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.011, 0.004), M.black), 'sink-overflow-slot', 0.0, -0.045, -S.bowlD / 2 + 0.004);

  // ---- drain (the water outlet): chrome flange, perforated basket, dark opening, tailpiece + trap below ----
  const drainY = baseY - dish; // lowest point of the dish
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.0065, 10, 40), M.chrome);
  ring.rotation.x = Math.PI / 2; add(g, ring, 'drain-flange-ring', 0, drainY + 0.003, drainZ);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.003, 40), M.chrome), 'drain-flange-plate', 0, drainY + 0.0015, drainZ);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.036, 0.016, 36, 1, true), M.chrome), 'drain-basket-wall', 0, drainY - 0.004, drainZ);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.002, 36), M.black), 'drain-opening', 0, drainY - 0.002, drainZ);
  const basketMat = new THREE.MeshStandardMaterial({ map: strainerTexture(), metalness: 0.9, roughness: 0.4 });
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.034, 0.004, 36), basketMat), 'drain-strainer', 0, drainY - 0.009, drainZ);
  const pipe = (len, name, x, y, z, rotZ = 0, rotX = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, len, 18), M.chrome);
    m.rotation.set(rotX, 0, rotZ); return add(g, m, name, x, y, z);
  };
  pipe(0.22, 'drain-tailpiece', 0, drainY - 0.12, drainZ);
  const trapY = drainY - 0.24;
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.019, 12, 18, Math.PI / 2), M.chrome);
  elbow.rotation.set(0, -Math.PI / 2, Math.PI); add(g, elbow, 'drain-trap-elbow', 0, trapY + 0.04, drainZ - 0.04 + 0.0);
  pipe(0.2, 'drain-trap-arm', 0, trapY, drainZ - 0.14, 0, Math.PI / 2);

  // ---- faucet (on the back rim flange) ----
  const faucet = new THREE.Group(); faucet.name = 'faucet'; faucet.userData.label = 'Chrome faucet';
  const fz = -S.rimD / 2 + 0.032;
  faucet.position.set(0, 0.0125, fz);
  g.add(faucet);

  const deckShape = rr(0.2, 0.048, 0.022);
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), M.chrome);
  deck.rotation.x = -Math.PI / 2; add(faucet, deck, 'faucet-deck-plate', 0, 0, 0);

  add(faucet, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.04, 28), M.chrome), 'faucet-spout-base', 0, 0.034, 0);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.13, 0), new THREE.Vector3(0, 0.185, 0.02),
    new THREE.Vector3(0, 0.205, 0.075), new THREE.Vector3(0, 0.19, 0.13), new THREE.Vector3(0, 0.15, 0.165),
    new THREE.Vector3(0, 0.12, 0.17),
  ]);
  add(faucet, new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0105, 16), M.chrome), 'faucet-spout');
  const tipY = 0.1, tipZ = 0.17;
  add(faucet, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.03, 20), M.chrome), 'faucet-aerator', 0, tipY + 0.02, tipZ);
  add(faucet, new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 20), M.black), 'faucet-aerator-face', 0, tipY + 0.004, tipZ);

  // handles: chrome valve body + clear acrylic cross handle; red = hot (left), blue = cold (right)
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f8, roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.55, clearcoat: 1, ior: 1.49 });
  const handles = {};
  for (const [side, name, hex] of [[-1, 'hot', 0xd23b2f], [1, 'cold', 0x2f6fd2]]) {
    const hg = new THREE.Group(); hg.name = `faucet-handle-${name}`;
    hg.userData.label = `${name === 'hot' ? 'Hot' : 'Cold'} water handle`;
    hg.position.set(side * 0.0508 * 1.6, 0, 0);
    add(hg, new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.026, 24), M.chrome), `${name}-valve-body`, 0, 0.013, 0);
    add(hg, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 14), M.chrome), `${name}-valve-stem`, 0, 0.04, 0);
    const cross = new THREE.Group(); cross.name = `${name}-cross-handle`; hg.add(cross);
    for (let i = 0; i < 2; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.013, 0.014), acrylic);
      arm.rotation.y = (i * Math.PI) / 2; add(cross, arm, `${name}-acrylic-arm-${i + 1}`, 0, 0.062, 0);
    }
    add(cross, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.014, 20), acrylic), `${name}-acrylic-hub`, 0, 0.062, 0);
    add(cross, new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.002, 16), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4 })), `${name}-index-disc`, 0, 0.0705, 0);
    faucet.add(hg);
    handles[name] = { open: false, t: 0, cross };
  }

  // ---- water ----
  const tipWorld = new THREE.Vector3(0, tipY + 0.0, fz + tipZ); // relative to sink group (faucet is offset by y 0.0125)
  const tipTopY = 0.0125 + tipY;
  const floorY = -S.bowlH + 0.006;
  const streamLen = tipTopY - floorY;
  const flow = flowTexture(); flow.repeat.set(1, 3);
  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6f4ff, transparent: true, opacity: 0.0, roughness: 0.05, clearcoat: 1, alphaMap: flow, depthWrite: false,
  });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0056, streamLen, 14, 1, true), streamMat);
  stream.position.set(0, (tipTopY + floorY) / 2, tipWorld.z); stream.name = 'water-stream'; stream.visible = false;
  g.add(stream);

  const filmMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0, roughness: 0.02, clearcoat: 1, depthWrite: false });
  const film = new THREE.Mesh(new THREE.ShapeGeometry(rr(S.bowlW - 0.03, S.bowlD - 0.03, S.cornerR)), filmMat);
  film.rotation.x = -Math.PI / 2; film.position.set(0, floorY + 0.001, 0); film.name = 'water-film'; film.visible = false;
  g.add(film);

  const splashMat = new THREE.MeshStandardMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.75, roughness: 0.1 });
  const drops = [];
  for (let i = 0; i < 18; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 5), splashMat);
    d.visible = false; d.name = 'water-splash-drop'; g.add(d);
    drops.push({ m: d, age: Math.random(), vx: 0, vy: 0, vz: 0 });
  }

  // ---- sound: filtered noise, volume falls off with distance ----
  let audio = null;
  function ensureAudio() {
    if (audio) return audio;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.45;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(bp); bp.connect(hp); hp.connect(gain); gain.connect(ctx.destination); src.start();
    audio = { ctx, gain };
    return audio;
  }

  // ---- interaction ----
  const anyOpen = () => handles.hot.open || handles.cold.open;
  const setAll = (v) => { handles.hot.open = v; handles.cold.open = v; };
  const wake = () => { try { ensureAudio().ctx.resume(); } catch { /* no audio available */ } };
  for (const [name, h] of Object.entries(handles)) {
    const grp = faucet.getObjectByName(`faucet-handle-${name}`);
    grp.userData.interact = {
      prompt: () => `<kbd>E</kbd> turn ${name} water ${h.open ? 'off' : 'on'}`,
      run: () => { wake(); h.open = !h.open; },
    };
  }
  faucet.userData.interact = {
    prompt: () => `<kbd>E</kbd> turn water ${anyOpen() ? 'off' : 'on'}`,
    run: () => { wake(); setAll(!anyOpen()); },
  };

  // ---- per-frame ----
  const world = new THREE.Vector3();
  let time = 0, level = 0;
  g.userData.update = (dt, ctx) => {
    time += dt;
    for (const h of Object.values(handles)) {
      h.t += ((h.open ? 1 : 0) - h.t) * Math.min(1, dt * 8);
      h.cross.rotation.y = h.t * Math.PI * 0.55;
    }
    const target = handles.hot.open && handles.cold.open ? 1 : anyOpen() ? 0.7 : 0;
    level += (target - level) * Math.min(1, dt * 6);
    const on = level > 0.02;
    stream.visible = on; film.visible = on;
    if (on) {
      streamMat.opacity = 0.85 * level;
      const r = 0.55 + 0.45 * level;
      stream.scale.set(r, 1, r);
      flow.offset.y -= dt * 2.2;
      filmMat.opacity = 0.35 * level;
    }
    for (const d of drops) {
      if (!on) { d.m.visible = false; continue; }
      d.age += dt * 1.8;
      if (d.age >= 1) {
        d.age = 0;
        const a = Math.random() * Math.PI * 2, sp = (0.03 + Math.random() * 0.06) * level;
        d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 0.12 + Math.random() * 0.18;
      }
      const t = d.age * 0.45;
      d.m.visible = true;
      d.m.position.set(d.vx * t * 6, floorY + 0.003 + Math.max(0, d.vy * t - 4.9 * t * t), tipWorld.z + d.vz * t * 6);
      d.m.scale.setScalar(1 - d.age * 0.5);
    }
    if (audio) {
      g.getWorldPosition(world);
      const dist = ctx.camera.position.distanceTo(world);
      const vol = (0.22 * level) / (1 + dist * 1.1);
      audio.gain.gain.setTargetAtTime(vol, audio.ctx.currentTime, 0.08);
    }
    void time;
  };
  g.userData.persist = { get: () => [handles.hot.open, handles.cold.open], set: (v) => { handles.hot.open = !!v[0]; handles.cold.open = !!v[1]; for (const h of Object.values(handles)) { h.t = h.open ? 1 : 0; h.cross.rotation.y = h.t * Math.PI * 0.55; } } };
  return g;
}
