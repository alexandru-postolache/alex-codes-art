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
  'Sill',
]);

function createHouseGrammar(style, floors, rng) {
  const params = {
    style,
    floors: constrain(floors, 1, 3),
    roofStyle: style === 'modern' ? 'flat' : style === 'barn' ? 'barn' : 'gable',
    palette: pickPalette(style, rng),
    windowCols: style === 'townhouse' ? rng.int(2, 3) : rng.int(1, 3),
    hasChimney: style !== 'modern' && rng.chance(0.55),
    hasPorch: (style === 'cottage' || style === 'barn') && rng.chance(0.45),
    bodyWidth: style === 'modern' ? rng.range(0.42, 0.58) : rng.range(0.32, 0.48),
    bodyHeight: style === 'townhouse'
      ? rng.range(0.28, 0.38) + (floors - 1) * 0.08
      : style === 'barn'
        ? rng.range(0.22, 0.3)
        : rng.range(0.24, 0.34),
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
      children.push(
        new ShapeNode(
          'Porch',
          { palette: p.palette },
          { x: 0.18, y: bodyH + roofH - 0.02, w: 0.28, h: 0.08 }
        )
      );
    }

    children.push(
      new ShapeNode(
        'Foundation',
        { palette: p.palette },
        { x: -0.02, y: bodyH + roofH - 0.015, w: 1.04, h: 0.03 }
      )
    );

    return children;
  },

  Body(node, rng) {
    const p = node.params;
    const children = [];
    const doorW = p.style === 'barn' ? 0.34 : p.style === 'modern' ? 0.14 : 0.16;
    const doorH = p.style === 'barn' ? 0.55 : 0.28;
    const doorX = p.style === 'barn' ? 0.33 : 0.5 - doorW / 2;

    children.push(
      new ShapeNode(
        'Door',
        { palette: p.palette, style: p.style },
        { x: doorX, y: 1 - doorH, w: doorW, h: doorH }
      )
    );

    const cols = p.style === 'townhouse' ? Math.max(2, p.windowCols) : p.windowCols;
    const rows = p.floors;
    const topMargin = 0.08;
    const bottomMargin = doorH + 0.06;
    const sideMargin = 0.08;
    const usableW = 1 - sideMargin * 2;
    const usableH = 1 - topMargin - bottomMargin;
    const gapX = usableW / cols;
    const gapY = usableH / rows;
    const winW = Math.min(gapX * 0.55, p.style === 'modern' ? 0.18 : 0.12);
    const winH = Math.min(gapY * 0.62, p.style === 'modern' ? 0.16 : 0.11);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = sideMargin + gapX * (col + 0.5);
        const cy = topMargin + gapY * (row + 0.5);
        if (rectsOverlap(cx - winW / 2, cy - winH / 2, winW, winH, doorX - 0.02, 1 - doorH - 0.02, doorW + 0.04, doorH + 0.02)) {
          continue;
        }
        children.push(
          new ShapeNode(
            'Window',
            { palette: p.palette, style: p.style, row, col },
            { x: cx - winW / 2, y: cy - winH / 2, w: winW, h: winH }
          )
        );
        children.push(
          new ShapeNode(
            'Sill',
            { palette: p.palette },
            { x: cx - winW / 2 - 0.01, y: cy + winH / 2 - 0.008, w: winW + 0.02, h: 0.015 }
          )
        );
      }
    }

    if (p.style !== 'modern') {
      children.push(
        new ShapeNode(
          'Trim',
          { palette: p.palette },
          { x: 0, y: 0, w: 1, h: 0.025 }
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
