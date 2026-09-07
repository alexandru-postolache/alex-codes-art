/**
 * Parametric shape grammar for procedural houses.
 * Each rule maps a labeled shape to child shapes in normalized parent space.
 */

class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }
}

class ShapeNode {
  constructor(type, params = {}, bounds = { x: 0, y: 0, w: 1, h: 1 }, depth = 0) {
    this.type = type;
    this.params = { ...params };
    this.bounds = { ...bounds };
    this.depth = depth;
    this.children = [];
    this.abs = null;
  }
}

const TERMINAL_TYPES = new Set([
  'Sky',
  'Ground',
  'Body',
  'Roof',
  'Door',
  'Window',
  'Chimney',
  'Foundation',
  'Porch',
  'Step',
  'Trim',
  'FloorLine',
  'Sill',
  'Wing',
  'Parapet',
  'Balcony',
  'Stairs',
  'Column',
  'Dome',
  'Pot',
  'Vine',
  'Terrace',
]);

function clampFloors(floors) {
  return Math.max(1, Math.min(3, floors));
}

function isGreek(style) {
  return style === 'greek';
}

function getDoorLayout(style) {
  if (isGreek(style)) {
    const doorW = 0.17;
    const doorH = 0.27;
    return { doorW, doorH, doorX: 0.5 - doorW / 2 };
  }
  const doorW = style === 'barn' ? 0.34 : style === 'modern' ? 0.14 : 0.18;
  const doorH = style === 'barn' ? 0.4 : style === 'modern' ? 0.22 : 0.24;
  const doorX = style === 'barn' ? 0.33 : 0.5 - doorW / 2;
  return { doorW, doorH, doorX };
}

function createHouseGrammar(style, floors, rng) {
  const floorCount = clampFloors(floors);

  if (isGreek(style)) {
    const variant = rng.pick(['cycladic', 'village', 'mansion']);
    return new ShapeNode('House', {
      style: 'greek',
      variant,
      floors: floorCount,
      roofStyle: 'parapet',
      palette: pickPalette('greek', rng),
      windowCols: rng.int(2, 3),
      bodyWidth: variant === 'mansion' ? rng.range(0.4, 0.52) : rng.range(0.34, 0.46),
      bodyHeight: 0.24 + (floorCount - 1) * 0.11,
      hasWing: variant !== 'cycladic' && rng.chance(0.55),
      wingSide: rng.pick(['left', 'right']),
      hasBalcony: floorCount > 1 && rng.chance(0.7),
      hasStairs: floorCount > 1 && rng.chance(0.6),
      stairSide: rng.pick(['left', 'right']),
      hasDome: rng.chance(0.38),
      hasColumns: rng.chance(0.5),
      columnCount: rng.int(2, 4),
      hasVines: rng.chance(0.55),
      potCount: rng.int(0, 3),
      hasTerrace: floorCount > 1 && rng.chance(0.45),
      shutterOpen: rng.chance(0.35),
    });
  }

  const baseHeights = { cottage: 0.26, townhouse: 0.28, modern: 0.24, barn: 0.24 };
  const perFloorHeights = { cottage: 0.12, townhouse: 0.1, modern: 0.11, barn: 0.1 };
  const base = baseHeights[style] || 0.26;
  const perFloor = perFloorHeights[style] || 0.11;

  return new ShapeNode('House', {
    style,
    floors: floorCount,
    roofStyle: style === 'modern' ? 'flat' : style === 'barn' ? 'barn' : 'gable',
    palette: pickPalette(style, rng),
    windowCols: style === 'townhouse' ? rng.int(2, 3) : 2,
    hasChimney: style !== 'modern' && rng.chance(0.55),
    hasPorch: (style === 'cottage' || style === 'barn') && rng.chance(0.45),
    bodyWidth: style === 'modern' ? rng.range(0.42, 0.58) : rng.range(0.34, 0.46),
    bodyHeight: base + (floorCount - 1) * perFloor,
  });
}

function pickPalette(style, rng) {
  const palettes = {
    greek: [
      { wall: '#f8f6f0', trim: '#dce6f2', roof: '#f4f2ec', door: '#1f4f8a', accent: '#2f67b0', stone: '#b8b0a4', plant: '#c94b7b', pot: '#b85c38', skyTop: '#4a90c8', skyBottom: '#b8dff5', ground: '#d8cfc0' },
      { wall: '#fffdf8', trim: '#e8eef5', roof: '#faf8f4', door: '#245a96', accent: '#3a74b8', stone: '#a8a098', plant: '#d65a88', pot: '#c06840', skyTop: '#5a9fd4', skyBottom: '#c8e8fa', ground: '#e0d4c4' },
      { wall: '#f5f0e8', trim: '#d0dae8', roof: '#f0ece4', door: '#183f72', accent: '#285ea0', stone: '#9c9488', plant: '#b83a6a', pot: '#a05030', skyTop: '#4588be', skyBottom: '#aad4f0', ground: '#cfc4b4' },
    ],
    cottage: [
      { wall: '#f2e6d8', trim: '#5c4a3a', roof: '#8b3a2f', door: '#4a2f1f', accent: '#c97b4a' },
      { wall: '#e8edf2', trim: '#3d4f5f', roof: '#2f4a62', door: '#243447', accent: '#7a9eb8' },
      { wall: '#f5efe6', trim: '#6b5b4f', roof: '#5a4638', door: '#3f2d22', accent: '#b8845a' },
    ],
    townhouse: [
      { wall: '#d9d2c7', trim: '#2e2e2e', roof: '#1f1f1f', door: '#1a1a1a', accent: '#8a8175' },
      { wall: '#c8d0d8', trim: '#334455', roof: '#223344', door: '#112233', accent: '#667788' },
      { wall: '#e6dccf', trim: '#4a4035', roof: '#3a3028', door: '#2a2218', accent: '#9a8870' },
    ],
    modern: [
      { wall: '#f7f7f5', trim: '#222222', roof: '#333333', door: '#111111', accent: '#c8b89a' },
      { wall: '#eceff1', trim: '#455a64', roof: '#37474f', door: '#263238', accent: '#78909c' },
      { wall: '#faf8f3', trim: '#2b2b2b', roof: '#1e1e1e', door: '#0f0f0f', accent: '#b0a090' },
    ],
    barn: [
      { wall: '#c94c3d', trim: '#5c2f22', roof: '#4a3020', door: '#3a2418', accent: '#8b5a3c' },
      { wall: '#b85c38', trim: '#4a2818', roof: '#3d2818', door: '#2a180f', accent: '#7a4a30' },
      { wall: '#d46a4a', trim: '#5a3420', roof: '#452818', door: '#301808', accent: '#9a6840' },
    ],
  };

  return rng.pick(palettes[style] || palettes.cottage);
}

function buildGreekBuilding(node, rng) {
  const p = node.params;
  const parapetH = 0.045;
  const bodyH = 1 - parapetH;
  const door = getDoorLayout('greek');
  const children = [];

  if (p.hasWing) {
    const wingW = 0.28;
    const wingH = bodyH * rng.range(0.55, 0.78);
    const wingX = p.wingSide === 'left' ? -wingW + 0.06 : 1 - 0.06;
    children.push(
      new ShapeNode(
        'Wing',
        { palette: p.palette, side: p.wingSide },
        { x: wingX, y: bodyH - wingH, w: wingW, h: wingH }
      )
    );
  }

  children.push(
    new ShapeNode(
      'Body',
      {
        palette: p.palette,
        style: 'greek',
        floors: p.floors,
        windowCols: p.windowCols,
        shutterOpen: p.shutterOpen,
      },
      { x: 0, y: parapetH, w: 1, h: bodyH }
    ),
    new ShapeNode(
      'Parapet',
      { palette: p.palette, style: p.variant },
      { x: -0.02, y: 0, w: 1.04, h: parapetH }
    ),
    new ShapeNode(
      'Foundation',
      { palette: p.palette, style: 'greek' },
      { x: -0.03, y: 1 - 0.018, w: 1.06, h: 0.022 }
    )
  );

  if (p.hasTerrace) {
    children.push(
      new ShapeNode(
        'Terrace',
        { palette: p.palette },
        { x: 0.04, y: parapetH + bodyH * 0.34, w: 0.92, h: 0.012 }
      )
    );
  }

  if (p.hasColumns) {
    const count = p.columnCount;
    const spacing = door.doorW * 1.35 / Math.max(1, count - 1);
    const startX = door.doorX + door.doorW / 2 - (spacing * (count - 1)) / 2;
    for (let i = 0; i < count; i++) {
      children.push(
        new ShapeNode(
          'Column',
          { palette: p.palette, index: i },
          { x: startX + spacing * i - 0.018, y: 1 - door.doorH - 0.02, w: 0.036, h: door.doorH + 0.02 }
        )
      );
    }
  }

  if (p.hasBalcony && p.floors > 1) {
    const floorH = 1 / p.floors;
    const balconyBand = p.floors - 1;
    const bodyRelY = balconyBand * floorH;
    const balconyY = parapetH + bodyH * bodyRelY;
    children.push(
      new ShapeNode(
        'Balcony',
        { palette: p.palette, floors: p.floors },
        { x: 0.1, y: balconyY - 0.004, w: 0.8, h: bodyH * floorH * 0.14 }
      )
    );
  }

  if (p.hasDome) {
    children.push(
      new ShapeNode(
        'Dome',
        { palette: p.palette },
        { x: 0.68, y: -0.055, w: 0.16, h: 0.09 }
      )
    );
  }

  for (let i = 0; i < p.potCount; i++) {
    children.push(
      new ShapeNode(
        'Pot',
        { palette: p.palette, index: i },
        { x: 0.06 + i * 0.11, y: 1 - 0.035, w: 0.05, h: 0.04 }
      )
    );
  }

  if (p.hasVines) {
    const corner = p.hasWing && p.wingSide === 'left' ? 'right' : 'left';
    const vineX = corner === 'left' ? -0.01 : 0.9;
    children.push(
      new ShapeNode(
        'Vine',
        { palette: p.palette, corner },
        { x: vineX, y: parapetH + bodyH * 0.58, w: 0.12, h: bodyH * 0.4 }
      )
    );
  }

  return children;
}

function buildGreekHouseExtras(node) {
  const p = node.params;
  const extras = [];
  const horizon = 0.68;
  const bodyX = 0.5 - p.bodyWidth / 2;

  if (p.hasStairs) {
    const stairW = 0.075;
    const stairH = p.bodyHeight * (0.38 + p.floors * 0.07);
    const stairTop = horizon - stairH;
    const stairX =
      p.stairSide === 'left'
        ? bodyX - stairW * 0.92
        : bodyX + p.bodyWidth + stairW * 0.08;

    extras.push(
      new ShapeNode(
        'Stairs',
        { palette: p.palette, side: p.stairSide, steps: p.floors + 3 },
        { x: stairX, y: stairTop, w: stairW, h: stairH }
      )
    );
  }

  return extras;
}

function buildStandardBuilding(node, rng) {
  const p = node.params;
  const roofH = p.roofH / (p.bodyHeight + p.roofH);
  const bodyH = 1 - roofH;
  const door = getDoorLayout(p.style);
  const children = [
    new ShapeNode(
      'Body',
      { palette: p.palette, style: p.style, floors: p.floors, windowCols: p.windowCols },
      { x: 0, y: roofH, w: 1, h: bodyH }
    ),
    new ShapeNode(
      'Roof',
      { palette: p.palette, style: p.roofStyle, overhang: p.style === 'modern' ? 0.02 : 0.06 },
      { x: -0.04, y: 0, w: 1.08, h: roofH }
    ),
  ];

  if (p.hasChimney) {
    children.push(
      new ShapeNode(
        'Chimney',
        { palette: p.palette },
        { x: rng.range(0.62, 0.78), y: -0.08, w: 0.08, h: roofH + 0.1 }
      )
    );
  }

  if (p.hasPorch) {
    const porchPad = 0.06;
    const porchW = door.doorW + porchPad * 2;
    const porchX = door.doorX - porchPad;
    children.push(
      new ShapeNode(
        'Porch',
        { palette: p.palette, doorCenter: door.doorX + door.doorW / 2 },
        { x: porchX, y: 1 - 0.025, w: porchW, h: 0.06 }
      )
    );
  }

  children.push(
    new ShapeNode(
      'Foundation',
      { palette: p.palette },
      { x: -0.02, y: 1 - 0.012, w: 1.04, h: 0.025 }
    )
  );

  return children;
}

function buildBodyChildren(node) {
  const p = node.params;
  const children = [];
  const floors = p.floors;
  const door = getDoorLayout(p.style);
  const cols = p.style === 'townhouse' ? Math.max(2, p.windowCols) : isGreek(p.style) ? p.windowCols : 2;
  const sideMargin = isGreek(p.style) ? 0.08 : 0.1;
  const floorH = 1 / floors;

  children.push(
    new ShapeNode(
      'Door',
      { palette: p.palette, style: p.style },
      { x: door.doorX, y: 1 - door.doorH, w: door.doorW, h: door.doorH }
    )
  );

  if (floors > 1) {
    for (let floor = 1; floor < floors; floor++) {
      const y = floor * floorH;
      children.push(
        new ShapeNode(
          'FloorLine',
          { palette: p.palette, style: p.style },
          { x: 0.03, y: y - 0.004, w: 0.94, h: isGreek(p.style) ? 0.006 : 0.008 }
        )
      );
    }
  }

  const winW = isGreek(p.style) ? 0.12 : p.style === 'modern' ? 0.16 : 0.13;
  const winH = Math.min(floorH * 0.42, isGreek(p.style) ? 0.12 : p.style === 'modern' ? 0.14 : 0.11);

  for (let floor = 0; floor < floors; floor++) {
    const bandTop = floor * floorH;
    const cy = bandTop + floorH * 0.42;
    const isGroundFloor = floor === floors - 1;

    for (let col = 0; col < cols; col++) {
      const cx = sideMargin + ((col + 0.5) / cols) * (1 - sideMargin * 2);
      const wx = cx - winW / 2;
      const wy = cy - winH / 2;

      if (
        isGroundFloor &&
        rectsOverlap(
          wx,
          wy,
          winW,
          winH,
          door.doorX - 0.02,
          1 - door.doorH - 0.02,
          door.doorW + 0.04,
          door.doorH + 0.04
        )
      ) {
        continue;
      }

      children.push(
        new ShapeNode(
          'Window',
          {
            palette: p.palette,
            style: p.style,
            floor,
            col,
            shutterOpen: p.shutterOpen,
          },
          { x: wx, y: wy, w: winW, h: winH }
        )
      );

      if (!isGreek(p.style)) {
        children.push(
          new ShapeNode(
            'Sill',
            { palette: p.palette },
            { x: wx - 0.008, y: wy + winH - 0.006, w: winW + 0.016, h: 0.012 }
          )
        );
      }
    }
  }

  if (p.style !== 'modern' && !isGreek(p.style)) {
    children.push(
      new ShapeNode('Trim', { palette: p.palette }, { x: 0, y: 0, w: 1, h: 0.02 })
    );
  }

  return children;
}

const GRAMMAR_RULES = {
  House(node, rng) {
    const p = node.params;
    const horizon = 0.68;
    const bodyW = p.bodyWidth;
    const bodyH = p.bodyHeight;
    const bodyX = 0.5 - bodyW / 2;
    const bodyY = horizon - bodyH;
    const roofH = isGreek(p.style)
      ? 0.045
      : p.roofStyle === 'flat'
        ? 0.03
        : p.roofStyle === 'barn'
          ? 0.16
          : 0.12;

    const buildingNode = new ShapeNode(
      'Building',
      { ...p, roofH },
      { x: bodyX, y: bodyY - roofH, w: bodyW, h: bodyH + roofH }
    );

    const children = [
      new ShapeNode(
        'Sky',
        { palette: p.palette, style: p.style },
        { x: 0, y: 0, w: 1, h: horizon }
      ),
      new ShapeNode(
        'Ground',
        { palette: p.palette, style: p.style },
        { x: 0, y: horizon, w: 1, h: 1 - horizon }
      ),
    ];

    if (isGreek(p.style)) {
      children.push(...buildGreekHouseExtras(node));
    }

    children.push(buildingNode);

    return children;
  },

  Building(node, rng) {
    if (isGreek(node.params.style)) {
      return buildGreekBuilding(node, rng);
    }
    return buildStandardBuilding(node, rng);
  },

  Body(node) {
    return buildBodyChildren(node);
  },
};

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function deriveShapeTree(root, rules, maxDepth = 12) {
  const queue = [root];

  while (queue.length) {
    const node = queue.shift();
    const rule = rules[node.type];
    if (!rule || node.depth >= maxDepth) continue;

    node.children = rule(node, node.params._rng);
    node.children.forEach((child) => {
      child.depth = node.depth + 1;
      child.params = {
        ...child.params,
        _rng: node.params._rng,
        palette: child.params.palette || node.params.palette,
      };
    });
    queue.push(...node.children.filter((child) => rules[child.type]));
  }

  return root;
}

function absolutizeBounds(node, parent = { x: 0, y: 0, w: 1, h: 1 }) {
  node.abs = {
    x: parent.x + node.bounds.x * parent.w,
    y: parent.y + node.bounds.y * parent.h,
    w: node.bounds.w * parent.w,
    h: node.bounds.h * parent.h,
  };
  node.children.forEach((child) => absolutizeBounds(child, node.abs));
  return node;
}

function flattenDrawables(root) {
  const items = [];

  function walk(node) {
    if (TERMINAL_TYPES.has(node.type)) {
      items.push(node);
    }
    node.children.forEach(walk);
  }

  walk(root);
  return items;
}

function generateHouse(options = {}) {
  const seed = options.seed ?? Math.floor(Math.random() * 999999);
  const style = options.style ?? 'greek';
  const floors = options.floors ?? 1;
  const rng = new SeededRandom(seed);

  const root = createHouseGrammar(style, floors, rng);
  root.params._rng = rng;
  deriveShapeTree(root, GRAMMAR_RULES);
  absolutizeBounds(root);

  return {
    seed,
    style,
    floors,
    root,
    drawables: flattenDrawables(root),
    steps: countRuleApplications(root),
  };
}

function countRuleApplications(root) {
  let count = 0;
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node.children.length && GRAMMAR_RULES[node.type]) {
      count += 1;
      queue.push(...node.children);
    }
  }
  return count;
}

function describeDerivation(root) {
  const p = root.params;
  const variantNote = p.variant ? ` · ${p.variant}` : '';
  const lines = [
    `House (${p.style}${variantNote}, ${p.floors} floor${p.floors > 1 ? 's' : ''})`,
  ];

  if (isGreek(p.style)) {
    const features = [];
    if (p.hasWing) features.push(`wing ${p.wingSide}`);
    if (p.hasBalcony) features.push('balcony');
    if (p.hasStairs) features.push(`stairs ${p.stairSide}`);
    if (p.hasDome) features.push('dome');
    if (p.hasColumns) features.push(`${p.columnCount} columns`);
    if (p.hasVines) features.push('vines');
    if (p.hasTerrace) features.push('terrace');
    if (p.potCount) features.push(`${p.potCount} pots`);
    if (features.length) lines.push(`Features: ${features.join(', ')}`);
  }

  function walk(node, indent) {
    node.children.forEach((child) => {
      const label = child.type + (child.params.style ? ` [${child.params.style}]` : '');
      lines.push(`${'  '.repeat(indent)}→ ${label}`);
      if (child.children.length) walk(child, indent + 1);
    });
  }

  walk(root, 1);
  return lines.join('\n');
}
