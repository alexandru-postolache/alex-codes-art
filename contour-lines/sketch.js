// P5Capture.setDefaultOptions({
//   format: "png",
//   quality: 1,
//   width: 1080,
// });

let nz = 0;
let cachedColors = [];
let cachedRgbColors = [];
let cachedColorKey = '';
let appliedNoiseSeed = null;

let noiseGridBuffer = null;
let fieldGridBuffer = null;
let gridCols = 0;
let gridRows = 0;
let lastFieldCacheKey = '';
let isAnimating = true;
let brushReady = false;
let brushInitialized = false;
let appliedBrushScale = null;

function getBrushWebglMode() {
  if (typeof WEBGL2 !== 'undefined') {
    return WEBGL2;
  }
  return WEBGL;
}

function getParams() {
  return window.contourParams;
}

function getThresholdValues() {
  return window.contourThresholdValues || [];
}

function getGridDimensions(cols, canvasWidth, canvasHeight) {
  const screenRows = Math.max(2, Math.round((cols * canvasHeight) / canvasWidth));
  const rows = screenRows + 1;
  const cellWidth = canvasWidth / cols;
  const cellHeight = canvasHeight / screenRows;

  return { cols, rows, cellWidth, cellHeight };
}

function shouldAnimate(params) {
  return params.speed > 0;
}

function updateLoopMode(params) {
  const animate = shouldAnimate(params);
  if (animate === isAnimating) {
    return;
  }

  isAnimating = animate;
  if (animate) {
    loop();
  } else {
    noLoop();
    redraw();
  }
}

function invalidateFieldCache() {
  lastFieldCacheKey = '';
}

function ensureNoiseSeed(seed) {
  const s = Math.floor(seed ?? 0);
  if (appliedNoiseSeed !== s) {
    noiseSeed(s);
    appliedNoiseSeed = s;
  }
}

function ensureBrushInitialized() {
  if (!brushReady || brushInitialized) {
    return;
  }

  try {
    if (typeof brush.load === 'function') {
      brush.load();
    }
    brushInitialized = true;
  } catch (error) {
    console.warn('p5.brush failed to initialize.', error);
    brushReady = false;
    brushInitialized = false;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, getBrushWebglMode());
  brushReady = typeof brush !== 'undefined' && typeof brush.line === 'function';
  ensureBrushInitialized();

  if (brushReady) {
    syncBrushScale(getParams());
    brush.noField();
  }

  window.requestContourRedraw = () => redraw();
  window.syncContourLoopMode = () => {
    const currentParams = getParams();
    if (currentParams) {
      updateLoopMode(currentParams);
    }
  };
}

function begin2DDraw() {
  push();
  translate(-width / 2, -height / 2);
}

function end2DDraw() {
  pop();
}


function syncBrushScale(params) {
  if (!brushReady || !params) {
    return;
  }

  const nextBrushScale = params.brushScale ?? 2;
  if (appliedBrushScale !== nextBrushScale) {
    brush.scaleBrushes(nextBrushScale);
    appliedBrushScale = nextBrushScale;
  }
}

function shouldUseBrush(params) {
  return params.brushEnabled && !params.debug && brushReady;
}

function shouldUseWatercolorBackground(params) {
  return params.watercolorBackground && brushReady && !params.debug;
}

function shouldUseWatercolorFillBands(params) {
  return params.fillEnabled && params.watercolorFillBands && brushReady && !params.debug;
}

function getCornerBandAt(fieldGrid, cols, cx, cy, thresholds) {
  const value = constrain(getCornerValue(fieldGrid, cols, cx, cy), 0, 1);
  return getBandIndex(value, thresholds);
}

function edgeCrossingThreshold(bandA, bandB, targetBand, thresholds) {
  const other = bandA === targetBand ? bandB : bandA;
  if (other < targetBand) {
    return thresholds[Math.max(0, targetBand - 1)];
  }
  return thresholds[Math.min(targetBand, thresholds.length - 1)];
}

function bandEdgePoint(pts, cornerA, cornerB, bands, values, targetBand, thresholds) {
  const bandA = bands[cornerA];
  const bandB = bands[cornerB];
  const inA = bandA === targetBand;
  const inB = bandB === targetBand;
  if (inA === inB) {
    return null;
  }

  const threshold = edgeCrossingThreshold(bandA, bandB, targetBand, thresholds);
  const va = values[cornerA];
  const vb = values[cornerB];
  const denom = vb - va;
  const t = Math.abs(denom) < 1e-6 ? 0.5 : constrain((threshold - va) / denom, 0, 1);

  return {
    x: lerp(pts[cornerA].x, pts[cornerB].x, t),
    y: lerp(pts[cornerA].y, pts[cornerB].y, t),
  };
}

function marchingSquaresBandPolygons(maskIndex, pts, edgePoint) {
  const c = pts;
  const e01 = edgePoint(0, 1);
  const e12 = edgePoint(1, 2);
  const e23 = edgePoint(2, 3);
  const e30 = edgePoint(3, 0);

  const poly = (...points) => points.filter(Boolean);

  switch (maskIndex) {
    case 1:
      return [poly(c[0], e01, e30)];
    case 2:
      return [poly(c[1], e12, e01)];
    case 3:
      return [poly(c[0], c[1], e12, e30)];
    case 4:
      return [poly(c[2], e23, e12)];
    case 5:
      return [poly(c[0], e01, e30), poly(c[2], e23, e12)];
    case 6:
      return [poly(c[1], c[2], e23, e01)];
    case 7:
      return [poly(c[0], c[1], c[2], e23, e30)];
    case 8:
      return [poly(c[3], e30, e23)];
    case 9:
      return [poly(c[0], c[3], e23, e01)];
    case 10:
      return [poly(c[1], e12, e01), poly(c[3], e30, e23)];
    case 11:
      return [poly(c[0], c[1], e12, e23, c[3])];
    case 12:
      return [poly(c[2], c[3], e30, e12)];
    case 13:
      return [poly(c[0], e01, e12, c[2], c[3])];
    case 14:
      return [poly(c[1], c[2], c[3], e30, e01)];
    default:
      return [];
  }
}

function buildCellBandPolygons(x, y, fieldGrid, cols, thresholds, cellWidth, cellHeight) {
  const bands = [
    getCornerBandAt(fieldGrid, cols, x, y, thresholds),
    getCornerBandAt(fieldGrid, cols, x + 1, y, thresholds),
    getCornerBandAt(fieldGrid, cols, x + 1, y + 1, thresholds),
    getCornerBandAt(fieldGrid, cols, x, y + 1, thresholds),
  ];
  const values = [
    getCornerValue(fieldGrid, cols, x, y),
    getCornerValue(fieldGrid, cols, x + 1, y),
    getCornerValue(fieldGrid, cols, x + 1, y + 1),
    getCornerValue(fieldGrid, cols, x, y + 1),
  ];

  const px = x * cellWidth;
  const py = y * cellHeight;
  const px1 = (x + 1) * cellWidth;
  const py1 = (y + 1) * cellHeight;
  const pts = [
    { x: px, y: py },
    { x: px1, y: py },
    { x: px1, y: py1 },
    { x: px, y: py1 },
  ];

  const uniqueBands = [...new Set(bands)];
  const results = [];

  for (const band of uniqueBands) {
    const mask = bands.map((b) => (b === band ? 1 : 0));
    const maskIndex = mask[0] | (mask[1] << 1) | (mask[2] << 2) | (mask[3] << 3);

    if (maskIndex === 0) {
      continue;
    }

    if (maskIndex === 15) {
      results.push({ band, polygon: [...pts], uniform: true });
      continue;
    }

    const edgePoint = (cornerA, cornerB) =>
      bandEdgePoint(pts, cornerA, cornerB, bands, values, band, thresholds);
    const polygons = marchingSquaresBandPolygons(maskIndex, pts, edgePoint);

    for (const polygon of polygons) {
      if (polygon.length >= 3) {
        results.push({ band, polygon, uniform: false });
      }
    }
  }

  return results;
}

function fillRegionPolygonClassic(polygon, colorValue) {
  fill(colorValue);
  noStroke();
  beginShape();
  for (const point of polygon) {
    vertex(point.x, point.y);
  }
  endShape(CLOSE);
}

function fillRegionPolygonWatercolor(polygon, colorValue) {
  brush.fill(colorValue, 255);
  if (typeof brush.polygon === 'function') {
    brush.polygon(polygon.map((point) => [point.x, point.y]));
    return;
  }

  brush.beginShape();
  for (const point of polygon) {
    brush.vertex(point.x, point.y);
  }
  brush.endShape(CLOSE);
}

function fillUniformCellWatercolor(x, y, cellWidth, cellHeight, colorValue) {
  brush.fill(colorValue, 255);
  brush.rect((x + 0.5) * cellWidth, (y + 0.5) * cellHeight, cellWidth, cellHeight, 'center');
}

function drawContourFillsClassic(fieldGrid, rows, cols, thresholds, colors, cellWidth, cellHeight) {
  push();
  if (typeof DISABLE_DEPTH_TEST !== 'undefined') {
    hint(DISABLE_DEPTH_TEST);
  }
  noStroke();

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const cellPolygons = buildCellBandPolygons(
        x,
        y,
        fieldGrid,
        cols,
        thresholds,
        cellWidth,
        cellHeight
      );

      for (const { band, polygon } of cellPolygons) {
        fillRegionPolygonClassic(polygon, colors[band]);
      }
    }
  }

  pop();
}

function drawContourFillsWatercolor(fieldGrid, rows, cols, thresholds, colors, params, cellWidth, cellHeight) {
  syncBrushScale(params);
  brush.noField();
  brush.noStroke();

  if (typeof brush.seed === 'function') {
    brush.seed(params.noiseSeed + 2);
  }

  if (typeof brush.fillTexture === 'function') {
    brush.fillTexture(0.45, 0.3);
  }

  if (typeof brush.fillBleed === 'function') {
    brush.fillBleed(0.2, 'out');
  }

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const cellPolygons = buildCellBandPolygons(
        x,
        y,
        fieldGrid,
        cols,
        thresholds,
        cellWidth,
        cellHeight
      );

      for (const { band, polygon, uniform } of cellPolygons) {
        const colorValue = colors[band];
        if (uniform) {
          fillUniformCellWatercolor(x, y, cellWidth, cellHeight, colorValue);
        } else {
          fillRegionPolygonWatercolor(polygon, colorValue);
        }
      }
    }
  }

  brush.noFill();
  brush.noWash();
}

function drawContourFills(fieldGrid, rows, cols, thresholds, params, colors, cellWidth, cellHeight) {
  if (shouldUseWatercolorFillBands(params)) {
    drawContourFillsWatercolor(fieldGrid, rows, cols, thresholds, colors, params, cellWidth, cellHeight);
    return;
  }

  drawContourFillsClassic(fieldGrid, rows, cols, thresholds, colors, cellWidth, cellHeight);
}

function renderWatercolorBackgroundRect(palette, params) {
  syncBrushScale(params);
  brush.noField();
  brush.noStroke();

  if (typeof brush.seed === 'function') {
    brush.seed(params.noiseSeed);
  }

  brush.fill(palette.backgroundColor, 255);

  if (typeof brush.fillTexture === 'function') {
    brush.fillTexture(0.55, 0.35);
  }

  if (typeof brush.fillBleed === 'function') {
    brush.fillBleed(0.25, 'out');
  }

  const pad = 8;
  brush.rect(width / 2, height / 2, width + pad, height + pad, 'center');
  brush.noFill();
  brush.noWash();
}

function drawWatercolorBackgroundLayer(palette, params) {
  renderWatercolorBackgroundRect(palette, params);
}

function drawBackground(palette, params) {
  if (!shouldUseWatercolorBackground(params)) {
    background(palette.backgroundColor);
    return;
  }

  background(255);
}

function drawContourSegmentsClassic(fieldGrid, rows, cols, thresholdValues, params, colors, debug, cellWidth, cellHeight) {
  let i = 0;
  for (let t of thresholdValues) {
    stroke(debug ? color(255, 220, 80) : colors[i]);
    strokeWeight(debug ? 1.5 : getStrokeWeight(i, thresholdValues.length, params));
    i++;

    beginShape(LINES);
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const segments = getContourSegmentsForCell(
          fieldGrid,
          cols,
          x,
          y,
          t,
          cellWidth,
          cellHeight,
          debug
        );

        for (let e = 0; e < segments.length; e += 2) {
          vertex(segments[e].x, segments[e].y);
          vertex(segments[e + 1].x, segments[e + 1].y);
        }
      }
    }
    endShape();
  }
}

function resolveBrushName(params) {
  if (typeof window.normalizeContourBrushName === 'function') {
    return window.normalizeContourBrushName(params.brushName);
  }
  return params.brushName ?? 'HB';
}

function renderBrushContourLinesToTarget(
  fieldGrid,
  rows,
  cols,
  thresholdValues,
  params,
  colors,
  cellWidth,
  cellHeight
) {
  if (!brushReady) {
    return false;
  }

  syncBrushScale(params);
  brush.noField();

  if (typeof brush.seed === 'function') {
    brush.seed(params.noiseSeed + 1);
  }

  let i = 0;
  for (let t of thresholdValues) {
    const strokeColor = colors[i];
    const weight = getStrokeWeight(i, thresholdValues.length, params);
    brush.pick(resolveBrushName(params));
    brush.stroke(strokeColor);
    brush.strokeWeight(weight);
    i++;

    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const segments = getContourSegmentsForCell(
          fieldGrid,
          cols,
          x,
          y,
          t,
          cellWidth,
          cellHeight,
          false
        );

        for (let e = 0; e < segments.length; e += 2) {
          brush.line(segments[e].x, segments[e].y, segments[e + 1].x, segments[e + 1].y);
        }
      }
    }
  }

  return true;
}

function drawContourSegmentsBrush(
  fieldGrid,
  rows,
  cols,
  thresholdValues,
  params,
  colors,
  cellWidth,
  cellHeight
) {
  if (!brushReady) {
    drawContourSegmentsClassic(
      fieldGrid,
      rows,
      cols,
      thresholdValues,
      params,
      colors,
      false,
      cellWidth,
      cellHeight
    );
    return;
  }

  renderBrushContourLinesToTarget(
    fieldGrid,
    rows,
    cols,
    thresholdValues,
    params,
    colors,
    cellWidth,
    cellHeight
  );
}

function getContourSegmentsForCell(
  fieldGrid,
  cols,
  x,
  y,
  threshold,
  cellWidth,
  cellHeight,
  debug
) {
  const topLeft = getCornerValue(fieldGrid, cols, x, y);
  const topRight = getCornerValue(fieldGrid, cols, x + 1, y);
  const bottomLeft = getCornerValue(fieldGrid, cols, x, y + 1);
  const bottomRight = getCornerValue(fieldGrid, cols, x + 1, y + 1);

  if (topLeft >= threshold && topRight >= threshold && bottomLeft >= threshold && bottomRight >= threshold) {
    return [];
  }
  if (topLeft < threshold && topRight < threshold && bottomLeft < threshold && bottomRight < threshold) {
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
    !debug
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  appliedBrushScale = null;
  invalidateFieldCache();
  redraw();
}

function mouseMoved() {
  const params = getParams();
  if (params && !shouldAnimate(params) && params.mouseInfluence) {
    redraw();
  }
}

function ensureGridBuffers(rows, cols) {
  const size = rows * cols;
  if (gridRows === rows && gridCols === cols && noiseGridBuffer?.length === size) {
    return;
  }

  noiseGridBuffer = new Float32Array(size);
  fieldGridBuffer = new Float32Array(size);
  gridRows = rows;
  gridCols = cols;
  invalidateFieldCache();
}

function buildFieldCacheKey(params, rows, cols) {
  const mouseKey = params.mouseInfluence
    ? `${mouseX}|${mouseY}|${params.mouseStrength}|${params.mouseRadius}`
    : 'off';
  return `${rows}|${cols}|${params.noiseScale}|${params.noiseSeed}|${nz}|${mouseKey}`;
}

function getOrBuildFieldGrid(rows, cols, noiseScale, cellWidth, cellHeight, params) {
  ensureGridBuffers(rows, cols);
  ensureNoiseSeed(params.noiseSeed);

  const cacheKey = buildFieldCacheKey(params, rows, cols);
  if (cacheKey === lastFieldCacheKey) {
    return fieldGridBuffer;
  }

  for (let y = 0; y < rows; y++) {
    const py = y * cellHeight;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const value = noise(x * noiseScale, y * noiseScale, nz);
      noiseGridBuffer[i] = value;
      fieldGridBuffer[i] = value + mouseInfluenceAt(x * cellWidth, py, params);
    }
  }

  lastFieldCacheKey = cacheKey;
  return fieldGridBuffer;
}

function mouseInfluenceAt(px, py, params) {
  if (!params.mouseInfluence || params.mouseStrength === 0) {
    return 0;
  }

  const mx = mouseX;
  const my = mouseY;
  if (mx < 0 || mx > width || my < 0 || my > height) {
    return 0;
  }

  const dx = mx - px;
  const dy = my - py;
  const radius = params.mouseRadius;
  const radiusSq = radius * radius;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radiusSq) {
    return 0;
  }

  const t = 1 - distSq / radiusSq;
  const falloff = t * t * (3 - 2 * t);
  return params.mouseStrength * falloff;
}

function getCornerValue(fieldGrid, cols, x, y) {
  return fieldGrid[y * cols + x];
}

function drawMouseInfluenceDebug(params) {
  if (!params.mouseInfluence || mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }

  noFill();
  stroke(255, 220, 80, 120);
  strokeWeight(1);
  circle(mouseX, mouseY, params.mouseRadius * 2);
}

function drawNoiseGrid(fieldGrid, rows, cols, cellWidth, cellHeight) {
  noStroke();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = constrain(fieldGrid[y * cols + x], 0, 1);
      fill(v * 255, v * 80, v * 100);
      rect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }
  }
}

function drawGridLines(cols, rows, cellWidth, cellHeight) {
  stroke(255, 180);
  strokeWeight(0.5);
  for (let x = 0; x <= cols; x++) {
    line(x * cellWidth, 0, x * cellWidth, height);
  }
  for (let y = 0; y <= rows; y++) {
    line(0, y * cellHeight, width, y * cellHeight);
  }
}

function drawGridValues(fieldGrid, rows, cols, cellWidth, cellHeight) {
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(min(min(cellWidth, cellHeight) * 0.45, 12));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = constrain(fieldGrid[y * cols + x], 0, 1);
      text(nf(v, 1, 2), (x + 0.5) * cellWidth, (y + 0.5) * cellHeight);
    }
  }
}

function getBandIndex(value, thresholds) {
  const count = thresholds.length;
  if (count === 1) {
    return 0;
  }

  const thresholdMin = thresholds[0];
  const thresholdMax = thresholds[count - 1];

  if (value < thresholdMin) {
    return 0;
  }
  if (value >= thresholdMax) {
    return count - 1;
  }

  const step = (thresholdMax - thresholdMin) / (count - 1);
  return Math.min(count - 1, Math.floor((value - thresholdMin) / step) + 1);
}

function colorToRgb(c) {
  push();
  colorMode(RGB, 255);
  const rgb = [red(c), green(c), blue(c)];
  pop();
  return rgb;
}

function sampleFieldGridFast(fieldGrid, cols, rows, gx, gy) {
  const x0 = gx | 0;
  const y0 = gy | 0;
  const x1 = x0 + 1 < cols ? x0 + 1 : cols - 1;
  const y1 = y0 + 1 < rows ? y0 + 1 : rows - 1;
  const tx = gx - x0;
  const ty = gy - y0;

  const i00 = y0 * cols + x0;
  const i10 = y0 * cols + x1;
  const i01 = y1 * cols + x0;
  const i11 = y1 * cols + x1;

  const top = fieldGrid[i00] + (fieldGrid[i10] - fieldGrid[i00]) * tx;
  const bottom = fieldGrid[i01] + (fieldGrid[i11] - fieldGrid[i01]) * tx;
  return top + (bottom - top) * ty;
}

function getThresholdColors(baseColor, count) {
  const key = `${baseColor}-${count}`;
  if (key !== cachedColorKey) {
    const colorGenerator = new ColorGenerator(baseColor);
    cachedColors = colorGenerator.getTints(count);
    cachedRgbColors = cachedColors.map(colorToRgb);
    cachedColorKey = key;
  }
  return cachedColors;
}

function resolvePaletteColors(params) {
  const innerColor = params.baseColor;

  if (!params.useComplementaryColors) {
    return {
      innerColor,
      backgroundColor: params.backgroundColor,
    };
  }

  const baseGenerator = new ColorGenerator(innerColor);
  const complementaryColor = baseGenerator.getComplementary()[1];
  const complementaryTints = new ColorGenerator(complementaryColor).getTints(9);

  return {
    innerColor,
    backgroundColor: complementaryTints[complementaryTints.length - 1],
  };
}

function getStrokeWeight(index, count, params) {
  if (count === 1) {
    return (params.strokeWeightMin + params.strokeWeightMax) / 2;
  }
  return map(index, 0, count - 1, params.strokeWeightMin, params.strokeWeightMax);
}

function draw() {
  const params = getParams();
  if (!params) return;

  ensureBrushInitialized();

  const cols = Math.round(params.cols);
  const { rows, cellWidth, cellHeight } = getGridDimensions(cols, width, height);
  const thresholdValues = getThresholdValues();
  const debug = params.debug;
  const useBrush = shouldUseBrush(params);

  const palette = resolvePaletteColors(params);
  const useWatercolorBackground = shouldUseWatercolorBackground(params);

  drawBackground(palette, params);
  begin2DDraw();

  if (useWatercolorBackground) {
    drawWatercolorBackgroundLayer(palette, params);
  }

  const fieldGrid = getOrBuildFieldGrid(rows, cols, params.noiseScale, cellWidth, cellHeight, params);
  nz += params.noiseScale * params.speed;

  if (debug) {
    drawNoiseGrid(fieldGrid, rows, cols, cellWidth, cellHeight);
    drawGridLines(cols, rows, cellWidth, cellHeight);
    if (cols <= 30 && rows <= 30) {
      drawGridValues(fieldGrid, rows, cols, cellWidth, cellHeight);
    }
  }

  const colors = getThresholdColors(palette.innerColor, thresholdValues.length);

  if (params.fillEnabled && !debug) {
    drawContourFills(
      fieldGrid,
      rows,
      cols,
      thresholdValues,
      params,
      colors,
      cellWidth,
      cellHeight
    );
  }

  noFill();
  if (useBrush) {
    drawContourSegmentsBrush(
      fieldGrid,
      rows,
      cols,
      thresholdValues,
      params,
      colors,
      cellWidth,
      cellHeight
    );
  } else {
    drawContourSegmentsClassic(
      fieldGrid,
      rows,
      cols,
      thresholdValues,
      params,
      colors,
      debug,
      cellWidth,
      cellHeight
    );
  }

  if (debug && params.mouseInfluence) {
    drawMouseInfluenceDebug(params);
  }

  end2DDraw();
  updateLoopMode(params);
}

function thresholdT(v1, v2, threshold) {
  const denom = v2 - v1;
  if (Math.abs(denom) < 1e-6) {
    return 0.5;
  }
  return constrain((threshold - v1) / denom, 0, 1);
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
  }
}

function getEdges(caseIndex, x, y, tl, tr, br, bl, threshold, cellWidth, cellHeight, interpolate = true) {
  let edges = [];
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
