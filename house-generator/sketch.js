/**
 * Shape-grammar house generator — p5.js renderer.
 * Brand palette aligned with Alex Codes Art sketches.
 */

const ALEX_PALETTE = {
  background: [35, 38, 58],
  accent: [255, 186, 6],
};

const STYLES = [
  { id: 'greek', name: 'Greek (Cycladic)' },
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
  styleSel.value = 'greek';

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
  const label = houseData.style === 'greek'
    ? `Greek · ${houseData.root.params.variant || 'cycladic'}`
    : houseData.style;
  text(`Shape grammar · ${label}`, 12, height - 10);
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
      drawSky(x, y, w, h, palette, node.params.style);
      break;
    case 'Ground':
      drawGround(x, y, w, h, palette, node.params.style);
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
      drawWindow(x, y, w, h, palette, node.params);
      break;
    case 'Chimney':
      drawChimney(x, y, w, h, palette);
      break;
    case 'Foundation':
      drawFoundation(x, y, w, h, palette, node.params.style);
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
    case 'FloorLine':
      drawFloorLine(x, y, w, h, palette, node.params.style);
      break;
    case 'Wing':
      drawWing(x, y, w, h, palette);
      break;
    case 'Parapet':
      drawParapet(x, y, w, h, palette);
      break;
    case 'Balcony':
      drawBalcony(x, y, w, h, palette, node.params);
      break;
    case 'Stairs':
      drawStairs(x, y, w, h, palette, node.params);
      break;
    case 'Column':
      drawColumn(x, y, w, h, palette);
      break;
    case 'Dome':
      drawDome(x, y, w, h, palette);
      break;
    case 'Pot':
      drawPot(x, y, w, h, palette);
      break;
    case 'Vine':
      drawVine(x, y, w, h, palette, node.params);
      break;
    case 'Terrace':
      drawTerrace(x, y, w, h, palette);
      break;
    default:
      break;
  }

  pop();
}

function drawSky(x, y, w, h, palette, style) {
  const top = style === 'greek' ? color(palette.skyTop || '#4a90c8') : color('#5a7a9a');
  const bottom = style === 'greek' ? color(palette.skyBottom || '#b8dff5') : color('#9ec5e8');
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    fill(lerpColor(top, bottom, t));
    noStroke();
    rect(x, y + h * t, w, h / 12 + 1);
  }
}

function drawGround(x, y, w, h, palette, style) {
  if (style === 'greek') {
    fill(palette.ground || '#d8cfc0');
    noStroke();
    rect(x, y, w, h);
    fill(palette.stone || '#b8b0a4');
    for (let i = 0; i < 8; i++) {
      const sx = x + (i / 8) * w;
      rect(sx, y, w / 8 - 1, h * 0.14, 1);
    }
    return;
  }
  fill('#4a7a52');
  noStroke();
  rect(x, y, w, h);
  fill('#3d6644');
  rect(x, y, w, h * 0.12);
}

function drawBody(x, y, w, h, palette, style) {
  fill(palette.wall);
  if (style === 'greek') {
    noStroke();
    rect(x, y, w, h, 2);
    stroke(palette.trim);
    strokeWeight(max(1, w * 0.004));
    noFill();
    rect(x + w * 0.02, y + h * 0.02, w * 0.96, h * 0.96, 1);
    return;
  }
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.008));
  rect(x, y, w, h, style === 'modern' ? 2 : 4);
}

function drawRoof(x, y, w, h, palette, params) {
  fill(palette.roof);
  noStroke();

  if (params.style === 'flat') {
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
  } else if (style === 'greek') {
    const archH = w * 0.55;
    const bodyTop = y + archH * 0.5;
    rect(x, bodyTop, w, h - archH * 0.5, 1);
    arc(x + w / 2, bodyTop, w, archH, PI, TWO_PI);
    fill(palette.wall);
    stroke(palette.trim);
    strokeWeight(max(1, w * 0.04));
    noFill();
    rect(x + w * 0.08, bodyTop + (h - archH * 0.5) * 0.08, w * 0.84, (h - archH * 0.5) * 0.84, 1);
    noStroke();
    fill(palette.accent);
    circle(x + w * 0.82, y + h * 0.58, w * 0.07);
  } else {
    const archH = w * 0.52;
    const bodyTop = y + archH * 0.5;
    rect(x, bodyTop, w, h - archH * 0.5);
    arc(x + w / 2, bodyTop, w, archH, PI, TWO_PI);
    fill(palette.accent);
    circle(x + w * 0.78, y + h * 0.62, w * 0.08);
  }
}

function drawWindow(x, y, w, h, palette, params) {
  const style = params.style;
  if (style === 'greek') {
    fill(palette.wall);
    noStroke();
    rect(x - w * 0.06, y - h * 0.04, w * 1.12, h * 1.08, 2);
    fill('#d8ecfa');
    rect(x, y, w, h, 1);
    fill(palette.door);
    const open = params.shutterOpen;
    if (open) {
      rect(x - w * 0.04, y + h * 0.05, w * 0.38, h * 0.9, 1);
      rect(x + w * 0.66, y + h * 0.05, w * 0.38, h * 0.9, 1);
    } else {
      rect(x + w * 0.02, y + h * 0.05, w * 0.45, h * 0.9, 1);
      rect(x + w * 0.53, y + h * 0.05, w * 0.45, h * 0.9, 1);
    }
    stroke(palette.trim);
    strokeWeight(max(1, w * 0.05));
    line(x + w * 0.5, y, x + w * 0.5, y + h);
    return;
  }

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

function drawFoundation(x, y, w, h, palette, style) {
  fill(style === 'greek' ? palette.stone || palette.trim : palette.trim);
  noStroke();
  rect(x, y, w, h, 1);
}

function drawPorch(x, y, w, h, palette) {
  const postH = h * 4.5;
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h * 0.45, 2);
  stroke(palette.trim);
  strokeWeight(max(1.5, w * 0.035));
  const inset = w * 0.1;
  line(x + inset, y, x + inset, y - postH);
  line(x + w - inset, y, x + w - inset, y - postH);
  line(x + inset, y - postH, x + w - inset, y - postH);
  noStroke();
}

function drawFloorLine(x, y, w, h, palette, style) {
  fill(style === 'greek' ? palette.trim : palette.trim);
  noStroke();
  rect(x, y, w, h);
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

function drawWing(x, y, w, h, palette) {
  fill(palette.wall);
  noStroke();
  rect(x, y, w, h, 2);
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.02));
  noFill();
  rect(x + w * 0.06, y + h * 0.04, w * 0.88, h * 0.92, 1);
}

function drawParapet(x, y, w, h, palette) {
  fill(palette.roof);
  noStroke();
  rect(x, y + h * 0.25, w, h * 0.75, 1);
  fill(palette.wall);
  rect(x + w * 0.02, y, w * 0.96, h * 0.35, 1);
}

function drawBalcony(x, y, w, h, palette, params) {
  const slabH = max(4, h * 0.28);
  const railH = max(12, h * 1.5);
  const baseY = y - slabH;

  noStroke();
  fill(palette.trim);
  rect(x, baseY, w, slabH, 1);

  stroke(palette.door);
  strokeWeight(max(1.4, w * 0.013));
  const topY = baseY - railH;
  line(x, topY, x + w, topY);
  line(x, topY, x, baseY);
  line(x + w, topY, x + w, baseY);

  const balusters = 7;
  for (let i = 1; i < balusters; i++) {
    const bx = x + (w / balusters) * i;
    line(bx, topY, bx, baseY);
  }
  noStroke();
}

function drawStairs(x, y, w, h, palette, params) {
  const steps = params.steps || 5;
  const side = params.side;

  noStroke();
  for (let i = 0; i < steps; i++) {
    const stepTop = y + (h / steps) * i;
    const stepBottom = y + (h / steps) * (i + 1);
    const stepH = stepBottom - stepTop + 0.5;
    const progress = (i + 1) / steps;
    const treadW = w * (0.5 + progress * 0.5);

    fill(lerpColor(color(palette.trim), color(palette.wall), 0.25));
    if (side === 'left') {
      rect(x, stepTop, treadW, stepH, 1);
    } else {
      rect(x + w - treadW, stepTop, treadW, stepH, 1);
    }
  }

  stroke(palette.stone || palette.trim);
  strokeWeight(max(1.2, w * 0.07));
  if (side === 'left') {
    line(x, y, x, y + h);
    line(x, y + h, x + w, y + h);
  } else {
    line(x + w, y, x + w, y + h);
    line(x, y + h, x + w, y + h);
  }
  noStroke();
}

function drawColumn(x, y, w, h, palette) {
  fill(palette.wall);
  stroke(palette.trim);
  strokeWeight(max(1, w * 0.08));
  rect(x, y, w, h, 1);
  noStroke();
  fill(palette.trim);
  rect(x - w * 0.15, y, w * 1.3, h * 0.08, 1);
  rect(x - w * 0.1, y + h - h * 0.06, w * 1.2, h * 0.06, 1);
}

function drawDome(x, y, w, h, palette) {
  fill(palette.door);
  noStroke();
  arc(x + w / 2, y + h, w, h * 2, PI, TWO_PI);
  fill(palette.accent);
  rect(x + w * 0.15, y + h * 1.55, w * 0.7, h * 0.25, 1);
}

function drawPot(x, y, w, h, palette) {
  fill(palette.pot || '#b85c38');
  noStroke();
  arc(x + w / 2, y + h * 0.55, w, h * 0.9, 0, PI);
  rect(x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.35);
  fill('#5a8a48');
  ellipse(x + w / 2, y + h * 0.25, w * 0.9, h * 0.7);
  fill(palette.plant || '#c94b7b');
  circle(x + w * 0.35, y + h * 0.15, w * 0.35);
  circle(x + w * 0.65, y + h * 0.1, w * 0.3);
}

function drawVine(x, y, w, h, palette, params) {
  const onLeft = params.corner === 'left';
  const stemX = onLeft ? x + w * 0.82 : x + w * 0.18;

  stroke('#4a7838');
  strokeWeight(max(2, w * 0.14));
  noFill();
  line(stemX, y + h, stemX + (onLeft ? 1 : -1) * w * 0.08, y + h * 0.72);
  line(stemX + (onLeft ? 1 : -1) * w * 0.08, y + h * 0.72, stemX, y + h * 0.42);
  line(stemX, y + h * 0.42, stemX + (onLeft ? 1 : -1) * w * 0.06, y + h * 0.15);

  noStroke();
  fill('#5a8a48');
  ellipse(stemX + (onLeft ? -1 : 1) * w * 0.22, y + h * 0.62, w * 0.38, h * 0.12);
  ellipse(stemX + (onLeft ? 1 : -1) * w * 0.18, y + h * 0.38, w * 0.34, h * 0.11);
  ellipse(stemX + (onLeft ? -1 : 1) * w * 0.12, y + h * 0.2, w * 0.3, h * 0.1);

  fill(palette.plant || '#c94b7b');
  circle(stemX + (onLeft ? -1 : 1) * w * 0.28, y + h * 0.72, w * 0.34);
  circle(stemX + (onLeft ? 1 : -1) * w * 0.24, y + h * 0.5, w * 0.28);
  circle(stemX + (onLeft ? -1 : 1) * w * 0.18, y + h * 0.28, w * 0.24);
  circle(stemX, y + h * 0.58, w * 0.2);
}

function drawTerrace(x, y, w, h, palette) {
  fill(palette.trim);
  noStroke();
  rect(x, y, w, h);
}
