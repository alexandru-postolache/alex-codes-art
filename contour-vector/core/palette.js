import { lerp } from './math.js';

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const gray = l * 255;
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

function blendPaletteColors(palette, count) {
  if (count <= 1) {
    return [palette[0]];
  }

  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const segment = t * (palette.length - 1);
    const index = Math.min(Math.floor(segment), palette.length - 2);
    const frac = segment - index;
    const a = hexToRgb(palette[index]);
    const b = hexToRgb(palette[index + 1]);
    colors.push(
      rgbToHex(
        lerp(a.r, b.r, frac),
        lerp(a.g, b.g, frac),
        lerp(a.b, b.b, frac)
      )
    );
  }
  return colors;
}

function getTints(baseHex, count) {
  const { r, g, b } = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const next = hslToRgb(h, Math.max(0, s - s * t), Math.min(100, l + (100 - l) * t));
    colors.push(rgbToHex(next.r, next.g, next.b));
  }
  return colors;
}

function getShades(baseHex, count) {
  const { r, g, b } = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const next = hslToRgb(h, s, Math.max(0, l - l * t));
    colors.push(rgbToHex(next.r, next.g, next.b));
  }
  return colors;
}

function rotateHue(baseHex, degrees) {
  const { r, g, b } = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const next = hslToRgb((h + degrees + 360) % 360, s, l);
  return rgbToHex(next.r, next.g, next.b);
}

function getComplementary(baseHex) {
  return [baseHex, rotateHue(baseHex, 180)];
}

function getTriadic(baseHex) {
  return [baseHex, rotateHue(baseHex, 120), rotateHue(baseHex, 240)];
}

function getAnalogous(baseHex, spread = 30) {
  return [rotateHue(baseHex, -spread), baseHex, rotateHue(baseHex, spread)];
}

export function getPaletteColors(baseColor, paletteType, count) {
  const paletteCount = Math.max(1, count);
  let palette;

  switch (paletteType) {
    case 'shades':
      return getShades(baseColor, paletteCount);
    case 'monochromatic':
      return blendPaletteColors(getTints(baseColor, 3), paletteCount);
    case 'complementary':
      palette = getComplementary(baseColor);
      break;
    case 'triadic':
      palette = getTriadic(baseColor);
      break;
    case 'analogous':
      palette = getAnalogous(baseColor, 30);
      break;
    case 'splitComplementary':
      palette = [baseColor, rotateHue(baseColor, 150), rotateHue(baseColor, 210)];
      break;
    case 'tetradic':
      palette = [baseColor, rotateHue(baseColor, 90), rotateHue(baseColor, 180), rotateHue(baseColor, 270)];
      break;
    case 'tints':
    default:
      return getTints(baseColor, paletteCount);
  }

  return blendPaletteColors(palette, paletteCount);
}
