/*
  Modes:

  "ALL_3X3"
      Generate all unique 3×3 partitions.

  "RANDOM_ONE"
      Generate random partitions at the chosen grid size.
      Columns and rows choose how many are drawn across and down.

  "ANIMATE"
      Play one partition as it is built: the spanning tree,
      the cuts that separate regions, then the outline.

  The Tweakpane panel edits these settings live.
  "Any count" chooses a valid region count at random.
  "Allow equals" keeps a partition even when two regions
  have the same size. Otherwise every region has a different size.

  The canvas fills the browser window. Partitions are centered
  in the space beside the controls. A sheet is scaled to fit there.

  Each region is filled from a palette built by ColorGenerator.
  The Color folder chooses the base color and the scheme.
  The Tiles folder can fill each region with a Kenney pattern.
  Patterns may repeat when there are more regions than sets.

  The Beats folder plays the partition with Strudel.
  Each row of piano takes half a bar. Region sizes are Euclidean
  drum densities of at most 16 steps on one kit, and the
  spanning tree is a quiet pitched line.
*/

const RANDOM_CANVAS = 700;

// Tile size at which a fitted sheet matches the frame.
// Larger values draw a larger piece. Smaller values draw a smaller one.
const TILE_REFERENCE = 105;

const MAX_GRID_SIZE = 12;

const params = {
  mode: "RANDOM_ONE",

  // Used only in RANDOM_ONE mode.
  gridSize: 5,

  /*
    anyCount chooses a valid region count at random.
    Otherwise regionCount is used.
  */
  anyCount: true,
  regionCount: 4,

  // Checked: regions may share a size.
  // Unchecked: every region must have a different size.
  allowEqualSizes: false,

  // How many random partitions to draw, across and down.
  columnCount: 1,
  rowCount: 1,

  // Same seed reproduces the same random partition.
  seed: Math.floor(Math.random() * 1000000),

  // Layout for ALL_3X3.
  columns: 5,
  tileSize: 105,
  pageMargin: 35,
  shapeSize: 66,

  outlineColor: "#292932",
  backgroundColor: "#eeeae1",

  // Region fills. ColorGenerator builds the palette from the base.
  baseColor: "#3f6f86",
  colorScheme: "analogous",
  paletteSize: 6,
  shadeLimit: 10,
  tintLimit: 92,
  harmonyDegree: 30,
  increaseSaturation: false,
  increaseBrightness: true,

  // Kenney Pattern Pack Extra. Each region takes one pattern.
  useTiles: true,
  patternCount: 8,
  patternScale: 1,

  strokeWidth: 2.2,
  // Measured relative to one grid cell.
  regionInset: 0.095,

  // Measured in pixels. Random mode scales the shape
  // by this fraction of the canvas.
  cornerRadius: 20,
  shapeScale: 0.72,

  // Steps per second while the animated mode is playing.
  playbackSpeed: 16,

  // Strudel playback. Play starts on a click, then follows
  // the partition as it changes.
  beatPlay: false,
  beatShape: true,
  beatSizes: true,
  beatTree: true,
  beatTempo: 0.8,
  beatLevel: 0.8
};

// Active grid size. ALL_3X3 always uses 3.
let gridSize = params.gridSize;

let partitions = [];
let catalogPartitions = null;

let pane;
let generationFolder;
let regionInput;
let seedInput;
let layoutFolder;
let scaleInput;
let summaryMonitor;
let columnsInput;
let columnCountInput;
let rowCountInput;
let playbackFolder;
let colorInputs = {};

let regionPaletteColors = [];
let regionPaletteKey = "";

let animation = null;
let lastAnimationCaption = "";

const readout = {
  summary: ""
};

const CUT_COLOR = "#c4552a";

const PATTERN_COUNT = 84;
let patternImages = [];
let tileInputs = {};

let beatPlayInput;
let beatStatusMonitor;
let beatCodeView;
let beatTimer = 0;
let beatToken = 0;
let lastPlayedCode = "";
let beatAudible = false;

const beatReadout = {
  status: "loading samples"
};

async function setup() {
  const canvas = createCanvas(
    windowWidth,
    windowHeight
  );

  canvas.parent("sketch");
  pixelDensity(2);
  noLoop();

  const loads = [];

  for (let index = 0; index < PATTERN_COUNT; index++) {
    const name = String(index).padStart(3, "0");
    loads.push(loadImage(`tiles/pattern_${name}.png`));
  }

  patternImages = await Promise.all(loads);
  setupPane();
  rebuild(true);
  watchBeatPlayer();
}

function draw() {
  document.body.style.background =
    cssColor(params.backgroundColor);

  background(cssColor(params.backgroundColor));

  if (params.mode === "ANIMATE") {
    paintAnimation();
    return;
  }

  if (partitions.length === 0) {
    return;
  }

  paintPartitions(drawingContext, "stroke");
}

function paintPartitions(target, style) {
  const frame = contentFrame();

  if (usesSheet()) {
    const placement = sheetPlacement(frame);
    const columns = placement.columns;

    for (let i = 0; i < partitions.length; i++) {
      const col = i % columns;
      const row = floor(i / columns);

      const centerX =
        placement.originX +
        col * placement.tile +
        placement.tile / 2;

      const centerY =
        placement.originY +
        row * placement.tile +
        placement.tile / 2;

      drawPartition(
        partitions[i],
        centerX,
        centerY,
        placement.shape,
        style,
        target,
        placement.pixelScale
      );
    }

    return;
  }

  const shape =
    min(frame.width, frame.height) * params.shapeScale;

  drawPartition(
    partitions[0],
    frame.x + frame.width / 2,
    frame.y + frame.height / 2,
    shape,
    style,
    target,
    inkScale(shape)
  );
}

// The open area beside the controls. The canvas itself is the full window.
function contentFrame() {
  const panel = document.getElementById("controls");
  const reserved = panel ? panel.offsetWidth + 32 : 0;

  return {
    x: 0,
    y: 0,
    width: max(1, width - reserved),
    height: max(1, height)
  };
}

// Fit the tile block to the open area and center it.
// The pitch fills that area. The piece then grows with tile size,
// so a larger tile draws a larger partition instead of a smaller one.
function sheetPlacement(frame) {
  const columns = max(1, sheetColumns());
  const rows = max(
    1,
    ceil(partitions.length / columns)
  );

  const margin = params.pageMargin;
  const availW = max(1, frame.width - margin * 2);
  const availH = max(1, frame.height - margin * 2);
  const fitted = min(
    availW / (columns * TILE_REFERENCE),
    availH / (rows * TILE_REFERENCE)
  );
  const tileScale = TILE_REFERENCE === 0
    ? 1
    : params.tileSize / TILE_REFERENCE;

  const tile = TILE_REFERENCE * fitted;
  const shape = params.shapeSize * fitted * tileScale;
  const drawnW = columns * tile;
  const drawnH = rows * tile;

  return {
    columns,
    rows,
    originX: frame.x + (frame.width - drawnW) / 2,
    originY: frame.y + (frame.height - drawnH) / 2,
    tile,
    shape,
    pixelScale: inkScale(shape)
  };
}

// Stroke and corner radius follow the on-screen size of one piece.
// The reference is the single-piece canvas, so a sheet does not
// thicken the stroke just because more pieces were added.
function inkScale(drawnSize) {
  const reference = RANDOM_CANVAS * params.shapeScale;

  if (reference <= 0) {
    return 1;
  }

  return drawnSize / reference;
}

function usesSheet() {
  return (
    params.mode === "ALL_3X3" ||
    params.columnCount * params.rowCount > 1
  );
}

function sheetColumns() {
  if (params.mode === "ALL_3X3") {
    return params.columns;
  }

  return params.columnCount;
}

function keyPressed() {
  const target = document.activeElement;

  if (
    target &&
    (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA"
    )
  ) {
    return;
  }

  // Generate another random partition.
  if (
    (
      params.mode === "RANDOM_ONE" ||
      params.mode === "ANIMATE"
    ) &&
    (key === "r" || key === "R")
  ) {
    randomizePartition();
  }

  if (key === "s" || key === "S") {
    savePartition();
  }
}

function activeGridSize() {
  if (params.mode === "ALL_3X3") {
    return 3;
  }

  return params.gridSize;
}

/*
  For k regions to have distinct positive sizes,
  the smallest possible total is:

    1 + 2 + 3 + ... + k

  which equals:

    k * (k + 1) / 2
*/
function maximumRegionCount(size) {
  const cellCount = size * size;

  return floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );
}

function savePartition() {
  let name = `partition-${gridSize}x${gridSize}`;

  if (params.mode === "ANIMATE") {
    name = `partition-steps-${gridSize}x${gridSize}`;
  } else if (params.mode === "ALL_3X3") {
    name = "partitions-3x3";
  } else if (params.columnCount * params.rowCount > 1) {
    name =
      `partitions-${params.columnCount}x${params.rowCount}`;
  }

  saveCanvas(name, "png");
}

function randomizePartition() {
  params.seed = floor(Math.random() * 1000000);

  if (seedInput) {
    seedInput.refresh();
  }

  rebuild(true);
}

/* =========================================================
   CONTROLS
   ========================================================= */

const DRAWING_KEYS = new Set([
  "outlineColor",
  "backgroundColor",
  "baseColor",
  "colorScheme",
  "paletteSize",
  "shadeLimit",
  "tintLimit",
  "harmonyDegree",
  "increaseSaturation",
  "increaseBrightness",
  "useTiles",
  "patternCount",
  "patternScale",
  "strokeWidth",
  "regionInset",
  "cornerRadius",
  "shapeScale"
]);

const LAYOUT_KEYS = new Set([
  "columns",
  "tileSize",
  "pageMargin",
  "shapeSize"
]);

const STRUCTURAL_KEYS = new Set([
  "mode",
  "gridSize",
  "anyCount",
  "allowEqualSizes",
  "regionCount",
  "columnCount",
  "rowCount",
  "seed"
]);

const BEAT_KEYS = new Set([
  "beatPlay",
  "beatShape",
  "beatSizes",
  "beatTree",
  "beatTempo",
  "beatLevel",
  "baseColor",
  "patternCount",
  "seed"
]);

function setupPane() {
  const container =
    document.getElementById("controls");

  pane = new Tweakpane.Pane({
    container,
    title: "Polyomino"
  });

  pane.addInput(params, "mode", {
    label: "mode",
    options: {
      "Random": "RANDOM_ONE",
      "Animate": "ANIMATE",
      "All 3×3": "ALL_3X3"
    }
  });

  generationFolder = pane.addFolder({
    title: "Generation"
  });

  generationFolder.addInput(params, "gridSize", {
    label: "grid size",
    min: 2,
    max: MAX_GRID_SIZE,
    step: 1
  });

  columnCountInput = generationFolder.addInput(params, "columnCount", {
    label: "columns",
    min: 1,
    max: 8,
    step: 1
  });

  rowCountInput = generationFolder.addInput(params, "rowCount", {
    label: "rows",
    min: 1,
    max: 8,
    step: 1
  });

  const regionFolder = generationFolder.addFolder({
    title: "Regions"
  });

  regionFolder.addInput(params, "anyCount", {
    label: "any count"
  });

  regionInput = regionFolder.addInput(
    params,
    "regionCount",
    {
      label: "regions",
      min: 2,
      max: maximumRegionCount(MAX_GRID_SIZE),
      step: 1
    }
  );

  regionInput.maxValue = maximumRegionCount(
    params.gridSize
  );

  generationFolder.addInput(params, "allowEqualSizes", {
    label: "allow equals"
  });

  seedInput = generationFolder.addInput(
    params,
    "seed",
    {
      label: "seed",
      min: 0,
      max: 999999,
      step: 1
    }
  );

  generationFolder.addButton({
    title: "New partition"
  }).on("click", () => {
    randomizePartition();
  });

  playbackFolder = pane.addFolder({
    title: "Playback"
  });

  playbackFolder.addInput(params, "playbackSpeed", {
    label: "speed",
    min: 4,
    max: 40,
    step: 1
  });

  playbackFolder.addButton({
    title: "Replay"
  }).on("click", () => {
    if (!animation) {
      rebuild(true);
      return;
    }

    animation.startedAt = millis();
    lastAnimationCaption = "";
  });

  layoutFolder = pane.addFolder({
    title: "Layout"
  });

  columnsInput = layoutFolder.addInput(params, "columns", {
    label: "columns",
    min: 1,
    max: 10,
    step: 1
  });

  layoutFolder.addInput(params, "tileSize", {
    label: "tile size",
    min: 70,
    max: 180,
    step: 1
  });

  layoutFolder.addInput(params, "pageMargin", {
    label: "margin",
    min: 0,
    max: 80,
    step: 1
  });

  layoutFolder.addInput(params, "shapeSize", {
    label: "shape size",
    min: 24,
    max: 150,
    step: 1
  });

  const drawingFolder = pane.addFolder({
    title: "Drawing"
  });

  drawingFolder.addInput(params, "backgroundColor", {
    label: "background"
  });

  drawingFolder.addInput(params, "outlineColor", {
    label: "outline"
  });

  drawingFolder.addInput(params, "strokeWidth", {
    label: "stroke",
    min: 0,
    max: 16,
    step: 0.1
  });

  drawingFolder.addInput(params, "regionInset", {
    label: "inset",
    min: 0,
    max: 0.35,
    step: 0.005
  });

  drawingFolder.addInput(params, "cornerRadius", {
    label: "corners",
    min: 0,
    max: 80,
    step: 1
  });

  scaleInput = drawingFolder.addInput(
    params,
    "shapeScale",
    {
      label: "scale",
      min: 0.35,
      max: 0.92,
      step: 0.01
    }
  );

  const colorFolder = pane.addFolder({
    title: "Color"
  });

  colorFolder.addInput(params, "baseColor", {
    label: "base"
  });

  colorFolder.addInput(params, "colorScheme", {
    label: "scheme",
    options: {
      "Solid": "solid",
      "Shades": "shades",
      "Tints": "tints",
      "Monochromatic": "monochromatic",
      "Complementary": "complementary",
      "Split complementary": "split",
      "Analogous": "analogous",
      "Triadic": "triadic",
      "Tetradic": "tetradic"
    }
  });

  colorInputs.paletteSize = colorFolder.addInput(params, "paletteSize", {
    label: "colors",
    min: 2,
    max: 16,
    step: 1
  });

  colorInputs.shadeLimit = colorFolder.addInput(params, "shadeLimit", {
    label: "shade limit",
    min: 0,
    max: 100,
    step: 1
  });

  colorInputs.tintLimit = colorFolder.addInput(params, "tintLimit", {
    label: "tint limit",
    min: 0,
    max: 100,
    step: 1
  });

  colorInputs.harmonyDegree = colorFolder.addInput(params, "harmonyDegree", {
    label: "degree",
    min: 1,
    max: 90,
    step: 1
  });

  colorInputs.increaseSaturation = colorFolder.addInput(
    params,
    "increaseSaturation",
    { label: "more saturation" }
  );

  colorInputs.increaseBrightness = colorFolder.addInput(
    params,
    "increaseBrightness",
    { label: "more brightness" }
  );

  updateColorVisibility();

  const tileFolder = pane.addFolder({
    title: "Tiles"
  });

  tileFolder.addInput(params, "useTiles", {
    label: "patterns"
  });

  tileInputs.count = tileFolder.addInput(params, "patternCount", {
    label: "sets",
    min: 1,
    max: PATTERN_COUNT,
    step: 1
  });

  tileInputs.scale = tileFolder.addInput(params, "patternScale", {
    label: "scale",
    min: 0.4,
    max: 2.5,
    step: 0.05
  });

  updateTileVisibility();

  const beatsFolder = pane.addFolder({
    title: "Beats"
  });

  beatPlayInput = beatsFolder.addInput(params, "beatPlay", {
    label: "play"
  });

  beatPlayInput.disabled = true;

  beatsFolder.addInput(params, "beatShape", {
    label: "shape"
  });

  beatsFolder.addInput(params, "beatSizes", {
    label: "sizes"
  });

  beatsFolder.addInput(params, "beatTree", {
    label: "tree"
  });

  beatsFolder.addInput(params, "beatTempo", {
    label: "tempo",
    min: 0.25,
    max: 2,
    step: 0.05
  });

  beatsFolder.addInput(params, "beatLevel", {
    label: "level",
    min: 0,
    max: 1,
    step: 0.05
  });

  beatStatusMonitor = beatsFolder.addMonitor(beatReadout, "status", {
    label: "audio",
    interval: 0
  });

  beatsFolder.addButton({
    title: "Copy pattern"
  }).on("click", () => {
    copyBeatCode();
  });

  beatsFolder.addButton({
    title: "Open in Strudel"
  }).on("click", () => {
    openBeatInStrudel();
  });

  const beatPanel = document.createElement("div");
  beatPanel.id = "beat-panel";

  const beatLabel = document.createElement("div");
  beatLabel.id = "beat-label";
  beatLabel.textContent = "Pattern";
  beatPanel.appendChild(beatLabel);

  beatCodeView = document.createElement("pre");
  beatCodeView.id = "beat-code";
  beatPanel.appendChild(beatCodeView);
  container.appendChild(beatPanel);

  summaryMonitor = pane.addMonitor(
    readout,
    "summary",
    {
      label: "sizes",
      interval: 0
    }
  );

  pane.addButton({
    title: "Save PNG"
  }).on("click", () => {
    savePartition();
  });

  pane.on("change", (event) => {
    const presetKey = event.presetKey;

    if (!presetKey) {
      return;
    }

    if (presetKey === "playbackSpeed") {
      syncAnimationSpeed();
      return;
    }

    if (presetKey === "beatPlay") {
      if (params.beatPlay) {
        scheduleBeat();
      } else {
        stopBeat();
      }

      return;
    }

    if (presetKey === "colorScheme") {
      updateColorVisibility();
    }

    if (presetKey === "useTiles") {
      updateTileVisibility();
    }

    // Drawing and layout values repaint while the pointer is still down.
    // Generation values do too, so a sheet does not wait for release.
    if (
      DRAWING_KEYS.has(presetKey) ||
      LAYOUT_KEYS.has(presetKey)
    ) {
      draw();
      syncBeat(presetKey);
      return;
    }

    if (presetKey === "gridSize") {
      clampRegionCount();
    }

    if (presetKey === "anyCount") {
      updateRegionCountAvailability();
    }

    if (STRUCTURAL_KEYS.has(presetKey)) {
      rebuild(true);
    }

    syncBeat(presetKey);
  });
}

function clampRegionCount() {
  const limit = maximumRegionCount(params.gridSize);

  if (regionInput) {
    regionInput.maxValue = limit;
  }

  if (params.regionCount > limit) {
    params.regionCount = limit;
  }

  if (params.regionCount < 2) {
    params.regionCount = 2;
  }

  if (regionInput) {
    regionInput.refresh();
  }
}

function updateRegionCountAvailability() {
  if (regionInput) {
    regionInput.disabled = params.anyCount;
  }
}

function updateColorVisibility() {
  const scheme = params.colorScheme;
  const usesCount =
    scheme === "shades" ||
    scheme === "tints" ||
    scheme === "monochromatic";

  if (!colorInputs.paletteSize) {
    return;
  }

  colorInputs.paletteSize.hidden = !usesCount;
  colorInputs.shadeLimit.hidden = scheme !== "shades";
  colorInputs.tintLimit.hidden = scheme !== "tints";
  colorInputs.harmonyDegree.hidden =
    scheme !== "analogous" && scheme !== "split";
  colorInputs.increaseSaturation.hidden = scheme !== "monochromatic";
  colorInputs.increaseBrightness.hidden = scheme !== "monochromatic";
}

function watchBeatPlayer() {
  if (!window.PolyominoPlayer) {
    setBeatStatus("audio failed to load");
    return;
  }

  PolyominoPlayer.ready.then(() => {
    if (beatPlayInput) {
      beatPlayInput.disabled = false;
    }

    if (!params.beatPlay) {
      setBeatStatus("ready");
    }
  }).catch((error) => {
    console.error(error);
    setBeatStatus(error.message || "audio failed to load");
  });
}

function syncBeat(presetKey) {
  if (STRUCTURAL_KEYS.has(presetKey)) {
    return;
  }

  if (!BEAT_KEYS.has(presetKey)) {
    return;
  }

  scheduleBeat();
}

function beatScore() {
  return {
    gridSize,
    cps: params.beatTempo,
    gain: params.beatLevel,
    rootMidi: window.PolyominoBeats
      ? PolyominoBeats.rootMidiFromColor(params.baseColor)
      : 48,
    patternCount: params.patternCount,
    seed: params.seed,
    layers: {
      shape: params.beatShape,
      sizes: params.beatSizes,
      tree: params.beatTree
    },
    partitions: partitions.map((grid) => ({
      labels: Array.from(grid),
      tree: grid.tree || null,
      cuts: grid.cuts || null,
      start: grid.start
    }))
  };
}

function refreshBeatCode() {
  if (!window.PolyominoBeats || !beatCodeView) {
    return "";
  }

  const patternText = PolyominoBeats.buildBeat(beatScore());
  beatCodeView.textContent = patternText;
  return patternText;
}

function scheduleBeat() {
  const patternText = refreshBeatCode();

  if (!params.beatPlay || !window.PolyominoPlayer) {
    return;
  }

  clearTimeout(beatTimer);
  const token = ++beatToken;

  beatTimer = setTimeout(() => {
    startBeat(patternText, token);
  }, 80);
}

async function startBeat(patternText, token) {
  if (!params.beatPlay || token !== beatToken) {
    return;
  }

  if (patternText === lastPlayedCode && beatAudible) {
    setBeatStatus("playing");
    return;
  }

  setBeatStatus("loading");

  try {
    await PolyominoPlayer.ready;

    if (!params.beatPlay || token !== beatToken) {
      return;
    }

    const result = await PolyominoPlayer.play(patternText);

    if (!params.beatPlay || token !== beatToken) {
      PolyominoPlayer.stop();
      return;
    }

    lastPlayedCode = patternText;
    const hits = result && Number.isFinite(result.hits)
      ? result.hits
      : null;
    const audible = !result || result.status !== "suspended";
    beatAudible = audible;

    if (!audible) {
      setBeatStatus("click to hear");
      return;
    }

    setBeatStatus(
      hits === null
        ? "playing"
        : `${hits} hits`
    );
  } catch (error) {
    console.error(error);

    if (token === beatToken) {
      setBeatStatus(error.message || "audio failed");
    }
  }
}

function stopBeat() {
  beatToken += 1;
  lastPlayedCode = "";
  beatAudible = false;
  clearTimeout(beatTimer);

  if (window.PolyominoPlayer) {
    PolyominoPlayer.stop();
  }

  setBeatStatus("stopped");
}

function setBeatStatus(status) {
  beatReadout.status = status;

  if (beatStatusMonitor) {
    beatStatusMonitor.refresh();
  }
}

function copyBeatCode() {
  const patternText = refreshBeatCode();

  if (!patternText || !navigator.clipboard) {
    return;
  }

  navigator.clipboard.writeText(patternText).catch((error) => {
    console.error(error);
    setBeatStatus("could not copy");
  });
}

function openBeatInStrudel() {
  const patternText = refreshBeatCode();
  const encoded = encodeURIComponent(btoa(patternText));
  window.open(`https://strudel.cc/#${encoded}`, "_blank", "noopener");
}

document.addEventListener("pointerdown", () => {
  if (!params.beatPlay || beatAudible) {
    return;
  }

  lastPlayedCode = "";
  scheduleBeat();
}, true);

function updateTileVisibility() {
  const hidden = !params.useTiles;

  if (tileInputs.count) {
    tileInputs.count.hidden = hidden;
  }

  if (tileInputs.scale) {
    tileInputs.scale.hidden = hidden;
  }
}

function updatePaneVisibility() {
  const randomMode = params.mode === "RANDOM_ONE";
  const animateMode = params.mode === "ANIMATE";
  const catalogMode = params.mode === "ALL_3X3";
  const sheet = randomMode && params.columnCount * params.rowCount > 1;

  if (generationFolder) {
    generationFolder.hidden = catalogMode;
  }

  if (columnCountInput) {
    columnCountInput.hidden = !randomMode;
  }

  if (rowCountInput) {
    rowCountInput.hidden = !randomMode;
  }

  if (playbackFolder) {
    playbackFolder.hidden = !animateMode;
  }

  if (layoutFolder) {
    layoutFolder.hidden = animateMode || (randomMode && !sheet);
  }

  if (columnsInput) {
    columnsInput.hidden = !catalogMode;
  }

  if (scaleInput) {
    scaleInput.hidden = sheet || catalogMode;
  }

  updateRegionCountAvailability();

  if (summaryMonitor) {
    if (animateMode) {
      summaryMonitor.label = "step";
    } else if (randomMode && params.columnCount * params.rowCount === 1) {
      summaryMonitor.label = "sizes";
    } else {
      summaryMonitor.label = "count";
    }
  }
}

function rebuild(regenerate) {
  const nextGridSize = activeGridSize();

  if (params.mode === "ANIMATE") {
    gridSize = nextGridSize;

    try {
      const trace = {};
      const requested = params.anyCount
        ? null
        : params.regionCount;

      const grid = generateRandomPartition(
        gridSize,
        requested,
        params.allowEqualSizes,
        params.seed,
        trace
      );

      partitions = [grid];
      animation = createAnimation(trace);
      lastAnimationCaption = "";
      readout.summary = animationCaption(animation.script[0]);
      printPartitionInfo(grid);
    } catch (error) {
      animation = null;
      partitions = [];
      readout.summary = "No partition found";
      console.error(error);
    }
  } else if (params.mode === "ALL_3X3") {
    animation = null;
    gridSize = 3;

    if (!catalogPartitions) {
      catalogPartitions = generatePartitions();

      catalogPartitions.sort((a, b) =>
        canonicalForm(a).localeCompare(
          canonicalForm(b)
        )
      );
    }

    partitions = catalogPartitions;
    readout.summary =
      `${partitions.length} unique partitions`;
  } else if (
    regenerate ||
    partitions.length !== params.columnCount * params.rowCount ||
    partitions[0].length !== nextGridSize * nextGridSize
  ) {
    animation = null;
    const previousGridSize = gridSize;
    const previousPartitions = partitions;

    gridSize = nextGridSize;

    try {
      const requested = params.anyCount
        ? null
        : params.regionCount;

      const total = params.columnCount * params.rowCount;
      const next = [];

      for (let index = 0; index < total; index++) {
        next.push(
          generateRandomPartition(
            gridSize,
            requested,
            params.allowEqualSizes,
            params.seed + index * 100003
          )
        );
      }

      partitions = next;
      readout.summary = partitionSummary(next);

      if (next.length === 1) {
        printPartitionInfo(next[0]);
      }
    } catch (error) {
      gridSize = previousGridSize;
      partitions = previousPartitions;
      readout.summary = "No partition found";
      console.error(error);
    }
  } else {
    animation = null;
    gridSize = nextGridSize;

    readout.summary = partitionSummary(partitions);
  }

  updatePaneVisibility();

  if (summaryMonitor) {
    summaryMonitor.refresh();
  }

  if (params.mode === "ANIMATE" && animation) {
    loop();
  } else {
    noLoop();
  }

  fitCanvas();
  refreshBeatCode();

  if (params.beatPlay) {
    scheduleBeat();
  }
}

function partitionSummary(grids) {
  if (grids.length === 1) {
    return getRegionSizes(grids[0])
      .slice()
      .sort((a, b) => a - b)
      .join(", ");
  }

  return `${grids.length} partitions`;
}

function fitCanvas() {
  const nextWidth = windowWidth;
  const nextHeight = windowHeight;

  if (width !== nextWidth || height !== nextHeight) {
    resizeCanvas(nextWidth, nextHeight);
    return;
  }

  draw();
}

function windowResized() {
  fitCanvas();
}

function cssColor(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && value.r !== undefined) {
    const redChannel = Math.round(value.r);
    const greenChannel = Math.round(value.g);
    const blueChannel = Math.round(value.b);

    return `rgb(${redChannel}, ${greenChannel}, ${blueChannel})`;
  }

  return "#888888";
}

function colorValue(value) {
  return cssColor(value);
}

/*
  Build the region palette with the shared ColorGenerator.
  The generator switches p5 into HSB, so this restores RGB
  before any later drawing.
*/
function regionPalette() {
  const signature = [
    colorValue(params.baseColor),
    params.colorScheme,
    params.paletteSize,
    params.shadeLimit,
    params.tintLimit,
    params.harmonyDegree,
    params.increaseSaturation,
    params.increaseBrightness
  ].join("|");

  if (signature === regionPaletteKey) {
    return regionPaletteColors;
  }

  const count = max(1, round(params.paletteSize));
  const base = colorValue(params.baseColor);
  let generated;

  push();
  const generator = new ColorGenerator(base);

  switch (params.colorScheme) {
    case "shades":
      generated = generator.getShades(count, params.shadeLimit);
      break;
    case "tints":
      generated = generator.getTints(count, params.tintLimit);
      break;
    case "monochromatic":
      generated = generator.getMonochromatic(
        count,
        params.increaseSaturation,
        params.increaseBrightness
      );
      break;
    case "complementary":
      generated = generator.getComplementary();
      break;
    case "analogous":
      generated = generator.getAnalogous(params.harmonyDegree);
      break;
    case "split":
      generated = generator.getSplitComplementary(params.harmonyDegree);
      break;
    case "triadic":
      generated = generator.getTriadic();
      break;
    case "tetradic":
      generated = generator.getTetradic();
      break;
    default:
      generated = [color(base)];
      break;
  }

  regionPaletteColors = generated.map(cssFromColor);
  pop();
  colorMode(RGB, 255);
  regionPaletteKey = signature;
  return regionPaletteColors;
}

function cssFromColor(value) {
  push();
  colorMode(RGB, 255);
  const sample = color(value);
  const redChannel = round(red(sample));
  const greenChannel = round(green(sample));
  const blueChannel = round(blue(sample));
  pop();

  return `rgb(${redChannel}, ${greenChannel}, ${blueChannel})`;
}

function regionFill(label) {
  const colors = regionPalette();

  if (colors.length === 0) {
    return "#ffffff";
  }

  const index = abs(label) % colors.length;
  return colors[index];
}

function patternIndexFor(label) {
  const total = patternImages.length;

  if (total === 0) {
    return 0;
  }

  const used = constrain(
    round(params.patternCount),
    1,
    total
  );
  const shift = abs(floor(params.seed)) % used;

  return (abs(label) + shift) % used;
}

function patternSource(index) {
  const pattern = patternImages[index];

  if (!pattern || !pattern.width) {
    return null;
  }

  return pattern.canvas || pattern.elt || null;
}

function contourBounds(contours) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const contour of contours) {
    for (const point of contour) {
      minX = min(minX, point.x);
      minY = min(minY, point.y);
      maxX = max(maxX, point.x);
      maxY = max(maxY, point.y);
    }
  }

  return { minX, minY, maxX, maxY };
}

function stampPattern(ctx, source, originX, originY, motif, bounds) {
  const startX = originX + floor((bounds.minX - originX) / motif) * motif;
  const startY = originY + floor((bounds.minY - originY) / motif) * motif;
  const bleed = 0.75;

  for (let y = startY; y < bounds.maxY; y += motif) {
    for (let x = startX; x < bounds.maxX; x += motif) {
      ctx.drawImage(source, x, y, motif + bleed, motif + bleed);
    }
  }
}

/*
  The Kenney patterns are black and white. Multiply keeps the
  white parts of a pattern in the region color and the black
  parts as the motif.
*/
function paintPatternFill(ctx, label, originX, originY, cellSize, bounds) {
  ctx.fillStyle = regionFill(label);
  ctx.fill("evenodd");

  const source = patternSource(patternIndexFor(label));

  if (!source) {
    return;
  }

  const motif = max(8, cellSize * params.patternScale);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  stampPattern(ctx, source, originX, originY, motif, bounds);
  ctx.restore();
}

function withAlpha(css, alpha) {
  const channels = cssToChannels(css);
  return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${alpha})`;
}

function cssToChannels(css) {
  const value = cssColor(css);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);

  if (hex) {
    const packed = parseInt(hex[1], 16);

    return {
      r: (packed >> 16) & 255,
      g: (packed >> 8) & 255,
      b: packed & 255
    };
  }

  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);

  if (match) {
    return {
      r: round(Number(match[1])),
      g: round(Number(match[2])),
      b: round(Number(match[3]))
    };
  }

  return { r: 255, g: 255, b: 255 };
}

/* =========================================================
   ANIMATED CONSTRUCTION
   ========================================================= */

/*
  Play the successful attempt: the depth-first spanning
  tree, the links cut out of it, then the outline as it
  is traced, inset, and rounded.
*/

function createAnimation(trace) {
  const paths = collectOutlinePaths(trace.grid);
  const script = [];
  let boundaryTotal = 0;

  for (const path of paths) {
    boundaryTotal += path.raw.length;
  }

  holdStep(script, { type: "grid" }, 5);
  holdStep(script, { type: "start" }, 6);

  for (let count = 1; count <= trace.tree.length; count++) {
    script.push({
      type: "tree",
      count,
      total: trace.tree.length
    });
  }

  holdStep(script, { type: "tree-done" }, 10);

  for (let i = 0; i < trace.cuts.length; i++) {
    holdStep(script, {
      type: "cut",
      removed: i,
      marking: true
    }, 4);

    holdStep(script, {
      type: "cut",
      removed: i + 1,
      marking: false
    }, 3);
  }

  holdStep(script, { type: "regions" }, 12);

  for (let count = 1; count <= boundaryTotal; count++) {
    script.push({
      type: "boundary",
      count,
      total: boundaryTotal
    });
  }

  holdStep(script, { type: "simple" }, 10);

  for (let frame = 1; frame <= 12; frame++) {
    script.push({
      type: "inset",
      t: frame / 12
    });
  }

  for (let frame = 1; frame <= 14; frame++) {
    script.push({
      type: "round",
      t: frame / 14
    });
  }

  script.push({ type: "done" });

  return {
    tree: trace.tree,
    cuts: trace.cuts,
    grid: trace.grid,
    start: trace.start,
    attempts: trace.attempts,
    regionCount: trace.regionCount,
    sizes: getRegionSizes(trace.grid)
      .slice()
      .sort((a, b) => a - b)
      .join(", "),
    paths,
    script,
    stepMs: 1000 / max(1, params.playbackSpeed),
    holdMs: 1500,
    startedAt: millis()
  };
}

function holdStep(script, step, frames) {
  for (let i = 0; i < frames; i++) {
    script.push(step);
  }
}

function collectOutlinePaths(grid) {
  const paths = [];

  for (const region of getRegionLabels(grid)) {
    const contours = traceAllContours(
      getBoundaryEdges(grid, region)
    );

    for (const contour of contours) {
      const simplified = simplifyContour(contour);

      if (simplified.length < 4) {
        continue;
      }

      paths.push({
        raw: contour,
        simplified
      });
    }
  }

  return paths;
}

function syncAnimationSpeed() {
  if (!animation) {
    return;
  }

  const index = animationClock();

  animation.stepMs = 1000 / max(1, params.playbackSpeed);
  animation.startedAt = millis() - index * animation.stepMs;
}

function animationClock() {
  const playMs = animation.script.length * animation.stepMs;
  const cycle = playMs + animation.holdMs;
  let elapsed = millis() - animation.startedAt;

  if (elapsed < 0) {
    elapsed = 0;
  }

  const wrapped = elapsed % cycle;

  if (wrapped >= playMs) {
    return animation.script.length - 1;
  }

  return min(
    animation.script.length - 1,
    floor(wrapped / animation.stepMs)
  );
}

function animationCaption(step) {
  if (!animation || !step) {
    return readout.summary || "";
  }

  if (step.type === "grid") {
    return "Empty grid";
  }

  if (step.type === "start") {
    return "Pick a starting cell";
  }

  if (step.type === "tree") {
    return `Spanning tree · ${step.count} of ${step.total}`;
  }

  if (step.type === "tree-done") {
    if (animation.attempts > 1) {
      return `Tree reaches every cell · attempt ${animation.attempts}`;
    }

    return "Tree reaches every cell";
  }

  if (step.type === "cut") {
    const total = animation.cuts.length;

    if (step.marking) {
      return `Cut ${step.removed + 1} of ${total}`;
    }

    return `Removed ${step.removed} of ${total} links`;
  }

  if (step.type === "regions") {
    return `${animation.regionCount} regions · ${animation.sizes}`;
  }

  if (step.type === "boundary") {
    return `Trace the boundary · ${step.count} of ${step.total}`;
  }

  if (step.type === "simple") {
    return "Drop points on straight edges";
  }

  if (step.type === "inset") {
    return "Inset the outline";
  }

  if (step.type === "round") {
    return "Round the corners";
  }

  return `Outline · ${animation.sizes}`;
}

function paintAnimation() {
  if (!animation) {
    paintAnimationCaption(readout.summary || "No partition found");
    return;
  }

  const step = animation.script[animationClock()];
  const caption = animationCaption(step);

  if (caption !== lastAnimationCaption) {
    lastAnimationCaption = caption;
    readout.summary = caption;

    if (summaryMonitor) {
      summaryMonitor.refresh();
    }
  }

  if (step.type === "done") {
    const place = animationPlace();

    drawPartition(
      animation.grid,
      place.originX + place.size / 2,
      place.originY + place.size / 2,
      place.size,
      "stroke",
      drawingContext,
      place.pixelScale
    );

    paintAnimationCaption(caption);
    return;
  }

  const place = animationPlace();
  const ctx = drawingContext;

  ctx.save();
  paintAnimationCells(ctx, place, step);

  if (showsTree(step)) {
    paintAnimationTree(ctx, place, step);
  }

  if (showsOutline(step)) {
    paintAnimationOutline(ctx, place, step);
  }

  ctx.restore();
  paintAnimationCaption(caption);
}

function animationPlace() {
  const frame = contentFrame();
  const shape = min(frame.width, frame.height) * params.shapeScale;

  return {
    frame,
    originX: frame.x + (frame.width - shape) / 2,
    originY: frame.y + (frame.height - shape) / 2,
    size: shape,
    cell: shape / gridSize,
    pixelScale: inkScale(shape)
  };
}

function showsTree(step) {
  return (
    step.type === "start" ||
    step.type === "tree" ||
    step.type === "tree-done" ||
    step.type === "cut"
  );
}

function showsOutline(step) {
  return (
    step.type === "boundary" ||
    step.type === "simple" ||
    step.type === "inset" ||
    step.type === "round"
  );
}

function showsRegions(step) {
  return (
    step.type === "regions" ||
    showsOutline(step)
  );
}

function paintAnimationCells(ctx, place, step) {
  const visited = showsTree(step)
    ? grownCells(step)
    : null;

  const regions = showsRegions(step);
  let wash = 0.82;

  if (step.type === "round") {
    wash = 0.82 * (1 - step.t * 0.2);
  }

  for (let index = 0; index < gridSize * gridSize; index++) {
    let fill = "rgba(41, 41, 50, 0.04)";

    if (regions && params.useTiles) {
      fill = regionFill(animation.grid[index]);
    } else if (regions) {
      fill = withAlpha(regionFill(animation.grid[index]), wash);
    } else if (visited && visited[index]) {
      fill = "rgba(41, 41, 50, 0.09)";
    }

    paintCell(
      ctx,
      place,
      index,
      fill,
      regions && params.useTiles ? animation.grid[index] : null
    );
  }

  let highlight = -1;

  if (step.type === "start") {
    highlight = animation.start;
  } else if (step.type === "tree") {
    highlight = animation.tree[step.count - 1].b;
  }

  if (highlight >= 0) {
    const center = cellCenter(highlight, place);

    ctx.beginPath();
    ctx.fillStyle = cssColor(params.outlineColor);
    ctx.arc(center.x, center.y, place.cell * 0.11, 0, TWO_PI);
    ctx.fill();
  }
}

function grownCells(step) {
  const visited = new Array(gridSize * gridSize).fill(false);
  let treeCount = 0;

  if (step.type === "tree") {
    treeCount = step.count;
  } else if (step.type === "tree-done" || step.type === "cut") {
    treeCount = animation.tree.length;
  }

  visited[animation.start] = true;

  for (let i = 0; i < treeCount; i++) {
    visited[animation.tree[i].b] = true;
  }

  return visited;
}

function paintCell(ctx, place, index, fill, patternLabel) {
  const x = index % gridSize;
  const y = floor(index / gridSize);
  const gap = place.cell * 0.1;
  const left = place.originX + x * place.cell + gap / 2;
  const top = place.originY + y * place.cell + gap / 2;
  const side = place.cell - gap;

  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "rgba(41, 41, 50, 0.16)";
  ctx.lineWidth = 1;
  ctx.roundRect(left, top, side, side, place.cell * 0.08);
  ctx.fill();
  ctx.stroke();

  if (patternLabel == null || !params.useTiles) {
    return;
  }

  const source = patternSource(patternIndexFor(patternLabel));

  if (!source) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top, side, side, place.cell * 0.08);
  ctx.clip();
  ctx.globalCompositeOperation = "multiply";
  stampPattern(ctx, source, place.originX, place.originY, max(8, place.cell * params.patternScale), {
    minX: left,
    minY: top,
    maxX: left + side,
    maxY: top + side
  });
  ctx.restore();
}

function paintAnimationTree(ctx, place, step) {
  const removed = step.type === "cut" ? step.removed : 0;
  const gone = new Set();

  for (let i = 0; i < removed && i < animation.cuts.length; i++) {
    gone.add(edgeKey(animation.cuts[i]));
  }

  let limit = 0;

  if (step.type === "tree") {
    limit = step.count;
  } else if (step.type === "tree-done" || step.type === "cut") {
    limit = animation.tree.length;
  }

  ctx.lineCap = "round";
  ctx.strokeStyle = cssColor(params.outlineColor);
  ctx.lineWidth = max(1.6, place.cell * 0.055);

  for (let i = 0; i < limit; i++) {
    const edge = animation.tree[i];

    if (gone.has(edgeKey(edge))) {
      continue;
    }

    if (
      step.type === "cut" &&
      step.marking &&
      edgeKey(edge) === edgeKey(animation.cuts[step.removed])
    ) {
      continue;
    }

    strokeTreeEdge(ctx, edge, place);
  }

  if (step.type === "tree" && step.count > 0) {
    ctx.lineWidth = max(2.4, place.cell * 0.09);
    strokeTreeEdge(ctx, animation.tree[step.count - 1], place);
  }

  if (step.type === "cut" && step.marking) {
    ctx.strokeStyle = CUT_COLOR;
    ctx.lineWidth = max(2.8, place.cell * 0.1);
    strokeTreeEdge(ctx, animation.cuts[step.removed], place);
  }
}

function strokeTreeEdge(ctx, edge, place) {
  const from = cellCenter(edge.a, place);
  const to = cellCenter(edge.b, place);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function edgeKey(edge) {
  return edge.a < edge.b
    ? `${edge.a}:${edge.b}`
    : `${edge.b}:${edge.a}`;
}

function cellCenter(index, place) {
  const x = index % gridSize;
  const y = floor(index / gridSize);

  return {
    x: place.originX + (x + 0.5) * place.cell,
    y: place.originY + (y + 0.5) * place.cell
  };
}

function paintAnimationOutline(ctx, place, step) {
  const lineWidth = params.strokeWidth * place.pixelScale;

  if (lineWidth <= 0) {
    return;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = cssColor(params.outlineColor);
  ctx.lineWidth = lineWidth;

  if (step.type === "boundary") {
    let remaining = step.count;

    for (const path of animation.paths) {
      const segments = path.raw.length;
      const take = min(remaining, segments);

      if (take > 0) {
        strokePartialPolyline(ctx, path.raw, take, place);
      }

      remaining -= segments;

      if (remaining <= 0) {
        break;
      }
    }

    return;
  }

  if (step.type === "simple") {
    for (const path of animation.paths) {
      strokeClosedPolyline(ctx, path.simplified, place);
    }

    return;
  }

  if (step.type === "inset") {
    for (const path of animation.paths) {
      strokeClosedPolyline(
        ctx,
        offsetPolygon(
          path.simplified,
          params.regionInset * step.t
        ),
        place
      );
    }

    return;
  }

  const cacheKey = [
    step.t,
    params.regionInset,
    params.cornerRadius,
    place.size,
    place.originX,
    place.originY
  ].join(":");

  if (animation.roundKey !== cacheKey) {
    const pixelContours = animation.paths.map(path =>
      gridToPixels(
        offsetPolygon(path.simplified, params.regionInset),
        place
      )
    );

    animation.roundKey = cacheKey;
    animation.roundContours = pixelContours;
    animation.roundRadii = roundedRadii(
      pixelContours,
      params.cornerRadius * place.pixelScale * step.t
    );
  }

  for (let i = 0; i < animation.roundContours.length; i++) {
    drawRoundedContour(
      ctx,
      animation.roundContours[i],
      animation.roundRadii[i],
      "stroke"
    );
  }
}

function strokePartialPolyline(ctx, points, count, place) {
  if (count <= 0 || points.length === 0) {
    return;
  }

  ctx.beginPath();

  const first = gridPoint(points[0], place);
  ctx.moveTo(first.x, first.y);

  const last = min(count, points.length);

  for (let i = 1; i <= last; i++) {
    const point = points[i % points.length];
    const pixel = gridPoint(point, place);
    ctx.lineTo(pixel.x, pixel.y);
  }

  ctx.stroke();
}

function strokeClosedPolyline(ctx, points, place) {
  strokePartialPolyline(ctx, points, points.length, place);
}

function gridPoint(point, place) {
  return {
    x: place.originX + point.x * place.cell,
    y: place.originY + point.y * place.cell
  };
}

function gridToPixels(points, place) {
  return points.map(point => gridPoint(point, place));
}

function paintAnimationCaption(caption) {
  const frame = contentFrame();
  const place = animation
    ? animationPlace()
    : null;

  const below = place
    ? place.originY + place.size + 28
    : frame.height - 24;

  const y = below < frame.height - 8
    ? below
    : frame.height - 16;

  push();
  noStroke();
  fill(cssColor(params.outlineColor));
  textFont("Helvetica, sans-serif");
  textSize(16);
  textAlign(CENTER, BOTTOM);
  text(caption, frame.x + frame.width / 2, y);
  pop();
}

/* =========================================================
   PARTITION GENERATION
   ========================================================= */

/*
  Partitions are generated as restricted-growth strings.

  Example:

    0 0 0
    0 0 1
    0 2 1

  becomes:

    [0, 0, 0, 0, 0, 1, 0, 2, 1]
*/

function generatePartitions() {
  const results = [];
  const seen = new Set();

  const grid = new Array(gridSize * gridSize).fill(0);

  // The first cell always belongs to region 0.
  grid[0] = 0;

  function recurse(position, largestLabel) {
    if (position === grid.length) {
      const candidate = grid.slice();

      if (!hasUnequalRegionSizes(candidate)) {
        return;
      }

      if (!allRegionsConnected(candidate)) {
        return;
      }

      const id = canonicalForm(candidate);

      if (!seen.has(id)) {
        seen.add(id);
        results.push(candidate);
      }

      return;
    }

    /*
      Existing labels are 0 ... largestLabel.

      largestLabel + 1 creates a new region.
    */
    for (
      let label = 0;
      label <= largestLabel + 1;
      label++
    ) {
      grid[position] = label;

      recurse(
        position + 1,
        max(largestLabel, label)
      );
    }
  }

  recurse(1, 0);

  return results;
}

/* =========================================================
   VALIDATION
   ========================================================= */

function getRegionLabels(grid) {
  return [...new Set(grid)];
}

function getRegionSizes(grid) {
  const counts = new Map();

  for (const region of grid) {
    counts.set(
      region,
      (counts.get(region) || 0) + 1
    );
  }

  return [...counts.values()];
}

function hasUnequalRegionSizes(grid) {
  const sizes = getRegionSizes(grid);
  const uniqueSizes = new Set(sizes);

  return uniqueSizes.size === sizes.length;
}

function allRegionsConnected(grid) {
  const regions = getRegionLabels(grid);

  for (const region of regions) {
    if (!isRegionConnected(grid, region)) {
      return false;
    }
  }

  return true;
}

function isRegionConnected(grid, region) {
  const regionCells = [];

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === region) {
      regionCells.push(i);
    }
  }

  if (regionCells.length === 0) {
    return false;
  }

  const visited = new Set();
  const queue = [regionCells[0]];

  while (queue.length > 0) {
    const index = queue.shift();

    if (visited.has(index)) {
      continue;
    }

    visited.add(index);

    const x = index % gridSize;
    const y = floor(index / gridSize);

    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const [nx, ny] of neighbours) {
      if (!insideGrid(nx, ny)) {
        continue;
      }

      const neighbourIndex = ny * gridSize + nx;

      if (
        grid[neighbourIndex] === region &&
        !visited.has(neighbourIndex)
      ) {
        queue.push(neighbourIndex);
      }
    }
  }

  return visited.size === regionCells.length;
}

function insideGrid(x, y) {
  return (
    x >= 0 &&
    x < gridSize &&
    y >= 0 &&
    y < gridSize
  );
}

function getCell(grid, x, y) {
  if (!insideGrid(x, y)) {
    return -1;
  }

  return grid[y * gridSize + x];
}

/* =========================================================
   ROTATION AND REFLECTION DEDUPLICATION
   ========================================================= */

/*
  Normalize labels by order of appearance.

  For example:

    [4, 4, 8, 4, 2, 8]

  becomes:

    [0, 0, 1, 0, 2, 1]
*/

function normalizeLabels(grid) {
  const mapping = new Map();
  let nextLabel = 0;

  return grid.map(label => {
    if (!mapping.has(label)) {
      mapping.set(label, nextLabel);
      nextLabel++;
    }

    return mapping.get(label);
  });
}

function serializeGrid(grid) {
  return normalizeLabels(grid).join("");
}

/*
  Return a canonical ID that is shared by all
  rotations and reflections of the partition.
*/

function canonicalForm(grid) {
  const variants = [];

  let current = grid.slice();

  // Four rotations.
  for (let i = 0; i < 4; i++) {
    variants.push(serializeGrid(current));
    current = rotateGrid(current);
  }

  // Reflect, then make four more rotations.
  current = reflectGrid(grid);

  for (let i = 0; i < 4; i++) {
    variants.push(serializeGrid(current));
    current = rotateGrid(current);
  }

  variants.sort();

  return variants[0];
}

function rotateGrid(grid) {
  const result = new Array(grid.length);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const newX = gridSize - 1 - y;
      const newY = x;

      result[newY * gridSize + newX] =
        grid[y * gridSize + x];
    }
  }

  return result;
}

function reflectGrid(grid) {
  const result = new Array(grid.length);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const newX = gridSize - 1 - x;

      result[y * gridSize + newX] =
        grid[y * gridSize + x];
    }
  }

  return result;
}

/* =========================================================
   PARTITION DRAWING
   ========================================================= */

function drawPartition(
  grid,
  centerX,
  centerY,
  size,
  style,
  ctx,
  pixelScale
) {
  const regions = getRegionLabels(grid);

  const originX = centerX - size / 2;
  const originY = centerY - size / 2;
  const cellSize = size / gridSize;
  const scale = pixelScale == null ? 1 : pixelScale;

  const target = ctx || drawingContext;
  const regionContours = [];

  for (const region of regions) {
    const edges = getBoundaryEdges(grid, region);
    const contours = traceAllContours(edges);
    const pixelContours = [];

    for (const contour of contours) {
      let points = simplifyContour(contour);

      if (points.length < 4) {
        continue;
      }

      /*
        The contour follows the region clockwise,
        so offsetting toward its right side moves
        the contour inward.
      */
      points = offsetPolygon(
        points,
        params.regionInset
      );

      pixelContours.push(points.map(point => ({
        x: originX + point.x * cellSize,
        y: originY + point.y * cellSize
      })));
    }

    if (pixelContours.length > 0) {
      regionContours.push({
        region,
        pixelContours
      });
    }
  }

  const flatContours = [];

  for (const item of regionContours) {
    for (const contour of item.pixelContours) {
      flatContours.push(contour);
    }
  }

  const radii = roundedRadii(
    flatContours,
    params.cornerRadius * scale
  );

  target.save();

  const lineWidth = max(0, params.strokeWidth) * scale;

  target.strokeStyle = cssColor(params.outlineColor);
  target.lineWidth = lineWidth;
  target.lineCap = "round";
  target.lineJoin = "round";

  let cursor = 0;

  for (const item of regionContours) {
    target.save();
    target.beginPath();

    for (let i = 0; i < item.pixelContours.length; i++) {
      drawRoundedContour(
        target,
        item.pixelContours[i],
        radii[cursor + i],
        "path"
      );
    }

    if (params.useTiles) {
      target.clip("evenodd");
      paintPatternFill(
        target,
        item.region,
        originX,
        originY,
        cellSize,
        contourBounds(item.pixelContours)
      );
    } else {
      target.fillStyle = regionFill(item.region);
      target.fill("evenodd");
    }

    target.restore();
    cursor += item.pixelContours.length;
  }

  if (style === "fill" || lineWidth <= 0) {
    target.restore();
    return;
  }

  cursor = 0;

  for (const item of regionContours) {
    for (let i = 0; i < item.pixelContours.length; i++) {
      drawRoundedContour(
        target,
        item.pixelContours[i],
        radii[cursor + i],
        "stroke"
      );
    }

    cursor += item.pixelContours.length;
  }

  target.restore();
}

/* =========================================================
   BOUNDARY EDGE EXTRACTION
   ========================================================= */

/*
  Edges are directed so that the region is always
  on the right-hand side of each edge.

  Direction values:

    0 = right
    1 = down
    2 = left
    3 = up
*/

function getBoundaryEdges(grid, region) {
  const edges = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (getCell(grid, x, y) !== region) {
        continue;
      }

      // Top side: left to right.
      if (getCell(grid, x, y - 1) !== region) {
        edges.push(makeEdge(
          x, y,
          x + 1, y,
          0
        ));
      }

      // Right side: top to bottom.
      if (getCell(grid, x + 1, y) !== region) {
        edges.push(makeEdge(
          x + 1, y,
          x + 1, y + 1,
          1
        ));
      }

      // Bottom side: right to left.
      if (getCell(grid, x, y + 1) !== region) {
        edges.push(makeEdge(
          x + 1, y + 1,
          x, y + 1,
          2
        ));
      }

      // Left side: bottom to top.
      if (getCell(grid, x - 1, y) !== region) {
        edges.push(makeEdge(
          x, y + 1,
          x, y,
          3
        ));
      }
    }
  }

  return edges;
}

function makeEdge(x1, y1, x2, y2, direction) {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    direction
  };
}

/* =========================================================
   CONTOUR TRACING
   ========================================================= */

function traceAllContours(edges) {
  const remaining = edges.slice();
  const contours = [];

  while (remaining.length > 0) {
    const first = remaining.shift();

    const contour = [
      copyPoint(first.start),
      copyPoint(first.end)
    ];

    let currentPoint = first.end;
    let currentDirection = first.direction;

    let safety = 0;
    const safetyLimit = remaining.length + contour.length + 2;

    while (
      !pointsEqual(currentPoint, first.start) &&
      safety < safetyLimit
    ) {
      safety++;

      const candidates = [];

      for (let i = 0; i < remaining.length; i++) {
        if (
          pointsEqual(
            remaining[i].start,
            currentPoint
          )
        ) {
          candidates.push({
            edge: remaining[i],
            index: i
          });
        }
      }

      if (candidates.length === 0) {
        break;
      }

      /*
        Follow the region using the right-hand rule.

        Preferred order:
          1. turn right
          2. go straight
          3. turn left
          4. go backward
      */
      candidates.sort((a, b) => {
        return (
          turnPriority(
            currentDirection,
            a.edge.direction
          ) -
          turnPriority(
            currentDirection,
            b.edge.direction
          )
        );
      });

      const selected = candidates[0];
      const nextEdge = selected.edge;

      remaining.splice(selected.index, 1);

      contour.push(copyPoint(nextEdge.end));

      currentPoint = nextEdge.end;
      currentDirection = nextEdge.direction;
    }

    contours.push(contour);
  }

  return contours;
}

function turnPriority(currentDirection, nextDirection) {
  const difference =
    (nextDirection - currentDirection + 4) % 4;

  if (difference === 1) return 0; // Right
  if (difference === 0) return 1; // Straight
  if (difference === 3) return 2; // Left

  return 3; // Backward
}

function copyPoint(point) {
  return {
    x: point.x,
    y: point.y
  };
}

function pointsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

/* =========================================================
   CONTOUR SIMPLIFICATION
   ========================================================= */

/*
  Remove duplicate final points and unnecessary
  points along straight edges.
*/

function simplifyContour(contour) {
  let points = contour.map(copyPoint);

  if (
    points.length > 1 &&
    pointsEqual(points[0], points[points.length - 1])
  ) {
    points.pop();
  }

  let changed = true;

  while (changed && points.length > 3) {
    changed = false;

    const result = [];

    for (let i = 0; i < points.length; i++) {
      const previous =
        points[(i - 1 + points.length) % points.length];

      const current = points[i];

      const next =
        points[(i + 1) % points.length];

      if (pointsAreCollinear(previous, current, next)) {
        changed = true;
      } else {
        result.push(current);
      }
    }

    points = result;
  }

  return points;
}

function pointsAreCollinear(a, b, c) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;

  return abX * bcY - abY * bcX === 0;
}

/* =========================================================
   INSETTING THE REGION OUTLINE
   ========================================================= */

/*
  Each edge is shifted to its right side.

  Since the boundary edges were created clockwise
  around the region, the right side points inward.
*/

function offsetPolygon(points, distance) {
  const result = [];

  for (let i = 0; i < points.length; i++) {
    const previous =
      points[(i - 1 + points.length) % points.length];

    const current = points[i];

    const next =
      points[(i + 1) % points.length];

    const incoming = offsetLine(
      previous,
      current,
      distance
    );

    const outgoing = offsetLine(
      current,
      next,
      distance
    );

    const intersection = lineIntersection(
      incoming.a,
      incoming.b,
      outgoing.a,
      outgoing.b
    );

    if (intersection) {
      result.push(intersection);
    } else {
      result.push(copyPoint(current));
    }
  }

  return result;
}

function offsetLine(a, b, distance) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const length = sqrt(dx * dx + dy * dy);

  /*
    Right-hand normal in canvas coordinates,
    where positive Y points downward.
  */
  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    a: {
      x: a.x + normalX * distance,
      y: a.y + normalY * distance
    },
    b: {
      x: b.x + normalX * distance,
      y: b.y + normalY * distance
    }
  };
}

function lineIntersection(a, b, c, d) {
  const r = {
    x: b.x - a.x,
    y: b.y - a.y
  };

  const s = {
    x: d.x - c.x,
    y: d.y - c.y
  };

  const denominator = crossProduct(r, s);

  if (abs(denominator) < 0.000001) {
    return null;
  }

  const cMinusA = {
    x: c.x - a.x,
    y: c.y - a.y
  };

  const t =
    crossProduct(cMinusA, s) /
    denominator;

  return {
    x: a.x + r.x * t,
    y: a.y + r.y * t
  };
}

function crossProduct(a, b) {
  return a.x * b.y - a.y * b.x;
}

/* =========================================================
   ROUNDED POLYGON DRAWING
   ========================================================= */

/*
  Each corner keeps the requested radius unless that curve
  would cross another curve or edge. Large radii on a wide
  notch otherwise bow across the gap and pinch the outline.
*/
function roundedRadii(contours, radius) {
  const radii = contours.map((points) =>
    edgeLimitedRadii(points, radius)
  );

  for (let pass = 0; pass < 48; pass++) {
    const hit = firstOverlap(contours, radii);

    if (!hit) {
      break;
    }

    separateRadii(contours, radii, hit);
  }

  return radii;
}

function edgeLimitedRadii(points, radius) {
  const count = points.length;
  const radii = new Array(count);

  for (let i = 0; i < count; i++) {
    const previous =
      points[(i - 1 + count) % count];

    const next =
      points[(i + 1) % count];

    const previousLength =
      distanceBetween(previous, points[i]);

    const nextLength =
      distanceBetween(points[i], next);

    radii[i] = min(
      radius,
      previousLength * 0.45,
      nextLength * 0.45
    );
  }

  return radii;
}

function separateRadii(contours, radii, hit) {
  const targets = [hit.a];

  if (hit.b) {
    targets.push(hit.b);
  }

  const saved = targets.map((item) =>
    radii[item.contour][item.index]
  );

  let low = 0;
  let high = 1;

  for (let step = 0; step < 10; step++) {
    const mid = (low + high) / 2;

    targets.forEach((item, index) => {
      radii[item.contour][item.index] =
        saved[index] * mid;
    });

    if (hitStillOverlaps(contours, radii, hit)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  targets.forEach((item, index) => {
    radii[item.contour][item.index] =
      saved[index] * low;
  });
}

function firstOverlap(contours, radii) {
  const groups = contours.map((points, contourIndex) =>
    points.map((point, index) => ({
      contour: contourIndex,
      index,
      corner: point,
      radius: radii[contourIndex][index],
      samples: curveSamples(
        points,
        index,
        radii[contourIndex][index]
      )
    }))
  );

  for (let aContour = 0; aContour < groups.length; aContour++) {
    for (let aIndex = 0; aIndex < groups[aContour].length; aIndex++) {
      const a = groups[aContour][aIndex];

      if (a.radius <= 0) {
        continue;
      }

      for (
        let bContour = aContour;
        bContour < groups.length;
        bContour++
      ) {
        const sameContour = bContour === aContour;
        const startIndex = sameContour ? aIndex + 1 : 0;

        for (
          let bIndex = startIndex;
          bIndex < groups[bContour].length;
          bIndex++
        ) {
          const b = groups[bContour][bIndex];

          if (b.radius <= 0) {
            continue;
          }

          if (
            distanceBetween(a.corner, b.corner) >=
            a.radius + b.radius
          ) {
            continue;
          }

          if (polylinesCross(a.samples, b.samples)) {
            return {
              a: {
                contour: aContour,
                index: aIndex
              },
              b: {
                contour: bContour,
                index: bIndex
              }
            };
          }
        }
      }

      for (
        let edgeContour = 0;
        edgeContour < contours.length;
        edgeContour++
      ) {
        const points = contours[edgeContour];

        for (let edgeIndex = 0; edgeIndex < points.length; edgeIndex++) {
          if (edgeContour === aContour) {
            const previousEdge =
              (aIndex - 1 + points.length) % points.length;

            if (
              edgeIndex === aIndex ||
              edgeIndex === previousEdge
            ) {
              continue;
            }
          }

          const start = points[edgeIndex];
          const end =
            points[(edgeIndex + 1) % points.length];

          if (
            distancePointToSegment(a.corner, start, end) >=
            a.radius
          ) {
            continue;
          }

          if (polylineHitsSegment(a.samples, start, end)) {
            return {
              a: {
                contour: aContour,
                index: aIndex
              },
              edge: {
                a: start,
                b: end
              }
            };
          }
        }
      }
    }
  }

  return null;
}

function hitStillOverlaps(contours, radii, hit) {
  const points = contours[hit.a.contour];
  const radius = radii[hit.a.contour][hit.a.index];
  const samples = curveSamples(
    points,
    hit.a.index,
    radius
  );

  if (hit.b) {
    const otherPoints = contours[hit.b.contour];
    const otherRadius =
      radii[hit.b.contour][hit.b.index];

    return polylinesCross(
      samples,
      curveSamples(
        otherPoints,
        hit.b.index,
        otherRadius
      )
    );
  }

  return polylineHitsSegment(
    samples,
    hit.edge.a,
    hit.edge.b
  );
}

function curveSamples(points, index, radius) {
  const count = points.length;
  const previous =
    points[(index - 1 + count) % count];

  const current = points[index];

  const next =
    points[(index + 1) % count];

  const before = moveToward(
    current,
    previous,
    radius
  );

  const after = moveToward(
    current,
    next,
    radius
  );

  const samples = [];
  const steps = 16;

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;

    samples.push({
      x:
        u * u * before.x +
        2 * u * t * current.x +
        t * t * after.x,
      y:
        u * u * before.y +
        2 * u * t * current.y +
        t * t * after.y
    });
  }

  return samples;
}

function polylinesCross(a, b) {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (
        segmentsProperlyCross(
          a[i],
          a[i + 1],
          b[j],
          b[j + 1]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function polylineHitsSegment(samples, a, b) {
  for (let i = 0; i < samples.length - 1; i++) {
    if (
      segmentsProperlyCross(
        samples[i],
        samples[i + 1],
        a,
        b
      )
    ) {
      return true;
    }
  }

  return false;
}

function segmentsProperlyCross(a, b, c, d) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denom = abX * cdY - abY * cdX;

  if (abs(denom) < 0.0001) {
    return false;
  }

  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const t = (acX * cdY - acY * cdX) / denom;
  const u = (acX * abY - acY * abX) / denom;
  const margin = 0.004;

  return (
    t > margin &&
    t < 1 - margin &&
    u > margin &&
    u < 1 - margin
  );
}

function drawRoundedContour(ctx, points, radius, style) {
  if (points.length < 3) {
    return;
  }

  const radii = Array.isArray(radius)
    ? radius
    : edgeLimitedRadii(points, radius);

  const corners = [];

  for (let i = 0; i < points.length; i++) {
    const previous =
      points[(i - 1 + points.length) % points.length];

    const current = points[i];

    const next =
      points[(i + 1) % points.length];

    const cornerRadius = radii[i] || 0;

    corners.push({
      corner: current,

      before: moveToward(
        current,
        previous,
        cornerRadius
      ),

      after: moveToward(
        current,
        next,
        cornerRadius
      )
    });
  }

  if (style !== "path") {
    ctx.beginPath();
  }

  ctx.moveTo(
    corners[0].after.x,
    corners[0].after.y
  );

  for (let step = 1; step <= corners.length; step++) {
    const index = step % corners.length;
    const item = corners[index];

    ctx.lineTo(
      item.before.x,
      item.before.y
    );

    ctx.quadraticCurveTo(
      item.corner.x,
      item.corner.y,
      item.after.x,
      item.after.y
    );
  }

  ctx.closePath();

  if (style === "path") {
    return;
  }

  if (style === "fill") {
    ctx.fill();
    return;
  }

  ctx.stroke();
}

function moveToward(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const length = sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return copyPoint(from);
  }

  return {
    x: from.x + dx / length * distance,
    y: from.y + dy / length * distance
  };
}

function distanceBetween(a, b) {
  return dist(a.x, a.y, b.x, b.y);
}

function distancePointToSegment(point, a, b) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared = abX * abX + abY * abY;

  if (lengthSquared === 0) {
    return distanceBetween(point, a);
  }

  const t = constrain(
    (
      (point.x - a.x) * abX +
      (point.y - a.y) * abY
    ) / lengthSquared,
    0,
    1
  );

  return distanceBetween(point, {
    x: a.x + abX * t,
    y: a.y + abY * t
  });
}

/* =========================================================
   RANDOM CONNECTED PARTITION
   ========================================================= */

/*
  Generate one random partition.

  Technique:
    1. Generate a random spanning tree over the grid.
    2. Remove regionCount - 1 edges.
    3. Find the resulting connected components.
    4. When allowEqualSizes is off, keep the result only if
       every region has a different size.
*/

function generateRandomPartition(
  size,
  requestedRegionCount,
  allowEqualSizes,
  seed,
  trace
) {
  randomSeed(seed);

  const cellCount = size * size;
  const maximumRegions = floor(
    (sqrt(8 * cellCount + 1) - 1) / 2
  );

  if (maximumRegions < 2) {
    throw new Error(
      "The grid is too small to contain multiple regions."
    );
  }

  let regionCount = requestedRegionCount;

  if (regionCount === null) {
    regionCount = floor(random(2, maximumRegions + 1));
  }

  if (
    regionCount < 2 ||
    regionCount > maximumRegions
  ) {
    throw new Error(
      `Invalid region count ${regionCount}. ` +
      `For a ${size}×${size} grid, choose between ` +
      `2 and ${maximumRegions}.`
    );
  }

  const maximumAttempts = 30000;

  for (
    let attempt = 0;
    attempt < maximumAttempts;
    attempt++
  ) {
    const tree = createRandomSpanningTree(size);

    // Shuffle the tree edges before choosing cuts.
    const shuffledEdges = shuffleArray(tree);

    // Removing k - 1 edges produces k components.
    const numberOfCuts = regionCount - 1;
    const cutEdges = shuffledEdges.slice(0, numberOfCuts);

    const remainingEdges =
      shuffledEdges.slice(numberOfCuts);

    const grid = componentsFromEdges(
      cellCount,
      remainingEdges
    );

    const sizesFit =
      allowEqualSizes || hasUnequalRegionSizes(grid);

    if (
      getRegionLabels(grid).length === regionCount &&
      sizesFit
    ) {
      const labeled = normalizeLabels(grid);
      labeled.tree = tree.map((edge) => ({
        a: edge.a,
        b: edge.b
      }));
      labeled.cuts = cutEdges.map((edge) => ({
        a: edge.a,
        b: edge.b
      }));
      labeled.start = tree.start;

      if (trace) {
        trace.tree = labeled.tree;
        trace.cuts = labeled.cuts;
        trace.grid = labeled;
        trace.start = labeled.start;
        trace.attempts = attempt + 1;
        trace.regionCount = regionCount;
      }

      return labeled;
    }
  }

  throw new Error(
    "Could not generate a valid random partition. " +
    "Try another region count or grid size."
  );
}

function createRandomSpanningTree(size) {
  const cellCount = size * size;

  const visited =
    new Array(cellCount).fill(false);

  const treeEdges = [];

  const startingCell =
    floor(random(cellCount));

  const stack = [startingCell];
  visited[startingCell] = true;
  treeEdges.start = startingCell;

  while (stack.length > 0) {
    const current =
      stack[stack.length - 1];

    const neighbours =
      getUnvisitedNeighbours(
        current,
        size,
        visited
      );

    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }

    const next = random(neighbours);

    treeEdges.push({
      a: current,
      b: next
    });

    visited[next] = true;
    stack.push(next);
  }

  return treeEdges;
}

function getUnvisitedNeighbours(
  index,
  size,
  visited
) {
  const x = index % size;
  const y = floor(index / size);

  const positions = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ];

  const result = [];

  for (const [nx, ny] of positions) {
    if (
      nx < 0 ||
      nx >= size ||
      ny < 0 ||
      ny >= size
    ) {
      continue;
    }

    const neighbourIndex =
      ny * size + nx;

    if (!visited[neighbourIndex]) {
      result.push(neighbourIndex);
    }
  }

  return result;
}

function shuffleArray(array) {
  const result = array.slice();

  for (let i = result.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));

    const temporary = result[i];
    result[i] = result[j];
    result[j] = temporary;
  }

  return result;
}

function componentsFromEdges(
  cellCount,
  edges
) {
  const parent = new Array(cellCount);
  const rank = new Array(cellCount).fill(0);

  for (let i = 0; i < cellCount; i++) {
    parent[i] = i;
  }

  function find(value) {
    if (parent[value] !== value) {
      parent[value] = find(parent[value]);
    }

    return parent[value];
  }

  function union(a, b) {
    let rootA = find(a);
    let rootB = find(b);

    if (rootA === rootB) {
      return;
    }

    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB;
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA;
    } else {
      parent[rootB] = rootA;
      rank[rootA]++;
    }
  }

  // Edges that weren't cut connect their cells.
  for (const edge of edges) {
    union(edge.a, edge.b);
  }

  const rootToLabel = new Map();
  let nextLabel = 0;

  const grid = new Array(cellCount);

  for (let i = 0; i < cellCount; i++) {
    const root = find(i);

    if (!rootToLabel.has(root)) {
      rootToLabel.set(root, nextLabel);
      nextLabel++;
    }

    grid[i] = rootToLabel.get(root);
  }

  return grid;
}

function printPartitionInfo(grid) {
  const sizes = getRegionSizes(grid);

  console.log("--------------------------");
  console.log(
    `Grid: ${gridSize}×${gridSize}`
  );
  console.log(
    `Number of regions: ${sizes.length}`
  );
  console.log(
    "Region sizes:",
    sizes.slice().sort((a, b) => a - b)
  );

  printGridToConsole(grid);
}

function printGridToConsole(grid) {
  for (let y = 0; y < gridSize; y++) {
    let line = "";

    for (let x = 0; x < gridSize; x++) {
      const value =
        grid[y * gridSize + x];

      line +=
        String(value).padStart(2, " ") +
        " ";
    }

    console.log(line);
  }
}
