let metaballShader;
let postShader;
let renderBuffer;

let pane;
let params = {
  numMetaballs: 5,
  radiusMin: 30,
  radiusMax: 60,
  amplitudeMin: 80,
  amplitudeMax: 130,
  frequencyMin: 0.8,
  frequencyMax: 1.8,
  k: 40,
  edgeThickness: 2.5,
  colorAnimationAmount: 0.05,
  bgColorA: { r: 250, g: 247, b: 230 },
  bgColorB: { r: 200, g: 232, b: 242 },
  hashSeed: 12452.23418,
  chromaticAberration: 0.005
};

function preload() {
  metaballShader = loadShader("shader.vert", "shader.frag");
  postShader = loadShader("shader.vert", "post.frag");
}

function setup() {
  pixelDensity(1);
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  noStroke();

  renderBuffer = createGraphics(width, height, WEBGL);
  renderBuffer.noStroke();

  setupPane();
  updateShaderUniforms();
}

function draw() {
  // 1. Render metaballs to buffer
  renderBuffer.shader(metaballShader);
  updateShaderUniforms();
  renderBuffer.plane(width, height);

  // 2. Apply post-processing shader to canvas
  shader(postShader);
  postShader.setUniform("u_texture", renderBuffer);
  postShader.setUniform("u_resolution", [width, height]);
  postShader.setUniform("u_chromaticAberration", params.chromaticAberration);
  plane(width, height);
}

function updateShaderUniforms() {
  metaballShader.setUniform("u_resolution", [width, height]);
  metaballShader.setUniform("u_time", millis() / 1000.0);
  metaballShader.setUniform("u_numMetaballs", params.numMetaballs);
  metaballShader.setUniform("u_radiusRange", [params.radiusMin, params.radiusMax]);
  metaballShader.setUniform("u_amplitudeRange", [params.amplitudeMin, params.amplitudeMax]);
  metaballShader.setUniform("u_frequencyRange", [params.frequencyMin, params.frequencyMax]);
  metaballShader.setUniform("u_k", params.k);
  metaballShader.setUniform("u_edgeThickness", params.edgeThickness);
  metaballShader.setUniform("u_colorAnimationAmount", params.colorAnimationAmount);
  
  metaballShader.setUniform("u_bgColorA", [
    params.bgColorA.r / 255,
    params.bgColorA.g / 255,
    params.bgColorA.b / 255,
  ]);
  metaballShader.setUniform("u_bgColorB", [
    params.bgColorB.r / 255,
    params.bgColorB.g / 255,
    params.bgColorB.b / 255,
  ]);
  
  metaballShader.setUniform("u_hashSeed", params.hashSeed);
}

function setupPane() {
  pane = new Tweakpane.Pane();

  const metaballsFolder = pane.addFolder({ title: 'Metaballs' });
  metaballsFolder.addInput(params, "numMetaballs", { label: "Count", min: 1, max: 20, step: 1 });
  metaballsFolder.addInput(params, "radiusMin", { label: "Min Radius", min: 5, max: 100 });
  metaballsFolder.addInput(params, "radiusMax", { label: "Max Radius", min: 5, max: 100 });
  metaballsFolder.addInput(params, "amplitudeMin", { label: "Min Amplitude", min: 10, max: 200 });
  metaballsFolder.addInput(params, "amplitudeMax", { label: "Max Amplitude", min: 10, max: 200 });
  metaballsFolder.addInput(params, "frequencyMin", { label: "Min Frequency", min: 0.1, max: 5.0 });
  metaballsFolder.addInput(params, "frequencyMax", { label: "Max Frequency", min: 0.1, max: 5.0 });
  metaballsFolder.addInput(params, "hashSeed", { label: "Seed", min: 0.0, max: 99999.9, step: 0.1 });

  const appearanceFolder = pane.addFolder({ title: 'Appearance' });
  appearanceFolder.addInput(params, "k", { label: "Smoothness", min: 0.1, max: 100 });
  appearanceFolder.addInput(params, "edgeThickness", { label: "Edge Thickness", min: 0.1, max: 10 });
  appearanceFolder.addInput(params, "colorAnimationAmount", { label: "Color Animation", min: 0.0, max: 0.5 });
  appearanceFolder.addInput(params, "bgColorA", { label: "Background A", view: "color" });
  appearanceFolder.addInput(params, "bgColorB", { label: "Background B", view: "color" });

  const effectsFolder = pane.addFolder({ title: 'Effects' });
  effectsFolder.addInput(params, "chromaticAberration", { label: "Chromatic Aberration", min: 0.0, max: 1.0, step: 0.001 });
}
