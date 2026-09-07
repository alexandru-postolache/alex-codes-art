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
]);

function getDoorLayout(style) {
  const doorW = style === 'barn' ? 0.34 : style === 'modern' ? 0.14 : 0.18;
  const doorH = style === 'barn' ? 0.4 : style === 'modern' ? 0.22 : 0.24;
  const doorX = style === 'barn' ? 0.33 : 0.5 - doorW / 2;
  return { doorW, doorH, doorX };
}

function createHouseGrammar(style, floors, rng) {
  const floorCount = constrain(floors, 1, 3);
  const baseHeights = { cottage: 0.26, townhouse: 0.28, modern: 0.24, barn: 0.24 };
  const perFloorHeights = { cottage: 0.12, townhouse: 0.1, modern: 0.11, barn: 0.1 };
  const base = baseHeights[style] || 0.26;
  const perFloor = perFloorHeights[style] || 0.11;

  const params = {
    style,
    floors: floorCount,
    roofStyle: style === 'modern' ? 'flat' : style === 'barn' ? 'barn' : 'gable',
    palette: pickPalette(style, rng),
    windowCols: style === 'townhouse' ? rng.int(2, 3) : 2,
    hasChimney: style !== 'modern' && rng.chance(0.55),
    hasPorch: (style === 'cottage' || style === 'barn') && rng.chance(0.45),
    bodyWidth: style === 'modern' ? rng.range(0.42, 0.58) : rng.range(0.34, 0.46),
    bodyHeight: base + (floorCount - 1) * perFloor,
  };

  return new ShapeNode('House', params);
}

function pickPalette(style, rng) {
  const palettes = {
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

const GRAMMAR_RULES = {
  House(node, rng) {
    const p = node.params;
    const horizon = 0.68;
    const bodyW = p.bodyWidth;
    const bodyH = p.bodyHeight;
    const bodyX = 0.5 - bodyW / 2;
    const bodyY = horizon - bodyH;
    const roofH = p.roofStyle === 'flat' ? 0.03 : p.roofStyle === 'barn' ? 0.16 : 0.12;

    return [
      new ShapeNode('Sky', { palette: p.palette }, { x: 0, y: 0, w: 1, h: horizon }),
      new ShapeNode('Ground', { palette: p.palette }, { x: 0, y: horizon, w: 1, h: 1 - horizon }),
      new ShapeNode(
        'Building',
        { ...p, roofH },
        { x: bodyX, y: bodyY - roofH, w: bodyW, h: bodyH + roofH }
      ),
    ];
  },

  Building(node, rng) {
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
        {
          palette: p.palette,
          style: p.roofStyle,
          overhang: p.style === 'modern' ? 0.02 : 0.06,
        },
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
  },

  Body(node, rng) {
    const p = node.params;
    const children = [];
    const floors = p.floors;
    const door = getDoorLayout(p.style);
    const cols = p.style === 'townhouse' ? Math.max(2, p.windowCols) : 2;
    const sideMargin = 0.1;
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
            { palette: p.palette },
            { x: 0.03, y: y - 0.004, w: 0.94, h: 0.008 }
          )
        );
      }
    }

    const winW = p.style === 'modern' ? 0.16 : 0.13;
    const winH = Math.min(floorH * 0.42, p.style === 'modern' ? 0.14 : 0.11);

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
            { palette: p.palette, style: p.style, floor, col },
            { x: wx, y: wy, w: winW, h: winH }
          )
        );
        children.push(
          new ShapeNode(
            'Sill',
            { palette: p.palette },
            { x: wx - 0.008, y: wy + winH - 0.006, w: winW + 0.016, h: 0.012 }
          )
        );
      }
    }

    if (p.style !== 'modern') {
      children.push(
        new ShapeNode(
          'Trim',
          { palette: p.palette },
          { x: 0, y: 0, w: 1, h: 0.02 }
        )
      );
    }

    return children;
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
      child.params = { ...child.params, _rng: node.params._rng, palette: child.params.palette || node.params.palette };
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
  const style = options.style ?? 'cottage';
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
  const lines = [`House (${root.params.style}, ${root.params.floors} floor${root.params.floors > 1 ? 's' : ''})`];

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
