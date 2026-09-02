#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform vec2 u_direction;
uniform float u_flipY;

vec2 sampleUv(vec2 uv) {
  if (u_flipY > 0.5) {
    uv.y = 1.0 - uv.y;
  }
  return uv;
}

void main() {
  vec2 uv = sampleUv(gl_FragCoord.xy * u_texelSize);
  vec2 offset = u_direction * u_texelSize;

  vec3 color = texture2D(u_texture, uv).rgb * 0.227027;
  color += texture2D(u_texture, uv + offset * 1.0).rgb * 0.1945946;
  color += texture2D(u_texture, uv - offset * 1.0).rgb * 0.1945946;
  color += texture2D(u_texture, uv + offset * 2.0).rgb * 0.1216216;
  color += texture2D(u_texture, uv - offset * 2.0).rgb * 0.1216216;

  gl_FragColor = vec4(color, 1.0);
}
