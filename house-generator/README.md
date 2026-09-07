# Shape Grammar House Generator

Generate cozy cottages, townhouses, modern homes, and barns with a **parametric shape grammar** in p5.js. A single `House` symbol is rewritten step by step into walls, roofs, doors, windows, chimneys, and more.

## What it does

- Applies shape-grammar production rules (`House → Sky + Ground + Building`, etc.)
- Supports four architectural styles: cottage, townhouse, modern, and barn
- Seeded randomness — the same seed always rebuilds the same house
- Shows the derivation tree so you can follow each rewrite
- Animates terminal shapes as they appear on the canvas

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/house-generator/index.html.

## How the grammar works

| Symbol | Production |
|--------|------------|
| `House` | `Sky` + `Ground` + `Building` |
| `Building` | `Body` + `Roof` + optional `Chimney` / `Porch` + `Foundation` |
| `Body` | `Door` + grid of `Window` + `Sill` shapes (+ `Trim`) |

Each rule places child shapes in normalized coordinates inside the parent, so the same grammar scales to any canvas size.
