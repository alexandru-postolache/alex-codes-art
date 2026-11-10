/** Blob and block silhouettes. A blob cell connects along edges it shares with filled neighbors. */

import { commandsForPolygon } from './marching.js';

const SQUARE_EDGE_BIT = [0, 2, 4, 6];
const SQUARE_DIAG_BIT = [7, 1, 3, 5];

function centroid(points) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    x += points[i].x;
    y += points[i].y;
  }
  return { x: x / points.length, y: y / points.length };
}

function mix(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clean(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - points[i].x, prev.y - points[i].y) < 1e-4) continue;
    out.push(points[i]);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-4) out.pop();
  }
  return out;
}

/**
 * Square blob. Bits alternate edge, diagonal, clockwise from the top:
 * N, NE, E, SE, S, SW, W, NW. A diagonal only changes the corner when both
 * edges beside it are filled.
 */
export function squareBlobPoints(corners, mask) {
  const center = centroid(corners);
  const inset = 0.3;
  const points = [];
  for (let k = 0; k < 4; k++) {
    const prev = (k + 3) % 4;
    const next = (k + 1) % 4;
    const inOn = (mask & (1 << SQUARE_EDGE_BIT[prev])) !== 0;
    const outOn = (mask & (1 << SQUARE_EDGE_BIT[k])) !== 0;
    const diag = inOn && outOn && (mask & (1 << SQUARE_DIAG_BIT[k])) !== 0;
    const pk = corners[k];
    if (inOn && outOn && diag) points.push(pk);
    else if (inOn && outOn) points.push(mix(pk, corners[prev], inset), mix(pk, corners[next], inset));
    else if (inOn) points.push(mix(pk, corners[prev], inset), mix(pk, center, 0.55));
    else if (outOn) points.push(mix(pk, center, 0.55), mix(pk, corners[next], inset));
    else points.push(mix(pk, center, 0.58));
  }
  return clean(points);
}

/** Hex and triangle blobs. A filled edge is drawn in full so neighbors meet. */
export function ringBlobPoints(corners, mask) {
  const center = centroid(corners);
  const points = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    if ((mask & (1 << i)) !== 0) {
      points.push(a, b);
    } else {
      points.push(mix(a, center, 0.46), mix(b, center, 0.46));
    }
  }
  return clean(points);
}

export function blobPoints(type, corners, mask) {
  if (type === 'square') return squareBlobPoints(corners, mask);
  return ringBlobPoints(corners, mask);
}

export function blockPoints(corners, mask) {
  if (!mask) return [];
  return corners.map((pt) => ({ x: pt.x, y: pt.y }));
}

export function blobCommands(type, corners, mask, rounded) {
  const points = blobPoints(type, corners, mask);
  const commands = commandsForPolygon(points, rounded);
  return commands.length ? [commands] : [];
}

export function blockCommands(corners, mask, rounded) {
  const points = blockPoints(corners, mask);
  const commands = commandsForPolygon(points, rounded);
  return commands.length ? [commands] : [];
}

/** Drop diagonal bits that sit beside an empty edge. 256 masks collapse to 47. */
export function normalizeBlob(mask) {
  const north = mask & 1;
  const east = mask & 4;
  const south = mask & 16;
  const west = mask & 64;
  let out = north | east | south | west;
  if (north && east && (mask & 2)) out |= 2;
  if (east && south && (mask & 8)) out |= 8;
  if (south && west && (mask & 32)) out |= 32;
  if (west && north && (mask & 128)) out |= 128;
  return out;
}

export function squareBlobMask(cell, isOn) {
  let mask = 0;
  for (let i = 0; i < 4; i++) {
    if (cell.edgeNeighbors[i] && isOn(cell.edgeNeighbors[i])) mask |= 1 << SQUARE_EDGE_BIT[i];
    const corner = (i + 1) % 4;
    if (cell.cornerNeighbors[corner] && isOn(cell.cornerNeighbors[corner])) mask |= 1 << (SQUARE_EDGE_BIT[i] + 1);
  }
  return normalizeBlob(mask);
}

export function ringBlobMask(cell, isOn) {
  let mask = 0;
  const edges = cell.edgeNeighbors;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] && isOn(edges[i])) mask |= 1 << i;
  }
  return mask;
}

export function blobMask(cell, isOn) {
  if (cell.type === 'square') return squareBlobMask(cell, isOn);
  return ringBlobMask(cell, isOn);
}
