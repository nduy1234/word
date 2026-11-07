# Tooling log — Meta tools and models

Rule: only claim a Meta tool or model we actually used. Every entry below starts as
**Planned — unverified**. Before any entry can be claimed in the submission, verify
availability, endpoints, limits, and usage terms in the Meta Model API docs, then update
Status, Verified date, and Evidence. If a model isn't available to us, drop the feature
and mark the entry **Dropped — never claim it**.

| Tool / model | Status | Powers (feature) | Offline fallback | Verified | Evidence |
|---|---|---|---|---|---|
| Muse Wonder (via coding agent, Claude Code session) | Used — docs/planning only | Plan merge, docs, later code assistance | n/a (build-time) | 2026-11-05 | This session: `docs/PLAN.md`, `CLAUDE.md`, this file |
| IWSDK (`@iwsdk/core` 1.1.0-rc.2, Create CLI 1.1.0-rc.2) | Used — scaffolded 2026-11-05, M1 slice running in emulator | Client runtime: hand tracking, grabbing, passthrough (immersive-ar), scene understanding, environment raycast | Raw WebXR APIs (hand-tracking, hit-test, plane-detection, mesh-detection, anchors) | 2026-11-05 | `iwsdk.config.json`: AR, grabbing, sceneUnderstanding, environmentRaycast on; locomotion/physics off. Dev server + immersive-ar session + fallback diorama verified in Immersive Web Emulator 2026-11-05 |
| `@meta-quest/metavr` ^1.8.1 (devDependency, bundled by scaffold) | Installed — not yet used | Quest device control / on-device test loop, Horizon doc search, 3D asset catalog | Manual Quest testing via dev-server network URL | — | Present in `package.json`; claim only after first actual use |
| Quest Browser WebXR (hand-tracking, passthrough, plane/mesh detection, anchors) | Planned — unverified | Real-room targets, table plane, spatial anchors | Manual "pinch your table" setup; virtual tabletop; full-VR room | — | Needs on-device test |
| Immersive Web Emulator (metaQuest3 + sunlit_living_room) | Used — 2026-11-05 | Desktop dev/testing of XR sessions | Real Quest 3/3S testing | 2026-11-05 | IWSDK CLI-managed browser: immersive-ar session entered, room + fallback diorama rendered |
| Muse Voice Transcribe | Verified in docs 2026-11-05 — not yet used | "Say it to wake it": server-side transcription of 3s `getUserMedia` clips (opt-in, never stored/logged) | Gaze-pinch multiple choice | 2026-11-05 | Meta Model API docs: `muse-voice-transcribe-1.0`, `POST /v1/asr/transcribe` (realtime variant exists), $3.00/1000 min, 256 concurrent streams. Must verify `getUserMedia` on Quest Browser first |
| Muse Spark | Verified in docs 2026-11-05 — API routes wired 2026-11-06 (`api/echo.ts`, `api/room-pack.ts`, model `muse-spark-1.3`, strict JSON + schema validation, rate limit + cache, scripted/seed fallback when no key/upstream fails — not claimed as used until a live key call succeeds) | Echo agent lines; room-aware curriculum from semantic labels only | Scripted Echo lines; seed packs (`packs/en/{room}.json`) | 2026-11-05 | Meta Model API docs: `muse-spark-1.3` / `1.2` / `1.1` on `https://api.meta.ai/v1`, Bearer auth, OpenAI/Anthropic SDK compatible; 1.1 = 3000 RPM / 4M TPM, $1.25/$4.25 per Mtok |
| Muse Wonder | Verified in docs 2026-11-05 — used via coding session only | Echo agent lines (candidate) | Scripted Echo lines | 2026-11-05 | Meta Model API docs: `muse-wonder-1.0`, $4/$20 per Mtok, 1M context. API use not yet made; coding-session use logged in row 1 |
| Muse Voice (speech generation) | Dropped — never claim it | Runtime: speak Echo's generated lines. Build-time: pre-generate pronunciation clips for all seed words (shipped offline) | Runtime: `speechSynthesis`, else captions only. Build-time: other license-compliant recorded audio | 2026-11-05 | Meta Model API docs checked 2026-11-05: Voice API is transcription only; no speech-generation endpoint offered. Feature dropped per rule |
| Muse Image | Verified in docs 2026-11-05 — pipeline script written 2026-11-06, art not yet generated (dry-run manifest only, no key in run) | Build-time: Atlas sticker art, Fluency Mural tiles, cosmetic textures (style from `docs/art.md`) | Hand-made / licensed assets listed in `ASSETS.md` | 2026-11-05 | Meta Model API docs: `muse-image-1.0`, `POST /v1/images/generations` and `/v1/images/edits`, $0.01/image, 150 RPM. Record model, prompt, date per asset in `ASSETS.md`. Script: `pipeline/generate_art.py` |
| SAM 3.1 | Verified in docs 2026-11-05 — pipeline script written 2026-11-06, no cut-outs yet (layout plan only) | Build-time: segment generated images into alpha cut-out stickers/mural pieces for one texture atlas | Manual masking | 2026-11-05 | Meta Model API docs: `sam-3-1` via Responses API `POST /v1/responses`, $2.50/1k images, 3000 RPM. Runtime passthrough segmentation not used (no verified camera-frame API). Script: `pipeline/segment_atlas.py` |
| Muse Glimmer (open weights) | Verified in docs 2026-11-05 — not downloaded (needs explicit user OK) | Build-time, local script: batch-generate + cross-check offline seed packs; disagreements flagged for human review. Until downloaded: deterministic cross-check in `pipeline/generate_packs.py` → `pipeline/review.md` | Hand-authored seed packs | 2026-11-05 | HF `meta-models/Muse-Glimmer-30B`, Apache 2.0; lightest GGUF Q4 ≈ 17 GB — do not download without explicit user OK |
| Muse Spark Open (open weights) | Dropped — never claim it | (Was: second cross-check model) | Muse Glimmer alone + human review | 2026-11-05 | 816B MoE, BF16 ≈ 1.6 TB across 65 shards — impossible on a laptop |
| Muse Code | Planned — unverified | Build-time coding assistance, if available | Claude Code session only | — | Use only if actually available to us |
| Meta XR Operator | Planned — unverified | Automated device QA, if available | Manual QA checklist in `docs/PLAN.md` | — | Use only if actually available to us |
| Agentic Tools (Skills) | Planned — unverified | Workflow automation where it fits | Manual workflow | — | Use only if actually available to us |

## Server key handling

- `META_API_KEY` is a dedicated Meta API key — separate from any Claude Code credentials.
- Local: `.env.local` (gitignored). Production: Vercel environment variables.
- Read only by Vercel API routes (server). Never exposed to the client, never committed.
