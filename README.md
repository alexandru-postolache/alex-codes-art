# Alex Codes Art

**Art with code for curious minds.**

This repository contains the source code for interactive [p5.js](https://p5js.org/) sketches featured on [Alex Codes Art](https://alexcodesart.com/) — a creative coding blog by Alex Postolache. Each folder is a self-contained project you can run locally in the browser.

## Projects

| Folder | Description | Blog tutorial |
|--------|-------------|---------------|
| [`wfc/`](wfc/) | Interactive Wave Function Collapse visualization with 2D tilesets, Wang tiles, and a 3D mode | [Article draft](wfc/article.md) |
| [`metaballs/`](metaballs/) | Animated organic blobs rendered with GLSL shaders and signed distance functions | [Create Animated Metaballs with Shaders in p5.js](https://alexcodesart.com/create-animated-metaballs-with-shaders-in-p5-js-a-creative-coding-tutorial/) |
| [`mandala/`](mandala/) | Interactive mandala maker with symmetry, fading trails, curvy motion, and Web MIDI | [Mandala series (parts 1–3)](mandala/) |
| [`radial-strokes/`](radial-strokes/) | Generative radial arc strokes with color gradients and live controls | [Building Interactive Radial Strokes with p5.js](https://alexcodesart.com/mastering-creative-coding-building-interactive-radial-strokes-with-p5-js/) |
| [`lesson-7/`](lesson-7/) | Geometric abstract art with stacked, rounded rectangles and palette switching | [Build Geometric Abstract Art with p5.js](https://alexcodesart.com/learn-creative-coding-build-geometric-abstract-art-with-p5-js/) |
| [`lesson-10/`](lesson-10/) | Animated noisy circles built from polar coordinates and Perlin noise | [Drawing Noisy Circles with p5.js](https://alexcodesart.com/drawing-noisy-circles-with-p5-js-a-deep-dive-into-polar-coordinates-and-perlin-noise/) |
| [`l-system/`](l-system/) | Fractal plants, Koch curves, and more via L-systems and turtle graphics | [Drawing Fractals with L-Systems in p5.js](https://alexcodesart.com/drawing-fractals-with-l-systems-in-p5-js-a-creative-coding-tutorial/) |
| [`tap-to-notation/`](tap-to-notation/) | Tap the spacebar in rhythm and see it transcribed into quantized sheet music | — |

## Running a sketch

Sketches must be served over HTTP (not opened as `file://`). From the repo root:

```bash
python3 -m http.server 8081
```

Then open a project in your browser, for example:

- http://localhost:8081/wfc/index.html
- http://localhost:8081/metaballs/index.html
- http://localhost:8081/mandala/index.html
- http://localhost:8081/tap-to-notation/index.html

Some sketches load p5.js or other libraries from a CDN, so an internet connection is required.

## About the blog

[Alex Codes Art](https://alexcodesart.com/) publishes beginner-friendly tutorials on creative coding, generative art, shaders, and algorithmic music. Every project in this repo walks through the ideas behind the code in a full step-by-step article.
