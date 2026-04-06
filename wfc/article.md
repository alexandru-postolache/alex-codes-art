# Wave Function Collapse in p5.js: A Visual Guide to the Generative Art Algorithm

Hello friends, and welcome to another creative coding tutorial! Today, we're going to explore one of the most fascinating algorithms in the world of generative art — **Wave Function Collapse** (WFC). If you've ever wanted to generate entire worlds, tile patterns, or procedural art that feels organic yet follows strict rules, this is the algorithm for you.

By the end of this article, you'll understand how the WFC algorithm works, step by step, and we'll walk through the core code together using JavaScript and p5.js. Whether you're a beginner in creative coding or an experienced generative artist, there's something here for you.

Let's dive in!

---

## What is Wave Function Collapse?

Wave Function Collapse is a procedural generation algorithm inspired by concepts from quantum mechanics. The name comes from the idea that, in quantum physics, a particle exists in a **superposition** — it's in multiple states at once — until it's observed and "collapses" into a single state.

In our creative coding context, WFC works with a grid of cells. Each cell starts in a **superposition** of all possible tiles. Then, step by step, cells "collapse" to a single tile, and that decision ripples outward, constraining what neighboring cells can become.

The result? Beautiful, coherent patterns generated entirely by code — no manual design required. This is what makes WFC such a powerful tool for generative art, game development, and procedural content creation.

---

## How It Works — The Big Picture

Before we jump into the code, let's walk through the core steps of the algorithm. Think of it like solving a jigsaw puzzle where the pieces decide for themselves where to go:

1. **Start with superposition** — Every cell holds all possible tiles.
2. **Find the most constrained cell** — Pick the cell with the lowest *entropy* (fewest remaining options).
3. **Collapse it** — Randomly choose one tile from its remaining options.
4. **Propagate constraints** — Remove incompatible options from neighboring cells.
5. **Repeat** — Go back to step 2 until every cell has collapsed.
6. **Handle failures** — If a cell ends up with zero options, we've hit a contradiction. Reset and try again.

Simple, right? The magic is in the details. Let's break down each step and look at the code that makes it happen.

---

## Defining Tiles — The Building Blocks

Everything in WFC starts with **tiles**. A tile is a small visual element that has **edges** — labels that describe what can sit next to it. Two tiles can be neighbors only if their touching edges match.

Here's how we define a simple pipe tileset:

```javascript
const PIPES_TILES = [
  { name: 'blank',      edges: [0,0,0,0], weight: 10 },
  { name: 'straight-h', edges: [0,1,0,1], weight: 4  },
  { name: 'straight-v', edges: [1,0,1,0], weight: 4  },
  { name: 'corner-tr',  edges: [1,1,0,0], weight: 2  },
  { name: 'corner-br',  edges: [0,1,1,0], weight: 2  },
  { name: 'corner-bl',  edges: [0,0,1,1], weight: 2  },
  { name: 'corner-tl',  edges: [1,0,0,1], weight: 2  },
  { name: 't-up',       edges: [1,1,0,1], weight: 1  },
  { name: 't-right',    edges: [1,1,1,0], weight: 1  },
  { name: 't-down',     edges: [0,1,1,1], weight: 1  },
  { name: 't-left',     edges: [1,0,1,1], weight: 1  },
  { name: 'cross',      edges: [1,1,1,1], weight: 1  },
];
```

Each tile has four edges: `[top, right, bottom, left]`. The values are **edge labels** — two tiles can sit next to each other only if the touching edges have the same label. A `0` means "empty" and a `1` means "pipe connector."

The `weight` property controls how likely a tile is to be chosen during collapse. Higher weight means it appears more often. The blank tile has the highest weight (10), so our generated patterns won't be overwhelmed with pipes — there'll be breathing room.

This idea of defining tiles with edge constraints is fundamental. You can create any visual vocabulary you want — from dungeon maps to abstract art — just by changing the tileset.

---

## Precomputing Adjacency Rules

Before the algorithm starts, we precompute which tiles can be neighbors in each direction. This avoids checking compatibility on every single step, making the algorithm much faster.

```javascript
const DIR_OFFSET = [[0,-1], [1,0], [0,1], [-1,0]];

let validNeighbors = [];

function precomputeAdjacency() {
  let numDirs = cornerMode ? 8 : 4;
  validNeighbors = [];

  for (let d = 0; d < numDirs; d++) {
    validNeighbors[d] = [];

    let opp = (d + 2) % 4;
    for (let i = 0; i < TILES.length; i++) {
      validNeighbors[d][i] = new Set();
      for (let j = 0; j < TILES.length; j++) {
        if (String(TILES[i].edges[d]) === String(TILES[j].edges[opp])) {
          validNeighbors[d][i].add(j);
        }
      }
    }
  }
}
```

Here's what's happening:

- For each **direction** `d` (top, right, bottom, left), and for each **tile** `i`, we find every tile `j` that could legally sit in that direction.
- The key insight is that if tile `i` has edge label `X` on its right side, then any tile placed to its right must have edge label `X` on its left side. The left side is the **opposite** direction, calculated as `(d + 2) % 4`.
- We store the results in `validNeighbors[d][i]` — a `Set` of tile indices compatible with tile `i` in direction `d`.

This lookup table is what makes propagation efficient. Instead of re-checking edge compatibility every time, we just look it up.

---

## The Cell — Where Superposition Lives

Each cell in the grid is an instance of the `Cell` class. It tracks its current state in the algorithm:

```javascript
class Cell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.options = new Set();
    for (let i = 0; i < TILES.length; i++) this.options.add(i);
    this.collapsed = false;
    this.tile = -1;
  }

  entropy() {
    if (this.collapsed) return Infinity;
    if (this.options.size <= 1) return 0;
    let sw = 0, swlw = 0;
    for (let opt of this.options) {
      let w = TILES[opt].weight;
      sw += w;
      swlw += weightLogWeights[opt];
    }
    if (sw === 0) return 0;
    return Math.log2(sw) - swlw / sw;
  }

  collapse() {
    let sw = 0;
    for (let opt of this.options) sw += TILES[opt].weight;
    let r = Math.random() * sw;
    let acc = 0;
    for (let opt of this.options) {
      acc += TILES[opt].weight;
      if (r <= acc) {
        this.tile = opt;
        this.options = new Set([opt]);
        this.collapsed = true;
        return;
      }
    }
  }
}
```

Let's break this down:

### Constructor

When a cell is created, it starts in **superposition** — its `options` set contains every tile index. It hasn't collapsed yet, and no tile has been assigned.

### Entropy — Measuring Uncertainty

The `entropy()` method is the brain of the algorithm. It tells us how uncertain a cell is. The formula used here is **Shannon entropy**, adapted for weighted tiles:

**entropy = log₂(Σw) − (Σ wᵢ·log₂(wᵢ)) / Σw**

Where `w` is the weight of each remaining tile option. A cell with many heavy-weighted options has high entropy (very uncertain), while a cell with only one lightweight option has low entropy (almost decided).

Collapsed cells return `Infinity` so the algorithm never picks them again.

### Collapse — Making the Decision

The `collapse()` method performs a **weighted random selection**. It picks a random number between 0 and the total weight of all remaining options, then walks through the options accumulating weight until it passes the random threshold. This means tiles with higher weight are more likely to be chosen — which is how we control the visual distribution of our generated patterns.

---

## Initializing the Grid

Before we can run the algorithm, we need a grid of cells:

```javascript
let GRID_COLS = 16;
let GRID_ROWS = 16;
let grid = [];

function initGrid() {
  grid = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      grid[y][x] = new Cell(x, y);
    }
  }
  collapsed = false;
  failed = false;
}
```

Nothing fancy here — we create a 2D array of cells. Each cell starts with all tiles as possible options. The `collapsed` and `failed` flags track the overall state of the algorithm.

---

## Finding the Lowest Entropy Cell

At each step, the algorithm needs to find the cell that's most constrained — the one with the fewest valid options. This is where the magic of WFC lies. By always collapsing the most constrained cell first, we minimize the chance of contradictions.

```javascript
function findLowestEntropy() {
  let minEntropy = Infinity;
  let candidates = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cell = grid[y][x];
      if (cell.collapsed) continue;
      let e = cell.entropy();
      if (e < minEntropy) {
        minEntropy = e;
        candidates = [cell];
      } else if (Math.abs(e - minEntropy) < 0.0001) {
        candidates.push(cell);
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

We scan every uncollapsed cell, tracking those with the minimum entropy. When multiple cells share the same entropy, we pick one at random. The small tolerance (`0.0001`) handles floating-point precision issues.

If no uncollapsed cells remain, we return `null` — the grid is complete.

---

## Constraint Propagation — The Ripple Effect

This is the heart of Wave Function Collapse. When a cell collapses, it doesn't just affect itself — it reshapes the possibilities of every cell around it. Those changes then cascade outward, like ripples in a pond.

```javascript
function propagate(startX, startY) {
  let stack = [[startX, startY]];
  let numDirs = cornerMode ? 8 : 4;

  while (stack.length > 0) {
    let [cx, cy] = stack.pop();
    let cell = grid[cy][cx];

    for (let d = 0; d < numDirs; d++) {
      let nx = cx + DIR_OFFSET[d][0];
      let ny = cy + DIR_OFFSET[d][1];
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;

      let neighbor = grid[ny][nx];
      if (neighbor.collapsed) continue;

      let allowed = new Set();
      for (let opt of cell.options) {
        for (let v of validNeighbors[d][opt]) {
          allowed.add(v);
        }
      }

      let changed = false;
      let removed = [];
      for (let opt of neighbor.options) {
        if (!allowed.has(opt)) {
          removed.push(opt);
          changed = true;
        }
      }
      for (let r of removed) neighbor.options.delete(r);

      if (neighbor.options.size === 0) {
        failed = true;
        failedCell = neighbor;
        return;
      }

      if (changed) {
        stack.push([nx, ny]);
      }
    }
  }
}
```

Let's walk through what happens:

1. We start with a **stack** containing the collapsed cell's position.
2. We pop a cell from the stack and look at all its neighbors.
3. For each neighbor, we compute the **allowed** set — the union of all tiles that are valid neighbors for any of the current cell's remaining options.
4. We then **remove** any tile from the neighbor's options that isn't in the allowed set.
5. If the neighbor's options changed, we push it onto the stack so its own neighbors get updated too.
6. If a neighbor ends up with **zero options**, we've hit a **contradiction** — the algorithm has failed and needs to restart.

This is stack-based **arc consistency** propagation — it guarantees that after every collapse, every cell's options are locally consistent with their neighbors. The ripple stops naturally when no more options are removed.

---

## One Step of WFC

The `wfcStep()` function ties everything together into a single step of the algorithm:

```javascript
function wfcStep() {
  let cell = findLowestEntropy();
  if (!cell) {
    collapsed = true;
    return { type: 'complete' };
  }

  if (cell.options.size === 0) {
    failed = true;
    failedCell = cell;
    return { type: 'fail', cell };
  }

  cell.collapse();
  propagate(cell.x, cell.y);

  if (failed) {
    return { type: 'fail', cell: failedCell };
  }

  return { type: 'step', cell };
}
```

Each call to `wfcStep()`:

1. **Finds** the lowest entropy cell. If none remain, the grid is complete.
2. **Checks** for contradictions — if the chosen cell has no options, we've failed.
3. **Collapses** the cell to a single tile (weighted random choice).
4. **Propagates** the constraints to update all neighbors.
5. **Returns** the result — either a successful step, a completion, or a failure.

To run the full algorithm, you just call `wfcStep()` in a loop until it returns `complete` or `fail`. In our p5.js visualization, we call it once per frame (or faster) so you can watch the algorithm unfold in real time.

---

## Handling Failure

Sometimes the algorithm paints itself into a corner — a cell ends up with no valid options. This isn't a bug; it's a fundamental property of constraint satisfaction problems. Not every sequence of random choices leads to a valid solution.

Our approach is simple: **reset and try again**. In the visualization, you'll see a red flash when a contradiction occurs, and the grid restarts automatically. With well-designed tilesets, contradictions are rare, but they can happen — especially with complex constraints.

---

## The p5.js Setup

Here's how we wire everything up in p5.js to bring the algorithm to life:

```javascript
function setup() {
  TILES = PIPES_TILES.map(t => ({ ...t, img: null }));
  precomputeAdjacency();
  precomputeWeights();
  let cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.parent('canvas-container');
  pixelDensity(2);
  initGrid();
}

function draw() {
  background(13, 13, 26);

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      let cell = grid[y][x];
      let px = x * CELL_SIZE;
      let py = y * CELL_SIZE;
      drawCell(cell, px, py, CELL_SIZE);
    }
  }
}
```

The `setup()` function initializes the tileset, precomputes adjacency rules and weights, creates the canvas, and builds the initial grid. The `draw()` function renders the grid every frame — drawing each cell as either a collapsed tile or a superposition preview.

---

## Visualizing Superposition

One of the coolest parts of this implementation is how we visualize cells that haven't collapsed yet. Instead of showing a blank square, we render faded previews of all remaining tile options:

```javascript
function drawSuperposition(cell, px, py, size) {
  noStroke();
  fill(20, 20, 40);
  rect(px, py, size, size);

  if (cell.options.size === 0) return;

  let alpha = map(cell.options.size, 1, TILES.length, 120, 25);

  let cx = px + size / 2;
  let cy = py + size / 2;
  let pw = size * 0.22;

  for (let opt of cell.options) {
    let tile = TILES[opt];
    let hasAnyEdge = tile.edges.some(e => e !== 0);
    if (!hasAnyEdge) continue;

    fill(108, 92, 231, alpha);
    noStroke();
    if (tile.edges[0] !== 0) rect(cx - pw/4, py + size*0.15, pw/2, size*0.35);
    if (tile.edges[1] !== 0) rect(cx + size*0.15, cy - pw/4, size*0.35, pw/2);
    if (tile.edges[2] !== 0) rect(cx - pw/4, cy + size*0.15, pw/2, size*0.35);
    if (tile.edges[3] !== 0) rect(px + size*0.15, cy - pw/4, size*0.35, pw/2);
  }
}
```

The alpha of each preview is mapped to how many options remain — more options means fainter previews. As the algorithm constrains cells, the previews become more vivid and focused, giving you a visual sense of entropy decreasing across the grid.

---

## Entropy Weights — Controlling the Output

The weight system is what gives you creative control over the algorithm's output. By tweaking weights, you can dramatically change the character of the generated patterns:

```javascript
function precomputeWeights() {
  weightLogWeights = [];
  totalWeight = 0;
  totalWeightLogWeight = 0;
  for (let i = 0; i < TILES.length; i++) {
    let w = TILES[i].weight;
    totalWeight += w;
    let wlw = w * Math.log2(Math.max(w, 1));
    weightLogWeights[i] = wlw;
    totalWeightLogWeight += wlw;
  }
}
```

These precomputed values are used in the entropy calculation to avoid recalculating logarithms on every cell scan. The `weightLogWeights` array caches `w * log₂(w)` for each tile, which is the key term in the Shannon entropy formula.

Want more blank space? Increase the blank tile's weight. Want dense, interconnected pipe networks? Lower the blank weight and raise the cross tile's weight. This is where the generative art becomes *your* art.

---

## Going Further — Corner Mode and Wang Tiles

The implementation also supports **corner-based adjacency** for more complex tilesets like Wang tiles. Instead of matching edges, we match **corner colors**:

```javascript
const CORNER_RULES = [
  [[3, 2], [0, 1]],  // top: my NW==their SW, my NE==their SE
  [[0, 3], [1, 2]],  // right: my NE==their NW, my SE==their SW
  [[2, 3], [1, 0]],  // bottom: my SW==their NW, my SE==their NE
  [[3, 0], [2, 1]],  // left: my NW==their NE, my SW==their SE
  [[0, 2]],           // top-right diagonal: my NE==their SW
  [[1, 3]],           // bottom-right diagonal: my SE==their NW
  [[2, 0]],           // bottom-left diagonal: my SW==their NE
  [[3, 1]],           // top-left diagonal: my NW==their SE
];
```

With corner mode enabled, the algorithm considers **8 directions** instead of 4 — including diagonals. Each direction has rules about which corners must match. This opens up support for Wang tilesets (both 2-color and 3-color variants), which can produce incredibly detailed and seamless procedural patterns.

Wang tiles are a well-established concept in computer graphics. A Wang 2-edge tileset uses a 4×4 atlas of 16 tiles, while a 3-edge tileset uses a 9×9 atlas of 81 tiles. The code can import these atlases directly and auto-configure all the edge or corner constraints.

---

## The Algorithm in Action

To see the full implementation in action, you can interact with the visualization at the top of this page. Here's what to look for:

- **Superposition** — Uncollapsed cells shimmer with faded previews of their remaining possibilities.
- **Entropy Heatmap** — Toggle this to see uncertainty across the grid. Bright cells are uncertain; dark cells are nearly decided.
- **The Collapse** — Watch for the golden pulse. That's a cell making its decision.
- **Propagation** — The cyan ripple spreading outward from each collapse is constraint propagation at work.
- **Contradictions** — A red flash means the algorithm hit a dead end. It resets and tries again.

You can also manually place tiles by selecting one from the tile picker and clicking on an uncollapsed cell. The algorithm will immediately propagate the constraints from your placement, letting you guide the generation process.

---

## Key Takeaways

Here's a summary of what makes Wave Function Collapse such a compelling algorithm for creative coding and generative art:

- **Local rules, global structure** — Simple tile adjacency rules produce complex, emergent patterns.
- **Weighted randomness** — Tile weights give you creative control over the output's character.
- **Entropy-driven decisions** — Always collapsing the most constrained cell minimizes contradictions.
- **Constraint propagation** — One decision ripples across the entire grid, keeping everything consistent.
- **Graceful failure** — Contradictions are handled naturally with restarts.
- **Extensible** — Swap tilesets, change weights, add corner rules, and you get entirely different visual worlds.

---

## Wrapping Up

Thank you for following along with this deep dive into Wave Function Collapse! This algorithm sits at a beautiful intersection of mathematics, constraint satisfaction, and visual art. It's one of those tools in creative coding that feels almost magical — you define simple local rules, and complex global patterns emerge.

I encourage you to experiment with the interactive visualization. Try different tilesets, adjust the weights, import your own Wang tile atlases, and see what kinds of generative art you can create. Every run produces something unique, and that's the beauty of procedural generation.

If you have any questions, feedback, or just want to share your own WFC creations, feel free to leave a comment below. I'd love to see what you come up with!

Stay connected for more creative coding tutorials and generative art explorations by subscribing to this blog. I really appreciate it!

Happy coding, and see you in the next tutorial!
