import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSheet, SQUARE_TILES, tileMasks } from '../marching.js';
import {
  EDITOR_PRESETS,
  editorTileSize,
  floodFill,
  shapePaths,
  squareTurnLabel,
  tileSlots,
} from '../tileset.js';

test('editor slots cover the sheet the painter accepts', () => {
  const square = tileSlots('square');
  assert.equal(square.length, 6);
  assert.deepEqual(square.map((slot) => slot.mask), SQUARE_TILES);
  assert.deepEqual(square.map((slot) => slot.name), ['Empty', 'Corner', 'Edge', 'Opposite', 'Three', 'Full']);
  assert.equal(square[1].hint.includes('90°'), true);

  const triangle = tileSlots('triangle');
  assert.equal(triangle.length, 4);
  assert.deepEqual(triangle.map((slot) => slot.mask), tileMasks('triangle'));
  assert.deepEqual(triangle.map((slot) => slot.name), ['Empty', 'Corner', 'Edge', 'Full']);
  assert.equal(triangle.every((slot) => slot.variant === 'up'), true);

  const hex = tileSlots('hex');
  assert.equal(hex.length, 13);
  assert.deepEqual(hex.map((slot) => slot.mask), tileMasks('hex'));
  assert.equal(new Set(hex.map((slot) => slot.name)).size, hex.length);
});

test('editor tile sizes parse as a full sheet', () => {
  for (const type of ['square', 'hex', 'triangle']) {
    for (const orientation of ['pointy', 'flat']) {
      for (const px of EDITOR_PRESETS) {
        const size = editorTileSize(type, orientation, px);
        const slots = tileSlots(type);
        const cols = slots.length;
        const rows = 1;
        const parsed = parseSheet(type, size.tileW * cols, size.tileH * rows, orientation);
        assert.ok(parsed, `${type} ${orientation} ${px}`);
        assert.equal(parsed.mode, 'full');
        assert.equal(parsed.tileW, size.tileW);
        assert.equal(parsed.tileH, size.tileH);
      }
    }
  }
});

test('square rotation labels name the mask a tile becomes', () => {
  assert.equal(squareTurnLabel(1, 0), 'Corner NW');
  assert.equal(squareTurnLabel(1, 1), 'Corner NE');
  assert.equal(squareTurnLabel(3, 1), 'Edge E');
  assert.equal(squareTurnLabel(15, 3), 'Full');
});

test('a corner shape is a triangle and an empty slot has no shape', () => {
  const empty = shapePaths('square', 'pointy', 32, 32, 0, 'up', false);
  assert.equal(empty.paths.length, 0);
  const corner = shapePaths('square', 'pointy', 32, 32, 1, 'up', false);
  assert.equal(corner.paths.length, 1);
  const full = shapePaths('square', 'pointy', 32, 32, 15, 'up', false);
  assert.equal(full.paths.length, 1);
  assert.equal(full.corners.length, 4);
});

test('flood fill replaces a connected color and stops at a different pixel', () => {
  const width = 4;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = 255;
  }
  data[4] = 255;
  data[5] = 0;
  data[6] = 0;
  const filled = floodFill(data, width, height, 0, 0, [0, 0, 255, 255]);
  assert.equal(filled, true);
  assert.equal(data[2], 255);
  assert.equal(data[4], 255);
  assert.equal(data[5], 0);
  assert.equal(floodFill(data, width, height, 0, 0, [0, 0, 255, 255]), false);
  assert.equal(floodFill(data, width, height, -1, 0, [0, 0, 0, 255]), false);
});
