const MEMBRANE = [
  { ratio: 1.593, amp: 0.5, damp: 0.46 },
  { ratio: 2.135, amp: 0.28, damp: 0.3 },
  { ratio: 2.295, amp: 0.16, damp: 0.22 },
  { ratio: 2.653, amp: 0.1, damp: 0.16 },
  { ratio: 2.917, amp: 0.06, damp: 0.12 },
];

function silence(rate, seconds) {
  return new Float32Array(Math.floor(rate * seconds));
}

function biquad(type, freq, q, rate) {
  const clamped = Math.min(Math.max(40, freq), rate * 0.45);
  const w0 = (2 * Math.PI * clamped) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(0.2, q));
  let b0;
  let b1;
  let b2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  if (type === "highpass") {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else if (type === "lowpass") {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function metalFreqs(low, high, count) {
  const freqs = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const f = low * (high / low) ** (t ** 0.8);
    freqs.push(f * (1 + ((i % 5) - 2) * 0.02));
  }
  return freqs;
}

function addFilteredNoise(data, rate, { type, freq, q, amp, attack, decay }) {
  const coeff = biquad(type, freq, q, rate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const attackSamples = Math.max(1, Math.floor((attack || 0.0002) * rate));
  for (let i = 0; i < data.length; i += 1) {
    const x = Math.random() * 2 - 1;
    const y = coeff.b0 * x + coeff.b1 * x1 + coeff.b2 * x2 - coeff.a1 * y1 - coeff.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = Math.abs(y) < 1e-8 ? 0 : y;
    const t = i / rate;
    const env = i < attackSamples ? i / attackSamples : Math.exp(-(t - attackSamples / rate) / decay);
    data[i] += y1 * env * amp;
  }
}

function addRattle(data, rate, { freq, q, amp, decay }) {
  const coeff = biquad("bandpass", freq, q, rate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let grain = 1;
  const grainSamples = Math.max(1, Math.floor(rate / 140));
  for (let i = 0; i < data.length; i += 1) {
    if (i % grainSamples === 0) grain = 0.25 + Math.random() * 0.75;
    const x = Math.random() * 2 - 1;
    const y = coeff.b0 * x + coeff.b1 * x1 + coeff.b2 * x2 - coeff.a1 * y1 - coeff.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = Math.abs(y) < 1e-8 ? 0 : y;
    data[i] += y1 * Math.exp(-(i / rate) / decay) * amp * grain;
  }
}

function addBend(data, rate, { freq, start, bendTime, amp, decay }) {
  let phase = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / rate;
    const glide = 1 + (start - 1) * Math.exp(-t / bendTime);
    phase += (2 * Math.PI * Math.min(freq * glide, rate * 0.45)) / rate;
    data[i] += Math.sin(phase) * Math.exp(-t / decay) * amp;
  }
}

function addStruck(data, rate, { freq, decay, amp }) {
  const q = Math.max(6, Math.min(64, Math.PI * freq * Math.max(0.02, decay)));
  const coeff = biquad("bandpass", freq, q, rate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / rate;
    const burst = t < 0.01 ? (Math.random() * 2 - 1) * (1 - t / 0.01) : 0;
    const x = (i === 0 ? 6 : 0) + burst;
    const y = coeff.b0 * x + coeff.b1 * x1 + coeff.b2 * x2 - coeff.a1 * y1 - coeff.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = Math.abs(y) < 1e-8 ? 0 : y;
    data[i] += y1 * amp;
  }
}

function combs(data, rate, delays, feedback, mix) {
  const dry = Float32Array.from(data);
  const wet = new Float32Array(data.length);
  for (const delaySec of delays) {
    const length = Math.max(1, Math.floor(delaySec * rate));
    const line = new Float32Array(length);
    let cursor = 0;
    for (let i = 0; i < data.length; i += 1) {
      const delayed = line[cursor];
      const y = dry[i] + delayed * feedback;
      line[cursor] = y;
      cursor = (cursor + 1) % length;
      wet[i] += y;
    }
  }
  const scale = mix / delays.length;
  const dryMix = 1 - mix;
  for (let i = 0; i < data.length; i += 1) data[i] = dry[i] * dryMix + wet[i] * scale;
}

function shapeHighpass(data, rate, freq) {
  const coeff = biquad("highpass", freq, 0.7, rate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i += 1) {
    const x = data[i];
    const y = coeff.b0 * x + coeff.b1 * x1 + coeff.b2 * x2 - coeff.a1 * y1 - coeff.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    data[i] = y;
  }
}

function earlyReflections(data, rate, amount) {
  const dry = Float32Array.from(data);
  for (const [delay, gain] of [[0.0062, 0.2], [0.0114, 0.11], [0.018, 0.06]]) {
    const offset = Math.floor(delay * rate);
    for (let i = offset; i < data.length; i += 1) data[i] += dry[i - offset] * gain * amount;
  }
}

function color(data, drive) {
  const norm = Math.tanh(drive);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.tanh(data[i] * drive) / norm;
}

function normalize(data, target) {
  let max = 0;
  for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i]));
  if (max < 1e-8) return data;
  const gain = target / max;
  for (let i = 0; i < data.length; i += 1) data[i] *= gain;
  return data;
}

function finish(data, rate, { drive = 1.15, hp = 28, room = 0, target = 0.86 } = {}) {
  if (room) earlyReflections(data, rate, room);
  normalize(data, 0.95);
  color(data, drive);
  shapeHighpass(data, rate, hp);
  return normalize(data, target);
}

function layer(data, gain, drive = 1) {
  if (drive > 1) {
    normalize(data, 0.9);
    color(data, drive);
  }
  normalize(data, 1);
  return { data, gain };
}

function mix(layers) {
  const length = Math.max(...layers.map((part) => part.data.length));
  const out = new Float32Array(length);
  for (const part of layers) {
    for (let i = 0; i < part.data.length; i += 1) out[i] += part.data[i] * part.gain;
  }
  return out;
}

function makeKick(rate) {
  const beater = silence(rate, 0.48);
  addFilteredNoise(beater, rate, { type: "highpass", freq: 1400, q: 0.7, amp: 1, attack: 0.00015, decay: 0.009 });
  addFilteredNoise(beater, rate, { type: "bandpass", freq: 2800, q: 1.1, amp: 0.8, attack: 0.0001, decay: 0.003 });
  const shell = silence(rate, 0.48);
  addFilteredNoise(shell, rate, { type: "bandpass", freq: 170, q: 1.4, amp: 1, attack: 0.001, decay: 0.05 });
  const body = silence(rate, 0.48);
  addBend(body, rate, { freq: 52, start: 3.4, bendTime: 0.022, amp: 1, decay: 0.22 });
  addBend(body, rate, { freq: 74, start: 2.2, bendTime: 0.03, amp: 0.4, decay: 0.13 });
  const over = silence(rate, 0.48);
  addStruck(over, rate, { freq: 142, decay: 0.05, amp: 1 });
  addStruck(over, rate, { freq: 214, decay: 0.03, amp: 0.6 });
  return mix([
    layer(body, 0.72, 1.55),
    layer(beater, 0.9),
    layer(shell, 0.34),
    layer(over, 0.22),
  ]);
}

function makeSnare(rate) {
  const stick = silence(rate, 0.42);
  addFilteredNoise(stick, rate, { type: "highpass", freq: 2000, q: 0.55, amp: 1, attack: 0.0001, decay: 0.008 });
  const wires = silence(rate, 0.42);
  addRattle(wires, rate, { freq: 1700, q: 0.45, amp: 1, decay: 0.22 });
  addRattle(wires, rate, { freq: 3400, q: 0.6, amp: 0.85, decay: 0.16 });
  addFilteredNoise(wires, rate, { type: "highpass", freq: 5800, q: 0.7, amp: 0.45, attack: 0.0002, decay: 0.07 });
  const head = silence(rate, 0.42);
  addBend(head, rate, { freq: 192, start: 1.28, bendTime: 0.018, amp: 1, decay: 0.11 });
  addBend(head, rate, { freq: 338, start: 1.12, bendTime: 0.016, amp: 0.45, decay: 0.06 });
  addStruck(head, rate, { freq: 455, decay: 0.04, amp: 0.35 });
  return mix([
    layer(wires, 1),
    layer(stick, 0.78),
    layer(head, 0.42, 1.25),
  ]);
}

function makeTom(rate, fundamental, seconds) {
  const stick = silence(rate, seconds);
  addFilteredNoise(stick, rate, { type: "highpass", freq: 1600, q: 0.6, amp: 1, attack: 0.0001, decay: 0.009 });
  addFilteredNoise(stick, rate, { type: "bandpass", freq: 3800, q: 0.8, amp: 0.7, attack: 0.0001, decay: 0.004 });
  const head = silence(rate, seconds);
  addBend(head, rate, { freq: fundamental, start: 1.7, bendTime: 0.045, amp: 1, decay: seconds * 0.42 });
  addBend(head, rate, { freq: fundamental * 1.016, start: 1.7, bendTime: 0.045, amp: 0.28, decay: seconds * 0.34 });
  const modes = silence(rate, seconds);
  for (const mode of MEMBRANE) {
    addStruck(modes, rate, {
      freq: fundamental * mode.ratio,
      decay: seconds * 0.42 * mode.damp,
      amp: mode.amp,
    });
  }
  return mix([
    layer(head, 0.8, 1.35),
    layer(stick, 1),
    layer(modes, 0.38),
  ]);
}

function makeHat(rate) {
  const tick = silence(rate, 0.09);
  addFilteredNoise(tick, rate, { type: "highpass", freq: 7000, q: 0.6, amp: 1, attack: 0.00005, decay: 0.01 });
  const wash = silence(rate, 0.09);
  for (const freq of metalFreqs(3000, 12500, 14)) {
    addFilteredNoise(wash, rate, {
      type: "bandpass",
      freq,
      q: 2.8,
      amp: 0.7,
      attack: 0.00008,
      decay: 0.018 + (freq / 12500) * 0.016,
    });
  }
  combs(wash, rate, [0.0013, 0.0019, 0.0027], 0.22, 0.4);
  return mix([
    layer(wash, 1),
    layer(tick, 0.85),
  ]);
}

function makeRide(rate) {
  const tick = silence(rate, 0.9);
  addFilteredNoise(tick, rate, { type: "highpass", freq: 5200, q: 0.6, amp: 1, attack: 0.00008, decay: 0.012 });
  const wash = silence(rate, 0.9);
  metalFreqs(1400, 10500, 16).forEach((freq, index) => {
    addFilteredNoise(wash, rate, {
      type: "bandpass",
      freq,
      q: 2.2,
      amp: 0.55,
      attack: 0.0006,
      decay: 0.34 + (index % 5) * 0.05,
    });
  });
  combs(wash, rate, [0.0019, 0.0027, 0.0038, 0.0051], 0.48, 0.55);
  const bell = silence(rate, 0.9);
  addBend(bell, rate, { freq: 410, start: 1.04, bendTime: 0.02, amp: 1, decay: 0.55 });
  addStruck(bell, rate, { freq: 820, decay: 0.32, amp: 0.45 });
  addStruck(bell, rate, { freq: 1280, decay: 0.2, amp: 0.25 });
  return mix([
    layer(wash, 1),
    layer(tick, 0.6),
    layer(bell, 0.34, 1.15),
  ]);
}

function makeCrash(rate) {
  const attack = silence(rate, 1.35);
  addFilteredNoise(attack, rate, { type: "highpass", freq: 900, q: 0.45, amp: 1, attack: 0.0001, decay: 0.045 });
  const wash = silence(rate, 1.35);
  const freqs = metalFreqs(380, 11500, 22);
  freqs.forEach((freq, index) => {
    const pos = index / (freqs.length - 1);
    addFilteredNoise(wash, rate, {
      type: "bandpass",
      freq,
      q: 1.8,
      amp: 0.5,
      attack: 0.002,
      decay: 0.55 + Math.sin(pos * Math.PI) * 0.9,
    });
  });
  combs(wash, rate, [0.0016, 0.0024, 0.0034, 0.0046, 0.0062, 0.0084], 0.62, 0.62);
  return mix([
    layer(wash, 1),
    layer(attack, 0.82),
  ]);
}

export function acousticHit(element, sampleRate = 44100) {
  if (element === "kick") return finish(makeKick(sampleRate), sampleRate, { drive: 1.3, hp: 32, room: 0.16, target: 0.9 });
  if (element === "snare") return finish(makeSnare(sampleRate), sampleRate, { drive: 1.4, hp: 70, room: 0.1, target: 0.88 });
  if (element === "hat") return finish(makeHat(sampleRate), sampleRate, { drive: 1.15, hp: 4200, room: 0, target: 0.8 });
  if (element === "ride") return finish(makeRide(sampleRate), sampleRate, { drive: 1.12, hp: 500, room: 0.08, target: 0.82 });
  if (element === "crash") return finish(makeCrash(sampleRate), sampleRate, { drive: 1.18, hp: 380, room: 0.12, target: 0.84 });
  const tom = { tom1: [156, 0.4], tom2: [112, 0.48], floor: [74, 0.6] }[element] || [112, 0.48];
  return finish(makeTom(sampleRate, tom[0], tom[1]), sampleRate, { drive: 1.2, hp: 40, room: 0.12, target: 0.86 });
}

export function createAudio(options = {}) {
  let ctx = null;
  let drumBus = null;
  let kit = null;

  function context() {
    if (!ctx) ctx = options.context || new AudioContext();
    return ctx;
  }

  function resume() {
    const audio = context();
    buffers();
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

  function buffers() {
    if (kit) return kit;
    const audio = context();
    const rate = audio.sampleRate;
    kit = {};
    for (const name of ["kick", "snare", "hat", "tom1", "tom2", "floor", "ride", "crash"]) {
      const data = acousticHit(name, rate);
      const buffer = audio.createBuffer(1, data.length, rate);
      buffer.getChannelData(0).set(data);
      kit[name] = buffer;
    }
    return kit;
  }

  function drum(time, element, velocity = 100) {
    const audio = context();
    const level = Math.max(0.24, Math.min(1, velocity / 118));
    const buffer = buffers()[element] || buffers().tom2;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(0.985 + level * 0.03, time);
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(0.7, time);
    filter.frequency.setValueAtTime(2400 + level * 14000, time);
    const gain = audio.createGain();
    const voice = {
      kick: 0.95,
      snare: 0.8,
      hat: 0.5,
      tom1: 0.72,
      tom2: 0.74,
      floor: 0.78,
      ride: 0.52,
      crash: 0.6,
    }[element] || 0.7;
    gain.gain.setValueAtTime(voice * (0.34 + 0.66 * level), time);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(drumOut());
    source.start(time);
    source.stop(time + buffer.duration + 0.02);
  }

  return { context, resume, currentTime, click, drum, playBuffer, stopBuffer, decodeArrayBuffer, decodeDataUrl };
}
