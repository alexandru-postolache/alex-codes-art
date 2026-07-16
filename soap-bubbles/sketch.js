const MAX_BUBBLES = 64;

let bubbleShader;
let parkBackground;
let mic;
let amp;
let audioReady = false;

let bubbles = [];
let blowLevel = 0;
let smoothedBlow = 0;
let spawnAccumulator = 0;

const params = {
  blowThreshold: 0.045,
  blowSensitivity: 14,
  spawnRate: 14,
  minRadius: 38,
  maxRadius: 110,
  riseSpeed: 2.4,
  drift: 0.55,
};

function preload() {
  bubbleShader = loadShader("shader.vert", "bubble.frag");
  parkBackground = loadImage("assets/park-bg.jpg");
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  noStroke();

  createMeter();

  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", startAudio);
}

function startAudio() {
  if (audioReady) {
    return;
  }

  userStartAudio().then(() => {
    mic = new p5.AudioIn();
    mic.start(
      () => {
        amp = new p5.Amplitude();
        amp.setInput(mic);
        amp.smooth(0.85);
        audioReady = true;
        document.getElementById("overlay").classList.add("hidden");
      },
      () => {
        document.querySelector(".card p").textContent =
          "Microphone access was blocked. Please allow the mic and refresh.";
      }
    );
  });
}

function draw() {
  if (audioReady && amp) {
    updateBlow();
    spawnBubbles();
  }

  updateBubbles();

  shader(bubbleShader);
  bubbleShader.setUniform("u_resolution", [width, height]);
  bubbleShader.setUniform("u_time", millis() / 1000);
  bubbleShader.setUniform("u_bubbleCount", bubbles.length);
  bubbleShader.setUniform("u_bubbles", packBubbleUniforms());
  bubbleShader.setUniform("u_wand", wandPosition());
  bubbleShader.setUniform("u_blow", smoothedBlow);
  bubbleShader.setUniform("u_background", parkBackground);

  plane(width, height);
  updateMeter();
}

function updateBlow() {
  const raw = amp.getLevel() * params.blowSensitivity;
  smoothedBlow = lerp(smoothedBlow, raw, 0.35);
  blowLevel = max(0, smoothedBlow - params.blowThreshold);
}

function spawnBubbles() {
  if (blowLevel <= 0) {
    spawnAccumulator = 0;
    return;
  }

  const wand = wandPosition();
  const scale = min(width, height);
  const strength = map(blowLevel, 0, 0.5, 0, 1, true);
  spawnAccumulator += params.spawnRate * strength * (deltaTime / 1000);

  while (spawnAccumulator >= 1 && bubbles.length < MAX_BUBBLES) {
    spawnAccumulator -= 1;

    const radius = random(params.minRadius, params.maxRadius) * (0.65 + strength * 0.55);
    const spread = map(strength, 0, 1, scale * 0.04, scale * 0.14);
    const angle = random(PI * 0.15, PI * 0.85);
    const spawnDist = random(scale * 0.08, scale * 0.17);

    bubbles.push(
      new Bubble(
        wand[0] + cos(angle) * spawnDist + random(-spread * 0.2, spread * 0.2),
        wand[1] + sin(angle) * spawnDist * 0.35 + random(0, scale * 0.04),
        radius,
        strength
      )
    );
  }
}

function updateBubbles() {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].update();
    if (bubbles[i].isDead()) {
      bubbles.splice(i, 1);
    }
  }

  bubbles.sort((a, b) => a.y - b.y);
}

function packBubbleUniforms() {
  const packed = new Array(MAX_BUBBLES * 4).fill(0);

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const index = i * 4;
    packed[index] = b.x;
    packed[index + 1] = b.y;
    packed[index + 2] = b.radius;
    packed[index + 3] = b.life;
  }

  return packed;
}

function wandPosition() {
  return [width * 0.5, height * 0.38];
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

function createMeter() {
  const meter = document.createElement("div");
  meter.id = "meter";
  meter.innerHTML = `
    <div>Blow strength</div>
    <div class="bar"><div class="fill"></div></div>
  `;
  document.body.appendChild(meter);
}

function updateMeter() {
  const fill = document.querySelector("#meter .fill");
  if (!fill) {
    return;
  }

  const amount = audioReady ? min(100, blowLevel * 220) : 0;
  fill.style.width = `${amount}%`;
}

class Bubble {
  constructor(x, y, radius, strength) {
    this.x = x;
    this.y = y;
    this.baseRadius = radius;
    this.radius = radius;
    this.life = 1;
    this.wobble = random(TWO_PI);
    this.wobbleSpeed = random(0.02, 0.05);

    const launch = map(strength, 0, 1, 1.5, 5.5);
    this.vx = random(-params.drift, params.drift) * strength;
    this.vy = launch * params.riseSpeed;
  }

  update() {
    const wand = wandPosition();
    this.wobble += this.wobbleSpeed;
    this.x += this.vx + sin(this.wobble) * 0.55;
    this.y += this.vy;

    this.vy -= 0.008;
    this.vx *= 0.996;
    this.vy *= 0.999;

    const depth = map(this.y, wand[1], height * 0.98, 0, 1, true);
    this.radius = this.baseRadius * (1.0 - depth * 0.5);
    this.radius += sin(this.wobble * 1.7) * 0.08;

    if (this.y > height + this.radius * 2) {
      this.life = 0;
    }

    if (this.y > height * 0.82) {
      this.life -= 0.004;
    }
  }

  isDead() {
    return this.life <= 0 || this.radius < 2;
  }
}
