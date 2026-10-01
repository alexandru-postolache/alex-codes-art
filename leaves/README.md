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

Use the Tweakpane panel to change:

- composition: seed, leaf count, directional flow, rotation jitter, and spacing
- leaf shape: global size, bend, and the mix of four leaf families
- watercolor: palette, paper color, opacity, bleed, texture, and vein density
- paper: procedural mottling, grain, and fibers

Four composition presets are available:

- `Scatter`: organic flow-field placement
- `Wreath`: leaves arranged around a circular path
- `Specimen`: a botanical study grid
- `Branch`: leaves attached along a tapered main branch and secondary twigs

The Branch folder selects one consistent leaf family and controls secondary branch count, curvature, thickness, leaf attachment angle, front/back layering, and branch color. Leaves decrease in size from the branch origin toward its terminal sections.

Every visible setting is stored in the page URL, making the complete composition reproducible and shareable.

- `R`: create a new seed
- `D`: show or hide collision geometry
- `S`: save the composition as a PNG
