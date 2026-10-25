/*
  Modes:

  "ALL_3X3"
      Generate all unique 3×3 partitions.

  "RANDOM_ONE"
      Generate random partitions at the chosen grid size.
      Columns and rows choose how many are drawn across and down.

  The Tweakpane panel edits these settings live.
  "Any count" chooses a valid region count at random.
  "Allow equals" keeps a partition even when two regions
  have the same size. Otherwise every region has a different size.

  The canvas fills the browser window. Partitions are centered
  in the space beside the controls. A sheet is scaled to fit there.
*/

const RANDOM_CANVAS = 700;

const MAX_GRID_SIZE = 12;

const params = {
  mode: "RANDOM_ONE",

  // Used only in RANDOM_ONE mode.
  gridSize: 5,

  /*
    anyCount chooses a valid region count at random.
    Otherwise regionCount is used.
  */
  anyCount: true,
  regionCount: 4,

  // Checked: regions may share a size.
  // Unchecked: every region must have a different size.
  allowEqualSizes: false,

  // How many random partitions to draw, across and down.
  columnCount: 1,
  rowCount: 1,

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
    windowWidth,
    windowHeight
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
  const frame = contentFrame();

  if (usesSheet()) {
    const placement = sheetPlacement(frame);
    const columns = placement.columns;

    for (let i = 0; i < partitions.length; i++) {
      const col = i % columns;
      const row = floor(i / columns);

      const centerX =
        placement.originX +
        col * placement.tile +
        placement.tile / 2;

      const centerY =
        placement.originY +
        row * placement.tile +
        placement.tile / 2;

      drawPartition(
        partitions[i],
        centerX,
        centerY,
        placement.shape,
        style,
        target,
        placement.pixelScale
      );
    }

    return;
  }

  const shape =
    min(frame.width, frame.height) * params.shapeScale;

  const reference = RANDOM_CANVAS * params.shapeScale;
  const pixelScale = reference === 0 ? 1 : shape / reference;

  drawPartition(
    partitions[0],
    frame.x + frame.width / 2,
    frame.y + frame.height / 2,
    shape,
    style,
    target,
    pixelScale
  );
}

// The open area beside the controls. The canvas itself is the full window.
function contentFrame() {
  const panel = document.getElementById("controls");
  const reserved = panel ? panel.offsetWidth + 32 : 0;

  return {
    x: 0,
    y: 0,
    width: max(1, width - reserved),
    height: max(1, height)
  };
}

// Fit the tile block to the open area and center it.
function sheetPlacement(frame) {
  const columns = max(1, sheetColumns());
  const rows = max(
    1,
    ceil(partitions.length / columns)
  );

  const margin = params.pageMargin;
  const availW = max(1, frame.width - margin * 2);
  const availH = max(1, frame.height - margin * 2);
  const naturalW = columns * params.tileSize;
  const naturalH = rows * params.tileSize;
  const fit = min(
    availW / naturalW,
    availH / naturalH
  );

  const tile = params.tileSize * fit;
  const shape = params.shapeSize * fit;
  const drawnW = columns * tile;
  const drawnH = rows * tile;

  return {
    columns,
    rows,
    originX: frame.x + (frame.width - drawnW) / 2,
    originY: frame.y + (frame.height - drawnH) / 2,
    tile,
    shape,
    pixelScale: params.shapeSize === 0
      ? 1
      : shape / params.shapeSize
  };
}

function usesSheet() {
  return (
    params.mode === "ALL_3X3" ||
    params.columnCount * params.rowCount > 1
  );
}

function sheetColumns() {
  if (params.mode === "ALL_3X3") {
    return params.columns;
  }

  return params.columnCount;
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
  let name = `partition-${gridSize}x${gridSize}`;

  if (params.mode === "ALL_3X3") {
    name = "partitions-3x3";
  } else if (params.columnCount * params.rowCount > 1) {
    name =
      `partitions-${params.columnCount}x${params.rowCount}`;
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
  "allowEqualSizes",
  "regionCount",
  "columnCount",
  "rowCount",
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

  generationFolder.addInput(params, "columnCount", {
    label: "columns",
    min: 1,
    max: 8,
    step: 1
  });

  generationFolder.addInput(params, "rowCount", {
    label: "rows",
    min: 1,
    max: 8,
    step: 1
  });

  const regionFolder = generationFolder.addFolder({
    title: "Regions"
  });

  regionFolder.addInput(params, "anyCount", {
    label: "any count"
  });

  regionInput = regionFolder.addInput(
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

  generationFolder.addInput(params, "allowEqualSizes", {
    label: "allow equals"
  });

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

    // Drawing and layout values repaint while the pointer is down.
    // Generation values do too, so a sheet does not wait for release.
    if (
      DRAWING_KEYS.has(presetKey) ||
      LAYOUT_KEYS.has(presetKey)
    ) {
      draw();
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
    }
  });
}

function clampRegionCount() {
  const limit = maximumRegionCount(params.gridSize);

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
  const sheet = randomMode && params.columnCount * params.rowCount > 1;

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
      randomMode && params.columnCount * params.rowCount === 1
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
    partitions.length !== params.columnCount * params.rowCount ||
    partitions[0].length !== nextGridSize * nextGridSize
  ) {
    const previousGridSize = gridSize;
    const previousPartitions = partitions;

    gridSize = nextGridSize;

    try {
      const requested = params.anyCount
        ? null
        : params.regionCount;

      const total = params.columnCount * params.rowCount;
      const next = [];

      for (let index = 0; index < total; index++) {
        next.push(
          generateRandomPartition(
            gridSize,
            requested,
            params.allowEqualSizes,
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
  const nextWidth = windowWidth;
  const nextHeight = windowHeight;

  if (width !== nextWidth || height !== nextHeight) {
    resizeCanvas(nextWidth, nextHeight);
    return;
  }

  draw();
}

function windowResized() {
  fitCanvas();
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
  ctx,
  pixelScale
) {
  const regions = getRegionLabels(grid);

  const originX = centerX - size / 2;
  const originY = centerY - size / 2;
  const cellSize = size / gridSize;
  const scale = pixelScale || 1;

  const target = ctx || drawingContext;
  const paint = style || "stroke";
  const pixelContours = [];

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

      pixelContours.push(points.map(point => ({
        x: originX + point.x * cellSize,
        y: originY + point.y * cellSize
      })));
    }
  }

  const radii = roundedRadii(
    pixelContours,
    params.cornerRadius * scale
  );

  target.save();

  target.strokeStyle = cssColor(params.outlineColor);
  target.lineWidth = params.strokeWidth * scale;
  target.lineCap = "round";
  target.lineJoin = "round";
  target.fillStyle = "#ffffff";

  for (let i = 0; i < pixelContours.length; i++) {
    drawRoundedContour(
      target,
      pixelContours[i],
      radii[i],
      paint
    );
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

/*
  Each corner keeps the requested radius unless that curve
  would cross another curve or edge. Large radii on a wide
  notch otherwise bow across the gap and pinch the outline.
*/
function roundedRadii(contours, radius) {
  const radii = contours.map((points) =>
    edgeLimitedRadii(points, radius)
  );

  for (let pass = 0; pass < 48; pass++) {
    const hit = firstOverlap(contours, radii);

    if (!hit) {
      break;
    }

    separateRadii(contours, radii, hit);
  }

  return radii;
}

function edgeLimitedRadii(points, radius) {
  const count = points.length;
  const radii = new Array(count);

  for (let i = 0; i < count; i++) {
    const previous =
      points[(i - 1 + count) % count];

    const next =
      points[(i + 1) % count];

    const previousLength =
      distanceBetween(previous, points[i]);

    const nextLength =
      distanceBetween(points[i], next);

    radii[i] = min(
      radius,
      previousLength * 0.45,
      nextLength * 0.45
    );
  }

  return radii;
}

function separateRadii(contours, radii, hit) {
  const targets = [hit.a];

  if (hit.b) {
    targets.push(hit.b);
  }

  const saved = targets.map((item) =>
    radii[item.contour][item.index]
  );

  let low = 0;
  let high = 1;

  for (let step = 0; step < 10; step++) {
    const mid = (low + high) / 2;

    targets.forEach((item, index) => {
      radii[item.contour][item.index] =
        saved[index] * mid;
    });

    if (hitStillOverlaps(contours, radii, hit)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  targets.forEach((item, index) => {
    radii[item.contour][item.index] =
      saved[index] * low;
  });
}

function firstOverlap(contours, radii) {
  const groups = contours.map((points, contourIndex) =>
    points.map((point, index) => ({
      contour: contourIndex,
      index,
      corner: point,
      radius: radii[contourIndex][index],
      samples: curveSamples(
        points,
        index,
        radii[contourIndex][index]
      )
    }))
  );

  for (let aContour = 0; aContour < groups.length; aContour++) {
    for (let aIndex = 0; aIndex < groups[aContour].length; aIndex++) {
      const a = groups[aContour][aIndex];

      if (a.radius <= 0) {
        continue;
      }

      for (
        let bContour = aContour;
        bContour < groups.length;
        bContour++
      ) {
        const sameContour = bContour === aContour;
        const startIndex = sameContour ? aIndex + 1 : 0;

        for (
          let bIndex = startIndex;
          bIndex < groups[bContour].length;
          bIndex++
        ) {
          const b = groups[bContour][bIndex];

          if (b.radius <= 0) {
            continue;
          }

          if (
            distanceBetween(a.corner, b.corner) >=
            a.radius + b.radius
          ) {
            continue;
          }

          if (polylinesCross(a.samples, b.samples)) {
            return {
              a: {
                contour: aContour,
                index: aIndex
              },
              b: {
                contour: bContour,
                index: bIndex
              }
            };
          }
        }
      }

      for (
        let edgeContour = 0;
        edgeContour < contours.length;
        edgeContour++
      ) {
        const points = contours[edgeContour];

        for (let edgeIndex = 0; edgeIndex < points.length; edgeIndex++) {
          if (edgeContour === aContour) {
            const previousEdge =
              (aIndex - 1 + points.length) % points.length;

            if (
              edgeIndex === aIndex ||
              edgeIndex === previousEdge
            ) {
              continue;
            }
          }

          const start = points[edgeIndex];
          const end =
            points[(edgeIndex + 1) % points.length];

          if (
            distancePointToSegment(a.corner, start, end) >=
            a.radius
          ) {
            continue;
          }

          if (polylineHitsSegment(a.samples, start, end)) {
            return {
              a: {
                contour: aContour,
                index: aIndex
              },
              edge: {
                a: start,
                b: end
              }
            };
          }
        }
      }
    }
  }

  return null;
}

function hitStillOverlaps(contours, radii, hit) {
  const points = contours[hit.a.contour];
  const radius = radii[hit.a.contour][hit.a.index];
  const samples = curveSamples(
    points,
    hit.a.index,
    radius
  );

  if (hit.b) {
    const otherPoints = contours[hit.b.contour];
    const otherRadius =
      radii[hit.b.contour][hit.b.index];

    return polylinesCross(
      samples,
      curveSamples(
        otherPoints,
        hit.b.index,
        otherRadius
      )
    );
  }

  return polylineHitsSegment(
    samples,
    hit.edge.a,
    hit.edge.b
  );
}

function curveSamples(points, index, radius) {
  const count = points.length;
  const previous =
    points[(index - 1 + count) % count];

  const current = points[index];

  const next =
    points[(index + 1) % count];

  const before = moveToward(
    current,
    previous,
    radius
  );

  const after = moveToward(
    current,
    next,
    radius
  );

  const samples = [];
  const steps = 16;

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;

    samples.push({
      x:
        u * u * before.x +
        2 * u * t * current.x +
        t * t * after.x,
      y:
        u * u * before.y +
        2 * u * t * current.y +
        t * t * after.y
    });
  }

  return samples;
}

function polylinesCross(a, b) {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (
        segmentsProperlyCross(
          a[i],
          a[i + 1],
          b[j],
          b[j + 1]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function polylineHitsSegment(samples, a, b) {
  for (let i = 0; i < samples.length - 1; i++) {
    if (
      segmentsProperlyCross(
        samples[i],
        samples[i + 1],
        a,
        b
      )
    ) {
      return true;
    }
  }

  return false;
}

function segmentsProperlyCross(a, b, c, d) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denom = abX * cdY - abY * cdX;

  if (abs(denom) < 0.0001) {
    return false;
  }

  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const t = (acX * cdY - acY * cdX) / denom;
  const u = (acX * abY - acY * abX) / denom;
  const margin = 0.004;

  return (
    t > margin &&
    t < 1 - margin &&
    u > margin &&
    u < 1 - margin
  );
}

function drawRoundedContour(ctx, points, radius, style) {
  if (points.length < 3) {
    return;
  }

  const radii = Array.isArray(radius)
    ? radius
    : edgeLimitedRadii(points, radius);

  const corners = [];

  for (let i = 0; i < points.length; i++) {
    const previous =
      points[(i - 1 + points.length) % points.length];

    const current = points[i];

    const next =
      points[(i + 1) % points.length];

    const cornerRadius = radii[i] || 0;

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

function distancePointToSegment(point, a, b) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared = abX * abX + abY * abY;

  if (lengthSquared === 0) {
    return distanceBetween(point, a);
  }

  const t = constrain(
    (
      (point.x - a.x) * abX +
      (point.y - a.y) * abY
    ) / lengthSquared,
    0,
    1
  );

  return distanceBetween(point, {
    x: a.x + abX * t,
    y: a.y + abY * t
  });
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
    4. When allowEqualSizes is off, keep the result only if
       every region has a different size.
*/

function generateRandomPartition(
  size,
  requestedRegionCount,
  allowEqualSizes,
  seed
) {
  randomSeed(seed);

  const cellCount = size * size;
  const maximumRegions = floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );

  if (maximumRegions < 2) {
    throw new Error(
      "The grid is too small to contain multiple regions."
    );
  }

  let regionCount = requestedRegionCount;

  if (regionCount === null) {
    regionCount = floor(random(2, maximumRegions + 1));
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

    const sizesFit =
      allowEqualSizes || hasUnequalRegionSizes(grid);

    if (
      getRegionLabels(grid).length === regionCount &&
      sizesFit
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
