# Word: Wake Your Room — Plan

Product name: **Word** (display title: "Word: Wake Your Room").

Build "Word" for the Meta VR Start Developer Competition 2026.

- Track: Gaming. Division: New Experience.
- Judged on Meta Quest 3/3S. Deadline: Nov 18, 2026, 12:00pm PT. Internal deadline: Nov 17.
- Judging: four equally weighted criteria — Innovation, Experience Design, Technical Implementation, Polish. Every decision should raise one of them.

## Concept

A fog called the Hush stole the names of everything in YOUR room. Through passthrough, your real table, walls, door, window, and couch look gray and silent. Name each one in the target language and it wakes up with color, sound, and life. Your real room becomes the level, and day by day it becomes fluent. This needs presence, real-world scale, and hands, so it couldn't exist on any other platform.

## Hard requirements (all must pass)

1. **Hands-only, end to end.** No controller is ever needed. Controllers can be supported, but never required.
2. **Seated, within a two-foot reach.** No walking. Things come to you: the play surface is your real table, reachable without standing.
   - Real-room targets (door, window, wall, couch) are beyond a two-foot reach: wake them with hand-ray pinch, flick, gaze-pinch, or voice. Never require poking them or standing up.
   - Poke is only for props on the table diorama.
   - Aim assist: flicked sprites curve toward the nearest valid target within 15°.
   - Forgiving pinch and flick thresholds so hand-tracking noise never causes a miss.
3. **Fast in and out.** Cold start under 5 seconds. Clean pause and resume: save state when the page is hidden or the XR session ends. A complete satisfying moment in 3–10 minutes.
4. **Original, not a wrapper.** The game is complete with AI and network turned off (the "take it away" test: every Meta AI feature below has an offline fallback).
5. **Performance.** Minimum 60 fps on Quest 3/3S; target 72 fps. No crashes. Test in rooms we've never used.
6. **Content rules.**
   - English UI. Target-language words always show the English translation.
   - Suitable for ages 10+.
   - No brands or logos, and no identifiable people.
   - Licensed assets only, listed in `/ASSETS.md`.
7. **Privacy and policy** (see Privacy section below — replaces the original "voice never leaves the device" line):
   - Room geometry and camera data never leave the device. Only semantic label names are sent, for the room-aware curriculum.
   - Voice is sent only after the player opts in at first mic use. It is transcribed and never stored or logged.
   - No analytics that capture room data.
   - One-line privacy note on the launch page says exactly this.

## Entry and permissions

- Launch page: one big "Enter your room" button, a small "Play in VR instead" link, and a 3-line explanation.
- Ask for spatial-data permission when entering MR. If denied, go straight to the "pinch your table" setup, or the VR room.
- Ask for microphone only when the player first chooses voice, never at launch.
- If Quest has no space setup, show a friendly one-line prompt with a "skip" option that uses the fallback.
- Submission launch copy (same page): a "Start in mixed reality" button, a VR fallback button, and a 3-line "how to play" note for judges — aligned with the entry above.

## Stack

- IWSDK: `npm create @iwsdk@latest`, TypeScript. Deploy on Vercel.
- Read the IWSDK docs and the generated scaffold before writing code. Use IWSDK's hand tracking, grabbing, passthrough (immersive-ar), and scene-understanding features.
- If a feature isn't exposed, use the underlying WebXR API directly: hand-tracking, hit-test, plane-detection, mesh-detection, anchors. Never guess APIs; verify them.
- Server: Vercel API routes as a proxy to the Meta Model API. The server reads `META_API_KEY` (a dedicated Meta API key, separate from any Claude Code credentials) from `.env.local` locally and from Vercel environment variables in production. The key never reaches the client.
- Develop with the Immersive Web Emulator, and test on a real Quest 3 at least every other day. Also test Quest 3S.

## Mixed reality: purposeful passthrough

- **Scene understanding:** read detected planes and meshes plus their semantic labels (for example table, wall, floor, door, window, couch, lamp, plant, screen, storage). Each labeled surface becomes an unnamed object to wake, using its real-world word (la mesa, la pared, la puerta, la ventana, el sofá).
  - Scene labels may be "other," duplicated, or missing. Skip unknown labels, keep at most one target per label, and pad with diorama words so every room has at least 10 targets.
- **Table as play surface:** find the nearest table plane at seated height and grow a small diorama on it (kitchen, café, market) with 10–15 props to wake.
- **Walls host content:** the day's quest card and a "Fluency Mural" pin to the nearest wall in your view. The mural is a living painting that fills in as your room becomes fluent and is your visible progress between sessions. The Mystery Board appears only if Room Mysteries ship (stretch).
- **Spatial anchors:** anchor woken labels and the diorama. Use persistent anchors if Quest Browser supports them (verify); otherwise store positions relative to the table plane. Your room remembers what you've named across sessions, which is the reason to come back.
  - If anchor relocalization fails or drifts: re-place everything relative to the table plane. Never show floating labels in wrong spots.
- **Rooms we never tested:**
  - If no scene data exists, run a 10-second setup: "pinch your table," using hand-ray hit-test.
  - If there's no table, float a virtual tabletop at lap height.
  - If passthrough isn't available, use a cozy full-VR room with the same gameplay.
  - Handle small rooms, unusual labels, and missing walls without errors.
- The experience must clearly change because of your room. With passthrough off, it falls back to the VR room; it doesn't play identically.

## Robustness

- **Hand-tracking loss** (low light, hands out of view): pause timers, show a soft "show your hands" ghost, and resume automatically.
- **Anchor relocalization fails or drifts:** re-place everything relative to the table plane (see Mixed reality).
- **Scene labels:** skip unknown, dedupe to one target per label, pad with diorama words to ≥10 targets (see Mixed reality).
- **Pause/resume:** on visibility loss or opening the system menu, pause all timers (including Hush Rush), save state, and resume exactly where the player left off.
- Error boundary around every system: a failing feature disables itself and logs the problem instead of crashing the session.
- QA checklist on device before code freeze:
  - unscanned room
  - no table
  - small room
  - dim light
  - permission denied
  - offline
  - 10 enter/exit cycles
  - a 30-minute soak test at 60+ fps

## Hands-first interactions (teach each one by showing, never with text)

- **Poke** an object to hear its word (pre-recorded/pre-generated audio plus a caption). Poke is only for props on the table diorama — real-room targets are beyond reach (see Hard requirements).
- **Pinch and pull** a glowing Word Sprite out of the air, then **flick** it at the matching object. A correct hit wakes the object. A wrong hit makes the sprite bounce back with a gentle hint. Aim assist curves sprites toward the nearest valid target within 15°; thresholds are forgiving.
- **Sentence Spells (signature mechanic):** pinch two word tiles and snap them together in midair like magnets ("abre" + "la ventana"), then flick the spell. The virtual window shutters on your real window open and a breeze plays. Grammar becomes something you build with your hands. Start with 8 verbs and a slot grammar: verb + object, adjective + noun, with gender agreement shown by the tile color snapping.
- **Palm-up menu:** look at your open palm to see the Atlas, today's quest, and settings. Pinch to select.
- **Alternatives (Accessibility):**
  - Voice: say the word to wake the object you're facing (see Meta AI runtime features — Muse Voice Transcribe). Microphone permission is requested only at first voice use (see Entry and permissions). Mic input: record 3-second clips with `getUserMedia`, after verifying `getUserMedia` works on Quest Browser.
  - Head-gaze plus pinch: a reticle that works one-handed. Quest 3/3S has no eye tracking, so "gaze" means head gaze — state this explicitly in the submission.
  - Every mechanic must be completable one-handed.
- **Accessibility additions:**
  - High-contrast mode.
  - Colorblind-safe "awake" indicator (outline plus icon, not color alone).
  - Adjustable caption size.
  - Every action gets both audio and visual feedback, since hand tracking has no haptics.
  - Test on Quest 3S as well as Quest 3 for FoV and text legibility.

## Core loop

1. **Explore:** look around your room and table; unnamed things shimmer.
2. **Discover:** poke to hear and collect a Word Sprite.
3. **Name it:** a quest asks you to wake "la ventana" by flicking, speaking, or gaze-pinching.
4. **Wake it:** color, sound, particles; the Hush recedes from that spot.
5. **Fade = review:** spaced repetition (FSRS-lite or SM-2, unit-tested) makes due words fade toward gray where they're anchored in your room. Restoring them is the review session.

## Game systems (in scope)

- **Hush Rush:** a 60-second arcade mode where fog rolls across your real table and you flick due words fast. Combo multipliers and a personal best. Timers pause on hand-tracking loss, visibility loss, and system menu (see Robustness).
- **Echo:** a small spirit that perches on your hand or table, models pronunciation, cheers streaks, and evolves through 3 forms as your Atlas grows. Echo is a voice-first Meta AI agent (see Meta AI runtime features).
- **Atlas:** a sticker book on the palm menu with rarity, a gold "mastered" border, and per-room %.
- **Fluency Mural:** living painting on the nearest wall that fills in as the room becomes fluent; visible progress between sessions (see Mixed reality).
- **Progression:**
  - Your real room is the "home district."
  - Diorama districts unlock in order: Kitchen → Café → Market, each at 80% of the previous one awake.
  - Daily Fog: 3 minutes of due reviews plus 2 new words.
  - Streak flame with 2 free freezes per week, so a missed day never wipes progress.
- **Cosmetics:** petals earned in play buy Echo hats and room decor. No paid currency.
- **Stretch only if everything above is polished:** Room Mysteries (adds the Mystery Board to walls) and co-presence multiplayer. Skip both if time is short; each entry can win only one prize, so polish matters more than breadth. (AI-voiced Echo dialog is no longer stretch — it is in scope as a Meta AI runtime feature with a scripted-lines fallback.)

## Meta AI tooling

**Principle:** Meta AI makes the game personal, playable by voice, and beautiful, but every feature has an offline fallback, so the core game still works with AI and network removed. Before coding, verify each model's availability, endpoints, limits, and usage terms in the Meta Model API docs. Never guess model names or parameters. If a model isn't available to us, drop that feature and don't claim it. Every tool/model actually used is logged in `/docs/tooling.md`; never claim a Meta tool or model we didn't actually use.

### Runtime features (in scope)

1. **Say it to wake it (Muse Voice Transcribe):**
   - Pinch-and-hold on the mic orb, say the word (3-second `getUserMedia` clip; verify `getUserMedia` on Quest Browser first), and the audio is transcribed server-side via the Vercel API proxy.
   - Compare the transcript to the target word, using accent-tolerant matching that grades both meaning and pronunciation, and give a gentle "almost" hint on near misses.
   - This is the primary accessibility alternative to hand gestures.
   - Fallback: gaze-pinch multiple choice.
2. **Echo, the voice-first agent (Muse Spark or Muse Wonder):**
   - Echo speaks short lines using only words you know plus 1 new word, reacts to what you just woke, and invents Sentence Spell challenges about YOUR room.
   - Output is strict JSON `{line, newWordId, spell}`, schema-validated. Never execute model output.
   - Echo's generated lines are spoken through Muse Voice speech generation if available; otherwise `speechSynthesis`; otherwise captions only.
   - Fallback: scripted lines.
3. **Room-aware curriculum (Muse Spark):**
   - After scene detection, send ONLY the list of semantic labels (never geometry or camera data).
   - The model returns a personalized pack: words, example sentences, distractors, and spells for the things actually in your room.
   - Validate, cache locally, and reuse offline. Fallback: seed packs.
4. **Latency and reliability:**
   - Responses under 1.5s, or Echo plays a "thinking" animation.
   - A 5-second timeout falls back to offline behavior.
   - Server-side rate limiting and response caching.
   - API keys live in server environment variables only (`META_API_KEY`; see Stack).

### Build-time content pipeline

Documented in `/docs/ai-pipeline.md`.

5. **Muse Image:** generate the stylized sticker art for every Atlas word, Fluency Mural tiles, and cosmetic textures in the style from `/docs/art.md`. Check the usage terms, and record the model, prompt, and date for each asset in `/ASSETS.md`.
6. **SAM 3.1:** segment the generated images into clean cut-out stickers and mural pieces with alpha masks, then pack them into one texture atlas.
   - Runtime segmentation of passthrough is allowed ONLY if a public API exposes camera frames to our web app; verify first. Otherwise SAM stays build-time.
7. **Muse Voice:** if it offers speech generation, pre-generate native-speaker-quality pronunciation clips for all seed words. That's license-clean audio, shipped with the app so it works offline. Runtime Echo lines use the speech chain in feature 2.
8. **Open-weights models (Muse Glimmer or Muse Spark Open):** run locally in a script to batch-generate and cross-check the offline seed packs (translations, gender, example sentences). The second model verifies the first, and disagreements are flagged for human review. This keeps shipped content correct with zero network.
9. **Coding agent:** we build with Muse Wonder through our coding agent setup. If Muse Code, Meta XR Operator, or Agentic Tools (Skills) are available to us, use them where they fit, such as automated device QA. Log what was actually used in `/docs/tooling.md`; only claim tools we really used.

### Privacy (replaces the base plan's "voice never leaves the device" line)

- Room geometry and camera data never leave the device. Only semantic label names are sent, for the curriculum.
- Voice is sent only after the player opts in at first mic use. It is transcribed and never stored or logged.
- Update the one-line privacy note on the launch page to say exactly this.

### Impact (state this in the submission)

- **Who benefits:** language learners who quit flashcard apps.
- **Why it works:** words are learned in the real place you'll use them (context-dependent memory), with daily spaced review built into your own room.
- **Path to real use:** any language pack, any room, sessions of 10 minutes or less.

## FoV-aware design and comfort

- Essential UI and quest cards stay within a comfortable central cone (about ±25° horizontal) and lazily follow the head.
- Nothing important sits at the edges, and text has a minimum size so it's readable on Quest 3S.
- No artificial locomotion or camera motion. Particles fade quickly. A reduced-motion toggle.

## Performance budget (Quest 3)

- Under 100 draw calls and about 150k triangles visible.
- Instanced props, one texture atlas, KTX2-compressed textures, baked lighting, no real-time shadows.
- A pooled particle system.
- An FPS overlay in dev mode. Profile on device every milestone; frames must never drop below 60 fps.

## Art direction

- Visual style: soft stylized low-poly with one cohesive palette. The Hush is cheap layered fog sprites in desaturated blue-gray (no heavy volumetrics). Waking is a warm color bloom that spreads outward from the object.
- Echo, the props, and the UI share the same shape language and palette.
- Create a style sheet in `/docs/art.md` before building any assets.

## Content and audio

- Packs live in `/packs/es/{room}.json`. Each word has id, target, english, partOfSpeech, gender, example, sceneLabel or propId, wakeFx, and rarity.
- Seed content: 12 real-room words from scene labels, plus 3 dioramas × 12 words, plus 8 verbs.
- Audio: pre-recorded or pre-generated clips for every seed word (Muse Voice pre-generation if available, license-compliant source otherwise), shipped with the app so it works offline, with speechSynthesis as fallback only.
- Sound design: a unique wake sound per object, soft ambient room tone, and satisfying snap and flick sounds.

## First five minutes (Best First Five Minutes)

1. 0–20s: the fog drifts in over your real room and Echo lands on your palm.
2. A ghost hand demonstrates a poke. Your real table glows: "la mesa." Poke it and it wakes.
3. A ghost hand demonstrates pinch-and-flick: wake the window and the door.
4. The diorama grows on your table and you wake 3 props.
5. Your first Sentence Spell, "abre la puerta," opens the door to the Kitchen district.
- No text walls; captions only. A real payoff before minute 2.

## Milestones (demo each on a Quest 3 or the emulator)

- **Nov 4–6:** scaffold, passthrough, hands, table detection plus fallbacks, diorama on table, poke-to-hear, wake effects. **(M1 start: asset pipeline — Muse Image / SAM 3.1 / Muse Voice clips / open-weights pack generation — runs in parallel, human-owned.)**
- **Nov 7–9:**
  - Real-room labels from scene data, plus anchors and persistence.
  - Deck, scheduler, and quests.
  - Pinch-flick naming, fade-as-review.
  - **M2: voice wake (Muse Voice Transcribe via Vercel proxy, gaze-pinch fallback).**
- **Nov 10–12:** Sentence Spells, Hush Rush, Echo, palm Atlas, Daily Fog and streak, district unlocks. **M3: Echo agent plus room-aware curriculum (Muse Spark/Wonder, scripted/seed fallbacks).**
- **Nov 13–15:**
  - Onboarding, sound pass, accessibility modes, FoV pass.
  - Performance pass on device.
  - Test in at least 3 different real rooms, including an unscanned one.
  - **M4: latency, fallback, and privacy QA with the network off, slow, and on.**
- **Nov 16:** code freeze. Tag the release, deploy to production, and confirm judges can launch it from the URL on Quest Browser.
- **Nov 17:** record the video, complete the submission, submit.
- **After Nov 18, 12:00pm PT:** no changes at all. Disable auto-deploy on the production branch. Keep the site and any API quota live until winners are announced (around Dec 11).

## Submission package (draft all of these)

- A live URL with a "Start in mixed reality" button, a VR fallback button, and a 3-line "how to play" note for judges (aligned with Entry and permissions).
- **Demo video, under 3 minutes:**
  - Real footage only, captured on Quest 3 (or the emulator for some shots), with no AI-generated video. AI-generated in-game art is fine and must be disclosed.
  - Lead with the story in the first 10 seconds: the Hush covers a real room.
  - Show the hands-first interactions within the first 30 seconds so Stage One's pass/fail check is obvious.
  - Then: poke → flick → wake → Sentence Spell opens the real window → Hush Rush.
  - Show Echo speaking about objects in the real room, voice-waking a word, and the room-aware pack appearing.
  - End with the next day, when faded words in the room get restored.
  - Test the Quest recording pipeline early and confirm passthrough appears in captures.
  - Keep it under 3 minutes.
- **Screenshots:** 5 high-quality in-headset screenshots plus a cover image for Devpost, all real captures.
- Name ("Word: Wake Your Room"), a tagline of 140 characters or fewer, Track: Gaming, Division: New Experience.
- A description under 500 words: inspiration, how it was built, future plans, target launch date.
  - Explicitly map features to the judging criteria for judges:
    - hand tracking (poke, pinch, flick, two-hand snap)
    - passthrough with scene understanding via WebXR plane and mesh detection (the IWSDK equivalent of MRUK)
    - spatial anchoring
    - FoV-aware UI
    - measured fps
    - the fallbacks for untested rooms
  - **Meta technology used and how:** list IWSDK; Quest Browser WebXR features (hand tracking, passthrough, plane and mesh detection, anchors); Immersive Web Emulator; and each Meta model actually used, with the exact feature it powers and its fallback. Only claim models verified and used (see `/docs/tooling.md`).
  - **Impact:** who benefits, why it works, path to real use (see Meta AI tooling → Impact).
  - Explicitly state: Quest 3/3S has no eye tracking, so "gaze" means head gaze with a reticle plus pinch.
- A paragraph on how hand interactions work and what excites us about the future of VR.
- Team names, emails, and roles.
- README covering setup, the pack format, how to add a language or room or spell, testing on Quest, and deploy steps.
- Tests for the scheduler, pack validation, and spell grammar.
- **Live demo resilience:** the deployed build works with the AI on or off, and the API quota lasts through Dec 11.
- **Pre-submit checklist:**
  - The person submitting is a Meta VR Start member with Developer Access enabled.
  - Each person submits only one entry (solo or as a team Representative).
  - All team members are listed with their roles.
  - The URL is tested on a fresh Quest Browser.
  - The site and any API quota stay live until winners are announced.
  - No deploys after Nov 18, 12:00pm PT.
