# Word — Project Instructions

Read docs/PLAN.md before every task.
Never commit secrets.
Never claim a Meta tool or model we didn't actually use. Log every Meta tool/model actually used in docs/tooling.md. Server-only: META_API_KEY lives in .env.local / Vercel env vars, never in client code.

IWSDK scaffold guidance lives in AGENTS.md (root) and src/AGENTS.md — follow them for SDK APIs. Never guess IWSDK/WebXR APIs; verify in scaffold, AGENTS.md, .claude/rules/, or IWSDK docs. Invoke the `iwsdk-dev` skill before building/extending app features.

## Product summary

Word is a hands-only mixed-reality language game for Meta Quest 3/3S: the Hush fog stole the names of everything in the player's real room.
Through passthrough and scene understanding, players poke, pinch, flick, speak, or gaze-pinch to name real and table-diorama objects in the target language, waking them with color and sound.
Faded words anchored in the room drive spaced-repetition review across days; built with IWSDK/TypeScript for the Meta VR Start Developer Competition 2026 (Gaming, New Experience).

## Hard rules

- Hands-only end to end; no controller ever required. Seated, within two-foot reach; no walking, no artificial locomotion.
- Real-room targets (door/window/wall/couch) woken by hand-ray pinch, flick, gaze-pinch, or voice — never poke/stand. Poke only for table diorama props.
- Cold start <5s; clean pause/resume on visibility loss / XR session end (save state, pause all timers). Satisfying moment in 3–10 min.
- Game complete with AI and network off. Original, not a wrapper.
- Min 60 fps on Quest 3/3S, target 72; no crashes; test in untested rooms. Budgets: <100 draw calls, ~150k tris visible, instanced props, one texture atlas, KTX2, baked lighting, no real-time shadows, pooled particles.
- English UI; target words always show English translation. Ages 10+. No brands/logos, no identifiable people. Licensed assets only, listed in ASSETS.md.
- Room geometry, scene data, and voice never leave device — except: semantic label names only for curriculum; voice clips only after opt-in consent, transcribed, never stored/logged (docs/PLAN.md Privacy). No analytics capturing room data. Never commit secrets.
- Head gaze = head-gaze reticle + pinch (Quest 3/3S has no eye tracking). Every mechanic completable one-handed.
- FoV: essential UI within ±25° central cone, lazy head-follow; readable min text size on Quest 3S; reduced-motion toggle.
- After Nov 18, 2026 12:00pm PT: no changes/deployments. Production stays live until winners announced (~Dec 11).

## Stack

- IWSDK 1.1.0-rc.2 (`@iwsdk/core`), TypeScript, Vite. Deploy on Vercel.
- Config authority: `iwsdk.config.json` (AR, handTracking, anchors, plane/mesh detection, hitTest, grabbing, sceneUnderstanding, environmentRaycast; locomotion + physics OFF). Import Three from `@iwsdk/core`, never `three`.
- Fallback to raw WebXR (hand-tracking, hit-test, plane-detection, mesh-detection, anchors) when IWSDK doesn't expose a feature.
- Immersive Web Emulator (IWER, metaQuest3 + sunlit_living_room) for dev; real Quest 3 test at least every other day; also test Quest 3S.
- Content packs: `packs/es/{room}.json`. SRS: FSRS-lite or SM-2, unit-tested.
- Server: Vercel API routes proxy Meta Model API; `META_API_KEY` server-only.

## Dev / build / test commands

```bash
npm run dev            # IWSDK CLI-managed dev server (managed browser + emulator) — not plain vite
npm run typecheck      # tsc --noEmit — always run before testing; type errors silently stop systems
npm run build          # vite build
npm run dev:status     # iwsdk dev status
npm test               # NOT yet configured — add vitest for scheduler/pack/spell tests in M1
```

## Working style

- Plan first: architecture, file tree, game-state diagram before code.
- Build in small commits. After each milestone: run it, fix bugs, report what works and what's next.
- Simplest robust option; note assumptions. Cut stretch scope before risking stability. Ask only if truly blocked.
- Error boundary around every system: failing feature disables itself and logs, never crashes session.
- Create docs/art.md style sheet before building any assets (done — docs/art.md).
- Web search: use Exa MCP tools (`mcp__exa__web_search_exa`, `mcp__exa__web_fetch_exa`) when available; do not use built-in WebSearch/WebFetch.
