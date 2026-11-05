import assert from 'node:assert/strict';
import test from 'node:test';
import { pointInPolygon } from '../geometry.js';
import { buildGrid, keysForPaint, writeTerrain } from '../grid.js';
import {
  maskFromFlags,
  parseSheet,
  sheetLayout,
  solidPolygons,
  spriteCell,
  templateTileSize,
} from '../marching.js';

function flagsOf(cell, terrain) {
  return cell.corners.map((corner) => terrain.get(corner.key) === 1);
}

test('square marching squares fills corners, edges, and opposite corners', () => {
  const corners = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ];
  assert.equal(solidPolygons(corners, [false, false, false, false]).length, 0);
  assert.equal(solidPolygons(corners, [true, true, true, true]).length, 1);
  assert.equal(solidPolygons(corners, [true, true, true, true])[0].length, 4);

  const corner = solidPolygons(corners, [true, false, false, false]);
  assert.equal(corner.length, 1);
  assert.equal(corner[0].length, 3);
  assert.equal(pointInPolygon(4, 4, corner[0]), true);
  assert.equal(pointInPolygon(20, 20, corner[0]), false);

  const edge = solidPolygons(corners, [true, false, false, true]);
  assert.equal(edge.length, 1);
  assert.equal(pointInPolygon(5, 20, edge[0]), true);
  assert.equal(pointInPolygon(30, 20, edge[0]), false);

  const opposite = solidPolygons(corners, [true, false, true, false]);
  assert.equal(opposite.length, 2);
});

test('painting one square sets that cell full and the neighbor to the shared edge', () => {
  const grid = buildGrid('square', 160, 80, 40);
  const terrain = new Map();
  const origin = grid.cells.find((cell) => cell.corners[0].x === 0 && cell.corners[0].y === 0);
  assert.ok(origin);
  writeTerrain(terrain, keysForPaint(grid, origin.center.x, origin.center.y, 'cells', 1), 1);
  assert.equal(maskFromFlags(flagsOf(origin, terrain)), 15);

  const right = grid.cells.find((cell) => cell.corners[0].key === origin.corners[1].key);
  assert.ok(right);
  assert.equal(maskFromFlags(flagsOf(right, terrain)), 9);
  assert.equal(origin.corners[1], right.corners[0]);
  assert.equal(origin.corners[2], right.corners[3]);
});

function interiorCell(grid) {
  return grid.cells.reduce((best, cell) => {
    const score = Math.hypot(cell.center.x - 480, cell.center.y - 360);
    const bestScore = Math.hypot(best.center.x - 480, best.center.y - 360);
    return score < bestScore ? cell : best;
  });
}

function edgeNeighbors(grid, cell) {
  const n = cell.corners.length;
  const found = [];
  for (let i = 0; i < n; i++) {
    const a = cell.corners[i];
    const b = cell.corners[(i + 1) % n];
    const neighbor = grid.cells.find(
      (other) => other !== cell && other.corners.includes(a) && other.corners.includes(b)
    );
    if (neighbor) found.push(neighbor);
  }
  return found;
}

test('an interior hex or triangle shares every edge, and painting it autotiles those neighbors', () => {
  for (const [type, orientation] of [['hex', 'pointy'], ['hex', 'flat'], ['triangle', 'pointy']]) {
    const grid = buildGrid(type, 960, 720, 48, orientation);
    const cell = interiorCell(grid);
    const neighbors = edgeNeighbors(grid, cell);
    assert.equal(neighbors.length, cell.corners.length, `${type} ${orientation}`);

    const terrain = new Map();
    writeTerrain(terrain, keysForPaint(grid, cell.center.x, cell.center.y, 'cells', 1), 1);
    assert.equal(maskFromFlags(flagsOf(cell, terrain)), (1 << cell.corners.length) - 1);
    for (const neighbor of neighbors) {
      assert.equal(flagsOf(neighbor, terrain).filter(Boolean).length, 2, `${type} ${orientation}`);
    }
  }
});

test('a point on the canvas hits a cell for every grid', () => {
  for (const type of ['square', 'hex', 'triangle']) {
    const grid = buildGrid(type, 640, 480, 36, 'flat');
    let hits = 0;
    for (let y = 8; y < 480; y += 24) {
      for (let x = 8; x < 640; x += 24) {
        if (grid.cells.some((cell) => pointInPolygon(x, y, cell.corners))) hits += 1;
      }
    }
    assert.ok(hits > 400, `${type} covered ${hits} samples`);
  }
});

test('tileset sheets match the generated template size', () => {
  for (const type of ['square', 'hex', 'triangle']) {
    for (const orientation of ['pointy', 'flat']) {
      const layout = sheetLayout(type);
      const { tileW, tileH } = templateTileSize(type, orientation);
      const parsed = parseSheet(type, tileW * layout.cols, tileH * layout.rows, orientation);
      assert.ok(parsed, type);
      assert.equal(parsed.mode, 'full');
      assert.equal(parsed.tileW, tileW);
      assert.equal(parsed.tileH, tileH);
    }
  }

  const square = parseSheet('square', 512, 32);
  assert.equal(square.mode, 'strip');
  assert.equal(square.cols, 16);
  assert.equal(square.tileW, 32);

  const upOnly = templateTileSize('triangle', 'pointy');
  const flip = parseSheet('triangle', upOnly.tileW * 8, upOnly.tileH, 'pointy');
  assert.equal(flip.mode, 'flip-down');
  assert.deepEqual(spriteCell(flip, 'triangle', 3, 'down'), { col: 3, row: 0, flipY: true });
  assert.deepEqual(spriteCell(flip, 'triangle', 3, 'up'), { col: 3, row: 0, flipY: false });

  const full = parseSheet('triangle', upOnly.tileW * 8, upOnly.tileH * 2, 'pointy');
  assert.deepEqual(spriteCell(full, 'triangle', 5, 'down'), { col: 5, row: 1, flipY: false });
  assert.equal(parseSheet('hex', 100, 40, 'pointy'), null);
});
