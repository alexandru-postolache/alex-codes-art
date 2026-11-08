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

/**
 * Square sheet, left to right. Each later mask is this tile turned clockwise by 90°.
 * 0 empty, 1 top-left corner, 3 top edge, 5 opposite corners, 7 three corners, 15 full.
 */
export const SQUARE_TILES = [0, 1, 3, 5, 7, 15];

/** Move each set corner clockwise by `turns` steps. */
export function rotateMask(mask, turns, bits = 4) {
  const k = ((turns % bits) + bits) % bits;
  let out = 0;
  for (let i = 0; i < bits; i++) {
    if ((mask & (1 << i)) !== 0) out |= 1 << ((i + k) % bits);
  }
  return out;
}

/** Which of the six square tiles to draw, and how many clockwise quarter-turns to apply. */
export function squarePlacement(mask) {
  for (let index = 0; index < SQUARE_TILES.length; index++) {
    for (let turns = 0; turns < 4; turns++) {
      if (rotateMask(SQUARE_TILES[index], turns) === mask) return { index, turns };
    }
  }
  return { index: 0, turns: 0 };
}

/**
 * Sheet layout for an uploaded tileset.
 * Square: 6×1. The painter rotates these six tiles to cover all 16 corner masks.
 * Triangle: 8×2, row 0 points up, row 1 points down. Bit 0 is the apex, then clockwise.
 * Hex: 8×8. Bit 0 is the top corner (pointy) or the right corner (flat), then clockwise.
 */
export function sheetLayout(type) {
  if (type === 'triangle') return { cols: 8, rows: 2, count: 16, masks: 8 };
  if (type === 'hex') return { cols: 8, rows: 8, count: 64, masks: 64 };
  return { cols: 6, rows: 1, count: 6, masks: 6 };
}

export function layoutHelp(type) {
  if (type === 'triangle') {
    return 'Use an 8×2 sheet (up triangles, then down) or a single row of 8 up triangles. Bit 0 is the apex, then clockwise.';
  }
  if (type === 'hex') {
    return 'Use an 8×8 sheet, 64 tiles. Bit 0 is the top corner (pointy) or the right corner (flat), then clockwise.';
  }
  return 'Use one row of 6 square tiles. They rotate by 90°: empty, top-left corner, top edge, opposite corners, three corners, full.';
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
  const fullFits = divides(width, layout.cols) && divides(height, layout.rows);
  const fullW = fullFits ? width / layout.cols : 0;
  const fullH = fullFits ? height / layout.rows : 0;
  const fullAspect = fullFits ? fullH / fullW : 0;
  const fullClose = fullFits && aspectClose(fullAspect, expected);

  if (type === 'triangle') {
    const stripFits = divides(width, 8) && height >= 2;
    const stripW = stripFits ? width / 8 : 0;
    const stripAspect = stripFits ? height / stripW : 0;
    const stripClose = stripFits && aspectClose(stripAspect, expected);
    if (fullClose && (!stripClose || Math.abs(fullAspect - expected) <= Math.abs(stripAspect - expected))) {
      return { ...layout, tileW: fullW, tileH: fullH, mode: 'full' };
    }
    if (stripClose) {
      return {
        cols: 8,
        rows: 1,
        count: 8,
        masks: 8,
        tileW: stripW,
        tileH: height,
        mode: 'flip-down',
      };
    }
  }

  if (fullClose) {
    return { ...layout, tileW: fullW, tileH: fullH, mode: 'full' };
  }

  const masks = layout.masks;
  if (divides(width, masks) && height >= 2) {
    const tileW = width / masks;
    const tileAspect = height / tileW;
    if (aspectClose(tileAspect, expected)) {
      return {
        cols: masks,
        rows: 1,
        count: masks,
        masks,
        tileW,
        tileH: height,
        mode: 'strip',
      };
    }
  }

  return null;
}

export function spriteCell(parsed, type, mask, variant) {
  if (type === 'triangle' && parsed.mode === 'flip-down') {
    return { col: mask, row: 0, flipY: variant === 'down', turns: 0 };
  }
  if (type === 'triangle') {
    return { col: mask, row: variant === 'down' ? 1 : 0, flipY: false, turns: 0 };
  }
  if (type === 'square') {
    const place = squarePlacement(mask);
    return {
      col: place.index % parsed.cols,
      row: Math.floor(place.index / parsed.cols),
      flipY: false,
      turns: place.turns,
    };
  }
  return {
    col: mask % parsed.cols,
    row: Math.floor(mask / parsed.cols),
    flipY: false,
    turns: 0,
  };
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
