// P5Capture.setDefaultOptions({
//   format: "png",
//   quality: 1,
//   width: 1080,
// });

let nz = 0;
let cachedColors = [];
let cachedColorKey = '';
let appliedNoiseSeed = null;
let appliedNoiseDetail = null;
let appliedNoiseFalloff = null;

let noiseGridBuffer = null;
let fieldGridBuffer = null;
let gridCols = 0;
let gridRows = 0;
let lastFieldCacheKey = '';
let fillImageCache = {
  key: '',
  image: null,
};
let isAnimating = true;

function getParams() {
  return window.contourParams;
}

function getThresholdValues() {
  return window.contourThresholdValues || [];
}

function getGridDimensions(cols, canvasWidth, canvasHeight) {
  const screenRows = Math.max(2, Math.round((cols * canvasHeight) / canvasWidth));
  const rows = screenRows + 1;
  const cellWidth = canvasWidth / Math.max(1, cols - 1);
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
  fillImageCache.key = '';
  fillImageCache.image = null;
}

function ensureNoiseSeed(seed) {
  const s = Math.floor(seed ?? 0);
  if (appliedNoiseSeed !== s) {
    noiseSeed(s);
    appliedNoiseSeed = s;
  }
}

function ensureNoiseDetail(lod, falloff) {
  const detail = Math.max(1, Math.round(lod ?? 4));
  const noiseFalloff = falloff ?? 0.5;
  if (appliedNoiseDetail !== detail || appliedNoiseFalloff !== noiseFalloff) {
    noiseDetail(detail, noiseFalloff);
    appliedNoiseDetail = detail;
    appliedNoiseFalloff = noiseFalloff;
  }
}

function setContourHintsVisible(visible) {
  const hintsEl = document.getElementById('keyboard-hints');
  if (hintsEl) {
    hintsEl.classList.toggle('is-hidden', !visible);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  window.requestContourRedraw = () => redraw();
  window.syncContourLoopMode = () => {
    const currentParams = getParams();
    if (currentParams) {
      updateLoopMode(currentParams);
    }
  };
  window.setContourHintsVisible = setContourHintsVisible;
  setContourHintsVisible(true);
}

function drawContourSegments(fieldGrid, rows, cols, thresholdValues, params, colors, cellWidth, cellHeight) {
  let i = 0;
  for (let t of thresholdValues) {
    stroke(colors[i]);
    strokeWeight(getStrokeWeight(i, thresholdValues.length, params));
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
          cellHeight
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

function getContourSegmentsForCell(
  fieldGrid,
  cols,
  x,
  y,
  threshold,
  cellWidth,
  cellHeight
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
    true
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
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

function seedHash(seed, channel = 0) {
  const n = Math.sin((seed + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function getPresetCenter(params, canvasWidth, canvasHeight) {
  const seed = Math.floor(params.noiseSeed ?? 0);
  return {
    x: canvasWidth * (0.2 + seedHash(seed, 0) * 0.6),
    y: canvasHeight * (0.2 + seedHash(seed, 1) * 0.6),
  };
}

function getPresetPhase(params) {
  return seedHash(Math.floor(params.noiseSeed ?? 0), 2) * TWO_PI;
}

function getLinearDirection(params) {
  const angle = seedHash(Math.floor(params.noiseSeed ?? 0), 3) * TWO_PI;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function sampleFbm(gx, gy, z, detail, falloff, scale) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < detail; octave++) {
    value += noise(gx * scale * frequency, gy * scale * frequency, z + octave * 17.17) * amplitude;
    total += amplitude;
    amplitude *= falloff;
    frequency *= 2;
  }

  return total > 0 ? value / total : 0;
}

function samplePerlinField(gx, gy, noiseScale, params) {
  return noise(gx * noiseScale, gy * noiseScale, nz);
}

function sampleLinearField(px, py, noiseScale, params, animPhase) {
  const direction = getLinearDirection(params);
  const phase = getPresetPhase(params);
  const frequency = noiseScale * 2;
  const coord = (px * direction.x + py * direction.y) * frequency + phase + animPhase;
  return 0.5 + 0.5 * Math.sin(coord);
}

function sampleRadialField(px, py, noiseScale, params, canvasWidth, canvasHeight, animPhase) {
  const center = getPresetCenter(params, canvasWidth, canvasHeight);
  const dx = px - center.x;
  const dy = py - center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const phase = getPresetPhase(params);
  const frequency = noiseScale * 2;
  return 0.5 + 0.5 * Math.sin(distance * frequency + phase + animPhase);
}

function sampleAngularField(px, py, noiseScale, params, canvasWidth, canvasHeight, animPhase) {
  const center = getPresetCenter(params, canvasWidth, canvasHeight);
  const dx = px - center.x;
  const dy = py - center.y;
  const angle = Math.atan2(dy, dx);
  const phase = getPresetPhase(params);
  const repeats = Math.max(2, Math.round(noiseScale * 250));
  return 0.5 + 0.5 * Math.sin(angle * repeats + phase + animPhase);
}

function sampleStructuredDistortion(gx, gy, params, noiseScale) {
  const detail = Math.max(1, Math.round(params.noiseDetail ?? 4));
  if (detail <= 1) {
    return 0;
  }

  const falloff = params.noiseFalloff ?? 0.5;
  const fbm = sampleFbm(gx, gy, nz, detail, falloff, noiseScale);
  const strength = falloff * 0.4 * (detail - 1) / 7;
  return (fbm - 0.5) * 2 * strength;
}

function sampleBaseField(px, py, gx, gy, noiseScale, params, canvasWidth, canvasHeight) {
  const preset = params.fieldPreset ?? 'perlin';
  const animPhase = nz * TWO_PI;

  switch (preset) {
    case 'linear':
      return sampleLinearField(px, py, noiseScale, params, animPhase);
    case 'radial':
      return sampleRadialField(px, py, noiseScale, params, canvasWidth, canvasHeight, animPhase);
    case 'angular':
      return sampleAngularField(px, py, noiseScale, params, canvasWidth, canvasHeight, animPhase);
    case 'perlin':
    default:
      return samplePerlinField(gx, gy, noiseScale, params);
  }
}

function sampleFieldValue(px, py, gx, gy, noiseScale, params, canvasWidth, canvasHeight) {
  const preset = params.fieldPreset ?? 'perlin';
  let value = sampleBaseField(px, py, gx, gy, noiseScale, params, canvasWidth, canvasHeight);

  if (preset !== 'perlin') {
    value += sampleStructuredDistortion(gx, gy, params, noiseScale);
  }

  return constrain(value, 0, 1);
}

function buildFieldCacheKey(params, rows, cols, canvasWidth, canvasHeight) {
  const mouseKey = params.mouseInfluence
    ? `${mouseX}|${mouseY}|${params.mouseStrength}|${params.mouseRadius}`
    : 'off';
  const preset = params.fieldPreset ?? 'perlin';
  return `${preset}|${rows}|${cols}|${canvasWidth}|${canvasHeight}|${params.noiseScale}|${params.noiseSeed}|${params.noiseDetail}|${params.noiseFalloff}|${nz}|${mouseKey}`;
}

function getOrBuildFieldGrid(rows, cols, noiseScale, cellWidth, cellHeight, params) {
  ensureGridBuffers(rows, cols);
  ensureNoiseSeed(params.noiseSeed);
  ensureNoiseDetail(params.noiseDetail, params.noiseFalloff);

  const cacheKey = buildFieldCacheKey(params, rows, cols, width, height);
  if (cacheKey === lastFieldCacheKey) {
    return fieldGridBuffer;
  }

  for (let y = 0; y < rows; y++) {
    const py = y * cellHeight;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const px = x * cellWidth;
      const value = sampleFieldValue(px, py, x, y, noiseScale, params, width, height);
      noiseGridBuffer[i] = value;
      fieldGridBuffer[i] = value + mouseInfluenceAt(px, py, params);
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

function blendPaletteColors(palette, count) {
  if (count <= 0) {
    return [];
  }
  if (palette.length === 0) {
    return [];
  }
  if (count === 1) {
    return [palette[0]];
  }

  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const segment = t * (palette.length - 1);
    const index = Math.min(Math.floor(segment), palette.length - 2);
    const frac = segment - index;
    colors.push(lerpColor(palette[index], palette[index + 1], frac));
  }
  return colors;
}

function getPaletteColors(baseColor, paletteType, count) {
  const generator = new ColorGenerator(baseColor);
  const paletteCount = Math.max(1, count);

  switch (paletteType) {
    case 'shades':
      return generator.getShades(paletteCount);
    case 'monochromatic':
      return generator.getMonochromatic(paletteCount, true, true);
    case 'complementary':
      return blendPaletteColors(generator.getComplementary(), paletteCount);
    case 'triadic':
      return blendPaletteColors(generator.getTriadic(), paletteCount);
    case 'analogous':
      return blendPaletteColors(generator.getAnalogous(30), paletteCount);
    case 'splitComplementary':
      return blendPaletteColors(generator.getSplitComplementary(30), paletteCount);
    case 'tetradic':
      return blendPaletteColors(generator.getTetradic(), paletteCount);
    case 'tints':
    default:
      return generator.getTints(paletteCount);
  }
}

function getThresholdColors(baseColor, paletteType, count) {
  const key = `${baseColor}-${paletteType}-${count}`;
  if (key !== cachedColorKey) {
    cachedColors = getPaletteColors(baseColor, paletteType, count);
    cachedColorKey = key;
  }
  return cachedColors;
}

function resolvePaletteColors(params) {
  const paletteType = params.colorPalette ?? 'tints';
  const contourCount = Math.max(1, Math.round(params.contourCount));
  const paletteColors = getPaletteColors(params.baseColor, paletteType, contourCount);

  return {
    innerColor: params.baseColor,
    backgroundColor: params.backgroundColor,
    paletteColors,
  };
}

function getStrokeWeight(index, count, params) {
  if (count === 1) {
    return (params.strokeWeightMin + params.strokeWeightMax) / 2;
  }
  return map(index, 0, count - 1, params.strokeWeightMin, params.strokeWeightMax);
}

function buildFillImageCacheKey(fieldCacheKey, thresholdValues, colors, canvasWidth, canvasHeight) {
  const thresholdKey = thresholdValues.join(',');
  const colorKey = colors.map((c) => `${red(c)}|${green(c)}|${blue(c)}`).join(',');
  return `${fieldCacheKey}|${thresholdKey}|${colorKey}|${canvasWidth}|${canvasHeight}`;
}

function buildFillBandsImage(
  fieldGrid,
  rows,
  cols,
  thresholdValues,
  colors,
  cellWidth,
  cellHeight,
  canvasWidth,
  canvasHeight
) {
  const img = createImage(canvasWidth, canvasHeight);
  const bandCount = thresholdValues.length;
  const thresholdMin = thresholdValues[0];
  const thresholdMax = thresholdValues[bandCount - 1];
  const step = bandCount > 1 ? (thresholdMax - thresholdMin) / (bandCount - 1) : 1;
  const invStep = step > 0 ? 1 / step : 0;
  const invCellWidth = 1 / cellWidth;
  const invCellHeight = 1 / cellHeight;
  const colorRGBA = colors.map((c) => [red(c), green(c), blue(c)]);

  img.loadPixels();
  const pixels = img.pixels;

  for (let py = 0; py < canvasHeight; py++) {
    const gy = py * invCellHeight;
    for (let px = 0; px < canvasWidth; px++) {
      const gx = px * invCellWidth;
      const value = sampleFieldGridFast(fieldGrid, cols, rows, gx, gy);

      let bandIndex;
      if (bandCount === 1) {
        bandIndex = 0;
      } else if (value < thresholdMin) {
        bandIndex = 0;
      } else if (value >= thresholdMax) {
        bandIndex = bandCount - 1;
      } else {
        bandIndex = Math.min(bandCount - 1, Math.floor((value - thresholdMin) * invStep) + 1);
      }

      const rgba = colorRGBA[bandIndex];
      const idx = (py * canvasWidth + px) * 4;
      pixels[idx] = rgba[0];
      pixels[idx + 1] = rgba[1];
      pixels[idx + 2] = rgba[2];
      pixels[idx + 3] = 255;
    }
  }

  img.updatePixels();
  return img;
}

function getOrBuildFillBandsImage(
  fieldGrid,
  rows,
  cols,
  thresholdValues,
  colors,
  cellWidth,
  cellHeight,
  canvasWidth,
  canvasHeight
) {
  const cacheKey = buildFillImageCacheKey(
    lastFieldCacheKey,
    thresholdValues,
    colors,
    canvasWidth,
    canvasHeight
  );

  if (fillImageCache.key === cacheKey && fillImageCache.image) {
    return fillImageCache.image;
  }

  fillImageCache.image = buildFillBandsImage(
    fieldGrid,
    rows,
    cols,
    thresholdValues,
    colors,
    cellWidth,
    cellHeight,
    canvasWidth,
    canvasHeight
  );
  fillImageCache.key = cacheKey;
  return fillImageCache.image;
}

function drawContourFills(fieldGrid, rows, cols, thresholdValues, colors, cellWidth, cellHeight) {
  const fillImage = getOrBuildFillBandsImage(
    fieldGrid,
    rows,
    cols,
    thresholdValues,
    colors,
    cellWidth,
    cellHeight,
    width,
    height
  );

  noStroke();
  image(fillImage, 0, 0);
}

function draw() {
  const params = getParams();
  if (!params) return;

  const cols = Math.round(params.cols);
  const { rows, cellWidth, cellHeight } = getGridDimensions(cols, width, height);
  const thresholdValues = getThresholdValues();
  const palette = resolvePaletteColors(params);

  background(palette.backgroundColor);

  const fieldGrid = getOrBuildFieldGrid(rows, cols, params.noiseScale, cellWidth, cellHeight, params);
  nz += params.noiseScale * params.speed;

  const colors = palette.paletteColors ?? getThresholdColors(
    palette.innerColor,
    params.colorPalette ?? 'tints',
    thresholdValues.length
  );

  if (params.fillEnabled) {
    drawContourFills(
      fieldGrid,
      rows,
      cols,
      thresholdValues,
      colors,
      cellWidth,
      cellHeight
    );
  }

  noFill();
  drawContourSegments(
    fieldGrid,
    rows,
    cols,
    thresholdValues,
    params,
    colors,
    cellWidth,
    cellHeight
  );

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
