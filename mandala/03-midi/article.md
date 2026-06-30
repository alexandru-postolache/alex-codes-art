# Mandala Maker Part 3: Web MIDI & Tempo-Driven Motion — A p5.js Tutorial

Hello and welcome back to another exciting tutorial about creative coding and generative art! In [part 1](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/01-basic-sketch) we built a symmetrical mandala with smoothing, speed-based thickness, and [Tweakpane](https://tweakpane.github.io/docs/?ref=alexcodesart.com). In [part 2](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/02-fade-keys) we added fading trails, curvy motion with Perlin noise, and parallel colored lines on keys `1`–`9`.

Today we're finishing the series with two big ideas:

1. Tempo-driven motion — curvy strokes that breathe with a BPM clock, including pauses and subdivisions.
2. Web MIDI — connect a drum pad or keyboard and every note spawns its own wandering voice into the mandala.

This tutorial is perfect if you've followed parts 1 and 2, or you're comfortable with `createGraphics()` and want to explore browser MIDI and rhythm in visual art.

By the end of this article, you will:

- drive curvy lines from a tempo clock with beat phases, pauses, and subdivisions
- map BPM to segment speed and heading changes with `updateBeatState()` and `getTempoCurvyTarget()`
- connect hardware through the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API?ref=alexcodesart.com) with `navigator.requestMIDIAccess()`
- spawn polyphonic drawing voices from note-on messages, each with its own color and motion style
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

If you open `mandala/03-midi/` next to `02-fade-keys/`, the symmetry math, trail fading, curvy keys, and `appendStrokeForLine()` pipeline are all still there. We're still in center coordinates, still mirroring wedges, still replaying segment history when fade is on.

What's new in this chapter:

- A Tempo folder in Tweakpane — BPM, impact, subdivision chance, and pause chance.
- Beat-aware curvy motion — when tempo is enabled, wandering lines follow beat segments instead of free noise.
- `midi.js` — a small `midiEngine` object that listens for MIDI note-ons and returns drawing segments each frame.
- Drum-style voice mapping — kick, snare, tom, hi-hat, and cymbal notes each get their own speed, turn behavior, and color.

That's the high-level picture. Let's break it down step by step.

---

## Tempo: Beats That Steer Curvy Motion

In part 2, curvy lines wandered using `noise()` and a sine pulse — organic, but not tied to rhythm. Part 3 adds an optional tempo clock so motion can feel musical: fast bursts on the beat, gentle coasts between them, occasional rests.

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

When a beat (or sub-beat) fires, `triggerBeatModulation()` walks every active line in `tempoLineStates` — the main curvy line on `C`, plus any digit-key lines currently held — and either pauses them or picks a new beat segment:

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

`pickNextBeatSegment()` chooses a new heading and speed pair for the current beat window:

```
function pickNextBeatSegment(state, isFirstSegment) {
  let impact = params.tempoImpact;

  if (isFirstSegment) {
    state.beatHeading = state.curvyAngle;
  } else {
    let dirSign = beatIndex % 2 === 0 ? 1 : -1;
    let turnAmount = random(45, 165) * (0.35 + impact);
    state.beatHeading += dirSign * turnAmount;
  }

  let speedBoost = 1 + random(0.6, 1.8) * impact;
  state.beatStartSpeed =
    (params.curvyBaseSpeed + params.curvySpeedVariation) * speedBoost;

  let nearStopChance = constrain(0.2 + 0.45 * impact, 0.2, 0.9);
  if (random() < nearStopChance) {
    state.beatEndSpeed = random(0, 0.25 * params.curvyBaseSpeed);
  } else {
    state.beatEndSpeed = random(0.2, 0.6) * params.curvyBaseSpeed;
  }
}
```

- `tempoImpact` scales how aggressively headings swing and speeds jump.
- `beatStartSpeed` and `beatEndSpeed` define a burst that eases out over the segment — like a drum stroke that decays.
- Alternating turn direction by `beatIndex` keeps patterns from spinning in one direction forever.

During drawing, `getCurvyTarget()` checks `params.tempoEnabled`. When it's on, we delegate to `getTempoCurvyTarget()`:

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

The eased speed curve (`1 - pow(segmentPhase, 1.8)`) means lines launch quickly at the beat and settle toward the end speed — a visual echo of accent and decay. Turn tempo off in the panel and you're back to the free noise wander from part 2. Nice!

---

## Web MIDI: Drum Pads Become Drawing Voices

Visual creative coding and algorithmic music share the same idea: events in, patterns out. Web MIDI lets the browser receive those events directly from a controller — no extra server, no plugin.

We keep MIDI logic in `midi.js` as a plain object called `midiEngine`. That keeps `sketch.js` focused on the mandala while the engine handles access, messages, voices, and debug UI.

### Connecting

In Tweakpane, open the MIDI folder and click Connect MIDI. That calls:

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
      this.status = "connected";
    })
    .catch((err) => {
      this.status = "midi error";
      console.log("MIDI access failed:", err);
    });
}
```

- `navigator.requestMIDIAccess()` asks the browser for permission — you'll get a prompt the first time.
- `refreshInputs()` attaches an `onmidimessage` handler to every connected input.
- Toggle `midiEnabled` when you're ready to actually spawn voices from incoming notes.

Don't worry if you've never touched MIDI before — we're only listening for note-on messages (status byte `0x90`), which is what most pads send when you hit a drum or key.

### Spawning a voice

When a note arrives, `handleMessage()` filters for note-on with velocity greater than zero, then calls `spawnVoice()`:

```
spawnVoice(note, velocity) {
  let vNorm = constrain(velocity / 127, 0, 1);
  let holdMs = this.params.midiPatternHoldMs * (0.75 + 0.6 * vNorm);
  let style = this.getVoiceStyle(note, vNorm);
  let now = millis();

  this.voices.push({
    id: this.nextVoiceId++,
    note,
    velocity,
    type: style.type,
    color: style.color,
    heading: random(360) + style.headingKick,
    startSpeed: style.startSpeed,
    endSpeed: style.endSpeed,
    turnRate: style.turnRate,
    startMs: now,
    untilMs: now + holdMs,
    pos: null,
    prev: null,
    current: null
  });
}
```

Each voice is a short-lived curvy line:

- Harder hits (`velocity` closer to 127) last longer via `holdMs`.
- `getVoiceStyle()` maps General MIDI drum notes to motion personalities — kicks push straight with gentle wobble, snares zig-zag with sine turns, hi-hats jitter fast, cymbals sweep wide.
- Colors are baked per drum family so a live performance reads like a layered palette.

For example, a kick on notes 35 or 36:

```
if (note === 35 || note === 36) {
  return {
    type: "kick",
    startSpeed: 8 + 10 * vNorm,
    endSpeed: 1.2 + 0.8 * vNorm,
    turnRate: 0.15,
    headingKick: random(-20, 20),
    color: { r: 255, g: 80, b: 60 }
  };
}
```

Other notes fall through to snare, tom, hat, cymbal, or a warm default — so even a melodic keyboard produces something readable on screen.

### From voices to mandala segments

Each frame in `draw()`, after mouse and keyboard lines update, we ask the engine for fresh segments:

```
let midiSegments = midiEngine.getSegments({
  params,
  current: mouseCurrent,
  prev: mousePrev,
  mouseX,
  mouseY,
  width,
  height
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

Inside `getSegments()`, every active voice steps forward with its own heading rules, bounces off canvas edges, and emits line segments through the same thickness pipeline as everything else. Voices expire when `millis()` passes `untilMs`, so polyphony stays manageable — hit ten pads quickly and you get ten ribbons weaving through the same symmetry.

New voices anchor near the cursor (with a small random offset) so your performance has a focal point, but each path diverges immediately based on its drum type.

Enable `midiDebugHud` to see connection status, last note, velocity, and active voice count in the corner while you jam.

---

## Tweakpane: Tempo & MIDI Folders

We keep Motion, Trail & Fade, Colors, and Multi-line keys from earlier parts, and add:

- Tempo — `tempoEnabled`, `tempo` (40–220 BPM), `tempoImpact`, `tempoSubdivisionChance`, `tempoPauseChance`
- MIDI — `midiEnabled`, `midiPatternHoldMs`, `midiDebugHud`, and the Connect MIDI button

Press `h` to hide or show the panel when you want a clean stage for recording or performing.

Great work so far — the sketch still uses one `params` object; Tweakpane binds straight into it, and the MIDI engine reads the same settings each frame.

---

## Why This Matters for Creative Coding

You're not drawing mirrored wedges by hand, and you're not placing every MIDI hit manually either. You designed symmetry, fade rules, tempo curves, and drum-to-color mappings — then you perform through mouse, keys, and pads while the system renders.

Small changes to BPM, impact, or hold time produce very different visual grooves from the same controller. That's the same mindset as generative art and live-coded music: describe the rules, play the instrument, let the output surprise you.

---

## Experiment and Explore

You can make this mandala your own by:

- Matching `tempo` to a track you're playing along with, then raising `tempoImpact` for wilder beat accents
- Lowering `tempoPauseChance` for nonstop motion or cranking it for sparse, call-and-response strokes
- Adjusting `midiPatternHoldMs` so ghost notes flicker and heavy hits leave long trails
- Layering mouse drawing, digit keys, and MIDI voices at once — then tuning fade amount so older layers breathe behind newer hits
- Mapping your pad's note layout in `getVoiceStyle()` to custom colors for your favorite kit pieces

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

That wraps our three-part mandala series — from a first symmetrical sketch to fading trails, curvy keys, tempo, and live MIDI. If this chapter got you curious about making music with code too, Strudel is a wonderful next stop: browser-based live coding with the same "small rules, big output" spirit.

[Making Music with Code: A Beginner's Guide to StrudelLearn live coding in the browser — patterns, drums, and grooves you can hear and tweak in real time.Alex Codes ArtAlex Postolache](https://alexcodesart.com/making-music-with-code-a-beginners-guide-to-strudel/)

> Happy coding, and see you in the next tutorial! 🥳
