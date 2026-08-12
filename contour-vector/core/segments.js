/**
 * Convert marching-squares segments to drawable paths.
 * Matches contour-lines canvas rendering: one independent line per cell segment
 * (p5 beginShape(LINES)), with no stitching or curve fitting.
 *
 * @param {Array<{a:{x:number,y:number}, b:{x:number,y:number}}>} segments
 * @returns {Array<{points: Array<{x:number,y:number}>, closed: boolean}>}
 */
export function segmentsToPaths(segments) {
  return segments.map(({ a, b }) => ({
    points: [a, b],
    closed: false,
  }));
}

/**
 * Merge segment paths into one SVG path data string (M/L per segment).
 *
 * @param {Array<{points: Array<{x:number,y:number}>}>} paths
 */
export function pathsToSegmentSvgD(paths) {
  return paths
    .map((path) => {
      const [a, b] = path.points;
      if (!a || !b) {
        return '';
      }
      return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    })
    .filter(Boolean)
    .join(' ');
}
