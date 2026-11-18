import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { KIT_SAMPLES, sampleFiles } from "../js/audio.js";

const PADS = ["kick", "snare", "hat", "tom1", "tom2", "floor", "ride", "crash"];

test("every pad has a VCSL sample on disk", () => {
  for (const pad of PADS) {
    assert.ok(KIT_SAMPLES[pad].soft.length > 0);
    assert.ok(KIT_SAMPLES[pad].loud.length > 0);
  }
  const files = sampleFiles();
  assert.equal(new Set(files).size, files.length);
  for (const name of files) {
    const bytes = readFileSync(new URL(`../samples/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    assert.ok(bytes.length > 1000, name);
  }
});
