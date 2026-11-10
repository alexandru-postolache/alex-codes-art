import assert from 'node:assert/strict';
import test from 'node:test';
import { blobMask, normalizeBlob, squareBlobPoints } from '../blob.js';
import { pointInPolygon } from '../geometry.js';
import { buildGrid } from '../grid.js';
import { canonicalCorners } from '../marching.js';
import {
  layoutHelp,
  parseSheet,
  placementMasks,
  sheetLayout,
  slotInfo,
  tileMasks,
  tilePlacement,
} from '../rules.js';

test('a square blob normalizes to 47 patterns and 14 tiles', () => {
  const seen = new Set();
  for (let mask = 0; mask < 256; mask++) seen.add(normalizeBlob(mask));
  assert.equal(seen.size, 47);
  assert.equal(tileMasks('square', 'blob').length, 14);
  assert.equal(placementMasks('square', 'blob').length, 47);
  const names = tileMasks('square', 'blob').map((mask) => slotInfo('square', 'blob', mask).name);
  assert.equal(new Set(names).size, names.length);
});

test('blob and block sheets cover every pattern', () => {
  for (const type of ['square', 'triangle', 'hex']) {
    assert.deepEqual(tileMasks(type, 'block'), [0, 1]);
    assert.equal(sheetLayout(type, 'block').cols, 2);
    const masks = tileMasks(type, 'blob');
    const names = masks.map((mask) => slotInfo(type, 'blob', mask).name);
    assert.equal(new Set(names).size, names.length, type);
    for (const orientation of type === 'hex' ? ['pointy', 'flat'] : ['pointy']) {
      for (const variant of type === 'triangle' ? ['up', 'down'] : ['up', null, 'pointy']) {
        for (const mask of placementMasks(type, 'blob')) {
          const place = tilePlacement(type, mask, variant, orientation, 'blob');
          assert.ok(place.index >= 0 && place.index < masks.length);
          assert.equal(movedMask(type, orientation, variant, masks[place.index], place), mask);
        }
      }
    }
  }
});

test('block and blob templates parse at the cell aspect', () => {
  for (const method of ['blob', 'block']) {
    for (const type of ['square', 'hex', 'triangle']) {
      const layout = sheetLayout(type, method);
      const parsed = parseSheet(type, 64 * layout.cols, type === 'square' ? 64 : 56, 'pointy', method);
      if (type === 'square') assert.equal(parsed.cols, layout.cols);
    }
  }
  assert.equal(parseSheet('square', 64 * 6, 64, 'pointy', 'block'), null);
  assert.match(layoutHelp('square', 'block'), /2 tiles/);
  assert.match(layoutHelp('square', 'blob'), /47/);
});

test('filled edge and diagonal neighbors build the square blob mask', () => {
  const grid = buildGrid('square', 360, 360, 40);
  const cell = grid.cells.find((item) => item.edgeNeighbors.every(Boolean) && item.cornerNeighbors.every(Boolean));
  assert.ok(cell);
  const north = cell.edgeNeighbors[0];
  const east = cell.edgeNeighbors[1];
  const northEast = cell.cornerNeighbors[1];
  const on = new Set([cell, north, east, northEast]);
  assert.equal(blobMask(cell, (other) => on.has(other)), 1 | 2 | 4);
  assert.equal(blobMask(cell, () => false), 0);
});

test('a shared blob edge is covered from both cells', () => {
  const left = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ];
  const right = left.map((pt) => ({ x: pt.x + 40, y: pt.y }));
  const leftPts = squareBlobPoints(left, 4);
  const rightPts = squareBlobPoints(right, 64);
  assert.equal(pointInPolygon(39, 20, leftPts), true);
  assert.equal(pointInPolygon(41, 20, rightPts), true);
  assert.equal(pointInPolygon(1, 1, squareBlobPoints(left, 0)), false);
  assert.equal(pointInPolygon(20, 20, squareBlobPoints(left, 0)), true);
});

function movedMask(type, orientation, variant, mask, place) {
  const box = type === 'triangle'
    ? { w: 2, h: Math.sqrt(3) }
    : type === 'hex'
      ? (orientation === 'flat' ? { w: 2, h: Math.sqrt(3) } : { w: Math.sqrt(3), h: 2 })
      : { w: 2, h: 2 };
  const side = variant === 'down' ? 'down' : 'up';
  const corners = canonicalCorners(type, orientation, box.w, box.h, 'up');
  const targetCorners = canonicalCorners(type, orientation, box.w, box.h, side);
  const source = samplePoints(type, corners);
  const target = samplePoints(type, targetCorners);
  const from = centroid(source);
  const to = centroid(target);
  const steps = type === 'hex' ? 6 : type === 'triangle' ? 3 : 4;
  let out = 0;
  for (let i = 0; i < source.length; i++) {
    if ((mask & (1 << i)) === 0) continue;
    let x = source[i].x - from.x;
    let y = source[i].y - from.y;
    if (place.flipY) y = -y;
    if (place.reflect) x = -x;
    const theta = (place.turns * 2 * Math.PI) / steps;
    const moved = {
      x: to.x + x * Math.cos(theta) - y * Math.sin(theta),
      y: to.y + x * Math.sin(theta) + y * Math.cos(theta),
    };
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < target.length; j++) {
      const d = (moved.x - target[j].x) ** 2 + (moved.y - target[j].y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    assert.ok(bestD < 1e-8, `${type} ${mask} bit ${i}`);
    out |= 1 << best;
  }
  return type === 'square' ? normalizeBlob(out) : out;
}

function samplePoints(type, corners) {
  const points = [];
  if (type === 'square') {
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      points.push(b);
    }
    return points;
  }
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return points;
}

function centroid(points) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    x += points[i].x;
    y += points[i].y;
  }
  return { x: x / points.length, y: y / points.length };
}
