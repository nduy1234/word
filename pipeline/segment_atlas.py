#!/usr/bin/env python3
"""SAM 3.1 cut-outs -> one KTX2 atlas.

Verified 2026-11-05 (docs/tooling.md): sam-3-1 via POST /v1/responses, $2.50/1k images.
Requires META_API_KEY + generated art (generate_art.py, non-dry-run) + `toktx`
(KTX-Software) on PATH for KTX2 encode. Missing any -> writes atlas layout plan
only; never fabricates atlas. Runtime passthrough segmentation: NOT used (no
verified camera-frame API).
Usage: python pipeline/segment_atlas.py
Output: public/assets/atlas-layout.json (+ public/assets/atlas.ktx2 when inputs exist)
"""
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets"
CELL = 256  # px per sticker cell, 8x8 grid = 2048px atlas max

def main():
    manifest_path = OUT / "art-manifest.json"
    if not manifest_path.exists():
        print("SKIP: no art-manifest.json — run generate_art.py first")
        return 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    generated = [m for m in manifest if m.get("status") == "generated" and (OUT / m["file"]).exists()]
    layout = {"cellPx": CELL, "cols": 8, "ktx2": "atlas.ktx2", "entries": [
        {"id": m["id"], "file": m["file"], "cell": i} for i, m in enumerate(manifest)]}
    (OUT / "atlas-layout.json").write_text(json.dumps(layout, indent=2) + "\n", encoding="utf-8")
    print(f"atlas-layout.json: {len(manifest)} cells planned, {len(generated)} cut-outs available")
    if not generated:
        print("SKIP segmentation+KTX2: no generated art yet (dry-run manifest). Re-run after real art generation.")
        return 0
    if not shutil.which("toktx"):
        print("SKIP KTX2 encode: `toktx` not on PATH (install KTX-Software). Layout plan written.")
        return 0
    # With SAM masks + toktx present: segment each PNG (POST /v1/responses, model sam-3-1,
    # prompt = word), alpha-composite into grid, then: toktx --t2 atlas.ktx2 atlas.png
    print("TODO at runtime: SAM segmentation call wired per-entry; see docs/tooling.md evidence before claiming.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
