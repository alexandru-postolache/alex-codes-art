/*
  Looks for a polyomino partition.

  The Tweakpane "look" list is built from POLYOMINO_LOOKS.
  A stroke look uses the canvas outline. A shader look fills
  the same rounded regions and runs POLYOMINO_LOOK_FRAGMENT.

  Shader modes:
    0  liquid glass
    1  frosted glass
    2  enamel

  Liquid glass uses the circular lens profile
  distortion = 1 - sqrt(1 - d^2), with d = 1 on the rim
  and d = 0 once the bezel flattens. The bezel is a narrow
  blur of the mask, so the interior stays optically flat
  and only the rim bends the backdrop.
*/

const POLYOMINO_LOOKS = [
  {
    id: "liquidGlass",
    label: "Liquid glass",
    kind: "shader",
    mode: 0,
    tint: "#f4f7fb",
    refraction: 0.85,
    softness: 0.28,
    shine: 0.9
  },
  {
    id: "frosted",
    label: "Frosted",
    kind: "shader",
    mode: 1,
    tint: "#f7f4ef",
    refraction: 0.35,
    softness: 0.9,
    shine: 0.4
  },
  {
    id: "enamel",
    label: "Enamel",
    kind: "shader",
    mode: 2,
    tint: "#d4654c",
    refraction: 0,
    softness: 0.22,
    shine: 0.7
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
uniform sampler2D uEdge;
uniform sampler2D uScene;
uniform sampler2D uSceneSoft;
uniform vec2 uResolution;
uniform vec3 uPaper;
// p5 writes its own uTint while drawing, so the glass color uses another name.
uniform vec3 uGlassTint;
uniform float uRefraction;
uniform float uSoftness;
uniform float uShine;
uniform float uMode;
uniform float uSpread;

vec2 clipUv(vec2 uv) {
  return clamp(uv, vec2(0.001), vec2(0.999));
}

float sampleEdge(vec2 uv) {
  return texture2D(uEdge, clipUv(uv)).r;
}

vec3 sampleScene(sampler2D tex, vec2 pixel) {
  return texture2D(tex, clipUv(pixel / uResolution)).rgb;
}

void main() {
  vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec2 pixel = uv * uResolution;
  vec2 texel = 1.0 / uResolution;

  float mask = texture2D(uMask, clipUv(uv)).r;
  float cover = smoothstep(0.35, 0.75, mask);

  float field = sampleEdge(uv);
  float distFromEdge = 1.0 - smoothstep(0.5, 0.98, field);
  distFromEdge = clamp(distFromEdge, 0.0, 1.0);

  float left = sampleEdge(uv - vec2(texel.x * 2.0, 0.0));
  float right = sampleEdge(uv + vec2(texel.x * 2.0, 0.0));
  float down = sampleEdge(uv - vec2(0.0, texel.y * 2.0));
  float up = sampleEdge(uv + vec2(0.0, texel.y * 2.0));
  vec2 inward = vec2(right - left, up - down);
  float inwardLength = length(inward);
  vec2 dir = inwardLength > 0.015
    ? inward / inwardLength
    : vec2(0.0);

  float curve = 1.0 - sqrt(max(
    0.0,
    1.0 - distFromEdge * distFromEdge
  ));

  float refractAmount = uRefraction;
  if (uMode > 0.5 && uMode < 1.5) {
    refractAmount = max(uRefraction, 0.28);
  }
  if (uMode > 1.5) {
    refractAmount = 0.0;
  }

  float refractPx = curve * refractAmount * max(uSpread, 8.0) * 1.65;
  vec2 bent = pixel + dir * refractPx;

  vec2 shift = dir * distFromEdge * refractAmount * 8.0;

  vec3 sharpColor = vec3(
    sampleScene(uScene, bent - shift).r,
    sampleScene(uScene, bent).g,
    sampleScene(uScene, bent + shift).b
  );
  vec3 softColor = vec3(
    sampleScene(uSceneSoft, bent - shift).r,
    sampleScene(uSceneSoft, bent).g,
    sampleScene(uSceneSoft, bent + shift).b
  );

  float frost = mix(0.16, 0.46, uSoftness);
  if (uMode > 0.5) {
    frost = mix(0.8, 0.97, uSoftness);
  }
  frost *= mix(0.35, 1.0, 1.0 - distFromEdge);

  vec3 glass = mix(sharpColor, softColor, frost);
  glass = mix(glass, glass * uGlassTint, 0.2);
  glass = mix(glass, uGlassTint, uMode < 0.5 ? 0.04 : 0.55);

  vec3 bevelNormal = normalize(vec3(-dir, 0.7));
  vec3 lightDir = normalize(vec3(-0.42, -0.78, 0.55));
  float lambert = clamp(dot(bevelNormal, lightDir), 0.0, 1.0);

  if (uMode > 1.5) {
    glass = uGlassTint * (0.74 + 0.26 * lambert);
    glass = mix(glass, uPaper, 0.05);
  }

  vec2 lightFlat = normalize(vec2(-0.42, -0.82));
  float lit = clamp(dot(-dir, lightFlat), 0.0, 1.0);
  float fresnel = pow(distFromEdge, 1.7);
  float ring = smoothstep(0.55, 0.92, distFromEdge);

  float shineScale = uMode > 1.5 ? 0.45 : 1.0;
  glass += vec3(1.0) * fresnel * lit * uShine * 0.42 * shineScale;
  glass += vec3(1.0) * ring * lit * uShine * 0.34 * shineScale;
  glass += vec3(0.78, 0.88, 1.0) * fresnel * (1.0 - lit) * uShine * 0.1;
  glass *= 1.0 - fresnel * (1.0 - lit) * 0.2 * shineScale;

  vec2 shadowPixel = pixel - vec2(uSpread * 0.22, uSpread * 0.36);
  float shadowField = sampleEdge(shadowPixel / uResolution);
  float shadow = smoothstep(0.2, 0.65, shadowField) * (1.0 - cover);

  vec3 page = sampleScene(uScene, pixel);
  page *= 1.0 - shadow * 0.36;

  vec3 color = mix(page, clamp(glass, 0.0, 1.0), cover);
  gl_FragColor = vec4(color, 1.0);
}
`;
