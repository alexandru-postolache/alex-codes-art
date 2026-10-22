# Alex Codes Art

**Art with code for curious minds.**

This repository contains the source code for interactive [p5.js](https://p5js.org/) sketches featured on [Alex Codes Art](https://alexcodesart.com/) — a creative coding blog by Alex Postolache. Each folder is a self-contained project you can run locally in the browser.

## Projects

| Folder | Description | Blog tutorial |
|--------|-------------|---------------|
| [`drums/`](drums/) | Rudiment trainer, groove lessons, fill generator, and sticking desk with Web MIDI for the Alesis Nitro Max | — |
| [`leaves/`](leaves/) | Deterministic watercolor leaves with flow-field placement and live controls | — |
| [`flow-field/`](flow-field/) | Particles that trace a noise flow field, with color schemes, spacing controls, and high-resolution export | — |
| [`metro/`](metro/) | Interactive transit diagram of colored routes, stations, shared paths, and 45-degree bends | — |
| [`polyomino/`](polyomino/) | Unequal connected polyomino partitions, drawn as ink outlines or with shader looks such as liquid glass | — |
| [`contour-lines/`](contour-lines/) | Animated topographic contours from a noise field, drawn with marching squares and optional fill bands | — |
| [`contour-vector/`](contour-vector/) | Vector contour output for SVG and Figma, with a browser demo separate from the canvas sketch | — |
| [`wfc/`](wfc/) | Interactive Wave Function Collapse visualization with 2D tilesets, Wang tiles, and a 3D mode | [Article draft](wfc/article.md) |
| [`metaballs/`](metaballs/) | Animated organic blobs rendered with GLSL shaders and signed distance functions | [Create Animated Metaballs with Shaders in p5.js](https://alexcodesart.com/create-animated-metaballs-with-shaders-in-p5-js-a-creative-coding-tutorial/) |
| [`mandala/`](mandala/) | Interactive mandala maker with symmetry, fading trails, curvy motion, and Web MIDI | [Mandala series (parts 1–3)](mandala/) |
| [`radial-strokes/`](radial-strokes/) | Generative radial arc strokes with color gradients and live controls | [Building Interactive Radial Strokes with p5.js](https://alexcodesart.com/mastering-creative-coding-building-interactive-radial-strokes-with-p5-js/) |
| [`lesson-7/`](lesson-7/) | Geometric abstract art with stacked, rounded rectangles and palette switching | [Build Geometric Abstract Art with p5.js](https://alexcodesart.com/learn-creative-coding-build-geometric-abstract-art-with-p5-js/) |
| [`lesson-10/`](lesson-10/) | Animated noisy circles built from polar coordinates and Perlin noise | [Drawing Noisy Circles with p5.js](https://alexcodesart.com/drawing-noisy-circles-with-p5-js-a-deep-dive-into-polar-coordinates-and-perlin-noise/) |
| [`l-system/`](l-system/) | Fractal plants, Koch curves, and more via L-systems and turtle graphics | [Drawing Fractals with L-Systems in p5.js](https://alexcodesart.com/drawing-fractals-with-l-systems-in-p5-js-a-creative-coding-tutorial/) |
| [`kinesiology/`](kinesiology/) | 3D skeleton lab for joint motion, ranges, and the muscles that produce them | — |

## Running a sketch

Sketches must be served over HTTP (not opened as `file://`). From the repo root:

```bash
python3 -m http.server 8081
```

Then open a project in your browser, for example:

- http://localhost:8081/wfc/index.html
- http://localhost:8081/metaballs/index.html
- http://localhost:8081/mandala/index.html

Some sketches load p5.js or other libraries from a CDN, so an internet connection is required.

## About the blog

[Alex Codes Art](https://alexcodesart.com/) publishes beginner-friendly tutorials on creative coding, generative art, shaders, and algorithmic music. Projects with a link in the table above have a step-by-step article on the blog.
