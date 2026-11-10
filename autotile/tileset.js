/** Slot layout, pixel size, and drawing helpers for the tileset editor. */

import {
  canonicalCorners,
  cornerCount,
  flagsFromMask,
  rotateMask,
  sheetLayout,
  SQUARE_TILES,
  templateTileSize,
  terrainPaths,
} from './marching.js';

const SQUARE_NAMES = ['Empty', 'Corner', 'Edge', 'Opposite', 'Three', 'Full'];

const SQUARE_HINTS = [
  'No corners. Turning this tile does not change it.',
  'Top-left corner. The other three corners are this tile turned by 90°.',
  'Top edge. The other three edges are this tile turned by 90°.',
  'Top-left and bottom-right. A quarter turn makes the other diagonal.',
  'Every corner except the bottom-left. Turning it covers the other three-corner tiles.',
  'The whole cell. Turning this tile does not change it.',
];

export const SQUARE_MASK_LABELS = {
  0: 'Empty',
  1: 'Corner NW',
  2: 'Corner NE',
  3: 'Edge N',
  4: 'Corner SE',
  5: 'Opposite',
  6: 'Edge E',
  7: 'Three, open SW',
  8: 'Corner SW',
  9: 'Edge W',
  10: 'Opposite',
  11: 'Three, open SE',
  12: 'Edge S',
  13: 'Three, open NE',
  14: 'Three, open NW',
  15: 'Full',
};

export const EDITOR_PRESETS = [16, 32, 64, 128];

/** One editable cell for the current grid, in sheet order. */
export function tileSlots(type) {
  const layout = sheetLayout(type);
  const slots = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const index = slots.length;
      if (type === 'square') {
        slots.push({
          index,
          col,
          row,
          mask: SQUARE_TILES[index],
          variant: 'up',
          name: SQUARE_NAMES[index],
          hint: SQUARE_HINTS[index],
        });
      } else if (type === 'triangle') {
        const down = row === 1;
        slots.push({
          index,
          col,
          row,
          mask: col,
          variant: down ? 'down' : 'up',
          name: `${down ? 'Down' : 'Up'} ${col}`,
          hint: down
            ? `Down triangle, mask ${col}. Bit 0 is the bottom apex, then clockwise.`
            : `Up triangle, mask ${col}. Bit 0 is the top apex, then clockwise.`,
        });
      } else {
        slots.push({
          index,
          col,
          row,
          mask: index,
          variant: 'up',
          name: String(index),
          hint: 'Hex mask ' + index + '. Bit 0 is the top corner on a pointy grid, or the right corner on a flat grid, then clockwise.',
        });
      }
    }
  }
  return slots;
}

/**
 * Tile pixel size for a preset. The shorter side is `px`, and the aspect
 * matches the template the painter accepts.
 */
export function editorTileSize(type, orientation, px) {
  const base = templateTileSize(type, orientation);
  const minor = Math.min(base.tileW, base.tileH);
  const scale = px / minor;
  return {
    tileW: Math.max(2, Math.round(base.tileW * scale)),
    tileH: Math.max(2, Math.round(base.tileH * scale)),
  };
}

export function squareTurnLabel(mask, turns) {
  return SQUARE_MASK_LABELS[rotateMask(mask, turns, 4)] || String(mask);
}

/** Closed paths for the one-color autotile shape of a single slot. */
export function shapePaths(type, orientation, w, h, mask, variant, rounded) {
  const corners = canonicalCorners(type, orientation, w, h, variant);
  const flags = flagsFromMask(mask, cornerCount(type));
  return {
    corners,
    paths: terrainPaths(corners, flags, rounded),
  };
}

export function paintShape(ctx, type, orientation, w, h, mask, variant, style) {
  const { corners, paths } = shapePaths(type, orientation, w, h, mask, variant, style.rounded);
  if (!paths.length) return;
  const scratch = ctx.canvas.ownerDocument.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const pen = scratch.getContext('2d');
  pen.beginPath();
  pen.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) pen.lineTo(corners[i].x, corners[i].y);
  pen.closePath();
  pen.clip();
  pen.fillStyle = style.color;
  pen.strokeStyle = style.color;
  pen.lineJoin = 'round';
  pen.lineCap = 'round';
  pen.lineWidth = outlineWidth(corners);
  for (let i = 0; i < paths.length; i++) {
    traceCommands(pen, paths[i]);
    if (style.filled) pen.fill();
    else pen.stroke();
  }
  const image = pen.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 128 ? 0 : 255;
  pen.putImageData(image, 0, 0);
  ctx.save();
  if (style.composite) ctx.globalCompositeOperation = style.composite;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

function outlineWidth(corners) {
  let min = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return Math.max(1.5, min * 0.07);
}

function traceCommands(ctx, commands) {
  ctx.beginPath();
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.op === 'M') ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.op === 'L') ctx.lineTo(cmd.x, cmd.y);
    else ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
  }
  ctx.closePath();
}

/**
 * Replace the connected region at (x, y) with `color` ([r, g, b, a]).
 * Matching is exact. Returns false when the pixel is already that color.
 */
export function floodFill(data, width, height, x, y, color) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const start = (y * width + x) * 4;
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  const ta = data[start + 3];
  const r = color[0];
  const g = color[1];
  const b = color[2];
  const a = color[3];
  if (tr === r && tg === g && tb === b && ta === a) return false;

  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop();
    const cx = stack.pop();
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const i = (cy * width + cx) * 4;
    if (data[i] !== tr || data[i + 1] !== tg || data[i + 2] !== tb || data[i + 3] !== ta) continue;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
    stack.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1);
  }
  return true;
}
