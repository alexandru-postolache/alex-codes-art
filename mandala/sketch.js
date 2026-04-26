let symmetry = 8;
let angle;

let drawing = false;
let current, prev;
let thickness = 2;
let curvyPos, curvyAngle = 0, curvyTime = 0;
let curvyWasActive = false;
let trailSegments = [];
let beatIndex = 0;
let lastBeatMs = 0;
let nextBeatMs = 0;
let beatPhase = 0;
let beatHeading = 0;
let beatStartSpeed = 0;
let beatEndSpeed = 0;
let beatIntervalMsCurrent = 0;
let subEventsRemaining = 0;
let nextSubEventMs = 0;
let subEventStepMs = 0;
let segmentStartMs = 0;
let segmentDurationMs = 1;
let pauseUntilMs = 0;

// --- Buffers ---
let buffer;
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
  strokeColor: { r: 255, g: 215, b: 0 }
};

let pane;
let paneContainer;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // --- Buffers ---
  buffer = createGraphics(width, height);
  glowBuffer = createGraphics(width, height);

  buffer.strokeCap(ROUND);
  buffer.noFill();

  buffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);

  current = createVector(0, 0);
  prev = createVector(0, 0);
  curvyPos = createVector(0, 0);

  // --- Tweakpane ---
  pane = new Tweakpane.Pane({ title: 'Mandala Controls' });
  paneContainer = pane.element;

  pane.addInput(params, 'symmetry', { min: 2, max: 16, step: 1 })
    .on('change', updateSymmetry);

  pane.addInput(params, 'smoothing', { min: 0.05, max: 0.5, step: 0.01 });
  pane.addInput(params, 'thicknessMax', { min: 1, max: 20, step: 0.5 });
  pane.addInput(params, 'tempoEnabled');
  pane.addInput(params, 'tempo', { min: 40, max: 220, step: 1 });
  pane.addInput(params, 'tempoImpact', { min: 0, max: 1.5, step: 0.05 });
  pane.addInput(params, 'tempoSubdivisionChance', { min: 0, max: 1, step: 0.05 });
  pane.addInput(params, 'tempoPauseChance', { min: 0, max: 1, step: 0.05 });
  pane.addInput(params, 'curvyEnabled', { label: 'Hold C: Curvy draw' });
  pane.addInput(params, 'curvyBaseSpeed', { min: 0.5, max: 12, step: 0.1 });
  pane.addInput(params, 'curvySpeedVariation', { min: 0, max: 10, step: 0.1 });
  pane.addInput(params, 'curvyPulseRate', { min: 0.2, max: 6, step: 0.1 });
  pane.addInput(params, 'curvyTurnRate', { min: 0.2, max: 8, step: 0.1 });

  pane.addInput(params, 'fadeEnabled');
  pane.addInput(params, 'fadeAmount', { min: 0, max: 100, step: 1 });
  pane.addInput(params, 'maxTrailSegments', { min: 500, max: 20000, step: 100 });
  pane.addInput(params, 'minSegmentLength', { min: 0.1, max: 5, step: 0.1 });

  pane.addInput(params, 'blurEnabled');
  pane.addInput(params, 'glowBlur', { min: 0, max: 20, step: 1 });
  pane.addInput(params, 'glowStrength', { min: 0, max: 3, step: 0.1 });

  pane.addInput(params, 'bgColor', { view: 'color' })
    .on('change', () => {
      buffer.background(
        params.bgColor.r,
        params.bgColor.g,
        params.bgColor.b
      );
    });

  pane.addInput(params, 'strokeColor', { view: 'color' });

  pane.addButton({ title: 'Clear' }).on('click', clearMandala);
  pane.addButton({ title: 'Save' }).on('click', saveMandala);

  updateSymmetry();
}

function draw() {
  updateBeatState();

  // --- Draw stroke ---
  let curvyDrawing = params.curvyEnabled && keyIsDown(67) && !isPointerOverPane();
  let curvyJustStarted = curvyDrawing && !curvyWasActive;
  curvyWasActive = curvyDrawing;

  if (drawing || curvyDrawing) {
    let target;
    if (curvyDrawing) {
      target = getCurvyTarget(curvyJustStarted);
    } else {
      target = createVector(mouseX - width / 2, mouseY - height / 2);
    }

    current.lerp(target, params.smoothing);
    let segmentLength = p5.Vector.dist(prev, current);
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
      if (params.fadeEnabled) {
        trailSegments.push({
          x1: prev.x,
          y1: prev.y,
          x2: current.x,
          y2: current.y,
          weight: thickness,
          bornAt: frameCount
        });

        if (trailSegments.length > params.maxTrailSegments) {
          let overflow = trailSegments.length - params.maxTrailSegments;
          trailSegments.splice(0, overflow);
        }
      } else {
        drawSymmetricSegment(
          prev.x,
          prev.y,
          current.x,
          current.y,
          thickness,
          255
        );
      }

      prev = current.copy();
    }
  }

  if (params.fadeEnabled) {
    renderFadingTrails();
  }

  // --- FINAL COMPOSITE ---
  background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );

  // base layer
  image(buffer, 0, 0);

  if (params.blurEnabled) {
    // --- BLOOM PASS ---
    glowBuffer.clear();
    glowBuffer.image(buffer, 0, 0);
    glowBuffer.filter(BLUR, params.glowBlur);

    // glow layer
    push();
    blendMode(ADD);
    tint(255, 255 * params.glowStrength);
    image(glowBuffer, 0, 0);
    pop();
  }
}

// --- Input ---
function mousePressed() {
  if (isPointerOverPane()) return;

  drawing = true;

  current.set(mouseX - width / 2, mouseY - height / 2);
  prev = current.copy();
}

function mouseReleased() {
  drawing = false;
}

function isPointerOverPane() {
  let rect = paneContainer.getBoundingClientRect();

  return (
    mouseX >= rect.left &&
    mouseX <= rect.right &&
    mouseY >= rect.top &&
    mouseY <= rect.bottom
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
  buffer.background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );
}

function saveMandala() {
  saveCanvas('MandalaFadeGlow', 'png');
}

function getCurvyTarget(justStarted) {
  if (justStarted) {
    curvyPos.set(mouseX - width / 2, mouseY - height / 2);
    prev = curvyPos.copy();
    current = curvyPos.copy();
    curvyAngle = random(360);
    beatHeading = curvyAngle;
    curvyTime = random(1000);
    if (params.tempoEnabled) {
      pickNextBeatSegment(true);
    }
  }

  if (params.tempoEnabled) {
    return getTempoCurvyTarget();
  }

  curvyTime += 0.02;
  let turnDelta = map(noise(curvyTime), 0, 1, -params.curvyTurnRate, params.curvyTurnRate);
  curvyAngle += turnDelta;

  let pulse = (sin(curvyTime * 360 * params.curvyPulseRate) + 1) * 0.5;
  let step = params.curvyBaseSpeed + params.curvySpeedVariation * pulse;

  curvyPos.x += cos(curvyAngle) * step;
  curvyPos.y += sin(curvyAngle) * step;

  let halfW = width / 2;
  let halfH = height / 2;
  if (curvyPos.x < -halfW || curvyPos.x > halfW) {
    curvyAngle = 180 - curvyAngle;
    curvyPos.x = constrain(curvyPos.x, -halfW, halfW);
  }

  if (curvyPos.y < -halfH || curvyPos.y > halfH) {
    curvyAngle = -curvyAngle;
    curvyPos.y = constrain(curvyPos.y, -halfH, halfH);
  }

  return curvyPos.copy();
}

function drawSymmetricSegment(x1, y1, x2, y2, weight, alphaValue) {
  buffer.stroke(
    params.strokeColor.r,
    params.strokeColor.g,
    params.strokeColor.b,
    alphaValue
  );
  buffer.strokeWeight(weight);

  buffer.push();
  buffer.translate(width / 2, height / 2);

  buffer.line(x1, y1, x2, y2);

  buffer.push();
  buffer.scale(1, -1);
  buffer.line(x1, y1, x2, y2);
  buffer.pop();

  for (let i = 1; i < params.symmetry; i++) {
    buffer.rotate(angle);
    buffer.line(x1, y1, x2, y2);

    buffer.push();
    buffer.scale(1, -1);
    buffer.line(x1, y1, x2, y2);
    buffer.pop();
  }

  buffer.pop();
}

function renderFadingTrails() {
  buffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);

  if (params.fadeAmount <= 0) {
    for (let segment of trailSegments) {
      drawSymmetricSegment(
        segment.x1,
        segment.y1,
        segment.x2,
        segment.y2,
        segment.weight,
        255
      );
    }
    return;
  }

  let lifeFrames = floor(map(params.fadeAmount, 1, 50, 900, 45, true));

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
      alphaValue
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
    segmentStartMs = 0;
    segmentDurationMs = 1;
    pauseUntilMs = 0;
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
  if (random() <= params.tempoPauseChance) {
    pauseUntilMs = now + max(1, beatIntervalMsCurrent);
    beatStartSpeed = 0;
    beatEndSpeed = 0;
    segmentStartMs = now;
    segmentDurationMs = max(1, beatIntervalMsCurrent);
    return;
  }

  segmentStartMs = millis();
  segmentDurationMs = max(1, segmentMs || beatIntervalMsCurrent || 1);
  pickNextBeatSegment(false);
}

function pickNextBeatSegment(isFirstSegment) {
  let impact = params.tempoImpact;

  if (isFirstSegment) {
    beatHeading = curvyAngle;
  } else {
    let dirSign = beatIndex % 2 === 0 ? 1 : -1;
    let turnAmount = random(45, 165) * (0.35 + impact);
    beatHeading += dirSign * turnAmount;
  }

  let speedBoost = 1 + random(0.6, 1.8) * impact;
  beatStartSpeed = (params.curvyBaseSpeed + params.curvySpeedVariation) * speedBoost;

  let nearStopChance = constrain(0.2 + 0.45 * impact, 0.2, 0.9);
  if (random() < nearStopChance) {
    beatEndSpeed = random(0, 0.25 * params.curvyBaseSpeed);
  } else {
    beatEndSpeed = random(0.2, 0.6) * params.curvyBaseSpeed;
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

function getTempoCurvyTarget() {
  if (millis() < pauseUntilMs) {
    return curvyPos.copy();
  }

  if (beatStartSpeed === 0 && beatEndSpeed === 0) {
    pickNextBeatSegment(true);
  }

  let segmentPhase = constrain((millis() - segmentStartMs) / segmentDurationMs, 0, 1);
  let eased = 1 - pow(segmentPhase, 1.8);
  let step = lerp(beatEndSpeed, beatStartSpeed, eased);
  curvyPos.x += cos(beatHeading) * step;
  curvyPos.y += sin(beatHeading) * step;

  let halfW = width / 2;
  let halfH = height / 2;
  if (curvyPos.x < -halfW || curvyPos.x > halfW) {
    beatHeading = 180 - beatHeading;
    curvyPos.x = constrain(curvyPos.x, -halfW, halfW);
  }

  if (curvyPos.y < -halfH || curvyPos.y > halfH) {
    beatHeading = -beatHeading;
    curvyPos.y = constrain(curvyPos.y, -halfH, halfH);
  }

  return curvyPos.copy();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let newBuffer = createGraphics(width, height);
  let newGlowBuffer = createGraphics(width, height);

  newBuffer.strokeCap(ROUND);
  newBuffer.noFill();
  newBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);
  newBuffer.image(buffer, 0, 0);

  buffer = newBuffer;
  glowBuffer = newGlowBuffer;
}