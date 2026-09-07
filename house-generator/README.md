# Shape Grammar House Generator

Generate **classic Greek island houses** — and other styles — with a parametric shape grammar in p5.js. A single `House` symbol is rewritten step by step into whitewashed volumes, blue shutters, parapet roofs, and optional architectural details.

## What it does

- **Greek (Cycladic) style** — the default focus: cubic white forms, Aegean blue accents, flat parapets
- Procedural variability per seed: wings, domes, columns, balconies, external stairs, bougainvillea, terracotta pots
- Three sub-variants: `cycladic`, `village`, and `mansion`
- Also supports cottage, townhouse, modern, and barn styles
- Seeded randomness — the same seed always rebuilds the same house
- Shows the derivation tree with a feature summary for Greek houses

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/house-generator/index.html.

## Greek shape grammar

| Symbol | Production |
|--------|------------|
| `House` | `Sky` + `Ground` + `Building` + optional `Stairs` |
| `Building` | optional `Wing` + `Body` + `Parapet` + `Foundation` + optional `Terrace`, `Column`, `Balcony`, `Dome`, `Pot`, `Vine` |
| `Body` | arched blue `Door` + shuttered `Window` grid + optional `FloorLine` dividers |

Each rule places child shapes in normalized coordinates inside the parent, so the same grammar scales to any canvas size.
