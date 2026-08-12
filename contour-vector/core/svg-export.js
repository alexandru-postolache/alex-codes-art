import { pathsToSegmentSvgD } from './segments.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialize a ContourVectorScene to an SVG string.
 *
 * @param {import('./generate.js').ContourVectorScene} scene
 * @param {Object} [options]
 * @param {boolean} [options.pretty=false]
 * @param {boolean} [options.mergePaths=true] - one path element per contour level
 */
export function exportSvg(scene, options = {}) {
  const { pretty = false, mergePaths = true } = options;
  const nl = pretty ? '\n' : '';
  const indent = pretty ? '  ' : '';

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `${indent}<rect width="100%" height="100%" fill="${escapeXml(scene.backgroundColor)}" />`,
    `${indent}<g id="contours">`,
  ];

  for (const layer of scene.contours) {
    if (mergePaths) {
      const d = pathsToSegmentSvgD(layer.paths);
      if (!d) {
        continue;
      }
      lines.push(
        `${indent}${indent}<path d="${d}" fill="none" stroke="${escapeXml(layer.color)}" stroke-width="${layer.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`
      );
      continue;
    }

    for (const path of layer.paths) {
      const d = pathsToSegmentSvgD([path]);
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
