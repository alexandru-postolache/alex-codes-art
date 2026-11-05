import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { params } from './params.js';

const status = {
  tileset: 'One-color tiles',
  note: 'Left drag paints. Right drag erases.',
};

let pane = null;
let hexBinding = null;
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
gridFolder.addBinding(params, 'showVertices', { label: 'corners' });

const paintFolder = pane.addFolder({ title: 'Paint', expanded: true });
paintFolder.addBinding(params, 'tool', {
  options: { Paint: 'paint', Erase: 'erase' },
});
paintFolder.addBinding(params, 'paintMode', {
  label: 'target',
  options: { Cells: 'cells', Corners: 'vertices' },
});
paintFolder.addBinding(params, 'brushSize', { label: 'brush', min: 1, max: 12, step: 1 });
paintFolder.addButton({ title: 'Clear' }).on('click', () => window.autotile?.clear());
paintFolder.addButton({ title: 'Invert' }).on('click', () => window.autotile?.invert());
paintFolder.addButton({ title: 'Undo' }).on('click', () => window.autotile?.undo());

const lookFolder = pane.addFolder({ title: 'Look', expanded: true });
lookFolder.addBinding(params, 'terrainColor', { label: 'terrain' });
lookFolder.addBinding(params, 'backgroundColor', { label: 'background' });
lookFolder.addBinding(params, 'gridColor', { label: 'grid' });
lookFolder.addBinding(params, 'gridAlpha', { label: 'grid alpha', min: 0, max: 100, step: 1 });
lookFolder.addBinding(params, 'showHints', { label: 'hints' });

const tilesetFolder = pane.addFolder({ title: 'Tileset', expanded: true });
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
    pane.refresh();
    syncVisibility();
    setHintVisible(params.showHints);
  },
};
