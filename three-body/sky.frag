#ifdef GL_ES
precision highp float;
#endif

varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y * 0.5 + 1.0;
  h = clamp(h * 0.5, 0.0, 1.0);

  vec3 deep = vec3(0.012, 0.018, 0.055);
  vec3 navy = vec3(0.03, 0.04, 0.12);
  vec3 dusk = vec3(0.07, 0.035, 0.14);
  vec3 teal = vec3(0.02, 0.07, 0.12);

  vec3 col = mix(deep, navy, smoothstep(0.0, 0.45, h));
  col = mix(col, dusk, smoothstep(0.35, 0.8, h));
  col = mix(col, teal, smoothstep(0.65, 1.0, h));

  float nebulaA = exp(-7.5 * length(dir - normalize(vec3(-0.45, 0.55, 0.35))));
  float nebulaB = exp(-5.5 * length(dir - normalize(vec3(0.7, 0.05, 0.45))));
  float nebulaC = exp(-9.0 * length(dir - normalize(vec3(0.1, -0.65, 0.55))));

  col += vec3(0.16, 0.045, 0.22) * nebulaA;
  col += vec3(0.03, 0.1, 0.18) * nebulaB;
  col += vec3(0.08, 0.02, 0.12) * nebulaC * 0.7;

  gl_FragColor = vec4(col, 1.0);
}
