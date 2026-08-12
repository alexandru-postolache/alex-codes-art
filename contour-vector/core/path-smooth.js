/**
 * Convert stitched marching-squares polylines into smooth cubic Bezier chains
 * using Catmull-Rom interpolation (good match for organic contour lines).
 */

function getPoint(points, index, closed) {
  const count = points.length;
  if (count === 0) {
    return { x: 0, y: 0 };
  }
  if (closed) {
    return points[((index % count) + count) % count];
  }
  if (index < 0) {
    return points[0];
  }
  if (index >= count) {
    return points[count - 1];
  }
  return points[index];
}

/**
 * @param {Array<{x:number,y:number}>} points
 * @param {boolean} [closed=false]
 * @param {number} [tension=1] - 1 = standard Catmull-Rom, higher = tighter curves
 * @returns {Array<{p0:{x:number,y:number}, cp1:{x:number,y:number}, cp2:{x:number,y:number}, p1:{x:number,y:number}}>}
 */
export function smoothPathToBeziers(points, closed = false, tension = 1) {
  if (points.length < 2) {
    return [];
  }

  if (points.length === 2) {
    return [
      {
        p0: points[0],
        cp1: points[0],
        cp2: points[1],
        p1: points[1],
      },
    ];
  }

  const alpha = tension / 6;
  const segmentCount = closed ? points.length : points.length - 1;
  const beziers = [];

  for (let i = 0; i < segmentCount; i++) {
    const p0 = getPoint(points, i, closed);
    const p1 = getPoint(points, i + 1, closed);
    const pm1 = getPoint(points, i - 1, closed);
    const p2 = getPoint(points, i + 2, closed);

    beziers.push({
      p0,
      cp1: {
        x: p0.x + alpha * (p1.x - pm1.x),
        y: p0.y + alpha * (p1.y - pm1.y),
      },
      cp2: {
        x: p1.x - alpha * (p2.x - p0.x),
        y: p1.y - alpha * (p2.y - p0.y),
      },
      p1,
    });
  }

  return beziers;
}

/**
 * Attach smoothed Bezier segments to stitched paths.
 *
 * @param {Array<{points: Array<{x:number,y:number}>, closed: boolean}>} paths
 * @param {Object} [options]
 * @param {number} [options.tension=1]
 */
export function smoothPaths(paths, options = {}) {
  const tension = options.tension ?? 1;

  return paths.map((path) => ({
    ...path,
    beziers: smoothPathToBeziers(path.points, path.closed, tension),
  }));
}
