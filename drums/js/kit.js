// Default pad notes from the Alesis Nitro Max Drum Module User Guide, section 5.2.
// Head and rim share a lane. The hi-hat pedal is a foot chick, not a stick hit.

export const ELEMENTS = [
  { id: "crash", label: "Crash" },
  { id: "ride", label: "Ride" },
  { id: "hat", label: "Hi-hat" },
  { id: "tom1", label: "Tom 1" },
  { id: "tom2", label: "Tom 2" },
  { id: "snare", label: "Snare" },
  { id: "floor", label: "Floor" },
  { id: "kick", label: "Kick" },
];

export const PADS = [
  { id: "kick", label: "Kick", key: "B", code: "KeyB" },
  { id: "snare", label: "Snare", key: "D", code: "KeyD" },
  { id: "tom1", label: "Tom 1", key: "F", code: "KeyF" },
  { id: "tom2", label: "Tom 2", key: "G", code: "KeyG" },
  { id: "floor", label: "Floor", key: "H", code: "KeyH" },
  { id: "hat", label: "Hat", key: "J", code: "KeyJ" },
  { id: "ride", label: "Ride", key: "L", code: "KeyL" },
  { id: "crash", label: "Crash", key: "C", code: "KeyC" },
];

export const NITRO_MAX = {
  36: "kick",
  38: "snare",
  40: "snare",
  48: "tom1",
  50: "tom1",
  45: "tom2",
  47: "tom2",
  43: "floor",
  58: "floor",
  41: "floor",
  39: "floor",
  49: "crash",
  57: "crash",
  51: "ride",
  53: "ride",
  46: "hat",
  42: "hat",
  23: "hat",
  21: "hat",
  44: null,
};

export const KEY_MAP = {
  KeyB: "kick",
  Space: "kick",
  KeyD: "snare",
  KeyF: "tom1",
  KeyG: "tom2",
  KeyH: "floor",
  KeyJ: "hat",
  KeyL: "ride",
  KeyC: "crash",
};

const LABELS = Object.fromEntries(ELEMENTS.map((e) => [e.id, e.label]));

export function elementLabel(id) {
  if (id === null) return "Hi-hat pedal";
  return LABELS[id] || "Unmapped";
}

export function letterFor(note) {
  if (note.element === "kick" || note.hand === "F") return "K";
  return note.hand;
}

export function laneOrder(ids) {
  const wanted = new Set(ids);
  return ELEMENTS.filter((e) => wanted.has(e.id));
}
