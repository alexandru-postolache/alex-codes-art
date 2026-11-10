/** Autotile rules: marching squares, blob neighbors, and on/off blocks. */

import { normalizeBlob } from './blob.js';
import {
  canonicalCorners,
  layoutHelp as squaresHelp,
  parseSheet as parseSquares,
  sheetLayout as squaresLayout,
  templateTileSize,
  tileMasks as squaresMasks,
  tilePlacement as squaresPlacement,
} from './marching.js';

export const METHODS = ['squares', 'blob', 'block'];

const placementCache = new Map();

export function blockSteps(type) {
  if (type === 'hex') return 6;
  if (type === 'triangle') return 3;
  return 4;
}

export function blockTurn(type, turns) {
  const steps = blockSteps(type);
  return ((turns % steps) + steps) % steps;
}

export function methodLabel(method) {
  if (method === 'blob') return 'Blob';
  if (method === 'block') return 'Block';
  return 'Marching squares';
}

export function sheetLayout(type, method = 'squares') {
  if (method === 'squares') return squaresLayout(type);
  const count = tileMasks(type, method).length;
  return { cols: count, rows: 1, count, masks: count };
}

export function tileMasks(type, method = 'squares') {
  if (method === 'squares') return squaresMasks(type);
  if (method === 'block') return [0, 1];
  return blobTable(type, 'pointy').masks;
}

export function tilePlacement(type, mask, variant = 'up', orientation = 'pointy', method = 'squares') {
  if (method === 'squares') return squaresPlacement(type, mask, variant, orientation);
  if (method === 'block') {
    return { index: mask ? 1 : 0, turns: 0, reflect: false, flipY: type === 'triangle' && variant === 'down' };
  }
  const table = blobTable(type, orientation);
  const side = variant === 'down' ? 'down' : 'up';
  return table.byMask.get(`${side}:${mask}`) || { index: 0, turns: 0, reflect: false, flipY: false };
}

export function layoutHelp(type, method = 'squares') {
  if (method === 'squares') return squaresHelp(type);
  if (method === 'block') {
    return 'Use one row of 2 tiles: off, then on. Turn sets how the on tile is rotated when you paint. Down triangles also flip.';
  }
  const count = tileMasks(type, 'blob').length;
  if (type === 'square') {
    return `Use one row of ${count} blob tiles. They rotate and reflect to cover all 47 neighbor patterns. Edges run N, E, S, W, and a diagonal counts only when both edges beside it are filled.`;
  }
  if (type === 'triangle') {
    return `Use one row of ${count} blob tiles. Bit 0 is the first edge clockwise from the apex. Down triangles flip the row.`;
  }
  return `Use one row of ${count} blob tiles. Bit 0 is the first edge clockwise from the top (pointy) or the right (flat). Rotation and reflection cover all 64 neighbor patterns.`;
}

export function parseSheet(type, width, height, orientation = 'pointy', method = 'squares') {
  if (method === 'squares') return parseSquares(type, width, height, orientation);
  const layout = sheetLayout(type, method);
  const size = templateTileSize(type, orientation);
  const expected = size.tileH / size.tileW;
  if (layout.cols <= 0 || width % layout.cols !== 0 || height % layout.rows !== 0) return null;
  const tileW = width / layout.cols;
  const tileH = height / layout.rows;
  if (tileW < 2 || tileH < 2) return null;
  if (Math.abs(tileH / tileW - expected) / expected > 0.3) return null;
  return { ...layout, tileW, tileH, mode: 'full' };
}

/** Masks the editor previews, including triangle flips. */
export function placementMasks(type, method = 'squares') {
  if (method === 'block') return [0, 1];
  if (method === 'squares') {
    const bits = type === 'triangle' ? 3 : type === 'hex' ? 6 : 4;
    const masks = [];
    for (let mask = 0; mask < (1 << bits); mask++) masks.push(mask);
    return masks;
  }
  if (type === 'square') return normalizedSquareMasks();
  const bits = type === 'triangle' ? 3 : 6;
  const masks = [];
  for (let mask = 0; mask < (1 << bits); mask++) masks.push(mask);
  return masks;
}

export function placementVariants(type) {
  return type === 'triangle' ? ['up', 'down'] : ['up'];
}

export function slotInfo(type, method, mask) {
  if (method === 'block') {
    return mask
      ? { name: 'On', hint: 'The filled cell. Down triangles flip this tile.' }
      : { name: 'Off', hint: 'The empty cell. Paint here if an empty cell should still show a sprite.' };
  }
  const name = blobName(type, mask);
  const hint = type === 'square'
    ? 'Neighbor bits are N, NE, E, SE, S, SW, W, NW. Rotation and reflection cover the matching blobs.'
    : 'Bit 0 is the first edge, then clockwise. Rotation and reflection cover the matching blobs.';
  return { name, hint };
}

function normalizedSquareMasks() {
  const found = [];
  const seen = new Set();
  for (let mask = 0; mask < 256; mask++) {
    const normal = normalizeBlob(mask);
    if (seen.has(normal)) continue;
    seen.add(normal);
    found.push(normal);
  }
  found.sort((a, b) => a - b);
  return found;
}

function samplePoints(type, orientation, variant) {
  const box = sampleBox(type);
  const corners = canonicalCorners(type, orientation, box.w, box.h, variant);
  if (type === 'square') {
    const points = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      points.push(corners[(i + 1) % 4]);
    }
    return points;
  }
  const points = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return points;
}

function sampleBox(type) {
  if (type === 'triangle') return { w: 2, h: Math.sqrt(3) };
  if (type === 'hex') return { w: Math.sqrt(3), h: 2 };
  return { w: 2, h: 2 };
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

function mapPoint(point, from, to, reflect, flipY, turns, steps) {
  let x = point.x - from.x;
  let y = point.y - from.y;
  if (flipY) y = -y;
  if (reflect) x = -x;
  const theta = (turns * 2 * Math.PI) / steps;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: to.x + x * cos - y * sin,
    y: to.y + x * sin + y * cos,
  };
}

function permutation(type, orientation, transform) {
  const steps = type === 'hex' ? 6 : type === 'triangle' ? 3 : 4;
  const variant = transform.flipY ? 'down' : 'up';
  const orient = type === 'hex' ? orientation : type === 'square' ? 'pointy' : 'pointy';
  const source = samplePoints(type, orient, 'up');
  const target = samplePoints(type, type === 'hex' ? orientation : orient, variant);
  const from = centroid(source);
  const to = centroid(target);
  const perm = new Array(source.length);
  const used = new Array(target.length).fill(false);
  for (let i = 0; i < source.length; i++) {
    const moved = mapPoint(source[i], from, to, transform.reflect, transform.flipY, transform.turns, steps);
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < target.length; j++) {
      const d = (moved.x - target[j].x) ** 2 + (moved.y - target[j].y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best < 0 || bestD > 1e-6 || used[best]) return null;
    used[best] = true;
    perm[i] = best;
  }
  return perm;
}

function applyPerm(mask, perm) {
  let out = 0;
  for (let i = 0; i < perm.length; i++) {
    if ((mask & (1 << i)) !== 0) out |= 1 << perm[i];
  }
  return out;
}

function blobTable(type, orientation) {
  const key = `${type}:${type === 'hex' ? orientation : 'any'}`;
  const cached = placementCache.get(key);
  if (cached) return cached;

  const steps = type === 'hex' ? 6 : type === 'triangle' ? 3 : 4;
  const orient = type === 'hex' ? orientation : 'pointy';
  const transforms = [];
  for (const flipY of type === 'triangle' ? [false, true] : [false]) {
    for (const reflect of [false, true]) {
      for (let turns = 0; turns < steps; turns++) transforms.push({ flipY, reflect, turns });
    }
  }
  const perms = [];
  for (let i = 0; i < transforms.length; i++) {
    const perm = permutation(type, orient, transforms[i]);
    if (perm) perms.push({ transform: transforms[i], perm });
  }

  const domain = type === 'square' ? normalizedSquareMasks() : placementMasks(type, 'blob');
  const seen = new Set();
  const masks = [];
  for (let d = 0; d < domain.length; d++) {
    const mask = domain[d];
    if (seen.has(mask)) continue;
    let best = mask;
    const stack = [mask];
    seen.add(mask);
    while (stack.length) {
      const current = stack.pop();
      if (current < best) best = current;
      for (let i = 0; i < perms.length; i++) {
        if (perms[i].transform.flipY) continue;
        let next = applyPerm(current, perms[i].perm);
        if (type === 'square') next = normalizeBlob(next);
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    masks.push(best);
  }
  masks.sort((a, b) => a - b);

  const byMask = new Map();
  const variants = placementVariants(type);
  for (let v = 0; v < variants.length; v++) {
    const flipY = variants[v] === 'down';
    for (let index = 0; index < masks.length; index++) {
      for (let i = 0; i < perms.length; i++) {
        if (perms[i].transform.flipY !== flipY) continue;
        let produced = applyPerm(masks[index], perms[i].perm);
        if (type === 'square') produced = normalizeBlob(produced);
        const slot = `${variants[v]}:${produced}`;
        if (byMask.has(slot)) continue;
        byMask.set(slot, {
          index,
          turns: perms[i].transform.turns,
          reflect: perms[i].transform.reflect,
          flipY,
        });
      }
    }
  }

  const value = { masks, byMask };
  placementCache.set(key, value);
  return value;
}

function rotateBits(mask, bits) {
  let out = 0;
  for (let i = 0; i < bits; i++) {
    if ((mask & (1 << i)) !== 0) out |= 1 << ((i + 1) % bits);
  }
  return out;
}

function minRotation(mask, bits) {
  let best = mask;
  let current = mask;
  for (let i = 0; i < bits; i++) {
    if (current < best) best = current;
    current = rotateBits(current, bits);
  }
  return best;
}

function blobName(type, mask) {
  if (type === 'square') return squareBlobName(mask);
  if (type === 'triangle') {
    const count = popcount(mask);
    if (count === 0) return 'Island';
    if (count === 1) return 'End';
    if (count === 2) return 'Elbow';
    return 'Surrounded';
  }
  const bits = 6;
  const count = popcount(mask);
  if (count === 0) return 'Island';
  if (count === bits) return 'Surrounded';
  if (count === 1) return 'End';
  if (count === bits - 1) return 'Notch';
  const canonical = minRotation(mask, bits);
  if (canonical === 3) return 'Elbow';
  if (canonical === 5) return 'Skip';
  if (canonical === 9) return 'Opposite';
  if (canonical === 7) return 'Run';
  if (canonical === 11) return 'Spur';
  if (canonical === 21) return 'Alternate';
  if (canonical === 15) return 'Wide';
  if (canonical === 23) return 'Branch';
  if (canonical === 27) return 'Bridge';
  return `Blob ${mask}`;
}

function squareBlobName(mask) {
  const edges = ((mask & 1) ? 1 : 0) | ((mask & 4) ? 2 : 0) | ((mask & 16) ? 4 : 0) | ((mask & 64) ? 8 : 0);
  const edge = minRotation(edges, 4);
  const base = { 0: 'Island', 1: 'End', 3: 'Elbow', 5: 'Bar', 7: 'Tee', 15: 'Cross' }[edge] || 'Blob';
  const diagBits = ((mask & 2) ? 1 : 0) | ((mask & 8) ? 2 : 0) | ((mask & 32) ? 4 : 0) | ((mask & 128) ? 8 : 0);
  const diags = popcount(diagBits);
  const possible = { 0: 0, 1: 0, 3: 1, 5: 0, 7: 2, 15: 4 }[edge] ?? 0;
  if (diags === 0 || possible === 0) return base;
  if (diags === possible) return `${base} full`;
  if (minRotation(diagBits, 4) === 5) return `${base} split`;
  return `${base} ${diags}`;
}

function popcount(mask) {
  let n = 0;
  while (mask) {
    n += mask & 1;
    mask >>= 1;
  }
  return n;
}
