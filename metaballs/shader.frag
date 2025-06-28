#ifdef GL_ES
precision mediump float;
#endif

// -------------- UNIFORMS --------------
// These are values passed from the sketch.js file

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_numMetaballs;

uniform vec2 u_radiusRange;
uniform vec2 u_amplitudeRange;
uniform vec2 u_frequencyRange;
uniform float u_k;
uniform float u_edgeThickness;
uniform float u_colorAnimationAmount;
uniform vec3 u_bgColorA;
uniform vec3 u_bgColorB;
uniform float u_hashSeed;

// -------------- HELPER FUNCTIONS --------------

// Generates a pseudo-random number between 0.0 and 1.0 from a float.
float hash(float n) {
  return fract(sin(n + u_hashSeed) * 43758.5453);
}

// Signed Distance Function for a circle.
// Returns the distance from a point `p` to the edge of a circle with center `center` and radius `r`.
float sdfCircle(vec2 p, vec2 center, float r) {
  return length(p - center) - r;
}

// Smoothly blends two float values `a` and `b` together using a factor `k`.
// This is used to create smooth transitions between the metaballs.
float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// -------------- METABALL CALCULATION --------------

// Calculates the total field value at a given UV coordinate `uv` by summing the influence of all metaballs.
float metaballField(vec2 uv) {
  float field = 0.0;
  vec2 center = u_resolution * 0.5;

  for (int i = 0; i < 100; i++) {
    if (i >= u_numMetaballs) break;
    float fi = float(i);

    // Calculate metaball properties using hash functions for pseudo-randomness
    float radius = mix(u_radiusRange.x, u_radiusRange.y, hash(fi + 300.0));
    float freqX = mix(u_frequencyRange.x, u_frequencyRange.y, hash(fi + 10.0));
    float freqY = mix(u_frequencyRange.x, u_frequencyRange.y, hash(fi + 20.0));
    float ampX  = mix(u_amplitudeRange.x, u_amplitudeRange.y, hash(fi + 30.0));
    float ampY  = mix(u_amplitudeRange.x, u_amplitudeRange.y, hash(fi + 40.0));

    // Animate the metaball's position over time
    vec2 pos = center + vec2(
      sin(u_time * freqX + fi) * ampX,
      cos(u_time * freqY + fi) * ampY
    );

    // The field contribution is inversely proportional to the distance.
    float dist = length(uv - pos);
    field += radius / dist;
  }

  return field;
}

// -------------- MAIN IMAGE GENERATION --------------

void main() {
  vec2 uv = gl_FragCoord.xy;
  vec2 norm = uv / u_resolution;
  vec2 center = u_resolution * 0.5;

  // Animate background colors over time
  vec3 bgA = u_bgColorA + u_colorAnimationAmount * vec3(
    sin(u_time * 0.5),
    sin(u_time * 0.6 + 1.0),
    sin(u_time * 0.7 + 2.0)
  );

  vec3 bgB = u_bgColorB + u_colorAnimationAmount * vec3(
    cos(u_time * 0.4 + 2.0),
    cos(u_time * 0.3 + 1.0),
    cos(u_time * 0.2)
  );
  
  // Create a linear gradient for the background
  float gradientT = clamp(norm.x + norm.y, 0.0, 1.0);
  vec3 background = mix(bgA, bgB, gradientT);

  // Initialize variables for the metaball rendering
  float field = 0.0;
  vec3 accumColor = vec3(0.0);
  float d = 10000.0;

  // This loop calculates the metaball field, color, and signed distance field.
  // It iterates through each metaball and accumulates their properties.
  for (int i = 0; i < 100; i++) {
    if (i >= u_numMetaballs) break;
    float fi = float(i);

    // Calculate metaball properties, same as in `metaballField` function
    float radius = mix(u_radiusRange.x, u_radiusRange.y, hash(fi + 300.0));
    float freqX = mix(u_frequencyRange.x, u_frequencyRange.y, hash(fi + 10.0));
    float freqY = mix(u_frequencyRange.x, u_frequencyRange.y, hash(fi + 20.0));
    float ampX  = mix(u_amplitudeRange.x, u_amplitudeRange.y, hash(fi + 30.0));
    float ampY  = mix(u_amplitudeRange.x, u_amplitudeRange.y, hash(fi + 40.0));

    vec2 pos = center + vec2(
      sin(u_time * freqX + fi) * ampX,
      cos(u_time * freqY + fi) * ampY
    );

    // Accumulate field strength and color
    float dist = length(uv - pos);
    float strength = radius / dist;
    accumColor += vec3(hash(fi + 50.0), hash(fi + 60.0), hash(fi + 70.0)) * strength;
    field += strength;

    // Combine metaball SDFs using smoothMin for a unified, smooth shape
    float di = sdfCircle(uv, pos, radius);
    d = smoothMin(d, di, u_k);
  }

  // Normalize the accumulated color
  vec3 fillColor = accumColor / max(field, 1e-5);

  // Create masks for the fill and outline of the metaballs
  float fillThreshold = 1.0;
  float fillMask = smoothstep(fillThreshold - 0.2, fillThreshold + 0.2, field);
  float outline = smoothstep(0.0, u_edgeThickness * 0.8, abs(d));

  // The following sections create advanced visual effects like specular highlights and shadow.
  // This could be a good place to start if you want to simplify the shader.

  // Calculate the gradient of the metaball field for lighting and shadow effects.
  float eps = 1.0;
  float fx = metaballField(uv + vec2(eps, 0.0)) - field;
  float fy = metaballField(uv + vec2(0.0, eps)) - field;
  vec2 grad = normalize(vec2(fx, fy));

  // Add a specular highlight
  float specular = pow(max(dot(grad, normalize(vec2(0.5, 0.7))), 0.0), 20.0);

  // Add a shadow to the outline
  float shadow = pow(max(dot(grad, normalize(vec2(-0.5, -0.7))), 0.0), 10.0) * 0.4;

  // Combine all the layers to get the final color
  vec3 interior = background * 0.7 + fillColor * 0.3 + specular * 0.6;
  vec3 color = mix(background, interior, fillMask);
  color = mix(color * (1.0 - shadow), background, outline);

  gl_FragColor = vec4(color, 1.0);
}
