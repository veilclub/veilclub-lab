#!/usr/bin/env python3
"""CATTAIL running-cat packer & validator.

Turns one cat's aligned layers (full-size PNGs + rig.json) into the web assets used by
cattail-layered-runner.js, and checks the rig in all 8 gait poses (with the tail wave).

  python3 tools/cattail/build_cat.py grid <image.png>                 # coordinate grid to read landmarks
  python3 tools/cattail/build_cat.py assemble <cat_dir> [--build --out sites/cattail/assets/cats]
  python3 tools/cattail/build_cat.py build <cat_dir> --out sites/cattail/assets/cats
  python3 tools/cattail/build_cat.py registry sites/cattail/assets/cats [--default random|<id>] \
        > sites/cattail/assets/cattail-cat-variants.js

<cat_dir> layout:
  rig.json
  layers/body.png frontNear.png frontFar.png rearNear.png rearFar.png
         tail1.png tail2.png tail3.png tail4.png      (segmented tail, base -> tip; 3-6 segments)
         -- or a single tail.png (no wave; legacy)
Every layer is the SAME canvas size (2048x1152), already positioned in the neutral pose.

Requires: Pillow, numpy.  Exit code 1 if any ERROR is reported.
"""
import argparse, glob, hashlib, io, json, math, os, re, sys
import numpy as np
from PIL import Image

LOGICAL = (640, 360)          # runner's logical canvas
DPR = 2                       # atlas stored at 2x logical for sharp phones
VIEW_OX = 16                  # runner draws the whole cat 16 logical px to the right (room for the tail wave)
STAGE = (160, 120, 60, 20)    # runner stage padding (left, top, right, bottom) round the 640x360 frame
LAYOUT_W = 2048               # layout coordinates are 2048x1152 for the 640x360 frame (x3.2)
LAYOUT_PAD = tuple(round(v * LAYOUT_W / LOGICAL[0]) for v in STAGE)   # 512, 384, 192, 64
LIMBS4 = ["frontNear", "frontFar", "rearNear", "rearFar"]
BACK_FRONT = ["rearFar", "frontFar", "body", "rearNear", "frontNear"]
# Anatomical joints on the 2048x1152 layout (calibrated on lateral cat skeletons, see SPEC 4)
ANATOMY = {"tail": (530, 600), "rearNear": (585, 642), "rearFar": (600, 636),
           "frontNear": (1450, 640), "frontFar": (1465, 648)}
PAWS = {"frontNear": (1636, 951), "frontFar": (1326, 939), "rearNear": (429, 983), "rearFar": (772, 884)}
HERE = os.path.dirname(os.path.abspath(__file__))
# assemble: where each part's two landmarks land on the 2048x1152 layout
TARGETS = {"body": {"nose": (1713, 510), "tailBase": ANATOMY["tail"]},
           "tail": {"base": ANATOMY["tail"], "tip": (46, 258)},
           **{n: {"joint": ANATOMY[n], "paw": PAWS[n]} for n in ["frontNear", "frontFar", "rearNear", "rearFar"]}}
FEATHER = {"rearNear": (60, 140), "frontNear": (50, 120)}  # near legs: soft edge within (full, fade-out) px of the joint
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
# Tail wave (keep identical to the runner): angle_k = gait (k==0) + amp_k * sin(phase - k*lag)
WAVE_BASE_AMP, WAVE_TIP_AMP, WAVE_LAG = 3.0, 15.0, 0.75

errors, warns = [], []
LEGACY_OK = False
def err(m): errors.append(m); print("ERROR:", m)
def warn(m): warns.append(m); print("WARN: ", m)


def wave_amps(n, wave=None):
    if wave and "amp" in wave: return list(wave["amp"])[:n] + [wave["amp"][-1]] * max(0, n - len(wave["amp"]))
    if n == 1: return [0.0]
    return [WAVE_BASE_AMP + (WAVE_TIP_AMP - WAVE_BASE_AMP) * i / (n - 1) for i in range(n)]


def chroma_key(img):
    """Layer without transparency: key out the flat corner colour, then un-mix that colour from the
    semi-transparent edge pixels (C = a*F + (1-a)*BG  ->  F) so no coloured fringe/spill remains."""
    a = np.array(img.convert("RGB")).astype(np.float64)
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - 40) / 90, 0, 1)
    F = (a - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1e-3)
    F = np.clip(F, 0, 255)
    # spill suppression: the key channel may not exceed the larger of the other two
    kc = int(np.argmax(bg)); others = [c for c in range(3) if c != kc]
    if bg[kc] > 150 and bg[others].max() < 120:
        F[..., kc] = np.minimum(F[..., kc], F[..., others].max(-1))
    out = np.dstack([F, alpha * 255]).astype(np.uint8)
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


# ---------- transforms (same maths as the runner's canvas calls) ----------
def T(x, y): return np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)
def S(s): return np.array([[s, 0, 0], [0, s, 0], [0, 0, 1]], float)
def Rot(deg):
    t = math.radians(deg); c, s = math.cos(t), math.sin(t)   # canvas rotate(): clockwise on screen
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)
def about(at, deg): return T(*at) @ Rot(deg) @ T(-at[0], -at[1])


def angles_for(variant, pose, phase, wave_scale=1.0):
    """Per-piece rotation (deg) for a gait pose plus a tail-wave phase."""
    ang = {n: pose.get(n, 0) for n in LIMBS4}
    chain = variant.get("chains", {}).get("tail")
    if chain:
        amps = wave_amps(len(chain), variant.get("tailWave"))
        lag = (variant.get("tailWave") or {}).get("lag", WAVE_LAG)
        for i, n in enumerate(chain):
            ang[n] = (pose.get("tail", 0) if i == 0 else 0) + wave_scale * amps[i] * math.sin(phase - i * lag)
    else:
        ang["tail"] = pose.get("tail", 0)
    return ang


def piece_matrix(variant, name, ang, bob):
    p = variant["pieces"][name]; sc = p["scale"]; (jx, jy), (ax, ay) = p["joint"], p["at"]
    N = T(ax - jx * sc, ay - jy * sc) @ S(sc)                     # neutral placement
    if name == "body": return T(0, bob) @ N
    chain = variant.get("chains", {}).get("tail") or []
    if name in chain:
        M = np.eye(3)
        for j in chain[:chain.index(name) + 1]:                    # rotate about every ancestor joint
            M = M @ about(variant["pieces"][j]["at"], ang[j])
        return T(0, bob * 0.3) @ M @ N
    return T(0, bob * (0.3 if name == "tail" else 1)) @ about((ax, ay), ang.get(name, 0)) @ N


def render(variant, atlas, pose, R=1, margin=0, phase=0.0, wave_scale=1.0):
    W, H = LOGICAL[0] * R + 2 * margin, LOGICAL[1] * R + 2 * margin
    ang = angles_for(variant, pose, phase, wave_scale); bob = pose.get("bob", 0)
    out = {}
    for name in variant["order"]:
        x, y, w, h = variant["pieces"][name]["src"]
        crop = atlas.crop((x, y, x + w, y + h)).convert("RGBa")
        M = T(margin, margin) @ S(R) @ T(VIEW_OX, 0) @ piece_matrix(variant, name, ang, bob)
        Mi = np.linalg.inv(M)
        out[name] = crop.transform((W, H), Image.AFFINE, tuple(Mi[:2].ravel()), resample=Image.BICUBIC).convert("RGBA")
    return out


def composite(variant, layers, bg=(200, 225, 220, 255)):
    W, H = next(iter(layers.values())).size
    out = Image.new("RGBA", (W, H), bg)
    for n in variant["order"]: out.alpha_composite(layers[n])
    return out


def dilate(m, r=3):
    d = m.copy()
    for dy in (-r, 0, r):
        for dx in (-r, 0, r): d |= np.roll(np.roll(m, dy, 0), dx, 1)
    return d


def pose_phase(i): return i * 2 * math.pi / len(POSES)   # one tail wave per stride cycle


def check_poses(variant, atlas):
    M = 240
    order = variant["order"]; body_i = order.index("body")
    chain = variant.get("chains", {}).get("tail") or []
    lows = []
    for i, pose in enumerate(POSES):
        L = render(variant, atlas, pose, R=1, margin=M, phase=pose_phase(i))
        al = {n: np.array(L[n])[:, :, 3] > 64 for n in L}
        body = al["body"]; bdil = dilate(body)
        yy, xx = np.ogrid[:body.shape[0], :body.shape[1]]
        has = body.any(0); bottom = np.where(has, body.shape[0] - 1 - np.argmax(body[::-1], 0), -1)
        for n in LIMBS4 + ([chain[0]] if chain else ["tail"]):
            if not (al[n] & bdil).any(): err(f"pose {i}: {n} does not touch the body (floating)")
            if n in LIMBS4 and order.index(n) < body_i:
                pv = variant["pieces"][n]["at"]; bob = pose.get("bob", 0)
                near = (xx - (pv[0] + VIEW_OX + M)) ** 2 + (yy - (pv[1] + bob + M)) ** 2 < 26 ** 2
                exposed = int((al[n] & near & ~body & (yy < bottom[None, :])).sum())
                if exposed > 40: warn(f"pose {i}: {n} joint area shows outside the body ({exposed}px) — joint cap may be visible")
        for a, b in zip(chain, chain[1:]):
            ov = int((al[b] & dilate(al[a], 2)).sum())
            if ov == 0: err(f"pose {i}: {b} is detached from {a} (tail joint opens)")
            elif ov < 150: warn(f"pose {i}: {a}->{b} joint overlap is thin ({ov}px); enlarge the joint cap")
        union = np.zeros_like(body)
        for a in al.values(): union |= a
        L_, T_, R_, B_ = STAGE
        inside = union[M - T_:M + LOGICAL[1] + B_, M - L_:M + LOGICAL[0] + R_].sum()
        if union.sum() - inside > 30: warn(f"pose {i}: {union.sum() - inside}px of the cat fall outside the runner stage")
        legs = np.zeros_like(body)
        for n in LIMBS4: legs |= al[n]
        lows.append(int(np.nonzero(legs.any(1))[0].max()) - M)
    neutral = render(variant, atlas, {}, R=1, margin=M)
    legs = np.zeros_like(np.array(neutral["body"])[:, :, 3] > 64)
    for n in LIMBS4: legs |= np.array(neutral[n])[:, :, 3] > 64
    nlow = int(np.nonzero(legs.any(1))[0].max()) - M
    print(f"paw ground line: neutral y={nlow}, poses y={min(lows)}..{max(lows)} (logical px)")
    if not 296 <= nlow <= 326: warn(f"neutral paws end at y={nlow}; target is about 312 (wheel floor)")
    if max(lows) > 352: warn(f"a paw reaches y={max(lows)} in some pose; may sink into the wheel rim")


def check_tail_joints(variant, atlas):
    """Rotating segments open a wedge at the outer edge of a joint unless each segment carries a
    round joint cap. Measure that notch (morphological closing minus the tail) around every joint."""
    from scipy import ndimage
    chain = variant.get("chains", {}).get("tail") or []
    if len(chain) < 2: return
    st = ndimage.generate_binary_structure(2, 1); worst = {}; MG = 2 * max(STAGE)
    yy, xx = np.ogrid[:LOGICAL[1] * 2 + 2 * MG, :LOGICAL[0] * 2 + 2 * MG]
    for i, pose in enumerate(POSES):
        for ph in np.linspace(0, 2 * math.pi, 4, endpoint=False):
            L = render(variant, atlas, pose, R=2, margin=MG, phase=ph); u = np.zeros(yy.shape[:1] + xx.shape[1:], bool)
            for n in chain: u |= np.array(L[n])[:, :, 3] > 64
            notch = ndimage.binary_closing(u, structure=st, iterations=5) & ~u
            ang = angles_for(variant, pose, ph)
            for k, n in enumerate(chain[1:], start=1):
                Mx = np.eye(3)
                for j in chain[:k + 1]: Mx = Mx @ about(variant["pieces"][j]["at"], ang[j])
                ax, ay = variant["pieces"][n]["at"]
                w = T(MG, MG) @ S(2) @ T(VIEW_OX, pose.get("bob", 0) * 0.3) @ Mx @ np.array([ax, ay, 1])
                px = int((notch & ((xx - w[0]) ** 2 + (yy - w[1]) ** 2 < 40 ** 2)).sum())
                worst[n] = max(worst.get(n, 0), px)
    for n, px in worst.items():
        if px > 40: err(f"tail joint {n} opens a {px}px gap while waving — add a round joint cap as wide as the tail (SPEC 3)")
        elif px > 18: warn(f"tail joint {n} shows a small {px}px notch while waving; widen its joint cap")


def check_not_recolor(cat_dir, size, tail_names, origin=(0, 0)):
    """New cats must be newly painted. Recolouring the old tabby layers keeps their exact silhouette."""
    if LEGACY_OK: return
    p = os.path.join(HERE, "legacy_masks.npz")
    if not os.path.exists(p):
        warn("legacy_masks.npz not found next to build_cat.py; recolour check skipped"); return
    ref = np.load(p); same = []; X0, Y0 = -origin[0], -origin[1]
    def mask(n):
        a = np.array(Image.open(os.path.join(cat_dir, "layers", n + ".png")).convert("RGBA"))[:, :, 3] > 64
        return a[Y0:Y0 + 1152, X0:X0 + LAYOUT_W]
    for n in ["body"] + LIMBS4 + ["tail"]:
        a = mask(n) if n != "tail" else np.logical_or.reduce([mask(t) for t in tail_names])
        b = np.unpackbits(ref[n])[:a.size].reshape(a.shape).astype(bool)
        iou = (a & b).sum() / max((a | b).sum(), 1)
        if iou > (0.985 if n == "body" else 0.98): same.append(f"{n} {iou:.3f}")
    if len(same) == 1 and not same[0].startswith("body"):
        warn(f"{same[0].split()[0]} has the same silhouette as the old tabby layer; it must still be newly painted")
    elif same:
        err("silhouette identical to the existing tabby layers (" + ", ".join(same) + ") — "
            "recolouring the old art is not allowed; paint new layers per SPEC 3")


def tail_layers(cat_dir):
    segs = []
    while os.path.exists(os.path.join(cat_dir, "layers", f"tail{len(segs) + 1}.png")):
        segs.append(f"tail{len(segs) + 1}")
    if segs: return segs, True
    return ["tail"], False


def build(cat_dir, out_root):
    rig = json.load(open(os.path.join(cat_dir, "rig.json"), encoding="utf-8"))
    cid = rig["id"]; size = rig.get("canvas", [2048, 1152])
    ox, oy = rig.get("canvasOrigin", [0, 0])      # layout coordinate of image pixel (0,0); <=0 when padded
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(cid)): err(f"id '{cid}' must be lowercase letters, digits and '-'")
    if ox > 0 or oy > 0 or size[0] + ox < LAYOUT_W or size[1] + oy < 1152:
        err(f"canvas {size} with origin {[ox, oy]} must cover the 2048x1152 layout")
    k = LOGICAL[0] / LAYOUT_W; f = DPR * k
    pivots = rig.get("pivots", {})
    tails, segmented = tail_layers(cat_dir)
    if segmented and not 3 <= len(tails) <= 6:
        (warn if len(tails) == 2 else err)(f"tail has {len(tails)} segments; use 3-6 (4 recommended)")
    if not segmented and not LEGACY_OK:
        err("tail must be split into segments tail1.png ... tail4.png (SPEC 3); a single tail.png cannot wave")
    pieces_list = ["body"] + LIMBS4 + tails
    order = rig.get("order", tails + BACK_FRONT)
    if sorted(order) != sorted(pieces_list): err(f"order must list exactly {pieces_list}")
    crops, info, alphas = {}, {}, {}
    for n in pieces_list:
        path = os.path.join(cat_dir, "layers", n + ".png")
        if not os.path.exists(path): err(f"missing layers/{n}.png"); continue
        img = load_layer(path, size)
        if img is None: continue
        al = np.array(img)[:, :, 3]; alphas[n] = al
        ys, xs = np.nonzero(al > 8)
        if not len(xs): err(f"{n}.png is empty"); continue
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = img.crop((x0, y0, x1, y1))
        crops[n] = resize_premul(crop, (max(1, round(crop.width * f)), max(1, round(crop.height * f))))
        info[n] = (x0 + ox, y0 + oy, crop.width, crop.height)       # layout coordinates
        if n == "body": continue
        if n not in pivots: err(f"rig.json pivots.{n} missing"); continue
        px, py = pivots[n]; ipx, ipy = px - ox, py - oy               # image coordinates
        sy, sx = np.nonzero(al > 64)
        dist = float(np.sqrt(((sx - ipx) ** 2 + (sy - ipy) ** 2).min()))
        lim_err, lim_warn = (48, 2) if LEGACY_OK else (24, 4)
        if dist > lim_err: err(f"pivots.{n} {pivots[n]} is {dist:.0f}px away from the drawing in {n}.png — the part must be painted all the way up to its joint")
        elif dist > lim_warn: warn(f"pivots.{n} is {dist:.0f}px off the drawing in {n}.png; put it on the joint itself")
        anat = "tail" if n in ("tail", "tail1") else n
        if not LEGACY_OK and anat in ANATOMY:
            ax, ay = ANATOMY[anat]; dd = math.hypot(px - ax, py - ay)
            if dd > 120: err(f"pivots.{n} {pivots[n]} is {dd:.0f}px from the anatomical joint {ANATOMY[anat]} (SPEC 4)")
            elif dd > 60: warn(f"pivots.{n} is {dd:.0f}px from the anatomical joint {ANATOMY[anat]}; check against refs/02")
        if not LEGACY_OK and n in PAWS:
            ys2, xs2 = np.nonzero(al > 64); sel = ys2 > ys2.max() - 70
            cx, cy = xs2[sel].mean() + ox, ys2[sel].mean() + oy; pd = math.hypot(cx - PAWS[n][0], cy - PAWS[n][1])
            if pd > 90: warn(f"{n} paw is at ({cx:.0f},{cy:.0f}), {pd:.0f}px from its target {PAWS[n]} (SPEC 3)")
    if len(crops) == len(pieces_list): check_not_recolor(cat_dir, size, tails, (ox, oy))
    if errors: return None
    bal = alphas["body"]
    for n in LIMBS4 + tails[:1]:
        px, py = pivots[n]
        if bal[int(py - oy), int(px - ox)] < 64:
            err(f"pivots.{n} {pivots[n]} is outside the body silhouette — joints must sit inside the body")
    for a, b in zip(tails, tails[1:]):   # each tail joint must sit where parent and child overlap
        px, py = pivots[b]; ipx, ipy = int(px - ox), int(py - oy)
        if alphas[a][ipy, ipx] < 64 or alphas[b][ipy, ipx] < 64:
            err(f"pivots.{b} {pivots[b]} must lie inside both {a}.png and {b}.png (overlapping joint cap)")
        ov = (alphas[a] > 64) & (alphas[b] > 64)
        if ov.sum() < 1500: warn(f"{a}/{b} overlap only {ov.sum()}px; draw a round joint cap as wide as the tail")
    if errors: return None
    bw = info["body"][2] * k
    if not 380 <= bw <= 470: warn(f"body is {bw:.0f} logical px wide; reference is ~420 (cat will look bigger/smaller)")
    if size[0] < 1600: warn("layers are small; 2048x1152 recommended for sharp phones")

    pos, (AW, AH) = pack(crops)
    atlas = Image.new("RGBA", (AW, AH), (0, 0, 0, 0))
    for n, (x, y) in pos.items(): atlas.alpha_composite(crops[n], (x, y))
    pieces = {}
    for n in pieces_list:
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
    if segmented: variant["chains"] = {"tail": tails}
    if "tailWave" in rig: variant["tailWave"] = rig["tailWave"]
    if "poses" in rig: variant["poses"] = rig["poses"]

    atlas_dec = Image.open(io.BytesIO(buf.getvalue())).convert("RGBA")
    check_poses(variant, atlas_dec)
    check_tail_joints(variant, atlas_dec)
    if errors: return None

    od = os.path.join(out_root, cid); os.makedirs(od, exist_ok=True)
    open(os.path.join(od, "atlas.webp"), "wb").write(buf.getvalue())
    json.dump(variant, open(os.path.join(od, "variant.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    L_, T_, R_, B_ = STAGE; MP = 2 * max(STAGE)
    crop_box = (MP - 2 * L_, MP - 2 * T_, MP + 2 * (LOGICAL[0] + R_), MP + 2 * (LOGICAL[1] + B_))
    tiles = [composite(variant, render(variant, atlas_dec, p, R=2, margin=MP, phase=ph)).crop(crop_box)
             for p, ph in [({}, 0.0)] + [(p, pose_phase(i)) for i, p in enumerate(POSES)]]
    tw, th = tiles[0].size; sheet = Image.new("RGBA", (tw * 3, th * 3), "white")
    for i, t in enumerate(tiles): sheet.paste(t, ((i % 3) * tw, (i // 3) * th))
    sheet.convert("RGB").save(os.path.join(cat_dir, "preview.png"))
    if segmented:   # tail wave strip: 8 phases at the neutral pose
        strip = [composite(variant, render(variant, atlas_dec, {}, R=2, margin=MP, phase=j * math.pi / 4))
                 .crop((MP - 2 * L_, MP - 2 * T_, MP + 560, MP + 600)) for j in range(8)]
        tw2, th2 = strip[0].size; ws = Image.new("RGB", (tw2 * 4, th2 * 2), "white")
        for j, t in enumerate(strip): ws.paste(t.convert("RGB"), ((j % 4) * tw2, (j // 4) * th2))
        ws.save(os.path.join(cat_dir, "preview_tail.png"))
    print(f"atlas {AW}x{AH}, {len(buf.getvalue()) // 1024} KB -> {od}/atlas.webp")
    print(f"preview -> {os.path.join(cat_dir, 'preview.png')} (top-left = neutral, then poses 0-7)"
          + (f"; tail wave -> {os.path.join(cat_dir, 'preview_tail.png')}" if segmented else ""))
    return variant


def grid(path):
    from PIL import ImageDraw
    im = Image.open(path).convert("RGBA"); W, H = im.size
    bg = Image.new("RGBA", im.size, (90, 90, 90, 255)); bg.alpha_composite(im); d = ImageDraw.Draw(bg)
    step = 50 if max(W, H) <= 2200 else 100
    for x in range(0, W, step):
        d.line([(x, 0), (x, H)], fill=(255, 255, 0, 255) if x % (step * 4) == 0 else (0, 220, 255, 255), width=1)
        if x % (step * 2) == 0: d.text((x + 3, 3), str(x), fill=(255, 255, 0, 255))
    for y in range(0, H, step):
        d.line([(0, y), (W, y)], fill=(255, 255, 0, 255) if y % (step * 4) == 0 else (0, 220, 255, 255), width=1)
        if y % (step * 2) == 0: d.text((3, y + 3), str(y), fill=(255, 255, 0, 255))
    out = os.path.splitext(path)[0] + "_grid.png"; bg.convert("RGB").save(out); print("grid ->", out)


def similarity(s1, s2, d1, d2):
    """2-point similarity (uniform scale + rotation + translation) mapping s1->d1, s2->d2."""
    sv, dv = np.subtract(s2, s1), np.subtract(d2, d1)
    ls = math.hypot(*sv)
    if ls < 10: raise ValueError("landmarks are too close together")
    sc = math.hypot(*dv) / ls; rot = math.atan2(dv[1], dv[0]) - math.atan2(sv[1], sv[0])
    rot = (rot + math.pi) % (2 * math.pi) - math.pi
    c, s_ = math.cos(rot) * sc, math.sin(rot) * sc
    M = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]], float)
    t = np.subtract(d1, (M @ np.array([s1[0], s1[1], 1]))[:2]); M[0, 2], M[1, 2] = t
    return M, sc, math.degrees(rot)


def geodesic(mask, seed):
    """BFS distance (8-connected, px) from seed inside mask; -1 outside / unreachable."""
    from collections import deque
    H, W = mask.shape; g = np.full(mask.shape, -1.0); sx, sy = seed
    ys, xs = np.nonzero(mask)
    k = int(np.argmin((xs - sx) ** 2 + (ys - sy) ** 2)); sx, sy = int(xs[k]), int(ys[k])
    g[sy, sx] = 0; q = deque([(sx, sy)]); r2 = math.sqrt(2)
    while q:
        x, y = q.popleft(); gv = g[y, x]
        for dx, dy, w in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, r2), (1, -1, r2), (-1, 1, r2), (-1, -1, r2)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and mask[ny, nx] and g[ny, nx] < 0:
                g[ny, nx] = gv + w; q.append((nx, ny))
    return g


def split_tail(tail_img, base, n=4, overlap=14):
    """Cut an aligned full tail into n chained segments with round joint caps."""
    from scipy import ndimage
    A = np.array(tail_img); al = A[:, :, 3]; solid = al > 64
    lab, nl = ndimage.label(solid)
    if nl > 1:   # keep the biggest piece only (stray specks would break the walk)
        sizes = ndimage.sum(solid, lab, range(1, nl + 1)); solid = lab == (1 + int(np.argmax(sizes)))
    g = geodesic(solid, base); L = g.max()
    soft = (al > 8) & ~solid
    if soft.any():   # give anti-aliased edge pixels the distance of their nearest solid pixel
        _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True); g = np.where(soft, g[iy, ix], g)
    dt = ndimage.distance_transform_edt(solid)
    yy, xx = np.ogrid[:al.shape[0], :al.shape[1]]
    joints, segs = [], []
    for k in range(n):
        lo = k * L / n
        if k == 0: jx, jy = base
        else:
            band = solid & (np.abs(g - lo) < 2.5); by, bx = np.nonzero(band)
            jx, jy = float(bx.mean()), float(by.mean())
        joints.append((round(jx), round(jy)))
        hi = (k + 1) * L / n + (overlap if k < n - 1 else 1e9)
        m = (g >= lo) & (g < hi) & (al > 8)
        if k > 0:
            r = dt[int(round(jy)), int(round(jx))] + 4
            m |= ((xx - jx) ** 2 + (yy - jy) ** 2 <= r * r) & (al > 8)
        out = A.copy(); out[~m] = 0; segs.append(Image.fromarray(out))
    return segs, joints, L


def assemble(cat_dir):
    spec = json.load(open(os.path.join(cat_dir, "parts.json"), encoding="utf-8"))
    cid = spec["id"]; parts = spec["parts"]
    PL, PT, PR, PB = LAYOUT_PAD; size = (LAYOUT_W + PL + PR, 1152 + PT + PB)
    def img_xy(p): return (p[0] + PL, p[1] + PT)                  # layout -> padded image coordinates
    os.makedirs(os.path.join(cat_dir, "layers"), exist_ok=True)
    aligned, scales = {}, {}
    for name, tg in TARGETS.items():
        if name not in parts: err(f"parts.json: parts.{name} missing"); continue
        p = parts[name]; fpath = os.path.join(cat_dir, "parts", p.get("file", name + ".png"))
        if not os.path.exists(fpath): err(f"missing parts/{os.path.basename(fpath)}"); continue
        img = Image.open(fpath)
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA")
        if not has_alpha or np.array(img)[:, :, 3].min() == 255:
            warn(f"parts/{os.path.basename(fpath)} has no transparency; keying out flat background colour"); img = chroma_key(img)
        (k1, k2) = list(tg.keys())
        if k1 not in p or k2 not in p: err(f"parts.json: parts.{name} needs '{k1}' and '{k2}' points"); continue
        al = np.array(img)[:, :, 3]
        for kk in (k1, k2):
            x, y = p[kk]
            if not (0 <= x < img.width and 0 <= y < img.height): err(f"parts.{name}.{kk} {p[kk]} is outside the image {img.size}")
        try: Mx, sc, rot = similarity(p[k1], p[k2], img_xy(tg[k1]), img_xy(tg[k2]))
        except ValueError as e: err(f"parts.{name}: {e}"); continue
        scales[name] = sc
        if abs(rot) > 30: warn(f"{name} had to be rotated {rot:.0f} deg to fit; draw it closer to the reference orientation")
        Mi = np.linalg.inv(Mx)
        out = img.convert("RGBa").transform(size, Image.AFFINE, tuple(Mi[:2].ravel()), resample=Image.BICUBIC).convert("RGBA")
        if name in FEATHER:   # soften only the EDGE of the near leg round its joint (joint itself stays solid)
            from scipy import ndimage
            r0, r1 = FEATHER[name]; jx, jy = img_xy(tg["joint"])
            a = np.array(out); edt = ndimage.distance_transform_edt(a[:, :, 3] > 64)
            yy, xx = np.ogrid[:size[1], :size[0]]; d = np.sqrt((xx - jx) ** 2 + (yy - jy) ** 2)
            near = 1 - np.clip((d - r0) / (r1 - r0), 0, 1); near = near * near * (3 - 2 * near)
            edge = np.clip(edt / 22.0, 0, 1)
            a[:, :, 3] = (a[:, :, 3] * (1 - near * (1 - edge))).astype(np.uint8); out = Image.fromarray(a)
        aligned[name] = out
        print(f"{name:10s} scale x{sc:.3f}  rotate {rot:+.1f} deg")
    if errors: return False
    bs = scales["body"]
    for n, sc in scales.items():
        if n != "body" and not 0.7 <= sc / bs <= 1.4:
            warn(f"{n} was scaled x{sc / bs:.2f} relative to the body — its fur strokes will look {'thicker' if sc > bs else 'finer'}; draw parts at a similar size")
    b = np.array(aligned["body"])[:, :, 3] > 64
    if b[880 + PT:].sum() > 2000: warn("body has a lot of pixels near the ground line — the body part must not include legs")
    n_seg = int(spec.get("tailSegments", 4))
    segs, joints, L = split_tail(aligned["tail"], img_xy(ANATOMY["tail"]), n_seg)
    joints = [(x - PL, y - PT) for x, y in joints]
    print(f"tail       length {L:.0f}px -> {n_seg} segments, joints {joints}")
    for n in ["body", "frontNear", "frontFar", "rearNear", "rearFar"]:
        aligned[n].save(os.path.join(cat_dir, "layers", n + ".png"))
    for old in glob.glob(os.path.join(cat_dir, "layers", "tail*.png")): os.remove(old)
    for i, sg in enumerate(segs, 1): sg.save(os.path.join(cat_dir, "layers", f"tail{i}.png"))
    pivots = {n: list(ANATOMY[n]) for n in ["frontNear", "frontFar", "rearNear", "rearFar"]}
    for i, j in enumerate(joints, 1): pivots[f"tail{i}"] = list(j)
    rig = {"id": cid, "label": spec.get("label", cid), "canvas": list(size), "canvasOrigin": [-PL, -PT], "pivots": pivots}
    for k in ("tailWave", "poses"):
        if k in spec: rig[k] = spec[k]
    json.dump(rig, open(os.path.join(cat_dir, "rig.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    comp = Image.new("RGBA", size, (200, 225, 220, 255))
    for n in [f"tail{i}" for i in range(1, n_seg + 1)] + BACK_FRONT:
        comp.alpha_composite(segs[int(n[4:]) - 1] if n.startswith("tail") else aligned[n])
    comp.convert("RGB").save(os.path.join(cat_dir, "assembled.png"))
    print(f"layers/ + rig.json written; check {os.path.join(cat_dir, 'assembled.png')}")
    return True


def registry(root, default):
    vs = {}
    for d in sorted(os.listdir(root)):
        p = os.path.join(root, d, "variant.json")
        if os.path.exists(p): vs[d] = json.load(open(p, encoding="utf-8"))
    if not vs: err(f"no */variant.json under {root}"); return
    if default != "random" and default not in vs: err(f"--default {default} is not a built cat"); return
    js = ("/* CATTAIL running-cat variants. Generated by tools/cattail/build_cat.py registry; do not edit by hand. */\n"
          "window.CATTAIL_CAT_VARIANTS=" + json.dumps(vs, ensure_ascii=False, separators=(",", ":")) + ";\n"
          f"window.CATTAIL_CAT_DEFAULT={json.dumps(default)};\n")
    sys.stdout.write(js)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build"); b.add_argument("cat_dir"); b.add_argument("--out", required=True)
    b.add_argument("--allow-legacy", action="store_true", help="maintenance only: rebuild the old tabby-legacy art")
    r = sub.add_parser("registry"); r.add_argument("root"); r.add_argument("--default", default="random")
    g = sub.add_parser("grid"); g.add_argument("image")
    m = sub.add_parser("assemble"); m.add_argument("cat_dir"); m.add_argument("--build", action="store_true")
    m.add_argument("--out", default="sites/cattail/assets/cats")
    a = ap.parse_args()
    LEGACY_OK = bool(getattr(a, "allow_legacy", False))
    if a.cmd == "build": build(a.cat_dir, a.out)
    elif a.cmd == "grid": grid(a.image)
    elif a.cmd == "assemble":
        if assemble(a.cat_dir) and a.build and not errors:
            print("\n--- build ---"); build(a.cat_dir, a.out)
    else: registry(a.root, a.default)
    print(f"\n{len(errors)} error(s), {len(warns)} warning(s)", file=sys.stderr)
    sys.exit(1 if errors else 0)
