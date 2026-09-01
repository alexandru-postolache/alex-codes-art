const G = 1;
const SOFTENING_CHAOTIC = 0.08;
const SOFTENING_DEFAULT = 0.05;
const MIN_MASS = 0.5;
const MAX_MASS = 8;
const BODY_RADIUS_SCALE = 6;
const SUBSTEPS = 12;
const BASE_DT = 0.002;

// Per-preset softening tuned for stable periodic orbits with Velocity Verlet.
// Šuvakov catalog orbits need different values — a single global softening
// works for Figure-8 and Lagrange but not the collinear-symmetric family.
const PRESET_PHYSICS = {
  "Figure-8": { softening: 0.05, fadeDuration: 6.5 },
  Lagrange: { softening: 0.05, fadeDuration: 4 },
  "Butterfly I": { softening: 0.07, fadeDuration: 6.5 },
  "Butterfly II": { softening: 0.025, fadeDuration: 7.5 },
  "Moth I": { softening: 0.01, fadeDuration: 15 },
  "Yin-Yang I": { softening: 0.195, fadeDuration: 18 },
  Dragonfly: { softening: 0.015, fadeDuration: 22 },
  Bumblebee: { softening: 0.105, fadeDuration: 65 },
  Goggles: { softening: 0.035, fadeDuration: 11 },
  Yarn: { softening: 0.13, fadeDuration: 56 },
  Pythagorean: { softening: 0.08 },
  Random: { softening: 0.08 },
};

const DEFAULT_COLORS = ["#ff6b6b", "#4ecdc4", "#ffe66d"];

const PRESET_OPTIONS = {
  "Figure-8": "Figure-8",
  Lagrange: "Lagrange",
  "Butterfly I": "Butterfly I",
  "Butterfly II": "Butterfly II",
  "Moth I": "Moth I",
  "Yin-Yang I": "Yin-Yang I",
  Dragonfly: "Dragonfly",
  Bumblebee: "Bumblebee",
  Goggles: "Goggles",
  Yarn: "Yarn",
  Pythagorean: "Pythagorean",
  Random: "Random",
};

// Šuvakov & Dmitrašinović (PRL 2013) collinear symmetric family.
// x1=-1, x2=+1, x3=0; v2=v1, v3=-2*v1; equal masses, G=1.
const SUVAKOV_PRESETS = {
  "Butterfly I": { vx: 0.306892758965492, vy: 0.125506782829762 },
  "Butterfly II": { vx: 0.392955223941802, vy: 0.097579235208034 },
  "Moth I": { vx: 0.464445237398184, vy: 0.396059973403921 },
  "Yin-Yang I": { vx: 0.513938054919243, vy: 0.304736003875733 },
  Dragonfly: { vx: 0.080584285736084, vy: 0.588836087036132 },
  Bumblebee: { vx: 0.184278506469727, vy: 0.587188195800781 },
  Goggles: { vx: 0.083300056457519, vy: 0.127889282226563 },
  Yarn: { vx: 0.559064247131347, vy: 0.349191558837891 },
};

const FIGURE_EIGHT_BODIES = [
  { x: 0.97000436, y: -0.24308753, vx: -0.466203685, vy: -0.43236573 },
  { x: -0.97000436, y: 0.24308753, vx: -0.466203685, vy: -0.43236573 },
  { x: 0, y: 0, vx: 0.93240737, vy: 0.86473146 },
];

const CATALOG_PRESETS = new Set([
  "Figure-8",
  "Lagrange",
  ...Object.keys(SUVAKOV_PRESETS),
]);

const settings = {
  preset: "Figure-8",
  paused: false,
  timeScale: 1,
  trails: true,
  trailWeight: 2,
  fadeDuration: 2.5,
  glow: true,
  glowIntensity: 1.35,
  glowRadius: 1.4,
  glowThreshold: 0.02,
  body1: { color: "#ff6b6b", mass: 1, speed: 1, angle: 0 },
  body2: { color: "#4ecdc4", mass: 1, speed: 1, angle: 0 },
  body3: { color: "#ffe66d", mass: 1, speed: 1, angle: 0 },
};

let bodies = [];
let accelerations = [];
let pane;
let sceneGfx;
let blurPing;
let blurPong;
let blurShader;
let glowShader;
let renderScale = 1;
let isPanning = false;

const viewport = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

function preload() {
  blurShader = loadShader("shader.vert", "blur.frag");
  glowShader = loadShader("shader.vert", "glow.frag");
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  pixelDensity(1);
  createSceneBuffer();
  createBlurBuffers();

  setupGui();
  resetSimulation();
}

function createSceneBuffer() {
  sceneGfx = createGraphics(width, height);
  sceneGfx.pixelDensity(pixelDensity());
  sceneGfx.strokeCap(ROUND);
  sceneGfx.strokeJoin(ROUND);
}

function createBlurBuffers() {
  const scale = 0.5;
  const bw = max(1, floor(width * scale));
  const bh = max(1, floor(height * scale));
  blurPing = createFramebuffer({ width: bw, height: bh, depth: false });
  blurPong = createFramebuffer({ width: bw, height: bh, depth: false });
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  createSceneBuffer();
  createBlurBuffers();
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
      options: PRESET_OPTIONS,
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
    if (!settings.trails) {
      clearTrails();
    }
  });
  trailFolder.addInput(settings, "fadeDuration", {
    min: 0.2,
    max: 8,
    step: 0.1,
    label: "fade duration (s)",
  });
  trailFolder.addInput(settings, "trailWeight", {
    min: 1,
    max: 6,
    step: 0.5,
    label: "line weight",
  });

  const glowFolder = pane.addFolder({ title: "Glow", expanded: true });
  glowFolder.addInput(settings, "glow", { label: "enable glow" });
  glowFolder.addInput(settings, "glowIntensity", {
    min: 0,
    max: 3,
    step: 0.05,
    label: "intensity",
  });
  glowFolder.addInput(settings, "glowRadius", {
    min: 0.5,
    max: 4,
    step: 0.1,
    label: "radius",
  });
  glowFolder.addInput(settings, "glowThreshold", {
    min: 0,
    max: 0.2,
    step: 0.01,
    label: "threshold",
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

function getPresetPhysics(preset = settings.preset) {
  return PRESET_PHYSICS[preset] || { softening: SOFTENING_DEFAULT };
}

function getSoftening() {
  return getPresetPhysics().softening ?? SOFTENING_CHAOTIC;
}

function getPresetFadeDuration() {
  return getPresetPhysics().fadeDuration ?? settings.fadeDuration;
}

function isCatalogPreset(preset = settings.preset) {
  return CATALOG_PRESETS.has(preset);
}

function lagrangeOrbitSpeed(mass, radius) {
  const side = radius * sqrt(3);
  return sqrt((G * mass) / side);
}

function setEqualMassDefaults() {
  settings.body1 = { color: DEFAULT_COLORS[0], mass: 1, speed: 1, angle: 0 };
  settings.body2 = { color: DEFAULT_COLORS[1], mass: 1, speed: 1, angle: 0 };
  settings.body3 = { color: DEFAULT_COLORS[2], mass: 1, speed: 1, angle: 0 };
}

function applyPresetPhysics(preset) {
  const physics = PRESET_PHYSICS[preset];
  if (physics?.fadeDuration) {
    settings.fadeDuration = physics.fadeDuration;
    pane?.refresh();
  }
}

function applyPreset(preset) {
  if (preset === "Figure-8") {
    settings.body1 = { color: DEFAULT_COLORS[0], mass: 1, speed: 1, angle: 0 };
    settings.body2 = { color: DEFAULT_COLORS[1], mass: 1, speed: 1, angle: 0 };
    settings.body3 = { color: DEFAULT_COLORS[2], mass: 1, speed: 1, angle: 0 };
    applyPresetPhysics(preset);
    pane.refresh();
    return;
  }

  if (preset === "Lagrange") {
    settings.body1 = { color: DEFAULT_COLORS[0], mass: 1, speed: 1, angle: 0 };
    settings.body2 = { color: DEFAULT_COLORS[1], mass: 1, speed: 1, angle: 120 };
    settings.body3 = { color: DEFAULT_COLORS[2], mass: 1, speed: 1, angle: 240 };
    applyPresetPhysics(preset);
    pane.refresh();
    return;
  }

  if (preset === "Pythagorean") {
    settings.body1 = { color: DEFAULT_COLORS[0], mass: 3, speed: 0, angle: 0 };
    settings.body2 = { color: DEFAULT_COLORS[1], mass: 4, speed: 0, angle: 0 };
    settings.body3 = { color: DEFAULT_COLORS[2], mass: 5, speed: 0, angle: 0 };
    applyPresetPhysics(preset);
    pane.refresh();
    return;
  }

  if (SUVAKOV_PRESETS[preset]) {
    setEqualMassDefaults();
    applyPresetPhysics(preset);
    pane.refresh();
    return;
  }

  applyPresetPhysics(preset);

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

  return false;
}

function resetSimulation() {
  renderScale = getRenderScale();
  bodies = createBodiesFromSettings();
  accelerations = computeAccelerations(bodies);
  clearTrails();
}

function clearTrails() {
  for (const body of bodies) {
    body.trail = [];
  }
}

function createBody(state) {
  return {
    ...state,
    trail: [],
  };
}

function bodiesFromSuvakov(vx1, vy1) {
  const configs = [
    { x: -1, y: 0, vx: vx1, vy: vy1, settings: settings.body1 },
    { x: 1, y: 0, vx: vx1, vy: vy1, settings: settings.body2 },
    { x: 0, y: 0, vx: -2 * vx1, vy: -2 * vy1, settings: settings.body3 },
  ];

  return configs.map((cfg) =>
    createBody({
      x: cfg.x,
      y: cfg.y,
      vx: cfg.vx,
      vy: cfg.vy,
      mass: cfg.settings.mass,
      color: cfg.settings.color,
    })
  );
}

function bodiesFromCatalog(states) {
  return states.map((state, index) => {
    const bodySettings = settings[`body${index + 1}`];
    return createBody({
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      mass: bodySettings.mass,
      color: bodySettings.color,
    });
  });
}

function createBodiesFromSettings() {
  const preset = settings.preset;

  if (SUVAKOV_PRESETS[preset]) {
    const { vx, vy } = SUVAKOV_PRESETS[preset];
    return bodiesFromSuvakov(vx, vy);
  }

  if (preset === "Figure-8") {
    return bodiesFromCatalog(FIGURE_EIGHT_BODIES);
  }

  if (preset === "Lagrange") {
    const radius = 1.4;
    const baseOrbitSpeed = lagrangeOrbitSpeed(settings.body1.mass, radius);

    const positions = [
      { x: 0, y: -radius, angle: 0 },
      { x: radius * cos(PI / 6), y: radius * sin(PI / 6), angle: 120 },
      { x: -radius * cos(PI / 6), y: radius * sin(PI / 6), angle: 240 },
    ];

    return positions.map((pos, index) => {
      const bodySettings = settings[`body${index + 1}`];
      const velocity = velocityFromSpeedAngle(
        baseOrbitSpeed,
        bodySettings.speed,
        bodySettings.angle
      );

      return createBody({
        x: pos.x,
        y: pos.y,
        vx: velocity.vx,
        vy: velocity.vy,
        mass: bodySettings.mass,
        color: bodySettings.color,
      });
    });
  }

  if (preset === "Pythagorean") {
    const pythagorean = [
      { x: 1, y: 3, mass: settings.body1.mass, color: settings.body1.color },
      { x: -2, y: -1, mass: settings.body2.mass, color: settings.body2.color },
      { x: 1, y: -1, mass: settings.body3.mass, color: settings.body3.color },
    ];

    return pythagorean.map((state) =>
      createBody({
        x: state.x,
        y: state.y,
        vx: 0,
        vy: 0,
        mass: state.mass,
        color: state.color,
      })
    );
  }

  const spread = 1.6;
  return [1, 2, 3].map((index) => {
    const bodySettings = settings[`body${index}`];
    const velocity = velocityFromSpeedAngle(0.35, bodySettings.speed, bodySettings.angle);
    const positionAngle = random(TWO_PI);
    const distance = random(spread * 0.35, spread);

    return createBody({
      x: cos(positionAngle) * distance,
      y: sin(positionAngle) * distance,
      vx: velocity.vx,
      vy: velocity.vy,
      mass: bodySettings.mass,
      color: bodySettings.color,
    });
  });
}

function computeAccelerations(currentBodies) {
  const softening = getSoftening();

  return currentBodies.map((body, i) => {
    let ax = 0;
    let ay = 0;

    for (let j = 0; j < currentBodies.length; j++) {
      if (i === j) continue;

      const other = currentBodies[j];
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const distSq = dx * dx + dy * dy + softening * softening;
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

function trailMaxAge() {
  return getPresetFadeDuration() * 1000;
}

function recordTrailPoint(body) {
  if (!settings.trails) return;

  body.trail.push({
    x: body.x,
    y: body.y,
    t: millis(),
  });
}

function pruneTrails() {
  const cutoff = millis() - trailMaxAge();

  for (const body of bodies) {
    let start = 0;
    while (start < body.trail.length && body.trail[start].t < cutoff) {
      start++;
    }
    if (start > 0) {
      body.trail = body.trail.slice(start);
    }
  }
}

function drawTrails(gfx = sceneGfx) {
  gfx.clear();
  gfx.push();
  gfx.blendMode(ADD);
  gfx.strokeWeight(settings.trailWeight);

  const maxAge = trailMaxAge();
  const now = millis();

  for (const body of bodies) {
    const trail = body.trail;
    if (trail.length < 2) continue;

    const col = color(body.color);

    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = now - p0.t;
      const alpha = constrain(map(age, 0, maxAge, 255, 0), 0, 255);
      if (alpha <= 0) continue;

      gfx.stroke(red(col), green(col), blue(col), alpha);

      const x1 = toScreenX(p0.x);
      const y1 = toScreenY(p0.y);
      const x2 = toScreenX(p1.x);
      const y2 = toScreenY(p1.y);
      drawTrailSegment(gfx, x1, y1, x2, y2);
    }
  }

  gfx.pop();
}

function drawTrailSegment(gfx, x1, y1, x2, y2, maxStep = 3) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = sqrt(dx * dx + dy * dy);

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

function renderSceneBuffer() {
  sceneGfx.background(0);

  if (settings.trails) {
    drawTrails(sceneGfx);
  }

  drawBodies(sceneGfx);
}

function renderBloom() {
  const radius = settings.glowRadius * 3;

  blurPing.begin();
  shader(blurShader);
  blurShader.setUniform("u_texture", sceneGfx);
  blurShader.setUniform("u_resolution", [blurPing.width, blurPing.height]);
  blurShader.setUniform("u_direction", [1, 0]);
  blurShader.setUniform("u_radius", radius);
  noStroke();
  plane(blurPing.width, blurPing.height);
  blurPing.end();

  blurPong.begin();
  shader(blurShader);
  blurShader.setUniform("u_texture", blurPing.color);
  blurShader.setUniform("u_resolution", [blurPong.width, blurPong.height]);
  blurShader.setUniform("u_direction", [0, 1]);
  blurShader.setUniform("u_radius", radius);
  plane(blurPong.width, blurPong.height);
  blurPong.end();
}

function renderToScreen() {
  clear();

  if (settings.glow) {
    renderBloom();
    shader(glowShader);
    glowShader.setUniform("u_scene", sceneGfx);
    glowShader.setUniform("u_blur", blurPong.color);
    glowShader.setUniform("u_resolution", [width, height]);
    glowShader.setUniform("u_intensity", settings.glowIntensity);
    glowShader.setUniform("u_threshold", settings.glowThreshold);
    noStroke();
    plane(width, height);
    return;
  }

  push();
  resetShader();
  noStroke();
  image(sceneGfx, -width / 2, -height / 2, width, height);
  pop();
}

function draw() {
  if (!settings.paused) {
    const totalDt = SUBSTEPS * BASE_DT * settings.timeScale;
    const substeps = min(64, max(SUBSTEPS, ceil(SUBSTEPS * settings.timeScale)));
    const dt = totalDt / substeps;

    for (let step = 0; step < substeps; step++) {
      velocityVerletStep(dt);
      for (const body of bodies) {
        recordTrailPoint(body);
      }
    }
  }

  pruneTrails();
  renderSceneBuffer();
  renderToScreen();
}

function drawBodies(gfx = sceneGfx) {
  gfx.push();
  gfx.blendMode(ADD);
  gfx.noStroke();

  for (const body of bodies) {
    const screenX = toScreenX(body.x);
    const screenY = toScreenY(body.y);
    const radius = sqrt(body.mass) * BODY_RADIUS_SCALE * viewport.zoom;
    const col = color(body.color);

    for (let i = 3; i >= 0; i--) {
      const t = i / 3;
      gfx.fill(red(col), green(col), blue(col), 60 + t * 70);
      gfx.circle(screenX, screenY, radius * (1.4 + t * 2.2));
    }

    gfx.fill(255, 255, 255, 200);
    gfx.circle(screenX, screenY, radius * 0.55);
  }

  gfx.pop();
}
