# Autotile

A full-screen painter for marching-squares autotiles. The grid can be squares, hexagons, or triangles. Each cell picks its tile from the corners it shares with its neighbors.

By default every filled corner is drawn in one color. Upload a tileset, or drop it on the canvas, and the same corner mask picks a sprite from the sheet.

## Run it

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/autotile/

## Paint

Left drag paints. Right drag erases. Hold Shift to erase with the left button. **Cells** sets every corner of the cells you touch, so a painted cell becomes the full tile and its neighbors become the edge and corner tiles. **Corners** sets the vertices themselves, which is the raw marching-squares field.

The first frame is a noise fill so the autotile is visible immediately. Clear it if you want an empty sheet.

Filled corners meet at the midpoint of each mixed edge. **Fill** paints the shape; turn it off to draw only the border. **Internal lines** keeps the border between neighboring tiles; turn it off to stroke only the outer contour. **Edges** are straight or rounded. The same choice is used for one-color tiles and for the generated template.

## Tileset sheets

Corner bits run clockwise. Bit 0 is the first corner listed below.

Square sheets are one row of 6 tiles. The painter turns a tile clockwise in 90° steps, so these six cover all 16 corner masks. Bit 0 is the top-left:

```
0---1
|   |
3---2
```

The row, left to right: empty, top-left corner, top edge, opposite corners, three corners (all but the bottom-left), and the full cell.

Triangle, 8×2. Row 0 points up, row 1 points down. Bit 0 is the apex. A single row of 8 up triangles also works: down triangles use that row flipped.

```
up          down
    0        2---1
   / \        \ /
  2---1        0
```

Hexagon, 8×8, 64 tiles. Pointy grids start at the top corner. Flat grids start at the right corner. Then clockwise.

**Download template** saves a numbered guide: 6×1 for squares, 8×2 for triangles, and 8×8 for hexes. Empty cells are the background color, and each cell has a border and its index. **Use generated sheet** paints with those tiles and no numbers or borders. Square tiles are rotated to fit the other corner masks.

Changing cell type does not throw the sheet away. It is used again when you switch back. Crisp pixels keeps uploaded pixel art from blurring.

## Keys

`H` hides the panel. `G` toggles grid lines. `[` and `]` change the brush. `Ctrl`+`Z` or `Cmd`+`Z` undoes. `S` saves a PNG of the canvas without the hover outline.

## Tests

```bash
node --test autotile/test/marching.test.mjs
```
