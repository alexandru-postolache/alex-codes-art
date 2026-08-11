// Minimal p5 bootstrap so p5.colorGenerator can use global color helpers.
function setup() {
  const canvas = createCanvas(1, 1);
  canvas.elt.style.display = 'none';
  noLoop();
  if (window.onP5Ready) {
    window.onP5Ready();
  }
}

function draw() {}
