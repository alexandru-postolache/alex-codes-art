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
- **First-person view** — A large bubble wand and hands are drawn in the foreground shader, like you're holding the blower close to the camera.
- **Depth of field** — Two-pass separable blur on the background, mixed with the sharp image based on distance from the wand (shallow focus, like a camera aimed at the blower)
- **Thin-film interference** — Per-channel optical path difference (650/532/450 nm) with Schlick fresnel, based on published soap-bubble rendering models
- **Bubble physics** — Each bubble floats upward, shrinks with distance, wobbles, and fades near the top.
- **Shader rendering** — Iridescent thin-film colors, fresnel rims, specular highlights, and refracted background sampling inside each bubble.

## Assets

- `assets/park-bg.jpg` — Forest park photo from [Unsplash](https://unsplash.com/photos/tGTVxeOr_Rs) (free to use).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell and mic-permission overlay |
| `sketch.js` | Mic input, bubble spawning, physics, uniforms |
| `scene.frag` | Depth-of-field composite, wand, and bubble rendering |
| `background.frag` | Cover-fit park background pass |
| `blur.frag` | Separable Gaussian blur pass for bokeh |
| `shader.vert` | Standard p5.js passthrough vertex shader |
| `style.css` | Overlay and blow-strength meter |

## Tips

- Use headphones to reduce feedback.
- Blow steadily rather than shouting — the experience is tuned for gentle breath.
- Tweak `params` at the top of `sketch.js` to adjust sensitivity, size, and spawn rate.
