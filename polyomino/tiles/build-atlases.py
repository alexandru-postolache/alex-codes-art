# Pack each biome folder into one sprite atlas.
# Run from the repo root: python3 polyomino/tiles/build-atlases.py

import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
BIOMES = os.path.join(ROOT, "biomes")
OUT = os.path.join(ROOT, "atlases")

SIZES = ["Big01", "Big02", "Big03", "Mid01", "Mid02", "Mid03", "Small01", "Small02", "Small03"]
SIZES_FULL = ["Big01", "Big02", "Big03", "Full", "Mid01", "Mid02", "Mid03", "Small01", "Small02", "Small03"]

SETS = [
    ("Grass", "Grass", SIZES),
    ("Field", "GrassField", SIZES_FULL),
    ("Forest", "GrassForest", SIZES_FULL),
    ("Ground", "GrassGround", SIZES_FULL),
    ("House", "GrassHouse", SIZES),
    ("Stone", "GrassStone", SIZES_FULL),
    ("Tree", "GrassTree", SIZES_FULL),
    ("Village", "GrassVillage", SIZES),
    ("Water", "GrassWater", SIZES_FULL),
]

COLUMNS = 2


def row_alpha(px, width, height, y):
    x0 = int(width * 0.25)
    x1 = int(width * 0.75)
    total = 0
    count = 0
    x = x0
    while x < x1:
        total += px[x, y][3]
        count += 1
        x += 14
    return total / count if count else 0


def soil_row(px, width, y):
    x0 = int(width * 0.25)
    x1 = int(width * 0.75)
    soil = 0
    opaque = 0
    x = x0
    while x < x1:
        red, green, blue, alpha = px[x, y]
        if alpha >= 150:
            opaque += 1
            if (
                red > 105
                and blue < 105
                and red > green + 18
                and green < 165
                and not (red > 200 and green > 150)
            ):
                soil += 1
        x += 10
    return opaque > 8 and soil / opaque > 0.85


def measure(image):
    width, height = image.size
    px = image.load()
    top = 0
    while top < height - 1 and row_alpha(px, width, height, top) < 240:
        top += 1

    rows = []
    y = int(height * 0.75)
    while y < height - 6:
        rows.append((y, soil_row(px, width, y)))
        y += 2

    soil = int(height * 0.82)
    for index, (row_y, _) in enumerate(rows):
        window = rows[index:index + 8]
        rest = rows[index:]
        if len(window) < 8:
            break
        window_score = sum(1 for _, flag in window if flag) / len(window)
        rest_score = sum(1 for _, flag in rest if flag) / len(rest)
        if window_score >= 0.75 and rest_score >= 0.85:
            soil = max(0, row_y - 16)
            break

    if soil <= top + 20:
        soil = int(height * 0.82)

    return top, soil


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []

    for folder, stem, names in SETS:
        paths = [
            os.path.join(BIOMES, folder, f"{stem}{name}.png")
            for name in names
        ]
        images = [Image.open(path).convert("RGBA") for path in paths]
        width, height = images[0].size
        for image, path in zip(images, paths):
            if image.size != (width, height):
                raise SystemExit(f"{path} is {image.size}, expected {(width, height)}")

        columns = COLUMNS
        rows = (len(images) + columns - 1) // columns
        atlas = Image.new("RGBA", (columns * width, rows * height), (0, 0, 0, 0))
        frames = []

        for index, image in enumerate(images):
            column = index % columns
            row = index // columns
            origin_x = column * width
            origin_y = row * height
            atlas.paste(image, (origin_x, origin_y))
            top, soil = measure(image)
            frames.append({
                "name": os.path.splitext(os.path.basename(paths[index]))[0],
                "x": origin_x,
                "y": origin_y,
                "width": width,
                "height": height,
                "top": top,
                "soil": soil,
            })
            image.close()

        file_name = f"{folder}.png"
        destination = os.path.join(OUT, file_name)
        atlas.save(destination, optimize=True, compress_level=6)
        atlas.close()
        manifest.append({
            "name": folder,
            "file": file_name,
            "frames": frames,
        })
        print(f"{folder}: {len(frames)} frames, {columns * width}x{rows * height}")

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
