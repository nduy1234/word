#!/usr/bin/env python3
"""Sticker + mural art via Muse Image (Meta Model API).

Verified 2026-11-05 (docs/tooling.md): muse-image-1.0, POST /v1/images/generations,
$0.01/image, 150 RPM. Requires META_API_KEY env (server/local only, never committed).
No key -> dry-run manifest only; NEVER fabricates image files.
Usage: python pipeline/generate_art.py [--dry-run]
Output: public/assets/art/{id}.png + public/assets/art-manifest.json
Style: docs/art.md — soft stylized low-poly, palette hexes below, no brands/people.
"""
import base64, json, os, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets"
API = "https://api.meta.ai/v1/images/generations"
MODEL = "muse-image-1.0"
STYLE = ("soft stylized low-poly sticker, rounded chunky silhouette, single dominant color block, "
         "warm off-white background #FFF4E0, ink outline #2D2438, teal #2EC4B6 amber #FFB43A coral #FF7A59, "
         "no text, no brands, no people, ages 10+ friendly")

def words():
    for p in sorted((ROOT / "packs/en").glob("*.json")):
        yield from json.loads(p.read_text(encoding="utf-8"))["words"]

def main():
    dry = "--dry-run" in sys.argv or not os.environ.get("META_API_KEY")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for w in words():
        if w["partOfSpeech"] != "noun":
            continue
        prompt = f"{STYLE}. Object: {w['word']}."
        item = {"id": w["id"], "file": f"art/{w['id']}.png", "model": MODEL, "prompt": prompt, "status": "planned-dry-run"}
        if not dry:
            req = urllib.request.Request(API, data=json.dumps(
                {"model": MODEL, "prompt": prompt, "size": "1024x1024"}).encode(),
                headers={"Authorization": f"Bearer {os.environ['META_API_KEY']}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            b64 = data["data"][0]["b64_json"]
            (OUT / item["file"]).parent.mkdir(parents=True, exist_ok=True)
            (OUT / item["file"]).write_bytes(base64.b64decode(b64))
            item["status"] = "generated"
        manifest.append(item)
        print(item["id"], item["status"])
    (OUT / "art-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{len(manifest)} stickers -> public/assets/art-manifest.json" + (" (dry-run: no key)" if dry else ""))
    return 0

if __name__ == "__main__":
    sys.exit(main())
