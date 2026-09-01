const G = 1;
const SOFTENING = 0.12;
const MIN_MASS = 0.5;
const MAX_MASS = 8;
const BODY_RADIUS_SCALE = 6;
const SUBSTEPS = 8;
const BASE_DT = 0.003;

const settings = {
  preset: "Figure-8",
  paused: false,
  timeScale: 1,
  trails: true,
  trailWeight: 2,
  fadeDuration: 2.5,
  body1: { color: "#ff6b6b", mass: 1, speed: 1, angle: 223 },
  body2: { color: "#4ecdc4", mass: 1, speed: 1, angle: 223 },
  body3: { color: "#ffe66d", mass: 1, speed: 1, angle: 43 },
};

let bodies = [];
let accelerations = [];
let pane;
let trailGfx;
let renderScale = 1;
let isPanning = false;

const viewport = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(2);
  createTrailBuffer();

  setupGui();
  resetSimulation();
}

function createTrailBuffer() {
  trailGfx = createGraphics(width, height);
  trailGfx.pixelDensity(pixelDensity());
  trailGfx.strokeCap(ROUND);
  trailGfx.strokeJoin(ROUND);
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  createTrailBuffer();
  resetSimulation();
}

function getRenderScale() {
  return min(width, height) * 0.18;
}

function setupGui() {
  pane = new Tweakpane.Pane({ title: "Three-Body Problem" });

  const simFolder = pane.addFolder({ title: "Simulation", expanded: true });
  simFolder
    .addInput(settings, "preset", {
      options: {
        "Figure-8": "Figure-8",
        Lagrange: "Lagrange",
        Random: "Random",
      },
    })
    .on("change", (ev) => {
      applyPreset(ev.value);
      resetSimulation();
    });
  simFolder.addInput(settings, "timeScale", {
    min: 0.1,
    max: 3,
    step: 0.1,
    label: "time scale",
  });
  simFolder.addInput(settings, "paused", { label: "pause" });
  simFolder.addButton({ title: "Reset" }).on("click", () => resetSimulation());
  simFolder.addButton({ title: "Reset view" }).on("click", () => resetView());

  const trailFolder = pane.addFolder({ title: "Trails", expanded: true });
  trailFolder.addInput(settings, "trails", { label: "show trails" }).on("change", () => {
    clearTrailBuffer();
    resetTrailPositions();
  });
  trailFolder
    .addInput(settings, "fadeDuration", {
      min: 0.2,
      max: 8,
      step: 0.1,
      label: "fade duration (s)",
    })
    .on("change", clearTrailBuffer);
  trailFolder.addInput(settings, "trailWeight", {
    min: 1,
    max: 6,
    step: 0.5,
    label: "line weight",
  });

  for (let i = 1; i <= 3; i++) {
    const bodyFolder = pane.addFolder({
      title: `Body ${i}`,
      expanded: i === 1,
    });
    const key = `body${i}`;
    const bodyIndex = i - 1;

    bodyFolder.addInput(settings[key], "color").on("change", () => {
      if (bodies[bodyIndex]) {
        bodies[bodyIndex].color = settings[key].color;
      }
    });
    bodyFolder
      .addInput(settings[key], "mass", {
        min: MIN_MASS,
        max: MAX_MASS,
        step: 0.1,
      })
      .on("change", () => resetSimulation());
    bodyFolder
      .addInput(settings[key], "speed", {
        min: 0,
        max: 4,
        step: 0.05,
        label: "speed",
      })
      .on("change", () => resetSimulation());
    bodyFolder
      .addInput(settings[key], "angle", {
        min: 0,
        max: 360,
        step: 1,
        label: "angle (deg)",
      })
      .on("change", () => resetSimulation());
  }

  pane.on("change", (ev) => {
    const key = ev.target.key;
    if (key === "mass" || key === "speed" || key === "angle") {
      resetSimulation();
    }
  });
}

function applyPreset(preset) {
  if (preset === "Figure-8") {
    settings.body1 = { color: "#ff6b6b", mass: 1, speed: 1, angle: 223 };
    settings.body2 = { color: "#4ecdc4", mass: 1, speed: 1, angle: 223 };
    settings.body3 = { color: "#ffe66d", mass: 1, speed: 1, angle: 43 };
    pane.refresh();
    return;
  }

  if (preset === "Lagrange") {
    settings.body1 = { color: "#ff6b6b", mass: 1, speed: 1.15, angle: 0 };
    settings.body2 = { color: "#4ecdc4", mass: 1, speed: 1.15, angle: 120 };
    settings.body3 = { color: "#ffe66d", mass: 1, speed: 1.15, angle: 240 };
    pane.refresh();
    return;
  }

  settings.body1 = {
    color: randomHexColor(),
    mass: random(0.8, 2.5),
    speed: random(0.6, 2.2),
    angle: random(360),
  };
  settings.body2 = {
    color: randomHexColor(),
    mass: random(0.8, 2.5),
    speed: random(0.6, 2.2),
    angle: random(360),
  };
  settings.body3 = {
    color: randomHexColor(),
    mass: random(0.8, 2.5),
    speed: random(0.6, 2.2),
    angle: random(360),
  };
  pane.refresh();
}

function randomHexColor() {
  const palette = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8", "#55efc4"];
  return random(palette);
}

function velocityFromSpeedAngle(baseSpeed, speedMultiplier, angleDeg) {
  const speed = baseSpeed * speedMultiplier;
  const angle = radians(angleDeg);
  return {
    vx: cos(angle) * speed,
    vy: sin(angle) * speed,
  };
}

function resetView() {
  viewport.zoom = 1;
  viewport.panX = 0;
  viewport.panY = 0;
  resetTrailPositions();
}

function isPointerOverPane() {
  if (!pane) return false;
  const target = document.elementFromPoint(winMouseX, winMouseY);
  return target && pane.element.contains(target);
}

function mousePressed() {
  if (mouseButton === LEFT && !isPointerOverPane()) {
    isPanning = true;
  }
}

function mouseReleased() {
  isPanning = false;
}

function mouseDragged() {
  if (!isPanning || isPointerOverPane()) return;

  viewport.panX += mouseX - pmouseX;
  viewport.panY += mouseY - pmouseY;
  resetTrailPositions();
}

function mouseWheel(event) {
  if (isPointerOverPane()) return true;

  const zoomFactor = 1 - event.delta * 0.001;
  const newZoom = constrain(viewport.zoom * zoomFactor, 0.2, 8);
  const worldX = (mouseX - width / 2 - viewport.panX) / (renderScale * viewport.zoom);
  const worldY = (mouseY - height / 2 - viewport.panY) / (renderScale * viewport.zoom);

  viewport.zoom = newZoom;
  viewport.panX = mouseX - width / 2 - worldX * renderScale * viewport.zoom;
  viewport.panY = mouseY - height / 2 - worldY * renderScale * viewport.zoom;
  resetTrailPositions();

  return false;
}

function resetSimulation() {
  renderScale = getRenderScale();
  bodies = createBodiesFromSettings();
  accelerations = computeAccelerations(bodies);
  resetTrailPositions();
  clearTrailBuffer();
}

function resetTrailPositions() {
  for (const body of bodies) {
    body.prevSx = toScreenX(body.x);
    body.prevSy = toScreenY(body.y);
  }
}

function createBodiesFromSettings() {
  const preset = settings.preset;

  if (preset === "Figure-8") {
    const figureEight = [
      { x: 0.97000436, y: -0.24308753, speed: 0.635 },
      { x: -0.97000436, y: 0.24308753, speed: 0.635 },
      { x: 0, y: 0, speed: 1.27 },
    ];

    return figureEight.map((state, index) => {
      const bodySettings = settings[`body${index + 1}`];
      const velocity = velocityFromSpeedAngle(
        state.speed,
        bodySettings.speed,
        bodySettings.angle
      );

      return {
        x: state.x,
        y: state.y,
        vx: velocity.vx,
        vy: velocity.vy,
        mass: bodySettings.mass,
        color: bodySettings.color,
      };
    });
  }

  if (preset === "Lagrange") {
    const radius = 1.4;
    const baseOrbitSpeed =
      sqrt((G * settings.body1.mass * 3) / (radius * sqrt(3))) * 0.92;

    const positions = [
      { x: 0, y: -radius, defaultAngle: 0 },
      { x: radius * cos(PI / 6), y: radius * sin(PI / 6), defaultAngle: 120 },
      { x: -radius * cos(PI / 6), y: radius * sin(PI / 6), defaultAngle: 240 },
    ];

    return positions.map((pos, index) => {
      const bodySettings = settings[`body${index + 1}`];
      const velocity = velocityFromSpeedAngle(
        baseOrbitSpeed,
        bodySettings.speed,
        bodySettings.angle
      );

      return {
        x: pos.x,
        y: pos.y,
        vx: velocity.vx,
        vy: velocity.vy,
        mass: bodySettings.mass,
        color: bodySettings.color,
      };
    });
  }

  const spread = 1.6;
  return [1, 2, 3].map((index) => {
    const bodySettings = settings[`body${index}`];
    const velocity = velocityFromSpeedAngle(0.35, bodySettings.speed, bodySettings.angle);
    const positionAngle = random(TWO_PI);
    const distance = random(spread * 0.35, spread);

    return {
      x: cos(positionAngle) * distance,
      y: sin(positionAngle) * distance,
      vx: velocity.vx,
      vy: velocity.vy,
      mass: bodySettings.mass,
      color: bodySettings.color,
    };
  });
}

function computeAccelerations(currentBodies) {
  return currentBodies.map((body, i) => {
    let ax = 0;
    let ay = 0;

    for (let j = 0; j < currentBodies.length; j++) {
      if (i === j) continue;

      const other = currentBodies[j];
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const distSq = dx * dx + dy * dy + SOFTENING * SOFTENING;
      const dist = sqrt(distSq);
      const accel = (G * other.mass) / distSq;

      ax += (dx / dist) * accel;
      ay += (dy / dist) * accel;
    }

    return createVector(ax, ay);
  });
}

function velocityVerletStep(dt) {
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].x += bodies[i].vx * dt + 0.5 * accelerations[i].x * dt * dt;
    bodies[i].y += bodies[i].vy * dt + 0.5 * accelerations[i].y * dt * dt;
  }

  const newAccelerations = computeAccelerations(bodies);

  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += 0.5 * (accelerations[i].x + newAccelerations[i].x) * dt;
    bodies[i].vy += 0.5 * (accelerations[i].y + newAccelerations[i].y) * dt;
  }

  accelerations = newAccelerations;
}

function toScreenX(simX) {
  return width / 2 + viewport.panX + simX * renderScale * viewport.zoom;
}

function toScreenY(simY) {
  return height / 2 + viewport.panY + simY * renderScale * viewport.zoom;
}

function clearTrailBuffer() {
  trailGfx.background(5, 10, 20);
}

function fadeTrails() {
  const fade = fadeAlpha();
  trailGfx.noStroke();
  trailGfx.fill(5, 10, 20, fade);
  trailGfx.rect(0, 0, width, height);
}

function fadeAlpha() {
  const frames = max(1, settings.fadeDuration * 60);
  return constrain(255 * (1 - pow(0.02, 1 / frames)), 1, 255);
}

function recordTrailSegments() {
  if (!settings.trails) return;

  trailGfx.strokeWeight(settings.trailWeight);

  for (const body of bodies) {
    const screenX = toScreenX(body.x);
    const screenY = toScreenY(body.y);

    if (body.prevSx !== undefined) {
      drawTrailSegment(trailGfx, body.prevSx, body.prevSy, screenX, screenY, body.color);
    }

    body.prevSx = screenX;
    body.prevSy = screenY;
  }
}

function drawTrailSegment(gfx, x1, y1, x2, y2, color, maxStep = 3) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = sqrt(dx * dx + dy * dy);

  gfx.stroke(color);

  if (dist <= maxStep) {
    gfx.line(x1, y1, x2, y2);
    return;
  }

  const steps = ceil(dist / maxStep);
  let prevX = x1;
  let prevY = y1;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nextX = lerp(x1, x2, t);
    const nextY = lerp(y1, y2, t);
    gfx.line(prevX, prevY, nextX, nextY);
    prevX = nextX;
    prevY = nextY;
  }
}

function draw() {
  if (settings.trails) {
    fadeTrails();
  } else {
    clearTrailBuffer();
  }

  if (!settings.paused) {
    const totalDt = SUBSTEPS * BASE_DT * settings.timeScale;
    const substeps = min(64, max(SUBSTEPS, ceil(SUBSTEPS * settings.timeScale)));
    const dt = totalDt / substeps;

    for (let step = 0; step < substeps; step++) {
      velocityVerletStep(dt);
      recordTrailSegments();
    }
  }

  background(5, 10, 20);

  if (settings.trails) {
    image(trailGfx, 0, 0);
  }

  drawBodies();
}

function drawBodies() {
  for (const body of bodies) {
    const screenX = toScreenX(body.x);
    const screenY = toScreenY(body.y);
    const radius = sqrt(body.mass) * BODY_RADIUS_SCALE * viewport.zoom;

    noStroke();
    fill(body.color);
    circle(screenX, screenY, radius * 2);

    fill(255, 255, 255, 90);
    circle(screenX - radius * 0.2, screenY - radius * 0.2, radius * 0.7);
  }
}
