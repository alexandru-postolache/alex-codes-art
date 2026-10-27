import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUM_BANK,
  DRUMS,
  SIZE_BLOOM,
  audibleCycle,
  buildBeat,
  euclidPair,
  euclidPattern,
  playingAt,
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
  assert.equal(rows[0].sound, "[c4,d#4,g4]@3 [d4,f4,g#4]@1");
  assert.equal(rows[1].sound, "[c4,d#4,g4]@1 [d#4,g4,a#4]@2 [d4,f4,g#4]@1");
  assert.equal(rows[2].sound, "[d#4,g4,a#4]@2 [f4,g#4,c5]@2");
  assert.equal(rows[3].sound, "[d#4,g4,a#4]@2 [f4,g#4,c5]@1 [c4,d#4,g4]@1");

  for (const row of rows) {
    const weights = row.sound
      .split(" ")
      .map((event) => Number(event.split("@")[1]));

    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 4);
    assert.ok(row.sound.split(" ").every((event) =>
      /^\[[a-g]#?\d,[a-g]#?\d,[a-g]#?\d\]@\d+$/.test(event)
    ));
  }
});

test("a triad near the top of the piano shifts down together", () => {
  const rows = shapeRows([6], 1, { ...score, rootMidi: 84 });

  assert.equal(rows[0].sound, "[a#4,d5,f5]@1");
});

test("region size is the Euclidean pulse count on that region's drum", () => {
  const voices = sizeVoices(labels, score);

  assert.deepEqual(
    voices.map((voice) => [voice.drum, voice.pulses, voice.steps]),
    [
      ["bd", 3, 8],
      ["sd", 1, 8],
      ["hh", 3, 8],
      ["cp", 2, 8]
    ]
  );
});

test("a grid larger than 8 cells is rescaled onto eight steps", () => {
  assert.deepEqual(euclidPair(12, 25), { pulses: 4, steps: 8 });
  assert.deepEqual(euclidPair(1, 25), { pulses: 1, steps: 8 });
  assert.deepEqual(euclidPair(9, 9), { pulses: 8, steps: 8 });
  assert.deepEqual(euclidPair(40, 144), { pulses: 2, steps: 8 });

  const big = new Array(36).fill(0);
  big[35] = 1;
  const voices = sizeVoices(big, { ...score, gridSize: 6 });

  assert.deepEqual(
    voices.map((voice) => [voice.pulses, voice.steps]),
    [
      [8, 8],
      [1, 8]
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
  assert.deepEqual(line.gains, ["0.8", "0.8", "1", "0.8", "0.8"]);
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

test("the pattern is valid script and holds each piece for its whole melody", () => {
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
  assert.match(code, /arrange\(\n {2}\[8, stack\(/);
  assert.match(code, /\[4\.5, stack\(/);
  assert.match(code, /note\(`</);
  assert.match(code, /\[c4,d#4,g4\]@3 \[d4,f4,g#4\]@1/);
  assert.match(code, /\.s\("piano"\)\.clip\(1\)\.gain\(0\.8\)\.fast\(2\)/);
  assert.equal(code.match(/\.fast\(2\)/g).length, 2);
  assert.match(code, /\.bank\("RolandTR909"\)/);
  assert.match(code, /\.euclid\(3, 8\)/);
  assert.doesNotMatch(code, /euclid\(\d+, 16\)/);
  assert.doesNotMatch(code, /s\(`</);
  assert.match(code, /\.s\("sawtooth"\)\.attack\(0\.02\)\.release\(0\.2\)\.lpf\(800\)\.slow\(8\)/);
  assert.doesNotMatch(code, /\.s\("bass"\)/);
  assert.doesNotMatch(code, /triangle|sine/);
  assert.match(code, /note\("c2@2"\)/);
  assert.match(code, /\.gain\("1"\)/);
  assert.match(code, /\.postgain\(0\.7\)/);
  assert.doesNotThrow(() => {
    new Function(code);
  });
});

test("the shape and the tree can use another built-in sound", () => {
  const code = buildBeat({
    ...score,
    sounds: { shape: "supersaw", tree: "sine" },
    partitions: [{
      labels,
      tree: [{ a: 0, b: 1 }],
      cuts: []
    }]
  });

  assert.match(code, /\.s\("supersaw"\)\.attack\(0\.02\)\.release\(0\.2\)\.gain\(0\.8\)\.fast\(2\)/);
  assert.match(code, /\.s\("sine"\)\.attack\(0\.02\)\.release\(0\.2\)\.lpf\(800\)/);
  assert.doesNotMatch(code, /\.s\("piano"\)|\.s\("bass"\)|\.s\("sawtooth"\)/);

  const fallback = buildBeat({
    ...score,
    sounds: { shape: "bd", tree: "saw\"); hush(" },
    partitions: [{
      labels,
      tree: [{ a: 0, b: 1 }],
      cuts: []
    }]
  });

  assert.match(fallback, /\.s\("piano"\)\.clip\(1\)/);
  assert.match(fallback, /\.s\("sawtooth"\)/);
  assert.doesNotMatch(fallback, /hush/);
});

test("instrument samples and drum kits can be chosen", () => {
  const code = buildBeat({
    ...score,
    sounds: {
      shape: "harp",
      tree: "pipeorgan_quiet_pedal",
      kit: "LinnDrum"
    },
    partitions: [{
      labels,
      tree: [{ a: 0, b: 1 }],
      cuts: []
    }]
  });

  assert.match(code, /\.s\("harp"\)\.clip\(1\)\.gain\(0\.8\)\.fast\(2\)/);
  assert.match(code, /\.s\("pipeorgan_quiet_pedal"\)\.clip\(1\)\.slow\(8\)/);
  assert.doesNotMatch(code, /lpf\(800\)/);
  assert.match(code, /\.bank\("LinnDrum"\)/);
  assert.doesNotMatch(code, /RolandTR909/);

  const fallback = buildBeat({
    ...score,
    sounds: { shape: "not-a-sound", tree: "not-a-bass", kit: "not-a-kit" },
    partitions: [{
      labels,
      tree: [{ a: 0, b: 1 }],
      cuts: []
    }]
  });

  assert.match(fallback, /\.s\("piano"\)\.clip\(1\)/);
  assert.match(fallback, /\.s\("sawtooth"\)\.attack\(0\.02\)\.release\(0\.2\)\.lpf\(800\)/);
  assert.match(fallback, /\.bank\("RolandTR909"\)/);

  const guitar = buildBeat({
    ...score,
    sounds: { tree: "jvbass" },
    layers: { shape: false, sizes: false, tree: true },
    partitions: [{
      labels,
      tree: [{ a: 0, b: 1 }],
      cuts: []
    }]
  });

  assert.match(guitar, /\.s\("jvbass"\)\.clip\(1\)/);
  assert.doesNotMatch(guitar, /lpf\(800\)/);
});

test("euclidean hits match the drum pattern", () => {
  assert.deepEqual(euclidPattern(3, 8), [1, 0, 0, 1, 0, 0, 1, 0]);
  assert.deepEqual(
    euclidPattern(5, 16),
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0]
  );
  assert.deepEqual(euclidPattern(1, 4), [1, 0, 0, 0]);
  assert.deepEqual(euclidPattern(4, 4), [1, 1, 1, 1]);
});

test("the shape light follows the sounding run", () => {
  const frame = playingAt({
    ...score,
    partitions: [{ labels, tree: null, cuts: null }]
  }, 0);

  assert.equal(frame.index, 0);
  assert.deepEqual(frame.shape.cells, [0, 1, 2]);
  assert.equal(frame.shape.label, 0);
  assert.equal(frame.shape.progress, 0);

  const next = playingAt({
    ...score,
    partitions: [{ labels, tree: null, cuts: null }]
  }, 1.5);

  assert.deepEqual(next.shape.cells, [3]);
  assert.equal(next.shape.label, 1);

  const wrapped = playingAt({
    ...score,
    partitions: [{ labels, tree: null, cuts: null }]
  }, 8);

  assert.deepEqual(wrapped.shape.cells, [0, 1, 2]);
});

test("a drum hit lights its region and then fades", () => {
  const downbeat = playingAt({
    ...score,
    layers: { shape: false, sizes: true, tree: false },
    partitions: [{ labels, tree: null, cuts: null }]
  }, 0);

  assert.ok(downbeat.sizes.some((bloom) =>
    bloom.label === 0 && bloom.strength === 1
  ));

  const later = playingAt({
    ...score,
    layers: { shape: false, sizes: true, tree: false },
    partitions: [{ labels, tree: null, cuts: null }]
  }, 0.05);
  const region = later.sizes.find((bloom) => bloom.label === 0);

  assert.ok(region);
  assert.ok(region.age > 0);
  assert.ok(region.strength < 1);
});

test("the tree light walks the edges and marks a cut", () => {
  const partition = {
    labels,
    start: 0,
    tree: [
      { a: 0, b: 1 },
      { a: 1, b: 5 }
    ],
    cuts: [{ a: 1, b: 5 }]
  };
  const heard = {
    ...score,
    layers: { shape: false, sizes: false, tree: true },
    partitions: [partition]
  };

  const opening = playingAt(heard, 0);
  assert.deepEqual(opening.tree.cells, [0, 1, 5]);
  assert.equal(opening.tree.head, 0);
  assert.equal(opening.tree.noteStart, 0);
  assert.equal(opening.tree.accent, true);

  const midway = playingAt(heard, 2);
  assert.equal(midway.tree.head, 0.5);
  assert.equal(midway.tree.noteStart, 0);
  assert.equal(midway.tree.accent, true);

  const cut = playingAt(heard, 16 / 3);
  assert.ok(Math.abs(cut.tree.head - 4 / 3) < 1e-9);
  assert.equal(cut.tree.noteStart, 0);
  assert.equal(cut.tree.accent, true);
});

test("a bass note holds for two steps, then one", () => {
  const five = buildBeat({
    ...score,
    layers: { shape: false, sizes: false, tree: true },
    partitions: [{
      labels,
      tree: [
        { a: 0, b: 1 },
        { a: 1, b: 5 },
        { a: 5, b: 4 },
        { a: 4, b: 0 },
        { a: 0, b: 4 }
      ],
      cuts: [{ a: 1, b: 5 }]
    }]
  });

  assert.match(five, /note\("c2@2 d1@1 c1@2"\)/);
  assert.match(five, /\.gain\("1 0\.8 0\.8"\)/);
  assert.match(five, /\.slow\(8\)/);
  assert.doesNotMatch(five, /@3/);

  const heard = {
    ...score,
    layers: { shape: false, sizes: false, tree: true },
    partitions: [{
      labels,
      tree: [
        { a: 0, b: 1 },
        { a: 1, b: 5 },
        { a: 5, b: 4 },
        { a: 4, b: 0 },
        { a: 0, b: 4 }
      ],
      cuts: [{ a: 1, b: 5 }]
    }]
  };
  const accented = playingAt(heard, 0);
  const quiet = playingAt(heard, 3.2);

  assert.equal(accented.tree.noteStart, 0);
  assert.equal(accented.tree.accent, true);
  assert.equal(quiet.tree.head, 2);
  assert.equal(quiet.tree.noteStart, 2);
  assert.equal(quiet.tree.accent, false);

  const six = buildBeat({
    ...score,
    layers: { shape: false, sizes: false, tree: true },
    partitions: [{
      labels,
      tree: [
        { a: 0, b: 1 },
        { a: 1, b: 5 },
        { a: 5, b: 4 },
        { a: 4, b: 0 },
        { a: 0, b: 4 },
        { a: 4, b: 5 }
      ],
      cuts: [{ a: 1, b: 5 }]
    }]
  });

  assert.match(six, /note\("c2@2 d1@1 c1@2 g1@1"\)/);
  assert.match(six, /\.gain\("1 0\.8 0\.8 0\.8"\)/);
  assert.doesNotMatch(six, /@3/);
});

test("the picture waits for the note that is leaving the speakers", () => {
  const shifted = audibleCycle(2, 0.8, 0.03);

  assert.ok(Math.abs(shifted - (2 - 0.8 * 0.08)) < 1e-9);
  assert.equal(audibleCycle(0.02, 0.8, 0.03), 0);
  assert.equal(audibleCycle(4, 0, 0.03), 4);
});

test("a sheet shows the partition that is playing", () => {
  const heard = {
    ...score,
    partitions: [
      { labels, tree: null, cuts: null },
      {
        labels: [0, 0, 1, 1, 1, 1, 0, 0, 2],
        tree: null,
        cuts: null
      }
    ]
  };

  assert.equal(playingAt(heard, 0).index, 0);
  assert.equal(playingAt(heard, 4).index, 0);
  assert.deepEqual(playingAt(heard, 4).shape.cells, [8, 9]);
  assert.equal(playingAt(heard, 8).index, 1);
  assert.deepEqual(playingAt(heard, 8).shape.cells, [0, 1]);
  assert.equal(playingAt(heard, 12.5).index, 0);
  assert.deepEqual(playingAt(heard, 12.5).shape.cells, [0, 1, 2]);

  const drums = {
    ...heard,
    layers: { shape: false, sizes: true, tree: false }
  };
  const drumCode = buildBeat(drums);

  assert.match(drumCode, /arrange\(\n {2}\[4, stack\(/);
  assert.match(drumCode, /\[3, stack\(/);
  assert.equal(playingAt(drums, 4).index, 1);
  assert.equal(playingAt(drums, 7).index, 0);
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
