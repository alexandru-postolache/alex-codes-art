const params = {
  fieldSpacing: 30,
  noiseScale: 0.05,
  noiseSeed: Math.floor(Math.random() * 10000),
  angleTurns: 1,
  showField: false,
  fieldColor: "#c8c8c8",
  particleCount: 200,
  speed: { min: 1, max: 3 },
  weight: { min: 1, max: 3 },
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
  paused: false,
  respawn: true,
  allowIntersect: true,
  minSpace: 8,
};

let pane;
let particles = [];
let field = [];
let palette = [];
let colorCursor = 0;
let cols = 0;
let rows = 0;
let colorInputs = {};
let pauseButton;
let minSpaceInput;
let occupied = null;
let occupiedWidth = 0;
let occupiedHeight = 0;
let nextStrokeId = 1;
const sampledForce = { x: 0, y: 0 };

function setup() {
  pixelDensity(Math.min(3, Math.max(2, Math.round(displayDensity() || 1))));
  const size = viewSize();
  createCanvas(size.w, size.h);
  strokeCap(ROUND);
  noFill();
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
  if (params.paused) {
    return;
  }

  strokeCap(ROUND);
  noFill();
  curveTightness(0);
  fadeBackground();

  if (params.showField) {
    drawField();
  }

  for (const particle of particles) {
    if (!particle.alive) {
      if (params.respawn && !particle.stopped) {
        particle.respawn();
      }
      continue;
    }

    particle.follow(field);
    particle.update();
    if (!particle.alive) {
      continue;
    }
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

function rangeValue(range) {
  const low = Math.min(range.min, range.max);
  const high = Math.max(range.min, range.max);
  if (high <= low) {
    return low;
  }
  return random(low, high);
}

function generateNew() {
  params.noiseSeed = Math.floor(random(10000));
  if (pane) {
    pane.refresh();
  }
  rebuildField();
  clearCanvas();
  resetParticles();
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
  clearOccupied();
}

function clearOccupied() {
  if (!occupied || occupiedWidth !== width || occupiedHeight !== height) {
    occupiedWidth = Math.max(1, width);
    occupiedHeight = Math.max(1, height);
    occupied = new Uint32Array(occupiedWidth * occupiedHeight);
  } else {
    occupied.fill(0);
  }
}

function stampSegment(x1, y1, x2, y2, radius, id) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(length));
  const r2 = radius * radius;
  const r = Math.ceil(radius);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(occupiedWidth - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(occupiedHeight - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      const row = y * occupiedWidth;
      const dy = y + 0.5 - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) {
          occupied[row + x] = id;
        }
      }
    }
  }
}

function segmentBlocked(x1, y1, x2, y2, reach, selfId, ignoreNear) {
  if (!occupied) {
    return false;
  }

  const r = Math.ceil(reach);
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - r));
  const maxX = Math.min(occupiedWidth - 1, Math.ceil(Math.max(x1, x2) + r));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - r));
  const maxY = Math.min(occupiedHeight - 1, Math.ceil(Math.max(y1, y2) + r));
  const reach2 = reach * reach;
  const abx = x2 - x1;
  const aby = y2 - y1;
  const ab2 = abx * abx + aby * aby;
  const ignore2 = ignoreNear * ignoreNear;

  for (let y = minY; y <= maxY; y++) {
    const row = y * occupiedWidth;
    for (let x = minX; x <= maxX; x++) {
      const id = occupied[row + x];
      if (!id) {
        continue;
      }

      const px = x + 0.5;
      const py = y + 0.5;
      let t = 0;
      if (ab2 > 0) {
        t = ((px - x1) * abx + (py - y1) * aby) / ab2;
        if (t < 0) {
          t = 0;
        } else if (t > 1) {
          t = 1;
        }
      }
      const cx = x1 + abx * t;
      const cy = y1 + aby * t;
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy > reach2) {
        continue;
      }

      if (id === selfId) {
        const ox = cx - x1;
        const oy = cy - y1;
        if (ox * ox + oy * oy <= ignore2) {
          continue;
        }
      }
      return true;
    }
  }

  return false;
}

function devicePixelWeight(weight) {
  return Math.max(1, Math.round(weight * pixelDensity()));
}

function sharpWeight(weight) {
  return devicePixelWeight(weight) / pixelDensity();
}

function sampleField(px, py) {
  const spacing = params.fieldSpacing;
  const gx = px / spacing;
  const gy = py / spacing;
  const x0 = constrain(Math.floor(gx), 0, cols - 1);
  const y0 = constrain(Math.floor(gy), 0, rows - 1);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const tx = x0 === x1 ? 0 : gx - Math.floor(gx);
  const ty = y0 === y1 ? 0 : gy - Math.floor(gy);
  const v00 = field[x0][y0];
  const v10 = field[x1][y0];
  const v01 = field[x0][y1];
  const v11 = field[x1][y1];
  const ax = v00.x + (v10.x - v00.x) * tx;
  const ay = v00.y + (v10.y - v00.y) * tx;
  const bx = v01.x + (v11.x - v01.x) * tx;
  const by = v01.y + (v11.y - v01.y) * tx;
  sampledForce.x = ax + (bx - ax) * ty;
  sampledForce.y = ay + (by - ay) * ty;
  const mag = Math.hypot(sampledForce.x, sampledForce.y);
  if (mag > 0) {
    sampledForce.x /= mag;
    sampledForce.y /= mag;
  }
  return sampledForce;
}

function randomEdgePoint() {
  const inset = 1;
  const side = Math.floor(random(4));
  if (side === 0) {
    return { x: random(width), y: inset };
  }
  if (side === 1) {
    return { x: random(width), y: height - inset };
  }
  if (side === 2) {
    return { x: inset, y: random(height) };
  }
  return { x: width - inset, y: random(height) };
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

function updateSeparationVisibility() {
  if (minSpaceInput) {
    minSpaceInput.hidden = params.allowIntersect;
  }
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
  pane.registerPlugin(TweakpaneEssentialsPlugin);

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
  particleFolder.addInput(params, "speed", {
    label: "speed",
    min: 0.1,
    max: 12,
    step: 0.1,
  });
  particleFolder.addInput(params, "weight", {
    label: "weight",
    min: 0.5,
    max: 12,
    step: 0.1,
  });
  particleFolder.addInput(params, "respawn", { label: "respawn" });
  particleFolder
    .addInput(params, "allowIntersect", { label: "intersect" })
    .on("change", updateSeparationVisibility);
  minSpaceInput = particleFolder.addInput(params, "minSpace", {
    label: "min space",
    min: 0,
    max: 48,
    step: 1,
  });
  updateSeparationVisibility();

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
  pauseButton = actions.addButton({ title: "Pause" });
  pauseButton.on("click", () => {
    params.paused = !params.paused;
    pauseButton.title = params.paused ? "Resume" : "Pause";
  });
  actions.addButton({ title: "Generate new" }).on("click", generateNew);
}

class Particle {
  constructor(x, y, colorIndex) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.history = [];
    this.colorIndex = colorIndex;
    this.alive = true;
    this.stopped = false;
    this.pickMotion();
    const flow = sampleField(x, y);
    this.vel.set(flow.x * this.speed, flow.y * this.speed);
  }

  pickMotion() {
    this.speed = rangeValue(params.speed);
    this.weight = rangeValue(params.weight);
    this.strokeId = nextStrokeId;
    nextStrokeId += 1;
    if (nextStrokeId > 0xffffffff) {
      nextStrokeId = 1;
    }
  }

  follow() {
    const force = sampleField(this.pos.x, this.pos.y);
    this.acc.x = force.x;
    this.acc.y = force.y;
  }

  update() {
    const target = Math.atan2(this.acc.y, this.acc.x);
    const speedNow = Math.hypot(this.vel.x, this.vel.y);
    let heading = speedNow < 0.001 ? target : Math.atan2(this.vel.y, this.vel.x);
    let delta = target - heading;
    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    } else if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    // A small turn per frame bends the stroke into an arc instead of a corner.
    const maxTurn = 0.09;
    if (delta > maxTurn) {
      delta = maxTurn;
    } else if (delta < -maxTurn) {
      delta = -maxTurn;
    }
    heading += delta;

    const speed = Math.min(this.speed, speedNow + 0.2);
    this.vel.x = Math.cos(heading) * speed;
    this.vel.y = Math.sin(heading) * speed;
    const nextX = this.pos.x + this.vel.x;
    const nextY = this.pos.y + this.vel.y;

    if (!params.allowIntersect) {
      const reach = this.weight / 2 + params.minSpace;
      const ignoreNear = this.weight + params.minSpace + this.speed + 2;
      if (
        segmentBlocked(
          this.pos.x,
          this.pos.y,
          nextX,
          nextY,
          reach,
          this.strokeId,
          ignoreNear
        )
      ) {
        this.flush();
        this.alive = false;
        this.stopped = true;
        this.acc.x = 0;
        this.acc.y = 0;
        return;
      }
    }

    if (occupied) {
      stampSegment(
        this.pos.x,
        this.pos.y,
        nextX,
        nextY,
        Math.max(0.5, this.weight / 2),
        this.strokeId
      );
    }
    this.pos.x = nextX;
    this.pos.y = nextY;
    this.acc.x = 0;
    this.acc.y = 0;
  }

  show() {
    this.history.push({ x: this.pos.x, y: this.pos.y });
    if (this.history.length < 4) {
      return;
    }
    if (this.history.length > 4) {
      this.history.shift();
    }

    const [p0, p1, p2, p3] = this.history;
    this.paintCurve(p0, p1, p2, p3);
  }

  flush() {
    const history = this.history;
    if (history.length < 2) {
      return;
    }

    if (history.length < 4) {
      const a = history[history.length - 2];
      const b = history[history.length - 1];
      this.applyStroke();
      line(a.x, a.y, b.x, b.y);
      return;
    }

    const p1 = history[1];
    const p2 = history[2];
    const p3 = history[3];
    this.paintCurve(p1, p2, p3, {
      x: p3.x + (p3.x - p2.x),
      y: p3.y + (p3.y - p2.y),
    });
  }

  applyStroke() {
    stroke(particleColor(this));
    strokeWeight(sharpWeight(this.weight));
  }

  paintCurve(p0, p1, p2, p3) {
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 0.05) {
      return;
    }
    this.applyStroke();
    curve(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  }

  edges() {
    const inside =
      this.pos.x >= 0 &&
      this.pos.x <= width &&
      this.pos.y >= 0 &&
      this.pos.y <= height;
    if (inside) {
      return;
    }

    this.flush();
    if (params.respawn) {
      this.respawn();
    } else {
      this.alive = false;
    }
  }

  respawn() {
    const point = randomEdgePoint();
    this.pos.set(point.x, point.y);
    this.pickMotion();
    const flow = sampleField(point.x, point.y);
    this.vel.set(flow.x * this.speed, flow.y * this.speed);
    this.acc.set(0, 0);
    this.history = [];
    this.stopped = false;
    this.alive = true;
  }
}
