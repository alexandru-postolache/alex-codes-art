// Grooves loop one phrase the way fills do. Each one is here for a skill.
// Hands: hi-hat is the right hand, snare is the left, kick is the foot.
// A snare on beat 2 or 4 is accented. Ghost snares are the same hand, quieter.

export const GROOVE_LEVELS = ["Easy", "Medium", "Hard"];

export const SEQUENCER_VOICES = [
  { id: "hat", label: "Hi-hat", hand: "R", element: "hat", token: "R" },
  { id: "snare", label: "Snare", hand: "L", element: "snare", token: "L" },
  { id: "kick", label: "Kick", hand: "F", element: "kick", token: "K" },
];

export const RESOLUTIONS = {
  8: { id: "8", stepsPerBeat: 2, steps: 8, label: "8ths", timing: "8th notes" },
  16: { id: "16", stepsPerBeat: 4, steps: 16, label: "16ths", timing: "16th notes" },
};

function note(step, stepsPerBeat, hand, element, accent, velocity) {
  const hit = {
    beat: step / stepsPerBeat,
    baseStep: step,
    hand,
    element,
    accent: !!accent,
    grace: false,
    graceIndex: 0,
    graceCount: 0,
    group: `g${step}:${element}`,
  };
  if (velocity) hit.velocity = velocity;
  return hit;
}

function pack(spec, events) {
  const notes = events
    .map((event) => note(event.step, spec.stepsPerBeat, event.hand, event.element, event.accent, event.velocity))
    .sort((a, b) => a.baseStep - b.baseStep || a.element.localeCompare(b.element));
  return {
    id: spec.id,
    title: spec.title,
    level: spec.level,
    skill: spec.skill,
    timing: spec.timing,
    beats: spec.beats,
    steps: spec.steps,
    stepsPerBeat: spec.stepsPerBeat,
    kind: "groove",
    summary: spec.summary,
    notes,
    recipe: {
      type: "phrase",
      notes,
      phraseBeats: spec.beats,
      phraseSteps: spec.steps,
      stepsPerBeat: spec.stepsPerBeat,
    },
  };
}

function everyStep(count, make) {
  const events = [];
  for (let step = 0; step < count; step += 1) events.push(...make(step));
  return events;
}

function hat(step, stepsPerBeat) {
  return { step, hand: "R", element: "hat", accent: step % stepsPerBeat === 0 };
}

function kick(step) {
  return { step, hand: "F", element: "kick", accent: true };
}

function snare(step, accent, velocity) {
  return { step, hand: "L", element: "snare", accent, velocity };
}

const backbeat = pack({
  id: "backbeat",
  title: "Backbeat",
  level: "Easy",
  skill: "The backbeat",
  timing: "8th notes",
  beats: 4,
  steps: 8,
  stepsPerBeat: 2,
  summary: "The backbeat. Right-hand hats on every 8th, kick on 1 and 3, left-hand snare on 2 and 4. Almost every other groove is a change to this one.",
}, everyStep(8, (step) => {
  const events = [hat(step, 2)];
  if (step === 0 || step === 4) events.push(kick(step));
  if (step === 2 || step === 6) events.push(snare(step, true));
  return events;
}));

const fourOnTheFloor = pack({
  id: "four-on-the-floor",
  title: "Four on the floor",
  level: "Easy",
  skill: "A kick that does not stop",
  timing: "8th notes",
  beats: 4,
  steps: 8,
  stepsPerBeat: 2,
  summary: "A kick that does not stop. The foot plays every quarter while the snare still answers on 2 and 4. Hats stay on the 8ths.",
}, everyStep(8, (step) => {
  const events = [hat(step, 2)];
  if (step % 2 === 0) events.push(kick(step));
  if (step === 2 || step === 6) events.push(snare(step, true));
  return events;
}));

const offbeat = pack({
  id: "offbeat-hats",
  title: "Offbeat hats",
  level: "Easy",
  skill: "Playing on the and",
  timing: "8th notes",
  beats: 4,
  steps: 8,
  stepsPerBeat: 2,
  summary: "The and. Hats only on the +, so the beat itself is a rest in the hand. Kick stays on 1 and 3, snare on 2 and 4.",
}, everyStep(8, (step) => {
  const events = [];
  if (step % 2 === 1) events.push(hat(step, 2));
  if (step === 0 || step === 4) events.push(kick(step));
  if (step === 2 || step === 6) events.push(snare(step, true));
  return events;
}));

const sixteenths = pack({
  id: "sixteenth-hats",
  title: "Sixteenth-note hats",
  level: "Medium",
  skill: "Even 16ths",
  timing: "16th notes",
  beats: 4,
  steps: 16,
  stepsPerBeat: 4,
  summary: "Even 16ths. The feet are the backbeat: kick on 1 and 3, snare on 2 and 4. The right hand plays every 16th and has to stay even.",
}, everyStep(16, (step) => {
  const events = [hat(step, 4)];
  if (step === 0 || step === 8) events.push(kick(step));
  if (step === 4 || step === 12) events.push(snare(step, true));
  return events;
}));

const displaced = pack({
  id: "displaced-kick",
  title: "Displaced kick",
  level: "Medium",
  skill: "The kick can move",
  timing: "8th notes",
  beats: 4,
  steps: 8,
  stepsPerBeat: 2,
  summary: "The kick can move. Hats and the snare on 2 and 4 stay put. The kick plays on 1, the + of 2, and 3.",
}, everyStep(8, (step) => {
  const events = [hat(step, 2)];
  if (step === 0 || step === 3 || step === 4) events.push(kick(step));
  if (step === 2 || step === 6) events.push(snare(step, true));
  return events;
}));

const shuffle = pack({
  id: "shuffle",
  title: "Shuffle",
  level: "Medium",
  skill: "The shuffle",
  timing: "Shuffle",
  beats: 4,
  steps: 12,
  stepsPerBeat: 3,
  summary: "The shuffle. Triplet hats with the middle note left out, so each beat is long-short. Kick on 1 and 3, snare on 2 and 4.",
}, everyStep(4, (beat) => {
  const events = [
    hat(beat * 3, 3),
    hat(beat * 3 + 2, 3),
  ];
  if (beat === 0 || beat === 2) events.push(kick(beat * 3));
  if (beat === 1 || beat === 3) events.push(snare(beat * 3, true));
  return events;
}));

const halftime = pack({
  id: "half-time",
  title: "Half time",
  level: "Medium",
  skill: "Half time",
  timing: "8th notes",
  beats: 4,
  steps: 8,
  stepsPerBeat: 2,
  summary: "Half time. Hats keep the 8ths and the kick stays on 1, but the snare waits until beat 3. The bar feels twice as long.",
}, everyStep(8, (step) => {
  const events = [hat(step, 2)];
  if (step === 0) events.push(kick(step));
  if (step === 4) events.push(snare(step, true));
  return events;
}));

const ghosts = pack({
  id: "ghost-notes",
  title: "Ghost notes",
  level: "Hard",
  skill: "Loud and quiet on one drum",
  timing: "16th notes",
  beats: 4,
  steps: 16,
  stepsPerBeat: 4,
  summary: "Loud and quiet on one drum. 16th-note hats, kick on 1 and 3. The snare is accented on 2 and 4, and the left hand adds quiet notes on every e and a.",
}, everyStep(16, (step) => {
  const events = [hat(step, 4)];
  const place = step % 4;
  const beat = Math.floor(step / 4);
  if (place === 0 && (beat === 0 || beat === 2)) events.push(kick(step));
  if (place === 0 && (beat === 1 || beat === 3)) events.push(snare(step, true));
  if (place === 1 || place === 3) events.push(snare(step, false, 46));
  return events;
}));

const linearPattern = [
  ["F", "kick", true],
  ["R", "hat", false],
  ["L", "snare", false],
  ["R", "hat", false],
  ["L", "snare", true],
  ["R", "hat", false],
  ["F", "kick", false],
  ["R", "hat", false],
  ["F", "kick", true],
  ["R", "hat", false],
  ["L", "snare", false],
  ["R", "hat", false],
  ["L", "snare", true],
  ["R", "hat", false],
  ["F", "kick", false],
  ["R", "hat", false],
];

const linear = pack({
  id: "linear",
  title: "Linear",
  level: "Hard",
  skill: "One limb at a time",
  timing: "16th notes",
  beats: 4,
  steps: 16,
  stepsPerBeat: 4,
  summary: "One limb at a time. Each 16th is a single surface: hat, snare, or kick, and never two together. The snare on 2 and 4 is the accent.",
}, linearPattern.map(([hand, element, accent], step) => ({ step, hand, element, accent })));

const twoBar = pack({
  id: "two-bar",
  title: "Two-bar phrase",
  level: "Hard",
  skill: "A phrase longer than one bar",
  timing: "Two bars",
  beats: 8,
  steps: 16,
  stepsPerBeat: 2,
  summary: "A phrase longer than one bar. Bar one is the backbeat. Bar two keeps the hats and the snare, and moves the kick to 1, the + of 2, 3, and the + of 4.",
}, everyStep(16, (step) => {
  const events = [hat(step, 2)];
  const inBar = step % 8;
  const bar = step < 8 ? 0 : 1;
  if (bar === 0 && (inBar === 0 || inBar === 4)) events.push(kick(step));
  if (bar === 1 && (inBar === 0 || inBar === 3 || inBar === 4 || inBar === 7)) events.push(kick(step));
  if (inBar === 2 || inBar === 6) events.push(snare(step, true));
  return events;
}));

export const GROOVES = [
  backbeat,
  fourOnTheFloor,
  offbeat,
  sixteenths,
  displaced,
  shuffle,
  halftime,
  ghosts,
  linear,
  twoBar,
];

export function emptyGrid(resolution = "8") {
  const steps = RESOLUTIONS[resolution].steps;
  return {
    hat: Array.from({ length: steps }, () => false),
    snare: Array.from({ length: steps }, () => false),
    kick: Array.from({ length: steps }, () => false),
  };
}

export function remapGrid(grid, from, to) {
  if (from === to) {
    return {
      hat: grid.hat.slice(),
      snare: grid.snare.slice(),
      kick: grid.kick.slice(),
    };
  }
  const next = emptyGrid(to);
  const voices = ["hat", "snare", "kick"];
  if (from === "8" && to === "16") {
    for (const voice of voices) {
      grid[voice].forEach((on, step) => {
        if (on) next[voice][step * 2] = true;
      });
    }
    return next;
  }
  for (const voice of voices) {
    for (let step = 0; step < 8; step += 1) {
      next[voice][step] = Boolean(grid[voice][step * 2] || grid[voice][step * 2 + 1]);
    }
  }
  return next;
}

export function sequencerGroove(grid, resolution = "8") {
  const spec = RESOLUTIONS[resolution];
  const events = [];
  for (let step = 0; step < spec.steps; step += 1) {
    const onBeat = step % spec.stepsPerBeat === 0;
    const beat = Math.floor(step / spec.stepsPerBeat) % 4;
    const backbeatHit = onBeat && (beat === 1 || beat === 3);
    if (grid.hat?.[step]) events.push({ step, hand: "R", element: "hat", accent: onBeat });
    if (grid.snare?.[step]) events.push({ step, hand: "L", element: "snare", accent: backbeatHit });
    if (grid.kick?.[step]) events.push({ step, hand: "F", element: "kick", accent: onBeat });
  }
  return pack({
    id: "sequencer",
    title: "Your groove",
    level: "Yours",
    skill: "A bar you wrote",
    timing: spec.timing,
    beats: 4,
    steps: spec.steps,
    stepsPerBeat: spec.stepsPerBeat,
    summary: events.length
      ? `A bar you wrote, in ${spec.timing}. Hi-hat is the right hand, snare is the left, kick is the foot. A snare on 2 or 4 is accented.`
      : "This bar is empty.",
  }, events);
}
