import assert from "node:assert/strict";
import test from "node:test";
import { generateFills } from "../js/fills.js";
import { GROOVE_LEVELS, GROOVES, emptyGrid, remapGrid, sequencerGroove } from "../js/grooves.js";
import { NITRO_MAX } from "../js/kit.js";
import { buildChart, formatSticking, parsePattern } from "../js/pattern.js";
import {
  RUDIMENTS,
  chartFor,
  defaultNoteValue,
  noteValueOptions,
  stepsForNoteValue,
} from "../js/rudiments.js";
import {
  graceLeads,
  registerHit,
  schedule,
  starRating,
  summarize,
  timingSentence,
} from "../js/score.js";
import {
  STICKINGS,
  arrangementsFor,
  arrangementsFromPattern,
  classicHertas,
  expandHands,
  generateArrangements,
  materialize,
  parseSticking,
} from "../js/stickings.js";

const ELEMENTS = new Set(["crash", "ride", "hat", "tom1", "tom2", "snare", "floor", "kick"]);

test("the 40 PAS rudiments parse into playable snare charts", () => {
  assert.equal(RUDIMENTS.length, 40);
  const numbers = RUDIMENTS.map((rudiment) => rudiment.number);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  assert.equal(new Set(numbers).size, 40);
  for (const rudiment of RUDIMENTS) {
    const chart = chartFor(rudiment, 2);
    assert.ok(chart.length > 0, rudiment.name);
    for (const note of chart) {
      assert.equal(note.element, "snare");
      assert.ok(note.hand === "R" || note.hand === "L");
    }
  }
  const byId = Object.fromEntries(RUDIMENTS.map((rudiment) => [rudiment.id, rudiment]));
  assert.equal(byId.paradiddle.cellSteps, 8);
  assert.equal(byId.paradiddle.sticking, "R L R R L R L L");
  assert.equal(byId["five-stroke"].cellSteps, 16);
  assert.equal(byId["five-stroke"].notes.filter((note) => !note.grace).length, 10);
  assert.equal(byId["single-stroke-seven"].cellSteps, 16);
  assert.equal(byId.flam.notes.filter((note) => note.grace).length, 2);
  assert.equal(formatSticking(parsePattern("lRrL")), "lR rL");
});

test("every rudiment can be played as 8th notes or as 16th notes", () => {
  const paradiddle = RUDIMENTS.find((rudiment) => rudiment.id === "paradiddle");
  const eighths = chartFor(paradiddle, 1, 2);
  const sixteenths = chartFor(paradiddle, 1, 4);
  const primaries = (notes) => notes.filter((note) => !note.grace);
  assert.equal(defaultNoteValue(paradiddle), "16");
  assert.equal(stepsForNoteValue(paradiddle, "8"), 2);
  assert.equal(stepsForNoteValue(paradiddle, "16"), 4);
  assert.equal(primaries(eighths).length, 8);
  assert.equal(eighths[1].beat, 0.5);
  assert.equal(primaries(sixteenths).length, 16);
  assert.equal(sixteenths[1].beat, 0.25);
  assert.equal(chartFor(paradiddle, 1).length, primaries(sixteenths).length);

  const flam = RUDIMENTS.find((rudiment) => rudiment.id === "flam");
  assert.equal(defaultNoteValue(flam), "8");
  assert.equal(noteValueOptions(flam).map((option) => option.id).join(","), "8,16");
  const flam16 = chartFor(flam, 1, stepsForNoteValue(flam, "16"));
  assert.equal(primaries(flam16).length, 16);
  assert.ok(flam16.some((note) => note.grace));

  const accent = RUDIMENTS.find((rudiment) => rudiment.id === "flam-accent");
  assert.equal(defaultNoteValue(accent), "written");
  assert.equal(stepsForNoteValue(accent, "written"), 3);
  assert.ok(noteValueOptions(accent).some((option) => option.id === "written"));
  assert.equal(chartFor(accent, 1, 4).filter((note) => !note.grace).length, 16);

  for (const rudiment of RUDIMENTS) {
    for (const grid of [2, 4]) {
      const chart = chartFor(rudiment, 2, grid);
      assert.ok(chart.length > 0, `${rudiment.name} at ${grid}`);
      assert.ok(chart.every((note) => note.element === "snare"));
    }
  }
});

test("a flam is scored on the main stroke when the hit is on the beat", () => {
  const chart = buildChart(parsePattern("lR"), { bars: 1, stepsPerBeat: 2 });
  const notes = schedule(chart, 10, 80, 2);
  const primary = notes.find((note) => !note.grace && note.beat === 0);
  const grace = notes.find((note) => note.grace && note.baseStep === 0);
  assert.ok(grace.time < primary.time);
  assert.equal(primary.time, 10);
  const hit = registerHit(notes, "snare", 10);
  assert.equal(hit.grace, false);
  assert.equal(hit.result, "perfect");
  const graceHit = registerHit(notes, "snare", grace.time);
  assert.equal(graceHit, grace);
});

test("timing windows, misses, and stars", () => {
  const notes = [
    { element: "snare", time: 1, hand: "R", grace: false },
    { element: "snare", time: 2, hand: "L", grace: false },
  ].map((note, id) => ({ ...note, id, result: null, deltaMs: null }));
  assert.equal(registerHit(notes, "snare", 1.03).result, "perfect");
  assert.equal(registerHit(notes, "snare", 2.2), null);
  notes[1].result = "miss";
  const summary = summarize(notes);
  assert.equal(summary.counts.perfect, 1);
  assert.equal(summary.counts.miss, 1);
  assert.equal(summary.stars, starRating(summary.score, summary.played));
  assert.ok(summary.score < 93);
  assert.match(timingSentence(-14), /early/);
  assert.match(timingSentence(2), /pocket/);
  assert.equal(starRating(100, 10), 5);
  assert.equal(starRating(50, 0), 0);
});

test("grace notes stay closer to their stroke than to the previous one", () => {
  for (const stepMs of [80, 180, 375]) {
    const [far, near] = graceLeads(2, stepMs);
    assert.ok(far > near);
    assert.ok(far <= stepMs * 0.46 + 0.5);
    const [single] = graceLeads(1, stepMs);
    assert.ok(single <= 34);
    assert.ok(single <= stepMs * 0.46 + 0.5);
  }
});

test("Nitro Max notes land on the right pads", () => {
  assert.equal(NITRO_MAX[36], "kick");
  assert.equal(NITRO_MAX[38], "snare");
  assert.equal(NITRO_MAX[40], "snare");
  assert.equal(NITRO_MAX[48], "tom1");
  assert.equal(NITRO_MAX[45], "tom2");
  assert.equal(NITRO_MAX[43], "floor");
  assert.equal(NITRO_MAX[42], "hat");
  assert.equal(NITRO_MAX[46], "hat");
  assert.equal(NITRO_MAX[44], null);
  assert.equal(NITRO_MAX[49], "crash");
  assert.equal(NITRO_MAX[51], "ride");
});

test("paradiddle grooves put the backbeat and the kick on the right beats", () => {
  const hands = ["R", "L", "R", "R", "L", "R", "L", "L"];
  const notes = expandHands(hands, 4, 2, "hats");
  const at = (step, element) => notes.filter((note) => note.baseStep === step && note.element === element);
  assert.equal(at(0, "hat")[0].hand, "R");
  assert.equal(at(0, "kick").length, 1);
  assert.equal(at(4, "snare")[0].hand, "L");
  assert.equal(at(4, "snare")[0].accent, true);
  assert.equal(at(12, "snare")[0].accent, true);
  assert.equal(at(8, "kick").length, 1);
  assert.equal(notes.filter((note) => note.element === "kick").length, 4);
  for (const step of [0, 8, 16, 24]) {
    assert.equal(notes.filter((note) => note.baseStep === step && note.hand !== "F").length, 1);
  }
});

test("fills use the kit, and linear grooves give 1 and 3 to the kick", () => {
  const hands = ["R", "L", "R", "L"];
  const fill = expandHands(hands, 4, 1, "down");
  const used = new Set(fill.map((note) => note.element));
  for (const element of ["snare", "tom1", "tom2", "floor", "kick"]) {
    assert.ok(used.has(element), element);
  }
  const linear = expandHands(["R", "L", "R", "R", "L", "R", "L", "L"], 4, 1, "linear");
  for (const step of [0, 8]) {
    const there = linear.filter((note) => note.baseStep === step);
    assert.deepEqual(there.map((note) => note.element), ["kick"]);
  }
  assert.ok(linear.some((note) => note.baseStep === 4 && note.element === "snare" && note.accent));
});

test("a written K is the kick and takes that step alone", () => {
  const parsed = parseSticking("R L K L");
  assert.deepEqual(parsed.hands, ["R", "L", "K", "L"]);
  assert.deepEqual(parseSticking("rlk").hands, ["R", "L", "K"]);
  const snare = expandHands(parsed.hands, 4, 1, "snare");
  const at = (step) => snare.filter((note) => note.baseStep === step);
  assert.deepEqual(at(0).map((note) => note.element), ["snare"]);
  assert.deepEqual(at(2).map((note) => [note.element, note.hand]), [["kick", "F"]]);
  const hats = expandHands(parsed.hands, 4, 1, "hats");
  assert.equal(hats.filter((note) => note.baseStep === 0 && note.element === "kick").length, 0);
  assert.equal(hats.find((note) => note.baseStep === 0).element, "hat");
  assert.deepEqual(
    hats.filter((note) => note.baseStep === 2).map((note) => note.element),
    ["kick"],
  );
  const linear = expandHands(parsed.hands, 4, 1, "linear");
  assert.equal(linear.find((note) => note.baseStep === 0).element, "hat");
  assert.equal(linear.find((note) => note.baseStep === 2).element, "kick");
  const plain = expandHands(["R", "L"], 4, 1, "hats");
  assert.equal(plain.filter((note) => note.baseStep === 0 && note.element === "kick").length, 1);
});

test("custom stickings reject junk and generate both grids", () => {
  assert.ok(parseSticking("R L R R").hands);
  assert.ok(parseSticking("RLX").error);
  const arrangements = generateArrangements(["R", "L", "L", "R"], { grids: ["8", "16"], bars: 2 });
  assert.ok(arrangements.some((item) => item.timing === "8th notes" && item.kind === "groove"));
  assert.ok(arrangements.some((item) => item.timing === "16th notes" && item.kind === "fill"));
  for (const arrangement of arrangements) {
    assert.ok(arrangement.notes.length > 0);
    for (const note of arrangement.notes) assert.ok(ELEMENTS.has(note.element));
  }
});

test("flam taps keep a single main stroke per attack", () => {
  const snare = arrangementsFromPattern("lRRrLL", { grids: ["8"], bars: 1 })
    .find((item) => item.id === "snare-8");
  assert.equal(snare.notes.filter((note) => !note.grace).length, 8);
  assert.ok(snare.notes.some((note) => note.grace && note.element === "snare"));
});

function fillDurations(fill) {
  const slots = [...new Set(fill.notes.map((note) => note.baseStep))].sort((a, b) => a - b);
  const gaps = slots.slice(1).map((slot, index) => slot - slots[index]);
  gaps.push(fill.slots - slots[slots.length - 1]);
  return gaps;
}

test("fills mix 8ths and 16ths across three lengths", () => {
  const fills = generateFills(["R", "L", "R", "R", "L", "R", "L", "L"]);
  assert.equal(fills.length, 18);
  const sigs = fills.map((fill) => fill.notes.map((note) => `${note.baseStep}:${note.element}:${note.hand}`).join("|"));
  assert.equal(new Set(sigs).size, fills.length);
  for (const beats of [1, 2, 4]) {
    const group = fills.filter((fill) => fill.beats === beats);
    assert.ok(group.length >= 4, `length ${beats}`);
  }
  for (const fill of fills) {
    const durations = fillDurations(fill);
    assert.ok(durations.includes(1) && durations.includes(2), fill.id);
    assert.equal(durations.reduce((sum, duration) => sum + duration, 0), fill.slots);
    assert.ok(durations.every((duration) => duration === 1 || duration === 2));
    assert.ok(fill.notes.every((note) => ELEMENTS.has(note.element)));
    assert.ok(new Set(fill.notes.map((note) => note.element)).size > 1, fill.id);
  }
  const quarter = fills.find((fill) => fill.beats === 1);
  const looped = materialize(quarter.recipe, 1);
  assert.equal(looped.length, quarter.notes.length * 4);
  const keys = new Set(looped.map((note) => `${note.baseStep}:${note.element}:${note.hand}`));
  assert.equal(keys.size, looped.length);
  assert.ok(looped.every((note) => note.baseStep < 16));

  const kicked = generateFills(["R", "L", "K", "L"]);
  const landed = kicked.find((fill) => fill.id === "quarter-land-descend");
  assert.deepEqual(landed.notes.filter((note) => note.baseStep === 2).map((note) => note.element), ["kick"]);
  const button = fills.find((fill) => fill.id === "bar-build-punctuate");
  const lastSlot = Math.max(...button.notes.map((note) => note.baseStep));
  const ending = button.notes.filter((note) => note.baseStep === lastSlot).map((note) => note.element).sort();
  assert.ok(ending.includes("crash") || ending.includes("floor"));
  assert.ok(ending.includes("kick"));
});

test("library stickings and the classic herta rhythm", () => {
  for (const id of ["singles", "paradiddle", "herta", "flam-tap", "drag"]) {
    const entry = STICKINGS.find((item) => item.id === id);
    const arrangements = arrangementsFor(entry, ["16"]);
    assert.ok(arrangements.length > 0, id);
    if (id === "herta") assert.ok(arrangements.some((item) => item.id === "herta-classic"));
  }
  const herta = classicHertas()[0];
  const steps = herta.notes.map((note) => note.baseStep);
  const gaps = steps.slice(1).map((step, index) => step - steps[index]);
  assert.ok(gaps.includes(1));
  assert.ok(gaps.includes(2));
});

function stepsOf(groove, element) {
  return groove.notes.filter((note) => note.element === element).map((note) => note.baseStep);
}

test("grooves teach one skill each and loop like a fill", () => {
  assert.equal(GROOVES.length, 10);
  const rank = { Easy: 0, Medium: 1, Hard: 2 };
  const skills = new Set();
  for (let index = 0; index < GROOVES.length; index += 1) {
    const groove = GROOVES[index];
    assert.ok(GROOVE_LEVELS.includes(groove.level), groove.id);
    assert.ok(groove.skill, groove.id);
    skills.add(groove.skill);
    if (index > 0) assert.ok(rank[groove.level] >= rank[GROOVES[index - 1].level]);
    assert.equal(groove.recipe.type, "phrase");
    assert.equal(groove.recipe.phraseBeats, groove.beats);
    assert.equal(groove.recipe.phraseSteps, groove.steps);
    assert.ok(groove.notes.length > 0, groove.id);
    assert.ok(groove.notes.every((note) => ELEMENTS.has(note.element)));
    const looped = materialize(groove.recipe, 4);
    const repeats = (16 / groove.beats);
    assert.equal(looped.length, groove.notes.length * repeats, groove.id);
    const keys = new Set(looped.map((note) => `${note.baseStep}:${note.element}:${note.hand}`));
    assert.equal(keys.size, looped.length, groove.id);
    assert.ok(looped.every((note) => note.baseStep < groove.stepsPerBeat * 16), groove.id);
  }
  assert.equal(skills.size, GROOVES.length);
  for (const level of GROOVE_LEVELS) {
    assert.ok(GROOVES.filter((groove) => groove.level === level).length >= 3, level);
  }

  const backbeat = GROOVES.find((groove) => groove.id === "backbeat");
  assert.deepEqual(stepsOf(backbeat, "kick"), [0, 4]);
  assert.deepEqual(stepsOf(backbeat, "snare"), [2, 6]);
  assert.ok(backbeat.notes.filter((note) => note.element === "snare").every((note) => note.accent));
  assert.equal(stepsOf(backbeat, "hat").length, 8);
  assert.ok(backbeat.notes.filter((note) => note.element === "hat").every((note) => note.hand === "R"));

  const floor = GROOVES.find((groove) => groove.id === "four-on-the-floor");
  assert.deepEqual(stepsOf(floor, "kick"), [0, 2, 4, 6]);

  const offbeat = GROOVES.find((groove) => groove.id === "offbeat-hats");
  assert.deepEqual(stepsOf(offbeat, "hat"), [1, 3, 5, 7]);

  const sixteenths = GROOVES.find((groove) => groove.id === "sixteenth-hats");
  assert.equal(sixteenths.stepsPerBeat, 4);
  assert.equal(stepsOf(sixteenths, "hat").length, 16);

  const displaced = GROOVES.find((groove) => groove.id === "displaced-kick");
  assert.deepEqual(stepsOf(displaced, "kick"), [0, 3, 4]);

  const shuffle = GROOVES.find((groove) => groove.id === "shuffle");
  assert.equal(shuffle.stepsPerBeat, 3);
  assert.deepEqual(stepsOf(shuffle, "hat"), [0, 2, 3, 5, 6, 8, 9, 11]);
  assert.deepEqual(stepsOf(shuffle, "kick"), [0, 6]);
  assert.deepEqual(stepsOf(shuffle, "snare"), [3, 9]);

  const half = GROOVES.find((groove) => groove.id === "half-time");
  assert.deepEqual(stepsOf(half, "kick"), [0]);
  assert.deepEqual(stepsOf(half, "snare"), [4]);

  const ghosts = GROOVES.find((groove) => groove.id === "ghost-notes");
  const ghostSnares = ghosts.notes.filter((note) => note.element === "snare");
  assert.deepEqual(ghostSnares.filter((note) => note.accent).map((note) => note.baseStep), [4, 12]);
  const quiet = ghostSnares.filter((note) => !note.accent);
  assert.equal(quiet.length, 8);
  assert.ok(quiet.every((note) => note.velocity < 70));

  const linear = GROOVES.find((groove) => groove.id === "linear");
  const occupied = new Map();
  for (const note of linear.notes) occupied.set(note.baseStep, (occupied.get(note.baseStep) || 0) + 1);
  assert.equal(linear.notes.length, 16);
  assert.ok([...occupied.values()].every((count) => count === 1));
  assert.deepEqual(stepsOf(linear, "snare").filter((step) => linear.notes.find((note) => note.element === "snare" && note.baseStep === step && note.accent)), [4, 12]);

  const phrase = GROOVES.find((groove) => groove.id === "two-bar");
  assert.equal(phrase.beats, 8);
  assert.deepEqual(stepsOf(phrase, "kick"), [0, 4, 8, 11, 12, 15]);
  assert.deepEqual(stepsOf(phrase, "snare"), [2, 6, 10, 14]);
});

test("the step sequencer builds a looping bar from toggles", () => {
  const grid = emptyGrid("8");
  grid.hat[0] = true;
  grid.snare[2] = true;
  grid.kick[0] = true;
  grid.kick[4] = true;
  const groove = sequencerGroove(grid, "8");
  assert.equal(groove.notes.length, 4);
  assert.equal(groove.recipe.phraseSteps, 8);
  assert.equal(groove.recipe.stepsPerBeat, 2);
  const snare = groove.notes.find((note) => note.element === "snare");
  assert.equal(snare.hand, "L");
  assert.equal(snare.accent, true);
  assert.equal(groove.notes.find((note) => note.element === "hat").hand, "R");
  assert.equal(groove.notes.find((note) => note.element === "kick").hand, "F");

  const wide = remapGrid(grid, "8", "16");
  assert.equal(wide.hat.length, 16);
  assert.equal(wide.hat[0], true);
  assert.equal(wide.hat[1], false);
  assert.equal(wide.snare[4], true);
  assert.equal(wide.kick[0], true);
  assert.equal(wide.kick[8], true);

  const back = remapGrid(wide, "16", "8");
  assert.equal(back.hat[0], true);
  assert.equal(back.snare[2], true);
  assert.equal(back.kick[4], true);

  const odd = emptyGrid("16");
  odd.hat[1] = true;
  odd.snare[3] = true;
  const collapsed = remapGrid(odd, "16", "8");
  assert.equal(collapsed.hat[0], true);
  assert.equal(collapsed.snare[1], true);
  assert.equal(collapsed.kick[0], false);

  const empty = sequencerGroove(emptyGrid("16"), "16");
  assert.equal(empty.notes.length, 0);
  assert.equal(empty.steps, 16);

  const looped = materialize(groove.recipe, 4);
  assert.equal(looped.length, groove.notes.length * 4);
  const keys = new Set(looped.map((note) => `${note.baseStep}:${note.element}:${note.hand}`));
  assert.equal(keys.size, looped.length);
  assert.ok(looped.every((note) => note.baseStep < 32));
});
