// Minimal p5 bootstrap so p5.colorGenerator can use global color helpers.
function setup() {
  noCanvas();
  noLoop();
  window.p5Ready = true;
  if (window.onP5Ready) {
    window.onP5Ready();
  }
}

function draw() {}
