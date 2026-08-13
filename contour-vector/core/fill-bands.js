import { getCornerValue } from './field.js';

function interpolateVertex(a, b, threshold) {
  const denominator = b.value - a.value;
  const t = Math.abs(denominator) < 1e-12
    ? 0.5
    : (threshold - a.value) / denominator;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    value: threshold,
  };
}

function clipByValue(polygon, threshold, keepAbove) {
  if (polygon.length === 0) {
    return [];
  }

  const result = [];
  let previous = polygon[polygon.length - 1];
  let previousInside = keepAbove
    ? previous.value >= threshold
    : previous.value <= threshold;

  for (const current of polygon) {
    const currentInside = keepAbove
      ? current.value >= threshold
      : current.value <= threshold;

    if (currentInside !== previousInside) {
      result.push(interpolateVertex(previous, current, threshold));
    }
    if (currentInside) {
      result.push(current);
    }

    previous = current;
    previousInside = currentInside;
  }

  return result;
}

function polygonArea(points) {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) * 0.5;
}

function bandIndexForValue(value, boundaries) {
  for (let i = 0; i < boundaries.length; i++) {
    if (value < boundaries[i]) {
      return i;
    }
  }
  return boundaries.length;
}

function clipTriangleToBand(triangle, bandIndex, boundaries) {
  let polygon = triangle;
  const lower = bandIndex > 0 ? boundaries[bandIndex - 1] : null;
  const upper = bandIndex < boundaries.length ? boundaries[bandIndex] : null;

  if (lower !== null) {
    polygon = clipByValue(polygon, lower, true);
  }
  if (upper !== null) {
    polygon = clipByValue(polygon, upper, false);
  }

  if (polygon.length < 3 || polygonArea(polygon) < 1e-6) {
    return null;
  }

  return polygon.map(({ x, y }) => ({ x, y }));
}

function addTriangleToBands(triangle, bands, boundaries) {
  const values = triangle.map((vertex) => vertex.value);
  const firstBand = bandIndexForValue(Math.min(...values), boundaries);
  const lastBand = bandIndexForValue(Math.max(...values), boundaries);

  for (let bandIndex = firstBand; bandIndex <= lastBand; bandIndex++) {
    const polygon = clipTriangleToBand(triangle, bandIndex, boundaries);
    if (polygon) {
      bands[bandIndex].polygons.push(polygon);
    }
  }
}

/**
 * Partition the scalar grid into vector polygons, one collection per color band.
 * Each cell is split around its bilinear center so every pixel-sized region
 * belongs to exactly one band and adjacent polygons share identical edges.
 */
export function buildFillBands({
  fieldGrid,
  rows,
  cols,
  cellWidth,
  cellHeight,
  thresholdValues,
  colors,
}) {
  const bandCount = colors.length;
  if (bandCount === 0) {
    return [];
  }

  // The raster version uses N colors: below threshold 0 is band 0, and
  // threshold N-2 starts the final band. Threshold N-1 remains a stroke only.
  const boundaries = thresholdValues.slice(0, Math.max(0, bandCount - 1));
  const bands = colors.map((color, index) => ({
    index,
    color,
    polygons: [],
  }));

  for (let y = 0; y < rows - 1; y++) {
    const y0 = y * cellHeight;
    const y1 = (y + 1) * cellHeight;

    for (let x = 0; x < cols - 1; x++) {
      const x0 = x * cellWidth;
      const x1 = (x + 1) * cellWidth;
      const tl = {
        x: x0,
        y: y0,
        value: getCornerValue(fieldGrid, cols, x, y),
      };
      const tr = {
        x: x1,
        y: y0,
        value: getCornerValue(fieldGrid, cols, x + 1, y),
      };
      const br = {
        x: x1,
        y: y1,
        value: getCornerValue(fieldGrid, cols, x + 1, y + 1),
      };
      const bl = {
        x: x0,
        y: y1,
        value: getCornerValue(fieldGrid, cols, x, y + 1),
      };
      const center = {
        x: (x0 + x1) * 0.5,
        y: (y0 + y1) * 0.5,
        value: (tl.value + tr.value + br.value + bl.value) * 0.25,
      };

      addTriangleToBands([tl, tr, center], bands, boundaries);
      addTriangleToBands([tr, br, center], bands, boundaries);
      addTriangleToBands([br, bl, center], bands, boundaries);
      addTriangleToBands([bl, tl, center], bands, boundaries);
    }
  }

  return bands;
}

