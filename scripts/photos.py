"""
Prepares her photographs for the site (run once after changing photos):

  python3 scripts/photos.py <folder with the originals>

- the frontispiece: a tone map (R = darkness, G = form displacement) that
  the browser engraves into lines, plus the colour photograph
- the plates: a colour JPEG and an ink-on-paper duotone of each

Needs Pillow + NumPy (pip3 install pillow numpy).
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "photos")
os.makedirs(OUT, exist_ok=True)

INK = np.array([28, 27, 43], dtype=np.float32)
PAPER = np.array([244, 238, 227], dtype=np.float32)


def blur(arr, r):
    return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def gblur(arr, r):
    """Gaussian blur (sigma r px) on a float array, edges reflected. NumPy only."""
    if r <= 0:
        return arr.astype(np.float32).copy()
    n = int(np.ceil(r * 3))
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / r) ** 2)
    k = (k / k.sum()).astype(np.float32)
    out = np.pad(arr.astype(np.float32), ((0, 0), (n, n)), mode="reflect")
    out = sum(k[i] * out[:, i : i + arr.shape[1]] for i in range(2 * n + 1))
    out = np.pad(out, ((n, n), (0, 0)), mode="reflect")
    return sum(k[i] * out[i : i + arr.shape[0], :] for i in range(2 * n + 1)).astype(np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def frontispiece(cutout, photo, crop, width=420):
    im = Image.open(os.path.join(SRC, cutout)).convert("RGBA").crop(crop)
    h = round(im.size[1] * width / im.size[0])
    im = im.resize((width, h), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    H, W = alpha.shape
    yy, xx = np.mgrid[0:H, 0:W]

    lum = gblur(0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2], 0.7)
    cr = 0.5 + 0.5 * rgb[..., 0] - 0.418688 * rgb[..., 1] - 0.081312 * rgb[..., 2]

    # skin: warm (Cr), not too dark, inside the figure
    skin = smoothstep(0.545, 0.575, gblur(cr, 1.0)) * smoothstep(0.10, 0.2, lum) * (alpha > 0.5)
    skin = np.clip(gblur(skin, 1.2), 0, 1)

    # light the skin evenly: lift its shading toward its own bright level
    # (a skin-only local mean, so the hair never bleeds in), keep the features
    base = gblur(lum * skin, 9.0) / (gblur(skin, 9.0) + 1e-4)
    ref = np.percentile(lum[skin > 0.8], 85)
    lifted = np.maximum(base + (ref - base) * 0.72, base)
    lum = lum * (1 - skin) + (lifted + (lum - base) * 1.45) * skin

    lum = np.clip(lum + 0.48 * (lum - gblur(lum, 10.0)), 0, 1.2)  # local contrast: features carry
    subj = lum[alpha > 0.5]
    lo, hi = np.percentile(subj, 2), np.percentile(subj, 98.5)
    dark = (1 - np.clip((lum - lo) / (hi - lo), 0, 1)) ** 1.7  # keep the lit face near white

    hair = (1 - skin) * smoothstep(0.45, 0.75, dark)
    dark = dark + (1 - dark) * hair * 0.6  # hair toward black, sheen kept
    clothes = (1 - skin) * (1 - smoothstep(0.35, 0.6, dark)) * smoothstep(0.55, 0.75, yy / H)
    dark = dark + (1 - dark) * clothes * 0.12  # the clothes get a light tone

    # the lock of hair that falls along her jaw on the left: in ink alone a
    # dark mass hugging the jawline reads as a shadow on the chin, so let it
    # fall back to a soft mid-tone right beside the face
    lock = np.exp(-(((xx / W - 0.27) / 0.09) ** 2 + ((yy / H - 0.57) / 0.13) ** 2))
    dark = dark * (1 - 0.68 * lock * (1 - skin))

    cx, cy, rx, ry = W / 2, H / 2, W * 0.485, H * 0.485
    oval = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    bg = np.clip((1 - oval) * 2.2, 0, 1) * 0.055  # a faint ruled background
    tone = alpha * (0.04 + 0.96 * dark) + (1 - alpha) * bg
    fade = np.clip((0.985 - yy / H) / 0.16, 0, 1)  # a vignetted bust: the bottom dissolves
    tone = np.where(oval <= 1, tone * (alpha * fade + (1 - alpha)), 0)
    disp = gblur((1 - dark) * alpha, 6.5)

    rg = np.zeros((H, W, 3), dtype=np.uint8)
    rg[..., 0] = (np.clip(tone, 0, 1) * 255).round()
    rg[..., 1] = (np.clip(disp, 0, 1) * 255).round()
    Image.fromarray(rg).save(os.path.join(OUT, "frontispiece-tone.png"), optimize=True)
    col = Image.open(os.path.join(SRC, photo)).convert("RGB").crop(crop)
    col = col.resize((720, round(col.size[1] * 720 / col.size[0])), Image.LANCZOS)
    col.save(os.path.join(OUT, "frontispiece.jpg"), quality=84, optimize=True, progressive=True)
    print("frontispiece", W, H)


def plate(name, photo, crop=None, width=1100):
    im = Image.open(os.path.join(SRC, photo)).convert("RGB")
    if crop:
        im = im.crop(crop)
    if im.size[0] > width:
        im = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
    im.save(os.path.join(OUT, f"plate-{name}.jpg"), quality=82, optimize=True, progressive=True)
    g = luminance(np.asarray(im).astype(np.float32) / 255.0)
    lo, hi = np.percentile(g, 1), np.percentile(g, 99.5)
    g = np.clip((g - lo) / (hi - lo), 0, 1) ** 0.92
    duo = (INK * (1 - g[..., None]) + PAPER * g[..., None]).astype(np.uint8)
    Image.fromarray(duo).save(os.path.join(OUT, f"plate-{name}-duo.jpg"), quality=80, optimize=True, progressive=True)
    print("plate", name, im.size)


frontispiece("her-cutout.png", "her.jpg", (70, 58, 590, 700))
plate("scherzando", "her-2.jpg", (0, 0, 500, 860))
plate("dolce", "her-3.jpg", (0, 0, 548, 930))
plate("notturno", "IMG_4735.jpg", (300, 20, 920, 917))
plate("tutti", "IMG_4732.jpg")
plate("crescendo-2025", "IMG_4733.jpg", (330, 0, 1100, 700))
plate("crescendo-2026", "IMG_4731.jpg", (380, 0, 960, 600))
