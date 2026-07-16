# Soap Bubbles

Blow into your microphone to launch iridescent soap bubbles. Built with **p5.js**, **p5.sound**, and a custom **GLSL** shader.

## Run locally

Because the sketch needs microphone access, serve the folder over HTTP (not `file://`):

```bash
cd soap-bubbles
npx --yes serve .
```

Then open the URL in your browser, click **Enable microphone**, and blow gently toward your mic.

## How it works

- **Microphone input** — `p5.AudioIn` feeds an `p5.Amplitude` analyzer. When the level crosses a threshold, bubbles spawn at the wand.
- **First-person view** — A large teal blower, finite handle, soap membrane, and hand sit sharply in the foreground.
- **Depth of field** — The park is cover-fitted and softly sampled in one WebGL context, keeping the background blurred without seams or cross-context artifacts.
- **Thin-film interference** — Optical path difference at 650/532/450 nm and Schlick fresnel create angle-dependent soap-film colors.
- **Bubble physics** — Bubbles drift, wobble, recede, and eventually burst. Tap any bubble to pop it early.
- **Satisfying pops** — Each burst expands into an iridescent ring and droplets with a short synthesized pop sound.

## Assets

- `assets/park-bg.png` — Purpose-built eye-level park backdrop for the first-person composition.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell and mic-permission overlay |
| `sketch.js` | Mic input, bubble spawning, physics, uniforms |
| `scene.frag` | Blurred park, realistic blower, bubbles, and pop rendering |
| `shader.vert` | Standard p5.js passthrough vertex shader |
| `style.css` | Overlay and blow-strength meter |

## Tips

- Use headphones to reduce feedback.
- Blow steadily rather than shouting — the experience is tuned for gentle breath.
- Tweak `params` at the top of `sketch.js` to adjust sensitivity, size, and spawn rate.
