/* global Tweakpane, Vex */

const VF = Vex.Flow;

const BEATS_PER_BAR = 4;
const BARS = 2;
const TOTAL_BEATS = BEATS_PER_BAR * BARS;
const SIXTEENTHS_PER_BEAT = 4;
const TOTAL_SIXTEENTHS = TOTAL_BEATS * SIXTEENTHS_PER_BEAT;
const NOTE_KEY = 'f/4';

const State = {
  IDLE: 'idle',
  COUNT_IN: 'count-in',
  RECORDING: 'recording',
  DONE: 'done',
};

const DURATION_PIECES = [
  [12, 'hd'],
  [8, 'h'],
  [6, 'qd'],
  [4, 'q'],
  [3, '8d'],
  [2, '8'],
  [1, '16'],
];

const settings = {
  bpm: 100,
};

let state = State.IDLE;
let audioContext = null;
let scheduledTimers = [];
let recordingStartTime = 0;
let rawTaps = [];
let quantizedTaps = [];

const statusEl = document.getElementById('status');
const notationEl = document.getElementById('notation');
const startBtn = document.getElementById('start-btn');
const clearBtn = document.getElementById('clear-btn');

function beatDuration() {
  return 60 / settings.bpm;
}

function sixteenthDuration() {
  return beatDuration() / SIXTEENTHS_PER_BEAT;
}

function setStatus(message, nextState = state) {
  state = nextState;
  statusEl.textContent = message;
  statusEl.dataset.state = nextState;
}

function setButtons({ startDisabled, clearDisabled }) {
  startBtn.disabled = startDisabled;
  clearBtn.disabled = clearDisabled;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    return audioContext.resume();
  }
  return Promise.resolve();
}

function playClick(time, accent = false) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.value = accent ? 1200 : 820;
  gain.gain.setValueAtTime(accent ? 0.22 : 0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(time);
  osc.stop(time + 0.07);
}

function clearScheduledTimers() {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers = [];
}

function scheduleClick(delayMs, accent = false) {
  const timer = setTimeout(() => {
    playClick(audioContext.currentTime, accent);
  }, Math.max(0, delayMs));
  scheduledTimers.push(timer);
}

function sixteenthsToDurations(length, isRest) {
  const suffix = isRest ? 'r' : '';
  const durations = [];
  let remaining = length;

  for (const [value, name] of DURATION_PIECES) {
    while (remaining >= value) {
      durations.push(`${name}${suffix}`);
      remaining -= value;
    }
  }

  return durations;
}

function quantizeTaps(taps, recordingStart) {
  const sixteenthMs = sixteenthDuration() * 1000;
  const indices = taps.map((tapTime) => {
    const elapsed = tapTime - recordingStart;
    const index = Math.round(elapsed / sixteenthMs);
    return Math.max(0, Math.min(TOTAL_SIXTEENTHS - 1, index));
  });

  return [...new Set(indices)].sort((a, b) => a - b);
}

function buildTickablesForRange(tapIndices, rangeLength) {
  const tickables = [];
  let cursor = 0;

  while (cursor < rangeLength) {
    const isTap = tapIndices.includes(cursor);

    if (isTap) {
      const nextTap = tapIndices.find((index) => index > cursor) ?? rangeLength;
      const length = Math.max(1, nextTap - cursor);
      sixteenthsToDurations(length, false).forEach((duration) => {
        tickables.push(
          new VF.StaveNote({
            keys: [NOTE_KEY],
            duration,
            autoStem: true,
          })
        );
      });
      cursor = nextTap;
    } else {
      const nextTap = tapIndices.find((index) => index > cursor) ?? rangeLength;
      const length = nextTap - cursor;
      sixteenthsToDurations(length, true).forEach((duration) => {
        tickables.push(
          new VF.StaveNote({
            keys: ['b/4'],
            duration,
          })
        );
      });
      cursor = nextTap;
    }
  }

  return tickables;
}

function buildMeasures(tapIndices) {
  const sixteenthsPerBar = BEATS_PER_BAR * SIXTEENTHS_PER_BEAT;
  const measures = [];

  for (let bar = 0; bar < BARS; bar += 1) {
    const barStart = bar * sixteenthsPerBar;
    const barEnd = barStart + sixteenthsPerBar;
    const barTaps = tapIndices
      .filter((index) => index >= barStart && index < barEnd)
      .map((index) => index - barStart);

    measures.push(buildTickablesForRange(barTaps, sixteenthsPerBar));
  }

  return measures;
}

function renderNotation(tapIndices) {
  notationEl.innerHTML = '';

  if (tapIndices.length === 0) {
    notationEl.innerHTML =
      '<p class="placeholder">No taps recorded. Try again and tap the spacebar in rhythm.</p>';
    return;
  }

  const measures = buildMeasures(tapIndices);

  const renderer = new VF.Renderer(notationEl, VF.Renderer.Backends.SVG);
  renderer.resize(680, 220);
  const context = renderer.getContext();
  context.setFont('Arial', 10);

  let x = 10;
  const y = 30;
  const measureWidth = 310;

  measures.forEach((measureNotes, index) => {
    const stave = new VF.Stave(x, y, measureWidth);

    if (index === 0) {
      stave.addClef('percussion').addTimeSignature('4/4');
    }

    stave.setContext(context).draw();

    const voice = new VF.Voice({ numBeats: BEATS_PER_BAR, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(measureNotes);

    new VF.Formatter().joinVoices([voice]).format([voice], measureWidth - 20);
    voice.draw(context, stave);

    x += measureWidth;
  });
}

function showPlaceholder() {
  notationEl.innerHTML =
    '<p class="placeholder">Your quantized rhythm will appear here after recording.</p>';
}

function resetSession() {
  clearScheduledTimers();
  rawTaps = [];
  quantizedTaps = [];
  recordingStartTime = 0;
  setStatus('Press Start, then tap Space during recording.', State.IDLE);
  setButtons({ startDisabled: false, clearDisabled: true });
  showPlaceholder();
}

function finishRecording() {
  quantizedTaps = quantizeTaps(rawTaps, recordingStartTime);
  setStatus(
    quantizedTaps.length
      ? `Done! ${quantizedTaps.length} tap${quantizedTaps.length === 1 ? '' : 's'} quantized to sheet music.`
      : 'Done — no taps detected. Press Start to try again.',
    State.DONE
  );
  renderNotation(quantizedTaps);
  setButtons({ startDisabled: false, clearDisabled: false });
}

async function startSession() {
  if (state === State.COUNT_IN || state === State.RECORDING) {
    return;
  }

  await ensureAudioContext();

  clearScheduledTimers();
  rawTaps = [];
  quantizedTaps = [];
  setButtons({ startDisabled: true, clearDisabled: true });
  showPlaceholder();

  const sessionStart = performance.now();
  const beatMs = beatDuration() * 1000;
  const countInBeats = BEATS_PER_BAR;
  const countInMs = countInBeats * beatMs;
  const recordingMs = TOTAL_BEATS * beatMs;
  const startOffset = 120;

  setStatus('Count-in… get ready!', State.COUNT_IN);

  for (let i = 0; i < countInBeats; i += 1) {
    scheduleClick(startOffset + i * beatMs, i === 0);
  }

  for (let i = 0; i < TOTAL_BEATS; i += 1) {
    scheduleClick(startOffset + countInMs + i * beatMs, i % BEATS_PER_BAR === 0);
  }

  const recordTimer = setTimeout(() => {
    recordingStartTime = sessionStart + startOffset + countInMs;
    setStatus('Recording! Tap the spacebar in rhythm.', State.RECORDING);
  }, startOffset + countInMs);
  scheduledTimers.push(recordTimer);

  const endTimer = setTimeout(() => {
    finishRecording();
  }, startOffset + countInMs + recordingMs + 50);
  scheduledTimers.push(endTimer);
}

function handleSpaceDown(event) {
  if (event.code !== 'Space' || event.repeat) {
    return;
  }

  event.preventDefault();

  if (state === State.IDLE || state === State.DONE) {
    startSession();
    return;
  }

  if (state === State.RECORDING) {
    rawTaps.push(performance.now());
  }
}

function initPane() {
  const pane = new Tweakpane.Pane({
    container: document.getElementById('pane'),
    title: 'Settings',
  });

  pane.addInput(settings, 'bpm', {
    min: 60,
    max: 180,
    step: 1,
    label: 'Tempo (BPM)',
  });
}

function init() {
  initPane();
  showPlaceholder();
  setButtons({ startDisabled: false, clearDisabled: true });

  startBtn.addEventListener('click', startSession);
  clearBtn.addEventListener('click', resetSession);
  window.addEventListener('keydown', handleSpaceDown);
}

init();
