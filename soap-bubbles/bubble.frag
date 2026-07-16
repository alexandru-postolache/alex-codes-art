#ifdef GL_ES
precision mediump float;
#endif

#define MAX_BUBBLES 64

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_bubbleCount;
uniform vec4 u_bubbles[MAX_BUBBLES];
uniform vec2 u_wand;
uniform float u_blow;

// Soft sky gradient with a little animated haze.
vec3 backgroundColor(vec2 uv) {
  vec3 top = vec3(0.45, 0.72, 0.95);
  vec3 bottom = vec3(0.82, 0.93, 0.98);
  vec3 color = mix(bottom, top, clamp(uv.y * 1.1, 0.0, 1.0));

  float glow = sin(uv.x * 8.0 + u_time * 0.2) * sin(uv.y * 6.0 - u_time * 0.15);
  color += vec3(0.04, 0.06, 0.08) * glow;

  return color;
}

// Thin-film style rainbow based on view angle and wobble phase.
vec3 iridescence(float angle, float phase) {
  float hue = fract(angle * 1.6 + phase * 0.17 + u_time * 0.03);
  vec3 a = vec3(1.0);
  vec3 b = vec3(0.72, 0.78, 0.95);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.18, 0.42);

  return a + b * cos(6.28318 * (c * hue + d));
}

// Render one soap bubble shell at pixel position `p`.
vec4 renderBubble(vec2 p, vec4 bubble) {
  vec2 center = bubble.xy;
  float radius = bubble.z;
  float life = bubble.w;

  if (radius <= 0.0 || life <= 0.0) {
    return vec4(0.0);
  }

  vec2 local = p - center;
  float dist = length(local);
  float normalized = dist / radius;

  // Outside the bubble entirely.
  if (normalized > 1.08) {
    return vec4(0.0);
  }

  vec2 dir = dist > 0.0001 ? local / dist : vec2(0.0, 1.0);
  float fresnel = pow(1.0 - clamp(dot(dir, vec2(0.0, -0.35)), 0.0, 1.0), 2.2);
  float shell = smoothstep(1.02, 0.88, normalized) * smoothstep(0.18, 0.72, normalized);

  float angle = atan(local.y, local.x) / 6.28318 + 0.5;
  vec3 film = iridescence(angle + fresnel * 0.35, bubble.z * 0.08);

  vec2 highlightPos = center + vec2(-radius * 0.28, -radius * 0.34);
  float highlight = smoothstep(radius * 0.22, 0.0, length(p - highlightPos));

  vec3 inner = mix(vec3(0.92, 0.97, 1.0), film, 0.55);
  inner += highlight * vec3(1.0) * 0.85;
  inner += fresnel * film * 0.9;

  float alpha = shell * (0.22 + fresnel * 0.55) * life;
  alpha = clamp(alpha, 0.0, 0.92);

  return vec4(inner, alpha);
}

// Simple bubble wand at the bottom of the screen.
vec3 renderWand(vec2 uv) {
  vec2 p = uv * u_resolution;
  float dist = length(p - u_wand);
  float ring = smoothstep(18.0, 10.0, abs(dist - 14.0));
  float stem = smoothstep(4.0, 0.0, abs(p.x - u_wand.x) - 2.0) *
    smoothstep(u_wand.y + 40.0, u_wand.y - 4.0, p.y);

  vec3 metal = vec3(0.72, 0.76, 0.82);
  float shimmer = 0.08 * sin(u_time * 4.0 + p.x * 0.05);
  return metal * (ring + stem) * (0.65 + shimmer);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = gl_FragCoord.xy;

  vec3 color = backgroundColor(uv);
  color += renderWand(uv) * 0.35;

  // Gentle blow haze around the wand when you blow.
  float haze = smoothstep(0.02, 0.35, u_blow);
  float mist = exp(-length(p - u_wand) / (90.0 + haze * 120.0)) * haze;
  color += vec3(0.85, 0.95, 1.0) * mist * 0.25;

  // Paint bubbles back-to-front using alpha compositing.
  vec3 accum = color;
  float alphaRemain = 1.0;

  for (int i = 0; i < MAX_BUBBLES; i++) {
    if (i >= u_bubbleCount) {
      break;
    }

    vec4 layer = renderBubble(p, u_bubbles[i]);
    accum = mix(accum, layer.rgb, layer.a * alphaRemain);
    alphaRemain *= 1.0 - layer.a;
  }

  gl_FragColor = vec4(accum, 1.0);
}
