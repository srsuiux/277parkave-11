/**
 * Virtual security cameras: each is an independent THREE.PerspectiveCamera with its own position and direction. Feeds are rendered
 * with the main renderer into a small render target (tone-mapped like the main view), then copied into the dashboard's <canvas>
 * elements. This only runs while the dashboard is open, one feed per frame (round robin), and never touches the first-person camera.
 *
 * These are SIMULATED feeds of the 3D model. A real hardware camera would be a different `source.kind` ('stream') that the UI
 * shows in a <video> element instead; the feed object already carries `kind` so the UI can label and route each correctly.
 */
import * as THREE from 'three';

const CAMS = [
  { id: 'cam_bedroom', name: 'Bedroom Camera', room: 'Bedroom', pos: [3.05, 2.25, 4.2], look: [-0.2, 0.7, 6.6], fov: 68 },
  { id: 'cam_kitchen', name: 'Kitchen Camera', room: 'Kitchen', pos: [2.9, 2.25, 0.25], look: [0.6, 0.8, 3.0], fov: 70 },
  { id: 'cam_entrance', name: 'Main Entrance Camera', room: 'Hallway', pos: [0.9, 2.2, -4.35], look: [1.0, 1.1, -0.2], fov: 62 },
  { id: 'cam_bath', name: 'Bathroom Camera', room: 'Bathroom', pos: [-0.25, 2.25, 0.2], look: [-1.3, 0.8, 3.0], fov: 74, defaultActive: false },
];

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const FS = `
precision highp float; varying vec2 vUv; uniform sampler2D tMap; uniform float exposure;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 color){
  const mat3 ACESIn = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOut = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6; color = ACESIn * color; color = RRTAndODTFit(color); color = ACESOut * color; return clamp(color, 0., 1.);
}
void main(){ vec3 c = aces(texture2D(tMap, vUv).rgb); c = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c)); gl_FragColor = vec4(c, 1.); }`;

export function initCameras({ scene, renderer, mainCamera }) {
  const feeds = CAMS.map((c) => {
    const cam = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.05, 60);
    cam.position.set(...c.pos); cam.lookAt(new THREE.Vector3(...c.look)); cam.updateMatrixWorld();
    let active = true; try { const s = localStorage.getItem('cam-active:' + c.id); active = s === null ? c.defaultActive !== false : s === '1'; } catch { /* no storage */ }
    return { ...c, kind: 'simulated', cam, active, lastDraw: 0, canvases: new Set() };
  });

  // visible camera bodies so you can see where each one is installed
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ec, roughness: 0.5 }), lensMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.2, metalness: 0.6 });
  for (const f of feeds) {
    const g = new THREE.Group(); g.name = 'camera-' + f.id; g.userData.label = f.name;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.11), bodyMat), lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 14), lensMat);
    lens.rotation.x = Math.PI / 2; lens.position.z = -0.065; g.add(body, lens);
    g.position.copy(f.cam.position); g.quaternion.copy(f.cam.quaternion); g.position.add(new THREE.Vector3(0, 0, 0.08).applyQuaternion(f.cam.quaternion));
    scene.add(g);
  }

  const W = 480, H = 270, BIG_W = 960, BIG_H = 540;
  const rts = { small: mk(W, H), big: mk(BIG_W, BIG_H) }; const outs = { small: mk(W, H, true), big: mk(BIG_W, BIG_H, true) };
  function mk(w, h, ldr) { return new THREE.WebGLRenderTarget(w, h, { type: ldr ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: ldr ? 0 : 2 }); }
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { tMap: { value: null }, exposure: { value: renderer.toneMappingExposure } }, depthTest: false, depthWrite: false });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const bufs = { small: new Uint8Array(W * H * 4), big: new Uint8Array(BIG_W * BIG_H * 4) };
  const imgs = {};

  function draw(f, canvas, size) {
    const w = size === 'big' ? BIG_W : W, h = size === 'big' ? BIG_H : H;
    const prevRT = renderer.getRenderTarget(), prevMask = mainCamera.layers.mask;
    const shadowAuto = renderer.shadowMap.autoUpdate;
    renderer.setRenderTarget(rts[size]); renderer.clear(); renderer.render(scene, f.cam);
    mat.uniforms.tMap.value = rts[size].texture; mat.uniforms.exposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(outs[size]); renderer.render(quadScene, quadCam);
    renderer.readRenderTargetPixels(outs[size], 0, 0, w, h, bufs[size]);
    renderer.setRenderTarget(prevRT); renderer.shadowMap.autoUpdate = shadowAuto; mainCamera.layers.mask = prevMask;
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    const key = size; let img = imgs[key]; if (!img) img = imgs[key] = new ImageData(w, h);
    // render targets are bottom-up: flip while copying
    const row = w * 4, src = bufs[size], dst = img.data;
    for (let y = 0; y < h; y++) dst.set(src.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    canvas.getContext('2d').putImageData(img, 0, 0);
  }

  let rr = 0;
  return {
    feeds,
    setActive(id, v) { const f = feeds.find((x) => x.id === id); if (!f) return; f.active = v; try { localStorage.setItem('cam-active:' + f.id, v ? '1' : '0'); } catch { /* ignore */ } },
    /** Call once per frame with the canvases currently on screen: [{feed, canvas, size}] */
    tick(visible) {
      const live = visible.filter((v) => v.feed.active);
      if (!live.length) return;
      const big = live.find((v) => v.size === 'big');
      const v = big && rr % 2 === 0 ? big : live[rr % live.length]; rr++;
      draw(v.feed, v.canvas, v.size);
    },
  };
}
