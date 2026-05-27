#!/usr/bin/env python3
"""Rebuild case TVK hero JPEGs from the raw screenshot master.

Reads:  assets/case-tvk-hero-source.jpg  (replace this when you have a new capture)
Writes: assets/case-tvk-hero.jpg (1x), assets/case-tvk-hero@2x.jpg (2x retina)

Pipeline: 1x → 4x LANCZOS → down to 2x (supersample, reduces JPEG blockiness), light
unsharp, high-quality progressive JPEG (4:4:4 chroma).

Requires: pip install pillow
Run from repo root: python3 scripts/enhance_case_tvk_hero.py
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageFilter

SOURCE_NAME = "case-tvk-hero-source.jpg"
OUT_1X = "case-tvk-hero.jpg"
OUT_2X = "case-tvk-hero@2x.jpg"


def _save_jpeg(path: Path, im: Image.Image, *, quality: int) -> None:
    im.save(
        path,
        format="JPEG",
        quality=quality,
        optimize=True,
        subsampling=0,
        progressive=True,
    )


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    assets = root / "assets"
    src_path = assets / SOURCE_NAME
    if not src_path.is_file():
        raise SystemExit(f"Missing raw master {src_path} (add screenshot, then run again)")

    src = Image.open(src_path).convert("RGB")
    w, h = src.size
    w4, h4 = w * 4, h * 4
    w2, h2 = w * 2, h * 2

    # Supersample via 4x intermediate (softer block edges than direct 2x from 1x).
    hi = src.resize((w4, h4), Image.Resampling.LANCZOS)
    up = hi.resize((w2, h2), Image.Resampling.LANCZOS)
    up = up.filter(ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=2))

    out_2x = assets / OUT_2X
    _save_jpeg(out_2x, up, quality=96)

    one = up.resize((w, h), Image.Resampling.LANCZOS)
    tmp = assets / ".case-tvk-hero-1x.tmp.jpg"
    _save_jpeg(tmp, one, quality=94)
    os.replace(tmp, assets / OUT_1X)

    out_1x = assets / OUT_1X
    print(f"Wrote {out_2x} ({up.size[0]}x{up.size[1]}, {out_2x.stat().st_size} bytes)")
    print(f"Wrote {out_1x} ({one.size[0]}x{one.size[1]}, {out_1x.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
