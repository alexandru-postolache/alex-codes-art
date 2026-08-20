# Tap to Notation

A web app that turns spacebar taps into quantized rhythm notation.

## Features (v1)

- Tempo slider (60–180 BPM)
- 4/4 time signature, 2 bars per recording
- 1-bar count-in with metronome clicks
- Spacebar tap input during recording
- Sixteenth-note quantization
- Sheet music rendered with [VexFlow](https://vexflow.com/)

## Running locally

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/tap-to-notation/index.html

## How to use

1. Set your tempo with the BPM slider.
2. Click **Start** (or press Space).
3. Listen to the 1-bar count-in.
4. Tap **Space** in rhythm during the 2-bar recording window.
5. View the quantized notation. Click **Clear** to reset.
