import { buildFieldGrid } from './field.js';
import { collectContourSegments } from './marching-squares.js';
import { stitchSegmentsToPaths } from './path-stitch.js';
import { smoothPaths } from './path-smooth.js';
import { computeThresholdValues, getGridDimensions, getStrokeWeight } from './grid.js';
import { getPaletteColors } from './palette.js';

/**
 * @typedef {Object} ContourVectorPath
 * @property {Array<{x:number,y:number}>} points
 * @property {boolean} closed
 * @property {Array<{p0:{x:number,y:number}, cp1:{x:number,y:number}, cp2:{x:number,y:number}, p1:{x:number,y:number}}>} [beziers]
 */

/**
 * @typedef {Object} ContourVectorLayer
 * @property {number} threshold
 * @property {string} color
 * @property {number} strokeWidth
 * @property {ContourVectorPath[]} paths
 */

/**
 * @typedef {Object} ContourVectorScene
 * @property {number} width
 * @property {number} height
 * @property {string} backgroundColor
 * @property {ContourVectorLayer[]} contours
 */

/**
 * Generate a platform-neutral vector scene from contour parameters.
 *
 * @param {Object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {Object} options.params
 * @param {number} [options.time=0]
 * @param {{x:number,y:number,canvasWidth:number,canvasHeight:number}|null} [options.mouse=null]
 * @param {string[]} [options.colors] - optional pre-resolved hex colors per contour
 * @param {number[]} [options.thresholds] - optional pre-resolved thresholds
 * @param {boolean} [options.smooth=true] - apply Catmull-Rom curve smoothing
 * @param {number} [options.smoothTension=1] - curve tension (1 = default)
 */
export function generateContourScene({
  width,
  height,
  params,
  time = 0,
  mouse = null,
  colors = null,
  thresholds = null,
  smooth = true,
  smoothTension = 1,
}) {
  const cols = Math.round(params.cols);
  const { rows, cellWidth, cellHeight } = getGridDimensions(cols, width, height);
  const thresholdValues = thresholds ?? computeThresholdValues(params);
  const paletteColors =
    colors ??
    getPaletteColors(params.baseColor, params.colorPalette ?? 'tints', thresholdValues.length);

  const { grid } = buildFieldGrid({
    cols,
    rows,
    cellWidth,
    cellHeight,
    canvasWidth: width,
    canvasHeight: height,
    params,
    time,
    mouse,
  });

  const contours = thresholdValues.map((threshold, index) => {
    const segments = collectContourSegments(grid, rows, cols, threshold, cellWidth, cellHeight);
    let paths = stitchSegmentsToPaths(segments);
    if (smooth) {
      paths = smoothPaths(paths, { tension: smoothTension });
    }

    return {
      threshold,
      color: paletteColors[index],
      strokeWidth: getStrokeWeight(index, thresholdValues.length, params),
      paths,
    };
  });

  return {
    width,
    height,
    backgroundColor: params.backgroundColor,
    contours,
  };
}
