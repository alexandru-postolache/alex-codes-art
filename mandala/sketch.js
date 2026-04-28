let symmetry = 8;
let angle;

let drawing = false;
let mouseCurrent, mousePrev;
let thickness = 2;
let curvyCWasActive = false;
let lastHeldDigitKeys = new Set();

function createCurvyLineState() {
  return {
    current: createVector(0, 0),
    prev: createVector(0, 0),
    curvyPos: createVector(0, 0),
    curvyAngle: 0,
    curvyTime: 0,
    beatHeading: 0,
    beatStartSpeed: 0,
    beatEndSpeed: 0,
    segmentStartMs: 0,
    segmentDurationMs: 1,
    pauseUntilMs: 0
  };
}

let curvyStateC;
let keyLineStates = {};
let tempoLineStates = [];
let trailSegments = [];
let beatIndex = 0;
let lastBeatMs = 0;
let nextBeatMs = 0;
let beatPhase = 0;
let beatIntervalMsCurrent = 0;
let subEventsRemaining = 0;
let nextSubEventMs = 0;
let subEventStepMs = 0;

// --- Buffers (avoid name "buffer" — conflicts with Web Audio / p5.sound) ---
let mandalaBuffer;
let glowBuffer;

// --- Params ---
let params = {
  symmetry: 8,
  smoothing: 0.2,
  thicknessMax: 10,
  tempoEnabled: true,
  tempo: 120,
  tempoImpact: 0.7,
  tempoSubdivisionChance: 0.35,
  tempoPauseChance: 0.15,
  midiEnabled: false,
  midiPatternHoldMs: 320,
  midiDebugHud: true,
  fadeEnabled: true,
  fadeAmount: 100,
  maxTrailSegments: 6000,
  minSegmentLength: 0.8,
  curvyEnabled: true,
  curvyBaseSpeed: 3,
  curvySpeedVariation: 2,
  curvyPulseRate: 2,
  curvyTurnRate: 2,

  blurEnabled: false,
  glowBlur: 8,
  glowStrength: 1.5,

  bgColor: { r: 30, g: 30, b: 70 },
  strokeColor: { r: 255, g: 215, b: 0 },

  multiLineColors: {
    k1: { r: 255, g: 120, b: 90 },
    k2: { r: 255, g: 200, b: 80 },
    k3: { r: 180, g: 255, b: 120 },
    k4: { r: 80, g: 220, b: 200 },
    k5: { r: 100, g: 160, b: 255 },
    k6: { r: 200, g: 130, b: 255 },
    k7: { r: 255, g: 100, b: 180 },
    k8: { r: 230, g: 230, b: 250 },
    k9: { r: 255, g: 245, b: 180 }
  },

  brushEnabled: true,
  brushName: 'HB',
  brushScale: 3,
  brushWeightMul: 1
};

let pane;
let paneContainer;

function applyBrushScale() {
  if (typeof brush !== 'undefined' && brush.scaleBrushes) {
    brush.scaleBrushes(params.brushScale);
  }
}

function rgbaString(rgb, alpha01) {
  let a = constrain(alpha01, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** WEBGL mandala buffer accumulates strokes when fade is off; depth must reset each frame or new strokes won't draw. */
function prepareMandalaBufferForFrame() {
  if (params.fadeEnabled || !mandalaBuffer) return;
  if (typeof mandalaBuffer.clearDepth === 'function') {
    mandalaBuffer.clearDepth();
  } else if (mandalaBuffer._renderer && mandalaBuffer._renderer.GL) {
    let gl = mandalaBuffer._renderer.GL;
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  angleMode(DEGREES);

  if (typeof brush !== 'undefined' && brush.load) {
    brush.load();
  }

  // --- Buffers ---
  // WEBGL: origin at canvas center — matches stroke coords (mouse − center)
  mandalaBuffer = createGraphics(width, height, WEBGL);
  glowBuffer = createGraphics(width, height);

  mandalaBuffer.strokeCap(ROUND);
  mandalaBuffer.noFill();

  mandalaBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);

  if (typeof brush !== 'undefined') {
    brush.scaleBrushes(params.brushScale);
    if (brush.noField) brush.noField();
  }

  mouseCurrent = createVector(0, 0);
  mousePrev = createVector(0, 0);
  curvyStateC = createCurvyLineState();

  // --- Tweakpane ---
  pane = new Tweakpane.Pane({ title: 'Mandala Controls' });
  paneContainer = pane.element;

  const motionFolder = pane.addFolder({ title: 'Motion', expanded: true });
  const tempoFolder = pane.addFolder({ title: 'Tempo', expanded: false });
  const midiFolder = pane.addFolder({ title: 'MIDI', expanded: false });
  const trailFolder = pane.addFolder({ title: 'Trail & Fade', expanded: false });
  const glowFolder = pane.addFolder({ title: 'Glow', expanded: false });
  const colorFolder = pane.addFolder({ title: 'Colors', expanded: false });
  const multiLineFolder = pane.addFolder({
    title: 'Multi-line keys (1–9)',
    expanded: false
  });
  const brushFolder = pane.addFolder({ title: 'p5.brush', expanded: false });

  motionFolder.addInput(params, 'symmetry', { min: 2, max: 16, step: 1 })
    .on('change', updateSymmetry);

  motionFolder.addInput(params, 'smoothing', { min: 0.05, max: 0.5, step: 0.01 });
  motionFolder.addInput(params, 'thicknessMax', { min: 1, max: 20, step: 0.5 });
  motionFolder.addInput(params, 'curvyEnabled', {
    label: 'Curvy (C + keys 1–9)'
  });
  motionFolder.addInput(params, 'curvyBaseSpeed', { min: 0.5, max: 12, step: 0.1 });
  motionFolder.addInput(params, 'curvySpeedVariation', { min: 0, max: 10, step: 0.1 });
  motionFolder.addInput(params, 'curvyPulseRate', { min: 0.2, max: 6, step: 0.1 });
  motionFolder.addInput(params, 'curvyTurnRate', { min: 0.2, max: 8, step: 0.1 });

  tempoFolder.addInput(params, 'tempoEnabled');
  tempoFolder.addInput(params, 'tempo', { min: 40, max: 220, step: 1 });
  tempoFolder.addInput(params, 'tempoImpact', { min: 0, max: 1.5, step: 0.05 });
  tempoFolder.addInput(params, 'tempoSubdivisionChance', { min: 0, max: 1, step: 0.05 });
  tempoFolder.addInput(params, 'tempoPauseChance', { min: 0, max: 1, step: 0.05 });

  midiFolder.addInput(params, 'midiEnabled');
  midiFolder.addInput(params, 'midiPatternHoldMs', { min: 120, max: 1200, step: 10 });
  midiFolder.addInput(params, 'midiDebugHud');
  midiFolder.addButton({ title: 'Connect MIDI' }).on('click', () => midiEngine.init());

  trailFolder.addInput(params, 'fadeEnabled');
  trailFolder.addInput(params, 'fadeAmount', { min: 0, max: 100, step: 1 });
  trailFolder.addInput(params, 'maxTrailSegments', { min: 500, max: 20000, step: 100 });
  trailFolder.addInput(params, 'minSegmentLength', { min: 0.1, max: 5, step: 0.1 });

  glowFolder.addInput(params, 'blurEnabled');
  glowFolder.addInput(params, 'glowBlur', { min: 0, max: 20, step: 1 });
  glowFolder.addInput(params, 'glowStrength', { min: 0, max: 3, step: 0.1 });

  colorFolder.addInput(params, 'bgColor', { view: 'color' })
    .on('change', () => {
      mandalaBuffer.background(
        params.bgColor.r,
        params.bgColor.g,
        params.bgColor.b
      );
    });

  colorFolder.addInput(params, 'strokeColor', { view: 'color' });

  for (let d = 1; d <= 9; d++) {
    multiLineFolder.addInput(params.multiLineColors, `k${d}`, {
      label: `Key ${d}`,
      view: 'color'
    });
  }

  brushFolder.addInput(params, 'brushEnabled', { label: 'Use brush strokes' });
  if (typeof brush !== 'undefined' && brush.box) {
    let brushNames = brush.box();
    if (brushNames.length > 0 && !brushNames.includes(params.brushName)) {
      params.brushName = brushNames[0];
    }
    if (brushNames.length > 0) {
      let brushOpts = {};
      for (let n of brushNames) brushOpts[n] = n;
      brushFolder.addInput(params, 'brushName', {
        label: 'Brush',
        options: brushOpts
      });
    }
  }
  brushFolder.addInput(params, 'brushScale', { min: 0.5, max: 10, step: 0.1 })
    .on('change', applyBrushScale);
  brushFolder.addInput(params, 'brushWeightMul', {
    label: 'Weight multiplier',
    min: 0.2,
    max: 3,
    step: 0.05
  });

  pane.addButton({ title: 'Clear' }).on('click', clearMandala);
  pane.addButton({ title: 'Save' }).on('click', saveMandala);

  updateSymmetry();
}

function collectHeldDigitKeys() {
  let digitSet = new Set();
  if (!params.curvyEnabled || isPointerOverPane()) return digitSet;
  for (let d = 1; d <= 9; d++) {
    if (keyIsDown(48 + d)) digitSet.add(d);
  }
  return digitSet;
}

function ensureKeyLineState(d) {
  if (!keyLineStates[d]) keyLineStates[d] = createCurvyLineState();
  return keyLineStates[d];
}

function appendStrokeForLine(lineState, active, justStarted, getTarget, colorOverride) {
  if (!active) return;
  let target = getTarget(justStarted);
  lineState.current.lerp(target, params.smoothing);
  let segmentLength = p5.Vector.dist(lineState.prev, lineState.current);
  if (segmentLength >= params.minSegmentLength) {
    let speed = segmentLength;
    let targetThickness = map(
      speed,
      0,
      10,
      params.thicknessMax,
      1,
      true
    );
    thickness = lerp(thickness, targetThickness, 0.2);
    addSegment(
      lineState.prev.x,
      lineState.prev.y,
      lineState.current.x,
      lineState.current.y,
      thickness,
      colorOverride
    );
    lineState.prev = lineState.current.copy();
  }
}

function draw() {
  midiEngine.setParams(params);
  updateBeatState();
  midiEngine.updateVisuals();

  prepareMandalaBufferForFrame();

  let overPane = isPointerOverPane();
  let curvyC = params.curvyEnabled && keyIsDown(67) && !overPane;
  let curvyJustStartedC = curvyC && !curvyCWasActive;
  curvyCWasActive = curvyC;

  let heldDigits = collectHeldDigitKeys();
  let digitJustStarted = new Set();
  for (let d of heldDigits) {
    if (!lastHeldDigitKeys.has(d)) digitJustStarted.add(d);
  }
  lastHeldDigitKeys = heldDigits;

  for (let d = 1; d <= 9; d++) {
    if (!heldDigits.has(d) && keyLineStates[d]) delete keyLineStates[d];
  }

  trimTempoLineStatesForFrame(curvyC, heldDigits);

  appendStrokeForLine(
    curvyStateC,
    drawing || curvyC,
    curvyJustStartedC,
    (js) =>
      curvyC
        ? getCurvyTarget(curvyStateC, js)
        : createVector(mouseX - width / 2, mouseY - height / 2),
    null
  );

  for (let d of heldDigits) {
    let st = ensureKeyLineState(d);
    let col = params.multiLineColors[`k${d}`];
    appendStrokeForLine(
      st,
      true,
      digitJustStarted.has(d),
      (js) => getCurvyTarget(st, js),
      col
    );
  }

  let midiSegments = midiEngine.getSegments({
    params,
    current: mouseCurrent,
    prev: mousePrev,
    mouseX,
    mouseY,
    width,
    height
  });

  for (let segment of midiSegments) {
    addSegment(
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      segment.weight,
      segment.color
    );
  }

  if (params.fadeEnabled) {
    renderFadingTrails();
  }

  // --- FINAL COMPOSITE (WEBGL: origin at center — draw layers in pixel space) ---
  background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );

  push();
  translate(-width / 2, -height / 2);
  imageMode(CORNER);
  image(mandalaBuffer, 0, 0, width, height);

  if (params.blurEnabled) {
    glowBuffer.clear();
    glowBuffer.image(mandalaBuffer, 0, 0);
    glowBuffer.filter(BLUR, params.glowBlur);

    push();
    blendMode(ADD);
    tint(255, 255 * params.glowStrength);
    image(glowBuffer, 0, 0, width, height);
    pop();
  }
  pop();

  if (params.midiDebugHud) {
    midiEngine.drawDebugHud();
  }
}

// --- Input ---
function mousePressed() {
  if (isPointerOverPane()) return;

  drawing = true;

  mouseCurrent.set(mouseX - width / 2, mouseY - height / 2);
  mousePrev = mouseCurrent.copy();
  curvyStateC.current.set(mouseCurrent);
  curvyStateC.prev.set(mousePrev);
}

function mouseReleased() {
  drawing = false;
}

function viewportPointerXY() {
  let el = document.querySelector('canvas');
  if (!el || !width || !height) {
    return { x: mouseX, y: mouseY };
  }
  let cr = el.getBoundingClientRect();
  return {
    x: cr.left + (mouseX / width) * cr.width,
    y: cr.top + (mouseY / height) * cr.height
  };
}

function isPointerOverPane() {
  if (!paneContainer || typeof paneContainer.getBoundingClientRect !== 'function') {
    return false;
  }
  let rect = paneContainer.getBoundingClientRect();
  let p = viewportPointerXY();

  return (
    p.x >= rect.left &&
    p.x <= rect.right &&
    p.y >= rect.top &&
    p.y <= rect.bottom
  );
}

// --- Controls ---
function keyPressed() {
  if (key === 'h') {
    pane.hidden = !pane.hidden;
  }
}

// --- Helpers ---
function updateSymmetry() {
  symmetry = params.symmetry;
  angle = 360 / symmetry;
}

function clearMandala() {
  trailSegments = [];
  mandalaBuffer.background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );
}

function saveMandala() {
  saveCanvas('MandalaFadeGlow', 'png');
}

function trimTempoLineStatesForFrame(curvyCActive, heldDigits) {
  tempoLineStates = [];
  if (params.tempoEnabled && curvyCActive) tempoLineStates.push(curvyStateC);
  if (params.tempoEnabled) {
    for (let d of heldDigits) tempoLineStates.push(ensureKeyLineState(d));
  }
}

function getCurvyTarget(state, justStarted) {
  if (justStarted) {
    state.curvyPos.set(mouseX - width / 2, mouseY - height / 2);
    state.prev = state.curvyPos.copy();
    state.current = state.curvyPos.copy();
    state.curvyAngle = random(360);
    state.beatHeading = state.curvyAngle;
    state.curvyTime = random(1000);
    if (params.tempoEnabled) {
      pickNextBeatSegment(state, true);
    }
  }

  if (params.tempoEnabled) {
    return getTempoCurvyTarget(state);
  }

  state.curvyTime += 0.02;
  let turnDelta = map(
    noise(state.curvyTime),
    0,
    1,
    -params.curvyTurnRate,
    params.curvyTurnRate
  );
  state.curvyAngle += turnDelta;

  let pulse = (sin(state.curvyTime * 360 * params.curvyPulseRate) + 1) * 0.5;
  let step = params.curvyBaseSpeed + params.curvySpeedVariation * pulse;

  state.curvyPos.x += cos(state.curvyAngle) * step;
  state.curvyPos.y += sin(state.curvyAngle) * step;

  let halfW = width / 2;
  let halfH = height / 2;
  if (state.curvyPos.x < -halfW || state.curvyPos.x > halfW) {
    state.curvyAngle = 180 - state.curvyAngle;
    state.curvyPos.x = constrain(state.curvyPos.x, -halfW, halfW);
  }

  if (state.curvyPos.y < -halfH || state.curvyPos.y > halfH) {
    state.curvyAngle = -state.curvyAngle;
    state.curvyPos.y = constrain(state.curvyPos.y, -halfH, halfH);
  }

  return state.curvyPos.copy();
}

function drawSymmetricSegment(x1, y1, x2, y2, weight, alphaValue, colorOverride) {
  let strokeColorNow = midiEngine.getStrokeColor(params.strokeColor);
  if (colorOverride) {
    strokeColorNow = colorOverride;
  }

  let useBrush =
    params.brushEnabled &&
    typeof brush !== 'undefined' &&
    brush.load &&
    brush.set &&
    brush.line;

  if (useBrush) {
    brush.load(mandalaBuffer);
    if (brush.noField) brush.noField();
    let hex = rgbaString(strokeColorNow, alphaValue / 255);
    let wMul = (weight / params.thicknessMax) * params.brushWeightMul;
    wMul = max(0.05, wMul);
    brush.set(params.brushName, hex, wMul);

    mandalaBuffer.push();

    brush.line(x1, y1, x2, y2);

    mandalaBuffer.push();
    mandalaBuffer.scale(1, -1);
    brush.line(x1, y1, x2, y2);
    mandalaBuffer.pop();

    for (let i = 1; i < params.symmetry; i++) {
      mandalaBuffer.rotate(angle);
      brush.line(x1, y1, x2, y2);

      mandalaBuffer.push();
      mandalaBuffer.scale(1, -1);
      brush.line(x1, y1, x2, y2);
      mandalaBuffer.pop();
    }

    mandalaBuffer.pop();
    brush.load();
    return;
  }

  mandalaBuffer.stroke(
    strokeColorNow.r,
    strokeColorNow.g,
    strokeColorNow.b,
    alphaValue
  );
  mandalaBuffer.strokeWeight(weight);

  mandalaBuffer.push();

  mandalaBuffer.line(x1, y1, x2, y2);

  mandalaBuffer.push();
  mandalaBuffer.scale(1, -1);
  mandalaBuffer.line(x1, y1, x2, y2);
  mandalaBuffer.pop();

  for (let i = 1; i < params.symmetry; i++) {
    mandalaBuffer.rotate(angle);
    mandalaBuffer.line(x1, y1, x2, y2);

    mandalaBuffer.push();
    mandalaBuffer.scale(1, -1);
    mandalaBuffer.line(x1, y1, x2, y2);
    mandalaBuffer.pop();
  }

  mandalaBuffer.pop();
}

function addSegment(x1, y1, x2, y2, weight, color) {
  if (params.fadeEnabled) {
    trailSegments.push({
      x1,
      y1,
      x2,
      y2,
      weight,
      bornAt: frameCount,
      color
    });

    if (trailSegments.length > params.maxTrailSegments) {
      let overflow = trailSegments.length - params.maxTrailSegments;
      trailSegments.splice(0, overflow);
    }
  } else {
    drawSymmetricSegment(x1, y1, x2, y2, weight, 255, color);
  }
}

function renderFadingTrails() {
  mandalaBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);

  if (params.fadeAmount <= 0) {
    for (let segment of trailSegments) {
      drawSymmetricSegment(
        segment.x1,
        segment.y1,
        segment.x2,
        segment.y2,
        segment.weight,
        255,
        segment.color
      );
    }
    return;
  }

  let lifeFrames = floor(map(params.fadeAmount, 1, 100, 900, 30, true));

  for (let i = trailSegments.length - 1; i >= 0; i--) {
    let segment = trailSegments[i];
    let age = frameCount - segment.bornAt;
    if (age >= lifeFrames) {
      trailSegments.splice(i, 1);
      continue;
    }

    let alphaValue = map(age, 0, lifeFrames, 255, 0, true);
    drawSymmetricSegment(
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      segment.weight,
      alphaValue,
      segment.color
    );
  }
}

function updateBeatState() {
  if (!params.tempoEnabled) {
    beatPhase = 0;
    nextBeatMs = 0;
    lastBeatMs = 0;
    beatIntervalMsCurrent = 0;
    subEventsRemaining = 0;
    nextSubEventMs = 0;
    subEventStepMs = 0;
    return;
  }

  let now = millis();
  let beatIntervalMs = 60000 / max(1, params.tempo);
  beatIntervalMsCurrent = beatIntervalMs;

  if (nextBeatMs === 0) {
    lastBeatMs = now;
    nextBeatMs = now + beatIntervalMs;
    triggerBeatModulation(beatIntervalMs);
    scheduleSubdivisionsForCurrentBeat();
  }

  if (now >= nextBeatMs) {
    while (now >= nextBeatMs) {
      lastBeatMs = nextBeatMs;
      nextBeatMs += beatIntervalMs;
      beatIndex++;
      triggerBeatModulation(beatIntervalMs);
      scheduleSubdivisionsForCurrentBeat();
    }
  }

  while (subEventsRemaining > 0 && now >= nextSubEventMs) {
    triggerBeatModulation(beatIntervalMs);
    subEventsRemaining--;
    nextSubEventMs += subEventStepMs;
  }

  beatPhase = constrain((now - lastBeatMs) / beatIntervalMs, 0, 1);
}

function triggerBeatModulation(segmentMs) {
  let now = millis();
  let beatDur = max(1, beatIntervalMsCurrent);

  for (let state of tempoLineStates) {
    if (random() <= params.tempoPauseChance) {
      state.pauseUntilMs = now + beatDur;
      state.beatStartSpeed = 0;
      state.beatEndSpeed = 0;
      state.segmentStartMs = now;
      state.segmentDurationMs = beatDur;
      continue;
    }

    state.segmentStartMs = millis();
    state.segmentDurationMs = max(1, segmentMs || beatIntervalMsCurrent || 1);
    pickNextBeatSegment(state, false);
  }
}

function pickNextBeatSegment(state, isFirstSegment) {
  let impact = params.tempoImpact;

  if (isFirstSegment) {
    state.beatHeading = state.curvyAngle;
  } else {
    let dirSign = beatIndex % 2 === 0 ? 1 : -1;
    let turnAmount = random(45, 165) * (0.35 + impact);
    state.beatHeading += dirSign * turnAmount;
  }

  let speedBoost = 1 + random(0.6, 1.8) * impact;
  state.beatStartSpeed =
    (params.curvyBaseSpeed + params.curvySpeedVariation) * speedBoost;

  let nearStopChance = constrain(0.2 + 0.45 * impact, 0.2, 0.9);
  if (random() < nearStopChance) {
    state.beatEndSpeed = random(0, 0.25 * params.curvyBaseSpeed);
  } else {
    state.beatEndSpeed = random(0.2, 0.6) * params.curvyBaseSpeed;
  }
}

function scheduleSubdivisionsForCurrentBeat() {
  subEventsRemaining = 0;
  nextSubEventMs = 0;

  if (random() > params.tempoSubdivisionChance) {
    return;
  }

  let targetEvents = random() < 0.5 ? 2 : 4;
  subEventsRemaining = targetEvents - 1;
  if (subEventsRemaining <= 0) {
    return;
  }

  subEventStepMs = beatIntervalMsCurrent / targetEvents;
  nextSubEventMs = lastBeatMs + subEventStepMs;
}

function getTempoCurvyTarget(state) {
  if (millis() < state.pauseUntilMs) {
    return state.curvyPos.copy();
  }

  if (state.beatStartSpeed === 0 && state.beatEndSpeed === 0) {
    pickNextBeatSegment(state, true);
  }

  let segmentPhase = constrain(
    (millis() - state.segmentStartMs) / state.segmentDurationMs,
    0,
    1
  );
  let eased = 1 - pow(segmentPhase, 1.8);
  let step = lerp(state.beatEndSpeed, state.beatStartSpeed, eased);
  state.curvyPos.x += cos(state.beatHeading) * step;
  state.curvyPos.y += sin(state.beatHeading) * step;

  let halfW = width / 2;
  let halfH = height / 2;
  if (state.curvyPos.x < -halfW || state.curvyPos.x > halfW) {
    state.beatHeading = 180 - state.beatHeading;
    state.curvyPos.x = constrain(state.curvyPos.x, -halfW, halfW);
  }

  if (state.curvyPos.y < -halfH || state.curvyPos.y > halfH) {
    state.beatHeading = -state.beatHeading;
    state.curvyPos.y = constrain(state.curvyPos.y, -halfH, halfH);
  }

  return state.curvyPos.copy();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight, WEBGL);

  let newBuffer = createGraphics(width, height, WEBGL);
  let newGlowBuffer = createGraphics(width, height);

  newBuffer.strokeCap(ROUND);
  newBuffer.noFill();
  newBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);
  newBuffer.image(mandalaBuffer, 0, 0);

  mandalaBuffer = newBuffer;
  glowBuffer = newGlowBuffer;

  if (typeof brush !== 'undefined' && brush.load) {
    brush.load();
  }
  if (typeof brush !== 'undefined' && brush.scaleBrushes) {
    brush.scaleBrushes(params.brushScale);
  }
}