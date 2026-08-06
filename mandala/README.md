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

## Keyboard MIDI simulation (main folder)

Enable **MIDI** and **Keyboard drum pad (QWERTY)** in the Tweakpane MIDI folder to trigger drum voices without hardware:

| Key | Drum |
|-----|------|
| Z | Kick |
| X | Snare |
| A / S / D / F / G | Toms |
| Q / W / E | Crash / open hat / closed hat |
| R / T / Y / U | Ride / china / splash / crash 2 |

Hold **Shift** for accent hits (velocity 127). These keys do not overlap with mouse drawing, `C` (curvy mode), or digit keys `1`–`9` (multi-line colors).
