#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform vec2 u_texelSize;
uniform float u_intensity;

vec2 sceneUv(vec2 fragCoord) {
  return vec2(fragCoord.x, 1.0 - fragCoord.y) * u_texelSize;
}

vec2 blurUv(vec2 fragCoord) {
  return fragCoord * u_texelSize;
}

void main() {
  vec2 coord = gl_FragCoord.xy;
  vec3 scene = texture2D(u_scene, sceneUv(coord)).rgb;
  vec3 blur = texture2D(u_blur, blurUv(coord)).rgb;

  float lum = max(max(scene.r, scene.g), scene.b);
  vec3 chroma = lum > 0.001 ? scene / lum : vec3(1.0);
  vec3 bloom = blur * chroma * u_intensity;
  vec3 color = scene + bloom;

  gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
}
