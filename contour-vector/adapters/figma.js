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
  if (path.beziers?.length) {
    const vertices = [{ x: path.beziers[0].p0.x, y: path.beziers[0].p0.y }];
    const segments = [];

    for (const bezier of path.beziers) {
      vertices.push({ x: bezier.p1.x, y: bezier.p1.y });
      const start = vertices.length - 2;
      const end = vertices.length - 1;
      segments.push({
        start,
        end,
        tangentStart: {
          x: bezier.cp1.x - bezier.p0.x,
          y: bezier.cp1.y - bezier.p0.y,
        },
        tangentEnd: {
          x: bezier.cp2.x - bezier.p1.x,
          y: bezier.cp2.y - bezier.p1.y,
        },
      });
    }

    if (path.closed && vertices.length > 2) {
      const last = path.beziers[path.beziers.length - 1];
      const first = path.beziers[0];
      segments.push({
        start: vertices.length - 1,
        end: 0,
        tangentStart: {
          x: last.cp1.x - last.p0.x,
          y: last.cp1.y - last.p0.y,
        },
        tangentEnd: {
          x: first.cp2.x - first.p1.x,
          y: first.cp2.y - first.p1.y,
        },
      });
    }

    return { vertices, segments, regions: [] };
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
