# Mandala Maker — Part 3

The final step in the mandala tutorial series. Adds **tempo-driven auto-draw motion**, **Web MIDI**, and **keyboard drum-pad simulation** so pads and keys can spawn polyphonic drawing voices into the mandala.

## What it does

- Drives keyboard auto-draw lines from a BPM clock with beat phases, pauses, and subdivisions
- Connects hardware through the Web MIDI API (`navigator.requestMIDIAccess()`)
- Simulates a drum pad from the QWERTY keyboard when no controller is connected
- Two MIDI modes: **Auto-draw** (pitch-based colors and radius) and **Drums** (GM drum families with family spawn rings)
- Keeps MIDI logic in a separate `midi.js` module
- Full-viewport canvas with a fixed, scroll-safe Tweakpane panel

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/mandala/03-midi/index.html.

Connect a MIDI controller in a browser that supports Web MIDI (Chrome recommended), or use the on-screen keyboard map (Z/X snare-kick, etc.).

## Blog tutorial

The full article draft lives in this folder: [article.md](article.md).

Published tutorials for the earlier parts:

- [Part 1 — Smooth Lines, Speed-Based Thickness & Tweakpane](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1/)
- [Part 2 — Fading Trails, Curvy Keys & Multi-Line Color](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1-2/)
