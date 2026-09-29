"""
The music box's plate: a tone map the browser engraves line by line as
the music plays (R = darkness, G = form), from a background-free cutout.

  python3 scripts/plate.py <folder with the originals>

Needs Pillow + NumPy (pip3 install pillow numpy).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "photos")

CUTOUT = "her-2-cutout.png"
CROP = (0, 20, 500, 640)    # head and shoulders, the big smile
WIDTH = 400


def blur(arr, r):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0


im = Image.open(os.path.join(SRC, CUTOUT)).convert("RGBA").crop(CROP)
h = round(im.size[1] * WIDTH / im.size[0])
im = im.resize((WIDTH, h), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255.0
rgb, alpha = a[..., :3], a[..., 3]
lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
lum = blur(lum, 0.8)
lum = np.clip(lum + 0.45 * (lum - blur(lum, 10)), 0, 1)
H, W = lum.shape
yy, xx = np.mgrid[0:H, 0:W]
# expose for her face, not the dark dress
face = (alpha > 0.5) & (yy < H * 0.5) & (xx > W * 0.2) & (xx < W * 0.8)
lo, hi = np.percentile(lum[face], 3), np.percentile(lum[face], 99)
dark = (1 - np.clip((lum - lo) / (hi - lo), 0, 1)) ** 1.85
oval = ((xx - W / 2) / (W * 0.485)) ** 2 + ((yy - H / 2) / (H * 0.485)) ** 2
bg = np.clip((1 - oval) * 2.2, 0, 1) * 0.08
tone = alpha * (0.14 + 0.86 * dark) + (1 - alpha) * bg
fade = np.clip((0.985 - yy / H) / 0.16, 0, 1)
tone = np.where(oval <= 1, tone * (alpha * fade + (1 - alpha)), 0)
form = blur((1 - dark) * alpha, 6.5)
rg = np.zeros((H, W, 3), dtype=np.uint8)
rg[..., 0] = (np.clip(tone, 0, 1) * 255).round()
rg[..., 1] = (np.clip(form, 0, 1) * 255).round()
Image.fromarray(rg).save(os.path.join(OUT, "musicbox-tone.png"), optimize=True)
print("musicbox-tone", W, H)
