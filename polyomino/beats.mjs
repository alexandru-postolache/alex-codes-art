/*
  Turn a polyomino partition into a Strudel pattern.

  Rows are bars of melody, played at twice the bar rate.
  A chord starts where the region changes, and the following
  cells are how long it lasts.
  The region's place in a minor scale, from the base color,
  chooses the triad. The melody is a piano by default,
  or another chord-friendly sound.
  A sheet holds each piece until that melody finishes.

  Each region size is an Euclidean drum density on one kit.
  The bar never has more than 8 steps, so a larger grid is played
  in eighth notes. The kit can be one of several drum machines.
  The spanning tree is a low line, played at half the speed:
  right and left step by a tone, up by a fifth, down by an octave.
  A note holds for two steps, then three, then one, and that
  cycle repeats, so the pitch stays while the line keeps moving.
  A cut in the tree is an accent.
  Sawtooth is the default bass. A lowpass keeps that synth low.
  The other basses are instruments, including bass guitars.
*/

export const DRUMS = [
  "bd",
  "sd",
  "hh",
  "cp",
  "rim",
  "mt",
  "ht",
  "lt",
  "oh",
  "cr",
  "rd"
];

// The default kit. Every size voice in a piece uses the same one.
export const DRUM_BANK = "RolandTR909";

export const DRUM_KITS = [
  { label: "TR-909", value: "RolandTR909" },
  { label: "Linn", value: "LinnDrum" },
  { label: "MPC-60", value: "AkaiMPC60" },
  { label: "DMX", value: "OberheimDMX" },
  { label: "R-8", value: "RolandR8" }
];

// The piano line is played this many times faster than the bar.
export const SHAPE_RATE = 2;

// The bass line is this many times slower than the bar.
export const TREE_RATE = 2;

// The bass sits this many octaves under the walk.
const BASS_OCTAVES = 2;

// A walking note, and a cut. The cut is full level.
const BASS_GAIN = "0.8";
const BASS_ACCENT = "1";

// A short fade so an oscillator does not tick at the ends.
const SYNTH_ATTACK = 0.02;
const SYNTH_RELEASE = 0.2;

// Trims the harmonics that make a sawtooth a buzzer.
const TREE_CUTOFF = 800;

// Chord sounds. Samples come from the Strudel library.
// The waveforms stay available beside them.
export const SHAPE_SOUNDS = [
  { label: "Piano", value: "piano", sample: true },
  { label: "Harp", value: "harp", sample: true },
  { label: "Marimba", value: "marimba", sample: true },
  { label: "Vibes", value: "vibraphone_soft", sample: true },
  { label: "Organ", value: "organ_full", sample: true },
  { label: "Soft", value: "triangle" },
  { label: "Pure", value: "sine" },
  { label: "Pad", value: "supersaw" }
];

// Low sounds. Sawtooth is the default synth bass.
// The sampled instruments include three bass guitars.
export const TREE_SOUNDS = [
  { label: "Saw", value: "sawtooth" },
  { label: "Pedal", value: "pipeorgan_quiet_pedal", sample: true },
  { label: "Organ", value: "organ_full", sample: true },
  { label: "Folk harp", value: "folkharp", sample: true },
  { label: "Jazz bass", value: "jvbass", sample: true },
  { label: "Finger bass", value: "bass3", sample: true },
  { label: "Drive bass", value: "bass2", sample: true },
  { label: "Square", value: "square" },
  { label: "Round", value: "triangle" },
  { label: "Sub", value: "sine" }
];

const DEFAULT_SHAPE_SOUND = "piano";
const DEFAULT_TREE_SOUND = "sawtooth";

// How long a drum hit stays lit, in cycles.
export const SIZE_BLOOM = 0.35;

const NOTE_NAMES = [
  "c",
  "c#",
  "d",
  "d#",
  "e",
  "f",
  "f#",
  "g",
  "g#",
  "a",
  "a#",
  "b"
];

const LOW_MIDI = 48;
const HIGH_MIDI = 84;
const EUCLID_MAX = 8;

// Natural minor. Region 0 is the root from the base color.
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export function buildBeat(score) {
  const cps = formatNum(score.cps ?? 0.8);
  const level = formatNum(score.gain ?? 0.8);
  const shapeName = shapeSoundName(score);
  const treeName = treeSoundName(score);
  const header = [
    `// The shape plays ${shapeName} chords where the region changes, two rows per cycle.`,
    "// A sheet holds each piece until that melody finishes.",
    "// Region size is an Euclidean density of at most 8 steps.",
    `// The tree is a ${treeName} bass line at half speed.`,
    `setcps(${cps})`
  ];

  const partitions = score.partitions || [];
  const layers = score.layers || {};
  const anyLayer = layers.shape || layers.sizes || layers.tree;

  if (!anyLayer || partitions.length === 0) {
    return `${header.join("\n")}\nsilence.postgain(${level})`;
  }

  const sections = partitions.map((partition) =>
    sectionCode(partition, score)
  );

  let body;

  if (sections.length === 1) {
    body = sections[0];
  } else {
    const blocks = partitions.map((partition, index) => {
      const cycles = formatNum(sectionSpan(partition, score));

      return `  [${cycles}, ${indent(sections[index], 4, true)}]`;
    });

    body = `arrange(\n${blocks.join(",\n")}\n)`;
  }

  return `${header.join("\n")}\n${body}.postgain(${level})`;
}

export function rootMidiFromColor(color) {
  const rgb = parseRgb(color);

  if (!rgb) {
    return LOW_MIDI;
  }

  const hue = hueOf(rgb.r, rgb.g, rgb.b);
  const pitch = ((Math.round(hue / 30) % 12) + 12) % 12;
  return LOW_MIDI + pitch;
}

export function shapeRows(labels, size, score) {
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = labels.slice(y * size, (y + 1) * size);
    const runs = runsInRow(row);

    rows.push({
      sound: runs
        .map((run) => {
          const chord = chordForRegion(run.label, score.rootMidi);
          return `[${chord.join(",")}]@${run.length}`;
        })
        .join(" ")
    });
  }

  return rows;
}

export function sizeVoices(labels, score) {
  const size = gridSizeOf(labels, score.gridSize);
  const area = size * size;
  const counts = new Map();

  for (const label of labels) {
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return [...counts.keys()]
    .sort((a, b) => a - b)
    .map((label) => {
      const slot = euclidPair(counts.get(label), area);

      return {
        label,
        drum: drumFor(label),
        pulses: slot.pulses,
        steps: slot.steps
      };
    });
}

// The same Bjorklund pattern Strudel's euclid() uses.
// A 1 is a hit. The list is one cycle, divided into equal steps.
export function euclidPattern(pulses, steps) {
  const count = Math.max(0, Math.round(steps));
  const hits = Math.max(0, Math.min(count, Math.round(pulses)));

  if (count === 0) {
    return [];
  }

  const ones = Array.from({ length: hits }, () => [1]);
  const zeros = Array.from({ length: count - hits }, () => [0]);
  const mixed = distributeHits([hits, count - hits], [ones, zeros]);

  return mixed[0].flat().concat(mixed[1].flat());
}

function distributeHits(counts, groups) {
  const [left, right] = counts;

  if (Math.min(left, right) <= 1) {
    return groups;
  }

  if (left > right) {
    const [head, tail] = splitGroups(right, groups[0]);

    return distributeHits(
      [right, left - right],
      [zipGroups(head, groups[1]), tail]
    );
  }

  const [head, tail] = splitGroups(left, groups[1]);

  return distributeHits(
    [left, right - left],
    [zipGroups(groups[0], head), tail]
  );
}

function splitGroups(count, groups) {
  return [groups.slice(0, count), groups.slice(count)];
}

function zipGroups(left, right) {
  return left.map((group, index) => group.concat(right[index]));
}

// What the piece should show at a scheduler cycle.
// A single partition keeps each layer on its own loop.
// A sheet holds each piece for the whole piano melody.
// With the piano off, each piece lasts one cycle per row.
export function playingAt(score, cycle) {
  if (!Number.isFinite(cycle)) {
    return null;
  }

  const partitions = score.partitions || [];

  if (partitions.length === 0) {
    return null;
  }

  const place = placeCycle(partitions, score, cycle);
  const partition = partitions[place.index];
  const labels = partition.labels || [];
  const size = gridSizeOf(labels, score.gridSize);
  const layers = score.layers || {};
  const shown = {
    index: place.index,
    shape: null,
    sizes: [],
    tree: null
  };

  if (layers.shape && labels.length > 0) {
    shown.shape = shapeAt(labels, size, place.time);
  }

  if (layers.sizes && labels.length > 0) {
    shown.sizes = sizesAt(labels, score, place.time);
  }

  if (layers.tree && partition.tree && partition.tree.length > 0) {
    shown.tree = treeAt(partition, size, place.time);
  }

  return shown;
}

function placeCycle(partitions, score, cycle) {
  if (partitions.length === 1) {
    return { index: 0, time: cycle };
  }

  const spans = partitions.map((partition) =>
    sectionSpan(partition, score)
  );
  const total = spans.reduce((sum, span) => sum + span, 0);
  let local = wrapCycle(cycle, total);

  for (let index = 0; index < spans.length; index++) {
    if (local < spans[index] || index === spans.length - 1) {
      return { index, time: local };
    }

    local -= spans[index];
  }

  return { index: 0, time: 0 };
}

function shapeAt(labels, size, time) {
  const events = [];
  let cursor = 0;

  for (let y = 0; y < size; y++) {
    const row = labels.slice(y * size, (y + 1) * size);
    let x = 0;

    for (const run of runsInRow(row)) {
      const cells = [];

      for (let step = 0; step < run.length; step++) {
        cells.push(y * size + x + step);
      }

      const begin = cursor / SHAPE_RATE;
      cursor += run.length;
      events.push({
        cells,
        label: run.label,
        begin,
        end: cursor / SHAPE_RATE
      });
      x += run.length;
    }
  }

  const period = cursor / SHAPE_RATE;

  if (!(period > 0)) {
    return null;
  }

  const local = wrapCycle(time, period);
  const event = events.find((item) =>
    local >= item.begin && local < item.end
  );

  if (!event) {
    return null;
  }

  return {
    cells: event.cells,
    label: event.label,
    progress: (local - event.begin) / (event.end - event.begin)
  };
}

function sizesAt(labels, score, time) {
  const local = wrapCycle(time, 1);
  const blooms = [];

  for (const voice of sizeVoices(labels, score)) {
    const pattern = euclidPattern(voice.pulses, voice.steps);

    pattern.forEach((hit, index) => {
      if (!hit) {
        return;
      }

      let age = local - index / voice.steps;

      if (age < 0) {
        age += 1;
      }

      if (age > SIZE_BLOOM) {
        return;
      }

      blooms.push({
        label: voice.label,
        age,
        strength: 1 - age / SIZE_BLOOM
      });
    });
  }

  return blooms;
}

function treeAt(partition, size, time) {
  const tree = partition.tree || [];
  const segments = tree.length;
  const period = size * TREE_RATE;

  if (!(period > 0) || segments === 0) {
    return null;
  }

  const local = wrapCycle(time, period);
  const head = (local / period) * segments;
  const edgeIndex = Math.min(segments - 1, Math.floor(head));
  const edge = tree[edgeIndex];
  const cuts = new Set((partition.cuts || []).map(edgeKey));
  const start = Number.isInteger(partition.start)
    ? partition.start
    : tree[0].a;
  const cells = [start];

  for (const step of tree) {
    cells.push(step.b);
  }

  return {
    cells,
    head,
    accent: cuts.has(edgeKey(edge))
  };
}

function wrapCycle(cycle, period) {
  if (!(period > 0)) {
    return 0;
  }

  const wrapped = cycle % period;
  return wrapped < 0 ? wrapped + period : wrapped;
}

// Fit a region into a bar of at most 8 steps.
// Smaller grids keep one step per cell. Larger grids
// are rescaled onto eight eighth notes.
export function euclidPair(count, area) {
  const cells = Math.max(1, area);
  const steps = Math.min(cells, EUCLID_MAX);
  const scaled = Math.round((count * steps) / cells);

  return {
    pulses: Math.max(1, Math.min(steps, scaled)),
    steps
  };
}

export function noteForRegion(label, rootMidi) {
  const degree = Math.abs(label);
  const scaleDegree = degree % MINOR.length;
  const octave = Math.floor(degree / MINOR.length);
  const midi = (rootMidi ?? LOW_MIDI) + MINOR[scaleDegree] + (octave * 12);

  return midiName(foldMidi(midi));
}

// A diatonic triad on this region's natural-minor degree.
// The root is the note the region already played. The third
// and the fifth are two and four scale steps above it.
// The whole triad shifts by octaves so the voicing stays together.
function chordForRegion(label, rootMidi) {
  const degree = Math.abs(label);
  const root = rootMidi ?? LOW_MIDI;
  const tones = [0, 2, 4].map((step) => {
    const scaleIndex = degree + step;
    const scaleDegree = scaleIndex % MINOR.length;
    const octave = Math.floor(scaleIndex / MINOR.length);

    return root + MINOR[scaleDegree] + (octave * 12);
  });

  return foldChord(tones).map(midiName);
}

function foldChord(tones) {
  let notes = tones.map((tone) => Math.round(tone));

  while (Math.max(...notes) > HIGH_MIDI) {
    notes = notes.map((tone) => tone - 12);
  }

  while (Math.min(...notes) < LOW_MIDI) {
    notes = notes.map((tone) => tone + 12);
  }

  return notes;
}

// How many cycles a sheet spends on one piece.
// The piano section lasts for the whole melody.
// The other layers keep one cycle per row.
function sectionSpan(partition, score) {
  const labels = partition.labels || [];
  const size = gridSizeOf(labels, score.gridSize);
  const layers = score.layers || {};

  if (layers.shape && labels.length > 0) {
    return (size * size) / SHAPE_RATE;
  }

  return size;
}

export function treeLine(partition, size, rootMidi) {
  const cuts = new Set((partition.cuts || []).map(edgeKey));
  let midi = foldMidi(rootMidi ?? LOW_MIDI);
  const notes = [midiName(midi)];
  const gains = [BASS_GAIN];

  for (const edge of partition.tree || []) {
    midi = foldMidi(midi + intervalFor(edge, size));
    notes.push(midiName(midi));
    gains.push(cuts.has(edgeKey(edge)) ? BASS_ACCENT : BASS_GAIN);
  }

  return { notes, gains };
}

function sectionCode(partition, score) {
  const labels = partition.labels || [];
  const size = gridSizeOf(labels, score.gridSize);
  const layers = score.layers || {};
  const voices = [];

  if (layers.shape && labels.length > 0) {
    voices.push(shapeVoice(labels, size, score));
  }

  if (layers.sizes && labels.length > 0) {
    voices.push(sizeVoice(labels, score));
  }

  if (layers.tree && partition.tree && partition.tree.length > 0) {
    voices.push(treeVoice(partition, size, score));
  }

  if (voices.length === 0) {
    return "silence";
  }

  if (voices.length === 1) {
    return voices[0];
  }

  return `stack(\n${voices
    .map((voice) => indent(voice, 2))
    .join(",\n")}\n)`;
}

function shapeVoice(labels, size, score) {
  const rows = shapeRows(labels, size, score);
  const notes = rows.map((row) => `  ${row.sound}`).join("\n");
  const tone = shapeTone(shapeSound(score));

  return [
    "note(`<",
    notes,
    `>\`)${tone}.gain(0.8).fast(${SHAPE_RATE})`
  ].join("\n");
}

function sizeVoice(labels, score) {
  const voices = sizeVoices(labels, score);
  const kit = drumKitName(score);

  if (voices.length === 1) {
    const voice = voices[0];
    return `s("${voice.drum}").euclid(${voice.pulses}, ${voice.steps}).bank("${kit}").gain(0.4)`;
  }

  const lines = voices.map((voice) =>
    `  s("${voice.drum}").euclid(${voice.pulses}, ${voice.steps})`
  );

  return `stack(\n${lines.join(",\n")}\n).bank("${kit}").gain(0.4)`;
}

function treeVoice(partition, size, score) {
  const line = heldBass(partition, size, score.rootMidi);
  const notes = line.notes.map((note, index) =>
    `${note}@${line.weights[index]}`
  );
  const tone = treeTone(treeSound(score));

  return [
    `note("${notes.join(" ")}")`,
    `.gain("${line.gains.join(" ")}")`,
    tone,
    `.slow(${size * TREE_RATE})`
  ].join("");
}

// The walk still visits every edge. A sounding note covers
// two steps, then three, then one, and that cycle repeats.
function heldBass(partition, size, rootMidi) {
  const line = treeLine(partition, size, rootMidi);
  const segments = Math.max(0, line.notes.length - 1);
  const groups = holdGroups(segments);
  const notes = [];
  const gains = [];
  let cursor = 0;

  for (const hold of groups) {
    notes.push(bassNote(line.notes[cursor]));
    const heard = line.gains.slice(cursor + 1, cursor + hold + 1);
    gains.push(heard.includes(BASS_ACCENT) ? BASS_ACCENT : BASS_GAIN);
    cursor += hold;
  }

  return { notes, gains, weights: groups };
}

// Hold lengths, in steps of the walk. A short remainder is kept.
const HOLDS = [2, 3, 1];

function holdGroups(count) {
  if (count <= 0) {
    return [];
  }

  const groups = [];
  let left = count;
  let index = 0;

  while (left > 0) {
    const take = Math.min(left, HOLDS[index % HOLDS.length]);
    groups.push(take);
    left -= take;
    index += 1;
  }

  return groups;
}

function shapeSoundName(score) {
  return shapeSound(score).value;
}

function treeSoundName(score) {
  return treeSound(score).value;
}

function shapeSound(score) {
  return pickSound(
    score.sounds && score.sounds.shape,
    SHAPE_SOUNDS,
    DEFAULT_SHAPE_SOUND
  );
}

function treeSound(score) {
  return pickSound(
    score.sounds && score.sounds.tree,
    TREE_SOUNDS,
    DEFAULT_TREE_SOUND
  );
}

function drumKitName(score) {
  return pickSound(
    score.sounds && score.sounds.kit,
    DRUM_KITS,
    DRUM_BANK
  ).value;
}

function shapeTone(sound) {
  if (sound.sample) {
    return `.s("${sound.value}").clip(1)`;
  }

  return `.s("${sound.value}").attack(${SYNTH_ATTACK}).release(${SYNTH_RELEASE})`;
}

function treeTone(sound) {
  if (sound.sample) {
    return `.s("${sound.value}").clip(1)`;
  }

  return `.s("${sound.value}").attack(${SYNTH_ATTACK}).release(${SYNTH_RELEASE}).lpf(${TREE_CUTOFF})`;
}

function pickSound(name, choices, fallback) {
  const found = choices.find((sound) => sound.value === name);

  if (found) {
    return found;
  }

  return choices.find((sound) => sound.value === fallback);
}

function bassNote(name) {
  const match = /^([a-g]#?)(-?\d+)$/.exec(name);

  if (!match) {
    return name;
  }

  return `${match[1]}${Number(match[2]) - BASS_OCTAVES}`;
}

export function runsInRow(row) {
  if (row.length === 0) {
    return [];
  }

  const runs = [];
  let label = row[0];
  let length = 1;

  for (let index = 1; index < row.length; index++) {
    if (row[index] === label) {
      length += 1;
      continue;
    }

    runs.push({ label, length });
    label = row[index];
    length = 1;
  }

  runs.push({ label, length });
  return runs;
}

function drumFor(label) {
  const index = Math.abs(label) % DRUMS.length;
  return DRUMS[index];
}

function gridSizeOf(labels, fallback) {
  const count = labels ? labels.length : 0;
  const size = Math.round(Math.sqrt(count));

  if (size > 0 && size * size === count) {
    return size;
  }

  return fallback || 1;
}

function intervalFor(edge, size) {
  const ax = edge.a % size;
  const ay = Math.floor(edge.a / size);
  const bx = edge.b % size;
  const by = Math.floor(edge.b / size);

  if (bx === ax + 1 && by === ay) {
    return 2;
  }

  if (bx === ax - 1 && by === ay) {
    return -2;
  }

  if (bx === ax && by === ay - 1) {
    return 7;
  }

  if (bx === ax && by === ay + 1) {
    return -12;
  }

  return 0;
}

function edgeKey(edge) {
  return `${edge.a}:${edge.b}`;
}

function foldMidi(midi) {
  let note = Math.round(midi);

  while (note > HIGH_MIDI) {
    note -= 12;
  }

  while (note < LOW_MIDI) {
    note += 12;
  }

  return note;
}

function midiName(midi) {
  const pitch = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitch]}${octave}`;
}

function formatNum(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(Math.round(number * 1000) / 1000);
}

function indent(text, spaces, skipFirst = false) {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line, index) =>
      skipFirst && index === 0 ? line : `${pad}${line}`
    )
    .join("\n");
}

function parseRgb(color) {
  if (!color) {
    return null;
  }

  if (typeof color === "object" && color.r !== undefined) {
    return {
      r: Number(color.r),
      g: Number(color.g),
      b: Number(color.b)
    };
  }

  if (typeof color !== "string") {
    return null;
  }

  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);

  if (short) {
    const [r, g, b] = short[1].split("");
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16)
    };
  }

  const long = /^#([0-9a-f]{6})$/i.exec(hex);

  if (long) {
    const value = long[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);

  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3])
    };
  }

  return null;
}

function hueOf(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue;

  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue *= 60;

  if (hue < 0) {
    hue += 360;
  }

  return hue;
}
