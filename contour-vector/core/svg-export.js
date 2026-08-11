function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pointsToPathData(points, closed) {
  if (points.length === 0) {
    return '';
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    commands.push(`L ${points[i].x} ${points[i].y}`);
  }
  if (closed) {
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
    `${indent}<g id="contours">`,
  ];

  for (const layer of scene.contours) {
    for (const path of layer.paths) {
      const d = pointsToPathData(path.points, path.closed);
      if (!d) {
        continue;
      }
      lines.push(
        `${indent}${indent}<path d="${d}" fill="none" stroke="${escapeXml(layer.color)}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
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
