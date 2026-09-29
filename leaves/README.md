# Watercolor Leaves

A generative p5.js sketch that arranges stylized leaves into a deterministic watercolor composition. Each leaf uses curved Bézier geometry, a flow field for direction, collision-aware placement, and p5.brush for texture.

## Run locally

From the repository root:

```bash
python3 -m http.server 8081
```

Then open [http://localhost:8081/leaves/](http://localhost:8081/leaves/).

The sketch loads pinned versions of p5.js, p5.brush, and Tweakpane from jsDelivr, so it requires an internet connection.

## Controls

Use the Tweakpane panel to change the seed, leaf count, directional flow, rotation jitter, spacing, and paper color. The seed is stored in the page URL, making a composition reproducible and shareable.

- `R`: create a new seed
- `D`: show or hide collision geometry
- `S`: save the composition as a PNG
