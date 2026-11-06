# Content pipeline (build-time, offline-capable)

Follows docs/PLAN.md (Revisions 2 items 5–8, updated by Revisions 3). Shipped game
never depends on this pipeline at runtime. Log tools in docs/tooling.md, assets in ASSETS.md.

| # | Script | Model / tool | Status |
|---|---|---|---|
| 1 | `generate_art.py` | Muse Image `muse-image-1.0` | Verified in docs 2026-11-05. Needs `META_API_KEY`; dry-run manifest without it. |
| 2 | `segment_atlas.py` | SAM 3.1 `sam-3-1` + `toktx` | Verified in docs 2026-11-05. Layout plan until real art + toktx exist. |
| 3 | `generate_audio.py` | Muse Voice TTS | **Unavailable — dropped, never claim.** Transcription only. Fallback: `--engine sapi` offline clips. |
| 4 | `generate_packs.py` | Muse Glimmer (open weights) | **Not downloaded — needs user OK (~17 GB).** Until then: deterministic cross-check (article/plural/IPA/CEFR/example/helper) → `review.md`. |

## Run

```bash
python pipeline/generate_packs.py    # packs/en/*.json + pipeline/review.md (no key needed)
python pipeline/generate_art.py      # dry-run without META_API_KEY; real art with key in env
python pipeline/segment_atlas.py     # atlas-layout.json; KTX2 when art + toktx exist
python pipeline/generate_audio.py --engine sapi   # offline US clips (optional)
```

Gates: model verified + logged, assets recorded in ASSETS.md, review.md cleared by human,
packs validate (schema, duplicate ids, sceneLabel/propId XOR). `META_API_KEY`: env only, never commit.
