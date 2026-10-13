import { laneOrder, letterFor } from "./kit.js";

const LOOKAHEAD = 2.2;

export function createHighway(canvas) {
  const ctx = canvas.getContext("2d");
  const flashes = [];
  const labels = [];
  let colors = null;
  let width = 0;
  let height = 0;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    const pick = (name) => style.getPropertyValue(name).trim();
    colors = {
      R: pick("--hand-r"),
      L: pick("--hand-l"),
      F: pick("--hand-f"),
      ink: pick("--ink"),
      muted: pick("--muted"),
      stage: pick("--stage"),
      good: pick("--good"),
      line: pick("--line"),
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(320, rect.width);
    const nextH = Math.max(280, rect.height);
    if (canvas.width !== Math.floor(nextW * dpr) || canvas.height !== Math.floor(nextH * dpr)) {
      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
    }
    width = nextW;
    height = nextH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!colors) readColors();
  }

  function feedback(element, kind, text) {
    const at = performance.now();
    flashes.push({ element, kind, at });
    if (text) labels.push({ element, kind, text, at });
  }

  function prune(nowMs) {
    while (flashes.length && nowMs - flashes[0].at > 220) flashes.shift();
    while (labels.length && nowMs - labels[0].at > 640) labels.shift();
  }

  function frame(view) {
    const { notes, now, bpm, stepsPerBeat, phase, currentBeat, buzz } = view;
    const lanes = laneOrder(notes.map((note) => note.element));
    const wanted = Math.min(500, Math.max(lanes.length > 2 ? 0 : 210, lanes.length * 68 + 32));
    if (canvas.style.height !== `${wanted}px`) canvas.style.height = `${wanted}px`;
    resize();
    const nowMs = performance.now();
    prune(nowMs);
    const labelW = 92;
    const hitX = 124;
    const pxPerSec = (width - hitX - 28) / LOOKAHEAD;
    const beatDur = 60 / bpm;
    const pxPerBeat = beatDur * pxPerSec;
    const top = 12;
    const laneH = lanes.length ? (height - 24) / lanes.length : height - 24;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.stage;
    ctx.fillRect(0, 0, width, height);

    lanes.forEach((lane, index) => {
      const y = top + index * laneH;
      ctx.fillStyle = index % 2 === 0 ? "rgba(243,238,230,0.035)" : "rgba(243,238,230,0.015)";
      ctx.fillRect(labelW, y, width - labelW, laneH);
      ctx.fillStyle = colors.muted;
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(lane.label.toUpperCase(), 16, y + laneH / 2);
    });

    const beat0 = Math.floor(currentBeat) - 1;
    const beat1 = currentBeat + LOOKAHEAD / beatDur + 1;
    for (let beat = beat0; beat < beat1; beat += 1) {
      const x = hitX + (beat - currentBeat) * pxPerBeat;
      if (x < labelW || x > width) continue;
      ctx.strokeStyle = beat % 4 === 0 ? "rgba(243,238,230,0.16)" : "rgba(243,238,230,0.06)";
      ctx.lineWidth = beat % 4 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, height - 12);
      ctx.stroke();
    }

    if (buzz && lanes.length) {
      drawBuzz(lanes, notes, now, hitX, pxPerSec, top, laneH);
    }

    const stepSec = beatDur / stepsPerBeat;
    for (const note of notes) {
      const laneIndex = lanes.findIndex((lane) => lane.id === note.element);
      if (laneIndex < 0) continue;
      const x = hitX + (note.time - now) * pxPerSec;
      if (x < labelW - 30 || x > width + 40) continue;
      const y = top + laneIndex * laneH + laneH / 2;
      const slot = Math.max(16, stepSec * pxPerSec);
      drawNote(note, x, y, laneH, slot);
    }

    const pulse = phase === "countin" || phase === "playing" || phase === "preview"
      ? Math.max(0, 1 - ((currentBeat % 1 + 1) % 1) / 0.12)
      : 0;
    ctx.strokeStyle = `rgba(243,238,230,${0.85 + pulse * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hitX, 8);
    ctx.lineTo(hitX, height - 8);
    ctx.stroke();

    lanes.forEach((lane, index) => {
      const y = top + index * laneH + laneH / 2;
      const h = Math.min(46, laneH * 0.62);
      const flash = flashes.find((item) => item.element === lane.id);
      ctx.strokeStyle = flash ? (colors[flash.kind] || colors.ink) : "rgba(243,238,230,0.35)";
      ctx.lineWidth = flash ? 2.5 : 1.25;
      roundRect(hitX - 16, y - h / 2, 32, h, 8);
      ctx.stroke();
    });

    labels.slice(-3).forEach((label, index) => {
      const age = (nowMs - label.at) / 640;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = label.kind === "miss" || label.kind === "stray" ? colors.R : colors.good;
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(label.text, hitX + 18, 28 + index * 16 - age * 10);
      ctx.globalAlpha = 1;
    });

    if (phase === "countin" && currentBeat < 0) {
      const number = Math.max(1, Math.ceil(-currentBeat - 1e-6));
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = 0.9;
      ctx.font = "500 92px Fraunces, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(number), (hitX + width) / 2, height / 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawBuzz(lanes, notes, now, hitX, pxPerSec, top, laneH) {
    const snare = lanes.findIndex((lane) => lane.id === "snare");
    if (snare < 0) return;
    const y = top + snare * laneH + laneH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(92, top + snare * laneH, width, laneH);
    ctx.clip();
    ctx.strokeStyle = "rgba(243,238,230,0.28)";
    ctx.lineWidth = 1.5;
    const ordered = notes.filter((note) => note.element === "snare" && !note.grace).slice().sort((a, b) => a.time - b.time);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const x0 = hitX + (ordered[i].time - now) * pxPerSec;
      const x1 = hitX + (ordered[i + 1].time - now) * pxPerSec;
      if (x1 < 80 || x0 > width) continue;
      ctx.beginPath();
      const waves = 7;
      for (let s = 0; s <= waves * 8; s += 1) {
        const t = s / (waves * 8);
        const x = x0 + (x1 - x0) * t;
        const amp = Math.sin(t * Math.PI) * Math.min(18, laneH * 0.22);
        const yy = y + Math.sin(t * waves * Math.PI * 2) * amp;
        if (s === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNote(note, x, y, laneH, slot) {
    const color = colors[note.hand] || colors.F;
    const passed = note.result && note.result !== "miss";
    const missed = note.result === "miss";
    ctx.save();
    if (missed) ctx.globalAlpha = 0.45;
    if (note.grace) {
      const radius = Math.max(6, Math.min(11, laneH * 0.16));
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = note.hand === "L" ? "#f4f7ff" : "#1a100c";
      ctx.font = "600 9px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letterFor(note).toLowerCase(), x, y + 0.5);
      ctx.restore();
      return;
    }

    const w = Math.max(20, Math.min(52, slot * 0.74));
    const h = Math.max(30, Math.min(laneH * 0.62, note.accent ? 70 : 58));
    ctx.fillStyle = color;
    roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.fill();
    if (note.accent) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
    }
    if (missed) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = note.hand === "L" ? "#f4f7ff" : "#1a100c";
      ctx.font = `600 ${w < 24 ? 11 : 14}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letterFor(note), x, y + 0.5);
    }
    if (passed) {
      ctx.globalAlpha = 0.9;
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  return { frame, feedback, resize };
}
