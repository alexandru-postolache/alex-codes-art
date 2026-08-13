function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pathToSvgD(path) {
  if (path.beziers?.length) {
    const first = path.beziers[0].p0;
    const commands = [`M ${first.x} ${first.y}`];
    for (const segment of path.beziers) {
      commands.push(
        `C ${segment.cp1.x} ${segment.cp1.y} ${segment.cp2.x} ${segment.cp2.y} ${segment.p1.x} ${segment.p1.y}`
      );
    }
    if (path.closed) {
      commands.push('Z');
    }
    return commands.join(' ');
  }

  if (!path.points?.length) {
    return '';
  }
  const commands = [`M ${path.points[0].x} ${path.points[0].y}`];
  for (let i = 1; i < path.points.length; i++) {
    commands.push(`L ${path.points[i].x} ${path.points[i].y}`);
  }
  if (path.closed) {
    commands.push('Z');
  }
  return commands.join(' ');
}

function polygonsToSvgD(polygons) {
  const commands = [];
  for (const polygon of polygons) {
    if (polygon.length < 3) {
      continue;
    }
    commands.push(`M ${polygon[0].x} ${polygon[0].y}`);
    for (let i = 1; i < polygon.length; i++) {
      commands.push(`L ${polygon[i].x} ${polygon[i].y}`);
    }
    commands.push('Z');
  }
  return commands.join(' ');
}

/**
 * Serialize a ContourVectorScene to an SVG string.
 *
 * @param {import('./generate.js').ContourVectorScene} scene
 * @param {Object} [options]
 * @param {boolean} [options.pretty=false]
 */
export function exportSvg(scene, options = {}) {
  const { pretty = false } = options;
  const nl = pretty ? '\n' : '';
  const indent = pretty ? '  ' : '';

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `${indent}<rect width="100%" height="100%" fill="${escapeXml(scene.backgroundColor)}" />`,
  ];

  if (scene.fills?.length) {
    lines.push(`${indent}<g id="fill-bands">`);
    for (const band of scene.fills) {
      const d = polygonsToSvgD(band.polygons);
      if (d) {
        lines.push(
          `${indent}${indent}<path data-band="${band.index}" d="${d}" fill="${escapeXml(band.color)}" fill-rule="nonzero" />`
        );
      }
    }
    lines.push(`${indent}</g>`);
  }

  lines.push(`${indent}<g id="contours">`);
  for (const layer of scene.contours) {
    for (const path of layer.paths) {
      const d = pathToSvgD(path);
      if (!d) {
        continue;
      }
      lines.push(
        `${indent}${indent}<path d="${d}" fill="none" stroke="${escapeXml(layer.color)}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`
      );
    }
  }

  lines.push(`${indent}</g>`, `</svg>`);
  return lines.join(nl);
}

/**
 * Trigger a browser download of the SVG string.
 */
export function downloadSvg(svgString, filename = 'contour-lines.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
