import * as THREE from 'three';
import { rBox } from './rbox.js';

/**
 * A phone held in first person, scrolling a short-video feed (made-up reels, drawn live on a canvas).
 * scroll(+1 / -1) swipes to the next / previous video; it also auto-advances every few seconds.
 */
const REELS = [
  { user: 'chai.and.chill', cap: 'Sunday morning in Kathmandu ☕', a: '#ff9a56', b: '#ff3d77', likes: '12.4K' },
  { user: 'trail.nomad', cap: 'Sunrise above the clouds ⛰️', a: '#4b6cb7', b: '#182848', likes: '88.1K' },
  { user: 'street.eats.daily', cap: 'Momo like you have never seen', a: '#f7971e', b: '#8e2de2', likes: '5,302' },
  { user: 'cat.chaos', cap: 'He knew exactly what he did 😹', a: '#11998e', b: '#38ef7d', likes: '240K' },
  { user: 'lofi.late.night', cap: 'rainy window · study beats', a: '#0f2027', b: '#2c5364', likes: '31.7K' },
  { user: 'tiny.apartment.tour', cap: 'Making a small place feel big', a: '#ee0979', b: '#ff6a00', likes: '9,884' },
];

export function buildPhone() {
  const group = new THREE.Group(); group.name = 'phone'; group.visible = false;
  const W = 256, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(rBox(0.077, 0.16, 0.009, 0.006), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.6 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.152), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.z = 0.0051; group.add(body, screen);
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98560, roughness: 0.65 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), skin); h.position.set(s * 0.046, -0.04, -0.01); h.rotation.z = s * 0.25; group.add(h); }   // thumbs / fingers holding the phone
  group.children.forEach((c) => { c.renderOrder = 5; });

  let idx = 0, from = 0, slide = 1, auto = 0, raise = 0, t = 0;
  const wrap = (i) => (i + REELS.length * 10) % REELS.length;

  function drawReel(i, oy) {
    const r = REELS[wrap(i)];
    g.save(); g.translate(0, oy);
    const gr = g.createLinearGradient(0, 0, W * 0.4, H); gr.addColorStop(0, r.a); gr.addColorStop(1, r.b); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {   // drifting bokeh so it reads as moving video
      const x = (Math.sin(t * 0.6 + k * 1.7 + i) * 0.5 + 0.5) * W, y = (Math.cos(t * 0.45 + k * 2.3) * 0.5 + 0.5) * H * 0.8 + 40, rad = 18 + (k % 4) * 14;
      g.fillStyle = `rgba(255,255,255,${0.05 + (k % 3) * 0.04})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(W / 2 - 20 + Math.sin(t * 1.1 + i) * 14, 250, 46, 78, 0, 0, 7); g.fill();   // "subject"
    const sh = g.createLinearGradient(0, H * 0.6, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = sh; g.fillRect(0, H * 0.6, W, H * 0.4);
    // right-hand buttons
    g.fillStyle = '#fff'; g.font = '26px sans-serif'; g.textAlign = 'center';
    g.fillText('♥', W - 28, 330); g.font = '12px sans-serif'; g.fillText(r.likes, W - 28, 348);
    g.font = '24px sans-serif'; g.fillText('💬', W - 28, 392); g.fillText('➤', W - 28, 438);
    // caption
    g.textAlign = 'left'; g.font = 'bold 14px sans-serif'; g.beginPath(); g.arc(24, H - 82, 12, 0, 7); g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#fff'; g.fillText('@' + r.user, 44, H - 77);
    g.font = '13px sans-serif'; g.fillText(r.cap, 14, H - 48);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(14, H - 22, W - 28, 3); g.fillStyle = '#fff'; g.fillRect(14, H - 22, (W - 28) * (((t - from) / 8) % 1), 3);
    g.restore();
  }
  function redraw() {
    g.clearRect(0, 0, W, H);
    const e = 1 - (1 - Math.min(1, slide)) ** 3;   // ease-out slide
    if (slide < 1) drawReel(idx - dirN, -e * H * dirN);          // the old video slides out
    drawReel(idx, slide < 1 ? (1 - e) * H * dirN : 0);           // the new one slides in
    g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'left'; g.fillText('Reels', 14, 28);   // header
    g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText('12:08', W - 12, 26);
    tex.needsUpdate = true;
  }
  let dirN = 1;
  return {
    group,
    scroll(d) { if (slide < 0.6) return; dirN = d >= 0 ? 1 : -1; idx = wrap(idx + dirN); slide = 0; from = t; auto = 0; },
    show(v) { group.visible = v; if (!v) raise = 0; },
    /** Keep the phone in the hand: in front of the camera, rising from below when the activity starts. */
    place(camera, dt) {
      if (!group.visible) return;
      t += dt; auto += dt; raise = Math.min(1, raise + dt / 0.9);
      if (slide < 1) slide = Math.min(1, slide + dt / 0.35);
      if (auto > 8) this.scroll(1);
      const e = 1 - (1 - raise) ** 3;
      const off = new THREE.Vector3(0.015, -0.34 + 0.17 * e, -0.34).applyQuaternion(camera.quaternion);
      group.position.copy(camera.position).add(off); group.quaternion.copy(camera.quaternion);
      group.rotateX(-0.32 + (1 - e) * -0.5);   // tilted back towards the face
      redraw();
    },
  };
}
