let particles = [];
let field = [];
let cols, rows;
let fieldSpacing = 30;
let numberOfParticles = 200;

function setup() {
  createCanvas(600, 600);
  cols = floor(width / fieldSpacing);
  rows = floor(height / fieldSpacing);
  background(255);
  
  // Initialize the vector field
  for (let x = 0; x < cols; x++) {
    field[x] = [];
    for (let y = 0; y < rows; y++) {
      let angle = noise(x * 0.05, y * 0.05) * TWO_PI; // Angle determined by Perlin noise
      field[x][y] = p5.Vector.fromAngle(angle);
    }
  }
  
  // Draw the vector field
  stroke(200);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      //drawVector(field[x][y], x * fieldSpacing, y * fieldSpacing, fieldSpacing - 2);
    }
  }
  
  // Create particles
  for (let i = 0; i < numberOfParticles; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function draw() {
  // Slightly clear the background to create a fading trail effect
  // background(255, 255, 255, 0.5);
  
  for (let particle of particles) {
    particle.follow(field);
    particle.update();
    particle.show();
    particle.edges();
  }
}

function drawVector(v, x, y, scale) {
  push();
  translate(x, y);
  rotate(v.heading());
  stroke(200);
  line(0, 0, scale, 0);
  pop();
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 2;
    this.prevPos = this.pos.copy();
  }
  
  follow(field) {
    let x = floor(this.pos.x / fieldSpacing);
    let y = floor(this.pos.y / fieldSpacing);
    
    // Boundary check to prevent accessing undefined array elements
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      let force = field[x][y];
      this.applyForce(force);
    }
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }
  
  show() {
    // Draw the particle
    // fill(0, 150);
    // noStroke();
    // ellipse(this.pos.x, this.pos.y, 4, 4);
    
    // Draw the trail
    stroke(0);
    strokeWeight(2);
    line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
    
    this.prevPos = this.pos.copy();
  }
  
  edges() {
    if (this.pos.x > width) {
      this.pos.x = 0;
      this.prevPos.x = this.pos.x;
    }
    if (this.pos.x < 0) {
      this.pos.x = width;
      this.prevPos.x = this.pos.x;
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
      this.prevPos.y = this.pos.y;
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
      this.prevPos.y = this.pos.y;
    }
  }
}