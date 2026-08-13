# Contour Vector

Platform-neutral vector output for contour-line art — built for **SVG export**, **Figma plugins**, and other design tools.

This folder is separate from `contour-lines/` (the canvas preview app). Nothing here modifies the existing sketch.

## Architecture

```
contour-vector/
  core/                 # pure JS, no p5 / canvas / Paper.js
    generate.js         # params → ContourVectorScene
    svg-export.js       # scene → SVG string
    marching-squares.js
    fill-bands.js       # scalar grid → vector band polygons
    path-stitch.js       # segments → continuous topology
    path-smooth.js       # local, chord-limited Bezier curves
    segments.js          # optional raw segment export
    field.js            # noise presets + scalar field
    palette.js          # hex palettes without p5
  adapters/
    figma.js            # scene → Figma vector network payloads
  demo/                 # standalone browser demo (SVG preview + download)
```

### Data model

`generateContourScene()` runs marching squares with an asymptotic saddle
decider, stitches each contour into continuous paths, then applies the same
local Bezier smoothing rule to every path.

```js
{
  width, height,
  backgroundColor: '#dfb2b6',
  contours: [
    {
      threshold: 0.5,
      color: '#96000e',
      strokeWidth: 3,
      paths: [{ points: [{x,y}, ...], closed: false }]
    }
  ],
  fills: [
    { color: '#96000e', polygons: [[{x,y}, ...], ...] }
  ]
}
```

Adapters translate that scene for each platform:

| Adapter | Output |
|---------|--------|
| `svg-export.js` | SVG file / string |
| `adapters/figma.js` | Vector network payloads for `figma.createVector()` |
| future: `sketch.js`, `penpot.js`, `framer.js` | same scene, different API |

## Dependencies

- **Demo only:** [p5.js](https://p5js.org) + `lib/p5.colorGenerator.js` (your 1-file palette library) for color matching with `contour-lines/`
- **Core / Figma:** no p5 — uses built-in hex fallback in `core/palette.js`, or pass pre-resolved `colors` into `generateContourScene()`

**Not in core.** The marching-squares pipeline already produces points; SVG and Figma only need polylines.

Paper.js is useful later as an **optional post-processor**:

- path simplification (Ramer–Douglas–Peucker)
- smoothing jagged contours into curves
- boolean union for vector fill bands
- SVG import/export round-trips

For a Figma plugin v1, skip Paper.js — fewer dependencies, smaller bundle, faster sandbox startup.

## Demo

```bash
cd contour-vector
python3 -m http.server 8080
```

Open `http://localhost:8080/demo/` — live SVG preview + download.

## Figma plugin path

1. Copy `core/` + `adapters/figma.js` into your plugin `src/`
2. Plugin UI collects params (or mirrors the demo controls)
3. Worker calls `generateContourScene()` → `sceneToFigmaVectors()`
4. Create a frame + background rect + vector nodes per path

Set `params.fillEnabled` to `true` to include editable vector fill-band
polygons beneath the contour strokes in SVG and Figma output.

## What's not vector yet

- **Image-based fields** — planned; would plug into `field.js` as another sampler.

## API quick start

```js
import { generateContourScene, exportSvg } from './core/index.js';

const scene = generateContourScene({
  width: 1080,
  height: 1080,
  params: { /* same shape as contour-lines params */ },
  time: 0,
});

const svg = exportSvg(scene, { pretty: true });
```
