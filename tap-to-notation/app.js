/* global Tweakpane, Vex */

const VF = Vex.Flow;

const BEATS_PER_BAR = 4;
const BARS = 2;
const TOTAL_BEATS = BEATS_PER_BAR * BARS;
const SIXTEENTHS_PER_BEAT = 4;
const TOTAL_SIXTEENTHS = TOTAL_BEATS * SIXTEENTHS_PER_BEAT;

const State = {
  IDLE: 'idle',
  COUNT_IN: 'count-in',
  RECORDING: 'recording',
  DONE: 'done',
  PLAYING: 'playing',
};

const LATENCY_COMPENSATION_SIXTEENTHS = 0.45;

const DURATION_PIECES = [
  [12, 'hd'],
  [8, 'h'],
  [6, 'qd'],
  [4, 'q'],
  [3, '8d'],
  [2, '8'],
  [1, '16'],
];

const TRACK_DEFS = [
  {
    name: 'Kick',
    noteKey: 'f/4',
    color: '#6ea8ff',
    sound: { type: 'kick' },
  },
  {
    name: 'Snare',
    noteKey: 'c/5',
    color: '#ff8f6e',
    sound: { type: 'snare' },
  },
  {
    name: 'Hi-hat',
    noteKey: 'a/5',
    color: '#ffd166',
    sound: { type: 'hihat' },
  },
  {
    name: 'Clap',
    noteKey: 'e/5',
    color: '#6ee7a0',
    sound: { type: 'clap' },
  },
];

const settings = {
  bpm: 100,
};

let state = State.IDLE;
let audioContext = null;
let scheduledTimers = [];
let recordingStartTime = 0;
let rawTaps = [];
let activeTrackIndex = 0;
let tracks = TRACK_DEFS.map(() => ({ quantizedTaps: [] }));
let playbackTimers = [];
let playbackRaf = null;
let notationLayout = null;

const statusEl = document.getElementById('status');
const notationEl = document.getElementById('notation');
const notationCanvasEl = document.getElementById('notation-canvas');
const playheadEl = document.getElementById('playhead');
const trackSelectorEl = document.getElementById('track-selector');
const startBtn = document.getElementById('start-btn');
const playBtn = document.getElementById('play-btn');
const clearBtn = document.getElementById('clear-btn');
const tapPad = document.getElementById('tap-pad');

function beatDuration() {
  return 60 / settings.bpm;
}

function sixteenthDuration() {
  return beatDuration() / SIXTEENTHS_PER_BEAT;
}

function hasAnyTrackData() {
  return tracks.some((track) => track.quantizedTaps.length > 0);
}

function setStatus(message, nextState = state) {
  state = nextState;
  statusEl.textContent = message;
  statusEl.dataset.state = nextState;
}

function updateControls() {
  const isBusy = state === State.COUNT_IN || state === State.RECORDING || state === State.PLAYING;
  const hasData = hasAnyTrackData();

  startBtn.disabled = isBusy;
  playBtn.disabled = isBusy || !hasData;
  clearBtn.disabled = isBusy || !hasData;
  tapPad.disabled = state !== State.RECORDING;

  document.querySelectorAll('.track-tab').forEach((button, index) => {
    button.disabled = isBusy;
    button.classList.toggle('is-active', index === activeTrackIndex);
    button.classList.toggle('has-data', tracks[index].quantizedTaps.length > 0);
  });
}

const STAVE_X = 118;
const NOTE_PADDING_LEFT = 62;
const MEASURE_WIDTH = 300;

function clearScheduledTimers() {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers = [];
  playbackTimers.forEach(clearTimeout);
  playbackTimers = [];
  stopPlayheadAnimation();
}

function hidePlayhead() {
  playheadEl.classList.remove('is-visible');
}

function syncPlayheadMetrics() {
  if (!notationLayout) {
    return;
  }

  const svg = notationCanvasEl.querySelector('svg');
  if (!svg) {
    return;
  }

  const notationRect = notationEl.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const scale = svgRect.width / notationLayout.svgWidth;

  notationLayout.scale = scale;
  notationLayout.svgOffsetLeft = svgRect.left - notationRect.left + notationEl.scrollLeft;
  notationLayout.noteStartPx =
    notationLayout.svgOffsetLeft + (STAVE_X + NOTE_PADDING_LEFT) * scale;
  notationLayout.noteWidthPx = (notationLayout.staveWidth - 18) * scale;
  notationLayout.topPx = svgRect.top - notationRect.top + notationEl.scrollTop + 8 * scale;
  notationLayout.heightPx = notationLayout.contentHeight * scale;
}

function updatePlayhead(progress) {
  if (!notationLayout || !notationLayout.noteWidthPx) {
    return;
  }

  const clamped = Math.max(0, Math.min(1, progress));
  playheadEl.style.left = `${notationLayout.noteStartPx + clamped * notationLayout.noteWidthPx}px`;
  playheadEl.style.top = `${notationLayout.topPx}px`;
  playheadEl.style.height = `${notationLayout.heightPx}px`;
  playheadEl.classList.add('is-visible');
}

function stopPlayheadAnimation() {
  if (playbackRaf) {
    cancelAnimationFrame(playbackRaf);
    playbackRaf = null;
  }
  hidePlayhead();
}

function startPlayheadAnimation(sessionStart, musicStartMs, musicDurationMs) {
  stopPlayheadAnimation();
  syncPlayheadMetrics();

  const tick = () => {
    if (state !== State.PLAYING) {
      return;
    }

    const elapsed = performance.now() - sessionStart;

    if (elapsed < musicStartMs) {
      hidePlayhead();
    } else {
      const musicElapsed = elapsed - musicStartMs;
      updatePlayhead(musicElapsed / musicDurationMs);
    }

    playbackRaf = requestAnimationFrame(tick);
  };

  playbackRaf = requestAnimationFrame(tick);
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
  gain.gain.setValueAtTime(accent ? 0.18 : 0.11, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(time);
  osc.stop(time + 0.07);
}

function playDrumSound(trackIndex, time = audioContext.currentTime) {
  const sound = TRACK_DEFS[trackIndex].sound;

  if (sound.type === 'kick') {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.36);
    return;
  }

  if (sound.type === 'snare') {
    const bufferSize = Math.floor(audioContext.sampleRate * 0.18);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    noise.start(time);
    noise.stop(time + 0.2);
    return;
  }

  if (sound.type === 'hihat') {
    const bufferSize = Math.floor(audioContext.sampleRate * 0.06);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    noise.start(time);
    noise.stop(time + 0.06);
    return;
  }

  if (sound.type === 'clap') {
    [0, 0.012, 0.024].forEach((offset) => {
      const bufferSize = Math.floor(audioContext.sampleRate * 0.04);
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.25, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.05);
      noise.connect(gain);
      gain.connect(audioContext.destination);
      noise.start(time + offset);
      noise.stop(time + offset + 0.06);
    });
  }
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
  const latencyMs = sixteenthMs * LATENCY_COMPENSATION_SIXTEENTHS;
  const indices = taps.map((tapTime) => {
    const elapsed = tapTime - recordingStart - latencyMs;
    const index = Math.round(elapsed / sixteenthMs);
    return Math.max(0, Math.min(TOTAL_SIXTEENTHS - 1, index));
  });

  return [...new Set(indices)].sort((a, b) => a - b);
}

function buildTickablesForRange(tapIndices, rangeLength, noteKey, rangeStart = 0) {
  const tickables = [];
  let cursor = 0;

  while (cursor < rangeLength) {
    const absoluteCursor = rangeStart + cursor;
    const isTap = tapIndices.includes(absoluteCursor);

    if (isTap) {
      const nextTap =
        tapIndices.find((index) => index > absoluteCursor) ?? rangeStart + rangeLength;
      const length = Math.max(1, Math.min(nextTap - absoluteCursor, rangeLength - cursor));
      sixteenthsToDurations(length, false).forEach((duration) => {
        tickables.push(
          new VF.StaveNote({
            keys: [noteKey],
            duration,
            autoStem: true,
          })
        );
      });
      cursor += length;
    } else {
      const nextTap =
        tapIndices.find((index) => index > absoluteCursor) ?? rangeStart + rangeLength;
      const length = Math.min(nextTap - absoluteCursor, rangeLength - cursor);
      sixteenthsToDurations(length, true).forEach((duration) => {
        tickables.push(
          new VF.StaveNote({
            keys: ['b/4'],
            duration,
          })
        );
      });
      cursor += length;
    }
  }

  return tickables;
}

function renderNotation() {
  hidePlayhead();
  notationLayout = null;
  notationCanvasEl.innerHTML = '';

  const tracksWithData = tracks
    .map((track, index) => ({ track, index, def: TRACK_DEFS[index] }))
    .filter(({ track }) => track.quantizedTaps.length > 0);

  if (tracksWithData.length === 0) {
    notationCanvasEl.innerHTML =
      '<p class="placeholder">Your quantized rhythms will appear here after recording.</p>';
    return;
  }

  const staveHeight = 92;
  const staveWidth = MEASURE_WIDTH * BARS;
  const width = 10 + staveWidth + 130;
  const height = 36 + tracksWithData.length * staveHeight;

  notationLayout = {
    svgWidth: width,
    staveWidth,
    contentHeight: tracksWithData.length * staveHeight,
  };

  const renderer = new VF.Renderer(notationCanvasEl, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  context.setFont('Arial', 10);

  tracksWithData.forEach(({ track, index, def }, row) => {
    const y = 24 + row * staveHeight;
    const tickables = buildTickablesForRange(
      track.quantizedTaps,
      TOTAL_SIXTEENTHS,
      def.noteKey,
      0
    );
    const stave = new VF.Stave(STAVE_X, y, staveWidth);

    if (row === 0) {
      stave.addClef('percussion').addTimeSignature('4/4');
    }

    stave.setContext(context).draw();

    const voice = new VF.Voice({ numBeats: TOTAL_BEATS, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(tickables);

    new VF.Formatter().joinVoices([voice]).format([voice], staveWidth - 18);
    voice.draw(context, stave);

    context.save();
    context.setFillStyle(def.color);
    context.fillText(def.name, 12, y + 24);
    context.restore();
  });

  syncPlayheadMetrics();
}

function showPlaceholder() {
  notationCanvasEl.innerHTML =
    '<p class="placeholder">Your quantized rhythms will appear here after recording.</p>';
  hidePlayhead();
  notationLayout = null;
}

function resetSession() {
  clearScheduledTimers();
  tracks = TRACK_DEFS.map(() => ({ quantizedTaps: [] }));
  rawTaps = [];
  recordingStartTime = 0;
  activeTrackIndex = 0;
  setStatus('Choose a track, press Record, then tap during recording.', State.IDLE);
  renderTrackSelector();
  showPlaceholder();
  updateControls();
}

function finishRecording() {
  tracks[activeTrackIndex].quantizedTaps = quantizeTaps(rawTaps, recordingStartTime);
  const trackName = TRACK_DEFS[activeTrackIndex].name;
  const tapCount = tracks[activeTrackIndex].quantizedTaps.length;

  setStatus(
    tapCount
      ? `${trackName} recorded — ${tapCount} tap${tapCount === 1 ? '' : 's'}. Record another track or press Play.`
      : `${trackName} — no taps detected. Try recording again.`,
    State.DONE
  );

  renderNotation();
  renderTrackSelector();
  updateControls();
}

async function startSession() {
  if (state === State.COUNT_IN || state === State.RECORDING || state === State.PLAYING) {
    return;
  }

  await ensureAudioContext();
  clearScheduledTimers();

  rawTaps = [];
  updateControls();

  const beatMs = beatDuration() * 1000;
  const countInBeats = BEATS_PER_BAR;
  const countInMs = countInBeats * beatMs;
  const recordingMs = TOTAL_BEATS * beatMs;
  const startOffset = 120;
  const trackName = TRACK_DEFS[activeTrackIndex].name;

  recordingStartTime = performance.now() + startOffset + countInMs;

  setStatus(`Count-in for ${trackName}… get ready!`, State.COUNT_IN);

  for (let i = 0; i < countInBeats; i += 1) {
    scheduleClick(startOffset + i * beatMs, i === 0);
  }

  for (let i = 0; i < TOTAL_BEATS; i += 1) {
    scheduleClick(startOffset + countInMs + i * beatMs, i % BEATS_PER_BAR === 0);
  }

  const recordTimer = setTimeout(() => {
    setStatus(`Recording ${trackName}! Tap the pad or press Space.`, State.RECORDING);
    updateControls();
  }, startOffset + countInMs);
  scheduledTimers.push(recordTimer);

  const endTimer = setTimeout(() => {
    finishRecording();
  }, startOffset + countInMs + recordingMs + 50);
  scheduledTimers.push(endTimer);
}

function registerTap() {
  if (state === State.IDLE || state === State.DONE) {
    startSession();
    return;
  }

  if (state !== State.RECORDING) {
    return;
  }

  rawTaps.push(performance.now());
  playDrumSound(activeTrackIndex);
  tapPad.classList.add('is-hit');
  setTimeout(() => tapPad.classList.remove('is-hit'), 90);
}

async function playAllTracks() {
  if (state === State.PLAYING || !hasAnyTrackData()) {
    return;
  }

  await ensureAudioContext();
  clearScheduledTimers();

  setStatus('Playing all tracks…', State.PLAYING);
  updateControls();

  const beatMs = beatDuration() * 1000;
  const countInMs = BEATS_PER_BAR * beatMs;
  const recordingMs = TOTAL_BEATS * beatMs;
  const startOffset = 120;
  const totalMs = startOffset + countInMs + recordingMs;
  const musicStartMs = startOffset + countInMs;
  const playbackSessionStart = performance.now();

  startPlayheadAnimation(playbackSessionStart, musicStartMs, recordingMs);

  for (let i = 0; i < BEATS_PER_BAR; i += 1) {
    scheduleClick(startOffset + i * beatMs, i === 0);
  }

  for (let i = 0; i < TOTAL_BEATS; i += 1) {
    scheduleClick(startOffset + countInMs + i * beatMs, i % BEATS_PER_BAR === 0);
  }

  tracks.forEach((track, trackIndex) => {
    track.quantizedTaps.forEach((sixteenthIndex) => {
      const delayMs = startOffset + countInMs + sixteenthIndex * sixteenthDuration() * 1000;
      const timer = setTimeout(() => {
        playDrumSound(trackIndex);
      }, delayMs);
      playbackTimers.push(timer);
    });
  });

  const finishTimer = setTimeout(() => {
    stopPlayheadAnimation();
    setStatus('Playback finished. Record more tracks or play again.', State.DONE);
    updateControls();
  }, totalMs + 80);
  playbackTimers.push(finishTimer);
}

function handleSpaceDown(event) {
  if (event.code !== 'Space' || event.repeat) {
    return;
  }

  event.preventDefault();
  registerTap();
}

function renderTrackSelector() {
  trackSelectorEl.innerHTML = '';

  TRACK_DEFS.forEach((def, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-tab';
    button.role = 'tab';
    button.setAttribute('aria-selected', index === activeTrackIndex ? 'true' : 'false');
    button.style.setProperty('--track-color', def.color);
    button.innerHTML = `
      <span class="track-tab-name">${def.name}</span>
      <span class="track-tab-state">${tracks[index].quantizedTaps.length ? '●' : '○'}</span>
    `;

    button.addEventListener('click', () => {
      if (state === State.COUNT_IN || state === State.RECORDING || state === State.PLAYING) {
        return;
      }
      activeTrackIndex = index;
      renderTrackSelector();
      updateControls();
    });

    trackSelectorEl.appendChild(button);
  });
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

function initTapPad() {
  const handlePointerDown = (event) => {
    event.preventDefault();
    if (tapPad.disabled) {
      return;
    }
    registerTap();
  };

  tapPad.addEventListener('pointerdown', handlePointerDown);
  tapPad.addEventListener('contextmenu', (event) => event.preventDefault());
}

function init() {
  initPane();
  initTapPad();
  renderTrackSelector();
  showPlaceholder();
  updateControls();

  startBtn.addEventListener('click', startSession);
  playBtn.addEventListener('click', playAllTracks);
  clearBtn.addEventListener('click', resetSession);
  window.addEventListener('keydown', handleSpaceDown);
}

init();
