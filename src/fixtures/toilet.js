import * as THREE from 'three';
import { std, mk, bx, rb, cyl, finish } from './furniture.js';
import { fixtureMats } from './mats.js';

/**
 * Detailed close-coupled toilet. Origin: floor, centre of the bowl; +z = front, the tank sits at -z against the wall.
 * Interactive: lid (E), seat (E), flush lever (E). Sounds are synthesised (no files) and fall off with distance.
 */
const LID_UP = -1.62, SEAT_UP = -1.5;

function makeSound() {
  let ctx = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } ctx.resume?.(); return ctx; };
  const noise = (c, secs) => { const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
  return {
    thunk(vol, hard = true) {   // lid / seat landing
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const n = noise(c, 0.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = hard ? 700 : 400;
      const g = c.createGain(); g.gain.setValueAtTime(0.9 * vol * (hard ? 1 : 0.5), t); g.gain.exponentialRampToValueAtTime(0.001, t + (hard ? 0.18 : 0.12));
      n.connect(lp); lp.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.3);
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hard ? 170 : 120, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
      const og = c.createGain(); og.gain.setValueAtTime(0.5 * vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(og); og.connect(c.destination); o.start(t); o.stop(t + 0.2);
    },
    click(vol) { const c = ensure(); if (!c) return; const t = c.currentTime, o = c.createOscillator(); o.type = 'square'; o.frequency.value = 900; const g = c.createGain(); g.gain.setValueAtTime(0.06 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.04); },
    flush(vol) {                 // whoosh + swirl + gurgle, ~4 s, then the tank refills (hiss) for ~4 s
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const n = noise(c, 9); n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(350, t); bp.frequency.linearRampToValueAtTime(1500, t + 1.0); bp.frequency.linearRampToValueAtTime(900, t + 2.6); bp.frequency.linearRampToValueAtTime(300, t + 4);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * vol, t + 0.5); g.gain.setValueAtTime(0.28 * vol, t + 2.4); g.gain.linearRampToValueAtTime(0.06 * vol, t + 3.4); g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
      n.connect(bp); bp.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 4.4);
      // gurgle at the end
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70; const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency);
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t + 3.0); og.gain.linearRampToValueAtTime(0.05 * vol, t + 3.5); og.gain.linearRampToValueAtTime(0.0001, t + 4.4);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; o.connect(lp); lp.connect(og); og.connect(c.destination); o.start(t + 3); lfo.start(t + 3); o.stop(t + 4.5); lfo.stop(t + 4.5);
      // refill hiss
      const r = noise(c, 6), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; const rg = c.createGain();
      rg.gain.setValueAtTime(0.0001, t + 3.8); rg.gain.linearRampToValueAtTime(0.07 * vol, t + 4.4); rg.gain.setValueAtTime(0.07 * vol, t + 7); rg.gain.linearRampToValueAtTime(0.0001, t + 8.2);
      r.connect(hp); hp.connect(rg); rg.connect(c.destination); r.start(t + 3.8); r.stop(t + 8.3);
    },
  };
}

export function buildToilet() {
  const M = fixtureMats();
  const g = new THREE.Group();
  const por = new THREE.MeshPhysicalMaterial({ color: 0xf5f4ef, roughness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0xf1f0ea, roughness: 0.28, clearcoat: 0.3 });
  const grey = std(0x8a8f93, 0.4, 0.6);

  // ---- pedestal / trap base ----
  const base = mk(g, new THREE.LatheGeometry([[0.001, 0], [0.095, 0.0], [0.11, 0.02], [0.115, 0.1], [0.13, 0.19], [0.001, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 32), por, 'toilet-base', 0, 0, 0.03); base.scale.z = 1.5;
  // ---- bowl shell: outer wall up to the rim, then down the inside to the sump ----
  const prof = [[0.12, 0.17], [0.15, 0.22], [0.172, 0.29], [0.186, 0.35], [0.19, 0.405], [0.188, 0.425], [0.168, 0.428], [0.16, 0.40], [0.145, 0.35], [0.115, 0.31], [0.07, 0.285], [0.001, 0.28]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = mk(g, new THREE.LatheGeometry(prof, 40), por, 'toilet-bowl', 0, 0, 0.07); bowl.scale.z = 1.36;
  const rim = mk(g, new THREE.TorusGeometry(0.178, 0.011, 10, 48), por, 'toilet-rim', 0, 0.427, 0.07, [Math.PI / 2, 0, 0]); rim.scale.set(1, 1.36, 1);
  rb(g, 0.3, 0.2, 0.22, 0.05, por, 'toilet-back-block', 0, 0.3, -0.17);   // joins bowl to tank
  // water in the sump
  const water = mk(g, new THREE.CircleGeometry(0.1, 28), new THREE.MeshPhysicalMaterial({ color: 0x9ab8c4, roughness: 0.03, transparent: true, opacity: 0.75, clearcoat: 1 }), 'bowl-water', 0, 0.322, 0.075, [-Math.PI / 2, 0, 0]); water.scale.set(1, 1.35, 1);
  const swirlMat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const swirl = new THREE.Group(); swirl.position.set(0, 0.323, 0.075); g.add(swirl);
  for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.RingGeometry(0.05 + i * 0.03, 0.057 + i * 0.03, 24, 1, i * 2, 1.6), swirlMat); a.rotation.x = -Math.PI / 2; a.scale.y = 1.35; swirl.add(a); }

  // ---- tank, lid, flush lever ----
  rb(g, 0.4, 0.34, 0.17, 0.03, por, 'toilet-tank', 0, 0.6, -0.275);
  rb(g, 0.43, 0.03, 0.2, 0.014, por, 'toilet-tank-lid', 0, 0.785, -0.275);
  const lever = new THREE.Group(); lever.name = 'flush-lever'; lever.userData.label = 'Flush lever'; lever.position.set(-0.14, 0.7, -0.185); g.add(lever);
  cyl(lever, 0.026, 0.026, 0.012, M.chrome, 'lever-plate', 0, 0, 0.004, [Math.PI / 2, 0, 0], 20);
  const arm = new THREE.Group(); arm.name = 'lever-arm'; lever.add(arm);
  cyl(arm, 0.007, 0.007, 0.075, M.chrome, 'lever-rod', 0.03, 0, 0.022, [0, 0, Math.PI / 2], 10);
  mk(arm, new THREE.SphereGeometry(0.011, 10, 8), M.chrome, 'lever-knob', 0.07, 0, 0.022);
  mk(lever, new THREE.BoxGeometry(0.16, 0.12, 0.08), new THREE.MeshBasicMaterial({ visible: false }), 'lever-hit', 0.02, 0, 0.03).visible = false;
  // supply: chrome angle-stop and braided line from the wall to the tank
  cyl(g, 0.011, 0.011, 0.22, M.chrome, 'supply-pipe', 0.12, 0.2, -0.345, null, 10);
  bx(g, 0.04, 0.03, 0.03, M.chrome, 'angle-stop', 0.12, 0.095, -0.335);
  cyl(g, 0.014, 0.014, 0.025, grey, 'stop-wheel', 0.12, 0.095, -0.31, [Math.PI / 2, 0, 0], 12);
  // closet-bolt caps and a bead of caulk at the floor
  for (const s of [-1, 1]) mk(g, new THREE.SphereGeometry(0.02, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plastic, 'bolt-cap', s * 0.115, 0.012, 0.04).scale.y = 0.8;
  const caulk = mk(g, new THREE.TorusGeometry(0.115, 0.004, 6, 40), std(0xe8e6e0, 0.7), 'floor-caulk', 0, 0.003, 0.03, [Math.PI / 2, 0, 0]); caulk.scale.set(1, 1.5, 1);

  // ---- seat + lid, hinged at the back ----
  const HZ = -0.19, ring = (rx, ry, hx, hy, depth) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false); if (hx) { const h = new THREE.Path(); h.absellipse(0, 0, hx, hy, 0, Math.PI * 2, true); s.holes.push(h); } const gm = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 36 }); gm.rotateX(Math.PI / 2); gm.translate(0, 0, 0.26); return gm; };
  const seat = new THREE.Group(); seat.name = 'toilet-seat'; seat.userData.label = 'Toilet seat'; seat.position.set(0, 0.455, HZ); g.add(seat);
  mk(seat, ring(0.185, 0.25, 0.122, 0.182, 0.026), plastic, 'seat-ring', 0, 0, 0);
  for (const s of [-1, 1]) { cyl(seat, 0.014, 0.014, 0.012, std(0x6b6e70, 0.8), 'seat-hinge-post', s * 0.11, 0.0, -0.005, null, 10); cyl(seat, 0.01, 0.01, 0.01, std(0x2b2b2b, 0.9), 'seat-bumper', s * 0.1, -0.03, 0.46, null, 8); }
  const lid = new THREE.Group(); lid.name = 'toilet-lid'; lid.userData.label = 'Toilet lid'; lid.position.set(0, 0.488, HZ); g.add(lid);
  mk(lid, ring(0.19, 0.255, 0, 0, 0.018), plastic, 'lid-panel', 0, 0, 0);
  bx(lid, 0.05, 0.01, 0.012, grey, 'lid-hinge-left', -0.11, 0, 0.0); bx(lid, 0.05, 0.01, 0.012, grey, 'lid-hinge-right', 0.11, 0, 0.0);

  // ---- state + interaction ----
  let lidUp = false, seatUp = false, lidA = 0, seatA = 0, lidSettle = 0, seatSettle = 0, flushT = -1, vol = 1;
  const snd = makeSound(), camPos = new THREE.Vector3(), me = new THREE.Vector3();
  const volAt = () => { g.getWorldPosition(me); return Math.min(1, 1.6 / (1 + me.distanceTo(camPos) * 0.9)); };
  lid.userData.interact = {
    prompt: () => `<kbd>E</kbd> ${lidUp ? 'close' : 'open'} the lid`,
    run: () => { lidUp = !lidUp; if (!lidUp && seatUp) { seatUp = false; } snd.click(volAt()); },
  };
  seat.userData.interact = {
    prompt: () => lidUp ? `<kbd>E</kbd> ${seatUp ? 'lower' : 'raise'} the seat` : '<kbd>E</kbd> open the lid first',
    run: () => { if (!lidUp) { lidUp = true; snd.click(volAt()); return; } seatUp = !seatUp; snd.click(volAt()); },
  };
  lever.userData.interact = {
    prompt: () => flushT >= 0 ? 'flushing…' : '<kbd>E</kbd> flush',
    run: () => { if (flushT >= 0) return; flushT = 0; snd.flush(volAt()); },
  };
  g.userData.flushing = () => flushT >= 0;   // read by the dashboard
  g.userData.persist = { get: () => [lidUp, seatUp], set: (v) => { lidUp = !!v[0]; seatUp = !!v[1]; lidA = lidUp ? LID_UP : 0; seatA = seatUp ? SEAT_UP : 0; lid.rotation.x = lidA; seat.rotation.x = seatA; } };
  g.userData.update = (dt, ctx) => {
    camPos.copy(ctx.camera.position); vol = volAt();
    // lid / seat swing with a little weight: fast at first, soft landing, thunk when it lands
    const tl = lidUp ? LID_UP : 0, ts = seatUp ? SEAT_UP : 0;
    const k = Math.min(1, dt * 7);
    if (Math.abs(tl - lidA) > 0.01) { lidA += (tl - lidA) * k; lidSettle = 1; } else if (lidSettle) { lidA = tl; lidSettle = 0; if (!lidUp) snd.thunk(vol, true); else snd.thunk(vol, false); }
    if (Math.abs(ts - seatA) > 0.01) { seatA += (ts - seatA) * k; seatSettle = 1; } else if (seatSettle) { seatA = ts; seatSettle = 0; snd.thunk(vol, !seatUp); }
    lid.rotation.x = lidA; seat.rotation.x = seatA;
    // flush: lever presses, bowl water swirls down and refills
    if (flushT >= 0) {
      flushT += dt;
      lever.rotation.z = flushT < 0.6 ? -0.5 * Math.min(1, flushT / 0.15) : -0.5 * Math.max(0, 1 - (flushT - 0.6) / 0.25);
      const drain = flushT < 3.4 ? Math.min(1, flushT / 1.2) : Math.max(0, 1 - (flushT - 3.4) / 3.6);
      water.position.y = 0.322 - 0.03 * drain; swirlMat.opacity = flushT < 3.6 ? 0.5 * Math.min(1, flushT / 0.5) : Math.max(0, 0.5 * (1 - (flushT - 3.6) / 0.6));
      swirl.rotation.y += dt * (flushT < 3.6 ? 6 : 0); swirl.position.y = water.position.y + 0.002;
      if (flushT > 7.2) { flushT = -1; water.position.y = 0.322; lever.rotation.z = 0; }
    }
  };
  return finish(g, 'toilet', 'Toilet (lid, seat and flush all work)', 0.42, 0.82, 0.72);
}
