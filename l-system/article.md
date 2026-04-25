# Drawing Fractals with L-Systems in p5.js: A Creative Coding Tutorial

Hello friends, and welcome to another creative coding tutorial! Today, we’re going to build an interactive **L-system explorer** with p5.js.

L-systems are one of those beautiful creative coding ideas where a tiny bit of text can grow into branches, curves, triangles, snowflakes, and all kinds of organic-looking structures. We’ll start with a small string, rewrite it again and again, and then use turtle graphics to draw the result on the canvas.

By the end of this article, you will:

- understand what an L-system is
- learn how to expand an axiom with rewrite rules
- draw the generated string with turtle graphics
- add controls for presets, iterations, angles, and animation speed
- build a small interactive playground for exploring fractals

Before you start this tutorial, consider signing up to get future articles like this sent straight to your inbox.

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

Let’s dive in.

---

## What Is an L-System?

An **L-system**, short for **Lindenmayer system**, is a way to describe growth using text rules.

We begin with an initial word called an **axiom**. Then we apply a set of replacement rules over and over. Each round is called an **iteration**.

Here is a tiny example:

```
Axiom: F
Rule:  F=F+F-F
```

After one iteration, `F` becomes `F+F-F`.

After another iteration, every `F` gets replaced again:

```
F+F-F
```

becomes:

```
F+F-F+F+F-F-F+F-F
```

This looks like a strange little sentence, but we can turn it into drawing instructions:

- `F` means “move forward and draw a line”
- `+` means “turn right”
- `-` means “turn left”

That’s the core idea. We grow a string, then we draw it.

You’re not placing every branch by hand — you’re designing a system that grows the drawing for you.

---

## What We’re Building

Our project is an interactive L-system sketch with:

- a p5.js canvas
- a preset dropdown with classic examples
- editable axiom and rules fields
- an iterations slider
- an angle input
- a draw speed slider
- a progressive animation that draws the fractal line by line

The project includes presets for:

- Fractal plant
- Koch snowflake edge
- Sierpinski triangle
- Dragon curve
- Hilbert-like curve

Each preset uses the same engine. Only the text rules, angle, and iteration count change.

That’s the magic of generative art: small textual changes can create very different visual results.

---

## Setting Up the Page

Before we write the p5.js logic, we need a small HTML page with a control panel and a canvas container.

Here is the important structure:

```
<aside class="panel">
  <label for="preset">Preset</label>
  <select id="preset"></select>

  <label for="axiom">Axiom</label>
  <input type="text" id="axiom" spellcheck="false" />

  <label for="rules">Rules</label>
  <textarea id="rules" spellcheck="false"></textarea>

  <label for="iter">Iterations <span id="iter-val"></span></label>
  <input type="range" id="iter" min="0" max="12" value="4" />

  <label for="angle">Angle (°)</label>
  <input type="number" id="angle" min="0" max="180" value="25" step="0.5" />

  <label for="speed">Draw speed <span id="speed-val"></span></label>
  <input type="range" id="speed" min="1" max="200" value="40" />

  <button type="button" id="apply">Apply & redraw</button>
  <button type="button" id="reset-anim">Reset animation</button>
</aside>

<div id="canvas-host">
  <span class="status" id="status"></span>
</div>
```

Let’s break this down:

- `preset` lets us choose between ready-made L-system examples.
- `axiom` stores the starting string.
- `rules` stores one rewrite rule per line.
- `iter` controls how many times the string grows.
- `angle` controls how much the turtle turns for `+` and `-`.
- `speed` controls how many line segments we draw each frame.
- `canvas-host` is where our p5.js canvas will live.
- `status` shows helpful information about the generated string and line count.

The HTML is simple, but it gives us a nice playground. Instead of changing code every time, we can experiment directly in the browser.

---

## Creating the Presets

Let’s define a few classic L-systems.

```
const PRESETS = [
  {
    id: 'plant',
    name: 'Fractal plant (classic)',
    axiom: 'X',
    rules: `X=F+[[X]-X]-F[-FX]+X\nF=FF`,
    angle: 25,
    iter: 6,
  },
  {
    id: 'koch',
    name: 'Koch snowflake edge',
    axiom: 'F',
    rules: 'F=F+F-F-F+F',
    angle: 90,
    iter: 4,
  },
  {
    id: 'sierpinski',
    name: 'Sierpinski triangle',
    axiom: 'F-G-G',
    rules: 'F=F-G+F+G-F\nG=GG',
    angle: 120,
    iter: 6,
  },
];
```

Each preset has:

- `id` — a short name we use internally.
- `name` — the label shown in the dropdown.
- `axiom` — the starting string.
- `rules` — the replacement rules.
- `angle` — how far the turtle turns.
- `iter` — how many iterations we should use.

The plant preset is especially fun because it uses brackets: `[` and `]`. Those symbols let the turtle save and restore its position, which is how we get branching structures.

Nice!

---

## Parsing the Rules

Our rules are written as plain text, one rule per line:

```
X=F+[[X]-X]-F[-FX]+X
F=FF
```

We need to turn this text into a JavaScript object.

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

Here’s what happens:

- `split('\n')` breaks the text into separate lines.
- `trim()` removes extra spaces.
- Empty lines and comment lines are ignored.
- `indexOf('=')` finds where the left side ends and the right side begins.
- `rules[key] = val` stores the replacement.

So this:

```
F=FF
X=F+X
```

becomes this:

```
{
  F: 'FF',
  X: 'F+X'
}
```

Now our sketch can understand the rules the reader types into the panel.

---

## Expanding the L-System

Next, we need a function that starts with an axiom and applies the rules several times.

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

Let’s unpack it:

- `s` stores the current string.
- `keys` stores all rule names, sorted from longest to shortest.
- For each iteration, we build a new string called `next`.
- At each position, we check if one of the rule keys matches.
- If a rule matches, we add its replacement.
- If no rule matches, we keep the original character.

That last part is important. Symbols like `+`, `-`, `[`, and `]` usually do not have rewrite rules. They pass through unchanged so they can be used later by the turtle.

This function is where the growth happens. A small axiom can become thousands of drawing commands after only a few iterations.

---

## Turtle Graphics

Now we have a generated string. Time to draw it.

We’ll use **turtle graphics**, which is a friendly way to think about drawing. Imagine a tiny turtle standing on the canvas. It has:

- an `x` position
- a `y` position
- a heading, which means the direction it is facing

Then we feed it commands:

- `F` or `G` — move forward and draw
- `f` or `g` — move forward without drawing
- `+` — turn one way
- `-` — turn the other way
- `|` — turn around
- `[` — save the current position and heading
- `]` — restore the last saved position and heading

This is perfect for L-systems because the generated string is already a list of instructions.

---

## Building Line Segments

Instead of drawing immediately, we’ll convert the string into an array of line segments.

This makes animation easier because we can draw the first few segments, then a few more, then a few more.

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

Here’s how it works:

- `segs` stores all line segments.
- `stack` stores saved turtle states for branching.
- `heading` is measured in radians, because `Math.sin()` and `Math.cos()` use radians.
- For `F` and `G`, we calculate a new point and store a line from the old point to the new point.
- For `f` and `g`, we move without storing a line.
- For `+` and `-`, we rotate the turtle.
- For `[` we save the current state.
- For `]` we go back to the last saved state.

The small formulas:

```
nx = x + stepLen * cos(heading)
ny = y + stepLen * sin(heading)
```

mean “walk forward in the direction we’re currently facing.”

If that feels new, don’t worry. You can think of `cos()` as controlling the horizontal movement and `sin()` as controlling the vertical movement.

---

## Fitting the Drawing on the Canvas

Different L-systems create different shapes. Some grow upward like plants. Some spread sideways. Some curl into squares or triangles.

So before we draw the final version, we measure the generated segments.

```
function boundsOfSegments(segs) {
  if (!segs.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of segs) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }

  return { minX, minY, maxX, maxY };
}
```

This function finds the smallest rectangle that contains the whole drawing.

Then we use that rectangle to scale and center the final result:

```
function recompute() {
  const axiom = document.getElementById('axiom').value;
  const rulesText = document.getElementById('rules').value;
  const iterations = parseInt(document.getElementById('iter').value, 10) || 0;
  const angle = parseFloat(document.getElementById('angle').value) || 0;

  const rules = parseRules(rulesText);
  const str = expand(axiom, rules, iterations);

  let temp = buildSegments(str, angle, 1, 0, 0, -Math.PI / 2);
  const b = boundsOfSegments(temp);

  const w = width - 40;
  const h = height - 40;
  const bw = b.maxX - b.minX || 1;
  const bh = b.maxY - b.minY || 1;
  const scale = Math.min(w / bw, h / bh) * 0.95;

  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const ox = width / 2 - cx * scale;
  const oy = height / 2 - cy * scale;

  segments = buildSegments(str, angle, scale, ox, oy, -Math.PI / 2);
}
```

In this function we:

- read the current controls
- parse the rules
- expand the L-system string
- build temporary segments with a step length of `1`
- measure the bounds
- calculate a scale that fits inside the canvas
- calculate an offset that centers the drawing
- build the final segments using the real scale and offset

This is why the dragon curve, Sierpinski triangle, and plant can all share the same canvas without flying offscreen.

Almost there!

---

## Setting Up p5.js

Now let’s connect p5.js to our HTML.

```
let segments = [];
let segIndex = 0;
let lastStringLen = 0;
let needsRecompute = true;
let p5canvas;

function setup() {
  const host = document.getElementById('canvas-host');
  p5canvas = createCanvas(host.clientWidth || 400, host.clientHeight || 400);
  p5canvas.parent(host);

  const presetSel = document.getElementById('preset');
  PRESETS.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    presetSel.appendChild(o);
  });

  presetSel.addEventListener('change', () => applyPreset(presetSel.value));
  applyPreset(PRESETS[0].id);
}
```

Let’s break this down:

- `segments` stores the line segments we draw.
- `segIndex` tracks how much of the drawing has been animated.
- `lastStringLen` stores the generated string length for the status text.
- `needsRecompute` tells us when the rules or settings changed.
- [`createCanvas()`](https://p5js.org/reference/?ref=alexcodesart.com#/p5/createCanvas) creates the p5.js canvas.
- `p5canvas.parent(host)` places it inside our `canvas-host` element.
- The preset dropdown is filled from the `PRESETS` array.

If you are new to p5.js, [`setup()`](https://p5js.org/reference/?ref=alexcodesart.com#/p5/setup) runs once when the sketch starts. It is the perfect place to create the canvas, initialize the UI, and set default values.

---

## Applying a Preset

When the reader chooses a preset, we copy its values into the controls.

```
function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;

  document.getElementById('axiom').value = p.axiom;
  document.getElementById('rules').value = p.rules;
  document.getElementById('angle').value = String(p.angle);
  document.getElementById('iter').value = String(Math.min(p.iter, 12));
  document.getElementById('iter-val').textContent =
    document.getElementById('iter').value;

  needsRecompute = true;
  segIndex = 0;
}
```

This function does two small but important things at the end:

- `needsRecompute = true` tells the sketch to rebuild the generated line segments.
- `segIndex = 0` restarts the progressive drawing animation.

That means every preset change gives us a fresh animation from the beginning.

---

## Drawing the Fractal

The `draw()` function is where the sketch comes alive.

In p5.js, `draw()` runs again and again, usually around 60 times per second.

```
function draw() {
  if (needsRecompute) recompute();

  background(35, 38, 58);

  const speed = parseInt(document.getElementById('speed').value, 10) || 1;
  const target = Math.min(segIndex + speed, segments.length);

  strokeWeight(max(1, width / 480));

  for (let i = 0; i < target; i++) {
    const s = segments[i];
    stroke(255, 186, 6, 230);
    line(s.x1, s.y1, s.x2, s.y2);
  }

  if (target < segments.length) {
    segIndex = target;
  }
}
```

Here’s what happens:

- If something changed, `recompute()` rebuilds the L-system.
- [`background()`](https://p5js.org/reference/?ref=alexcodesart.com#/p5/background) clears the canvas with the dark Alex Codes Art background color.
- `speed` controls how many segments we reveal per frame.
- `target` is the current number of visible segments.
- The `for` loop draws every visible segment with [`line()`](https://p5js.org/reference/?ref=alexcodesart.com#/p5/line).
- `segIndex` increases until the full drawing is visible.

The animation is very simple, but it makes a huge difference. Instead of instantly seeing a finished fractal, we can watch the system draw itself.

Math magic! Great work so far.

---

## Keeping the Interface Responsive

One nice detail in this project is that the sketch responds to changes immediately.

```
['axiom', 'rules', 'angle'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    needsRecompute = true;
    segIndex = 0;
  });
});

document.getElementById('iter').addEventListener('input', () => {
  document.getElementById('iter-val').textContent =
    document.getElementById('iter').value;
  needsRecompute = true;
  segIndex = 0;
});

document.getElementById('reset-anim').addEventListener('click', () => {
  segIndex = 0;
});
```

Every time the axiom, rules, angle, or iteration count changes, we rebuild the drawing.

The reset button is even simpler. It doesn’t change the L-system at all. It only sends `segIndex` back to `0`, so we can replay the drawing animation.

This turns the sketch into a little creative coding instrument. Type a rule, change an angle, increase the iterations, and watch the system respond.

---

## Why This Matters for Creative Coding

L-systems are a wonderful reminder that creative coding is often about rules, not individual marks.

We do not draw every branch of the plant. We do not place every side of the triangle. We describe a grammar, then let the system unfold.

That is the same idea behind many generative art techniques: the artist designs the behavior, and the code produces the final image. Every parameter becomes a small door into a different visual world.

---

## Experiment and Explore

You can make this art your own by:

- Changing the angle from `25` to `20`, `30`, or `45`
- Increasing and decreasing the iteration count
- Editing the plant rule and adding more `[` and `]` branches
- Trying a new axiom like `F+F+F+F`
- Changing the stroke color from yellow to another palette
- Slowing the draw speed so the structure appears more gradually
- Creating your own preset in the `PRESETS` array

You might be surprised how quickly new patterns start to emerge.

You can find the full source code here:

[L-System project on GitHub](https://github.com/alexandru-postolache/alex-codes-art/tree/main/l-system?ref=alexcodesart.com)

---

## Wrapping Up

Thank you for following along with this tutorial! If you have any questions, feedback, or just want to share your own creations, please feel free to leave a comment below. I’ll make sure to respond and help you out as best as I can.

Stay connected for more exciting tutorials and creative coding tips by subscribing to this blog. I really appreciate it!

Happy coding, and see you in the next tutorial!

Want to stay updated with new articles? Just hit subscribe — it’s completely free, and I’d really appreciate the support. Thanks a lot!

## Sign up for Alex Codes Art

Art with code for curious minds

Subscribe

Email sent! Check your inbox to complete your signup.

No spam. Unsubscribe anytime.

---

## Next tutorial

In the next tutorial, we’ll keep exploring rule-based generative art and look at another way small systems can create rich visual patterns. I hope to see you there!

[Wave Function Collapse in p5.js: A Visual Guide to the Generative Art AlgorithmLearn how local tile rules, entropy, and constraint propagation can create surprising procedural patterns with p5.js.Alex Codes ArtAlex Postolache](https://alexcodesart.com/wave-function-collapse-in-p5-js-a-visual-guide-to-the-generative-art-algorithm/)

Happy coding, and see you in the next tutorial! 🚀
