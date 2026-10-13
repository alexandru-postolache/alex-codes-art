import assert from "node:assert/strict";
import test from "node:test";
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
