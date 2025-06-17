const params = {
  noiseDetail: 0.015,
  resolution: 180,
  noiseFactor: 30,
  speed: 0.015,
  numberOfCurves: 50,
  gap: 3,
  weight: 1,
  baseColor: "#2EE1E9",
  colorMode: "tints",
};

let curveNoiseFactor = params.noiseFactor;

function setup() {
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  pixelDensity(4);
  // noLoop();
  
  setupGui();
}

function draw() {
  apply2DTransformations();

  noFill();
  strokeWeight(params.weight);

  // brush.strokeWeight(2);
  // console.log(brush.box());
  // brush.pick("HB");
  // brush.noStroke();

  colorGen = new ColorGenerator(params.baseColor);
  complementary = colorGen.getShades(2);
  background(complementary[1]);

  switch (params.colorMode) {
    case "tints":
      colors = colorGen.getTints(params.numberOfCurves, 90);
      break;
    case "shades":
      colors = colorGen.getShades(params.numberOfCurves, 10);
      break;
    case "triadic":
      colors = colorGen.getTriadic();
      break;
    case "tetradic":
      colors = colorGen.getTetradic();
      break;
  }

  createNoisyCircles(width / 2, height / 2, colors);
}

function createNoisyCircles(centerX, centerY, colors) {
  for (j = 0; j < params.numberOfCurves; j++) {
    beginShape();
    stroke(colors[j % colors.length]);
    curveNoiseFactor = params.noiseFactor + j;

    for (i = 0; i <= params.resolution; i++) {
      circlePoint = map(i, 0, params.resolution, 0, TWO_PI);

      curveRadius = j * params.gap;

      x = centerX + cos(circlePoint) * curveRadius;
      y = centerY + sin(circlePoint) * curveRadius;

      n = noise(
        x * params.noiseDetail,
        y * params.noiseDetail,
        frameCount * params.speed
      );

      let offsetX = n * cos(circlePoint) * curveNoiseFactor;
      let offsetY = n * sin(circlePoint) * curveNoiseFactor;

      vertex(x + offsetX, y + offsetY);
    }
    endShape();
  }
}

function setupGui() {
  const pane = new Tweakpane.Pane();
  
  // add folders
  let generalFolder = pane.addFolder({ title: "General" });
  let noiseFolder = pane.addFolder({ title: "Noise" });
  let styleFolder = pane.addFolder({ title: "Style" });
  
  // general folder
  generalFolder.addInput(params, "numberOfCurves", {
    min: 1,
    max: 150,
    step: 1,
  });
  generalFolder.addInput(params, "resolution", { min: 5, max: 360, step: 1 });
  generalFolder.addInput(params, "speed", { min: 0, max: 0.1, step: 0.001 });

  // noise folder
  noiseFolder.addInput(params, "noiseDetail", {
    min: 0,
    max: 0.3,
    step: 0.001,
  });
  noiseFolder.addInput(params, "noiseFactor", { min: 1, max: 200, step: 1 });

  // style folder
  styleFolder.addInput(params, "gap", { min: 1, max: 20, step: 1 });
  styleFolder.addInput(params, "baseColor");
  styleFolder.addInput(params, "weight", { min: 1, max: 10, step: 1 });
  styleFolder.addInput(params, "colorMode", {
    options: {
      Tints: "tints",
      Shades: "shades",
      Triadic: "triadic",
      Tetradic: "tetradic",
    },
  });
}

function apply2DTransformations() {
  translate(-width / 2, -height / 2);
}
