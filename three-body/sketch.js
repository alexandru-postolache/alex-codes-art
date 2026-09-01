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
  body1: { color: "#ff6b6b", mass: 1, speed: 1, angle: 210 },
  body2: { color: "#4ecdc4", mass: 1, speed: 1, angle: 330 },
  body3: { color: "#ffe66d", mass: 1, speed: 1, angle: 90 },
};

let bodies = [];
let accelerations = [];
let pane;
let renderScale = 1;

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(2);

  setupGui();
  resetSimulation();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
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

  const trailFolder = pane.addFolder({ title: "Trails", expanded: true });
  trailFolder.addInput(settings, "trails", { label: "show trails" });
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

  for (let i = 1; i <= 3; i++) {
    const bodyFolder = pane.addFolder({
      title: `Body ${i}`,
      expanded: i === 1,
    });
    const key = `body${i}`;
    bodyFolder.addInput(settings[key], "color");
    bodyFolder.addInput(settings[key], "mass", {
      min: MIN_MASS,
      max: MAX_MASS,
      step: 0.1,
    });
    bodyFolder.addInput(settings[key], "speed", {
      min: 0,
      max: 4,
      step: 0.05,
      label: "speed",
    });
    bodyFolder.addInput(settings[key], "angle", {
      min: 0,
      max: 360,
      step: 1,
      label: "angle (deg)",
    });
  }
}

function applyPreset(preset) {
  if (preset === "Figure-8") {
    settings.body1 = { color: "#ff6b6b", mass: 1, speed: 1, angle: 210 };
    settings.body2 = { color: "#4ecdc4", mass: 1, speed: 1, angle: 330 };
    settings.body3 = { color: "#ffe66d", mass: 1, speed: 1, angle: 90 };
    pane.refresh();
    return;
  }

  if (preset === "Lagrange") {
    settings.body1 = { color: "#ff6b6b", mass: 1, speed: 1.15, angle: 90 };
    settings.body2 = { color: "#4ecdc4", mass: 1, speed: 1.15, angle: 210 };
    settings.body3 = { color: "#ffe66d", mass: 1, speed: 1.15, angle: 330 };
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

function resetSimulation() {
  renderScale = getRenderScale();
  bodies = createBodiesFromSettings();
  accelerations = computeAccelerations(bodies);
  clearTrailBuffer();
}

function createBodiesFromSettings() {
  const preset = settings.preset;

  if (preset === "Figure-8") {
    const figureEight = [
      { x: 0.97000436, y: -0.24308753, vx: -0.466203685, vy: -0.43236573 },
      { x: -0.97000436, y: 0.24308753, vx: -0.466203685, vy: -0.43236573 },
      { x: 0, y: 0, vx: 0.93240737, vy: 0.86473146 },
    ];

    return figureEight.map((state, index) => {
      const bodySettings = settings[`body${index + 1}`];
      return {
        x: state.x,
        y: state.y,
        vx: state.vx,
        vy: state.vy,
        mass: bodySettings.mass,
        color: bodySettings.color,
      };
    });
  }

  if (preset === "Lagrange") {
    const radius = 1.4;
    const orbitSpeed =
      sqrt((G * settings.body1.mass * 3) / (radius * sqrt(3))) * 0.92;

    const positions = [
      { x: 0, y: -radius },
      { x: radius * cos(PI / 6), y: radius * sin(PI / 6) },
      { x: -radius * cos(PI / 6), y: radius * sin(PI / 6) },
    ];

    return positions.map((pos, index) => {
      const bodySettings = settings[`body${index + 1}`];
      const dist = sqrt(pos.x * pos.x + pos.y * pos.y) || 1;
      const tangentX = -pos.y / dist;
      const tangentY = pos.x / dist;
      const speed = orbitSpeed * (bodySettings.speed / 1.15);

      return {
        x: pos.x,
        y: pos.y,
        vx: tangentX * speed,
        vy: tangentY * speed,
        mass: bodySettings.mass,
        color: bodySettings.color,
      };
    });
  }

  const spread = 1.6;
  return [1, 2, 3].map((index) => {
    const bodySettings = settings[`body${index}`];
    const angle = radians(bodySettings.angle);
    const speed = bodySettings.speed * 0.35;
    const positionAngle = random(TWO_PI);
    const distance = random(spread * 0.35, spread);

    return {
      x: cos(positionAngle) * distance,
      y: sin(positionAngle) * distance,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
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
  return width / 2 + simX * renderScale;
}

function toScreenY(simY) {
  return height / 2 + simY * renderScale;
}

function clearTrailBuffer() {
  background(5, 10, 20);
}

function fadeAlpha() {
  const frames = max(1, settings.fadeDuration * 60);
  const alpha = 255 * (1 - pow(0.02, 1 / frames));
  return constrain(alpha, 4, 255);
}

function draw() {
  if (settings.trails) {
    background(5, 10, 20, fadeAlpha() / 255);
  } else {
    clearTrailBuffer();
  }

  if (!settings.paused) {
    const dt = BASE_DT * settings.timeScale;
    for (let step = 0; step < SUBSTEPS; step++) {
      velocityVerletStep(dt);
    }
  }

  drawBodies();
}

function drawBodies() {
  for (const body of bodies) {
    const screenX = toScreenX(body.x);
    const screenY = toScreenY(body.y);
    const radius = sqrt(body.mass) * BODY_RADIUS_SCALE;

    if (settings.trails) {
      noFill();
      stroke(body.color);
      strokeWeight(settings.trailWeight);
      point(screenX, screenY);
    }

    noStroke();
    fill(body.color);
    circle(screenX, screenY, radius * 2);

    fill(255, 255, 255, 90);
    circle(screenX - radius * 0.2, screenY - radius * 0.2, radius * 0.7);
  }
}
