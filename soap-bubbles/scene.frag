#ifdef GL_ES
precision highp float;
#endif

#define MAX_BUBBLES 64
#define MAX_POPS 16

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_bubbleCount;
uniform vec4 u_bubbles[MAX_BUBBLES];
uniform int u_popCount;
uniform vec4 u_pops[MAX_POPS];
uniform vec2 u_wand;
uniform float u_blow;
uniform sampler2D u_background;
uniform float u_imageAspect;

varying vec2 vTexCoord;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 coverUV(vec2 uv) {
  float screenAspect = u_resolution.x / u_resolution.y;
  vec2 mapped = uv;
  if (screenAspect > u_imageAspect) {
    mapped.y = (uv.y - 0.5) * (u_imageAspect / screenAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (screenAspect / u_imageAspect) + 0.5;
  }
  return clamp(vec2(mapped.x, 1.0 - mapped.y), 0.001, 0.999);
}

vec3 blurredPark(vec2 uv) {
  vec2 texel = vec2(1.0) / u_resolution;
  vec2 t = coverUV(uv);
  vec3 color = texture2D(u_background, t).rgb * 0.18;
  color += texture2D(u_background, coverUV(uv + vec2( 5.0,  0.0) * texel)).rgb * 0.11;
  color += texture2D(u_background, coverUV(uv + vec2(-5.0,  0.0) * texel)).rgb * 0.11;
  color += texture2D(u_background, coverUV(uv + vec2( 0.0,  5.0) * texel)).rgb * 0.11;
  color += texture2D(u_background, coverUV(uv + vec2( 0.0, -5.0) * texel)).rgb * 0.11;
  color += texture2D(u_background, coverUV(uv + vec2( 8.0,  8.0) * texel)).rgb * 0.095;
  color += texture2D(u_background, coverUV(uv + vec2(-8.0,  8.0) * texel)).rgb * 0.095;
  color += texture2D(u_background, coverUV(uv + vec2( 8.0, -8.0) * texel)).rgb * 0.095;
  color += texture2D(u_background, coverUV(uv + vec2(-8.0, -8.0) * texel)).rgb * 0.095;
  return color;
}

vec3 thinFilm(vec3 normal, float thicknessNm) {
  const float ior = 1.33;
  float ndv = clamp(normal.z, 0.0, 1.0);
  float r0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float fresnel = r0 + (1.0 - r0) * pow(1.0 - ndv, 5.0);
  float sinI = sqrt(max(0.0, 1.0 - ndv * ndv));
  float cosT = sqrt(max(0.0, 1.0 - (sinI / ior) * (sinI / ior)));
  float opd = 2.0 * ior * thicknessNm * cosT;
  vec3 interference = 0.5 + 0.5 * cos(6.283185 * opd / vec3(650.0, 532.0, 450.0));
  float colored = smoothstep(0.02, 0.28, ndv);
  return interference * fresnel * 2.2 * colored
    + vec3(fresnel * 0.75) * (1.0 - colored);
}

vec4 bubbleLayer(vec2 p, vec2 uv, vec4 bubble) {
  if (bubble.z < 2.0 || bubble.w <= 0.0) return vec4(0.0);
  vec2 q = (p - bubble.xy) / bubble.z;
  float d = length(q);
  if (d > 1.0) return vec4(0.0);

  float sphereZ = sqrt(max(0.0, 1.0 - d * d));
  vec3 normal = normalize(vec3(q, sphereZ));
  float seed = hash(bubble.xy * 0.017);
  float angle = atan(q.y, q.x);
  float gravity = q.y * 175.0;
  float flow = sin(angle * 3.0 + u_time * 0.38 + seed * 8.0) * 52.0;
  flow += sin(q.y * 9.0 - u_time * 0.22 + seed * 4.0) * 24.0;
  float thickness = clamp(410.0 + gravity + flow, 90.0, 820.0);
  vec3 film = thinFilm(normal, thickness);

  vec2 refractUV = clamp(uv + normal.xy * (1.0 - d) * 0.018, 0.002, 0.998);
  vec3 refracted = blurredPark(refractUV);
  float rim = smoothstep(0.76, 0.995, d);
  float fresnel = pow(1.0 - normal.z, 3.0);

  vec2 highlightCenter = vec2(-0.34, 0.38);
  float highlight = smoothstep(0.24, 0.03, length(q - highlightCenter));
  float crescent = smoothstep(0.18, 0.02, abs(length(q - vec2(-0.13, 0.13)) - 0.73));
  crescent *= smoothstep(0.3, 0.95, q.y - q.x);

  vec3 color = refracted * (0.96 + sphereZ * 0.04);
  color += film * (0.38 + rim * 1.05);
  color += vec3(1.0, 0.985, 0.94) * highlight * 0.9;
  color += vec3(0.75, 0.9, 1.0) * crescent * 0.24;

  float alpha = 0.035 + rim * 0.38 + fresnel * 0.15 + highlight * 0.42;
  alpha *= bubble.w;
  return vec4(color, clamp(alpha, 0.0, 0.92));
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec4 blowerLayer(vec2 p) {
  float s = min(u_resolution.x, u_resolution.y);
  vec2 c = u_wand;
  float ringRadius = s * 0.17;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  vec2 handleTop = c + vec2(s * 0.018, -ringRadius * 0.8);
  vec2 handleBottom = c + vec2(s * 0.09, -s * 0.47);
  float handleD = sdSegment(p, handleTop, handleBottom);
  float handleMask = smoothstep(s * 0.031, s * 0.022, handleD);
  float handleEdge = smoothstep(s * 0.032, s * 0.027, handleD);
  vec3 handleColor = mix(vec3(0.07, 0.12, 0.16), vec3(0.12, 0.24, 0.29), handleEdge);
  float handleShine = smoothstep(s * 0.014, 0.0, abs(handleD - s * 0.009));
  handleColor += vec3(0.25, 0.48, 0.53) * handleShine * 0.28;
  color = mix(color, handleColor, handleMask);
  alpha = max(alpha, handleMask);

  float ringD = abs(length(p - c) - ringRadius);
  float ringShadow = smoothstep(s * 0.025, s * 0.004, ringD);
  float ringCore = smoothstep(s * 0.018, s * 0.006, ringD);
  vec3 plastic = mix(vec3(0.03, 0.14, 0.18), vec3(0.08, 0.42, 0.46), ringCore);
  plastic += vec3(0.35, 0.82, 0.8) * pow(max(0.0, 1.0 - ringD / (s * 0.018)), 5.0) * 0.45;
  color = mix(color, plastic, ringShadow);
  alpha = max(alpha, ringShadow);

  float inside = 1.0 - smoothstep(ringRadius - s * 0.022, ringRadius - s * 0.008, length(p - c));
  vec2 filmQ = (p - c) / ringRadius;
  vec3 filmNormal = normalize(vec3(filmQ, sqrt(max(0.04, 1.0 - dot(filmQ, filmQ)))));
  vec3 film = thinFilm(filmNormal, 370.0 + filmQ.y * 180.0 + sin(filmQ.x * 7.0 + u_time) * 35.0);
  float membrane = inside * (0.055 + smoothstep(0.5, 1.0, length(filmQ)) * 0.08);
  color = mix(color, vec3(0.72, 0.9, 0.94) + film, membrane);
  alpha = max(alpha, membrane);

  vec2 palm = handleBottom + vec2(-s * 0.01, s * 0.015);
  vec2 palmQ = (p - palm) / vec2(s * 0.085, s * 0.12);
  float hand = smoothstep(1.05, 0.9, length(palmQ));
  vec3 skin = vec3(0.68, 0.42, 0.28);
  skin *= 0.88 + 0.12 * smoothstep(-1.0, 0.6, palmQ.x);
  color = mix(color, skin, hand);
  alpha = max(alpha, hand);

  return vec4(color, alpha);
}

vec4 popLayer(vec2 p, vec4 pop) {
  if (pop.z <= 0.0 || pop.w >= 1.0) return vec4(0.0);
  float progress = pop.w;
  float radius = pop.z * (1.0 + progress * 0.65);
  float dist = length(p - pop.xy);
  float ring = smoothstep(5.0, 1.0, abs(dist - radius));
  ring *= 1.0 - progress;
  vec3 color = thinFilm(vec3(0.0, 0.7, 0.72), 360.0 + progress * 220.0);
  float shards = 0.0;
  vec2 q = p - pop.xy;
  float a = atan(q.y, q.x);
  float sector = floor((a + 3.14159) / 6.28318 * 12.0);
  float ray = pop.z * (0.72 + hash(vec2(sector, pop.x)) * 0.65) * progress;
  float angular = abs(fract((a + 3.14159) / 6.28318 * 12.0) - 0.5);
  shards = smoothstep(0.09, 0.0, angular) * smoothstep(8.0, 1.0, abs(dist - ray));
  shards *= smoothstep(1.0, 0.35, progress);
  return vec4(color + vec3(0.8), clamp(ring * 0.7 + shards * 0.9, 0.0, 1.0));
}

void main() {
  vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec2 p = uv * u_resolution;
  vec3 color = blurredPark(uv);

  float vignette = smoothstep(0.78, 0.24, length((uv - 0.5) * vec2(0.82, 1.0)));
  color *= mix(0.62, 1.02, vignette);
  color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), 0.08);

  for (int i = 0; i < MAX_BUBBLES; i++) {
    if (i >= u_bubbleCount) break;
    vec4 layer = bubbleLayer(p, uv, u_bubbles[i]);
    color = mix(color, layer.rgb, layer.a);
  }

  for (int i = 0; i < MAX_POPS; i++) {
    if (i >= u_popCount) break;
    vec4 layer = popLayer(p, u_pops[i]);
    color = mix(color, layer.rgb, layer.a);
  }

  vec4 blower = blowerLayer(p);
  color = mix(color, blower.rgb, blower.a);

  float breath = smoothstep(0.01, 0.26, u_blow);
  float mist = exp(-length(p - u_wand) / (min(u_resolution.x, u_resolution.y) * 0.22));
  color += vec3(0.68, 0.86, 0.9) * mist * breath * 0.08;

  gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.96)), 1.0);
}
