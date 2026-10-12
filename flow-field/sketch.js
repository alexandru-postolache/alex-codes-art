const params = {
  fieldSpacing: 30,
  noiseScale: 0.05,
  noiseSeed: Math.floor(Math.random() * 10000),
  angleTurns: 1,
  showField: false,
  fieldColor: "#c8c8c8",
  particleCount: 200,
  maxSpeed: 2,
  strokeWeight: 2,
  strokeColor: "#000000",
  backgroundColor: "#ffffff",
  fade: 0,
};

let pane;
let particles = [];
let field = [];
let cols = 0;
let rows = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  rebuildField();
  resetParticles();
  clearCanvas();
  setupPane();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  rebuildField();
  clearCanvas();
}

function draw() {
  fadeBackground();

  if (params.showField) {
    drawField();
  }

  for (const particle of particles) {
    particle.follow(field);
    particle.update();
    particle.show();
    particle.edges();
  }
}

function rebuildField() {
  cols = Math.max(1, Math.floor(width / params.fieldSpacing));
  rows = Math.max(1, Math.floor(height / params.fieldSpacing));
  noiseSeed(params.noiseSeed);

  field = [];
  for (let x = 0; x < cols; x++) {
    field[x] = [];
    for (let y = 0; y < rows; y++) {
      const angle =
        noise(x * params.noiseScale, y * params.noiseScale) *
        TWO_PI *
        params.angleTurns;
      field[x][y] = p5.Vector.fromAngle(angle);
    }
  }
}

function resetParticles() {
  particles = [];
  syncParticleCount();
}

function syncParticleCount() {
  const target = params.particleCount;
  while (particles.length < target) {
    particles.push(new Particle(random(width), random(height)));
  }
  if (particles.length > target) {
    particles.length = target;
  }
}

function clearCanvas() {
  background(params.backgroundColor);
}

function fadeBackground() {
  if (params.fade <= 0) {
    return;
  }

  const c = color(params.backgroundColor);
  background(red(c), green(c), blue(c), params.fade);
}

function drawField() {
  const length = Math.max(1, params.fieldSpacing - 2);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      drawVector(
        field[x][y],
        x * params.fieldSpacing,
        y * params.fieldSpacing,
        length
      );
    }
  }
}

function drawVector(v, x, y, scale) {
  push();
  translate(x, y);
  rotate(v.heading());
  stroke(params.fieldColor);
  strokeWeight(1);
  line(0, 0, scale, 0);
  pop();
}

function setupPane() {
  pane = new Tweakpane.Pane({ title: "Flow Field" });

  const fieldFolder = pane.addFolder({ title: "Field" });
  fieldFolder
    .addInput(params, "fieldSpacing", {
      label: "spacing",
      min: 8,
      max: 120,
      step: 1,
    })
    .on("change", rebuildField);
  fieldFolder
    .addInput(params, "noiseScale", {
      label: "noise scale",
      min: 0.001,
      max: 0.2,
      step: 0.001,
    })
    .on("change", rebuildField);
  fieldFolder
    .addInput(params, "noiseSeed", {
      label: "seed",
      min: 0,
      max: 9999,
      step: 1,
    })
    .on("change", rebuildField);
  fieldFolder
    .addInput(params, "angleTurns", {
      label: "angle",
      min: 0,
      max: 2,
      step: 0.01,
    })
    .on("change", rebuildField);
  fieldFolder.addInput(params, "showField", { label: "show vectors" });
  fieldFolder.addInput(params, "fieldColor", {
    label: "vector color",
    view: "color",
  });

  const particleFolder = pane.addFolder({ title: "Particles" });
  particleFolder
    .addInput(params, "particleCount", {
      label: "count",
      min: 1,
      max: 4000,
      step: 1,
    })
    .on("change", syncParticleCount);
  particleFolder.addInput(params, "maxSpeed", {
    label: "max speed",
    min: 0.1,
    max: 12,
    step: 0.1,
  });
  particleFolder.addInput(params, "strokeWeight", {
    label: "weight",
    min: 0.5,
    max: 12,
    step: 0.5,
  });
  particleFolder.addInput(params, "strokeColor", {
    label: "color",
    view: "color",
  });

  const canvasFolder = pane.addFolder({ title: "Canvas" });
  canvasFolder.addInput(params, "backgroundColor", {
    label: "background",
    view: "color",
  });
  canvasFolder.addInput(params, "fade", {
    label: "trail fade",
    min: 0,
    max: 80,
    step: 1,
  });

  const actions = pane.addFolder({ title: "Actions" });
  actions.addButton({ title: "Clear canvas" }).on("click", clearCanvas);
  actions.addButton({ title: "Reset particles" }).on("click", resetParticles);
  actions.addButton({ title: "New seed" }).on("click", () => {
    params.noiseSeed = Math.floor(random(10000));
    pane.refresh();
    rebuildField();
  });
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.prevPos = this.pos.copy();
  }

  follow(vectors) {
    const x = constrain(
      Math.floor(this.pos.x / params.fieldSpacing),
      0,
      cols - 1
    );
    const y = constrain(
      Math.floor(this.pos.y / params.fieldSpacing),
      0,
      rows - 1
    );
    const force = vectors[x] && vectors[x][y];
    if (force) {
      this.acc.add(force);
    }
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(params.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  show() {
    stroke(params.strokeColor);
    strokeWeight(params.strokeWeight);
    line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
    this.prevPos.set(this.pos);
  }

  edges() {
    let wrapped = false;

    if (this.pos.x > width) {
      this.pos.x = 0;
      wrapped = true;
    } else if (this.pos.x < 0) {
      this.pos.x = width;
      wrapped = true;
    }

    if (this.pos.y > height) {
      this.pos.y = 0;
      wrapped = true;
    } else if (this.pos.y < 0) {
      this.pos.y = height;
      wrapped = true;
    }

    if (wrapped) {
      this.prevPos.set(this.pos);
    }
  }
}
