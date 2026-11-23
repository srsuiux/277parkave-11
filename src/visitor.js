import * as THREE from 'three';
import { rBox } from './rbox.js';
import { PLAYER } from './config.js';
import { AVATAR } from './avatar.js';

/**
 * The visitor: a fit 5'10" (1.78 m) man from Nepal, slim waist, broad shoulders. Feet are always on the floor (y = 0).
 * First person only: you see your own shoes and legs here and your torso, sleeves and hands from fpbody.js; this body
 * (upper half hidden from your eyes) is what mirrors reflect. The third-person view was removed.
 */
export const visitor = { upper: null, third: false };

const std = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

export function buildVisitor() {
  const eye = PLAYER.eye;
  const group = new THREE.Group(); group.name = 'visitor';
  const jeans = std(0x2c3445, 0.85), shoe = std(0x1b1b1d, 0.55), sole = std(0xe9e6df, 0.6), skin = std(AVATAR.skin, 0.65), hoodie = std(AVATAR.shirt, 0.9), hair = std(0x111111, 0.9);
  const cast = (m) => { m.castShadow = true; return m; };
  const part = (parent, geo, mat, x, y, z) => { const m = cast(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); parent.add(m); return m; };

  // legs: hip pivot -> thigh -> knee pivot -> shin -> foot (the knee lets us sit)
  const HIP = 0.92, THIGH = 0.46, SHIN = 0.46, legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.085, HIP, 0.03); group.add(leg);
    part(leg, new THREE.CylinderGeometry(0.068, 0.052, THIGH, 14), jeans, 0, -THIGH / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -THIGH; leg.add(knee);
    part(knee, new THREE.CylinderGeometry(0.052, 0.04, SHIN - 0.06, 14), jeans, 0, -(SHIN - 0.06) / 2, 0);
    const foot = new THREE.Group(); foot.position.set(0, -SHIN, 0); knee.add(foot);
    part(foot, rBox(0.095, 0.085, 0.28, 0.03), shoe, 0, 0.055, -0.05);
    part(foot, rBox(0.102, 0.03, 0.29, 0.012), sole, 0, 0.015, -0.05);
    legs.push({ leg, knee, s });
  }

  // upper body (hidden in first person): V-shaped torso, shoulders broader than the waist
  const upper = new THREE.Group(); upper.name = 'visitor-upper'; upper.visible = false; group.add(upper);
  const torso = new THREE.Group(); upper.add(torso);
  part(torso, rBox(0.32, 0.27, 0.18, 0.07), hoodie, 0, 1.33, 0.03);       // chest + shoulders
  part(torso, rBox(0.26, 0.26, 0.16, 0.06), hoodie, 0, 1.1, 0.03);       // waist
  part(torso, rBox(0.27, 0.12, 0.17, 0.05), jeans, 0, 0.97, 0.03);       // hips
  part(torso, new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), skin, 0, 1.5, 0.03);
  const head = part(torso, new THREE.SphereGeometry(0.1, 20, 16), skin, 0, eye, 0.03); head.scale.set(0.93, 1.12, 1.0);
  part(torso, new THREE.SphereGeometry(0.103, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, eye + 0.015, 0.025).scale.set(0.97, 1.1, 1.02);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.2, 1.42, 0.03); torso.add(arm);
    part(arm, new THREE.CylinderGeometry(0.043, 0.036, 0.27, 12), hoodie, 0, -0.135, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.27; arm.add(elbow);
    part(elbow, new THREE.CylinderGeometry(0.036, 0.03, 0.24, 12), hoodie, 0, -0.12, 0);
    part(elbow, new THREE.SphereGeometry(0.034, 10, 8), skin, 0, -0.26, 0);
    arms.push({ arm, elbow, s });
  }
  torso.children.forEach((c) => { c.position.y -= HIP; }); torso.position.y = HIP;   // the torso pivots at the hips, so leaning forward looks right
  visitor.upper = upper;

  const st = { swing: 0, yaw: 0, y: 0, sit: 0, wash: 0 };
  const lerp = (a, b, k) => a + (b - a) * k;
  const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
  return {
    group,
    /**
     * pose: null (walking / standing) or { kind: 'sit' | 'toilet' | 'shower', x, y, z, yaw } - y = hip height of the seat surface.
     * third: draw the whole body. facing: yaw the body should turn to (third-person walking).
     */
    update(dt, player, camera, moving, visible, { pose = null, third = false, facing = null } = {}) {
      group.visible = visible; visitor.third = third;
      upper.visible = third;
      const k = Math.min(1, dt * 10);
      st.sit = lerp(st.sit, pose && pose.kind !== 'shower' ? 1 : 0, Math.min(1, dt * 7));
      st.wash = lerp(st.wash, pose?.kind === 'shower' ? 1 : 0, Math.min(1, dt * 6));
      const px = pose ? pose.x : player.x, pz = pose ? pose.z : player.z;
      group.position.set(px, pose && pose.kind !== 'shower' ? (pose.y - 0.92 + 0.05) * st.sit : 0, pz);
      const wantYaw = pose ? pose.yaw : third && facing != null ? facing : camera.rotation.y;
      st.yaw = third || pose ? angLerp(st.yaw, wantYaw, Math.min(1, dt * 12)) : camera.rotation.y;
      group.rotation.y = st.yaw;
      st.swing += ((moving && !pose ? Math.sin(player.bob) * 0.55 : 0) - st.swing) * Math.min(1, dt * 14);
      const t = performance.now() / 1000;
      for (const { leg, knee, s } of legs) {
        leg.rotation.x = st.swing * s * (1 - st.sit) + st.sit * Math.PI / 2;
        knee.rotation.x = st.sit * -Math.PI / 2 + (moving && !pose ? Math.max(0, -st.swing * s) * 0.6 : 0);
        leg.rotation.z = st.sit * s * -0.06;
      }
      const toilet = pose?.kind === 'toilet', lean = toilet ? -0.32 : pose?.kind === 'sit' ? -0.06 : 0;
      torso.rotation.x = lerp(torso.rotation.x, lean, k);
      for (const { arm, elbow, s } of arms) {
        let ax = -st.swing * s * 0.8, ex = 0.08, az = s * 0.05;
        if (pose?.kind === 'sit') { ax = 0.75; ex = 0.9; az = s * 0.12; }                           // hands resting on the lap
        if (toilet) { ax = 0.9; ex = 0.5; az = s * 0.14; }                                          // elbows on knees
        if (st.wash > 0.01) { ax = lerp(ax, 2.6 + Math.sin(t * 5 + s) * 0.35, st.wash); ex = lerp(ex, 1.9 + Math.sin(t * 5 + s * 2) * 0.3, st.wash); az = lerp(az, s * 0.35, st.wash); }   // scrubbing hair
        arm.rotation.x = lerp(arm.rotation.x, ax, k); arm.rotation.z = lerp(arm.rotation.z, az, k); elbow.rotation.x = lerp(elbow.rotation.x, ex, k);
      }
    },
  };
}
