/** Teaching paths for muscles the Rajagopal gait model does not include.
 * Right-side points are mirrored in Z for the left side. Limb frames in this
 * model are mirrored that way; torso landmarks are mirrored in the same step.
 */

const RIGHT = [
  ["deltoid_ant", "torso", [0.03, 0.39, 0.145], "humerus_r", [0.014, -0.12, 0.01]],
  ["deltoid_mid", "torso", [0.0, 0.405, 0.165], "humerus_r", [0.0, -0.13, 0.02]],
  ["deltoid_post", "torso", [-0.025, 0.385, 0.15], "humerus_r", [-0.01, -0.12, 0.008]],
  ["supraspinatus", "torso", [-0.005, 0.4, 0.11], "humerus_r", [0.002, -0.02, 0.02]],
  ["infraspinatus", "torso", [-0.04, 0.35, 0.125], "humerus_r", [-0.004, -0.035, 0.016]],
  ["subscapularis", "torso", [0.015, 0.35, 0.105], "humerus_r", [0.012, -0.025, -0.008]],
  ["teres_minor", "torso", [-0.035, 0.31, 0.145], "humerus_r", [-0.004, -0.045, 0.012]],
  ["teres_major", "torso", [-0.02, 0.27, 0.135], "humerus_r", [0.012, -0.055, -0.01]],
  ["pec_major", "torso", [0.075, 0.3, 0.03], "torso", [0.04, 0.33, 0.12], "humerus_r", [0.012, -0.05, 0.0]],
  ["latissimus", "torso", [-0.03, 0.14, 0.06], "torso", [0.0, 0.24, 0.13], "humerus_r", [0.01, -0.05, -0.012]],
  ["coracobrachialis", "torso", [0.025, 0.36, 0.135], "humerus_r", [0.01, -0.14, -0.006]],
  ["biceps", "torso", [0.015, 0.375, 0.15], "humerus_r", [0.012, -0.16, 0.004], "radius_r", [0.002, -0.035, 0.02]],
  ["brachialis", "humerus_r", [0.012, -0.18, 0.0], "ulna_r", [-0.012, -0.035, 0.008]],
  ["triceps_long", "torso", [-0.005, 0.355, 0.15], "humerus_r", [-0.01, -0.16, 0.0], "ulna_r", [-0.028, 0.006, 0.012]],
  ["triceps_lat", "humerus_r", [-0.006, -0.08, 0.014], "ulna_r", [-0.026, 0.004, 0.01]],
  ["brachioradialis", "humerus_r", [0.0, -0.22, 0.02], "radius_r", [0.0, -0.21, 0.028]],
  ["pronator_teres", "humerus_r", [0.006, -0.27, -0.02], "radius_r", [0.004, -0.11, 0.02]],
  ["supinator", "ulna_r", [-0.016, -0.04, 0.02], "radius_r", [-0.004, -0.045, 0.016]],
  ["fcr", "humerus_r", [0.008, -0.272, -0.018], "hand_r", [0.016, -0.045, 0.02]],
  ["fcu", "humerus_r", [0.006, -0.272, -0.022], "hand_r", [0.012, -0.035, -0.032]],
  ["ecrl", "humerus_r", [0.0, -0.268, 0.022], "hand_r", [-0.008, -0.05, 0.02]],
  ["ecu", "humerus_r", [-0.002, -0.268, 0.016], "hand_r", [-0.006, -0.04, -0.03]],
  ["edc", "humerus_r", [0.0, -0.265, 0.018], "hand_r", [-0.006, -0.09, 0.0]],
  ["fds", "humerus_r", [0.008, -0.27, -0.016], "hand_r", [0.014, -0.1, 0.0]],
  ["upper_trap", "skull", [-0.02, 0.58, 0.04], "torso", [-0.015, 0.39, 0.145]],
  ["mid_trap", "torso", [-0.045, 0.34, 0.02], "torso", [-0.03, 0.35, 0.14]],
  ["lower_trap", "torso", [-0.04, 0.18, 0.02], "torso", [-0.02, 0.36, 0.13]],
  ["levator", "torso", [-0.02, 0.48, 0.035], "torso", [-0.015, 0.38, 0.12]],
  ["rhomboid", "torso", [-0.04, 0.32, 0.025], "torso", [-0.025, 0.33, 0.105]],
  ["serratus", "torso", [0.07, 0.26, 0.12], "torso", [0.01, 0.32, 0.13]],
  ["scm", "torso", [0.06, 0.3, 0.02], "skull", [-0.02, 0.57, 0.055]],
  ["erector", "torso", [-0.05, 0.08, 0.03], "torso", [-0.04, 0.4, 0.025]],
];

function mirrorBody(name) {
  return name.endsWith("_r") ? `${name.slice(0, -2)}_l` : name;
}

function expand(entry) {
  const [name, ...rest] = entry;
  const points = [];
  for (let i = 0; i < rest.length; i += 2) {
    points.push({ body: rest[i], p: rest[i + 1] });
  }
  return { name, points, wraps: [], source: "schematic" };
}

export function schematicMuscles() {
  const muscles = [];
  for (const entry of RIGHT) {
    const right = expand(entry);
    muscles.push({ ...right, name: `${right.name}_r` });
    muscles.push({
      name: `${right.name}_l`,
      source: "schematic",
      wraps: [],
      points: right.points.map((point) => ({
        body: mirrorBody(point.body),
        p: [point.p[0], point.p[1], -point.p[2]],
      })),
    });
  }
  return muscles;
}
