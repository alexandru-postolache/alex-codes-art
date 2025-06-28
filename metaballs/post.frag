#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_chromaticAberration;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 offset = u_chromaticAberration * (uv - 0.5) * 0.1;

  float r = texture2D(u_texture, uv - offset).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv + offset).b;

  gl_FragColor = vec4(r, g, b, 1.0);
} 