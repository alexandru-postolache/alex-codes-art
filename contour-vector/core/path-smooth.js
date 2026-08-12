/**
 * Convert stitched marching-squares polylines into smooth cubic Bezier chains.
 * Uses clamped Catmull-Rom to avoid overshoot at saddle points and sharp corners.
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

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clampControlPoint(anchor, toward, cp, maxRatio) {
  const chord = dist(anchor, toward);
  if (chord === 0) {
    return { x: anchor.x, y: anchor.y };
  }

  const maxLen = chord * maxRatio;
  const dx = cp.x - anchor.x;
  const dy = cp.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= maxLen) {
    return cp;
  }

  const scale = maxLen / len;
  return { x: anchor.x + dx * scale, y: anchor.y + dy * scale };
}

function interiorAngle(pm, p0, p1) {
  const v1x = p0.x - pm.x;
  const v1y = p0.y - pm.y;
  const v2x = p1.x - p0.x;
  const v2y = p1.y - p0.y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 === 0 || len2 === 0) {
    return Math.PI;
  }

  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Break polylines at sharp grid corners so smoothing does not bridge separate branches.
 */
export function splitPathAtSharpCorners(points, closed = false, minAngle = Math.PI * 0.55) {
  if (points.length < 3) {
    return [points];
  }

  if (closed) {
    const doubled = points.concat(points);
    const openSplits = splitPathAtSharpCorners(doubled, false, minAngle);
    return openSplits.filter((segment) => segment.length >= 2);
  }

  const segments = [];
  let current = [points[0]];

  for (let i = 1; i < points.length; i++) {
    current.push(points[i]);

    if (i >= points.length - 1) {
      break;
    }

    const angle = interiorAngle(points[i - 1], points[i], points[i + 1]);
    if (angle < minAngle && current.length >= 2) {
      segments.push(current);
      current = [points[i]];
    }
  }

  if (current.length >= 2) {
    segments.push(current);
  }

  return segments.length > 0 ? segments : [points];
}

/**
 * @param {Array<{x:number,y:number}>} points
 * @param {boolean} [closed=false]
 * @param {number} [tension=0.65]
 * @param {number} [maxControlRatio=0.35]
 */
export function smoothPathToBeziers(points, closed = false, tension = 0.65, maxControlRatio = 0.35) {
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

    const cp1 = clampControlPoint(
      p0,
      p1,
      {
        x: p0.x + alpha * (p1.x - pm1.x),
        y: p0.y + alpha * (p1.y - pm1.y),
      },
      maxControlRatio
    );

    const cp2 = clampControlPoint(
      p1,
      p0,
      {
        x: p1.x - alpha * (p2.x - p0.x),
        y: p1.y - alpha * (p2.y - p0.y),
      },
      maxControlRatio
    );

    beziers.push({ p0, cp1, cp2, p1 });
  }

  return beziers;
}

/**
 * @param {Array<{points: Array<{x:number,y:number}>, closed: boolean}>} paths
 * @param {Object} [options]
 * @param {number} [options.tension=0.65]
 * @param {number} [options.maxControlRatio=0.35]
 */
export function smoothPaths(paths, options = {}) {
  const tension = options.tension ?? 0.65;
  const maxControlRatio = options.maxControlRatio ?? 0.35;
  const smoothed = [];

  for (const path of paths) {
    const segments = splitPathAtSharpCorners(path.points, path.closed);

    for (const segment of segments) {
      if (segment.length < 2) {
        continue;
      }

      smoothed.push({
        points: segment,
        closed: false,
        beziers: smoothPathToBeziers(segment, false, tension, maxControlRatio),
      });
    }
  }

  return smoothed;
}
