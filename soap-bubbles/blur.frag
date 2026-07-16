#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform sampler2D u_image;
uniform vec2 u_direction;
uniform float u_blurSize;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 sum = texture2D(u_image, uv).rgb;
  float weight = 1.0;

  for (int i = 1; i <= 6; i++) {
    float t = float(i);
    float w = exp(-t * t * 0.22);
    vec2 offset = u_direction * t * u_blurSize;
    sum += texture2D(u_image, clamp(uv + offset, 0.001, 0.999)).rgb * w;
    sum += texture2D(u_image, clamp(uv - offset, 0.001, 0.999)).rgb * w;
    weight += 2.0 * w;
  }

  gl_FragColor = vec4(sum / weight, 1.0);
}
