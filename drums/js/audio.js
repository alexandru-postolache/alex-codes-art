export function createAudio(options = {}) {
  let ctx = null;
  let noiseCache = null;
  let noiseCursor = 0;
  let drumBus = null;

  function context() {
    if (!ctx) ctx = options.context || new AudioContext();
    return ctx;
  }

  function resume() {
    const audio = context();
    if (audio.state !== "running") return audio.resume();
    return Promise.resolve();
  }

  function currentTime() {
    return context().currentTime;
  }

  function drumOut() {
    if (drumBus) return drumBus;
    const audio = context();
    const shaper = audio.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.7) / Math.tanh(1.7);
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    const trim = audio.createGain();
    trim.gain.value = 0.72;
    shaper.connect(trim);
    trim.connect(audio.destination);
    drumBus = shaper;
    return drumBus;
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

  function tone(time, { type = "sine", freq, freqTo, duration, pitchTime, gain, destination }) {
    const audio = context();
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (freqTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, freqTo),
        time + Math.max(0.02, pitchTime || duration),
      );
    }
    const amp = envGain(time, gain, duration, destination);
    osc.connect(amp);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  function noiseBuffer() {
    const audio = context();
    if (noiseCache && noiseCache.sampleRate === audio.sampleRate) return noiseCache;
    const length = Math.floor(audio.sampleRate * 2);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseCache = buffer;
    return buffer;
  }

  function noise(time, { duration, freq, q, gain, type = "bandpass", destination }) {
    const audio = context();
    const buffer = noiseBuffer();
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(q, time);
    const amp = envGain(time, gain, duration, destination);
    source.connect(filter);
    filter.connect(amp);
    const span = Math.max(0.05, buffer.duration - duration - 0.05);
    const offset = noiseCursor % span;
    noiseCursor = (noiseCursor + 0.041) % span;
    source.start(time, offset);
    source.stop(time + duration + 0.03);
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

  function drum(time, element, velocity = 100) {
    const level = Math.max(0.28, Math.min(1, velocity / 120));
    const bright = 0.55 + 0.45 * level;
    const out = drumOut();
    const hit = (spec) => tone(time, { ...spec, destination: out });
    const air = (spec) => noise(time, { ...spec, destination: out });
    if (element === "kick") {
      air({ duration: 0.012, freq: 1800, q: 0.7, gain: 0.1 * level, type: "highpass" });
      hit({ freq: 172, freqTo: 58, pitchTime: 0.045, duration: 0.07, gain: 0.34 * level });
      hit({ freq: 86, freqTo: 49, pitchTime: 0.09, duration: 0.26, gain: 0.3 * level });
      return;
    }
    if (element === "snare") {
      air({ duration: 0.01, freq: 3500, q: 0.6, gain: 0.14 * level, type: "highpass" });
      hit({ type: "triangle", freq: 196, freqTo: 158, pitchTime: 0.05, duration: 0.12, gain: 0.13 * level });
      hit({ freq: 332, freqTo: 270, pitchTime: 0.04, duration: 0.07, gain: 0.05 * level });
      air({ duration: 0.2, freq: 2400, q: 0.55, gain: 0.22 * level * bright });
      air({ duration: 0.14, freq: 5600, q: 0.6, gain: 0.07 * level * bright, type: "highpass" });
      return;
    }
    if (element === "hat") {
      for (const [freq, gain, duration] of [
        [317, 0.026, 0.03],
        [489, 0.022, 0.035],
        [742, 0.024, 0.04],
        [1288, 0.02, 0.045],
        [2140, 0.018, 0.04],
        [3460, 0.015, 0.035],
        [5820, 0.013, 0.03],
      ]) hit({ freq, duration, gain: gain * level * bright });
      air({ duration: 0.055, freq: 7500, q: 0.7, gain: 0.14 * level * bright, type: "highpass" });
      return;
    }
    if (element === "ride") {
      hit({ freq: 392, duration: 0.6, gain: 0.07 * level });
      for (const [freq, gain, duration] of [
        [548, 0.036, 0.45],
        [812, 0.026, 0.36],
        [1340, 0.02, 0.3],
        [2080, 0.016, 0.24],
        [3410, 0.012, 0.2],
      ]) hit({ freq, duration, gain: gain * level * bright });
      air({ duration: 0.5, freq: 5400, q: 0.7, gain: 0.07 * level * bright, type: "highpass" });
      return;
    }
    if (element === "crash") {
      for (const [freq, gain, duration] of [
        [286, 0.034, 0.75],
        [431, 0.03, 0.9],
        [638, 0.026, 1],
        [970, 0.022, 1.05],
        [1460, 0.018, 1.05],
        [2140, 0.015, 0.95],
        [3280, 0.012, 0.8],
        [5120, 0.01, 0.65],
      ]) hit({ freq, duration, gain: gain * level * bright });
      air({ duration: 1.15, freq: 2400, q: 0.4, gain: 0.11 * level * bright, type: "highpass" });
      return;
    }
    const tom = {
      tom1: { freq: 246, freqTo: 174, over: 348, decay: 0.2 },
      tom2: { freq: 174, freqTo: 122, over: 248, decay: 0.24 },
      floor: { freq: 108, freqTo: 76, over: 162, decay: 0.34 },
    }[element] || { freq: 150, freqTo: 104, over: 220, decay: 0.2 };
    air({ duration: 0.014, freq: 1800, q: 0.8, gain: 0.07 * level, type: "bandpass" });
    hit({ freq: tom.freq, freqTo: tom.freqTo, pitchTime: 0.08, duration: tom.decay, gain: 0.26 * level });
    hit({ freq: tom.over, freqTo: tom.over * 0.82, pitchTime: 0.05, duration: tom.decay * 0.45, gain: 0.07 * level });
  }

  return { context, resume, currentTime, click, drum, playBuffer, stopBuffer, decodeArrayBuffer, decodeDataUrl };
}
