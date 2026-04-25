/**
 * L-system with turtle graphics + progressive draw.
 * Brand colors: black background, #ffba06 accent.
 */
const ALEX_PALETTE = {
  background: [35, 38, 58],
  stroke: [
    [255, 186, 6],
  ],
};

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
  {
    id: 'dragon',
    name: 'Dragon curve',
    axiom: 'FX',
    rules: 'X=X+YF+\nY=-FX-Y',
    angle: 90,
    iter: 12,
  },
  {
    id: 'hilbert',
    name: 'Hilbert-like (Lindenmayer)',
    axiom: 'A',
    rules: 'A=+BF-AFA-FB+\nB=-AF+BFB+FA-',
    angle: 90,
    iter: 5,
  },
];

let segments = [];
let segIndex = 0;
let lastStringLen = 0;
let needsRecompute = true;

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const intVal = Number.parseInt(full, 16);
  if (Number.isNaN(intVal)) return [255, 186, 6];
  return [
    (intVal >> 16) & 255,
    (intVal >> 8) & 255,
    intVal & 255,
  ];
}

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

function boundsOfSegments(segs) {
  if (!segs.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of segs) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  return { minX, minY, maxX, maxY };
}

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
  document.getElementById('apply').addEventListener('click', () => {
    needsRecompute = true;
    segIndex = 0;
  });
  document.getElementById('reset-anim').addEventListener('click', () => {
    segIndex = 0;
  });

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
  document.getElementById('speed').addEventListener('input', () => {
    document.getElementById('speed-val').textContent =
      document.getElementById('speed').value;
  });
  document.getElementById('thickness').addEventListener('input', () => {
    document.getElementById('thickness-val').textContent =
      document.getElementById('thickness').value;
  });

  applyPreset(PRESETS[0].id);
  document.getElementById('iter-val').textContent =
    document.getElementById('iter').value;
  document.getElementById('speed-val').textContent =
    document.getElementById('speed').value;
  document.getElementById('thickness-val').textContent =
    document.getElementById('thickness').value;

  window.addEventListener('resize', () => {
    resizeCanvas(host.clientWidth, host.clientHeight);
    needsRecompute = true;
    segIndex = 0;
  });
}

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

function recompute() {
  const axiom = document.getElementById('axiom').value;
  const rulesText = document.getElementById('rules').value;
  const iterations = parseInt(document.getElementById('iter').value, 10) || 0;
  const angle = parseFloat(document.getElementById('angle').value) || 0;

  const rules = parseRules(rulesText);
  const str = expand(axiom, rules, iterations);
  lastStringLen = str.length;

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

  segments = buildSegments(
    str,
    angle,
    scale,
    ox,
    oy,
    -Math.PI / 2
  );
  needsRecompute = false;
}

function draw() {
  if (needsRecompute) recompute();

  const bg = ALEX_PALETTE.background;
  background(bg[0], bg[1], bg[2]);

  const speed = parseInt(document.getElementById('speed').value, 10) || 1;
  const thickness = parseFloat(document.getElementById('thickness').value) || 1;
  const strokeColor = hexToRgb(document.getElementById('stroke-color').value);
  const target = Math.min(segIndex + speed, segments.length);

  strokeWeight(max(0.5, thickness));
  for (let i = 0; i < target; i++) {
    const s = segments[i];
    stroke(strokeColor[0], strokeColor[1], strokeColor[2]);
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
