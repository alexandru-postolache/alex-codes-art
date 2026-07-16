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
- **Depth of field** — A park photo fills the background. Areas away from the wand are blurred, mimicking a shallow focus on the bubbles.
- **Bubble physics** — Each bubble floats upward, shrinks with distance, wobbles, and fades near the top.
- **Shader rendering** — Iridescent thin-film colors, fresnel rims, specular highlights, and refracted background sampling inside each bubble.

## Assets

- `assets/park-bg.jpg` — Forest park photo from [Unsplash](https://unsplash.com/photos/tGTVxeOr_Rs) (free to use).

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
