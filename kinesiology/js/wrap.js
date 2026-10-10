/** Approximate cylinder wrap so muscle lines bow around OpenSim wrap cylinders.
 * The published solver is iterative and quadrant-aware. This is a visual
 * approximation: a string that is pushed onto the cylinder surface.
 */

import { add, invertTransform, mulMatVec, scale, sub, transformPoint, transpose } from "./kinematics.js";

function hypot2(x, y) {
  return Math.hypot(x, y);
}

function bodyPointFromWorld(bodyWorld, worldPoint) {
  return transformPoint(invertTransform(bodyWorld), worldPoint);
}

function toCylinder(local, wrap) {
  return mulMatVec(transpose(wrap.R), sub(local, wrap.t));
}

function fromCylinder(localCyl, wrap) {
  return add(mulMatVec(wrap.R, localCyl), wrap.t);
}

function segmentHitsCylinder(aWorld, bWorld, wrap, bodyWorld) {
  const a = toCylinder(bodyPointFromWorld(bodyWorld, aWorld), wrap);
  const b = toCylinder(bodyPointFromWorld(bodyWorld, bWorld), wrap);
  let best = Infinity;
  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const z = a[2] + (b[2] - a[2]) * t;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    if (Math.abs(z) > wrap.length * 0.5) continue;
    best = Math.min(best, hypot2(x, y));
  }
  return best < wrap.radius * 0.98;
}

function bowSegment(aWorld, bWorld, wrap, bodyWorld) {
  const steps = 14;
  const samples = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    samples.push([
      aWorld[0] + (bWorld[0] - aWorld[0]) * t,
      aWorld[1] + (bWorld[1] - aWorld[1]) * t,
      aWorld[2] + (bWorld[2] - aWorld[2]) * t,
    ]);
  }
  const half = wrap.length * 0.5;
  for (let iter = 0; iter < 8; iter += 1) {
    for (let i = 1; i < samples.length - 1; i += 1) {
      const local = bodyPointFromWorld(bodyWorld, samples[i]);
      const cyl = toCylinder(local, wrap);
      const radial = hypot2(cyl[0], cyl[1]);
      if (Math.abs(cyl[2]) <= half && radial < wrap.radius && radial > 1e-8) {
        const s = wrap.radius / radial;
        const pushed = fromCylinder([cyl[0] * s, cyl[1] * s, cyl[2]], wrap);
        samples[i] = transformPoint(bodyWorld, pushed);
      }
    }
    const copy = samples.map((p) => p.slice());
    for (let i = 1; i < samples.length - 1; i += 1) {
      samples[i] = add(scale(copy[i], 0.5), scale(add(copy[i - 1], copy[i + 1]), 0.25));
    }
  }
  return samples;
}

export function muscleWorldPoints(muscle, world) {
  const anchors = muscle.points.map((point) => transformPoint(world[point.body], point.p));
  if (!muscle.wraps?.length || anchors.length < 2) return anchors;

  let path = anchors;
  for (const wrap of muscle.wraps) {
    const bodyWorld = world[wrap.body];
    if (!bodyWorld) continue;
    let best = -1;
    for (let i = 0; i < path.length - 1; i += 1) {
      if (segmentHitsCylinder(path[i], path[i + 1], wrap, bodyWorld)) {
        best = i;
        break;
      }
    }
    if (best < 0) continue;
    const curved = bowSegment(path[best], path[best + 1], wrap, bodyWorld);
    path = path.slice(0, best).concat(curved, path.slice(best + 2));
  }
  return path;
}
