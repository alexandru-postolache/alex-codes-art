import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

const PARAM_DEFAULTS = window.contourParamDefaults;

const PARAM_SCHEMA = {
  noiseScale: { type: 'number', min: 0.001, max: 0.05 },
  noiseSeed: { type: 'int', min: 0, max: 999999 },
  cols: { type: 'int', min: 20, max: 400 },
  speed: { type: 'number', min: 0, max: 1 },
  contourCount: { type: 'int', min: 1, max: 20 },
  thresholdMin: { type: 'number', min: 0, max: 1 },
  thresholdMax: { type: 'number', min: 0, max: 1 },
  baseColor: { type: 'color' },
  backgroundColor: { type: 'color' },
  useComplementaryColors: { type: 'boolean' },
  strokeWeightMin: { type: 'number', min: 0.5, max: 50 },
  strokeWeightMax: { type: 'number', min: 0.5, max: 50 },
  brushEnabled: { type: 'boolean' },
  brushName: { type: 'string' },
  brushScale: { type: 'number', min: 0.5, max: 10 },
  fillEnabled: { type: 'boolean' },
  watercolorBackground: { type: 'boolean' },
  debug: { type: 'boolean' },
  mouseInfluence: { type: 'boolean' },
  mouseStrength: { type: 'number', min: -0.5, max: 0.5 },
  mouseRadius: { type: 'int', min: 20, max: 500 },
};

const params = window.contourParams;

let thresholdValues = [];
let urlSyncTimer = null;
let pane = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseColor(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const normalized = value.startsWith('#') ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function parseBoolean(value) {
  if (value === '1' || value === 'true') {
    return true;
  }
  if (value === '0' || value === 'false') {
    return false;
  }
  return null;
}

function parseParamValue(key, rawValue) {
  const schema = PARAM_SCHEMA[key];
  if (!schema || rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  if (schema.type === 'boolean') {
    return parseBoolean(rawValue);
  }

  if (schema.type === 'string') {
    if (key === 'brushName' && typeof window.normalizeContourBrushName === 'function') {
      return window.normalizeContourBrushName(String(rawValue));
    }
    return String(rawValue);
  }

  if (schema.type === 'color') {
    return parseColor(rawValue);
  }

  if (schema.type === 'int') {
    const value = parseInt(rawValue, 10);
    if (Number.isNaN(value)) {
      return null;
    }
    return clamp(value, schema.min, schema.max);
  }

  const value = Number(rawValue);
  if (Number.isNaN(value)) {
    return null;
  }

  return clamp(value, schema.min, schema.max);
}

function loadParamsFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  let loadedAny = false;

  for (const key of Object.keys(PARAM_SCHEMA)) {
    if (!searchParams.has(key)) {
      continue;
    }

    const parsed = parseParamValue(key, searchParams.get(key));
    if (parsed !== null) {
      params[key] = parsed;
      loadedAny = true;
    }
  }

  return loadedAny;
}

function formatParamValue(key, value) {
  const schema = PARAM_SCHEMA[key];

  if (schema.type === 'boolean') {
    return value ? '1' : '0';
  }

  if (schema.type === 'color') {
    return String(value).replace('#', '');
  }

  if (schema.type === 'int') {
    return String(Math.round(value));
  }

  return String(value);
}

function serializeParamsToSearchParams() {
  const searchParams = new URLSearchParams();

  for (const key of Object.keys(PARAM_SCHEMA)) {
    searchParams.set(key, formatParamValue(key, params[key]));
  }

  return searchParams;
}

function syncParamsToUrl() {
  clearTimeout(urlSyncTimer);
  urlSyncTimer = setTimeout(() => {
    const searchParams = serializeParamsToSearchParams();
    const nextUrl = `${window.location.pathname}?${searchParams.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, 200);
}

function updateThresholds() {
  thresholdValues = window.computeContourThresholdValues(params);
  window.contourThresholdValues = thresholdValues;
}

function requestRedraw() {
  if (window.requestContourRedraw) {
    window.requestContourRedraw();
  }
}

function onParamsChange() {
  syncParamsToUrl();
  requestRedraw();
}

function isTypingTarget(target) {
  if (!target) {
    return false;
  }

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function toggleAnimationPause() {
  params.speed = params.speed > 0 ? 0 : 0.1;

  pane.refresh();
  if (window.syncContourLoopMode) {
    window.syncContourLoopMode();
  }
  onParamsChange();
}

function randomizeSeed() {
  params.noiseSeed = Math.floor(Math.random() * 999999);
  pane.refresh();
  updateThresholds();
  onParamsChange();
}

function saveSketchPng() {
  if (typeof saveCanvas !== 'function') {
    return;
  }

  saveCanvas(`contour-lines-${Date.now()}`, 'png');
}

loadParamsFromUrl();
updateThresholds();

pane = new Pane({ title: 'Contour Lines', expanded: true });

const noiseFolder = pane.addFolder({ title: 'Noise', expanded: true });
noiseFolder.addBinding(params, 'noiseScale', { min: 0.001, max: 0.05, step: 0.001 });
noiseFolder.addBinding(params, 'noiseSeed', { label: 'seed', min: 0, max: 999999, step: 1 });
noiseFolder.addBinding(params, 'speed', { min: 0, max: 1, step: 0.01 });
noiseFolder.addButton({ title: 'randomize seed' }).on('click', () => {
  randomizeSeed();
});

const gridFolder = pane.addFolder({ title: 'Grid', expanded: true });
gridFolder.addBinding(params, 'cols', { label: 'cols (rows auto)', min: 20, max: 400, step: 10 });

const contourFolder = pane.addFolder({ title: 'Contours', expanded: true });
contourFolder.addBinding(params, 'contourCount', { min: 1, max: 20, step: 1 });
contourFolder.addBinding(params, 'thresholdMin', { min: 0, max: 1, step: 0.05 });
contourFolder.addBinding(params, 'thresholdMax', { min: 0, max: 1, step: 0.05 });

const colorFolder = pane.addFolder({ title: 'Colors', expanded: true });
colorFolder.addBinding(params, 'baseColor', { label: 'inner color' });
const backgroundBinding = colorFolder.addBinding(params, 'backgroundColor');
const complementaryBinding = colorFolder.addBinding(params, 'useComplementaryColors', {
  label: 'complementary colors',
});
colorFolder.addBinding(params, 'fillEnabled', { label: 'fill bands' });
colorFolder.addBinding(params, 'watercolorBackground', { label: 'watercolor background' });

function updateColorBindings() {
  backgroundBinding.disabled = params.useComplementaryColors;
}

complementaryBinding.on('change', () => {
  updateColorBindings();
});

updateColorBindings();

const strokeFolder = pane.addFolder({ title: 'Stroke', expanded: false });
strokeFolder.addBinding(params, 'strokeWeightMin', { label: 'inner weight', min: 0.5, max: 50, step: 0.5 });
strokeFolder.addBinding(params, 'strokeWeightMax', { label: 'outer weight', min: 0.5, max: 50, step: 0.5 });
const brushEnabledBinding = strokeFolder.addBinding(params, 'brushEnabled', { label: 'brush strokes' });
const brushNameBinding = strokeFolder.addBinding(params, 'brushName', {
  label: 'brush',
  options: {
    HB: 'HB',
    '2H': '2H',
    '2B': '2B',
    Pen: 'pen',
    Rotring: 'rotring',
    Pencil: 'cpencil',
    Pastel: 'pastel',
    Crayon: 'crayon',
    Charcoal: 'charcoal',
    Marker: 'marker',
    Spray: 'spray',
  },
});
const brushScaleBinding = strokeFolder.addBinding(params, 'brushScale', {
  label: 'brush scale',
  min: 0.5,
  max: 10,
  step: 0.5,
});

function updateBrushBindings() {
  const disabled = !params.brushEnabled;
  brushNameBinding.disabled = disabled;
  brushScaleBinding.disabled = disabled;
}

brushEnabledBinding.on('change', () => {
  updateBrushBindings();
});

updateBrushBindings();

const mouseFolder = pane.addFolder({ title: 'Mouse', expanded: true });
mouseFolder.addBinding(params, 'mouseInfluence', { label: 'mouse influence' });
mouseFolder.addBinding(params, 'mouseStrength', {
  label: 'strength (+ bump, − dent)',
  min: -0.5,
  max: 0.5,
  step: 0.01,
});
mouseFolder.addBinding(params, 'mouseRadius', { label: 'radius (px)', min: 20, max: 500, step: 5 });

pane.addBinding(params, 'debug', { label: 'debug mode' });

contourFolder.on('change', () => updateThresholds());

pane.on('change', () => {
  onParamsChange();
});

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === 'h' || event.key === 'H') {
    pane.hidden = !pane.hidden;
    return;
  }

  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleAnimationPause();
    return;
  }

  if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    saveSketchPng();
    return;
  }

  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    randomizeSeed();
  }
});

window.contourParams = params;
window.updateContourThresholds = updateThresholds;

if (window.location.search) {
  pane.refresh();
  syncParamsToUrl();
}
