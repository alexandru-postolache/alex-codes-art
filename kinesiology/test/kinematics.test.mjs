import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JOINTS, MUSCLES, sidedCoord } from "../js/anatomy.js";
import { schematicMuscles } from "../js/schematic-muscles.js";
import {
  cervicalRotation,
  compensatePelvis,
  forwardKinematics,
  mobilizerTransform,
  mulMatVec,
  mulTransform,
  rad,
  resolveCoordinates,
  transformPoint,
} from "../js/kinematics.js";

const model = JSON.parse(readFileSync(new URL("../data/model.json", import.meta.url)));

function frameInWorld(bodyWorld, frame) {
  return mulTransform(bodyWorld, { R: frame.R, p: frame.p ?? frame.t });
}

test("every joint frame matches the mobilizer, including knee splines", () => {
  const overrides = { knee_angle_r: 1.1, knee_angle_l: 0.4, hip_flexion_r: 0.5 };
  const { world, q } = forwardKinematics(model, overrides);
  assert.ok(Math.abs(q.pelvis_ty - 0.94) < 1e-6);
  assert.ok(Math.abs(q.knee_angle_r_beta - 1.1) < 1e-6);
  for (const joint of model.joints) {
    const parentFrame = frameInWorld(world[joint.parent], joint.parentFrame);
    const childFrame = frameInWorld(world[joint.child], joint.childFrame);
    const predicted = mulTransform(parentFrame, mobilizerTransform(joint, q));
    const gap = Math.hypot(
      childFrame.p[0] - predicted.p[0],
      childFrame.p[1] - predicted.p[1],
      childFrame.p[2] - predicted.p[2],
    );
    assert.ok(gap < 1e-5, `${joint.name} frame gap ${gap}`);
  }
});

test("hip flexion swings the knee forward, and adduction swings it medially", () => {
  const distal = [0, -0.4, 0];
  const neutral = forwardKinematics(model);
  const flexed = forwardKinematics(model, { hip_flexion_r: rad(40), hip_flexion_l: rad(40) });
  const kneeR0 = transformPoint(neutral.world.femur_r, distal);
  const kneeR1 = transformPoint(flexed.world.femur_r, distal);
  const kneeL1 = transformPoint(flexed.world.femur_l, distal);
  assert.ok(kneeR1[0] > kneeR0[0] + 0.05, "right knee should move anteriorly");
  assert.ok(kneeL1[0] > transformPoint(neutral.world.femur_l, distal)[0] + 0.05);

  const adducted = forwardKinematics(model, { hip_adduction_r: rad(20), hip_adduction_l: rad(20) });
  const addR = transformPoint(adducted.world.femur_r, distal);
  const addL = transformPoint(adducted.world.femur_l, distal);
  assert.ok(addR[2] < kneeR0[2] - 0.02, "right knee should move medially, toward -Z");
  assert.ok(addL[2] > transformPoint(neutral.world.femur_l, distal)[2] + 0.02, "left knee should move medially, toward +Z");
});

test("sided coordinates use the OpenSim _r and _l suffixes", () => {
  const hip = JOINTS.find((joint) => joint.id === "hip");
  const trunk = JOINTS.find((joint) => joint.id === "lumbar");
  assert.equal(sidedCoord("hip_flexion", "right", hip), "hip_flexion_r");
  assert.equal(sidedCoord("hip_flexion", "left", hip), "hip_flexion_l");
  assert.equal(sidedCoord("lumbar_extension", "right", trunk), "lumbar_extension");
});

test("every taught muscle has a description and a path", () => {
  const paths = new Set([
    ...model.muscles.map((muscle) => muscle.name.replace(/_(r|l)$/, "")),
    ...schematicMuscles().map((muscle) => muscle.name.replace(/_(r|l)$/, "")),
  ]);
  const ids = new Set();
  for (const joint of JOINTS) {
    for (const dof of joint.dofs || []) {
      for (const item of [...(dof.positiveMuscles || []), ...(dof.negativeMuscles || [])]) ids.add(item.id);
    }
    for (const movement of joint.movements || []) {
      for (const item of movement.muscles) ids.add(item.id);
    }
  }
  for (const id of ids) {
    assert.ok(MUSCLES[id], `missing description for ${id}`);
    assert.ok(paths.has(id), `missing path for ${id}`);
  }
});

test("knee flexion moves the ankle without leaving the femoral joint", () => {
  const straight = forwardKinematics(model);
  const bent = forwardKinematics(model, { knee_angle_r: 1.2 });
  const joint = model.joints.find((item) => item.name === "walker_knee_r");
  const q = resolveCoordinates(model, { knee_angle_r: 1.2 });
  const parentFrame = frameInWorld(bent.world.femur_r, joint.parentFrame);
  const childFrame = frameInWorld(bent.world.tibia_r, joint.childFrame);
  const predicted = mulTransform(parentFrame, mobilizerTransform(joint, q));
  const gap = Math.hypot(
    predicted.p[0] - childFrame.p[0],
    predicted.p[1] - childFrame.p[1],
    predicted.p[2] - childFrame.p[2],
  );
  assert.ok(gap < 1e-5, `knee mobilizer gap ${gap}`);
  const ankle0 = transformPoint(straight.world.tibia_r, [0, -0.4, 0]);
  const ankle1 = transformPoint(bent.world.tibia_r, [0, -0.4, 0]);
  assert.ok(ankle1[0] < ankle0[0] - 0.05, "knee flexion should swing the foot backward");
  assert.ok(ankle1[1] > ankle0[1] + 0.05, "knee flexion should lift the foot");
});

test("pelvis tilt, list, and rotation leave the thighs where the hip sliders put them", () => {
  const pose = {
    pelvis_tilt: rad(18),
    pelvis_list: rad(12),
    pelvis_rotation: rad(16),
    hip_flexion_r: rad(25),
    hip_adduction_l: rad(10),
  };
  const moved = forwardKinematics(model, compensatePelvis(model, pose));
  const legs = forwardKinematics(model, {
    hip_flexion_r: rad(25),
    hip_adduction_l: rad(10),
  });
  const direction = (world, body) => {
    const origin = transformPoint(world[body], [0, 0, 0]);
    const distal = transformPoint(world[body], [0, -0.4, 0]);
    return [distal[0] - origin[0], distal[1] - origin[1], distal[2] - origin[2]];
  };
  for (const body of ["femur_r", "femur_l"]) {
    const a = direction(moved.world, body);
    const b = direction(legs.world, body);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(gap < 1e-4, `${body} direction changed by ${gap}`);
  }
  const tilted = forwardKinematics(model, compensatePelvis(model, { pelvis_tilt: rad(18) }));
  const standing = forwardKinematics(model);
  const knee = [0, -0.4, 0];
  for (const body of ["femur_r", "femur_l"]) {
    const a = transformPoint(tilted.world[body], knee);
    const b = transformPoint(standing.world[body], knee);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(gap < 1e-4, `${body} knee moved ${gap} under pure tilt`);
  }
  const chest = [0.05, 0.3, 0];
  const before = transformPoint(standing.world.torso, chest);
  const after = transformPoint(moved.world.torso, chest);
  const chestGap = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  assert.ok(chestGap > 0.05, "the trunk should turn with the pelvis");
});

test("cervical flexion drops the chin and turns the face with the labeled signs", () => {
  const pivot = [-0.012, 0.47, 0];
  const chin = [0.092, 0.03, 0];
  const flexed = mulMatVec(cervicalRotation(rad(40), 0, 0), chin);
  assert.ok(flexed[1] < chin[1] - 0.03, "positive flexion should drop the chin");
  assert.ok(flexed[0] > 0.05, "the chin should stay anterior");

  const crown = [0, 0.16, 0.02];
  const side = mulMatVec(cervicalRotation(0, rad(30), 0), crown);
  assert.ok(side[2] > crown[2] + 0.03, "positive lateral flexion should tip the head toward the model's right");

  const nose = [0.08, 0.08, 0];
  const turned = mulMatVec(cervicalRotation(0, 0, rad(40)), nose);
  assert.ok(turned[2] < -0.02, "positive rotation should turn the face toward the model's left");
  assert.equal(pivot[1], 0.47);
});
