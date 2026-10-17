import { createAudio } from "./audio.js";
import { FILL_PRESETS, generateFills } from "./fills.js";
import {
  GROOVE_LEVELS,
  GROOVES,
  RESOLUTIONS,
  SEQUENCER_VOICES,
  emptyGrid,
  remapGrid,
  sequencerGroove,
} from "./grooves.js";
import { createHighway } from "./highway.js";
import { KEY_MAP, NITRO_MAX, PADS, elementLabel } from "./kit.js";
import { createMidi } from "./midi.js";
import { gridLabel } from "./pattern.js";
import {
  FAMILY_FILTERS,
  chartFor,
  defaultNoteValue,
  familyLabel,
  findRudiment,
  noteValueOptions,
  RUDIMENTS,
  stepsForNoteValue,
} from "./rudiments.js";
import {
  expireMisses,
  registerHit,
  schedule,
  starLabel,
  summarize,
  timingSentence,
} from "./score.js";
import {
  GRIDS,
  STICKINGS,
  arrangementsFor,
  arrangementsFromPattern,
  classicHertas,
  defaultBpm,
  elementsIn,
  generateArrangements,
  materialize,
  parseSticking,
} from "./stickings.js";

const audio = createAudio();
const highway = createHighway(document.querySelector("#highway"));
const $ = (id) => document.querySelector(id);

const els = {
  train: $("#train"),
  fills: $("#fills"),
  grooves: $("#grooves"),
  stick: $("#stick"),
  tabTrain: $("#tab-train"),
  tabFills: $("#tab-fills"),
  tabGrooves: $("#tab-grooves"),
  tabStick: $("#tab-stick"),
  kit: $("#kit-panel"),
  kitOpen: $("#kit-open"),
  midiPill: $("#midi-pill"),
  midiStatus: $("#midi-status"),
  midiLast: $("#midi-last"),
  midiConnect: $("#midi-connect"),
  calibration: $("#calibration"),
  calRead: $("#cal-read"),
  noteMap: $("#note-map"),
  keyMap: $("#key-map"),
  search: $("#search"),
  families: $("#families"),
  rudimentList: $("#rudiment-list"),
  kicker: $("#lesson-kicker"),
  title: $("#lesson-title"),
  sticking: $("#lesson-sticking"),
  about: $("#lesson-about"),
  bpm: $("#bpm"),
  bpmRead: $("#bpm-read"),
  subdivision: $("#subdivision"),
  bars: $("#bars"),
  gridRead: $("#grid-read"),
  playPart: $("#play-part"),
  hear: $("#hear"),
  start: $("#start"),
  stop: $("#stop"),
  banner: $("#custom-banner"),
  progress: document.querySelector("#progress span"),
  results: $("#results"),
  live: $("#live-judge"),
  pads: $("#pads"),
  stickList: $("#stick-list"),
  stickInput: $("#stick-input"),
  gridChips: $("#grid-chips"),
  stickError: $("#stick-error"),
  essay: $("#stick-essay"),
  arrangements: $("#arrangements"),
  fillInput: $("#fill-input"),
  fillPresets: $("#fill-presets"),
  fillLengths: $("#fill-lengths"),
  fillError: $("#fill-error"),
  fillList: $("#fill-list"),
  grooveLevels: $("#groove-levels"),
  grooveList: $("#groove-list"),
  seqResolution: $("#seq-resolution"),
  sequencer: $("#sequencer"),
  seqError: $("#seq-error"),
};

const state = {
  mode: "train",
  family: "all",
  query: "",
  rudimentId: "paradiddle",
  noteValue: "16",
  bpm: 80,
  bars: 4,
  phase: "idle",
  chart: [],
  downbeat: 0,
  scoring: false,
  calibration: Number(localStorage.getItem("handline-calibration") || 0),
  custom: null,
  summary: null,
  midi: { state: "idle", inputs: [], last: "" },
  stickText: "R L R R L R L L",
  stickGrids: ["8", "16"],
  pinnedId: null,
  fillText: "R L R R L R L L",
  fillLength: "all",
  grooveLevel: "all",
  seqResolution: "8",
  seqGrid: emptyGrid("8"),
};

let sessionId = 0;
let timer = 0;
const shown = new Map();
const fillShown = new Map();

function stepsPerBeat() {
  if (state.custom) return state.custom.stepsPerBeat;
  return stepsForNoteValue(findRudiment(state.rudimentId), state.noteValue);
}

function lessonNotes(bars) {
  if (state.custom) return materialize(state.custom.recipe, bars);
  return chartFor(findRudiment(state.rudimentId), bars, stepsPerBeat());
}

function previewNotes() {
  state.chart = schedule(lessonNotes(state.bars), 0, state.bpm, stepsPerBeat());
  state.downbeat = 0;
}

function running() {
  return state.phase === "countin" || state.phase === "playing" || state.phase === "preview";
}

function setMode(mode) {
  state.mode = mode;
  els.train.hidden = mode !== "train";
  els.fills.hidden = mode !== "fills";
  els.grooves.hidden = mode !== "grooves";
  els.stick.hidden = mode !== "stick";
  els.tabTrain.setAttribute("aria-selected", String(mode === "train"));
  els.tabFills.setAttribute("aria-selected", String(mode === "fills"));
  els.tabGrooves.setAttribute("aria-selected", String(mode === "grooves"));
  els.tabStick.setAttribute("aria-selected", String(mode === "stick"));
  if (mode === "stick") renderStick();
  if (mode === "fills") renderFills();
  if (mode === "grooves") renderGrooves();
}

function stickingHTML(text) {
  return [...text].map((ch) => {
    if (ch === "R" || ch === "r") return `<b class="r${ch === "r" ? " dim" : ""}">${ch}</b>`;
    if (ch === "L" || ch === "l") return `<b class="l${ch === "l" ? " dim" : ""}">${ch}</b>`;
    if (ch === "K" || ch === "k") return `<b class="f">${ch.toUpperCase()}</b>`;
    return ch === " " ? " " : ch;
  }).join("");
}

function renderFamilies() {
  els.families.innerHTML = FAMILY_FILTERS.map((family) => `
    <button type="button" data-family="${family.id}" aria-pressed="${family.id === state.family}">${family.label}</button>
  `).join("");
}

function renderRudimentList() {
  const query = state.query.trim().toLowerCase();
  const items = RUDIMENTS.filter((rudiment) => {
    if (state.family !== "all" && rudiment.family !== state.family) return false;
    if (!query) return true;
    return `${rudiment.name} ${rudiment.sticking}`.toLowerCase().includes(query);
  });
  els.rudimentList.innerHTML = items.map((rudiment) => `
    <button type="button" class="ritem" role="option" data-id="${rudiment.id}" aria-selected="${rudiment.id === state.rudimentId && !state.custom}">
      <span class="num">${rudiment.number}</span>
      <span><strong>${rudiment.name}</strong><small>${rudiment.sticking}</small></span>
    </button>
  `).join("") || `<p class="status">No rudiment matches.</p>`;
}

function renderBanner() {
  if (!state.custom) {
    els.banner.hidden = true;
    els.banner.innerHTML = "";
    return;
  }
  els.banner.hidden = false;
  els.banner.innerHTML = `<span>Practicing ${state.custom.name}. ${state.custom.timing}.</span><button type="button" id="clear-custom">Back to rudiments</button>`;
  $("#clear-custom").addEventListener("click", () => {
    state.custom = null;
    const rudiment = findRudiment(state.rudimentId);
    state.bpm = rudiment.defaultBpm;
    els.bpm.value = String(state.bpm);
    if (state.phase === "results") closeResults();
    previewNotes();
    renderTrain();
  });
}

function renderTrain() {
  const rudiment = findRudiment(state.rudimentId);
  const custom = state.custom;
  els.kicker.textContent = custom
    ? custom.timing
    : `PAS ${rudiment.number} · ${familyLabel(rudiment.family)}`;
  els.title.textContent = custom ? custom.name : rudiment.name;
  els.sticking.innerHTML = custom ? "" : stickingHTML(rudiment.sticking);
  els.about.textContent = custom ? custom.detail : rudiment.about;
  els.bpmRead.textContent = String(state.bpm);
  els.gridRead.textContent = `${gridLabel(stepsPerBeat())} · ${state.bars} bars`;
  renderSubdivision(rudiment, custom);
  els.bars.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.bars) === state.bars));
  });
  const locked = running();
  els.bpm.disabled = locked;
  els.subdivision.querySelectorAll("button").forEach((button) => { button.disabled = locked; });
  els.bars.querySelectorAll("button").forEach((button) => { button.disabled = locked; });
  els.hear.hidden = locked;
  els.start.hidden = locked;
  els.stop.hidden = !locked;
  renderBanner();
  renderRudimentList();
}

function renderSubdivision(rudiment, custom) {
  els.subdivision.hidden = Boolean(custom);
  if (custom) return;
  const options = noteValueOptions(rudiment);
  if (!options.some((option) => option.id === state.noteValue)) {
    state.noteValue = defaultNoteValue(rudiment);
  }
  els.subdivision.innerHTML = options.map((option) => `
    <button type="button" data-note-value="${option.id}" aria-pressed="${option.id === state.noteValue}">${option.label}</button>
  `).join("");
}

function renderPads() {
  els.pads.innerHTML = PADS.map((pad) => `
    <button type="button" class="pad" data-pad="${pad.id}">
      <b>${pad.label}</b><span>${pad.key}${pad.id === "kick" ? " · Space" : ""}</span>
    </button>
  `).join("");
}

function renderKit() {
  const names = {
    kick: "Kick", snare: "Snare", tom1: "Tom 1", tom2: "Tom 2", floor: "Floor",
    crash: "Crash", ride: "Ride", hat: "Hi-hat", "hat-pedal": "Hi-hat pedal (ignored)",
  };
  const groups = new Map();
  for (const [note, element] of Object.entries(NITRO_MAX)) {
    const key = element === null ? "hat-pedal" : element;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  els.noteMap.innerHTML = [...groups.entries()].map(([key, notes]) =>
    `<li>${names[key] || key} · ${notes.join(", ")}</li>`).join("");
  els.keyMap.innerHTML = PADS.map((pad) => `<li>${pad.label} · ${pad.key}${pad.id === "kick" ? " or Space" : ""}</li>`).join("");
}

function renderMidi() {
  const { state: midiState, inputs, last } = state.midi;
  const text = {
    unsupported: "This browser has no Web MIDI. Use Chrome or Edge, or play from the keys.",
    denied: "MIDI permission was blocked.",
    waiting: "No input yet. Plug in the Nitro Max by USB and press Connect MIDI.",
    connected: inputs[0] || "MIDI connected",
    idle: "MIDI is not connected yet.",
  }[midiState] || "MIDI is not connected yet.";
  els.midiStatus.textContent = text;
  els.midiLast.textContent = last ? `Last hit: ${last}` : "";
  els.midiPill.textContent = midiState === "connected" ? (inputs[0] || "MIDI").slice(0, 28) : "MIDI";
  els.midiPill.classList.toggle("on", midiState === "connected");
}

function paintCalibration() {
  const value = state.calibration;
  els.calibration.value = String(value);
  const side = value === 0 ? "centered" : value > 0 ? `${value} ms earlier` : `${Math.abs(value)} ms later`;
  els.calRead.textContent = `${side}. Move right if your hits are called late.`;
}

function starSVG(on) {
  return `<svg viewBox="0 0 20 20" class="${on ? "on" : ""}" aria-hidden="true"><path d="M10 1.6 12.2 7l5.8.5-4.4 3.8 1.4 5.6L10 14.2 4.9 16.9 6.3 11.3 1.9 7.5 7.8 7z"/></svg>`;
}

function handLine(label, hand) {
  if (!hand.total) return "";
  const rate = Math.round((hand.hit / hand.total) * 100);
  const bias = hand.meanDeltaMs == null
    ? ""
    : Math.abs(hand.meanDeltaMs) <= 8
      ? "in the pocket"
      : hand.meanDeltaMs < 0
        ? `${Math.abs(Math.round(hand.meanDeltaMs))} ms early`
        : `${Math.round(hand.meanDeltaMs)} ms late`;
  return `<div><b>${label}</b><span class="quiet"> ${rate}% hit${bias ? ` · ${bias}` : ""}</span></div>`;
}

function renderResults() {
  const summary = state.summary;
  if (!summary || state.phase !== "results") {
    els.results.hidden = true;
    els.results.innerHTML = "";
    return;
  }
  const { counts } = summary;
  const graces = state.chart.some((note) => note.grace);
  els.results.hidden = false;
  els.results.innerHTML = `
    <div class="results-card" role="dialog" aria-label="Lesson results">
      <div class="stars" aria-label="${summary.stars} of 5 stars">${[0, 1, 2, 3, 4].map((i) => starSVG(i < summary.stars)).join("")}</div>
      <div class="score-line"><strong>${summary.score}</strong><span>${starLabel(summary.stars)}<br>${summary.stars} of 5 stars</span></div>
      <p>${timingSentence(summary.meanDeltaMs)} ${summary.early} early, ${summary.late} late.</p>
      <div class="stats">
        <div><b>${counts.perfect}</b><span>Perfect</span></div>
        <div><b>${counts.great}</b><span>Great</span></div>
        <div><b>${counts.good}</b><span>Good</span></div>
        <div><b>${counts.miss}</b><span>Missed</span></div>
      </div>
      <div class="hands">
        ${handLine("Right", summary.hands.R)}
        ${handLine("Left", summary.hands.L)}
      </div>
      <div class="ticks">${state.chart.map((note) => `<i class="${note.result || ""}"></i>`).join("")}</div>
      <p class="quiet">${graces ? "Grace notes count at half weight. " : ""}Perfect is within 30 ms, great within 55, good within 90.</p>
      <div class="result-actions">
        <button type="button" id="results-close">Close</button>
        <button type="button" class="again" id="results-again">Play again</button>
      </div>
    </div>`;
  $("#results-close").addEventListener("click", closeResults);
  $("#results-again").addEventListener("click", () => runLesson(false));
}

function closeResults() {
  state.phase = "idle";
  state.summary = null;
  previewNotes();
  renderResults();
  renderTrain();
}

function view() {
  const active = running();
  const beatDur = 60 / state.bpm;
  const audioNow = active ? audio.currentTime() : -0.18;
  return {
    notes: state.chart,
    now: audioNow,
    bpm: state.bpm,
    stepsPerBeat: stepsPerBeat(),
    phase: state.phase,
    currentBeat: active ? (audio.currentTime() - state.downbeat) / beatDur : audioNow / beatDur,
    buzz: !state.custom && findRudiment(state.rudimentId).buzz,
  };
}

function updateProgress() {
  if (!running()) {
    els.progress.style.transform = "scaleX(0)";
    return;
  }
  const total = state.bars * 4 * (60 / state.bpm);
  const amount = (audio.currentTime() - state.downbeat) / total;
  els.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, amount))})`;
}

function announceMisses() {
  let shownMiss = false;
  for (const note of state.chart) {
    if (note.result !== "miss" || note.announced) continue;
    note.announced = true;
    if (!shownMiss) {
      highway.feedback(note.element, "stray", "MISS");
      els.live.textContent = "MISS";
      shownMiss = true;
    }
  }
}

function runLesson(preview) {
  sessionId += 1;
  const id = sessionId;
  window.clearTimeout(timer);
  state.summary = null;
  renderResults();
  audio.resume().then(() => {
    if (id !== sessionId) return;
    const beatDur = 60 / state.bpm;
    const totalBeats = state.bars * 4;
    state.downbeat = audio.currentTime() + 0.12 + 4 * beatDur;
    state.chart = schedule(lessonNotes(state.bars), state.downbeat, state.bpm, stepsPerBeat());
    state.phase = "countin";
    state.scoring = !preview;
    let beat = -4;
    let nextBeat = state.downbeat - 4 * beatDur;
    let guide = 0;
    const playPart = preview || els.playPart.checked;
    renderTrain();

    const tick = () => {
      if (id !== sessionId) return;
      const horizon = audio.currentTime() + 0.18;
      while (nextBeat < horizon && beat <= totalBeats) {
        audio.click(nextBeat, ((beat % 4) + 4) % 4 === 0);
        nextBeat += beatDur;
        beat += 1;
      }
      if (playPart) {
        while (guide < state.chart.length && state.chart[guide].time < horizon) {
          const note = state.chart[guide];
          if (note.time >= audio.currentTime() - 0.02) {
            audio.drum(Math.max(note.time, audio.currentTime()), note.element, note.velocity ?? (note.accent ? 115 : 78));
          }
          guide += 1;
        }
      }
      const now = audio.currentTime();
      if (now >= state.downbeat && state.phase === "countin") {
        state.phase = preview ? "preview" : "playing";
      }
      if (state.scoring && expireMisses(state.chart, now)) announceMisses();
      if (now > state.downbeat + totalBeats * beatDur + 0.14) {
        finish(id, preview);
        return;
      }
      timer = window.setTimeout(tick, 25);
    };
    tick();
  });
}

function finish(id, preview) {
  if (id !== sessionId) return;
  sessionId += 1;
  window.clearTimeout(timer);
  state.scoring = false;
  if (preview) {
    state.phase = "idle";
    previewNotes();
    renderTrain();
    return;
  }
  expireMisses(state.chart, Infinity);
  state.summary = summarize(state.chart);
  state.phase = "results";
  renderTrain();
  renderResults();
}

function stopLesson() {
  sessionId += 1;
  window.clearTimeout(timer);
  state.scoring = false;
  state.phase = "idle";
  state.summary = null;
  previewNotes();
  renderResults();
  renderTrain();
}

function onStrike(element, velocity = 100) {
  audio.resume();
  const now = audio.currentTime();
  audio.drum(now, element, velocity);
  const pad = els.pads.querySelector(`[data-pad="${element}"]`);
  if (pad) {
    pad.style.setProperty("--flash", "#f3eee6");
    pad.classList.add("lit");
    window.setTimeout(() => pad.classList.remove("lit"), 90);
  }
  if (!state.scoring) return;
  const hit = registerHit(state.chart, element, now - state.calibration / 1000);
  if (!hit) {
    highway.feedback(element, "stray", "");
    els.live.textContent = `${elementLabel(element)} — nothing due there`;
    return;
  }
  const word = hit.result === "perfect" ? "PERFECT" : hit.deltaMs < 0 ? "EARLY" : "LATE";
  const ms = Math.round(hit.deltaMs);
  const side = ms === 0 ? "on the beat" : ms < 0 ? `${Math.abs(ms)} ms early` : `${ms} ms late`;
  highway.feedback(element, hit.hand, word);
  els.live.textContent = `${word} · ${side}`;
  if (pad) pad.style.setProperty("--flash", hit.hand === "L" ? "#3d7dff" : hit.hand === "F" ? "#e7c56c" : "#ff4d3a");
}

function selectRudiment(id) {
  const rudiment = findRudiment(id);
  if (!rudiment) return;
  if (running()) stopLesson();
  state.rudimentId = id;
  state.custom = null;
  state.noteValue = defaultNoteValue(rudiment);
  state.bpm = rudiment.defaultBpm;
  els.bpm.value = String(state.bpm);
  if (state.phase === "results") {
    state.phase = "idle";
    state.summary = null;
    renderResults();
  }
  previewNotes();
  renderTrain();
}

function wakeSettings() {
  if (state.phase === "results") closeResults();
  else if (!running()) previewNotes();
}

function matchEntry(hands) {
  return STICKINGS.find((entry) => {
    if (entry.pattern) return false;
    const parsed = parseSticking(entry.display);
    return parsed.hands && parsed.hands.join("") === hands.join("");
  }) || null;
}

function currentArrangements() {
  if (state.pinnedId) {
    const entry = STICKINGS.find((item) => item.id === state.pinnedId);
    if (entry?.pattern) return { entry, arrangements: arrangementsFromPattern(entry.pattern, { grids: state.stickGrids, bars: 2 }), error: "" };
  }
  const parsed = parseSticking(els.stickInput.value);
  if (parsed.error) return { entry: null, arrangements: [], error: parsed.error };
  const entry = matchEntry(parsed.hands);
  const arrangements = generateArrangements(parsed.hands, { grids: state.stickGrids, bars: 2 });
  if (entry?.extra === "herta") arrangements.push(...classicHertas());
  return { entry, arrangements, error: "" };
}

function subdivisionLabel(step, stepsPerBeat) {
  const index = step % stepsPerBeat;
  const beat = (Math.floor(step / stepsPerBeat) % 4) + 1;
  if (index === 0) return String(beat);
  if (stepsPerBeat === 2) return "+";
  if (stepsPerBeat === 3) return index === 1 ? "t" : "l";
  if (stepsPerBeat === 4) return ["", "e", "+", "a"][index];
  return "";
}

function renderGrid(arrangement) {
  const lanes = elementsIn(arrangement.notes);
  const steps = arrangement.steps;
  const byLane = new Map(lanes.map((lane) => [lane.id, new Map()]));
  for (const note of arrangement.notes) {
    const lane = byLane.get(note.element);
    if (!lane) continue;
    if (!lane.has(note.baseStep)) lane.set(note.baseStep, []);
    lane.get(note.baseStep).push(note);
  }
  const head = [`<span></span>`];
  for (let step = 0; step < steps; step += 1) {
    const beat = step % arrangement.stepsPerBeat === 0 ? " beat" : "";
    head.push(`<span class="head${beat}">${subdivisionLabel(step, arrangement.stepsPerBeat)}</span>`);
  }
  const rows = lanes.map((lane) => {
    const cells = [`<span class="lane">${lane.label}</span>`];
    const laneNotes = byLane.get(lane.id);
    for (let step = 0; step < steps; step += 1) {
      const notes = (laneNotes.get(step) || []).slice().sort((a, b) => a.grace === b.grace ? 0 : a.grace ? -1 : 1);
      const beat = step % arrangement.stepsPerBeat === 0 ? " beat" : "";
      if (!notes.length) {
        cells.push(`<span class="${beat.trim()}"></span>`);
        continue;
      }
      const token = notes.map((note) => (note.element === "kick" ? "K" : note.grace ? note.hand.toLowerCase() : note.hand)).join("");
      const hand = notes.find((note) => !note.grace)?.hand || notes[0].hand;
      const accent = notes.some((note) => note.accent) ? " accent" : "";
      const grace = notes.every((note) => note.grace) ? " grace" : "";
      const tone = hand === "L" ? "l" : hand === "F" || notes[0].element === "kick" ? "f" : "r";
      cells.push(`<span class="cell ${tone}${accent}${grace}${beat}">${token}</span>`);
    }
    return cells.join("");
  });
  return `<div class="grid-scroll"><div class="grid" style="--cols:${steps}">${head.join("")}${rows.join("")}</div></div>`;
}

function renderStickList() {
  els.stickList.innerHTML = STICKINGS.map((entry) => `
    <button type="button" class="ritem" role="option" data-stick="${entry.id}" aria-selected="${entry.id === (state.pinnedId || currentArrangements().entry?.id)}">
      <span class="num">${entry.pattern ? "♩" : "R"}</span>
      <span><strong>${entry.name}</strong><small>${entry.display}</small></span>
    </button>
  `).join("");
}

function renderStick() {
  const { entry, arrangements, error } = currentArrangements();
  els.stickError.hidden = !error;
  els.stickError.textContent = error;
  els.essay.innerHTML = entry
    ? `<h2>${entry.name}</h2><p class="sticking-line">${stickingHTML(entry.display)}</p><p>${entry.about}</p>`
    : `<h2>Custom sticking</h2><p>R is the right hand, L the left, and K the kick. K takes its own step. Rights lead cymbals in the grooves. Lefts sit on the snare unless a backbeat asks them to move. Fills walk the hands down the kit.</p>`;
  renderStickList();
  if (error || !state.stickGrids.length) {
    els.arrangements.innerHTML = error ? "" : `<p class="status">Pick an 8th-note, 16th-note, or triplet grid.</p>`;
    return;
  }
  shown.clear();
  const groups = [];
  for (const arrangement of arrangements) {
    let group = groups.find((item) => item.timing === arrangement.timing);
    if (!group) {
      group = { timing: arrangement.timing, items: [] };
      groups.push(group);
    }
    group.items.push(arrangement);
    shown.set(`${group.timing}:${arrangement.id}`, arrangement);
  }
  els.arrangements.innerHTML = groups.map((group) => `
    <section class="group">
      <h3>${group.timing}</h3>
      ${group.items.map((arrangement) => `
        <article class="card">
          <div class="card-head">
            <div>
              <h4>${arrangement.title}</h4>
              <p>${arrangement.summary}</p>
            </div>
            <button type="button" data-practice="${group.timing}:${arrangement.id}">Practice this</button>
          </div>
          ${renderGrid(arrangement)}
        </article>
      `).join("")}
    </section>
  `).join("");
}

const SOURCE_LABEL = { fill: "Fill", groove: "Groove" };

function practice(arrangement, source) {
  const steps = arrangement.recipe.type === "hands"
    ? GRIDS[arrangement.recipe.grid].stepsPerBeat
    : arrangement.recipe.stepsPerBeat;
  const entry = source
    ? null
    : state.pinnedId
      ? STICKINGS.find((item) => item.id === state.pinnedId)
      : matchEntry(parseSticking(els.stickInput.value).hands || []);
  state.custom = {
    name: source
      ? `${SOURCE_LABEL[source] || "Fill"} · ${arrangement.title}`
      : `${entry ? entry.name : "Custom"} · ${arrangement.title}`,
    detail: arrangement.summary,
    timing: arrangement.timing,
    stepsPerBeat: steps,
    recipe: arrangement.recipe,
  };
  state.bpm = defaultBpm(steps);
  els.bpm.value = String(state.bpm);
  state.bars = 4;
  if (running()) stopLesson();
  state.phase = "idle";
  state.summary = null;
  renderResults();
  setMode("train");
  previewNotes();
  renderTrain();
}

const FILL_LENGTHS = [
  ["all", "All"],
  ["One beat", "One beat"],
  ["Half a bar", "Half a bar"],
  ["One bar", "One bar"],
];

function renderFillPresets() {
  els.fillPresets.innerHTML = FILL_PRESETS.map((preset) => `
    <button type="button" data-fill-preset="${preset.sticking}" aria-pressed="${els.fillInput.value === preset.sticking}">${preset.label}</button>
  `).join("");
}

function renderFillLengths() {
  els.fillLengths.innerHTML = FILL_LENGTHS.map(([id, label]) => `
    <button type="button" data-fill-length="${id}" aria-pressed="${state.fillLength === id}">${label}</button>
  `).join("");
}

function renderFills() {
  const parsed = parseSticking(els.fillInput.value);
  renderFillPresets();
  renderFillLengths();
  els.fillError.hidden = !parsed.error;
  els.fillError.textContent = parsed.error || "";
  if (parsed.error) {
    els.fillList.innerHTML = "";
    return;
  }
  const fills = generateFills(parsed.hands).filter((fill) => state.fillLength === "all" || fill.timing === state.fillLength);
  fillShown.clear();
  const groups = [];
  for (const fill of fills) {
    let group = groups.find((item) => item.timing === fill.timing);
    if (!group) {
      group = { timing: fill.timing, items: [] };
      groups.push(group);
    }
    group.items.push(fill);
    fillShown.set(fill.id, fill);
  }
  els.fillList.innerHTML = groups.map((group) => `
    <section class="group">
      <h3>${group.timing}</h3>
      ${group.items.map((fill) => `
        <article class="card">
          <div class="card-head">
            <div>
              <h4>${fill.title}</h4>
              <p class="sticking-line">${stickingHTML(fill.sticking)}</p>
              <p>${fill.summary}</p>
            </div>
            <button type="button" data-fill-practice="${fill.id}">Practice this</button>
          </div>
          ${renderGrid(fill)}
        </article>
      `).join("")}
    </section>
  `).join("") || `<p class="status">No fills for that length.</p>`;
}

const grooveShown = new Map();

function renderGrooveLevels() {
  const levels = [["all", "All"], ...GROOVE_LEVELS.map((level) => [level, level])];
  els.grooveLevels.innerHTML = levels.map(([id, label]) => `
    <button type="button" data-groove-level="${id}" aria-pressed="${state.grooveLevel === id}">${label}</button>
  `).join("");
}

function renderGrooveList() {
  const grooves = GROOVES.filter((groove) => state.grooveLevel === "all" || groove.level === state.grooveLevel);
  grooveShown.clear();
  const groups = [];
  for (const groove of grooves) {
    let group = groups.find((item) => item.level === groove.level);
    if (!group) {
      group = { level: groove.level, items: [] };
      groups.push(group);
    }
    group.items.push(groove);
    grooveShown.set(groove.id, groove);
  }
  els.grooveList.innerHTML = groups.map((group) => `
    <section class="group">
      <h3>${group.level}</h3>
      ${group.items.map((groove) => `
        <article class="card">
          <div class="card-head">
            <div>
              <h4>${groove.title}</h4>
              <p class="skill">Teaches ${groove.skill.toLowerCase()}</p>
              <p>${groove.summary}</p>
            </div>
            <button type="button" data-groove-practice="${groove.id}">Practice this</button>
          </div>
          ${renderGrid(groove)}
        </article>
      `).join("")}
    </section>
  `).join("") || `<p class="status">No grooves at that level.</p>`;
}

function renderSequencer() {
  const spec = RESOLUTIONS[state.seqResolution];
  els.seqResolution.innerHTML = Object.values(RESOLUTIONS).map((item) => `
    <button type="button" data-seq-res="${item.id}" aria-pressed="${item.id === state.seqResolution}">${item.label}</button>
  `).join("");
  const head = [`<span></span>`];
  for (let step = 0; step < spec.steps; step += 1) {
    const beat = step % spec.stepsPerBeat === 0 ? " beat" : "";
    head.push(`<span class="head${beat}">${subdivisionLabel(step, spec.stepsPerBeat)}</span>`);
  }
  const rows = SEQUENCER_VOICES.map((voice) => {
    const cells = [`<span class="lane">${voice.label}</span>`];
    for (let step = 0; step < spec.steps; step += 1) {
      const on = state.seqGrid[voice.id][step];
      const beat = step % spec.stepsPerBeat === 0 ? " beat" : "";
      const beatInBar = Math.floor(step / spec.stepsPerBeat) % 4;
      const accent = on && voice.id === "snare" && step % spec.stepsPerBeat === 0 && (beatInBar === 1 || beatInBar === 3) ? " accent" : "";
      const tone = voice.hand === "L" ? "l" : voice.hand === "F" ? "f" : "r";
      cells.push(`<button type="button" class="seq-cell${on ? ` on ${tone}` : ""}${accent}${beat}" data-seq-voice="${voice.id}" data-seq-step="${step}" aria-pressed="${on}" aria-label="${voice.label} ${subdivisionLabel(step, spec.stepsPerBeat) || "step"}">${on ? voice.token : ""}</button>`);
    }
    return cells.join("");
  });
  els.sequencer.innerHTML = `<div class="seq-scroll"><div class="seq" style="--cols:${spec.steps}">${head.join("")}${rows.join("")}</div></div>`;
}

function renderGrooves() {
  renderGrooveLevels();
  renderSequencer();
  renderGrooveList();
}

function loop() {
  highway.frame(view());
  updateProgress();
  requestAnimationFrame(loop);
}

function bind() {
  document.querySelector("#fill-form").addEventListener("submit", (event) => event.preventDefault());
  els.tabTrain.addEventListener("click", () => setMode("train"));
  els.tabFills.addEventListener("click", () => setMode("fills"));
  els.tabGrooves.addEventListener("click", () => setMode("grooves"));
  els.tabStick.addEventListener("click", () => setMode("stick"));
  els.kitOpen.addEventListener("click", () => {
    const open = els.kit.hidden;
    els.kit.hidden = !open;
    els.kitOpen.setAttribute("aria-expanded", String(open));
    if (open) midi.connect();
  });
  els.midiConnect.addEventListener("click", () => midi.connect());
  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    renderRudimentList();
  });
  els.families.addEventListener("click", (event) => {
    const button = event.target.closest("[data-family]");
    if (!button) return;
    state.family = button.dataset.family;
    renderFamilies();
    renderRudimentList();
  });
  els.rudimentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) selectRudiment(button.dataset.id);
  });
  els.bpm.addEventListener("input", () => {
    state.bpm = Number(els.bpm.value);
    els.bpmRead.textContent = String(state.bpm);
    if (!running()) wakeSettings();
  });
  els.subdivision.addEventListener("click", (event) => {
    const button = event.target.closest("[data-note-value]");
    if (!button || running() || state.custom) return;
    state.noteValue = button.dataset.noteValue;
    wakeSettings();
    renderTrain();
  });
  els.bars.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bars]");
    if (!button || running()) return;
    state.bars = Number(button.dataset.bars);
    wakeSettings();
    renderTrain();
  });
  els.hear.addEventListener("click", () => runLesson(true));
  els.start.addEventListener("click", () => runLesson(false));
  els.stop.addEventListener("click", stopLesson);
  els.calibration.addEventListener("input", () => {
    state.calibration = Number(els.calibration.value);
    localStorage.setItem("handline-calibration", String(state.calibration));
    paintCalibration();
  });
  els.pads.addEventListener("pointerdown", (event) => {
    const pad = event.target.closest("[data-pad]");
    if (!pad) return;
    event.preventDefault();
    onStrike(pad.dataset.pad, 104);
  });
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const target = event.target;
    if (target && (target.matches("input, textarea") || target.isContentEditable)) return;
    const element = KEY_MAP[event.code];
    if (!element) return;
    event.preventDefault();
    onStrike(element, 108);
  });
  els.stickList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stick]");
    if (!button) return;
    const entry = STICKINGS.find((item) => item.id === button.dataset.stick);
    els.stickInput.value = entry.display;
    state.stickText = entry.display;
    state.pinnedId = entry.pattern ? entry.id : null;
    renderStick();
  });
  els.stickInput.addEventListener("input", () => {
    state.stickText = els.stickInput.value;
    if (state.pinnedId) {
      const entry = STICKINGS.find((item) => item.id === state.pinnedId);
      if (!entry || els.stickInput.value !== entry.display) state.pinnedId = null;
    }
    renderStick();
  });
  els.gridChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-grid]");
    if (!button) return;
    const id = button.dataset.grid;
    state.stickGrids = state.stickGrids.includes(id)
      ? state.stickGrids.filter((grid) => grid !== id)
      : [...state.stickGrids, id];
    renderGridChips();
    renderStick();
  });
  els.fillInput.addEventListener("input", () => {
    state.fillText = els.fillInput.value;
    renderFills();
  });
  els.fillPresets.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fill-preset]");
    if (!button) return;
    els.fillInput.value = button.dataset.fillPreset;
    state.fillText = button.dataset.fillPreset;
    renderFills();
  });
  els.fillLengths.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fill-length]");
    if (!button) return;
    state.fillLength = button.dataset.fillLength;
    renderFills();
  });
  els.fillList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fill-practice]");
    if (!button) return;
    const fill = fillShown.get(button.dataset.fillPractice);
    if (fill) practice(fill, "fill");
  });
  els.grooveLevels.addEventListener("click", (event) => {
    const button = event.target.closest("[data-groove-level]");
    if (!button) return;
    state.grooveLevel = button.dataset.grooveLevel;
    renderGrooveLevels();
    renderGrooveList();
  });
  els.grooveList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-groove-practice]");
    if (!button) return;
    const groove = grooveShown.get(button.dataset.groovePractice);
    if (groove) practice(groove, "groove");
  });
  els.seqResolution.addEventListener("click", (event) => {
    const button = event.target.closest("[data-seq-res]");
    if (!button || button.dataset.seqRes === state.seqResolution) return;
    state.seqGrid = remapGrid(state.seqGrid, state.seqResolution, button.dataset.seqRes);
    state.seqResolution = button.dataset.seqRes;
    els.seqError.hidden = true;
    renderSequencer();
  });
  els.sequencer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-seq-voice]");
    if (!button) return;
    const voice = button.dataset.seqVoice;
    const step = Number(button.dataset.seqStep);
    state.seqGrid[voice][step] = !state.seqGrid[voice][step];
    els.seqError.hidden = true;
    renderSequencer();
  });
  document.querySelector("#seq-clear").addEventListener("click", () => {
    state.seqGrid = emptyGrid(state.seqResolution);
    els.seqError.hidden = true;
    renderSequencer();
  });
  document.querySelector("#seq-play").addEventListener("click", () => {
    const groove = sequencerGroove(state.seqGrid, state.seqResolution);
    if (!groove.notes.length) {
      els.seqError.hidden = false;
      els.seqError.textContent = "Add at least one hit.";
      return;
    }
    practice(groove, "groove");
  });
  els.arrangements.addEventListener("click", (event) => {
    const button = event.target.closest("[data-practice]");
    if (!button) return;
    const arrangement = shown.get(button.dataset.practice);
    if (arrangement) practice(arrangement);
  });
}

function renderGridChips() {
  const chips = [
    ["8", "8ths"],
    ["16", "16ths"],
    ["12", "Triplets"],
  ];
  els.gridChips.innerHTML = chips.map(([id, label]) => `
    <button type="button" data-grid="${id}" aria-pressed="${state.stickGrids.includes(id)}">${label}</button>
  `).join("");
}

const midi = createMidi({
  onNote: ({ note, velocity, element, label }) => {
    state.midi.last = element ? `${label} · note ${note} · vel ${velocity}` : `${label} · vel ${velocity}`;
    renderMidi();
    if (element) onStrike(element, velocity);
  },
  onStatus: (status) => {
    state.midi = { ...state.midi, ...status, last: state.midi.last };
    renderMidi();
  },
});

els.bars.innerHTML = [2, 4, 8].map((bars) =>
  `<button type="button" data-bars="${bars}" aria-pressed="${bars === 4}">${bars} bars</button>`).join("");
els.calibration.value = String(state.calibration);
els.bpm.value = "80";
els.stickInput.value = state.stickText;
els.fillInput.value = state.fillText;
renderFamilies();
renderPads();
renderKit();
renderGridChips();
paintCalibration();
renderMidi();
bind();
selectRudiment("paradiddle");
renderStick();
requestAnimationFrame(loop);
midi.connect();
