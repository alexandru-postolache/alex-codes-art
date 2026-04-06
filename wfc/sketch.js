// ============================================================
// Wave Function Collapse — Interactive Visualization
// ============================================================

// --- Tileset Presets ---
const PIPES_TILES = [
  { name: 'blank',      edges: [0,0,0,0], weight: 10 },
  { name: 'straight-h', edges: [0,1,0,1], weight: 4  },
  { name: 'straight-v', edges: [1,0,1,0], weight: 4  },
  { name: 'corner-tr',  edges: [1,1,0,0], weight: 2  },
  { name: 'corner-br',  edges: [0,1,1,0], weight: 2  },
  { name: 'corner-bl',  edges: [0,0,1,1], weight: 2  },
  { name: 'corner-tl',  edges: [1,0,0,1], weight: 2  },
  { name: 't-up',       edges: [1,1,0,1], weight: 1  },
  { name: 't-right',    edges: [1,1,1,0], weight: 1  },
  { name: 't-down',     edges: [0,1,1,1], weight: 1  },
  { name: 't-left',     edges: [1,0,1,1], weight: 1  },
  { name: 'cross',      edges: [1,1,1,1], weight: 1  },
];

// Wang 2-edge tileset: canonical 4x4 layout
// Tile index = N*1 + E*2 + S*4 + W*8, edges from bits
const WANG_2E_LAYOUT = [
  [ 4,  6, 14, 12],
  [ 5,  7, 15, 13],
  [ 1,  3, 11,  9],
  [ 0,  2, 10,  8]
];

function wangEdges(idx) {
  return [
    (idx >> 0) & 1, // top (N)
    (idx >> 1) & 1, // right (E)
    (idx >> 2) & 1, // bottom (S)
    (idx >> 3) & 1  // left (W)
  ];
}

// Wang 2-corner tileset: canonical 4x4 atlas layout
// Tile index = NE*1 + SE*2 + SW*4 + NW*8, corners from bits
const WANG_2C_LAYOUT = [
  [ 4,  3, 14,  6],
  [10,  7, 15, 13],
  [ 1,  9, 11, 12],
  [ 0,  2,  5,  8]
];

function wangCorners(idx) {
  return [
    (idx >> 0) & 1, // NE
    (idx >> 1) & 1, // SE
    (idx >> 2) & 1, // SW
    (idx >> 3) & 1  // NW
  ];
}

// Wang 3-edge tileset: 9x9 atlas layout (81 tiles, 3 edge colors)
// Tile index = N*1 + E*3 + S*9 + W*27, edges from base-3 digits
const WANG_3E_LAYOUT = [
  [18, 21, 48, 45, 24, 75, 51, 78, 72],
  [20, 23, 50, 47, 26, 77, 53, 80, 74],
  [11, 14, 41, 38, 17, 68, 44, 71, 65],
  [19, 22, 49, 46, 25, 76, 52, 79, 73],
  [ 2,  5, 32, 29,  8, 59, 35, 62, 56],
  [ 9, 12, 39, 36, 15, 66, 42, 69, 63],
  [10, 13, 40, 37, 16, 67, 43, 70, 64],
  [ 1,  4, 31, 28,  7, 58, 34, 61, 55],
  [ 0,  3, 30, 27,  6, 57, 33, 60, 54],
];

function wang3eEdges(idx) {
  return [
    idx % 3,                    // N
    Math.floor(idx / 3) % 3,    // E
    Math.floor(idx / 9) % 3,    // S
    Math.floor(idx / 27) % 3    // W
  ];
}

// Wang 3-corner tileset: 9x9 atlas layout (81 tiles, 3 corner colors)
// Tile index = NE*1 + SE*3 + SW*9 + NW*27, corners from base-3 digits
const WANG_3C_LAYOUT = [
  [58, 43, 47, 60, 24, 20, 61, 49, 38],
  [10, 35, 75, 11, 56, 57, 17, 73, 30],
  [45,  5, 70, 48, 12, 16, 50, 63,  7],
  [78, 22, 44, 79, 52, 53, 76, 42, 26],
  [65, 55, 32, 71, 80, 77, 64, 29, 59],
  [39,  9,  4, 41, 68, 67, 36,  3, 13],
  [34, 51, 19, 31, 40, 37, 33, 25, 46],
  [ 8, 74, 54,  1, 28, 27,  2, 62, 72],
  [23, 66, 15, 18,  0,  6, 21, 14, 69],
];

function wang3cCorners(idx) {
  return [
    idx % 3,                    // NE
    Math.floor(idx / 3) % 3,    // SE
    Math.floor(idx / 9) % 3,    // SW
    Math.floor(idx / 27) % 3    // NW
  ];
}

// --- Active Tile Definitions (mutable) ---
let TILES = [];
let currentTilesetName = 'pipes';
let cornerMode = false;

// Direction offsets: 0-3 cardinal, 4-7 diagonal
// top, right, bottom, left, top-right, bottom-right, bottom-left, top-left
const DIR_OFFSET = [[0,-1], [1,0], [0,1], [-1,0], [1,-1], [1,1], [-1,1], [-1,-1]];
const DIR_NAMES = ['top', 'right', 'bottom', 'left'];

// Corner indices: NE=0, SE=1, SW=2, NW=3
// For each of the 8 directions, which corner pairs must match: [myCorner, theirCorner]
const CORNER_RULES = [
  [[3, 2], [0, 1]],  // 0 top: my NW==their SW, my NE==their SE
  [[0, 3], [1, 2]],  // 1 right: my NE==their NW, my SE==their SW
  [[2, 3], [1, 0]],  // 2 bottom: my SW==their NW, my SE==their NE
  [[3, 0], [2, 1]],  // 3 left: my NW==their NE, my SW==their SE
  [[0, 2]],           // 4 top-right: my NE==their SW
  [[1, 3]],           // 5 bottom-right: my SE==their NW
  [[2, 0]],           // 6 bottom-left: my SW==their NE
  [[3, 1]],           // 7 top-left: my NW==their SE
];

// Precompute valid neighbors: validNeighbors[dir][tileIdx] = Set of compatible tile indices
let validNeighbors = [];

function precomputeAdjacency() {
  let numDirs = cornerMode ? 8 : 4;
  validNeighbors = [];

  for (let d = 0; d < numDirs; d++) {
    validNeighbors[d] = [];

    if (cornerMode) {
      let rules = CORNER_RULES[d];
      for (let i = 0; i < TILES.length; i++) {
        validNeighbors[d][i] = new Set();
        for (let j = 0; j < TILES.length; j++) {
          let valid = true;
          for (let [myC, theirC] of rules) {
            if (String(TILES[i].corners[myC]) !== String(TILES[j].corners[theirC])) {
              valid = false;
              break;
            }
          }
          if (valid) validNeighbors[d][i].add(j);
        }
      }
    } else {
      let opp = (d + 2) % 4;
      for (let i = 0; i < TILES.length; i++) {
        validNeighbors[d][i] = new Set();
        for (let j = 0; j < TILES.length; j++) {
          if (String(TILES[i].edges[d]) === String(TILES[j].edges[opp])) {
            validNeighbors[d][i].add(j);
          }
        }
      }
    }
  }
}

// --- Grid Configuration ---
let GRID_COLS = 16;
let GRID_ROWS = 16;
const MAX_CANVAS = 576;
let CELL_SIZE = Math.floor(MAX_CANVAS / GRID_COLS);
let CANVAS_W = GRID_COLS * CELL_SIZE;
let CANVAS_H = GRID_ROWS * CELL_SIZE;

function updateGridSize(cols, rows) {
  GRID_COLS = cols;
  GRID_ROWS = rows;
  CELL_SIZE = Math.floor(MAX_CANVAS / Math.max(cols, rows));
  CANVAS_W = GRID_COLS * CELL_SIZE;
  CANVAS_H = GRID_ROWS * CELL_SIZE;
  initGrid();
  resizeCanvas(CANVAS_W, CANVAS_H);
}

// --- Colors ---
const COL_BG       = [13, 13, 26];
const COL_CELL_BG  = [20, 20, 40];
const COL_GRID     = [30, 30, 55];
const COL_PATH     = [108, 92, 231];
const COL_SELECT   = [255, 200, 50];
const COL_COLLAPSE = [255, 220, 100];
const COL_RIPPLE   = [0, 210, 230];
const COL_FAIL     = [255, 60, 60];

// Edge type colors for the editor
const EDGE_COLORS = [
  '#555577', '#6c5ce7', '#00cec9', '#fdcb6e',
  '#e17055', '#55efc4', '#ff7675', '#74b9ff',
  '#a29bfe', '#ffeaa7', '#fab1a0', '#81ecec',
];

// --- WFC State ---
let grid = [];
let collapsed = false;
let failed = false;
let failedCell = null;

// --- Animation State ---
let animPhase = 'idle';
let animProgress = 0;
let animSpeed = 5;
let autoPlay = false;
let stepData = null;
let autoPlayTimer = 0;

// --- UI State ---
let showEntropy = false;
let debugView = false;
let showGrid = true;
let hoveredCell = null;

// --- Manual Placement ---
let selectedTileIdx = -1;
let manualCells = new Set();
let invalidFlash = null;

// --- Custom Tileset ---
let customTileData = []; // { name, edges: [t,r,b,l], weight, img (p5.Image), dataUrl }

// --- Entropy precomputation ---
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
    let wlw = w * Math.log2(Math.max(w, 1));
    weightLogWeights[i] = wlw;
    totalWeightLogWeight += wlw;
  }
}

// ============================================================
// Cell
// ============================================================
class Cell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.options = new Set();
    for (let i = 0; i < TILES.length; i++) this.options.add(i);
    this.collapsed = false;
    this.tile = -1;
    this.flashTime = 0;
    this.flashType = null;
    this.propagateDist = 0;
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

// ============================================================
// WFC Algorithm
// ============================================================

function initGrid() {
  grid = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      grid[y][x] = new Cell(x, y);
    }
  }
  collapsed = false;
  failed = false;
  failedCell = null;
  animPhase = 'idle';
  animProgress = 0;
  stepData = null;
  manualCells = new Set();
  invalidFlash = null;
}

function findLowestEntropy() {
  let minEntropy = Infinity;
  let candidates = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cell = grid[y][x];
      if (cell.collapsed) continue;
      let e = cell.entropy();
      if (e < minEntropy) {
        minEntropy = e;
        candidates = [cell];
      } else if (Math.abs(e - minEntropy) < 0.0001) {
        candidates.push(cell);
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function propagate(startX, startY) {
  let stack = [[startX, startY]];
  let affected = new Map();
  let numDirs = cornerMode ? 8 : 4;

  while (stack.length > 0) {
    let [cx, cy] = stack.pop();
    let cell = grid[cy][cx];

    for (let d = 0; d < numDirs; d++) {
      let nx = cx + DIR_OFFSET[d][0];
      let ny = cy + DIR_OFFSET[d][1];
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;

      let neighbor = grid[ny][nx];
      if (neighbor.collapsed) continue;

      let allowed = new Set();
      for (let opt of cell.options) {
        for (let v of validNeighbors[d][opt]) {
          allowed.add(v);
        }
      }

      let changed = false;
      let removed = [];
      for (let opt of neighbor.options) {
        if (!allowed.has(opt)) {
          removed.push(opt);
          changed = true;
        }
      }
      for (let r of removed) neighbor.options.delete(r);

      if (neighbor.options.size === 0) {
        failed = true;
        failedCell = neighbor;
        return affected;
      }

      if (changed) {
        let parentDist = affected.has(cell) ? affected.get(cell).dist : 0;
        let dist = parentDist + 1;
        let existing = affected.get(neighbor);
        if (!existing || dist < existing.dist) {
          affected.set(neighbor, { dist, removed });
        }
        stack.push([nx, ny]);
      }
    }
  }
  return affected;
}

function wfcStep() {
  let cell = findLowestEntropy();
  if (!cell) {
    collapsed = true;
    return { type: 'complete' };
  }

  if (cell.options.size === 0) {
    failed = true;
    failedCell = cell;
    return { type: 'fail', cell };
  }

  cell.collapse();
  let affectedCells = propagate(cell.x, cell.y);

  let maxDist = 0;
  for (let [, info] of affectedCells) {
    if (info.dist > maxDist) maxDist = info.dist;
  }

  if (failed) {
    return { type: 'fail', cell: failedCell, affectedCells, maxDist };
  }

  return { type: 'step', cell, affectedCells, maxDist };
}

// ============================================================
// Tileset Management
// ============================================================

function loadTileset(name) {
  currentTilesetName = name;
  selectedTileIdx = -1;

  if (name === 'pipes') {
    cornerMode = false;
    TILES = PIPES_TILES.map(t => ({ ...t, img: null }));
  } else if (name === 'custom') {
    // cornerMode is set by the import function that populated customTileData
    if (customTileData.length === 0) {
      cornerMode = false;
      TILES = [{ name: 'empty', edges: [0,0,0,0], weight: 1, img: null }];
    } else {
      TILES = customTileData.map(t => ({
        name: t.name,
        edges: t.edges ? [...t.edges] : [0,0,0,0],
        corners: t.corners ? [...t.corners] : undefined,
        weight: t.weight,
        img: t.img
      }));
    }
  }

  precomputeAdjacency();
  precomputeWeights();
  initGrid();
  buildTilePicker();
  updateTilesetUI();
}

function updateTilesetUI() {
  document.querySelectorAll('.tileset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tileset === currentTilesetName);
  });
  let customEditor = document.getElementById('custom-editor');
  customEditor.hidden = currentTilesetName !== 'custom';
}

// ============================================================
// Custom Tileset Upload & Editor
// ============================================================

function handleTileUpload(files) {
  let loadCount = 0;
  let totalFiles = files.length;

  for (let file of files) {
    let reader = new FileReader();
    reader.onload = function(e) {
      let dataUrl = e.target.result;
      loadImage(dataUrl, function(p5img) {
        let baseName = file.name.replace(/\.[^.]+$/, '');
        customTileData.push({
          name: baseName,
          edges: [0, 0, 0, 0],
          weight: 1,
          img: p5img,
          dataUrl: dataUrl
        });
        loadCount++;
        if (loadCount === totalFiles) {
          buildEdgeEditor();
          if (currentTilesetName === 'custom') {
            applyCustomTileset();
          }
        }
      });
    };
    reader.readAsDataURL(file);
  }
}

function buildEdgeEditor() {
  let container = document.getElementById('edge-editor');
  container.innerHTML = '';

  if (customTileData.length === 0) {
    container.innerHTML = '<p class="editor-empty">Upload tile images to get started</p>';
    return;
  }

  let isCorner = customTileData.some(t => t.corners);

  customTileData.forEach((tile, idx) => {
    let card = document.createElement('div');
    card.className = isCorner ? 'edge-card corner-card' : 'edge-card';

    let imgEl = document.createElement('img');
    imgEl.src = tile.dataUrl;
    imgEl.className = 'edge-card-img';

    let imgWrap = document.createElement('div');
    imgWrap.className = 'edge-card-center';
    imgWrap.appendChild(imgEl);

    if (isCorner) {
      // Corner inputs: NE=0, SE=1, SW=2, NW=3
      let nwInput = edgeInput(tile.corners[3], val => { tile.corners[3] = val; });
      let neInput = edgeInput(tile.corners[0], val => { tile.corners[0] = val; });
      let swInput = edgeInput(tile.corners[2], val => { tile.corners[2] = val; });
      let seInput = edgeInput(tile.corners[1], val => { tile.corners[1] = val; });
      nwInput.classList.add('corner-nw');
      neInput.classList.add('corner-ne');
      swInput.classList.add('corner-sw');
      seInput.classList.add('corner-se');
      card.appendChild(nwInput);
      card.appendChild(neInput);
      card.appendChild(imgWrap);
      card.appendChild(swInput);
      card.appendChild(seInput);
    } else {
      // Edge inputs: top=0, right=1, bottom=2, left=3
      let topInput = edgeInput(tile.edges[0], val => { tile.edges[0] = val; });
      let rightInput = edgeInput(tile.edges[1], val => { tile.edges[1] = val; });
      let bottomInput = edgeInput(tile.edges[2], val => { tile.edges[2] = val; });
      let leftInput = edgeInput(tile.edges[3], val => { tile.edges[3] = val; });
      topInput.classList.add('edge-top');
      rightInput.classList.add('edge-right');
      bottomInput.classList.add('edge-bottom');
      leftInput.classList.add('edge-left');
      card.appendChild(topInput);
      card.appendChild(leftInput);
      card.appendChild(imgWrap);
      card.appendChild(rightInput);
      card.appendChild(bottomInput);
    }

    let meta = document.createElement('div');
    meta.className = 'edge-card-meta';

    let nameSpan = document.createElement('span');
    nameSpan.className = 'edge-card-name';
    nameSpan.textContent = tile.name;

    let weightLabel = document.createElement('label');
    weightLabel.className = 'edge-card-weight';
    weightLabel.textContent = 'W:';
    let weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.min = '1';
    weightInput.max = '100';
    weightInput.value = tile.weight;
    weightInput.addEventListener('change', (e) => {
      tile.weight = Math.max(1, parseInt(e.target.value) || 1);
    });
    weightLabel.appendChild(weightInput);

    let removeBtn = document.createElement('button');
    removeBtn.className = 'edge-card-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove tile';
    removeBtn.addEventListener('click', () => {
      customTileData.splice(idx, 1);
      buildEdgeEditor();
    });

    meta.appendChild(nameSpan);
    meta.appendChild(weightLabel);
    meta.appendChild(removeBtn);

    card.appendChild(meta);
    container.appendChild(card);
  });
}

function edgeInput(value, onChange) {
  let input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '99';
  input.value = value;
  input.className = 'edge-input';
  colorEdgeInput(input, value);
  input.addEventListener('change', (e) => {
    let val = parseInt(e.target.value) || 0;
    e.target.value = val;
    colorEdgeInput(e.target, val);
    onChange(val);
  });
  return input;
}

function colorEdgeInput(input, val) {
  let color = EDGE_COLORS[val % EDGE_COLORS.length];
  input.style.borderColor = color;
  input.style.boxShadow = `0 0 4px ${color}40`;
}

function applyCustomTileset() {
  loadTileset('custom');
}

function handleWangImport(file) {
  let reader = new FileReader();
  reader.onload = function(e) {
    let atlasDataUrl = e.target.result;
    loadImage(atlasDataUrl, function(atlas) {
      let tileW = Math.floor(atlas.width / 4);
      let tileH = Math.floor(atlas.height / 4);

      customTileData = [];

      // We'll collect all 16 tiles indexed by their Wang index
      // then sort by index for a clean ordering
      let tilesByIdx = [];

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          let wangIdx = WANG_2E_LAYOUT[row][col];
          let edges = wangEdges(wangIdx);

          // Extract sub-tile
          let subImg = atlas.get(col * tileW, row * tileH, tileW, tileH);

          // Render to a temporary graphics to get a clean dataUrl
          let pg = createGraphics(tileW, tileH);
          pg.image(subImg, 0, 0, tileW, tileH);
          let dataUrl = pg.canvas.toDataURL();
          pg.remove();

          tilesByIdx.push({
            wangIdx,
            name: `wang-${wangIdx}`,
            edges: edges,
            weight: 1,
            img: subImg,
            dataUrl: dataUrl
          });
        }
      }

      // Sort by wang index for consistent ordering
      tilesByIdx.sort((a, b) => a.wangIdx - b.wangIdx);
      customTileData = tilesByIdx;

      // Show atlas preview
      let preview = document.getElementById('wang-preview');
      preview.hidden = false;
      document.getElementById('wang-preview-img').src = atlasDataUrl;

      cornerMode = false;

      // Build edge editor and auto-apply
      buildEdgeEditor();
      applyCustomTileset();
    });
  };
  reader.readAsDataURL(file);
}

function handleWangCornerImport(file) {
  let reader = new FileReader();
  reader.onload = function(e) {
    let atlasDataUrl = e.target.result;
    loadImage(atlasDataUrl, function(atlas) {
      // Support both 4x4 grid and 16x1 strip
      let cols, rows;
      if (atlas.width > atlas.height * 2) {
        cols = 16; rows = 1;
      } else {
        cols = 4; rows = 4;
      }
      let tileW = Math.floor(atlas.width / cols);
      let tileH = Math.floor(atlas.height / rows);

      customTileData = [];
      let tilesByIdx = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let wangIdx;
          if (rows === 1) {
            wangIdx = col;
          } else {
            wangIdx = WANG_2C_LAYOUT[row][col];
          }
          let corners = wangCorners(wangIdx);

          let subImg = atlas.get(col * tileW, row * tileH, tileW, tileH);
          let pg = createGraphics(tileW, tileH);
          pg.image(subImg, 0, 0, tileW, tileH);
          let dataUrl = pg.canvas.toDataURL();
          pg.remove();

          tilesByIdx.push({
            wangIdx,
            name: `wang-c${wangIdx}`,
            corners: corners,
            edges: null,
            weight: 1,
            img: subImg,
            dataUrl: dataUrl
          });
        }
      }

      tilesByIdx.sort((a, b) => a.wangIdx - b.wangIdx);
      customTileData = tilesByIdx;
      cornerMode = true;

      // Show atlas preview
      let preview = document.getElementById('wang-preview');
      preview.hidden = false;
      document.getElementById('wang-preview-img').src = atlasDataUrl;

      buildEdgeEditor();
      applyCustomTileset();
    });
  };
  reader.readAsDataURL(file);
}

function handleWang3eImport(file) {
  let reader = new FileReader();
  reader.onload = function(e) {
    let atlasDataUrl = e.target.result;
    loadImage(atlasDataUrl, function(atlas) {
      let tileW = Math.floor(atlas.width / 9);
      let tileH = Math.floor(atlas.height / 9);

      customTileData = [];
      let tilesByIdx = [];

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          let wangIdx = WANG_3E_LAYOUT[row][col];
          let edges = wang3eEdges(wangIdx);

          let subImg = atlas.get(col * tileW, row * tileH, tileW, tileH);
          let pg = createGraphics(tileW, tileH);
          pg.image(subImg, 0, 0, tileW, tileH);
          let dataUrl = pg.canvas.toDataURL();
          pg.remove();

          tilesByIdx.push({
            wangIdx,
            name: `wang3e-${wangIdx}`,
            edges: edges,
            weight: 1,
            img: subImg,
            dataUrl: dataUrl
          });
        }
      }

      tilesByIdx.sort((a, b) => a.wangIdx - b.wangIdx);
      customTileData = tilesByIdx;

      let preview = document.getElementById('wang-preview');
      preview.hidden = false;
      document.getElementById('wang-preview-img').src = atlasDataUrl;
      document.querySelector('.wang-preview-label').textContent = '81 tiles extracted with 3-edge constraints';

      cornerMode = false;
      buildEdgeEditor();
      applyCustomTileset();
    });
  };
  reader.readAsDataURL(file);
}

function handleWang3cImport(file) {
  let reader = new FileReader();
  reader.onload = function(e) {
    let atlasDataUrl = e.target.result;
    loadImage(atlasDataUrl, function(atlas) {
      let tileW = Math.floor(atlas.width / 9);
      let tileH = Math.floor(atlas.height / 9);

      customTileData = [];
      let tilesByIdx = [];

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          let wangIdx = WANG_3C_LAYOUT[row][col];
          let corners = wang3cCorners(wangIdx);

          let subImg = atlas.get(col * tileW, row * tileH, tileW, tileH);
          let pg = createGraphics(tileW, tileH);
          pg.image(subImg, 0, 0, tileW, tileH);
          let dataUrl = pg.canvas.toDataURL();
          pg.remove();

          tilesByIdx.push({
            wangIdx,
            name: `wang3c-${wangIdx}`,
            corners: corners,
            edges: null,
            weight: 1,
            img: subImg,
            dataUrl: dataUrl
          });
        }
      }

      tilesByIdx.sort((a, b) => a.wangIdx - b.wangIdx);
      customTileData = tilesByIdx;
      cornerMode = true;

      let preview = document.getElementById('wang-preview');
      preview.hidden = false;
      document.getElementById('wang-preview-img').src = atlasDataUrl;
      document.querySelector('.wang-preview-label').textContent = '81 tiles extracted with 3-corner constraints';

      buildEdgeEditor();
      applyCustomTileset();
    });
  };
  reader.readAsDataURL(file);
}

// ============================================================
// p5.js Setup & Draw
// ============================================================

function setup() {
  TILES = PIPES_TILES.map(t => ({ ...t, img: null }));
  precomputeAdjacency();
  precomputeWeights();
  let cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.parent('canvas-container');
  pixelDensity(2);
  textFont('monospace');
  initGrid();
  bindControls();
  buildTilePicker();

  // Set example atlas thumbnail sources from embedded data
  document.querySelectorAll('.atlas-thumb').forEach(thumb => {
    let type = thumb.dataset.atlas;
    if (EXAMPLE_ATLASES[type]) {
      thumb.querySelector('img').src = EXAMPLE_ATLASES[type];
    }
  });
}

function draw() {
  background(COL_BG);
  updateAnimation();

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cell = grid[y][x];
      let px = x * CELL_SIZE;
      let py = y * CELL_SIZE;
      drawCell(cell, px, py, CELL_SIZE);
    }
  }

  if (showGrid) {
    stroke(COL_GRID);
    strokeWeight(0.5);
    for (let x = 0; x <= GRID_COLS; x++) line(x * CELL_SIZE, 0, x * CELL_SIZE, CANVAS_H);
    for (let y = 0; y <= GRID_ROWS; y++) line(0, y * CELL_SIZE, CANVAS_W, y * CELL_SIZE);
  }

  drawOverlays();
  updateHover();
}

// ============================================================
// Animation
// ============================================================

function updateAnimation() {
  let speedMult = map(constrain(animSpeed, 1, 15), 1, 15, 0.3, 4.0);

  // Above 15: skip animations, multiple steps per frame
  if (autoPlay && animSpeed > 15) {
    let stepsPerFrame = Math.round(map(animSpeed, 16, 20, 2, 10));
    for (let i = 0; i < stepsPerFrame; i++) {
      if (collapsed || failed) break;
      if (animPhase !== 'idle') {
        animPhase = 'idle';
        animProgress = 0;
        stepData = null;
      }
      let result = wfcStep();
      if (result.type === 'complete') {
        collapsed = true;
        animPhase = 'complete';
        autoPlay = false;
        updateButtonStates();
        break;
      }
      if (result.type === 'fail') {
        initGrid();
        continue;
      }
      if (i === stepsPerFrame - 1) {
        result.cell.flashType = 'collapse';
        result.cell.flashTime = 0;
      }
    }
    return;
  }

  if (animPhase === 'selecting') {
    animProgress += 0.06 * speedMult;
    if (animProgress >= 1) {
      animPhase = 'collapsing';
      animProgress = 0;
      if (stepData && stepData.cell) {
        stepData.cell.flashType = 'collapse';
        stepData.cell.flashTime = 0;
      }
    }
  } else if (animPhase === 'collapsing') {
    animProgress += 0.05 * speedMult;
    if (animProgress >= 1) {
      animPhase = 'propagating';
      animProgress = 0;
      if (stepData && stepData.affectedCells) {
        for (let [c, info] of stepData.affectedCells) {
          c.flashType = 'propagate';
          c.flashTime = 0;
          c.propagateDist = info.dist;
        }
      }
    }
  } else if (animPhase === 'propagating') {
    animProgress += 0.04 * speedMult;
    let maxDist = stepData ? stepData.maxDist : 1;
    if (animProgress >= 1 + maxDist * 0.15) {
      animPhase = 'idle';
      animProgress = 0;
      stepData = null;
      checkAutoPlay();
    }
  } else if (animPhase === 'failed') {
    animProgress += 0.02 * speedMult;
    if (animProgress >= 1) {
      initGrid();
      if (autoPlay) {
        triggerStep();
      }
    }
  } else if (animPhase === 'idle' && autoPlay) {
    autoPlayTimer += speedMult;
    if (autoPlayTimer >= 3) {
      autoPlayTimer = 0;
      triggerStep();
    }
  }

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cell = grid[y][x];
      if (cell.flashType) {
        cell.flashTime++;
        if (cell.flashTime > 60) cell.flashType = null;
      }
    }
  }
}

function checkAutoPlay() {
  if (autoPlay && !collapsed && !failed) {
    autoPlayTimer = 0;
  }
}

function triggerStep() {
  if (collapsed || animPhase !== 'idle') return;

  if (failed) {
    initGrid();
    return;
  }

  let result = wfcStep();

  if (result.type === 'complete') {
    animPhase = 'complete';
    collapsed = true;
    if (autoPlay) {
      autoPlay = false;
      updateButtonStates();
    }
    return;
  }

  if (result.type === 'fail') {
    stepData = result;
    animPhase = 'failed';
    animProgress = 0;
    if (result.cell) {
      result.cell.flashType = 'fail';
      result.cell.flashTime = 0;
    }
    return;
  }

  stepData = result;
  animPhase = 'selecting';
  animProgress = 0;
}

// ============================================================
// Drawing
// ============================================================

function drawCell(cell, px, py, size) {
  let isHovered = hoveredCell === cell;

  if (cell.collapsed) {
    drawTile(px, py, size, cell.tile, cell.x, cell.y);
  } else {
    drawSuperposition(cell, px, py, size);
  }

  if (manualCells.has(`${cell.x},${cell.y}`)) {
    fill(COL_SELECT[0], COL_SELECT[1], COL_SELECT[2], 180);
    noStroke();
    ellipse(px + CELL_SIZE - 5, py + 5, 4, 4);
  }

  if (isHovered) {
    noFill();
    stroke(255, 255, 255, 80);
    strokeWeight(2);
    rect(px + 1, py + 1, size - 2, size - 2, 2);
  }
}

function drawTile(px, py, size, tileIdx, gx, gy) {
  let tile = TILES[tileIdx];

  // Image tile (custom tileset)
  if (tile.img) {
    noStroke();
    image(tile.img, px, py, size, size);
    return;
  }

  // Procedural tile (pipes)
  let cx = px + size / 2;
  let cy = py + size / 2;
  let half = size / 2;
  let pw = size * 0.22;

  noStroke();
  fill(COL_CELL_BG);
  rect(px, py, size, size);

  let hasAnyEdge = tile.edges.some(e => e !== 0);
  if (!hasAnyEdge) return;

  let hue = map(gx + gy, 0, GRID_COLS + GRID_ROWS - 2, 0, 1);
  let r = lerp(COL_PATH[0], 0, hue * 0.5);
  let g = lerp(COL_PATH[1], 180, hue);
  let b = lerp(COL_PATH[2], 255, hue * 0.3);

  fill(r, g, b);
  noStroke();
  ellipse(cx, cy, pw, pw);

  if (tile.edges[0] !== 0) rect(cx - pw / 2, py, pw, half);
  if (tile.edges[1] !== 0) rect(cx, cy - pw / 2, half, pw);
  if (tile.edges[2] !== 0) rect(cx - pw / 2, cy, pw, half);
  if (tile.edges[3] !== 0) rect(px, cy - pw / 2, half, pw);

  if (tile.edges[0] !== 0 && tile.edges[1] !== 0) ellipse(cx, cy, pw * 1.1, pw * 1.1);
  if (tile.edges[1] !== 0 && tile.edges[2] !== 0) ellipse(cx, cy, pw * 1.1, pw * 1.1);
  if (tile.edges[2] !== 0 && tile.edges[3] !== 0) ellipse(cx, cy, pw * 1.1, pw * 1.1);
  if (tile.edges[3] !== 0 && tile.edges[0] !== 0) ellipse(cx, cy, pw * 1.1, pw * 1.1);
}

function drawSuperposition(cell, px, py, size) {
  noStroke();
  fill(COL_CELL_BG);
  rect(px, py, size, size);

  if (cell.options.size === 0) return;

  let alpha = map(cell.options.size, 1, TILES.length, 120, 25);
  let hasImages = TILES[0] && TILES[0].img;

  if (hasImages) {
    // Draw faded image previews (cap to avoid rendering 81+ images per cell)
    const MAX_PREVIEW = 5;
    let count = 0;
    push();
    tint(255, alpha);
    for (let opt of cell.options) {
      if (TILES[opt].img) {
        image(TILES[opt].img, px, py, size, size);
        if (++count >= MAX_PREVIEW) break;
      }
    }
    noTint();
    pop();
  } else {
    // Procedural superposition preview
    let cx = px + size / 2;
    let cy = py + size / 2;
    let pw = size * 0.22;
    let hue = map(cell.x + cell.y, 0, GRID_COLS + GRID_ROWS - 2, 0, 1);
    let r = lerp(COL_PATH[0], 0, hue * 0.5);
    let g = lerp(COL_PATH[1], 180, hue);
    let b = lerp(COL_PATH[2], 255, hue * 0.3);

    for (let opt of cell.options) {
      let tile = TILES[opt];
      let hasAnyEdge = tile.edges.some(e => e !== 0);
      if (!hasAnyEdge) continue;

      fill(r, g, b, alpha);
      noStroke();
      if (tile.edges[0] !== 0) rect(cx - pw / 4, py + size * 0.15, pw / 2, size * 0.35);
      if (tile.edges[1] !== 0) rect(cx + size * 0.15, cy - pw / 4, size * 0.35, pw / 2);
      if (tile.edges[2] !== 0) rect(cx - pw / 4, cy + size * 0.15, pw / 2, size * 0.35);
      if (tile.edges[3] !== 0) rect(px + size * 0.15, cy - pw / 4, size * 0.35, pw / 2);
    }
  }

  if (debugView) {
    fill(200, 200, 255, 180);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(9);
    text(cell.options.size.toString(), px + size / 2, py + size / 2);
  }
}

function drawOverlays() {
  if (showEntropy) {
    let maxE = (totalWeight > 0) ? Math.log2(totalWeight) - totalWeightLogWeight / totalWeight : 1;
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        let cell = grid[y][x];
        if (cell.collapsed) continue;
        let e = cell.entropy();
        let t = constrain(e / (maxE || 1), 0, 1);
        let r = lerp(20, 255, t);
        let g = lerp(40, 230, t);
        let b = lerp(120, 50, t);
        fill(r, g, b, 60);
        noStroke();
        rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  if (animPhase === 'selecting' && stepData && stepData.cell) {
    let cell = stepData.cell;
    let px = cell.x * CELL_SIZE;
    let py = cell.y * CELL_SIZE;
    let pulse = sin(animProgress * PI) * 0.6 + 0.4;
    noFill();
    stroke(COL_SELECT[0], COL_SELECT[1], COL_SELECT[2], 200 * pulse);
    strokeWeight(3);
    rect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
  }

  if (animPhase === 'collapsing' && stepData && stepData.cell) {
    let cell = stepData.cell;
    let px = cell.x * CELL_SIZE;
    let py = cell.y * CELL_SIZE;
    let pulse = sin(animProgress * PI);
    fill(COL_COLLAPSE[0], COL_COLLAPSE[1], COL_COLLAPSE[2], 80 * pulse);
    noStroke();
    rect(px, py, CELL_SIZE, CELL_SIZE, 3);
  }

  if (animPhase === 'propagating' && stepData && stepData.affectedCells) {
    for (let [cell, info] of stepData.affectedCells) {
      let revealAt = info.dist * 0.15;
      let localProgress = animProgress - revealAt;
      if (localProgress < 0) continue;
      let fade = constrain(1 - localProgress * 1.5, 0, 1);
      let px = cell.x * CELL_SIZE;
      let py = cell.y * CELL_SIZE;
      fill(COL_RIPPLE[0], COL_RIPPLE[1], COL_RIPPLE[2], 70 * fade);
      noStroke();
      rect(px, py, CELL_SIZE, CELL_SIZE, 2);
    }
  }

  if (animPhase === 'failed' && failedCell) {
    let pulse = sin(animProgress * PI * 4) * 0.5 + 0.5;
    let px = failedCell.x * CELL_SIZE;
    let py = failedCell.y * CELL_SIZE;
    fill(COL_FAIL[0], COL_FAIL[1], COL_FAIL[2], 150 * pulse);
    noStroke();
    rect(px, py, CELL_SIZE, CELL_SIZE, 3);
    stroke(COL_FAIL[0], COL_FAIL[1], COL_FAIL[2], 200 * pulse);
    strokeWeight(2);
    let m = 8;
    line(px + m, py + m, px + CELL_SIZE - m, py + CELL_SIZE - m);
    line(px + CELL_SIZE - m, py + m, px + m, py + CELL_SIZE - m);
  }

  if (invalidFlash) {
    invalidFlash.timer--;
    let pulse = sin(invalidFlash.timer * 0.3) * 0.5 + 0.5;
    let px = invalidFlash.x * CELL_SIZE;
    let py = invalidFlash.y * CELL_SIZE;
    noFill();
    stroke(COL_FAIL[0], COL_FAIL[1], COL_FAIL[2], 200 * pulse);
    strokeWeight(2.5);
    rect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4, 3);
    if (invalidFlash.timer <= 0) invalidFlash = null;
  }
}

// ============================================================
// Hover & Info Panel
// ============================================================

function updateHover() {
  let mx = mouseX;
  let my = mouseY;
  if (mx < 0 || mx >= CANVAS_W || my < 0 || my >= CANVAS_H) {
    if (hoveredCell !== null) {
      hoveredCell = null;
      updateInfoPanel(null);
    }
    return;
  }
  let gx = Math.floor(mx / CELL_SIZE);
  let gy = Math.floor(my / CELL_SIZE);
  gx = constrain(gx, 0, GRID_COLS - 1);
  gy = constrain(gy, 0, GRID_ROWS - 1);
  let cell = grid[gy][gx];
  if (cell !== hoveredCell) {
    hoveredCell = cell;
    updateInfoPanel(cell);
  }
}

function updateInfoPanel(cell) {
  let panel = document.getElementById('info-panel');
  if (!cell) {
    panel.innerHTML = '<p class="info-placeholder">Hover over a cell to see its state</p>';
    return;
  }

  let html = '';
  html += `<span class="info-label">Cell:</span> <span class="info-value">(${cell.x}, ${cell.y})</span>`;

  if (cell.collapsed) {
    let manual = manualCells.has(`${cell.x},${cell.y}`);
    html += ` &nbsp; <span class="info-label">Tile:</span> <span class="info-value">${TILES[cell.tile].name}${manual ? ' (placed)' : ''}</span>`;
    if (cornerMode && TILES[cell.tile].corners) {
      let c = TILES[cell.tile].corners;
      html += ` &nbsp; <span class="info-label">Corners:</span> <span class="info-value">NE:${c[0]} SE:${c[1]} SW:${c[2]} NW:${c[3]}</span>`;
    } else {
      html += ` &nbsp; <span class="info-label">Edges:</span> <span class="info-value">[${TILES[cell.tile].edges.join(',')}]</span>`;
    }
  } else {
    let e = cell.entropy();
    html += ` &nbsp; <span class="info-label">Options:</span> <span class="info-value">${cell.options.size}/${TILES.length}</span>`;
    html += ` &nbsp; <span class="info-label">Entropy:</span> <span class="info-value">${e.toFixed(2)}</span>`;
    let names = [...cell.options].map(i => TILES[i].name).join(', ');
    html += `<br><span class="info-label">Possible:</span> <span class="info-value" style="font-size:0.75rem">${names}</span>`;
    if (selectedTileIdx >= 0) {
      let canPlace = cell.options.has(selectedTileIdx);
      html += `<br><span class="info-label">Selected tile:</span> <span class="info-value" style="color:${canPlace ? '#5ddb6a' : '#ff5555'}">${TILES[selectedTileIdx].name} — ${canPlace ? 'valid here' : 'not compatible'}</span>`;
    }
  }

  panel.innerHTML = `<p>${html}</p>`;
}

// ============================================================
// Tile Picker & Manual Placement
// ============================================================

function buildTilePicker() {
  let container = document.getElementById('tile-picker-grid');
  container.innerHTML = '';

  for (let i = 0; i < TILES.length; i++) {
    let btn = document.createElement('button');
    btn.className = 'tile-pick';
    btn.title = TILES[i].name;

    if (TILES[i].img) {
      // Custom tile — use uploaded image
      let imgEl = document.createElement('img');
      imgEl.src = TILES[i].img.canvas ? TILES[i].img.canvas.toDataURL() : '';
      // Try the dataUrl from customTileData
      let ctd = customTileData.find(t => t.name === TILES[i].name);
      if (ctd && ctd.dataUrl) imgEl.src = ctd.dataUrl;
      imgEl.alt = TILES[i].name;
      btn.appendChild(imgEl);
    } else {
      // Procedural tile — render preview
      let pg = createGraphics(36, 36);
      drawTileToGraphics(pg, i, 36);
      let dataUrl = pg.canvas.toDataURL();
      pg.remove();
      let imgEl = document.createElement('img');
      imgEl.src = dataUrl;
      imgEl.alt = TILES[i].name;
      btn.appendChild(imgEl);
    }

    btn.addEventListener('click', () => selectTile(i));
    container.appendChild(btn);
  }

  // Re-bind deselect (in case DOM was rebuilt)
  let deselectBtn = document.getElementById('btn-deselect');
  let newBtn = deselectBtn.cloneNode(true);
  deselectBtn.parentNode.replaceChild(newBtn, deselectBtn);
  newBtn.addEventListener('click', () => selectTile(-1));
  newBtn.disabled = true;
}

function drawTileToGraphics(pg, tileIdx, size) {
  let tile = TILES[tileIdx];
  let cx = size / 2;
  let cy = size / 2;
  let half = size / 2;
  let pw = size * 0.22;

  pg.noStroke();
  pg.fill(COL_CELL_BG[0], COL_CELL_BG[1], COL_CELL_BG[2]);
  pg.rect(0, 0, size, size);

  let hasAnyEdge = tile.edges.some(e => e !== 0);
  if (!hasAnyEdge) return;

  pg.fill(COL_PATH[0], COL_PATH[1], COL_PATH[2]);
  pg.noStroke();
  pg.ellipse(cx, cy, pw, pw);

  if (tile.edges[0] !== 0) pg.rect(cx - pw / 2, 0, pw, half);
  if (tile.edges[1] !== 0) pg.rect(cx, cy - pw / 2, half, pw);
  if (tile.edges[2] !== 0) pg.rect(cx - pw / 2, cy, pw, half);
  if (tile.edges[3] !== 0) pg.rect(0, cy - pw / 2, half, pw);
}

function selectTile(idx) {
  selectedTileIdx = (selectedTileIdx === idx) ? -1 : idx;
  let btns = document.querySelectorAll('.tile-pick');
  btns.forEach((btn, i) => btn.classList.toggle('selected', i === selectedTileIdx));
  document.getElementById('btn-deselect').disabled = selectedTileIdx === -1;

  let cnv = document.querySelector('#canvas-container canvas');
  cnv.style.cursor = selectedTileIdx >= 0 ? 'crosshair' : 'default';
}

function mousePressed() {
  if (selectedTileIdx < 0) return;
  if (autoPlay) return;
  if (animPhase !== 'idle') return;

  let mx = mouseX;
  let my = mouseY;
  if (mx < 0 || mx >= CANVAS_W || my < 0 || my >= CANVAS_H) return;

  let gx = Math.floor(mx / CELL_SIZE);
  let gy = Math.floor(my / CELL_SIZE);
  gx = constrain(gx, 0, GRID_COLS - 1);
  gy = constrain(gy, 0, GRID_ROWS - 1);

  let cell = grid[gy][gx];

  if (cell.collapsed) {
    invalidFlash = { x: gx, y: gy, timer: 30 };
    return;
  }

  if (!cell.options.has(selectedTileIdx)) {
    invalidFlash = { x: gx, y: gy, timer: 30 };
    return;
  }

  cell.tile = selectedTileIdx;
  cell.options = new Set([selectedTileIdx]);
  cell.collapsed = true;
  cell.flashType = 'collapse';
  cell.flashTime = 0;
  manualCells.add(`${gx},${gy}`);

  let affectedCells = propagate(gx, gy);

  if (failed) {
    stepData = { cell, affectedCells, maxDist: 0 };
    animPhase = 'failed';
    animProgress = 0;
    if (failedCell) {
      failedCell.flashType = 'fail';
      failedCell.flashTime = 0;
    }
    return;
  }

  let maxDist = 0;
  for (let [, info] of affectedCells) {
    if (info.dist > maxDist) maxDist = info.dist;
  }
  if (maxDist > 0) {
    stepData = { cell, affectedCells, maxDist };
    animPhase = 'propagating';
    animProgress = 0;
    for (let [c, info] of affectedCells) {
      c.flashType = 'propagate';
      c.flashTime = 0;
      c.propagateDist = info.dist;
    }
  }

  let allCollapsed = true;
  for (let row of grid) for (let c of row) if (!c.collapsed) { allCollapsed = false; break; }
  if (allCollapsed) {
    collapsed = true;
    animPhase = 'complete';
  }
}

// ============================================================
// UI Controls
// ============================================================

function bindControls() {
  document.getElementById('btn-play').addEventListener('click', () => {
    autoPlay = true;
    autoPlayTimer = 10;
    updateButtonStates();
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    autoPlay = false;
    updateButtonStates();
  });

  document.getElementById('btn-step').addEventListener('click', () => {
    autoPlay = false;
    updateButtonStates();
    triggerStep();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    autoPlay = false;
    updateButtonStates();
    initGrid();
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    saveCanvas('wfc-' + GRID_COLS + 'x' + GRID_ROWS, 'png');
  });

  document.getElementById('speed').addEventListener('input', (e) => {
    animSpeed = parseInt(e.target.value);
  });

  document.getElementById('show-entropy').addEventListener('change', (e) => {
    showEntropy = e.target.checked;
  });

  document.getElementById('debug-view').addEventListener('change', (e) => {
    debugView = e.target.checked;
  });

  document.getElementById('show-grid').addEventListener('change', (e) => {
    showGrid = e.target.checked;
  });

  document.getElementById('grid-width').addEventListener('change', () => {
    autoPlay = false;
    updateButtonStates();
    updateGridSize(parseInt(document.getElementById('grid-width').value), parseInt(document.getElementById('grid-height').value));
  });

  document.getElementById('grid-height').addEventListener('change', () => {
    autoPlay = false;
    updateButtonStates();
    updateGridSize(parseInt(document.getElementById('grid-width').value), parseInt(document.getElementById('grid-height').value));
  });

  // Tileset switcher
  document.querySelectorAll('.tileset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      autoPlay = false;
      updateButtonStates();
      loadTileset(btn.dataset.tileset);
    });
  });

  // Custom tile upload
  document.getElementById('tile-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleTileUpload(e.target.files);
    }
  });

  // Wang 2-edge atlas import
  document.getElementById('wang-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleWangImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Wang 2-corner atlas import
  document.getElementById('wang-corner-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleWangCornerImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Wang 3-edge atlas import
  document.getElementById('wang-3e-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleWang3eImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Wang 3-corner atlas import
  document.getElementById('wang-3c-upload').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleWang3cImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Example atlas thumbnails
  document.querySelectorAll('.atlas-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      let type = thumb.dataset.atlas;
      let imgSrc = thumb.querySelector('img').src;

      // Switch to custom tileset
      document.querySelectorAll('.tileset-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tileset="custom"]').classList.add('active');
      document.getElementById('custom-editor').hidden = false;
      currentTilesetName = 'custom';

      // Highlight active atlas
      document.querySelectorAll('.atlas-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');

      autoPlay = false;
      updateButtonStates();
      loadExampleAtlas(imgSrc, type);
    });
  });

  // Apply custom tileset
  document.getElementById('btn-apply-custom').addEventListener('click', () => {
    applyCustomTileset();
  });
}

function loadExampleAtlas(ignored, type) {
  let dataUrl = EXAMPLE_ATLASES[type];
  if (!dataUrl) return;
  loadImage(dataUrl, function(atlas) {
    let gridN, layoutTable, edgesFn, cornersFn, namePrefix, isCorner;
    if (type === 'wang2e') {
      gridN = 4; layoutTable = WANG_2E_LAYOUT; edgesFn = wangEdges; namePrefix = 'wang'; isCorner = false;
    } else if (type === 'wang2c') {
      gridN = 4; layoutTable = WANG_2C_LAYOUT; cornersFn = wangCorners; namePrefix = 'wang-c'; isCorner = true;
    } else if (type === 'wang3e') {
      gridN = 9; layoutTable = WANG_3E_LAYOUT; edgesFn = wang3eEdges; namePrefix = 'wang3e'; isCorner = false;
    } else if (type === 'wang3c') {
      gridN = 9; layoutTable = WANG_3C_LAYOUT; cornersFn = wang3cCorners; namePrefix = 'wang3c'; isCorner = true;
    }

    let tileW = Math.floor(atlas.width / gridN);
    let tileH = Math.floor(atlas.height / gridN);
    let tilesByIdx = [];

    for (let row = 0; row < gridN; row++) {
      for (let col = 0; col < gridN; col++) {
        let wangIdx = layoutTable[row][col];
        let subImg = atlas.get(col * tileW, row * tileH, tileW, tileH);

        let tile = {
          wangIdx,
          name: `${namePrefix}-${wangIdx}`,
          weight: 1,
          img: subImg,
          dataUrl: null
        };

        if (isCorner) {
          tile.corners = cornersFn(wangIdx);
          tile.edges = null;
        } else {
          tile.edges = edgesFn(wangIdx);
        }

        tilesByIdx.push(tile);
      }
    }

    // Generate dataUrls in a second pass (avoids tainted canvas issues)
    for (let t of tilesByIdx) {
      try {
        let pg = createGraphics(tileW, tileH);
        pg.image(t.img, 0, 0, tileW, tileH);
        t.dataUrl = pg.canvas.toDataURL();
        pg.remove();
      } catch (e) {
        // Fallback: use the atlas data URL itself
        t.dataUrl = dataUrl;
      }
    }

    tilesByIdx.sort((a, b) => a.wangIdx - b.wangIdx);
    customTileData = tilesByIdx;
    cornerMode = isCorner;

    let preview = document.getElementById('wang-preview');
    preview.hidden = false;
    document.getElementById('wang-preview-img').src = dataUrl;
    let totalTiles = gridN * gridN;
    let mode = isCorner ? 'corner' : 'edge';
    let n = gridN === 4 ? 2 : 3;
    document.querySelector('.wang-preview-label').textContent = `${totalTiles} tiles extracted with ${n}-${mode} constraints`;

    buildEdgeEditor();
    applyCustomTileset();
  });
}

function updateButtonStates() {
  document.getElementById('btn-play').disabled = autoPlay;
  document.getElementById('btn-pause').disabled = !autoPlay;
  document.getElementById('btn-step').disabled = autoPlay || collapsed;
}
