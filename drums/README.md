# Handline

A browser drum desk with two jobs: practice the 40 PAS rudiments against a clock, and see how a sticking sits on the kit as a groove or a fill.

Lessons scroll toward a hit line, Melodics-style, on a horizontal highway. Right hand is vermilion, left hand is blue, kick is gold. At the end you get a timing score and a star rating.

## Run it

From the repo root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/drums/

Chrome or Edge. Web MIDI does not work in every browser.

## Alesis Nitro Max

Plug the module in with USB and press **Connect MIDI**. The app uses the module’s default note map (user guide section 5.2): kick 36, snare 38, snare rim 40, tom 1 48, tom 2 45, floor 43, closed hat 42, open hat 46, crash 49, ride 51. Rim shots count as the same drum. The hi-hat pedal chick is ignored so it does not score as a stick hit.

If every hit is called late, open **Kit & keys** and move calibration to the right.

Without the kit, use the on-screen pads or the keyboard: B or Space kick, D snare, F and G toms, H floor, J hat, L ride, C crash.

## Timing

Perfect is within 30 ms, great within 55, good within 90. Anything else is a miss. Grace notes get a slightly wider window and count at half weight. Five stars starts at a score of 93.

## Stickings

The portfolio is a set of stickings that show up in everyday playing. Each one is written out as 8th notes and as 16th notes, on the snare, as hat and ride grooves, as a linear groove, and as two fills. Triplets are optional. Type any R/L sticking to generate the same set. **Practice this** loads that voicing into the highway.

## Tests

```bash
node --test drums/test/engine.test.mjs
```
