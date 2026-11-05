#!/usr/bin/env python3
"""Refine existing homepage photo at the same framing; no AI content changes.

The source asset hero.png is a JPEG encoded asset despite its extension.
Outputs have the exact same dimensions as the previous corresponding files.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps
import pillow_avif  # noqa: F401 - register AVIF encoder/decoder

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/"hero.png"
TARGETS={
    "hero-optimized.jpg": ("JPEG", 88),
    "hero-optimized.avif": ("AVIF", 81),
    "hero-mobile-520w.avif": ("AVIF", 81),
    "hero-mobile-360w.jpg": ("JPEG", 88),
}
def safe_image(path):
    with Image.open(path) as im:
        return ImageOps.exif_transpose(im).convert("RGB")

source=safe_image(SOURCE)
print(f"Source original: {SOURCE.name} size={source.size}, bytes={SOURCE.stat().st_size}")
for name,(fmt,quality) in TARGETS.items():
    output=ROOT/name
    previous=safe_image(output)
    w,h=previous.size
    ratio_delta=abs(source.width/source.height - w/h)
    if ratio_delta <= 0.015 and source.width >= w:
        basis=source.resize((w,h), Image.Resampling.LANCZOS) if source.size != (w,h) else source.copy()
        basis_name="original"
    else:
        basis=previous
        basis_name="existing (original ratio/resolution not suitable)"
    # Gentle edge recovery, no alterations to scene, logo, crop or colors.
    sharp=basis.filter(ImageFilter.UnsharpMask(radius=1.15,percent=108,threshold=3))
    old_bytes=output.stat().st_size
    kwargs={"format":fmt,"quality":quality}
    if fmt=="JPEG":
        kwargs.update({"optimize":True,"progressive":True, "subsampling":0})
    else:
        kwargs.update({"speed":6})
    sharp.save(output,**kwargs)
    new_bytes=output.stat().st_size
    # Avoid accidentally replacing a compressed hero with an unreasonably large file.
    cap=210_000 if w>520 else 135_000
    if new_bytes>cap:
        quality=77 if fmt=="JPEG" else 72
        sharp.save(output,**{**kwargs,"quality":quality})
        new_bytes=output.stat().st_size
    print(f"{name} dim={w}x{h} source={basis_name} old={old_bytes}B new={new_bytes}B")
    if new_bytes>max(cap*1.3, old_bytes*3):
        raise SystemExit(f"{name} unexpectedly large; refusing to commit")
