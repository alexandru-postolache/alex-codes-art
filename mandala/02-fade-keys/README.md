# Mandala Maker — Part 2

The second step in the mandala tutorial series. Builds on part 1 with **fading trails**, **curvy noise motion**, and **multi-line keyboard drawing**.

## What it does

- Stores stroke history and fades older segments by alpha and age
- Hold `C` for organic curvy motion driven by Perlin noise and a sine pulse
- Hold `1`–`9` for parallel wandering lines, each with its own color
- Tweakpane controls for fade behavior, curvy motion, and per-key colors

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/mandala/02-fade-keys/index.html.

## Blog tutorial

[Drawing a Mandala with p5.js: Fading Trails, Curvy Keys & Multi-Line Color — Part 2](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1-2/)
