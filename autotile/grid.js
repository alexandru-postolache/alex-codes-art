/** Square, pointy/flat hex, and triangle grids with shared corner vertices. */

import { pointInPolygon } from './geometry.js';

export function brushRadius(grid, mode, brushSize) {
  if (mode === 'vertices') {
    return brushSize <= 1 ? grid.vertexSpacing * 0.75 : brushSize * grid.vertexSpacing * 0.85;
  }
  return brushSize <= 1 ? 0 : (brushSize - 0.5) * grid.brushStep;
}

export function buildGrid(type, width, height, cellSize, orientation = 'pointy') {
  if (type === 'hex') return buildHex(width, height, cellSize, orientation);
  if (type === 'triangle') return buildTriangle(width, height, cellSize);
  return buildSquare(width, height, cellSize);
}

export function pickCell(grid, x, y) {
  const b = grid.bucket;
  const gx = Math.floor(x / b);
  const gy = Math.floor(y / b);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = grid.index.get(`${gx + dx},${gy + dy}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const cell = grid.cells[list[i]];
        if (pointInPolygon(x, y, cell.corners)) return cell;
      }
    }
  }
  return null;
}

export function cellsInBrush(grid, x, y, brushSize, radiusPx = null) {
  const hit = pickCell(grid, x, y);
  const reach = radiusPx == null ? brushRadius(grid, 'cells', brushSize) : radiusPx;
  if (reach <= 0) return hit ? [hit] : [];

  const result = [];
  const seen = new Set();
  const b = grid.bucket;
  const x0 = Math.floor((x - reach) / b);
  const x1 = Math.floor((x + reach) / b);
  const y0 = Math.floor((y - reach) / b);
  const y1 = Math.floor((y + reach) / b);
  const reach2 = reach * reach;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const list = grid.index.get(`${gx},${gy}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const index = list[i];
        if (seen.has(index)) continue;
        seen.add(index);
        const cell = grid.cells[index];
        const dx = cell.center.x - x;
        const dy = cell.center.y - y;
        if (dx * dx + dy * dy <= reach2) result.push(cell);
      }
    }
  }
  if (hit && !result.includes(hit)) result.push(hit);
  return result;
}

export function keysForPaint(grid, x, y, mode, brushSize, radiusPx = null) {
  if (mode === 'vertices') {
    const reach = radiusPx == null ? brushRadius(grid, 'vertices', brushSize) : radiusPx;
    const limit = brushSize <= 1 ? Math.max(reach, grid.vertexSpacing) : reach;
    const limit2 = limit * limit;
    if (brushSize <= 1) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < grid.vertices.length; i++) {
        const vertex = grid.vertices[i];
        const d = (vertex.x - x) ** 2 + (vertex.y - y) ** 2;
        if (d < bestD && d <= limit2) {
          bestD = d;
          best = vertex;
        }
      }
      return best ? [best.key] : [];
    }
    const keys = [];
    for (let i = 0; i < grid.vertices.length; i++) {
      const vertex = grid.vertices[i];
      const d = (vertex.x - x) ** 2 + (vertex.y - y) ** 2;
      if (d <= limit2) keys.push(vertex.key);
    }
    return keys;
  }

  const keys = [];
  const seen = new Set();
  const cells = cellsInBrush(grid, x, y, brushSize, radiusPx);
  for (let i = 0; i < cells.length; i++) {
    const corners = cells[i].corners;
    for (let c = 0; c < corners.length; c++) {
      const key = corners[c].key;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export function writeTerrain(terrain, keys, value) {
  for (let i = 0; i < keys.length; i++) {
    if (value) terrain.set(keys[i], 1);
    else terrain.delete(keys[i]);
  }
}

function buildSquare(width, height, cellSize) {
  const vertexSpacing = cellSize;
  const index = makeIndexer(vertexSpacing / 512);
  const cells = [];
  const cols = Math.ceil(width / cellSize) + 1;
  const rows = Math.ceil(height / cellSize) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      const corners = [
        index.corner(x, y),
        index.corner(x + cellSize, y),
        index.corner(x + cellSize, y + cellSize),
        index.corner(x, y + cellSize),
      ];
      pushCell(cells, 'square', corners, width, height, null);
    }
  }
  return pack(cells, index, {
    type: 'square',
    orientation: null,
    cellSize,
    brushStep: cellSize,
    vertexSpacing,
  });
}

function buildHex(width, height, cellSize, orientation) {
  const pointy = orientation !== 'flat';
  const radius = pointy ? cellSize / Math.sqrt(3) : cellSize / 2;
  const vertexSpacing = radius;
  const brushStep = Math.sqrt(3) * radius;
  const index = makeIndexer(vertexSpacing / 512);
  const cells = [];
  const colCount = Math.ceil(width / (pointy ? cellSize : radius * 1.5)) + 3;
  const rowCount = Math.ceil(height / (pointy ? radius * 1.5 : (Math.sqrt(3) * radius))) + 3;

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      let cx;
      let cy;
      if (pointy) {
        cx = cellSize * (col + 0.5 * ((row & 1) + 1));
        cy = radius + row * 1.5 * radius;
      } else {
        const hexH = Math.sqrt(3) * radius;
        cx = radius + col * 1.5 * radius;
        cy = hexH / 2 + hexH * (row + 0.5 * (col & 1));
      }
      const raw = hexCorners(cx, cy, radius, pointy);
      const corners = raw.map((pt) => index.corner(pt.x, pt.y));
      pushCell(cells, 'hex', corners, width, height, pointy ? 'pointy' : 'flat');
    }
  }

  return pack(cells, index, {
    type: 'hex',
    orientation: pointy ? 'pointy' : 'flat',
    cellSize,
    brushStep,
    vertexSpacing,
  });
}

function buildTriangle(width, height, cellSize) {
  const edge = cellSize;
  const h = (edge * Math.sqrt(3)) / 2;
  const vertexSpacing = edge / 2;
  const brushStep = edge / Math.sqrt(3);
  const index = makeIndexer(vertexSpacing / 512);
  const cells = [];
  const cols = Math.ceil(width / vertexSpacing) + 2;
  const rows = Math.ceil(height / h) + 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col * edge) / 2;
      const y = row * h;
      const up = (col + row) % 2 === 0;
      const raw = up
        ? [
            { x: x + edge / 2, y },
            { x: x + edge, y: y + h },
            { x, y: y + h },
          ]
        : [
            { x: x + edge / 2, y: y + h },
            { x: x + edge, y },
            { x, y },
          ];
      const corners = raw.map((pt) => index.corner(pt.x, pt.y));
      pushCell(cells, 'triangle', corners, width, height, up ? 'up' : 'down');
    }
  }
  return pack(cells, index, {
    type: 'triangle',
    orientation: null,
    cellSize,
    brushStep,
    vertexSpacing,
  });
}

export function hexCorners(cx, cy, radius, pointy) {
  const start = pointy ? -Math.PI / 2 : 0;
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = start + (i * Math.PI) / 3;
    corners.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return corners;
}

function makeIndexer(step) {
  const map = new Map();
  return {
    map,
    corner(x, y) {
      const ix = Math.round(x / step);
      const iy = Math.round(y / step);
      const key = `${ix},${iy}`;
      let vertex = map.get(key);
      if (!vertex) {
        vertex = { key, x: ix * step, y: iy * step };
        map.set(key, vertex);
      }
      return vertex;
    },
  };
}

function bboxOf(corners) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const pt = corners[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pushCell(cells, type, corners, width, height, variant) {
  const bbox = bboxOf(corners);
  if (bbox.x >= width || bbox.y >= height || bbox.x + bbox.w <= 0 || bbox.y + bbox.h <= 0) return;
  let x = 0;
  let y = 0;
  for (let i = 0; i < corners.length; i++) {
    x += corners[i].x;
    y += corners[i].y;
  }
  cells.push({
    type,
    variant,
    corners,
    bbox,
    center: { x: x / corners.length, y: y / corners.length },
  });
}

function pack(cells, index, meta) {
  const bucket = Math.max(8, meta.cellSize);
  const spatial = new Map();
  for (let i = 0; i < cells.length; i++) {
    const box = cells[i].bbox;
    const x0 = Math.floor(box.x / bucket);
    const x1 = Math.floor((box.x + box.w) / bucket);
    const y0 = Math.floor(box.y / bucket);
    const y1 = Math.floor((box.y + box.h) / bucket);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = `${x},${y}`;
        let list = spatial.get(key);
        if (!list) spatial.set(key, (list = []));
        list.push(i);
      }
    }
  }
  return {
    ...meta,
    cells,
    vertices: [...index.map.values()],
    index: spatial,
    bucket,
  };
}
