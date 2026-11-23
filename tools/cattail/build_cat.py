#!/usr/bin/env python3
"""CATTAIL running-cat packer & validator.

Turns one cat's aligned layers (6 full-size PNGs + rig.json) into the web assets
used by cattail-layered-runner.js, and checks the rig in all 8 gait poses.

  python3 tools/cattail/build_cat.py build <cat_dir> --out sites/cattail/assets/cats
  python3 tools/cattail/build_cat.py registry sites/cattail/assets/cats [--default random|<id>] \
        > sites/cattail/assets/cattail-cat-variants.js

<cat_dir> layout:
  rig.json
  layers/body.png  frontNear.png  frontFar.png  rearNear.png  rearFar.png  tail.png
Every layer is the SAME canvas size (default 2048x1152), already positioned in the
neutral running pose; layers are not cropped. See SPEC.md.

Requires: Pillow, numpy.  Exit code 1 if any ERROR is reported.
"""
import argparse, hashlib, io, json, math, os, sys
import numpy as np
from PIL import Image

LOGICAL = (640, 360)          # runner's logical canvas
DPR = 2                       # atlas stored at 2x logical for sharp phones
PIECES = ["body", "frontNear", "frontFar", "rearNear", "rearFar", "tail"]
LIMBS = PIECES[1:]
DEFAULT_ORDER = ["tail", "rearFar", "frontFar", "body", "rearNear", "frontNear"]
POSES = [  # keep identical to cattail-layered-runner.js DEFAULT_POSES
    {"frontNear": -16, "frontFar": 13, "rearNear": 17, "rearFar": -12, "tail": -7, "bob": 0},
    {"frontNear": -6, "frontFar": 20, "rearNear": 9, "rearFar": -21, "tail": -3, "bob": -2},
    {"frontNear": 13, "frontFar": 6, "rearNear": -8, "rearFar": -9, "tail": 4, "bob": -4},
    {"frontNear": 21, "frontFar": -9, "rearNear": -19, "rearFar": 9, "tail": 7, "bob": -2},
    {"frontNear": 11, "frontFar": -21, "rearNear": -13, "rearFar": 19, "tail": 3, "bob": 0},
    {"frontNear": -7, "frontFar": -12, "rearNear": 4, "rearFar": 17, "tail": -3, "bob": -2},
    {"frontNear": -20, "frontFar": 7, "rearNear": 17, "rearFar": -3, "tail": -7, "bob": -4},
    {"frontNear": -13, "frontFar": 17, "rearNear": 12, "rearFar": -15, "tail": -2, "bob": -2},
]

errors, warns = [], []
def err(m): errors.append(m); print("ERROR:", m)
def warn(m): warns.append(m); print("WARN: ", m)


def chroma_key(img):
    """Layer without transparency: key out the corner colour (flat background)."""
    a = np.array(img.convert("RGB")).astype(np.int32)
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - 40) / 30, 0, 1) * 255
    out = np.dstack([a, alpha]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def load_layer(path, size):
    img = Image.open(path)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA")
    if img.size != tuple(size):
        err(f"{os.path.basename(path)} is {img.size}, expected {tuple(size)} (all layers must share one canvas)")
        return None
    al = np.array(img)[:, :, 3]
    if not has_alpha or al.min() == 255:
        warn(f"{os.path.basename(path)} has no transparency; keying out flat background colour")
        img = chroma_key(img); al = np.array(img)[:, :, 3]
    edge = np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]])
    if (edge > 128).sum() > 4:
        warn(f"{os.path.basename(path)} touches the canvas edge — part of the drawing may be cut off")
    return img


def resize_premul(img, size):
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def pack(items, max_w=1024, pad=4):
    """Shelf packing. items: {name: Image}. Returns ({name:(x,y)}, (W,H))."""
    max_w = max(max_w, max(i.width for i in items.values()) + 2 * pad)
    order = sorted(items, key=lambda n: -items[n].height)
    pos, x, y, shelf = {}, pad, pad, 0
    for n in order:
        w, h = items[n].size
        if x + w + pad > max_w:
            x, y, shelf = pad, y + shelf + pad, 0
        pos[n] = (x, y); x += w + pad; shelf = max(shelf, h)
    H = y + shelf + pad
    return pos, (max_w, H + (-H) % 4)


def render(variant, atlas, pose, R=1, only=None, margin=0):
    """Reproduces the runner's canvas math. Returns {name: RGBA layer} or composite."""
    W, H = LOGICAL[0] * R + 2 * margin, LOGICAL[1] * R + 2 * margin
    layers = {}
    for name in variant["order"]:
        if only and name not in only: continue
        p = variant["pieces"][name]
        x, y, w, h = p["src"]; crop = atlas.crop((x, y, x + w, y + h)).convert("RGBa")
        sc, (jx, jy), (atx, aty) = p["scale"], p["joint"], p["at"]
        bob = pose.get("bob", 0) * (0.3 if name == "tail" else 1)
        th = math.radians(pose.get(name, 0) if name != "body" else 0)
        c, s = math.cos(th), math.sin(th)
        ox, oy = atx * R + margin, (aty + bob) * R + margin
        # output pixel -> piece-local atlas pixel
        A = (c / (sc * R), s / (sc * R), jx - (c * ox + s * oy) / (sc * R),
             -s / (sc * R), c / (sc * R), jy - (-s * ox + c * oy) / (sc * R))
        layers[name] = crop.transform((W, H), Image.AFFINE, A, resample=Image.BICUBIC).convert("RGBA")
    return layers


def composite(variant, layers, R, bg=(200, 225, 220, 255)):
    W, H = next(iter(layers.values())).size
    out = Image.new("RGBA", (W, H), bg)
    for n in variant["order"]:
        out.alpha_composite(layers[n])
    return out


def check_poses(variant, atlas):
    M = 120  # margin (logical px) to detect drawing outside the canvas
    order = variant["order"]; body_i = order.index("body")
    lows = []
    for i, pose in enumerate(POSES):
        L = render(variant, atlas, pose, R=1, margin=M)
        al = {n: np.array(L[n])[:, :, 3] > 64 for n in L}
        body = al["body"]
        from_dil = np.zeros_like(body)
        ys, xs = np.nonzero(body)
        dil = body.copy()
        for dy in (-3, 0, 3):
            for dx in (-3, 0, 3):
                dil |= np.roll(np.roll(body, dy, 0), dx, 1)
        for n in LIMBS:
            if not (al[n] & dil).any():
                err(f"pose {i}: {n} does not touch the body (floating limb)")
            behind = order.index(n) < body_i
            if behind:
                pv = variant["pieces"][n]["at"]
                yy, xx = np.ogrid[:body.shape[0], :body.shape[1]]
                bob = pose.get("bob", 0) * (0.3 if n == "tail" else 1)
                near = (xx - (pv[0] + M)) ** 2 + (yy - (pv[1] + bob + M)) ** 2 < 26 ** 2
                # a leg legitimately shows BELOW the belly line; what must not show is the joint
                # poking out above/beside the silhouette (above the body's lower edge in that column)
                has = body.any(0)
                bottom = np.where(has, body.shape[0] - 1 - np.argmax(body[::-1], 0), -1)
                above = yy < bottom[None, :]
                exposed = int((al[n] & near & ~body & above).sum())
                if exposed > 40:
                    warn(f"pose {i}: {n} joint area shows outside the body ({exposed}px) — joint cap may be visible")
        union = np.zeros_like(body)
        for a in al.values(): union |= a
        inside = union[M:M + LOGICAL[1], M:M + LOGICAL[0]].sum()
        if union.sum() - inside > 30:
            warn(f"pose {i}: {union.sum() - inside}px of the cat fall outside the 640x360 canvas")
        legs = np.zeros_like(body)
        for n in ("frontNear", "frontFar", "rearNear", "rearFar"): legs |= al[n]
        lows.append(int(np.nonzero(legs.any(1))[0].max()) - M)
    neutral = render(variant, atlas, {}, R=1, margin=M)
    legs = np.zeros_like(np.array(neutral["body"])[:, :, 3] > 64)
    for n in ("frontNear", "frontFar", "rearNear", "rearFar"): legs |= np.array(neutral[n])[:, :, 3] > 64
    nlow = int(np.nonzero(legs.any(1))[0].max()) - M
    print(f"paw ground line: neutral y={nlow}, poses y={min(lows)}..{max(lows)} (logical px)")
    if not 296 <= nlow <= 326:
        warn(f"neutral paws end at y={nlow}; target is about 312 (wheel floor)")
    if max(lows) > 352:
        warn(f"a paw reaches y={max(lows)} in some pose; may sink into the wheel rim")


def build(cat_dir, out_root):
    rig = json.load(open(os.path.join(cat_dir, "rig.json"), encoding="utf-8"))
    cid = rig["id"]; size = rig.get("canvas", [2048, 1152])
    if abs(size[0] / size[1] - 16 / 9) > 0.01: err("canvas must be 16:9 (e.g. 2048x1152)")
    k = LOGICAL[0] / size[0]; f = DPR * k
    pivots = rig.get("pivots", {})
    order = rig.get("order", DEFAULT_ORDER)
    if sorted(order) != sorted(PIECES): err(f"order must list exactly {PIECES}")
    crops, info = {}, {}
    for n in PIECES:
        path = os.path.join(cat_dir, "layers", n + ".png")
        if not os.path.exists(path): err(f"missing layers/{n}.png"); continue
        img = load_layer(path, size)
        if img is None: continue
        al = np.array(img)[:, :, 3]
        ys, xs = np.nonzero(al > 8)
        if not len(xs): err(f"{n}.png is empty"); continue
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = img.crop((x0, y0, x1, y1))
        crops[n] = resize_premul(crop, (max(1, round(crop.width * f)), max(1, round(crop.height * f))))
        info[n] = (x0, y0, crop.width, crop.height)
        if n != "body":
            if n not in pivots: err(f"rig.json pivots.{n} missing"); continue
            px, py = pivots[n]
            oy, ox = np.nonzero(al > 64)
            dist = float(np.sqrt(((ox - px) ** 2 + (oy - py) ** 2).min()))
            if dist > 48: err(f"pivots.{n} {pivots[n]} is {dist:.0f}px away from the drawing in {n}.png")
            elif dist > 2: warn(f"pivots.{n} is {dist:.0f}px off the drawing in {n}.png; put it on the joint itself")
    if errors: return None
    bal = np.array(Image.open(os.path.join(cat_dir, "layers", "body.png")).convert("RGBA"))[:, :, 3]
    for n in LIMBS:
        px, py = pivots[n]
        if bal[int(py), int(px)] < 64:
            err(f"pivots.{n} {pivots[n]} is outside the body silhouette — joints must sit inside the body")
    if errors: return None
    bw = info["body"][2] * k
    if not 380 <= bw <= 470: warn(f"body is {bw:.0f} logical px wide; reference is ~420 (cat will look bigger/smaller)")
    if size[0] < 1600: warn("layers are small; 2048x1152 recommended for sharp phones")

    pos, (AW, AH) = pack(crops)
    atlas = Image.new("RGBA", (AW, AH), (0, 0, 0, 0))
    for n, (x, y) in pos.items(): atlas.alpha_composite(crops[n], (x, y))
    pieces = {}
    for n in PIECES:
        x0, y0, w, h = info[n]; ax, ay = pos[n]; aw, ah = crops[n].size
        sc = w * k / aw
        if n == "body": joint, at = [0, 0], [x0 * k, y0 * k]
        else:
            px, py = pivots[n]
            joint = [(px - x0) * aw / w, (py - y0) * ah / h]; at = [px * k, py * k]
        pieces[n] = {"src": [ax, ay, aw, ah], "scale": round(sc, 5),
                     "joint": [round(v, 2) for v in joint], "at": [round(v, 2) for v in at]}
    buf = io.BytesIO(); atlas.save(buf, "WEBP", quality=90, method=6)
    h8 = hashlib.sha1(buf.getvalue()).hexdigest()[:8]
    variant = {"id": cid, "label": rig.get("label", cid), "atlas": f"assets/cats/{cid}/atlas.webp?v={h8}",
               "order": order, "pieces": pieces}
    if "poses" in rig: variant["poses"] = rig["poses"]

    atlas_dec = Image.open(io.BytesIO(buf.getvalue())).convert("RGBA")
    check_poses(variant, atlas_dec)

    od = os.path.join(out_root, cid); os.makedirs(od, exist_ok=True)
    open(os.path.join(od, "atlas.webp"), "wb").write(buf.getvalue())
    json.dump(variant, open(os.path.join(od, "variant.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # preview: neutral + 8 poses at 2x
    tiles = [composite(variant, render(variant, atlas_dec, p, R=2), 2) for p in [{}] + POSES]
    tw, th = tiles[0].size; sheet = Image.new("RGBA", (tw * 3, th * 3), "white")
    for i, t in enumerate(tiles): sheet.paste(t, ((i % 3) * tw, (i // 3) * th))
    sheet.convert("RGB").save(os.path.join(cat_dir, "preview.png"))
    print(f"atlas {AW}x{AH}, {len(buf.getvalue()) // 1024} KB -> {od}/atlas.webp")
    print(f"preview -> {os.path.join(cat_dir, 'preview.png')} (top-left = neutral, then poses 0-7)")
    return variant


def registry(root, default):
    vs = {}
    for d in sorted(os.listdir(root)):
        p = os.path.join(root, d, "variant.json")
        if os.path.exists(p): vs[d] = json.load(open(p, encoding="utf-8"))
    if not vs: err(f"no */variant.json under {root}"); return
    if default != "random" and default not in vs: err(f"--default {default} is not a built cat")
    js = ("/* CATTAIL running-cat variants. Generated by tools/build_cat.py registry; do not edit by hand. */\n"
          "window.CATTAIL_CAT_VARIANTS=" + json.dumps(vs, ensure_ascii=False, separators=(",", ":")) + ";\n"
          f"window.CATTAIL_CAT_DEFAULT={json.dumps(default)};\n")
    sys.stdout.write(js)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build"); b.add_argument("cat_dir"); b.add_argument("--out", required=True)
    r = sub.add_parser("registry"); r.add_argument("root"); r.add_argument("--default", default="random")
    a = ap.parse_args()
    if a.cmd == "build": build(a.cat_dir, a.out)
    else: registry(a.root, a.default)
    print(f"\n{len(errors)} error(s), {len(warns)} warning(s)", file=sys.stderr)
    sys.exit(1 if errors else 0)
