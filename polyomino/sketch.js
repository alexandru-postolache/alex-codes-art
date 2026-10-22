/*
  Modes:

  "ALL_3X3"
      Generate all unique 3×3 partitions.

  "RANDOM_ONE"
      Generate one random partition at the chosen grid size.

  The Tweakpane panel edits these settings live.
  "Any count" chooses a valid region count at random.
  "Look" chooses an outline or a shader material.
  The choices live in looks.js.
*/

const RANDOM_CANVAS = 700;

const MAX_GRID_SIZE = 12;

const params = {
  mode: "RANDOM_ONE",

  // Used only in RANDOM_ONE mode.
  gridSize: 5,

  /*
    anyCount chooses a valid region count at random.
    Otherwise regionCount must allow distinct positive sizes.
  */
  anyCount: true,
  regionCount: 4,

  // Same seed reproduces the same random partition.
  seed: Math.floor(Math.random() * 1000000),

  // Layout for ALL_3X3.
  columns: 5,
  tileSize: 105,
  pageMargin: 35,
  shapeSize: 66,

  // Drawing. Shader presets live on each entry in POLYOMINO_LOOKS.
  look: "liquidGlass",
  outlineColor: "#292932",
  backgroundColor: "#eeeae1",
  strokeWidth: 2.2,
  tint: "#f4f7fb",
  refraction: 0.85,
  softness: 0.28,
  shine: 0.9,

  // Measured relative to one grid cell.
  regionInset: 0.095,

  // Measured in pixels. Random mode scales the shape
  // by this fraction of the canvas.
  cornerRadius: 20,
  shapeScale: 0.72
};

// Active grid size. ALL_3X3 always uses 3.
let gridSize = params.gridSize;

let partitions = [];
let catalogPartitions = null;

let pane;
let generationFolder;
let regionInput;
let seedInput;
let layoutFolder;
let scaleInput;
let summaryMonitor;
let outlineInput;
let strokeInput;
let materialFolder;
let refractionInput;

let maskLayer;
let edgeLayer;
let sceneLayer;
let sceneSoftLayer;
let shadeLayer;
let lookShader;
let activeLookId = "liquidGlass";

const readout = {
  summary: ""
};

function setup() {
  const canvas = createCanvas(
    RANDOM_CANVAS,
    RANDOM_CANVAS
  );

  canvas.parent("sketch");
  pixelDensity(2);

  noLoop();
  setupPane();
  rebuild(true);
}

function draw() {
  document.body.style.background =
    cssColor(params.backgroundColor);

  if (partitions.length === 0) {
    background(cssColor(params.backgroundColor));
    return;
  }

  const look = polyominoLook(params.look);

  if (!look || look.kind === "stroke") {
    background(cssColor(params.backgroundColor));
    paintPartitions(drawingContext, "stroke");
    return;
  }

  renderShaderLook(look);
}

function paintPartitions(target, style) {
  if (params.mode === "ALL_3X3") {
    for (let i = 0; i < partitions.length; i++) {
      const col = i % params.columns;
      const row = floor(i / params.columns);

      const centerX =
        params.pageMargin +
        col * params.tileSize +
        params.tileSize / 2;

      const centerY =
        params.pageMargin +
        row * params.tileSize +
        params.tileSize / 2;

      drawPartition(
        partitions[i],
        centerX,
        centerY,
        params.shapeSize,
        style,
        target
      );
    }

    return;
  }

  drawPartition(
    partitions[0],
    width / 2,
    height / 2,
    min(width, height) * params.shapeScale,
    style,
    target
  );
}

function bevelWidth() {
  const shapePx =
    params.mode === "ALL_3X3"
      ? params.shapeSize
      : min(width, height) * params.shapeScale;

  const cells = params.mode === "ALL_3X3" ? 3 : gridSize;
  const cell = shapePx / max(cells, 1);
  const lip = constrain(cell * 0.38, 14, 26);

  return lip * pixelDensity();
}

function ensureShadeLayers() {
  const density = pixelDensity();

  if (
    maskLayer &&
    edgeLayer &&
    sceneLayer &&
    sceneSoftLayer &&
    shadeLayer &&
    lookShader &&
    maskLayer.width === width &&
    maskLayer.height === height
  ) {
    return;
  }

  if (maskLayer) {
    maskLayer.remove();
  }

  if (edgeLayer) {
    edgeLayer.remove();
  }

  if (sceneLayer) {
    sceneLayer.remove();
  }

  if (sceneSoftLayer) {
    sceneSoftLayer.remove();
  }

  if (shadeLayer) {
    shadeLayer.remove();
  }

  maskLayer = createGraphics(width, height);
  edgeLayer = createGraphics(width, height);
  sceneLayer = createGraphics(width, height);
  sceneSoftLayer = createGraphics(width, height);
  maskLayer.pixelDensity(density);
  edgeLayer.pixelDensity(density);
  sceneLayer.pixelDensity(density);
  sceneSoftLayer.pixelDensity(density);

  shadeLayer = createGraphics(width, height, WEBGL);
  shadeLayer.pixelDensity(density);

  lookShader = shadeLayer.createShader(
    POLYOMINO_LOOK_VERTEX,
    POLYOMINO_LOOK_FRAGMENT
  );
}

function blurGraphics(source, target, radiusPx) {
  const ctx = target.drawingContext;
  const bufferWidth = source.canvas.width;
  const bufferHeight = source.canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bufferWidth, bufferHeight);
  ctx.filter = `blur(${Math.max(radiusPx, 0.5)}px)`;
  ctx.drawImage(source.canvas, 0, 0);
  ctx.filter = "none";
}

function paintGlassScene(layer) {
  const ctx = layer.drawingContext;
  const bufferWidth = layer.canvas.width;
  const bufferHeight = layer.canvas.height;
  const minSide = Math.min(bufferWidth, bufferHeight);
  const paper = cssColor(params.backgroundColor);

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const gradient = ctx.createLinearGradient(
    0,
    0,
    bufferWidth,
    bufferHeight * 0.9
  );
  gradient.addColorStop(0, "#f6c7ae");
  gradient.addColorStop(0.38, paper);
  gradient.addColorStop(1, "#b7d0ef");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, bufferWidth, bufferHeight);

  const blobs = [
    [0.14, 0.18, 0.36, "#4f9fe8"],
    [0.86, 0.14, 0.28, "#ef7d55"],
    [0.74, 0.8, 0.4, "#63b890"],
    [0.16, 0.84, 0.3, "#f3a9b8"],
    [0.48, 0.4, 0.18, "#fff4e4"],
    [0.58, 0.62, 0.11, "#f0c85a"]
  ];

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    ctx.beginPath();
    ctx.fillStyle = blob[3];
    ctx.arc(
      blob[0] * bufferWidth,
      blob[1] * bufferHeight,
      blob[2] * minSide,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function renderShaderLook(look) {
  ensureShadeLayers();

  maskLayer.background(0);
  paintPartitions(maskLayer.drawingContext, "fill");
  paintGlassScene(sceneLayer);

  const bevel = bevelWidth();
  const frost = look.mode < 0.5
    ? Math.max(8, bevel * (0.22 + params.softness * 0.35))
    : bevel * (0.9 + params.softness * 1.4);

  blurGraphics(maskLayer, edgeLayer, bevel * 0.55);
  blurGraphics(sceneLayer, sceneSoftLayer, frost);

  shadeLayer.shader(lookShader);
  lookShader.setUniform("uMask", maskLayer);
  lookShader.setUniform("uEdge", edgeLayer);
  lookShader.setUniform("uScene", sceneLayer);
  lookShader.setUniform("uSceneSoft", sceneSoftLayer);
  lookShader.setUniform("uResolution", [
    width * pixelDensity(),
    height * pixelDensity()
  ]);
  lookShader.setUniform(
    "uPaper",
    colorUnit(params.backgroundColor)
  );
  lookShader.setUniform(
    "uGlassTint",
    colorUnit(params.tint)
  );
  lookShader.setUniform(
    "uRefraction",
    params.refraction
  );
  lookShader.setUniform("uSoftness", params.softness);
  lookShader.setUniform("uShine", params.shine);
  lookShader.setUniform("uMode", look.mode);
  lookShader.setUniform("uSpread", bevel);

  shadeLayer.clear();
  shadeLayer.noStroke();
  shadeLayer.rectMode(CENTER);
  shadeLayer.rect(0, 0, width, height);

  background(cssColor(params.backgroundColor));
  image(shadeLayer, 0, 0, width, height);
}

function colorUnit(value) {
  const paint = color(cssColor(value));

  return [
    red(paint) / 255,
    green(paint) / 255,
    blue(paint) / 255
  ];
}

function keyPressed() {
  const target = document.activeElement;

  if (
    target &&
    (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA"
    )
  ) {
    return;
  }

  // Generate another random partition.
  if (
    params.mode === "RANDOM_ONE" &&
    (key === "r" || key === "R")
  ) {
    randomizePartition();
  }

  if (key === "s" || key === "S") {
    savePartition();
  }
}

function activeGridSize() {
  if (params.mode === "ALL_3X3") {
    return 3;
  }

  return params.gridSize;
}

/*
  For k regions to have distinct positive sizes,
  the smallest possible total is:

    1 + 2 + 3 + ... + k

  which equals:

    k * (k + 1) / 2
*/
function maximumRegionCount(size) {
  const cellCount = size * size;

  return floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );
}

function savePartition() {
  const name =
    params.mode === "ALL_3X3"
      ? "partitions-3x3"
      : `partition-${gridSize}x${gridSize}`;

  saveCanvas(name, "png");
}

function randomizePartition() {
  params.seed = floor(Math.random() * 1000000);

  if (seedInput) {
    seedInput.refresh();
  }

  rebuild(true);
}

/* =========================================================
   CONTROLS
   ========================================================= */

const DRAWING_KEYS = new Set([
  "outlineColor",
  "backgroundColor",
  "strokeWidth",
  "tint",
  "refraction",
  "softness",
  "shine",
  "regionInset",
  "cornerRadius",
  "shapeScale"
]);

const LAYOUT_KEYS = new Set([
  "columns",
  "tileSize",
  "pageMargin",
  "shapeSize"
]);

const STRUCTURAL_KEYS = new Set([
  "mode",
  "gridSize",
  "anyCount",
  "regionCount",
  "seed"
]);

function setupPane() {
  const container =
    document.getElementById("controls");

  pane = new Tweakpane.Pane({
    container,
    title: "Polyomino"
  });

  pane.addInput(params, "mode", {
    label: "mode",
    options: {
      "One random": "RANDOM_ONE",
      "All 3×3": "ALL_3X3"
    }
  });

  generationFolder = pane.addFolder({
    title: "Generation"
  });

  generationFolder.addInput(params, "gridSize", {
    label: "grid size",
    min: 2,
    max: MAX_GRID_SIZE,
    step: 1
  });

  generationFolder.addInput(params, "anyCount", {
    label: "any count"
  });

  regionInput = generationFolder.addInput(
    params,
    "regionCount",
    {
      label: "regions",
      min: 2,
      max: maximumRegionCount(MAX_GRID_SIZE),
      step: 1
    }
  );

  regionInput.maxValue = maximumRegionCount(
    params.gridSize
  );

  seedInput = generationFolder.addInput(
    params,
    "seed",
    {
      label: "seed",
      min: 0,
      max: 999999,
      step: 1
    }
  );

  generationFolder.addButton({
    title: "New partition"
  }).on("click", () => {
    randomizePartition();
  });

  layoutFolder = pane.addFolder({
    title: "Layout"
  });

  layoutFolder.addInput(params, "columns", {
    label: "columns",
    min: 1,
    max: 10,
    step: 1
  });

  layoutFolder.addInput(params, "tileSize", {
    label: "tile size",
    min: 70,
    max: 180,
    step: 1
  });

  layoutFolder.addInput(params, "pageMargin", {
    label: "margin",
    min: 0,
    max: 80,
    step: 1
  });

  layoutFolder.addInput(params, "shapeSize", {
    label: "shape size",
    min: 24,
    max: 150,
    step: 1
  });

  const drawingFolder = pane.addFolder({
    title: "Drawing"
  });

  const lookOptions = {};

  for (let i = 0; i < POLYOMINO_LOOKS.length; i++) {
    lookOptions[POLYOMINO_LOOKS[i].label] =
      POLYOMINO_LOOKS[i].id;
  }

  drawingFolder.addInput(params, "look", {
    label: "look",
    options: lookOptions
  });

  drawingFolder.addInput(params, "backgroundColor", {
    label: "background"
  });

  outlineInput = drawingFolder.addInput(
    params,
    "outlineColor",
    {
      label: "outline"
    }
  );

  strokeInput = drawingFolder.addInput(
    params,
    "strokeWidth",
    {
      label: "stroke",
      min: 0.5,
      max: 16,
      step: 0.1
    }
  );

  materialFolder = drawingFolder.addFolder({
    title: "Material"
  });

  materialFolder.addInput(params, "tint", {
    label: "tint"
  });

  refractionInput = materialFolder.addInput(
    params,
    "refraction",
    {
      label: "refraction",
      min: 0,
      max: 1,
      step: 0.01
    }
  );

  materialFolder.addInput(params, "softness", {
    label: "softness",
    min: 0,
    max: 1,
    step: 0.01
  });

  materialFolder.addInput(params, "shine", {
    label: "shine",
    min: 0,
    max: 1,
    step: 0.01
  });

  drawingFolder.addInput(params, "regionInset", {
    label: "inset",
    min: 0,
    max: 0.35,
    step: 0.005
  });

  drawingFolder.addInput(params, "cornerRadius", {
    label: "corners",
    min: 0,
    max: 80,
    step: 1
  });

  scaleInput = drawingFolder.addInput(
    params,
    "shapeScale",
    {
      label: "scale",
      min: 0.35,
      max: 0.92,
      step: 0.01
    }
  );

  summaryMonitor = pane.addMonitor(
    readout,
    "summary",
    {
      label: "sizes",
      interval: 0
    }
  );

  pane.addButton({
    title: "Save PNG"
  }).on("click", () => {
    savePartition();
  });

  pane.on("change", (event) => {
    const presetKey = event.presetKey;

    if (!presetKey) {
      return;
    }

    if (presetKey === "look") {
      rememberLook(activeLookId);
      activeLookId = params.look;
      applyLookPreset(params.look);
      updateLookVisibility();
      draw();
      return;
    }

    if (DRAWING_KEYS.has(presetKey)) {
      draw();
      return;
    }

    // Sliders apply structural changes on release.
    if (event.last === false) {
      return;
    }

    if (presetKey === "gridSize") {
      clampRegionCount();
    }

    if (presetKey === "anyCount") {
      updateRegionCountAvailability();
    }

    if (STRUCTURAL_KEYS.has(presetKey)) {
      rebuild(true);
      return;
    }

    if (LAYOUT_KEYS.has(presetKey)) {
      fitCanvas();
    }
  });
}

function clampRegionCount() {
  const max = maximumRegionCount(params.gridSize);

  if (regionInput) {
    regionInput.maxValue = max;
  }

  if (params.regionCount > max) {
    params.regionCount = max;

    if (regionInput) {
      regionInput.refresh();
    }
  }

  if (params.regionCount < 2) {
    params.regionCount = 2;

    if (regionInput) {
      regionInput.refresh();
    }
  }
}

function rememberLook(id) {
  const look = polyominoLook(id);

  if (!look || look.kind !== "shader") {
    return;
  }

  look.tint = params.tint;
  look.refraction = params.refraction;
  look.softness = params.softness;
  look.shine = params.shine;
}

function applyLookPreset(id) {
  const look = polyominoLook(id);

  if (!look || look.kind !== "shader") {
    return;
  }

  params.tint = look.tint;
  params.refraction = look.refraction;
  params.softness = look.softness;
  params.shine = look.shine;

  if (pane) {
    pane.refresh();
  }
}

function updateLookVisibility() {
  const look = polyominoLook(params.look);
  const shaderLook = look && look.kind === "shader";

  if (outlineInput) {
    outlineInput.hidden = shaderLook;
  }

  if (strokeInput) {
    strokeInput.hidden = shaderLook;
  }

  if (materialFolder) {
    materialFolder.hidden = !shaderLook;
  }

  if (refractionInput) {
    refractionInput.hidden =
      !shaderLook || look.id === "enamel";
  }
}

function updateRegionCountAvailability() {
  if (regionInput) {
    regionInput.disabled = params.anyCount;
  }
}

function updatePaneVisibility() {
  const randomMode = params.mode === "RANDOM_ONE";

  if (generationFolder) {
    generationFolder.hidden = !randomMode;
  }

  if (layoutFolder) {
    layoutFolder.hidden = randomMode;
  }

  if (scaleInput) {
    scaleInput.hidden = !randomMode;
  }

  updateRegionCountAvailability();
  updateLookVisibility();

  if (summaryMonitor) {
    summaryMonitor.label = randomMode
      ? "sizes"
      : "count";
  }
}

function rebuild(regenerate) {
  const nextGridSize = activeGridSize();

  if (params.mode === "ALL_3X3") {
    gridSize = 3;

    if (!catalogPartitions) {
      catalogPartitions = generatePartitions();

      catalogPartitions.sort((a, b) =>
        canonicalForm(a).localeCompare(
          canonicalForm(b)
        )
      );
    }

    partitions = catalogPartitions;
    readout.summary =
      `${partitions.length} unique partitions`;
  } else if (
    regenerate ||
    partitions.length !== 1 ||
    partitions[0].length !== nextGridSize * nextGridSize
  ) {
    const previousGridSize = gridSize;
    const previousPartitions = partitions;

    gridSize = nextGridSize;

    try {
      const requested = params.anyCount
        ? null
        : params.regionCount;

      const next = generateRandomUnequalPartition(
        gridSize,
        requested
      );

      partitions = [next];

      const sizes = getRegionSizes(next)
        .slice()
        .sort((a, b) => a - b);

      readout.summary = sizes.join(", ");
      printPartitionInfo(next);
    } catch (error) {
      gridSize = previousGridSize;
      partitions = previousPartitions;
      readout.summary = "No partition found";
      console.error(error);
    }
  } else {
    gridSize = nextGridSize;

    const sizes = getRegionSizes(partitions[0])
      .slice()
      .sort((a, b) => a - b);

    readout.summary = sizes.join(", ");
  }

  updatePaneVisibility();

  if (summaryMonitor) {
    summaryMonitor.refresh();
  }

  fitCanvas();
}

function fitCanvas() {
  let nextWidth = RANDOM_CANVAS;
  let nextHeight = RANDOM_CANVAS;

  if (params.mode === "ALL_3X3") {
    const rows = ceil(
      partitions.length / params.columns
    );

    nextWidth =
      params.pageMargin * 2 +
      params.columns * params.tileSize;

    nextHeight =
      params.pageMargin * 2 +
      rows * params.tileSize;
  }

  resizeCanvas(nextWidth, nextHeight);
}

function cssColor(value) {
  if (typeof value === "string") {
    return value;
  }

  return `rgb(${value.r}, ${value.g}, ${value.b})`;
}

/* =========================================================
   PARTITION GENERATION
   ========================================================= */

/*
  Partitions are generated as restricted-growth strings.

  Example:

    0 0 0
    0 0 1
    0 2 1

  becomes:

    [0, 0, 0, 0, 0, 1, 0, 2, 1]
*/

function generatePartitions() {
  const results = [];
  const seen = new Set();

  const grid = new Array(gridSize * gridSize).fill(0);

  // The first cell always belongs to region 0.
  grid[0] = 0;

  function recurse(position, largestLabel) {
    if (position === grid.length) {
      const candidate = grid.slice();

      if (!hasUnequalRegionSizes(candidate)) {
        return;
      }

      if (!allRegionsConnected(candidate)) {
        return;
      }

      const id = canonicalForm(candidate);

      if (!seen.has(id)) {
        seen.add(id);
        results.push(candidate);
      }

      return;
    }

    /*
      Existing labels are 0 ... largestLabel.

      largestLabel + 1 creates a new region.
    */
    for (
      let label = 0;
      label <= largestLabel + 1;
      label++
    ) {
      grid[position] = label;

      recurse(
        position + 1,
        max(largestLabel, label)
      );
    }
  }

  recurse(1, 0);

  return results;
}

/* =========================================================
   VALIDATION
   ========================================================= */

function getRegionLabels(grid) {
  return [...new Set(grid)];
}

function getRegionSizes(grid) {
  const counts = new Map();

  for (const region of grid) {
    counts.set(
      region,
      (counts.get(region) || 0) + 1
    );
  }

  return [...counts.values()];
}

function hasUnequalRegionSizes(grid) {
  const sizes = getRegionSizes(grid);
  const uniqueSizes = new Set(sizes);

  return uniqueSizes.size === sizes.length;
}

function allRegionsConnected(grid) {
  const regions = getRegionLabels(grid);

  for (const region of regions) {
    if (!isRegionConnected(grid, region)) {
      return false;
    }
  }

  return true;
}

function isRegionConnected(grid, region) {
  const regionCells = [];

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === region) {
      regionCells.push(i);
    }
  }

  if (regionCells.length === 0) {
    return false;
  }

  const visited = new Set();
  const queue = [regionCells[0]];

  while (queue.length > 0) {
    const index = queue.shift();

    if (visited.has(index)) {
      continue;
    }

    visited.add(index);

    const x = index % gridSize;
    const y = floor(index / gridSize);

    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const [nx, ny] of neighbours) {
      if (!insideGrid(nx, ny)) {
        continue;
      }

      const neighbourIndex = ny * gridSize + nx;

      if (
        grid[neighbourIndex] === region &&
        !visited.has(neighbourIndex)
      ) {
        queue.push(neighbourIndex);
      }
    }
  }

  return visited.size === regionCells.length;
}

function insideGrid(x, y) {
  return (
    x >= 0 &&
    x < gridSize &&
    y >= 0 &&
    y < gridSize
  );
}

function getCell(grid, x, y) {
  if (!insideGrid(x, y)) {
    return -1;
  }

  return grid[y * gridSize + x];
}

/* =========================================================
   ROTATION AND REFLECTION DEDUPLICATION
   ========================================================= */

/*
  Normalize labels by order of appearance.

  For example:

    [4, 4, 8, 4, 2, 8]

  becomes:

    [0, 0, 1, 0, 2, 1]
*/

function normalizeLabels(grid) {
  const mapping = new Map();
  let nextLabel = 0;

  return grid.map(label => {
    if (!mapping.has(label)) {
      mapping.set(label, nextLabel);
      nextLabel++;
    }

    return mapping.get(label);
  });
}

function serializeGrid(grid) {
  return normalizeLabels(grid).join("");
}

/*
  Return a canonical ID that is shared by all
  rotations and reflections of the partition.
*/

function canonicalForm(grid) {
  const variants = [];

  let current = grid.slice();

  // Four rotations.
  for (let i = 0; i < 4; i++) {
    variants.push(serializeGrid(current));
    current = rotateGrid(current);
  }

  // Reflect, then make four more rotations.
  current = reflectGrid(grid);

  for (let i = 0; i < 4; i++) {
    variants.push(serializeGrid(current));
    current = rotateGrid(current);
  }

  variants.sort();

  return variants[0];
}

function rotateGrid(grid) {
  const result = new Array(grid.length);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const newX = gridSize - 1 - y;
      const newY = x;

      result[newY * gridSize + newX] =
        grid[y * gridSize + x];
    }
  }

  return result;
}

function reflectGrid(grid) {
  const result = new Array(grid.length);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const newX = gridSize - 1 - x;

      result[y * gridSize + newX] =
        grid[y * gridSize + x];
    }
  }

  return result;
}

/* =========================================================
   PARTITION DRAWING
   ========================================================= */

function drawPartition(
  grid,
  centerX,
  centerY,
  size,
  style,
  ctx
) {
  const regions = getRegionLabels(grid);

  const originX = centerX - size / 2;
  const originY = centerY - size / 2;
  const cellSize = size / gridSize;

  const target = ctx || drawingContext;
  const paint = style || "stroke";

  target.save();

  target.strokeStyle = cssColor(params.outlineColor);
  target.lineWidth = params.strokeWidth;
  target.lineCap = "round";
  target.lineJoin = "round";
  target.fillStyle = "#ffffff";

  for (const region of regions) {
    const edges = getBoundaryEdges(grid, region);
    const contours = traceAllContours(edges);

    for (const contour of contours) {
      let points = simplifyContour(contour);

      if (points.length < 4) {
        continue;
      }

      /*
        The contour follows the region clockwise,
        so offsetting toward its right side moves
        the contour inward.
      */
      points = offsetPolygon(
        points,
        params.regionInset
      );

      const pixelPoints = points.map(point => ({
        x: originX + point.x * cellSize,
        y: originY + point.y * cellSize
      }));

      drawRoundedContour(
        target,
        pixelPoints,
        params.cornerRadius,
        paint
      );
    }
  }

  target.restore();
}

/* =========================================================
   BOUNDARY EDGE EXTRACTION
   ========================================================= */

/*
  Edges are directed so that the region is always
  on the right-hand side of each edge.

  Direction values:

    0 = right
    1 = down
    2 = left
    3 = up
*/

function getBoundaryEdges(grid, region) {
  const edges = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (getCell(grid, x, y) !== region) {
        continue;
      }

      // Top side: left to right.
      if (getCell(grid, x, y - 1) !== region) {
        edges.push(makeEdge(
          x, y,
          x + 1, y,
          0
        ));
      }

      // Right side: top to bottom.
      if (getCell(grid, x + 1, y) !== region) {
        edges.push(makeEdge(
          x + 1, y,
          x + 1, y + 1,
          1
        ));
      }

      // Bottom side: right to left.
      if (getCell(grid, x, y + 1) !== region) {
        edges.push(makeEdge(
          x + 1, y + 1,
          x, y + 1,
          2
        ));
      }

      // Left side: bottom to top.
      if (getCell(grid, x - 1, y) !== region) {
        edges.push(makeEdge(
          x, y + 1,
          x, y,
          3
        ));
      }
    }
  }

  return edges;
}

function makeEdge(x1, y1, x2, y2, direction) {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    direction
  };
}

/* =========================================================
   CONTOUR TRACING
   ========================================================= */

function traceAllContours(edges) {
  const remaining = edges.slice();
  const contours = [];

  while (remaining.length > 0) {
    const first = remaining.shift();

    const contour = [
      copyPoint(first.start),
      copyPoint(first.end)
    ];

    let currentPoint = first.end;
    let currentDirection = first.direction;

    let safety = 0;
    const safetyLimit = remaining.length + contour.length + 2;

    while (
      !pointsEqual(currentPoint, first.start) &&
      safety < safetyLimit
    ) {
      safety++;

      const candidates = [];

      for (let i = 0; i < remaining.length; i++) {
        if (
          pointsEqual(
            remaining[i].start,
            currentPoint
          )
        ) {
          candidates.push({
            edge: remaining[i],
            index: i
          });
        }
      }

      if (candidates.length === 0) {
        break;
      }

      /*
        Follow the region using the right-hand rule.

        Preferred order:
          1. turn right
          2. go straight
          3. turn left
          4. go backward
      */
      candidates.sort((a, b) => {
        return (
          turnPriority(
            currentDirection,
            a.edge.direction
          ) -
          turnPriority(
            currentDirection,
            b.edge.direction
          )
        );
      });

      const selected = candidates[0];
      const nextEdge = selected.edge;

      remaining.splice(selected.index, 1);

      contour.push(copyPoint(nextEdge.end));

      currentPoint = nextEdge.end;
      currentDirection = nextEdge.direction;
    }

    contours.push(contour);
  }

  return contours;
}

function turnPriority(currentDirection, nextDirection) {
  const difference =
    (nextDirection - currentDirection + 4) % 4;

  if (difference === 1) return 0; // Right
  if (difference === 0) return 1; // Straight
  if (difference === 3) return 2; // Left

  return 3; // Backward
}

function copyPoint(point) {
  return {
    x: point.x,
    y: point.y
  };
}

function pointsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

/* =========================================================
   CONTOUR SIMPLIFICATION
   ========================================================= */

/*
  Remove duplicate final points and unnecessary
  points along straight edges.
*/

function simplifyContour(contour) {
  let points = contour.map(copyPoint);

  if (
    points.length > 1 &&
    pointsEqual(points[0], points[points.length - 1])
  ) {
    points.pop();
  }

  let changed = true;

  while (changed && points.length > 3) {
    changed = false;

    const result = [];

    for (let i = 0; i < points.length; i++) {
      const previous =
        points[(i - 1 + points.length) % points.length];

      const current = points[i];

      const next =
        points[(i + 1) % points.length];

      if (pointsAreCollinear(previous, current, next)) {
        changed = true;
      } else {
        result.push(current);
      }
    }

    points = result;
  }

  return points;
}

function pointsAreCollinear(a, b, c) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;

  return abX * bcY - abY * bcX === 0;
}

/* =========================================================
   INSETTING THE REGION OUTLINE
   ========================================================= */

/*
  Each edge is shifted to its right side.

  Since the boundary edges were created clockwise
  around the region, the right side points inward.
*/

function offsetPolygon(points, distance) {
  const result = [];

  for (let i = 0; i < points.length; i++) {
    const previous =
      points[(i - 1 + points.length) % points.length];

    const current = points[i];

    const next =
      points[(i + 1) % points.length];

    const incoming = offsetLine(
      previous,
      current,
      distance
    );

    const outgoing = offsetLine(
      current,
      next,
      distance
    );

    const intersection = lineIntersection(
      incoming.a,
      incoming.b,
      outgoing.a,
      outgoing.b
    );

    if (intersection) {
      result.push(intersection);
    } else {
      result.push(copyPoint(current));
    }
  }

  return result;
}

function offsetLine(a, b, distance) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const length = sqrt(dx * dx + dy * dy);

  /*
    Right-hand normal in canvas coordinates,
    where positive Y points downward.
  */
  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    a: {
      x: a.x + normalX * distance,
      y: a.y + normalY * distance
    },
    b: {
      x: b.x + normalX * distance,
      y: b.y + normalY * distance
    }
  };
}

function lineIntersection(a, b, c, d) {
  const r = {
    x: b.x - a.x,
    y: b.y - a.y
  };

  const s = {
    x: d.x - c.x,
    y: d.y - c.y
  };

  const denominator = crossProduct(r, s);

  if (abs(denominator) < 0.000001) {
    return null;
  }

  const cMinusA = {
    x: c.x - a.x,
    y: c.y - a.y
  };

  const t =
    crossProduct(cMinusA, s) /
    denominator;

  return {
    x: a.x + r.x * t,
    y: a.y + r.y * t
  };
}

function crossProduct(a, b) {
  return a.x * b.y - a.y * b.x;
}

/* =========================================================
   ROUNDED POLYGON DRAWING
   ========================================================= */

function drawRoundedContour(ctx, points, radius, style) {
  if (points.length < 3) {
    return;
  }

  const corners = [];

  for (let i = 0; i < points.length; i++) {
    const previous =
      points[(i - 1 + points.length) % points.length];

    const current = points[i];

    const next =
      points[(i + 1) % points.length];

    const previousLength =
      distanceBetween(previous, current);

    const nextLength =
      distanceBetween(current, next);

    const cornerRadius = min(
      radius,
      previousLength * 0.45,
      nextLength * 0.45
    );

    corners.push({
      corner: current,

      before: moveToward(
        current,
        previous,
        cornerRadius
      ),

      after: moveToward(
        current,
        next,
        cornerRadius
      )
    });
  }

  ctx.beginPath();

  ctx.moveTo(
    corners[0].after.x,
    corners[0].after.y
  );

  for (let step = 1; step <= corners.length; step++) {
    const index = step % corners.length;
    const item = corners[index];

    ctx.lineTo(
      item.before.x,
      item.before.y
    );

    ctx.quadraticCurveTo(
      item.corner.x,
      item.corner.y,
      item.after.x,
      item.after.y
    );
  }

  ctx.closePath();

  if (style === "fill") {
    ctx.fill();
    return;
  }

  ctx.stroke();
}

function moveToward(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const length = sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return copyPoint(from);
  }

  return {
    x: from.x + dx / length * distance,
    y: from.y + dy / length * distance
  };
}

function distanceBetween(a, b) {
  return dist(a.x, a.y, b.x, b.y);
}

/* =========================================================
   RANDOM CONNECTED PARTITION
   ========================================================= */

/*
  Generate one random partition.

  Technique:
    1. Generate a random spanning tree over the grid.
    2. Remove regionCount - 1 edges.
    3. Find the resulting connected components.
    4. Keep the result if all component sizes differ.
*/

function generateRandomUnequalPartition(
  size,
  requestedRegionCount = null
) {
  randomSeed(params.seed);

  const maximumRegions = maximumRegionCount(size);

  if (maximumRegions < 2) {
    throw new Error(
      "The grid is too small to contain multiple regions " +
      "with unequal sizes."
    );
  }

  let regionCount = requestedRegionCount;

  if (regionCount === null) {
    regionCount = floor(
      random(2, maximumRegions + 1)
    );
  }

  if (
    regionCount < 2 ||
    regionCount > maximumRegions
  ) {
    throw new Error(
      `Invalid region count ${regionCount}. ` +
      `For a ${size}×${size} grid, choose between ` +
      `2 and ${maximumRegions}.`
    );
  }

  const cellCount = size * size;
  const maximumAttempts = 30000;

  for (
    let attempt = 0;
    attempt < maximumAttempts;
    attempt++
  ) {
    const tree = createRandomSpanningTree(size);

    // Shuffle the tree edges before choosing cuts.
    const shuffledEdges = shuffleArray(tree);

    // Removing k - 1 edges produces k components.
    const numberOfCuts = regionCount - 1;

    const remainingEdges =
      shuffledEdges.slice(numberOfCuts);

    const grid = componentsFromEdges(
      cellCount,
      remainingEdges
    );

    if (
      getRegionLabels(grid).length === regionCount &&
      hasUnequalRegionSizes(grid)
    ) {
      return normalizeLabels(grid);
    }
  }

  throw new Error(
    "Could not generate a valid random partition. " +
    "Try another region count or grid size."
  );
}

function createRandomSpanningTree(size) {
  const cellCount = size * size;

  const visited =
    new Array(cellCount).fill(false);

  const treeEdges = [];

  const startingCell =
    floor(random(cellCount));

  const stack = [startingCell];
  visited[startingCell] = true;

  while (stack.length > 0) {
    const current =
      stack[stack.length - 1];

    const neighbours =
      getUnvisitedNeighbours(
        current,
        size,
        visited
      );

    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }

    const next = random(neighbours);

    treeEdges.push({
      a: current,
      b: next
    });

    visited[next] = true;
    stack.push(next);
  }

  return treeEdges;
}

function getUnvisitedNeighbours(
  index,
  size,
  visited
) {
  const x = index % size;
  const y = floor(index / size);

  const positions = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ];

  const result = [];

  for (const [nx, ny] of positions) {
    if (
      nx < 0 ||
      nx >= size ||
      ny < 0 ||
      ny >= size
    ) {
      continue;
    }

    const neighbourIndex =
      ny * size + nx;

    if (!visited[neighbourIndex]) {
      result.push(neighbourIndex);
    }
  }

  return result;
}

function shuffleArray(array) {
  const result = array.slice();

  for (let i = result.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));

    const temporary = result[i];
    result[i] = result[j];
    result[j] = temporary;
  }

  return result;
}

function componentsFromEdges(
  cellCount,
  edges
) {
  const parent = new Array(cellCount);
  const rank = new Array(cellCount).fill(0);

  for (let i = 0; i < cellCount; i++) {
    parent[i] = i;
  }

  function find(value) {
    if (parent[value] !== value) {
      parent[value] = find(parent[value]);
    }

    return parent[value];
  }

  function union(a, b) {
    let rootA = find(a);
    let rootB = find(b);

    if (rootA === rootB) {
      return;
    }

    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB;
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA;
    } else {
      parent[rootB] = rootA;
      rank[rootA]++;
    }
  }

  // Edges that weren't cut connect their cells.
  for (const edge of edges) {
    union(edge.a, edge.b);
  }

  const rootToLabel = new Map();
  let nextLabel = 0;

  const grid = new Array(cellCount);

  for (let i = 0; i < cellCount; i++) {
    const root = find(i);

    if (!rootToLabel.has(root)) {
      rootToLabel.set(root, nextLabel);
      nextLabel++;
    }

    grid[i] = rootToLabel.get(root);
  }

  return grid;
}

function printPartitionInfo(grid) {
  const sizes = getRegionSizes(grid);

  console.log("--------------------------");
  console.log(
    `Grid: ${gridSize}×${gridSize}`
  );
  console.log(
    `Number of regions: ${sizes.length}`
  );
  console.log(
    "Region sizes:",
    sizes.slice().sort((a, b) => a - b)
  );

  printGridToConsole(grid);
}

function printGridToConsole(grid) {
  for (let y = 0; y < gridSize; y++) {
    let line = "";

    for (let x = 0; x < gridSize; x++) {
      const value =
        grid[y * gridSize + x];

      line +=
        String(value).padStart(2, " ") +
        " ";
    }

    console.log(line);
  }
}
