// A fill is one sticking phrased in a mix of 8ths and 16ths.
// The grid is 16th-note slots: an 8th takes two slots, a 16th takes one.
// Lengths are a beat (4 slots), half a bar (8), or a bar (16).

const LENGTHS = [
  { id: "quarter", beats: 1, slots: 4, label: "One beat" },
  { id: "half", beats: 2, slots: 8, label: "Half a bar" },
  { id: "bar", beats: 4, slots: 16, label: "One bar" },
];

const RHYTHMS = {
  quarter: [
    { id: "land", name: "Land on the long note", durations: [1, 1, 2], blurb: "Two 16ths fall into an 8th." },
    { id: "rush", name: "Rush the end", durations: [2, 1, 1], blurb: "An 8th, then two 16ths." },
    { id: "skip", name: "Skip", durations: [1, 2, 1], blurb: "A 16th, an 8th, and a 16th." },
  ],
  half: [
    { id: "open-run", name: "Open, then run", durations: [2, 2, 1, 1, 1, 1], blurb: "Two 8ths, then a beat of 16ths." },
    { id: "run-open", name: "Run, then open", durations: [1, 1, 1, 1, 2, 2], blurb: "A beat of 16ths, then two 8ths." },
    { id: "mixed", name: "Mixed cell", durations: [2, 1, 1, 2, 1, 1], blurb: "An 8th and two 16ths, twice." },
  ],
  bar: [
    { id: "build", name: "Build", durations: [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1], blurb: "8ths for two beats, then 16ths for two beats." },
    { id: "groups", name: "Four groups", durations: [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1], blurb: "Every beat is an 8th followed by two 16ths." },
    { id: "wave", name: "Wave", durations: [2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1], blurb: "8ths, 16ths, 8ths, 16ths." },
  ],
};

const VOICES = {
  descend: {
    id: "descend",
    name: "Down the kit",
    line: "The hands walk down: snare, tom 1, tom 2, floor.",
  },
  punctuate: {
    id: "punctuate",
    name: "Button ending",
    line: "The phrase walks down and the last hand hits a crash, or the floor, with the kick.",
  },
  split: {
    id: "split",
    name: "Hands split",
    line: "Rights stay on the snare. Lefts walk the toms.",
  },
  diddle: {
    id: "diddle",
    name: "Short notes on the snare",
    line: "16ths stay on the snare. The 8ths, and the last note, move.",
  },
  around: {
    id: "around",
    name: "Around the kit",
    line: "Hat, snare, tom, floor, then around again.",
  },
};

const IDEAS = [
  ["quarter", "land", "descend"],
  ["quarter", "land", "punctuate"],
  ["quarter", "rush", "split"],
  ["quarter", "rush", "punctuate"],
  ["quarter", "skip", "diddle"],
  ["quarter", "skip", "descend"],
  ["half", "open-run", "descend"],
  ["half", "open-run", "diddle"],
  ["half", "run-open", "around"],
  ["half", "run-open", "punctuate"],
  ["half", "mixed", "split"],
  ["half", "mixed", "descend"],
  ["bar", "build", "descend"],
  ["bar", "build", "punctuate"],
  ["bar", "groups", "diddle"],
  ["bar", "groups", "split"],
  ["bar", "wave", "around"],
  ["bar", "wave", "punctuate"],
];

const DRUMS = ["snare", "tom1", "tom2", "floor"];

export const FILL_PRESETS = [
  { id: "singles", label: "Singles", sticking: "R L" },
  { id: "paradiddle", label: "Paradiddle", sticking: "R L R R L R L L" },
  { id: "six", label: "Six-stroke", sticking: "R L L R R L" },
  { id: "kick", label: "With kick", sticking: "R L K L" },
];

function drumAt(index, count) {
  if (count <= 1) return "snare";
  const at = Math.round((index / (count - 1)) * (DRUMS.length - 1));
  return DRUMS[at];
}

function voiceNote(voiceId, ctx, writtenKick) {
  if (voiceId === "diddle") {
    if (ctx.isLast) return { element: "floor", accent: true };
    if (ctx.long) return { element: ctx.beat % 2 === 0 ? "tom1" : "tom2", accent: true };
    return { element: "snare", accent: false };
  }
  if (voiceId === "split") {
    if (ctx.hand === "L") {
      return { element: drumAt(ctx.index, ctx.count), accent: ctx.onBeat || ctx.isLast };
    }
    if (ctx.isLast && ctx.beats > 1) return { element: "floor", accent: true };
    return { element: "snare", accent: ctx.onBeat };
  }
  if (voiceId === "around") {
    const path = ["hat", "snare", "tom1", "floor"];
    return { element: path[ctx.index % path.length], accent: ctx.onBeat || ctx.long };
  }
  const moving = { element: drumAt(ctx.index, ctx.count), accent: ctx.onBeat || ctx.isLast };
  if (voiceId === "punctuate" && ctx.isLast) {
    const handEnds = ctx.hand === "R"
      ? { element: "crash", accent: true }
      : { element: "floor", accent: true };
    if (!writtenKick) handEnds.extras = [{ hand: "F", element: "kick", accent: true }];
    return handEnds;
  }
  return moving;
}

function placeFill(strokes, durations, slots, voiceId) {
  const writtenKick = strokes.includes("K");
  const notes = [];
  let slot = 0;
  durations.forEach((duration, index) => {
    const hand = strokes[index % strokes.length];
    const ctx = {
      hand,
      index,
      count: durations.length,
      beat: Math.floor(slot / 4),
      beats: slots / 4,
      onBeat: slot % 4 === 0,
      isLast: index === durations.length - 1,
      long: duration === 2,
    };
    if (hand === "K") {
      notes.push(note(slot, "F", "kick", ctx.onBeat || ctx.isLast));
    } else {
      const voiced = voiceNote(voiceId, ctx, writtenKick);
      notes.push(note(slot, hand, voiced.element, voiced.accent));
      for (const extra of voiced.extras || []) {
        notes.push(note(slot, extra.hand, extra.element, !!extra.accent));
      }
    }
    slot += duration;
  });
  return notes;
}

function note(slot, hand, element, accent) {
  return {
    beat: slot / 4,
    baseStep: slot,
    hand,
    element,
    accent: !!accent,
    grace: false,
    graceIndex: 0,
    graceCount: 0,
    group: `f${slot}:${element}`,
  };
}

function usedSticking(strokes, count) {
  return Array.from({ length: count }, (_, index) => strokes[index % strokes.length]).join(" ");
}

function signature(notes) {
  return notes.map((item) => `${item.baseStep}:${item.element}:${item.hand}`).join("|");
}

export function generateFills(strokes) {
  const seen = new Set();
  const fills = [];
  for (const [lengthId, rhythmId, voiceId] of IDEAS) {
    const length = LENGTHS.find((item) => item.id === lengthId);
    const rhythm = RHYTHMS[lengthId].find((item) => item.id === rhythmId);
    const voice = VOICES[voiceId];
    const notes = placeFill(strokes, rhythm.durations, length.slots, voiceId);
    const sig = signature(notes);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const sticking = usedSticking(strokes, rhythm.durations.length);
    fills.push({
      id: `${lengthId}-${rhythmId}-${voiceId}`,
      title: `${rhythm.name} · ${voice.name}`,
      timing: length.label,
      beats: length.beats,
      slots: length.slots,
      stepsPerBeat: 4,
      steps: length.slots,
      kind: "fill",
      sticking,
      summary: `${length.label}. ${rhythm.blurb} ${voice.line} Sticking ${sticking}.`,
      notes,
      recipe: {
        type: "phrase",
        notes,
        phraseBeats: length.beats,
        phraseSteps: length.slots,
        stepsPerBeat: 4,
      },
    });
  }
  return fills;
}
