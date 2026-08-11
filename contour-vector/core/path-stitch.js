/**
 * Stitch marching-squares segments into continuous polylines for SVG / vector tools.
 */

function pointKey(point, precision = 4) {
  const scale = Math.pow(10, precision);
  return `${Math.round(point.x * scale)},${Math.round(point.y * scale)}`;
}

function edgeKey(keyA, keyB) {
  return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
}

function pointsEqual(a, b, epsilon = 1e-4) {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

function addEdgeToGraph(graph, a, b) {
  const keyA = pointKey(a);
  const keyB = pointKey(b);

  if (keyA === keyB) {
    return;
  }

  if (!graph.has(keyA)) graph.set(keyA, { point: a, neighbors: new Map() });
  if (!graph.has(keyB)) graph.set(keyB, { point: b, neighbors: new Map() });

  const nodeA = graph.get(keyA);
  const nodeB = graph.get(keyB);

  nodeA.neighbors.set(keyB, nodeB.point);
  nodeB.neighbors.set(keyA, nodeA.point);
}

function buildSegmentGraph(segments) {
  const graph = new Map();

  for (const segment of segments) {
    if (!pointsEqual(segment.a, segment.b)) {
      addEdgeToGraph(graph, segment.a, segment.b);
    }
  }

  return graph;
}

function extendPathFromEnd(pathKeys, graph, visitedEdges) {
  let currentKey = pathKeys[pathKeys.length - 1];

  while (true) {
    const node = graph.get(currentKey);
    let nextKey = null;

    for (const neighborKey of node.neighbors.keys()) {
      const edge = edgeKey(currentKey, neighborKey);
      if (!visitedEdges.has(edge)) {
        nextKey = neighborKey;
        visitedEdges.add(edge);
        break;
      }
    }

    if (!nextKey) {
      break;
    }

    pathKeys.push(nextKey);
    currentKey = nextKey;

    if (nextKey === pathKeys[0]) {
      break;
    }
  }
}

function extendPathFromStart(pathKeys, graph, visitedEdges) {
  let currentKey = pathKeys[0];

  while (true) {
    const node = graph.get(currentKey);
    let previousKey = null;

    for (const neighborKey of node.neighbors.keys()) {
      const edge = edgeKey(currentKey, neighborKey);
      if (!visitedEdges.has(edge)) {
        previousKey = neighborKey;
        visitedEdges.add(edge);
        break;
      }
    }

    if (!previousKey) {
      break;
    }

    pathKeys.unshift(previousKey);
    currentKey = previousKey;

    if (previousKey === pathKeys[pathKeys.length - 1]) {
      break;
    }
  }
}

function keysToPath(pathKeys, graph) {
  const points = pathKeys.map((key) => graph.get(key).point);
  const closed =
    points.length > 2 &&
    pointKey(points[0]) === pointKey(points[points.length - 1]);
  return { points, closed };
}

function collectUnvisitedEdges(graph, visitedEdges) {
  const edges = [];

  for (const [keyA, node] of graph) {
    for (const keyB of node.neighbors.keys()) {
      const edge = edgeKey(keyA, keyB);
      if (!visitedEdges.has(edge)) {
        edges.push({ keyA, keyB, edge });
      }
    }
  }

  return edges;
}

/**
 * @param {Array<{a:{x:number,y:number}, b:{x:number,y:number}}>} segments
 * @returns {Array<{points: Array<{x:number,y:number}>, closed: boolean}>}
 */
export function stitchSegmentsToPaths(segments) {
  const graph = buildSegmentGraph(segments);
  const visitedEdges = new Set();
  const paths = [];

  let unvisited = collectUnvisitedEdges(graph, visitedEdges);

  while (unvisited.length > 0) {
    const { keyA, keyB, edge } = unvisited[0];
    visitedEdges.add(edge);

    const pathKeys = [keyA, keyB];
    extendPathFromEnd(pathKeys, graph, visitedEdges);
    extendPathFromStart(pathKeys, graph, visitedEdges);

    const path = keysToPath(pathKeys, graph);
    if (path.points.length >= 2) {
      paths.push(path);
    }

    unvisited = collectUnvisitedEdges(graph, visitedEdges);
  }

  return paths;
}
