/*
  Looks for a polyomino partition.

  The Tweakpane "look" list is built from POLYOMINO_LOOKS.
  Outline draws the ink stroke. Liquid glass fills the same
  rounded regions with RealGlass (explosion-scratch/realglass).
*/

const POLYOMINO_LOOKS = [
  {
    id: "liquidGlass",
    label: "Liquid glass",
    kind: "shader",
    chromaticAberration: 50,
    frosting: 0,
    glassOpacity: 0,
    lightStrength: 0.39,
    edgeSmoothness: 10,
    ior: 1.52,
    borderRadius: 50,
    specularShininess: 2,
    thickness: 2.1,
    tintColor: "#438c98",
    tintStrength: 0.5,
    maskSmoothing: 0.15,
    maskSmoothingInset: 0.1
  },
  {
    id: "outline",
    label: "Outline",
    kind: "stroke"
  }
];

function polyominoLook(id) {
  for (let i = 0; i < POLYOMINO_LOOKS.length; i++) {
    if (POLYOMINO_LOOKS[i].id === id) {
      return POLYOMINO_LOOKS[i];
    }
  }

  return POLYOMINO_LOOKS[0];
}
