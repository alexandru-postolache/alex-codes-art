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
  colorScheme: "solid",
  paletteSize: 6,
  shadeLimit: 10,
  tintLimit: 92,
  harmonyDegree: 30,
  increaseSaturation: false,
  increaseBrightness: true,
  backgroundColor: "#ffffff",
  fade: 0,
};

let pane;
let particles = [];
let field = [];
let palette = [];
let colorCursor = 0;
let cols = 0;
let rows = 0;
let colorInputs = {};

function setup() {
  pixelDensity(Math.min(3, Math.max(2, Math.round(displayDensity() || 1))));
  const size = viewSize();
  createCanvas(size.w, size.h);
  strokeCap(PROJECT);
  rebuildField();
  rebuildPalette();
  resetParticles();
  clearCanvas();
  setupPane();
}

function viewSize() {
  return {
    w: Math.floor(window.innerWidth),
    h: Math.floor(window.innerHeight),
  };
}

function windowResized() {
  const size = viewSize();
  resizeCanvas(size.w, size.h);
  rebuildField();
  clearCanvas();
}

function draw() {
  strokeCap(PROJECT);
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
  colorCursor = 0;
  syncParticleCount();
}

function syncParticleCount() {
  const target = params.particleCount;
  while (particles.length < target) {
    particles.push(new Particle(random(width), random(height), colorCursor));
    colorCursor += 1;
  }
  if (particles.length > target) {
    particles.length = target;
  }
}

function clearCanvas() {
  colorMode(RGB, 255);
  background(params.backgroundColor);
}

function devicePixelWeight(weight) {
  return Math.max(1, Math.round(weight * pixelDensity()));
}

function sharpWeight(weight) {
  return devicePixelWeight(weight) / pixelDensity();
}

function snapAxis(value, weight) {
  const density = pixelDensity();
  const odd = devicePixelWeight(weight) % 2 === 1;
  const device = odd
    ? Math.round(value * density - 0.5) + 0.5
    : Math.round(value * density);
  return device / density;
}

function rebuildPalette() {
  const count = Math.max(1, Math.round(params.paletteSize));
  push();
  const generator = new ColorGenerator(params.strokeColor);
  let next;

  switch (params.colorScheme) {
    case "shades":
      next = generator.getShades(count, params.shadeLimit);
      break;
    case "tints":
      next = generator.getTints(count, params.tintLimit);
      break;
    case "monochromatic":
      next = generator.getMonochromatic(
        count,
        params.increaseSaturation,
        params.increaseBrightness
      );
      break;
    case "complementary":
      next = generator.getComplementary();
      break;
    case "analogous":
      next = generator.getAnalogous(params.harmonyDegree);
      break;
    case "split":
      next = generator.getSplitComplementary(params.harmonyDegree);
      break;
    case "triadic":
      next = generator.getTriadic();
      break;
    case "tetradic":
      next = generator.getTetradic();
      break;
    default:
      next = [color(params.strokeColor)];
      break;
  }

  pop();
  colorMode(RGB, 255);
  palette = next;
}

function updateColorVisibility() {
  const scheme = params.colorScheme;
  const usesCount =
    scheme === "shades" || scheme === "tints" || scheme === "monochromatic";
  colorInputs.paletteSize.hidden = !usesCount;
  colorInputs.shadeLimit.hidden = scheme !== "shades";
  colorInputs.tintLimit.hidden = scheme !== "tints";
  colorInputs.harmonyDegree.hidden =
    scheme !== "analogous" && scheme !== "split";
  colorInputs.increaseSaturation.hidden = scheme !== "monochromatic";
  colorInputs.increaseBrightness.hidden = scheme !== "monochromatic";
}

function particleColor(particle) {
  if (palette.length === 0) {
    return params.strokeColor;
  }
  return palette[particle.colorIndex % palette.length];
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
  strokeWeight(sharpWeight(1));
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

  const colorFolder = pane.addFolder({ title: "Color" });
  colorFolder
    .addInput(params, "strokeColor", {
      label: "base",
      view: "color",
    })
    .on("change", rebuildPalette);
  colorFolder
    .addInput(params, "colorScheme", {
      label: "scheme",
      options: {
        Solid: "solid",
        Shades: "shades",
        Tints: "tints",
        Monochromatic: "monochromatic",
        Complementary: "complementary",
        "Split complementary": "split",
        Analogous: "analogous",
        Triadic: "triadic",
        Tetradic: "tetradic",
      },
    })
    .on("change", () => {
      updateColorVisibility();
      rebuildPalette();
    });
  colorInputs.paletteSize = colorFolder
    .addInput(params, "paletteSize", {
      label: "colors",
      min: 2,
      max: 16,
      step: 1,
    })
    .on("change", rebuildPalette);
  colorInputs.shadeLimit = colorFolder
    .addInput(params, "shadeLimit", {
      label: "shade limit",
      min: 0,
      max: 100,
      step: 1,
    })
    .on("change", rebuildPalette);
  colorInputs.tintLimit = colorFolder
    .addInput(params, "tintLimit", {
      label: "tint limit",
      min: 0,
      max: 100,
      step: 1,
    })
    .on("change", rebuildPalette);
  colorInputs.harmonyDegree = colorFolder
    .addInput(params, "harmonyDegree", {
      label: "degree",
      min: 1,
      max: 90,
      step: 1,
    })
    .on("change", rebuildPalette);
  colorInputs.increaseSaturation = colorFolder
    .addInput(params, "increaseSaturation", { label: "more saturation" })
    .on("change", rebuildPalette);
  colorInputs.increaseBrightness = colorFolder
    .addInput(params, "increaseBrightness", { label: "more brightness" })
    .on("change", rebuildPalette);
  updateColorVisibility();

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
  constructor(x, y, colorIndex) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.prevPos = this.pos.copy();
    this.colorIndex = colorIndex;
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
    const weight = params.strokeWeight;
    const x1 = snapAxis(this.prevPos.x, weight);
    const y1 = snapAxis(this.prevPos.y, weight);
    const x2 = snapAxis(this.pos.x, weight);
    const y2 = snapAxis(this.pos.y, weight);

    if (x1 !== x2 || y1 !== y2) {
      stroke(particleColor(this));
      strokeWeight(sharpWeight(weight));
      line(x1, y1, x2, y2);
    }

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
