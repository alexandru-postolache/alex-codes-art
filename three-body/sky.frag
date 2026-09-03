#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform vec2 u_look;

void main() {
  vec2 uv = vTexCoord + u_look * 0.12;
  float h = clamp(uv.y, 0.0, 1.0);

  vec3 deep = vec3(0.03, 0.04, 0.12);
  vec3 navy = vec3(0.06, 0.05, 0.18);
  vec3 dusk = vec3(0.14, 0.05, 0.22);
  vec3 teal = vec3(0.04, 0.11, 0.20);

  vec3 col = mix(deep, navy, smoothstep(0.0, 0.4, h));
  col = mix(col, dusk, smoothstep(0.3, 0.75, h));
  col = mix(col, teal, smoothstep(0.6, 1.0, h));

  vec2 nA = uv - vec2(0.22, 0.72);
  vec2 nB = uv - vec2(0.82, 0.38);
  vec2 nC = uv - vec2(0.48, 0.18);
  float nebulaA = exp(-8.0 * dot(nA, nA));
  float nebulaB = exp(-6.0 * dot(nB, nB));
  float nebulaC = exp(-10.0 * dot(nC, nC));

  col += vec3(0.22, 0.06, 0.28) * nebulaA;
  col += vec3(0.04, 0.14, 0.24) * nebulaB;
  col += vec3(0.1, 0.03, 0.16) * nebulaC;

  gl_FragColor = vec4(col, 1.0);
}
