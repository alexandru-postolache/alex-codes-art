#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform vec2 u_direction;
uniform float u_radius;

void main() {
  vec2 uv = vTexCoord;
  vec2 offset = u_direction * u_radius * u_texelSize;

  vec3 color = texture2D(u_texture, uv).rgb * 0.227027;
  color += texture2D(u_texture, uv + offset).rgb * 0.1945946;
  color += texture2D(u_texture, uv - offset).rgb * 0.1945946;
  color += texture2D(u_texture, uv + offset * 2.0).rgb * 0.1216216;
  color += texture2D(u_texture, uv - offset * 2.0).rgb * 0.1216216;
  color += texture2D(u_texture, uv + offset * 3.0).rgb * 0.054054;
  color += texture2D(u_texture, uv - offset * 3.0).rgb * 0.054054;

  gl_FragColor = vec4(color, 1.0);
}
