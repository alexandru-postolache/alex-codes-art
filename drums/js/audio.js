// Acoustic hits from the Versilian Community Sample Library (CC0),
// the open sample set Strudel loads. See drums/samples/SOURCES.txt.
const sampleRoot = new URL("../samples/", import.meta.url);

export const KIT_SAMPLES = {
  kick: { soft: ["kick-soft.wav"], loud: ["kick-loud.wav"], gain: 0.9 },
  snare: { soft: ["snare-soft.wav"], loud: ["snare-loud.wav"], gain: 0.82 },
  hat: { soft: ["hat-soft-1.wav", "hat-soft-2.wav"], loud: ["hat-loud.wav"], gain: 0.95 },
  tom1: { soft: ["tom1-soft.wav"], loud: ["tom1-loud.wav"], gain: 0.8 },
  tom2: { soft: ["tom2-soft.wav"], loud: ["tom2-loud.wav"], gain: 0.82 },
  floor: { soft: ["floor-soft.wav"], loud: ["floor-loud.wav"], gain: 0.86 },
  ride: { soft: ["ride-soft.wav"], loud: ["ride-loud.wav"], gain: 0.78 },
  crash: { soft: ["crash-soft.wav"], loud: ["crash-loud.wav"], gain: 0.8 },
};

export function sampleFiles() {
  return Object.values(KIT_SAMPLES).flatMap((voice) => [...voice.soft, ...voice.loud]);
}

export function createAudio(options = {}) {
  let ctx = null;
  let kit = null;
  let drumOut = null;

  function context() {
    if (!ctx) ctx = options.context || new AudioContext();
    return ctx;
  }

  function output() {
    if (drumOut) return drumOut;
    const audio = context();
    const gain = audio.createGain();
    gain.gain.value = 0.8;
    gain.connect(audio.destination);
    drumOut = gain;
    return drumOut;
  }

  function loadKit() {
    const audio = context();
    const built = {};
    const jobs = [];
    for (const [name, spec] of Object.entries(KIT_SAMPLES)) {
      built[name] = { soft: Array(spec.soft.length), loud: Array(spec.loud.length), gain: spec.gain, cursor: 0 };
      for (const kind of ["soft", "loud"]) {
        spec[kind].forEach((file, index) => {
          const url = new URL(file, sampleRoot);
          jobs.push(fetch(url).then((response) => {
            if (!response.ok) throw new Error(file);
            return response.arrayBuffer();
          }).then((arrayBuffer) => audio.decodeAudioData(arrayBuffer.slice(0))).then((buffer) => {
            built[name][kind][index] = buffer;
          }));
        });
      }
    }
    return Promise.all(jobs).then(() => {
      kit = built;
    });
  }

  const loading = loadKit();

  function resume() {
    const audio = context();
    const ready = loading.catch(() => {});
    if (audio.state !== "running") return ready.then(() => audio.resume());
    return ready.then(() => audio);
  }

  function currentTime() {
    return context().currentTime;
  }

  function envGain(time, value, duration, destination) {
    const audio = context();
    const gain = audio.createGain();
    const peak = Math.max(0.0008, value);
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + Math.max(0.02, duration));
    gain.connect(destination || audio.destination);
    return gain;
  }

  function tone(time, { type = "sine", freq, duration, gain }) {
    const audio = context();
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    const amp = envGain(time, gain, duration);
    osc.connect(amp);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  function click(time, accent) {
    tone(time, {
      type: "square",
      freq: accent ? 1680 : 1120,
      duration: 0.028,
      gain: accent ? 0.045 : 0.026,
    });
  }

  let backing = null;

  function stopBuffer() {
    if (!backing) return;
    try { backing.stop(); } catch { /* already ended */ }
    backing.disconnect();
    backing = null;
  }

  function playBuffer(buffer, when, rate = 1, options = {}) {
    stopBuffer();
    if (!buffer) return;
    const audio = context();
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const playback = Math.max(0.25, Math.min(4, rate || 1));
    source.playbackRate.setValueAtTime(playback, audio.currentTime);
    source.connect(audio.destination);
    const offset = Math.max(0, Number(options.offset) || 0);
    if (offset >= buffer.duration - 0.02) return;
    const requested = Number(options.duration) || 0;
    const end = requested > 0 ? Math.min(buffer.duration, offset + requested) : buffer.duration;
    const loop = Boolean(options.loop) && end - offset > 0.05;
    source.loop = loop;
    if (loop) {
      source.loopStart = offset;
      source.loopEnd = end;
    }
    const startAt = Math.max(when, audio.currentTime);
    if (loop) source.start(startAt, offset);
    else source.start(startAt, offset, Math.max(0.05, end - offset));
    backing = source;
  }

  function decodeArrayBuffer(arrayBuffer) {
    return context().decodeAudioData(arrayBuffer.slice(0));
  }

  function decodeDataUrl(dataUrl) {
    const comma = String(dataUrl || "").indexOf(",");
    if (comma < 0) return Promise.reject(new Error("audio"));
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return decodeArrayBuffer(bytes.buffer);
  }

  function playHit(time, element, velocity) {
    const audio = context();
    const voice = kit[element] || kit.tom2;
    const loud = velocity >= 100 && voice.loud.length;
    const bank = loud ? voice.loud : voice.soft;
    const index = voice.cursor % bank.length;
    voice.cursor += 1;
    const buffer = bank[index];
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const level = Math.max(0.35, Math.min(1, velocity / 118));
    const gain = audio.createGain();
    gain.gain.setValueAtTime(voice.gain * (0.48 + 0.52 * level), time);
    source.connect(gain);
    gain.connect(output());
    const startAt = Math.max(time, audio.currentTime);
    source.start(startAt);
    source.stop(startAt + buffer.duration + 0.02);
  }

  function drum(time, element, velocity = 100) {
    if (kit) {
      playHit(time, element, velocity);
      return Promise.resolve();
    }
    return loading.then(() => playHit(time, element, velocity));
  }

  return { context, resume, currentTime, click, drum, playBuffer, stopBuffer, decodeArrayBuffer, decodeDataUrl };
}
