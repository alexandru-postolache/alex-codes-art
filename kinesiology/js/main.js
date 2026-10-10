import { JOINTS, MODEL_CHANGES, MUSCLES, PATTERNS, REGIONS, muscleBase, sidedCoord } from "./anatomy.js";
import { cervicalRotation, compensatePelvis, deg, forwardKinematics, mulMatVec, mulTransform, rad, transformPoint } from "./kinematics.js";
import { schematicMuscles } from "./schematic-muscles.js";
import { createViewer, jointAxisWorld } from "./viewer.js";

const TEACHING = new Set(["cervical_flexion", "cervical_lateral", "cervical_rotation", "finger_curl", "thumb_flexion"]);

const state = {
  side: "right",
  mirror: true,
  showBones: true,
  showMuscles: true,
  showAllMuscles: false,
  jointId: "hip",
  dofId: "hip_flexion",
  lessonName: null,
  pose: {},
  extras: {
    cervical_flexion: 0,
    cervical_lateral: 0,
    cervical_rotation: 0,
    finger_curl: 0,
    thumb_flexion: 0,
  },
  detailId: null,
  playing: false,
  playDir: 1,
};

const libraryEl = document.querySelector("#library");
const detailEl = document.querySelector("#detail");
const readoutEl = document.querySelector("#readout");
const stageEl = document.querySelector("#viewport");

let viewer;
let model;
let muscles = [];
let playPhase = 0;

function jointById(id) {
  return JOINTS.find((joint) => joint.id === id);
}

function activeJoint() {
  return jointById(state.jointId);
}

function activeDof() {
  const joint = activeJoint();
  return joint?.dofs?.find((dof) => dof.id === state.dofId) || null;
}

function coordRecord(name) {
  return model.coordinates.find((coord) => coord.name === name);
}

function limits(dof, joint) {
  if (dof.kind === "coupled" || joint.kind === "teaching" || TEACHING.has(dof.id)) {
    return { min: dof.uiMin, max: dof.uiMax };
  }
  const sample = coordRecord(sidedCoord(dof.id, "r", joint)) || coordRecord(dof.id);
  let min = deg(sample.min);
  let max = deg(sample.max);
  if (dof.uiMin != null) min = Math.max(min, dof.uiMin);
  if (dof.uiMax != null) max = Math.min(max, dof.uiMax);
  return { min, max };
}

function currentDegrees(dof, joint) {
  if (TEACHING.has(dof.id)) return deg(state.extras[dof.id] || 0);
  const name = sidedCoord(dof.id, state.side, joint);
  if (state.pose[name] != null) return deg(state.pose[name]);
  const record = coordRecord(name) || coordRecord(dof.id);
  return deg(record?.default ?? 0);
}

function setDegrees(dof, joint, degrees) {
  const { min, max } = limits(dof, joint);
  const clamped = Math.min(max, Math.max(min, degrees));
  const value = rad(clamped);
  if (TEACHING.has(dof.id)) {
    state.extras[dof.id] = value;
    return;
  }
  const names = [sidedCoord(dof.id, state.side, joint)];
  if (state.mirror && joint.sided) names.push(sidedCoord(dof.id, state.side === "right" ? "left" : "right", joint));
  for (const name of names) state.pose[name] = value;
}

function modelOverrides() {
  return compensatePelvis(model, state.pose);
}

function phrase(dof, degrees) {
  const amount = Math.abs(Math.round(degrees));
  if (amount < 1) return "Anatomical position";
  return degrees > 0 ? `${amount}° ${dof.positive.toLowerCase()}` : `${amount}° ${dof.negative.toLowerCase()}`;
}

function emphasis(degrees, min, max) {
  if (state.playing) return state.playDir > 0 ? "positive" : "negative";
  const t = (degrees - min) / ((max - min) || 1);
  if (t > 0.62) return "positive";
  if (t < 0.38) return "negative";
  return "both";
}

function rolesFor(items, emphasisName) {
  const roles = {};
  if (state.showAllMuscles) {
    for (const muscle of muscles) roles[muscleBase(muscle.name)] = "context";
  }
  const paint = (list, role) => {
    for (const item of list || []) {
      if (role === "opposite" && roles[item.id] === "prime") continue;
      roles[item.id] = role;
    }
  };
  if (!items) return roles;
  if (emphasisName !== "negative") {
    paint(items.positiveMuscles?.filter((item) => item.role === "prime"), "prime");
    paint(items.positiveMuscles?.filter((item) => item.role === "synergist"), "synergist");
    if (emphasisName === "positive") paint(items.negativeMuscles?.filter((item) => item.role === "prime"), "opposite");
  }
  if (emphasisName !== "positive") {
    paint(items.negativeMuscles?.filter((item) => item.role === "prime"), "prime");
    paint(items.negativeMuscles?.filter((item) => item.role === "synergist"), "synergist");
    if (emphasisName === "negative") paint(items.positiveMuscles?.filter((item) => item.role === "prime"), "opposite");
  }
  return roles;
}

function lessonItems() {
  const joint = activeJoint();
  if (joint.kind !== "lesson") return null;
  return joint.movements.find((movement) => movement.name === state.lessonName) || joint.movements[0];
}

function sync() {
  const solved = forwardKinematics(model, modelOverrides());
  const pivot = [-0.012, 0.47, 0];
  const neck = {
    R: cervicalRotation(
      state.extras.cervical_flexion || 0,
      state.extras.cervical_lateral || 0,
      state.extras.cervical_rotation || 0,
    ),
    p: [0, 0, 0],
  };
  solved.world.skull = mulTransform(
    solved.world.torso,
    mulTransform(
      { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], p: pivot },
      mulTransform(neck, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], p: [-pivot[0], -pivot[1], -pivot[2]] }),
    ),
  );
  const joint = activeJoint();
  const dof = activeDof();
  const lesson = lessonItems();
  let roles = {};
  let label = joint.title;
  let detail = joint.summary;
  if (dof) {
    const range = limits(dof, joint);
    const degrees = currentDegrees(dof, joint);
    const which = emphasis(degrees, range.min, range.max);
    roles = rolesFor(dof, which);
    label = phrase(dof, degrees);
    detail = `${dof.plane} plane · ${dof.axis} axis`;
  } else if (lesson) {
    roles = {};
    for (const item of lesson.muscles) roles[item.id] = item.role === "prime" ? "prime" : "synergist";
    label = lesson.name;
    detail = `${lesson.plane} plane`;
  }
  const axis = axisFor(solved.world, joint, dof);
  const bodies = (joint.bodies || []).flatMap((body) => {
    if (body === "skull") return ["skull"];
    if (joint.sided === false || body === "torso" || body === "pelvis") {
      return body === "torso" && joint.id === "cervical" ? ["torso", "skull"] : [body];
    }
    return [`${body}_r`, `${body}_l`];
  });
  viewer.update({
    world: solved.world,
    muscles,
    roles,
    showMuscles: state.showMuscles,
    showBones: state.showBones,
    extras: state.extras,
    ground: true,
    axis: axis ? { ...axis, bodies, color: "#f2c14e" } : { bodies },
  });
  readoutEl.innerHTML = `<b>${label}</b><span>${detail}</span>`;
}

function axisFor(world, joint, dof) {
  if (dof && joint.id === "pelvis" && dof.id.startsWith("pelvis_")) {
    const local = dof.id === "pelvis_tilt" ? [0, 0, 1] : dof.id === "pelvis_list" ? [1, 0, 0] : [0, 1, 0];
    return {
      origin: transformPoint(world.pelvis, [-0.056276, -0.07849, 0]),
      direction: mulMatVec(world.pelvis.R, local),
    };
  }
  if (!dof || joint.kind === "teaching" || joint.kind === "lesson") {
    if (joint.id === "cervical" && dof) {
      const local = dof.id.endsWith("flexion") ? [0, 0, -1] : dof.id.endsWith("lateral") ? [1, 0, 0] : [0, 1, 0];
      return {
        origin: transformPoint(world.torso, [-0.012, 0.47, 0]),
        direction: mulMatVec(world.torso.R, local),
      };
    }
    return null;
  }
  const name = sidedCoord(dof.id, state.side, joint);
  const osim = model.joints.find((item) => item.axes.some((axis) => axis.fn.coord === name));
  if (!osim) return null;
  const axis = osim.axes.find((item) => item.fn.coord === name);
  return jointAxisWorld(world, osim, axis.axis);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function signedDegrees(value) {
  const rounded = Math.round(value);
  return rounded < 0 ? `−${Math.abs(rounded)}°` : `${rounded}°`;
}

function degreeSpan(min, max) {
  return `${signedDegrees(min)} to ${signedDegrees(max)}`;
}

function publishedRange(dof, joint) {
  if (joint.kind === "teaching" || TEACHING.has(dof.id)) return null;
  const sample = coordRecord(sidedCoord(dof.id, "r", joint)) || coordRecord(dof.id);
  if (!sample) return null;
  return { min: deg(sample.min), max: deg(sample.max) };
}

function renderChanges() {
  const kept = MODEL_CHANGES.kept.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const wrapped = model.muscles.filter((muscle) => muscle.wraps.length > 0).length;
  const cards = MODEL_CHANGES.changes.map((change) => {
    const lab = change.title.startsWith("Lower-limb")
      ? `${change.lab} ${wrapped} of the ${model.muscles.length} paths define a wrap cylinder.`
      : change.lab;
    return `<article class="change">
      <h3>${escapeHtml(change.title)}</h3>
      <dl>
        <dt>Base model</dt>
        <dd>${escapeHtml(change.model)}</dd>
        <dt>This lab</dt>
        <dd>${escapeHtml(lab)}</dd>
      </dl>
    </article>`;
  }).join("");
  const rows = [];
  for (const joint of JOINTS) {
    for (const dof of joint.dofs || []) {
      const slider = limits(dof, joint);
      const published = publishedRange(dof, joint);
      const changed = !published
        || Math.abs(Math.round(published.min) - Math.round(slider.min)) > 0
        || Math.abs(Math.round(published.max) - Math.round(slider.max)) > 0;
      rows.push(`<tr data-changed="${changed}">
        <td>${escapeHtml(joint.title)} · ${escapeHtml(dof.positive)} / ${escapeHtml(dof.negative)}</td>
        <td>${published ? degreeSpan(published.min, published.max) : "Not in the model"}</td>
        <td>${degreeSpan(slider.min, slider.max)}</td>
      </tr>`);
    }
  }
  const drawn = [...new Set(muscles.filter((muscle) => muscle.source === "schematic").map((muscle) => muscleBase(muscle.name)))]
    .map((id) => MUSCLES[id]?.title || id);
  const poses = PATTERNS.filter((pattern) => pattern.id !== "stand").map((pattern) => {
    const bits = Object.entries(pattern.pose).map(([key, degrees]) => {
      const owner = JOINTS.find((joint) => joint.dofs?.some((dof) => dof.id === key));
      const dof = owner.dofs.find((item) => item.id === key);
      const word = degrees >= 0 ? dof.positive : dof.negative;
      return `${Math.abs(degrees)}° ${word.toLowerCase()}`;
    });
    return `<li><b>${escapeHtml(pattern.title)}.</b> ${escapeHtml(bits.join(", "))}. ${escapeHtml(pattern.detail)}</li>`;
  }).join("");
  document.querySelector("#changes-body").innerHTML = `
    <p class="summary changes-body-lead">${escapeHtml(MODEL_CHANGES.lead)}</p>
    <p class="section-label">Unchanged from the paper</p>
    <ul class="kept">${kept}</ul>
    <p class="section-label">Added or changed</p>
    ${cards}
    <p class="section-label">Slider ranges</p>
    <p class="summary">Each row is a published coordinate limit beside the window the slider uses. Highlighted rows are narrower than the model, or are hinges this lab added. Shoulder flexion stays at the model’s ±90° because the scapula cannot rotate the arm overhead.</p>
    <table class="change-table">
      <thead><tr><th>Motion</th><th>Published</th><th>Slider</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
    <p class="section-label">Drawn lines that are not in the model</p>
    <p class="summary">${drawn.length} lines on each side. The lower limb keeps the model’s ${model.muscles.length} paths.</p>
    <div class="muscle-pills">${drawn.map((title) => `<span>${escapeHtml(title)}</span>`).join("")}</div>
    <p class="section-label">Example poses</p>
    <ul class="kept">${poses}</ul>
    <p class="credit">Rajagopal A, Dembia CL, DeMers MS, Delp DD, Hicks JL, Delp SL. Full-body musculoskeletal model for muscle-driven simulation of human gait. IEEE Trans Biomed Eng. 2016. <a href="https://doi.org/10.1109/TBME.2016.2586891">Paper</a>. Source: <a href="https://github.com/opensim-org/opensim-models/tree/master/Models/Rajagopal">opensim-models</a>.</p>
  `;
}

function openChanges() {
  renderChanges();
  const dialog = document.querySelector("#changes");
  if (!dialog.open) dialog.showModal();
}

function renderLibrary() {
  const query = (libraryEl.querySelector("#search")?.value || "").trim().toLowerCase();
  const parts = ['<input id="search" class="search" placeholder="Search joints or muscles" value="">'];
  for (const region of REGIONS) {
    const joints = JOINTS.filter((joint) => joint.region === region).filter((joint) => {
      if (!query) return true;
      const blob = `${joint.title} ${joint.summary} ${(joint.dofs || []).map((dof) => `${dof.positive} ${dof.negative}`).join(" ")} ${(joint.movements || []).map((movement) => movement.name).join(" ")}`.toLowerCase();
      return blob.includes(query);
    });
    if (!joints.length) continue;
    parts.push(`<div class="region">${region}</div>`);
    for (const joint of joints) {
      parts.push(`<button class="joint-btn" data-joint="${joint.id}" aria-pressed="${joint.id === state.jointId}">
        <span>${joint.title}</span><small>${joint.kind === "model" ? "Model joint" : joint.kind === "teaching" ? "Approximate" : "Concept"}</small>
      </button>`);
    }
  }
  libraryEl.innerHTML = parts.join("");
  const search = libraryEl.querySelector("#search");
  search.value = query;
  search.addEventListener("input", () => {
    const caret = search.selectionStart;
    renderLibrary();
    const next = libraryEl.querySelector("#search");
    next.focus();
    next.setSelectionRange(caret, caret);
  });
  libraryEl.querySelectorAll("[data-joint]").forEach((button) => {
    button.addEventListener("click", () => {
      state.jointId = button.dataset.joint;
      const joint = activeJoint();
      state.dofId = joint.dofs?.[0]?.id || null;
      state.lessonName = joint.movements?.[0]?.name || null;
      state.detailId = null;
      state.playing = false;
      renderLibrary();
      renderDetail();
      focusCamera(joint.id);
      sync();
    });
  });
}

function muscleBlock(item, groupLabel) {
  const info = MUSCLES[item.id];
  if (!info) return "";
  const color = item.role === "prime" ? "var(--prime)" : "var(--syn)";
  return `<div class="muscle">
    <i class="swatch" style="background:${color}"></i>
    <div>
      <b>${info.title}</b> <span class="role">${groupLabel} · ${item.role}</span>
      <p>${info.actions} Origin: ${info.origin}. Insertion: ${info.insertion}. ${info.nerve}.</p>
    </div>
  </div>`;
}

function detailToggle(id) {
  const open = state.detailId === id;
  return `<button class="detail-toggle" data-detail="${id}" aria-expanded="${open}" aria-label="${open ? "Hide muscle detail" : "Show muscle detail"}">
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6.2 8 10.2 12 6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>`;
}

function renderDetail() {
  const joint = activeJoint();
  const kind = joint.kind === "model" ? "Rajagopal 2016 coordinate" : joint.kind === "teaching" ? "Teaching approximation" : "Not a separate joint in this model";
  const patternButtons = PATTERNS.map((pattern) => `<button data-pattern="${pattern.id}">${pattern.title}</button>`).join("");
  let body = "";
  if (joint.dofs) {
    body = joint.dofs.map((dof) => {
      const range = limits(dof, joint);
      const degrees = currentDegrees(dof, joint);
      const active = dof.id === state.dofId;
      const open = state.detailId === dof.id;
      return `<section class="dof" data-active="${active}" data-dof="${dof.id}">
        <header>
          <button class="link" data-pick-dof="${dof.id}"><b>${dof.positive}</b> <span class="meta">/ ${dof.negative}</span></button>
          <span class="dof-tools">
            <span class="degrees" data-readout="${dof.id}">${phrase(dof, degrees)}</span>
            ${detailToggle(dof.id)}
          </span>
        </header>
        <input type="range" min="${range.min}" max="${range.max}" step="1" value="${degrees}" data-slider="${dof.id}" aria-label="${dof.positive}">
        <div class="ends"><span>${dof.negative}</span><span>${dof.positive}</span></div>
        <div class="facts"><span>${dof.plane}</span><span>${dof.axis}</span></div>
        ${open ? `<p class="about">${dof.about}</p><p class="clinical">${dof.clinical}</p>
          <h3>Muscles</h3>
          ${dof.positiveMuscles.map((item) => muscleBlock(item, dof.positive)).join("")}
          ${dof.negativeMuscles.map((item) => muscleBlock(item, dof.negative)).join("")}` : ""}
      </section>`;
    }).join("");
  } else {
    body = joint.movements.map((movement) => `<section class="lesson">
      <button data-lesson="${movement.name}"><b>${movement.name}</b></button>
      <p class="about">${movement.about}</p>
      ${movement.muscles.map((item) => muscleBlock(item, movement.name)).join("")}
    </section>`).join("");
  }
  detailEl.innerHTML = `
    <div class="kicker">${joint.region}</div>
    <div class="badge">${kind}</div>
    <h2>${joint.title}</h2>
    <p class="summary">${joint.summary}</p>
    <div class="patterns">${patternButtons}</div>
    ${body}
    <p class="credit">Bones, joint axes, and lower-limb paths: Rajagopal et al., IEEE TBME 2016. <button type="button" class="text-button" data-open-changes>See every change this lab adds</button>. <a href="https://doi.org/10.1109/TBME.2016.2586891">Paper</a>.</p>
  `;
  detailEl.querySelectorAll("[data-slider]").forEach((slider) => {
    slider.addEventListener("input", () => {
      state.playing = false;
      const dof = joint.dofs.find((item) => item.id === slider.dataset.slider);
      state.dofId = dof.id;
      setDegrees(dof, joint, Number(slider.value));
      const readout = detailEl.querySelector(`[data-readout="${dof.id}"]`);
      if (readout) readout.textContent = phrase(dof, Number(slider.value));
      detailEl.querySelectorAll(".dof").forEach((card) => {
        card.dataset.active = card.dataset.dof === dof.id;
      });
      sync();
    });
  });
  detailEl.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      state.detailId = state.detailId === button.dataset.detail ? null : button.dataset.detail;
      renderDetail();
    });
  });
  detailEl.querySelectorAll("[data-pick-dof]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dofId = button.dataset.pickDof;
      state.playing = false;
      renderDetail();
      sync();
    });
  });
  detailEl.querySelectorAll("[data-lesson]").forEach((button) => {
    button.addEventListener("click", () => {
      state.lessonName = button.dataset.lesson;
      sync();
    });
  });
  detailEl.querySelectorAll("[data-pattern]").forEach((button) => {
    button.addEventListener("click", () => applyPattern(PATTERNS.find((pattern) => pattern.id === button.dataset.pattern)));
  });
  detailEl.querySelector("[data-open-changes]").addEventListener("click", openChanges);
}

function applyPattern(pattern) {
  state.playing = false;
  state.pose = {};
  for (const key of Object.keys(state.extras)) state.extras[key] = 0;
  for (const [key, degrees] of Object.entries(pattern.pose)) {
    const owner = JOINTS.find((joint) => joint.dofs?.some((dof) => dof.id === key));
    const dof = owner.dofs.find((item) => item.id === key);
    const value = rad(degrees);
    if (TEACHING.has(key)) state.extras[key] = value;
    else if (owner.sided) {
      state.pose[`${key}_r`] = value;
      state.pose[`${key}_l`] = value;
    } else state.pose[key] = value;
  }
  state.jointId = pattern.focus;
  state.dofId = pattern.dof;
  state.detailId = null;
  renderLibrary();
  renderDetail();
  focusCamera(pattern.focus);
  sync();
}

function focusCamera(jointId) {
  const map = {
    pelvis: "pelvis", lumbar: "pelvis", cervical: "neck", scapula: "shoulder",
    shoulder: "shoulder", elbow: "shoulder", forearm: "hand", wrist: "hand", fingers: "hand",
    hip: "hip", knee: "knee", ankle: "ankle", subtalar: "ankle", toes: "ankle",
  };
  const solved = forwardKinematics(model, modelOverrides());
  viewer.lookAt(map[jointId] || "hip", solved.world, state.side === "left" ? "l" : "r");
}

function bodyToJoint(body) {
  const base = body.replace(/_(r|l)$/, "");
  const map = {
    femur: "hip", patella: "knee", tibia: "knee", talus: "ankle", calcn: "subtalar",
    toes: "toes", humerus: "shoulder", ulna: "elbow", radius: "forearm", hand: "wrist",
    pelvis: "pelvis", torso: "lumbar", skull: "cervical",
  };
  return map[base];
}

function animate(time) {
  requestAnimationFrame(animate);
  if (!state.playing) return;
  const joint = activeJoint();
  const dof = activeDof();
  if (!dof) return;
  playPhase += 0.008;
  const range = limits(dof, joint);
  const mid = (range.min + range.max) / 2;
  const amp = (range.max - range.min) / 2;
  const degrees = mid - amp * Math.cos(playPhase);
  const prev = currentDegrees(dof, joint);
  state.playDir = degrees >= prev ? 1 : -1;
  setDegrees(dof, joint, degrees);
  const slider = detailEl.querySelector(`[data-slider="${dof.id}"]`);
  const readout = detailEl.querySelector(`[data-readout="${dof.id}"]`);
  if (slider) slider.value = String(Math.round(degrees));
  if (readout) readout.textContent = phrase(dof, degrees);
  sync();
}

function wireChrome() {
  document.querySelector("#side-right").addEventListener("click", () => {
    state.side = "right";
    document.querySelector("#side-right").setAttribute("aria-pressed", "true");
    document.querySelector("#side-left").setAttribute("aria-pressed", "false");
    renderDetail();
    sync();
  });
  document.querySelector("#side-left").addEventListener("click", () => {
    state.side = "left";
    document.querySelector("#side-left").setAttribute("aria-pressed", "true");
    document.querySelector("#side-right").setAttribute("aria-pressed", "false");
    renderDetail();
    sync();
  });
  document.querySelector("#mirror").addEventListener("click", (event) => {
    state.mirror = !state.mirror;
    event.currentTarget.setAttribute("aria-pressed", String(state.mirror));
  });
  document.querySelector("#bones").addEventListener("click", (event) => {
    state.showBones = !state.showBones;
    event.currentTarget.setAttribute("aria-pressed", String(state.showBones));
    sync();
  });
  document.querySelector("#muscles").addEventListener("click", (event) => {
    state.showMuscles = !state.showMuscles;
    event.currentTarget.setAttribute("aria-pressed", String(state.showMuscles));
    sync();
  });
  document.querySelector("#all-muscles").addEventListener("click", (event) => {
    state.showAllMuscles = !state.showAllMuscles;
    event.currentTarget.setAttribute("aria-pressed", String(state.showAllMuscles));
    sync();
  });
  document.querySelector("#play").addEventListener("click", (event) => {
    state.playing = !state.playing;
    event.currentTarget.setAttribute("aria-pressed", String(state.playing));
    event.currentTarget.textContent = state.playing ? "Pause" : "Play range";
  });
  document.querySelector("#reset").addEventListener("click", () => applyPattern(PATTERNS[0]));
  document.querySelector("#changes-open").addEventListener("click", openChanges);
  const changes = document.querySelector("#changes");
  document.querySelector("#changes-close").addEventListener("click", () => changes.close());
  changes.addEventListener("click", (event) => {
    if (event.target === changes) changes.close();
  });
}

async function boot() {
  const [modelResponse, meshResponse] = await Promise.all([
    fetch("data/model.json"),
    fetch("data/meshes.json"),
  ]);
  model = await modelResponse.json();
  const meshData = await meshResponse.json();
  muscles = [...model.muscles, ...schematicMuscles()];
  viewer = createViewer(stageEl, model, meshData);
  viewer.setPickHandler((body) => {
    const jointId = bodyToJoint(body);
    if (!jointId) return;
    if (body.endsWith("_l")) state.side = "left";
    if (body.endsWith("_r")) state.side = "right";
    document.querySelector("#side-right").setAttribute("aria-pressed", String(state.side === "right"));
    document.querySelector("#side-left").setAttribute("aria-pressed", String(state.side === "left"));
    state.jointId = jointId;
    const joint = activeJoint();
    state.dofId = joint.dofs?.[0]?.id || state.dofId;
    state.lessonName = joint.movements?.[0]?.name || null;
    renderLibrary();
    renderDetail();
    focusCamera(jointId);
    sync();
  });
  wireChrome();
  renderLibrary();
  renderDetail();
  sync();
  requestAnimationFrame(animate);
}

boot().catch((error) => {
  console.error(error.stack || error.message);
  const loading = document.querySelector("#loading");
  if (loading) loading.textContent = `The model did not load. ${error.message}`;
});
