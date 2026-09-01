# Three-Body Problem

An interactive 2D visualization of the classic three-body gravitational problem, built with [p5.js](https://p5js.org/) and [Tweakpane](https://tweakpane.github.io/docs/).

Three bodies orbit each other under Newtonian gravity, integrated with Velocity Verlet for stability. Trails fade over time so you can read the shape of chaotic and periodic orbits.

## Controls

- **Presets** — Figure-8, Lagrange, Butterfly I/II, Moth I, Yin-Yang I, Dragonfly, Bumblebee, Goggles, Yarn, Pythagorean (3-4-5 triangle), and Random chaos
- **Per body** — color, mass, speed, and launch angle
- **Trails** — toggle, fade duration, and line weight
- **Simulation** — pause, time scale, reset, and reset view
- **Mouse** — scroll to zoom (toward cursor), drag to pan, Reset view button

## Run locally

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/three-body/index.html
