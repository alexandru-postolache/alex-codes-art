#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform float u_intensity;

void main() {
  // Same UVs for both textures — never mirror one axis independently.
  vec2 uv = vTexCoord;
  vec3 scene = texture2D(u_scene, uv).rgb;
  vec3 blur = texture2D(u_blur, uv).rgb;
  vec3 halo = max(blur - scene, vec3(0.0));
  vec3 color = scene + halo * u_intensity;
  gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
}
