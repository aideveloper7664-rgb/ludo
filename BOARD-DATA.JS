/* ==========================================================================
   BOARD-DATA.JS
   All coordinates are in "grid units" on a 15x15 ludo board (0..14, 0..14).
   These were derived by pixel-analysing assets/object/ak_board.png so the
   pawns line up exactly with the printed board.
   ========================================================================== */

// The 56-cell common ring, walked clockwise starting just outside GREEN's yard.
const RING = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],[12,6],
  [13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],
  [8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],
  [6,10],[6,9],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]
];

const START_INDEX = { green: 0, red: 14, blue: 28, yellow: 42 };

// Cells that are safe (no capture possible) - the 4 colour starts + 4 grey stars.
const SAFE_INDICES = [0, 9, 14, 23, 28, 37, 42, 51];

// Each colour's private home column (6 cells, ring-adjacent -> centre-adjacent)
const HOME_COLS = {
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]
};

const CENTER = [7, 7];

// Fractional-grid slots (inside each yard) where the 4 idle pawns sit.
const BASE_SLOTS = {
  green:  [[1.4,1.4],[4.6,1.4],[1.4,4.6],[4.6,4.6]],
  red:    [[10.4,1.4],[13.6,1.4],[10.4,4.6],[13.6,4.6]],
  yellow: [[1.4,10.4],[4.6,10.4],[1.4,13.6],[4.6,13.6]],
  blue:   [[10.4,10.4],[13.6,10.4],[10.4,13.6],[13.6,13.6]]
};

const COLORS = ['green', 'red', 'blue', 'yellow'];

// Build the full 62-step path (index 0..61) for a colour:
//   0..54  -> 55 cells of the common ring (their own lap)
//   55..60 -> 6 cells of their private home column
//   61     -> centre / finished
function buildPath(color) {
  const s = START_INDEX[color];
  const path = [];
  for (let i = 0; i < 55; i++) {
    path.push(RING[(s + i) % 56]);
  }
  for (const c of HOME_COLS[color]) path.push(c);
  path.push(CENTER);
  return path;
}

const PATHS = {};
for (const c of COLORS) PATHS[c] = buildPath(c);

// Actual board coordinates of every safe cell (for capture checks)
const SAFE_COORDS = new Set(SAFE_INDICES.map(i => RING[i].join(',')));

function isSafeCoord(col, row) {
  return SAFE_COORDS.has(col + ',' + row);
}

const PATH_LEN = 62; // 0..61
const FINISH_POS = 61;
const HOME_ENTRY_POS = 55; // first step that leaves the common ring
