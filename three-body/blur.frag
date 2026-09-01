#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction;
uniform float u_radius;

void main() {
  vec2 uv = (gl_FragCoord.xy + 0.5) / u_resolution;
  vec2 texel = u_direction * u_radius / u_resolution;

  vec3 color = texture2D(u_texture, uv).rgb * 0.082607;

  color += texture2D(u_texture, uv + texel * 1.0).rgb * 0.080740;
  color += texture2D(u_texture, uv - texel * 1.0).rgb * 0.080740;
  color += texture2D(u_texture, uv + texel * 2.0).rgb * 0.075376;
  color += texture2D(u_texture, uv - texel * 2.0).rgb * 0.075376;
  color += texture2D(u_texture, uv + texel * 3.0).rgb * 0.067634;
  color += texture2D(u_texture, uv - texel * 3.0).rgb * 0.067634;
  color += texture2D(u_texture, uv + texel * 4.0).rgb * 0.058552;
  color += texture2D(u_texture, uv - texel * 4.0).rgb * 0.058552;

  gl_FragColor = vec4(color, 1.0);
}
