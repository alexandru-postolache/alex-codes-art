/** Pixel editor for the sheets the autotile painter accepts. */

import { buildGrid } from './grid.js';
import { blobMask } from './blob.js';
import { canonicalCorners, drawSpriteImage, templateTileSize } from './marching.js';
import { layoutHelp, parseSheet, placementMasks, placementVariants, sheetLayout, tilePlacement } from './rules.js';
import { params } from './params.js';
import {
  EDITOR_PRESETS,
  editorTileSize,
  floodFill,
  paintShape,
  shapePaths,
  SQUARE_MASK_LABELS,
  tileSlots,
} from './tileset.js';

const SWATCHES = ['#1d4f91', '#e4572e', '#2f6b4f', '#f2c14e', '#f4efe6', '#1c1915'];

const ui = {
  tool: 'pencil',
  color: params.terrainColor,
  brush: 1,
  zoom: 0,
  corners: true,
  pixels: true,
};

const sheets = new Map();
const store = document.createElement('div');
store.hidden = true;

let stroke = null;
let previewGridKey = '';
let previewGrid = null;
let builtKey = '';

const root = document.createElement('div');
root.className = 'tileset-editor';
root.hidden = true;
root.innerHTML = `
  <div class="tileset-editor__card" role="dialog" aria-modal="true" aria-labelledby="tileset-editor-title" tabindex="-1">
    <header class="tileset-editor__bar">
      <div>
        <h2 id="tileset-editor-title">Tileset editor</h2>
        <p class="tileset-editor__sub"></p>
      </div>
      <div class="tileset-editor__bar-actions">
        <button type="button" class="tileset-editor__use" data-act="use">Use in autotile</button>
        <button type="button" data-act="download">Download PNG</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </header>
    <div class="tileset-editor__body">
      <aside class="tileset-editor__slots"></aside>
      <section class="tileset-editor__main">
        <div class="tileset-editor__stage">
          <div class="tileset-editor__frame" data-tool="pencil">
            <canvas class="tileset-editor__guide"></canvas>
            <div class="tileset-editor__grid" hidden></div>
          </div>
        </div>
        <div class="tileset-editor__below">
          <div class="tileset-editor__turns"></div>
          <figure class="tileset-editor__preview-wrap">
            <canvas class="tileset-editor__preview" width="220" height="140"></canvas>
            <figcaption>On the grid</figcaption>
          </figure>
        </div>
        <p class="tileset-editor__status"></p>
        <p class="tileset-editor__message"></p>
      </section>
      <aside class="tileset-editor__tools">
        <div class="tileset-editor__tool-row" role="group" aria-label="Tool">
          <button type="button" data-tool="pencil" class="is-on">Pencil</button>
          <button type="button" data-tool="eraser">Eraser</button>
          <button type="button" data-tool="fill">Fill</button>
          <button type="button" data-tool="picker">Pick</button>
        </div>
        <label class="tileset-editor__field">Color
          <input type="color" data-color value="${params.terrainColor}">
        </label>
        <div class="tileset-editor__swatches">
          ${SWATCHES.map((color) => `<button type="button" class="tileset-editor__swatch" data-swatch="${color}" style="background:${color}" aria-label="${color}"></button>`).join('')}
        </div>
        <div class="tileset-editor__tool-row" role="group" aria-label="Brush size">
          <button type="button" data-brush="1" class="is-on">1</button>
          <button type="button" data-brush="2">2</button>
          <button type="button" data-brush="4">4</button>
        </div>
        <label class="tileset-editor__check"><input type="checkbox" data-corners checked> Corner guide</label>
        <label class="tileset-editor__check"><input type="checkbox" data-pixels checked> Pixel grid</label>
        <div class="tileset-editor__tool-row">
          <button type="button" data-act="zoom-out" aria-label="Zoom out">−</button>
          <button type="button" data-act="zoom-fit">Fit</button>
          <button type="button" data-act="zoom-in" aria-label="Zoom in">+</button>
        </div>
        <p class="tileset-editor__note">Shape uses the terrain color, fill, and edges.</p>
        <label class="tileset-editor__check"><input type="checkbox" data-filled> Fill</label>
        <label class="tileset-editor__field">Edges
          <select data-edges>
            <option value="straight">Straight</option>
            <option value="rounded">Rounded</option>
          </select>
        </label>
        <button type="button" class="tileset-editor__wide" data-act="shape">Shape behind</button>
        <button type="button" class="tileset-editor__wide" data-act="reset-shapes">Reset sheet to shapes</button>
        <div class="tileset-editor__tool-row tileset-editor__sizes" role="group" aria-label="Tile size">
          ${EDITOR_PRESETS.map((px) => `<button type="button" data-preset="${px}">${px}</button>`).join('')}
        </div>
        <button type="button" class="tileset-editor__wide" data-act="load">Load image</button>
        <button type="button" class="tileset-editor__wide" data-act="load-current">Edit current sheet</button>
        <div class="tileset-editor__pair">
          <button type="button" data-act="clear">Clear tile</button>
          <button type="button" data-act="clear-all">Clear sheet</button>
          <button type="button" data-act="flip-h">Flip horizontal</button>
          <button type="button" data-act="flip-v">Flip vertical</button>
          <button type="button" data-act="rotate">Rotate 90°</button>
        </div>
        <p class="tileset-editor__note">Left drag draws. Right drag erases. Ctrl+Z undoes.</p>
      </aside>
    </div>
  </div>
  <input class="tileset-editor__file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
`;

document.body.appendChild(store);
document.body.appendChild(root);

const frame = root.querySelector('.tileset-editor__frame');
const fileInput = root.querySelector('.tileset-editor__file');

frame.addEventListener('pointerdown', onPointerDown);
frame.addEventListener('pointermove', onPointerMove);
frame.addEventListener('pointerup', endStroke);
frame.addEventListener('pointercancel', endStroke);
frame.addEventListener('contextmenu', (event) => event.preventDefault());
frame.addEventListener('wheel', onWheel, { passive: false });

root.addEventListener('click', onClick);
root.addEventListener('pointerdown', (event) => {
  if (event.target === root) close();
});
root.querySelector('[data-color]').addEventListener('input', (event) => {
  ui.color = event.target.value;
});
root.querySelector('[data-corners]').addEventListener('change', (event) => {
  ui.corners = event.target.checked;
  drawGuide(currentSheet());
});
root.querySelector('[data-pixels]').addEventListener('change', (event) => {
  ui.pixels = event.target.checked;
  applyZoom(currentSheet());
});
root.querySelector('[data-filled]').addEventListener('change', (event) => {
  params.filled = event.target.checked;
  window.autotileControls?.refresh();
  window.autotile?.onParams(false);
});
root.querySelector('[data-edges]').addEventListener('change', (event) => {
  params.edges = event.target.value;
  window.autotileControls?.refresh();
  window.autotile?.onParams(false);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) loadImageFile(file);
});

window.addEventListener('keydown', onKeyDown);
window.addEventListener('resize', () => {
  if (root.hidden) return;
  if (ui.zoom === 0) applyZoom(currentSheet());
  drawGuide(currentSheet());
});

function sheetKey() {
  const grid = params.grid === 'hex' ? `hex:${params.hexOrientation}` : params.grid;
  return `${params.method}:${grid}`;
}

function makeTile(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function tileContext(tile) {
  return tile.getContext('2d', { willReadFrequently: true });
}

function replaceSheet(tileW, tileH) {
  const sheet = {
    tileW,
    tileH,
    tiles: tileSlots(params.grid, params.method).map(() => makeTile(tileW, tileH)),
    undo: [],
    redo: [],
    selected: 0,
  };
  for (let i = 0; i < sheet.tiles.length; i++) store.appendChild(sheet.tiles[i]);
  sheets.set(sheetKey(), sheet);
  builtKey = '';
  return sheet;
}

function currentSheet() {
  const key = sheetKey();
  if (!sheets.has(key)) {
    const size = editorTileSize(params.grid, params.hexOrientation, 32);
    const sheet = replaceSheet(size.tileW, size.tileH);
    const slots = tileSlots(params.grid, params.method);
    for (let i = 0; i < slots.length; i++) stampShape(tileContext(sheet.tiles[i]), slots[i], shapeStyle());
    const firstDrawn = slots.findIndex((slot) => slot.mask !== 0);
    sheet.selected = firstDrawn < 0 ? 0 : firstDrawn;
  }
  return sheets.get(key);
}

function open() {
  ui.color = root.querySelector('[data-color]').value;
  root.hidden = false;
  document.body.classList.add('is-editing-tiles');
  sync();
  root.querySelector('.tileset-editor__card').focus();
}

function close() {
  root.hidden = true;
  document.body.classList.remove('is-editing-tiles');
  stroke = null;
}

function sync() {
  const sheet = currentSheet();
  const key = `${sheetKey()}:${sheet.tileW}x${sheet.tileH}`;
  root.querySelector('.tileset-editor__sub').textContent = subtitle();
  root.querySelector('[data-filled]').checked = params.filled;
  root.querySelector('[data-edges]').value = params.edges;
  if (builtKey !== key) {
    builtKey = key;
    buildSlots(sheet);
  }
  mountTile(sheet);
  markSelected(sheet);
  syncTools(sheet);
  applyZoom(sheet);
  drawGuide(sheet);
  drawRotations(sheet);
  paintThumbs(sheet);
  drawPreview(sheet);
  setHint(sheet);
}

function subtitle() {
  const count = tileSlots(params.grid, params.method).length;
  if (params.method === 'block') return 'Two tiles, off and on. Every cell is one or the other.';
  if (params.method === 'blob') {
    return `${count} blob tiles. Rotation and reflection cover the other neighbor patterns.`;
  }
  if (params.grid === 'square') return 'Six tiles. Rotation and reflection cover all 16 masks.';
  if (params.grid === 'triangle') return 'Four tiles. Turns by 120°. Down triangles flip this row.';
  return `13 hex tiles, ${params.hexOrientation}. Rotation and reflection cover all 64 masks.`;
}

function buildSlots(sheet) {
  const aside = root.querySelector('.tileset-editor__slots');
  aside.replaceChildren();
  const slots = tileSlots(params.grid, params.method);
  const host = document.createElement('div');
  host.className = 'tileset-editor__list';
  aside.appendChild(host);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tileset-editor__slot';
    button.dataset.index = String(slot.index);
    button.title = slot.hint;
    button.setAttribute('aria-label', slot.name);
    const thumb = document.createElement('canvas');
    thumb.width = 48;
    thumb.height = 48;
    thumb.dataset.thumb = String(slot.index);
    const label = document.createElement('span');
    label.textContent = slot.name;
    button.append(thumb, label);
    host.appendChild(button);
  }
  paintThumbs(sheet);
}

function mountTile(sheet) {
  const tile = sheet.tiles[sheet.selected];
  const current = frame.querySelector('.tileset-editor__tile');
  if (current === tile) return;
  if (current) store.appendChild(current);
  tile.className = 'tileset-editor__tile';
  frame.insertBefore(tile, frame.firstChild);
}

function markSelected(sheet) {
  const buttons = root.querySelectorAll('.tileset-editor__slot');
  for (let i = 0; i < buttons.length; i++) {
    const on = Number(buttons[i].dataset.index) === sheet.selected;
    buttons[i].classList.toggle('is-selected', on);
    if (on) buttons[i].scrollIntoView({ block: 'nearest' });
  }
}

function syncTools(sheet) {
  root.querySelector('[data-act="rotate"]').hidden = params.grid !== 'square';
  const presets = root.querySelectorAll('[data-preset]');
  for (let i = 0; i < presets.length; i++) {
    const px = Number(presets[i].dataset.preset);
    const size = editorTileSize(params.grid, params.hexOrientation, px);
    presets[i].classList.toggle('is-on', size.tileW === sheet.tileW && size.tileH === sheet.tileH);
  }
}

function applyZoom(sheet) {
  const stage = root.querySelector('.tileset-editor__stage');
  const availW = Math.max(64, stage.clientWidth - 24);
  const availH = Math.max(64, stage.clientHeight - 24);
  const fit = Math.max(1, Math.min(32, Math.floor(Math.min(availW / sheet.tileW, availH / sheet.tileH))));
  const zoom = ui.zoom > 0 ? Math.max(1, Math.min(32, ui.zoom)) : fit;
  frame.style.width = `${sheet.tileW * zoom}px`;
  frame.style.height = `${sheet.tileH * zoom}px`;
  frame.dataset.zoom = String(zoom);
  const grid = root.querySelector('.tileset-editor__grid');
  const show = ui.pixels && zoom >= 6;
  grid.hidden = !show;
  grid.style.backgroundSize = `${zoom}px ${zoom}px, ${zoom}px ${zoom}px`;
  return zoom;
}

function drawGuide(sheet) {
  const canvas = root.querySelector('.tileset-editor__guide');
  const zoom = Number(frame.dataset.zoom || 1);
  const w = Math.max(1, sheet.tileW * zoom);
  const h = Math.max(1, sheet.tileH * zoom);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!ui.corners) return;
  const slot = tileSlots(params.grid, params.method)[sheet.selected];
  const { corners } = shapePaths(params.grid, params.hexOrientation, w, h, slot.mask, slot.variant, false, params.method);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(28, 25, 21, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < corners.length; i++) {
    cx += corners[i].x;
    cy += corners[i].y;
  }
  cx /= corners.length;
  cy /= corners.length;
  const radius = Math.max(4, Math.min(w, h) * 0.035);
  const marks = guideMarks(corners, slot.mask);
  for (let i = 0; i < marks.length; i++) {
    const on = marks[i].on;
    const dx = cx - marks[i].x;
    const dy = cy - marks[i].y;
    const len = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.arc(marks[i].x + (dx / len) * radius, marks[i].y + (dy / len) * radius, radius * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#e4572e' : 'rgba(255, 250, 240, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1c1915';
    ctx.stroke();
  }
}

function guideMarks(corners, mask) {
  if (params.method === 'block') return [];
  if (params.method !== 'blob') {
    return corners.map((corner, index) => ({
      x: corner.x,
      y: corner.y,
      on: (mask & (1 << index)) !== 0,
    }));
  }
  const marks = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    if (params.grid === 'square') {
      marks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: (mask & (1 << (2 * i))) !== 0 });
      marks.push({ x: b.x, y: b.y, on: (mask & (1 << (2 * i + 1))) !== 0 });
    } else {
      marks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: (mask & (1 << i)) !== 0 });
    }
  }
  return marks;
}

function tileUses(index) {
  const masks = placementMasks(params.grid, params.method);
  const variants = placementVariants(params.grid);
  const uses = [];
  for (let v = 0; v < variants.length; v++) {
    for (let i = 0; i < masks.length; i++) {
      const place = tilePlacement(params.grid, masks[i], variants[v], params.hexOrientation, params.method);
      if (place.index !== index) continue;
      uses.push({ mask: masks[i], variant: variants[v], ...place });
    }
  }
  return uses;
}

function drawRotations(sheet) {
  const host = root.querySelector('.tileset-editor__turns');
  const uses = tileUses(sheet.selected);
  const signature = uses.map((use) => `${use.variant}:${use.mask}`).join('|');
  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.replaceChildren();
    for (let i = 0; i < uses.length; i++) {
      const fig = document.createElement('figure');
      const canvas = document.createElement('canvas');
      const cap = document.createElement('figcaption');
      fig.append(canvas, cap);
      host.appendChild(fig);
    }
  }
  host.hidden = false;
  const tile = sheet.tiles[sheet.selected];
  const base = templateTileSize(params.grid, params.hexOrientation);
  const scale = 40 / Math.max(base.tileW, base.tileH);
  const w = Math.max(8, Math.round(base.tileW * scale));
  const h = Math.max(8, Math.round(base.tileH * scale));
  const figures = host.children;
  for (let i = 0; i < uses.length; i++) {
    const use = uses[i];
    const canvas = figures[i].querySelector('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = params.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    const corners = canonicalCorners(params.grid, params.hexOrientation, w, h, use.variant);
    drawSpriteImage(ctx, tile, 0, 0, tile.width, tile.height, {
      type: params.grid,
      variant: use.variant,
      corners,
      bbox: boxOf(corners),
    }, use);
    figures[i].querySelector('figcaption').textContent = useLabel(use);
  }
}

function boxOf(corners) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    minX = Math.min(minX, corners[i].x);
    minY = Math.min(minY, corners[i].y);
    maxX = Math.max(maxX, corners[i].x);
    maxY = Math.max(maxY, corners[i].y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function useLabel(use) {
  if (params.method === 'block') {
    const side = use.mask ? 'On' : 'Off';
    return params.grid === 'triangle' && use.variant === 'down' ? `Down ${side}` : side;
  }
  if (params.method === 'squares' && params.grid === 'square') return SQUARE_MASK_LABELS[use.mask] || String(use.mask);
  if (params.grid === 'triangle') return `${use.variant === 'down' ? 'Down' : 'Up'} ${use.mask}`;
  return String(use.mask);
}

function paintThumbs(sheet, index = -1) {
  const slots = tileSlots(params.grid, params.method);
  for (let i = 0; i < slots.length; i++) {
    if (index !== -1 && i !== index) continue;
    const canvas = root.querySelector(`[data-thumb="${i}"]`);
    if (!canvas) continue;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#efe8dc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tile = sheet.tiles[i];
    const scale = Math.min(canvas.width / tile.width, canvas.height / tile.height);
    const w = tile.width * scale;
    const h = tile.height * scale;
    ctx.drawImage(tile, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }
}

function previewOf() {
  const key = sheetKey();
  if (previewGridKey !== key) {
    previewGridKey = key;
    const cell = params.grid === 'hex' ? 26 : 32;
    previewGrid = buildGrid(params.grid, 220, 140, cell, params.hexOrientation);
  }
  return previewGrid;
}

function drawPreview(sheet) {
  const canvas = root.querySelector('.tileset-editor__preview');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = params.backgroundColor;
  ctx.fillRect(0, 0, w, h);
  const grid = previewOf();
  const inside = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i];
    const dx = (cell.center.x - w / 2) / (w * 0.24);
    const dy = (cell.center.y - h / 2) / (h * 0.3);
    if (dx * dx + dy * dy > 1) continue;
    inside.push(cell);
  }
  const composed = compose(sheet);
  const parsed = parsedSheet(sheet);
  if (params.method === 'squares') {
    const terrain = new Map();
    for (let i = 0; i < inside.length; i++) {
      const corners = inside[i].corners;
      for (let c = 0; c < corners.length; c++) terrain.set(corners[c].key, 1);
    }
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      let mask = 0;
      for (let c = 0; c < cell.corners.length; c++) {
        if (terrain.get(cell.corners[c].key)) mask |= 1 << c;
      }
      blitSprite(ctx, composed, parsed, cell, mask);
    }
    return;
  }
  const on = new Set(inside);
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i];
    const filled = on.has(cell);
    if (params.method === 'blob' && !filled) continue;
    const mask = params.method === 'block' ? (filled ? 1 : 0) : blobMask(cell, (other) => on.has(other));
    blitSprite(ctx, composed, parsed, cell, mask);
  }
}

function parsedSheet(sheet) {
  const layout = sheetLayout(params.grid, params.method);
  return {
    cols: layout.cols,
    rows: layout.rows,
    tileW: sheet.tileW,
    tileH: sheet.tileH,
    mode: 'full',
  };
}

function compose(sheet) {
  const layout = sheetLayout(params.grid, params.method);
  const canvas = document.createElement('canvas');
  canvas.width = layout.cols * sheet.tileW;
  canvas.height = layout.rows * sheet.tileH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const slots = tileSlots(params.grid, params.method);
  for (let i = 0; i < slots.length; i++) {
    ctx.drawImage(sheet.tiles[i], slots[i].col * sheet.tileW, slots[i].row * sheet.tileH);
  }
  return canvas;
}

function blitSprite(ctx, sheetCanvas, parsed, cell, mask) {
  const loc = tilePlacement(cell.type, mask, cell.variant, params.hexOrientation, params.method);
  const sx = loc.index * parsed.tileW;
  const sy = 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawSpriteImage(ctx, sheetCanvas, sx, sy, parsed.tileW, parsed.tileH, cell, loc);
  ctx.restore();
}

function setHint(sheet) {
  const slot = tileSlots(params.grid, params.method)[sheet.selected];
  const mark = params.method === 'blob'
    ? 'Orange marks a filled neighbor.'
    : params.method === 'squares'
      ? 'Orange marks a filled corner.'
      : '';
  root.querySelector('.tileset-editor__status').textContent = `${slot.name}. ${slot.hint} ${mark}`;
}

function setMessage(text) {
  root.querySelector('.tileset-editor__message').textContent = text || '';
}

function grab(tile) {
  const image = tileContext(tile).getImageData(0, 0, tile.width, tile.height);
  return { w: tile.width, h: tile.height, data: new Uint8ClampedArray(image.data) };
}

function put(tile, shot) {
  if (tile.width !== shot.w || tile.height !== shot.h) return;
  const ctx = tileContext(tile);
  const image = ctx.createImageData(shot.w, shot.h);
  image.data.set(shot.data);
  ctx.putImageData(image, 0, 0);
}

function snapshot(sheet, indexes) {
  sheet.undo.push({
    shots: indexes.map((index) => ({ index, ...grab(sheet.tiles[index]) })),
  });
  if (sheet.undo.length > 40) sheet.undo.shift();
  sheet.redo.length = 0;
}

function restore(sheet, entry) {
  const back = {
    shots: entry.shots.map((shot) => ({ index: shot.index, ...grab(sheet.tiles[shot.index]) })),
  };
  for (let i = 0; i < entry.shots.length; i++) put(sheet.tiles[entry.shots[i].index], entry.shots[i]);
  return back;
}

function undo() {
  const sheet = currentSheet();
  const entry = sheet.undo.pop();
  if (!entry) return;
  sheet.redo.push(restore(sheet, entry));
  refreshArt(sheet);
}

function redo() {
  const sheet = currentSheet();
  const entry = sheet.redo.pop();
  if (!entry) return;
  sheet.undo.push(restore(sheet, entry));
  refreshArt(sheet);
}

function refreshArt(sheet, index = -1) {
  paintThumbs(sheet, index);
  drawRotations(sheet);
  drawPreview(sheet);
}

function shapeStyle() {
  return {
    color: params.terrainColor,
    filled: params.filled,
    rounded: params.edges === 'rounded',
    method: params.method,
  };
}

function stampShape(ctx, slot, style) {
  paintShape(ctx, params.grid, params.hexOrientation, ctx.canvas.width, ctx.canvas.height, slot.mask, slot.variant, style);
}

function shapeBehind() {
  const sheet = currentSheet();
  const slot = tileSlots(params.grid, params.method)[sheet.selected];
  snapshot(sheet, [sheet.selected]);
  stampShape(tileContext(sheet.tiles[sheet.selected]), slot, { ...shapeStyle(), composite: 'destination-over' });
  refreshArt(sheet, sheet.selected);
  setMessage('The shape sits behind what you already drew.');
}

function resetShapes() {
  const sheet = currentSheet();
  const slots = tileSlots(params.grid, params.method);
  snapshot(sheet, slots.map((slot) => slot.index));
  for (let i = 0; i < slots.length; i++) {
    const ctx = tileContext(sheet.tiles[i]);
    ctx.clearRect(0, 0, sheet.tileW, sheet.tileH);
    stampShape(ctx, slots[i], shapeStyle());
  }
  refreshArt(sheet);
  setMessage('Every tile is the marching shape.');
}

function clearTile(index) {
  const sheet = currentSheet();
  const ctx = tileContext(sheet.tiles[index]);
  ctx.clearRect(0, 0, sheet.tileW, sheet.tileH);
}

function clearSelected() {
  const sheet = currentSheet();
  snapshot(sheet, [sheet.selected]);
  clearTile(sheet.selected);
  refreshArt(sheet, sheet.selected);
}

function clearAll() {
  const sheet = currentSheet();
  const slots = tileSlots(params.grid, params.method);
  snapshot(sheet, slots.map((slot) => slot.index));
  for (let i = 0; i < slots.length; i++) clearTile(i);
  refreshArt(sheet);
}

function flip(axis) {
  const sheet = currentSheet();
  snapshot(sheet, [sheet.selected]);
  const tile = sheet.tiles[sheet.selected];
  const copy = makeTile(tile.width, tile.height);
  tileContext(copy).drawImage(tile, 0, 0);
  const ctx = tileContext(tile);
  ctx.clearRect(0, 0, tile.width, tile.height);
  ctx.save();
  if (axis === 'h') {
    ctx.translate(tile.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, tile.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
  refreshArt(sheet, sheet.selected);
}

function rotateTile() {
  const sheet = currentSheet();
  if (sheet.tileW !== sheet.tileH) return;
  snapshot(sheet, [sheet.selected]);
  const tile = sheet.tiles[sheet.selected];
  const copy = makeTile(tile.width, tile.height);
  tileContext(copy).drawImage(tile, 0, 0);
  const ctx = tileContext(tile);
  ctx.clearRect(0, 0, tile.width, tile.height);
  ctx.save();
  ctx.translate(tile.width / 2, tile.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(copy, -tile.width / 2, -tile.height / 2);
  ctx.restore();
  refreshArt(sheet, sheet.selected);
}

function setPreset(px) {
  const sheet = currentSheet();
  const size = editorTileSize(params.grid, params.hexOrientation, px);
  if (size.tileW === sheet.tileW && size.tileH === sheet.tileH) return;
  const old = sheet.tiles;
  const selected = sheet.selected;
  const next = replaceSheet(size.tileW, size.tileH);
  next.selected = selected;
  for (let i = 0; i < old.length; i++) {
    const ctx = tileContext(next.tiles[i]);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(old[i], 0, 0, next.tileW, next.tileH);
    old[i].remove();
  }
  ui.zoom = 0;
  sync();
  setMessage(`Tiles are ${next.tileW}×${next.tileH} px.`);
}

function cssToRgba(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255,
  ];
}

function rgbHex(r, g, b) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function pixelOf(event, sheet) {
  const rect = frame.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return { x: 0, y: 0 };
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * sheet.tileW);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * sheet.tileH);
  return {
    x: Math.max(0, Math.min(sheet.tileW - 1, x)),
    y: Math.max(0, Math.min(sheet.tileH - 1, y)),
  };
}

function stamp(ctx, x, y, erasing) {
  const n = ui.brush;
  const x0 = x - Math.floor((n - 1) / 2);
  const y0 = y - Math.floor((n - 1) / 2);
  ctx.save();
  ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  ctx.fillStyle = erasing ? '#000' : ui.color;
  ctx.fillRect(x0, y0, n, n);
  ctx.restore();
}

function paintLine(ctx, x0, y0, x1, y1, draw) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    draw(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function onPointerDown(event) {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  const sheet = currentSheet();
  const pt = pixelOf(event, sheet);
  try {
    frame.setPointerCapture(event.pointerId);
  } catch {
    // A pointer can already be released, or the event is not active.
  }
  if (ui.tool === 'picker' && event.button === 0) {
    const px = tileContext(sheet.tiles[sheet.selected]).getImageData(pt.x, pt.y, 1, 1).data;
    if (px[3] === 0) {
      setMessage('That pixel is empty.');
      return;
    }
    ui.color = rgbHex(px[0], px[1], px[2]);
    root.querySelector('[data-color]').value = ui.color;
    return;
  }
  if (ui.tool === 'fill' && event.button === 0) {
    snapshot(sheet, [sheet.selected]);
    const tile = sheet.tiles[sheet.selected];
    const ctx = tileContext(tile);
    const image = ctx.getImageData(0, 0, tile.width, tile.height);
    floodFill(image.data, tile.width, tile.height, pt.x, pt.y, cssToRgba(ui.color));
    ctx.putImageData(image, 0, 0);
    refreshArt(sheet, sheet.selected);
    return;
  }
  const erasing = event.button === 2 || ui.tool === 'eraser';
  snapshot(sheet, [sheet.selected]);
  stroke = { erasing, x: pt.x, y: pt.y };
  stamp(tileContext(sheet.tiles[sheet.selected]), pt.x, pt.y, erasing);
  refreshArt(sheet, sheet.selected);
}

function onPointerMove(event) {
  if (!stroke) return;
  const sheet = currentSheet();
  const pt = pixelOf(event, sheet);
  const ctx = tileContext(sheet.tiles[sheet.selected]);
  paintLine(ctx, stroke.x, stroke.y, pt.x, pt.y, (x, y) => stamp(ctx, x, y, stroke.erasing));
  stroke.x = pt.x;
  stroke.y = pt.y;
  refreshArt(sheet, sheet.selected);
}

function endStroke(event) {
  stroke = null;
  if (frame.hasPointerCapture?.(event.pointerId)) frame.releasePointerCapture(event.pointerId);
}

function onWheel(event) {
  event.preventDefault();
  const current = Number(frame.dataset.zoom || 1);
  ui.zoom = Math.max(1, Math.min(32, current + (event.deltaY < 0 ? 1 : -1)));
  const sheet = currentSheet();
  applyZoom(sheet);
  drawGuide(sheet);
}

function setTool(tool) {
  ui.tool = tool;
  frame.dataset.tool = tool;
  const buttons = root.querySelectorAll('[data-tool]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('is-on', buttons[i].dataset.tool === tool);
  }
}

function setBrush(size) {
  ui.brush = size;
  const buttons = root.querySelectorAll('[data-brush]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('is-on', Number(buttons[i].dataset.brush) === size);
  }
}

function setColor(color) {
  ui.color = color;
  root.querySelector('[data-color]').value = color;
}

function selectSlot(index) {
  const sheet = currentSheet();
  sheet.selected = index;
  markSelected(sheet);
  mountTile(sheet);
  drawGuide(sheet);
  drawRotations(sheet);
  setHint(sheet);
}

function onClick(event) {
  const slot = event.target.closest('.tileset-editor__slot');
  if (slot && root.contains(slot)) {
    selectSlot(Number(slot.dataset.index));
    return;
  }
  const tool = event.target.closest('[data-tool]');
  if (tool) {
    setTool(tool.dataset.tool);
    return;
  }
  const brush = event.target.closest('[data-brush]');
  if (brush) {
    setBrush(Number(brush.dataset.brush));
    return;
  }
  const preset = event.target.closest('[data-preset]');
  if (preset) {
    setPreset(Number(preset.dataset.preset));
    return;
  }
  const swatch = event.target.closest('[data-swatch]');
  if (swatch) {
    setColor(swatch.dataset.swatch);
    return;
  }
  const act = event.target.closest('[data-act]');
  if (!act || !root.contains(act)) return;
  const name = act.dataset.act;
  if (name === 'use') useInAutotile();
  else if (name === 'download') downloadSheet();
  else if (name === 'close') close();
  else if (name === 'zoom-out') zoomBy(-1);
  else if (name === 'zoom-in') zoomBy(1);
  else if (name === 'zoom-fit') zoomBy(0);
  else if (name === 'shape') shapeBehind();
  else if (name === 'reset-shapes') resetShapes();
  else if (name === 'clear') clearSelected();
  else if (name === 'clear-all') clearAll();
  else if (name === 'flip-h') flip('h');
  else if (name === 'flip-v') flip('v');
  else if (name === 'rotate') rotateTile();
  else if (name === 'load') fileInput.click();
  else if (name === 'load-current') loadCurrent();
}

function zoomBy(delta) {
  const sheet = currentSheet();
  if (delta === 0) ui.zoom = 0;
  else ui.zoom = Math.max(1, Math.min(32, Number(frame.dataset.zoom || 1) + delta));
  applyZoom(sheet);
  drawGuide(sheet);
}

function useInAutotile() {
  const sheet = currentSheet();
  const canvas = compose(sheet);
  if (Math.min(sheet.tileW, sheet.tileH) <= 48) params.crispPixels = true;
  const ok = window.autotile?.adoptSheet(canvas, 'Edited tiles');
  if (ok === false) {
    setMessage('That sheet does not match this grid.');
    return;
  }
  window.autotileControls?.refresh();
  close();
}

function downloadSheet() {
  const sheet = currentSheet();
  const canvas = compose(sheet);
  const link = document.createElement('a');
  const shape = params.grid === 'hex' ? `${params.grid}-${params.hexOrientation}` : params.grid;
  link.href = canvas.toDataURL('image/png');
  link.download = `autotile-${params.method}-${shape}-tileset.png`;
  link.click();
  setMessage('Saved a PNG. Drop it on the canvas to use it again.');
}

function adoptImage(image, width, height, label) {
  const parsed = parseSheet(params.grid, width, height, params.hexOrientation, params.method);
  if (!parsed || parsed.mode !== 'full') {
    setMessage(layoutHelp(params.grid, params.method));
    return false;
  }
  const selected = sheets.get(sheetKey())?.selected || 0;
  const sheet = replaceSheet(parsed.tileW, parsed.tileH);
  sheet.selected = Math.min(selected, sheet.tiles.length - 1);
  for (let i = 0; i < sheet.tiles.length; i++) {
    const slot = tileSlots(params.grid, params.method)[i];
    tileContext(sheet.tiles[i]).drawImage(
      image,
      slot.col * parsed.tileW,
      slot.row * parsed.tileH,
      parsed.tileW,
      parsed.tileH,
      0,
      0,
      parsed.tileW,
      parsed.tileH,
    );
  }
  ui.zoom = 0;
  sync();
  setMessage(label);
  return true;
}

function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    adoptImage(image, image.width, image.height, `Loaded ${file.name}.`);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setMessage('Could not read that image.');
  };
  image.src = url;
}

function loadCurrent() {
  const live = window.autotile?.currentSheet();
  if (!live) {
    setMessage('No sheet is in use for this grid.');
    return;
  }
  adoptImage(live.canvas, live.canvas.width, live.canvas.height, `Editing ${live.label}.`);
}

function onKeyDown(event) {
  if (root.hidden) return;
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (event.key === 'Escape') close();
    return;
  }
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && key === 'y') {
    event.preventDefault();
    event.stopImmediatePropagation();
    redo();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (key === 'escape') {
    close();
    return;
  }
  if (key === 'b') setTool('pencil');
  else if (key === 'e') setTool('eraser');
  else if (key === 'f') setTool('fill');
  else if (key === 'i') setTool('picker');
  else if (key === '[') setBrush(ui.brush === 4 ? 2 : 1);
  else if (key === ']') setBrush(ui.brush === 1 ? 2 : 4);
  else return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

window.autotileEditor = { open, close };
