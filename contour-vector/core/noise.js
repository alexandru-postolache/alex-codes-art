import { lerp } from './math.js';

/**
 * Portable Perlin noise (no p5 / canvas dependency).
 */
export class NoiseField {
  constructor(seed = 0) {
    this.perm = new Uint8Array(512);
    this.setSeed(seed);
  }

  setSeed(seed) {
    const source = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      source[i] = i;
    }

    let state = seed >>> 0;
    for (let i = 255; i > 0; i--) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const j = state % (i + 1);
      const tmp = source[i];
      source[i] = source[j];
      source[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = source[i & 255];
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    const lerpW = (a, b, t) => a + t * (b - a);

    return lerpW(
      lerpW(
        lerpW(this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z), u),
        lerpW(this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lerpW(
        lerpW(this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1), u),
        lerpW(this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    ) * 0.5 + 0.5;
  }
}

export function sampleFbm(noise, gx, gy, z, detail, falloff, scale) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < detail; octave++) {
    value += noise.noise3D(gx * scale * frequency, gy * scale * frequency, z + octave * 17.17) * amplitude;
    total += amplitude;
    amplitude *= falloff;
    frequency *= 2;
  }

  return total > 0 ? value / total : 0;
}
