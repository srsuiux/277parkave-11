// All dimensions in metres. X = east, Y = up, Z = south.
// These are ESTIMATES from photos — edit here and everything rebuilds.
export const KITCHEN = {
  width: 3.0,   // west -> east (x)
  depth: 3.9,   // north -> south (z)
  height: 2.45,
  wallT: 0.14,

  // Openings. wall: N (z=0), E (x=W), S (z=D), W (x=0).
  // `at` = centre of opening along that wall, measured in world x (N/S) or z (E/W).
  doors: [
    // All doors share the entrance door's structure (5 panels, deadbolt, knob + plate, hinges).
    // sticker: the red "SEALED" sticker (entrance only) · reverse: we see the BACK of the door from here ·
    // locked: can't be opened · peephole: small viewer above the knob.
    { id: 'north-door',   label: 'Entrance door #11 (main door)', wall: 'N', at: 1.0,  w: 0.82, h: 2.03, color: 0xf1efe8, open: 0, maxOpen: 100, hinge: 'left', hardware: 'entry', sticker: true },
    { id: 'east-door',    label: 'East door - sealed hallway door (back side)', wall: 'E', at: 3.0, w: 0.82, h: 2.03, color: 0xb8bab0, open: 0, hinge: 'right', hardware: 'entry', reverse: true, locked: true },
    { id: 'living-room-door', label: 'Bedroom door (south wall, straight ahead from the entrance)', wall: 'S', at: 0.95, w: 0.88, h: 2.03, color: 0xf1efe8, open: 0, maxOpen: 95, swing: -1, hinge: 'right', hardware: 'entry', peephole: true },
    { id: 'bathroom-door', label: 'Bathroom door (west wall, end of the counter)', knobColor: 0xeeeae0, wall: 'W', at: 3.25, w: 0.82, h: 2.03, color: 0xf1efe8, open: 0, maxOpen: 100, swing: -1, hinge: 'left', hardware: 'entry' },
  ],
  label: 'Kitchen',

  // Counter run on the WEST wall, from IMG_1284. Entering from the main door it is on your right and
  // runs to the bathroom door. Units are listed left -> right as seen from the room (south -> north).
  counter: {
    startZ: 2.69,      // south end of the run (just before the bathroom door casing)
    depth: 0.6,
    topH: 0.91,        // countertop height
    units: [
      { type: 'stove',          w: 0.51, label: 'Electric stove (20")' },
      { type: 'drawer-cabinet', w: 0.85, label: 'Cabinet - drawer + arched door' },
      { type: 'sink-cabinet',   w: 0, label: 'Sink cabinet - two doors' },
    ],
    northGap: 0.02,    // counter runs right up to the north wall (just clear of the baseboard)
    sconceZ: 1.05, sconceY: 1.55, // porcelain wall light above the sink side
  },
  // Grey shag rug in front of the counter (IMG_1284 / IMG_1279 / IMG_1277)
  rug: { x: 1.6, z: 2.15, w: 2.1, l: 3.4, rot: 0, label: 'Grey shag rug (kitchen)' },
  // Refrigerator on the EAST wall, facing the kitchen (feedback note: fridge at about z = 2.0)
  fridge: { z: 1.89, w: 0.7, d: 0.72, h: 1.68, label: 'Refrigerator (white, top freezer)' },
  // Light switch on the south wall above the dresser (IMG_1290)
  switch: { x: 1.72, y: 1.2 },
  wallLabels: { N: 'North wall - entrance wall', E: 'East wall - fridge side', S: 'South wall - living room side', W: 'West wall - counter side (stove, cabinets, sink)' },

  windows: [], // none in the kitchen (the createWindow() part is kept for other rooms)
  // Recesses cut into the north wall (inner face z=0). x0/x1 along the wall, depth from the inner face.
  niches: [
    // Open shelving built into the wall, left of the entrance (IMG_1278 / IMG_1282)
    { id: 'shelf-niche', label: 'Shelf niche (left of entrance)', x0: 0.0, x1: 0.34, y0: 0.0, y1: 2.0, depth: 0.32, sideT: 0.14, shelves: [0.15, 0.5, 0.87, 1.2, 1.47, 1.76] },
    // Empty recess at the far (north-east) end of the same wall: same size, no shelves
    { id: 'ne-recess', label: 'Empty recess (north-east end of entrance wall)', trim: true, x0: 2.5, x1: 3.0,  y0: 0.0, y1: 2.45, depth: 0.32, sideT: 0.14, shelves: [] },
  ],
  // Boxed bulkhead seen top-left in the sink-side photo (IMG_1278)
  soffit: { side: 'W', from: 0.0, to: 1.6, width: 0.4, drop: 0.28 },
};

// Hallway outside the entrance (door #11 = kitchen 'north-door').
// It is attached automatically: centred on that door, running north (-z) from the kitchen's north wall.
export const HALLWAY = {
  label: 'Hallway (outside the entrance)',
  width: 1.2,
  length: 4.4,
  height: KITCHEN.height,
  wallT: 0.14,
  doorShift: 0.1, // door sits this far toward the west wall of the hallway (photo IMG_1281)
  railFrom: 1.9, // distance from the entrance at which the stairwell railing starts
};

// Placeholder rooms behind the other doors so nothing opens onto a void.
// Interiors are empty for now — each becomes its own asset later.
export const ROOMS = [];   // (the old living-room placeholder is now the real bedroom, see BEDROOM)

// First-person
export const PLAYER = { height: 1.78, eye: 1.67, radius: 0.13, walk: 1.5, run: 3.0 };

// Loose furniture (IMG_1288-1292). x/z = footprint centre (m), rot = degrees about the vertical axis
// (0 faces south/+z, -90 faces west, 90 faces east, 180 faces north), y = height off the floor.
// These are only DEFAULTS: anything you drag/resize in Layout mode (press L) is saved to layout.json and wins.
export const FURNITURE = [
  { id: 'bookshelf',    x: 2.815, z: 0.99, rot: -90 },   // east wall, left of the fridge
  { id: 'metal-chair',  x: 2.72,  z: 2.47, rot: -90 },   // scroll-back chair between fridge and hallway door
  { id: 'dining-table', x: 2.4,   z: 3.08, rot: 0 },     // counter-height table, south-east corner
  { id: 'monitor',      x: 2.78,  z: 3.08, rot: -90, y: 0.9 },
  { id: 'laptop',       x: 2.38,  z: 3.16, rot: 180, y: 0.9 },
  { id: 'diary',        x: 2.66,  z: 3.3,  rot: 90,  y: 0.9 },   // black-cover diary
  { id: 'chair-north',  x: 2.0,   z: 2.48, rot: 0 },     // X-back chair, north side of the table
  { id: 'chair-west',   x: 1.6,   z: 3.08, rot: 90 },    // X-back chair, west end of the table
  { id: 'dresser',      x: 1.85,  z: 3.67, rot: 180 },   // south wall, right of the living-room door
  { id: 'radiator',     x: 2.1,   z: 0.095, rot: 0 },    // north wall, right of the entrance
  { id: 'orange-chair', x: 1.5,   z: 0.6,  rot: 0 },     // folding sling chair by the entrance
];

// Bathroom, WEST of the kitchen (photos IMG_1293-1298). Interior rectangle in world metres.
// Door is in the kitchen's west wall (z = 3.25). Layout (looking from the door): shower stall in the NE corner,
// toilet + radiator at the north end, vanity + mirror + sconce on the south wall, arched window on the west wall.
export const BATHROOM = {
  label: 'Bathroom',
  x1: -KITCHEN.wallT, x0: -KITCHEN.wallT - 1.85,   // inner faces (east = kitchen wall)
  z0: 0.05, z1: KITCHEN.depth,
  height: KITCHEN.height, wallT: 0.14, wainscot: 1.12,
  stall: { w: 0.95, d: 1.05 },                       // shower stall in the north-east corner
  window: { z: 3.38, w: 0.74, sill: 1.12, top: 2.17 },
};

// Bedroom, SOUTH of the kitchen (through the kitchen's south door). Centred on that door, so there is equal space to the left and right.
// Facing south: the closet door is on your LEFT (east wall), the glass window + AC on your RIGHT (west wall).
const _bw = 2.25, _bc = KITCHEN.doors.find((d) => d.id === 'living-room-door').at;
export const BEDROOM = {
  label: 'Bedroom',
  x0: _bc - _bw, x1: _bc + _bw, z0: KITCHEN.depth + KITCHEN.wallT, z1: KITCHEN.depth + KITCHEN.wallT + 3.7,
  height: KITCHEN.height, wallT: 0.14,
  window: { pad: 0.2, h: 1.35, sill: 0.85 },                       // wide window along the west wall, pad = gap at each end
  closet: { w: 1.7, d: 3.2, dz0: 0.35, doorDz: 0.85, doorW: 0.78, doorH: 2.03 },   // interior size (d = 2.2 m by the door + 1.0 m, one bed-width, running on to the right of the door); dz0 = offset of the closet from the bedroom's north wall; doorDz = door centre from the closet's north wall
};
