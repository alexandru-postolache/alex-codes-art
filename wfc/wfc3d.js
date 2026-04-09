// ============================================================
// 3D Wave Function Collapse — Pipes & Buildings
// ============================================================

// --- Tile Definitions ---
// Faces: [+Y(top), -Y(bottom), +X(east), -X(west), +Z(south), -Z(north)]

// === PIPES TILESET ===
// Face types: 0=closed, 1=pipe
const PIPES_TILES_3D = [
  { name: 'blank',       faces: [0,0,0,0,0,0], weight: 10 },
  { name: 'straight-y',  faces: [1,1,0,0,0,0], weight: 3 },
  { name: 'straight-x',  faces: [0,0,1,1,0,0], weight: 3 },
  { name: 'straight-z',  faces: [0,0,0,0,1,1], weight: 3 },
  { name: 'corner-ty-ex', faces: [1,0,1,0,0,0], weight: 1 },
  { name: 'corner-ty-wx', faces: [1,0,0,1,0,0], weight: 1 },
  { name: 'corner-ty-sz', faces: [1,0,0,0,1,0], weight: 1 },
  { name: 'corner-ty-nz', faces: [1,0,0,0,0,1], weight: 1 },
  { name: 'corner-by-ex', faces: [0,1,1,0,0,0], weight: 1 },
  { name: 'corner-by-wx', faces: [0,1,0,1,0,0], weight: 1 },
  { name: 'corner-by-sz', faces: [0,1,0,0,1,0], weight: 1 },
  { name: 'corner-by-nz', faces: [0,1,0,0,0,1], weight: 1 },
  { name: 'corner-ex-sz', faces: [0,0,1,0,1,0], weight: 1 },
  { name: 'corner-ex-nz', faces: [0,0,1,0,0,1], weight: 1 },
  { name: 'corner-wx-sz', faces: [0,0,0,1,1,0], weight: 1 },
  { name: 'corner-wx-nz', faces: [0,0,0,1,0,1], weight: 1 },
  { name: 't-xz-ex',     faces: [0,0,1,0,1,1], weight: 0.5 },
  { name: 't-xz-wx',     faces: [0,0,0,1,1,1], weight: 0.5 },
  { name: 't-xz-sz',     faces: [0,0,1,1,1,0], weight: 0.5 },
  { name: 't-xz-nz',     faces: [0,0,1,1,0,1], weight: 0.5 },
  { name: 't-xy-ty',     faces: [1,0,1,1,0,0], weight: 0.5 },
  { name: 't-xy-by',     faces: [0,1,1,1,0,0], weight: 0.5 },
  { name: 't-xy-wx',     faces: [1,1,0,1,0,0], weight: 0.5 },
  { name: 't-xy-ex2',    faces: [1,1,1,0,0,0], weight: 0.5 },
  { name: 't-yz-ty',     faces: [1,0,0,0,1,1], weight: 0.5 },
  { name: 't-yz-by',     faces: [0,1,0,0,1,1], weight: 0.5 },
  { name: 't-yz-sz',     faces: [1,1,0,0,1,0], weight: 0.5 },
  { name: 't-yz-nz',     faces: [1,1,0,0,0,1], weight: 0.5 },
  { name: 'cross-xy',    faces: [1,1,1,1,0,0], weight: 0.3 },
  { name: 'cross-xz',    faces: [0,0,1,1,1,1], weight: 0.3 },
  { name: 'cross-yz',    faces: [1,1,0,0,1,1], weight: 0.3 },
];

// === BUILDING TILESET ===
// Face types: 0=air, 1=wall, 2=floor-top, 3=floor-bottom, 4=roof-top, 5=roof-bottom
// Vertical connections: floor-top(2) matches floor-bottom(3), roof-top(4) matches roof-bottom(5)
// Horizontal connections: wall(1) matches wall(1), air(0) matches air(0)
const BUILDING_TILES_3D = [
  // Air
  { name: 'air',            faces: [0,0,0,0,0,0], weight: 12 },

  // Solid ground block
  { name: 'ground',         faces: [2,2,1,1,1,1], weight: 3 },

  // Floor slab — floor surface on top, connects down
  { name: 'floor',          faces: [2,3,0,0,0,0], weight: 4 },

  // Walls — single wall faces (floor-top on top, floor-bottom on bottom for stacking)
  { name: 'wall-e',         faces: [2,3,1,0,0,0], weight: 2 },
  { name: 'wall-w',         faces: [2,3,0,1,0,0], weight: 2 },
  { name: 'wall-s',         faces: [2,3,0,0,1,0], weight: 2 },
  { name: 'wall-n',         faces: [2,3,0,0,0,1], weight: 2 },

  // Corner walls (two adjacent walls)
  { name: 'corner-es',      faces: [2,3,1,0,1,0], weight: 1.5 },
  { name: 'corner-en',      faces: [2,3,1,0,0,1], weight: 1.5 },
  { name: 'corner-ws',      faces: [2,3,0,1,1,0], weight: 1.5 },
  { name: 'corner-wn',      faces: [2,3,0,1,0,1], weight: 1.5 },

  // Hallway (two opposite walls)
  { name: 'hall-ew',        faces: [2,3,1,1,0,0], weight: 1 },
  { name: 'hall-ns',        faces: [2,3,0,0,1,1], weight: 1 },

  // Room — three walls, one opening
  { name: 'room-open-e',    faces: [2,3,0,1,1,1], weight: 0.8 },
  { name: 'room-open-w',    faces: [2,3,1,0,1,1], weight: 0.8 },
  { name: 'room-open-s',    faces: [2,3,1,1,0,1], weight: 0.8 },
  { name: 'room-open-n',    faces: [2,3,1,1,1,0], weight: 0.8 },

  // Enclosed room (4 walls)
  { name: 'room-closed',    faces: [2,3,1,1,1,1], weight: 0.5 },

  // Roof tiles — cap off the building top
  { name: 'roof',           faces: [0,3,0,0,0,0], weight: 3 },
  { name: 'roof-wall-e',    faces: [0,3,1,0,0,0], weight: 1.5 },
  { name: 'roof-wall-w',    faces: [0,3,0,1,0,0], weight: 1.5 },
  { name: 'roof-wall-s',    faces: [0,3,0,0,1,0], weight: 1.5 },
  { name: 'roof-wall-n',    faces: [0,3,0,0,0,1], weight: 1.5 },
  { name: 'roof-corner-es', faces: [0,3,1,0,1,0], weight: 1 },
  { name: 'roof-corner-en', faces: [0,3,1,0,0,1], weight: 1 },
  { name: 'roof-corner-ws', faces: [0,3,0,1,1,0], weight: 1 },
  { name: 'roof-corner-wn', faces: [0,3,0,1,0,1], weight: 1 },

  // Pillar (vertical support, no floor)
  { name: 'pillar',         faces: [3,3,0,0,0,0], weight: 0.5 },

  // Pillar with one wall
  { name: 'pillar-wall-e',  faces: [3,3,1,0,0,0], weight: 0.3 },
  { name: 'pillar-wall-w',  faces: [3,3,0,1,0,0], weight: 0.3 },
  { name: 'pillar-wall-s',  faces: [3,3,0,0,1,0], weight: 0.3 },
  { name: 'pillar-wall-n',  faces: [3,3,0,0,0,1], weight: 0.3 },
];

// --- Active tileset ---
let currentTileset = 'pipes';
let TILES = [];

function loadTileset3D(name) {
  currentTileset = name;
  if (name === 'pipes') {
    TILES = PIPES_TILES_3D.filter(t => t.weight > 0);
  } else {
    TILES = BUILDING_TILES_3D.filter(t => t.weight > 0);
  }
  precomputeAdjacency();
  precomputeWeights();
  initGrid();
  updateTilesetUI3D();
}

function updateTilesetUI3D() {
  document.querySelectorAll('[data-tileset3d]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tileset3d === currentTileset);
  });
}

// --- Directions ---
// 0:+Y(top) 1:-Y(bottom) 2:+X(east) 3:-X(west) 4:+Z(south) 5:-Z(north)
const DIR_OFFSET = [
  [0,1,0], [0,-1,0], [1,0,0], [-1,0,0], [0,0,1], [0,0,-1]
];
const OPP_DIR = [1, 0, 3, 2, 5, 4];

// --- Adjacency ---
let validNeighbors = [];

function precomputeAdjacency() {
  validNeighbors = [];
  for (let d = 0; d < 6; d++) {
    validNeighbors[d] = [];
    let opp = OPP_DIR[d];
    for (let i = 0; i < TILES.length; i++) {
      validNeighbors[d][i] = new Set();
      for (let j = 0; j < TILES.length; j++) {
        if (TILES[i].faces[d] === TILES[j].faces[opp]) {
          validNeighbors[d][i].add(j);
        }
      }
    }
  }
}

// --- Weights ---
let weightLogWeights = [];
let totalWeight = 0;
let totalWeightLogWeight = 0;

function precomputeWeights() {
  weightLogWeights = [];
  totalWeight = 0;
  totalWeightLogWeight = 0;
  for (let i = 0; i < TILES.length; i++) {
    let w = TILES[i].weight;
    totalWeight += w;
    let wlw = w * Math.log2(Math.max(w, 0.001));
    weightLogWeights[i] = wlw;
    totalWeightLogWeight += wlw;
  }
}

// --- Grid ---
let GRID_SIZE = 5;
let grid = [];
let collapsed = false;
let failed = false;
let failedCell = null;

class Cell {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.options = new Set();
    for (let i = 0; i < TILES.length; i++) this.options.add(i);
    this.collapsed = false;
    this.tile = -1;
    this.flashTime = 0;
    this.flashType = null;
  }

  entropy() {
    if (this.collapsed) return Infinity;
    if (this.options.size <= 1) return 0;
    let sw = 0, swlw = 0;
    for (let opt of this.options) {
      let w = TILES[opt].weight;
      sw += w;
      swlw += weightLogWeights[opt];
    }
    if (sw === 0) return 0;
    return Math.log2(sw) - swlw / sw;
  }

  collapse() {
    let sw = 0;
    for (let opt of this.options) sw += TILES[opt].weight;
    let r = Math.random() * sw;
    let acc = 0;
    for (let opt of this.options) {
      acc += TILES[opt].weight;
      if (r <= acc) {
        this.tile = opt;
        this.options = new Set([opt]);
        this.collapsed = true;
        return;
      }
    }
    let last = [...this.options].pop();
    this.tile = last;
    this.options = new Set([last]);
    this.collapsed = true;
  }
}

function initGrid() {
  grid = [];
  for (let z = 0; z < GRID_SIZE; z++) {
    grid[z] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[z][y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        grid[z][y][x] = new Cell(x, y, z);
      }
    }
  }
  collapsed = false;
  failed = false;
  failedCell = null;
  stepCount = 0;
  animPhase = 'idle';
  animProgress = 0;
  stepData = null;
  updateInfo();
}

// --- WFC ---
function findLowestEntropy() {
  let minE = Infinity;
  let candidates = [];
  for (let z = 0; z < GRID_SIZE; z++)
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++) {
        let cell = grid[z][y][x];
        if (cell.collapsed) continue;
        let e = cell.entropy();
        if (e < minE) { minE = e; candidates = [cell]; }
        else if (Math.abs(e - minE) < 0.0001) candidates.push(cell);
      }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function propagate(sx, sy, sz) {
  let stack = [[sx, sy, sz]];
  let affected = new Map();
  while (stack.length > 0) {
    let [cx, cy, cz] = stack.pop();
    let cell = grid[cz][cy][cx];
    for (let d = 0; d < 6; d++) {
      let [dx, dy, dz] = DIR_OFFSET[d];
      let nx = cx + dx, ny = cy + dy, nz = cz + dz;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) continue;
      let neighbor = grid[nz][ny][nx];
      if (neighbor.collapsed) continue;
      let allowed = new Set();
      for (let opt of cell.options)
        for (let v of validNeighbors[d][opt]) allowed.add(v);
      let changed = false;
      let toRemove = [];
      for (let opt of neighbor.options)
        if (!allowed.has(opt)) { toRemove.push(opt); changed = true; }
      for (let r of toRemove) neighbor.options.delete(r);
      if (neighbor.options.size === 0) {
        failed = true; failedCell = neighbor; return affected;
      }
      if (changed) {
        let parentDist = affected.has(cell) ? affected.get(cell).dist : 0;
        let dist = parentDist + 1;
        let existing = affected.get(neighbor);
        if (!existing || dist < existing.dist) affected.set(neighbor, { dist });
        stack.push([nx, ny, nz]);
      }
    }
  }
  return affected;
}

let stepCount = 0;

function wfcStep() {
  let cell = findLowestEntropy();
  if (!cell) { collapsed = true; return { type: 'complete' }; }
  if (cell.options.size === 0) {
    failed = true; failedCell = cell;
    return { type: 'fail', cell };
  }
  cell.collapse();
  stepCount++;
  let affectedCells = propagate(cell.x, cell.y, cell.z);
  let maxDist = 0;
  for (let [, info] of affectedCells)
    if (info.dist > maxDist) maxDist = info.dist;
  if (failed) return { type: 'fail', cell: failedCell, affectedCells, maxDist };
  return { type: 'step', cell, affectedCells, maxDist };
}

// --- Animation ---
let animPhase = 'idle';
let animProgress = 0;
let animSpeed = 5;
let autoPlay = false;
let stepData = null;
let autoPlayTimer = 0;

// --- UI State ---
let showUncollapsed = true;
let showGrid = false;
let sliceY = 0;

// --- Colors ---
const COL_BG = [13, 13, 26];
const COL_PIPE = [108, 92, 231];

// Building colors
const COL_WALL      = [160, 140, 120];
const COL_FLOOR     = [100, 100, 110];
const COL_ROOF      = [140, 60, 60];
const COL_GROUND    = [80, 90, 70];
const COL_PILLAR    = [130, 120, 100];
const COL_INTERIOR  = [180, 170, 150];

// ============================================================
// p5.js Setup & Draw
// ============================================================

function setup() {
  TILES = PIPES_TILES_3D.filter(t => t.weight > 0);
  precomputeAdjacency();
  precomputeWeights();
  let cnv = createCanvas(576, 576, WEBGL);
  cnv.parent('canvas-container');
  pixelDensity(2);
  initGrid();
  bindControls();
  document.getElementById('slice').max = GRID_SIZE;
}

function draw() {
  background(COL_BG);
  updateAnimation();
  orbitControl(2, 2, 0.5);

  ambientLight(80);
  directionalLight(180, 180, 220, 0.5, -0.8, -0.5);
  directionalLight(80, 80, 120, -0.3, 0.5, 0.8);

  let cellSize = 280 / GRID_SIZE;
  let offset = (GRID_SIZE * cellSize) / 2 - cellSize / 2;

  for (let z = 0; z < GRID_SIZE; z++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (sliceY > 0 && y !== sliceY - 1) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        let cell = grid[z][y][x];
        push();
        translate(x * cellSize - offset, -(y * cellSize - offset), z * cellSize - offset);
        if (cell.collapsed) {
          if (currentTileset === 'pipes') drawPipeTile(cell, cellSize);
          else drawBuildingTile(cell, cellSize);
        } else if (showUncollapsed) {
          drawUncollapsed(cell, cellSize);
        }
        if (showGrid) {
          noFill(); stroke(30, 30, 55, 60); strokeWeight(0.5); box(cellSize);
        }
        pop();
      }
    }
  }

  drawFlashes(cellSize, offset);
  updateInfo();
}

// ============================================================
// Pipe Tile Rendering
// ============================================================

function drawPipeTile(cell, size) {
  let tile = TILES[cell.tile];
  let hasAny = tile.faces.some(f => f !== 0);
  if (!hasAny) return;

  let hue = map(cell.x + cell.y + cell.z, 0, (GRID_SIZE - 1) * 3, 0, 1);
  let r = lerp(COL_PIPE[0], 30, hue * 0.5);
  let g = lerp(COL_PIPE[1], 200, hue);
  let b = lerp(COL_PIPE[2], 255, hue * 0.3);

  let pipeR = size * 0.12;
  let halfLen = size * 0.5;

  noStroke();
  ambientMaterial(r * 0.4, g * 0.4, b * 0.4);
  specularMaterial(r, g, b);
  shininess(30);

  sphere(pipeR * 1.3, 8, 8);
  let faces = tile.faces;
  if (faces[0]) { push(); translate(0, -halfLen/2, 0); cylinder(pipeR, halfLen, 8, 1); pop(); }
  if (faces[1]) { push(); translate(0, halfLen/2, 0); cylinder(pipeR, halfLen, 8, 1); pop(); }
  if (faces[2]) { push(); translate(halfLen/2, 0, 0); rotateZ(HALF_PI); cylinder(pipeR, halfLen, 8, 1); pop(); }
  if (faces[3]) { push(); translate(-halfLen/2, 0, 0); rotateZ(HALF_PI); cylinder(pipeR, halfLen, 8, 1); pop(); }
  if (faces[4]) { push(); translate(0, 0, halfLen/2); rotateX(HALF_PI); cylinder(pipeR, halfLen, 8, 1); pop(); }
  if (faces[5]) { push(); translate(0, 0, -halfLen/2); rotateX(HALF_PI); cylinder(pipeR, halfLen, 8, 1); pop(); }
}

// ============================================================
// Building Tile Rendering
// ============================================================

function drawBuildingTile(cell, size) {
  let tile = TILES[cell.tile];
  let name = tile.name;
  let faces = tile.faces;
  let half = size / 2;
  let wallThick = size * 0.08;
  let floorThick = size * 0.06;

  noStroke();

  if (name === 'air') return;

  // Height variation based on Y
  let yFade = map(cell.y, 0, GRID_SIZE - 1, 0.7, 1.0);

  if (name === 'ground') {
    ambientMaterial(COL_GROUND[0] * yFade, COL_GROUND[1] * yFade, COL_GROUND[2] * yFade);
    box(size * 0.95, size * 0.95, size * 0.95);
    return;
  }

  // Draw floor slab if tile has floor-top (2) on top face
  if (faces[0] === 2) {
    push();
    ambientMaterial(COL_FLOOR[0] * yFade, COL_FLOOR[1] * yFade, COL_FLOOR[2] * yFade);
    translate(0, -half + floorThick / 2, 0);
    box(size * 0.98, floorThick, size * 0.98);
    pop();
  }

  // Draw ceiling if tile has floor-bottom (3) on bottom face and not a pillar
  if (faces[1] === 3 && !name.startsWith('pillar')) {
    push();
    ambientMaterial(COL_INTERIOR[0] * yFade * 0.7, COL_INTERIOR[1] * yFade * 0.7, COL_INTERIOR[2] * yFade * 0.7);
    translate(0, half - floorThick / 2, 0);
    box(size * 0.98, floorThick, size * 0.98);
    pop();
  }

  // Draw roof cap if tile has air (0) on top and floor-bottom (3) on bottom
  if (name.startsWith('roof')) {
    push();
    ambientMaterial(COL_ROOF[0] * yFade, COL_ROOF[1] * yFade, COL_ROOF[2] * yFade);
    translate(0, -half + floorThick, 0);
    box(size * 0.99, floorThick * 2, size * 0.99);
    pop();
  }

  // Pillar
  if (name.startsWith('pillar')) {
    push();
    ambientMaterial(COL_PILLAR[0] * yFade, COL_PILLAR[1] * yFade, COL_PILLAR[2] * yFade);
    cylinder(wallThick * 1.5, size * 0.95, 6, 1);
    pop();
  }

  // Draw walls for each side face that is wall (1)
  let wallColor = name.startsWith('roof') ? COL_ROOF : COL_WALL;
  ambientMaterial(wallColor[0] * yFade, wallColor[1] * yFade, wallColor[2] * yFade);

  // +X (east)
  if (faces[2] === 1) {
    push(); translate(half - wallThick / 2, 0, 0);
    box(wallThick, size * 0.95, size * 0.95); pop();
  }
  // -X (west)
  if (faces[3] === 1) {
    push(); translate(-half + wallThick / 2, 0, 0);
    box(wallThick, size * 0.95, size * 0.95); pop();
  }
  // +Z (south)
  if (faces[4] === 1) {
    push(); translate(0, 0, half - wallThick / 2);
    box(size * 0.95, size * 0.95, wallThick); pop();
  }
  // -Z (north)
  if (faces[5] === 1) {
    push(); translate(0, 0, -half + wallThick / 2);
    box(size * 0.95, size * 0.95, wallThick); pop();
  }
}

// ============================================================
// Shared Rendering
// ============================================================

function drawUncollapsed(cell, size) {
  let alpha = map(cell.options.size, 1, TILES.length, 80, 15);
  noFill();
  stroke(108, 92, 231, alpha);
  strokeWeight(0.5);
  box(size * 0.3);
}

function drawFlashes(cellSize, offset) {
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (sliceY > 0 && y !== sliceY - 1) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        let cell = grid[z][y][x];
        if (!cell.flashType) continue;
        push();
        translate(x * cellSize - offset, -(y * cellSize - offset), z * cellSize - offset);
        let t = cell.flashTime / 40;
        if (t > 1) { cell.flashType = null; pop(); continue; }
        noStroke();
        if (cell.flashType === 'collapse') {
          ambientMaterial(255, 220, 100, (1 - t) * 150);
          sphere(cellSize * 0.3 * (1 - t * 0.5), 6, 6);
        } else if (cell.flashType === 'propagate') {
          ambientMaterial(0, 210, 230, (1 - t) * 80);
          box(cellSize * 0.4 * (1 - t * 0.3));
        } else if (cell.flashType === 'fail') {
          let pulse = sin(t * PI * 4) * 0.5 + 0.5;
          ambientMaterial(255, 60, 60, 150 * pulse);
          box(cellSize * 0.5);
        }
        pop();
      }
    }
  }
}

// ============================================================
// Animation
// ============================================================

function updateAnimation() {
  let speedMult = map(constrain(animSpeed, 1, 15), 1, 15, 0.3, 4.0);

  if (autoPlay && animSpeed > 15) {
    let stepsPerFrame = Math.round(map(animSpeed, 16, 20, 3, 20));
    for (let i = 0; i < stepsPerFrame; i++) {
      if (collapsed || failed) break;
      if (animPhase !== 'idle') { animPhase = 'idle'; animProgress = 0; stepData = null; }
      let result = wfcStep();
      if (result.type === 'complete') {
        collapsed = true; animPhase = 'complete';
        autoPlay = false; updateButtonStates();
        break;
      }
      if (result.type === 'fail') { initGrid(); continue; }
    }
    return;
  }

  if (animPhase === 'selecting') {
    animProgress += 0.08 * speedMult;
    if (animProgress >= 1) {
      animPhase = 'collapsing'; animProgress = 0;
      if (stepData && stepData.cell) { stepData.cell.flashType = 'collapse'; stepData.cell.flashTime = 0; }
    }
  } else if (animPhase === 'collapsing') {
    animProgress += 0.07 * speedMult;
    if (animProgress >= 1) {
      animPhase = 'propagating'; animProgress = 0;
      if (stepData && stepData.affectedCells)
        for (let [c] of stepData.affectedCells) { c.flashType = 'propagate'; c.flashTime = 0; }
    }
  } else if (animPhase === 'propagating') {
    animProgress += 0.06 * speedMult;
    let maxDist = stepData ? stepData.maxDist : 1;
    if (animProgress >= 1 + maxDist * 0.1) {
      animPhase = 'idle'; animProgress = 0; stepData = null;
      if (autoPlay && !collapsed && !failed) autoPlayTimer = 0;
    }
  } else if (animPhase === 'failed') {
    animProgress += 0.03 * speedMult;
    if (animProgress >= 1) { initGrid(); if (autoPlay) triggerStep(); }
  } else if (animPhase === 'idle' && autoPlay) {
    autoPlayTimer += speedMult;
    if (autoPlayTimer >= 2) { autoPlayTimer = 0; triggerStep(); }
  }

  for (let z = 0; z < GRID_SIZE; z++)
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++) {
        let cell = grid[z][y][x];
        if (cell.flashType) { cell.flashTime++; if (cell.flashTime > 40) cell.flashType = null; }
      }
}

function triggerStep() {
  if (collapsed || animPhase !== 'idle') return;
  if (failed) { initGrid(); return; }
  let result = wfcStep();
  if (result.type === 'complete') {
    animPhase = 'complete'; collapsed = true;
    if (autoPlay) { autoPlay = false; updateButtonStates(); }
    return;
  }
  if (result.type === 'fail') {
    stepData = result; animPhase = 'failed'; animProgress = 0;
    if (result.cell) { result.cell.flashType = 'fail'; result.cell.flashTime = 0; }
    return;
  }
  stepData = result; animPhase = 'selecting'; animProgress = 0;
}

// ============================================================
// UI
// ============================================================

function updateInfo() {
  let total = GRID_SIZE * GRID_SIZE * GRID_SIZE;
  let el = document.getElementById('info-text');
  if (collapsed) {
    el.textContent = `Complete! ${total} cells collapsed in ${stepCount} steps.`;
    el.className = '';
  } else if (failed) {
    el.textContent = 'Contradiction detected — resetting...';
    el.className = '';
  } else if (stepCount > 0) {
    el.textContent = `Step ${stepCount} / ${total} cells | Tileset: ${currentTileset}`;
    el.className = '';
  } else {
    el.textContent = 'Click Play or Step to start';
    el.className = 'info-placeholder';
  }
}

function bindControls() {
  document.getElementById('btn-play').addEventListener('click', () => {
    autoPlay = true; autoPlayTimer = 10; updateButtonStates();
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    autoPlay = false; updateButtonStates();
  });
  document.getElementById('btn-step').addEventListener('click', () => {
    autoPlay = false; updateButtonStates(); triggerStep();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    autoPlay = false; updateButtonStates(); initGrid();
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    saveCanvas('wfc3d-' + currentTileset + '-' + GRID_SIZE, 'png');
  });
  document.getElementById('speed').addEventListener('input', (e) => {
    animSpeed = parseInt(e.target.value);
  });
  document.getElementById('grid-size').addEventListener('change', (e) => {
    autoPlay = false; updateButtonStates();
    GRID_SIZE = parseInt(e.target.value);
    document.getElementById('slice').max = GRID_SIZE;
    document.getElementById('slice').value = 0;
    sliceY = 0;
    document.getElementById('slice-label').textContent = 'All';
    initGrid();
  });
  document.getElementById('slice').addEventListener('input', (e) => {
    sliceY = parseInt(e.target.value);
    document.getElementById('slice-label').textContent = sliceY === 0 ? 'All' : `Y=${sliceY}`;
  });
  document.getElementById('show-uncollapsed').addEventListener('change', (e) => {
    showUncollapsed = e.target.checked;
  });
  document.getElementById('show-grid').addEventListener('change', (e) => {
    showGrid = e.target.checked;
  });

  // Tileset switcher
  document.querySelectorAll('[data-tileset3d]').forEach(btn => {
    btn.addEventListener('click', () => {
      autoPlay = false; updateButtonStates();
      loadTileset3D(btn.dataset.tileset3d);
    });
  });
}

function updateButtonStates() {
  document.getElementById('btn-play').disabled = autoPlay;
  document.getElementById('btn-pause').disabled = !autoPlay;
  document.getElementById('btn-step').disabled = autoPlay || collapsed;
}
