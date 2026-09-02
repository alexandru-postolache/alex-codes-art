#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform vec2 u_resolution;
uniform float u_intensity;

vec2 sceneUv(vec2 fragCoord) {
  return vec2(fragCoord.x, u_resolution.y - fragCoord.y) / u_resolution;
}

vec2 blurUv(vec2 fragCoord) {
  return (fragCoord + 0.5) / u_resolution;
}

void main() {
  vec2 coord = gl_FragCoord.xy;
  vec3 scene = texture2D(u_scene, sceneUv(coord)).rgb;
  vec3 blur = texture2D(u_blur, blurUv(coord)).rgb;

  float sceneLum = max(max(scene.r, scene.g), scene.b);
  vec3 chroma = scene / max(sceneLum, 0.001);
  vec3 bloom = blur * chroma * u_intensity;

  vec3 color = scene + bloom * (1.0 - scene);
  gl_FragColor = vec4(color, 1.0);
}
