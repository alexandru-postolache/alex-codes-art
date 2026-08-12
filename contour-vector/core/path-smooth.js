/**
 * Convert a stitched polyline to cubic Beziers with local, chord-limited
 * tangents. The same curve rule applies everywhere and cannot reach across
 * neighboring branches.
 */

function pointAt(points, index, closed) {
  if (closed) {
    return points[((index % points.length) + points.length) % points.length];
  }
  return points[Math.max(0, Math.min(points.length - 1, index))];
}

function unitVector(from, to) {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y);
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function tangentAt(points, index, closed) {
  const previous = pointAt(points, index - 1, closed);
  const current = pointAt(points, index, closed);
  const next = pointAt(points, index + 1, closed);
  const incoming = unitVector(previous, current);
  const outgoing = unitVector(current, next);
  const x = incoming.x + outgoing.x;
  const y = incoming.y + outgoing.y;
  const length = Math.hypot(x, y);

  if (length < 1e-9) {
    return outgoing;
  }
  return { x: x / length, y: y / length };
}

/**
 * @param {Array<{x:number,y:number}>} points
 * @param {boolean} [closed=false]
 * @param {number} [tension=0.8]
 */
export function smoothPathToBeziers(points, closed = false, tension = 0.8) {
  if (points.length < 2) {
    return [];
  }
  const segmentCount = closed ? points.length : points.length - 1;
  const beziers = [];

  for (let i = 0; i < segmentCount; i++) {
    const p0 = pointAt(points, i, closed);
    const p1 = pointAt(points, i + 1, closed);
    const chordLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const handleLength = (chordLength * tension) / 3;
    const tangent0 = tangentAt(points, i, closed);
    const tangent1 = tangentAt(points, i + 1, closed);
    const cp1 = {
      x: p0.x + tangent0.x * handleLength,
      y: p0.y + tangent0.y * handleLength,
    };
    const cp2 = {
      x: p1.x - tangent1.x * handleLength,
      y: p1.y - tangent1.y * handleLength,
    };

    beziers.push({ p0, cp1, cp2, p1 });
  }

  return beziers;
}

/**
 * @param {Array<{points: Array<{x:number,y:number}>, closed: boolean}>} paths
 * @param {Object} [options]
 * @param {number} [options.tension=0.8]
 */
export function smoothPaths(paths, options = {}) {
  const tension = options.tension ?? 0.8;
  return paths.map((path) => {
    const points =
      path.closed && path.points.length > 1
        ? path.points.slice(0, -1)
        : path.points;
    return {
      ...path,
      points,
      beziers: smoothPathToBeziers(points, path.closed, tension),
    };
  });
}
