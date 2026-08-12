/**
 * Figma adapter — maps ContourVectorScene to Figma vector nodes.
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

function segmentToVectorNetwork(path) {
  const [a, b] = path.points;
  return {
    vertices: [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 },
      },
    ],
    regions: [],
  };
}

/**
 * Convert scene paths to Figma vector network payloads.
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

      vectors.push({
        name: `contour-${layer.threshold.toFixed(3)}`,
        vectorNetwork: segmentToVectorNetwork(path),
        stroke: {
          color: hexToFigmaRgb(layer.color),
          weight: layer.strokeWeight,
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
