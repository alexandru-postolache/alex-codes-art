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
uniform sampler2D u_blower;
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
  float rim = smoothstep(0.7, 0.995, d);
  float fresnel = pow(1.0 - normal.z, 3.0);

  vec2 highlightCenter = vec2(-0.34, 0.38);
  float highlight = smoothstep(0.3, 0.04, length(q - highlightCenter));
  float crescent = smoothstep(0.22, 0.025, abs(length(q - vec2(-0.13, 0.13)) - 0.73));
  crescent *= smoothstep(0.3, 0.95, q.y - q.x);
  float innerGlow = smoothstep(1.0, 0.1, d) * (0.5 + 0.5 * normal.z);

  vec3 color = refracted * (0.92 + sphereZ * 0.08);
  color += film * (0.2 + rim * 0.62);
  color += vec3(1.0, 0.985, 0.94) * highlight * 0.64;
  color += vec3(0.75, 0.9, 1.0) * crescent * 0.18;
  color += vec3(0.7, 0.86, 0.9) * innerGlow * 0.035;

  float alpha = 0.13 + rim * 0.23 + fresnel * 0.1 + highlight * 0.27;
  alpha *= bubble.w;
  return vec4(color, clamp(alpha, 0.0, 0.92));
}

vec4 blowerLayer(vec2 screenUV) {
  vec2 assetUV;
  assetUV.x = (screenUV.x - 0.5) / 1.25 + 0.5;
  assetUV.y = (screenUV.y - 0.5) / 0.8;

  float inside = step(0.0, assetUV.x) * step(assetUV.x, 1.0)
    * step(0.0, assetUV.y) * step(assetUV.y, 1.0);
  vec4 asset = texture2D(u_blower, clamp(assetUV, 0.001, 0.999));
  asset.a *= inside;

  float contactShadow = smoothstep(0.0, 0.5, asset.a) * 0.16;
  asset.rgb = mix(asset.rgb, asset.rgb * vec3(0.92, 0.96, 0.98), contactShadow);
  return asset;
}

vec4 popLayer(vec2 p, vec4 pop) {
  if (pop.z <= 0.0 || pop.w >= 1.0) return vec4(0.0);
  float progress = pop.w;
  float radius = pop.z * (1.0 + progress * 0.65);
  float dist = length(p - pop.xy);
  float ring = 1.0 - smoothstep(1.0, 9.0, abs(dist - radius));
  ring *= 1.0 - progress;
  vec3 rainbow = 0.58 + 0.42 * cos(
    6.28318 * (progress + vec3(0.0, 0.33, 0.67))
  );
  vec3 color = mix(vec3(0.82, 0.96, 1.0), rainbow, 0.48);
  float shards = 0.0;
  vec2 q = p - pop.xy;
  float a = atan(q.y, q.x);
  float sector = floor((a + 3.14159) / 6.28318 * 12.0);
  float ray = pop.z * (0.72 + hash(vec2(sector, pop.x)) * 0.65) * progress;
  float angular = abs(fract((a + 3.14159) / 6.28318 * 12.0) - 0.5);
  shards = (1.0 - smoothstep(0.0, 0.13, angular))
    * (1.0 - smoothstep(1.0, 12.0, abs(dist - ray)));
  shards *= 1.0 - smoothstep(0.35, 1.0, progress);
  float flash = (1.0 - smoothstep(0.0, 0.24, progress))
    * (1.0 - smoothstep(0.0, pop.z * 0.9, dist));
  float halo = (1.0 - smoothstep(4.0, 16.0, abs(dist - radius * 1.08)))
    * (1.0 - progress) * 0.46;
  float droplets = (1.0 - smoothstep(0.0, 0.16, angular))
    * (1.0 - smoothstep(1.0, 6.0, abs(dist - ray * 1.24)))
    * (1.0 - smoothstep(0.55, 1.0, progress));
  return vec4(
    color + vec3(0.34),
    clamp(ring + halo + shards + droplets + flash * 0.52, 0.0, 1.0)
  );
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

  vec4 blower = blowerLayer(vTexCoord);
  color = mix(color, blower.rgb, blower.a);

  float breath = smoothstep(0.01, 0.26, u_blow);
  float mist = exp(-length(p - u_wand) / (min(u_resolution.x, u_resolution.y) * 0.22));
  color += vec3(0.68, 0.86, 0.9) * mist * breath * 0.08;

  gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.96)), 1.0);
}
