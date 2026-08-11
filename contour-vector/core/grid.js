export function getGridDimensions(cols, canvasWidth, canvasHeight) {
  const screenRows = Math.max(2, Math.round((cols * canvasHeight) / canvasWidth));
  const rows = screenRows + 1;
  const cellWidth = canvasWidth / Math.max(1, cols - 1);
  const cellHeight = canvasHeight / screenRows;

  return { cols, rows, cellWidth, cellHeight };
}

export function computeThresholdValues(params) {
  const thresholdValues = [];
  const count = Math.max(1, Math.round(params.contourCount));
  const min = Math.min(params.thresholdMin, params.thresholdMax);
  const max = Math.max(params.thresholdMin, params.thresholdMax);

  if (count === 1) {
    thresholdValues.push((min + max) / 2);
  } else {
    for (let i = 0; i < count; i++) {
      thresholdValues.push(min + (i / (count - 1)) * (max - min));
    }
  }

  return thresholdValues;
}

export function getStrokeWeight(index, count, params) {
  if (count === 1) {
    return (params.strokeWeightMin + params.strokeWeightMax) / 2;
  }
  return params.strokeWeightMin + (params.strokeWeightMax - params.strokeWeightMin) * (index / (count - 1));
}
