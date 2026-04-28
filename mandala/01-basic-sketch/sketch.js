let symmetry = 8;
let angle;

let drawing = false;
let current;
let prev;
let thickness = 2;

let mandalaBuffer;

let params = {
  symmetry: 8,
  smoothing: 0.2,
  thicknessMax: 10,
  minSegmentLength: 0.8,

  bgColor: { r: 30, g: 30, b: 70 },
  strokeColor: { r: 255, g: 215, b: 0 }
};

let pane;
let paneContainer;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  mandalaBuffer = createGraphics(width, height);
  mandalaBuffer.strokeCap(ROUND);
  mandalaBuffer.noFill();
  mandalaBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);

  current = createVector(0, 0);
  prev = createVector(0, 0);

  pane = new Tweakpane.Pane({ title: 'Mandala — Basic' });
  paneContainer = pane.element;

  const motionFolder = pane.addFolder({ title: 'Motion', expanded: true });
  const colorFolder = pane.addFolder({ title: 'Colors', expanded: false });

  motionFolder.addInput(params, 'symmetry', { min: 2, max: 16, step: 1 })
    .on('change', updateSymmetry);

  motionFolder.addInput(params, 'smoothing', { min: 0.05, max: 0.5, step: 0.01 });
  motionFolder.addInput(params, 'thicknessMax', { min: 1, max: 20, step: 0.5 });
  motionFolder.addInput(params, 'minSegmentLength', { min: 0.1, max: 5, step: 0.1 });

  colorFolder.addInput(params, 'bgColor', { view: 'color' })
    .on('change', () => {
      mandalaBuffer.background(
        params.bgColor.r,
        params.bgColor.g,
        params.bgColor.b
      );
    });

  colorFolder.addInput(params, 'strokeColor', { view: 'color' });

  pane.addButton({ title: 'Clear' }).on('click', clearMandala);
  pane.addButton({ title: 'Save' }).on('click', saveMandala);

  updateSymmetry();
}

function draw() {
  if (drawing && !isPointerOverPane()) {
    let target = createVector(mouseX - width / 2, mouseY - height / 2);
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
      drawSymmetricSegment(prev.x, prev.y, current.x, current.y, thickness);
      prev = current.copy();
    }
  }

  background(params.bgColor.r, params.bgColor.g, params.bgColor.b);
  image(mandalaBuffer, 0, 0);
}

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
  if (!paneContainer || typeof paneContainer.getBoundingClientRect !== 'function') {
    return false;
  }
  let rect = paneContainer.getBoundingClientRect();
  return (
    mouseX >= rect.left &&
    mouseX <= rect.right &&
    mouseY >= rect.top &&
    mouseY <= rect.bottom
  );
}

function keyPressed() {
  if (key === 'h') {
    pane.hidden = !pane.hidden;
  }
}

function updateSymmetry() {
  symmetry = params.symmetry;
  angle = 360 / symmetry;
}

function clearMandala() {
  mandalaBuffer.background(
    params.bgColor.r,
    params.bgColor.g,
    params.bgColor.b
  );
}

function saveMandala() {
  saveCanvas('MandalaBasic', 'png');
}

function drawSymmetricSegment(x1, y1, x2, y2, weight) {
  mandalaBuffer.stroke(
    params.strokeColor.r,
    params.strokeColor.g,
    params.strokeColor.b
  );
  mandalaBuffer.strokeWeight(weight);

  mandalaBuffer.push();
  mandalaBuffer.translate(width / 2, height / 2);

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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  let newBuffer = createGraphics(width, height);
  newBuffer.strokeCap(ROUND);
  newBuffer.noFill();
  newBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);
  newBuffer.image(mandalaBuffer, 0, 0);
  mandalaBuffer = newBuffer;
}
