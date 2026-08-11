/**
 * Palette helpers using p5.colorGenerator (requires p5 globals).
 */

function p5ColorToHex(c) {
  const r = Math.round(red(c));
  const g = Math.round(green(c));
  const b = Math.round(blue(c));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function blendPaletteColors(palette, count) {
  if (count <= 0) {
    return [];
  }
  if (palette.length === 0) {
    return [];
  }
  if (count === 1) {
    return [p5ColorToHex(palette[0])];
  }

  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const segment = t * (palette.length - 1);
    const index = Math.min(Math.floor(segment), palette.length - 2);
    const frac = segment - index;
    colors.push(p5ColorToHex(lerpColor(palette[index], palette[index + 1], frac)));
  }
  return colors;
}

export function getPaletteColorsHex(baseColor, paletteType, count) {
  const generator = new ColorGenerator(baseColor);
  const paletteCount = Math.max(1, count);

  switch (paletteType) {
    case 'shades':
      return blendPaletteColors(generator.getShades(paletteCount), paletteCount);
    case 'monochromatic':
      return blendPaletteColors(generator.getMonochromatic(paletteCount, true, true), paletteCount);
    case 'complementary':
      return blendPaletteColors(generator.getComplementary(), paletteCount);
    case 'triadic':
      return blendPaletteColors(generator.getTriadic(), paletteCount);
    case 'analogous':
      return blendPaletteColors(generator.getAnalogous(30), paletteCount);
    case 'splitComplementary':
      return blendPaletteColors(generator.getSplitComplementary(30), paletteCount);
    case 'tetradic':
      return blendPaletteColors(generator.getTetradic(), paletteCount);
    case 'tints':
    default:
      return blendPaletteColors(generator.getTints(paletteCount), paletteCount);
  }
}

export function resolveSceneColors(params, contourCount) {
  const count = Math.max(1, Math.round(contourCount));
  return {
    backgroundColor: params.backgroundColor,
    colors: getPaletteColorsHex(params.baseColor, params.colorPalette ?? 'tints', count),
  };
}
