# Mandala sketches (tutorial iterations)

Three **standalone** demos under `mandala/`, each building on the previous for separate articles. Open `index.html` in each folder (local server recommended).

| Folder | Contents |
|--------|-----------|
| **`01-basic-sketch/`** | Symmetry, smoothing, speed-based stroke thickness, background & stroke colors, Tweakpane. Mouse drag only. |
| **`02-fade-keys/`** | Everything in **01**, plus fading trails and hold **C** or **1–9** for colored wandering lines (noise-based curvy motion — no tempo yet). |
| **`03-midi/`** | Everything in **02**, plus **tempo**-driven curvy motion when tempo is enabled, and **Web MIDI** polyphonic drawing (`midi.js`). |

The older **`mandala/sketch.js`** + **`mandala/index.html`** at the repo root matches the **full** feature set (same idea as `03-midi/`).

Libraries load from **jsDelivr** (p5, Tweakpane); no need for local `p5.js` copies when using these folders.
