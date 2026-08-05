(function initContourParams() {
  const PARAM_DEFAULTS = {
    noiseScale: 0.01,
    noiseSeed: 42,
    noiseDetail: 4,
    noiseFalloff: 0.5,
    cols: 200,
    speed: 0.1,
    contourCount: 9,
    thresholdMin: 0.1,
    thresholdMax: 0.9,
    baseColor: '#96000e',
    backgroundColor: '#dfb2b6',
    colorPalette: 'tints',
    strokeWeightMin: 1,
    strokeWeightMax: 5,
    fillEnabled: false,
    mouseInfluence: true,
    mouseStrength: 0.25,
    mouseRadius: 120,
  };

  function computeThresholdValues(params) {
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

  window.contourParamDefaults = PARAM_DEFAULTS;
  window.contourParams = { ...PARAM_DEFAULTS };
  window.contourThresholdValues = computeThresholdValues(window.contourParams);
  window.computeContourThresholdValues = computeThresholdValues;

  window.contourColorPalettes = [
    'tints',
    'shades',
    'monochromatic',
    'complementary',
    'triadic',
    'analogous',
    'splitComplementary',
    'tetradic',
  ];
})();
