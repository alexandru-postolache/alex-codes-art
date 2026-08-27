# Tap to Notation

A web app that turns taps into quantized rhythm notation — on desktop **or** mobile.

## Features

- Tempo slider (60–180 BPM)
- 4/4 time signature, 1–8 bars per recording (selectable in Settings)
- **Up to 4 drum tracks** (Kick, Snare, Hi-hat, Clap) with distinct sounds
- **Mobile tap pad** — press the screen in rhythm during recording
- **Desktop spacebar** input still supported
- Live drum sound on every tap while recording
- **Play** button to hear all recorded tracks together with metronome
- Sixteenth-note quantization
- Sheet music rendered with [VexFlow](https://vexflow.com/) — one staff per track

## Running locally

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/tap-to-notation/index.html

## How to use

1. Set your tempo with the BPM slider.
2. Select a track (Kick, Snare, Hi-hat, or Clap).
3. Click **Record** (or press Space on desktop).
4. Listen to the 1-bar count-in.
5. Tap the **tap pad** (mobile) or **Space** (desktop) in rhythm during the 2-bar window.
6. Repeat for additional tracks.
7. Press **Play** to hear everything together.
8. Click **Clear all** to reset.
