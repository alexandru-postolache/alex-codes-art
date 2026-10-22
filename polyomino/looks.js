/*
  Looks for a polyomino partition.

  The Tweakpane "look" list is built from POLYOMINO_LOOKS.
  A stroke look uses the canvas outline. A shader look fills
  the same rounded regions and runs POLYOMINO_LOOK_FRAGMENT.

  Shader modes:
    0  liquid glass
    1  frosted glass
    2  enamel
*/

const POLYOMINO_LOOKS = [
  {
    id: "liquidGlass",
    label: "Liquid glass",
    kind: "shader",
    mode: 0,
    tint: "#f4f7fb",
    refraction: 0.72,
    softness: 0.32,
    shine: 0.95
  },
  {
    id: "frosted",
    label: "Frosted",
    kind: "shader",
    mode: 1,
    tint: "#f7f4ef",
    refraction: 0.18,
    softness: 0.86,
    shine: 0.42
  },
  {
    id: "enamel",
    label: "Enamel",
    kind: "shader",
    mode: 2,
    tint: "#d4654c",
    refraction: 0,
    softness: 0.22,
    shine: 0.78
  },
  {
    id: "outline",
    label: "Outline",
    kind: "stroke"
  }
];

function polyominoLook(id) {
  for (let i = 0; i < POLYOMINO_LOOKS.length; i++) {
    if (POLYOMINO_LOOKS[i].id === id) {
      return POLYOMINO_LOOKS[i];
    }
  }

  return POLYOMINO_LOOKS[0];
}

const POLYOMINO_LOOK_VERTEX = `
precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const POLYOMINO_LOOK_FRAGMENT = `
precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uMask;
uniform vec2 uResolution;
uniform vec3 uPaper;
// p5 writes its own uTint while drawing, so the glass color uses another name.
uniform vec3 uGlassTint;
uniform float uRefraction;
uniform float uSoftness;
uniform float uShine;
uniform float uMode;
uniform float uSpread;

float sampleMask(vec2 uv) {
  uv = clamp(uv, vec2(0.001), vec2(0.999));
  return texture2D(uMask, uv).r;
}

float blurMask(vec2 uv, float radius) {
  vec2 texel = 1.0 / uResolution;
  vec2 r = texel * max(radius, 1.0);

  float sum = sampleMask(uv) * 2.0;
  sum += sampleMask(uv + vec2(r.x, 0.0));
  sum += sampleMask(uv - vec2(r.x, 0.0));
  sum += sampleMask(uv + vec2(0.0, r.y));
  sum += sampleMask(uv - vec2(0.0, r.y));
  sum += sampleMask(uv + vec2(r.x, r.y) * 0.72);
  sum += sampleMask(uv + vec2(-r.x, r.y) * 0.72);
  sum += sampleMask(uv + vec2(r.x, -r.y) * 0.72);
  sum += sampleMask(uv + vec2(-r.x, -r.y) * 0.72);
  sum += sampleMask(uv + vec2(r.x * 0.38, r.y * 0.22));
  sum += sampleMask(uv + vec2(-r.x * 0.38, r.y * 0.22));
  sum += sampleMask(uv + vec2(r.x * 0.22, -r.y * 0.38));
  sum += sampleMask(uv + vec2(-r.x * 0.22, -r.y * 0.38));

  return sum / 14.0;
}

vec3 wallpaper(vec2 uv) {
  vec2 p = uv * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  p *= 3.4;

  float a = sin(p.x * 1.6 + p.y * 0.7);
  float b = sin(p.x * 0.85 - p.y * 1.35 + 1.4);
  float c = sin((p.x + p.y) * 1.15 + 0.6);

  vec3 warm = vec3(0.93, 0.55, 0.38);
  vec3 cool = vec3(0.36, 0.58, 0.90);
  vec3 leaf = vec3(0.46, 0.70, 0.56);
  vec3 blush = vec3(0.94, 0.72, 0.76);

  vec3 field = mix(warm, cool, 0.5 + 0.5 * a);
  field = mix(field, leaf, 0.22 + 0.22 * b);
  field = mix(field, blush, 0.12 + 0.12 * c);

  return field;
}

vec3 blurredWallpaper(vec2 uv, float radius) {
  vec2 texel = 1.0 / uResolution;
  vec2 r = texel * radius;
  vec3 sum = wallpaper(uv) * 2.0;

  sum += wallpaper(uv + vec2(r.x, 0.0));
  sum += wallpaper(uv - vec2(r.x, 0.0));
  sum += wallpaper(uv + vec2(0.0, r.y));
  sum += wallpaper(uv - vec2(0.0, r.y));
  sum += wallpaper(uv + vec2(r.x, r.y) * 0.7);
  sum += wallpaper(uv + vec2(-r.x, r.y) * 0.7);
  sum += wallpaper(uv + vec2(r.x, -r.y) * 0.7);
  sum += wallpaper(uv + vec2(-r.x, -r.y) * 0.7);

  return sum / 10.0;
}

void main() {
  vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec2 texel = 1.0 / uResolution;

  float mask = sampleMask(uv);
  float cover = smoothstep(0.28, 0.72, mask);

  float radius = max(uSpread, 8.0);
  float heightHere = blurMask(uv, radius);
  float stepPx = 3.0;
  float heightX = blurMask(uv + vec2(texel.x * stepPx, 0.0), radius);
  float heightY = blurMask(uv + vec2(0.0, texel.y * stepPx), radius);
  vec2 slope = vec2(heightX - heightHere, heightY - heightHere);

  vec3 normal = normalize(vec3(-slope.x * 28.0, -slope.y * 28.0, 1.0));
  vec3 lightDir = normalize(vec3(-0.35, -0.72, 0.60));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);

  float lambert = clamp(dot(normal, lightDir), 0.0, 1.0);
  float facing = dot(normalize(slope + vec2(0.0001)), normalize(vec2(-0.35, -0.85)));
  float spec = pow(clamp(dot(normal, halfDir), 0.0, 1.0), mix(24.0, 64.0, uShine));

  float hardL = sampleMask(uv - vec2(texel.x * 1.5, 0.0));
  float hardR = sampleMask(uv + vec2(texel.x * 1.5, 0.0));
  float hardD = sampleMask(uv - vec2(0.0, texel.y * 1.5));
  float hardU = sampleMask(uv + vec2(0.0, texel.y * 1.5));
  float edge = length(vec2(hardR - hardL, hardU - hardD));
  float rim = smoothstep(0.12, 0.95, edge);

  vec2 bend = slope * uRefraction * 5.5;
  vec2 bent = clamp(uv + bend, vec2(0.02), vec2(0.98));

  float blurPx = mix(10.0, radius * 0.55, uSoftness);
  vec3 scene = blurredWallpaper(bent, blurPx);

  float chroma = rim * uRefraction * 0.012;
  vec2 chromaDir = normalize(slope + vec2(0.0001));
  vec3 dispersed;
  dispersed.r = blurredWallpaper(bent + chromaDir * chroma, blurPx * 0.5).r;
  dispersed.g = scene.g;
  dispersed.b = blurredWallpaper(bent - chromaDir * chroma, blurPx * 0.5).b;

  vec3 through = mix(scene, dispersed, uMode < 0.5 ? 0.85 : 0.2);

  float milk = uMode < 0.5 ? 0.1 : 0.72;
  vec3 body = mix(through, uGlassTint, milk);

  if (uMode > 1.5) {
    float shade = 0.72 + 0.28 * lambert;
    body = uGlassTint * shade;
    body = mix(body, uPaper, 0.06);
  }

  float lightRim = rim * pow(clamp(facing, 0.0, 1.0), 1.2);
  float darkRim = rim * pow(clamp(-facing, 0.0, 1.0), 1.5);
  float broad = pow(clamp(lambert, 0.0, 1.0), 3.0) * cover;

  vec3 glass = body;
  glass += vec3(1.0) * spec * uShine * (uMode > 1.5 ? 0.22 : 0.38);
  glass += vec3(1.0) * lightRim * uShine * 0.42;
  glass += vec3(0.75, 0.86, 1.0) * broad * uShine * (uMode < 0.5 ? 0.16 : 0.05);
  glass *= 1.0 - darkRim * (uMode > 1.5 ? 0.12 : 0.38);

  if (uMode < 1.5) {
    float clearCenter = smoothstep(0.2, 0.75, heightHere);
    glass = mix(glass, through, clearCenter * (uMode < 0.5 ? 0.35 : 0.1));
  }

  vec2 shadowUv = uv - vec2(10.0, 14.0) / uResolution;
  float shadowMask = blurMask(shadowUv, radius * 0.45);
  float shadow = smoothstep(0.12, 0.55, shadowMask) * (1.0 - cover);

  vec3 page = uPaper;
  if (uMode < 1.5) {
    page = mix(uPaper, wallpaper(uv), 0.14);
  }
  page *= 1.0 - shadow * 0.34;

  vec3 color = mix(page, clamp(glass, 0.0, 1.0), cover);
  gl_FragColor = vec4(color, 1.0);
}
`;
