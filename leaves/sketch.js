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
  branchCount: 3,
  branchCurvature: 0.55,
  branchThickness: 6,
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
    "branchCount",
    {
      label: "side branches",
      min: 0,
      max: 6,
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
    branchCount: getNumberParameter(
      parameters,
      "branches",
      DEFAULT_SETTINGS.branchCount,
      0,
      6,
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
    branches: settings.branchCount,
    branchCurve:
      settings.branchCurvature,
    branchWidth:
      settings.branchThickness,
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

  for (
    let i = 0;
    i < settings.leafCount;
    i++
  ) {
    const family = chooseLeafFamily();
    const scale = createLeafScale(i);

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

function createLeafScale(index) {
  const progress =
    settings.leafCount <= 1
      ? 0
      : index /
        (settings.leafCount - 1);

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
  const start = [
    width * random(0.07, 0.12),
    height * random(0.84, 0.91)
  ];

  const end = [
    width * random(0.86, 0.93),
    height * random(0.09, 0.16)
  ];

  const curveAmount =
    settings.branchCurvature;

  const control1 = [
    width *
      lerp(0.24, 0.16, curveAmount),

    height *
      lerp(0.69, 0.84, curveAmount)
  ];

  const control2 = [
    width *
      lerp(0.7, 0.82, curveAmount),

    height *
      lerp(0.31, 0.18, curveAmount)
  ];

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

  const segments = [mainSegment];

  for (
    let i = 0;
    i < settings.branchCount;
    i++
  ) {
    const progress =
      constrain(
        lerp(
          0.2,
          0.78,
          (i + 1) /
            (settings.branchCount + 1)
        ) +
        random(-0.035, 0.035),
        0.16,
        0.84
      );

    const attachment =
      sampleBranchSegment(
        mainSegment,
        progress
      );

    const side =
      i % 2 === 0 ? -1 : 1;

    const parentAngle =
      Math.atan2(
        attachment.ty,
        attachment.tx
      );

    const splitAngle =
      parentAngle +
      side *
      random(0.55, 0.95);

    const segmentLength =
      random(92, 148) *
      lerp(0.86, 1.08, curveAmount);

    const branchEnd = [
      constrain(
        attachment.x +
          cos(splitAngle) *
          segmentLength,
        28,
        width - 28
      ),

      constrain(
        attachment.y +
          sin(splitAngle) *
          segmentLength,
        28,
        height - 28
      )
    ];

    const branchControl1 = [
      attachment.x +
        attachment.tx *
        segmentLength *
        0.2,

      attachment.y +
        attachment.ty *
        segmentLength *
        0.2
    ];

    const branchControl2 = [
      lerp(
        attachment.x,
        branchEnd[0],
        0.7
      ) +
        side *
        attachment.ty *
        segmentLength *
        0.08 *
        curveAmount,

      lerp(
        attachment.y,
        branchEnd[1],
        0.7
      ) -
        side *
        attachment.tx *
        segmentLength *
        0.08 *
        curveAmount
    ];

    const parentRadius =
      lerp(
        mainSegment.startRadius,
        mainSegment.endRadius,
        progress
      );

    segments.push(
      createBranchSegment(
        [attachment.x, attachment.y],
        branchControl1,
        branchControl2,
        branchEnd,
        max(1.2, parentRadius * 0.62),
        0.55,
        1
      )
    );
  }

  return {
    segments,

    attachmentLength:
      segments.reduce(
        (total, segment) =>
          total +
          segment.length * 0.76,
        0
      )
  };
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

function sampleBranchStructure(progress) {
  let targetDistance =
    constrain(progress, 0, 1) *
    branchStructure.attachmentLength;

  for (
    const segment
    of branchStructure.segments
  ) {
    const availableLength =
      segment.length * 0.76;

    if (
      targetDistance <=
      availableLength
    ) {
      return {
        ...sampleBranchSegment(
          segment,
          lerp(
            0.12,
            0.88,
            targetDistance /
              availableLength
          )
        ),

        segment
      };
    }

    targetDistance -=
      availableLength;
  }

  const lastSegment =
    branchStructure.segments[
      branchStructure.segments.length - 1
    ];

  return {
    ...sampleBranchSegment(
      lastSegment,
      0.88
    ),

    segment: lastSegment
  };
}

function placeLeavesOnBranch() {
  const placedLeaves = [];

  for (
    let leafIndex = 0;
    leafIndex < leaves.length;
    leafIndex++
  ) {
    const leaf = leaves[leafIndex];

    const branchProgress =
      (leafIndex + 0.5) /
      leaves.length;

    leaf.scale =
      lerp(
        1.12,
        0.56,
        pow(branchProgress, 0.82)
      );

    leaf.branchProgress =
      branchProgress;

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (
      let attempt = 0;
      attempt < 80;
      attempt++
    ) {
      const progress =
        constrain(
          branchProgress +
          random(-0.38, 0.38) /
            leaves.length,
          0.01,
          0.99
        );

      const attachment =
        sampleBranchStructure(
          progress
        );

      const side =
        leafIndex % 2 === 0
          ? -1
          : 1;

      const tangentAngle =
        Math.atan2(
          attachment.ty,
          attachment.tx
        );

      const outwardAngle =
        tangentAngle +
        side *
        radians(
          settings.leafAngle +
          random(-10, 10)
        );

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
    brush.noHatch();
    brush.noWash();

    brush.fill(
      settings.branchColor,
      segment.depth === 0
        ? 155
        : 138
    );

    brush.fillBleed(
      segment.depth === 0
        ? 0.075
        : 0.045,
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
      segment.depth === 0
        ? 0.7
        : 0.45
    );

    drawBrushPolygon(
      segment.outline
    );

    brush.noFill();
    brush.noWash();
    brush.noHatch();

    drawTaperedBrushPath(
      segment.points,
      branchStroke,
      segment.depth === 0
        ? 0.45
        : 0.28,
      0.08
    );
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