const midiEngine = {
  access: null,
  inputCount: 0,
  voices: [],
  nextVoiceId: 1,
  lastNote: null,
  lastVelocity: 0,
  lastSource: null,
  status: "idle",
  nextPianoColorKey: 1,

  keyboardBindings: {
    z: 36,
    x: 38,
    a: 43,
    s: 40,
    d: 45,
    f: 47,
    g: 48,
    q: 49,
    w: 46,
    e: 42,
    r: 51,
    t: 52,
    y: 55,
    u: 57
  },

  setParams(params) {
    this.params = params;
    this.refreshStatus();
  },

  isDrumMode() {
    return !!(this.params && this.params.midiMode === "drums");
  },

  isPianoMode() {
    return !!(this.params && this.params.midiMode === "piano");
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

    if (command === 0x90 && velocity > 0) {
      this.noteOn(note, velocity, "hardware");
      return;
    }

    if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.noteOff(note, "hardware");
    }
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

  handleKeyboardRelease(key) {
    if (!this.params || !this.params.midiEnabled || !this.params.midiKeyboardEnabled) {
      return false;
    }

    let note = this.keyboardBindings[key.toLowerCase()];
    if (note === undefined) return false;

    if (this.isPianoMode()) {
      this.noteOff(note, "keyboard");
    }

    return true;
  },

  noteOn(note, velocity, source) {
    this.lastNote = note;
    this.lastVelocity = velocity;
    this.lastSource = source;

    if (this.isPianoMode()) {
      this.endVoicesForNote(note);
    }

    this.spawnVoice(note, velocity);
    this.refreshStatus();
  },

  noteOff(note, source) {
    if (!this.isPianoMode()) return;

    this.lastNote = note;
    this.lastSource = source;
    this.endVoicesForNote(note);
    this.refreshStatus();
  },

  endVoicesForNote(note) {
    for (let voice of this.voices) {
      if (voice.note === note && voice.holdUntilNoteOff) {
        voice.held = false;
      }
    }
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

  velocityNorm(velocity) {
    return constrain(velocity / 127, 0, 1);
  },

  noteRadiusFrac(note) {
    return map(constrain(note, 0, 127), 0, 127, 0.02, 0.9);
  },

  notePaletteKey(note) {
    return constrain(floor(map(note, 0, 127, 1, 9)), 1, 9);
  },

  nextPianoColor() {
    let key = this.nextPianoColorKey;
    this.nextPianoColorKey = key >= 9 ? 1 : key + 1;
    return this.params.multiLineColors[`k${key}`];
  },

  noteColor(note) {
    let key = this.notePaletteKey(note);
    return this.params.multiLineColors[`k${key}`];
  },

  drumPaletteKey(type) {
    switch (type) {
      case "kick": return 1;
      case "snare": return 2;
      case "tom": return 3;
      case "hat": return 4;
      case "cymbal": return 5;
      default: return 6;
    }
  },

  drumColor(type) {
    let key = this.drumPaletteKey(type);
    return this.params.multiLineColors[`k${key}`];
  },

  getDrumProfile(note) {
    let type = "other";
    let radiusMin = 0.26;
    let radiusMax = 0.42;

    if (note === 35 || note === 36) {
      type = "kick";
      radiusMin = 0.02;
      radiusMax = 0.09;
    } else if (note === 38 || note === 40) {
      type = "snare";
      radiusMin = 0.14;
      radiusMax = 0.24;
    } else if ([41, 43, 45, 47, 48, 50].includes(note)) {
      type = "tom";
      radiusMin = 0.22;
      radiusMax = 0.36;
    } else if ([42, 44, 46].includes(note)) {
      type = "hat";
      radiusMin = 0.34;
      radiusMax = 0.48;
    } else if ([49, 51, 52, 55, 57, 59].includes(note)) {
      type = "cymbal";
      radiusMin = 0.52;
      radiusMax = 0.72;
    }

    return {
      type,
      label: type,
      color: this.drumColor(type),
      radiusMin,
      radiusMax
    };
  },

  resolveVoiceStyle(note) {
    if (this.isDrumMode()) {
      return this.getDrumProfile(note);
    }

    return {
      type: "piano",
      label: "piano",
      color: this.nextPianoColor(),
      radiusFrac: this.noteRadiusFrac(note)
    };
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
    let radiusFrac = voice.radiusFrac !== undefined
      ? voice.radiusFrac
      : random(voice.radiusMin, voice.radiusMax);
    let r = half * radiusFrac;
    return createVector(cos(voice.spawnAngle) * r, sin(voice.spawnAngle) * r);
  },

  ensureVoiceLineStates(context) {
    if (!context.createCurvyLineState) return;

    for (let voice of this.voices) {
      if (voice.lineState) continue;

      voice.lineState = context.createCurvyLineState();
      let spawnPos = this.radialSpawnPosition(voice, context);
      voice.lineState.curvyPos.set(spawnPos);
      voice.lineState.prev.set(spawnPos);
      voice.lineState.current.set(spawnPos);
    }
  },

  spawnVoice(note, velocity) {
    let vNorm = this.velocityNorm(velocity);
    let style = this.resolveVoiceStyle(note);
    let now = millis();
    let spawnAngle = (note * 41 + this.nextVoiceId * 17) % 360;
    let holdUntilNoteOff = this.isPianoMode();
    let untilMs = null;

    if (this.isDrumMode()) {
      let holdMs = this.params.midiPatternHoldMs * (0.75 + 0.6 * vNorm);
      untilMs = now + holdMs;
    }

    this.voices.push({
      id: this.nextVoiceId++,
      note,
      velocity,
      vNorm,
      spawnAngle,
      drumType: style.type,
      drumLabel: style.label,
      color: style.color,
      radiusFrac: style.radiusFrac,
      radiusMin: style.radiusMin,
      radiusMax: style.radiusMax,
      holdUntilNoteOff,
      held: holdUntilNoteOff,
      lineState: null,
      justStarted: true,
      startMs: now,
      untilMs
    });
  },

  getActiveLineStates() {
    return this.voices
      .filter((voice) => voice.lineState)
      .map((voice) => voice.lineState);
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
    this.voices = this.voices.filter((voice) => {
      if (voice.holdUntilNoteOff) {
        return voice.held;
      }
      return now <= voice.untilMs;
    });
  },

  getSegments(context) {
    if (!this.params || !this.params.midiEnabled) return [];
    if (!context.getCurvyTarget || !context.createCurvyLineState) return [];

    this.pruneExpiredVoices();
    if (this.voices.length === 0) return [];

    let segments = [];
    let speedScale = (vNorm) => lerp(0.38, 1.15, vNorm);

    for (let voice of this.voices) {
      if (!voice.lineState) {
        this.ensureVoiceLineStates(context);
      }

      let prevPos = voice.lineState.curvyPos.copy();
      context.getCurvyTarget(
        voice.lineState,
        voice.justStarted,
        voice.lineState.curvyPos.copy(),
        false
      );

      if (!voice.justStarted) {
        let mult = speedScale(voice.vNorm);
        let moved = p5.Vector.sub(voice.lineState.curvyPos, prevPos);
        voice.lineState.curvyPos = prevPos.copy().add(moved.mult(mult));
      }

      voice.justStarted = false;

      voice.lineState.current.lerp(voice.lineState.curvyPos, context.params.smoothing);
      let length = p5.Vector.dist(voice.lineState.prev, voice.lineState.current);
      if (length < context.params.minSegmentLength) continue;

      let weight = map(length, 0, 10, context.params.thicknessMax, 1, true);
      segments.push({
        x1: voice.lineState.prev.x,
        y1: voice.lineState.prev.y,
        x2: voice.lineState.current.x,
        y2: voice.lineState.current.y,
        weight,
        color: this.colorWithVelocity(voice.color, voice.vNorm)
      });
      voice.lineState.prev = voice.lineState.current.copy();
    }

    return segments;
  },

  drawDebugHud() {
    let noteText = this.lastNote === null ? "-" : this.lastNote;
    let velText = this.lastNote === null ? "-" : this.lastVelocity;
    let sourceText = this.lastSource || "-";
    let enabledText = this.params && this.params.midiEnabled ? "on" : "off";
    let keyboardText = this.params && this.params.midiKeyboardEnabled ? "on" : "off";
    let modeText = this.isDrumMode() ? "drums" : "piano";
    let hudHeight = this.params && this.params.midiKeyboardEnabled ? 148 : 112;

    push();
    noStroke();
    fill(0, 150);
    rect(12, 12, 320, hudHeight, 8);
    fill(255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(`MIDI: ${this.status}`, 20, 20);
    text(`Enabled: ${enabledText}  Mode: ${modeText}  Keys: ${keyboardText}`, 20, 38);
    text(`Last note: ${noteText}  vel: ${velText}  src: ${sourceText}`, 20, 56);
    text(`Active voices: ${this.voices.length}`, 20, 74);
    if (this.params && this.params.midiKeyboardEnabled) {
      text("Keys: Z kick  X snare  ASDFG toms  QWE ride/hats  RTY cymbals", 20, 92);
      text("Hold Shift for accent (velocity 127)", 20, 110);
      if (this.isDrumMode()) {
        text("Drums mode: spawn ring per family, keys 1-6 colors", 20, 128);
      } else {
        text("Piano mode: line lasts while key is held", 20, 128);
      }
    }
    pop();
  }
};
