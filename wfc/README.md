# Wave Function Collapse

An interactive visualization of the **Wave Function Collapse** (WFC) algorithm — the procedural generation technique where each grid cell starts in a superposition of possible tiles, then collapses one by one while constraints ripple outward to neighboring cells.

## What it does

- Step through WFC on a 2D grid with pipe, Wang, and custom tilesets
- Watch entropy, propagation, and backtracking in real time
- Explore a 3D voxel-style variant (`wfc3d.html`)
- Load tile atlases from PNG images for visual tilesets

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/wfc/index.html (2D) or http://localhost:8081/wfc/wfc3d.html (3D).

## Article

The full article draft lives in this folder: [article.md](article.md).
