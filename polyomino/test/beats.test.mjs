import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUM_BANK,
  DRUMS,
  buildBeat,
  euclidPair,
  rootMidiFromColor,
  runsInRow,
  shapeRows,
  sizeVoices,
  treeLine
} from "../beats.mjs";

const score = {
  gridSize: 4,
  cps: 0.8,
  gain: 0.7,
  rootMidi: 60,
  patternCount: 8,
  seed: 0,
  layers: { shape: true, sizes: true, tree: true }
};

const labels = [
  0, 0, 0, 1,
  0, 2, 2, 1,
  2, 2, 3, 3,
  2, 2, 3, 0
];

test("a row is a melody where the region changes and holds for the run", () => {
  assert.deepEqual(runsInRow([0, 0, 0, 1, 1]), [
    { label: 0, length: 3 },
    { label: 1, length: 2 }
  ]);

  const rows = shapeRows(labels, 4, score);

  assert.equal(rows.length, 4);
  assert.equal(rows[0].sound, "c4@3 d4@1");
  assert.equal(rows[1].sound, "c4@1 d#4@2 d4@1");
  assert.equal(rows[2].sound, "d#4@2 f4@2");
  assert.equal(rows[3].sound, "d#4@2 f4@1 c4@1");

  for (const row of rows) {
    const weights = row.sound
      .split(" ")
      .map((event) => Number(event.split("@")[1]));

    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 4);
  }
});

test("region size is the Euclidean pulse count on that region's drum", () => {
  const voices = sizeVoices(labels, score);

  assert.deepEqual(
    voices.map((voice) => [voice.drum, voice.pulses, voice.steps]),
    [
      ["bd", 5, 16],
      ["sd", 2, 16],
      ["hh", 6, 16],
      ["cp", 3, 16]
    ]
  );
});

test("a grid larger than 16 cells is rescaled onto sixteen steps", () => {
  assert.deepEqual(euclidPair(12, 25), { pulses: 8, steps: 16 });
  assert.deepEqual(euclidPair(1, 25), { pulses: 1, steps: 16 });
  assert.deepEqual(euclidPair(9, 9), { pulses: 9, steps: 9 });
  assert.deepEqual(euclidPair(40, 144), { pulses: 4, steps: 16 });

  const big = new Array(36).fill(0);
  big[35] = 1;
  const voices = sizeVoices(big, { ...score, gridSize: 6 });

  assert.deepEqual(
    voices.map((voice) => [voice.pulses, voice.steps]),
    [
      [16, 16],
      [1, 16]
    ]
  );
});

test("every size voice uses the same drum kit", () => {
  const code = buildBeat({
    ...score,
    partitions: [{ labels, tree: null, cuts: null }]
  });

  assert.equal(DRUM_BANK, "RolandTR909");
  assert.equal(code.match(/\.bank\("RolandTR909"\)/g).length, 1);
  assert.doesNotMatch(code, /Akai|Linn|Boss|Emu|Oberheim|Yamaha|Sakata/);
  assert.equal(DRUMS.length, 11);

  const shifted = buildBeat({
    ...score,
    seed: 4,
    patternCount: 3,
    partitions: [{ labels, tree: null, cuts: null }]
  });

  assert.equal(shifted.match(/\.bank\("RolandTR909"\)/g).length, 1);
});

test("the tree walks by direction and accents cuts", () => {
  const line = treeLine({
    tree: [
      { a: 0, b: 1 },
      { a: 1, b: 5 },
      { a: 5, b: 4 },
      { a: 4, b: 0 }
    ],
    cuts: [{ a: 1, b: 5 }]
  }, 4, 60);

  assert.deepEqual(line.notes, ["c4", "d4", "d3", "c3", "g3"]);
  assert.deepEqual(line.gains, ["0.28", "0.28", "0.85", "0.28", "0.28"]);
});

test("pitch stays inside the playing range", () => {
  const downs = Array.from({ length: 8 }, (_, index) => ({
    a: index,
    b: index + 4
  }));

  const line = treeLine({
    tree: downs,
    cuts: []
  }, 4, 48);

  for (const note of line.notes) {
    assert.match(note, /^[a-g]#?[2-6]$/);
  }

  assert.equal(line.notes[0], "c3");
  assert.ok(line.notes.every((note) => note.endsWith("3") || note.endsWith("4") || note.endsWith("5") || note.endsWith("6") || note.endsWith("2")));
});

test("the base color chooses the tree's starting note", () => {
  assert.equal(rootMidiFromColor("#ff0000"), 48);
  assert.equal(rootMidiFromColor("#00ff00"), 52);
  assert.equal(rootMidiFromColor("#0000ff"), 56);
  assert.equal(rootMidiFromColor({ r: 255, g: 0, b: 0 }), 48);
  assert.equal(rootMidiFromColor("#fff"), 48);
});

test("the pattern is valid script and keeps each partition for one cycle per row", () => {
  const code = buildBeat({
    ...score,
    partitions: [
      {
        labels,
        tree: [
          { a: 0, b: 1 },
          { a: 1, b: 5 }
        ],
        cuts: [{ a: 1, b: 5 }]
      },
      {
        labels: [0, 0, 1, 1, 1, 1, 0, 0, 2],
        tree: null,
        cuts: null
      }
    ]
  });

  assert.match(code, /setcps\(0\.8\)/);
  assert.match(code, /arrange\(\n {2}\[4, stack\(/);
  assert.match(code, /\[3, stack\(/);
  assert.match(code, /note\(`</);
  assert.match(code, /c4@3 d4@1/);
  assert.match(code, /\.s\("piano"\)\.clip\(1\)/);
  assert.match(code, /\.bank\("RolandTR909"\)/);
  assert.match(code, /\.euclid\(5, 16\)/);
  assert.doesNotMatch(code, /s\(`</);
  assert.match(code, /\.slow\(4\)/);
  assert.match(code, /note\("c4 d4 d3"\)/);
  assert.match(code, /\.gain\("0\.28 0\.28 0\.85"\)/);
  assert.match(code, /\.postgain\(0\.7\)/);
  assert.doesNotThrow(() => {
    new Function(code);
  });
});

test("turning the layers off leaves silence", () => {
  const code = buildBeat({
    ...score,
    layers: { shape: false, sizes: false, tree: false },
    partitions: [{ labels, tree: [], cuts: [] }]
  });

  assert.match(code, /silence\.postgain\(0\.7\)/);
  assert.doesNotThrow(() => {
    new Function(code);
  });
});
