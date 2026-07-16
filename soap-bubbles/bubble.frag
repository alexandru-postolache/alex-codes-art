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
uniform sampler2D u_background;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 bgUV(vec2 uv) {
  return vec2(uv.x, 1.0 - uv.y);
}

float circleOfConfusion(vec2 uv) {
  vec2 focus = u_wand / u_resolution;
  vec2 delta = uv - focus;
  delta.y *= 1.35;
  float radial = length(delta);
  float upward = smoothstep(focus.y - 0.02, focus.y + 0.42, uv.y);
  float downward = smoothstep(focus.y + 0.02, focus.y - 0.18, uv.y) * 0.35;
  return clamp(radial * 1.15 + upward * 0.55 - downward, 0.0, 1.0);
}

vec3 sampleBackground(vec2 uv, float blur) {
  vec2 texUV = bgUV(clamp(uv, 0.001, 0.999));
  vec3 col = texture2D(u_background, texUV).rgb;
  float w = 1.0;
  float radius = blur * 0.045;

  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 off = vec2(cos(a), sin(a)) * radius;
    col += texture2D(u_background, bgUV(clamp(uv + off, 0.001, 0.999))).rgb;
    w += 1.0;
  }

  for (int j = 0; j < 4; j++) {
    float a = float(j) * 1.570796 + 0.4;
    vec2 off = vec2(cos(a), sin(a)) * radius * 2.2;
    col += texture2D(u_background, bgUV(clamp(uv + off, 0.001, 0.999))).rgb;
    w += 1.0;
  }

  return col / w;
}

vec3 thinFilmColor(float thickness, float angle) {
  float phase = thickness * 18.0 + angle * 6.0 + u_time * 0.15;
  vec3 color;
  color.r = 0.5 + 0.5 * cos(phase);
  color.g = 0.5 + 0.5 * cos(phase + 2.094);
  color.b = 0.5 + 0.5 * cos(phase + 4.188);
  return color * vec3(0.85, 0.92, 1.0);
}

vec4 renderBubble(vec2 p, vec4 bubble, vec2 uv) {
  vec2 center = bubble.xy;
  float radius = bubble.z;
  float life = bubble.w;

  if (radius <= 1.0 || life <= 0.0) {
    return vec4(0.0);
  }

  vec2 local = p - center;
  float dist = length(local);
  float nd = dist / radius;

  if (nd > 1.02) {
    return vec4(0.0);
  }

  float z = sqrt(max(0.0, 1.0 - nd * nd));
  vec3 normal = normalize(vec3(local / radius, z));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  float depth = clamp((center.y - u_wand.y) / max(u_resolution.y - u_wand.y, 1.0), 0.0, 1.0);
  float bubbleBlur = depth * 0.75;

  vec2 refractOffset = normal.xy * (1.0 - nd) * 0.12;
  vec3 refracted = sampleBackground(uv + refractOffset, bubbleBlur);

  float rim = smoothstep(0.72, 0.98, nd);
  float innerRim = smoothstep(0.45, 0.72, nd) * (1.0 - rim);
  float angle = atan(local.y, local.x);
  float thickness = 0.55 + nd * 0.8 + sin(angle * 3.0 + u_time * 0.5) * 0.08;
  vec3 film = thinFilmColor(thickness, angle + fresnel);

  vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.82));
  float spec = pow(max(dot(reflect(-viewDir, normal), lightDir), 0.0), 120.0);
  float specSoft = pow(max(dot(reflect(-viewDir, normal), lightDir), 0.0), 28.0);

  vec2 hl1 = center + vec2(-radius * 0.32, radius * 0.28);
  vec2 hl2 = center + vec2(radius * 0.18, radius * 0.35);
  float highlight1 = smoothstep(radius * 0.18, 0.0, length(p - hl1));
  float highlight2 = smoothstep(radius * 0.1, 0.0, length(p - hl2)) * 0.55;

  float bottomShadow = smoothstep(-0.15, -0.75, local.y / radius) * rim;

  vec3 col = refracted;
  col = mix(col, col * 0.92 + film * 0.55, innerRim * 0.45);
  col = mix(col, film * 0.65 + refracted * 0.35, rim * 0.85);
  col += vec3(1.0) * spec * 1.4;
  col += vec3(0.95, 0.98, 1.0) * specSoft * 0.25;
  col += vec3(1.0) * (highlight1 * 0.9 + highlight2);
  col -= vec3(0.08, 0.06, 0.05) * bottomShadow;

  float alpha = (1.0 - nd) * 0.08 + rim * 0.42 + fresnel * 0.18 + spec * 0.6;
  alpha = clamp(alpha * life, 0.0, 0.95);

  return vec4(col, alpha);
}

float sdRoundBox(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float sdEllipse(vec2 p, vec2 ab) {
  p = abs(p);
  if (p.x > p.y) return length(p / ab) - 1.0;
  return length(p / ab.yx) - 1.0;
}

vec3 renderFirstPersonWand(vec2 p) {
  float scale = min(u_resolution.x, u_resolution.y);
  vec2 wand = u_wand;
  vec3 result = vec3(0.0);

  vec2 handleCenter = wand + vec2(0.0, -scale * 0.17);
  float handle = 1.0 - smoothstep(0.0, 1.5, sdRoundBox(p - handleCenter, vec2(scale * 0.028, scale * 0.16), scale * 0.02));
  vec3 wood = mix(vec3(0.42, 0.24, 0.12), vec3(0.58, 0.36, 0.18), 0.5 + 0.5 * sin(p.y * 0.04));
  result += wood * handle;

  vec2 leftHand = wand + vec2(-scale * 0.075, -scale * 0.13);
  vec2 rightHand = wand + vec2(scale * 0.075, -scale * 0.115);
  float handL = 1.0 - smoothstep(0.0, 2.0, sdEllipse(p - leftHand, vec2(scale * 0.055, scale * 0.038)));
  float handR = 1.0 - smoothstep(0.0, 2.0, sdEllipse(p - rightHand, vec2(scale * 0.052, scale * 0.036)));
  vec3 skin = vec3(0.92, 0.76, 0.64);
  result = mix(result, skin * (0.85 + 0.15 * hash(p * 0.01)), clamp(handL + handR, 0.0, 1.0));

  float ringRadius = scale * 0.19;
  float ringDist = abs(length(p - wand) - ringRadius);
  float ring = smoothstep(5.5, 1.5, ringDist) * smoothstep(ringRadius + 8.0, ringRadius - 2.0, length(p - wand));
  vec3 ringColor = vec3(0.78, 0.42, 0.18);
  float ringSpec = pow(max(dot(normalize(vec3(p - wand, 8.0)), normalize(vec3(-0.3, 0.5, 1.0))), 0.0), 24.0);
  result += ringColor * ring * (0.75 + ringSpec * 0.8);

  float inner = smoothstep(ringRadius - 10.0, ringRadius - 18.0, length(p - wand));
  float soapFilm = inner * (1.0 - ring) * 0.55;
  float soapAngle = atan(p.y - wand.y, p.x - wand.x);
  vec3 soap = thinFilmColor(1.2 + sin(soapAngle * 5.0 + u_time) * 0.2, soapAngle) * 0.35;
  soap += vec3(0.9, 0.97, 1.0) * 0.25;
  result += soap * soapFilm;

  float dipBowl = smoothstep(scale * 0.11, scale * 0.07, length(p - (wand + vec2(0.0, scale * 0.02))));
  result += vec3(0.55, 0.32, 0.14) * dipBowl * 0.35;

  return result;
}

vec3 renderBlowMist(vec2 p) {
  float haze = smoothstep(0.02, 0.4, u_blow);
  float scale = min(u_resolution.x, u_resolution.y);
  float mist = exp(-length(p - u_wand) / (scale * 0.22 + haze * scale * 0.18)) * haze;
  float swirl = sin(u_time * 8.0 + length(p - u_wand) * 0.08) * 0.5 + 0.5;
  return vec3(0.92, 0.97, 1.0) * mist * swirl * 0.35;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = gl_FragCoord.xy;

  float coc = circleOfConfusion(uv);
  vec3 color = sampleBackground(uv, coc);

  float vignette = smoothstep(1.2, 0.25, length(uv - vec2(0.5, 0.42)));
  color *= mix(0.72, 1.0, vignette);

  color += renderFirstPersonWand(p);
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

  color = pow(color, vec3(0.96));
  gl_FragColor = vec4(color, 1.0);
}
