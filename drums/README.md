# Handline

A browser drum desk: practice the 40 PAS rudiments against a clock, learn a set of grooves, generate fills from a sticking, and see how a sticking sits on the kit as a groove or a fill.

Lessons scroll toward a hit line, Melodics-style, on a horizontal highway. Right hand is vermilion, left hand is blue, kick is gold. Each rudiment can be played as 8th notes or as 16th notes. A rudiment written in triplets or sextuplets also keeps that grid. At the end you get a timing score and a star rating.

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

## Grooves

Grooves loop the same phrase on the highway, the way a fill does. The set runs from easy to hard, and each groove is there for one skill: the backbeat, a constant kick, the offbeat hat, even 16ths, a kick that moves, the shuffle, half time, ghost notes, playing one limb at a time, and a two-bar phrase. **Practice this** loads that groove.

The step sequencer is one bar of hi-hat, snare, and kick, in 8ths or 16ths. Click a cell to add that voice. Switching to 16ths keeps an 8th hit on the first of the two slots. Switching back to 8ths keeps a step if either 16th in the pair was on. **Play** loops what you wrote. A snare on beat 2 or 4 is accented.

## Fills

Type R, L, and K. The generator writes that sticking as one beat, half a bar, and a full bar. Every fill mixes 8th notes and 16th notes, and the set moves the hands in different ways: down the kit, split between the hands, 16ths on the snare, or around the drums. **Practice this** loops the fill on the highway.

## Stickings

The portfolio is a set of stickings that show up in everyday playing. Each one is written out as 8th notes and as 16th notes, on the snare, as hat and ride grooves, as a linear groove, and as two fills. Triplets are optional. Type R, L, and K. K is the kick and takes its own step. A sticking with no K still puts the kick on beats 1 and 3 in the grooves. **Practice this** loads that voicing into the highway.

## Tests

```bash
node --test drums/test/engine.test.mjs
```
