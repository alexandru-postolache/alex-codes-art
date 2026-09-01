#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_threshold;

vec2 flipUv(vec2 fragCoord) {
  return vec2(fragCoord.x, u_resolution.y - fragCoord.y) / u_resolution;
}

void main() {
  vec2 uv = flipUv(gl_FragCoord.xy);
  vec4 scene = texture2D(u_scene, uv);
  vec4 blur = texture2D(u_blur, uv);

  vec3 bloom = max(blur.rgb - vec3(u_threshold), vec3(0.0));
  vec3 color = scene.rgb + bloom * u_intensity;

  gl_FragColor = vec4(color, 1.0);
}
