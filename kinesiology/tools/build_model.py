#!/usr/bin/env python3
"""Convert the Rajagopal 2016 OpenSim model into browser JSON.

Bone meshes and joint definitions come from the public opensim-models
repository (Models/Rajagopal). Model-local Geometry overrides the shared
Geometry folder, matching OpenSim's search order.
"""

from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "opensim-models"
DATA = ROOT / "data"
RAW_BASE = "https://raw.githubusercontent.com/opensim-org/opensim-models/master"
OSIM_REL = "Models/Rajagopal/Rajagopal2016.osim"

# Body-fixed XYZ Euler, matching SimTK Rotation::setRotationToBodyFixedXYZ.
def euler_xyz(angles):
    x, y, z = angles
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    # R[i][j] from setThreeAngleThreeAxesBodyFixedForwardCyclicalRotation
    # with axis order X, Y, Z.
    return [
        cy * cz,
        -sz * cy,
        sy,
        sz * cx + sy * sx * cz,
        cx * cz - sy * sx * sz,
        -sx * cy,
        sx * sz - sy * cx * cz,
        sx * cz + sy * sz * cx,
        cx * cy,
    ]


def natural_cubic_spline(xs, ys):
    n = len(xs) - 1
    if n < 1:
        raise ValueError("spline needs two points")
    h = [xs[i + 1] - xs[i] for i in range(n)]
    alpha = [0.0] * (n + 1)
    for i in range(1, n):
        alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1])
    ell = [1.0] + [0.0] * n
    mu = [0.0] * (n + 1)
    z = [0.0] * (n + 1)
    for i in range(1, n):
        ell[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]
        mu[i] = h[i] / ell[i]
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / ell[i]
    ell[n] = 1.0
    c = [0.0] * (n + 1)
    b = [0.0] * n
    d = [0.0] * n
    for j in range(n - 1, -1, -1):
        c[j] = z[j] - mu[j] * c[j + 1]
        b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3
        d[j] = (c[j + 1] - c[j]) / (3 * h[j])
    segments = []
    for j in range(n):
        segments.append(
            {
                "x0": xs[j],
                "x1": xs[j + 1],
                "a": ys[j],
                "b": b[j],
                "c": c[j],
                "d": d[j],
            }
        )
    return segments


def eval_spline(segments, x):
    if x <= segments[0]["x0"]:
        return segments[0]["a"]
    last = segments[-1]
    if x >= last["x1"]:
        dt = last["x1"] - last["x0"]
        return last["a"] + dt * (last["b"] + dt * (last["c"] + dt * last["d"]))
    for seg in segments:
        if x <= seg["x1"]:
            dt = x - seg["x0"]
            return seg["a"] + dt * (seg["b"] + dt * (seg["c"] + dt * seg["d"]))
    return last["a"]


def floats(text):
    return [float(part) for part in text.split()]


def download(rel):
    dest = CACHE / rel
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{RAW_BASE}/{rel}"
    print(f"fetch {rel}")
    urllib.request.urlretrieve(url, dest)
    return dest


def local_name(socket_text):
    # "/bodyset/femur_r" or "/ground" or "femur_r_offset"
    name = socket_text.strip().split("/")[-1]
    if name == "ground":
        return "ground"
    return name


def parse_function(axis_el, coord_index):
    coords = (axis_el.findtext("coordinates") or "").split()
    axis = floats(axis_el.findtext("axis"))
    fn_el = None
    for child in list(axis_el):
        if child.tag not in ("coordinates", "axis"):
            fn_el = child
            break
    if fn_el is None:
        raise ValueError(f"missing function on {axis_el.get('name')}")
    if fn_el.tag == "Constant":
        return {"kind": "rotation" if axis_el.get("name").startswith("rotation") else "translation",
                "axis": axis, "fn": {"type": "constant", "value": float(fn_el.findtext("value"))}}
    if fn_el.tag == "LinearFunction":
        slope, intercept = floats(fn_el.findtext("coefficients"))
        if len(coords) != 1:
            raise ValueError(f"linear function expected 1 coord, got {coords}")
        return {"kind": "rotation" if axis_el.get("name").startswith("rotation") else "translation",
                "axis": axis,
                "fn": {"type": "linear", "coord": coords[0], "slope": slope, "intercept": intercept}}
    if fn_el.tag == "SimmSpline":
        if len(coords) != 1:
            raise ValueError(f"spline expected 1 coord, got {coords}")
        xs = floats(fn_el.findtext("x"))
        ys = floats(fn_el.findtext("y"))
        segments = natural_cubic_spline(xs, ys)
        for x, y in zip(xs, ys):
            got = eval_spline(segments, x)
            if abs(got - y) > 1e-6:
                raise SystemExit(f"spline missed knot {x}: {got} != {y}")
        return {"kind": "rotation" if axis_el.get("name").startswith("rotation") else "translation",
                "axis": axis,
                "fn": {"type": "spline", "coord": coords[0], "segments": segments}}
    raise ValueError(f"unsupported function {fn_el.tag}")


def frame_of(joint_el, frame_name):
    for frame in joint_el.findall("./frames/PhysicalOffsetFrame"):
        if frame.get("name") == frame_name:
            translation = floats(frame.findtext("translation"))
            orientation = floats(frame.findtext("orientation"))
            parent = local_name(frame.findtext("socket_parent"))
            return {
                "parent": parent,
                "t": translation,
                "R": euler_xyz(orientation),
            }
    raise KeyError(frame_name)


def default_spatial(kind, coord_names):
    """Pin rotates about Z. Universal rotates about X, then the new Y."""
    zeros = [{"kind": "rotation", "axis": [1, 0, 0], "fn": {"type": "constant", "value": 0}},
             {"kind": "rotation", "axis": [0, 1, 0], "fn": {"type": "constant", "value": 0}},
             {"kind": "rotation", "axis": [0, 0, 1], "fn": {"type": "constant", "value": 0}},
             {"kind": "translation", "axis": [1, 0, 0], "fn": {"type": "constant", "value": 0}},
             {"kind": "translation", "axis": [0, 1, 0], "fn": {"type": "constant", "value": 0}},
             {"kind": "translation", "axis": [0, 0, 1], "fn": {"type": "constant", "value": 0}}]
    if kind == "PinJoint":
        zeros[2] = {"kind": "rotation", "axis": [0, 0, 1],
                    "fn": {"type": "linear", "coord": coord_names[0], "slope": 1, "intercept": 0}}
    elif kind == "UniversalJoint":
        zeros[0] = {"kind": "rotation", "axis": [1, 0, 0],
                    "fn": {"type": "linear", "coord": coord_names[0], "slope": 1, "intercept": 0}}
        zeros[1] = {"kind": "rotation", "axis": [0, 1, 0],
                    "fn": {"type": "linear", "coord": coord_names[1], "slope": 1, "intercept": 0}}
    else:
        raise ValueError(kind)
    return zeros


def parse_vtp(path):
    tree = ET.parse(path)
    root = tree.getroot()
    piece = root.find(".//Piece")
    points_array = None
    connectivity = None
    offsets = None
    for array in piece.iter("DataArray"):
        name = array.get("Name")
        if array.get("NumberOfComponents") == "3" and points_array is None and name != "connectivity":
            # The points array is the first 3-component array under Points.
            parent = None
        if path and False:
            pass
    points_node = piece.find("./Points/DataArray")
    if points_node.get("format") != "ascii":
        raise SystemExit(f"binary VTP not supported: {path}")
    positions = floats(points_node.text)
    if len(positions) % 3 != 0:
        raise SystemExit(f"bad point count in {path}")
    poly_arrays = piece.findall("./Polys/DataArray")
    for array in poly_arrays:
        if array.get("Name") == "connectivity":
            connectivity = [int(v) for v in array.text.split()]
        elif array.get("Name") == "offsets":
            offsets = [int(v) for v in array.text.split()]
    if connectivity is None or offsets is None:
        raise SystemExit(f"missing polys in {path}")
    indices = []
    start = 0
    npoints = len(positions) // 3
    for end in offsets:
        poly = connectivity[start:end]
        start = end
        if len(poly) < 3:
            continue
        for k in range(1, len(poly) - 1):
            tri = (poly[0], poly[k], poly[k + 1])
            if any(i < 0 or i >= npoints for i in tri):
                raise SystemExit(f"index out of range in {path}")
            indices.extend(tri)
    # Round to 0.01 mm. Values are meters.
    rounded = [round(v, 5) for v in positions]
    return rounded, indices


def sole_candidates(positions, count=24):
    verts = list(zip(positions[0::3], positions[1::3], positions[2::3]))
    verts.sort(key=lambda p: p[1])
    return [list(p) for p in verts[:count]]


def main():
    osim_path = download(OSIM_REL)
    model = ET.parse(osim_path).getroot().find("Model")

    coordinates = []
    coord_meta = {}
    for coord in model.findall(".//Coordinate"):
        name = coord.get("name")
        if name in coord_meta:
            continue
        lo, hi = floats(coord.findtext("range"))
        default = float(coord.findtext("default_value"))
        entry = {"name": name, "min": lo, "max": hi, "default": default}
        coordinates.append(entry)
        coord_meta[name] = entry

    couplers = []
    for coupler in model.findall(".//CoordinateCouplerConstraint"):
        indep = coupler.findtext("independent_coordinate_names").split()
        dep = coupler.findtext("dependent_coordinate_name").strip()
        slope, intercept = floats(coupler.find(".//LinearFunction/coefficients").text)
        scale = float(coupler.findtext("scale_factor") or 1)
        if len(indep) != 1:
            raise SystemExit("only 1-D couplers are supported")
        couplers.append({
            "dependent": dep,
            "independent": indep[0],
            "slope": slope * scale,
            "intercept": intercept * scale,
        })

    mesh_names = []
    bodies = []
    for body in model.find("BodySet/objects"):
        meshes = []
        for mesh in body.findall("./attached_geometry/Mesh"):
            fname = mesh.findtext("mesh_file").strip()
            meshes.append(fname)
            mesh_names.append(fname)
        bodies.append({"name": body.get("name"), "meshes": meshes})

    joints = []
    for joint in model.find("JointSet/objects"):
        parent_frame_name = local_name(joint.findtext("socket_parent_frame"))
        child_frame_name = local_name(joint.findtext("socket_child_frame"))
        parent_frame = frame_of(joint, parent_frame_name)
        child_frame = frame_of(joint, child_frame_name)
        coord_names = [c.get("name") for c in joint.findall("./coordinates/Coordinate")]
        spatial = joint.find("SpatialTransform")
        if spatial is not None:
            axes = [parse_function(axis, None) for axis in list(spatial)]
        else:
            axes = default_spatial(joint.tag, coord_names)
        joints.append({
            "name": joint.get("name"),
            "type": joint.tag,
            "parent": parent_frame["parent"],
            "child": child_frame["parent"],
            "parentFrame": {"p": parent_frame["t"], "R": parent_frame["R"]},
            "childFrame": {"p": child_frame["t"], "R": child_frame["R"]},
            "axes": axes,
        })

    # Parent before child.
    order = []
    pending = joints[:]
    ready = {"ground"}
    while pending:
        progress = False
        next_pending = []
        for joint in pending:
            if joint["parent"] in ready:
                order.append(joint)
                ready.add(joint["child"])
                progress = True
            else:
                next_pending.append(joint)
        if not progress:
            raise SystemExit(f"joint cycle or missing parent: {[j['name'] for j in pending]}")
        pending = next_pending

    muscles = []
    for muscle in model.find("ForceSet/objects"):
        if muscle.tag != "Millard2012EquilibriumMuscle":
            continue
        points = []
        for point in muscle.findall(".//PathPoint"):
            points.append({
                "body": local_name(point.findtext("socket_parent_frame")),
                "p": floats(point.findtext("location")),
            })
        wraps = []
        for wrap in muscle.findall(".//PathWrap"):
            wrap_name = wrap.findtext("wrap_object").strip()
            # Wrap cylinders live on bodies.
            found = None
            for body in model.find("BodySet/objects"):
                for cyl in body.findall(".//WrapCylinder"):
                    if cyl.get("name") == wrap_name:
                        found = (body.get("name"), cyl)
                        break
            if found is None:
                print(f"skip missing wrap {wrap_name} on {muscle.get('name')}")
                continue
            body_name, cyl = found
            wraps.append({
                "body": body_name,
                "t": floats(cyl.findtext("translation")),
                "e": floats(cyl.findtext("xyz_body_rotation")),
                "R": euler_xyz(floats(cyl.findtext("xyz_body_rotation"))),
                "radius": float(cyl.findtext("radius")),
                "length": float(cyl.findtext("length")),
            })
        muscles.append({"name": muscle.get("name"), "points": points, "wraps": wraps, "source": "rajagopal2016"})

    mesh_geometry = {}
    sole = []
    bboxes = {}
    for fname in sorted(set(mesh_names)):
        local_rel = f"Models/Rajagopal/Geometry/{fname}"
        shared_rel = f"Geometry/{fname}"
        local_path = CACHE / local_rel
        local_path.parent.mkdir(parents=True, exist_ok=True)
        if not local_path.exists() or local_path.stat().st_size < 200:
            url = f"{RAW_BASE}/{local_rel}"
            try:
                with urllib.request.urlopen(url) as response:
                    local_path.write_bytes(response.read())
                print(f"fetch {local_rel}")
            except Exception:
                if local_path.exists() and local_path.stat().st_size < 200:
                    local_path.unlink()
        if local_path.exists() and local_path.stat().st_size > 200:
            mesh_path = local_path
            origin = "model"
        else:
            mesh_path = download(shared_rel)
            origin = "shared"
        positions, indices = parse_vtp(mesh_path)
        mesh_geometry[fname] = {"positions": positions, "indices": indices}
        xs = positions[0::3]
        ys = positions[1::3]
        zs = positions[2::3]
        bboxes[fname] = {
            "origin": origin,
            "min": [min(xs), min(ys), min(zs)],
            "max": [max(xs), max(ys), max(zs)],
            "triangles": len(indices) // 3,
        }
        if any(token in fname for token in ("foot", "bofoot", "toes")):
            for point in sole_candidates(positions, 16):
                sole.append({"mesh": fname, "p": point})

    # Attach sole points to the body that owns the mesh.
    mesh_owner = {}
    for body in bodies:
        for mesh in body["meshes"]:
            mesh_owner[mesh] = body["name"]
    sole_points = [{"body": mesh_owner[item["mesh"]], "p": item["p"]} for item in sole]

    payload = {
        "meta": {
            "model": "Rajagopal2016",
            "citation": "Rajagopal A, Dembia CL, DeMers MS, Delp DD, Hicks JL, Delp SL. Full-body musculoskeletal model for muscle-driven simulation of human gait. IEEE Trans Biomed Eng. 2016;63(10):2068-2079.",
            "source": "https://github.com/opensim-org/opensim-models/tree/master/Models/Rajagopal",
            "units": {"length": "meters", "angle": "radians"},
            "convention": "OpenSim: +X anterior, +Y superior, +Z to the model's right. Rotations are right-handed.",
        },
        "coordinates": coordinates,
        "couplers": couplers,
        "bodies": bodies,
        "joints": order,
        "muscles": muscles,
        "solePoints": sole_points,
    }

    DATA.mkdir(parents=True, exist_ok=True)
    model_path = DATA / "model.json"
    mesh_path = DATA / "meshes.json"
    model_path.write_text(json.dumps(payload, separators=(",", ":")))
    mesh_path.write_text(json.dumps(mesh_geometry, separators=(",", ":")))
    (CACHE / "mesh-bounds.json").write_text(json.dumps(bboxes, indent=2))

    print(f"bodies {len(bodies)} joints {len(order)} coords {len(coordinates)} muscles {len(muscles)}")
    print(f"wrote {model_path} ({model_path.stat().st_size} bytes)")
    print(f"wrote {mesh_path} ({mesh_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
