import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { params } from './params.js';
import { blockTurn } from './rules.js';

const status = {
  tileset: 'One-color tiles',
  note: 'Left drag paints. Right drag erases.',
};

let pane = null;
let hexBinding = null;
let vertexBinding = null;
let paintModeBinding = null;
let turnBinding = null;
let tilesetBinding = null;
let noteBinding = null;
let snapshot = { ...params };

function structuralChange() {
  return (
    snapshot.grid !== params.grid ||
    snapshot.hexOrientation !== params.hexOrientation ||
    snapshot.cellSize !== params.cellSize
  );
}

function syncVisibility() {
  if (hexBinding) hexBinding.hidden = params.grid !== 'hex';
  if (vertexBinding) vertexBinding.hidden = params.method !== 'squares';
  if (paintModeBinding) paintModeBinding.hidden = params.method !== 'squares';
  if (params.method !== 'squares' && params.paintMode === 'vertices') params.paintMode = 'cells';
  if (turnBinding) {
    turnBinding.hidden = params.method !== 'block';
    const steps = params.grid === 'hex' ? 6 : params.grid === 'triangle' ? 3 : 4;
    const slider = turnBinding.controller?.valueController?.sliderC_;
    if (slider?.props?.set) slider.props.set('max', steps - 1);
    const turned = blockTurn(params.grid, params.blockTurns | 0);
    if (turned !== params.blockTurns) {
      params.blockTurns = turned;
      turnBinding.refresh();
    }
  }
}

function emit() {
  const structural = structuralChange();
  snapshot = { ...params };
  syncVisibility();
  window.autotile?.onParams(structural);
}

function setHintVisible(visible) {
  const hints = document.getElementById('keyboard-hints');
  if (hints) hints.classList.toggle('is-hidden', !visible);
}

pane = new Pane({ title: 'Autotile', expanded: true });
pane.element.classList.add('autotile-pane');

const gridFolder = pane.addFolder({ title: 'Grid', expanded: true });
gridFolder.addBinding(params, 'method', {
  label: 'rule',
  options: { 'Marching squares': 'squares', Blob: 'blob', Block: 'block' },
});
gridFolder.addBinding(params, 'grid', {
  label: 'cell',
  options: { Square: 'square', Hexagon: 'hex', Triangle: 'triangle' },
});
hexBinding = gridFolder.addBinding(params, 'hexOrientation', {
  label: 'hex',
  options: { Pointy: 'pointy', Flat: 'flat' },
});
gridFolder.addBinding(params, 'cellSize', { label: 'size', min: 18, max: 180, step: 2 });
gridFolder.addBinding(params, 'showGrid', { label: 'grid lines' });
vertexBinding = gridFolder.addBinding(params, 'showVertices', { label: 'corners' });

const paintFolder = pane.addFolder({ title: 'Paint', expanded: true });
paintModeBinding = paintFolder.addBinding(params, 'paintMode', {
  label: 'target',
  options: { Cells: 'cells', Corners: 'vertices' },
});
paintFolder.addBinding(params, 'brushSize', { label: 'brush', min: 1, max: 12, step: 1 });
turnBinding = paintFolder.addBinding(params, 'blockTurns', {
  label: 'turn',
  min: 0,
  max: 3,
  step: 1,
});
paintFolder.addButton({ title: 'Clear' }).on('click', () => window.autotile?.clear());
paintFolder.addButton({ title: 'Invert' }).on('click', () => window.autotile?.invert());
paintFolder.addButton({ title: 'Undo' }).on('click', () => window.autotile?.undo());

const lookFolder = pane.addFolder({ title: 'Look', expanded: true });
lookFolder.addBinding(params, 'filled', { label: 'fill' });
lookFolder.addBinding(params, 'internalLines', { label: 'internal lines' });
lookFolder.addBinding(params, 'edges', {
  label: 'edges',
  options: { Straight: 'straight', Rounded: 'rounded' },
});
lookFolder.addBinding(params, 'terrainColor', { label: 'terrain' });
lookFolder.addBinding(params, 'backgroundColor', { label: 'background' });
lookFolder.addBinding(params, 'gridColor', { label: 'grid' });
lookFolder.addBinding(params, 'gridAlpha', { label: 'grid alpha', min: 0, max: 100, step: 1 });
lookFolder.addBinding(params, 'showHints', { label: 'hints' });

const tilesetFolder = pane.addFolder({ title: 'Tileset', expanded: true });
tilesetFolder.addButton({ title: 'Edit tiles' }).on('click', () => window.autotileEditor?.open());
tilesetBinding = tilesetFolder.addBinding(status, 'tileset', { readonly: true, label: 'sheet' });
noteBinding = tilesetFolder.addBinding(status, 'note', {
  readonly: true,
  label: 'layout',
  multiline: true,
  rows: 4,
});
tilesetFolder.addBinding(params, 'useTileset', { label: 'use sheet' });
tilesetFolder.addBinding(params, 'crispPixels', { label: 'crisp pixels' });
tilesetFolder.addButton({ title: 'Upload tileset' }).on('click', () => {
  document.getElementById('tileset-file')?.click();
});
tilesetFolder.addButton({ title: 'Use generated sheet' }).on('click', () => {
  window.autotile?.useTemplate();
});
tilesetFolder.addButton({ title: 'Download template' }).on('click', () => {
  window.autotile?.downloadTemplate();
});
tilesetFolder.addButton({ title: 'Clear tileset' }).on('click', () => {
  window.autotile?.clearTileset();
});

const noiseFolder = pane.addFolder({ title: 'Noise fill', expanded: false });
noiseFolder.addBinding(params, 'noiseSeed', { label: 'seed', min: 0, max: 999999, step: 1 });
noiseFolder.addBinding(params, 'noiseScale', { label: 'scale', min: 0.001, max: 0.04, step: 0.001 });
noiseFolder.addBinding(params, 'noiseThreshold', { label: 'threshold', min: 0.05, max: 0.95, step: 0.01 });
noiseFolder.addButton({ title: 'Fill with noise' }).on('click', () => window.autotile?.noiseFill(false));
noiseFolder.addButton({ title: 'Shuffle seed and fill' }).on('click', () => window.autotile?.noiseFill(true));

pane.addButton({ title: 'Save PNG' }).on('click', () => window.autotile?.savePng());

pane.on('change', (event) => {
  if (event?.target === tilesetBinding || event?.target === noteBinding) return;
  setHintVisible(params.showHints);
  emit();
});

syncVisibility();
setHintVisible(params.showHints);

window.autotileControls = {
  togglePane() {
    const hidden = pane.element.style.display === 'none';
    pane.element.style.display = hidden ? '' : 'none';
  },
  setStatus(tilesetLabel, note) {
    status.tileset = tilesetLabel;
    status.note = note;
    tilesetBinding.refresh();
    noteBinding.refresh();
  },
  refresh() {
    syncVisibility();
    pane.refresh();
    setHintVisible(params.showHints);
  },
};
