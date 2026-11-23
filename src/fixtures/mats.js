import * as THREE from 'three';

let cache;
let envTex = null;
/** Give the metal materials a reflection environment (called by main before building). */
export function setFixtureEnv(tex) { envTex = tex; }

function brushedMaps() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#707070'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 80 + Math.random() * 120;
    x.strokeStyle = `rgba(${v},${v},${v},0.5)`; x.lineWidth = 0.6 + Math.random();
    const y = Math.random() * 512, x0 = Math.random() * 512, l = 40 + Math.random() * 220;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + l, y + (Math.random() - 0.5) * 2); x.stroke();
  }
  // faint water marks / residue
  for (let i = 0; i < 24; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    x.save(); x.translate(Math.random() * 512, Math.random() * 512); x.scale(6 + Math.random() * 22, 6 + Math.random() * 22);
    g.addColorStop(0, 'rgba(210,210,210,0.35)'); g.addColorStop(1, 'rgba(210,210,210,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 8;
  return t;
}
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }

function graniteTexture() {
  const [c, x] = canvas(512);
  x.fillStyle = '#58493d'; x.fillRect(0, 0, 512, 512);
  const dots = [['#161413', 3400, 1.7], ['#a8957c', 2000, 1.8], ['#3a2c22', 2600, 2.4], ['#7d6a56', 1800, 2], ['#c9bba4', 600, 1.4], ['#6b6f72', 900, 1.5]];
  for (const [col, n, r] of dots) {
    x.fillStyle = col;
    for (let i = 0; i < n; i++) { x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, Math.random() * r + 0.5, 0, 7); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / 0.5, 1 / 0.5);
  return t;
}

function fibreTexture() {
  const [c, x] = canvas(256);
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + Math.random() * 130;
    x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 1 + Math.random();
    const px = Math.random() * 256, py = Math.random() * 256, a = Math.random() * 6.28, l = 2 + Math.random() * 4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function fixtureMats() {
  if (cache) return cache;
  const brushed = brushedMaps();
  cache = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07, envMap: envTex, envMapIntensity: 1.8 }),
    sink: new THREE.MeshStandardMaterial({ color: 0xa9adb1, metalness: 1, roughness: 0.5, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.4, envMap: envTex, envMapIntensity: 0.75, side: THREE.DoubleSide }),
    cabinet: new THREE.MeshStandardMaterial({ color: 0x8b939b, roughness: 0.55 }),
    cabinetDark: new THREE.MeshStandardMaterial({ color: 0x777f87, roughness: 0.6 }),
    kick: new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.7 }),
    granite: new THREE.MeshStandardMaterial({ map: graniteTexture(), roughness: 0.3, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c7ca, roughness: 0.3, metalness: 0.9 }),
    brushed: new THREE.MeshStandardMaterial({ color: 0xb5b8bb, roughness: 0.45, metalness: 0.85 }),
    enamel: new THREE.MeshStandardMaterial({ color: 0xf1efe7, roughness: 0.35, metalness: 0.05 }),
    enamelDim: new THREE.MeshStandardMaterial({ color: 0xe0ddd2, roughness: 0.5 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xe9e3cf, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.5, metalness: 0.3 }),
    coil: new THREE.MeshStandardMaterial({ color: 0x2c2a29, roughness: 0.6, metalness: 0.5 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.2 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfaf6ea, roughness: 0.3, emissive: 0x403828 }),
    rug: new THREE.MeshPhysicalMaterial({
      color: 0x908d88, roughness: 1, bumpMap: fibreTexture(), bumpScale: 4,
      sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xe9e7e1),
    }),
  };
  return cache;
}
