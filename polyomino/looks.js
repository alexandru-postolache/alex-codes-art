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
    tint: "#f4f7fb",
    refraction: 0.85,
    softness: 0,
    shine: 0.9
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
