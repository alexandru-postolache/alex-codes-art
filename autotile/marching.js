/** Corner-bit marching squares for square, triangle, and hex cells. */

export function maskFromFlags(flags) {
  let mask = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) mask |= 1 << i;
  }
  return mask;
}

export function flagsFromMask(mask, count) {
  const flags = new Array(count);
  for (let i = 0; i < count; i++) flags[i] = (mask & (1 << i)) !== 0;
  return flags;
}

export function cornerCount(type) {
  if (type === 'triangle') return 3;
  if (type === 'hex') return 6;
  return 4;
}

/** Move each set corner clockwise by `turns` steps. */
export function rotateMask(mask, turns, bits = 4) {
  const k = ((turns % bits) + bits) % bits;
  let out = 0;
  for (let i = 0; i < bits; i++) {
    if ((mask & (1 << i)) !== 0) out |= 1 << ((i + k) % bits);
  }
  return out;
}

const placementCache = new Map();

/**
 * One sheet per cell type. Each entry is the lowest mask in its rotation
 * and reflection orbit. The painter turns and mirrors these to cover every mask.
 * Square: empty, corner, edge, opposite corners, three corners, full.
 * Triangle: empty, one corner, two corners, full. Down cells flip the up tile.
 * Hex: the 13 dihedral orbits of a 6-bit mask.
 */
export function tileMasks(type) {
  return placements(type, 'pointy').masks;
}

/** Square sheet order. Same masks as tileMasks('square'). */
export const SQUARE_TILES = [0, 1, 3, 5, 7, 15];

/** Which canonical tile and transform draw this mask. */
export function tilePlacement(type, mask, variant = 'up', orientation = 'pointy') {
  const table = placements(type, orientation).table;
  const key = type === 'triangle' && variant === 'down' ? mask + (1 << 3) : mask;
  return table[key] || { index: 0, turns: 0, reflect: false, flipY: false };
}

/** Which of the six square tiles to draw, and how many clockwise quarter-turns to apply. */
export function squarePlacement(mask) {
  const place = tilePlacement('square', mask, 'up', 'pointy');
  return { index: place.index, turns: place.turns };
}

/**
 * Sheet layout for an uploaded tileset. One row, the same tiles the editor saves.
 * Square 6×1, triangle 4×1, hex 13×1.
 */
export function sheetLayout(type) {
  const count = tileMasks(type).length;
  return { cols: count, rows: 1, count, masks: count };
}

export function layoutHelp(type) {
  if (type === 'triangle') {
    return 'Use one row of 4 up triangles: empty, one corner, two corners, full. They rotate by 120°. Down triangles flip that row.';
  }
  if (type === 'hex') {
    return 'Use one row of 13 hex tiles. Rotation and reflection cover all 64 masks. Bit 0 is the top corner (pointy) or the right corner (flat), then clockwise.';
  }
  return 'Use one row of 6 square tiles: empty, corner, edge, opposite corners, three corners, full. Rotation and reflection cover all 16 masks.';
}

export function templateTileSize(type, orientation) {
  if (type === 'square') return { tileW: 128, tileH: 128 };
  if (type === 'triangle') {
    const edge = 128;
    return { tileW: edge, tileH: Math.round((edge * Math.sqrt(3)) / 2) };
  }
  const radius = 64;
  if (orientation === 'flat') {
    return { tileW: radius * 2, tileH: Math.round(Math.sqrt(3) * radius) };
  }
  return { tileW: Math.round(Math.sqrt(3) * radius), tileH: radius * 2 };
}

export function expectedTileAspect(type, orientation) {
  const size = templateTileSize(type, orientation);
  return size.tileH / size.tileW;
}

/**
 * Corners in tile-local space, same bit order as the live grid.
 * variant is 'up' or 'down' for triangles.
 */
export function canonicalCorners(type, orientation, w, h, variant = 'up') {
  if (type === 'triangle') {
    if (variant === 'down') {
      return [
        { x: w / 2, y: h },
        { x: w, y: 0 },
        { x: 0, y: 0 },
      ];
    }
    return [
      { x: w / 2, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  }
  if (type === 'hex') {
    const pointy = orientation !== 'flat';
    const size = pointy
      ? Math.min(h / 2, w / Math.sqrt(3))
      : Math.min(w / 2, h / Math.sqrt(3));
    const start = pointy ? -Math.PI / 2 : 0;
    const cx = w / 2;
    const cy = h / 2;
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angle = start + (i * Math.PI) / 3;
      corners.push({
        x: cx + size * Math.cos(angle),
        y: cy + size * Math.sin(angle),
      });
    }
    return corners;
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

function divides(total, parts) {
  return parts > 0 && total % parts === 0 && total / parts >= 2;
}

function aspectClose(actual, expected) {
  return Math.abs(actual - expected) / expected <= 0.3;
}

/**
 * Read a tileset image size into a sprite grid.
 * Returns null when the image does not match this cell type.
 */
export function parseSheet(type, width, height, orientation = 'pointy') {
  const layout = sheetLayout(type);
  const expected = expectedTileAspect(type, orientation);
  if (!divides(width, layout.cols) || !divides(height, layout.rows)) return null;
  const tileW = width / layout.cols;
  const tileH = height / layout.rows;
  if (!aspectClose(tileH / tileW, expected)) return null;
  return { ...layout, tileW, tileH, mode: 'full' };
}

export function spriteCell(parsed, type, mask, variant, orientation = 'pointy') {
  const place = tilePlacement(type, mask, variant, orientation);
  return {
    col: place.index % parsed.cols,
    row: Math.floor(place.index / parsed.cols),
    flipY: place.flipY,
    reflect: place.reflect,
    turns: place.turns,
  };
}

/**
 * Where to draw a tile image so its corners land on the cell.
 * The anchor is the source art's centroid. Triangle art is stored pointing up;
 * a down cell flips it around that centroid.
 */
export function spriteDraw(cell, loc) {
  const n = cell.corners.length;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += cell.corners[i].x;
    cy += cell.corners[i].y;
  }
  const box = cell.bbox;
  const anchorY = cell.type === 'triangle' ? (box.h * 2) / 3 : box.h / 2;
  return {
    cx: cx / n,
    cy: cy / n,
    angle: (loc.turns * 2 * Math.PI) / n,
    reflect: !!loc.reflect,
    flipY: !!loc.flipY,
    x: -box.w / 2,
    y: -anchorY,
    w: box.w,
    h: box.h,
  };
}

export function drawSpriteImage(ctx, image, sx, sy, sw, sh, cell, loc) {
  const draw = spriteDraw(cell, loc);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cell.corners[0].x, cell.corners[0].y);
  for (let i = 1; i < cell.corners.length; i++) ctx.lineTo(cell.corners[i].x, cell.corners[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.translate(draw.cx, draw.cy);
  if (draw.angle) ctx.rotate(draw.angle);
  if (draw.reflect) ctx.scale(-1, 1);
  if (draw.flipY) ctx.scale(1, -1);
  ctx.drawImage(image, sx, sy, sw, sh, draw.x, draw.y, draw.w, draw.h);
  ctx.restore();
}

function sampleBox(type, orientation) {
  if (type === 'triangle') return { w: 2, h: Math.sqrt(3) };
  if (type === 'hex') {
    return orientation === 'flat' ? { w: 2, h: Math.sqrt(3) } : { w: Math.sqrt(3), h: 2 };
  }
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

function mapPoint(point, fromCenter, toCenter, reflect, flipY, turns, bits) {
  let x = point.x - fromCenter.x;
  let y = point.y - fromCenter.y;
  if (flipY) y = -y;
  if (reflect) x = -x;
  const theta = (turns * 2 * Math.PI) / bits;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: toCenter.x + x * cos - y * sin,
    y: toCenter.y + x * sin + y * cos,
  };
}

function cornerPermutation(type, orientation, transform) {
  const box = sampleBox(type, orientation);
  const variant = transform.flipY ? 'down' : 'up';
  const source = canonicalCorners(type, orientation, box.w, box.h, 'up');
  const target = canonicalCorners(type, orientation, box.w, box.h, variant);
  const from = centroid(source);
  const to = centroid(target);
  const bits = source.length;
  const perm = new Array(bits);
  const used = new Array(bits).fill(false);
  for (let i = 0; i < bits; i++) {
    const moved = mapPoint(source[i], from, to, transform.reflect, transform.flipY, transform.turns, bits);
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < bits; j++) {
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

function placements(type, orientation) {
  const key = `${type}:${type === 'hex' ? orientation : 'pointy'}`;
  const cached = placementCache.get(key);
  if (cached) return cached;

  const bits = cornerCount(type);
  const orient = type === 'hex' ? orientation : 'pointy';
  const transforms = [];
  for (const flipY of type === 'triangle' ? [false, true] : [false]) {
    for (const reflect of [false, true]) {
      for (let turns = 0; turns < bits; turns++) transforms.push({ flipY, reflect, turns });
    }
  }
  const perms = transforms.map((transform) => ({
    transform,
    perm: cornerPermutation(type, orient, transform),
  })).filter((entry) => entry.perm);

  const total = 1 << bits;
  const seen = new Array(total).fill(false);
  const masks = [];
  for (let mask = 0; mask < total; mask++) {
    if (seen[mask]) continue;
    let best = mask;
    const stack = [mask];
    seen[mask] = true;
    while (stack.length) {
      const current = stack.pop();
      if (current < best) best = current;
      for (let i = 0; i < perms.length; i++) {
        if (perms[i].transform.flipY) continue;
        const next = applyPerm(current, perms[i].perm);
        if (!seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
    masks.push(best);
  }
  masks.sort((a, b) => a - b);

  const variants = type === 'triangle' ? ['up', 'down'] : ['up'];
  const table = new Array(type === 'triangle' ? total * 2 : total);
  for (let v = 0; v < variants.length; v++) {
    const flipY = variants[v] === 'down';
    for (let index = 0; index < masks.length; index++) {
      for (let i = 0; i < perms.length; i++) {
        const transform = perms[i].transform;
        if (transform.flipY !== flipY) continue;
        const produced = applyPerm(masks[index], perms[i].perm);
        const slot = flipY ? produced + total : produced;
        if (table[slot]) continue;
        table[slot] = {
          index,
          turns: transform.turns,
          reflect: transform.reflect,
          flipY,
        };
      }
    }
  }

  const value = { masks, table };
  placementCache.set(key, value);
  return value;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Filled region for one cell. Corners are in clockwise screen order.
 * Opposite corners stay disconnected, which is the usual marching-squares saddle.
 * An all-on cell returns the cell polygon itself.
 */
export function solidPolygons(points, flags) {
  const n = points.length;
  if (n === 0 || flags.length !== n) return [];
  let on = 0;
  for (let i = 0; i < n; i++) if (flags[i]) on += 1;
  if (on === 0) return [];
  if (on === n) return [points.map((pt) => ({ x: pt.x, y: pt.y }))];

  const polys = [];
  const seen = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    if (!flags[i] || flags[prev]) continue;
    const poly = [midpoint(points[prev], points[i])];
    let k = i;
    while (flags[k] && !seen[k]) {
      seen[k] = true;
      poly.push({ x: points[k].x, y: points[k].y });
      const next = (k + 1) % n;
      if (!flags[next]) {
        poly.push(midpoint(points[k], points[next]));
        break;
      }
      k = next;
    }
    polys.push(poly);
  }
  return polys;
}

/**
 * Closed drawing commands for each solid region.
 * Rounded corners replace every vertex with a quadratic curve.
 */
export function terrainPaths(points, flags, rounded) {
  const polys = solidPolygons(points, flags);
  const paths = [];
  for (let i = 0; i < polys.length; i++) {
    paths.push(rounded ? roundPolygon(polys[i]) : linearPath(polys[i]));
  }
  return paths;
}

function linearPath(poly) {
  const commands = [];
  for (let i = 0; i < poly.length; i++) {
    commands.push({ op: i === 0 ? 'M' : 'L', x: poly[i].x, y: poly[i].y });
  }
  return commands;
}

function roundPolygon(poly) {
  const n = poly.length;
  if (n < 3) return linearPath(poly);
  const commands = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    if (inLen < 1e-6 || outLen < 1e-6) {
      commands.push({ op: commands.length === 0 ? 'M' : 'L', x: curr.x, y: curr.y });
      continue;
    }
    const cut = Math.min(inLen, outLen) * 0.5;
    const ax = curr.x - ((curr.x - prev.x) / inLen) * cut;
    const ay = curr.y - ((curr.y - prev.y) / inLen) * cut;
    const bx = curr.x + ((next.x - curr.x) / outLen) * cut;
    const by = curr.y + ((next.y - curr.y) / outLen) * cut;
    commands.push({ op: commands.length === 0 ? 'M' : 'L', x: ax, y: ay });
    commands.push({ op: 'Q', cx: curr.x, cy: curr.y, x: bx, y: by });
  }
  return commands;
}

function pointKey(p) {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

/**
 * Outline of the union of several tile polygons.
 * An edge drawn by two tiles is internal and dropped, so only the border
 * between terrain and empty space remains. `rounded` curves that contour.
 */
export function externalContours(polygons, rounded) {
  const tally = new Map();
  const stored = new Map();
  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) continue;
      const ka = pointKey(a);
      const kb = pointKey(b);
      const undirected = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      tally.set(undirected, (tally.get(undirected) || 0) + 1);
      if (!stored.has(undirected)) stored.set(undirected, [a, b]);
    }
  }

  const segments = [];
  for (const [key, count] of tally) {
    if (count === 1) segments.push(stored.get(key));
  }

  const loops = chainLoops(segments);
  const paths = [];
  for (let i = 0; i < loops.length; i++) {
    paths.push(rounded ? roundPolygon(loops[i]) : linearPath(loops[i]));
  }
  return paths;
}

function chainLoops(segments) {
  const unused = segments.map((pair) => ({ a: pair[0], b: pair[1], used: false }));
  const at = new Map();
  for (let i = 0; i < unused.length; i++) {
    const seg = unused[i];
    for (const point of [seg.a, seg.b]) {
      const key = pointKey(point);
      if (!at.has(key)) at.set(key, []);
      at.get(key).push(seg);
    }
  }

  const loops = [];
  for (let i = 0; i < unused.length; i++) {
    const start = unused[i];
    if (start.used) continue;
    start.used = true;
    const loop = [start.a];
    let curr = start.b;
    let guard = 0;
    while (guard++ <= unused.length) {
      if (pointKey(curr) === pointKey(start.a)) break;
      loop.push(curr);
      const next = (at.get(pointKey(curr)) || []).find((seg) => !seg.used);
      if (!next) break;
      next.used = true;
      curr = pointKey(next.a) === pointKey(curr) ? next.b : next.a;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
