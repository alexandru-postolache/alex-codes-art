/** Teaching scapula motion on the Rajagopal torso.
 *
 * The gait model's scapulae are triangles inside hat_ribs_scap.vtp, not a
 * joint. MoBL-ARMS has its own scapula mesh, but that thorax does not match
 * this one and its license is non-commercial. The Seth scapulothoracic joint
 * is an OpenSim ellipsoid plugin, not a mesh. These helpers cut the blades
 * (and the lateral clavicle fragment welded to them) out of this rib cage
 * and move the blades with a small teaching rig. The clavicle stays on
 * the ribs. The lateral fragment is too short to swing on its own without
 * leaving a floating chip at the sternum.
 *
 * Upward rotation spins about the glenoid. Protraction yaws about a vertical
 * axis near the sternum. Elevation is a superior translation. The arm chain
 * takes the same transform so the humeral head stays in the glenoid.
 */

import { invertTransform, mulMatVec, mulTransform, rotAxis, sub } from "./kinematics.js";

export const GLENOID = {
  r: [0.003155, 0.3715, 0.17],
  l: [0.003155, 0.3715, -0.17],
};

/** A point on the upper sternum, used as the protraction pivot. */
export const STERNUM = [0.045, 0.36, 0];

const ARM = ["humerus", "ulna", "radius", "hand"];

function find(parent, index) {
  let root = index;
  while (parent[root] !== root) root = parent[root];
  while (parent[index] !== index) {
    const next = parent[index];
    parent[index] = root;
    index = next;
  }
  return root;
}

function pack(positions, indices, triangles) {
  const remap = new Map();
  const nextPositions = [];
  const nextIndices = [];
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = indices[triangle * 3 + corner];
      let mapped = remap.get(vertex);
      if (mapped == null) {
        mapped = nextPositions.length / 3;
        remap.set(vertex, mapped);
        nextPositions.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
      }
      nextIndices.push(mapped);
    }
  }
  return { positions: nextPositions, indices: nextIndices };
}

/** Split hat_ribs_scap.vtp into ribs plus a right and left scapula. */
export function splitScapulaMesh(mesh) {
  const { positions, indices } = mesh;
  const vertexCount = positions.length / 3;
  const triangleCount = indices.length / 3;
  const parent = new Int32Array(vertexCount);
  parent.fill(-1);
  const candidate = new Uint8Array(triangleCount);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = indices[triangle * 3];
    const b = indices[triangle * 3 + 1];
    const c = indices[triangle * 3 + 2];
    const z = (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3;
    if (Math.abs(z) <= 0.09) continue;
    candidate[triangle] = 1;
    if (parent[a] < 0) parent[a] = a;
    if (parent[b] < 0) parent[b] = b;
    if (parent[c] < 0) parent[c] = c;
    const ra = find(parent, a);
    const rb = find(parent, b);
    const rc = find(parent, c);
    if (ra !== rb) parent[rb] = ra;
    if (ra !== rc) parent[rc] = ra;
  }

  const groups = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    if (!candidate[triangle]) continue;
    const root = find(parent, indices[triangle * 3]);
    let group = groups.get(root);
    if (!group) {
      group = { triangles: [], vertices: new Set() };
      groups.set(root, group);
    }
    group.triangles.push(triangle);
    group.vertices.add(indices[triangle * 3]);
    group.vertices.add(indices[triangle * 3 + 1]);
    group.vertices.add(indices[triangle * 3 + 2]);
  }

  const buckets = { ribs: [], scapula_r: [], scapula_l: [] };
  for (const group of groups.values()) {
    let sumZ = 0;
    for (const vertex of group.vertices) sumZ += positions[vertex * 3 + 2];
    const count = group.vertices.size;
    const meanZ = sumZ / count;
    const side = meanZ >= 0 ? "r" : "l";
    const blade = count > 400 && Math.abs(meanZ) > 0.12;
    buckets[blade ? `scapula_${side}` : "ribs"].push(...group.triangles);
  }
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    if (!candidate[triangle]) buckets.ribs.push(triangle);
  }
  return {
    ribs: pack(positions, indices, buckets.ribs),
    scapula_r: pack(positions, indices, buckets.scapula_r),
    scapula_l: pack(positions, indices, buckets.scapula_l),
  };
}

function aboutPoint(axis, angle, pivot) {
  const rotation = rotAxis(axis, angle);
  return { R: rotation, p: sub(pivot, mulMatVec(rotation, pivot)) };
}

/** Rigid transform of one scapula in the torso frame. Angles are radians, elevation is meters. */
export function scapulaLocal(side, upward = 0, protraction = 0, elevation = 0) {
  const sign = side === "l" || side === "left" ? -1 : 1;
  const key = sign > 0 ? "r" : "l";
  const upwardSpin = aboutPoint([1, 0, 0], -sign * upward, GLENOID[key]);
  const yaw = aboutPoint([0, 1, 0], sign * protraction, STERNUM);
  const lift = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], p: [0, elevation, 0] };
  return mulTransform(lift, mulTransform(yaw, upwardSpin));
}

/** Write scapula poses and carry the humerus, forearm, and hand with the glenoid. */
export function placeScapula(world, motion = {}) {
  for (const side of ["r", "l"]) {
    const value = motion[side] || {};
    const local = scapulaLocal(side, value.upward || 0, value.protraction || 0, value.elevation || 0);
    world[`scapula_${side}`] = mulTransform(world.torso, local);
    const delta = mulTransform(world.torso, mulTransform(local, invertTransform(world.torso)));
    for (const name of ARM) {
      const body = `${name}_${side}`;
      if (world[body]) world[body] = mulTransform(delta, world[body]);
    }
  }
  return world;
}
