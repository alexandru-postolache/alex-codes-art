/**
 * Figma adapter sketch — maps ContourVectorScene to Figma vector nodes.
 *
 * Usage inside a Figma plugin worker:
 *   import { sceneToFigmaNodes } from './adapters/figma.js';
 *   const nodes = sceneToFigmaNodes(scene);
 */

function hexToFigmaRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

/**
 * Convert scene paths to Figma vector network payloads.
 * The plugin UI can then call figma.createVector() per layer/path.
 *
 * @param {import('../core/generate.js').ContourVectorScene} scene
 */
export function sceneToFigmaVectors(scene) {
  const vectors = [];

  for (const layer of scene.contours) {
    for (const path of layer.paths) {
      if (path.points.length < 2) {
        continue;
      }

      const vertices = path.points.map((point) => ({ x: point.x, y: point.y }));
      const segments = [];
      for (let i = 0; i < vertices.length - 1; i++) {
        segments.push({
          start: i,
          end: i + 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 },
        });
      }
      if (path.closed && vertices.length > 2) {
        segments.push({
          start: vertices.length - 1,
          end: 0,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 },
        });
      }

      vectors.push({
        name: `contour-${layer.threshold.toFixed(3)}`,
        vectorNetwork: { vertices, segments, regions: [] },
        stroke: {
          color: hexToFigmaRgb(layer.color),
          weight: layer.strokeWidth,
        },
      });
    }
  }

  return {
    frame: { width: scene.width, height: scene.height },
    backgroundColor: hexToFigmaRgb(scene.backgroundColor),
    vectors,
  };
}
