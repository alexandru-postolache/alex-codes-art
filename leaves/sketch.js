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

const settings = {
  seed: getSeedFromUrl(),
  leafCount: 20,
  flowScale: 0.0095,
  rotationJitter: 0.1,
  spacing: 0.82,
  background: "#f2eee7"
};

// ==================================================
// STATE
// ==================================================

let leaves = [];
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
  settings.seed =
    normalizeSeed(settings.seed);

  updateSeedInUrl();

  randomSeed(settings.seed);
  noiseSeed(settings.seed);

  background(settings.background);

  createLeaves();
  placeLeaves();

  push();

  // Restore normal top-left coordinates in WEBGL mode.
  translate(
    -width / 2,
    -height / 2
  );

  for (const leaf of leaves) {
    drawLeafInstance(leaf);
  }

  if (showDebug) {
    drawDebugInformation();
  }

  pop();
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

  pane.addInput(settings, "leafCount", {
    label: "leaves",
    min: 5,
    max: 40,
    step: 1
  });

  const compositionFolder =
    pane.addFolder({
      title: "Composition"
    });

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

  pane.addInput(settings, "background", {
    label: "paper"
  });

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
    loadSeedFromUrl
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
  updateSeedInUrl();

  navigator.clipboard.writeText(
    window.location.href
  );
}

function getSeedFromUrl() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );

  return normalizeSeed(
    parameters.get("seed")
  );
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

function updateSeedInUrl() {
  const url =
    new URL(window.location.href);

  url.searchParams.set(
    "seed",
    settings.seed
  );

  history.replaceState(
    null,
    "",
    url
  );
}

function loadSeedFromUrl() {
  settings.seed = getSeedFromUrl();

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

    const length = random(
      family.length[0],
      family.length[1]
    );

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
        )
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
      fillOpacity: random(95, 145),

      strokeColor: null,
      veinColor: null,

      bleed: random(0.07, 0.15),
      texture: random(0.25, 0.48),

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
    const areaA =
      a.length *
      a.width *
      a.scale *
      a.scale;

    const areaB =
      b.length *
      b.width *
      b.scale *
      b.scale;

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
      weight: 0.3,

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
      weight: 0.3,

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
      weight: 0.23,

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
      weight: 0.17,

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

  const value = random();

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

    stemEnd
  };
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
  const placedLeaves = [];

  for (const leaf of leaves) {
    let bestCandidate = null;
    let bestScore = -Infinity;

    for (
      let attempt = 0;
      attempt < CANDIDATES_PER_LEAF;
      attempt++
    ) {
      const x = random(width);
      const y = random(height);

      const flowRotation =
        getFlowRotation(x, y);

      const rotation =
        flowRotation +
        random(
          -settings.rotationJitter,
          settings.rotationJitter
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

function drawStylizedLeaf(leaf) {
  const geometry =
    leaf.geometry;

  /*
   * The only closed shape being drawn is the outer
   * silhouette. No inner wash or fold polygons are
   * drawn, so no extra longitudinal lines appear.
   */
  const outline = [
    ...geometry.rightBorder,

    ...geometry.leftBorder
      .slice()
      .reverse()
  ];

  const outlineWeight =
    0.72 / leaf.scale;

  // Center vein weights.
  const centerTipWeight =
    0.14 / leaf.scale;

  const centerBaseWeight =
    0.68 / leaf.scale;

  // Wider external stem.
  const stemBaseWeight =
   0.4  / leaf.scale;

  const stemEndWeight =
    0.8 / leaf.scale;

  // Side vein weights.
  const sideVeinBaseWeight =
    0.36 / leaf.scale;

  const sideVeinEndWeight =
    0.055 / leaf.scale;

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

  // ----------------------------------------------
  // Wider, tapered external stem
  // ----------------------------------------------

  const stemPoints =
    sampleStraightPath(
      geometry.base,
      geometry.stemEnd,
      14
    );

  /*
   * The stem is widest where it joins the blade,
   * then tapers toward the free endpoint.
   */
  drawTaperedBrushPath(
    stemPoints,
    leaf.veinColor,
    stemBaseWeight,
    stemEndWeight
  );
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

function sampleStraightPath(
  start,
  end,
  resolution
) {
  const points = [];

  for (
    let i = 0;
    i <= resolution;
    i++
  ) {
    const amount =
      i / resolution;

    points.push([
      lerp(
        start[0],
        end[0],
        amount
      ),

      lerp(
        start[1],
        end[1],
        amount
      )
    ]);
  }

  return points;
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
  const colors = [
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
  ];

  return random(colors);
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