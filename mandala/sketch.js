let symmetry = 8;
let angle;

let drawing = false;
let current, prev;
let thickness = 2;

// --- Buffers ---
let buffer;
let glowBuffer;

// --- Params ---
let params = {
  symmetry: 8,
  smoothing: 0.2,
  thicknessMax: 10,
  fadeEnabled: false,
  fadeAmount: 10,

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

  // --- Tweakpane ---
  pane = new Tweakpane.Pane({ title: 'Mandala Controls' });
  paneContainer = pane.element;

  pane.addInput(params, 'symmetry', { min: 2, max: 16, step: 1 })
    .on('change', updateSymmetry);

  pane.addInput(params, 'smoothing', { min: 0.05, max: 0.5, step: 0.01 });
  pane.addInput(params, 'thicknessMax', { min: 1, max: 20, step: 0.5 });

  pane.addInput(params, 'fadeEnabled');
  pane.addInput(params, 'fadeAmount', { min: 0, max: 50, step: 1 });

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
  // --- Fade ---
  if (params.fadeEnabled) {
    buffer.noStroke();
    buffer.fill(
      params.bgColor.r,
      params.bgColor.g,
      params.bgColor.b,
      params.fadeAmount
    );
    buffer.rect(0, 0, width, height);
  }

  // --- Draw stroke ---
  if (drawing) {
    let target = createVector(mouseX - width / 2, mouseY - height / 2);
    current.lerp(target, params.smoothing);

    let speed = p5.Vector.dist(prev, current);

    let targetThickness = map(
      speed,
      0,
      10,
      params.thicknessMax,
      1,
      true
    );

    thickness = lerp(thickness, targetThickness, 0.2);

    buffer.stroke(
      params.strokeColor.r,
      params.strokeColor.g,
      params.strokeColor.b
    );
    buffer.strokeWeight(thickness);

    buffer.push();
    buffer.translate(width / 2, height / 2);

    // 1) Main stroke (unrotated, smoothed)
    buffer.line(prev.x, prev.y, current.x, current.y);

    // Mirror of main stroke
    buffer.push();
    buffer.scale(1, -1);
    buffer.line(prev.x, prev.y, current.x, current.y);
    buffer.pop();

    // 2) Rotated symmetry strokes
    for (let i = 1; i < params.symmetry; i++) {
      buffer.rotate(angle);

      buffer.line(prev.x, prev.y, current.x, current.y);

      buffer.push();
      buffer.scale(1, -1);
      buffer.line(prev.x, prev.y, current.x, current.y);
      buffer.pop();
    }

    buffer.pop();

    prev = current.copy();
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
  buffer.background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );
}

function saveMandala() {
  saveCanvas('MandalaFadeGlow', 'png');
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