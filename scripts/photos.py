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


def frontispiece(cutout, photo, crop, width=420):
    im = Image.open(os.path.join(SRC, cutout)).convert("RGBA").crop(crop)
    h = round(im.size[1] * width / im.size[0])
    im = im.resize((width, h), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    lum = blur(luminance(rgb), 0.8)
    lum = np.clip(lum + 0.75 * (lum - blur(lum, 10)), 0, 1)  # local contrast: features carry
    subj = lum[alpha > 0.5]
    lo, hi = np.percentile(subj, 2), np.percentile(subj, 98)
    dark = 1 - np.clip((lum - lo) / (hi - lo), 0, 1)
    dark = dark ** 1.45  # keep skin light, hair deep
    H, W = dark.shape
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy, rx, ry = W / 2, H / 2, W * 0.485, H * 0.485
    oval = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    bg = np.clip((1 - oval) * 2.2, 0, 1) * 0.085
    tone = alpha * (0.15 + 0.85 * dark) + (1 - alpha) * bg
    fade = np.clip((0.985 - yy / H) / 0.16, 0, 1)  # a vignetted bust: the bottom dissolves
    tone = np.where(oval <= 1, tone * (alpha * fade + (1 - alpha)), 0)
    disp = blur((1 - dark) * alpha, 6.5)
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
