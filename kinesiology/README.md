# Kinetic Anatomy

A browser lab for kinesiology. Drag a joint through its range and the skeleton moves on the published axes of the [Rajagopal 2016 full-body OpenSim model](https://doi.org/10.1109/TBME.2016.2586891). Lower-limb muscle lines are that model's paths. The panel names the prime movers, synergists, and antagonists for each direction.

## Run it

From the repository root:

```bash
python3 -m http.server 8081
```

Open http://localhost:8081/kinesiology/

The page loads Three.js from a CDN. Bone meshes are already converted in `data/`.

Check the joint math with:

```bash
node --test kinesiology/test/kinematics.test.mjs
```

## What is validated, and what is a teaching diagram

The OpenSim model supplies the bone meshes, the joint frames, and the lower-limb muscle paths. Positive hip flexion swings the knee forward. Positive hip adduction swings each knee toward the midline. Knee flexion follows the Walker knee splines, so the tibia slides as it bends instead of hinging through the femur.

A few things are deliberately not pretended to be part of that paper:

- Upper-limb muscle lines are schematic paths placed on the same bones. The gait model actuates the arms with torques, not muscles.
- The neck pivot and the finger hinges are approximations. In the source model the skull is welded to the torso and the hand is one rigid body.
- The scapula, clavicle, and individual vertebrae do not have their own joints. Scapular motion is explained beside the shoulder, because a real overhead reach is glenohumeral abduction plus scapular upward rotation.
- Slider limits are the model's published coordinate ranges, tightened where that range is far outside a teaching range (the lumbar joint, for example, can fold ±90°). Clinical numbers shown next to them are adult guides in the AAOS / Norkin & White tradition, not measurements of this generic model.

## Rebuild the model files

`tools/build_model.py` downloads `Rajagopal2016.osim` and the VTK bone meshes from [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models) and writes `data/model.json` and `data/meshes.json`.

```bash
python3 kinesiology/tools/build_model.py
```
