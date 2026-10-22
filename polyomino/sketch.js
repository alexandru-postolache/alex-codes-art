/*
  Modes:

  "ALL_3X3"
      Generate all unique 3×3 partitions.

  "RANDOM_ONE"
      Generate random partitions at the chosen grid size.
      x and y choose how many are drawn across and down.

  The Tweakpane panel edits these settings live.
  "Any count" chooses a valid region count at random.
  "Equal sizes" lets every region cover the same number of cells.
  Otherwise every region has a different size.
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

  // Checked: every region has the same size.
  // Unchecked: every region has a different size.
  equalSizes: false,

  // How many random partitions to draw, across and down.
  countX: 1,
  countY: 1,

  // Same seed reproduces the same random partition.
  seed: Math.floor(Math.random() * 1000000),

  // Layout for ALL_3X3.
  columns: 5,
  tileSize: 105,
  pageMargin: 35,
  shapeSize: 66,

  outlineColor: "#292932",
  backgroundColor: "#eeeae1",
  strokeWidth: 2.2,
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
let columnsInput;

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

  background(cssColor(params.backgroundColor));

  if (partitions.length === 0) {
    return;
  }

  paintPartitions(drawingContext, "stroke");
}

function paintPartitions(target, style) {
  if (usesSheet()) {
    const columns = sheetColumns();

    for (let i = 0; i < partitions.length; i++) {
      const col = i % columns;
      const row = floor(i / columns);

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

function usesSheet() {
  return (
    params.mode === "ALL_3X3" ||
    params.countX * params.countY > 1
  );
}

function sheetColumns() {
  if (params.mode === "ALL_3X3") {
    return params.columns;
  }

  return params.countX;
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

  if (params.equalSizes) {
    return cellCount;
  }

  return floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );
}

function nearestEqualRegionCount(size, count) {
  const cellCount = size * size;
  let chosen = cellCount;
  let chosenDistance = cellCount;

  for (let regions = 2; regions <= cellCount; regions++) {
    if (cellCount % regions !== 0) {
      continue;
    }

    const distance = Math.abs(regions - count);

    if (distance < chosenDistance) {
      chosen = regions;
      chosenDistance = distance;
    }
  }

  return chosen;
}

function savePartition() {
  let name = `partition-${gridSize}x${gridSize}`;

  if (params.mode === "ALL_3X3") {
    name = "partitions-3x3";
  } else if (params.countX * params.countY > 1) {
    name =
      `partitions-${params.countX}x${params.countY}`;
  }

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
  "equalSizes",
  "regionCount",
  "countX",
  "countY",
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
      "Random": "RANDOM_ONE",
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

  generationFolder.addInput(params, "equalSizes", {
    label: "equal sizes"
  });

  generationFolder.addInput(params, "countX", {
    label: "x",
    min: 1,
    max: 8,
    step: 1
  });

  generationFolder.addInput(params, "countY", {
    label: "y",
    min: 1,
    max: 8,
    step: 1
  });

  regionInput = generationFolder.addInput(
    params,
    "regionCount",
    {
      label: "regions",
      min: 2,
      max: MAX_GRID_SIZE * MAX_GRID_SIZE,
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

  columnsInput = layoutFolder.addInput(params, "columns", {
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

  drawingFolder.addInput(params, "backgroundColor", {
    label: "background"
  });

  drawingFolder.addInput(params, "outlineColor", {
    label: "outline"
  });

  drawingFolder.addInput(params, "strokeWidth", {
    label: "stroke",
    min: 0.5,
    max: 16,
    step: 0.1
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

    if (DRAWING_KEYS.has(presetKey)) {
      draw();
      return;
    }

    // Sliders apply structural changes on release.
    if (event.last === false) {
      return;
    }

    if (
      presetKey === "gridSize" ||
      presetKey === "equalSizes"
    ) {
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
  let limit = maximumRegionCount(params.gridSize);

  if (params.equalSizes && !params.anyCount) {
    params.regionCount = nearestEqualRegionCount(
      params.gridSize,
      params.regionCount
    );
  }

  if (regionInput) {
    regionInput.maxValue = limit;
  }

  if (params.regionCount > limit) {
    params.regionCount = limit;
  }

  if (params.regionCount < 2) {
    params.regionCount = 2;
  }

  if (regionInput) {
    regionInput.refresh();
  }
}

function updateRegionCountAvailability() {
  if (regionInput) {
    regionInput.disabled = params.anyCount;
  }
}

function updatePaneVisibility() {
  const randomMode = params.mode === "RANDOM_ONE";
  const sheet = randomMode && params.countX * params.countY > 1;

  if (generationFolder) {
    generationFolder.hidden = !randomMode;
  }

  if (layoutFolder) {
    layoutFolder.hidden = randomMode && !sheet;
  }

  if (columnsInput) {
    columnsInput.hidden = randomMode;
  }

  if (scaleInput) {
    scaleInput.hidden = !randomMode || sheet;
  }

  updateRegionCountAvailability();

  if (summaryMonitor) {
    summaryMonitor.label =
      randomMode && params.countX * params.countY === 1
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
    partitions.length !== params.countX * params.countY ||
    partitions[0].length !== nextGridSize * nextGridSize
  ) {
    const previousGridSize = gridSize;
    const previousPartitions = partitions;

    gridSize = nextGridSize;

    try {
      const requested = params.anyCount
        ? null
        : params.regionCount;

      const total = params.countX * params.countY;
      const next = [];

      for (let index = 0; index < total; index++) {
        next.push(
          generateRandomPartition(
            gridSize,
            requested,
            params.equalSizes,
            params.seed + index * 100003
          )
        );
      }

      partitions = next;
      readout.summary = partitionSummary(next);

      if (next.length === 1) {
        printPartitionInfo(next[0]);
      }
    } catch (error) {
      gridSize = previousGridSize;
      partitions = previousPartitions;
      readout.summary = "No partition found";
      console.error(error);
    }
  } else {
    gridSize = nextGridSize;

    readout.summary = partitionSummary(partitions);
  }

  updatePaneVisibility();

  if (summaryMonitor) {
    summaryMonitor.refresh();
  }

  fitCanvas();
}

function partitionSummary(grids) {
  if (grids.length === 1) {
    return getRegionSizes(grids[0])
      .slice()
      .sort((a, b) => a - b)
      .join(", ");
  }

  return `${grids.length} partitions`;
}

function fitCanvas() {
  let nextWidth = RANDOM_CANVAS;
  let nextHeight = RANDOM_CANVAS;

  if (usesSheet()) {
    const columns = sheetColumns();
    const rows = ceil(partitions.length / columns);

    nextWidth =
      params.pageMargin * 2 +
      columns * params.tileSize;

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

function hasEqualRegionSizes(grid) {
  const sizes = getRegionSizes(grid);

  if (sizes.length < 2) {
    return false;
  }

  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] !== sizes[0]) {
      return false;
    }
  }

  return true;
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
    4. Keep the result when every region has a different size.

  Equal sizes grow each region from a random seed until every
  region covers the same number of cells.
*/

function generateRandomPartition(
  size,
  requestedRegionCount,
  equalSizes,
  seed
) {
  randomSeed(seed);

  const cellCount = size * size;
  const maximumRegions = equalSizes
    ? cellCount
    : floor((sqrt(8 * cellCount + 1) - 1) / 2);

  if (maximumRegions < 2) {
    throw new Error(
      "The grid is too small to contain multiple regions."
    );
  }

  let regionCount = requestedRegionCount;

  if (regionCount === null) {
    if (equalSizes) {
      const choices = [];

      for (let regions = 2; regions <= cellCount; regions++) {
        if (cellCount % regions === 0) {
          choices.push(regions);
        }
      }

      regionCount = choices[floor(random(choices.length))];
    } else {
      regionCount = floor(random(2, maximumRegions + 1));
    }
  }

  if (
    regionCount < 2 ||
    regionCount > maximumRegions ||
    (equalSizes && cellCount % regionCount !== 0)
  ) {
    throw new Error(
      `Invalid region count ${regionCount}. ` +
      `For a ${size}×${size} grid, choose between ` +
      `2 and ${maximumRegions}.`
    );
  }

  if (equalSizes) {
    return growEqualPartition(size, regionCount);
  }

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

function cellNeighbours(cell, size) {
  const x = cell % size;
  const y = floor(cell / size);
  const neighbours = [];

  if (x > 0) {
    neighbours.push(cell - 1);
  }

  if (x < size - 1) {
    neighbours.push(cell + 1);
  }

  if (y > 0) {
    neighbours.push(cell - size);
  }

  if (y < size - 1) {
    neighbours.push(cell + size);
  }

  return neighbours;
}

function growEqualPartition(size, regionCount) {
  const cellCount = size * size;
  const target = cellCount / regionCount;

  if (target === 1) {
    return normalizeLabels(
      Array.from({ length: cellCount }, (_, index) => index)
    );
  }

  for (let attempt = 0; attempt < 4000; attempt++) {
    const grid = new Array(cellCount).fill(-1);
    const counts = new Array(regionCount).fill(0);
    const frontiers = [];
    let placed = 0;

    for (let region = 0; region < regionCount; region++) {
      let seed = floor(random(cellCount));
      let guard = 0;

      while (grid[seed] !== -1 && guard < cellCount) {
        seed = (seed + 1) % cellCount;
        guard += 1;
      }

      grid[seed] = region;
      counts[region] = 1;
      placed += 1;
      frontiers.push(
        cellNeighbours(seed, size).filter((cell) => grid[cell] === -1)
      );
    }

    let failed = false;

    while (placed < cellCount && !failed) {
      const open = [];

      for (let region = 0; region < regionCount; region++) {
        if (counts[region] < target && frontiers[region].length > 0) {
          open.push(region);
        }
      }

      if (open.length === 0) {
        failed = true;
        break;
      }

      const region = open[floor(random(open.length))];
      const frontier = frontiers[region];
      const cell = frontier.splice(
        floor(random(frontier.length)),
        1
      )[0];

      if (grid[cell] !== -1) {
        continue;
      }

      grid[cell] = region;
      counts[region] += 1;
      placed += 1;

      const nextCells = cellNeighbours(cell, size);

      for (let i = 0; i < nextCells.length; i++) {
        if (grid[nextCells[i]] === -1) {
          frontier.push(nextCells[i]);
        }
      }
    }

    if (
      !failed &&
      counts.every((count) => count === target)
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
