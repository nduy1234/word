#!/usr/bin/env python3
"""US English pronunciation clips for every seed word (UK optional).

Meta status (verified 2026-11-05, docs/tooling.md): Muse Voice = transcription
only, NO speech-generation endpoint -> Dropped, never claim it.
This script therefore writes the clip manifest and, only if a local TTS engine
is explicitly selected, renders clips. No engine -> manifest only, no fake mp3s.
Engines: --engine sapi (Windows System.Speech, offline) | none (default)
Usage: python pipeline/generate_audio.py [--engine sapi] [--uk]
Output: public/assets/audio/en-US/{id}.mp3|wav + public/assets/audio-manifest.json
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets"

def words():
    for p in sorted((ROOT / "packs/en").glob("*.json")):
        yield from json.loads(p.read_text(encoding="utf-8"))["words"]

def main():
    engine = "sapi" if "--engine" in sys.argv and sys.argv[sys.argv.index("--engine") + 1] == "sapi" else "none"
    locales = ["en-US", "en-GB"] if "--uk" in sys.argv else ["en-US"]
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for locale in locales:
        for w in words():
            rel = f"audio/{locale}/{w['id']}.wav"
            item = {"id": w["id"], "locale": locale, "text": w["word"], "file": rel,
                    "engine": engine, "status": "planned-no-engine"}
            if engine == "sapi":
                target = OUT / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                ps = (f"Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                      f"$s.SetOutputToWaveFile('{target}'); $s.Speak('{w['word']}'); $s.Dispose()")
                subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
                item["status"] = "generated-sapi"
            manifest.append(item)
    (OUT / "audio-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{len(manifest)} clip entries -> public/assets/audio-manifest.json (engine={engine})")
    if engine == "none":
        print("SKIP render: Muse Voice TTS unavailable (dropped). Re-run with --engine sapi for offline Windows TTS.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
