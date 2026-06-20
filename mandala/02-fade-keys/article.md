# Mandala Maker Part 2: Fading Trails, Curvy Keys & Multi-Line Color — A p5.js Tutorial

Hello and welcome back to another exciting tutorial! In **[part 1](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/01-basic-sketch)** we built a **symmetrical mandala** with smoothing, speed-based thickness, and **[Tweakpane](https://tweakpane.github.io/docs/?ref=alexcodesart.com)** — mouse in, mirrored wedges out.

Today we're leveling up that same foundation with three ideas:

1. **Fading trails** — we remember recent segments and redraw them with transparency so older strokes gently disappear.
2. **Curvy drawing** — hold **`C`** (when enabled) and the stroke wanders on its own using **[noise()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/noise)** and a little sine pulse — release to stop.
3. **Multi-line keys** — hold **`1`** through **`9`** at the same time for **parallel** wandering lines, each with its **own color** in the panel.

This tutorial is perfect if you've followed part 1 or you're comfortable with `createGraphics()` and want to explore **history**, **keyboard input**, and **Perlin-style motion**.

By the end of this article, you will:

- store stroke history in an array and **fade** older segments by **alpha** and age
- toggle **fade** vs **immediate** drawing so you can compare behaviors
- drive a stroke from **noise** + **trigonometry** for organic curvy motion
- spawn **multiple independent paths** with **`keyIsDown()`** and **digit keys 1–9**
- keep colors organized with a **`multiLineColors`** object and Tweakpane pickers

Don't miss any new posts — subscribe for free! It really helps me out, and I'd love to have you along. Thanks!

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

Let's dive in.

---

## What We're Adding (Part 1 Recap + Delta)

If you open **`mandala/02-fade-keys/`** next to **`01-basic-sketch/`**, the symmetry math and **`drawSymmetricSegment()`** idea are the same — we're still in **center coordinates** and still mirroring + rotating wedges.

What's new:

- **`trailSegments`** — each finished segment stores endpoints, weight, **birth frame**, and optional **color**.
- **`renderFadingTrails()`** — clears the off-screen buffer and **repaints** every stored segment with alpha based on age (or draws solid if fade amount is zero).
- **`appendStrokeForLine()`** — one shared pipeline for **mouse**, **C**, and **digit keys** so we don't copy-paste thickness logic.
- **`getCurvyTarget()`** — advances a wandering point with **`noise()`**, **`sin()`**, **`cos()`**, and soft **edge bouncing**.

That's it at a high level — let's break it down.

---

## Trail & Fade: Remembering Strokes

When **fade** is on, we don't draw straight to the mandala buffer forever without bookkeeping. We **`push()`** small records:

```
trailSegments.push({
  x1,
  y1,
  x2,
  y2,
  weight,
  bornAt: frameCount,
  color
});
```

Each segment remembers **`bornAt`** so we can ask: how **old** is this line in frames?

In **`renderFadingTrails()`** we:

1. **`background()`** the mandala buffer so we start fresh each frame we're fading.
2. Map **`fadeAmount`** (1–100 in the UI) to a **`lifeFrames`** window — higher fade slider → longer ghost trails.
3. For each segment, compute **age** = `frameCount - bornAt`, map age to **alpha** from 255 down toward 0, and **`splice`** segments that exceeded their life.

Concept: we're not erasing pixels — we're **replaying** history with rules. That's classic generative thinking — **small rules** (birth time, fade curve) → rich behavior.

When **fade** is **off**, **`addSegment()`** draws immediately with full opacity instead of queueing — same symmetric segment, no trail memory.

---

## Curvy Mode: Hold C (and Optional Keys 1–9)

With **Curvy** enabled in Motion, **`keyIsDown(67)`** checks for **`C`** (ASCII 67). While it's held (and the pointer isn't over the UI), we feed **`getCurvyTarget()`** instead of the raw mouse:

```
let curvyC = params.curvyEnabled && keyIsDown(67) && !overPane;
```

**`getCurvyTarget()`** keeps a **`curvyPos`**, **`curvyAngle`**, and **`curvyTime`**. Each frame we:

- nudge **`curvyAngle`** with **`map(noise(curvyTime), ...)`** — organic turning.
- add a **pulse** with **`sin`** so speed breathes a little.
- step along **`cos` / `sin`** of the heading and **bounce** off the canvas edges by flipping the angle.

When a curvy stroke **starts**, we seed position near the cursor and randomize angle and noise phase so each press feels fresh.

For keys **`1`**–**`9`**, we scan **`keyIsDown(48 + d)`** — digit **`1`** is key code **49**, so **`48 + d`** hits **`1`**–**`9`**.

Each digit gets its **own** **`createCurvyLineState()`** so paths don't share one position — you really can hold **`3`**, **`7`**, and **`C`** together and get three (or four) independent ribbons.

---

## One Drawing Pipeline: `appendStrokeForLine`

Instead of duplicating **lerp → distance → thickness → addSegment** for mouse vs keys, we funnel everything through **`appendStrokeForLine(lineState, active, justStarted, getTarget, colorOverride)`**:

- **`getTarget`** returns either the mouse vector or **`getCurvyTarget(state, justStarted)`**.
- **`colorOverride`** is **`null`** for the main stroke (uses **`strokeColor`**) or a **`multiLineColors.k1`…`k9`** object for digit lines.

**`drawSymmetricSegment`** now takes **`alphaValue`** and optional **`colorOverride`** so faded segments and key colors both work.

---

## Tweakpane: New Folders

We keep **Motion** and **Colors**, and add:

- **Trail & Fade** — `fadeEnabled`, `fadeAmount`, `maxTrailSegments`, `minSegmentLength`
- **Multi-line keys (1–9)** — nine color pickers labeled **Key 1** … **Key 9**

Great work so far — the UI stays one **`params`** object; Tweakpane binds straight into it.

---

## Why This Matters for Creative Coding

You're still not drawing mirrored wedges by hand — you're storing **events** (segments), **replaying** them with **time-based opacity**, and layering **parallel systems** (cursor, **C**, digits) that share one renderer. **Every run** can look different because **noise** and **random** seeds vary — but the **style** stays yours because symmetry and thickness rules stay put.

That's the magic of generative art truly shines — systems producing output, not pixel pushing.

---

## Try It Yourself

You can make this mandala your own by:

- Cranking **fade amount** down for snappy ghosts or up for long smoky trails
- Raising **max trail segments** before dense sessions slow the redraw
- Tuning **curvy base speed** and **turn rate** for calm doodles vs frantic scribbles
- Painting **key colors** into a personal palette and jamming several number keys at once

You might be surprised how quickly new rhythms show up when **multiple** curvy lines weave through the same symmetry.

---

## Full source

Run from **`mandala/02-fade-keys/`** (local server + `index.html`). Libraries load from **jsDelivr**.

**Repo:** [github.com/alexandru-postolache/alex-codes-art — mandala/02-fade-keys](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/02-fade-keys)

---

## Wrapping Up

Thank you for following along with this tutorial! If you have any questions, feedback, or just want to share your own creations, please feel free to leave a comment below. I'll make sure to respond and help you out as best as I can.

Stay connected for more exciting tutorials and creative coding tips by subscribing to this blog. I really appreciate it!

Happy coding, and see you in the next tutorial!

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

---

## Next tutorial

In **part 3** we'll hook up **Web MIDI** so drum pads and keys can spawn their **own** wandering voices into the mandala — tempo-driven motion included. I hope to see you there!

[Mandala part 3 — MIDI drawingWe'll connect Web MIDI, polyphonic voices, and tempo-modulated curvy strokes.Alex Codes ArtAlex Postolache](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/03-midi)

> Happy coding, and see you in the next tutorial! 🚀
