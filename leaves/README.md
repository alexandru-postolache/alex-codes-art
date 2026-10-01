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
- `Branch`: a mature tree limb with recursively tapered branches and leaves on smaller twigs

The Branch folder selects one consistent leaf family and controls:

- alternate, opposite, or whorled leaf arrangements
- right, left, top, or bottom canvas entry
- sparse, balanced, or dense growth
- recursive levels, spread, curvature, gravity, and wind
- tip clustering, leaf angle, front/back layering, and branch color
- Spring, Summer, Autumn, and Winter states

Growth uses a dominant continuation branch, thinner lateral branches, crossing rejection, smooth junction collars, and progressively smaller terminal growth. Leaf placement favors smaller twigs. Branch rendering includes directional bark lines, knots, buds, scars, young-twig color variation, and occasional broken tips.

The Export folder provides 600 px, 1800 px, and 3000 px PNG presets, transparent backgrounds, and SVG geometry export.

Every visible setting is stored in the page URL, making the complete composition reproducible and shareable.

- `R`: create a new seed
- `D`: show or hide collision geometry
- `S`: save the composition as a PNG
