/**
 * Shape-grammar house generator — p5.js renderer.
 * Brand palette aligned with Alex Codes Art sketches.
 */

const ALEX_PALETTE = {
  background: [35, 38, 58],
  accent: [255, 186, 6],
};

const STYLES = [
  { id: 'cottage', name: 'Cottage' },
  { id: 'townhouse', name: 'Townhouse' },
  { id: 'modern', name: 'Modern' },
  { id: 'barn', name: 'Barn' },
];

let houseData = null;
let showDerivation = true;
let animateIn = 0;
let p5canvas;

function setup() {
  const host = document.getElementById('canvas-host');
  p5canvas = createCanvas(host.clientWidth || 480, host.clientHeight || 360);
  p5canvas.parent(host);

  const styleSel = document.getElementById('style');
  STYLES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    styleSel.appendChild(opt);
  });

  document.getElementById('regenerate').addEventListener('click', regenerate);
  document.getElementById('random-seed').addEventListener('click', () => {
    document.getElementById('seed').value = String(Math.floor(Math.random() * 999999));
    regenerate();
  });
  document.getElementById('seed').addEventListener('change', regenerate);
  document.getElementById('style').addEventListener('change', regenerate);
  document.getElementById('floors').addEventListener('input', () => {
    document.getElementById('floors-val').textContent = document.getElementById('floors').value;
    regenerate();
  });
  document.getElementById('show-tree').addEventListener('change', (e) => {
    showDerivation = e.target.checked;
    document.getElementById('derivation').hidden = !showDerivation;
  });

  document.getElementById('floors-val').textContent = document.getElementById('floors').value;
  regenerate();

  window.addEventListener('resize', () => {
    resizeCanvas(host.clientWidth, host.clientHeight);
  });
}

function regenerate() {
  const seed = parseInt(document.getElementById('seed').value, 10) || 1;
  const style = document.getElementById('style').value;
  const floors = parseInt(document.getElementById('floors').value, 10) || 1;

  houseData = generateHouse({ seed, style, floors });
  animateIn = 0;

  document.getElementById('derivation').textContent = describeDerivation(houseData.root);
  document.getElementById('status').textContent =
    `Seed ${houseData.seed} · ${houseData.steps} rule applications · ${houseData.drawables.length} terminal shapes`;
}

function draw() {
  const bg = ALEX_PALETTE.background;
  background(bg[0], bg[1], bg[2]);

  if (!houseData) return;

  animateIn = min(animateIn + 0.04, 1);
  const margin = min(width, height) * 0.08;
  const sceneW = width - margin * 2;
  const sceneH = height - margin * 2;
  const ox = margin;
  const oy = margin + sceneH * (1 - animateIn) * 0.08;

  push();
  translate(ox, oy);

  const drawables = houseData.drawables;
  for (let i = 0; i < drawables.length; i++) {
    const node = drawables[i];
    const reveal = constrain((animateIn * drawables.length - i) / 4, 0, 1);
    if (reveal <= 0) continue;
    drawShape(node, sceneW, sceneH, reveal);
  }

  pop();

  noStroke();
  fill(168, 173, 191, 180);
  textSize(11);
  textAlign(LEFT, BOTTOM);
  text(`Shape grammar · ${houseData.style}`, 12, height - 10);
}

function drawShape(node, sceneW, sceneH, reveal) {
  const b = node.abs;
  const x = b.x * sceneW;
  const y = b.y * sceneH;
  const w = b.w * sceneW;
  const h = b.h * sceneH;
  const palette = node.params.palette || houseData.root.params.palette;

  push();
  drawingContext.globalAlpha = reveal;

  switch (node.type) {
    case 'Sky':
      drawSky(x, y, w, h, palette);
      break;
    case 'Ground':
      drawGround(x, y, w, h, palette);
      break;
    case 'Body':
      drawBody(x, y, w, h, palette, node.params.style);
      break;
    case 'Roof':
      drawRoof(x, y, w, h, palette, node.params);
      break;
    case 'Door':
      drawDoor(x, y, w, h, palette, node.params.style);
      break;
    case 'Window':
      drawWindow(x, y, w, h, palette, node.params.style);
      break;
    case 'Chimney':
      drawChimney(x, y, w, h, palette);
      break;
    case 'Foundation':
      drawFoundation(x, y, w, h, palette);
      break;
    case 'Porch':
      drawPorch(x, y, w, h, palette);
      break;
    case 'Sill':
      drawSill(x, y, w, h, palette);
      break;
    case 'Trim':
      drawTrim(x, y, w, h, palette);
      break;
    default:
      break;
  }

  pop();
}

function drawSky(x, y, w, h, palette) {
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const c = lerpColor(color('#5a7a9a'), color('#9ec5e8'), t);
    fill(c);
    noStroke();
    rect(x, y + h * t, w, h / 12 + 1);
  }
}

function drawGround(x, y, w, h, palette) {
  fill('#4a7a52');
  noStroke();
  rect(x, y, w, h);
  fill('#3d6644');
  rect(x, y, w, h * 0.12);
}

function drawBody(x, y, w, h, palette, style) {
  fill(palette.wall);
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.008));
  rect(x, y, w, h, style === 'modern' ? 2 : 4);
}

function drawRoof(x, y, w, h, palette, params) {
  fill(palette.roof);
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.01));
  noStroke();

  if (params.style === 'flat') {
    fill(palette.roof);
    rect(x, y + h * 0.35, w, h * 0.65, 1);
    fill(red(color(palette.roof)) * 0.85, green(color(palette.roof)) * 0.85, blue(color(palette.roof)) * 0.85);
    rect(x, y + h * 0.35, w, h * 0.12);
    return;
  }

  if (params.style === 'barn') {
    beginShape();
    vertex(x, y + h);
    vertex(x + w * 0.5, y);
    vertex(x + w, y + h);
    endShape(CLOSE);
    fill(red(color(palette.roof)) * 0.75, green(color(palette.roof)) * 0.75, blue(color(palette.roof)) * 0.75);
    beginShape();
    vertex(x + w * 0.08, y + h);
    vertex(x + w * 0.5, y + h * 0.12);
    vertex(x + w * 0.92, y + h);
    endShape(CLOSE);
    return;
  }

  beginShape();
  vertex(x, y + h);
  vertex(x + w * 0.5, y);
  vertex(x + w, y + h);
  endShape(CLOSE);
}

function drawDoor(x, y, w, h, palette, style) {
  fill(palette.door);
  noStroke();
  if (style === 'modern') {
    rect(x, y, w, h, 1);
  } else if (style === 'barn') {
    rect(x, y, w, h, 2);
    fill(palette.trim);
    rect(x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.08);
    rect(x + w * 0.08, y + h * 0.28, w * 0.84, h * 0.08);
    rect(x + w * 0.08, y + h * 0.44, w * 0.84, h * 0.08);
  } else {
    arc(x, y + h * 0.15, w, h * 0.35, PI, TWO_PI);
    rect(x, y + h * 0.28, w, h * 0.72);
    fill(palette.accent);
    circle(x + w * 0.78, y + h * 0.55, w * 0.08);
  }
}

function drawWindow(x, y, w, h, palette, style) {
  fill(style === 'modern' ? '#d8e8f0' : '#a8cce8');
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.06));
  rect(x, y, w, h, style === 'modern' ? 0 : 2);
  line(x + w * 0.5, y, x + w * 0.5, y + h);
  line(x, y + h * 0.5, x + w, y + h * 0.5);
}

function drawChimney(x, y, w, h, palette) {
  fill('#8a8a8a');
  noStroke();
  rect(x, y, w, h, 2);
  fill('#6a6a6a');
  rect(x - w * 0.08, y, w * 1.16, h * 0.08, 2);
}

function drawFoundation(x, y, w, h, palette) {
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h, 1);
}

function drawPorch(x, y, w, h, palette) {
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h * 0.35, 2);
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.04));
  line(x + w * 0.12, y, x + w * 0.12, y - h * 1.8);
  line(x + w * 0.88, y, x + w * 0.88, y - h * 1.8);
  line(x + w * 0.12, y - h * 1.8, x + w * 0.88, y - h * 1.8);
}

function drawSill(x, y, w, h, palette) {
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h, 1);
}

function drawTrim(x, y, w, h, palette) {
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h);
}
