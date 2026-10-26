/*
  Turn a polyomino partition into a Strudel pattern.

  Rows are bars of melody. A note starts where the region
  changes, and the following cells are how long it lasts.
  The region's place in a minor scale, from the base color,
  chooses the pitch.

  Each region size is an Euclidean drum density. The bar
  never has more than 16 steps, so a larger grid is played
  in sixteenth notes.
  The spanning tree is a quiet pitch line: right and left
  step by a tone, up by a fifth, down by an octave.
  A cut in the tree is an accent.
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

// Machines that contain every drum name above.
export const BANKS = [
  "RolandTR909",
  "AkaiMPC60",
  "AkaiXR10",
  "BossDR550",
  "EmuSP12",
  "LinnDrum",
  "LinnLM2",
  "OberheimDMX",
  "RolandCompurhythm1000",
  "RolandMT32",
  "RolandR8",
  "RolandTR505",
  "RolandTR626",
  "SakataDPM48",
  "YamahaRY30"
];

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
const EUCLID_MAX = 16;

// Natural minor. Region 0 is the root from the base color.
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export function buildBeat(score) {
  const cps = formatNum(score.cps ?? 0.8);
  const level = formatNum(score.gain ?? 0.8);
  const header = [
    "// One cycle is one row. A note starts where the region changes.",
    "// Region size is an Euclidean density of at most 16 steps.",
    "// The tree is a quiet pitch line.",
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
      const cycles = gridSizeOf(
        partition.labels,
        score.gridSize
      );

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
          const note = noteForRegion(run.label, score.rootMidi);
          return `${note}@${run.length}`;
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
        drum: drumFor(label),
        pulses: slot.pulses,
        steps: slot.steps,
        bank: bankFor(label, score)
      };
    });
}

// Fit a region into a bar of at most 16 steps.
// Smaller grids keep one step per cell. Larger grids
// are rescaled onto sixteen sixteenth notes.
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

export function treeLine(partition, size, rootMidi) {
  const cuts = new Set((partition.cuts || []).map(edgeKey));
  let midi = foldMidi(rootMidi ?? LOW_MIDI);
  const notes = [midiName(midi)];
  const gains = ["0.28"];

  for (const edge of partition.tree || []) {
    midi = foldMidi(midi + intervalFor(edge, size));
    notes.push(midiName(midi));
    gains.push(cuts.has(edgeKey(edge)) ? "0.85" : "0.28");
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
    voices.push(treeVoice(partition, size, score.rootMidi));
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

  return [
    "note(`<",
    notes,
    ">`).s(\"sine\").gain(0.7)"
  ].join("\n");
}

function sizeVoice(labels, score) {
  const voices = sizeVoices(labels, score);

  if (voices.length === 1) {
    const voice = voices[0];
    return `s("${voice.drum}").euclid(${voice.pulses}, ${voice.steps}).bank("${voice.bank}").gain(0.4)`;
  }

  const lines = voices.map((voice) =>
    `  s("${voice.drum}").euclid(${voice.pulses}, ${voice.steps}).bank("${voice.bank}")`
  );

  return `stack(\n${lines.join(",\n")}\n).gain(0.4)`;
}

function treeVoice(partition, size, rootMidi) {
  const line = treeLine(partition, size, rootMidi);

  return [
    `note("${line.notes.join(" ")}")`,
    `.gain("${line.gains.join(" ")}")`,
    `.s("triangle")`,
    `.slow(${size})`
  ].join("");
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

function bankFor(label, score) {
  const used = Math.max(
    1,
    Math.round(Number(score.patternCount) || 1)
  );

  const shift =
    Math.abs(Math.floor(Number(score.seed) || 0)) % used;

  const pattern =
    (Math.abs(label) + shift) % used;

  return BANKS[pattern % BANKS.length];
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
