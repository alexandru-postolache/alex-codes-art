let settings = {
  arcs: 30,
  radius: { min: 1, max: 360 },
  gap: { min: 15, max: 25 },
  movementOffset: 0,
  weight: { min: 2, max: 15 },
  speed: { min: 0, max: 0.003 },
  arcsColor: "#dbf7ff",
  background: "#012d3a",
  directions: "both",
};

let directions = ["left", "right", "both"];

let angleStart, angleFinish, gap;
let curves = [];

function setup() {
  createCanvas(windowWidth, windowHeight);

  setupGui();

  init();
}

function setupGui() {
  const pane = new Tweakpane.Pane({
    title: "Parameters",
  });
  pane.registerPlugin(TweakpaneEssentialsPlugin);
  pane.addInput(settings, "arcs");
  pane.addInput(settings, "radius", {
    min: 0,
    max: 360,
    step: 1,
  });
  pane.addInput(settings, "gap", {
    min: 0,
    max: 30,
    step: 1,
  });
  pane.addInput(settings, "weight", {
    min: 2,
    max: 30,
    step: 1,
  });
  pane.addInput(settings, "speed", {
    min: 0,
    max: 1,
    step: 0.001,
  });
  pane.addInput(settings, "arcsColor");
  pane.addInput(settings, "background");
  pane.addInput(settings, "directions", {
    view: "radiogrid",
    groupName: "scale",
    size: [3, 1],
    cells: (x, y) => ({
      title: directions[x],
      value: directions[x],
    }),
    label: "direction",
  });

  pane.on("change", (ev) => {
    init();
  });
}

function init() {
  colorGen = new ColorGenerator(settings.arcsColor);
  colors = colorGen.getTints(settings.arcs);

  gap = random(settings.gap.min, settings.gap.max);

  for (i = 0; i < settings.arcs; i++) {
    angleStart = int(random(settings.radius.min, settings.radius.max));
    angleFinish = int(random(settings.radius.min, settings.radius.max));
    switch (settings.directions) {
      case "both":
        movementDirection = int(random(0, 2));
        break;
      case "left":
        movementDirection = 1;
        break;
      case "right":
        movementDirection = 0;
        break;
    }

    movementSpeed = random(settings.speed.min, settings.speed.max);
    curveWeight = random(settings.weight.min, settings.weight.max);

    curves[i] = new RadialStroke(
      width / 2,
      height / 2,
      i * gap,
      angleStart,
      angleFinish,
      colors[i],
      curveWeight,
      movementDirection,
      movementSpeed
    );
  }
}

function draw() {
  background(settings.background);
  noFill();

  for (i = 0; i < settings.arcs; i++) {
    curves[i].draw();
  }
}
