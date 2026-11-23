import * as THREE from 'three';
import { rBox } from './rbox.js';

function canvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(ctx, size, base, amp, grain = 1) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = base + (Math.random() - 0.5) * amp;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (grain > 1) { ctx.filter = `blur(${grain}px)`; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none'; }
}

/** Textures tile every TILE metres (see scaleBoxUV). */
export const TILE = 1.0;

function stuccoBump() {
  const [c, ctx] = canvas(512);
  noiseFill(ctx, 512, 128, 140, 1.6);
  // trowel swirls
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = Math.random() > 0.5 ? '#fff' : '#000';
    ctx.lineWidth = 2 + Math.random() * 6;
    ctx.beginPath();
    const x = Math.random() * 512, y = Math.random() * 512;
    ctx.arc(x, y, 6 + Math.random() * 26, Math.random() * 6, Math.random() * 6 + 2);
    ctx.stroke();
  }
  return tex(c, false);
}

function plainColor(hex, jitter = 10) {
  const [c, ctx] = canvas(256);
  const col = new THREE.Color(hex);
  ctx.fillStyle = `#${col.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * jitter;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c); t.userData.baseHex = hex; return t;
}

function floorPlanks() {
  const [c, ctx] = canvas(1024);
  const planks = 8; // 8 planks across 1 m  -> 12.5 cm boards
  const pw = 1024 / planks;
  for (let i = 0; i < planks; i++) {
    const l = 16 + Math.random() * 8;
    ctx.fillStyle = `hsl(${20 + Math.random() * 6}, 45%, ${l}%)`;
    ctx.fillRect(i * pw, 0, pw, 1024);
    // grain
    for (let g = 0; g < 70; g++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      const x = i * pw + Math.random() * pw;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 6, 300, x - 6, 700, x + 2, 1024); ctx.stroke();
    }
    // butt joint
    const j = Math.random() * 1024;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(i * pw, j, pw, 2);
    // seam
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(i * pw, 0, 2, 1024);
  }
  return tex(c);
}

export function makeMaterials() {
  const stucco = stuccoBump();
  const m = {
    kitchenWall: new THREE.MeshStandardMaterial({ map: plainColor(0xd9d8c9, 8), bumpMap: stucco, bumpScale: 2.2, roughness: 0.95 }),
    ceiling:     new THREE.MeshStandardMaterial({ map: plainColor(0xd2d0c0, 14), bumpMap: stucco, bumpScale: 4.5, roughness: 1 }),
    hallWall:    new THREE.MeshStandardMaterial({ map: plainColor(0xc9a874, 10), bumpMap: stucco, bumpScale: 1.2, roughness: 0.95 }),
    hallCeiling: new THREE.MeshStandardMaterial({ map: plainColor(0xb99d6c, 14), bumpMap: stucco, bumpScale: 4, roughness: 1 }),
    floor:       new THREE.MeshStandardMaterial({ map: floorPlanks(), roughness: 0.55, metalness: 0 }),
    trim:        new THREE.MeshStandardMaterial({ color: 0xeeece4, roughness: 0.5 }),
    brass:       new THREE.MeshStandardMaterial({ color: 0x8a6a2f, roughness: 0.35, metalness: 0.8 }),
    glass:       new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.05, transparent: true, opacity: 0.25 }),
    outside:     new THREE.MeshBasicMaterial({ color: 0xeaf3ff }),
    railing:     new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.6 }),
  };
  return m;
}

/** Rescale a BoxGeometry's UVs so textures keep a constant world-space size. */
export function scaleBoxUV(geo, w, h, d, tile = TILE) {
  const uv = geo.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z ; the same number of verts per face (4 for a plain box, more when rounded)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]], per = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < per; v++) {
      const i = f * per + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function box(w, h, d, material, { tile = TILE, cast = true, receive = true, round = 0 } = {}) {
  const g = scaleBoxUV(round > 0 ? rBox(w, h, d, round) : new THREE.BoxGeometry(w, h, d), w, h, d, tile);
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}
