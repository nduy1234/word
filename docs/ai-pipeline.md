# AI content pipeline (build-time)

All steps build-time and offline-capable. Shipped game never depends on this pipeline at
runtime. Verify each model's availability, endpoints, limits, and usage terms in the Meta
Model API docs before use — never guess model names or parameters. Log actual use in
`docs/tooling.md`; record each generated asset (model, prompt, date) in `ASSETS.md`.

## Steps

1. **Style first.** `docs/art.md` style sheet exists before any generation. One palette,
   one shape language for Echo, props, UI, stickers, mural tiles.
2. **Muse Image — art generation.** Generate Atlas sticker art (one per word), Fluency
   Mural tiles, cosmetic textures, in the `docs/art.md` style. Check usage terms first.
3. **SAM 3.1 — segmentation.** Cut generated images into alpha-masked stickers/mural
   pieces. Pack into ONE texture atlas (KTX2) per the performance budget.
   Runtime segmentation of passthrough: only if a public API exposes camera frames to
   the web app — verify first; otherwise build-time only.
4. **Muse Voice — pronunciation clips.** If speech generation is available, pre-generate
   clips for every seed word; ship with the app (works offline). Fallback: other
   license-compliant recorded audio, then `speechSynthesis`.
5. **Open-weights pack generation (Muse Glimmer or Muse Spark Open).** Local script
   batch-generates seed-pack drafts (translations, gender, example sentences). A second
   model cross-checks the first; disagreements flagged for human review — no auto-ship.
   Output lands in `packs/es/{room}.json` only after human approval + pack validation tests.

## Gates (all must pass before assets/content ship)

- Model availability + terms verified; `docs/tooling.md` status updated with evidence.
- Every generated asset recorded in `ASSETS.md` (model, prompt, date, license/terms basis).
- Pack validation tests pass (schema, gender, duplicate ids, sceneLabel/propId refs).
- Atlas fits budget: <100 draw calls, ~150k tris visible, KTX2, baked lighting.
