/** OpenSim custom-joint kinematics for the Rajagopal model. Pure functions. */

export function transpose(r) {
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}

export function mulMat(a, b) {
  const o = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      o[row * 3 + col] =
        a[row * 3] * b[col] +
        a[row * 3 + 1] * b[3 + col] +
        a[row * 3 + 2] * b[6 + col];
    }
  }
  return o;
}

export function mulMatVec(r, v) {
  return [
    r[0] * v[0] + r[1] * v[1] + r[2] * v[2],
    r[3] * v[0] + r[4] * v[1] + r[5] * v[2],
    r[6] * v[0] + r[7] * v[1] + r[8] * v[2],
  ];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export const IDENTITY = {
  R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  p: [0, 0, 0],
};

export function mulTransform(a, b) {
  return {
    R: mulMat(a.R, b.R),
    p: add(mulMatVec(a.R, b.p), a.p),
  };
}

export function invertTransform(t) {
  const r = transpose(t.R);
  return { R: r, p: mulMatVec(r, scale(t.p, -1)) };
}

export function transformPoint(t, p) {
  return add(mulMatVec(t.R, p), t.p);
}

export function rotAxis(axis, angle) {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const x = axis[0] / len;
  const y = axis[1] / len;
  const z = axis[2] / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}

function evalSpline(segments, x) {
  const first = segments[0];
  if (x <= first.x0) return first.a;
  const last = segments[segments.length - 1];
  if (x >= last.x1) {
    const dt = last.x1 - last.x0;
    return last.a + dt * (last.b + dt * (last.c + dt * last.d));
  }
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (x <= seg.x1) {
      const dt = x - seg.x0;
      return seg.a + dt * (seg.b + dt * (seg.c + dt * seg.d));
    }
  }
  return last.a;
}

export function evalAxis(fn, q) {
  if (fn.type === "constant") return fn.value;
  const value = q[fn.coord] ?? 0;
  if (fn.type === "linear") return fn.slope * value + fn.intercept;
  if (fn.type === "spline") return evalSpline(fn.segments, value);
  throw new Error(`Unknown function ${fn.type}`);
}

/** Mobilizer transform of frame M in frame F. Rotations are space-fixed in F. */
export function mobilizerTransform(joint, q) {
  let rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const translation = [0, 0, 0];
  const rotations = [];
  for (const axis of joint.axes) {
    const amount = evalAxis(axis.fn, q);
    if (axis.kind === "rotation") rotations.push(rotAxis(axis.axis, amount));
    else {
      translation[0] += amount * axis.axis[0];
      translation[1] += amount * axis.axis[1];
      translation[2] += amount * axis.axis[2];
    }
  }
  // R = R1 * R2 * R3, matching Simbody FunctionBasedMobilizer.
  for (let i = rotations.length - 1; i >= 0; i -= 1) {
    rotation = mulMat(rotations[i], rotation);
  }
  return { R: rotation, p: translation };
}

export function resolveCoordinates(model, overrides = {}) {
  const q = {};
  for (const coord of model.coordinates) q[coord.name] = coord.default;
  Object.assign(q, overrides);
  for (const coupler of model.couplers) {
    q[coupler.dependent] = coupler.slope * (q[coupler.independent] ?? 0) + coupler.intercept;
  }
  return q;
}

export function forwardKinematics(model, overrides = {}) {
  const q = resolveCoordinates(model, overrides);
  const world = { ground: IDENTITY };
  for (const joint of model.joints) {
    const parent = world[joint.parent];
    if (!parent) throw new Error(`Missing parent ${joint.parent} for ${joint.name}`);
    const mobilizer = mobilizerTransform(joint, q);
    const parentFrame = { R: joint.parentFrame.R, p: joint.parentFrame.p ?? joint.parentFrame.t };
    const childFrame = { R: joint.childFrame.R, p: joint.childFrame.p ?? joint.childFrame.t };
    const childFromParent = mulTransform(
      mulTransform(parentFrame, mobilizer),
      invertTransform(childFrame),
    );
    world[joint.child] = mulTransform(parent, childFromParent);
  }
  return { q, world };
}

/** Teaching neck rotation in the torso frame. Positive flexion nods the chin down. */
export function cervicalRotation(flex, lateral, rotation) {
  return mulMat(
    rotAxis([0, 0, -1], flex),
    mulMat(rotAxis([1, 0, 0], lateral), rotAxis([0, 1, 0], rotation)),
  );
}

export function deg(rad) {
  return (rad * 180) / Math.PI;
}

export function rad(degrees) {
  return (degrees * Math.PI) / 180;
}
