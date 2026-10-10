import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  add,
  cervicalRotation,
  forwardKinematics,
  mulMatVec,
  rotAxis,
  scale,
  sub,
  transformPoint,
} from "./kinematics.js";
import { muscleWorldPoints } from "./wrap.js";

const BONE = new THREE.Color("#e7d3b4");
const BONE_DIM = new THREE.Color("#b7a48a");

const FINGER_CHAINS = {
  r: [
    ["metacarpal2_rvs.vtp", "index_proximal_rvs.vtp", "index_medial_rvs.vtp", "index_distal_rvs.vtp"],
    ["metacarpal3_rvs.vtp", "middle_proximal_rvs.vtp", "middle_medial_rvs.vtp", "middle_distal_rvs.vtp"],
    ["metacarpal4_rvs.vtp", "ring_proximal_rvs.vtp", "ring_medial_rvs.vtp", "ring_distal_rvs.vtp"],
    ["metacarpal5_rvs.vtp", "little_proximal_rvs.vtp", "little_medial_rvs.vtp", "little_distal_rvs.vtp"],
  ],
  l: [
    ["metacarpal2_lvs.vtp", "index_proximal_lvs.vtp", "index_medial_lvs.vtp", "index_distal_lvs.vtp"],
    ["metacarpal3_lvs.vtp", "middle_proximal_lvs.vtp", "middle_medial_lvs.vtp", "middle_distal_lvs.vtp"],
    ["metacarpal4_lvs.vtp", "ring_proximal_lvs.vtp", "ring_medial_lvs.vtp", "ring_distal_lvs.vtp"],
    ["metacarpal5_lvs.vtp", "little_proximal_lvs.vtp", "little_medial_lvs.vtp", "little_distal_lvs.vtp"],
  ],
};

const THUMB_CHAINS = {
  r: ["metacarpal1_rvs.vtp", "thumb_proximal_rvs.vtp", "thumb_distal_rvs.vtp"],
  l: ["metacarpal1_lvs.vtp", "thumb_proximal_lvs.vtp", "thumb_distal_lvs.vtp"],
};

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function orthogonal(t) {
  const hint = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(t, hint));
}

function tubeGeometry(points, radius) {
  const cleaned = [];
  for (const point of points) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2]) > 0.0015) {
      cleaned.push(point);
    }
  }
  if (cleaned.length < 2) return null;
  const tangents = cleaned.map((point, index) => {
    const next = cleaned[Math.min(index + 1, cleaned.length - 1)];
    const prev = cleaned[Math.max(index - 1, 0)];
    return normalize(sub(next, prev));
  });
  let normal = orthogonal(tangents[0]);
  const frames = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const tangent = tangents[i];
    normal = sub(normal, scale(tangent, dot(normal, tangent)));
    const nLen = Math.hypot(normal[0], normal[1], normal[2]);
    normal = nLen > 1e-6 ? scale(normal, 1 / nLen) : orthogonal(tangent);
    frames.push({ normal, binormal: cross(tangent, normal), point: cleaned[i] });
    const upcoming = tangents[Math.min(i + 1, tangents.length - 1)];
    const axis = cross(tangent, upcoming);
    const sin = Math.hypot(axis[0], axis[1], axis[2]);
    const cos = Math.max(-1, Math.min(1, dot(tangent, upcoming)));
    if (sin > 1e-5) normal = mulMatVec(rotAxis(scale(axis, 1 / sin), Math.atan2(sin, cos)), normal);
  }
  const sides = 7;
  const positions = [];
  const normals = [];
  const indices = [];
  frames.forEach((frame) => {
    for (let s = 0; s < sides; s += 1) {
      const angle = (s / sides) * Math.PI * 2;
      const cx = Math.cos(angle);
      const sy = Math.sin(angle);
      const nx = cx * frame.normal[0] + sy * frame.binormal[0];
      const ny = cx * frame.normal[1] + sy * frame.binormal[1];
      const nz = cx * frame.normal[2] + sy * frame.binormal[2];
      normals.push(nx, ny, nz);
      positions.push(
        frame.point[0] + radius * nx,
        frame.point[1] + radius * ny,
        frame.point[2] + radius * nz,
      );
    }
  });
  for (let i = 0; i < frames.length - 1; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const s2 = (s + 1) % sides;
      const a = i * sides + s;
      const b = i * sides + s2;
      const c = (i + 1) * sides + s;
      const d = (i + 1) * sides + s2;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function matrixFromTransform(transform) {
  const r = transform.R;
  const p = transform.p;
  const matrix = new THREE.Matrix4();
  matrix.set(
    r[0], r[1], r[2], p[0],
    r[3], r[4], r[5], p[1],
    r[6], r[7], r[8], p[2],
    0, 0, 0, 1,
  );
  return matrix;
}

function geometryFromMesh(mesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function boxCenter(box) {
  return new THREE.Vector3(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  );
}

function closestOnBox(box, point) {
  return new THREE.Vector3(
    Math.min(box.max.x, Math.max(box.min.x, point.x)),
    Math.min(box.max.y, Math.max(box.min.y, point.y)),
    Math.min(box.max.z, Math.max(box.min.z, point.z)),
  );
}

function jointPivot(parentBox, childBox) {
  const parentCenter = boxCenter(parentBox);
  const childCenter = boxCenter(childBox);
  const onParent = closestOnBox(parentBox, childCenter);
  const onChild = closestOnBox(childBox, parentCenter);
  return onParent.add(onChild).multiplyScalar(0.5);
}

export function createViewer(container, model, meshData) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#14120f", 6.5, 12);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
  camera.position.set(1.55, 1.15, 2.35);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.0, 0.92, 0);
  controls.enableDamping = true;
  controls.maxDistance = 6;
  controls.minDistance = 0.4;
  controls.update();

  scene.add(new THREE.HemisphereLight("#f4efe4", "#3a332c", 0.85));
  const key = new THREE.DirectionalLight("#fff4e4", 2.1);
  key.position.set(1.6, 3.2, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 8;
  key.shadow.camera.left = -1.6;
  key.shadow.camera.right = 1.6;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -0.2;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#c9d7e8", 0.55);
  fill.position.set(-2.2, 1.4, -1.2);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 80),
    new THREE.MeshStandardMaterial({ color: "#1c1916", roughness: 1, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.42, 1.5, 80),
    new THREE.MeshBasicMaterial({ color: "#3a322a", side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  scene.add(ring);

  const root = new THREE.Group();
  scene.add(root);
  const bodies = {};
  const boneMaterials = [];
  const geometries = {};
  for (const [name, mesh] of Object.entries(meshData)) {
    geometries[name] = geometryFromMesh(mesh);
  }

  const neck = {
    pivot: new THREE.Vector3(-0.012, 0.47, 0),
    group: new THREE.Group(),
  };

  function boneMaterial() {
    const material = new THREE.MeshStandardMaterial({
      color: BONE.clone(),
      roughness: 0.62,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    boneMaterials.push(material);
    return material;
  }

  function addBoneMesh(parent, geometry, position, bodyName) {
    const mesh = new THREE.Mesh(geometry, boneMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    mesh.userData.body = bodyName;
    parent.add(mesh);
    return mesh;
  }

  for (const body of model.bodies) {
    const group = new THREE.Group();
    group.name = body.name;
    group.matrixAutoUpdate = false;
    root.add(group);
    bodies[body.name] = group;
    const fingerFiles = new Set(
      body.name.endsWith("_r") || body.name.endsWith("_l")
        ? [...(FINGER_CHAINS[body.name.endsWith("_r") ? "r" : "l"] || []).flat(), ...(THUMB_CHAINS[body.name.endsWith("_r") ? "r" : "l"] || [])]
        : [],
    );
    for (const file of body.meshes) {
      const geometry = geometries[file];
      if (!geometry) continue;
      if (body.name === "torso" && (file === "hat_skull.vtp" || file === "hat_jaw.vtp")) {
        continue;
      }
      if (body.name.startsWith("hand_") && fingerFiles.has(file)) continue;
      addBoneMesh(group, geometry, new THREE.Vector3(), body.name);
    }
  }

  const torso = bodies.torso;
  neck.group.position.copy(neck.pivot);
  torso.add(neck.group);
  const skullHolder = new THREE.Group();
  skullHolder.position.copy(neck.pivot).multiplyScalar(-1);
  neck.group.add(skullHolder);
  for (const file of ["hat_skull.vtp", "hat_jaw.vtp"]) {
    addBoneMesh(skullHolder, geometries[file], new THREE.Vector3(), "skull");
  }

  const fingerJoints = { r: [], l: [] };
  const thumbJoints = { r: [], l: [] };

  function buildChain(handName, files, store, axisForLink) {
    const hand = bodies[handName];
    const side = handName.endsWith("_r") ? "r" : "l";
    let parent = hand;
    let parentPivot = null;
    files.forEach((file, index) => {
      if (index === 0) return;
      const parentBox = geometries[files[index - 1]].boundingBox;
      const childBox = geometries[file].boundingBox;
      const pivot = jointPivot(parentBox, childBox);
      const joint = new THREE.Group();
      if (parentPivot) joint.position.copy(pivot).sub(parentPivot);
      else joint.position.copy(pivot);
      parent.add(joint);
      const holder = new THREE.Group();
      holder.position.copy(pivot).multiplyScalar(-1);
      joint.add(holder);
      addBoneMesh(holder, geometries[file], new THREE.Vector3(), handName);
      const axis = axisForLink(files[index - 1], file, side);
      store[side].push({ joint, axis, depth: index });
      parent = joint;
      parentPivot = pivot;
    });
    // Metacarpal stays on the hand, unmoved.
    addBoneMesh(hand, geometries[files[0]], new THREE.Vector3(), handName);
  }

  for (const side of ["r", "l"]) {
    const handName = side === "r" ? "hand_r" : "hand_l";
    for (const chain of FINGER_CHAINS[side]) {
      buildChain(handName, chain, fingerJoints, () => new THREE.Vector3(0, 0, 1));
    }
    buildChain(handName, THUMB_CHAINS[side], thumbJoints, (parentFile, childFile) => {
      const a = boxCenter(geometries[parentFile].boundingBox);
      const b = boxCenter(geometries[childFile].boundingBox);
      const boneDir = b.clone().sub(a).normalize();
      const palmar = new THREE.Vector3(1, 0, 0);
      const axis = new THREE.Vector3().crossVectors(boneDir, palmar).normalize();
      // Positive curl should move the thumb toward the palm (+X).
      const trial = boneDir.clone().applyAxisAngle(axis, 0.4);
      if (trial.x < boneDir.x) axis.multiplyScalar(-1);
      return axis;
    });
  }

  const muscleGroup = new THREE.Group();
  scene.add(muscleGroup);
  const muscleMaterial = (source) => new THREE.MeshStandardMaterial({
    color: source === "schematic" ? "#c46a45" : "#8d3030",
    roughness: 0.48,
    metalness: 0.0,
    emissive: "#000000",
    emissiveIntensity: 0.6,
  });

  const axisGroup = new THREE.Group();
  scene.add(axisGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pickHandler = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!pickHandler || event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    const hit = hits.find((item) => item.object.userData.body);
    if (hit) pickHandler(hit.object.userData.body);
  });

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  function setPose(world, extras, groundOffset) {
    for (const [name, group] of Object.entries(bodies)) {
      if (!world[name]) continue;
      group.matrix.copy(matrixFromTransform(world[name]));
      group.matrixWorldNeedsUpdate = true;
    }
    root.position.y = groundOffset || 0;
    const neckR = cervicalRotation(
      extras.cervical_flexion || 0,
      extras.cervical_lateral || 0,
      extras.cervical_rotation || 0,
    );
    const neckMatrix = new THREE.Matrix4().set(
      neckR[0], neckR[1], neckR[2], 0,
      neckR[3], neckR[4], neckR[5], 0,
      neckR[6], neckR[7], neckR[8], 0,
      0, 0, 0, 1,
    );
    neck.group.quaternion.setFromRotationMatrix(neckMatrix);

    const curl = extras.finger_curl || 0;
    for (const entry of [...fingerJoints.r, ...fingerJoints.l]) {
      const scaleByDepth = entry.depth === 1 ? 1 : entry.depth === 2 ? 1.1 : 1;
      entry.joint.quaternion.setFromAxisAngle(entry.axis, curl * scaleByDepth);
    }
    const thumb = extras.thumb_flexion || 0;
    for (const entry of [...thumbJoints.r, ...thumbJoints.l]) {
      entry.joint.quaternion.setFromAxisAngle(entry.axis, thumb);
    }
  }

  function setMuscles(muscles, roles, visible) {
    while (muscleGroup.children.length) {
      const child = muscleGroup.children.pop();
      child.geometry?.dispose();
      child.material?.dispose();
    }
    if (!visible) return;
    for (const muscle of muscles) {
      const base = muscle.name.replace(/_(r|l)$/, "");
      const role = roles[base];
      if (!role) continue;
      const points = muscleWorldPoints(muscle, lastWorld);
      const radius = role === "prime" ? 0.009 : role === "synergist" ? 0.0065 : 0.0045;
      const geometry = tubeGeometry(points, radius);
      if (!geometry) continue;
      const material = muscleMaterial(muscle.source);
      if (role === "prime") {
        material.color.set(muscle.source === "schematic" ? "#ff7a45" : "#e23b32");
        material.emissive.set("#5a140c");
      } else if (role === "synergist") {
        material.color.set("#e0a15a");
        material.emissive.set("#4a2d0c");
      } else if (role === "context") {
        material.color.set(muscle.source === "schematic" ? "#8a5644" : "#6d3836");
        material.transparent = true;
        material.opacity = 0.28;
        material.depthWrite = false;
      } else {
        material.color.set("#7fa8c4");
        material.emissive.set("#10202c");
        material.transparent = true;
        material.opacity = 0.55;
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = root.position.y;
      muscleGroup.add(mesh);
    }
  }

  let lastWorld = null;

  function setBonesDimmed(dim) {
    for (const material of boneMaterials) {
      material.color.copy(dim ? BONE_DIM : BONE);
      material.emissive.set("#000000");
    }
  }

  function highlightBodies(names) {
    const wanted = new Set(names);
    for (const group of Object.values(bodies)) {
      group.traverse((obj) => {
        if (!obj.isMesh) return;
        const on = wanted.size === 0 || wanted.has(obj.userData.body);
        obj.material.emissive.set(on && wanted.size ? "#4a2a16" : "#000000");
        obj.material.emissiveIntensity = on && wanted.size ? 0.35 : 0;
      });
    }
  }

  function setAxis(worldPoint, axisDir, color) {
    while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);
    if (!worldPoint || !axisDir) return;
    const origin = new THREE.Vector3(worldPoint[0], worldPoint[1] + root.position.y, worldPoint[2]);
    const dir = new THREE.Vector3(axisDir[0], axisDir[1], axisDir[2]).normalize();
    const arrow = new THREE.ArrowHelper(dir, origin, 0.18, color, 0.035, 0.02);
    axisGroup.add(arrow);
  }

  function lowestSole(world) {
    let minY = Infinity;
    for (const sole of model.solePoints) {
      const body = world[sole.body];
      if (!body) continue;
      const y = body.R[3] * sole.p[0] + body.R[4] * sole.p[1] + body.R[5] * sole.p[2] + body.p[1];
      if (y < minY) minY = y;
    }
    return minY;
  }

  // Plant the standing pose once. Later joint motion must not drop the body
  // to chase whichever sole point is lowest.
  const standingOffset = -lowestSole(forwardKinematics(model).world);

  return {
    resize,
    setPickHandler(handler) {
      pickHandler = handler;
    },
    lookAt(part, world, side = "r") {
      const shots = {
        pelvis: { body: "pelvis", local: [0, 0.05, 0], eye: [1.35, 0.35, 1.7] },
        hip: { body: `femur_${side}`, local: [0, -0.05, 0], eye: [1.05, 0.28, 1.25] },
        knee: { body: `tibia_${side}`, local: [0, 0.18, 0], eye: [0.85, 0.12, 0.95] },
        ankle: { body: `calcn_${side}`, local: [0.07, 0.03, 0], eye: [0.22, 0.16, 0.72] },
        shoulder: { body: `humerus_${side}`, local: [0, -0.02, 0], eye: [0.85, 0.22, 1.05] },
        neck: { body: "torso", local: [-0.01, 0.56, 0], eye: [0.22, 0.02, 0.88], mirror: false },
        hand: { body: `hand_${side}`, local: [0.01, -0.04, 0], eye: [0.06, 0.05, 0.42] },
      };
      const shot = shots[part] || shots.pelvis;
      const lift = world ? standingOffset : 0;
      const target = world?.[shot.body]
        ? transformPoint(world[shot.body], shot.local)
        : [0, 0.95, 0];
      const zSign = shot.mirror === false || side === "r" ? 1 : -1;
      controls.target.set(target[0], target[1] + lift, target[2]);
      camera.position.set(
        target[0] + shot.eye[0],
        target[1] + lift + shot.eye[1],
        target[2] + shot.eye[2] * zSign,
      );
    },
    update({ world, muscles, roles, showMuscles, showBones, extras, ground, axis }) {
      lastWorld = world;
      root.visible = showBones;
      const offset = ground ? standingOffset : 0;
      setPose(world, extras, offset);
      setBonesDimmed(showMuscles);
      setMuscles(muscles, roles, showMuscles);
      highlightBodies(axis?.bodies || []);
      setAxis(axis?.origin, axis?.direction, axis?.color || "#f2c14e");
    },
    dispose() {
      running = false;
      observer.disconnect();
      renderer.dispose();
    },
  };
}

export function jointAxisWorld(world, joint, axis) {
  const parent = world[joint.parent];
  const frameR = joint.parentFrame.R;
  const frameP = joint.parentFrame.p;
  const origin = add(mulMatVec(parent.R, add(mulMatVec(frameR, [0, 0, 0]), frameP)), parent.p);
  const direction = mulMatVec(parent.R, mulMatVec(frameR, axis));
  return { origin, direction };
}
