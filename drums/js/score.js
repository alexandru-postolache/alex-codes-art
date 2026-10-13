export const WINDOWS = { perfect: 30, great: 55, good: 90 };

const WEIGHT = { perfect: 1, great: 0.85, good: 0.55, miss: 0 };

export function graceLeads(graceCount, stepMs) {
  const limit = stepMs * 0.46;
  if (graceCount >= 2) {
    let far = 68;
    let near = 32;
    if (far > limit) {
      far = limit;
      near = far * 0.46;
    }
    if (near > far - 12) near = far * 0.45;
    return [Math.round(far), Math.round(Math.max(12, near))];
  }
  return [Math.round(Math.min(34, Math.max(12, limit)))];
}

export function schedule(notes, downbeat, bpm, stepsPerBeat) {
  const beatDur = 60 / bpm;
  const stepMs = 60000 / (bpm * stepsPerBeat);
  return notes.map((note, id) => {
    let time = downbeat + note.beat * beatDur;
    if (note.grace) {
      const leads = graceLeads(note.graceCount, stepMs);
      time -= (leads[note.graceIndex] ?? leads[0]) / 1000;
    }
    return { ...note, id, time, result: null, deltaMs: null };
  });
}

export function judge(deltaMs, grace = false) {
  const slack = grace ? 12 : 0;
  const distance = Math.abs(deltaMs);
  const within = (limit) => distance <= limit + slack + 0.2;
  if (within(WINDOWS.perfect)) return "perfect";
  if (within(WINDOWS.great)) return "great";
  if (within(WINDOWS.good)) return "good";
  return null;
}

export function registerHit(notes, element, hitTime) {
  let best = null;
  let bestDistance = Infinity;

  for (const note of notes) {
    if (note.result || note.element !== element) continue;
    const delta = (hitTime - note.time) * 1000;
    const distance = Math.abs(delta);
    const limit = WINDOWS.good + (note.grace ? 12 : 0);
    if (distance > limit) continue;
    const closer = distance < bestDistance - 0.01;
    const tie = Math.abs(distance - bestDistance) <= 0.01 && best && note.time < best.time;
    if (closer || tie || !best) {
      best = note;
      bestDistance = distance;
    }
  }

  if (!best) return null;
  const deltaMs = (hitTime - best.time) * 1000;
  const result = judge(deltaMs, best.grace);
  if (!result) return null;
  best.result = result;
  best.deltaMs = deltaMs;
  return best;
}

export function expireMisses(notes, now) {
  let changed = false;
  for (const note of notes) {
    if (note.result) continue;
    const limit = (WINDOWS.good + (note.grace ? 12 : 0)) / 1000;
    if (now > note.time + limit) {
      note.result = "miss";
      note.deltaMs = null;
      changed = true;
    }
  }
  return changed;
}

export function starRating(score, played) {
  if (!played) return 0;
  if (score >= 93) return 5;
  if (score >= 84) return 4;
  if (score >= 70) return 3;
  if (score >= 52) return 2;
  return 1;
}

export function summarize(notes) {
  const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  const hands = {
    R: { total: 0, hit: 0, deltaSum: 0, deltaCount: 0 },
    L: { total: 0, hit: 0, deltaSum: 0, deltaCount: 0 },
  };
  let weighted = 0;
  let weightSum = 0;
  let deltaSum = 0;
  let deltaCount = 0;
  let early = 0;
  let late = 0;
  let pending = 0;

  for (const note of notes) {
    const hand = hands[note.hand];
    if (hand && !note.grace) hand.total += 1;
    if (!note.result) {
      pending += 1;
      continue;
    }
    counts[note.result] += 1;
    const weight = note.grace ? 0.5 : 1;
    weightSum += weight;
    weighted += weight * WEIGHT[note.result];
    if (note.result === "miss") continue;
    if (hand && !note.grace) {
      hand.hit += 1;
      hand.deltaSum += note.deltaMs;
      hand.deltaCount += 1;
    }
    if (!note.grace) {
      deltaSum += note.deltaMs;
      deltaCount += 1;
      if (note.deltaMs < -8) early += 1;
      else if (note.deltaMs > 8) late += 1;
    }
  }

  const played = counts.perfect + counts.great + counts.good;
  const score = weightSum ? Math.round((weighted / weightSum) * 100) : 0;
  const pack = (hand) => ({
    total: hand.total,
    hit: hand.hit,
    meanDeltaMs: hand.deltaCount ? hand.deltaSum / hand.deltaCount : null,
  });

  return {
    total: notes.length,
    played,
    pending,
    counts,
    score,
    stars: starRating(score, played),
    meanDeltaMs: deltaCount ? deltaSum / deltaCount : null,
    early,
    late,
    hands: { R: pack(hands.R), L: pack(hands.L) },
  };
}

export function timingSentence(meanDeltaMs) {
  if (meanDeltaMs == null || Number.isNaN(meanDeltaMs)) {
    return "No hits landed in the window.";
  }
  const ms = Math.round(meanDeltaMs);
  if (Math.abs(ms) <= 8) return "Your average hit sat in the pocket.";
  if (ms < 0) return `You averaged ${Math.abs(ms)} ms early.`;
  return `You averaged ${ms} ms late.`;
}

export function starLabel(stars) {
  return ["No scored hits", "A start", "Loose", "Getting there", "Solid", "In the pocket"][stars] || "";
}
