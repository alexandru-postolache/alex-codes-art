#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform sampler2D u_texture;
uniform vec4 u_tint;

void main() {
  gl_FragColor = texture2D(u_texture, vTexCoord) * u_tint;
}
