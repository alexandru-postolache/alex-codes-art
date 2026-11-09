import assert from 'node:assert/strict';
import test from 'node:test';
import { pointInPolygon } from '../geometry.js';
import { buildGrid, keysForPaint, writeTerrain } from '../grid.js';
import {
  maskFromFlags,
  parseSheet,
  rotateMask,
  sheetLayout,
  solidPolygons,
  spriteCell,
  terrainPaths,
  SQUARE_TILES,
  squarePlacement,
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

test('rounded tiles curve every corner and stay inside the straight shape', () => {
  const corners = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ];
  assert.equal(terrainPaths(corners, [false, false, false, false], true).length, 0);

  const straight = terrainPaths(corners, [true, true, true, true], false);
  assert.equal(straight.length, 1);
  assert.ok(straight[0].every((cmd) => cmd.op === 'M' || cmd.op === 'L'));

  const rounded = terrainPaths(corners, [true, true, true, true], true)[0];
  assert.equal(rounded.filter((cmd) => cmd.op === 'Q').length, 4);
  let x = 0;
  let y = 0;
  for (const cmd of rounded) {
    if (cmd.op === 'M' || cmd.op === 'L') {
      x = cmd.x;
      y = cmd.y;
    } else {
      const mx = 0.25 * x + 0.5 * cmd.cx + 0.25 * cmd.x;
      const my = 0.25 * y + 0.5 * cmd.cy + 0.25 * cmd.y;
      assert.ok(mx >= -0.01 && mx <= 40.01 && my >= -0.01 && my <= 40.01);
      assert.ok(mx > 0.5 && mx < 39.5 && my > 0.5 && my < 39.5);
      x = cmd.x;
      y = cmd.y;
    }
  }

  const corner = terrainPaths(corners, [true, false, false, false], true);
  assert.equal(corner.length, 1);
  assert.equal(corner[0].filter((cmd) => cmd.op === 'Q').length, 3);
  const opposite = terrainPaths(corners, [true, false, true, false], true);
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

  assert.equal(parseSheet('square', 512, 512), null);
  assert.equal(parseSheet('square', 512, 32), null);
  assert.equal(parseSheet('square', 128 * 3, 128 * 2), null);

  const six = parseSheet('square', 128 * 6, 128);
  assert.equal(six.mode, 'full');
  assert.equal(six.cols, 6);
  assert.equal(six.rows, 1);
  for (let mask = 0; mask < 16; mask++) {
    const place = squarePlacement(mask);
    assert.equal(rotateMask(SQUARE_TILES[place.index], place.turns), mask);
    assert.deepEqual(spriteCell(six, 'square', mask), {
      col: place.index,
      row: 0,
      flipY: false,
      turns: place.turns,
    });
  }
  assert.deepEqual(SQUARE_TILES, [0, 1, 3, 5, 7, 15]);

  const upOnly = templateTileSize('triangle', 'pointy');
  const flip = parseSheet('triangle', upOnly.tileW * 8, upOnly.tileH, 'pointy');
  assert.equal(flip.mode, 'flip-down');
  assert.deepEqual(spriteCell(flip, 'triangle', 3, 'down'), { col: 3, row: 0, flipY: true, turns: 0 });
  assert.deepEqual(spriteCell(flip, 'triangle', 3, 'up'), { col: 3, row: 0, flipY: false, turns: 0 });

  const full = parseSheet('triangle', upOnly.tileW * 8, upOnly.tileH * 2, 'pointy');
  assert.deepEqual(spriteCell(full, 'triangle', 5, 'down'), { col: 5, row: 1, flipY: false, turns: 0 });
  assert.equal(parseSheet('hex', 100, 40, 'pointy'), null);
});
