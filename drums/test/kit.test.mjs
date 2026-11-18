import assert from "node:assert/strict";
import test from "node:test";
import { acousticHit } from "../js/audio.js";

const rate = 44100;

function zeroCrossings(data, start, end) {
  let count = 0;
  const last = Math.min(data.length, end);
  for (let i = start + 1; i < last; i += 1) {
    if ((data[i] >= 0) !== (data[i - 1] >= 0)) count += 1;
  }
  return count;
}

function peakOf(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  return peak;
}

test("each drum is a struck hit with its own pitch and length", () => {
  const hit = {};
  for (const name of ["kick", "snare", "hat", "tom1", "tom2", "floor", "ride", "crash"]) {
    hit[name] = acousticHit(name, rate);
    assert.ok(peakOf(hit[name]) > 0.5);
    assert.ok(peakOf(hit[name]) <= 1);
  }
  const attack = Math.floor(0.012 * rate);
  const bodyStart = Math.floor(0.16 * rate);
  const bodyEnd = Math.floor(0.32 * rate);
  assert.ok(zeroCrossings(hit.kick, 0, attack) > 20);
  assert.ok(zeroCrossings(hit.kick, bodyStart, bodyEnd) < 30);
  assert.ok(zeroCrossings(hit.snare, bodyStart, bodyEnd) > 400);
  assert.ok(hit.hat.length / rate < 0.12);
  assert.ok(zeroCrossings(hit.hat, 0, attack) > 80);
  const attackRate = zeroCrossings(hit.tom1, 0, attack) / attack;
  const bodyRate = zeroCrossings(hit.tom1, bodyStart, bodyEnd) / (bodyEnd - bodyStart);
  assert.ok(attackRate > bodyRate * 2);
  const tom1 = zeroCrossings(hit.tom1, bodyStart, bodyEnd);
  const tom2 = zeroCrossings(hit.tom2, bodyStart, bodyEnd);
  const floor = zeroCrossings(hit.floor, bodyStart, bodyEnd);
  assert.ok(floor < tom2 && tom2 < tom1);
  assert.ok(hit.hat.length < hit.ride.length && hit.ride.length < hit.crash.length);
});
