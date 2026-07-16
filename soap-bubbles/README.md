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
- **Bubble physics** — Each bubble floats upward with a little wobble, drift, and fade-out near the top of the screen.
- **Shader rendering** — A full-screen fragment shader draws a soft sky, a simple wand, blow mist, and up to 64 layered soap-film bubbles with iridescent rims and highlights.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell and mic-permission overlay |
| `sketch.js` | Mic input, bubble spawning, physics, uniforms |
| `bubble.frag` | Iridescent bubble rendering |
| `shader.vert` | Standard p5.js passthrough vertex shader |
| `style.css` | Overlay and blow-strength meter |

## Tips

- Use headphones to reduce feedback.
- Blow steadily rather than shouting — the experience is tuned for gentle breath.
- Tweak `params` at the top of `sketch.js` to adjust sensitivity, size, and spawn rate.
