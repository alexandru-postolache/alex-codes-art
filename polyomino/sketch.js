/*
  Modes:

  "ALL_3X3"
      Generate all unique 3×3 partitions.

  "RANDOM_ONE"
      Generate one random partition at the chosen grid size.
*/

const MODE = "RANDOM_ONE";

// Used only in RANDOM_ONE mode.
const RANDOM_GRID_SIZE = 5;

/*
  null = choose a random valid number of regions.

  Or specify a number:
    2, 3, 4, etc.

  The number must allow distinct positive region sizes.
*/
const RANDOM_REGION_COUNT = null;

// ALL_3X3 always uses 3.
const GRID_SIZE =
  MODE === "ALL_3X3"
    ? 3
    : RANDOM_GRID_SIZE;

// Layout for ALL_3X3.
const COLS = 5;
const TILE_SIZE = 105;
const PAGE_MARGIN = 35;
const SHAPE_SIZE = 66;

// Drawing.
const OUTLINE_COLOR = "#292932";
const BACKGROUND_COLOR = "#eeeae1";
const STROKE_WIDTH = 2.2;

// Measured relative to one grid cell.
const REGION_INSET = 0.095;

// Measured in pixels.
const CORNER_RADIUS = 20;

let partitions = [];

function setup() {
  pixelDensity(2);

  if (MODE === "ALL_3X3") {
    partitions = generatePartitions();

    partitions.sort((a, b) =>
      canonicalForm(a).localeCompare(canonicalForm(b))
    );

    const rows = ceil(partitions.length / COLS);

    createCanvas(
      PAGE_MARGIN * 2 + COLS * TILE_SIZE,
      PAGE_MARGIN * 2 + rows * TILE_SIZE
    );
  } else {
    createCanvas(700, 700);

    partitions = [
      generateRandomUnequalPartition(
        GRID_SIZE,
        RANDOM_REGION_COUNT
      )
    ];

    printPartitionInfo(partitions[0]);
  }

  noLoop();
}

function draw() {
  background(BACKGROUND_COLOR);

  if (MODE === "ALL_3X3") {
    for (let i = 0; i < partitions.length; i++) {
      const col = i % COLS;
      const row = floor(i / COLS);

      const centerX =
        PAGE_MARGIN +
        col * TILE_SIZE +
        TILE_SIZE / 2;

      const centerY =
        PAGE_MARGIN +
        row * TILE_SIZE +
        TILE_SIZE / 2;

      drawPartition(
        partitions[i],
        centerX,
        centerY,
        SHAPE_SIZE
      );
    }
  } else {
    drawPartition(
      partitions[0],
      width / 2,
      height / 2,
      min(width, height) * 0.72
    );
  }
}

function keyPressed() {
  // Generate another random partition.
  if (
    MODE === "RANDOM_ONE" &&
    (key === "r" || key === "R")
  ) {
    partitions[0] =
      generateRandomUnequalPartition(
        GRID_SIZE,
        RANDOM_REGION_COUNT
      );

    printPartitionInfo(partitions[0]);
    redraw();
  }

  if (key === "s" || key === "S") {
    saveCanvas(
      `partition-${GRID_SIZE}x${GRID_SIZE}`,
      "png"
    );
  }
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

  const grid = new Array(GRID_SIZE * GRID_SIZE).fill(0);

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

    const x = index % GRID_SIZE;
    const y = floor(index / GRID_SIZE);

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

      const neighbourIndex = ny * GRID_SIZE + nx;

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
    x < GRID_SIZE &&
    y >= 0 &&
    y < GRID_SIZE
  );
}

function getCell(grid, x, y) {
  if (!insideGrid(x, y)) {
    return -1;
  }

  return grid[y * GRID_SIZE + x];
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

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const newX = GRID_SIZE - 1 - y;
      const newY = x;

      result[newY * GRID_SIZE + newX] =
        grid[y * GRID_SIZE + x];
    }
  }

  return result;
}

function reflectGrid(grid) {
  const result = new Array(grid.length);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const newX = GRID_SIZE - 1 - x;

      result[y * GRID_SIZE + newX] =
        grid[y * GRID_SIZE + x];
    }
  }

  return result;
}

/* =========================================================
   PARTITION DRAWING
   ========================================================= */

function drawPartition(grid, centerX, centerY, size) {
  const regions = getRegionLabels(grid);

  const originX = centerX - size / 2;
  const originY = centerY - size / 2;
  const cellSize = size / GRID_SIZE;

  const ctx = drawingContext;

  ctx.save();

  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "transparent";

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
        REGION_INSET
      );

      const pixelPoints = points.map(point => ({
        x: originX + point.x * cellSize,
        y: originY + point.y * cellSize
      }));

      drawRoundedContour(
        ctx,
        pixelPoints,
        CORNER_RADIUS
      );
    }
  }

  ctx.restore();
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

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
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

    while (
      !pointsEqual(currentPoint, first.start) &&
      safety < 100
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

function drawRoundedContour(ctx, points, radius) {
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
  const cellCount = size * size;

  /*
    For k regions to have distinct positive sizes,
    the smallest possible total is:

      1 + 2 + 3 + ... + k

    which equals:

      k * (k + 1) / 2
  */
  const maximumRegionCount = floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );

  if (maximumRegionCount < 2) {
    throw new Error(
      "The grid is too small to contain multiple regions " +
      "with unequal sizes."
    );
  }

  let regionCount = requestedRegionCount;

  if (regionCount === null) {
    regionCount = floor(
      random(2, maximumRegionCount + 1)
    );
  }

  if (
    regionCount < 2 ||
    regionCount > maximumRegionCount
  ) {
    throw new Error(
      `Invalid region count ${regionCount}. ` +
      `For a ${size}×${size} grid, choose between ` +
      `2 and ${maximumRegionCount}.`
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
    `Grid: ${GRID_SIZE}×${GRID_SIZE}`
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
  for (let y = 0; y < GRID_SIZE; y++) {
    let line = "";

    for (let x = 0; x < GRID_SIZE; x++) {
      const value =
        grid[y * GRID_SIZE + x];

      line +=
        String(value).padStart(2, " ") +
        " ";
    }

    console.log(line);
  }
}
