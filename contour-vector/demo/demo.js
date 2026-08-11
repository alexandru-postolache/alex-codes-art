import {
  generateContourScene,
  exportSvg,
  downloadSvg,
} from '../core/index.js';

const DEFAULT_PARAMS = {
  fieldPreset: 'perlin',
  noiseScale: 0.01,
  noiseSeed: 42,
  noiseDetail: 4,
  noiseFalloff: 0.5,
  cols: 120,
  contourCount: 9,
  thresholdMin: 0.1,
  thresholdMax: 0.9,
  baseColor: '#96000e',
  backgroundColor: '#dfb2b6',
  colorPalette: 'tints',
  strokeWeightMin: 1,
  strokeWeightMax: 5,
};

const params = { ...DEFAULT_PARAMS };
const previewSize = { width: 900, height: 900 };

const svgHost = document.getElementById('svg-host');
const paneHost = document.getElementById('pane-host');
const regenerateButton = document.getElementById('regenerate');
const downloadButton = document.getElementById('download-svg');

let scene = null;

function renderScene() {
  scene = generateContourScene({
    width: previewSize.width,
    height: previewSize.height,
    params,
    time: 0,
  });

  const svg = exportSvg(scene, { pretty: true });
  svgHost.innerHTML = svg;
}

const pane = new Tweakpane.Pane({ container: paneHost, title: 'Parameters', width: 256 });
pane.element.classList.add('contour-pane');

const noiseFolder = pane.addFolder({ title: 'Noise', expanded: true });
noiseFolder.addInput(params, 'fieldPreset', {
  label: 'preset',
  options: { Perlin: 'perlin', Linear: 'linear', Radial: 'radial' },
});
noiseFolder.addInput(params, 'noiseScale', { min: 0.001, max: 0.05, step: 0.001 });
noiseFolder.addInput(params, 'noiseSeed', { label: 'seed', min: 0, max: 999999, step: 1 });
noiseFolder.addInput(params, 'noiseDetail', { label: 'detail', min: 1, max: 8, step: 1 });
noiseFolder.addInput(params, 'noiseFalloff', { label: 'falloff', min: 0.1, max: 1, step: 0.05 });

const gridFolder = pane.addFolder({ title: 'Grid', expanded: true });
gridFolder.addInput(params, 'cols', { min: 20, max: 300, step: 10 });

const contourFolder = pane.addFolder({ title: 'Contours', expanded: true });
contourFolder.addInput(params, 'contourCount', { min: 1, max: 20, step: 1 });
contourFolder.addInput(params, 'thresholdMin', { min: 0, max: 1, step: 0.05 });
contourFolder.addInput(params, 'thresholdMax', { min: 0, max: 1, step: 0.05 });

const colorFolder = pane.addFolder({ title: 'Colors', expanded: true });
colorFolder.addInput(params, 'baseColor', { label: 'inner color' });
colorFolder.addInput(params, 'colorPalette', {
  label: 'palette',
  options: {
    Tints: 'tints',
    Shades: 'shades',
    Monochromatic: 'monochromatic',
    Complementary: 'complementary',
    Triadic: 'triadic',
    Analogous: 'analogous',
    'Split complementary': 'splitComplementary',
    Tetradic: 'tetradic',
  },
});
colorFolder.addInput(params, 'backgroundColor');

const strokeFolder = pane.addFolder({ title: 'Stroke', expanded: false });
strokeFolder.addInput(params, 'strokeWeightMin', { label: 'inner weight', min: 0.5, max: 50, step: 0.5 });
strokeFolder.addInput(params, 'strokeWeightMax', { label: 'outer weight', min: 0.5, max: 50, step: 0.5 });

pane.on('change', () => {
  renderScene();
});

regenerateButton.addEventListener('click', () => {
  params.noiseSeed = Math.floor(Math.random() * 999999);
  pane.refresh();
  renderScene();
});

downloadButton.addEventListener('click', () => {
  if (!scene) {
    renderScene();
  }
  downloadSvg(exportSvg(scene, { pretty: true }), `contour-vector-${Date.now()}.svg`);
});

renderScene();
