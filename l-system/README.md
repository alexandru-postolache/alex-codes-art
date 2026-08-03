# L-System Fractals

Draw beautiful fractal forms with **L-systems** (Lindenmayer systems) and turtle graphics in p5.js. A tiny axiom and a few rewrite rules grow into plants, Koch curves, Sierpinski triangles, and more.

## What it does

- Expands an axiom through production rules over multiple iterations
- Interprets the resulting string with turtle graphics (`F` = draw, `+`/`-` = turn, `[`/`]` = branch)
- Fits and centers the drawing automatically regardless of preset
- Animates the fractal line by line as it appears
- Includes several built-in presets and a UI to edit rules, angle, and iterations

## Run it

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/l-system/index.html.

## Blog tutorial

[Drawing Fractals with L-Systems in p5.js: A Creative Coding Tutorial](https://alexcodesart.com/drawing-fractals-with-l-systems-in-p5-js-a-creative-coding-tutorial/)
