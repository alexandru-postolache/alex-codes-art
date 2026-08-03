# Mandala Maker — Part 1

The first step in the mandala tutorial series. Build a **symmetrical mandala** with mouse drawing — every stroke is mirrored and rotated around the center.

## What it does

- Radial symmetry by rotating and mirroring each stroke around the canvas center
- Smooth mouse input with `lerp()` for less jittery lines
- Speed-based stroke thickness mapped from drawing velocity
- Off-screen buffer via `createGraphics()` for persistent strokes
- Tweakpane panel for symmetry count, smoothing, colors, and motion settings

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/mandala/01-basic-sketch/index.html.

## Blog tutorial

[Drawing a Mandala with p5.js: Smooth Lines, Speed-Based Thickness & Tweakpane — Part 1](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1/)
