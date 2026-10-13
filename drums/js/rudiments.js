import { buildChart, formatSticking, gridLabel, parsePattern } from "./pattern.js";

const FAMILIES = [
  { id: "roll", label: "Rolls" },
  { id: "diddle", label: "Diddles" },
  { id: "flam", label: "Flams" },
  { id: "drag", label: "Drags" },
];

const DEFS = [
  ["single-stroke", 1, "roll", "Single Stroke Roll", "RL", 4, 80, false,
    "Alternating strokes at an even height. This is the motion under 16th notes around the kit."],
  ["single-stroke-four", 2, "roll", "Single Stroke Four", "R>LRLL>RLR", 4, 80, false,
    "Four alternating strokes, accent on the first of each group of four."],
  ["single-stroke-seven", 3, "roll", "Single Stroke Seven", "R>LRLRLR.L>RLRLRL.", 4, 76, false,
    "Seven alternating strokes and a rest, accent on the first. The accents land on beats 1 and 3."],
  ["multiple-bounce", 4, "roll", "Multiple Bounce Roll", "RL", 2, 72, true,
    "A buzz roll. The marks are an 8th-note pulse, alternating hands. Buzz between them and land each hand on the pulse."],
  ["triple-stroke", 5, "roll", "Triple Stroke Roll", "RRRLLL", 4, 72, false,
    "Three strokes in each hand. The third stroke is the one that usually thins out — keep it as full as the first."],
  ["double-stroke", 6, "roll", "Double Stroke Open Roll", "RRLL", 4, 80, false,
    "Two and two, every stroke a wrist stroke. Even doubles are the open roll, before it closes into a buzz."],
  ["five-stroke", 7, "roll", "Five Stroke Roll", "RRLLR>...LLRRL>...", 4, 72, false,
    "Two doubles and an accented release. The release sits on beats 2 and 4, and the hands swap after each one."],
  ["six-stroke", 8, "roll", "Six Stroke Roll", "R>LLRRL>", 6, 64, false,
    "Accent, diddle, diddle, accent, one group per beat. The accented notes are the ones to move onto toms later."],
  ["seven-stroke", 9, "roll", "Seven Stroke Roll", "RRLLRRL>.LLRRLLR>.", 4, 70, false,
    "Three doubles and a release on the next beat, then a rest, then the other hand leads."],
  ["nine-stroke", 10, "roll", "Nine Stroke Roll", "RRLLRRLLR>", 4, 68, false,
    "Four doubles and a release. Nine strokes, so the accent walks against the bar. Listen for the release."],
  ["ten-stroke", 11, "roll", "Ten Stroke Roll", "RRLLRRLLRRLLRRLLRRLL", 4, 68, false,
    "Five doubles led by the right, then the same roll led by the left."],
  ["eleven-stroke", 12, "roll", "Eleven Stroke Roll", "RRLLRRLLRRL>", 4, 64, false,
    "Five doubles and a release. The accent walks, the same way it does in the nine-stroke roll."],
  ["thirteen-stroke", 13, "roll", "Thirteen Stroke Roll", "RRLLRRLLRRLLR>", 4, 62, false,
    "Six doubles and a release. Keep the doubles open and save the accent for the single at the end."],
  ["fifteen-stroke", 14, "roll", "Fifteen Stroke Roll", "RRLLRRLLRRLLRRL>", 4, 60, false,
    "Seven doubles and a release. Long enough that the second stroke of each double will show you where you tense up."],
  ["seventeen-stroke", 15, "roll", "Seventeen Stroke Roll", "RRLLRRLLRRLLRRLLR>", 4, 58, false,
    "Eight doubles and a release. Same open-roll hands as the double-stroke roll, with one accented way out."],
  ["paradiddle", 16, "diddle", "Single Paradiddle", "RLRRLRLL", 4, 80, false,
    "Single, single, double. As 16ths from beat 1, the left hand lands on beats 2 and 4."],
  ["double-paradiddle", 17, "diddle", "Double Paradiddle", "R>LRLRRL>RLRLL", 6, 70, false,
    "Two singles and a double in each hand. As sextuplets, one group is one beat. Accent the first note."],
  ["triple-paradiddle", 18, "diddle", "Triple Paradiddle", "RLRLRLRRLRLRLRLL", 4, 72, false,
    "Three singles and a double in each hand. As 16ths, the right-hand group takes half a bar."],
  ["paradiddle-diddle", 19, "diddle", "Single Paradiddle-Diddle", "R>LRRLLL>RLLRR", 6, 68, false,
    "A single and two doubles. As sextuplets, one group per beat. The doubles are the part you split between drums."],
  ["flam", 20, "flam", "Flam", "lRrL", 2, 72, false,
    "A soft grace note just ahead of the opposite hand. Both notes of a flam belong on the same drum. One flam per 8th note."],
  ["flam-accent", 21, "flam", "Flam Accent", "lR>LRrL>RL", 3, 72, false,
    "A flam and two taps, as a triplet. The flam is the accent. Keep the taps lower."],
  ["flam-tap", 22, "flam", "Flam Tap", "lRRrLL", 4, 76, false,
    "A flam, then a tap with the hand that played the main note. Then the same thing starting on the other hand."],
  ["flamacue", 23, "flam", "Flamacue", "lRL>RLlRrLR>LRrL", 4, 70, false,
    "Flam, accent, tap, tap, flam. The accent is the second note, not the flam."],
  ["flam-paradiddle", 24, "flam", "Flam Paradiddle", "lRLRRrLRLL", 4, 70, false,
    "A paradiddle with a flam on the first note of each hand."],
  ["flammed-mill", 25, "flam", "Single Flammed Mill", "lRRLRrLLRL", 4, 70, false,
    "A flam, a right, a left, and a right, then the left-hand version. The flam is the only grace note."],
  ["flam-paradiddle-diddle", 26, "flam", "Flam Paradiddle-Diddle", "lRLRRLLrLRLLRR", 4, 66, false,
    "A paradiddle-diddle with a flam on the first note."],
  ["pataflafla", 27, "flam", "Pataflafla", "lRLRrL", 4, 72, false,
    "Flam, left, right, flam. One group per beat. Learn it on one drum, then move a whole group at a time."],
  ["swiss-army", 28, "flam", "Swiss Army Triplet", "lR>RLrL>LR", 3, 72, false,
    "A flam, a tap with the same hand, and a tap with the other, as a triplet. Then swap hands."],
  ["inverted-flam-tap", 29, "flam", "Inverted Flam Tap", "lRLrLR", 4, 74, false,
    "Flam, opposite hand, flam, opposite hand. The grace note sits in the middle of the group."],
  ["flam-drag", 30, "flam", "Flam Drag", "lRLLRrLRRL", 4, 68, false,
    "A flam, a measured double with the other hand, and a tap. The double is in the rhythm, not a grace note."],
  ["drag", 31, "drag", "Drag", "llRrrL", 2, 60, false,
    "Two soft grace notes and a main stroke. All three belong on the same drum. One drag per 8th note."],
  ["single-drag-tap", 32, "drag", "Single Drag Tap", "llRL>rrLR>", 2, 60, false,
    "A drag and then an accented tap with the other hand."],
  ["double-drag-tap", 33, "drag", "Double Drag Tap", "llRllRL>rrLrrLR>", 2, 56, false,
    "Two drags and an accented tap. The tap is the note to hear; the drags stay low."],
  ["lesson-25", 34, "drag", "Lesson 25", "llRLR>rrLRL>", 4, 60, false,
    "A drag and two taps. The accent is the last note of the group."],
  ["dragadiddle", 35, "drag", "Single Dragadiddle", "RRLRRLLRLL", 4, 70, false,
    "A measured double, a single, and a double. No grace notes — the opening double is played in the rhythm."],
  ["drag-paradiddle-1", 36, "drag", "Drag Paradiddle #1", "R>llRLRRL>rrLRLL", 4, 60, false,
    "A tap, a drag into the next stroke, then the rest of the paradiddle shape. The hands swap on the repeat."],
  ["drag-paradiddle-2", 37, "drag", "Drag Paradiddle #2", "R>llRllRLRRL>rrLrrLRLL", 4, 56, false,
    "A tap and two drags, then the double that finishes the paradiddle."],
  ["single-ratamacue", 38, "drag", "Single Ratamacue", "llRLRL>rrLRLR>", 4, 60, false,
    "A drag and three singles. The last note is the accent."],
  ["double-ratamacue", 39, "drag", "Double Ratamacue", "llRllRLRL>rrLrrLRLR>", 4, 56, false,
    "Two drags, then three singles, accent on the last."],
  ["triple-ratamacue", 40, "drag", "Triple Ratamacue", "llRllRllRLRL>rrLrrLrrLRLR>", 4, 52, false,
    "Three drags, then three singles, accent on the last. The drags are the quiet part."],
];

function makeRudiment(def) {
  const [id, number, family, name, pattern, stepsPerBeat, defaultBpm, buzz, about] = def;
  const parsed = parsePattern(pattern);
  return {
    id,
    number,
    family,
    name,
    pattern,
    stepsPerBeat,
    defaultBpm,
    buzz,
    about,
    notes: parsed.notes,
    cellSteps: parsed.cellSteps,
    sticking: formatSticking(parsed),
    grid: gridLabel(stepsPerBeat),
  };
}

export const RUDIMENTS = DEFS.map(makeRudiment);

export const FAMILY_FILTERS = [
  { id: "all", label: "All" },
  ...FAMILIES,
];

export function familyLabel(id) {
  return FAMILIES.find((family) => family.id === id)?.label || "";
}

export function findRudiment(id) {
  return RUDIMENTS.find((rudiment) => rudiment.id === id) || null;
}

export function noteValueOptions(rudiment) {
  const options = [
    { id: "8", stepsPerBeat: 2, label: "8ths" },
    { id: "16", stepsPerBeat: 4, label: "16ths" },
  ];
  if (rudiment.stepsPerBeat !== 2 && rudiment.stepsPerBeat !== 4) {
    const label = rudiment.stepsPerBeat === 3
      ? "Triplets"
      : rudiment.stepsPerBeat === 6
        ? "Sextuplets"
        : gridLabel(rudiment.stepsPerBeat);
    options.push({ id: "written", stepsPerBeat: rudiment.stepsPerBeat, label });
  }
  return options;
}

export function defaultNoteValue(rudiment) {
  if (rudiment.stepsPerBeat === 2) return "8";
  if (rudiment.stepsPerBeat === 4) return "16";
  return "written";
}

export function stepsForNoteValue(rudiment, noteValue) {
  const option = noteValueOptions(rudiment).find((item) => item.id === noteValue);
  return option ? option.stepsPerBeat : rudiment.stepsPerBeat;
}

export function chartFor(rudiment, bars, stepsPerBeat = rudiment.stepsPerBeat) {
  return buildChart(rudiment, { bars, stepsPerBeat });
}
