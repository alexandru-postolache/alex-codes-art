const G = 1;
const SOFTENING_CHAOTIC = 0.08;
const SOFTENING_CATALOG = 1e-6;
const MIN_MASS = 0.5;
const MAX_MASS = 8;
const MAX_BODIES = 10;
const MIN_BODIES = 2;
const BODY_RADIUS = 0.08;
const BASE_DT = 0.002;
const DT_MIN = 1e-6;
const ADAPT_C = 0.02;
const MAX_STEPS_PER_FRAME = 2500;
const BLOOM_ITERATIONS = 2;

const PRESET_PHYSICS = {
  "Figure-8": { fadeDuration: 6.5 },
  Lagrange: { fadeDuration: 4 },
  "Butterfly I": { fadeDuration: 6.5 },
  "Butterfly II": { fadeDuration: 7.5 },
  "Moth I": { fadeDuration: 15 },
  "Yin-Yang I": { fadeDuration: 18 },
  Dragonfly: { fadeDuration: 22 },
  Bumblebee: { fadeDuration: 65 },
  Goggles: { fadeDuration: 11 },
  Yarn: { fadeDuration: 56 },
  Pythagorean: { fadeDuration: 8 },
  Random: { fadeDuration: 6 },
};

const PALETTE = [
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a29bfe",
  "#fd79a8",
  "#55efc4",
  "#74b9ff",
  "#fab1a0",
  "#81ecec",
  "#dfe6e9",
];

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

const SUVAKOV_PRESETS = {
  "Butterfly I": { vx: 0.306892758965492, vy: 0.125506782829762 },
  "Butterfly II": { vx: 0.39295, vy: 0.09758 },
  "Moth I": { vx: 0.46444, vy: 0.39606 },
  "Yin-Yang I": { vx: 0.513938054919243, vy: 0.304736003875733 },
  Dragonfly: { vx: 0.080584285736084, vy: 0.588836087036132 },
  Bumblebee: { vx: 0.18428, vy: 0.58719 },
  Goggles: { vx: 0.0833000564575194, vy: 0.127889282226563 },
  Yarn: { vx: 0.559064247131347, vy: 0.349191558837891 },
};

const FIGURE_EIGHT_BODIES = [
  { x: 0.97000436, y: -0.24308753, z: 0, vx: -0.466203685, vy: -0.43236573, vz: 0 },
  { x: -0.97000436, y: 0.24308753, z: 0, vx: -0.466203685, vy: -0.43236573, vz: 0 },
  { x: 0, y: 0, z: 0, vx: 0.93240737, vy: 0.86473146, vz: 0 },
];

function defaultBodySettings(index) {
  return {
    color: PALETTE[index % PALETTE.length],
    mass: 1,
    speed: 1,
    azimuth: 0,
    elevation: 0,
  };
}

const settings = {
  preset: "Figure-8",
  bodyCount: 3,
  paused: false,
  timeScale: 1,
  trails: true,
  trailWeight: 2,
  fadeDuration: 6.5,
  showGrid: true,
  bodies: Array.from({ length: MAX_BODIES }, (_, i) => defaultBodySettings(i)),
};

const glowSettings = {
  enabled: true,
  intensity: 1.4,
  radius: 3.5,
};

const cameraState = {
  yaw: 0,
  pitch: 0.18,
  distance: 6.5,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
};

let simBodies = [];
let pane;
let bodyFolders = [];
let canvas;
let sceneFbo;
let blurPing;
let blurPong;
let blurShader;
let copyShader;
let isOrbiting = false;
let isPanning = false;

function preload() {
  blurShader = loadShader("shader.vert", "blur.frag");
  copyShader = loadShader("shader.vert", "copy.frag");
}

function shaderTexelSize(w, h) {
  return [1 / max(1, w), 1 / max(1, h)];
}

function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  pixelDensity(2);
  canvas.elt.addEventListener("contextmenu", (event) => event.preventDefault());
  createRenderTargets();
  setupGui();
  applyPresetPhysics(settings.preset);
  pane.refresh();
  resetSimulation();
}

function createRenderTargets() {
  sceneFbo = createFramebuffer({
    depth: true,
    textureFiltering: LINEAR,
  });
  blurPing = createFramebuffer({
    width,
    height,
    depth: false,
    density: 1,
    textureFiltering: LINEAR,
  });
  blurPong = createFramebuffer({
    width,
    height,
    depth: false,
    density: 1,
    textureFiltering: LINEAR,
  });
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  createRenderTargets();
}

function setupGui() {
  pane = new Tweakpane.Pane({ title: "N-Body Problem" });

  const simFolder = pane.addFolder({ title: "Simulation", expanded: true });
  simFolder
    .addInput(settings, "preset", { options: PRESET_OPTIONS })
    .on("change", (ev) => {
      applyPreset(ev.value);
      resetSimulation();
    });
  simFolder
    .addInput(settings, "bodyCount", {
      min: MIN_BODIES,
      max: MAX_BODIES,
      step: 1,
      label: "bodies",
    })
    .on("change", () => {
      updateBodyFolderVisibility();
      resetSimulation();
    });
  simFolder.addInput(settings, "timeScale", {
    min: 0.1,
    max: 3,
    step: 0.1,
    label: "time scale",
  });
  simFolder.addInput(settings, "paused", { label: "pause" });
  simFolder.addInput(settings, "showGrid", { label: "show grid" });
  simFolder.addButton({ title: "Reset" }).on("click", () => resetSimulation());
  simFolder.addButton({ title: "Reset view" }).on("click", () => resetView());

  const trailFolder = pane.addFolder({ title: "Trails", expanded: true });
  trailFolder.addInput(settings, "trails", { label: "show trails" }).on("change", () => {
    if (!settings.trails) clearTrails();
  });
  trailFolder.addInput(settings, "fadeDuration", {
    min: 0.2,
    max: 80,
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
  glowFolder.addInput(glowSettings, "enabled", { label: "enable glow" });
  glowFolder.addInput(glowSettings, "intensity", {
    min: 0,
    max: 3,
    step: 0.05,
    label: "intensity",
  });
  glowFolder.addInput(glowSettings, "radius", {
    min: 0.5,
    max: 16,
    step: 0.5,
    label: "radius",
  });

  const camFolder = pane.addFolder({ title: "Camera", expanded: false });
  camFolder.addInput(cameraState, "distance", { min: 1.5, max: 40, step: 0.1 });
  camFolder.addInput(cameraState, "yaw", { min: -Math.PI, max: Math.PI, step: 0.01 });
  camFolder.addInput(cameraState, "pitch", { min: -1.2, max: 1.2, step: 0.01 });

  for (let i = 0; i < MAX_BODIES; i++) {
    const folder = pane.addFolder({
      title: `Body ${i + 1}`,
      expanded: i === 0,
    });
    const bodySettings = settings.bodies[i];

    folder.addInput(bodySettings, "color").on("change", () => {
      if (simBodies[i]) simBodies[i].color = bodyColorHex(bodySettings.color);
    });
    folder
      .addInput(bodySettings, "mass", { min: MIN_MASS, max: MAX_MASS, step: 0.1 })
      .on("change", () => {
        if (simBodies[i]) simBodies[i].mass = bodySettings.mass;
      });
    folder
      .addInput(bodySettings, "speed", { min: 0, max: 4, step: 0.05, label: "speed" })
      .on("change", () => resetSimulation());
    folder
      .addInput(bodySettings, "azimuth", {
        min: 0,
        max: 360,
        step: 1,
        label: "azimuth (deg)",
      })
      .on("change", () => resetSimulation());
    folder
      .addInput(bodySettings, "elevation", {
        min: -90,
        max: 90,
        step: 1,
        label: "elevation (deg)",
      })
      .on("change", () => resetSimulation());

    bodyFolders.push(folder);
  }

  updateBodyFolderVisibility();
}

function updateBodyFolderVisibility() {
  for (let i = 0; i < bodyFolders.length; i++) {
    bodyFolders[i].hidden = i >= settings.bodyCount;
  }
}

function getSoftening() {
  if (settings.preset === "Random" || settings.preset === "Pythagorean" || settings.bodyCount !== 3) {
    return SOFTENING_CHAOTIC;
  }
  return SOFTENING_CATALOG;
}

function bodyColorHex(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const r = constrain(round(value.r ?? 255), 0, 255);
    const g = constrain(round(value.g ?? 255), 0, 255);
    const b = constrain(round(value.b ?? 255), 0, 255);
    const toHex = (n) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return PALETTE[0];
}

function writeBodySettings(target, props) {
  target.color = props.color ?? target.color;
  target.mass = props.mass ?? target.mass;
  target.speed = props.speed ?? target.speed;
  target.azimuth = props.azimuth ?? 0;
  target.elevation = props.elevation ?? 0;
}

function applyVelocityModifiers(vx, vy, vz, bodySettings) {
  const scaledX = vx * bodySettings.speed;
  const scaledY = vy * bodySettings.speed;
  const scaledZ = (vz || 0) * bodySettings.speed;
  const yaw = radians(bodySettings.azimuth || 0);
  const pitch = radians(bodySettings.elevation || 0);
  const cosY = cos(yaw);
  const sinY = sin(yaw);
  let rx = scaledX * cosY - scaledY * sinY;
  let ry = scaledX * sinY + scaledY * cosY;
  let rz = scaledZ;
  const hyp = sqrt(rx * rx + rz * rz);
  const nHoriz = hyp * cos(pitch) - ry * sin(pitch);
  const nY = hyp * sin(pitch) + ry * cos(pitch);
  if (hyp > 1e-8) {
    rx *= nHoriz / hyp;
    rz *= nHoriz / hyp;
  }
  return { vx: rx, vy: nY, vz: rz };
}

function lagrangeOrbitSpeed(mass, radius) {
  const side = radius * sqrt(3);
  return sqrt((G * mass) / side);
}

function setEqualMassDefaults() {
  for (let i = 0; i < 3; i++) {
    writeBodySettings(settings.bodies[i], {
      color: PALETTE[i],
      mass: 1,
      speed: 1,
      azimuth: 0,
      elevation: 0,
    });
  }
}

function applyPresetPhysics(preset) {
  const physics = PRESET_PHYSICS[preset];
  if (physics?.fadeDuration) settings.fadeDuration = physics.fadeDuration;
}

function applyPreset(preset) {
  if (preset === "Random") {
    settings.bodyCount = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < MAX_BODIES; i++) {
      writeBodySettings(settings.bodies[i], {
        color: randomHexColor(),
        mass: random(0.8, 2.5),
        speed: random(0.6, 2.2),
        azimuth: random(360),
        elevation: random(-40, 40),
      });
    }
  } else {
    settings.bodyCount = 3;
    if (preset === "Lagrange") {
      writeBodySettings(settings.bodies[0], { color: PALETTE[0], mass: 1, speed: 1, azimuth: 0, elevation: 0 });
      writeBodySettings(settings.bodies[1], { color: PALETTE[1], mass: 1, speed: 1, azimuth: 120, elevation: 0 });
      writeBodySettings(settings.bodies[2], { color: PALETTE[2], mass: 1, speed: 1, azimuth: 240, elevation: 0 });
    } else if (preset === "Pythagorean") {
      writeBodySettings(settings.bodies[0], { color: PALETTE[0], mass: 3, speed: 0, azimuth: 0, elevation: 0 });
      writeBodySettings(settings.bodies[1], { color: PALETTE[1], mass: 4, speed: 0, azimuth: 0, elevation: 0 });
      writeBodySettings(settings.bodies[2], { color: PALETTE[2], mass: 5, speed: 0, azimuth: 0, elevation: 0 });
    } else {
      setEqualMassDefaults();
    }
  }

  applyPresetPhysics(preset);
  updateBodyFolderVisibility();
  pane.refresh();
}

function randomHexColor() {
  return random(PALETTE);
}

function velocityFromSpherical(speed, azimuthDeg, elevationDeg) {
  const az = radians(azimuthDeg);
  const el = radians(elevationDeg);
  return {
    vx: speed * cos(el) * cos(az),
    vy: speed * sin(el),
    vz: speed * cos(el) * sin(az),
  };
}

function resetView() {
  cameraState.yaw = 0;
  cameraState.pitch = 0.18;
  cameraState.distance = 6.5;
  cameraState.targetX = 0;
  cameraState.targetY = 0;
  cameraState.targetZ = 0;
}

function isPointerOverPane() {
  if (!pane) return false;
  const target = document.elementFromPoint(winMouseX, winMouseY);
  return target && pane.element.contains(target);
}

function isGuiFocused() {
  const el = document.activeElement;
  return Boolean(el && pane && pane.element.contains(el));
}

function mousePressed() {
  if (isPointerOverPane()) return;
  if (mouseButton === RIGHT || mouseButton === CENTER || keyIsDown(SHIFT)) {
    isPanning = true;
  } else if (mouseButton === LEFT) {
    isOrbiting = true;
  }
}

function mouseReleased() {
  isOrbiting = false;
  isPanning = false;
}

function mouseDragged() {
  if (isPointerOverPane()) return;
  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;
  const basis = cameraBasis();

  if (isPanning || keyIsDown(SHIFT)) {
    const scale = cameraState.distance * 0.0025;
    cameraState.targetX += (-basis.rx * dx + basis.ux * dy) * scale;
    cameraState.targetY += (-basis.ry * dx + basis.uy * dy) * scale;
    cameraState.targetZ += (-basis.rz * dx + basis.uz * dy) * scale;
    return;
  }

  if (isOrbiting) {
    cameraState.yaw -= dx * 0.005;
    cameraState.pitch = constrain(cameraState.pitch + dy * 0.005, -1.2, 1.2);
  }
}

function mouseWheel(event) {
  if (isPointerOverPane()) return true;
  cameraState.distance = constrain(cameraState.distance * (1 + event.delta * 0.001), 1.5, 40);
  return false;
}

function handleKeyboard(dt) {
  if (isGuiFocused()) return;

  const move = 1.8 * dt * cameraState.distance * 0.2;
  const rot = 1.3 * dt;
  const basis = cameraBasis();
  const flen = max(0.001, sqrt(basis.fx * basis.fx + basis.fz * basis.fz));
  const fx = basis.fx / flen;
  const fz = basis.fz / flen;

  if (keyIsDown(87)) {
    cameraState.targetX -= fx * move;
    cameraState.targetZ -= fz * move;
  }
  if (keyIsDown(83)) {
    cameraState.targetX += fx * move;
    cameraState.targetZ += fz * move;
  }
  if (keyIsDown(65)) {
    cameraState.targetX -= basis.rx * move;
    cameraState.targetZ -= basis.rz * move;
  }
  if (keyIsDown(68)) {
    cameraState.targetX += basis.rx * move;
    cameraState.targetZ += basis.rz * move;
  }
  if (keyIsDown(UP_ARROW)) cameraState.pitch = constrain(cameraState.pitch + rot, -1.2, 1.2);
  if (keyIsDown(DOWN_ARROW)) cameraState.pitch = constrain(cameraState.pitch - rot, -1.2, 1.2);
  if (keyIsDown(LEFT_ARROW)) cameraState.yaw += rot;
  if (keyIsDown(RIGHT_ARROW)) cameraState.yaw -= rot;
  if (keyIsDown(81)) cameraState.targetY += move;
  if (keyIsDown(69)) cameraState.targetY -= move;
  if (keyIsDown(187) || keyIsDown(61) || keyIsDown(107)) {
    cameraState.distance = max(1.5, cameraState.distance * 0.98);
  }
  if (keyIsDown(189) || keyIsDown(173) || keyIsDown(109)) {
    cameraState.distance = min(40, cameraState.distance * 1.02);
  }
}

function keyPressed() {
  if (isGuiFocused()) return;
  if (key === "r" || key === "R") resetView();
}

function cameraBasis() {
  const cosP = cos(cameraState.pitch);
  const sinP = sin(cameraState.pitch);
  const cosY = cos(cameraState.yaw);
  const sinY = sin(cameraState.yaw);
  return {
    fx: cosP * sinY,
    fy: sinP,
    fz: cosP * cosY,
    rx: cosY,
    ry: 0,
    rz: -sinY,
    ux: -sinP * sinY,
    uy: cosP,
    uz: -sinP * cosY,
  };
}

function applyCamera() {
  const { fx, fy, fz } = cameraBasis();
  const d = cameraState.distance;
  const tx = cameraState.targetX;
  const ty = cameraState.targetY;
  const tz = cameraState.targetZ;
  camera(tx + fx * d, ty + fy * d, tz + fz * d, tx, ty, tz, 0, 1, 0);
}

function glContext() {
  return drawingContext;
}

function setDepthTest(enabled) {
  const gl = glContext();
  if (!gl) return;
  if (enabled) gl.enable(gl.DEPTH_TEST);
  else gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
}

function drawClipQuad() {
  noStroke();
  fill(255);
  quad(-1, -1, 1, -1, 1, 1, -1, 1);
}

function resetSimulation() {
  simBodies = createBodiesFromSettings();
  clearTrails();
}

function clearTrails() {
  for (const body of simBodies) body.trail = [];
}

function createBody(state) {
  return {
    x: state.x,
    y: state.y,
    z: state.z || 0,
    vx: state.vx,
    vy: state.vy,
    vz: state.vz || 0,
    mass: state.mass,
    color: state.color,
    trail: [],
  };
}

function extraBodies(startIndex) {
  const extras = [];
  for (let i = startIndex; i < settings.bodyCount; i++) {
    extras.push(randomBody3D(settings.bodies[i]));
  }
  return extras;
}

function randomBody3D(bodySettings) {
  const r = random(0.8, 2.2);
  const theta = random(TWO_PI);
  const phi = random(-1, 1);
  const vel = velocityFromSpherical(
    0.28 * bodySettings.speed,
    bodySettings.azimuth,
    bodySettings.elevation
  );
  return createBody({
    x: r * cos(theta) * cos(phi),
    y: r * sin(phi),
    z: r * sin(theta) * cos(phi),
    vx: vel.vx,
    vy: vel.vy,
    vz: vel.vz,
    mass: bodySettings.mass,
    color: bodyColorHex(bodySettings.color),
  });
}

function bodiesFromSuvakov(vx1, vy1) {
  const configs = [
    { x: -1, y: 0, z: 0, vx: vx1, vy: vy1, vz: 0 },
    { x: 1, y: 0, z: 0, vx: vx1, vy: vy1, vz: 0 },
    { x: 0, y: 0, z: 0, vx: -2 * vx1, vy: -2 * vy1, vz: 0 },
  ];
  return configs.slice(0, settings.bodyCount).map((cfg, i) => {
    const velocity = applyVelocityModifiers(cfg.vx, cfg.vy, cfg.vz, settings.bodies[i]);
    return createBody({
      x: cfg.x,
      y: cfg.y,
      z: cfg.z,
      vx: velocity.vx,
      vy: velocity.vy,
      vz: velocity.vz,
      mass: settings.bodies[i].mass,
      color: bodyColorHex(settings.bodies[i].color),
    });
  });
}

function bodiesFromCatalog(states) {
  return states.slice(0, settings.bodyCount).map((state, index) => {
    const bodySettings = settings.bodies[index];
    const velocity = applyVelocityModifiers(state.vx, state.vy, state.vz || 0, bodySettings);
    return createBody({
      x: state.x,
      y: state.y,
      z: state.z || 0,
      vx: velocity.vx,
      vy: velocity.vy,
      vz: velocity.vz,
      mass: bodySettings.mass,
      color: bodyColorHex(bodySettings.color),
    });
  });
}

function createBodiesFromSettings() {
  const preset = settings.preset;
  let created = [];

  if (SUVAKOV_PRESETS[preset]) {
    const { vx, vy } = SUVAKOV_PRESETS[preset];
    created = bodiesFromSuvakov(vx, vy);
  } else if (preset === "Figure-8") {
    created = bodiesFromCatalog(FIGURE_EIGHT_BODIES);
  } else if (preset === "Lagrange") {
    const radius = 1.4;
    const baseOrbitSpeed = lagrangeOrbitSpeed(settings.bodies[0].mass, radius);
    const positions = [
      { x: 0, y: -radius, z: 0 },
      { x: radius * cos(PI / 6), y: radius * sin(PI / 6), z: 0 },
      { x: -radius * cos(PI / 6), y: radius * sin(PI / 6), z: 0 },
    ];
    created = positions.slice(0, settings.bodyCount).map((pos, index) => {
      const bodySettings = settings.bodies[index];
      const vel = velocityFromSpherical(
        baseOrbitSpeed * bodySettings.speed,
        bodySettings.azimuth,
        bodySettings.elevation
      );
      return createBody({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: vel.vx,
        vy: vel.vy,
        vz: vel.vz,
        mass: bodySettings.mass,
        color: bodyColorHex(bodySettings.color),
      });
    });
  } else if (preset === "Pythagorean") {
    const pythagorean = [
      { x: 1, y: 3, z: 0 },
      { x: -2, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
    ];
    created = pythagorean.slice(0, settings.bodyCount).map((state, index) => {
      const bodySettings = settings.bodies[index];
      const vel = velocityFromSpherical(
        0.35 * bodySettings.speed,
        bodySettings.azimuth,
        bodySettings.elevation
      );
      return createBody({
        x: state.x,
        y: state.y,
        z: state.z,
        vx: vel.vx,
        vy: vel.vy,
        vz: vel.vz,
        mass: bodySettings.mass,
        color: bodyColorHex(bodySettings.color),
      });
    });
  } else {
    for (let i = 0; i < settings.bodyCount; i++) {
      created.push(randomBody3D(settings.bodies[i]));
    }
    return created;
  }

  return created.concat(extraBodies(created.length));
}

function computeAccelerations(currentBodies) {
  const softening = getSoftening();

  return currentBodies.map((body, i) => {
    let ax = 0;
    let ay = 0;
    let az = 0;

    for (let j = 0; j < currentBodies.length; j++) {
      if (i === j) continue;
      const other = currentBodies[j];
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const dz = (other.z || 0) - (body.z || 0);
      const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
      const dist = sqrt(distSq);
      const accel = (G * other.mass) / distSq;
      ax += (dx / dist) * accel;
      ay += (dy / dist) * accel;
      az += (dz / dist) * accel;
    }

    return { x: ax, y: ay, z: az };
  });
}

function minPairDistance() {
  let minDist = Infinity;
  for (let i = 0; i < simBodies.length; i++) {
    for (let j = i + 1; j < simBodies.length; j++) {
      const dx = simBodies[i].x - simBodies[j].x;
      const dy = simBodies[i].y - simBodies[j].y;
      const dz = simBodies[i].z - simBodies[j].z;
      minDist = min(minDist, sqrt(dx * dx + dy * dy + dz * dz));
    }
  }
  return minDist;
}

function rk4Step(dt) {
  const state = simBodies.map((body) => ({
    x: body.x,
    y: body.y,
    z: body.z,
    vx: body.vx,
    vy: body.vy,
    vz: body.vz,
    mass: body.mass,
  }));

  const derivative = (current) => {
    const acc = computeAccelerations(current);
    return current.map((body, i) => ({
      x: body.vx,
      y: body.vy,
      z: body.vz,
      vx: acc[i].x,
      vy: acc[i].y,
      vz: acc[i].z,
    }));
  };

  const addScaled = (current, k, h) =>
    current.map((body, i) => ({
      x: body.x + k[i].x * h,
      y: body.y + k[i].y * h,
      z: body.z + k[i].z * h,
      vx: body.vx + k[i].vx * h,
      vy: body.vy + k[i].vy * h,
      vz: body.vz + k[i].vz * h,
      mass: body.mass,
    }));

  const k1 = derivative(state);
  const k2 = derivative(addScaled(state, k1, dt / 2));
  const k3 = derivative(addScaled(state, k2, dt / 2));
  const k4 = derivative(addScaled(state, k3, dt));

  for (let i = 0; i < simBodies.length; i++) {
    simBodies[i].x += (dt / 6) * (k1[i].x + 2 * k2[i].x + 2 * k3[i].x + k4[i].x);
    simBodies[i].y += (dt / 6) * (k1[i].y + 2 * k2[i].y + 2 * k3[i].y + k4[i].y);
    simBodies[i].z += (dt / 6) * (k1[i].z + 2 * k2[i].z + 2 * k3[i].z + k4[i].z);
    simBodies[i].vx += (dt / 6) * (k1[i].vx + 2 * k2[i].vx + 2 * k3[i].vx + k4[i].vx);
    simBodies[i].vy += (dt / 6) * (k1[i].vy + 2 * k2[i].vy + 2 * k3[i].vy + k4[i].vy);
    simBodies[i].vz += (dt / 6) * (k1[i].vz + 2 * k2[i].vz + 2 * k3[i].vz + k4[i].vz);
  }
}

function integrateFrame(totalDt) {
  let advanced = 0;
  let steps = 0;
  while (advanced < totalDt && steps < MAX_STEPS_PER_FRAME) {
    const pairDist = minPairDistance();
    let dt = min(BASE_DT, max(DT_MIN, ADAPT_C * pow(max(pairDist, DT_MIN), 1.5)));
    dt = min(dt, totalDt - advanced);
    rk4Step(dt);
    advanced += dt;
    steps++;
  }
}

function trailMaxAge() {
  return settings.fadeDuration * 1000;
}

function recordTrailPoint(body) {
  if (!settings.trails) return;
  body.trail.push({ x: body.x, y: body.y, z: body.z, t: millis() });
}

function pruneTrails() {
  const cutoff = millis() - trailMaxAge();
  for (const body of simBodies) {
    let start = 0;
    while (start < body.trail.length && body.trail[start].t < cutoff) start++;
    if (start > 0) body.trail = body.trail.slice(start);
  }
}

function drawGrid() {
  if (!settings.showGrid) return;
  stroke(255, 255, 255, 28);
  strokeWeight(1);
  const extent = 3;
  const step = 0.5;
  for (let i = -extent; i <= extent; i += step) {
    line(i, 0, -extent, i, 0, extent);
    line(-extent, 0, i, extent, 0, i);
  }
}

function drawTrails3D() {
  const maxAge = trailMaxAge();
  const now = millis();
  strokeWeight(settings.trailWeight);

  for (const body of simBodies) {
    const trail = body.trail;
    if (trail.length < 2) continue;
    const col = color(body.color);

    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const alpha = constrain(map(now - p0.t, 0, maxAge, 220, 0), 0, 220);
      if (alpha <= 0) continue;
      stroke(red(col), green(col), blue(col), alpha);
      line(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
  }
}

function drawBodies3D() {
  noStroke();
  for (const body of simBodies) {
    const col = color(body.color);
    push();
    translate(body.x, body.y, body.z);
    fill(red(col), green(col), blue(col));
    sphere(BODY_RADIUS * sqrt(body.mass), 20, 14);
    pop();
  }
}

function renderScene() {
  sceneFbo.begin();
  setDepthTest(true);
  clear();
  background(0);
  perspective(PI / 3, width / height, 0.05, 500);
  applyCamera();
  ambientLight(32);
  directionalLight(230, 230, 230, 0.35, 0.7, -1);
  const { fx, fy, fz } = cameraBasis();
  const d = cameraState.distance;
  pointLight(
    160,
    160,
    180,
    cameraState.targetX + fx * d,
    cameraState.targetY + fy * d,
    cameraState.targetZ + fz * d
  );
  drawGrid();
  if (settings.trails) drawTrails3D();
  drawBodies3D();
  sceneFbo.end();
}

function blurSource(source) {
  return source && source.color ? source.color : source;
}

function runBlurPass(target, source, direction) {
  target.begin();
  setDepthTest(false);
  clear();
  shader(blurShader);
  blurShader.setUniform("u_clipSpace", 1);
  blurShader.setUniform("u_texture", blurSource(source));
  blurShader.setUniform("u_texelSize", shaderTexelSize(target.width, target.height));
  blurShader.setUniform("u_direction", direction);
  blurShader.setUniform("u_radius", glowSettings.radius);
  drawClipQuad();
  resetShader();
  target.end();
}

function renderBloom() {
  let source = sceneFbo;
  for (let i = 0; i < BLOOM_ITERATIONS; i++) {
    runBlurPass(blurPing, source, [1, 0]);
    runBlurPass(blurPong, blurPing, [0, 1]);
    source = blurPong;
  }
}

function blitFramebuffer(fbo, tintRgba) {
  setDepthTest(false);
  shader(copyShader);
  copyShader.setUniform("u_clipSpace", 1);
  copyShader.setUniform("u_texture", blurSource(fbo));
  copyShader.setUniform("u_tint", tintRgba);
  drawClipQuad();
  resetShader();
}

function renderToScreen() {
  setDepthTest(false);
  background(0);
  blitFramebuffer(sceneFbo, [1, 1, 1, 1]);

  if (glowSettings.enabled && glowSettings.intensity > 0) {
    renderBloom();
    const a = constrain(glowSettings.intensity * 0.45, 0, 1);
    blendMode(ADD);
    blitFramebuffer(blurPong, [a, a, a, 1]);
    blendMode(BLEND);
  }
}

function draw() {
  handleKeyboard(deltaTime / 1000);

  if (!settings.paused) {
    integrateFrame(12 * BASE_DT * settings.timeScale);
    for (const body of simBodies) recordTrailPoint(body);
  }

  pruneTrails();
  renderScene();
  renderToScreen();
}
