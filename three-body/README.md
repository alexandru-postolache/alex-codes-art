# N-Body Problem

An interactive 3D n-body gravitational simulation, built with [p5.js](https://p5js.org/) and [Tweakpane](https://tweakpane.github.io/docs/).

Two to ten bodies orbit each other under Newtonian gravity, integrated with adaptive RK4 so close approaches stay accurate. Catalog presets (Figure-8, Lagrange, Šuvakov families) stay planar; extra bodies and the Random preset move in 3D. Trails fade over time so you can read the shape of chaotic and periodic orbits. A GPU bloom pass adds soft colored halos around trails and bodies without mirroring the canvas. The scene sits in a starfield over a deep navy–purple nebula gradient so the orbits feel like they are happening in space.

## Controls

- **Presets** — Figure-8, Lagrange, Butterfly I/II, Moth I, Yin-Yang I, Dragonfly, Bumblebee, Goggles, Yarn, Pythagorean (3-4-5 triangle), and Random chaos
- **Bodies** — 2 to 10. Catalog presets start with 3; raise the count to drop extra 3D wanderers into the same system
- **Per body** — color, mass, speed, azimuth, and elevation
- **Trails** — toggle, fade duration, and line weight
- **Glow** — toggle, intensity, and radius (GPU bloom). Intensity 0 and intensity > 0 keep the same orientation
- **Simulation** — pause, time scale, grid, stars, reset, and reset view
- **Mouse** — drag to orbit, scroll to zoom, right/middle/shift-drag to pan
- **Keyboard** — WASD pan, Q/E up/down, arrow keys orbit, +/− zoom, R reset view

## Run locally

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/three-body/index.html
