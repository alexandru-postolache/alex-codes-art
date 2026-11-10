# Autotile

A full-screen painter for autotiles. The grid can be squares, hexagons, or triangles. The rule decides which tile a cell uses.

**Marching squares** reads the corners a cell shares with its neighbors. **Blob** reads which neighboring cells are filled. **Block** is two tiles: the cell is on or off.

By default the shape is drawn in one color. Upload a tileset, or drop it on the canvas, and the same mask picks a sprite from the sheet for that rule.

## Run it

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/autotile/

## Paint

Left drag paints. Right drag erases. Hold Shift to erase with the left button. **Rule** picks marching squares, blob, or block. Each rule keeps its own paint, so switching rules does not throw the others away.

With marching squares, **Cells** sets every corner of the cells you touch, and **Corners** sets the vertices themselves. Blob and block paint whole cells. A blob tile is the pattern of filled neighbors. A block tile is only on or off.

The first frame is a noise fill so the autotile is visible immediately. Clear it if you want an empty sheet.

Filled corners meet at the midpoint of each mixed edge. **Fill** paints the shape; turn it off to draw only the border. **Internal lines** keeps the border between neighboring tiles; turn it off to stroke only the outer contour. **Edges** are straight or rounded. Rounded fill is still one shape: the same region as the straight fill, with the corners rounded off. The same choice is used for one-color tiles and for the generated template.

## Tileset sheets

Each rule has its own sheet. Edit, download, and upload use that sheet for the current rule and cell.

Marching-square corner bits run clockwise. Bit 0 is the first corner listed below.

Each cell type has one sheet. The painter rotates and reflects those tiles, so you draw only the distinct shapes.

Square sheets are one row of 6 tiles. Bit 0 is the top-left:

```
0---1
|   |
3---2
```

The row, left to right: empty, top-left corner, top edge, opposite corners, three corners (all but the bottom-left), and the full cell. Turns of 90° and mirrors cover all 16 masks.

Triangle sheets are one row of 4 up triangles: empty, one corner, two corners, and full. Bit 0 is the apex, then clockwise. Turns of 120° cover the other corners. Down triangles flip that row.

```
    0
   / \
  2---1
```

Hex sheets are one row of 13 tiles. Bit 0 is the top corner on a pointy grid, or the right corner on a flat grid, then clockwise. Rotation and reflection cover all 64 masks.

Blob sheets are the distinct neighbor patterns under rotation and reflection: 14 for squares (the full set is 47), 4 for triangles, and 13 for hexes. Block sheets are two tiles, off then on.

**Edit tiles** opens a pixel editor for that same sheet. Draw with the pencil, eraser, fill, and eyedropper. Right drag erases. **Shape behind** paints the marching shape under your pixels, and **Reset sheet to shapes** replaces the whole sheet with it. The strip under the canvas shows every rotation, reflection, and triangle flip of the selected tile. The small preview places the sheet on a blob. **Use in autotile** sends the sheet to the painter. **Download PNG** saves it, and dropping that file on the canvas loads it again. **Load image** opens a sheet in the editor.

**Download template** saves a numbered guide in that same layout. Empty cells are the background color, and each cell has a border and its index. **Use generated sheet** paints with those tiles and no numbers or borders.

Changing cell type does not throw the sheet away. It is used again when you switch back. Crisp pixels keeps uploaded pixel art from blurring.

## Keys

`H` hides the panel. `G` toggles grid lines. `[` and `]` change the brush. `Ctrl`+`Z` or `Cmd`+`Z` undoes. `S` saves a PNG of the canvas without the hover outline.

## Tests

```bash
node --test autotile/test/marching.test.mjs autotile/test/rules.test.mjs
```
