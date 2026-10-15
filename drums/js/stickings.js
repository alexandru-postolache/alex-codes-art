import { ELEMENTS } from "./kit.js";
import { buildChart, gridLabel, parsePattern } from "./pattern.js";

export const GRIDS = {
  8: { id: "8", label: "8th notes", stepsPerBeat: 2 },
  16: { id: "16", label: "16th notes", stepsPerBeat: 4 },
  12: { id: "12", label: "8th-note triplets", stepsPerBeat: 3 },
};

const STYLES = [
  { id: "snare", title: "On the snare", kind: "study" },
  { id: "hats", title: "Hi-hat groove", kind: "groove" },
  { id: "ride", title: "Ride groove", kind: "groove" },
  { id: "linear", title: "Linear groove", kind: "groove" },
  { id: "down", title: "Fill down the kit", kind: "fill" },
  { id: "split", title: "Fill, hands split", kind: "fill" },
];

const STYLE_BY_ID = Object.fromEntries(STYLES.map((style) => [style.id, style]));

const SKIP = new Set([" ", "\n", "\t", "·", "•", "|", ",", ".", "-", "_", "/", "+"]);

export function parseSticking(text) {
  const hands = [];
  for (const ch of String(text)) {
    const upper = ch.toUpperCase();
    if (upper === "R" || upper === "L" || upper === "K") {
      hands.push(upper);
      continue;
    }
    if (SKIP.has(ch)) continue;
    return { error: `“${ch}” is not a stroke. Use R, L, and K.` };
  }
  if (!hands.length) return { error: "Type a sticking, such as R L K L or R L R R L R L L." };
  if (hands.length > 48) return { error: "Keep it to 48 strokes or fewer." };
  return { hands };
}

export function voiceStep(style, step, hand, stepsPerBeat, { writtenKick = false } = {}) {
  const beat = Math.floor(step / stepsPerBeat) % 4;
  const downbeat = step % stepsPerBeat === 0;
  const backbeat = downbeat && (beat === 1 || beat === 3);
  const pulse = downbeat && (beat === 0 || beat === 2);
  const stepsPerBar = stepsPerBeat * 4;
  const barEnd = step % stepsPerBar === stepsPerBar - 1;
  const kick = { hand: "F", element: "kick", accent: false };

  if (style === "snare") {
    return { element: "snare", accent: false, extras: [], rest: false };
  }

  if (style === "hats" || style === "ride") {
    const cymbal = style === "hats" ? "hat" : "ride";
    return {
      element: backbeat ? "snare" : hand === "R" ? cymbal : "snare",
      accent: backbeat,
      extras: pulse && !writtenKick ? [kick] : [],
      rest: false,
    };
  }

  if (style === "linear") {
    if (pulse && !writtenKick) return { element: "kick", accent: false, extras: [], rest: true, foot: kick };
    if (backbeat) return { element: "snare", accent: true, extras: [], rest: false };
    return {
      element: hand === "R" ? "hat" : "snare",
      accent: false,
      extras: [],
      rest: false,
    };
  }

  if (style === "down") {
    const path = ["snare", "tom1", "tom2", "floor"];
    return {
      element: path[beat],
      accent: downbeat || barEnd,
      extras: barEnd && !writtenKick ? [{ ...kick, accent: true }] : [],
      rest: false,
    };
  }

  if (style === "split") {
    const leftPath = ["snare", "tom1", "tom2", "floor"];
    return {
      element: hand === "R" ? "snare" : leftPath[beat],
      accent: beat === 3 && downbeat,
      extras: barEnd && !writtenKick ? [kick] : [],
      rest: false,
    };
  }

  throw new Error(`Unknown voicing “${style}”.`);
}

function pushVoiced(out, note, decision) {
  if (decision.rest) {
    const foot = decision.foot;
    out.push({
      ...note,
      hand: foot.hand,
      element: foot.element,
      accent: !!foot.accent,
      grace: false,
      group: `${note.group}:kick`,
    });
    return;
  }

  out.push({
    ...note,
    element: decision.element,
    accent: note.grace ? false : note.accent || decision.accent,
  });

  for (const extra of decision.extras) {
    out.push({
      beat: note.beat,
      baseStep: note.baseStep,
      hand: extra.hand,
      element: extra.element,
      accent: !!extra.accent,
      grace: false,
      graceIndex: 0,
      graceCount: 0,
      group: `${note.group}:${extra.element}`,
    });
  }
}

export function expandHands(hands, stepsPerBeat, bars, style) {
  const steps = bars * 4 * stepsPerBeat;
  const writtenKick = hands.includes("K");
  const notes = [];
  for (let step = 0; step < steps; step += 1) {
    const hand = hands[step % hands.length];
    if (hand === "K") {
      notes.push({
        beat: step / stepsPerBeat,
        baseStep: step,
        hand: "F",
        element: "kick",
        accent: false,
        grace: false,
        graceIndex: 0,
        graceCount: 0,
        group: `s${step}`,
      });
      continue;
    }
    const decision = voiceStep(style, step, hand, stepsPerBeat, { writtenKick });
    pushVoiced(notes, {
      beat: step / stepsPerBeat,
      baseStep: step,
      hand,
      grace: false,
      graceIndex: 0,
      graceCount: 0,
      accent: style === "snare" && step % hands.length === 0,
      element: "snare",
      group: `s${step}`,
    }, decision);
  }
  return notes;
}

export function voiceChart(chart, style, stepsPerBeat) {
  const groups = new Map();
  for (const note of chart) {
    if (!groups.has(note.group)) groups.set(note.group, []);
    groups.get(note.group).push(note);
  }

  const notes = [];
  for (const members of groups.values()) {
    const primary = members.find((note) => !note.grace);
    if (!primary) continue;
    const decision = voiceStep(style, primary.baseStep, primary.hand, stepsPerBeat);

    if (decision.rest) {
      notes.push({
        beat: primary.beat,
        baseStep: primary.baseStep,
        hand: "F",
        element: "kick",
        accent: false,
        grace: false,
        graceIndex: 0,
        graceCount: 0,
        group: `${primary.group}:kick`,
      });
      continue;
    }

    for (const member of members) {
      notes.push({
        ...member,
        element: decision.element,
        accent: member.grace ? false : member.accent || decision.accent,
      });
    }
    for (const extra of decision.extras) {
      notes.push({
        beat: primary.beat,
        baseStep: primary.baseStep,
        hand: extra.hand,
        element: extra.element,
        accent: !!extra.accent,
        grace: false,
        graceIndex: 0,
        graceCount: 0,
        group: `${primary.group}:${extra.element}`,
      });
    }
  }

  return notes.sort((a, b) => a.beat - b.beat || a.baseStep - b.baseStep);
}

function backbeatHands(notes, stepsPerBeat) {
  const found = [];
  for (const note of notes) {
    if (note.grace || note.hand === "F" || !note.accent || note.element !== "snare") continue;
    const beat = Math.floor(note.baseStep / stepsPerBeat) % 4;
    if (beat !== 1 && beat !== 3) continue;
    const name = note.hand === "R" ? "right" : "left";
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

function describe(style, grid, notes, stepsPerBeat, resolves, handCount, writtenKick) {
  const turn = resolves
    ? `The ${handCount}-note sticking closes inside these bars.`
    : `It is ${handCount} notes long, so it turns around the bar and continues.`;
  const placed = "K is the kick on the steps you wrote, and it plays alone.";

  if (style === "snare") {
    const foot = writtenKick ? ` ${placed}` : "";
    return `${grid.label} on the snare, each hand in the color it plays.${foot} ${turn}`;
  }
  if (style === "hats" || style === "ride") {
    const cymbal = style === "hats" ? "hi-hat" : "ride";
    const hands = backbeatHands(notes, stepsPerBeat);
    const who = hands.length === 1
      ? `The backbeat is in the ${hands[0]} hand.`
      : hands.length > 1
        ? "Both hands take backbeats somewhere in the phrase."
        : "No note lands on beat 2 or 4 in this slice, so nothing is moved to a backbeat.";
    const foot = writtenKick ? placed : "Kick on 1 and 3.";
    return `Right hand on the ${cymbal}, left hand on the snare, except beats 2 and 4: whichever hand lands there plays an accented snare. ${foot} ${who} ${turn}`;
  }
  if (style === "linear") {
    const foot = writtenKick
      ? placed
      : "Beats 1 and 3 are the kick, so the hand that would have played them rests.";
    return `One surface at a time. ${foot} Beats 2 and 4 are accented snare. Other rights stay on the hi-hat and other lefts on the snare. ${turn}`;
  }
  if (style === "down") {
    const foot = writtenKick
      ? placed
      : "The last note of the bar is played with the kick.";
    return `Each beat moves to the next drum: snare, tom 1, tom 2, floor. ${foot} ${turn}`;
  }
  const foot = writtenKick
    ? placed
    : "The kick joins the last note of the bar.";
  return `The right hand stays on the snare. The left hand starts there and moves through tom 1, tom 2, and the floor. ${foot} ${turn}`;
}

function arrangement({ id, style, grid, notes, bars, steps, resolves, handCount, recipe, timing, writtenKick = false }) {
  const meta = STYLE_BY_ID[style];
  return {
    id,
    title: meta.title,
    kind: meta.kind,
    timing: timing || grid.label,
    summary: describe(style, grid, notes, grid.stepsPerBeat, resolves, handCount, writtenKick),
    stepsPerBeat: grid.stepsPerBeat,
    steps,
    bars,
    notes,
    resolves,
    recipe,
  };
}

export function generateArrangements(hands, { grids = ["8", "16"], bars = 2 } = {}) {
  const out = [];
  for (const gridId of grids) {
    const grid = GRIDS[gridId];
    if (!grid) continue;
    const steps = bars * 4 * grid.stepsPerBeat;
    for (const style of STYLES) {
      const notes = expandHands(hands, grid.stepsPerBeat, bars, style.id);
      out.push(arrangement({
        id: `${style.id}-${grid.id}`,
        style: style.id,
        grid,
        notes,
        bars,
        steps,
        resolves: steps % hands.length === 0,
        handCount: hands.length,
        writtenKick: hands.includes("K"),
        recipe: { type: "hands", hands: hands.slice(), grid: grid.id, style: style.id },
      }));
    }
  }
  return out;
}

export function arrangementsFromPattern(pattern, { grids = ["8", "16"], bars = 2 } = {}) {
  const parsed = parsePattern(pattern);
  const primaries = parsed.notes.filter((note) => !note.grace).length;
  const out = [];
  for (const gridId of grids) {
    const grid = GRIDS[gridId];
    if (!grid) continue;
    const steps = bars * 4 * grid.stepsPerBeat;
    for (const styleId of ["snare", "down", "split"]) {
      const chart = buildChart(parsed, { bars, stepsPerBeat: grid.stepsPerBeat });
      const notes = voiceChart(chart, styleId, grid.stepsPerBeat);
      out.push(arrangement({
        id: `${styleId}-${grid.id}`,
        style: styleId,
        grid,
        notes,
        bars,
        steps,
        resolves: steps % primaries === 0,
        handCount: primaries,
        recipe: { type: "pattern", pattern, stepsPerBeat: grid.stepsPerBeat, style: styleId },
      }));
    }
  }
  return out;
}

function phraseNotes(groups, elementAt) {
  const rhythm = [
    { pos: 0, hand: "R", accent: false },
    { pos: 2, hand: "L", accent: false },
    { pos: 4, hand: "R", accent: false },
    { pos: 5, hand: "R", accent: true },
  ];
  const path = ["snare", "tom1", "tom2", "floor"];
  const notes = [];
  for (let group = 0; group < groups; group += 1) {
    const element = elementAt(group, path);
    for (const hit of rhythm) {
      const pos = group * 6 + hit.pos;
      notes.push({
        beat: pos / 8,
        baseStep: pos,
        hand: hit.hand,
        element,
        accent: hit.accent,
        grace: false,
        graceIndex: 0,
        graceCount: 0,
        group: `h${group}:${hit.pos}`,
      });
    }
  }
  return notes;
}

function hertaPhrase(id, title, kind, summary, elementAt) {
  const notes = phraseNotes(4, elementAt);
  return {
    id,
    title,
    kind,
    timing: "16th, 16th, 32nd, 32nd",
    summary,
    stepsPerBeat: 8,
    steps: 24,
    bars: 0.75,
    notes,
    resolves: false,
    recipe: { type: "phrase", notes, phraseBeats: 3, stepsPerBeat: 8 },
  };
}

export function classicHertas() {
  return [
    hertaPhrase(
      "herta-classic",
      "Classic herta, on the snare",
      "study",
      "The double at the end is squeezed into two 32nds. Four of them take three beats, so the phrase sits across the bar on purpose.",
      () => "snare",
    ),
    hertaPhrase(
      "herta-classic-fill",
      "Classic herta, moving",
      "fill",
      "Same rhythm. Each group moves to the next drum: snare, tom 1, tom 2, floor. The accented double is the note that changes surface.",
      (group, path) => path[group % path.length],
    ),
  ];
}

export function loopPhrase(notes, phraseBeats, totalBeats, phraseSteps) {
  const span = phraseSteps || notes.reduce((max, note) => Math.max(max, note.baseStep + 1), 0);
  const out = [];
  for (let origin = 0; origin < totalBeats - 1e-6; origin += phraseBeats) {
    for (const note of notes) {
      const beat = note.beat + origin;
      if (beat >= totalBeats - 1e-6) continue;
      out.push({
        ...note,
        beat,
        baseStep: note.baseStep + Math.round(origin / phraseBeats) * span,
        result: null,
        deltaMs: null,
      });
    }
  }
  return out;
}

export function materialize(recipe, bars = 4) {
  if (!recipe) return [];
  if (recipe.type === "hands") {
    return expandHands(recipe.hands, GRIDS[recipe.grid].stepsPerBeat, bars, recipe.style);
  }
  if (recipe.type === "pattern") {
    const parsed = parsePattern(recipe.pattern);
    const chart = buildChart(parsed, { bars, stepsPerBeat: recipe.stepsPerBeat });
    return voiceChart(chart, recipe.style, recipe.stepsPerBeat);
  }
  if (recipe.type === "phrase") {
    return loopPhrase(recipe.notes, recipe.phraseBeats, bars * 4, recipe.phraseSteps);
  }
  return [];
}

export function defaultBpm(stepsPerBeat) {
  if (stepsPerBeat >= 8) return 52;
  if (stepsPerBeat >= 6) return 64;
  if (stepsPerBeat >= 4) return 80;
  if (stepsPerBeat === 3) return 76;
  return 96;
}

export const STICKINGS = [
  {
    id: "singles",
    name: "Singles",
    display: "R L",
    about: "Hand to hand. This is the 16th-note hi-hat when you play every note, and the cleanest way down the drums, because each hand takes a new surface.",
  },
  {
    id: "kick-linear",
    name: "Right, left, kick, left",
    display: "R L K L",
    about: "A linear cell with the kick written in. K takes that step by itself. On a groove the right stays on the cymbal and the lefts sit on the snare. On a fill the hands move, and the kick stays where you put it.",
  },
  {
    id: "doubles",
    name: "Doubles",
    display: "R R L L",
    about: "Two in each hand. On the kit, a double lets you stay on a drum or play a cymbal and a drum with the same hand. The second stroke has to be as full as the first.",
  },
  {
    id: "paradiddle",
    name: "Paradiddle",
    display: "R L R R L R L L",
    about: "The mixed sticking that shows up most often. As 16ths from beat 1 the left hand already lands on 2 and 4. As 8ths, the right hand takes those backbeats instead.",
  },
  {
    id: "inverted",
    name: "Inverted paradiddle",
    display: "R R L R L L R L",
    about: "The double moves to the front. The accent wants the downbeat, which suits funk figures that lean on 1 and 3. The second right is free to leave the cymbal.",
  },
  {
    id: "reverse",
    name: "Reverse paradiddle",
    display: "R L L R L R R L",
    about: "The double sits in the middle. Use it when the note you want to hear is not the first one. The two lefts are a natural hop to a tom and back.",
  },
  {
    id: "paradiddle-diddle",
    name: "Paradiddle-diddle",
    display: "R L R R L L",
    about: "Six notes, so as straight 16ths the accent walks across the bar. As triplets or sextuplets it sits still. Move the two doubles and leave the singles on the snare.",
  },
  {
    id: "double-paradiddle",
    name: "Double paradiddle",
    display: "R L R L R R",
    about: "A paradiddle with an extra single. In sextuplets, one group is one beat. Accent the first note and let the double at the end be the one that changes drum.",
  },
  {
    id: "six-stroke",
    name: "Six-stroke",
    display: "R L L R R L",
    about: "The fill most players reach for without naming it. Accents on the first and last. Play those on toms and the diddles on the snare, or the other way when you want the snare to poke out.",
  },
  {
    id: "herta",
    name: "Herta",
    display: "R L R R",
    about: "A single, a single, and a double. Even 16ths are the grid version used for chops and fills. The older rhythm squeezes the double into two 32nds after two 16ths.",
    extra: "herta",
  },
  {
    id: "rrl",
    name: "Right right left",
    display: "R R L",
    about: "The Swiss army triplet without the flam. As triplets, the two rights can ride or hat and the left taps the snare. Put the flam back on when you practice the rudiment.",
  },
  {
    id: "flam-tap",
    name: "Flam tap",
    display: "lR R · rL L",
    pattern: "lRRrLL",
    about: "A flam and a tap with the same hand. Keep the grace note on the same drum as its main stroke. The tap can answer on another drum. Grace notes are written small in the grid.",
  },
  {
    id: "drag",
    name: "Drag",
    display: "llR · rrL",
    pattern: "llRrrL",
    about: "Two soft bounces and a main stroke on the other hand. The three notes belong on one drum. Used as a pickup, it leads into a backbeat.",
  },
];

export function arrangementsFor(entry, grids) {
  if (entry.pattern) return arrangementsFromPattern(entry.pattern, { grids, bars: 2 });
  const parsed = parseSticking(entry.display);
  const arrangements = generateArrangements(parsed.hands, { grids, bars: 2 });
  if (entry.extra === "herta") arrangements.push(...classicHertas());
  return arrangements;
}

export function elementsIn(notes) {
  const ids = new Set(notes.map((note) => note.element));
  return ELEMENTS.filter((element) => ids.has(element.id));
}

export { gridLabel };
