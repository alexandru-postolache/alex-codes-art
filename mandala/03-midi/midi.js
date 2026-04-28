const midiEngine = {
  access: null,
  inputCount: 0,
  voices: [],
  nextVoiceId: 1,
  lastNote: null,
  lastVelocity: 0,
  status: "idle",

  setParams(params) {
    this.params = params;
  },

  init() {
    if (!navigator.requestMIDIAccess) {
      this.status = "Web MIDI unavailable";
      return;
    }

    navigator.requestMIDIAccess()
      .then((access) => {
        this.access = access;
        this.access.onstatechange = () => this.refreshInputs();
        this.refreshInputs();
        this.status = "connected";
      })
      .catch((err) => {
        this.status = "midi error";
        console.log("MIDI access failed:", err);
      });
  },

  refreshInputs() {
    if (!this.access) return;
    this.inputCount = 0;
    for (let input of this.access.inputs.values()) {
      input.onmidimessage = (event) => this.handleMessage(event);
      this.inputCount++;
    }
    this.status = this.inputCount > 0 ? "listening" : "no inputs";
  },

  handleMessage(event) {
    if (!this.params || !this.params.midiEnabled) return;

    let [status, note, velocity] = event.data;
    let command = status & 0xf0;
    if (command !== 0x90 || velocity === 0) return;

    this.lastNote = note;
    this.lastVelocity = velocity;
    this.spawnVoice(note, velocity);
  },

  getVoiceStyle(note, vNorm) {
    if (note === 35 || note === 36) {
      return {
        type: "kick",
        startSpeed: 8 + 10 * vNorm,
        endSpeed: 1.2 + 0.8 * vNorm,
        turnRate: 0.15,
        headingKick: random(-20, 20),
        color: { r: 255, g: 80, b: 60 }
      };
    }
    if (note === 38 || note === 40) {
      return {
        type: "snare",
        startSpeed: 6 + 8 * vNorm,
        endSpeed: 0.6,
        turnRate: 1,
        headingKick: random([-120, -90, 90, 120]),
        color: { r: 90, g: 180, b: 255 }
      };
    }
    if ([41, 43, 45, 47, 48, 50].includes(note)) {
      return {
        type: "tom",
        startSpeed: 7 + 7 * vNorm,
        endSpeed: 0.8,
        turnRate: 0.7,
        headingKick: random([-65, -40, 40, 65]),
        color: { r: 120, g: 255, b: 140 }
      };
    }
    if ([42, 44, 46].includes(note)) {
      return {
        type: "hat",
        startSpeed: 4 + 5 * vNorm,
        endSpeed: 0.2,
        turnRate: 1.2,
        headingKick: random(-30, 30),
        color: { r: 255, g: 245, b: 140 }
      };
    }
    if ([49, 51, 52, 55, 57, 59].includes(note)) {
      return {
        type: "cymbal",
        startSpeed: 9 + 7 * vNorm,
        endSpeed: 1.5,
        turnRate: random([-1, 1]) * 0.8,
        headingKick: random([-150, -110, 110, 150]),
        color: { r: 210, g: 120, b: 255 }
      };
    }

    return {
      type: "other",
      startSpeed: 6 + 7 * vNorm,
      endSpeed: 0.8,
      turnRate: 0.5,
      headingKick: random(-90, 90),
      color: { r: 255, g: 200, b: 110 }
    };
  },

  spawnVoice(note, velocity) {
    let vNorm = constrain(velocity / 127, 0, 1);
    let holdMs = this.params.midiPatternHoldMs * (0.75 + 0.6 * vNorm);
    let style = this.getVoiceStyle(note, vNorm);
    let now = millis();

    this.voices.push({
      id: this.nextVoiceId++,
      note,
      velocity,
      type: style.type,
      color: style.color,
      heading: random(360) + style.headingKick,
      startSpeed: style.startSpeed,
      endSpeed: style.endSpeed,
      turnRate: style.turnRate,
      startMs: now,
      untilMs: now + holdMs,
      pos: null,
      prev: null,
      current: null
    });
  },

  isActive() {
    return !!(this.params && this.params.midiEnabled && this.voices.length > 0);
  },

  updateVisuals() {
    // No-op for now; kept for API compatibility.
  },

  getStrokeColor(baseColor) {
    return { r: baseColor.r, g: baseColor.g, b: baseColor.b };
  },

  pruneExpiredVoices() {
    let now = millis();
    this.voices = this.voices.filter((voice) => now <= voice.untilMs);
  },

  getSegments(context) {
    if (!this.params || !this.params.midiEnabled) return [];

    this.pruneExpiredVoices();
    if (this.voices.length === 0) return [];

    let segments = [];
    let now = millis();
    let anchor = context.current.mag() === 0 && context.prev.mag() === 0
      ? createVector(context.mouseX - context.width / 2, context.mouseY - context.height / 2)
      : context.current.copy();

    for (let voice of this.voices) {
      if (!voice.pos) {
        voice.pos = anchor.copy();
        voice.pos.x += random(-14, 14);
        voice.pos.y += random(-14, 14);
        voice.prev = voice.pos.copy();
        voice.current = voice.pos.copy();
      }

      let life = max(1, voice.untilMs - voice.startMs);
      let phase = constrain((now - voice.startMs) / life, 0, 1);
      let eased = 1 - pow(phase, 1.5);
      let step = lerp(voice.endSpeed, voice.startSpeed, eased);

      if (voice.type === "kick") {
        voice.heading += map(noise(now * 0.0008 + voice.id), 0, 1, -2, 2) * voice.turnRate;
      } else if (voice.type === "snare") {
        voice.heading += sin(now * 0.07 + voice.id) * voice.turnRate * 9;
      } else if (voice.type === "tom") {
        voice.heading += sin(now * 0.02 + voice.id) * voice.turnRate * 4.5;
      } else if (voice.type === "hat") {
        voice.heading += map(noise(now * 0.015 + voice.id), 0, 1, -1, 1) * voice.turnRate * 14;
        step *= 1 + 0.2 * sin(now * 0.16 + voice.id);
      } else if (voice.type === "cymbal") {
        voice.heading += voice.turnRate * 1.2;
        step *= 1 + 0.25 * sin(now * 0.01 + voice.id);
      } else {
        voice.heading += map(noise(now * 0.002 + voice.id), 0, 1, -1, 1) * voice.turnRate * 2;
      }

      voice.pos.x += cos(voice.heading) * step;
      voice.pos.y += sin(voice.heading) * step;

      let halfW = context.width / 2;
      let halfH = context.height / 2;
      if (voice.pos.x < -halfW || voice.pos.x > halfW) {
        voice.heading = 180 - voice.heading;
        voice.pos.x = constrain(voice.pos.x, -halfW, halfW);
      }
      if (voice.pos.y < -halfH || voice.pos.y > halfH) {
        voice.heading = -voice.heading;
        voice.pos.y = constrain(voice.pos.y, -halfH, halfH);
      }

      voice.current.lerp(voice.pos, context.params.smoothing);
      let length = p5.Vector.dist(voice.prev, voice.current);
      if (length < context.params.minSegmentLength) continue;

      let weight = map(length, 0, 10, context.params.thicknessMax, 1, true);
      segments.push({
        x1: voice.prev.x,
        y1: voice.prev.y,
        x2: voice.current.x,
        y2: voice.current.y,
        weight,
        color: voice.color
      });
      voice.prev = voice.current.copy();
    }

    return segments;
  },

  drawDebugHud() {
    let noteText = this.lastNote === null ? "-" : this.lastNote;
    let velText = this.lastNote === null ? "-" : this.lastVelocity;
    let enabledText = this.params && this.params.midiEnabled ? "on" : "off";

    push();
    noStroke();
    fill(0, 150);
    rect(12, 12, 290, 94, 8);
    fill(255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(`MIDI: ${this.status}`, 20, 20);
    text(`Enabled: ${enabledText}  Inputs: ${this.inputCount}`, 20, 38);
    text(`Last note: ${noteText}  vel: ${velText}`, 20, 56);
    text(`Active voices: ${this.voices.length}`, 20, 74);
    pop();
  }
};
