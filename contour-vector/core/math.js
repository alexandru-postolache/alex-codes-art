export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mapRange(value, start1, stop1, start2, stop2) {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

export function seedHash(seed, channel = 0) {
  const n = Math.sin((seed + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export const TAU = Math.PI * 2;
