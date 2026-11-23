import * as THREE from 'three';

/**
 * Every wall of the house can be painted: look at it and press X (same modal as the furniture).
 * buildWall() gives each wall its own material and tags the wall group `isWall`; here we make those groups paintable,
 * give each a stable id (its path of group names) so the colour is saved in layout.json under "wall:<id>".
 * Painting swaps the baked wallpaper tint for a flat paint colour (the stucco bump stays); Reset puts the original back.
 */
const NICE = { N: 'north', S: 'south', E: 'east', W: 'west' };

export function makeWallsPaintable(roots, openPaint) {
  const list = [], seen = new Map();
  for (const root of roots) root.traverse((g) => {
    if (!g.userData.isWall) return;
    const names = []; for (let p = g; p && p !== root.parent; p = p.parent) if (p.name) names.unshift(p.name);
    let id = names.join('/'); const n = (seen.get(id) ?? 0) + 1; seen.set(id, n); if (n > 1) id += '#' + n;
    const mat = g.userData.wallMat, origMap = mat.map, origColor = mat.color.clone();
    const base = new THREE.Color(0xffffff);
    if (origMap?.userData?.baseHex !== undefined) base.set(origMap.userData.baseHex);
    else base.set(mat.userData.baseHex ?? 0xd9d8c9);
    const def = '#' + base.clone().multiply(origColor).getHexString();
    let hex = def;
    const apply = (h) => { hex = h; if (h === def) { mat.map = origMap; mat.color.copy(origColor); } else { mat.map = null; mat.color.set(h); } mat.needsUpdate = true; };
    const room = names.find((x) => /bath|bed|closet|hall|kitchen/i.test(x));
    if (!g.userData.label) {
      const m = /^wall-([NSEW])(?:-(left|right))?/i.exec(g.name), dir = m ? NICE[m[1].toUpperCase()] + (m[2] ? ' ' + m[2] : '') : g.name.replace(/^(hallway-)?wall-?/i, '').replace(/-/g, ' ');
      const rm = room ? room.replace(/-?(walls?|shell)$/i, '') : '';
      g.userData.label = `${rm ? rm[0].toUpperCase() + rm.slice(1) + ' ' : ''}${dir ? dir + ' ' : ''}wall`.trim();
    }
    g.userData.paintId = id;
    g.userData.paint = { parts: [{ label: 'Wall paint' }], get: () => ({ 'Wall paint': hex }), set: (v) => { if (v?.['Wall paint']) apply(v['Wall paint']); }, reset: () => apply(def) };
    g.userData.interact = { prompt: () => '<kbd>X</kbd> paint this wall', run: () => {}, keys: { KeyX: () => openPaint(g) } };
    list.push(g);
  });
  return list;
}
