// Sticking notation: R/L are strokes, r/l are grace notes, > accents the stroke
// just before it, and "." is a rest the length of one step.

export function parsePattern(str) {
  const s = String(str).replace(/[·•|\s]/g, "");
  const notes = [];
  let step = 0;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (ch === ".") {
      step += 1;
      i += 1;
      continue;
    }
    if (ch === ">") {
      i += 1;
      continue;
    }

    const graces = [];
    while (i < s.length && (s[i] === "r" || s[i] === "l")) {
      graces.push(s[i].toUpperCase());
      i += 1;
    }

    if (i >= s.length || (s[i] !== "R" && s[i] !== "L")) {
      throw new Error(`Could not read “${s.slice(i, i + 8) || "end"}” in “${str}”.`);
    }

    const hand = s[i];
    i += 1;
    let accent = false;
    if (s[i] === ">") {
      accent = true;
      i += 1;
    }

    const graceCount = graces.length;
    graces.forEach((handName, graceIndex) => {
      notes.push({
        step,
        hand: handName,
        grace: true,
        graceIndex,
        graceCount,
        accent: false,
        element: "snare",
      });
    });
    notes.push({
      step,
      hand,
      grace: false,
      graceIndex: 0,
      graceCount: 0,
      accent,
      element: "snare",
    });
    step += 1;
  }

  if (!notes.some((n) => !n.grace)) {
    throw new Error("That sticking has no strokes.");
  }

  return { notes, cellSteps: step };
}

export function formatSticking(pattern) {
  const slots = Array.from({ length: pattern.cellSteps }, () => null);
  for (const note of pattern.notes) {
    if (!slots[note.step]) slots[note.step] = { graces: [], primary: null };
    if (note.grace) slots[note.step].graces.push(note);
    else slots[note.step].primary = note;
  }

  return slots
    .map((slot) => {
      if (!slot || !slot.primary) return "·";
      const grace = slot.graces
        .slice()
        .sort((a, b) => a.graceIndex - b.graceIndex)
        .map((n) => n.hand.toLowerCase())
        .join("");
      return grace + slot.primary.hand;
    })
    .join(" ");
}

export function buildChart(pattern, { bars, stepsPerBeat }) {
  const cell = pattern.cellSteps;
  if (!cell || !stepsPerBeat || !bars) {
    throw new Error("A chart needs a pattern, a grid, and a length.");
  }

  const totalSteps = bars * 4 * stepsPerBeat;
  const notes = [];

  for (let origin = 0; origin < totalSteps; origin += cell) {
    for (const note of pattern.notes) {
      const base = origin + note.step;
      if (base >= totalSteps) continue;
      notes.push({
        beat: base / stepsPerBeat,
        baseStep: base,
        hand: note.hand,
        grace: note.grace,
        graceIndex: note.graceIndex,
        graceCount: note.graceCount,
        accent: note.accent,
        element: note.element || "snare",
        group: `${origin}:${note.step}`,
      });
    }
  }

  return notes;
}

export function gridLabel(stepsPerBeat) {
  switch (stepsPerBeat) {
    case 2:
      return "8th notes";
    case 3:
      return "8th-note triplets";
    case 4:
      return "16th notes";
    case 5:
      return "quintuplets";
    case 6:
      return "sextuplets";
    case 8:
      return "32nd notes";
    default:
      return `${stepsPerBeat} notes per beat`;
  }
}
