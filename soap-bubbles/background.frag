#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform sampler2D u_image;
uniform float u_imageAspect;

vec2 coverUV(vec2 uv) {
  float screenAspect = u_resolution.x / u_resolution.y;
  vec2 mapped = uv;

  if (screenAspect > u_imageAspect) {
    mapped.y = (uv.y - 0.5) * (screenAspect / u_imageAspect) + 0.5;
  } else {
    mapped.x = (uv.x - 0.5) * (u_imageAspect / screenAspect) + 0.5;
  }

  return vec2(mapped.x, 1.0 - mapped.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 color = texture2D(u_image, coverUV(uv)).rgb;
  gl_FragColor = vec4(color, 1.0);
}
