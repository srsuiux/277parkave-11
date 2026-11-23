import * as THREE from 'three';

/**
 * One physically-minded lighting model for the whole apartment.
 *
 * Direct light: sun / moon (directional) and every lamp (point lights) cast real shadow maps, so walls, doors and curtains
 * block them and open doorways / windows let them through. Nothing here depends on where the player stands.
 *
 * Indirect light: three.js has no global illumination, so the ambient (hemisphere + environment) term is made *position
 * dependent* instead of global. A shader patch multiplies every material's ambient light by a per-room colour looked up from
 * the fragment's world position (rooms are axis-aligned boxes, blended over 10 cm at the edges). The per-room colours are
 * solved on the CPU every frame from the real state of the apartment: daylight x window openness (curtains), bounce from
 * each room's own lamps, and light leaking in from neighbouring rooms through open doors. A closed, curtained, unlit
 * room at night therefore gets almost no ambient light at all.
 *
 * Import this module before anything compiles a material: it patches the standard/physical shader chunks.
 */
export const ROOMS = ['kitchen', 'bath', 'bedroom', 'closet', 'hall'];
const N = ROOMS.length;                       // index N = outdoors
const AMB = Array.from({ length: N + 1 }, () => new THREE.Vector3(1, 1, 1));
export const roomAmbient = AMB;

let patched = false;
/** rects: { room: [x0, x1, z0, z1] }. Must run before the first material is compiled. */
export function patchShaders(rects, yMin = -0.4, yMax = 3.4) {
  if (patched) return; patched = true;
  const boxes = ROOMS.map((r) => { const b = rects[r]; return `vec4(${b.map((v) => v.toFixed(3)).join(',')})`; }).join(',');
  const decl = `
uniform vec3 uRoomAmb[${N + 1}];
const vec4 ROOM_BOX[${N}] = vec4[${N}](${boxes});
vec3 roomAmbientAt( vec3 viewPos ) {
	vec3 wp = transpose( mat3( viewMatrix ) ) * ( viewPos - viewMatrix[ 3 ].xyz );
	if ( wp.y < ${yMin.toFixed(2)} || wp.y > ${yMax.toFixed(2)} ) return uRoomAmb[ ${N} ];
	vec3 acc = vec3( 0.0 ); float wsum = 0.0;
	for ( int i = 0; i < ${N}; i ++ ) {
		vec4 b = ROOM_BOX[ i ];
		float dx = max( max( b.x - wp.x, wp.x - b.y ), 0.0 ), dz = max( max( b.z - wp.z, wp.z - b.w ), 0.0 );
		float w = 1.0 - smoothstep( 0.0, 0.1, length( vec2( dx, dz ) ) );
		acc += w * uRoomAmb[ i ]; wsum += w;
	}
	float wo = clamp( 1.0 - wsum, 0.0, 1.0 );
	return ( acc + wo * uRoomAmb[ ${N} ] ) / ( wsum + wo );
}
`;
  THREE.ShaderChunk.lights_physical_pars_fragment += decl;
  THREE.ShaderChunk.lights_fragment_end = `
#if defined( RE_IndirectDiffuse ) || defined( RE_IndirectSpecular )
	vec3 roomAmb = roomAmbientAt( - vViewPosition );
#endif
#if defined( RE_IndirectDiffuse )
	irradiance *= roomAmb;
#endif
#if defined( RE_IndirectSpecular )
	radiance *= roomAmb; iblIrradiance *= roomAmb;
#endif
` + THREE.ShaderChunk.lights_fragment_end;
  for (const lib of [THREE.ShaderLib.standard, THREE.ShaderLib.physical]) lib.uniforms.uRoomAmb = { value: AMB };
}

const WARM = new THREE.Color(1.0, 0.86, 0.68);
const tmp = new THREE.Color();

/**
 * Solve the per-room ambient multipliers.
 * s: { dayAmb, skyColor, lamp: {room: 0..1}, window: {room: 0..1 open sky fraction}, links: [[roomA, roomB, open01]] }
 * Base units match the old hemisphere formula (0.06 + 0.29*lamp + 0.5*daylight) relative to a fixed hemisphere of 0.4.
 */
const BASE = 0.012, REF = 0.4, WINDOW_GAIN = { bedroom: 0.55, bath: 0.3, closet: 0.0, hall: 0.1, kitchen: 0.0 };
const raw = ROOMS.map(() => new THREE.Color()), fin = ROOMS.map(() => new THREE.Color());
export function solveAmbient(s) {
  ROOMS.forEach((r, i) => {
    const day = s.dayAmb * (WINDOW_GAIN[r] ?? 0) * (s.window[r] ?? 0);
    raw[i].setRGB(BASE, BASE, BASE);
    raw[i].r += 0.29 * (s.lamp[r] ?? 0) * WARM.r + 0.5 * day * s.skyColor.r;
    raw[i].g += 0.29 * (s.lamp[r] ?? 0) * WARM.g + 0.5 * day * s.skyColor.g;
    raw[i].b += 0.29 * (s.lamp[r] ?? 0) * WARM.b + 0.5 * day * s.skyColor.b;
  });
  // light travelling through doorways: an open door shares ~30% of the neighbour's ambient, a closed one leaks a little around the edges
  ROOMS.forEach((r, i) => fin[i].copy(raw[i]));
  for (const [a, b, open] of s.links) {
    const ia = ROOMS.indexOf(a), ib = ROOMS.indexOf(b), k = 0.012 + 0.3 * open;
    fin[ia].add(tmp.copy(raw[ib]).multiplyScalar(k)); fin[ib].add(tmp.copy(raw[ia]).multiplyScalar(k));
  }
  ROOMS.forEach((r, i) => AMB[i].set(fin[i].r / REF, fin[i].g / REF, fin[i].b / REF));
  const o = (0.06 + 0.5 * s.dayAmb) / REF; AMB[N].set(o * s.skyColor.r, o * s.skyColor.g, o * s.skyColor.b);
}
export const AMBIENT_REF = REF;
