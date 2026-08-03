# Radial Strokes

A generative art sketch that draws colorful **radial arc strokes** from the center of the canvas. Each arc rotates at its own speed and direction, creating a layered, clockwork-like composition.

## What it does

- Generates arcs with random start/end angles, weights, and rotation speeds
- Builds color gradients from a base hue using `p5.colorGenerator` (tints or shades)
- Regenerates the full composition on demand via a `p5.gui.js` control panel
- Animates strokes continuously in `draw()`

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/radial-strokes/index.html.

## Blog tutorial

[Mastering Creative Coding: Building Interactive Radial Strokes with p5.js](https://alexcodesart.com/mastering-creative-coding-building-interactive-radial-strokes-with-p5-js/)
