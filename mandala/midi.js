const midiEngine = {
  access: null,
  inputCount: 0,
  voices: [],
  nextVoiceId: 1,
  lastNote: null,
  lastVelocity: 0,
  status: "idle",

  // QWERTY drum-pad layout (General MIDI note numbers).
  keyboardBindings: {
    z: 36, // kick
    x: 38, // snare
    a: 43, // low tom
    s: 40, // rim / alt snare
    d: 45, // mid tom
    f: 47, // high tom
    g: 48, // floor tom
    q: 49, // crash
    w: 46, // open hi-hat
    e: 42, // closed hi-hat
    r: 51, // ride
    t: 52, // china
    y: 55, // splash
    u: 57  // crash 2
  },

  setParams(params) {
    this.params = params;
    this.refreshStatus();
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
    this.refreshStatus();
  },

  handleMessage(event) {
    if (!this.params || !this.params.midiEnabled) return;

    let [status, note, velocity] = event.data;
    let command = status & 0xf0;
    if (command !== 0x90 || velocity === 0) return;

    this.noteOn(note, velocity, "hardware");
  },

  handleKeyboardPress(key, modifiers = {}) {
    if (!this.params || !this.params.midiEnabled || !this.params.midiKeyboardEnabled) {
      return false;
    }

    let note = this.keyboardBindings[key.toLowerCase()];
    if (note === undefined) return false;

    let velocity = modifiers.shiftKey ? 127 : floor(random(88, 112));
    this.noteOn(note, velocity, "keyboard");
    return true;
  },

  noteOn(note, velocity, source) {
    this.lastNote = note;
    this.lastVelocity = velocity;
    this.lastSource = source;
    this.spawnVoice(note, velocity);
    this.refreshStatus();
  },

  refreshStatus() {
    let parts = [];
    if (this.inputCount > 0) parts.push("listening");
    if (this.params && this.params.midiKeyboardEnabled) parts.push("keyboard");
    if (parts.length === 0) {
      this.status = this.access ? "no inputs" : "idle";
      return;
    }
    this.status = parts.join(" + ");
  },

  getVoiceStyle(note) {
    if (note === 35 || note === 36) {
      return {
        type: "kick",
        startSpeed: 10,
        endSpeed: 1.4,
        turnRate: 0.15,
        headingKick: random(-20, 20),
        color: { r: 255, g: 80, b: 60 },
        radiusMin: 0.02,
        radiusMax: 0.09
      };
    }
    if (note === 38 || note === 40) {
      return {
        type: "snare",
        startSpeed: 9,
        endSpeed: 0.7,
        turnRate: 1,
        headingKick: random([-120, -90, 90, 120]),
        color: { r: 90, g: 180, b: 255 },
        radiusMin: 0.14,
        radiusMax: 0.24
      };
    }
    if ([41, 43, 45, 47, 48, 50].includes(note)) {
      return {
        type: "tom",
        startSpeed: 8,
        endSpeed: 0.9,
        turnRate: 0.7,
        headingKick: random([-65, -40, 40, 65]),
        color: { r: 120, g: 255, b: 140 },
        radiusMin: 0.22,
        radiusMax: 0.36
      };
    }
    if ([42, 44, 46].includes(note)) {
      return {
        type: "hat",
        startSpeed: 6,
        endSpeed: 0.25,
        turnRate: 1.2,
        headingKick: random(-30, 30),
        color: { r: 255, g: 245, b: 140 },
        radiusMin: 0.34,
        radiusMax: 0.48
      };
    }
    if ([49, 51, 52, 55, 57, 59].includes(note)) {
      return {
        type: "cymbal",
        startSpeed: 11,
        endSpeed: 1.6,
        turnRate: random([-1, 1]) * 0.8,
        headingKick: random([-150, -110, 110, 150]),
        color: { r: 210, g: 120, b: 255 },
        radiusMin: 0.52,
        radiusMax: 0.72
      };
    }

    return {
      type: "other",
      startSpeed: 7,
      endSpeed: 0.9,
      turnRate: 0.5,
      headingKick: random(-90, 90),
      color: { r: 255, g: 200, b: 110 },
      radiusMin: 0.26,
      radiusMax: 0.42
    };
  },

  velocityNorm(velocity) {
    return constrain(velocity / 127, 0, 1);
  },

  colorWithVelocity(color, vNorm) {
    let brightness = lerp(0.32, 1, vNorm);
    return {
      r: min(255, color.r * brightness),
      g: min(255, color.g * brightness),
      b: min(255, color.b * brightness)
    };
  },

  radialSpawnPosition(voice, context) {
    let half = min(context.width, context.height) / 2;
    let radiusFrac = random(voice.radiusMin, voice.radiusMax);
    let angle = voice.spawnAngle;
    let r = half * radiusFrac;
    return createVector(cos(angle) * r, sin(angle) * r);
  },

  getTypeWeightMult(type) {
    switch (type) {
      case "kick": return 1.75;
      case "snare": return 1.05;
      case "tom": return 1.15;
      case "hat": return 0.38;
      case "cymbal": return 0.9;
      default: return 1;
    }
  },

  applyBounds(voice, halfW, halfH) {
    let bounced = false;

    if (voice.pos.x < -halfW || voice.pos.x > halfW) {
      voice.heading = 180 - voice.heading;
      voice.pos.x = constrain(voice.pos.x, -halfW, halfW);
      bounced = true;
    }
    if (voice.pos.y < -halfH || voice.pos.y > halfH) {
      voice.heading = -voice.heading;
      voice.pos.y = constrain(voice.pos.y, -halfH, halfH);
      bounced = true;
    }

    if (bounced && voice.type === "tom") {
      voice.heading += random(-35, 35);
      voice.bounceBoost = 1.45;
    }

    return bounced;
  },

  advanceKick(voice, step, now) {
    voice.heading = voice.spawnAngle + map(
      noise(now * 0.001 + voice.id),
      0,
      1,
      -5,
      5
    );
    voice.pos.x += cos(voice.heading) * step;
    voice.pos.y += sin(voice.heading) * step;
  },

  advanceSnare(voice, step, now) {
    if (voice.zigNextMs === undefined) {
      voice.zigNextMs = now;
      voice.zigSign = random([-1, 1]);
    }
    if (now >= voice.zigNextMs) {
      voice.heading += voice.zigSign * random(78, 118);
      voice.zigSign *= -1;
      voice.zigNextMs = now + random(30, 70);
    }
    voice.pos.x += cos(voice.heading) * step;
    voice.pos.y += sin(voice.heading) * step;
  },

  advanceTom(voice, step, now) {
    let boost = voice.bounceBoost || 1;
    voice.bounceBoost = lerp(boost, 1, 0.18);
    voice.heading += sin(now * 0.03 + voice.id) * 2.5;
    voice.pos.x += cos(voice.heading) * step * boost;
    voice.pos.y += sin(voice.heading) * step * boost;
  },

  advanceHat(voice, step, now) {
    voice.heading += map(
      noise(now * 0.05 + voice.id * 2.7),
      0,
      1,
      -1,
      1
    ) * 62;
    let scratch = step * 0.42;
    voice.pos.x += cos(voice.heading) * scratch;
    voice.pos.y += sin(voice.heading) * scratch;
  },

  advanceCymbal(voice, step, now) {
    if (voice.orbitRadius === undefined) {
      voice.orbitAngle = voice.spawnAngle;
      voice.orbitRadius = max(8, voice.pos.mag());
      voice.orbitDir = voice.turnRate >= 0 ? 1 : -1;
    }

    voice.orbitAngle += voice.orbitDir * (2.4 + voice.turnRate);
    voice.orbitRadius += step * 0.14;
    voice.pos.x = cos(voice.orbitAngle) * voice.orbitRadius;
    voice.pos.y = sin(voice.orbitAngle) * voice.orbitRadius;
  },

  advanceOther(voice, step, now) {
    voice.heading += map(
      noise(now * 0.002 + voice.id),
      0,
      1,
      -1,
      1
    ) * voice.turnRate * 2;
    voice.pos.x += cos(voice.heading) * step;
    voice.pos.y += sin(voice.heading) * step;
  },

  advanceVoice(voice, step, now) {
    switch (voice.type) {
      case "kick": this.advanceKick(voice, step, now); break;
      case "snare": this.advanceSnare(voice, step, now); break;
      case "tom": this.advanceTom(voice, step, now); break;
      case "hat": this.advanceHat(voice, step, now); break;
      case "cymbal": this.advanceCymbal(voice, step, now); break;
      default: this.advanceOther(voice, step, now); break;
    }
  },

  spawnVoice(note, velocity) {
    let vNorm = this.velocityNorm(velocity);
    let holdMs = this.params.midiPatternHoldMs * (0.75 + 0.6 * vNorm);
    let style = this.getVoiceStyle(note);
    let now = millis();
    let spawnAngle = (note * 41 + this.nextVoiceId * 17) % 360;
    let heading = style.type === "kick"
      ? spawnAngle
      : random(360) + style.headingKick;

    this.voices.push({
      id: this.nextVoiceId++,
      note,
      velocity,
      vNorm,
      type: style.type,
      color: style.color,
      radiusMin: style.radiusMin,
      radiusMax: style.radiusMax,
      spawnAngle,
      heading,
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
    let speedScale = (voice) => lerp(0.38, 1.15, voice.vNorm);

    for (let voice of this.voices) {
      if (!voice.pos) {
        voice.pos = this.radialSpawnPosition(voice, context);
        voice.prev = voice.pos.copy();
        voice.current = voice.pos.copy();
      }

      let life = max(1, voice.untilMs - voice.startMs);
      let phase = constrain((now - voice.startMs) / life, 0, 1);
      let eased = 1 - pow(phase, 1.5);
      let step = lerp(voice.endSpeed, voice.startSpeed, eased) * speedScale(voice);

      this.advanceVoice(voice, step, now);

      let halfW = context.width / 2;
      let halfH = context.height / 2;
      if (voice.type !== "cymbal") {
        this.applyBounds(voice, halfW, halfH);
      } else {
        let maxOrbit = min(halfW, halfH) * 0.88;
        if (voice.orbitRadius > maxOrbit) {
          voice.orbitRadius = maxOrbit;
          voice.orbitDir *= -1;
        }
      }

      voice.current.lerp(voice.pos, context.params.smoothing);
      let length = p5.Vector.dist(voice.prev, voice.current);
      if (length < context.params.minSegmentLength) continue;

      let weight = map(length, 0, 10, context.params.thicknessMax, 1, true);
      weight *= this.getTypeWeightMult(voice.type);
      segments.push({
        x1: voice.prev.x,
        y1: voice.prev.y,
        x2: voice.current.x,
        y2: voice.current.y,
        weight,
        color: this.colorWithVelocity(voice.color, voice.vNorm)
      });
      voice.prev = voice.current.copy();
    }

    return segments;
  },

  drawDebugHud() {
    let noteText = this.lastNote === null ? "-" : this.lastNote;
    let velText = this.lastNote === null ? "-" : this.lastVelocity;
    let sourceText = this.lastSource || "-";
    let enabledText = this.params && this.params.midiEnabled ? "on" : "off";
    let keyboardText = this.params && this.params.midiKeyboardEnabled ? "on" : "off";
    let hudHeight = this.params && this.params.midiKeyboardEnabled ? 130 : 94;

    push();
    noStroke();
    fill(0, 150);
    rect(12, 12, 320, hudHeight, 8);
    fill(255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(`MIDI: ${this.status}`, 20, 20);
    text(`Enabled: ${enabledText}  Inputs: ${this.inputCount}  Keys: ${keyboardText}`, 20, 38);
    text(`Last note: ${noteText}  vel: ${velText}  src: ${sourceText}`, 20, 56);
    text(`Active voices: ${this.voices.length}`, 20, 74);
    if (this.params && this.params.midiKeyboardEnabled) {
      text("Keys: Z kick  X snare  ASDFG toms  QWE ride/hats  RTY cymbals", 20, 92);
      text("Hold Shift for accent (velocity 127)", 20, 110);
    }
    pop();
  }
};
