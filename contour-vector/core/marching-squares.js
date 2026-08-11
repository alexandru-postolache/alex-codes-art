import { clamp, lerp } from './math.js';
import { getCornerValue } from './field.js';

function thresholdT(v1, v2, threshold) {
  const denom = v2 - v1;
  if (Math.abs(denom) < 1e-6) {
    return 0.5;
  }
  return clamp((threshold - v1) / denom, 0, 1);
}

function edgePoint(edge, x, y, cellWidth, cellHeight, v1, v2, threshold, interpolate) {
  switch (edge) {
    case 'top':
      return interpolate
        ? { x: lerp(x, x + 1, thresholdT(v1, v2, threshold)) * cellWidth, y: y * cellHeight }
        : { x: (x + 0.5) * cellWidth, y: y * cellHeight };
    case 'right':
      return interpolate
        ? { x: (x + 1) * cellWidth, y: lerp(y, y + 1, thresholdT(v1, v2, threshold)) * cellHeight }
        : { x: (x + 1) * cellWidth, y: (y + 0.5) * cellHeight };
    case 'bottom':
      return interpolate
        ? { x: lerp(x, x + 1, thresholdT(v1, v2, threshold)) * cellWidth, y: (y + 1) * cellHeight }
        : { x: (x + 0.5) * cellWidth, y: (y + 1) * cellHeight };
    case 'left':
      return interpolate
        ? { x: x * cellWidth, y: lerp(y, y + 1, thresholdT(v1, v2, threshold)) * cellHeight }
        : { x: x * cellWidth, y: (y + 0.5) * cellHeight };
    default:
      return { x: 0, y: 0 };
  }
}

function getEdges(caseIndex, x, y, tl, tr, br, bl, threshold, cellWidth, cellHeight, interpolate = true) {
  const edges = [];
  switch (caseIndex) {
    case 1:
    case 14:
      edges.push(edgePoint('left', x, y, cellWidth, cellHeight, tl, bl, threshold, interpolate));
      edges.push(edgePoint('top', x, y, cellWidth, cellHeight, tl, tr, threshold, interpolate));
      break;
    case 2:
    case 13:
      edges.push(edgePoint('top', x, y, cellWidth, cellHeight, tl, tr, threshold, interpolate));
      edges.push(edgePoint('right', x, y, cellWidth, cellHeight, tr, br, threshold, interpolate));
      break;
    case 3:
    case 12:
      edges.push(edgePoint('left', x, y, cellWidth, cellHeight, tl, bl, threshold, interpolate));
      edges.push(edgePoint('right', x, y, cellWidth, cellHeight, tr, br, threshold, interpolate));
      break;
    case 4:
    case 11:
      edges.push(edgePoint('right', x, y, cellWidth, cellHeight, tr, br, threshold, interpolate));
      edges.push(edgePoint('bottom', x, y, cellWidth, cellHeight, bl, br, threshold, interpolate));
      break;
    case 6:
    case 9:
      edges.push(edgePoint('top', x, y, cellWidth, cellHeight, tl, tr, threshold, interpolate));
      edges.push(edgePoint('bottom', x, y, cellWidth, cellHeight, bl, br, threshold, interpolate));
      break;
    case 7:
    case 8:
      edges.push(edgePoint('left', x, y, cellWidth, cellHeight, tl, bl, threshold, interpolate));
      edges.push(edgePoint('bottom', x, y, cellWidth, cellHeight, bl, br, threshold, interpolate));
      break;
    case 10:
      edges.push(edgePoint('top', x, y, cellWidth, cellHeight, tr, br, threshold, interpolate));
      edges.push(edgePoint('left', x, y, cellWidth, cellHeight, bl, br, threshold, interpolate));
      break;
    case 5:
      edges.push(edgePoint('left', x, y, cellWidth, cellHeight, tl, bl, threshold, interpolate));
      edges.push(edgePoint('top', x, y, cellWidth, cellHeight, tr, br, threshold, interpolate));
      edges.push(edgePoint('right', x, y, cellWidth, cellHeight, br, bl, threshold, interpolate));
      edges.push(edgePoint('bottom', x, y, cellWidth, cellHeight, tl, bl, threshold, interpolate));
      break;
  }
  return edges;
}

export function getContourSegmentsForCell(fieldGrid, cols, x, y, threshold, cellWidth, cellHeight) {
  const topLeft = getCornerValue(fieldGrid, cols, x, y);
  const topRight = getCornerValue(fieldGrid, cols, x + 1, y);
  const bottomLeft = getCornerValue(fieldGrid, cols, x, y + 1);
  const bottomRight = getCornerValue(fieldGrid, cols, x + 1, y + 1);

  if (
    topLeft >= threshold &&
    topRight >= threshold &&
    bottomLeft >= threshold &&
    bottomRight >= threshold
  ) {
    return [];
  }
  if (
    topLeft < threshold &&
    topRight < threshold &&
    bottomLeft < threshold &&
    bottomRight < threshold
  ) {
    return [];
  }

  let caseIndex = 0;
  if (topLeft >= threshold) caseIndex |= 1;
  if (topRight >= threshold) caseIndex |= 2;
  if (bottomRight >= threshold) caseIndex |= 4;
  if (bottomLeft >= threshold) caseIndex |= 8;

  return getEdges(
    caseIndex,
    x,
    y,
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    threshold,
    cellWidth,
    cellHeight,
    true
  );
}

/**
 * Collect raw line segments for one threshold level.
 * @returns {Array<{a: {x,y}, b: {x,y}}>}
 */
export function collectContourSegments(fieldGrid, rows, cols, threshold, cellWidth, cellHeight) {
  const segments = [];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const edges = getContourSegmentsForCell(fieldGrid, cols, x, y, threshold, cellWidth, cellHeight);
      for (let i = 0; i < edges.length; i += 2) {
        segments.push({ a: edges[i], b: edges[i + 1] });
      }
    }
  }

  return segments;
}
