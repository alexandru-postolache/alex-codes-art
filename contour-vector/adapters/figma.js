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

function pathToVectorNetwork(path) {
  const vertices = path.points.map((point) => ({ x: point.x, y: point.y }));
  const segments = [];
  const segmentCount = path.closed ? vertices.length : vertices.length - 1;

  for (let index = 0; index < segmentCount; index++) {
    const end = (index + 1) % vertices.length;
    const bezier = path.beziers?.[index];
    segments.push({
      start: index,
      end,
      tangentStart: bezier
        ? {
            x: bezier.cp1.x - bezier.p0.x,
            y: bezier.cp1.y - bezier.p0.y,
          }
        : { x: 0, y: 0 },
      tangentEnd: bezier
        ? {
            x: bezier.cp2.x - bezier.p1.x,
            y: bezier.cp2.y - bezier.p1.y,
          }
        : { x: 0, y: 0 },
    });
  }

  return { vertices, segments, regions: [] };
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
        vectorNetwork: pathToVectorNetwork(path),
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
