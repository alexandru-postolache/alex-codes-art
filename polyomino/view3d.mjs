import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ISOMETRIC = new THREE.Vector3(1, 1, 1);
const FRUSTUM = 8;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
  -FRUSTUM,
  FRUSTUM,
  FRUSTUM,
  -FRUSTUM,
  0.1,
  400
);
const pieces = new THREE.Group();

scene.add(pieces);
scene.add(new THREE.AmbientLight(0xffffff, 0.74));

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(7, 11, 5);
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.38);
fillLight.position.set(-6, 4, -5);
scene.add(fillLight);

let renderer = null;
let controls = null;
let failed = false;
let viewWidth = 0;
let viewHeight = 0;
let frameId = 0;
let fitting = false;

const view = {
  get available() {
    return !failed;
  },

  canvas() {
    return renderer ? renderer.domElement : null;
  },

  setVisible(visible) {
    if (!ensureRenderer()) {
      return;
    }

    renderer.domElement.hidden = !visible;

    if (visible) {
      startLoop();
      return;
    }

    stopLoop();
  },

  resize(width, height) {
    if (!ensureRenderer()) {
      return;
    }

    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));

    if (nextWidth === viewWidth && nextHeight === viewHeight) {
      return;
    }

    viewWidth = nextWidth;
    viewHeight = nextHeight;

    const aspect = nextWidth / nextHeight;
    camera.left = -FRUSTUM * aspect;
    camera.right = FRUSTUM * aspect;
    camera.top = FRUSTUM;
    camera.bottom = -FRUSTUM;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(nextWidth, nextHeight, false);
  },

  show(model, options) {
    if (!ensureRenderer()) {
      return;
    }

    const entering = options && options.entering;
    const refit = options && options.refit;

    scene.background = new THREE.Color(model.background || "#eeeae1");
    rebuildPieces(model.pieces || []);

    if (entering) {
      fitCamera(ISOMETRIC);
    } else if (refit) {
      fitCamera(camera.position.clone().sub(controls.target));
    }
  },

  render() {
    if (!renderer) {
      return;
    }

    controls.update();
    renderer.render(scene, camera);
  },

  aim() {
    if (!renderer) {
      return null;
    }

    return {
      zoom: camera.zoom,
      position: camera.position.toArray(),
      target: controls.target.toArray()
    };
  }
};

function ensureRenderer() {
  if (renderer) {
    return true;
  }

  if (failed) {
    return false;
  }

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
  } catch (error) {
    failed = true;
    console.error(error);
    return false;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.id = "view3d";
  renderer.domElement.hidden = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.05;
  controls.minZoom = 0.08;
  controls.maxZoom = 14;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);
  camera.position.set(12, 12, 12);
  camera.lookAt(controls.target);
  return true;
}

function startLoop() {
  if (frameId) {
    return;
  }

  const tick = () => {
    frameId = requestAnimationFrame(tick);
    view.render();
  };

  frameId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (!frameId) {
    return;
  }

  cancelAnimationFrame(frameId);
  frameId = 0;
}

function rebuildPieces(models) {
  disposeGroup(pieces);
  pieces.clear();

  for (const model of models) {
    const piece = new THREE.Group();
    piece.position.set(model.x || 0, 0, model.z || 0);

    for (const region of model.regions || []) {
      const mesh = regionMesh(region);

      if (mesh) {
        piece.add(mesh);
      }
    }

    pieces.add(piece);
  }
}

function regionMesh(region) {
  const outer = region.outer || [];

  if (outer.length < 3) {
    return null;
  }

  try {
    const shape = new THREE.Shape();
    writeLoop(shape, outer, false);

    for (const hole of region.holes || []) {
      if (hole.length < 3) {
        continue;
      }

      const path = new THREE.Path();
      writeLoop(path, hole, true);
      shape.holes.push(path);
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.08, region.height || 0.3),
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 1
    });
    const material = new THREE.MeshStandardMaterial({
      color: region.color || "#888888",
      roughness: 0.78,
      metalness: 0.02
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function writeLoop(path, points, clockwise) {
  const ordered = points.map((point) => ({
    x: point.x,
    y: -point.y
  }));
  const positive = signedArea(ordered) > 0;

  if (positive === clockwise) {
    ordered.reverse();
  }

  path.moveTo(ordered[0].x, ordered[0].y);

  for (let index = 1; index < ordered.length; index++) {
    path.lineTo(ordered[index].x, ordered[index].y);
  }
}

function signedArea(points) {
  let sum = 0;

  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    sum += points[index].x * next.y - next.x * points[index].y;
  }

  return sum;
}

function fitCamera(direction) {
  const box = new THREE.Box3().setFromObject(pieces);

  if (box.isEmpty()) {
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(
    0.5,
    Math.hypot(size.x, size.z) * 0.78 + size.y * 0.62
  );
  const vertical = camera.top - camera.bottom;
  const horizontal = camera.right - camera.left;
  const zoom = Math.min(vertical, horizontal) / span;
  const offset = direction.clone();

  if (offset.lengthSq() < 0.0001) {
    offset.copy(ISOMETRIC);
  }

  offset.normalize().multiplyScalar(36);
  fitting = true;
  controls.target.copy(center);
  camera.position.copy(center).add(offset);
  camera.zoom = THREE.MathUtils.clamp(
    zoom,
    controls.minZoom,
    controls.maxZoom
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.update();
  fitting = false;
}

function disposeGroup(group) {
  group.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (!object.material) {
      return;
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      material.dispose();
    }
  });
}

window.PolyominoView = view;
