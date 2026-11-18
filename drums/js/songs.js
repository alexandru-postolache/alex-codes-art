// Recorded songs. Hits stay in localStorage. A backing track that does not
// fit there is handed back so the page can keep it in IndexedDB.

export const SONG_KEY = "handline-songs";
export const SONG_FORMAT = "handline-song";

const ELEMENTS = new Set(["crash", "ride", "hat", "tom1", "tom2", "snare", "floor", "kick"]);
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function clampBpm(value) {
  const bpm = Math.round(Number(value));
  if (!Number.isFinite(bpm)) return 80;
  return Math.max(40, Math.min(200, bpm));
}

export function newSongId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function hitBeat(time, downbeat, bpm) {
  return ((time - downbeat) * bpm) / 60;
}

export function audioRate(recordedBpm, practiceBpm) {
  const base = clampBpm(recordedBpm);
  const play = clampBpm(practiceBpm);
  return Math.max(0.25, Math.min(4, play / base));
}

export function songFileName(name) {
  const slug = String(name || "song")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "song"}.json`;
}

function clampVelocity(value) {
  const velocity = Math.round(Number(value));
  if (!Number.isFinite(velocity)) return 100;
  return Math.max(1, Math.min(127, velocity));
}

function cleanName(name) {
  const text = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return text || "Song";
}

function cleanId(id) {
  const text = String(id ?? "");
  return ID_RE.test(text) ? text : newSongId();
}

export function recordHit(hits, hit, bpm) {
  const beat = Number(hit?.beat);
  if (!Number.isFinite(beat) || !ELEMENTS.has(hit.element)) return hits;
  const tempo = clampBpm(bpm);
  const early = (0.04 * tempo) / 60;
  if (beat < -early) return hits;
  const clamped = Math.max(0, Math.round(beat * 10000) / 10000);
  const velocity = clampVelocity(hit.velocity);
  const gap = (0.035 * tempo) / 60;
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const prev = hits[i];
    if (prev.element !== hit.element) continue;
    if (Math.abs(prev.beat - clamped) <= gap) {
      if (velocity > prev.velocity) {
        prev.velocity = velocity;
        prev.beat = clamped;
      }
      return hits;
    }
    break;
  }
  hits.push({ beat: clamped, element: hit.element, velocity });
  return hits;
}

export const LOOP_REPEATS = [1, 2, 4, 8];

export function songBarCount(song) {
  return phraseBeatsFor(song?.hits, song?.audioSeconds, song?.recordedBpm || song?.bpm) / 4;
}

export function clampLoop(barCount, loop = {}) {
  const bars = Math.max(1, Math.round(Number(barCount) || 1));
  let start = Math.round(Number(loop.startBar));
  let end = Math.round(Number(loop.endBar));
  if (!Number.isFinite(start)) start = 1;
  if (!Number.isFinite(end)) end = bars;
  start = Math.min(bars, Math.max(1, start));
  end = Math.min(bars, Math.max(start, end));
  let repeats = Math.round(Number(loop.repeats));
  if (!LOOP_REPEATS.includes(repeats)) repeats = 1;
  return { startBar: start, endBar: end, repeats, bars };
}

export function loopLabel(region) {
  const whole = region.startBar === 1 && region.endBar === region.bars;
  const span = whole
    ? "The whole song"
    : region.startBar === region.endBar
      ? `Bar ${region.startBar}`
      : `Bars ${region.startBar}–${region.endBar}`;
  const times = region.repeats === 1 ? "once" : `${region.repeats} times`;
  return `${span}, ${times}`;
}

export function hitsPerBar(song) {
  const counts = Array(songBarCount(song)).fill(0);
  for (const hit of song?.hits || []) {
    const index = Math.floor(Number(hit.beat) / 4);
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

export function phraseBeatsFor(hits, audioSeconds = 0, bpm = 80) {
  const last = (hits || []).reduce((max, hit) => Math.max(max, Number(hit.beat) || 0), 0);
  const seconds = Math.max(0, Number(audioSeconds) || 0);
  const tempo = clampBpm(bpm);
  const audioBeats = seconds > 0 ? (seconds * tempo) / 60 : 0;
  const end = Math.max(last + 0.25, audioBeats);
  return Math.max(4, Math.ceil(end / 4) * 4);
}

export function notesForSong(song) {
  return [...(song?.hits || [])]
    .filter((hit) => ELEMENTS.has(hit.element) && Number.isFinite(hit.beat) && hit.beat >= 0)
    .sort((a, b) => a.beat - b.beat || a.element.localeCompare(b.element))
    .map((hit, index) => ({
      beat: hit.beat,
      baseStep: Math.round(hit.beat * 4),
      element: hit.element,
      hand: hit.element === "kick" ? "F" : "S",
      accent: false,
      grace: false,
      velocity: clampVelocity(hit.velocity),
      group: `s${index}:${hit.element}`,
    }));
}

export function arrangementFromSong(song) {
  const recordedBpm = clampBpm(song.recordedBpm || song.bpm);
  const region = clampLoop(songBarCount(song), {
    startBar: song.loopStart,
    endBar: song.loopEnd,
    repeats: song.loopRepeats,
  });
  const startBeat = (region.startBar - 1) * 4;
  const phraseBeats = (region.endBar - region.startBar + 1) * 4;
  const notes = notesForSong(song).flatMap((note) => {
    if (note.beat < startBeat - 1e-6 || note.beat >= startBeat + phraseBeats - 1e-6) return [];
    const beat = Math.round((note.beat - startBeat) * 10000) / 10000;
    return [{ ...note, beat, baseStep: Math.round(beat * 4) }];
  });
  const label = loopLabel(region);
  const audio = song.audioName ? ` Backing track ${song.audioName}.` : "";
  const hitLabel = notes.length === 1 ? "hit" : "hits";
  const hitLine = notes.length ? `${notes.length} ${hitLabel}` : "No recorded hits";
  return {
    song: true,
    songId: song.id,
    title: cleanName(song.name),
    bpm: clampBpm(song.bpm || recordedBpm),
    recordedBpm,
    bars: (phraseBeats / 4) * region.repeats,
    timing: label,
    summary: `${hitLine}. ${label}, at ${recordedBpm} bpm.${audio}`,
    section: { startBeat, phraseBeats, repeats: region.repeats },
    recipe: {
      type: "phrase",
      notes,
      phraseBeats,
      phraseSteps: phraseBeats * 4,
      stepsPerBeat: 4,
    },
  };
}

function cleanAudio(value) {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  return value;
}

export function normalizeSong(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const hits = Array.isArray(input.hits) ? input.hits.flatMap((hit) => {
    const beat = Math.round(Number(hit?.beat) * 10000) / 10000;
    if (!Number.isFinite(beat) || beat < 0 || beat > 20000 || !ELEMENTS.has(hit.element)) return [];
    return [{ beat, element: hit.element, velocity: clampVelocity(hit.velocity) }];
  }) : [];
  hits.sort((a, b) => a.beat - b.beat || a.element.localeCompare(b.element));
  const bpm = clampBpm(input.bpm);
  const created = typeof input.createdAt === "string" && !Number.isNaN(Date.parse(input.createdAt))
    ? input.createdAt
    : new Date().toISOString();
  const audioSeconds = Math.max(0, Math.min(60 * 60, Number(input.audioSeconds) || 0));
  const audioName = typeof input.audioName === "string" && input.audioName.trim()
    ? input.audioName.trim().slice(0, 120)
    : null;
  const region = clampLoop(phraseBeatsFor(hits, audioSeconds, clampBpm(input.recordedBpm || bpm)) / 4, {
    startBar: input.loopStart,
    endBar: input.loopEnd,
    repeats: input.loopRepeats,
  });
  return {
    format: SONG_FORMAT,
    version: 1,
    id: cleanId(input.id),
    name: cleanName(input.name),
    bpm,
    recordedBpm: clampBpm(input.recordedBpm || bpm),
    createdAt: created,
    audioName,
    audioType: typeof input.audioType === "string" ? input.audioType.slice(0, 80) : null,
    audioSeconds,
    audio: cleanAudio(input.audio),
    audioExternal: Boolean(input.audioExternal),
    hits,
    loopStart: region.startBar,
    loopEnd: region.endBar,
    loopRepeats: region.repeats,
  };
}

export function exportSong(song) {
  return JSON.stringify(normalizeSong({ ...song, format: SONG_FORMAT, version: 1 }), null, 2);
}

export function importSong(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { song: null, error: "That file could not be read." };
  }
  if (!data || data.format !== SONG_FORMAT) {
    return { song: null, error: "That file is not a Handline song." };
  }
  const song = normalizeSong(data);
  if (!song) return { song: null, error: "That file is not a Handline song." };
  return { song, error: "" };
}

export function loadLibrary(storage) {
  try {
    const raw = storage.getItem(SONG_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((item) => normalizeSong(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function isQuotaError(error) {
  return Boolean(error) && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014);
}

export function saveLibrary(songs, storage) {
  const full = (songs || []).map((song) => normalizeSong(song)).filter(Boolean);
  try {
    storage.setItem(SONG_KEY, JSON.stringify(full));
    return { ok: true, audioOmitted: false, omitted: [] };
  } catch (error) {
    if (!isQuotaError(error)) return { ok: false, audioOmitted: false, omitted: [], error };
    const omitted = [];
    const slim = full.map((song) => {
      if (!song.audio) return song;
      omitted.push({ id: song.id, audio: song.audio });
      return { ...song, audio: null, audioExternal: true };
    });
    try {
      storage.setItem(SONG_KEY, JSON.stringify(slim));
    } catch (again) {
      return { ok: false, audioOmitted: false, omitted: [], error: again };
    }
    return { ok: true, audioOmitted: omitted.length > 0, omitted };
  }
}

export function memoryStorage({ maxBytes = Infinity } = {}) {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      const next = new Map(data);
      next.set(key, String(value));
      let size = 0;
      for (const item of next.values()) size += item.length;
      if (size > maxBytes) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.clear();
      for (const [itemKey, itemValue] of next) data.set(itemKey, itemValue);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const AUDIO_DB = "handline";
const AUDIO_STORE = "audio";

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function audioRequest(mode, run) {
  return openAudioDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, mode);
    const store = tx.objectStore(AUDIO_STORE);
    const request = run(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }));
}

export function audioPut(id, dataUrl) {
  return audioRequest("readwrite", (store) => store.put(dataUrl, id));
}

export function audioGet(id) {
  return audioRequest("readonly", (store) => store.get(id));
}

export function audioDelete(id) {
  return audioRequest("readwrite", (store) => store.delete(id));
}
