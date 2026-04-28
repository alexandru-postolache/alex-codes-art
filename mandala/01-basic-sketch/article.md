# Drawing a Symmetrical Mandala with p5.js: Smooth Lines, Speed-Based Thickness & Tweakpane

Hello friends, and welcome to another creative coding tutorial! Today we're going to build a **basic mandala maker** in the browser — you drag with the mouse, and every stroke is mirrored and rotated so you get kaleidoscope-like patterns in real time. We'll wire up **symmetry**, **smoothing**, **velocity-based stroke thickness**, and **colors**, all tweakable from a small **[Tweakpane](https://tweakpane.github.io/docs/?ref=alexcodesart.com)** panel.

This tutorial is perfect for beginners in creative coding who are curious about interactive drawing and a gentle intro to transforms in p5.js.

By the end of this article, you will:

- understand how **radial symmetry** works with `translate()`, `rotate()`, and `scale()`
- smooth mouse input with **`lerp()`** so lines feel less jittery
- map **drawing speed** to **stroke weight** with **`map()`** and **`lerp()`**
- add **[createGraphics()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/createGraphics)** so we draw into an off-screen buffer and composite it each frame
- expose settings with **Tweakpane** folders for Motion and Colors

Want to stay updated with new articles like this? Feel free to subscribe — it's completely free, and I'd really appreciate the support. Thanks!

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

Let's dive in.

---

## Breaking Down the Design

Here's what we're building together:

- **One stroke from your hand** — we track the mouse in "canvas space" where `(0, 0)` is the **center** of the window.
- **Mirror vertically** — we draw the same segment right-side up and upside down using `scale(1, -1)`.
- **Copy around the circle** — we rotate by `360 / symmetry` degrees and repeat until we've filled the mandala.
- **Smooth + thick** — we don't connect every raw pixel; we ease toward the mouse and vary thickness by how fast you're moving.

We're describing **rules** (symmetry, smoothing, thickness mapping), not placing each mirrored pixel by hand — that's the heart of creative coding.

---

## Setting Up the Canvas

We start with a full-window sketch and **degree mode** for angles — symmetry angles are easier to think about in degrees than radians.

```
function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);
```

Let's unpack that:

- **`createCanvas(windowWidth, windowHeight)`** — makes the sketch fill the browser window.
- **`angleMode(DEGREES)`** — so later `rotate(angle)` uses degrees (e.g. `45` instead of `PI/4`).

We keep our drawing on an off-screen buffer so the **main canvas** can paint a solid background every frame and then show the mandala on top.

```
  mandalaBuffer = createGraphics(width, height);
  mandalaBuffer.strokeCap(ROUND);
  mandalaBuffer.noFill();
  mandalaBuffer.background(params.bgColor.r, params.bgColor.g, params.bgColor.b);
```

In this snippet we:

- **`createGraphics(width, height)`** — builds a **p5.Graphics** buffer the same size as the canvas.
- **`strokeCap(ROUND)`** — soft round caps at the ends of each line segment.
- **`noFill()`** — we're only stroking lines, not filling shapes.
- **`background(...)`** — clears the buffer to our background color (RGB object from our settings).

---

## Symmetry: One Segment, Many Copies

The mandala lives in **center coordinates**: `mouseX - width/2` and `mouseY - height/2` point from the middle of the screen. That way `(0, 0)` is where the mandala's hub sits.

We draw **one** logical segment from `(x1, y1)` to `(x2, y2)`, then:

1. Move to the center with **`translate(width/2, height/2)`**.
2. Draw the line once.
3. Flip vertically with **`scale(1, -1)`** and draw again — mirror across the horizontal axis through the center.
4. **`rotate(angle)`** where `angle = 360 / symmetry`, and repeat for each wedge.

```
function drawSymmetricSegment(x1, y1, x2, y2, weight) {
  mandalaBuffer.stroke(
    params.strokeColor.r,
    params.strokeColor.g,
    params.strokeColor.b
  );
  mandalaBuffer.strokeWeight(weight);

  mandalaBuffer.push();
  mandalaBuffer.translate(width / 2, height / 2);

  mandalaBuffer.line(x1, y1, x2, y2);

  mandalaBuffer.push();
  mandalaBuffer.scale(1, -1);
  mandalaBuffer.line(x1, y1, x2, y2);
  mandalaBuffer.pop();

  for (let i = 1; i < params.symmetry; i++) {
    mandalaBuffer.rotate(angle);
    mandalaBuffer.line(x1, y1, x2, y2);

    mandalaBuffer.push();
    mandalaBuffer.scale(1, -1);
    mandalaBuffer.line(x1, y1, x2, y2);
    mandalaBuffer.pop();
  }

  mandalaBuffer.pop();
}
```

What's going on:

- **`push()` / `pop()`** — save and restore the mandala buffer's transform stack so rotations don't leak between steps.
- **`translate(width/2, height/2)`** — draws from the visual center of the canvas.
- **`scale(1, -1)`** — mirrors the Y axis for the reflection copy.
- **The `for` loop** — rotates by `angle` (`360 / symmetry`) for each additional wedge.

When **`symmetry`** changes, we update **`angle`** once:

```
function updateSymmetry() {
  symmetry = params.symmetry;
  angle = 360 / symmetry;
}
```

---

## Smoothing and Speed-Based Thickness

Raw mouse positions can feel twitchy. We ease **`current`** toward the mouse target using **`lerp()`** — the **`smoothing`** parameter controls how snappy that chase is.

```
let target = createVector(mouseX - width / 2, mouseY - height / 2);
current.lerp(target, params.smoothing);
```

- **`lerp()`** — linear interpolation; each frame we move `current` a fraction of the way toward `target`.

We only add a new segment when we've moved far enough (**`minSegmentLength`**), then we treat **segment length** as a stand-in for **speed**: short segments → thicker strokes in our mapping (you can flip the feel by swapping the map range).

```
let segmentLength = p5.Vector.dist(prev, current);
if (segmentLength >= params.minSegmentLength) {
  let speed = segmentLength;
  let targetThickness = map(
    speed,
    0,
    10,
    params.thicknessMax,
    1,
    true
  );
  thickness = lerp(thickness, targetThickness, 0.2);
  drawSymmetricSegment(prev.x, prev.y, current.x, current.y, thickness);
  prev = current.copy();
}
```

Here:

- **`p5.Vector.dist(prev, current)`** — distance between last committed point and smoothed position.
- **`map(speed, 0, 10, thicknessMax, 1, true)`** — maps speed into a thickness band; **`true`** clamps values outside the input range.
- **`lerp(thickness, targetThickness, 0.2)`** — eases thickness changes so the line doesn't jitter in weight every frame.

---

## The Draw Loop and Tweakpane

While the mouse button is down (and the pointer isn't over the UI), we accumulate segments. Each frame we paint the background color on the **main canvas** and **`image(mandalaBuffer, 0, 0)`** to show our buffer.

We add **Tweakpane** with two folders — **Motion** (symmetry, smoothing, thickness, minimum segment length) and **Colors** (background and stroke as RGB color pickers). **Clear** resets the buffer; **Save** exports a PNG.

Press **`h`** to hide or show the panel when you want an unobstructed view.

Don't worry if UI libraries feel new — Tweakpane is beginner-friendly, and we're only touching sliders and color inputs tied to our **`params`** object.

---

## Why This Matters for Creative Coding

You're not placing mirrored lines by hand — you're defining **symmetry**, **smoothing**, and **how speed maps to weight**. Small changes to those rules produce very different mandalas from the same hand motion. That's the same mindset as generative art everywhere: **design the system**, let the system draw.

---

## Experiment and Explore

You can make this sketch your own by:

- Pushing **symmetry** to high values for dense starburst patterns
- Lowering **smoothing** for sharper, more angular trails
- Raising **`thicknessMax`** for bold ribbons or lowering it for hairline lace
- Tweaking **background** vs **stroke** for high-contrast or dreamy pastel palettes

I encourage you to play with the sliders before moving on — you'll feel how each rule shapes the whole piece.

---

## Full source

You can run this project locally from the repo folder **`mandala/01-basic-sketch/`** (open `index.html` with a local server). Libraries load from **jsDelivr** in `index.html`.

**Repo:** [github.com/alexandru-postolache/alex-codes-art — mandala/01-basic-sketch](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/01-basic-sketch)

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

In the next part of this series we'll add **fading trails**, **multi-line drawing** with number keys, and more — building on this same mandala foundation. I hope to see you there!

[Mandala part 2 — Fade trails & multi-line keysWe'll layer segment history, fading, and hold keys 1–9 for parallel colored strokes.Alex Codes ArtAlex Postolache](https://github.com/alexandru-postolache/alex-codes-art/tree/main/mandala/02-fade-keys)

> Happy coding, and see you in the next tutorial! 🚀
