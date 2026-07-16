const MAX_BUBBLES = 64;

let bgShader;
let blurShader;
let sceneShader;
let parkBackground;

let sharpBuffer;
let blurPassBuffer;
let blurredBuffer;
let bgShaderBuffer;
let blurShaderPassBuffer;
let blurShaderBlurredBuffer;

let mic;
let amp;
let audioReady = false;

let bubbles = [];
let blowLevel = 0;
let smoothedBlow = 0;
let spawnAccumulator = 0;

const params = {
  blowThreshold: 0.035,
  blowSensitivity: 16,
  spawnRate: 12,
  minRadius: 28,
  maxRadius: 88,
  riseSpeed: 2.8,
  drift: 0.45,
};

function preload() {
  bgShader = loadShader("shader.vert", "background.frag");
  blurShader = loadShader("shader.vert", "blur.frag");
  sceneShader = loadShader("shader.vert", "scene.frag");
  parkBackground = loadImage("assets/park-bg.jpg");
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  noStroke();

  initBuffers();
  createMeter();

  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", startAudio);
}

function initBuffers() {
  sharpBuffer = createGraphics(width, height, WEBGL);
  blurPassBuffer = createGraphics(width, height, WEBGL);
  blurredBuffer = createGraphics(width, height, WEBGL);

  for (const buffer of [sharpBuffer, blurPassBuffer, blurredBuffer]) {
    buffer.noStroke();
    buffer.pixelDensity(pixelDensity());
  }

  if (bgShader && blurShader) {
    bgShaderBuffer = bgShader.copyToContext(sharpBuffer);
    blurShaderPassBuffer = blurShader.copyToContext(blurPassBuffer);
    blurShaderBlurredBuffer = blurShader.copyToContext(blurredBuffer);
  }
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
        amp.smooth(0.88);
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
  renderBackgroundPasses();
  renderScene();
  updateMeter();
}

function renderBackgroundPasses() {
  const imageAspect = parkBackground.width / parkBackground.height;

  sharpBuffer.shader(bgShaderBuffer);
  bgShaderBuffer.setUniform("u_resolution", [width, height]);
  bgShaderBuffer.setUniform("u_image", parkBackground);
  bgShaderBuffer.setUniform("u_imageAspect", imageAspect);
  sharpBuffer.plane(width, height);

  blurPassBuffer.shader(blurShaderPassBuffer);
  blurShaderPassBuffer.setUniform("u_resolution", [width, height]);
  blurShaderPassBuffer.setUniform("u_image", sharpBuffer);
  blurShaderPassBuffer.setUniform("u_direction", [1.0 / width, 0.0]);
  blurShaderPassBuffer.setUniform("u_blurSize", 4.0);
  blurPassBuffer.plane(width, height);

  blurredBuffer.shader(blurShaderBlurredBuffer);
  blurShaderBlurredBuffer.setUniform("u_resolution", [width, height]);
  blurShaderBlurredBuffer.setUniform("u_image", blurPassBuffer);
  blurShaderBlurredBuffer.setUniform("u_direction", [0.0, 1.0 / height]);
  blurShaderBlurredBuffer.setUniform("u_blurSize", 4.0);
  blurredBuffer.plane(width, height);

  blurPassBuffer.shader(blurShaderPassBuffer);
  blurShaderPassBuffer.setUniform("u_image", blurredBuffer);
  blurShaderPassBuffer.setUniform("u_direction", [1.0 / width, 0.0]);
  blurShaderPassBuffer.setUniform("u_blurSize", 5.5);
  blurPassBuffer.plane(width, height);

  blurredBuffer.shader(blurShaderBlurredBuffer);
  blurShaderBlurredBuffer.setUniform("u_image", blurPassBuffer);
  blurShaderBlurredBuffer.setUniform("u_direction", [0.0, 1.0 / height]);
  blurShaderBlurredBuffer.setUniform("u_blurSize", 5.5);
  blurredBuffer.plane(width, height);
}

function renderScene() {
  shader(sceneShader);
  sceneShader.setUniform("u_resolution", [width, height]);
  sceneShader.setUniform("u_time", millis() / 1000);
  sceneShader.setUniform("u_bubbleCount", bubbles.length);
  sceneShader.setUniform("u_bubbles", packBubbleUniforms());
  sceneShader.setUniform("u_wand", wandPosition());
  sceneShader.setUniform("u_blow", smoothedBlow);
  sceneShader.setUniform("u_sharp", sharpBuffer);
  sceneShader.setUniform("u_blurred", blurredBuffer);
  plane(width, height);
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
  const ringRadius = scale * 0.135;
  const strength = map(blowLevel, 0, 0.5, 0, 1, true);
  spawnAccumulator += params.spawnRate * strength * (deltaTime / 1000);

  while (spawnAccumulator >= 1 && bubbles.length < MAX_BUBBLES) {
    spawnAccumulator -= 1;

    const radius = random(params.minRadius, params.maxRadius) * (0.7 + strength * 0.45);
    const angle = random(PI * 0.25, PI * 0.75);
    const spawnDist = random(ringRadius * 0.35, ringRadius * 0.85);

    bubbles.push(
      new Bubble(
        wand[0] + cos(angle) * spawnDist,
        wand[1] + sin(angle) * spawnDist + random(0, ringRadius * 0.15),
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
  return [width * 0.5, height * 0.26];
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  initBuffers();
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
    this.wobbleSpeed = random(0.015, 0.04);

    const launch = map(strength, 0, 1, 2.0, 6.5);
    this.vx = random(-params.drift, params.drift) * strength;
    this.vy = launch * params.riseSpeed;
  }

  update() {
    const wand = wandPosition();
    this.wobble += this.wobbleSpeed;
    this.x += this.vx + sin(this.wobble) * 0.45;
    this.y += this.vy;

    this.vy -= 0.006;
    this.vx *= 0.997;
    this.vy *= 0.9995;

    const depth = map(this.y, wand[1], height * 0.96, 0, 1, true);
    this.radius = this.baseRadius * (1.0 - depth * 0.45);
    this.radius += sin(this.wobble * 1.5) * 0.06;

    if (this.y > height + this.radius) {
      this.life = 0;
    }

    if (this.y > height * 0.78) {
      this.life -= 0.0035;
    }
  }

  isDead() {
    return this.life <= 0 || this.radius < 3;
  }
}
