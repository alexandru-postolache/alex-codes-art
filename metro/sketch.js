const nrOfPoints = 3;
const nrOfSets = 3;

const numberOfRows = 50;
const numberOfCols = 50;

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

  cellWidth = width / numberOfCols;
  cellHeight = height / numberOfRows;

  createSets();
  renderScene();

  noLoop();
}

/**
 * Creates the route sets and their initial stations.
 */
function createSets() {
  for (
    let setIndex = 0;
    setIndex < nrOfSets;
    setIndex++
  ) {
    setColors[setIndex] = color(
      METRO_PALETTE[
        setIndex % METRO_PALETTE.length
      ]
    );

    sets[setIndex] = [];

    for (let i = 0; i < nrOfPoints; i++) {
      addPoint(
        random(width),
        random(height),
        setIndex
      );
    }
  }
}

/**
 * Snaps a point to the center of a grid cell and adds it
 * as a station to the given route.
 */
function addPoint(x, y, setIndex) {
  if (
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height
  ) {
    return;
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

  sets[setIndex].push({
    x: xGrid,
    y: yGrid
  });
}

/* =========================================================
   SCENE RENDERING
   ========================================================= */

function renderScene() {
  background(255);

  // Uncomment to show the grid.
  /*
  drawGrid(
    numberOfRows,
    numberOfCols,
    0,
    0,
    width,
    height
  );
  */

  rawSegments = createAllLineSegments();

  const network =
    buildAtomicNetwork(rawSegments);

  atomicEdges = network.edges;
  intersectionStations =
    network.intersections;

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
 * Creates one 45-degree segment followed by one horizontal
 * or vertical segment.
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

  const cornerX =
    x1 + xSign * diagonalDistance;

  const cornerY =
    y1 + ySign * diagonalDistance;

  // Add the diagonal section.
  if (diagonalDistance > EPSILON) {
    segments.push({
      x1,
      y1,
      x2: cornerX,
      y2: cornerY,
      setIndex,
      connectionId
    });
  }

  // Add the remaining horizontal or vertical section.
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

      stroke(setColors[setIndex]);

      line(
        edge.x1 + offsetX,
        edge.y1 + offsetY,
        edge.x2 + offsetX,
        edge.y2 + offsetY
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

  stroke(setColors[setIndex]);
  strokeWeight(getRouteWidth());
  strokeCap(SQUARE);

  line(
    laneCenter.x,
    laneCenter.y,
    capCenter.x,
    capCenter.y
  );

  line(
    capCenter.x -
      perpendicularX * halfCapLength,

    capCenter.y -
      perpendicularY * halfCapLength,

    capCenter.x +
      perpendicularX * halfCapLength,

    capCenter.y +
      perpendicularY * halfCapLength
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

  stroke(220);
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

  addPoint(
    mouseX,
    mouseY,
    selectedSetIndex
  );

  renderScene();
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