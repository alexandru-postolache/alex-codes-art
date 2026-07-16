#ifdef GL_ES
precision highp float;
#endif

#define MAX_BUBBLES 64

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_bubbleCount;
uniform vec4 u_bubbles[MAX_BUBBLES];
uniform vec2 u_wand;
uniform float u_blow;
uniform sampler2D u_sharp;
uniform sampler2D u_blurred;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash11(float p) {
  return fract(sin(p) * 43758.5453);
}

vec2 coverUV(vec2 uv) {
  return vec2(uv.x, uv.y);
}

float circleOfConfusion(vec2 uv) {
  vec2 focus = u_wand / u_resolution;
  float vertical = smoothstep(focus.y + 0.06, 0.94, uv.y);
  vec2 delta = (uv - focus) * vec2(1.0, 1.25);
  float radial = smoothstep(0.08, 0.42, length(delta));
  return clamp(max(vertical, radial * 0.55), 0.0, 1.0);
}

vec3 sampleScene(vec2 uv, float blurMix) {
  vec3 sharp = texture2D(u_sharp, uv).rgb;
  vec3 blurred = texture2D(u_blurred, uv).rgb;
  return mix(sharp, blurred, blurMix);
}

vec3 thinFilmReflection(vec3 normal, float thicknessNm) {
  float nFilm = 1.33;
  float nAir = 1.0;
  float ndotV = clamp(normal.z, 0.0, 1.0);
  float r0 = pow((nFilm - nAir) / (nFilm + nAir), 2.0);
  float fresnel = r0 + (1.0 - r0) * pow(1.0 - ndotV, 5.0);

  float sinThetaI = sqrt(max(0.0, 1.0 - ndotV * ndotV));
  float sinThetaT = sinThetaI / nFilm;
  float cosThetaT = sqrt(max(0.0, 1.0 - sinThetaT * sinThetaT));
  float opd = 2.0 * nFilm * thicknessNm * cosThetaT;

  vec3 osc;
  osc.r = 0.5 + 0.5 * cos(6.28318 * opd / 650.0);
  osc.g = 0.5 + 0.5 * cos(6.28318 * opd / 532.0);
  osc.b = 0.5 + 0.5 * cos(6.28318 * opd / 450.0);

  float edgeFade = smoothstep(0.0, 0.22, ndotV);
  vec3 film = osc * fresnel * 2.4 * edgeFade;
  vec3 rimWhite = vec3(fresnel) * (1.0 - edgeFade) * 0.85;
  return film + rimWhite;
}

float fresnelBoost(float ndotV) {
  return pow(1.0 - ndotV, 3.0);
}

vec4 renderBubble(vec2 p, vec4 bubble, vec2 uv) {
  vec2 center = bubble.xy;
  float radius = bubble.z;
  float life = bubble.w;

  if (radius <= 2.0 || life <= 0.0) {
    return vec4(0.0);
  }

  vec2 local = p - center;
  float dist = length(local);
  float nd = dist / radius;

  if (nd > 1.0) {
    return vec4(0.0);
  }

  float z = sqrt(max(0.0, 1.0 - nd * nd));
  vec3 normal = normalize(vec3(local / radius, z));
  float ndotV = clamp(normal.z, 0.0, 1.0);

  float depth = clamp((center.y - u_wand.y) / max(u_resolution.y - u_wand.y, 1.0), 0.0, 1.0);
  float sceneBlur = circleOfConfusion(uv) * 0.35 + depth * 0.45;
  vec2 refractUV = clamp(uv + normal.xy * pow(1.0 - nd, 2.0) * 0.035, 0.001, 0.999);
  vec3 behind = sampleScene(refractUV, sceneBlur);

  float nUvY = local.y / radius;
  float thickness = 420.0 + nUvY * 180.0;
  thickness += sin(atan(local.y, local.x) * 4.0 + u_time * 0.4 + radius) * 60.0;
  thickness += hash(center * 0.01) * 40.0;
  thickness = clamp(thickness, 120.0, 780.0);

  vec3 film = thinFilmReflection(normal, thickness);
  float rim = smoothstep(0.55, 0.97, nd);
  float body = 1.0 - rim;

  vec3 lightDir = normalize(vec3(-0.3, 0.5, 0.8));
  vec3 reflectDir = reflect(vec3(0.0, 0.0, -1.0), normal);
  float spec = pow(max(dot(reflectDir, lightDir), 0.0), 140.0);
  float specSoft = pow(max(dot(reflectDir, lightDir), 0.0), 24.0);

  vec2 hl = center + vec2(-radius * 0.33, radius * 0.3);
  float highlight = smoothstep(radius * 0.16, 0.0, length(p - hl));

  vec3 col = behind;
  col = mix(col, behind * 0.85 + film * 0.55, body * 0.35);
  col = mix(col, film + behind * 0.15, rim * 0.92);
  col += vec3(1.0) * spec * 1.6;
  col += vec3(0.95, 0.98, 1.0) * specSoft * 0.2;
  col += vec3(1.0) * highlight * 0.95;

  float alpha = body * 0.12 + rim * 0.38 + spec * 0.55 + fresnelBoost(ndotV) * 0.1;
  alpha = clamp(alpha * life, 0.0, 0.94);
  return vec4(col, alpha);
}

vec3 renderWand(vec2 p) {
  float s = min(u_resolution.x, u_resolution.y);
  vec2 c = u_wand;
  vec3 color = vec3(0.0);

  float ringRadius = s * 0.135;
  float dist = length(p - c);

  float ringOuter = smoothstep(5.0, 1.5, abs(dist - ringRadius));
  float ringInner = smoothstep(ringRadius - 9.0, ringRadius - 16.0, dist);
  float ring = ringOuter * (1.0 - ringInner);
  vec3 ringColor = mix(vec3(0.85, 0.2, 0.18), vec3(0.2, 0.35, 0.82), step(0.5, hash(vec2(u_time * 0.01))));
  float ringSpec = pow(max(dot(normalize(vec3(p - c, 10.0)), normalize(vec3(-0.2, 0.4, 1.0))), 0.0), 30.0);
  color += ringColor * ring * (0.7 + ringSpec);

  float filmMask = smoothstep(ringRadius - 16.0, ringRadius - 22.0, dist) * (1.0 - ring);
  float soapAngle = atan(p.y - c.y, p.x - c.x);
  float soapThick = 500.0 + sin(soapAngle * 6.0 + u_time * 0.6) * 120.0;
  vec3 soapNormal = normalize(vec3(p - c, ringRadius * 0.5));
  color += thinFilmReflection(soapNormal, soapThick) * filmMask * 0.55;
  color += vec3(0.92, 0.97, 1.0) * filmMask * 0.12;

  vec2 handleBase = c + vec2(s * 0.02, -s * 0.02);
  vec2 handleDir = normalize(vec2(0.12, -1.0));
  vec2 rel = p - handleBase;
  float along = dot(rel, handleDir);
  float perp = abs(dot(rel, vec2(-handleDir.y, handleDir.x)));
  float handle = smoothstep(s * 0.022, 0.0, perp) * smoothstep(s * 0.04, s * 0.38, -along);
  vec3 wood = mix(vec3(0.36, 0.2, 0.1), vec3(0.62, 0.4, 0.2), 0.5 + 0.5 * sin(along * 0.03));
  color += wood * handle;

  vec2 grip = handleBase + handleDir * s * 0.1;
  float gripMask = smoothstep(s * 0.05, 0.0, length(p - grip));
  color = mix(color, vec3(0.9, 0.74, 0.62) * 0.9, gripMask * 0.85);

  float bowl = smoothstep(s * 0.09, s * 0.05, length(p - (c + vec2(0.0, -s * 0.015))));
  color += vec3(0.5, 0.28, 0.12) * bowl * 0.3;

  return color;
}

vec3 renderBlowMist(vec2 p) {
  float haze = smoothstep(0.02, 0.35, u_blow);
  float s = min(u_resolution.x, u_resolution.y);
  float mist = exp(-length(p - u_wand) / (s * 0.16 + haze * s * 0.12)) * haze;
  return vec3(0.94, 0.98, 1.0) * mist * 0.22;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = gl_FragCoord.xy;

  float coc = circleOfConfusion(uv);
  vec3 color = sampleScene(uv, coc);

  float vignette = smoothstep(1.15, 0.35, length(uv - vec2(0.5, 0.45)));
  color *= mix(0.78, 1.0, vignette);

  color += renderWand(p);
  color += renderBlowMist(p);

  float alphaRemain = 1.0;
  for (int i = 0; i < MAX_BUBBLES; i++) {
    if (i >= u_bubbleCount) {
      break;
    }

    vec4 layer = renderBubble(p, u_bubbles[i], uv);
    color = mix(color, layer.rgb, layer.a * alphaRemain);
    alphaRemain *= 1.0 - layer.a;
  }

  color = pow(color, vec3(0.97));
  gl_FragColor = vec4(color, 1.0);
}
