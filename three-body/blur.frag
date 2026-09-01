#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction;
uniform float u_radius;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texel = u_direction * u_radius / u_resolution;

  float weights[5];
  weights[0] = 0.227027;
  weights[1] = 0.1945946;
  weights[2] = 0.1216216;
  weights[3] = 0.054054;
  weights[4] = 0.016216;

  vec3 color = texture2D(u_texture, uv).rgb * weights[0];

  for (int i = 1; i < 5; i++) {
    vec2 offset = texel * float(i);
    color += texture2D(u_texture, uv + offset).rgb * weights[i];
    color += texture2D(u_texture, uv - offset).rgb * weights[i];
  }

  gl_FragColor = vec4(color, 1.0);
}
