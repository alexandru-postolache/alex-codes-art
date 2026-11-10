import './controls.js';
import './editor.js';
import { brushRadius, buildGrid, keysForPaint, pickCell, writeTerrain } from './grid.js';
import {
  canonicalCorners,
  cornerCount,
  flagsFromMask,
  layoutHelp,
  maskFromFlags,
  parseSheet,
  externalContours,
  sheetLayout,
  solidPolygons,
  drawSpriteImage,
  terrainPaths,
  templateTileSize,
  tileMasks,
  tilePlacement,
} from './marching.js';
import { params } from './params.js';

const sketch = (p) => {
  let grid = null;
  let terrain = new Map();
  let layer = null;
  let dirty = true;
  let tileset = null;
  let doc = { ops: [] };
  let activeStroke = null;
  let painting = false;
  let hover = null;
  let pointer = { x: -1, y: -1, inside: false };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    p.canvas.addEventListener('dragover', (event) => event.preventDefault());
    p.canvas.addEventListener('drop', onDrop);
    const fileInput = document.getElementById('tileset-file');
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) loadTilesetFile(file);
      fileInput.value = '';
    });
    window.addEventListener('keydown', onKeyDown);
    doc.ops.push(noiseOp());
    rebuild();
    p.noLoop();
    publishApi();
    syncStatus();
    p.redraw();
  };

  p.draw = () => {
    if (dirty) {
      paintLayer();
      dirty = false;
    }
    p.image(layer, 0, 0, p.width, p.height);
    drawCursor();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    rebuild();
    p.redraw();
  };

  p.mousePressed = (event) => {
    if (!isCanvasTarget(event)) return;
    painting = true;
    pointer.inside = true;
    activeStroke = { kind: 'stroke', stamps: [] };
    stampAt(p.mouseX, p.mouseY, paintValue());
    p.redraw();
  };

  p.mouseDragged = () => {
    pointer.x = p.mouseX;
    pointer.y = p.mouseY;
    if (!painting) {
      updateHover();
      p.redraw();
      return;
    }
    stampAt(p.mouseX, p.mouseY, paintValue());
    p.redraw();
  };

  p.mouseReleased = () => {
    if (activeStroke && activeStroke.stamps.length) doc.ops.push(activeStroke);
    activeStroke = null;
    painting = false;
  };

  p.mouseMoved = () => {
    pointer.x = p.mouseX;
    pointer.y = p.mouseY;
    pointer.inside = true;
    updateHover();
    p.redraw();
  };

  p.mouseOut = () => {
    pointer.inside = false;
    hover = null;
    setReadout('');
    p.redraw();
  };

  function publishApi() {
    window.autotile = {
      onParams(structural) {
        if (structural) rebuild();
        else dirty = true;
        syncStatus();
        document.body.style.background = params.backgroundColor;
        p.redraw();
      },
      clear() {
        doc.ops.push({ kind: 'clear' });
        terrain = new Map();
        dirty = true;
        p.redraw();
      },
      invert() {
        doc.ops.push({ kind: 'invert' });
        invertTerrain();
        dirty = true;
        p.redraw();
      },
      undo() {
        if (!doc.ops.length) return;
        doc.ops.pop();
        replay();
        dirty = true;
        p.redraw();
      },
      noiseFill(shuffle) {
        if (shuffle) params.noiseSeed = Math.floor(Math.random() * 999999);
        window.autotileControls?.refresh();
        doc.ops.push(noiseOp());
        applyNoise(doc.ops[doc.ops.length - 1]);
        dirty = true;
        p.redraw();
      },
      useTemplate() {
        const graphics = makeTemplateGraphics();
        adoptCanvas(graphics.elt, graphics.width, graphics.height, 'Generated sheet', graphics);
      },
      adoptSheet(canvas, label = 'Edited tiles') {
        return adoptCanvas(canvas, canvas.width, canvas.height, label, null);
      },
      currentSheet() {
        if (!tileset) return null;
        if (tileset.grid !== params.grid) return null;
        if (params.grid === 'hex' && tileset.orientation !== params.hexOrientation) return null;
        return { canvas: tileset.canvas, label: tileset.label };
      },
      downloadTemplate() {
        const graphics = makeTemplateGraphics(true);
        const link = document.createElement('a');
        const shape = params.grid === 'hex' ? `${params.grid}-${params.hexOrientation}` : params.grid;
        link.href = graphics.elt.toDataURL('image/png');
        link.download = `autotile-${shape}-template.png`;
        link.click();
        graphics.remove();
        const layout = sheetLayout(params.grid);
        syncStatus(
          `Saved a ${layout.cols}×${layout.rows} guide. These ${layout.count} tiles rotate and reflect to cover every mask. Borders and numbers are drawn on the sheet.`
        );
      },
      clearTileset() {
        releaseTileset();
        dirty = true;
        syncStatus();
        p.redraw();
      },
      savePng() {
        if (dirty) paintLayer();
        const link = document.createElement('a');
        link.href = layer.elt.toDataURL('image/png');
        link.download = `autotile-${params.grid}.png`;
        link.click();
      },
    };
  }

  function noiseOp() {
    return {
      kind: 'noise',
      seed: params.noiseSeed | 0,
      scale: params.noiseScale,
      threshold: params.noiseThreshold,
    };
  }

  function rebuild() {
    const size = Math.max(8, params.cellSize);
    grid = buildGrid(params.grid, p.width, p.height, size, params.hexOrientation);
    ensureLayer();
    replay();
    dirty = true;
  }

  function ensureLayer() {
    if (layer && layer.width === p.width && layer.height === p.height) return;
    if (layer) layer.remove();
    layer = p.createGraphics(p.width, p.height);
    layer.pixelDensity(p.pixelDensity());
  }

  function replay() {
    terrain = new Map();
    for (let i = 0; i < doc.ops.length; i++) applyOp(doc.ops[i]);
  }

  function applyOp(op) {
    if (op.kind === 'clear') {
      terrain = new Map();
      return;
    }
    if (op.kind === 'noise') {
      applyNoise(op);
      return;
    }
    if (op.kind === 'invert') {
      invertTerrain();
      return;
    }
    if (op.kind === 'stroke') {
      for (let i = 0; i < op.stamps.length; i++) applyStamp(op.stamps[i]);
    }
  }

  function applyNoise(op) {
    p.noiseSeed(op.seed);
    p.noiseDetail(4, 0.5);
    const vertices = grid.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const sample = p.noise(vertex.x * op.scale, vertex.y * op.scale);
      if (sample >= op.threshold) terrain.set(vertex.key, 1);
      else terrain.delete(vertex.key);
    }
  }

  function invertTerrain() {
    const vertices = grid.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const key = vertices[i].key;
      if (terrain.get(key)) terrain.delete(key);
      else terrain.set(key, 1);
    }
  }

  function erasing() {
    return p.mouseButton === p.RIGHT || p.keyIsDown(p.SHIFT);
  }

  function paintValue() {
    return erasing() ? 0 : 1;
  }

  function stampAt(x, y, value) {
    if (!activeStroke) return;
    const last = activeStroke.stamps[activeStroke.stamps.length - 1];
    if (last && last.x === x && last.y === y && last.value === value) return;
    const stamp = {
      x,
      y,
      value,
      mode: params.paintMode,
      brushSize: params.brushSize,
      radiusPx: brushRadius(grid, params.paintMode, params.brushSize),
    };
    activeStroke.stamps.push(stamp);
    applyStamp(stamp);
    dirty = true;
    updateHover();
  }

  function applyStamp(stamp) {
    const keys = keysForPaint(grid, stamp.x, stamp.y, stamp.mode, stamp.brushSize, stamp.radiusPx);
    writeTerrain(terrain, keys, stamp.value);
  }

  function updateHover() {
    hover = grid ? pickCell(grid, pointer.x, pointer.y) : null;
    if (!hover) {
      setReadout('');
      return;
    }
    const mask = maskFromFlags(flagsFor(hover));
    const bits = cornerCount(hover.type) ;
    const total = (1 << bits) - 1;
    setReadout(`${gridLabel()} · tile ${mask} of 0–${total}`);
  }

  function gridLabel() {
    if (params.grid === 'hex') return params.hexOrientation === 'flat' ? 'Flat hex' : 'Pointy hex';
    if (params.grid === 'triangle') return 'Triangle';
    return 'Square';
  }

  function setReadout(text) {
    const node = document.getElementById('status-readout');
    if (node) node.textContent = text;
  }

  function flagsFor(cell) {
    const flags = new Array(cell.corners.length);
    for (let i = 0; i < flags.length; i++) flags[i] = terrain.get(cell.corners[i].key) === 1;
    return flags;
  }

  function activeTileset() {
    if (!tileset || !params.useTileset) return null;
    if (tileset.grid !== params.grid) return null;
    if (params.grid === 'hex' && tileset.orientation !== params.hexOrientation) return null;
    return tileset;
  }

  function paintLayer() {
    const g = layer;
    g.background(params.backgroundColor);
    const sheet = activeTileset();
    const cells = grid.cells;
    const mergeOutline = !sheet && !params.filled && !params.internalLines;
    const mergeFill = !sheet && params.filled && params.edges === 'rounded';
    const outlinePolys = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const flags = flagsFor(cell);
      if (sheet) drawSprite(g, cell, maskFromFlags(flags), sheet);
      else if (mergeOutline || mergeFill) {
        const polys = solidPolygons(cell.corners, flags);
        for (let j = 0; j < polys.length; j++) outlinePolys.push(polys[j]);
      } else drawProcedural(g, cell.corners, flags);
    }
    if (mergeOutline || mergeFill) drawMergedShape(g, outlinePolys, mergeFill);
    if (params.showGrid) drawGrid(g);
    if (params.showVertices) drawVertices(g);
  }

  function drawProcedural(g, corners, flags) {
    const paths = terrainPaths(corners, flags, params.edges === 'rounded');
    if (!paths.length) return;
    const color = g.color(params.terrainColor).toString();
    const ctx = g.drawingContext;
    ctx.save();
    tracePath(ctx, corners);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = outlineWeight(corners);
    for (let i = 0; i < paths.length; i++) {
      traceCommands(ctx, paths[i]);
      if (params.filled) ctx.fill();
      else ctx.stroke();
    }
    ctx.restore();
  }

  function drawMergedShape(g, polys, fill) {
    const paths = externalContours(polys, params.edges === 'rounded');
    if (!paths.length || !grid.cells.length) return;
    const ctx = g.drawingContext;
    const color = g.color(params.terrainColor).toString();
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = outlineWeight(grid.cells[0].corners);
    ctx.beginPath();
    for (let i = 0; i < paths.length; i++) traceCommands(ctx, paths[i], false);
    if (fill) ctx.fill('evenodd');
    else ctx.stroke();
    ctx.restore();
  }

  function outlineWeight(corners) {
    let min = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
    }
    return Math.max(1.5, min * 0.07);
  }

  function traceCommands(ctx, commands, begin = true) {
    if (begin) ctx.beginPath();
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      if (cmd.op === 'M') ctx.moveTo(cmd.x, cmd.y);
      else if (cmd.op === 'L') ctx.lineTo(cmd.x, cmd.y);
      else ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
    }
    ctx.closePath();
  }

  function drawSprite(g, cell, mask, sheet) {
    const loc = tilePlacement(cell.type, mask, cell.variant, params.hexOrientation);
    const col = loc.index % sheet.parsed.cols;
    const row = Math.floor(loc.index / sheet.parsed.cols);
    const ctx = g.drawingContext;
    ctx.save();
    ctx.imageSmoothingEnabled = !params.crispPixels;
    drawSpriteImage(
      ctx,
      sheet.canvas,
      col * sheet.parsed.tileW,
      row * sheet.parsed.tileH,
      sheet.parsed.tileW,
      sheet.parsed.tileH,
      cell,
      loc,
    );
    ctx.restore();
  }

  function drawGrid(g) {
    const color = g.color(params.gridColor);
    color.setAlpha(Math.round((params.gridAlpha / 100) * 255));
    g.stroke(color);
    g.strokeWeight(1);
    g.strokeJoin(g.ROUND);
    g.noFill();
    const cells = grid.cells;
    for (let i = 0; i < cells.length; i++) drawPoly(g, cells[i].corners);
  }

  function drawVertices(g) {
    g.noStroke();
    const vertices = grid.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      g.fill(terrain.get(vertex.key) ? params.terrainColor : params.gridColor);
      g.circle(vertex.x, vertex.y, Math.max(3, grid.vertexSpacing * 0.12));
    }
  }

  function drawCursor() {
    if (!pointer.inside || !grid) return;
    if (hover) {
      p.noFill();
      p.stroke(erasing() ? '#9a3412' : '#e4572e');
      p.strokeWeight(2);
      drawPoly(p, hover.corners);
    }
    if (params.paintMode === 'vertices') {
      const reach = brushRadius(grid, 'vertices', params.brushSize);
      p.noFill();
      p.stroke('#e4572e');
      p.strokeWeight(1);
      p.circle(pointer.x, pointer.y, Math.max(8, reach * 2));
    } else if (params.brushSize > 1) {
      const reach = brushRadius(grid, 'cells', params.brushSize);
      p.noFill();
      p.stroke('#e4572e');
      p.strokeWeight(1);
      p.circle(pointer.x, pointer.y, reach * 2);
    }
  }

  function drawPoly(g, points) {
    g.beginShape();
    for (let i = 0; i < points.length; i++) g.vertex(points[i].x, points[i].y);
    g.endShape(g.CLOSE);
  }

  function tracePath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function makeTemplateGraphics(guides = false) {
    const layout = sheetLayout(params.grid);
    const { tileW, tileH } = templateTileSize(params.grid, params.hexOrientation);
    const graphics = p.createGraphics(layout.cols * tileW, layout.rows * tileH);
    graphics.pixelDensity(1);
    if (guides) graphics.background('#d8d2c6');
    else graphics.clear();
    const bits = cornerCount(params.grid);
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const slot = row * layout.cols + col;
        const mask = tileMasks(params.grid)[slot];
        const variant = 'up';
        const x = col * tileW;
        const y = row * tileH;
        if (guides) {
          graphics.noStroke();
          graphics.fill(params.backgroundColor);
          graphics.rect(x, y, tileW, tileH);
        }
        const local = canonicalCorners(params.grid, params.hexOrientation, tileW, tileH, variant);
        const corners = local.map((pt) => ({ x: pt.x + x, y: pt.y + y }));
        const ctx = graphics.drawingContext;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, tileW, tileH);
        ctx.clip();
        drawProcedural(graphics, corners, flagsFromMask(mask, bits));
        ctx.restore();
        if (guides) drawTemplateGuide(graphics, x, y, tileW, tileH, params.grid === 'square' ? slot : mask);
      }
    }
    return graphics;
  }

  function drawTemplateGuide(graphics, x, y, tileW, tileH, mask) {
    graphics.noFill();
    graphics.stroke('#1c1915');
    graphics.strokeWeight(3);
    graphics.rect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);

    const label = String(mask);
    const size = Math.max(14, Math.round(Math.min(tileW, tileH) * 0.2));
    graphics.textSize(size);
    graphics.textAlign(graphics.CENTER, graphics.CENTER);
    const cx = x + tileW / 2;
    const cy = y + tileH / 2;
    const labelW = graphics.textWidth(label);
    graphics.noStroke();
    graphics.fill(255, 250, 240, 230);
    graphics.rect(cx - labelW / 2 - 7, cy - size / 2 - 4, labelW + 14, size + 8, 6);
    graphics.fill('#1c1915');
    graphics.text(label, cx, cy);
  }

  function adoptCanvas(canvas, width, height, label, hold) {
    const parsed = parseSheet(params.grid, width, height, params.hexOrientation);
    if (!parsed) {
      if (hold?.remove) hold.remove();
      syncStatus(layoutHelp(params.grid));
      return false;
    }
    releaseTileset();
    tileset = {
      canvas,
      parsed,
      hold,
      grid: params.grid,
      orientation: params.hexOrientation,
      label,
    };
    params.useTileset = true;
    window.autotileControls?.refresh();
    dirty = true;
    syncStatus();
    p.redraw();
    return true;
  }

  function loadTilesetFile(file) {
    const url = URL.createObjectURL(file);
    p.loadImage(
      url,
      (img) => {
        URL.revokeObjectURL(url);
        adoptCanvas(img.canvas || img.elt, img.width, img.height, file.name, img);
      },
      () => {
        URL.revokeObjectURL(url);
        syncStatus('Could not read that image.');
      }
    );
  }

  function onDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) loadTilesetFile(file);
  }

  function releaseTileset() {
    if (tileset?.hold?.remove && tileset.label === 'Generated sheet') tileset.hold.remove();
    tileset = null;
  }

  function syncStatus(error) {
    const sheet = activeTileset();
    let label = 'One-color tiles';
    let note = layoutHelp(params.grid);
    if (error) {
      note = error;
    } else if (tileset && !sheet) {
      label = tileset.label;
      note = `That sheet is for ${tileset.grid}${tileset.grid === 'hex' ? ` (${tileset.orientation})` : ''}. Showing one-color tiles.`;
    } else if (sheet) {
      label = `${sheet.label} · ${sheet.parsed.cols}×${sheet.parsed.rows}`;
      note = `${sheet.parsed.tileW}×${sheet.parsed.tileH} px tiles. ${layoutHelp(params.grid)}`;
    }
    window.autotileControls?.setStatus(label, note);
  }

  function onKeyDown(event) {
    if (document.body.classList.contains('is-editing-tiles')) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      window.autotile.undo();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (key === 'h') {
      window.autotileControls?.togglePane();
      return;
    }
    if (key === 'g') {
      params.showGrid = !params.showGrid;
      window.autotileControls?.refresh();
      dirty = true;
      p.redraw();
      return;
    }
    if (key === '[') {
      params.brushSize = Math.max(1, params.brushSize - 1);
      window.autotileControls?.refresh();
      p.redraw();
      return;
    }
    if (key === ']') {
      params.brushSize = Math.min(12, params.brushSize + 1);
      window.autotileControls?.refresh();
      p.redraw();
    }
    if (key === 's') {
      event.preventDefault();
      window.autotile.savePng();
    }
  }

  function isCanvasTarget(event) {
    return event?.target === p.canvas;
  }
};

new p5(sketch);
