/**
 * Stitch marching-squares segments into continuous polylines for SVG / vector tools.
 */

function pointKey(point, precision = 3) {
  const scale = Math.pow(10, precision);
  return `${Math.round(point.x * scale)},${Math.round(point.y * scale)}`;
}

function pointsEqual(a, b, epsilon = 1e-3) {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

function addEdgeToGraph(graph, a, b) {
  const keyA = pointKey(a);
  const keyB = pointKey(b);

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

function walkPath(startKey, graph, visitedEdges) {
  const points = [graph.get(startKey).point];
  let currentKey = startKey;

  while (true) {
    const node = graph.get(currentKey);
    let nextKey = null;

    for (const [neighborKey] of node.neighbors) {
      const edgeKey = currentKey < neighborKey ? `${currentKey}|${neighborKey}` : `${neighborKey}|${currentKey}`;
      if (!visitedEdges.has(edgeKey)) {
        nextKey = neighborKey;
        visitedEdges.add(edgeKey);
        break;
      }
    }

    if (!nextKey) {
      break;
    }

    points.push(graph.get(nextKey).point);
    currentKey = nextKey;

    if (nextKey === startKey) {
      break;
    }
  }

  const closed = points.length > 2 && pointsEqual(points[0], points[points.length - 1]);
  return { points, closed };
}

/**
 * @param {Array<{a:{x:number,y:number}, b:{x:number,y:number}}>} segments
 * @returns {Array<{points: Array<{x:number,y:number}>, closed: boolean}>}
 */
export function stitchSegmentsToPaths(segments) {
  const graph = buildSegmentGraph(segments);
  const visitedEdges = new Set();
  const paths = [];

  for (const startKey of graph.keys()) {
    const node = graph.get(startKey);
    for (const neighborKey of node.neighbors.keys()) {
      const edgeKey = startKey < neighborKey ? `${startKey}|${neighborKey}` : `${neighborKey}|${startKey}`;
      if (visitedEdges.has(edgeKey)) {
        continue;
      }

      visitedEdges.add(edgeKey);
      const path = walkPath(startKey, graph, visitedEdges);
      if (path.points.length >= 2) {
        paths.push(path);
      }
    }
  }

  return paths;
}
