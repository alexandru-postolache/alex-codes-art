# Mandala Maker — Part 3

The final step in the mandala tutorial series. Adds **tempo-driven curvy motion** and **Web MIDI** so drum pads and keyboards can spawn polyphonic drawing voices into the mandala.

## What it does

- Drives curvy strokes from a BPM clock with beat phases, pauses, and subdivisions
- Connects hardware through the Web MIDI API (`navigator.requestMIDIAccess()`)
- Spawns independent drawing voices from MIDI note-on messages, each with its own color and motion
- Keeps MIDI logic in a separate `midi.js` module

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/mandala/03-midi/index.html.

Connect a MIDI controller in a browser that supports Web MIDI (Chrome recommended).

## Blog tutorial

The full article draft lives in this folder: [article.md](article.md).

Published tutorials for the earlier parts:

- [Part 1 — Smooth Lines, Speed-Based Thickness & Tweakpane](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1/)
- [Part 2 — Fading Trails, Curvy Keys & Multi-Line Color](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1-2/)
