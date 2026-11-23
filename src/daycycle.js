import * as THREE from 'three';

/**
 * Dynamic day / night cycle.
 *  - `env` is the single source of truth (hour, sun + moon direction, daylight / warmth / lamp factors, sky colours).
 *  - One shadow-casting DirectionalLight is the sun by day and the moon by night. The apartment's walls, ceilings and window
 *    frames cast real shadows, so light only enters through the windows (and doors left open) and the patch moves across the floor.
 *  - The bedroom's winter street view (winterscene.js) and the per-room ambient light in main.js read `env`.
 * Hours are 0-24. Winter-ish day: sunrise 6:30, sunset 17:30, sun peaks at 34 degrees.
 */
const SUNRISE = 6.5, SUNSET = 17.5, MAX_EL = 34, MOON_EL = 40;
export const PRESETS = [['Morning', 8.5], ['Afternoon', 14.5], ['Sunset', 17.2], ['Night', 22]];
const KEY = 'apartment-daycycle';

const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } })();
export const env = {
  hour: saved?.hour ?? 16, playing: saved?.playing ?? true, secPerHour: saved?.secPerHour ?? 10,
  sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, 1, 0), sunElev: 20, moonElev: -20,
  dayK: 1, nightK: 0, warm: 0, lampK: 0, dayAmb: 0.5,
  skyTop: new THREE.Color(), skyHor: new THREE.Color(), ambSky: new THREE.Color(), ambGround: new THREE.Color(),
  light: null,
};

const C = (h) => new THREE.Color(h);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NIGHT_TOP = C(0x080d1c), NIGHT_HOR = C(0x1a2340), DAY_TOP = C(0x86a3c6), DAY_HOR = C(0xd5dde8), WARM_TOP = C(0x5a5f8c), WARM_HOR = C(0xf29a5a);
const SUN_LOW = C(0xff9d55), SUN_HIGH = C(0xfff0dc), MOON = C(0x8fa8ff);
const tmp = new THREE.Color();

function arc(u, maxEl) {   // u 0..1 across the sky: east -> south -> west. Returns a unit vector toward the body (x east, y up, z south).
  const az = u * Math.PI, el = Math.sin(u * Math.PI) * THREE.MathUtils.degToRad(maxEl), c = Math.cos(el);
  return new THREE.Vector3(Math.cos(az) * c, Math.sin(el), Math.sin(az) * c);
}
function bodies(h) {
  const dayLen = SUNSET - SUNRISE, u = (h - SUNRISE) / dayLen, nl = 24 - dayLen;
  const n = u > 1 ? (h - SUNSET) / nl : u < 0 ? (h + 24 - SUNSET) / nl : -1;   // 0..1 through the night
  const sun = u >= 0 && u <= 1 ? arc(u, MAX_EL) : arc(n, -35);                  // below the horizon at night
  const moon = n >= 0 ? arc(n, MOON_EL) : new THREE.Vector3(0, -1, 0);
  return { sun, moon };
}

export function initSun(scene) {
  const light = new THREE.DirectionalLight(0xffffff, 0); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03; light.shadow.radius = 3;
  const cam = light.shadow.camera; cam.left = -12; cam.right = 12; cam.top = 12; cam.bottom = -12; cam.near = 1; cam.far = 100;
  light.target.position.set(1.2, 0.5, 2.0); scene.add(light, light.target);
  env.light = light; update(0); return light;
}

export function update(dt) {
  if (env.playing) env.hour = (env.hour + dt / env.secPerHour) % 24;
  const { sun, moon } = bodies(env.hour);
  env.sunDir.copy(sun); env.moonDir.copy(moon);
  env.sunElev = THREE.MathUtils.radToDeg(Math.asin(sun.y)); env.moonElev = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, moon.y))));
  const e = env.sunElev;
  env.dayK = sm(-3, 9, e); env.nightK = 1 - sm(-9, 2, e);
  env.warm = Math.exp(-(((e - 3) / 9) ** 2)) * (e > -8 ? 1 : 0);
  env.lampK = 1 - sm(3, 16, e);
  env.skyTop.copy(NIGHT_TOP).lerp(DAY_TOP, env.dayK).lerp(WARM_TOP, env.warm * 0.75);
  env.skyHor.copy(NIGHT_HOR).lerp(DAY_HOR, env.dayK).lerp(WARM_HOR, env.warm * 0.85);
  env.ambSky.copy(C(0x6f86c8)).lerp(C(0xfff2de), env.dayK).lerp(C(0xffc9a0), env.warm * 0.5);
  env.ambGround.copy(C(0x1b1f30)).lerp(C(0x4a3a2a), env.dayK);
  env.dayAmb = 0.15 + 0.85 * env.dayK;
  const L = env.light; if (!L) return;
  const sunI = sm(-1, 7, e) * (2.4 + 1.4 * sm(5, 30, e)), moonI = env.nightK * sm(-2, 8, env.moonElev) * 0.55;
  const useSun = sunI >= moonI, dir = useSun ? sun : moon;
  L.color.copy(useSun ? tmp.copy(SUN_LOW).lerp(SUN_HIGH, sm(2, 26, e)) : MOON); L.intensity = useSun ? sunI : moonI;
  L.position.copy(L.target.position).addScaledVector(dir, 40); L.visible = L.intensity > 0.01;
}

/** Jump to an hour (also used by the clock UI / T key). */
export function setHour(h, keepPlaying = true) { env.hour = ((h % 24) + 24) % 24; if (!keepPlaying) env.playing = false; update(0); persist(); }
let lastSave = 0;
export function persist(force = true) { const n = performance.now(); if (!force && n - lastSave < 2000) return; lastSave = n; try { localStorage.setItem(KEY, JSON.stringify({ hour: env.hour, playing: env.playing, secPerHour: env.secPerHour })); } catch { /* ignore */ } }
export function nextPreset() { const h = env.hour; const nxt = PRESETS.find(([, ph]) => ph > h + 0.05) ?? PRESETS[0]; setHour(nxt[1]); return nxt[0]; }
export function clockText(h = env.hour) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60), ap = hh >= 12 ? 'PM' : 'AM'; return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`; }
export function phaseName() { const e = env.sunElev; if (e > 12) return env.hour < 12 ? 'Morning' : 'Afternoon'; if (e > -4) return env.hour < 12 ? 'Sunrise' : 'Sunset'; return env.hour > 4 && env.hour < 6.5 ? 'Dawn' : env.hour < 20 ? 'Dusk' : 'Night'; }
