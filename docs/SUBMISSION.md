# Submission — Word: Wake Your Room

- **Name:** Word: Wake Your Room
- **Tagline:** The Hush stole your room's names. Poke, pinch, flick, and speak English to wake your real room back to life. (111 chars)
- **Track:** Gaming
- **Division:** New Experience
- **Live URL:** https://word-liard-beta.vercel.app/
- **Target launch date:** Live now for judging; public launch targeted Nov 17, 2026 (submission build frozen before Nov 18, 2026, 12:00pm PT; production stays live until winners are announced, ~Dec 11, 2026).

## Description (under 500 words)

**Inspiration.** Flashcard apps teach words in a vacuum, then learners forget them at home — exactly where they need them. We asked: what if your own room was the textbook? In *Word: Wake Your Room*, a fog called the Hush has stolen the names of everything around you. Your real table, door, window, wall, and couch sit gray and silent in passthrough. Name each one in English — by hand, in the place you will actually use the word — and it wakes with color and sound.

**Impact.** Word serves English learners ages 10+ at CEFR A1–A2, one of the largest learner groups in the world and one that quits flashcards at high rates. Context-dependent memory does the teaching: a word learned on your door is recalled at your door. Spaced repetition (SM-2-style scheduling, unit-tested) makes woken words fade toward gray where they are anchored in your room, so next-day review is walking back into your own space. Crucially, Word teaches what flashcards cannot: spatial prepositions and phrasal verbs through real space. Echo says "put the cup under the table" and you physically place the cup; the game grades the relation against your real table geometry. "Turn on the lamp" and "open the door" are built by snapping word tiles together in midair and performed on your real room.

**How it was built.** Hands-only IWSDK (TypeScript) on Quest Browser WebXR: scene-understanding labels claim real-room targets, a table diorama hosts Kitchen → Café → Market districts (80% unlock rule), Sentence Spells enforce stored article/adjective/plural grammar, and every AI feature ships with a working offline fallback — scripted Echo, seed packs, speechSynthesis-then-captions — so the full game plays with AI and network off. Budgets: <100 draw calls, ~150k visible triangles (code-side estimate ~20 calls / ≲16k tris), pooled effects, no real-time shadows.

**Future plans.** Live-verified Meta AI calls (Echo + room-aware packs), recorded pronunciation clips, more rooms/languages, Quest 3/3S device soak data published, then a public launch for home learners and classrooms.

## Meta technology used and how

| Technology | Actually used? | Feature it powers | Fallback (ships today) |
|---|---|---|---|
| IWSDK `@iwsdk/core` 1.1.0-rc.2 | **Yes** — scaffolded and running | Client runtime: immersive-AR passthrough session, hand tracking, grabbing, scene understanding, environment raycast (`iwsdk.config.json`: AR, anchors, plane/mesh detection, hit-test on; locomotion/physics off) | Raw WebXR APIs (hand-tracking, hit-test, plane/mesh detection, anchors) |
| Quest Browser WebXR (hand-tracking, passthrough, plane/mesh detection, anchors) | Code-complete; on-device verification pending (see `docs/QA.md`) | Real-room targets from semantic labels, table plane, table-relative label restore across sessions | "Pinch your table" setup, virtual tabletop at lap height, full-VR fallback room |
| Immersive Web Emulator (metaQuest3 + sunlit_living_room) | **Yes** — 2026-11-05 | Desktop dev/testing of XR sessions | Real Quest 3/3S testing |
| Muse Spark (`muse-spark-1.3`, Meta Model API) | **Not claimed as used** — API routes wired (`api/echo.ts`, `api/room-pack.ts`), docs-verified 2026-11-05, no live keyed call yet (no `META_API_KEY` in test env, re-checked 2026-11-10) | Echo agent lines; room-aware curriculum from semantic label names only (never geometry/camera data) | Scripted Echo lines; seed packs (`src/word/pack.ts`, `packs/en/*.json`). Routes validate strict JSON, rate-limit, cache; bad output is rejected, never executed |
| Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | **Not claimed as used** — client + server wired (`api/transcribe.ts`, `src/word/voice-wake.ts`), docs-verified 2026-11-05, no live keyed call yet | "Say it to wake it": opt-in 3-second `getUserMedia` clip, transcribed server-side, graded for intelligibility (minimal-pair/stress hints), never stored/logged | Head-gaze-pinch / ray-pinch multiple choice; speechSynthesis → caption audio chain |
| Muse Wonder (`muse-wonder-1.0`) | Build-time only — via coding-agent session for planning/docs/code assistance, logged in `docs/tooling.md`. No runtime API call. | Development assistance | n/a |
| Muse Image (`muse-image-1.0`) / SAM 3.1 (`sam-3-1`) | **Not used, never claim** — pipeline scripts + dry-run manifests only, no key in run, no images or cut-outs generated | (Planned: Atlas/mural sticker art + segmentation) | Procedural low-poly primitives + hand-authored seed content ship today |
| Muse Voice (speech generation) | **Dropped — never claim** — no speech-generation endpoint exists (docs-checked, re-checked 2026-11-10), no clips generated | (Was: pronunciation clips) | `speechSynthesis` (en-US default), else captions only |

**Gaze disclosure:** Quest 3/3S has no eye tracking. Everywhere Word says "gaze," it means **head gaze**: a head-gaze reticle plus pinch, completable one-handed.

**AI-generated art disclosure:** No AI-generated art ships in this build. All in-game visuals are procedural low-poly geometry (primitives), pooled particle/bloom effects, and hand-authored content data. Muse Image and SAM 3.1 were planned for sticker/mural art, were never run with a key, and generated nothing in the shipped build (`ASSETS.md`, `public/assets/*-manifest.json` are dry-run plans only). Any future AI-generated art will be recorded per-asset (model, prompt, date) in `ASSETS.md`.

## Hand interactions — and what excites us about VR

Everything in Word is hands-only, seated, within two-foot reach, and completable one-handed — no controller is ever required. You **poke** table-diorama props to hear their word; **pinch-and-pull** a glowing Word Sprite and **flick** it at a real-room target (aim assist curves sprites toward the nearest valid target within 15°, with forgiving thresholds for hand-tracking noise); **snap two word tiles together in midair** to build a Sentence Spell; **physically place a cup** under/on/next to your real table to answer a preposition quest; open your **palm** for the Atlas/quest/settings menu; **pinch-and-hold the mic orb** and speak (opt-in only, at first voice use); or use **head-gaze + pinch** for distant door/window/wall targets. What excites us about VR is exactly this: the room you already live in becomes the interface. When grammar is something you build with your hands and a preposition is a place you put a real cup, learning stops being screen time and becomes muscle memory in your own space — that presence, at real-world scale, could not exist on any other platform.

## Judge how-to-play (3 lines)

1. Pinch **Enter your room**, poke the glowing table to hear "table," then pinch-flick its sprite to wake it.
2. Snap "open" + "the door" together and flick to open the Kitchen; place the cup when Echo says "under the table."
3. Palm up for Atlas/quests; speak to the mic orb or head-gaze-pinch far targets — come back tomorrow to restore faded words.

## Screenshot shot list (5, real in-headset captures only)

1. **The Hush over a real room** — gray passthrough living room, fog sprites, sleeping labels on door/window/couch, Echo landing on open palm.
2. **First wake** — hand poking the glowing real table mid-bloom: warm color spreading, word + IPA caption visible.
3. **Pinch-flick in flight** — Word Sprite arcing from pinched fingers toward the real window, aim-assist trail, window half-woken.
4. **"Put the cup under the table"** — hand physically placing the diorama cup under the table edge, preposition quest card + Echo in frame.
5. **Next-day restore + progress** — faded due words in the room, Fluency Mural filled on the real wall, palm-up Atlas open showing district %.

Plus cover image: Shot 1 recomposed wider (real capture, no AI-generated imagery).

## Video script (under 3 minutes, real footage only)

Real Quest 3 footage only (emulator only where passthrough capture is impossible, disclosed on-screen). No AI-generated video. Hands visible within the first 30 seconds.

| Time | Beat | On screen / VO |
|---|---|---|
| 0:00–0:10 | **Story first** | Real room in passthrough, gray under the Hush. VO: "The Hush stole the names of everything in your room. Only you can wake it — in English." |
| 0:10–0:25 | **Hands in first 30s** | Bare hands enter frame. Poke the glowing table → "table" + IPA caption, table blooms awake. Pinch-pull a Word Sprite, flick it at the window; it wakes with color + sound. |
| 0:25–0:45 | **"Open the door"** | Snap "open" + "the door" tiles together in midair, flick the spell; the real door's district gate opens the Kitchen diorama on the table. Wake 2–3 props by poke/flick. |
| 0:45–1:15 | **"Put the cup under the table"** | Echo (caption + voice chain): "Put the cup under the table." Player physically places the cup under the real table; geometric check grades it, cup wakes. Quick cut: wrong placement gets a gentle hint, not a fail buzz. |
| 1:15–1:45 | **Echo talks about the real room** | Echo perched on table corner gestures at the player's actual couch/lamp; room-aware quest order highlights words for this room (label names only — on-screen privacy note). Palm-up Atlas + Fluency Mural on the real wall. |
| 1:45–2:15 | **Voice wake + Hush Rush** | Pinch-hold mic orb (consent shown once), say "lamp" — lamp wakes; "almost" hint demo on a minimal pair. 10s Hush Rush burst: fast flicks, combo counter, timer freezing when hands leave view. |
| 2:15–2:40 | **Next-day restore (end)** | "Tomorrow": same room, woken words faded toward gray. Player restores two by flick/voice; mural fills further, streak flame holds. VO: "Your room remembers. Day by day, it becomes fluent." End card: Word: Wake Your Room — live URL. |

## Honesty notes (mirrors `docs/tooling.md`)

- Only IWSDK, the Immersive Web Emulator, and build-time Muse Wonder (coding session) are claimed as used today.
- Muse Spark and Muse Voice Transcribe are wired with fallbacks and docs-verified, but **not claimed as used** until a keyed live call succeeds. The shipped game is complete with AI and network off.
- Muse Image / SAM 3.1 generated nothing; Muse Voice speech generation was dropped (no such endpoint). Never claim any of these.
- On-device Quest 3/3S QA rows in `docs/QA.md` are still to be filled; nothing above claims measured device fps — budget figures are code-side estimates until the device soak (A8) is recorded.
