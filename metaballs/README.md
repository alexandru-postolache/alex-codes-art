# Animated Metaballs

Organic, fluid shapes that morph and merge in real time — rendered entirely on the GPU with **GLSL shaders** and **signed distance functions** (SDFs).

## What it does

- Animates multiple metaballs on looping circular paths
- Blends blob fields with `smoothMin` for gooey merging
- Applies lighting, outlines, color animation, and chromatic aberration in a post-processing pass
- Exposes parameters (count, radius, speed, colors, and more) through a Tweakpane panel

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/metaballs/index.html.

## Blog tutorial

[Create Animated Metaballs with Shaders in p5.js — A Creative Coding Tutorial](https://alexcodesart.com/create-animated-metaballs-with-shaders-in-p5-js-a-creative-coding-tutorial/)
