import * as THREE from 'three';
import { LOCATION, weather } from './weather.js';

/**
 * Real-time sun and moon for 277 Park Ave #11, Youngstown, OH (US Eastern time).
 *  - The sun / moon position is computed from the actual date + time (astronomical formulas, no API) for Youngstown's latitude and
 *    longitude, then mapped onto the apartment (x east, y up, z south). So the light is exactly where the real sun is right now.
 *  - One shadow-casting DirectionalLight is the sun by day and the moon by night (moon strength follows the real phase). Walls,
 *    ceilings and window frames cast real shadows, so light only enters through the windows (and open doors).
 *  - Live weather (weather.js) dims the sun under cloud, greys the sky and adds fog. `env` is read by main.js and winterscene.js.
 */
const D2R = Math.PI / 180;
const tzFmt = new Intl.DateTimeFormat('en-US', { timeZone: LOCATION.tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export const env = {
  override: null,            // ms timestamp, for testing only (window.__fp.setTime)
  sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0), sunElev: 20, moonElev: -20, moonIllum: 0.5,
  dayK: 1, nightK: 0, warm: 0, lampK: 0, dayAmb: 0.5,
  skyTop: new THREE.Color(), skyHor: new THREE.Color(), ambSky: new THREE.Color(), ambGround: new THREE.Color(),
  light: null,
};

const C = (h) => new THREE.Color(h);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mod = (x, m) => ((x % m) + m) % m;
const NIGHT_TOP = C(0x080d1c), NIGHT_HOR = C(0x1a2340), DAY_TOP = C(0x86a3c6), DAY_HOR = C(0xd5dde8), WARM_TOP = C(0x5a5f8c), WARM_HOR = C(0xf29a5a);
const GREY_TOP = C(0x8f969f), GREY_HOR = C(0xc4c9d0);
const SUN_LOW = C(0xff9d55), SUN_HIGH = C(0xfff0dc), MOON = C(0x8fa8ff);
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

/** equatorial (RA, dec in radians) at time `n` days since J2000 -> apartment direction vector */
function toApartment(ra, dec, n) {
  const gmst = mod(18.697374558 + 24.06570982441908 * n, 24), ha = (gmst * 15 + LOCATION.lon) * D2R - ra, lat = LOCATION.lat * D2R;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha), el = Math.asin(sinEl);
  const A = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));   // from south, positive towards west
  const c = Math.cos(el);
  return new THREE.Vector3(-Math.sin(A) * c, sinEl, Math.cos(A) * c);   // x east, y up, z south
}
export function sunMoon(ms) {
  const n = ms / 86400000 + 2440587.5 - 2451545.0;
  const L = mod(280.460 + 0.9856474 * n, 360), g = mod(357.528 + 0.9856003 * n, 360) * D2R, lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R, eps = (23.439 - 0.0000004 * n) * D2R;
  const sun = toApartment(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), Math.asin(Math.sin(eps) * Math.sin(lam)), n);
  const Lm = mod(218.316 + 13.176396 * n, 360), Mm = mod(134.963 + 13.064993 * n, 360) * D2R, Fm = mod(93.272 + 13.229350 * n, 360) * D2R;
  const lonM = (Lm + 6.289 * Math.sin(Mm)) * D2R, latM = 5.128 * Math.sin(Fm) * D2R;
  const ra = Math.atan2(Math.sin(lonM) * Math.cos(eps) - Math.tan(latM) * Math.sin(eps), Math.cos(lonM)), dec = Math.asin(Math.sin(latM) * Math.cos(eps) + Math.cos(latM) * Math.sin(eps) * Math.sin(lonM));
  const moon = toApartment(ra, dec, n), illum = (1 - Math.cos(lonM - lam)) / 2;
  return { sun, moon, illum };
}

export function initSun(scene) {
  const light = new THREE.DirectionalLight(0xffffff, 0); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03; light.shadow.radius = 3;
  const cam = light.shadow.camera; cam.left = -12; cam.right = 12; cam.top = 12; cam.bottom = -12; cam.near = 1; cam.far = 100;
  light.target.position.set(1.2, 0.5, 2.0); scene.add(light, light.target);
  env.light = light; update(); return light;
}

export const now = () => env.override ?? Date.now();

export function update() {
  const { sun, moon, illum } = sunMoon(now());
  env.sunDir.copy(sun); env.moonDir.copy(moon); env.moonIllum = illum;
  env.sunElev = THREE.MathUtils.radToDeg(Math.asin(sun.y)); env.moonElev = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, moon.y))));
  const e = env.sunElev, cloud = weather.cloud / 100, fog = weather.fog;
  env.dayK = sm(-3, 9, e); env.nightK = 1 - sm(-9, 2, e);
  env.warm = Math.exp(-(((e - 3) / 9) ** 2)) * (e > -8 ? 1 : 0) * (1 - 0.7 * cloud);   // a blanket of cloud mutes the sunset colours
  env.lampK = Math.min(1, 1 - sm(3, 16, e) + sm(0.55, 1, Math.max(cloud, weather.rain, weather.snow)) * 0.35 * env.dayK);
  const gray = Math.min(1, cloud * 0.85 + fog * 0.3);
  env.skyTop.copy(NIGHT_TOP).lerp(DAY_TOP, env.dayK).lerp(WARM_TOP, env.warm * 0.75).lerp(tmp.copy(GREY_TOP).multiplyScalar(0.12 + 0.88 * env.dayK), gray);
  env.skyHor.copy(NIGHT_HOR).lerp(DAY_HOR, env.dayK).lerp(WARM_HOR, env.warm * 0.85).lerp(tmp2.copy(GREY_HOR).multiplyScalar(0.15 + 0.85 * env.dayK), gray);
  env.ambSky.copy(C(0x6f86c8)).lerp(C(0xfff2de), env.dayK).lerp(C(0xffc9a0), env.warm * 0.5);
  env.ambGround.copy(C(0x1b1f30)).lerp(C(0x4a3a2a), env.dayK);
  env.dayAmb = (0.15 + 0.85 * env.dayK) * (1 + 0.25 * cloud);   // overcast days are soft and even
  const L = env.light; if (!L) return;
  const sunI = sm(-1, 7, e) * (2.4 + 1.4 * sm(5, 30, e)) * (1 - 0.88 * Math.pow(cloud, 1.2)), moonI = env.nightK * sm(-2, 8, env.moonElev) * (0.12 + 0.55 * illum) * (1 - 0.8 * cloud);
  const useSun = sunI >= moonI, dir = useSun ? sun : moon;
  L.color.copy(useSun ? tmp.copy(SUN_LOW).lerp(SUN_HIGH, sm(2, 26, e)) : MOON); L.intensity = useSun ? sunI : moonI;
  L.position.copy(L.target.position).addScaledVector(dir, 40); L.visible = L.intensity > 0.01;
}

/** "3:42 PM EST" in Youngstown's time zone */
export function clockText() { return tzFmt.format(new Date(now())); }
export function phaseName() { const e = env.sunElev; if (e > 12) return 'Daytime'; if (e > -4) return new Date(now()).getUTCHours() < 17 ? 'Sunrise' : 'Sunset'; if (e > -12) return 'Twilight'; return 'Night'; }
