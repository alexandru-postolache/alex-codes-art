// ==================================================
// CONFIGURATION
// ==================================================

const CANDIDATES_PER_LEAF = 180;
const DEFAULT_SEED = 12345;
const MAX_SEED = 2147483647;

// Geometry.
const OUTLINE_RESOLUTION = 80;
const VEIN_RESOLUTION = 10;
const COLLISION_SAMPLE_COUNT = 11;

// Placement.
const COLLISION_PADDING = 2;
const OVERLAP_PENALTY = 110;
const EDGE_PENALTY = 5;

const COMPOSITION_PRESETS = [
  "Scatter",
  "Wreath",
  "Specimen",
  "Branch"
];

const BRANCH_LEAF_FAMILIES = [
  "lance",
  "oval",
  "teardrop",
  "inverseTeardrop"
];

const BRANCH_ENTRIES = [
  "Right",
  "Left",
  "Top",
  "Bottom"
];

const LEAF_ARRANGEMENTS = [
  "Alternate",
  "Opposite",
  "Whorled"
];

const GROWTH_DENSITIES = [
  "Sparse",
  "Balanced",
  "Dense"
];

const SEASONS = [
  "Spring",
  "Summer",
  "Autumn",
  "Winter"
];

const SEASON_LEAF_COLORS = {
  Spring: [
    "#b7d58a",
    "#d1df91",
    "#91c58d",
    "#c4dca2",
    "#a5cf78"
  ],
  Summer: null,
  Autumn: [
    "#c56b3e",
    "#d6923f",
    "#a94b32",
    "#e0ad57",
    "#8b5e3c",
    "#b47b42"
  ],
  Winter: [
    "#8f765b",
    "#aa8d68",
    "#756b58"
  ]
};

const PALETTES = {
  Forest: [
    "#82a96b",
    "#648f61",
    "#99b96c",
    "#5f8970",
    "#a4b978",
    "#718d55",
    "#779f7a",
    "#9ca963",
    "#668268",
    "#78986b",
    "#58785c",
    "#8a9f5b",
    "#728a70",
    "#b3a46c"
  ],
  Spring: [
    "#a8c686",
    "#d3dc8e",
    "#85b79d",
    "#f0b7a4",
    "#e8cf7a",
    "#97c77f",
    "#c6b4d8"
  ],
  Autumn: [
    "#c56b3e",
    "#d6923f",
    "#a94b32",
    "#e0ad57",
    "#8b5e3c",
    "#b47b42",
    "#7f713f"
  ],
  Twilight: [
    "#52657a",
    "#6f6680",
    "#496f6a",
    "#887078",
    "#405b66",
    "#7d8291",
    "#5c536f"
  ]
};

const DEFAULT_SETTINGS = {
  seed: DEFAULT_SEED,
  composition: "Scatter",
  leafCount: 20,
  flowScale: 0.0095,
  rotationJitter: 0.1,
  spacing: 0.82,
  leafSize: 1,
  bend: 1,
  lanceWeight: 0.3,
  ovalWeight: 0.3,
  teardropWeight: 0.23,
  inverseWeight: 0.17,
  palette: "Forest",
  background: "#f2eee7",
  opacity: 120,
  bleed: 0.11,
  texture: 0.36,
  veinDensity: 1,
  paperTexture: 0.45,
  branchFamily: "oval",
  branchEntry: "Right",
  leafArrangement: "Alternate",
  growthDensity: "Balanced",
  season: "Summer",
  branchCount: 3,
  branchLevels: 3,
  branchCurvature: 0.55,
  branchThickness: 6,
  branchSpread: 0.7,
  branchGravity: 0.12,
  branchWind: 0,
  tipClustering: 0.68,
  leafAngle: 48,
  rearLeaves: 0.25,
  branchColor: "#735b3e"
};

const settings = createSettingsFromUrl();

// ==================================================
// STATE
// ==================================================

let leaves = [];
let branchStructure = null;
let showDebug = false;
let pane = null;
let regenerateTimer = null;

// ==================================================
// SETUP
// ==================================================

function setup() {
  createCanvas(600, 600, WEBGL);

  brush.scaleBrushes(3);

  setupControls();
  regenerate();

  noLoop();
}

function regenerate() {
  normalizeSettings();

  updateSettingsInUrl();

  randomSeed(settings.seed);
  noiseSeed(settings.seed);

  document.body.style.backgroundColor =
    settings.background;

  background(settings.background);

  createLeaves();
  placeLeaves();

  push();

  // Restore normal top-left coordinates in WEBGL mode.
  translate(
    -width / 2,
    -height / 2
  );

  drawPaperTexture();

  if (
    settings.composition ===
    "Branch" &&
    branchStructure !== null
  ) {
    for (
      const leaf
      of leaves.filter(
        item =>
          item.branchLayer === "rear"
      )
    ) {
      drawLeafInstance(leaf);
    }

    drawBranchStructure();

    for (
      const leaf
      of leaves.filter(
        item =>
          item.branchLayer === "front"
      )
    ) {
      drawLeafInstance(leaf);
    }
  } else {
    for (const leaf of leaves) {
      drawLeafInstance(leaf);
    }
  }

  if (showDebug) {
    drawDebugInformation();
  }

  pop();
}

function normalizeSettings() {
  settings.seed =
    normalizeSeed(settings.seed);

  settings.leafCount =
    Math.round(settings.leafCount);

  settings.opacity =
    Math.round(settings.opacity);

  settings.branchCount =
    Math.round(settings.branchCount);

  settings.branchLevels =
    Math.round(settings.branchLevels);

  const decimalProperties = [
    "flowScale",
    "rotationJitter",
    "spacing",
    "leafSize",
    "bend",
    "lanceWeight",
    "ovalWeight",
    "teardropWeight",
    "inverseWeight",
    "bleed",
    "texture",
    "veinDensity",
    "paperTexture",
    "branchCurvature",
    "branchThickness",
    "branchSpread",
    "branchGravity",
    "branchWind",
    "tipClustering",
    "leafAngle",
    "rearLeaves"
  ];

  for (
    const property
    of decimalProperties
  ) {
    settings[property] =
      Number(
        settings[property].toFixed(6)
      );
  }
}

// ==================================================
// KEYBOARD CONTROLS
// ==================================================

function keyPressed() {
  // Generate a different composition.
  if (key === "r" || key === "R") {
    useNewSeed();
  }

  // Show collision circles.
  if (key === "d" || key === "D") {
    showDebug = !showDebug;

    regenerate();
  }

  // Save the result.
  if (key === "s" || key === "S") {
    saveCanvas(
      `stylized-leaves-${settings.seed}`,
      "png"
    );
  }
}

// ==================================================
// CONTROLS AND SHAREABLE SEEDS
// ==================================================

function setupControls() {
  pane = new Tweakpane.Pane({
    title: "Watercolor Leaves"
  });

  pane.addInput(settings, "seed", {
    label: "seed",
    min: 0,
    max: MAX_SEED,
    step: 1
  });

  const compositionFolder =
    pane.addFolder({
      title: "Composition"
    });

  compositionFolder.addInput(
    settings,
    "composition",
    {
      label: "layout",
      options: {
        Scatter: "Scatter",
        Wreath: "Wreath",
        Specimen: "Specimen",
        Branch: "Branch"
      }
    }
  );

  compositionFolder.addInput(
    settings,
    "leafCount",
    {
      label: "leaves",
      min: 5,
      max: 40,
      step: 1
    }
  );

  compositionFolder.addInput(
    settings,
    "flowScale",
    {
      label: "flow",
      min: 0.001,
      max: 0.03,
      step: 0.0005
    }
  );

  compositionFolder.addInput(
    settings,
    "rotationJitter",
    {
      label: "jitter",
      min: 0,
      max: 0.5,
      step: 0.01
    }
  );

  compositionFolder.addInput(
    settings,
    "spacing",
    {
      label: "spacing",
      min: 0.65,
      max: 1.1,
      step: 0.01
    }
  );

  const branchFolder =
    pane.addFolder({
      title: "Branch",
      expanded: false
    });

  branchFolder.addInput(
    settings,
    "branchFamily",
    {
      label: "leaf family",
      options: {
        Lance: "lance",
        Oval: "oval",
        Teardrop: "teardrop",
        "Inverse teardrop":
          "inverseTeardrop"
      }
    }
  );

  branchFolder.addInput(
    settings,
    "branchEntry",
    {
      label: "entry side",
      options: {
        Right: "Right",
        Left: "Left",
        Top: "Top",
        Bottom: "Bottom"
      }
    }
  );

  branchFolder.addInput(
    settings,
    "leafArrangement",
    {
      label: "leaf pattern",
      options: {
        Alternate: "Alternate",
        Opposite: "Opposite",
        Whorled: "Whorled"
      }
    }
  );

  branchFolder.addInput(
    settings,
    "growthDensity",
    {
      label: "growth",
      options: {
        Sparse: "Sparse",
        Balanced: "Balanced",
        Dense: "Dense"
      }
    }
  );

  branchFolder.addInput(
    settings,
    "season",
    {
      options: {
        Spring: "Spring",
        Summer: "Summer",
        Autumn: "Autumn",
        Winter: "Winter"
      }
    }
  );

  branchFolder.addInput(
    settings,
    "branchCount",
    {
      label: "primary branches",
      min: 1,
      max: 5,
      step: 1
    }
  );

  branchFolder.addInput(
    settings,
    "branchLevels",
    {
      label: "branch levels",
      min: 1,
      max: 4,
      step: 1
    }
  );

  branchFolder.addInput(
    settings,
    "branchCurvature",
    {
      label: "curvature",
      min: 0,
      max: 1,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "branchThickness",
    {
      label: "thickness",
      min: 3,
      max: 12,
      step: 0.5
    }
  );

  branchFolder.addInput(
    settings,
    "branchSpread",
    {
      label: "spread",
      min: 0.35,
      max: 1.25,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "branchGravity",
    {
      label: "gravity",
      min: -1,
      max: 1,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "branchWind",
    {
      label: "wind",
      min: -1,
      max: 1,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "tipClustering",
    {
      label: "tip clustering",
      min: 0,
      max: 1,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "leafAngle",
    {
      label: "leaf angle",
      min: 20,
      max: 80,
      step: 1
    }
  );

  branchFolder.addInput(
    settings,
    "rearLeaves",
    {
      label: "behind branch",
      min: 0,
      max: 0.6,
      step: 0.05
    }
  );

  branchFolder.addInput(
    settings,
    "branchColor",
    {
      label: "color"
    }
  );

  const shapeFolder =
    pane.addFolder({
      title: "Leaf shape",
      expanded: false
    });

  shapeFolder.addInput(
    settings,
    "leafSize",
    {
      label: "size",
      min: 0.6,
      max: 1.5,
      step: 0.01
    }
  );

  shapeFolder.addInput(
    settings,
    "bend",
    {
      label: "bend",
      min: 0,
      max: 2,
      step: 0.05
    }
  );

  const familyFolder =
    pane.addFolder({
      title: "Family mix",
      expanded: false
    });

  addFamilyWeightControl(
    familyFolder,
    "lanceWeight",
    "lance"
  );

  addFamilyWeightControl(
    familyFolder,
    "ovalWeight",
    "oval"
  );

  addFamilyWeightControl(
    familyFolder,
    "teardropWeight",
    "teardrop"
  );

  addFamilyWeightControl(
    familyFolder,
    "inverseWeight",
    "inverse"
  );

  const watercolorFolder =
    pane.addFolder({
      title: "Watercolor",
      expanded: false
    });

  watercolorFolder.addInput(
    settings,
    "palette",
    {
      options: {
        Forest: "Forest",
        Spring: "Spring",
        Autumn: "Autumn",
        Twilight: "Twilight"
      }
    }
  );

  watercolorFolder.addInput(
    settings,
    "background",
    {
      label: "paper"
    }
  );

  watercolorFolder.addInput(
    settings,
    "opacity",
    {
      min: 50,
      max: 220,
      step: 1
    }
  );

  watercolorFolder.addInput(
    settings,
    "bleed",
    {
      min: 0.02,
      max: 0.25,
      step: 0.01
    }
  );

  watercolorFolder.addInput(
    settings,
    "texture",
    {
      min: 0.05,
      max: 0.8,
      step: 0.01
    }
  );

  watercolorFolder.addInput(
    settings,
    "veinDensity",
    {
      label: "veins",
      min: 0.4,
      max: 2,
      step: 0.05
    }
  );

  const paperFolder =
    pane.addFolder({
      title: "Paper",
      expanded: false
    });

  paperFolder.addInput(
    settings,
    "paperTexture",
    {
      label: "paper grain",
      min: 0,
      max: 1,
      step: 0.05
    }
  );

  pane.addButton({
    title: "New seed"
  }).on("click", useNewSeed);

  pane.addButton({
    title: "Copy share link"
  }).on("click", copyShareLink);

  pane.addButton({
    title: "Save PNG"
  }).on("click", () => {
    saveCanvas(
      `stylized-leaves-${settings.seed}`,
      "png"
    );
  });

  pane.on("change", scheduleRegenerate);

  window.addEventListener(
    "popstate",
    loadSettingsFromUrl
  );
}

function addFamilyWeightControl(
  folder,
  property,
  label
) {
  folder.addInput(
    settings,
    property,
    {
      label,
      min: 0,
      max: 1,
      step: 0.01
    }
  );
}

function scheduleRegenerate() {
  clearTimeout(regenerateTimer);

  regenerateTimer =
    setTimeout(regenerate, 80);
}

function useNewSeed() {
  const randomValues =
    new Uint32Array(1);

  crypto.getRandomValues(randomValues);

  settings.seed =
    randomValues[0] % MAX_SEED;

  pane.refresh();
  regenerate();
}

function copyShareLink() {
  updateSettingsInUrl();

  navigator.clipboard.writeText(
    window.location.href
  );
}

function createSettingsFromUrl() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );

  return {
    seed: normalizeSeed(
      parameters.get("seed")
    ),
    composition: getChoiceParameter(
      parameters,
      "layout",
      COMPOSITION_PRESETS,
      DEFAULT_SETTINGS.composition
    ),
    leafCount: getNumberParameter(
      parameters,
      "leaves",
      DEFAULT_SETTINGS.leafCount,
      5,
      40,
      true
    ),
    flowScale: getNumberParameter(
      parameters,
      "flow",
      DEFAULT_SETTINGS.flowScale,
      0.001,
      0.03
    ),
    rotationJitter: getNumberParameter(
      parameters,
      "jitter",
      DEFAULT_SETTINGS.rotationJitter,
      0,
      0.5
    ),
    spacing: getNumberParameter(
      parameters,
      "spacing",
      DEFAULT_SETTINGS.spacing,
      0.65,
      1.1
    ),
    leafSize: getNumberParameter(
      parameters,
      "size",
      DEFAULT_SETTINGS.leafSize,
      0.6,
      1.5
    ),
    bend: getNumberParameter(
      parameters,
      "bend",
      DEFAULT_SETTINGS.bend,
      0,
      2
    ),
    lanceWeight: getNumberParameter(
      parameters,
      "lance",
      DEFAULT_SETTINGS.lanceWeight,
      0,
      1
    ),
    ovalWeight: getNumberParameter(
      parameters,
      "oval",
      DEFAULT_SETTINGS.ovalWeight,
      0,
      1
    ),
    teardropWeight: getNumberParameter(
      parameters,
      "teardrop",
      DEFAULT_SETTINGS.teardropWeight,
      0,
      1
    ),
    inverseWeight: getNumberParameter(
      parameters,
      "inverse",
      DEFAULT_SETTINGS.inverseWeight,
      0,
      1
    ),
    palette: getPaletteParameter(
      parameters
    ),
    background: getColorParameter(
      parameters,
      "paper",
      DEFAULT_SETTINGS.background
    ),
    opacity: getNumberParameter(
      parameters,
      "opacity",
      DEFAULT_SETTINGS.opacity,
      50,
      220,
      true
    ),
    bleed: getNumberParameter(
      parameters,
      "bleed",
      DEFAULT_SETTINGS.bleed,
      0.02,
      0.25
    ),
    texture: getNumberParameter(
      parameters,
      "texture",
      DEFAULT_SETTINGS.texture,
      0.05,
      0.8
    ),
    veinDensity: getNumberParameter(
      parameters,
      "veins",
      DEFAULT_SETTINGS.veinDensity,
      0.4,
      2
    ),
    paperTexture: getNumberParameter(
      parameters,
      "grain",
      DEFAULT_SETTINGS.paperTexture,
      0,
      1
    ),
    branchFamily: getChoiceParameter(
      parameters,
      "branchFamily",
      BRANCH_LEAF_FAMILIES,
      DEFAULT_SETTINGS.branchFamily
    ),
    branchEntry: getChoiceParameter(
      parameters,
      "branchEntry",
      BRANCH_ENTRIES,
      DEFAULT_SETTINGS.branchEntry
    ),
    leafArrangement: getChoiceParameter(
      parameters,
      "leafPattern",
      LEAF_ARRANGEMENTS,
      DEFAULT_SETTINGS.leafArrangement
    ),
    growthDensity: getChoiceParameter(
      parameters,
      "growth",
      GROWTH_DENSITIES,
      DEFAULT_SETTINGS.growthDensity
    ),
    season: getChoiceParameter(
      parameters,
      "season",
      SEASONS,
      DEFAULT_SETTINGS.season
    ),
    branchCount: getNumberParameter(
      parameters,
      "branches",
      DEFAULT_SETTINGS.branchCount,
      1,
      5,
      true
    ),
    branchLevels: getNumberParameter(
      parameters,
      "branchLevels",
      DEFAULT_SETTINGS.branchLevels,
      1,
      4,
      true
    ),
    branchCurvature: getNumberParameter(
      parameters,
      "branchCurve",
      DEFAULT_SETTINGS.branchCurvature,
      0,
      1
    ),
    branchThickness: getNumberParameter(
      parameters,
      "branchWidth",
      DEFAULT_SETTINGS.branchThickness,
      3,
      12
    ),
    branchSpread: getNumberParameter(
      parameters,
      "branchSpread",
      DEFAULT_SETTINGS.branchSpread,
      0.35,
      1.25
    ),
    branchGravity: getNumberParameter(
      parameters,
      "gravity",
      DEFAULT_SETTINGS.branchGravity,
      -1,
      1
    ),
    branchWind: getNumberParameter(
      parameters,
      "wind",
      DEFAULT_SETTINGS.branchWind,
      -1,
      1
    ),
    tipClustering: getNumberParameter(
      parameters,
      "tipCluster",
      DEFAULT_SETTINGS.tipClustering,
      0,
      1
    ),
    leafAngle: getNumberParameter(
      parameters,
      "leafAngle",
      DEFAULT_SETTINGS.leafAngle,
      20,
      80
    ),
    rearLeaves: getNumberParameter(
      parameters,
      "rearLeaves",
      DEFAULT_SETTINGS.rearLeaves,
      0,
      0.6
    ),
    branchColor: getColorParameter(
      parameters,
      "branchColor",
      DEFAULT_SETTINGS.branchColor
    )
  };
}

function getNumberParameter(
  parameters,
  name,
  fallback,
  minimum,
  maximum,
  useInteger = false
) {
  const value =
    Number(parameters.get(name));

  if (
    parameters.get(name) === null ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  const constrained =
    Math.min(
      maximum,
      Math.max(minimum, value)
    );

  return useInteger
    ? Math.round(constrained)
    : constrained;
}

function getPaletteParameter(parameters) {
  const palette =
    parameters.get("palette");

  return Object.hasOwn(
    PALETTES,
    palette
  )
    ? palette
    : DEFAULT_SETTINGS.palette;
}

function getChoiceParameter(
  parameters,
  name,
  choices,
  fallback
) {
  const value =
    parameters.get(name);

  return choices.includes(value)
    ? value
    : fallback;
}

function getColorParameter(
  parameters,
  name,
  fallback
) {
  const colorValue =
    parameters.get(name);

  return /^#[0-9a-f]{6}$/i.test(
    colorValue || ""
  )
    ? colorValue
    : fallback;
}

function normalizeSeed(value) {
  if (
    value === null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return DEFAULT_SEED;
  }

  return (
    Math.abs(Math.trunc(Number(value))) %
    MAX_SEED
  );
}

function updateSettingsInUrl() {
  const url =
    new URL(window.location.href);

  url.searchParams.delete("depth");
  url.searchParams.delete("shadow");

  const parameterValues = {
    seed: settings.seed,
    layout: settings.composition,
    leaves: settings.leafCount,
    flow: settings.flowScale,
    jitter: settings.rotationJitter,
    spacing: settings.spacing,
    size: settings.leafSize,
    bend: settings.bend,
    lance: settings.lanceWeight,
    oval: settings.ovalWeight,
    teardrop: settings.teardropWeight,
    inverse: settings.inverseWeight,
    palette: settings.palette,
    paper: settings.background,
    opacity: settings.opacity,
    bleed: settings.bleed,
    texture: settings.texture,
    veins: settings.veinDensity,
    grain: settings.paperTexture,
    branchFamily: settings.branchFamily,
    branchEntry: settings.branchEntry,
    leafPattern: settings.leafArrangement,
    growth: settings.growthDensity,
    season: settings.season,
    branches: settings.branchCount,
    branchLevels: settings.branchLevels,
    branchCurve:
      settings.branchCurvature,
    branchWidth:
      settings.branchThickness,
    branchSpread: settings.branchSpread,
    gravity: settings.branchGravity,
    wind: settings.branchWind,
    tipCluster: settings.tipClustering,
    leafAngle: settings.leafAngle,
    rearLeaves: settings.rearLeaves,
    branchColor: settings.branchColor
  };

  for (
    const [name, value]
    of Object.entries(parameterValues)
  ) {
    url.searchParams.set(
      name,
      formatSettingValue(value)
    );
  }

  history.replaceState(
    null,
    "",
    url
  );
}

function formatSettingValue(value) {
  if (typeof value !== "number") {
    return value;
  }

  return String(
    Number(value.toFixed(6))
  );
}

function loadSettingsFromUrl() {
  Object.assign(
    settings,
    createSettingsFromUrl()
  );

  pane.refresh();
  regenerate();
}

// ==================================================
// LEAF CREATION
// ==================================================

function createLeaves() {
  leaves = [];

  const targetLeafCount =
    getTargetLeafCount();

  for (
    let i = 0;
    i < targetLeafCount;
    i++
  ) {
    const family = chooseLeafFamily();
    const scale =
      createLeafScale(
        i,
        targetLeafCount
      );

    const length =
      random(
        family.length[0],
        family.length[1]
      ) *
      settings.leafSize;

    const width =
      length *
      random(
        family.widthRatio[0],
        family.widthRatio[1]
      );

    const asymmetry =
      random(-0.12, 0.12);

    const bend =
      length *
      random(
        family.bendRatio[0],
        family.bendRatio[1]
      ) *
      settings.bend *
      random([-1, 1]);

    const leaf = {
      // Placement.
      x: 0,
      y: 0,
      rotation: 0,
      scale,

      // Identity.
      familyName: family.name,

      // Dimensions.
      length,
      width,

      stemLength:
        length *
        random(
          family.stemRatio[0],
          family.stemRatio[1]
        ),

      // Whole-leaf curve.
      bend,

      baseOffset:
        bend *
        random(0.12, 0.32),

      tipOffset:
        random() < 0.15
          ? random(
              -length * 0.025,
              length * 0.025
            )
          : 0,

      // Bézier handle positions.
      upperControlT: random(
        family.upperControlT[0],
        family.upperControlT[1]
      ),

      lowerControlT: random(
        family.lowerControlT[0],
        family.lowerControlT[1]
      ),

      // Upper widths.
      leftUpperWidth:
        width *
        family.upperWidth *
        (1 + asymmetry) *
        random(0.94, 1.06),

      rightUpperWidth:
        width *
        family.upperWidth *
        (1 - asymmetry) *
        random(0.94, 1.06),

      // Lower widths.
      leftLowerWidth:
        width *
        family.lowerWidth *
        (1 - asymmetry * 0.7) *
        random(0.94, 1.06),

      rightLowerWidth:
        width *
        family.lowerWidth *
        (1 + asymmetry * 0.7) *
        random(0.94, 1.06),

      // Broad bend distribution.
      upperBendMultiplier:
        random(0.4, 0.7),

      lowerBendMultiplier:
        random(0.65, 0.95),

      // Side-vein properties.
      veinCount: floor(
        random(
          family.veinCount[0],
          family.veinCount[1] + 1
        ) *
        settings.veinDensity
      ),

      veinTipBias: random(
        family.veinTipBias[0],
        family.veinTipBias[1]
      ),

      veinCurvature: random(
        family.veinCurvature[0],
        family.veinCurvature[1]
      ),

      veins: [],

      // Watercolor appearance.
      fillColor: randomLeafColor(),
      fillOpacity: constrain(
        random(
          settings.opacity - 20,
          settings.opacity + 20
        ),
        0,
        255
      ),

      strokeColor: null,
      veinColor: null,

      bleed:
        settings.bleed *
        random(0.75, 1.25),

      texture:
        settings.texture *
        random(0.75, 1.25),

      // Generated geometry.
      geometry: null,

      localCollisionCircles: [],
      collisionCircles: []
    };

    leaf.strokeColor = darkenHex(
      leaf.fillColor,
      0.56
    );

    leaf.veinColor = darkenHex(
      leaf.fillColor,
      0.45
    );

    leaf.geometry =
      buildStylizedLeafGeometry(leaf);

    leaf.veins =
      createVeinData(leaf);

    leaf.localCollisionCircles =
      createLocalCollisionCircles(
        leaf.geometry
      );

    leaves.push(leaf);
  }

  // Place the largest leaves first.
  leaves.sort((a, b) => {
    const scaleA =
      settings.composition ===
      "Branch"
        ? 1
        : a.scale * a.scale;

    const scaleB =
      settings.composition ===
      "Branch"
        ? 1
        : b.scale * b.scale;

    const areaA =
      a.length *
      a.width *
      scaleA;

    const areaB =
      b.length *
      b.width *
      scaleB;

    return areaB - areaA;
  });
}

function getTargetLeafCount() {
  if (
    settings.composition !==
    "Branch"
  ) {
    return settings.leafCount;
  }

  const densityMultiplier =
    settings.growthDensity === "Sparse"
      ? 0.7
      : settings.growthDensity === "Dense"
        ? 1.3
        : 1;

  const seasonMultiplier =
    settings.season === "Spring"
      ? 0.78
      : settings.season === "Autumn"
        ? 0.68
        : settings.season === "Winter"
          ? 0.08
          : 1;

  return constrain(
    round(
      settings.leafCount *
      densityMultiplier *
      seasonMultiplier
    ),
    settings.season === "Winter"
      ? 0
      : 5,
    52
  );
}

// ==================================================
// LEAF FAMILIES
// ==================================================

function chooseLeafFamily() {
  const families = [
    {
      name: "lance",
      weight: settings.lanceWeight,

      length: [105, 150],
      widthRatio: [0.13, 0.2],

      upperControlT: [0.22, 0.31],
      lowerControlT: [0.68, 0.79],

      upperWidth: 0.72,
      lowerWidth: 0.78,

      bendRatio: [0.015, 0.1],
      stemRatio: [0.16, 0.28],

      veinCount: [14, 20],
      veinTipBias: [0.42, 0.72],
      veinCurvature: [0.06, 0.14]
    },

    {
      name: "oval",
      weight: settings.ovalWeight,

      length: [80, 115],
      widthRatio: [0.26, 0.36],

      upperControlT: [0.23, 0.33],
      lowerControlT: [0.67, 0.78],

      upperWidth: 1,
      lowerWidth: 1,

      bendRatio: [0.01, 0.07],
      stemRatio: [0.12, 0.22],

      veinCount: [10, 15],
      veinTipBias: [0.3, 0.58],
      veinCurvature: [0.06, 0.16]
    },

    {
      name: "teardrop",
      weight: settings.teardropWeight,

      length: [90, 130],
      widthRatio: [0.22, 0.33],

      upperControlT: [0.22, 0.32],
      lowerControlT: [0.69, 0.81],

      upperWidth: 0.55,
      lowerWidth: 1.14,

      bendRatio: [0.015, 0.09],
      stemRatio: [0.15, 0.28],

      veinCount: [10, 16],
      veinTipBias: [0.36, 0.66],
      veinCurvature: [0.07, 0.17]
    },

    {
      name: "inverseTeardrop",
      weight: settings.inverseWeight,

      length: [85, 125],
      widthRatio: [0.22, 0.33],

      upperControlT: [0.19, 0.3],
      lowerControlT: [0.66, 0.78],

      upperWidth: 1.14,
      lowerWidth: 0.56,

      bendRatio: [0.015, 0.085],
      stemRatio: [0.14, 0.25],

      veinCount: [10, 16],
      veinTipBias: [0.32, 0.62],
      veinCurvature: [0.06, 0.16]
    }
  ];

  if (
    settings.composition ===
    "Branch"
  ) {
    return families.find(
      family =>
        family.name ===
        settings.branchFamily
    );
  }

  const totalWeight =
    families.reduce(
      (total, family) =>
        total + family.weight,
      0
    );

  if (totalWeight <= 0) {
    return random(families);
  }

  const value =
    random(totalWeight);

  let accumulatedWeight = 0;

  for (const family of families) {
    accumulatedWeight += family.weight;

    if (value <= accumulatedWeight) {
      return family;
    }
  }

  return families[
    families.length - 1
  ];
}

// ==================================================
// SCALE DISTRIBUTION
// ==================================================

function createLeafScale(
  index,
  totalCount
) {
  const progress =
    totalCount <= 1
      ? 0
      : index /
        (totalCount - 1);

  if (progress < 0.15) {
    return random(1.15, 1.4);
  }

  if (progress < 0.55) {
    return random(0.88, 1.15);
  }

  return random(0.62, 0.96);
}

// ==================================================
// SMOOTH LEAF GEOMETRY
// ==================================================

function buildStylizedLeafGeometry(leaf) {
  const tip = [
    leaf.tipOffset,
    0
  ];

  const base = [
    leaf.baseOffset,
    leaf.length
  ];

  /*
   * These are the two control points of the
   * central vein.
   */
  const upperAxis = [
    leaf.bend *
      leaf.upperBendMultiplier,

    leaf.length *
      leaf.upperControlT
  ];

  const lowerAxis = [
    leaf.bend *
      leaf.lowerBendMultiplier,

    leaf.length *
      leaf.lowerControlT
  ];

  const centerControl1 = [
    upperAxis[0],
    upperAxis[1]
  ];

  const centerControl2 = [
    lowerAxis[0],
    lowerAxis[1]
  ];

  /*
   * Right outline controls.
   */
  const rightControl1 = [
    upperAxis[0] +
      leaf.rightUpperWidth,

    upperAxis[1]
  ];

  const rightControl2 = [
    lowerAxis[0] +
      leaf.rightLowerWidth,

    lowerAxis[1]
  ];

  /*
   * Left outline controls.
   */
  const leftControl1 = [
    upperAxis[0] -
      leaf.leftUpperWidth,

    upperAxis[1]
  ];

  const leftControl2 = [
    lowerAxis[0] -
      leaf.leftLowerWidth,

    lowerAxis[1]
  ];

  const rightBorder =
    sampleCubicBezier(
      tip,
      rightControl1,
      rightControl2,
      base,
      OUTLINE_RESOLUTION
    );

  const leftBorder =
    sampleCubicBezier(
      tip,
      leftControl1,
      leftControl2,
      base,
      OUTLINE_RESOLUTION
    );

  const centerline =
    sampleCubicBezierWithFrames(
      tip,
      centerControl1,
      centerControl2,
      base,
      OUTLINE_RESOLUTION
    );

  /*
   * Continue the stem using the centerline's
   * direction at the base.
   */
  const finalPoint =
    centerline[
      centerline.length - 1
    ];

  const previousPoint =
    centerline[
      centerline.length - 2
    ];

  let stemDirectionX =
    finalPoint[0] -
    previousPoint[0];

  let stemDirectionY =
    finalPoint[1] -
    previousPoint[1];

  const directionLength =
    Math.hypot(
      stemDirectionX,
      stemDirectionY
    ) || 1;

  stemDirectionX /= directionLength;
  stemDirectionY /= directionLength;

  const stemEnd = [
    base[0] +
      stemDirectionX *
      leaf.stemLength,

    base[1] +
      stemDirectionY *
      leaf.stemLength
  ];

  const stemCenterline =
    buildStemCenterline(
      leaf,
      base,
      stemEnd
    );

  return {
    tip,
    base,

    centerControl1,
    centerControl2,

    rightControl1,
    rightControl2,

    leftControl1,
    leftControl2,

    rightBorder,
    leftBorder,
    centerline,

    stemEnd,
    stemCenterline
  };
}

function buildStemCenterline(
  leaf,
  base,
  stemEnd
) {
  const directionX =
    stemEnd[0] - base[0];

  const directionY =
    stemEnd[1] - base[1];

  const directionLength =
    Math.hypot(
      directionX,
      directionY
    ) || 1;

  const unitX =
    directionX / directionLength;

  const unitY =
    directionY / directionLength;

  const normalX = -unitY;
  const normalY = unitX;

  const curveOffset =
    constrain(
      leaf.bend * 0.08,
      -leaf.stemLength * 0.12,
      leaf.stemLength * 0.12
    );

  const control = [
    lerp(base[0], stemEnd[0], 0.52) +
      normalX * curveOffset,

    lerp(base[1], stemEnd[1], 0.52) +
      normalY * curveOffset
  ];

  const centerPoints =
    sampleQuadraticBezier(
      base,
      control,
      stemEnd,
      18
    );

  return centerPoints;
}

// ==================================================
// CUBIC BÉZIER UTILITIES
// ==================================================

function sampleCubicBezier(
  start,
  control1,
  control2,
  end,
  resolution
) {
  const points = [];

  for (
    let i = 0;
    i <= resolution;
    i++
  ) {
    const t =
      i / resolution;

    points.push(
      cubicBezierPoint(
        start,
        control1,
        control2,
        end,
        t
      )
    );
  }

  return points;
}

function sampleCubicBezierWithFrames(
  start,
  control1,
  control2,
  end,
  resolution
) {
  const points = [];

  for (
    let i = 0;
    i <= resolution;
    i++
  ) {
    const t =
      i / resolution;

    const point =
      cubicBezierPoint(
        start,
        control1,
        control2,
        end,
        t
      );

    let tangent =
      cubicBezierTangent(
        start,
        control1,
        control2,
        end,
        t
      );

    const tangentLength =
      Math.hypot(
        tangent[0],
        tangent[1]
      ) || 1;

    tangent = [
      tangent[0] /
        tangentLength,

      tangent[1] /
        tangentLength
    ];

    /*
     * This normal points toward the right side
     * of a generally downward-facing leaf.
     */
    const normal = [
      tangent[1],
      -tangent[0]
    ];

    point.t = t;

    point.tx = tangent[0];
    point.ty = tangent[1];

    point.nx = normal[0];
    point.ny = normal[1];

    points.push(point);
  }

  return points;
}

function cubicBezierPoint(
  start,
  control1,
  control2,
  end,
  t
) {
  const inverse = 1 - t;

  const inverseSquared =
    inverse * inverse;

  const tSquared =
    t * t;

  return [
    inverseSquared *
      inverse *
      start[0] +

      3 *
      inverseSquared *
      t *
      control1[0] +

      3 *
      inverse *
      tSquared *
      control2[0] +

      tSquared *
      t *
      end[0],

    inverseSquared *
      inverse *
      start[1] +

      3 *
      inverseSquared *
      t *
      control1[1] +

      3 *
      inverse *
      tSquared *
      control2[1] +

      tSquared *
      t *
      end[1]
  ];
}

function cubicBezierTangent(
  start,
  control1,
  control2,
  end,
  t
) {
  const inverse = 1 - t;

  return [
    3 *
      inverse *
      inverse *
      (control1[0] - start[0]) +

      6 *
      inverse *
      t *
      (control2[0] - control1[0]) +

      3 *
      t *
      t *
      (end[0] - control2[0]),

    3 *
      inverse *
      inverse *
      (control1[1] - start[1]) +

      6 *
      inverse *
      t *
      (control2[1] - control1[1]) +

      3 *
      t *
      t *
      (end[1] - control2[1])
  ];
}

// ==================================================
// SIDE-VEIN GENERATION
// ==================================================

function createVeinData(leaf) {
  const veins = [];

  const veinsPerSide =
    ceil(leaf.veinCount / 2);

  for (
    let i = 0;
    i < veinsPerSide;
    i++
  ) {
    const progress =
      veinsPerSide <= 1
        ? 0.5
        : i /
          (veinsPerSide - 1);

    const basePosition =
      lerp(
        0.09,
        0.9,
        progress
      );

    /*
     * Left and right veins are staggered slightly
     * so they aren't perfectly mirrored.
     */
    const stagger =
      random(0.01, 0.025);

    veins.push({
      side: "left",

      u: constrain(
        basePosition - stagger,
        0.06,
        0.93
      ),

      tipBias:
        leaf.veinTipBias *
        random(0.85, 1.15),

      curvature:
        leaf.veinCurvature *
        random(0.8, 1.2),

      reach:
        random(0.94, 1),

      weightMultiplier:
        random(0.82, 1.1)
    });

    veins.push({
      side: "right",

      u: constrain(
        basePosition + stagger,
        0.06,
        0.93
      ),

      tipBias:
        leaf.veinTipBias *
        random(0.85, 1.15),

      curvature:
        leaf.veinCurvature *
        random(0.8, 1.2),

      reach:
        random(0.94, 1),

      weightMultiplier:
        random(0.82, 1.1)
    });
  }

  return veins;
}

// ==================================================
// SIDE-VEIN CURVES
// ==================================================

function calculateVeinCurve(
  leaf,
  vein
) {
  const geometry =
    leaf.geometry;

  const centerIndex =
    constrain(
      round(
        vein.u *
        (
          geometry.centerline.length -
          1
        )
      ),
      0,
      geometry.centerline.length - 1
    );

  const center =
    geometry.centerline[
      centerIndex
    ];

  const border =
    vein.side === "left"
      ? geometry.leftBorder
      : geometry.rightBorder;

  const sideMultiplier =
    vein.side === "left"
      ? -1
      : 1;

  /*
   * The local normal points outward.
   */
  const outwardX =
    center.nx *
    sideMultiplier;

  const outwardY =
    center.ny *
    sideMultiplier;

  /*
   * The negative tangent points toward the tip.
   */
  const tipDirectionX =
    -center.tx;

  const tipDirectionY =
    -center.ty;

  let directionX =
    outwardX +
    tipDirectionX *
    vein.tipBias;

  let directionY =
    outwardY +
    tipDirectionY *
    vein.tipBias;

  const directionLength =
    Math.hypot(
      directionX,
      directionY
    ) || 1;

  directionX /=
    directionLength;

  directionY /=
    directionLength;

  const start = [
    center[0],
    center[1]
  ];

  const borderHit =
    rayPolylineIntersection(
      start,
      [
        directionX,
        directionY
      ],
      border
    );

  if (borderHit === null) {
    return null;
  }

  const end = [
    lerp(
      start[0],
      borderHit[0],
      vein.reach
    ),

    lerp(
      start[1],
      borderHit[1],
      vein.reach
    )
  ];

  const veinLength =
    dist(
      start[0],
      start[1],
      end[0],
      end[1]
    );

  /*
   * Pull the curve slightly toward the tip.
   */
  const control = [
    lerp(
      start[0],
      end[0],
      0.5
    ) +
      tipDirectionX *
      veinLength *
      vein.curvature,

    lerp(
      start[1],
      end[1],
      0.5
    ) +
      tipDirectionY *
      veinLength *
      vein.curvature
  ];

  return sampleQuadraticBezier(
    start,
    control,
    end,
    VEIN_RESOLUTION
  );
}

function sampleQuadraticBezier(
  start,
  control,
  end,
  resolution
) {
  const points = [];

  for (
    let i = 0;
    i <= resolution;
    i++
  ) {
    const t =
      i / resolution;

    const inverse =
      1 - t;

    points.push([
      inverse *
        inverse *
        start[0] +

        2 *
        inverse *
        t *
        control[0] +

        t *
        t *
        end[0],

      inverse *
        inverse *
        start[1] +

        2 *
        inverse *
        t *
        control[1] +

        t *
        t *
        end[1]
    ]);
  }

  return points;
}

// ==================================================
// COLLISION GEOMETRY
// ==================================================

function createLocalCollisionCircles(
  geometry
) {
  const circles = [];

  for (
    let i = 0;
    i < COLLISION_SAMPLE_COUNT;
    i++
  ) {
    const amount =
      COLLISION_SAMPLE_COUNT <= 1
        ? 0.5
        : i /
          (COLLISION_SAMPLE_COUNT - 1);

    const sampleAmount =
      lerp(
        0.035,
        0.965,
        amount
      );

    const index =
      constrain(
        round(
          sampleAmount *
          (
            geometry.rightBorder.length -
            1
          )
        ),
        0,
        geometry.rightBorder.length - 1
      );

    const left =
      geometry.leftBorder[index];

    const right =
      geometry.rightBorder[index];

    circles.push({
      x:
        (
          left[0] +
          right[0]
        ) / 2,

      y:
        (
          left[1] +
          right[1]
        ) / 2,

      radius:
        max(
          2.5,

          dist(
            left[0],
            left[1],
            right[0],
            right[1]
          ) / 2
        )
    });
  }

  return circles;
}

// ==================================================
// BEST-CANDIDATE PLACEMENT
// ==================================================

function placeLeaves() {
  if (
    settings.composition ===
    "Branch"
  ) {
    branchStructure =
      createBranchStructure();

    placeLeavesOnBranch();
    return;
  }

  branchStructure = null;

  const placedLeaves = [];

  for (
    let leafIndex = 0;
    leafIndex < leaves.length;
    leafIndex++
  ) {
    const leaf = leaves[leafIndex];

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (
      let attempt = 0;
      attempt < CANDIDATES_PER_LEAF;
      attempt++
    ) {
      const placement =
        createPlacementCandidate(
          leaf,
          leafIndex
        );

      const circles =
        transformCollisionCircles(
          leaf,
          placement.x,
          placement.y,
          placement.rotation
        );

      const score =
        scorePlacementCandidate(
          circles,
          placedLeaves
        );

      if (score > bestScore) {
        bestScore = score;

        bestCandidate = {
          x: placement.x,
          y: placement.y,
          rotation:
            placement.rotation,
          circles
        };
      }
    }

    leaf.x =
      bestCandidate.x;

    leaf.y =
      bestCandidate.y;

    leaf.rotation =
      bestCandidate.rotation;

    leaf.collisionCircles =
      bestCandidate.circles;

    placedLeaves.push(leaf);
  }
}

function createBranchStructure() {
  const canonicalStart = [
    width + 42,
    height * random(0.17, 0.24)
  ];

  const canonicalEnd = [
    width * random(0.07, 0.13),
    height * random(0.4, 0.5)
  ];

  const curveAmount =
    settings.branchCurvature;

  const canonicalControl1 = [
    width *
      lerp(0.82, 0.74, curveAmount),

    height *
      lerp(0.2, 0.29, curveAmount)
  ];

  const canonicalControl2 = [
    width *
      lerp(0.45, 0.58, curveAmount),

    height *
      lerp(0.37, 0.51, curveAmount)
  ];

  const start =
    transformBranchEntryPoint(
      canonicalStart
    );

  const end =
    transformBranchEntryPoint(
      canonicalEnd
    );

  const control1 =
    transformBranchEntryPoint(
      canonicalControl1
    );

  const control2 =
    transformBranchEntryPoint(
      canonicalControl2
    );

  const mainSegment =
    createBranchSegment(
      start,
      control1,
      control2,
      end,
      settings.branchThickness,
      max(
        0.85,
        settings.branchThickness * 0.16
      ),
      0
    );

  mainSegment.branchIndex = 0;
  mainSegment.parentIndex = null;

  const segments = [mainSegment];

  growBranchChildren(
    mainSegment,
    1,
    segments
  );

  for (const segment of segments) {
    segment.isTerminal = true;
  }

  for (const segment of segments) {
    if (segment.parentIndex !== null) {
      segments[
        segment.parentIndex
      ].isTerminal = false;
    }
  }

  return {
    segments,
    maxDepth:
      max(
        ...segments.map(
          segment => segment.depth
        )
      )
  };
}

function transformBranchEntryPoint(point) {
  if (settings.branchEntry === "Left") {
    return [
      width - point[0],
      point[1]
    ];
  }

  if (settings.branchEntry === "Top") {
    return [
      point[1],
      width - point[0]
    ];
  }

  if (settings.branchEntry === "Bottom") {
    return [
      height - point[1],
      point[0]
    ];
  }

  return [...point];
}

function growBranchChildren(
  parentSegment,
  level,
  segments
) {
  if (level >= settings.branchLevels) {
    return;
  }

  const densityAdjustment =
    settings.growthDensity === "Sparse"
      ? -1
      : settings.growthDensity === "Dense"
        ? 1
        : 0;

  const childCount =
    level === 1
      ? max(
          1,
          settings.branchCount +
            densityAdjustment
        )
      : constrain(
          (
            random() < 0.58
              ? 2
              : 1
          ) +
            densityAdjustment,
          1,
          3
        );

  for (
    let i = 0;
    i < childCount;
    i++
  ) {
    const isContinuation = i === 0;

    const progress =
      constrain(
        (
          isContinuation
            ? random(0.94, 0.98)
            : lerp(
                level === 1
                  ? 0.2
                  : 0.34,
                level === 1
                  ? 0.7
                  : 0.72,
                i /
                  max(1, childCount - 1)
              )
        ) +
        random(-0.045, 0.045),
        0.16,
        0.99
      );

    const attachment =
      sampleBranchSegment(
        parentSegment,
        progress
      );

    const side =
      isContinuation
        ? 0
        : (
            i +
            parentSegment.branchIndex
          ) %
          2 === 0
          ? -1
          : 1;

    const parentAngle =
      Math.atan2(
        attachment.ty,
        attachment.tx
      );

    const splitAngle =
      parentAngle +
      (
        isContinuation
          ? random(-0.13, 0.13)
          : side *
            random(
              level === 1
                ? 0.52
                : 0.62,
              level === 1
                ? 1.02
                : 1.12
            )
      ) *
      settings.branchSpread;

    const lengthRatio =
      isContinuation
        ? random(0.5, 0.66)
        : level === 1
          ? random(0.28, 0.44)
          : random(0.38, 0.58);

    const segmentLength =
      parentSegment.length *
      lengthRatio *
      lerp(
        0.9,
        1.08,
        settings.branchCurvature
      );

    const branchEnd = [
      constrain(
        attachment.x +
          cos(splitAngle) *
          segmentLength +
          settings.branchWind *
          segmentLength *
          0.16,
        18,
        width - 18
      ),

      constrain(
        attachment.y +
          sin(splitAngle) *
          segmentLength +
          settings.branchGravity *
          segmentLength *
          0.2,
        22,
        height - 22
      )
    ];

    const actualLength =
      dist(
        attachment.x,
        attachment.y,
        branchEnd[0],
        branchEnd[1]
      );

    if (actualLength < 34) {
      continue;
    }

    const branchControl1 = [
      attachment.x +
        attachment.tx *
        actualLength *
        0.22,

      attachment.y +
        attachment.ty *
        actualLength *
        0.22
    ];

    const branchControl2 = [
      lerp(
        attachment.x,
        branchEnd[0],
        0.7
      ) +
        side *
        attachment.ty *
        actualLength *
        0.07 *
        settings.branchCurvature,

      lerp(
        attachment.y,
        branchEnd[1],
        0.7
      ) -
        side *
        attachment.tx *
        actualLength *
        0.07 *
        settings.branchCurvature
    ];

    const parentRadius =
      lerp(
        parentSegment.startRadius,
        parentSegment.endRadius,
        progress
      );

    const childSegment =
      createBranchSegment(
        [attachment.x, attachment.y],
        branchControl1,
        branchControl2,
        branchEnd,
        max(
          0.5,
          parentRadius *
            (
              isContinuation
                ? 0.72
                : random(0.38, 0.52)
            )
        ),
        max(
          0.2,
          parentRadius * 0.1
        ),
        level
      );

    if (
      branchConflictsWithTree(
        childSegment,
        segments,
        attachment
      )
    ) {
      continue;
    }

    childSegment.junctionOutline =
      createBranchJunctionOutline(
        attachment,
        childSegment.startRadius
      );

    childSegment.branchIndex =
      segments.length;

    childSegment.parentIndex =
      parentSegment.branchIndex;

    segments.push(childSegment);

    growBranchChildren(
      childSegment,
      level + 1,
      segments
    );
  }
}

function branchConflictsWithTree(
  candidate,
  segments,
  attachment
) {
  for (
    let candidateIndex = 3;
    candidateIndex <
      candidate.points.length;
    candidateIndex += 2
  ) {
    const candidateStart =
      candidate.points[
        candidateIndex - 2
      ];

    const candidateEnd =
      candidate.points[
        candidateIndex
      ];

    if (
      dist(
        candidateEnd[0],
        candidateEnd[1],
        attachment.x,
        attachment.y
      ) < 24
    ) {
      continue;
    }

    for (
      const segment
      of segments
    ) {
      for (
        let segmentIndex = 2;
        segmentIndex <
          segment.points.length;
        segmentIndex += 2
      ) {
        const segmentStart =
          segment.points[
            segmentIndex - 2
          ];

        const segmentEnd =
          segment.points[
            segmentIndex
          ];

        if (
          lineSegmentsIntersect(
            candidateStart,
            candidateEnd,
            segmentStart,
            segmentEnd
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function lineSegmentsIntersect(
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
) {
  const firstDirection = [
    firstEnd[0] - firstStart[0],
    firstEnd[1] - firstStart[1]
  ];

  const secondDirection = [
    secondEnd[0] - secondStart[0],
    secondEnd[1] - secondStart[1]
  ];

  const denominator =
    cross2D(
      firstDirection[0],
      firstDirection[1],
      secondDirection[0],
      secondDirection[1]
    );

  if (abs(denominator) < 0.0001) {
    return false;
  }

  const difference = [
    secondStart[0] - firstStart[0],
    secondStart[1] - firstStart[1]
  ];

  const firstAmount =
    cross2D(
      difference[0],
      difference[1],
      secondDirection[0],
      secondDirection[1]
    ) /
    denominator;

  const secondAmount =
    cross2D(
      difference[0],
      difference[1],
      firstDirection[0],
      firstDirection[1]
    ) /
    denominator;

  return (
    firstAmount > 0.02 &&
    firstAmount < 0.98 &&
    secondAmount > 0.02 &&
    secondAmount < 0.98
  );
}

function createBranchJunctionOutline(
  attachment,
  radius
) {
  const points = [];

  for (
    let i = 0;
    i < 16;
    i++
  ) {
    const angle =
      i / 16 * Math.PI * 2;

    const along =
      cos(angle) *
      radius *
      1.65;

    const across =
      sin(angle) *
      radius *
      0.92;

    points.push([
      attachment.x +
        attachment.tx * along -
        attachment.ty * across,

      attachment.y +
        attachment.ty * along +
        attachment.tx * across
    ]);
  }

  return points;
}

function createBranchSegment(
  start,
  control1,
  control2,
  end,
  startRadius,
  endRadius,
  depth
) {
  const points =
    sampleCubicBezierWithFrames(
      start,
      control1,
      control2,
      end,
      48
    );

  const distances = [0];
  let length = 0;

  for (
    let i = 1;
    i < points.length;
    i++
  ) {
    length +=
      dist(
        points[i - 1][0],
        points[i - 1][1],
        points[i][0],
        points[i][1]
      );

    distances.push(length);
  }

  const firstSide = [];
  const secondSide = [];

  for (
    let i = 0;
    i < points.length;
    i++
  ) {
    const progress =
      distances[i] / length;

    const radius =
      lerp(
        startRadius,
        endRadius,
        pow(progress, 0.82)
      );

    firstSide.push([
      points[i][0] +
        points[i].nx * radius,

      points[i][1] +
        points[i].ny * radius
    ]);

    secondSide.push([
      points[i][0] -
        points[i].nx * radius,

      points[i][1] -
        points[i].ny * radius
    ]);
  }

  return {
    start,
    end,
    control1,
    control2,
    startRadius,
    endRadius,
    depth,
    points,
    distances,
    length,
    knotProgresses:
      depth <= 1 &&
      random() < 0.7
        ? [random(0.24, 0.76)]
        : [],

    outline: [
      ...firstSide,
      ...secondSide.reverse()
    ]
  };
}

function sampleBranchSegment(
  segment,
  progress
) {
  const targetDistance =
    constrain(progress, 0, 1) *
    segment.length;

  let upperIndex = 1;

  while (
    upperIndex <
      segment.distances.length - 1 &&
    segment.distances[upperIndex] <
      targetDistance
  ) {
    upperIndex++;
  }

  const lowerIndex =
    max(0, upperIndex - 1);

  const lowerDistance =
    segment.distances[lowerIndex];

  const upperDistance =
    segment.distances[upperIndex];

  const amount =
    upperDistance === lowerDistance
      ? 0
      : (
          targetDistance -
          lowerDistance
        ) /
        (
          upperDistance -
          lowerDistance
        );

  const lower =
    segment.points[lowerIndex];

  const upper =
    segment.points[upperIndex];

  let tx =
    lerp(lower.tx, upper.tx, amount);

  let ty =
    lerp(lower.ty, upper.ty, amount);

  const tangentLength =
    Math.hypot(tx, ty) || 1;

  tx /= tangentLength;
  ty /= tangentLength;

  return {
    x: lerp(lower[0], upper[0], amount),
    y: lerp(lower[1], upper[1], amount),
    tx,
    ty
  };
}

function createBranchLeafAssignments(
  count
) {
  const arrangementSize =
    settings.leafArrangement ===
    "Opposite"
      ? 2
      : settings.leafArrangement ===
          "Whorled"
        ? 3
        : 1;

  const clusterCount =
    ceil(count / arrangementSize);

  const weightedSegments =
    branchStructure.segments.map(
      segment => {
        const levelWeight =
          segment.depth === 0
            ? 0.16
            : 1 +
              segment.depth * 0.32;

        return {
          segment,
          weight:
            segment.length *
            levelWeight
        };
      }
    );

  const totalWeight =
    weightedSegments.reduce(
      (total, item) =>
        total + item.weight,
      0
    );

  const assignments = [];

  for (
    let i = 0;
    i < clusterCount;
    i++
  ) {
    let target =
      (
        (i + 0.5) /
        clusterCount
      ) *
      totalWeight;

    let selected =
      weightedSegments[
        weightedSegments.length - 1
      ];

    for (
      const item
      of weightedSegments
    ) {
      if (target <= item.weight) {
        selected = item;
        break;
      }

      target -= item.weight;
    }

    const evenProgress =
      constrain(
        target /
          selected.weight,
        0,
        1
      );

    const clusteredProgress =
      lerp(
        evenProgress,
        pow(evenProgress, 0.42),
        settings.tipClustering
      );

    const localProgress =
      lerp(
        0.12,
        0.9,
        clusteredProgress
      );

    assignments.push({
      segment: selected.segment,
      progress: localProgress,
      nodeOffset: random(-0.035, 0.035),

      maturity:
        (
          selected.segment.depth +
          localProgress
        ) /
        (
          branchStructure.maxDepth +
          1
        )
    });
  }

  const orderedAssignments =
    assignments.sort(
    (first, second) =>
      first.maturity -
      second.maturity
  );

  const expandedAssignments = [];

  for (
    const assignment
    of orderedAssignments
  ) {
    for (
      let arrangementIndex = 0;
      arrangementIndex <
        arrangementSize;
      arrangementIndex++
    ) {
      expandedAssignments.push({
        ...assignment,
        arrangementIndex,
        arrangementSize
      });
    }
  }

  return expandedAssignments.slice(
    0,
    count
  );
}

function getLeafAttachmentAngle(
  tangentAngle,
  assignment,
  leafIndex
) {
  const angle =
    radians(settings.leafAngle);

  if (
    settings.leafArrangement ===
    "Opposite"
  ) {
    return (
      tangentAngle +
      (
        assignment.arrangementIndex === 0
          ? -angle
          : angle
      )
    );
  }

  if (
    settings.leafArrangement ===
    "Whorled"
  ) {
    const offsets = [
      -angle,
      angle,
      Math.PI
    ];

    return (
      tangentAngle +
      offsets[
        assignment.arrangementIndex
      ]
    );
  }

  return (
    tangentAngle +
    (
      leafIndex % 2 === 0
        ? -angle
        : angle
    )
  );
}

function placeLeavesOnBranch() {
  const placedLeaves = [];
  const assignments =
    createBranchLeafAssignments(
      leaves.length
    );

  for (
    let leafIndex = 0;
    leafIndex < leaves.length;
    leafIndex++
  ) {
    const leaf = leaves[leafIndex];

    const assignment =
      assignments[leafIndex];

    leaf.scale =
      lerp(
        1.12,
        0.48,
        pow(
          assignment.maturity,
          0.78
        )
      ) *
      (
        settings.season === "Spring"
          ? 0.82
          : settings.season === "Winter"
            ? 0.68
            : 1
      );

    leaf.branchProgress =
      assignment.maturity;

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (
      let attempt = 0;
      attempt < 80;
      attempt++
    ) {
      const progress =
        constrain(
          assignment.progress +
          assignment.nodeOffset +
          random(
            -(
              assignment.arrangementSize >
              1
                ? 0.01
                : 0.045
            ),
            assignment.arrangementSize >
            1
              ? 0.01
              : 0.045
          ),
          0.08,
          0.94
        );

      const attachment =
        {
          ...sampleBranchSegment(
            assignment.segment,
            progress
          ),

          segment:
            assignment.segment
        };

      const tangentAngle =
        Math.atan2(
          attachment.ty,
          attachment.tx
        );

      const outwardAngle =
        getLeafAttachmentAngle(
          tangentAngle,
          assignment,
          leafIndex
        ) +
        radians(random(-7, 7));

      const rotation =
        outwardAngle +
        Math.PI / 2;

      const stemX =
        leaf.geometry.stemEnd[0] *
        leaf.scale;

      const stemY =
        leaf.geometry.stemEnd[1] *
        leaf.scale;

      const cosine = cos(rotation);
      const sine = sin(rotation);

      const x =
        attachment.x -
        (
          stemX * cosine -
          stemY * sine
        );

      const y =
        attachment.y -
        (
          stemX * sine +
          stemY * cosine
        );

      const circles =
        transformCollisionCircles(
          leaf,
          x,
          y,
          rotation
        );

      const score =
        scorePlacementCandidate(
          circles,
          placedLeaves
        );

      if (score > bestScore) {
        bestScore = score;

        bestCandidate = {
          x,
          y,
          rotation,
          circles,
          attachment
        };
      }
    }

    leaf.x = bestCandidate.x;
    leaf.y = bestCandidate.y;
    leaf.rotation =
      bestCandidate.rotation;

    leaf.collisionCircles =
      bestCandidate.circles;

    leaf.branchAttachment =
      bestCandidate.attachment;

    leaf.branchLayer =
      random() < settings.rearLeaves
        ? "rear"
        : "front";

    placedLeaves.push(leaf);
  }
}

function createPlacementCandidate(
  leaf,
  leafIndex
) {
  if (
    settings.composition ===
    "Wreath"
  ) {
    return createWreathCandidate(
      leafIndex
    );
  }

  if (
    settings.composition ===
    "Specimen"
  ) {
    return createSpecimenCandidate(
      leaf,
      leafIndex
    );
  }

  return createScatterCandidate();
}

function createScatterCandidate() {
  const x = random(width);
  const y = random(height);

  return {
    x,
    y,
    rotation:
      getFlowRotation(x, y) +
      random(
        -settings.rotationJitter,
        settings.rotationJitter
      )
  };
}

function createWreathCandidate(
  leafIndex
) {
  const progress =
    leafIndex /
    max(1, leaves.length);

  const angle =
    progress *
    Math.PI *
    2 +
    random(-0.16, 0.16);

  const radius =
    min(width, height) *
    random(0.29, 0.37);

  return {
    x:
      width / 2 +
      cos(angle) * radius,

    y:
      height / 2 +
      sin(angle) * radius,

    rotation:
      angle +
      random(
        -settings.rotationJitter,
        settings.rotationJitter
      )
  };
}

function createSpecimenCandidate(
  leaf,
  leafIndex
) {
  const columns =
    ceil(sqrt(leaves.length));

  const rows =
    ceil(
      leaves.length / columns
    );

  const column =
    leafIndex % columns;

  const row =
    floor(leafIndex / columns);

  const cellWidth =
    width / columns;

  const cellHeight =
    height / rows;

  return {
    x:
      (column + 0.5) *
      cellWidth +
      random(
        -cellWidth * 0.1,
        cellWidth * 0.1
      ),

    y:
      (row + 0.5) *
      cellHeight -
      leaf.length *
      leaf.scale *
      0.45 +
      random(
        -cellHeight * 0.08,
        cellHeight * 0.08
      ),

    rotation:
      random(-0.28, 0.28)
  };
}

function transformCollisionCircles(
  leaf,
  x,
  y,
  rotation
) {
  const result = [];

  const cosine =
    cos(rotation);

  const sine =
    sin(rotation);

  for (
    const circle
    of leaf.localCollisionCircles
  ) {
    const scaledX =
      circle.x *
      leaf.scale;

    const scaledY =
      circle.y *
      leaf.scale;

    result.push({
      x:
        x +
        scaledX * cosine -
        scaledY * sine,

      y:
        y +
        scaledX * sine +
        scaledY * cosine,

      radius:
        circle.radius *
        leaf.scale *
        settings.spacing +
        COLLISION_PADDING
    });
  }

  return result;
}

function scorePlacementCandidate(
  candidateCircles,
  placedLeaves
) {
  const boundaryOverflow =
    calculateBoundaryOverflow(
      candidateCircles
    );

  if (placedLeaves.length === 0) {
    const candidateCenter =
      getCircleGroupCenter(
        candidateCircles
      );

    return (
      -dist(
        candidateCenter.x,
        candidateCenter.y,
        width / 2,
        height / 2
      ) -
      boundaryOverflow *
      EDGE_PENALTY
    );
  }

  let minimumClearance =
    Infinity;

  let overlapAmount = 0;

  for (
    const candidateCircle
    of candidateCircles
  ) {
    for (
      const placedLeaf
      of placedLeaves
    ) {
      for (
        const placedCircle
        of placedLeaf.collisionCircles
      ) {
        const centerDistance =
          dist(
            candidateCircle.x,
            candidateCircle.y,
            placedCircle.x,
            placedCircle.y
          );

        const combinedRadius =
          candidateCircle.radius +
          placedCircle.radius;

        const clearance =
          centerDistance -
          combinedRadius;

        minimumClearance =
          min(
            minimumClearance,
            clearance
          );

        if (clearance < 0) {
          overlapAmount +=
            -clearance /
            combinedRadius;
        }
      }
    }
  }

  return (
    minimumClearance -
    overlapAmount *
    OVERLAP_PENALTY -
    boundaryOverflow *
    EDGE_PENALTY
  );
}

function calculateBoundaryOverflow(
  circles
) {
  let overflow = 0;

  for (const circle of circles) {
    const left =
      circle.x -
      circle.radius;

    const right =
      circle.x +
      circle.radius;

    const top =
      circle.y -
      circle.radius;

    const bottom =
      circle.y +
      circle.radius;

    if (left < 0) {
      overflow += -left;
    }

    if (right > width) {
      overflow +=
        right - width;
    }

    if (top < 0) {
      overflow += -top;
    }

    if (bottom > height) {
      overflow +=
        bottom - height;
    }
  }

  return overflow;
}

function getCircleGroupCenter(circles) {
  let totalX = 0;
  let totalY = 0;

  for (const circle of circles) {
    totalX += circle.x;
    totalY += circle.y;
  }

  return {
    x:
      totalX /
      circles.length,

    y:
      totalY /
      circles.length
  };
}

// ==================================================
// FLOW-FIELD ROTATION
// ==================================================

function getFlowRotation(x, y) {
  const noiseValue =
    noise(
      x * settings.flowScale,
      y * settings.flowScale
    );

  return map(
    noiseValue,
    0,
    1,
    -Math.PI * 2,
    Math.PI * 2
  );
}

// ==================================================
// DRAWING
// ==================================================

function drawBranchStructure() {
  const branchStroke =
    darkenHex(
      settings.branchColor,
      0.42
    );

  const orderedSegments = [
    ...branchStructure.segments
  ].sort(
    (first, second) =>
      second.depth - first.depth
  );

  for (
    const segment
    of orderedSegments
  ) {
    const segmentFill =
      getBranchSegmentColor(
        segment
      );

    brush.noHatch();
    brush.noWash();

    brush.fill(
      segmentFill,
      max(
        102,
        155 - segment.depth * 18
      )
    );

    brush.fillBleed(
      max(
        0.025,
        0.075 -
          segment.depth * 0.018
      ),
      "out"
    );

    brush.fillTexture(
      0.4,
      0.28,
      true
    );

    brush.set(
      "HB",
      branchStroke,
      max(
        0.24,
        0.7 - segment.depth * 0.18
      )
    );

    if (segment.junctionOutline) {
      drawBrushPolygon(
        segment.junctionOutline
      );
    }

    drawBrushPolygon(
      segment.outline
    );

    brush.noFill();
    brush.noWash();
    brush.noHatch();

    drawTaperedBrushPath(
      segment.points,
      branchStroke,
      max(
        0.16,
        0.45 - segment.depth * 0.13
      ),
      0.08
    );

    drawBranchBark(
      segment,
      branchStroke
    );

    drawBranchKnots(
      segment,
      branchStroke
    );

    if (
      segment.isTerminal &&
      (
        settings.season === "Winter" ||
        (
          segment.branchIndex +
          settings.seed
        ) %
        5 === 0
      )
    ) {
      drawBrokenBranchTip(
        segment,
        branchStroke
      );
    }
  }

  drawBranchNodes(branchStroke);
}

function getBranchSegmentColor(segment) {
  const youngWoodAmount =
    constrain(
      segment.depth * 0.12,
      0,
      0.32
    );

  let youngWood = "#9b8057";

  if (settings.season === "Spring") {
    youngWood = "#78825a";
  }

  if (settings.season === "Winter") {
    youngWood = "#756754";
  }

  return mixHex(
    settings.branchColor,
    youngWood,
    youngWoodAmount
  );
}

function drawBranchBark(
  segment,
  branchStroke
) {
  const barkColor =
    mixHex(
      branchStroke,
      getBranchSegmentColor(segment),
      0.38
    );

  const offsets =
    segment.depth === 0
      ? [-0.42, 0, 0.4]
      : [-0.28, 0.28];

  for (const offset of offsets) {
    const path = [];

    for (
      let i = 2;
      i < segment.points.length - 2;
      i++
    ) {
      const point = segment.points[i];
      const progress =
        segment.distances[i] /
        segment.length;

      const radius =
        lerp(
          segment.startRadius,
          segment.endRadius,
          pow(progress, 0.82)
        );

      path.push([
        point[0] +
          point.nx *
          radius *
          offset,

        point[1] +
          point.ny *
          radius *
          offset
      ]);
    }

    drawTaperedBrushPath(
      path,
      barkColor,
      segment.depth === 0
        ? 0.16
        : 0.1,
      0.04
    );
  }
}

function drawBranchKnots(
  segment,
  branchStroke
) {
  for (
    const progress
    of segment.knotProgresses
  ) {
    const frame =
      sampleBranchSegment(
        segment,
        progress
      );

    const radius =
      lerp(
        segment.startRadius,
        segment.endRadius,
        progress
      );

    const knot = [];

    for (
      let i = 0;
      i <= 12;
      i++
    ) {
      const angle =
        i / 12 * Math.PI * 2;

      knot.push([
        frame.x +
          frame.tx *
          cos(angle) *
          radius *
          0.75 -
          frame.ty *
          sin(angle) *
          radius *
          0.42,

        frame.y +
          frame.ty *
          cos(angle) *
          radius *
          0.75 +
          frame.tx *
          sin(angle) *
          radius *
          0.42
      ]);
    }

    drawTaperedBrushPath(
      knot,
      branchStroke,
      0.24,
      0.24
    );
  }
}

function drawBrokenBranchTip(
  segment,
  branchStroke
) {
  const end =
    segment.points[
      segment.points.length - 1
    ];

  const size =
    max(2.2, segment.endRadius * 2);

  const firstCut = [
    [end[0], end[1]],
    [
      end[0] -
        end.tx * size +
        end.nx * size * 0.5,

      end[1] -
        end.ty * size +
        end.ny * size * 0.5
    ]
  ];

  const secondCut = [
    [end[0], end[1]],
    [
      end[0] -
        end.tx * size -
        end.nx * size * 0.45,

      end[1] -
        end.ty * size -
        end.ny * size * 0.45
    ]
  ];

  drawTaperedBrushPath(
    firstCut,
    branchStroke,
    0.32,
    0.08
  );

  drawTaperedBrushPath(
    secondCut,
    branchStroke,
    0.32,
    0.08
  );
}

function drawBranchNodes(branchStroke) {
  const drawnNodes = new Set();

  brush.noFill();
  brush.noWash();
  brush.noHatch();

  for (
    let i = 0;
    i < leaves.length;
    i++
  ) {
    const leaf = leaves[i];
    const attachment =
      leaf.branchAttachment;

    const key =
      `${round(attachment.x / 3)}:` +
      `${round(attachment.y / 3)}`;

    if (drawnNodes.has(key)) {
      continue;
    }

    drawnNodes.add(key);

    const nodeHalfWidth =
      leaf.branchProgress > 0.62
        ? 2.2
        : 1.6;

    const nodePath = [
      [
        attachment.x -
          attachment.ty *
          nodeHalfWidth,

        attachment.y +
          attachment.tx *
          nodeHalfWidth
      ],
      [
        attachment.x +
          attachment.ty *
          nodeHalfWidth,

        attachment.y -
          attachment.tx *
          nodeHalfWidth
      ]
    ];

    drawTaperedBrushPath(
      nodePath,
      branchStroke,
      0.58,
      0.32
    );

    if (
      leaf.branchProgress > 0.72 &&
      i % 4 === 0
    ) {
      const budPath = [
        [attachment.x, attachment.y],
        [
          attachment.x -
            attachment.ty * 4 -
            attachment.tx * 1.5,

          attachment.y +
            attachment.tx * 4 -
            attachment.ty * 1.5
        ]
      ];

      drawTaperedBrushPath(
        budPath,
        branchStroke,
        0.55,
        0.12
      );
    }
  }
}

function drawPaperTexture() {
  if (settings.paperTexture <= 0) {
    return;
  }

  push();

  const darkGrain =
    color(
      darkenHex(
        settings.background,
        0.24
      )
    );

  const lightGrain =
    color(
      mixHex(
        settings.background,
        "#ffffff",
        0.7
      )
    );

  noStroke();

  const mottleCount =
    round(
      28 *
      settings.paperTexture
    );

  for (
    let i = 0;
    i < mottleCount;
    i++
  ) {
    const mottleColor =
      random() < 0.65
        ? darkGrain
        : lightGrain;

    mottleColor.setAlpha(
      random(4, 12) *
      settings.paperTexture
    );

    fill(mottleColor);

    circle(
      random(width),
      random(height),
      random(18, 75)
    );
  }

  const grainCount =
    round(
      1600 *
      settings.paperTexture
    );

  for (
    let i = 0;
    i < grainCount;
    i++
  ) {
    const grainColor =
      random() < 0.72
        ? darkGrain
        : lightGrain;

    grainColor.setAlpha(
      random(18, 52) *
      settings.paperTexture
    );

    fill(grainColor);

    circle(
      random(width),
      random(height),
      random(0.8, 3.5)
    );
  }

  const fiberCount =
    round(
      210 *
      settings.paperTexture
    );

  for (
    let i = 0;
    i < fiberCount;
    i++
  ) {
    darkGrain.setAlpha(
      random(20, 55) *
      settings.paperTexture
    );

    stroke(darkGrain);
    strokeWeight(random(0.4, 1.2));

    const x = random(width);
    const y = random(height);
    const fiberLength =
      random(8, 42);
    const angle =
      random(-0.35, 0.35);

    line(
      x,
      y,
      x + cos(angle) * fiberLength,
      y + sin(angle) * fiberLength
    );
  }

  pop();
}

function drawLeafInstance(leaf) {
  push();

  translate(
    leaf.x,
    leaf.y
  );

  rotate(
    leaf.rotation
  );

  scale(
    leaf.scale
  );

  drawStylizedLeaf(leaf);

  pop();
}

function createLeafOutline(geometry) {
  return [
    ...geometry.rightBorder,

    ...geometry.leftBorder
      .slice()
      .reverse()
  ];
}

function drawStylizedLeaf(leaf) {
  const geometry =
    leaf.geometry;

  /*
   * The only closed shape being drawn is the outer
   * silhouette. No inner wash or fold polygons are
   * drawn, so no extra longitudinal lines appear.
   */
  const outline =
    createLeafOutline(geometry);

  const outlineWeight =
    0.72 / leaf.scale;

  // Center vein weights.
  const centerTipWeight =
    0.14 / leaf.scale;

  const centerBaseWeight =
    0.68 / leaf.scale;

  // Side vein weights.
  const sideVeinBaseWeight =
    0.36 / leaf.scale;

  const sideVeinEndWeight =
    0.055 / leaf.scale;

  // ----------------------------------------------
  // Narrow, tapered pen-drawn petiole
  // ----------------------------------------------

  brush.noFill();
  brush.noHatch();
  brush.noWash();

  drawTaperedBrushPath(
    geometry.stemCenterline,
    leaf.veinColor,
    0.42 / leaf.scale,
    1.2 / leaf.scale
  );

  // ----------------------------------------------
  // Main watercolor body
  // ----------------------------------------------

  brush.noHatch();
  brush.noWash();

  brush.fill(
    leaf.fillColor,
    leaf.fillOpacity
  );

  brush.fillBleed(
    leaf.bleed,
    "out"
  );

  brush.fillTexture(
    leaf.texture,
    0.3,
    true
  );

  brush.set(
    "HB",
    leaf.strokeColor,
    outlineWeight
  );

  drawBrushPolygon(outline);

  // ----------------------------------------------
  // Single center vein
  // ----------------------------------------------

  brush.noFill();
  brush.noWash();
  brush.noHatch();

  /*
   * The centerline runs from the tip to the base,
   * becoming thicker toward the base.
   */
  drawTaperedBrushPath(
    geometry.centerline,
    leaf.veinColor,
    centerTipWeight,
    centerBaseWeight
  );

  // ----------------------------------------------
  // Curved side veins
  // ----------------------------------------------

  for (const vein of leaf.veins) {
    const curve =
      calculateVeinCurve(
        leaf,
        vein
      );

    if (curve === null) {
      continue;
    }

    drawTaperedBrushPath(
      curve,
      leaf.veinColor,

      sideVeinBaseWeight *
      vein.weightMultiplier,

      sideVeinEndWeight
    );
  }

}

// ==================================================
// BRUSH DRAWING HELPERS
// ==================================================

function drawBrushPolygon(points) {
  brush.beginShape(0);

  for (const point of points) {
    brush.vertex(
      point[0],
      point[1]
    );
  }

  brush.endShape(true);
}

function drawTaperedBrushPath(
  points,
  colorValue,
  startWeight,
  endWeight
) {
  if (points.length < 2) {
    return;
  }

  for (
    let i = 0;
    i < points.length - 1;
    i++
  ) {
    const amount =
      i /
      max(
        1,
        points.length - 2
      );

    const weight =
      lerp(
        startWeight,
        endWeight,
        amount
      );

    brush.set(
      "HB",
      colorValue,
      max(0.03, weight)
    );

    brush.line(
      points[i][0],
      points[i][1],
      points[i + 1][0],
      points[i + 1][1]
    );
  }
}

// ==================================================
// RAY/BORDER INTERSECTIONS
// ==================================================

function rayPolylineIntersection(
  origin,
  direction,
  polyline
) {
  let closestPoint = null;

  let closestDistance =
    Infinity;

  for (
    let i = 0;
    i < polyline.length - 1;
    i++
  ) {
    const hit =
      raySegmentIntersection(
        origin,
        direction,
        polyline[i],
        polyline[i + 1]
      );

    if (
      hit !== null &&
      hit.distance <
      closestDistance
    ) {
      closestDistance =
        hit.distance;

      closestPoint =
        hit.point;
    }
  }

  return closestPoint;
}

function raySegmentIntersection(
  origin,
  direction,
  pointA,
  pointB
) {
  const rayX =
    direction[0];

  const rayY =
    direction[1];

  const segmentX =
    pointB[0] -
    pointA[0];

  const segmentY =
    pointB[1] -
    pointA[1];

  const denominator =
    cross2D(
      rayX,
      rayY,
      segmentX,
      segmentY
    );

  if (
    abs(denominator) <
    0.000001
  ) {
    return null;
  }

  const differenceX =
    pointA[0] -
    origin[0];

  const differenceY =
    pointA[1] -
    origin[1];

  const rayAmount =
    cross2D(
      differenceX,
      differenceY,
      segmentX,
      segmentY
    ) / denominator;

  const segmentAmount =
    cross2D(
      differenceX,
      differenceY,
      rayX,
      rayY
    ) / denominator;

  if (
    rayAmount >= 0 &&
    segmentAmount >= 0 &&
    segmentAmount <= 1
  ) {
    return {
      point: [
        origin[0] +
        rayX *
        rayAmount,

        origin[1] +
        rayY *
        rayAmount
      ],

      distance:
        rayAmount
    };
  }

  return null;
}

function cross2D(
  ax,
  ay,
  bx,
  by
) {
  return (
    ax * by -
    ay * bx
  );
}

// ==================================================
// COLORS
// ==================================================

function randomLeafColor() {
  if (
    settings.composition ===
    "Branch" &&
    settings.season !== "Summer"
  ) {
    return random(
      SEASON_LEAF_COLORS[
        settings.season
      ]
    );
  }

  return random(
    PALETTES[settings.palette]
  );
}

function darkenHex(hex, amount) {
  return mixHex(
    hex,
    "#000000",
    amount
  );
}

function mixHex(
  first,
  second,
  amount
) {
  const firstColor =
    hexToRgb(first);

  const secondColor =
    hexToRgb(second);

  return rgbToHex(
    round(
      lerp(
        firstColor.r,
        secondColor.r,
        amount
      )
    ),

    round(
      lerp(
        firstColor.g,
        secondColor.g,
        amount
      )
    ),

    round(
      lerp(
        firstColor.b,
        secondColor.b,
        amount
      )
    )
  );
}

function hexToRgb(hex) {
  const clean =
    hex.replace("#", "");

  return {
    r: parseInt(
      clean.substring(0, 2),
      16
    ),

    g: parseInt(
      clean.substring(2, 4),
      16
    ),

    b: parseInt(
      clean.substring(4, 6),
      16
    )
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    componentToHex(r) +
    componentToHex(g) +
    componentToHex(b)
  );
}

function componentToHex(value) {
  return constrain(
    round(value),
    0,
    255
  )
    .toString(16)
    .padStart(2, "0");
}

// ==================================================
// DEBUG VIEW
// ==================================================

function drawDebugInformation() {
  push();

  noFill();
  stroke(255, 0, 0, 110);
  strokeWeight(1);

  for (const leaf of leaves) {
    for (
      const collisionCircle
      of leaf.collisionCircles
    ) {
      circle(
        collisionCircle.x,
        collisionCircle.y,
        collisionCircle.radius * 2
      );
    }
  }

  pop();
}