const params = {
  lines: 3,
  points: 3,
  water: 2,
  parks: 4,
  walls: 3,
  showGrid: false,
  cells: 50,
  bend: "diagonal"
};

const LAND_COLOR = "#e6e2d8";
const WATER_COLOR = "#6eb0d0";
const PARK_COLOR = "#9fbf78";
const WALL_COLOR = "#9c9890";

const METRO_PALETTE = [
  "#D32F2F", // red
  "#1976D2", // blue
  "#00897B", // teal
  "#7B1FA2", // purple
  "#E67E00", // orange
  "#C2185B", // magenta
  "#546E7A", // slate
  "#6D4C41", // brown
  "#689F38", // green
  "#D39E00"  // gold
];

const EPSILON = 0.000001;

let cellWidth;
let cellHeight;

let sets = [];
let setColors = [];

let rawSegments = [];
let atomicEdges = [];
let intersectionStations = [];

let selectedSetIndex = 0;

let terrain = {
  waters: [],
  parks: [],
  walls: []
};

let pane;

/* =========================================================
   SETUP AND DATA
   ========================================================= */

function setup() {
  const canvas = createCanvas(600, 600);

  canvas.elt.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    }
  );

  canvas.parent("map");

  updateCellSize();

  createTerrain();
  createSets();
  setupPane();
  renderScene();

  noLoop();
}

/**
 * Creates the route sets and their initial stations.
 */
function createSets() {
  for (
    let setIndex = 0;
    setIndex < params.lines;
    setIndex++
  ) {
    setColors[setIndex] = color(
      METRO_PALETTE[
        setIndex % METRO_PALETTE.length
      ]
    );

    sets[setIndex] = [];

    for (let i = 0; i < params.points; i++) {
      for (
        let attempt = 0;
        attempt < 50;
        attempt++
      ) {
        const placed = addPoint(
          random(width),
          random(height),
          setIndex
        );

        if (placed) {
          break;
        }
      }
    }
  }
}

/**
 * Snaps a point to the center of a grid cell and adds it
 * as a station to the given route.
 *
 * Stations are not placed in water.
 */
function addPoint(x, y, setIndex) {
  if (
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height
  ) {
    return false;
  }

  if (!sets[setIndex]) {
    sets[setIndex] = [];
  }

  const xGrid =
    floor(x / cellWidth) * cellWidth +
    cellWidth / 2;

  const yGrid =
    floor(y / cellHeight) * cellHeight +
    cellHeight / 2;

  if (!canPlaceStation(xGrid, yGrid)) {
    return false;
  }

  sets[setIndex].push({
    x: xGrid,
    y: yGrid
  });

  return true;
}

/**
 * True when a station circle would sit on dry land.
 */
function canPlaceStation(x, y) {
  const margin =
    min(cellWidth, cellHeight) * 0.55;

  const samples = [
    { x, y },
    { x: x - margin, y },
    { x: x + margin, y },
    { x, y: y - margin },
    { x, y: y + margin }
  ];

  for (const sample of samples) {
    if (pointInWater(sample.x, sample.y)) {
      return false;
    }
  }

  return true;
}

/* =========================================================
   SCENE RENDERING
   ========================================================= */

function renderScene() {
  drawTerrain();

  rawSegments = mergeCloseParallelSegments(
    createAllLineSegments()
  );

  const network =
    buildAtomicNetwork(rawSegments);

  atomicEdges = network.edges;
  intersectionStations =
    network.intersections;

  if (params.showGrid) {
    drawGrid(
      params.cells,
      params.cells,
      0,
      0,
      width,
      height
    );
  }

  // Drawing order determines visual layering.
  drawBundledLines();
  drawEndOfLineCaps();
  drawIntersectionStations();
  drawOriginalStations();
  drawRouteLegend();
}

/* =========================================================
   ROUTE GEOMETRY
   ========================================================= */

/**
 * Converts every station-to-station connection into
 * individual straight segments.
 */
function createAllLineSegments() {
  const segments = [];

  let connectionId = 0;

  for (
    let setIndex = 0;
    setIndex < sets.length;
    setIndex++
  ) {
    const points = sets[setIndex];

    if (!points) {
      continue;
    }

    for (let i = 1; i < points.length; i++) {
      const previousPoint = points[i - 1];
      const currentPoint = points[i];

      const connectionSegments =
        createConnectionSegments(
          previousPoint.x,
          previousPoint.y,
          currentPoint.x,
          currentPoint.y,
          setIndex,
          connectionId
        );

      segments.push(...connectionSegments);

      connectionId++;
    }
  }

  return segments;
}

/**
 * Joins two stations with a 45-degree run and a straight run.
 *
 * Diagonal first draws the angled piece, then the remaining
 * horizontal or vertical piece. Straight first does the opposite.
 */
function createConnectionSegments(
  x1,
  y1,
  x2,
  y2,
  setIndex,
  connectionId
) {
  const segments = [];

  const dx = abs(x2 - x1);
  const dy = abs(y2 - y1);

  if (dx < EPSILON && dy < EPSILON) {
    return segments;
  }

  const xSign = x2 >= x1 ? 1 : -1;
  const ySign = y2 >= y1 ? 1 : -1;

  const diagonalDistance = min(dx, dy);
  const straightDistance = abs(dx - dy);

  let cornerX;
  let cornerY;

  if (params.bend === "straight") {
    if (dx >= dy) {
      cornerX =
        x1 + xSign * straightDistance;

      cornerY = y1;
    } else {
      cornerX = x1;

      cornerY =
        y1 + ySign * straightDistance;
    }
  } else {
    cornerX =
      x1 + xSign * diagonalDistance;

    cornerY =
      y1 + ySign * diagonalDistance;
  }

  // Add the first section.
  if (
    abs(cornerX - x1) > EPSILON ||
    abs(cornerY - y1) > EPSILON
  ) {
    segments.push({
      x1,
      y1,
      x2: cornerX,
      y2: cornerY,
      setIndex,
      connectionId
    });
  }

  // Add the remaining straight or diagonal section.
  if (
    abs(cornerX - x2) > EPSILON ||
    abs(cornerY - y2) > EPSILON
  ) {
    segments.push({
      x1: cornerX,
      y1: cornerY,
      x2,
      y2,
      setIndex,
      connectionId
    });
  }

  return segments;
}

/* =========================================================
   ATOMIC NETWORK
   ========================================================= */

/**
 * Splits route segments at intersections and shared-path
 * boundaries.
 *
 * Identical resulting edges are grouped together so each
 * edge knows which routes use it.
 */
function buildAtomicNetwork(segments) {
  const splitPositions =
    segments.map(() => [0, 1]);

  const intersections = [];

  for (let i = 0; i < segments.length; i++) {
    for (
      let j = i + 1;
      j < segments.length;
      j++
    ) {
      const segmentA = segments[i];
      const segmentB = segments[j];

      const result =
        analyzeSegmentPair(
          segmentA,
          segmentB
        );

      if (result.type === "intersection") {
        addUniqueNumber(
          splitPositions[i],
          result.t
        );

        addUniqueNumber(
          splitPositions[j],
          result.u
        );

        const insideA =
          result.t > EPSILON &&
          result.t < 1 - EPSILON;

        const insideB =
          result.u > EPSILON &&
          result.u < 1 - EPSILON;

        /*
         * Parts of the same connection meet at their bend.
         * That should not create an intersection station.
         */
        if (
          segmentA.connectionId !==
            segmentB.connectionId &&
          (insideA || insideB)
        ) {
          addUniquePoint(
            intersections,
            result.point
          );
        }
      }

      if (result.type === "collinear") {
        /*
         * Use the endpoints as possible split positions.
         * Points outside the finite segments are ignored.
         */
        addPointAsSplit(
          segmentB.x1,
          segmentB.y1,
          segmentA,
          splitPositions[i]
        );

        addPointAsSplit(
          segmentB.x2,
          segmentB.y2,
          segmentA,
          splitPositions[i]
        );

        addPointAsSplit(
          segmentA.x1,
          segmentA.y1,
          segmentB,
          splitPositions[j]
        );

        addPointAsSplit(
          segmentA.x2,
          segmentA.y2,
          segmentB,
          splitPositions[j]
        );
      }
    }
  }

  const edgeGroups = new Map();

  /*
   * Split every original segment into its atomic pieces.
   */
  for (
    let segmentIndex = 0;
    segmentIndex < segments.length;
    segmentIndex++
  ) {
    const segment =
      segments[segmentIndex];

    const positions =
      splitPositions[segmentIndex]
        .map((value) => {
          return constrain(value, 0, 1);
        })
        .sort((a, b) => a - b);

    for (
      let positionIndex = 1;
      positionIndex < positions.length;
      positionIndex++
    ) {
      const startT =
        positions[positionIndex - 1];

      const endT =
        positions[positionIndex];

      if (endT - startT < EPSILON) {
        continue;
      }

      const start =
        pointAlongSegment(
          segment,
          startT
        );

      const end =
        pointAlongSegment(
          segment,
          endT
        );

      const canonical =
        canonicalizeEdge(start, end);

      const key =
        edgeKey(
          canonical.start,
          canonical.end
        );

      if (!edgeGroups.has(key)) {
        edgeGroups.set(key, {
          x1: canonical.start.x,
          y1: canonical.start.y,
          x2: canonical.end.x,
          y2: canonical.end.y,
          setIndices: new Set()
        });
      }

      edgeGroups
        .get(key)
        .setIndices
        .add(segment.setIndex);
    }
  }

  const edges = [];

  for (const edge of edgeGroups.values()) {
    edges.push({
      x1: edge.x1,
      y1: edge.y1,
      x2: edge.x2,
      y2: edge.y2,

      setIndices: Array
        .from(edge.setIndices)
        .sort((a, b) => a - b)
    });
  }

  /*
   * Attach route information to each generated
   * intersection station.
   */
  for (const station of intersections) {
    station.setIndices =
      getRouteIndicesAtPoint(
        station,
        edges
      );
  }

  return {
    edges,
    intersections
  };
}

/**
 * Determines how two finite segments relate.
 */
function analyzeSegmentPair(
  segmentA,
  segmentB
) {
  const p = {
    x: segmentA.x1,
    y: segmentA.y1
  };

  const r = {
    x: segmentA.x2 - segmentA.x1,
    y: segmentA.y2 - segmentA.y1
  };

  const q = {
    x: segmentB.x1,
    y: segmentB.y1
  };

  const s = {
    x: segmentB.x2 - segmentB.x1,
    y: segmentB.y2 - segmentB.y1
  };

  const qMinusP = {
    x: q.x - p.x,
    y: q.y - p.y
  };

  const denominator =
    crossProduct(r, s);

  // Non-parallel segments may have one intersection.
  if (abs(denominator) > EPSILON) {
    const t =
      crossProduct(qMinusP, s) /
      denominator;

    const u =
      crossProduct(qMinusP, r) /
      denominator;

    if (
      t >= -EPSILON &&
      t <= 1 + EPSILON &&
      u >= -EPSILON &&
      u <= 1 + EPSILON
    ) {
      return {
        type: "intersection",
        t,
        u,
        point: {
          x: p.x + t * r.x,
          y: p.y + t * r.y
        }
      };
    }

    return {
      type: "separate"
    };
  }

  /*
   * Parallel segments are collinear when the displacement
   * between them also has a zero cross product.
   */
  const collinear =
    abs(
      crossProduct(qMinusP, r)
    ) < EPSILON;

  if (collinear) {
    return {
      type: "collinear"
    };
  }

  return {
    type: "parallel"
  };
}

/* =========================================================
   CLOSE PARALLEL MERGING
   ========================================================= */

/**
 * Pulls parallel routes that run one grid cell apart onto
 * one shared track so the bundler can draw them as lanes.
 *
 * A short piece of the original route is kept at each end,
 * then a perpendicular step joins the shared track.
 */
function mergeCloseParallelSegments(segments) {
  const threshold =
    getParallelMergeDistance();

  const annotated = [];

  for (
    let index = 0;
    index < segments.length;
    index++
  ) {
    const item =
      annotateSegment(
        segments[index],
        index
      );

    if (item === null) {
      continue;
    }

    annotated.push(item);
  }

  const buckets = new Map();

  for (const item of annotated) {
    const key = item.direction.key;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key).push(item);
  }

  const merged = [];

  for (const bucket of buckets.values()) {
    const clusters =
      clusterParallelSegments(
        bucket,
        threshold
      );

    for (const cluster of clusters) {
      const spread =
        offsetSpread(cluster);

      if (
        cluster.length < 2 ||
        spread <= 0.01
      ) {
        for (const item of cluster) {
          merged.push(item.segment);
        }

        continue;
      }

      const targetOffset =
        averageOffset(cluster);

      for (const item of cluster) {
        const intervals =
          mergeIntervalsForItem(
            item,
            cluster,
            threshold
          );

        const pieces =
          snapSegmentToOffset(
            item,
            intervals,
            targetOffset
          );

        merged.push(...pieces);
      }
    }
  }

  return merged;
}

/**
 * Parallel tracks at most one grid cell apart can merge.
 */
function getParallelMergeDistance() {
  return min(cellWidth, cellHeight);
}

/**
 * Original track left in place before a route steps
 * onto the shared line.
 */
function getMergeLead() {
  return min(cellWidth, cellHeight);
}

/**
 * Describes a segment in a direction shared by every
 * parallel copy, including opposite travel directions.
 */
function annotateSegment(segment, index) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;

  const length = sqrt(
    dx * dx + dy * dy
  );

  if (length < EPSILON) {
    return null;
  }

  const direction =
    canonicalDirection(dx, dy);

  const t1 =
    segment.x1 * direction.x +
    segment.y1 * direction.y;

  const t2 =
    segment.x2 * direction.x +
    segment.y2 * direction.y;

  const offset1 =
    segment.x1 * direction.normalX +
    segment.y1 * direction.normalY;

  const offset2 =
    segment.x2 * direction.normalX +
    segment.y2 * direction.normalY;

  return {
    segment,
    index,
    direction,

    offset: (offset1 + offset2) / 2,

    tMin: min(t1, t2),
    tMax: max(t1, t2)
  };
}

/**
 * Snaps an arbitrary direction onto the metro directions:
 * horizontal, vertical, and both 45-degree diagonals.
 */
function canonicalDirection(dx, dy) {
  const length = sqrt(
    dx * dx + dy * dy
  );

  const ux = dx / length;
  const uy = dy / length;

  const diagonal = sqrt(0.5);

  const candidates = [
    { x: 1, y: 0 },
    { x: diagonal, y: diagonal },
    { x: 0, y: 1 },
    { x: -diagonal, y: diagonal }
  ];

  let best = candidates[0];
  let bestDot = -Infinity;

  for (const candidate of candidates) {
    const alignment = abs(
      ux * candidate.x +
        uy * candidate.y
    );

    if (alignment > bestDot) {
      bestDot = alignment;
      best = candidate;
    }
  }

  return {
    x: best.x,
    y: best.y,
    normalX: -best.y,
    normalY: best.x,
    key:
      best.x.toFixed(4) +
      "," +
      best.y.toFixed(4)
  };
}

/**
 * Groups segments that are one grid cell apart and that
 * overlap along their direction.
 */
function clusterParallelSegments(
  items,
  threshold
) {
  const parent = items.map(
    (_, index) => index
  );

  function find(index) {
    let current = index;

    while (parent[current] !== current) {
      parent[current] =
        parent[parent[current]];

      current = parent[current];
    }

    return current;
  }

  function unite(first, second) {
    const rootA = find(first);
    const rootB = find(second);

    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (
      let j = i + 1;
      j < items.length;
      j++
    ) {
      if (
        segmentsShouldMerge(
          items[i],
          items[j],
          threshold
        )
      ) {
        unite(i, j);
      }
    }
  }

  const groups = new Map();

  for (let i = 0; i < items.length; i++) {
    const root = find(i);

    if (!groups.has(root)) {
      groups.set(root, []);
    }

    groups.get(root).push(items[i]);
  }

  return Array.from(groups.values());
}

/**
 * True when two parallel segments are close enough,
 * and long enough together, to share a track.
 */
function segmentsShouldMerge(
  first,
  second,
  threshold
) {
  const separation = abs(
    first.offset - second.offset
  );

  if (separation > threshold + 0.5) {
    return false;
  }

  const overlap =
    min(first.tMax, second.tMax) -
    max(first.tMin, second.tMin);

  return (
    overlap >
    getParallelMergeDistance() * 0.25
  );
}

function offsetSpread(cluster) {
  let low = Infinity;
  let high = -Infinity;

  for (const item of cluster) {
    low = min(low, item.offset);
    high = max(high, item.offset);
  }

  return high - low;
}

function averageOffset(cluster) {
  let weight = 0;
  let sum = 0;

  for (const item of cluster) {
    const length =
      item.tMax - item.tMin;

    sum += item.offset * length;
    weight += length;
  }

  if (weight < EPSILON) {
    return cluster[0].offset;
  }

  return sum / weight;
}

/**
 * Overlap of this segment with its close neighbors,
 * kept clear of the segment ends.
 */
function mergeIntervalsForItem(
  item,
  cluster,
  threshold
) {
  const raw = [];

  for (const other of cluster) {
    if (other.index === item.index) {
      continue;
    }

    const separation = abs(
      item.offset - other.offset
    );

    if (separation > threshold + 0.5) {
      continue;
    }

    const start = max(
      item.tMin,
      other.tMin
    );

    const end = min(
      item.tMax,
      other.tMax
    );

    if (end - start > EPSILON) {
      raw.push({ start, end });
    }
  }

  const lead = getMergeLead();
  const trimmed = [];

  for (const interval of mergeIntervals(raw)) {
    const start = max(
      interval.start,
      item.tMin + lead
    );

    const end = min(
      interval.end,
      item.tMax - lead
    );

    if (end - start >= lead * 0.5) {
      trimmed.push({ start, end });
    }
  }

  return trimmed;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = intervals
    .slice()
    .sort((a, b) => a.start - b.start);

  const result = [
    {
      start: sorted[0].start,
      end: sorted[0].end
    }
  ];

  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const next = sorted[i];

    if (next.start <= last.end + 0.01) {
      last.end = max(last.end, next.end);
    } else {
      result.push({
        start: next.start,
        end: next.end
      });
    }
  }

  return result;
}

/**
 * Rebuilds one segment so the overlapping run lies on
 * the shared track. The ends stay on the original line.
 */
function snapSegmentToOffset(
  item,
  intervals,
  targetOffset
) {
  const segment = item.segment;

  if (intervals.length === 0) {
    return [segment];
  }

  const direction = item.direction;

  const t1 =
    segment.x1 * direction.x +
    segment.y1 * direction.y;

  const t2 =
    segment.x2 * direction.x +
    segment.y2 * direction.y;

  const span = t2 - t1;

  if (abs(span) < EPSILON) {
    return [segment];
  }

  const cuts = [0, 1];

  for (const interval of intervals) {
    cuts.push((interval.start - t1) / span);
    cuts.push((interval.end - t1) / span);
  }

  const fractions =
    uniqueSortedFractions(cuts);

  const pieces = [];

  let cursor = {
    x: segment.x1,
    y: segment.y1
  };

  for (
    let index = 0;
    index < fractions.length - 1;
    index++
  ) {
    const startFraction = fractions[index];
    const endFraction = fractions[index + 1];

    if (endFraction - startFraction < 0.0001) {
      continue;
    }

    const midT =
      t1 +
      ((startFraction + endFraction) / 2) *
        span;

    const snapped =
      intervalContains(intervals, midT);

    const start =
      pointOnSegmentFraction(
        segment,
        startFraction
      );

    const end =
      pointOnSegmentFraction(
        segment,
        endFraction
      );

    const pieceStart = snapped
      ? shiftToOffset(
          start,
          item,
          targetOffset
        )
      : start;

    const pieceEnd = snapped
      ? shiftToOffset(
          end,
          item,
          targetOffset
        )
      : end;

    pushRouteSegment(
      pieces,
      cursor,
      pieceStart,
      segment
    );

    pushRouteSegment(
      pieces,
      pieceStart,
      pieceEnd,
      segment
    );

    cursor = pieceEnd;
  }

  pushRouteSegment(
    pieces,
    cursor,
    {
      x: segment.x2,
      y: segment.y2
    },
    segment
  );

  if (pieces.length === 0) {
    return [segment];
  }

  return pieces;
}

function pointOnSegmentFraction(
  segment,
  fraction
) {
  return {
    x: lerp(
      segment.x1,
      segment.x2,
      fraction
    ),

    y: lerp(
      segment.y1,
      segment.y2,
      fraction
    )
  };
}

function shiftToOffset(
  point,
  item,
  targetOffset
) {
  const delta =
    targetOffset - item.offset;

  return {
    x:
      point.x +
      item.direction.normalX * delta,

    y:
      point.y +
      item.direction.normalY * delta
  };
}

function pushRouteSegment(
  pieces,
  start,
  end,
  template
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (
    dx * dx + dy * dy <
    EPSILON * EPSILON
  ) {
    return;
  }

  pieces.push({
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    setIndex: template.setIndex,
    connectionId: template.connectionId
  });
}

function uniqueSortedFractions(cuts) {
  const sorted = cuts
    .map((value) => constrain(value, 0, 1))
    .sort((a, b) => a - b);

  const result = [];

  for (const value of sorted) {
    const previous =
      result[result.length - 1];

    if (
      result.length === 0 ||
      abs(value - previous) > 0.0001
    ) {
      result.push(value);
    }
  }

  return result;
}

function intervalContains(intervals, t) {
  for (const interval of intervals) {
    if (
      t >= interval.start - 0.01 &&
      t <= interval.end + 0.01
    ) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   BUNDLED ROUTE DRAWING
   ========================================================= */

/**
 * Draws routes next to one another where paths are shared.
 */
function drawBundledLines() {
  const routeWidth =
    getRouteWidth();

  push();

  noFill();
  strokeWeight(routeWidth);
  strokeCap(ROUND);
  strokeJoin(ROUND);

  for (const edge of atomicEdges) {
    const dx =
      edge.x2 - edge.x1;

    const dy =
      edge.y2 - edge.y1;

    const edgeLength =
      sqrt(dx * dx + dy * dy);

    if (edgeLength < EPSILON) {
      continue;
    }

    const perpendicularX =
      -dy / edgeLength;

    const perpendicularY =
      dx / edgeLength;

    const laneCount =
      edge.setIndices.length;

    for (
      let laneIndex = 0;
      laneIndex < laneCount;
      laneIndex++
    ) {
      const setIndex =
        edge.setIndices[laneIndex];

      const centeredLane =
        laneIndex -
        (laneCount - 1) / 2;

      const offset =
        centeredLane * routeWidth;

      const offsetX =
        perpendicularX * offset;

      const offsetY =
        perpendicularY * offset;

      drawColoredSegment(
        edge.x1 + offsetX,
        edge.y1 + offsetY,
        edge.x2 + offsetX,
        edge.y2 + offsetY,
        setColors[setIndex]
      );
    }
  }

  pop();
}

/* =========================================================
   END-OF-LINE T MARKERS
   ========================================================= */

/**
 * Draws a terminus cap just past the first and last
 * station of every route.
 */
function drawEndOfLineCaps() {
  for (
    let setIndex = 0;
    setIndex < sets.length;
    setIndex++
  ) {
    const points = sets[setIndex];

    if (!points || points.length < 2) {
      continue;
    }

    const firstStation =
      points[0];

    const lastStation =
      points[points.length - 1];

    drawEndOfLineCap(
      points,
      setIndex,
      true
    );

    /*
     * Avoid drawing twice if the route starts and ends
     * at the same position.
     */
    if (
      !pointsApproximatelyEqual(
        firstStation,
        lastStation
      )
    ) {
      drawEndOfLineCap(
        points,
        setIndex,
        false
      );
    }
  }
}

/**
 * Draws one perpendicular terminus cap a short distance
 * past the station, with a stem connecting them.
 */
function drawEndOfLineCap(
  points,
  setIndex,
  atStart
) {
  const station = atStart
    ? points[0]
    : points[points.length - 1];

  const outward =
    getTerminusDirection(
      points,
      atStart
    );

  if (outward === null) {
    return;
  }

  const terminalEdge =
    findTerminalEdge(
      station,
      setIndex,
      outward
    );

  /*
   * Shared routes are offset into individual lanes.
   * Position the cap at this route's displayed lane.
   */
  const laneCenter =
    terminalEdge === null
      ? {
          x: station.x,
          y: station.y
        }
      : getRouteLanePositionAtPoint(
          station,
          terminalEdge.edge,
          setIndex
        );

  const stationRoutes =
    mergeRouteIndices(
      [setIndex],
      getRouteIndicesAtPoint(station)
    );

  const stationDiameter =
    getStationDiameter(
      station,
      stationRoutes
    );

  const extension =
    getEndOfLineExtension(
      stationDiameter
    );

  const capCenter = {
    x:
      laneCenter.x +
      outward.x * extension,

    y:
      laneCenter.y +
      outward.y * extension
  };

  const perpendicularX =
    -outward.y;

  const perpendicularY =
    outward.x;

  /*
   * Make the cap wider than the station so that both ends
   * remain visible beside the route stem.
   */
  const capLength =
    stationDiameter * 1.45;

  const halfCapLength =
    capLength / 2;

  push();

  strokeWeight(getRouteWidth());
  strokeCap(SQUARE);

  drawColoredSegment(
    laneCenter.x,
    laneCenter.y,
    capCenter.x,
    capCenter.y,
    setColors[setIndex]
  );

  drawColoredSegment(
    capCenter.x -
      perpendicularX * halfCapLength,

    capCenter.y -
      perpendicularY * halfCapLength,

    capCenter.x +
      perpendicularX * halfCapLength,

    capCenter.y +
      perpendicularY * halfCapLength,
    setColors[setIndex]
  );

  pop();
}

/**
 * How far past the station center the terminus bar sits.
 *
 * The bar clears the station circle by about one route
 * width.
 */
function getEndOfLineExtension(
  stationDiameter
) {
  return (
    stationDiameter / 2 +
    getRouteWidth()
  );
}

/**
 * Unit vector pointing out of the route at one terminus.
 */
function getTerminusDirection(
  points,
  atStart
) {
  if (!points || points.length < 2) {
    return null;
  }

  const origin = atStart
    ? points[0]
    : points[points.length - 2];

  const destination = atStart
    ? points[1]
    : points[points.length - 1];

  const segments =
    createConnectionSegments(
      origin.x,
      origin.y,
      destination.x,
      destination.y,
      0,
      0
    );

  if (segments.length === 0) {
    return null;
  }

  const segment = atStart
    ? segments[0]
    : segments[segments.length - 1];

  let dx =
    segment.x2 - segment.x1;

  let dy =
    segment.y2 - segment.y1;

  const length =
    sqrt(dx * dx + dy * dy);

  if (length < EPSILON) {
    return null;
  }

  dx /= length;
  dy /= length;

  if (atStart) {
    return {
      x: -dx,
      y: -dy
    };
  }

  return {
    x: dx,
    y: dy
  };
}

/**
 * Finds an atomic edge used by a route that ends at the
 * supplied station.
 *
 * When several edges meet there, the one aligned with the
 * outward terminus direction is preferred.
 */
function findTerminalEdge(
  station,
  setIndex,
  direction
) {
  let fallback = null;

  for (const edge of atomicEdges) {
    if (
      !edge.setIndices.includes(setIndex)
    ) {
      continue;
    }

    const edgeStart = {
      x: edge.x1,
      y: edge.y1
    };

    const edgeEnd = {
      x: edge.x2,
      y: edge.y2
    };

    const matchesStart =
      pointsApproximatelyEqual(
        station,
        edgeStart
      );

    const matchesEnd =
      pointsApproximatelyEqual(
        station,
        edgeEnd
      );

    if (!matchesStart && !matchesEnd) {
      continue;
    }

    const candidate = {
      edge,
      matchesStart,
      matchesEnd
    };

    if (fallback === null) {
      fallback = candidate;
    }

    if (!direction) {
      continue;
    }

    const edgeDx =
      edge.x2 - edge.x1;

    const edgeDy =
      edge.y2 - edge.y1;

    const edgeLength =
      sqrt(
        edgeDx * edgeDx +
          edgeDy * edgeDy
      );

    if (edgeLength < EPSILON) {
      continue;
    }

    const alignment = abs(
      (edgeDx / edgeLength) *
        direction.x +
        (edgeDy / edgeLength) *
          direction.y
    );

    if (alignment > 0.9) {
      return candidate;
    }
  }

  return fallback;
}

/**
 * Returns the displayed lane position of a route at a point.
 */
function getRouteLanePositionAtPoint(
  point,
  edge,
  setIndex
) {
  const dx =
    edge.x2 - edge.x1;

  const dy =
    edge.y2 - edge.y1;

  const edgeLength =
    sqrt(dx * dx + dy * dy);

  if (edgeLength < EPSILON) {
    return {
      x: point.x,
      y: point.y
    };
  }

  const perpendicularX =
    -dy / edgeLength;

  const perpendicularY =
    dx / edgeLength;

  const laneIndex =
    edge.setIndices.indexOf(setIndex);

  if (laneIndex === -1) {
    return {
      x: point.x,
      y: point.y
    };
  }

  const laneCount =
    edge.setIndices.length;

  const centeredLane =
    laneIndex -
    (laneCount - 1) / 2;

  const offset =
    centeredLane * getRouteWidth();

  return {
    x:
      point.x +
      perpendicularX * offset,

    y:
      point.y +
      perpendicularY * offset
  };
}

/* =========================================================
   INTERSECTION STATIONS
   ========================================================= */

/**
 * Draws automatically generated intersection stations.
 */
function drawIntersectionStations() {
  const originalStations =
    getOriginalStationGroups();

  for (
    const station of intersectionStations
  ) {
    /*
     * If an original station already exists here, it is
     * drawn later by drawOriginalStations().
     */
    if (
      containsPoint(
        originalStations,
        station
      )
    ) {
      continue;
    }

    /*
     * Crossings in the river are not stations.
     */
    if (pointInWater(station.x, station.y)) {
      continue;
    }

    const routes =
      station.setIndices ??
      getRouteIndicesAtPoint(station);

    drawMulticolorStation(
      station,
      routes
    );
  }
}

/**
 * Groups original stations that occupy the same position.
 */
function getOriginalStationGroups() {
  const groups = new Map();

  for (
    let setIndex = 0;
    setIndex < sets.length;
    setIndex++
  ) {
    const points = sets[setIndex];

    if (!points) {
      continue;
    }

    for (const point of points) {
      const key =
        pointKey(point);

      if (!groups.has(key)) {
        groups.set(key, {
          x: point.x,
          y: point.y,
          setIndices: new Set()
        });
      }

      groups
        .get(key)
        .setIndices
        .add(setIndex);
    }
  }

  return Array
    .from(groups.values())
    .map((station) => {
      return {
        x: station.x,
        y: station.y,

        setIndices: Array
          .from(station.setIndices)
          .sort((a, b) => a - b)
      };
    });
}

/**
 * Draws the explicitly created stations.
 */
function drawOriginalStations() {
  const stations =
    getOriginalStationGroups();

  for (const station of stations) {
    if (pointInWater(station.x, station.y)) {
      continue;
    }

    /*
     * Include both routes that explicitly have a station
     * here and routes that pass through this location.
     */
    const passingRoutes =
      getRouteIndicesAtPoint(station);

    const allRoutes =
      mergeRouteIndices(
        station.setIndices,
        passingRoutes
      );

    drawMulticolorStation(
      station,
      allRoutes
    );
  }
}

/* =========================================================
   CONCENTRIC STATION RINGS
   ========================================================= */

/**
 * Draws one complete concentric ring for each route passing
 * through the station.
 */
function drawMulticolorStation(
  station,
  routeIndices
) {
  const routes = Array
    .from(new Set(routeIndices))
    .sort((a, b) => a - b);

  if (routes.length === 0) {
    return;
  }

  const outerDiameter =
    getStationDiameter(
      station,
      routes
    );

  const ringWidth =
    getStationStrokeWidth();

  const ringGap =
    getStationRingGap();

  /*
   * Cover the route lines beneath the station.
   */
  push();

  noStroke();
  fill(255);

  circle(
    station.x,
    station.y,
    outerDiameter
  );

  pop();

  /*
   * Draw full route-colored rings from outside inward.
   */
  push();

  noFill();
  strokeWeight(ringWidth);

  for (
    let routeIndex = 0;
    routeIndex < routes.length;
    routeIndex++
  ) {
    const setIndex =
      routes[routeIndex];

    const ringDiameter =
      outerDiameter -
      ringWidth -
      routeIndex *
        2 *
        (ringWidth + ringGap);

    if (ringDiameter <= ringWidth) {
      break;
    }

    stroke(setColors[setIndex]);

    circle(
      station.x,
      station.y,
      ringDiameter
    );
  }

  pop();
}

/**
 * Calculates the station diameter.
 *
 * It must be large enough to cover the route bundle and
 * contain every concentric ring.
 */
function getStationDiameter(
  point,
  routeIndices = null
) {
  let routes = routeIndices;

  if (routes === null) {
    routes =
      getRouteIndicesAtPoint(point);
  }

  routes = Array.from(
    new Set(routes)
  );

  const routeCount =
    max(1, routes.length);

  const baseDiameter =
    min(cellWidth, cellHeight);

  const bundleWidth =
    getWidestBundleAtPoint(point);

  const ringWidth =
    getStationStrokeWidth();

  const ringGap =
    getStationRingGap();

  const minimumInnerDiameter =
    min(cellWidth, cellHeight) * 0.25;

  /*
   * Space required by all concentric rings and the white
   * center.
   */
  const ringsDiameter =
    minimumInnerDiameter +
    2 * ringWidth +
    2 *
      (routeCount - 1) *
      (ringWidth + ringGap);

  /*
   * Space required to cover the route bundle below.
   */
  const bundleDiameter =
    bundleWidth +
    ringWidth * 2;

  return max(
    baseDiameter,
    ringsDiameter,
    bundleDiameter
  );
}

/**
 * Finds the widest route bundle that passes through a point.
 */
function getWidestBundleAtPoint(point) {
  const routeWidth =
    getRouteWidth();

  let widestBundle =
    routeWidth;

  for (const edge of atomicEdges) {
    if (pointOnSegment(point, edge)) {
      const bundleWidth =
        edge.setIndices.length *
        routeWidth;

      widestBundle = max(
        widestBundle,
        bundleWidth
      );
    }
  }

  return widestBundle;
}

function getRouteWidth() {
  return (
    min(cellWidth, cellHeight) * 0.6
  );
}

function getStationStrokeWidth() {
  return (
    min(cellWidth, cellHeight) * 0.2
  );
}

function getStationRingGap() {
  return (
    getStationStrokeWidth() * 0.35
  );
}

/* =========================================================
   ROUTE LOOKUP
   ========================================================= */

/**
 * Returns every route that passes through a point.
 */
function getRouteIndicesAtPoint(
  point,
  edges = atomicEdges
) {
  const routeIndices =
    new Set();

  for (const edge of edges) {
    if (!pointOnSegment(point, edge)) {
      continue;
    }

    for (
      const setIndex of edge.setIndices
    ) {
      routeIndices.add(setIndex);
    }
  }

  return Array
    .from(routeIndices)
    .sort((a, b) => a - b);
}

/**
 * Combines route-index arrays without duplicates.
 */
function mergeRouteIndices(
  ...routeArrays
) {
  const result =
    new Set();

  for (const routeArray of routeArrays) {
    if (!routeArray) {
      continue;
    }

    for (const setIndex of routeArray) {
      result.add(setIndex);
    }
  }

  return Array
    .from(result)
    .sort((a, b) => a - b);
}

/* =========================================================
   GEOMETRY HELPERS
   ========================================================= */

/**
 * Adds a point as a splitting position on a segment if the
 * point lies on that segment.
 */
function addPointAsSplit(
  x,
  y,
  segment,
  positions
) {
  const point = { x, y };

  if (!pointOnSegment(point, segment)) {
    return;
  }

  const t =
    getPointParameter(
      point,
      segment
    );

  if (
    t >= -EPSILON &&
    t <= 1 + EPSILON
  ) {
    addUniqueNumber(
      positions,
      t
    );
  }
}

/**
 * Returns a point's relative position along a segment.
 *
 * 0 is the beginning and 1 is the end.
 */
function getPointParameter(
  point,
  segment
) {
  const dx =
    segment.x2 - segment.x1;

  const dy =
    segment.y2 - segment.y1;

  if (abs(dx) >= abs(dy)) {
    if (abs(dx) < EPSILON) {
      return 0;
    }

    return (
      (point.x - segment.x1) / dx
    );
  }

  if (abs(dy) < EPSILON) {
    return 0;
  }

  return (
    (point.y - segment.y1) / dy
  );
}

/**
 * Returns a point at position t along a segment.
 */
function pointAlongSegment(
  segment,
  t
) {
  return {
    x: lerp(
      segment.x1,
      segment.x2,
      t
    ),

    y: lerp(
      segment.y1,
      segment.y2,
      t
    )
  };
}

/**
 * Gives every edge a stable direction.
 */
function canonicalizeEdge(
  start,
  end
) {
  const startComesFirst =
    start.x < end.x - EPSILON ||
    (
      abs(start.x - end.x) < EPSILON &&
      start.y <= end.y
    );

  if (startComesFirst) {
    return {
      start,
      end
    };
  }

  return {
    start: end,
    end: start
  };
}

/**
 * Checks whether a point lies on a finite line segment.
 */
function pointOnSegment(
  point,
  segment
) {
  const segmentVector = {
    x: segment.x2 - segment.x1,
    y: segment.y2 - segment.y1
  };

  const pointVector = {
    x: point.x - segment.x1,
    y: point.y - segment.y1
  };

  const cross =
    crossProduct(
      segmentVector,
      pointVector
    );

  const segmentLength =
    sqrt(
      segmentVector.x *
        segmentVector.x +
      segmentVector.y *
        segmentVector.y
    );

  if (
    abs(cross) >
    EPSILON * max(1, segmentLength)
  ) {
    return false;
  }

  return (
    point.x >=
      min(segment.x1, segment.x2) -
        EPSILON &&

    point.x <=
      max(segment.x1, segment.x2) +
        EPSILON &&

    point.y >=
      min(segment.y1, segment.y2) -
        EPSILON &&

    point.y <=
      max(segment.y1, segment.y2) +
        EPSILON
  );
}

/**
 * Calculates the 2D cross product of two vectors.
 */
function crossProduct(
  vectorA,
  vectorB
) {
  return (
    vectorA.x * vectorB.y -
    vectorA.y * vectorB.x
  );
}

function pointsApproximatelyEqual(
  pointA,
  pointB
) {
  const tolerance = 0.001;

  return (
    abs(pointA.x - pointB.x) <
      tolerance &&

    abs(pointA.y - pointB.y) <
      tolerance
  );
}

/* =========================================================
   UNIQUE VALUES AND KEYS
   ========================================================= */

function addUniqueNumber(
  numbers,
  candidate
) {
  const exists =
    numbers.some((number) => {
      return (
        abs(number - candidate) <
        EPSILON
      );
    });

  if (!exists) {
    numbers.push(candidate);
  }
}

function addUniquePoint(
  points,
  candidate
) {
  if (!containsPoint(points, candidate)) {
    points.push(candidate);
  }
}

function containsPoint(
  points,
  candidate
) {
  const tolerance = 0.001;

  return points.some((point) => {
    return (
      abs(point.x - candidate.x) <
        tolerance &&

      abs(point.y - candidate.y) <
        tolerance
    );
  });
}

function edgeKey(start, end) {
  return (
    pointKey(start) +
    "|" +
    pointKey(end)
  );
}

function pointKey(point) {
  const precision = 1000;

  const x =
    round(point.x * precision) /
    precision;

  const y =
    round(point.y * precision) /
    precision;

  return `${x},${y}`;
}

/* =========================================================
   OPTIONAL GRID
   ========================================================= */

function drawGrid(
  rows,
  cols,
  startX,
  startY,
  gridWidth,
  gridHeight
) {
  push();

  translate(startX, startY);

  stroke(90, 80, 60, 80);
  strokeWeight(1);

  const gridCellWidth =
    gridWidth / cols;

  const gridCellHeight =
    gridHeight / rows;

  for (let col = 0; col <= cols; col++) {
    const x =
      col * gridCellWidth;

    line(
      x,
      0,
      x,
      gridHeight
    );
  }

  for (let row = 0; row <= rows; row++) {
    const y =
      row * gridCellHeight;

    line(
      0,
      y,
      gridWidth,
      y
    );
  }

  pop();
}

/* =========================================================
   ROUTE LEGEND
   ========================================================= */

/**
 * Draws the line key used to choose which route receives
 * new stations.
 */
function drawRouteLegend() {
  const layout =
    getLegendLayout();

  push();

  fill(255);
  stroke(190);
  strokeWeight(1);

  rect(
    layout.x,
    layout.y,
    layout.width,
    layout.height,
    10
  );

  for (
    let setIndex = 0;
    setIndex < sets.length;
    setIndex++
  ) {
    const bounds =
      getLegendItemBounds(
        layout,
        setIndex
      );

    const selected =
      setIndex === selectedSetIndex;

    if (selected) {
      fill(255);
      stroke(25);
      strokeWeight(2);

      rect(
        bounds.x - 5,
        bounds.y - 5,
        bounds.width + 10,
        bounds.height + 10,
        8
      );
    }

    noStroke();
    fill(setColors[setIndex]);

    rect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      bounds.height / 2
    );

    fill(255);

    circle(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.height * 0.7
    );
  }

  pop();
}

/**
 * Legend panel geometry. Swatches sit in one row.
 */
function getLegendLayout() {
  const itemWidth = 36;
  const itemHeight = 12;
  const gap = 14;
  const padX = 14;
  const padY = 14;
  const count = sets.length;

  const panelWidth =
    padX * 2 +
    count * itemWidth +
    max(0, count - 1) * gap;

  const panelHeight =
    padY * 2 + itemHeight;

  return {
    x: 16,
    y: 16,
    width: panelWidth,
    height: panelHeight,
    itemWidth,
    itemHeight,
    gap,
    padX,
    padY
  };
}

/**
 * Bounds of one color swatch inside the legend.
 */
function getLegendItemBounds(
  layout,
  setIndex
) {
  return {
    x:
      layout.x +
      layout.padX +
      setIndex *
        (layout.itemWidth + layout.gap),

    y:
      layout.y + layout.padY,

    width: layout.itemWidth,
    height: layout.itemHeight
  };
}

/**
 * Returns the route under a legend click, or -1.
 */
function legendIndexAt(x, y) {
  const layout =
    getLegendLayout();

  for (
    let setIndex = 0;
    setIndex < sets.length;
    setIndex++
  ) {
    const bounds =
      getLegendItemBounds(
        layout,
        setIndex
      );

    const hitPadding = 6;

    const inside =
      x >= bounds.x - hitPadding &&
      x <=
        bounds.x +
          bounds.width +
          hitPadding &&
      y >= bounds.y - hitPadding &&
      y <=
        bounds.y +
          bounds.height +
          hitPadding;

    if (inside) {
      return setIndex;
    }
  }

  return -1;
}

/**
 * True when the pointer is over the legend panel.
 */
function isInsideLegend(x, y) {
  const layout =
    getLegendLayout();

  return (
    x >= layout.x &&
    x <= layout.x + layout.width &&
    y >= layout.y &&
    y <= layout.y + layout.height
  );
}

/* =========================================================
   TERRAIN
   ========================================================= */

/**
 * Builds land, water, parks, and gray walls.
 * Every outline uses horizontal, vertical, or 45-degree edges.
 */
function createTerrain() {
  terrain = {
    waters: [],
    parks: [],
    walls: []
  };

  for (
    let index = 0;
    index < params.water;
    index++
  ) {
    if (index === 0) {
      terrain.waters.push(
        createRiverPolygon()
      );
    } else {
      terrain.waters.push(
        createLakePolygon()
      );
    }
  }

  for (
    let index = 0;
    index < params.parks;
    index++
  ) {
    terrain.parks.push(createPark());
  }

  for (
    let index = 0;
    index < params.walls;
    index++
  ) {
    terrain.walls.push(createWall());
  }
}

/**
 * Drops stations whose cells now fall in water.
 */
function removeStationsInWater() {
  for (const points of sets) {
    if (!points) {
      continue;
    }

    for (
      let index = points.length - 1;
      index >= 0;
      index--
    ) {
      const point = points[index];

      if (
        !canPlaceStation(point.x, point.y)
      ) {
        points.splice(index, 1);
      }
    }
  }
}

/**
 * A river of straight runs and 45-degree bends.
 */
function createRiverPolygon() {
  const cell = gridSize();
  const step = cell * randomInt(5, 8);
  const half = cell * randomInt(2, 3);

  const forward = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ];

  let y = snapToGrid(
    random(height * 0.28, height * 0.72)
  );

  y = constrain(
    y,
    half + cell * 2,
    height - half - cell * 2
  );

  const points = [{ x: 0, y }];
  let x = 0;
  let direction = forward[0];

  while (x < width && points.length < 10) {
    if (random() < 0.4) {
      direction =
        forward[floor(random(forward.length))];
    }

    let nextY = y + direction.y * step;

    if (
      nextY < half + cell ||
      nextY > height - half - cell
    ) {
      direction = forward[0];
      nextY = y;
    }

    const nextX = x + direction.x * step;

    points.push({
      x: nextX,
      y: nextY
    });

    x = nextX;
    y = nextY;
  }

  const last = points[points.length - 1];

  if (last.x !== width && points.length >= 2) {
    const previous = points[points.length - 2];
    const span = last.x - previous.x;

    if (abs(span) > EPSILON) {
      const t = constrain(
        (width - previous.x) / span,
        0,
        1
      );

      points[points.length - 1] = {
        x: previous.x + span * t,
        y:
          previous.y +
          (last.y - previous.y) * t
      };
    }
  }

  return ribbonPolygon(points, half);
}

/**
 * A lake with right-angle or 45-degree corners.
 */
function createLakePolygon() {
  const kind = floor(random(3));

  if (kind === 0) {
    return randomRectangle(4, 8, 3, 6);
  }

  if (kind === 1) {
    return randomOctagon(5, 9, 4, 7);
  }

  return randomRibbon(2, 4, 2, 3);
}

/**
 * A park with the same corner language as the routes.
 */
function createPark() {
  const kind = floor(random(4));

  if (kind === 0) {
    return randomRectangle(
      cellsBetween(0.28, 0.34),
      cellsBetween(0.42, 0.52),
      cellsBetween(0.20, 0.26),
      cellsBetween(0.34, 0.44)
    );
  }

  if (kind === 1) {
    return randomOctagon(
      cellsBetween(0.26, 0.32),
      cellsBetween(0.40, 0.50),
      cellsBetween(0.22, 0.28),
      cellsBetween(0.34, 0.44)
    );
  }

  if (kind === 2) {
    return randomLShape(
      cellsBetween(0.32, 0.38),
      cellsBetween(0.48, 0.58),
      cellsBetween(0.12, 0.16),
      cellsBetween(0.18, 0.24)
    );
  }

  return randomDiamond(
    cellsBetween(0.12, 0.16),
    cellsBetween(0.20, 0.26)
  );
}

/**
 * A gray wall: a large block, an L, or a wide angled bar.
 */
function createWall() {
  const kind = floor(random(3));

  if (kind === 0) {
    return randomRectangle(
      cellsBetween(0.24, 0.30),
      cellsBetween(0.42, 0.52),
      cellsBetween(0.14, 0.18),
      cellsBetween(0.26, 0.34)
    );
  }

  if (kind === 1) {
    return randomLShape(
      cellsBetween(0.30, 0.36),
      cellsBetween(0.46, 0.56),
      cellsBetween(0.10, 0.14),
      cellsBetween(0.16, 0.22)
    );
  }

  return randomRibbon(
    2,
    3,
    cellsBetween(0.05, 0.07),
    cellsBetween(0.09, 0.13)
  );
}

/**
 * A cell count that stays a large fraction of the grid.
 */
function cellsBetween(minFraction, maxFraction) {
  const limit = max(4, params.cells - 2);

  const minCount = min(
    limit,
    max(4, round(params.cells * minFraction))
  );

  const maxCount = min(
    limit,
    max(minCount, round(params.cells * maxFraction))
  );

  return randomInt(minCount, maxCount);
}

function randomRectangle(
  minW,
  maxW,
  minH,
  maxH
) {
  const cell = gridSize();
  const w = cell * randomInt(minW, maxW);
  const h = cell * randomInt(minH, maxH);
  const origin = randomOrigin(w, h);

  return rectanglePolygon(
    origin.x,
    origin.y,
    w,
    h
  );
}

function randomOctagon(minW, maxW, minH, maxH) {
  const cell = gridSize();
  const w = cell * randomInt(minW, maxW);
  const h = cell * randomInt(minH, maxH);
  const origin = randomOrigin(w, h);
  const maxCut = max(
    1,
    floor(min(w, h) / cell / 2) - 1
  );
  const cut = cell * randomInt(1, maxCut);

  return octagonPolygon(
    origin.x,
    origin.y,
    w,
    h,
    cut
  );
}

function randomLShape(
  minOuter,
  maxOuter,
  minThick,
  maxThick
) {
  const cell = gridSize();
  const outerW = cell * randomInt(minOuter, maxOuter);
  const outerH = cell * randomInt(minOuter, maxOuter);
  const thick = cell * randomInt(minThick, maxThick);
  const origin = randomOrigin(outerW, outerH);

  return lPolygon(
    origin.x,
    origin.y,
    outerW,
    outerH,
    min(thick, outerW - cell, outerH - cell),
    random() < 0.5,
    random() < 0.5
  );
}

function randomDiamond(minRadius, maxRadius) {
  const cell = gridSize();
  const radius = cell * randomInt(minRadius, maxRadius);
  const origin = randomOrigin(
    radius * 2,
    radius * 2
  );

  return diamondPolygon(
    origin.x + radius,
    origin.y + radius,
    radius
  );
}

/**
 * A short corridor of straight and 45-degree runs.
 */
function randomRibbon(minSeg, maxSeg, minHalf, maxHalf) {
  const cell = gridSize();
  const halfCells = randomInt(minHalf, maxHalf);
  const step = cell * max(
    halfCells,
    randomInt(6, 12)
  );
  const half = cell * halfCells;
  const count = randomInt(minSeg, maxSeg);

  const directions = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 }
  ];

  let dir = floor(random(directions.length));

  let point = {
    x: snapToGrid(random(cell * 3, width - cell * 3)),
    y: snapToGrid(random(cell * 3, height - cell * 3))
  };

  const points = [{ ...point }];

  for (let index = 0; index < count; index++) {
    const turn = random() < 0.5
      ? 0
      : (random() < 0.5 ? 1 : -1);

    const nextDir = (dir + turn + 8) % 8;
    const direction = directions[nextDir];

    const next = {
      x: point.x + direction.x * step,
      y: point.y + direction.y * step
    };

    if (
      next.x < half ||
      next.y < half ||
      next.x > width - half ||
      next.y > height - half
    ) {
      continue;
    }

    points.push(next);
    point = next;
    dir = nextDir;
  }

  if (points.length < 2) {
    return randomRectangle(
      max(2, minHalf * 2),
      max(4, maxHalf * 3),
      max(2, minHalf),
      max(3, maxHalf * 2)
    );
  }

  return ribbonPolygon(points, half);
}

function rectanglePolygon(x, y, w, h) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
}

function octagonPolygon(x, y, w, h, cut) {
  const inset = min(cut, w / 2, h / 2);

  return [
    { x: x + inset, y },
    { x: x + w - inset, y },
    { x: x + w, y: y + inset },
    { x: x + w, y: y + h - inset },
    { x: x + w - inset, y: y + h },
    { x: x + inset, y: y + h },
    { x, y: y + h - inset },
    { x, y: y + inset }
  ];
}

function lPolygon(
  x,
  y,
  outerW,
  outerH,
  thickness,
  flipX,
  flipY
) {
  let points = [
    { x, y },
    { x: x + thickness, y },
    {
      x: x + thickness,
      y: y + outerH - thickness
    },
    { x: x + outerW, y: y + outerH - thickness },
    { x: x + outerW, y: y + outerH },
    { x, y: y + outerH }
  ];

  if (flipX) {
    points = points.map((point) => {
      return {
        x: x + outerW - (point.x - x),
        y: point.y
      };
    });
  }

  if (flipY) {
    points = points.map((point) => {
      return {
        x: point.x,
        y: y + outerH - (point.y - y)
      };
    });
  }

  return points;
}

function diamondPolygon(centerX, centerY, radius) {
  return [
    { x: centerX, y: centerY - radius },
    { x: centerX + radius, y: centerY },
    { x: centerX, y: centerY + radius },
    { x: centerX - radius, y: centerY }
  ];
}

/**
 * Thickens an octilinear centerline into a polygon.
 */
function ribbonPolygon(centerline, halfWidth) {
  const cleaned = dedupePoints(centerline);

  if (cleaned.length < 2) {
    return cleaned;
  }

  const left = offsetPolyline(
    cleaned,
    halfWidth
  );

  const right = offsetPolyline(
    cleaned,
    -halfWidth
  );

  return left.concat(right.reverse());
}

function offsetPolyline(points, distance) {
  const offsets = [];

  for (
    let index = 0;
    index < points.length;
    index++
  ) {
    const current = points[index];

    if (index === 0) {
      const normal = segmentNormal(
        current,
        points[index + 1]
      );

      offsets.push(
        addScaled(current, normal, distance)
      );

      continue;
    }

    if (index === points.length - 1) {
      const normal = segmentNormal(
        points[index - 1],
        current
      );

      offsets.push(
        addScaled(current, normal, distance)
      );

      continue;
    }

    const previous = points[index - 1];
    const next = points[index + 1];

    const normalIn = segmentNormal(
      previous,
      current
    );

    const normalOut = segmentNormal(
      current,
      next
    );

    const directionIn = segmentDirection(
      previous,
      current
    );

    const directionOut = segmentDirection(
      current,
      next
    );

    offsets.push(
      lineIntersection(
        addScaled(current, normalIn, distance),
        directionIn,
        addScaled(current, normalOut, distance),
        directionOut
      )
    );
  }

  return offsets;
}

function segmentDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = sqrt(dx * dx + dy * dy);

  if (length < EPSILON) {
    return { x: 1, y: 0 };
  }

  return {
    x: dx / length,
    y: dy / length
  };
}

function segmentNormal(start, end) {
  const direction = segmentDirection(start, end);

  return {
    x: -direction.y,
    y: direction.x
  };
}

function addScaled(point, vector, scale) {
  return {
    x: point.x + vector.x * scale,
    y: point.y + vector.y * scale
  };
}

function lineIntersection(originA, directionA, originB, directionB) {
  const delta = {
    x: originB.x - originA.x,
    y: originB.y - originA.y
  };

  const denominator = crossProduct(
    directionA,
    directionB
  );

  if (abs(denominator) < EPSILON) {
    return {
      x: originA.x,
      y: originA.y
    };
  }

  const t = crossProduct(delta, directionB) / denominator;

  return {
    x: originA.x + directionA.x * t,
    y: originA.y + directionA.y * t
  };
}

function dedupePoints(points) {
  const result = [];

  for (const point of points) {
    const last = result[result.length - 1];

    if (
      !last ||
      abs(last.x - point.x) > 0.01 ||
      abs(last.y - point.y) > 0.01
    ) {
      result.push(point);
    }
  }

  return result;
}

function updateCellSize() {
  const count = max(2, params.cells);

  cellWidth = width / count;
  cellHeight = height / count;
}

/**
 * Rebuilds the grid and keeps stations on the new cells.
 */
function applyCellCount() {
  updateCellSize();
  resnapStations();
  createTerrain();
  removeStationsInWater();
  renderScene();
}

function resnapStations() {
  for (const points of sets) {
    if (!points) {
      continue;
    }

    for (const point of points) {
      point.x =
        floor(point.x / cellWidth) *
          cellWidth +
        cellWidth / 2;

      point.y =
        floor(point.y / cellHeight) *
          cellHeight +
        cellHeight / 2;

      point.x = constrain(
        point.x,
        cellWidth / 2,
        width - cellWidth / 2
      );

      point.y = constrain(
        point.y,
        cellHeight / 2,
        height - cellHeight / 2
      );
    }
  }
}

function gridSize() {
  return min(cellWidth, cellHeight);
}

function snapToGrid(value) {
  const size = gridSize();
  return round(value / size) * size;
}

function randomInt(minValue, maxValue) {
  const low = min(minValue, maxValue);
  const high = max(minValue, maxValue);

  return floor(random(low, high + 1));
}

function randomOrigin(shapeWidth, shapeHeight) {
  const cell = gridSize();
  const maxX = max(cell, width - shapeWidth);
  const maxY = max(cell, height - shapeHeight);

  return {
    x: snapToGrid(random(0, maxX)),
    y: snapToGrid(random(0, maxY))
  };
}

/**
 * Draws land, walls, parks, then water.
 */
function drawTerrain() {
  background(LAND_COLOR);

  noStroke();

  fill(WALL_COLOR);

  for (const wall of terrain.walls) {
    drawPolygon(wall);
  }

  fill(PARK_COLOR);

  for (const park of terrain.parks) {
    drawPolygon(park);
  }

  fill(WATER_COLOR);

  for (const water of terrain.waters) {
    drawPolygon(water);
  }
}

function drawPolygon(points) {
  if (!points || points.length < 3) {
    return;
  }

  beginShape();

  for (const point of points) {
    vertex(point.x, point.y);
  }

  endShape(CLOSE);
}

function pointInWater(x, y) {
  for (const water of terrain.waters) {
    if (pointInPolygon(x, y, water)) {
      return true;
    }
  }

  return false;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index];
    const prior = polygon[previous];

    const crosses =
      current.y > y !== prior.y > y;

    if (!crosses) {
      continue;
    }

    const xHit =
      ((prior.x - current.x) * (y - current.y)) /
        (prior.y - current.y) +
      current.x;

    if (x < xHit) {
      inside = !inside;
    }
  }

  return inside;
}

/* =========================================================
   LAND AND WATER STROKES
   ========================================================= */

/**
 * Draws a route solid on land and dotted over water.
 */
function drawColoredSegment(
  x1,
  y1,
  x2,
  y2,
  paint
) {
  const pieces =
    splitSegmentByTerrain(x1, y1, x2, y2);

  for (const piece of pieces) {
    if (piece.water) {
      drawDottedSegment(
        piece.x1,
        piece.y1,
        piece.x2,
        piece.y2,
        paint
      );
    } else {
      stroke(paint);

      line(
        piece.x1,
        piece.y1,
        piece.x2,
        piece.y2
      );
    }
  }
}

/**
 * Splits a segment where it enters or leaves water.
 */
function splitSegmentByTerrain(x1, y1, x2, y2) {
  const length = dist(x1, y1, x2, y2);

  if (length < EPSILON) {
    return [
      {
        x1,
        y1,
        x2,
        y2,
        water: pointInWater(x1, y1)
      }
    ];
  }

  const step =
    min(cellWidth, cellHeight) * 0.35;

  const samples = max(
    2,
    ceil(length / step)
  );

  const pieces = [];

  let pieceStart = 0;
  let water = pointInWater(x1, y1);

  for (
    let sample = 1;
    sample <= samples;
    sample++
  ) {
    const t = sample / samples;

    const sampleWater = pointInWater(
      lerp(x1, x2, t),
      lerp(y1, y2, t)
    );

    if (sampleWater === water) {
      continue;
    }

    const boundary =
      (sample - 0.5) / samples;

    pieces.push(
      makeTerrainPiece(
        x1,
        y1,
        x2,
        y2,
        pieceStart,
        boundary,
        water
      )
    );

    pieceStart = boundary;
    water = sampleWater;
  }

  pieces.push(
    makeTerrainPiece(
      x1,
      y1,
      x2,
      y2,
      pieceStart,
      1,
      water
    )
  );

  return pieces;
}

function makeTerrainPiece(
  x1,
  y1,
  x2,
  y2,
  startT,
  endT,
  water
) {
  return {
    x1: lerp(x1, x2, startT),
    y1: lerp(y1, y2, startT),
    x2: lerp(x1, x2, endT),
    y2: lerp(y1, y2, endT),
    water
  };
}

/**
 * Round dots in the route color, with water showing
 * between them.
 */
function drawDottedSegment(
  x1,
  y1,
  x2,
  y2,
  paint
) {
  const length = dist(x1, y1, x2, y2);
  const diameter = getRouteWidth() * 0.7;
  const spacing = getRouteWidth() * 1.65;

  push();

  noStroke();
  fill(paint);

  if (length <= spacing) {
    circle(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      diameter
    );

    pop();
    return;
  }

  let distance = spacing * 0.5;

  while (distance < length) {
    const t = distance / length;

    circle(
      lerp(x1, x2, t),
      lerp(y1, y2, t),
      diameter
    );

    distance += spacing;
  }

  pop();
}

/* =========================================================
   CONTROLS
   ========================================================= */

/**
 * Tweakpane controls for the route count and the map.
 */
function setupPane() {
  const container =
    document.getElementById("controls");

  pane = new Tweakpane.Pane({
    container,
    title: "Metro"
  });

  pane.addInput(params, "lines", {
    label: "Lines",
    min: 1,
    max: 8,
    step: 1
  });

  pane.addInput(params, "points", {
    label: "Points",
    min: 2,
    max: 8,
    step: 1
  });

  pane.addInput(params, "water", {
    label: "Water",
    min: 0,
    max: 4,
    step: 1
  });

  pane.addInput(params, "parks", {
    label: "Parks",
    min: 0,
    max: 6,
    step: 1
  });

  pane.addInput(params, "walls", {
    label: "Walls",
    min: 0,
    max: 6,
    step: 1
  });

  pane.addInput(params, "showGrid", {
    label: "Grid"
  });

  pane.addInput(params, "cells", {
    label: "Cells",
    min: 12,
    max: 80,
    step: 1
  });

  pane.addInput(params, "bend", {
    label: "Bend",
    options: {
      "Diagonal first": "diagonal",
      "Straight first": "straight"
    }
  });

  pane
    .addButton({
      title: "New map"
    })
    .on("click", () => {
      rebuildMap();
    });

  pane.on("change", (event) => {
    if (event.last === false) {
      return;
    }

    if (
      event.presetKey === "lines" ||
      event.presetKey === "points"
    ) {
      rebuildRoutes();
      return;
    }

    if (
      event.presetKey === "showGrid" ||
      event.presetKey === "bend"
    ) {
      renderScene();
      return;
    }

    if (event.presetKey === "cells") {
      applyCellCount();
      return;
    }

    if (
      event.presetKey === "water" ||
      event.presetKey === "parks" ||
      event.presetKey === "walls"
    ) {
      createTerrain();
      removeStationsInWater();
      renderScene();
    }
  });
}

/**
 * Builds a fresh set of routes and keeps the terrain.
 */
function rebuildRoutes() {
  sets = [];
  setColors = [];

  if (selectedSetIndex >= params.lines) {
    selectedSetIndex = 0;
  }

  createSets();
  renderScene();
}

/**
 * Builds a new terrain and a new set of routes.
 */
function rebuildMap() {
  createTerrain();
  rebuildRoutes();
}

/* =========================================================
   INTERACTION
   ========================================================= */

/**
 * Left click selects a legend line or adds a station.
 * Right click deletes a station on the selected line.
 *
 * p5 2 reports the pressed button on mouseButton.left
 * and mouseButton.right.
 */
function mousePressed(event) {
  if (
    mouseX < 0 ||
    mouseY < 0 ||
    mouseX >= width ||
    mouseY >= height
  ) {
    return;
  }

  if (isRightButton(event)) {
    if (
      !isInsideLegend(mouseX, mouseY) &&
      deleteSelectedStationAt(
        mouseX,
        mouseY
      )
    ) {
      renderScene();
    }

    return false;
  }

  if (!isLeftButton(event)) {
    return false;
  }

  const legendIndex =
    legendIndexAt(mouseX, mouseY);

  if (legendIndex !== -1) {
    selectedSetIndex = legendIndex;
    renderScene();
    return false;
  }

  if (isInsideLegend(mouseX, mouseY)) {
    return false;
  }

  const placed = addPoint(
    mouseX,
    mouseY,
    selectedSetIndex
  );

  if (placed) {
    renderScene();
  }

  return false;
}

/**
 * True when this press is the right mouse button.
 */
function isRightButton(event) {
  if (mouseButton && mouseButton.right) {
    return true;
  }

  return !!event && event.button === 2;
}

/**
 * True when this press is the left mouse button.
 */
function isLeftButton(event) {
  if (mouseButton && mouseButton.left) {
    return true;
  }

  return !!event && event.button === 0;
}

/**
 * Removes the selected line's station closest to a point.
 */
function deleteSelectedStationAt(x, y) {
  const points =
    sets[selectedSetIndex];

  if (!points || points.length === 0) {
    return false;
  }

  let closestIndex = -1;
  let closestDistance = Infinity;

  for (
    let pointIndex = 0;
    pointIndex < points.length;
    pointIndex++
  ) {
    const point = points[pointIndex];

    const distance = dist(
      x,
      y,
      point.x,
      point.y
    );

    const hitRadius =
      getStationHitRadius(point);

    if (
      distance <= hitRadius &&
      distance < closestDistance
    ) {
      closestDistance = distance;
      closestIndex = pointIndex;
    }
  }

  if (closestIndex === -1) {
    return false;
  }

  points.splice(closestIndex, 1);
  return true;
}

/**
 * Click target around a station, with a little extra slop.
 */
function getStationHitRadius(point) {
  return (
    getStationDiameter(point) / 2 +
    4
  );
}