const MAX_BUBBLES = 64;
const MAX_POPS = 16;

let sceneShader;
let parkBackground;
let blowerImage;

let mic;
let amp;
let audioReady = false;
let demoMode = false;
let demoBlowing = false;

let bubbles = [];
let pops = [];
let blowLevel = 0;
let smoothedBlow = 0;
let spawnAccumulator = 0;
let noiseFloor = 0.012;
let lastPopAt = 0;

const params = {
  blowThreshold: 0.018,
  blowSensitivity: 12,
  spawnRate: 3.6,
  minRadius: 42,
  maxRadius: 96,
  riseSpeed: 1.9,
  drift: 1.25,
};

function preload() {
  sceneShader = loadShader("shader.vert", "scene.frag");
  parkBackground = loadImage("assets/park-bg.png");
  blowerImage = loadImage("assets/bubble-wand.png");
}

function setup() {
  pixelDensity(1);
  createCanvas(window.innerWidth, window.innerHeight, WEBGL);
  noStroke();

  createMeter();

  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", startAudio);
  document.getElementById("demo-btn").addEventListener("click", startDemo);
  window.addEventListener("pointerdown", popAtPointer);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("keyup", handleKey);
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
        amp.smooth(0.86);
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

function startDemo() {
  demoMode = true;
  audioReady = true;
  document.getElementById("overlay").classList.add("hidden");
}

function handleKey(event) {
  if (event.code !== "Space" || !demoMode) {
    return;
  }

  event.preventDefault();
  demoBlowing = event.type === "keydown";
}

function draw() {
  if (demoMode) {
    const target = demoBlowing ? 0.3 : 0;
    smoothedBlow = lerp(smoothedBlow, target, demoBlowing ? 0.12 : 0.08);
    blowLevel = smoothedBlow;
    spawnBubbles();
  } else if (audioReady && amp) {
    updateBlow();
    spawnBubbles();
  }

  updateBubbles();
  renderScene();
  updatePops();
  updateMeter();
}

function renderScene() {
  shader(sceneShader);
  sceneShader.setUniform("u_resolution", [width, height]);
  sceneShader.setUniform("u_time", millis() / 1000);
  sceneShader.setUniform("u_bubbleCount", bubbles.length);
  sceneShader.setUniform("u_bubbles", packBubbleUniforms());
  sceneShader.setUniform("u_popCount", pops.length);
  sceneShader.setUniform("u_pops", packPopUniforms());
  sceneShader.setUniform("u_wand", wandPosition());
  sceneShader.setUniform("u_blow", smoothedBlow);
  sceneShader.setUniform("u_background", parkBackground);
  sceneShader.setUniform("u_blower", blowerImage);
  sceneShader.setUniform(
    "u_imageAspect",
    parkBackground.width / parkBackground.height
  );
  plane(width, height);
}

function updateBlow() {
  const raw = amp.getLevel();
  if (raw < noiseFloor * 1.8) {
    noiseFloor = lerp(noiseFloor, raw, 0.012);
  }

  const normalized = max(0, raw - noiseFloor - params.blowThreshold);
  smoothedBlow = lerp(smoothedBlow, normalized * params.blowSensitivity, 0.28);
  blowLevel = constrain(smoothedBlow, 0, 1);
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

    const radius =
      random(params.minRadius, params.maxRadius) * (0.78 + strength * 0.34);
    const angle = random(PI * 0.27, PI * 0.73);
    const spawnDist = random(ringRadius * 0.42, ringRadius * 0.85);

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
    if (bubbles[i].shouldPop()) {
      popBubble(i);
    } else if (bubbles[i].isDead()) {
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

function packPopUniforms() {
  const packed = new Array(MAX_POPS * 4).fill(0);

  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    const index = i * 4;
    packed[index] = pop.x;
    packed[index + 1] = pop.y;
    packed[index + 2] = pop.radius;
    packed[index + 3] = pop.progress;
  }

  return packed;
}

function wandPosition() {
  return [width * 0.5, height * 0.355];
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

function createMeter() {
  const meter = document.createElement("div");
  meter.id = "meter";
  meter.innerHTML = `
    <div class="meter-label"><span>Breath</span><span class="meter-state">ready</span></div>
    <div class="bar"><div class="fill"></div></div>
    <div class="meter-tip">Blow steadily · hold Space in preview · tap to pop</div>
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

  const state = document.querySelector("#meter .meter-state");
  if (state) {
    state.textContent = blowLevel > 0.025 ? "blowing" : "ready";
  }
}

function popAtPointer(event) {
  if (!audioReady) {
    return;
  }

  const pointerX = event.clientX;
  const pointerY = height - event.clientY;
  let nearest = -1;
  let nearestDistance = Infinity;

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const distance = dist(pointerX, pointerY, b.x, b.y);
    if (distance < b.radius * 1.75 && distance < nearestDistance) {
      nearest = i;
      nearestDistance = distance;
    }
  }

  if (nearest >= 0) {
    popBubble(nearest);
  }
}

function popBubble(index) {
  const bubble = bubbles[index];
  if (!bubble) {
    return;
  }

  if (pops.length >= MAX_POPS) {
    pops.shift();
  }
  pops.push(new BubblePop(bubble.x, bubble.y, bubble.radius));
  bubbles.splice(index, 1);
  playPopSound(bubble.radius);
}

function updatePops() {
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].update();
    if (pops[i].progress >= 1) {
      pops.splice(i, 1);
    }
  }
}

function playPopSound(radius) {
  if (!audioReady || millis() - lastPopAt < 35) {
    return;
  }
  lastPopAt = millis();

  const context = getAudioContext();
  const duration = 0.055;
  const length = floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const envelope = pow(1 - i / length, 5);
    data[i] = random(-1, 1) * envelope;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "bandpass";
  filter.frequency.value = map(radius, params.minRadius, params.maxRadius, 2600, 900, true);
  filter.Q.value = 0.8;
  gain.gain.value = 0.12;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
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
    this.age = 0;
    this.popAge = random(320, 650);
    this.popChance = random(0.001, 0.004);

    const launch = map(strength, 0, 1, 2.5, 4.8);
    this.vx = random(-params.drift, params.drift) * (0.45 + strength);
    this.vy = launch * params.riseSpeed;
  }

  update() {
    const wand = wandPosition();
    this.age++;
    this.wobble += this.wobbleSpeed;
    this.x += this.vx + sin(this.wobble) * 0.52;
    this.y += this.vy;

    this.vy += 0.012;
    this.vx += noise(this.age * 0.006, this.wobble) * 0.018 - 0.009;
    this.vx *= 0.998;
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

  shouldPop() {
    const oldEnough = this.age > 140;
    return (
      this.y > height * 0.9 ||
      (oldEnough && this.age > this.popAge && random() < this.popChance)
    );
  }

  isDead() {
    return this.life <= 0 || this.radius < 3;
  }
}

class BubblePop {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.progress = 0;
  }

  update() {
    this.progress += 0.026 * (deltaTime / 16.67);
  }
}
