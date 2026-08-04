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

function cellKey(x, y) {
  return `${x},${y}`;
}

function buildCellBandGrid(fieldGrid, cols, rows, thresholds) {
  const gridCols = cols - 1;
  const gridRows = rows - 1;
  const bands = new Uint8Array(gridCols * gridRows);

  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      const value = sampleFieldGridFast(fieldGrid, cols, rows, x + 0.5, y + 0.5);
      bands[y * gridCols + x] = getBandIndex(constrain(value, 0, 1), thresholds);
    }
  }

  return { bands, gridCols, gridRows };
}

function findBandRegions(bands, gridCols, gridRows) {
  const visited = new Uint8Array(bands.length);
  const regions = [];

  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      const startIndex = y * gridCols + x;
      if (visited[startIndex]) {
        continue;
      }

      const band = bands[startIndex];
      const cells = [];
      const queue = [{ x, y }];
      visited[startIndex] = 1;

      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.pop();
        cells.push({ x: cx, y: cy });

        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) {
            continue;
          }

          const nextIndex = ny * gridCols + nx;
          if (!visited[nextIndex] && bands[nextIndex] === band) {
            visited[nextIndex] = 1;
            queue.push({ x: nx, y: ny });
          }
        }
      }

      regions.push({ band, cells });
    }
  }

  return regions;
}

function thresholdBetweenBands(bandA, bandB, thresholds) {
  const low = Math.min(bandA, bandB);
  if (low < 0) {
    return thresholds[0];
  }
  if (low >= thresholds.length - 1) {
    return thresholds[thresholds.length - 1];
  }
  return thresholds[low];
}

function segmentPointKey(x, y) {
  return `${Math.round(x * 10000)},${Math.round(y * 10000)}`;
}

function addSplitBoundaryEdge(segments, ax, ay, bx, by, v1, v2, threshold) {
  const denom = v2 - v1;
  if (Math.abs(denom) < 1e-6) {
    segments.push({ ax, ay, bx, by });
    return;
  }

  const t = constrain((threshold - v1) / denom, 0, 1);
  if (t <= 0.001 || t >= 0.999) {
    segments.push({ ax, ay, bx, by });
    return;
  }

  const mx = lerp(ax, bx, t);
  const my = lerp(ay, by, t);
  segments.push({ ax, ay, bx: mx, by: my });
  segments.push({ ax: mx, ay: my, bx, by });
}

function buildRegionBoundarySegments(
  region,
  cellSet,
  bands,
  gridCols,
  gridRows,
  fieldGrid,
  cols,
  thresholds,
  cellWidth,
  cellHeight
) {
  const segments = [];
  const { band } = region;

  for (const { x, y } of region.cells) {
    const px = x * cellWidth;
    const py = y * cellHeight;
    const cw = cellWidth;
    const ch = cellHeight;

    if (!cellSet.has(cellKey(x, y - 1))) {
      const ax = px;
      const ay = py;
      const bx = px + cw;
      const by = py;
      if (y > 0) {
        const neighborBand = bands[(y - 1) * gridCols + x];
        if (neighborBand !== band) {
          const threshold = thresholdBetweenBands(band, neighborBand, thresholds);
          addSplitBoundaryEdge(
            segments,
            ax,
            ay,
            bx,
            by,
            getCornerValue(fieldGrid, cols, x, y),
            getCornerValue(fieldGrid, cols, x + 1, y),
            threshold
          );
          continue;
        }
      }
      segments.push({ ax, ay, bx, by });
    }

    if (!cellSet.has(cellKey(x + 1, y))) {
      const ax = px + cw;
      const ay = py;
      const bx = px + cw;
      const by = py + ch;
      if (x + 1 < gridCols) {
        const neighborBand = bands[y * gridCols + x + 1];
        if (neighborBand !== band) {
          const threshold = thresholdBetweenBands(band, neighborBand, thresholds);
          addSplitBoundaryEdge(
            segments,
            ax,
            ay,
            bx,
            by,
            getCornerValue(fieldGrid, cols, x + 1, y),
            getCornerValue(fieldGrid, cols, x + 1, y + 1),
            threshold
          );
          continue;
        }
      }
      segments.push({ ax, ay, bx, by });
    }

    if (!cellSet.has(cellKey(x, y + 1))) {
      const ax = px + cw;
      const ay = py + ch;
      const bx = px;
      const by = py + ch;
      if (y + 1 < gridRows) {
        const neighborBand = bands[(y + 1) * gridCols + x];
        if (neighborBand !== band) {
          const threshold = thresholdBetweenBands(band, neighborBand, thresholds);
          addSplitBoundaryEdge(
            segments,
            ax,
            ay,
            bx,
            by,
            getCornerValue(fieldGrid, cols, x + 1, y + 1),
            getCornerValue(fieldGrid, cols, x, y + 1),
            threshold
          );
          continue;
        }
      }
      segments.push({ ax, ay, bx, by });
    }

    if (!cellSet.has(cellKey(x - 1, y))) {
      const ax = px;
      const ay = py + ch;
      const bx = px;
      const by = py;
      if (x > 0) {
        const neighborBand = bands[y * gridCols + x - 1];
        if (neighborBand !== band) {
          const threshold = thresholdBetweenBands(band, neighborBand, thresholds);
          addSplitBoundaryEdge(
            segments,
            ax,
            ay,
            bx,
            by,
            getCornerValue(fieldGrid, cols, x, y + 1),
            getCornerValue(fieldGrid, cols, x, y),
            threshold
          );
          continue;
        }
      }
      segments.push({ ax, ay, bx, by });
    }
  }

  return segments;
}

function chainBoundarySegments(segments) {
  if (segments.length === 0) {
    return [];
  }

  const adjacency = new Map();
  segments.forEach((segment, index) => {
    const startKey = segmentPointKey(segment.ax, segment.ay);
    const endKey = segmentPointKey(segment.bx, segment.by);
    if (!adjacency.has(startKey)) adjacency.set(startKey, []);
    if (!adjacency.has(endKey)) adjacency.set(endKey, []);
    adjacency.get(startKey).push({ index, end: 'start' });
    adjacency.get(endKey).push({ index, end: 'end' });
  });

  const used = new Set();
  const polygons = [];

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (used.has(startIndex)) {
      continue;
    }

    const polygon = [];
    let segment = segments[startIndex];
    used.add(startIndex);
    polygon.push({ x: segment.ax, y: segment.ay });

    let x = segment.bx;
    let y = segment.by;
    polygon.push({ x, y });

    while (true) {
      const key = segmentPointKey(x, y);
      const candidates = (adjacency.get(key) || []).filter((candidate) => !used.has(candidate.index));
      if (candidates.length === 0) {
        break;
      }

      const next = candidates[0];
      used.add(next.index);
      segment = segments[next.index];

      if (next.end === 'start') {
        x = segment.bx;
        y = segment.by;
      } else {
        x = segment.ax;
        y = segment.ay;
      }

      if (segmentPointKey(x, y) === segmentPointKey(polygon[0].x, polygon[0].y) && polygon.length > 2) {
        break;
      }

      polygon.push({ x, y });
    }

    if (polygon.length >= 3) {
      polygons.push(polygon);
    }
  }

  return polygons;
}

function polygonSignedArea(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  return area * 0.5;
}

function buildBandRegionPolygons(fieldGrid, rows, cols, thresholds, cellWidth, cellHeight) {
  const { bands, gridCols, gridRows } = buildCellBandGrid(fieldGrid, cols, rows, thresholds);
  const regions = findBandRegions(bands, gridCols, gridRows);
  const shapes = [];

  for (const region of regions) {
    const cellSet = new Set(region.cells.map(({ x, y }) => cellKey(x, y)));
    const segments = buildRegionBoundarySegments(
      region,
      cellSet,
      bands,
      gridCols,
      gridRows,
      fieldGrid,
      cols,
      thresholds,
      cellWidth,
      cellHeight
    );
    const polygons = chainBoundarySegments(segments);

    for (const polygon of polygons) {
      shapes.push({
        band: region.band,
        polygon,
        area: Math.abs(polygonSignedArea(polygon)),
      });
    }
  }

  shapes.sort((a, b) => b.area - a.area);
  return shapes;
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

function fillRegionPolygonWatercolor(polygon, colorValue, params) {
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

function drawContourFillsClassic(shapes, colors) {
  push();
  if (typeof DISABLE_DEPTH_TEST !== 'undefined') {
    hint(DISABLE_DEPTH_TEST);
  }
  noStroke();

  for (const shape of shapes) {
    fillRegionPolygonClassic(shape.polygon, colors[shape.band]);
  }

  pop();
}

function drawContourFillsWatercolor(shapes, colors, params) {
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

  for (const shape of shapes) {
    fillRegionPolygonWatercolor(shape.polygon, colors[shape.band], params);
  }

  brush.noFill();
  brush.noWash();
}

function drawContourFills(fieldGrid, rows, cols, thresholds, params, colors, cellWidth, cellHeight) {
  const shapes = buildBandRegionPolygons(fieldGrid, rows, cols, thresholds, cellWidth, cellHeight);

  if (shouldUseWatercolorFillBands(params)) {
    drawContourFillsWatercolor(shapes, colors, params);
    return;
  }

  drawContourFillsClassic(shapes, colors);
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
