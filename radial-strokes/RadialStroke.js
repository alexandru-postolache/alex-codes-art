class RadialStroke {
  constructor(x, y, distance, angleStart, angleFinish, color, weight, movementDirection, movementSpeed) {
    this.x = x;
    this.y = y;
    this.distance = distance;
    this.angleStart = angleStart;
    this.angleFinish = angleFinish;
    this.color = color;
    this.weight = weight;
    this.movementDirection = movementDirection;
    this.movementSpeed = movementSpeed;
    this.currentOffset = 0;
  }
  
  draw() {
    stroke(this.color);
    strokeWeight(this.weight);
    if (this.angleStart > this.angleFinish) {
      let newStart = this.angleFinish;
      this.angleFinish = this.angleStart;
      this.angleStart = newStart;
    }

    beginShape();
    for (let i = this.angleStart; i <= this.angleFinish; i++) {
      let a = map(i, 0, 360, 0, TWO_PI);
      
      let newX = this.x + cos(a + this.currentOffset) * this.distance;
      let newY = this.y + sin(a + this.currentOffset) * this.distance;

      vertex(newX, newY);
    }
    endShape();
    
    if (this.movementDirection == 0) {
      this.currentOffset += this.movementSpeed;
    }else {
      this.currentOffset -= this.movementSpeed;
    }
  }
}