precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float u_clipSpace;

varying vec2 vTexCoord;

void main() {
  if (u_clipSpace > 0.5) {
    // Fullscreen pass: vertex positions are already in clip space.
    // Derive UVs from NDC so sampling does not depend on plane texcoords
    // or the leftover 3D camera.
    gl_Position = vec4(aPosition, 1.0);
    vTexCoord = aPosition.xy * 0.5 + 0.5;
  } else {
    vTexCoord = aTexCoord;
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  }
}
