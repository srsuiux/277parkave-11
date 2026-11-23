/**
 * Things you must be able to find in the dark (light switches): their plates glow a faint pale green when the room around you is dark,
 * like glow-in-the-dark switch plates. main.js feeds the darkness each frame.
 */
const mats = [];
export function markGlow(m) { m.emissive.set(0x9affc0); m.emissiveIntensity = 0; mats.push(m); return m; }
export function setDarkness(d) { const v = Math.max(0, Math.min(1, d)) * 0.6; for (const m of mats) m.emissiveIntensity = v; }
