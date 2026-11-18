export function createAudio() {
  let ctx = null;

  function context() {
    if (!ctx) ctx = new AudioContext();
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

  function envGain(time, value, duration) {
    const audio = context();
    const gain = audio.createGain();
    gain.gain.setValueAtTime(value, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    gain.connect(audio.destination);
    return gain;
  }

  function tone(time, { type = "sine", freq, freqTo, duration, gain }) {
    const audio = context();
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), time + duration);
    const amp = envGain(time, gain, duration);
    osc.connect(amp);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function noise(time, { duration, freq, q, gain, type = "bandpass" }) {
    const audio = context();
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = envGain(time, gain, duration);
    source.connect(filter);
    filter.connect(amp);
    source.start(time);
    source.stop(time + duration + 0.02);
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
    const level = Math.max(0.35, Math.min(1, velocity / 110));
    if (element === "kick") {
      tone(time, { freq: 146, freqTo: 48, duration: 0.18, gain: 0.46 * level });
      return;
    }
    if (element === "snare") {
      tone(time, { type: "triangle", freq: 196, freqTo: 140, duration: 0.09, gain: 0.16 * level });
      noise(time, { duration: 0.12, freq: 1800, q: 0.7, gain: 0.18 * level });
      return;
    }
    if (element === "hat") {
      noise(time, { duration: 0.045, freq: 8000, q: 0.8, gain: 0.1 * level, type: "highpass" });
      return;
    }
    if (element === "ride") {
      noise(time, { duration: 0.18, freq: 5200, q: 1.4, gain: 0.07 * level, type: "highpass" });
      return;
    }
    if (element === "crash") {
      noise(time, { duration: 0.35, freq: 3200, q: 0.5, gain: 0.09 * level, type: "highpass" });
      return;
    }
    const tom = { tom1: 210, tom2: 160, floor: 110 };
    tone(time, {
      type: "sine",
      freq: tom[element] || 150,
      freqTo: (tom[element] || 150) * 0.7,
      duration: 0.16,
      gain: 0.28 * level,
    });
  }

  return { context, resume, currentTime, click, drum, playBuffer, stopBuffer, decodeArrayBuffer, decodeDataUrl };
}
