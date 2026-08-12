import { clamp, seedHash, TAU } from './math.js';
import { NoiseField, sampleFbm } from './noise.js';

export function buildFieldGrid({
  cols,
  rows,
  cellWidth,
  cellHeight,
  canvasWidth,
  canvasHeight,
  params,
  time = 0,
  mouse = null,
  noise = null,
}) {
  const noiseField = noise ?? new NoiseField(params.noiseSeed ?? 0);
  const grid = new Float32Array(rows * cols);

  for (let y = 0; y < rows; y++) {
    const py = y * cellHeight;
    for (let x = 0; x < cols; x++) {
      const px = x * cellWidth;
      const i = y * cols + x;
      let value = sampleFieldValue({
        px,
        py,
        gx: x,
        gy: y,
        noiseScale: params.noiseScale,
        params,
        canvasWidth,
        canvasHeight,
        time,
        noise: noiseField,
      });
      value += mouseInfluenceAt(px, py, mouse, params);
      grid[i] = value;
    }
  }

  return { grid, noise: noiseField };
}

function mouseInfluenceAt(px, py, mouse, params) {
  if (!params.mouseInfluence || params.mouseStrength === 0 || !mouse) {
    return 0;
  }

  const { x: mx, y: my, canvasWidth, canvasHeight } = mouse;
  if (mx < 0 || mx > canvasWidth || my < 0 || my > canvasHeight) {
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

function getPresetCenter(params, canvasWidth, canvasHeight) {
  const seed = Math.floor(params.noiseSeed ?? 0);
  return {
    x: canvasWidth * (0.2 + seedHash(seed, 0) * 0.6),
    y: canvasHeight * (0.2 + seedHash(seed, 1) * 0.6),
  };
}

function getPresetPhase(params) {
  return seedHash(Math.floor(params.noiseSeed ?? 0), 2) * TAU;
}

function getLinearDirection(params) {
  const angle = seedHash(Math.floor(params.noiseSeed ?? 0), 3) * TAU;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function sampleFieldValue({
  px,
  py,
  gx,
  gy,
  noiseScale,
  params,
  canvasWidth,
  canvasHeight,
  time,
  noise,
}) {
  const preset = params.fieldPreset ?? 'perlin';
  const animPhase = time * TAU;
  let value = sampleBaseField({
    px,
    py,
    gx,
    gy,
    noiseScale,
    params,
    canvasWidth,
    canvasHeight,
    animPhase,
    time,
    noise,
  });

  if (preset !== 'perlin') {
    value += sampleStructuredDistortion(gx, gy, params, noiseScale, time, noise);
  }

  return clamp(value, 0, 1);
}

function samplePerlinField(gx, gy, noiseScale, params, time, noise) {
  const detail = Math.max(1, Math.round(params.noiseDetail ?? 4));
  const falloff = clamp(params.noiseFalloff ?? 0.5, 0, 1);
  return sampleFbm(noise, gx, gy, time, detail, falloff, noiseScale);
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
  const radius = Math.sqrt(dx * dx + dy * dy);
  const phase = getPresetPhase(params);
  const frequency = noiseScale * 2;
  return 0.5 + 0.5 * Math.sin(radius * frequency + phase + animPhase);
}

function sampleStructuredDistortion(gx, gy, params, noiseScale, time, noise) {
  const detail = Math.max(1, Math.round(params.noiseDetail ?? 4));
  if (detail <= 1) {
    return 0;
  }

  const falloff = params.noiseFalloff ?? 0.5;
  const fbm = sampleFbm(noise, gx, gy, time, detail, falloff, noiseScale);
  const strength = falloff * 0.4 * (detail - 1) / 7;
  return (fbm - 0.5) * 2 * strength;
}

function sampleBaseField({
  px,
  py,
  gx,
  gy,
  noiseScale,
  params,
  canvasWidth,
  canvasHeight,
  animPhase,
  time,
  noise,
}) {
  const preset = params.fieldPreset ?? 'perlin';

  switch (preset) {
    case 'linear':
      return sampleLinearField(px, py, noiseScale, params, animPhase);
    case 'radial':
      return sampleRadialField(px, py, noiseScale, params, canvasWidth, canvasHeight, animPhase);
    case 'perlin':
    default:
      return samplePerlinField(gx, gy, noiseScale, params, time, noise);
  }
}

export function getCornerValue(fieldGrid, cols, x, y) {
  return fieldGrid[y * cols + x];
}
