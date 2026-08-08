# Mandala Maker Part 3: Web MIDI, Auto-Draw & Tempo — A p5.js Tutorial

Hello and welcome back to another exciting tutorial about creative coding and generative art! In [part 1](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/01-basic-sketch) we built a symmetrical mandala with smoothing, speed-based thickness, and [Tweakpane](https://tweakpane.github.io/docs/?ref=alexcodesart.com). In [part 2](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/02-fade-keys) we added fading trails, draw-with-keyboard auto-draw motion, and parallel colored lines on keys `1`–`9`.

Today we're finishing the series with three big ideas:

1. **Tempo-driven motion** — auto-draw strokes on `C` and digit keys that breathe with a BPM clock, including pauses and subdivisions.
2. **Web MIDI** — connect a drum pad or keyboard and every note spawns its own wandering voice into the mandala.
3. **Two MIDI modes** — **Piano** keeps drawing while a key is held, while **Drums** uses timed voices with family spawn rings.

This tutorial is perfect if you've followed parts 1 and 2, or you're comfortable with `createGraphics()` and want to explore browser MIDI in visual art.

By the end of this article, you will:

- drive auto-draw lines from a tempo clock with beat phases, pauses, and subdivisions
- connect hardware through the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API?ref=alexcodesart.com) with `navigator.requestMIDIAccess()`
- spawn polyphonic MIDI voices that reuse the same auto-draw motion as keys `1`–`9`
- switch between pitch-based and drum-family MIDI mapping
- keep MIDI logic separate in a `midiEngine` module so the sketch stays readable

Before you start this tutorial, consider signing up to get future articles like this sent straight to your inbox.

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

Let's dive in.

---

## What We're Adding (Part 2 Recap + Delta)

If you open `mandala/03-midi/` next to `02-fade-keys/`, the symmetry math, trail fading, draw-with-keyboard lines, and `appendStrokeForLine()` pipeline are all still there. We're still in center coordinates, still mirroring wedges, still replaying segment history when fade is on.

What's new in this chapter:

- A **Tempo** folder in Tweakpane — BPM, impact, subdivision chance, and pause chance.
- Beat-aware auto-draw motion — when tempo is enabled, lines on `C` and keys `1`–`9` follow beat segments instead of free noise.
- **`midi.js`** — a small `midiEngine` object that listens for MIDI note-ons and returns drawing segments each frame.
- **MIDI Piano mode** — each new stroke cycles through multi-line key colors `1`–`9`; spawn radius from 2% to 90% by pitch; lines last while the note is held.
- **MIDI Drums mode** — kick, snare, tom, hi-hat, and cymbal notes each spawn on their own ring, using keys `1`–`6` from the multi-line palette, with length set by **Drums pattern hold MS**.
- **Full-viewport layout** — the canvas fills the screen and the control panel stays fixed without a page scrollbar.

That's the high-level picture. Let's break it down step by step.

---

## Draw With Keyboard & Auto-Draw Motion

In part 2 we called this "curvy mode." In the final sketch the Motion folder label is **Draw with keyboard (C + 1–9)**, and the speed sliders are grouped as **Auto-draw** settings — same idea, clearer name.

Hold **`C`** (when enabled) or digit keys **`1`**–**`9`** and each line wanders using `noise()`, a sine pulse, and soft edge bouncing via `getCurvyTarget()`. The multi-line palette in Tweakpane still assigns a color per digit key.

MIDI voices reuse that same motion path — they call `getCurvyTarget()` with `useTempo` set to `false`, so pad hits always use the free noise wander even when tempo is on for keyboard lines. Nice separation!

---

## Tempo: Beats That Steer Keyboard Auto-Draw

In part 2, auto-draw lines wandered every frame with Perlin noise — organic, but not tied to rhythm. Part 3 adds an optional tempo clock so motion on `C` and digit keys can feel musical: fast bursts on the beat, gentle coasts between them, occasional rests.

We track beat timing with a few globals:

```
let beatIndex = 0;
let lastBeatMs = 0;
let nextBeatMs = 0;
let beatPhase = 0;
let beatIntervalMsCurrent = 0;
let subEventsRemaining = 0;
let nextSubEventMs = 0;
let subEventStepMs = 0;
```

Each frame, `updateBeatState()` converts `params.tempo` (BPM) into milliseconds per beat:

```
let beatIntervalMs = 60000 / max(1, params.tempo);
```

Here's what happens inside `updateBeatState()`:

- On the first run, we schedule the next beat and call `triggerBeatModulation()`.
- When `millis()` passes `nextBeatMs`, we advance `beatIndex`, fire another modulation, and optionally schedule subdivisions.
- `beatPhase` becomes a 0–1 value between the last beat and the next — handy if you extend the sketch with visual pulses later.
- Subdivisions split a beat into 2 or 4 smaller events when `tempoSubdivisionChance` rolls in your favor.

When a beat (or sub-beat) fires, `triggerBeatModulation()` walks every active line in `tempoLineStates` — the main line on `C`, plus any digit-key lines currently held — and either pauses them or picks a new beat segment:

```
function triggerBeatModulation(segmentMs) {
  let now = millis();
  let beatDur = max(1, beatIntervalMsCurrent);

  for (let state of tempoLineStates) {
    if (random() <= params.tempoPauseChance) {
      state.pauseUntilMs = now + beatDur;
      state.beatStartSpeed = 0;
      state.beatEndSpeed = 0;
      state.segmentStartMs = now;
      state.segmentDurationMs = beatDur;
      continue;
    }

    state.segmentStartMs = millis();
    state.segmentDurationMs = max(1, segmentMs || beatIntervalMsCurrent || 1);
    pickNextBeatSegment(state, false);
  }
}
```

Concept: instead of turning every frame with noise, we plan short motion segments aligned to the clock. Pauses are simply "don't move until `pauseUntilMs`." Subdivisions add extra heading and speed changes mid-beat for syncopated scribbles.

During drawing, `getCurvyTarget()` checks `params.tempoEnabled` for keyboard lines. When it's on, we delegate to `getTempoCurvyTarget()`:

```
function getTempoCurvyTarget(state) {
  if (millis() < state.pauseUntilMs) {
    return state.curvyPos.copy();
  }

  let segmentPhase = constrain(
    (millis() - state.segmentStartMs) / state.segmentDurationMs,
    0,
    1
  );
  let eased = 1 - pow(segmentPhase, 1.8);
  let step = lerp(state.beatEndSpeed, state.beatStartSpeed, eased);
  state.curvyPos.x += cos(state.beatHeading) * step;
  state.curvyPos.y += sin(state.beatHeading) * step;
  // ... edge bounce ...
  return state.curvyPos.copy();
}
```

The eased speed curve (`1 - pow(segmentPhase, 1.8)`) means lines launch quickly at the beat and settle toward the end speed — a visual echo of accent and decay. Turn tempo off in the panel and you're back to the free noise wander from part 2. Great work so far!

---

## Web MIDI: Pads, Keys, and the `midiEngine`

Visual creative coding and algorithmic music share the same idea: events in, patterns out. Web MIDI lets the browser receive those events directly from a controller — no extra server, no plugin.

We keep MIDI logic in `midi.js` as a plain object called `midiEngine`. That keeps `sketch.js` focused on the mandala while the engine handles access, messages, voices, and debug UI.

### Connecting

In Tweakpane, open the MIDI folder and click **Connect MIDI**. That calls:

```
init() {
  if (!navigator.requestMIDIAccess) {
    this.status = "Web MIDI unavailable";
    return;
  }

  navigator.requestMIDIAccess()
    .then((access) => {
      this.access = access;
      this.access.onstatechange = () => this.refreshInputs();
      this.refreshInputs();
    })
    .catch((err) => {
      this.status = "midi error";
      console.log("MIDI access failed:", err);
    });
}
```

- `navigator.requestMIDIAccess()` asks the browser for permission — you'll get a prompt the first time.
- `refreshInputs()` attaches an `onmidimessage` handler to every connected input.
- Toggle **midiEnabled** when you're ready to actually spawn voices from incoming notes.

Don't worry if you've never touched MIDI before — we listen for note-on messages (status byte `0x90`) to start a voice, and note-off messages (`0x80`, or note-on with velocity `0`) to end piano voices.

### Spawning a voice

When a note arrives, `handleMessage()` filters for note-on with velocity greater than zero, then calls `spawnVoice()`. Note-off calls `noteOff()` in **Piano** mode:

```
spawnVoice(note, velocity) {
  let vNorm = this.velocityNorm(velocity);
  let style = this.resolveVoiceStyle(note);
  let now = millis();
  let holdUntilNoteOff = this.isPianoMode();
  let untilMs = null;

  if (this.isDrumMode()) {
    let holdMs = this.params.midiPatternHoldMs * (0.75 + 0.6 * vNorm);
    untilMs = now + holdMs;
  }

  this.voices.push({
    // ...
    holdUntilNoteOff,
    held: holdUntilNoteOff,
    untilMs
  });
}
```

Each voice is an auto-draw line:

- **Piano** — the line keeps going until you release the key (`noteOff()` sets `held` to `false`).
- **Drums** — harder hits (`velocity` closer to 127) last longer via `midiPatternHoldMs`.
- **Velocity** scales motion speed and color brightness — not stroke thickness.
- Colors always come from the **Multi-line keys (1–9)** palette in Tweakpane.

### Two MIDI modes

In the MIDI folder, **Mode** switches between:

**Piano** (`piano`) — melodic / pitch-based mapping:

- Color: each new stroke cycles through keys `1`–`9` in the multi-line palette (in order).
- Spawn radius: linear map from **2%** (lowest notes) to **90%** (highest notes) of the canvas radius.
- Duration: while the MIDI key is held — no pattern hold timer.

**Drums** (`drums`) — General MIDI drum kit mapping:

| Family | Example notes | Spawn ring | Color key |
|--------|---------------|------------|-----------|
| Kick | 35, 36 | 2–9% (center) | 1 |
| Snare | 38, 40 | 14–24% | 2 |
| Tom | 41, 43, 45, 47, 48, 50 | 22–36% | 3 |
| Hi-hat | 42, 44, 46 | 34–48% | 4 |
| Cymbal | 49, 51, 52, 55, 57, 59 | 52–72% (outer) | 5 |
| Other | everything else | 26–42% | 6 |

`resolveVoiceStyle()` picks the right profile:

```
resolveVoiceStyle(note) {
  if (this.isDrumMode()) {
    return this.getDrumProfile(note);
  }

  return {
    type: "note",
    color: this.nextPianoColor(),
    radiusFrac: this.noteRadiusFrac(note)
  };
}
```

Both modes share the same wandering motion — only color and spawn position differ. That's the magic of generative art: one motion system, many mapping rules.

### From voices to mandala segments

Each frame in `draw()`, after mouse and keyboard lines update, we ask the engine for fresh segments:

```
let midiSegments = midiEngine.getSegments({
  params,
  width,
  height,
  getCurvyTarget,
  createCurvyLineState
});

for (let segment of midiSegments) {
  addSegment(
    segment.x1,
    segment.y1,
    segment.x2,
    segment.y2,
    segment.weight,
    segment.color
  );
}
```

Inside `getSegments()`, every active voice:

1. Spawns on its ring at a fixed angle derived from the note.
2. Advances through `getCurvyTarget()` with tempo disabled.
3. Scales movement by velocity for softer or harder hits.
4. Emits line segments through the same thickness pipeline as everything else.

Voices expire when `millis()` passes `untilMs`, so polyphony stays manageable — hit ten pads quickly and you get ten ribbons weaving through the same symmetry.

Enable **midiDebugHud** to see connection status, mode, last note, velocity, and active voice count in the corner while you jam.

---

## Layout: Full-Screen Canvas & Tweakpane

The canvas uses `createCanvas(windowWidth, windowHeight)` and stays fixed to the viewport. The control panel gets a `mandala-pane` class so it caps at screen height and scrolls internally without showing a page scrollbar:

```
.mandala-pane {
  position: fixed;
  top: 8px;
  right: 8px;
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  scrollbar-width: none;
}
```

Press **`h`** to hide or show the panel when you want a clean stage for recording or performing.

---

## Tweakpane: Tempo & MIDI Folders

We keep Motion, Trail & Fade, Colors, and Multi-line keys from earlier parts, and add:

- **Tempo** — `tempoEnabled`, `tempo` (40–220 BPM), `tempoImpact`, `tempoSubdivisionChance`, `tempoPauseChance`
- **MIDI** — `midiEnabled`, `midiMode` (Piano / Drums), `midiPatternHoldMs` (Drums pattern hold MS, drums only), `midiDebugHud`, and the Connect MIDI button

Almost there! The sketch still uses one `params` object; Tweakpane binds straight into it, and the MIDI engine reads the same settings each frame.

---

## Why This Matters for Creative Coding

You're not drawing mirrored wedges by hand, and you're not placing every MIDI hit manually either. You designed symmetry, fade rules, tempo curves, color mappings, and spawn rings — then you perform through mouse, keys, and pads while the system renders.

Small changes to BPM, auto-draw speed, MIDI mode, or hold time produce very different visual grooves from the same controller. That's the same mindset as generative art and live-coded music: describe the rules, play the instrument, let the output surprise you.

---

## Experiment and Explore

You can make this mandala your own by:

- Matching `tempo` to a track you're playing along with, then raising `tempoImpact` for wilder beat accents on keyboard lines
- Switching MIDI mode mid-jam — Piano for held melodic lines, Drums for a pad kit
- Adjusting **Drums pattern hold MS** so ghost notes flicker and heavy hits leave long trails
- Tuning keys `1`–`6` in the multi-line palette to build a custom drum color scheme
- Layering mouse drawing, digit keys, and MIDI voices at once — then tuning fade amount so older layers breathe behind newer hits

You might be surprised how quickly a simple 8-fold symmetry turns a drum practice session into a glowing, rhythmic painting.

---

## Full source

Run from `mandala/03-midi/` (local server + `index.html`). Libraries load from jsDelivr; `index.html` also loads `midi.js` alongside `sketch.js`.

Repo: [github.com/alexandru-postolache/alex-codes-art — mandala/03-midi](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/03-midi)

---

## Wrapping Up

Thank you for following along with this tutorial! If you have any questions, feedback, or just want to share your own creations, please feel free to leave a comment below. I'll make sure to respond and help you out as best as I can.

Stay connected for more exciting tutorials and creative coding tips by subscribing to this blog. I really appreciate it!

Happy coding, and see you in the next tutorial!

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

---

## Next tutorial

That wraps our three-part mandala series — from a first symmetrical sketch to fading trails, draw-with-keyboard auto-draw, tempo, and live MIDI. If this chapter got you curious about making music with code too, Strudel is a wonderful next stop: browser-based live coding with the same "small rules, big output" spirit.

[Making Music with Code: A Beginner's Guide to StrudelLearn live coding in the browser — patterns, drums, and grooves you can hear and tweak in real time.Alex Codes ArtAlex Postolache](https://alexcodesart.com/making-music-with-code-a-beginners-guide-to-strudel/)

> Happy coding, and see you in the next tutorial! 🥳
