# Mandala Maker

An interactive **mandala maker** in the browser — drag with the mouse (or play MIDI notes) and every stroke is mirrored and rotated around the center for kaleidoscope-like patterns in real time.

This folder contains a **three-part tutorial series**, each building on the previous. The root `index.html` and `sketch.js` include the full feature set (equivalent to part 3).

## Tutorial iterations

| Folder | Features | Blog tutorial |
|--------|----------|---------------|
| [`01-basic-sketch/`](01-basic-sketch/) | Radial symmetry, smoothing, speed-based thickness, Tweakpane | [Part 1 — Smooth Lines, Speed-Based Thickness & Tweakpane](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1/) |
| [`02-fade-keys/`](02-fade-keys/) | Fading trails, curvy noise motion (`C` key), multi-line colors (`1`–`9`) | [Part 2 — Fading Trails, Curvy Keys & Multi-Line Color](https://alexcodesart.com/drawing-a-mandala-with-p5-js-smooth-lines-speed-based-thickness-tweakpane-part-1-2/) |
| [`03-midi/`](03-midi/) | Tempo-driven curvy motion, Web MIDI polyphonic drawing | [Part 3 — Web MIDI & Tempo-Driven Motion](03-midi/article.md) *(article draft in repo)* |

## Run it

```bash
python3 -m http.server 8081
```

Open any iteration, for example:

- http://localhost:8081/mandala/index.html (full version)
- http://localhost:8081/mandala/01-basic-sketch/index.html
- http://localhost:8081/mandala/02-fade-keys/index.html
- http://localhost:8081/mandala/03-midi/index.html

Libraries load from jsDelivr (p5.js, Tweakpane) — no local copies needed in the tutorial folders.

### MIDI modes

In Tweakpane → **MIDI** → **Mode**:

- **Piano** (default) — auto-draw motion while a key is held; each new stroke cycles through multi-line key colors **1–9**; spawn radius 2%–90% by pitch.
- **Drums** — same auto-draw motion with timed voices; GM drum notes map to **drum families** with spawn rings. Adjust **Drums pattern hold MS** for voice length. Colors: kick → key 1, snare → 2, tom → 3, hi-hat → 4, cymbal → 5, other → 6.

Velocity controls speed and brightness in both modes.
