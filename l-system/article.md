# Growing Fractal Lines with L-Systems and p5.js: A Creative Coding Tutorial

Hello friends, and welcome to another creative coding tutorial! Today, we're going to meet **L-systems** — tiny grammars of symbols that rewrite themselves into long strings, then bloom into branches, snowflakes, and space-filling curves when we hand those strings to a virtual turtle. This tutorial is perfect for beginners who like the idea of **rules, not hand-drawn pixels** — and for anyone who wants to understand the `l-system` sketch in this repo line by line.

First, let's take a look at what we're building. We'll think through axiom + production rules, watch the string grow across iterations, and see how the same idea powers a browser playground with presets, sliders, and a satisfying progressive draw.

By the end of this article, you will:

- understand what an L-system is and why biologists and artists both love it
- know how **string rewriting** turns a short axiom into a huge command sequence
- see how a **turtle** turns symbols into line segments on a canvas
- be able to tweak the sketch in the `l-system` folder and invent your own curves

Want to stay updated with new articles? Just hit subscribe — it's completely free, and I'd really appreciate the support. Thanks a lot!

/signup

Let's dive in.


## What Is an L-System?

An **L-system** (Lindenmayer system) is a way to describe growth with **parallel rewriting**. We start with a short string called the **axiom**. Then we apply **rules** — for every symbol, we might replace it with another string. We repeat that a chosen number of **iterations**, and the string explodes in length while staying perfectly deterministic.

Aristid Lindenmayer originally invented this to model plants. For us, it's pure creative coding: a few characters of "DNA" can become an entire drawing. You're not placing every twig — you're designing the **system** that grows the twigs for you.


## What's in the `l-system` Folder?

The companion code lives in the **`l-system`** folder (that's the folder name in this repo — L-systems with an "s" in the concept, singular in the path) of the [alex-codes-art](https://github.com/alexandru-postolache/alex-codes-art?ref=alexcodesart.com) repository. Open `index.html` in a browser for the full UI, or peek at `sketch.js` for the logic.

The playground loads [p5.js](https://p5js.org/?ref=alexcodesart.com) from a CDN, gives you a preset dropdown, fields for axiom and rules, sliders for iterations and draw speed, and a status line that shows segment count and string length. The canvas resizes with the window, and the curve recenters itself automatically.


## Breaking Down the Turtle Alphabet

After we expand the L-system, we don't draw the raw string as text — we **interpret** it like instructions for a turtle on the plane:

- `F` and `G` — step forward **with** the pen down (we draw a segment)
- `f` and `g` — step forward **without** drawing (handy for gaps)
- `+` and `-` — turn left or right by the angle you set (in degrees)
- `|` — turn around (180° flip)
- `[` — **save** the current position and heading on a stack
- `]` — **pop** the stack and jump back (classic branching)

Any other symbols (for example `X` or `Y` in some presets) exist only for rewriting — they never move the turtle. That's how a rule can say "replace `X` with something huge" without drawing extra lines until an `F` appears.


## Presets: Familiar Fractals, One Playground

The sketch ships with several **presets** you can select from the menu:

- **Fractal plant** — the textbook bush with brackets for side branches
- **Koch snowflake edge** — straight segments that crinkle into a famous outline
- **Sierpinski triangle** — two symbols (`F` and `G`) cooperating in the rules
- **Dragon curve** — a classic "paper fold" path built from two variables
- **Hilbert-like** — a space-filling flavor using `A` and `B` rules

Each preset fills in the axiom, rules, default angle, and a safe iteration count. From there, the fun is turning the knobs yourself.


## Parsing Rules from the Textarea

Rules are typed **one per line**, in the shape `symbol=replacement`. Lines starting with `#` are ignored as comments. The parser walks the textarea and builds a plain JavaScript object — keys are the left-hand symbols, values are the right-hand strings.

```
function parseRules(text) {
  const rules = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (key.length) rules[key] = val;
  }
  return rules;
}
```

Here's what happens:

- `split('\n')` breaks the textarea into individual lines so we can treat each rule separately
- Empty lines and `#` comment lines are skipped so you can document your experiments
- `indexOf('=')` finds the separator between the **symbol** and its **replacement**
- `trim()` keeps stray spaces from breaking your keys
- Each valid line stores one entry in the `rules` object


## Expanding the String

The heart of the L-system is **expansion**. We scan the current string left to right. Whenever a substring matches a rule key (longest keys first, so multi-character symbols work), we append the replacement. If nothing matches, we copy the character through unchanged.

```
function expand(axiom, rules, iterations) {
  let s = axiom;
  const keys = Object.keys(rules).sort((a, b) => b.length - a.length);
  for (let n = 0; n < iterations; n++) {
    let next = '';
    for (let i = 0; i < s.length; ) {
      let matched = false;
      for (const k of keys) {
        if (s.startsWith(k, i)) {
          next += rules[k];
          i += k.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        next += s[i];
        i += 1;
      }
    }
    s = next;
  }
  return s;
}
```

Let's unpack that:

- We start from `axiom` and repeat the rewrite loop `iterations` times
- Sorting keys **longest first** means a rule like `AB` wins over `A` when both could match
- `startsWith(k, i)` checks for a match at the current index without slicing the whole string
- If no rule matches, we keep the single character — angles, brackets, and literals pass through

**Heads up:** each extra iteration can multiply the string length dramatically. The UI caps the slider at 12 iterations so the browser stays happy — if things slow down, nudge iterations back down.


## Turning Symbols into Segments

Once we have the final string, we simulate the turtle. We track position `(x, y)`, **heading** in radians, and a **stack** for saved states whenever we see `[` and `]`. Every time `F` or `G` fires, we push a line segment from the old point to the new point.

```
function buildSegments(str, angleDeg, stepLen, startX, startY, startHeading) {
  const segs = [];
  const stack = [];
  let x = startX;
  let y = startY;
  let heading = startHeading;
  const rad = (angleDeg * Math.PI) / 180;

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === 'F' || c === 'G') {
      const nx = x + stepLen * Math.cos(heading);
      const ny = y + stepLen * Math.sin(heading);
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth: stack.length });
      x = nx;
      y = ny;
    } else if (c === 'f' || c === 'g') {
      x += stepLen * Math.cos(heading);
      y += stepLen * Math.sin(heading);
    } else if (c === '+') {
      heading += rad;
    } else if (c === '-') {
      heading -= rad;
    } else if (c === '|') {
      heading += Math.PI;
    } else if (c === '[') {
      stack.push({ x, y, heading });
    } else if (c === ']') {
      const st = stack.pop();
      if (st) {
        x = st.x;
        y = st.y;
        heading = st.heading;
      }
    }
  }
  return segs;
}
```

In plain English:

- `cos` and `sin` turn the heading into a step in x and y — that's classic trigonometry for "move in the direction you're facing"
- `F` / `G` record a visible segment; `f` / `g` move the turtle silently
- `+` and `-` rotate the heading by the user-chosen angle, converted from degrees to radians
- `[` saves a bookmark; `]` teleports back so branches can sprout from the same trunk

The sketch runs this twice in `recompute()` — first with a unit step to measure **bounds**, then again with a **scale** and offset so the whole plant fits inside the canvas with a little margin. That's why resizing the window recenters the art.


## Drawing with p5.js

The `draw()` loop clears the frame with [background()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/background), then draws only the first `segIndex` segments — increasing each frame so the curve **grows on screen**. [stroke()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/stroke) cycles through a warm palette; [line()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/line) connects each pair of points.

```
function draw() {
  if (needsRecompute) recompute();

  const bg = ALEX_PALETTE.background;
  background(bg[0], bg[1], bg[2]);

  const speed = parseInt(document.getElementById('speed').value, 10) || 1;
  const target = Math.min(segIndex + speed, segments.length);
  const colors = ALEX_PALETTE.stroke;

  strokeWeight(max(1, width / 480));
  for (let i = 0; i < target; i++) {
    const s = segments[i];
    const col = colors[i % colors.length];
    stroke(col[0], col[1], col[2], 230);
    line(s.x1, s.y1, s.x2, s.y2);
  }

  if (target < segments.length) {
    segIndex = target;
  }

  const st = document.getElementById('status');
  st.textContent = `${segments.length} segments · string length ${lastStringLen} · drawn ${Math.min(
    segIndex,
    segments.length
  )}/${segments.length}`;
}
```

Here's the idea:

- `needsRecompute` batches heavy math until something changed (typing, presets, resize)
- `speed` controls how many new segments appear per frame — fast for demos, slow for hypnosis
- `strokeWeight(max(1, width / 480))` keeps lines readable on high-DPI layouts
- Cycling `colors[i % colors.length]` gives each segment a stripe of hue without extra randomness
- The status line prints segment count, final string length, and draw progress so you can see when the expansion is getting huge

[createCanvas()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/createCanvas) attaches to the `canvas-host` div in `setup()`, and a resize listener calls [resizeCanvas()](https://p5js.org/reference/?ref=alexcodesart.com#/p5/resizeCanvas) so the playground feels like a real tool, not a fixed postage stamp.


## Why This Matters for Creative Coding

L-systems are a perfect reminder that generative art is often **grammar + geometry**. Change one symbol in a rule, or nudge the angle by five degrees, and you get a cousin of the same plant — same family, new personality. Every run with the same settings draws the same curve, but the moment you add randomness (random rule picks, jittered angles, varying step length), **every run becomes unique while the style stays yours**.

You're not fighting the canvas pixel by pixel. You're composing a language.


## Experiment and Explore

You can make this playground yours by:

- Writing a brand-new axiom and a single `F=…` rule to see what grows
- Raising and lowering **iterations** to watch detail appear or simplify
- Adjusting the **angle** a few degrees at a time — small edits, huge silhouette changes
- Using `[` and `]` in the replacement string to invent your own branching species
- Slowing **draw speed** way down for a meditative reveal, or cranking it up for instant gratification

I encourage you to duplicate a preset into the textarea, comment the old version with `#`, and iterate on your fork. You might be surprised how quickly new silhouettes emerge.


## Full Source

The runnable playground and all the code live here:

[github.com/alexandru-postolache/alex-codes-art — `l-system` folder](https://github.com/alexandru-postolache/alex-codes-art/tree/main/l-system?ref=alexcodesart.com)

Clone the repo, open `l-system/index.html` locally, and hack away.


## Wrapping Up

Thank you for following along with this tutorial! If you have any questions, feedback, or just want to share your own creations, please feel free to leave a comment below. I'll make sure to respond and help you out as best as I can.

Stay connected for more exciting tutorials and creative coding tips by subscribing to this blog. I really appreciate it!

Happy coding, and see you in the next tutorial!

Don't miss any new posts — subscribe for free! It really helps me out, and I'd love to have you along. Thanks!

/signup

## Next tutorial

If you enjoyed thinking in **rules and replacements**, you might like our walkthrough of another procedural superstar — tiles, constraints, and collapse on a grid. I hope to see you there!

[Wave Function Collapse in p5.js: A Visual Guide to the Generative Art AlgorithmFrom superposition to propagation, this article unpacks WFC with code and a big-picture map you can reuse in your own sketches.Alex Codes ArtAlex Postolache](https://github.com/alexandru-postolache/alex-codes-art/blob/main/wfc/article.md?ref=alexcodesart.com)

> Happy coding, and see you in the next tutorial! 🚀
