# QA — Word: Wake Your Room (device checklist)

Run on Quest 3 **and** Quest 3S. Record pass/fail + notes per row. Report bugs back with step #, device, room type.

## A. Room / session robustness (PLAN QA)
| # | Test | Steps | Pass criteria |
|---|---|---|---|
| A1 | Unscanned room | Fresh room, no space setup. Enter MR. | No crash; "pinch your table" or VR fallback offered. |
| A2 | No table | Room without table. | Virtual tabletop at lap height; diorama playable. |
| A3 | Small room | Closet/small office. | Targets reachable seated; UI in ±25° cone. |
| A4 | Dim light | Lights low. Drop hands out of view 5s. | Timers pause; "Show your hands ✋" ghost; resume on hands back; no false wakes. |
| A5 | Permission denied | Deny spatial data, then mic. | Friendly one-liner + skip; gaze-pinch fallback works; no launch-time mic prompt (mic only at first voice use). |
| A6 | Offline | Airplane mode, cold start. | Full core loop plays: poke/flick/spells/prepositions/Hush Rush; Echo scripted lines; seed packs. |
| A7 | Enter/exit ×10 | Enter/exit XR 10 times. | State restored each time; no duplicate targets; no leak slowdown. |
| A8 | 30-min soak | Play 30 min. | ≥60 fps throughout (dev FPS overlay on); no crash; no runaway heat throttle below 60. |
| A9 | Hand-tracking loss mid-Rush | Start Hush Rush, cover cameras 3s. | Rush timer frozen during loss; resumes exactly; score intact. |
| A10 | Visibility/menu pause | Open system menu mid-session. | All timers pause, state saved; resume exact. |
| A11 | Anchor drift | Restart app next day, moved furniture. | Labels re-place relative to table; no floating labels in wrong spots; faded due words visible for review. |

## B. First five minutes (onboarding)
| # | Test | Pass criteria |
|---|---|---|
| B1 | Cold start <5s to launch; time to "table" wake <2 min. | Timed. |
| B2 | Ghost hand demos poke, pinch-flick, snap, place — captions only, no text wall >32 chars. | Each gesture teach completes one-handed. |
| B3 | "open the door" spell opens Kitchen diorama before minute 5; then "put the cup on the table" placed physically. | Preposition check grades correct/almost honestly at table edge. |

## C. Accessibility + FoV
| # | Test | Pass criteria |
|---|---|---|
| C1 | High contrast on (launch toggle). | Palette visibly higher contrast in XR. |
| C2 | Colorblind: grayscale filter / simulator. | Awake vs sleeping distinguishable by ✓ icon + outline, not color. |
| C3 | Caption size normal/large/extra-large. | Applies in XR captions; min size readable on 3S at 1.2 m. |
| C4 | Reduced motion on. | No pulse/bloom motion; wakes still clear via sound + static color. |
| C5 | FoV: quest card + captions stay in ±25° cone, lazy-follow head on Quest 3S. | Nothing essential at edges. |
| C6 | One-handed: every mechanic (poke, flick, spell snap, place, voice, gaze-pinch) with one hand. | All completable. Voice: mic orb pinch-hold, 3s clip. |

## D. AI: network off / slow / on (Echo + room-pack)
| # | Mode | Steps | Pass criteria |
|---|---|---|---|
| D1 | Off | Airplane mode. Ask Echo; enter new room. | Scripted Echo line <1s; seed pack; zero error UI. |
| D2 | Slow | Throttle to ~100 kbps / high latency (router or hotspot). Ask Echo. | "Thinking" animation shows; answer or scripted fallback within 5s; never a spinner forever. |
| D3 | On | Normal Wi-Fi with `META_API_KEY` set on server. | Echo line simple English, ≤1 new word, valid spell; room pack matches actual labels; response <1.5s typical. |
| D4 | Bad output | (Dev) stub API returning invalid JSON. | Client rejects schema, falls back scripted; model output never executed; no crash. |
| D5 | Rate limit | (Dev) >30 Echo calls/min. | 429 handled as fallback, no error wall. |

## E. Privacy: no room data / voice leaves device without consent
| # | Check | Method | Pass criteria |
|---|---|---|---|
| E1 | Network capture | Browser devtools / proxy on launch + room scan, before any opt-in. | Requests to `/api/room-pack` contain ONLY label name strings (e.g. `["table","wall"]`) — no geometry, coordinates, images, mesh data. `/api/echo` contains only known word ids. |
| E2 | Voice consent | Fresh profile; use voice first time. | Mic requested only then, after opt-in; clip transcribed, never stored/logged (server code: in-memory forward only, `api/transcribe.ts`). Deny mic → gaze-pinch fallback. |
| E3 | Local storage | Inspect `word-save-v1`. | Only cards/awake/settings/table-relative offsets. No audio, no room geometry scans, no transcripts. |
| E4 | Launch page | Read privacy line. | States: geometry/camera never leave device; label names only for lessons; voice opt-in only, never stored. |
| E5 | Secrets | Search repo/client bundle for `META_API_KEY`. | Key absent from client + git history; server env only. |

## F. Performance budget (Quest 3/3S)
Budget (PLAN): **≥60 fps (target 72), <100 draw calls, ~150k tris visible.**

Code-side counts (this build, fallback diorama + claimed room targets):
- Entities: table + 5 props + ≤12 room markers + quest panel ≈ ≤20 meshes.
- Triangles: low-poly primitives ≤800 tris/mesh upper bound ⇒ ≲16k visible — well under 150k.
- Draw calls: ~1 per mesh + panel ⇒ ~20 — under 100.
- In-code guard: `WordSystem` samples fps every 2s, logs `[Word perf]` via `assessPerf()` (`src/word/perf.ts`); dev FPS overlay (`FpsSystem`, DEV only).

**Device measurement (fill in when run):**
| Device | Room | FPS min/avg (overlay, 30-min soak A8) | Draw calls (renderer.info via devtools) | Tris | Verdict |
|---|---|---|---|---|---|
| Emulator/code audit (not device) | fallback diorama | not measured — device only | ~20 (6 diorama meshes + ≤12 markers + panel) | ≲9k (boxes 12, cylinders ≤96, spheres 640 tris) | Under budget code-side; device fps still required |
| Quest 3 | | | | | |
| Quest 3S | | | | | |

Over budget → fix order: reduce marker sphere segments, merge prop geometries, cut particles, then re-run A8.

## P0 results (fill in on device / emulator)

| # | Check | Result | Notes |
|---|---|---|---|
| P0-1a | In-world caption readable in XR (onboarding, word+IPA+helper, pause, Show your hands, spell/preposition hints) | | |
| P0-1b | In-world dev panel shows fps / draw calls / triangles | | |
| P0-2 | Palm-up menu opens, pinch selects, settings persist after restart | | |
| P0-3 | Every word plays audio (clip if present, else speechSynthesis, else caption) | | |
| P0-4a | Mic orb: consent first use only, 3s voice wake, fallback to ray-pinch | | |
| P0-4b | Hush Rush from palm menu: timer/score in-world, frozen on pause/hand-loss | | |
| P0-4c | Gaze-pinch with aim assist wakes far room target within 15 deg | | |
| P0-5 | Network off: full game plays (poke/spells/quests/rush, scripted Echo) | | |
| Perf | fps / draw calls / triangles this build (emulator estimate in code log `[Word perf]`) | | |

## P1 results (fill in on device / emulator)

| # | Check | Result | Notes |
|---|---|---|---|
| P1-6 | Room labels claim, save, restart: table-relative anchors restore; move room setup >0.35m: "Room changed - labels re-placed" shows, no floating wrong labels | | |
| P1-7 | Grab cup: prompt cycles on -> under -> next to -> in front of -> behind; settle 300ms grades vs real table, wrong placement gives hint only | | |
| P1-8 | Echo orb on table corner; grows form 2 at 8 awake, form 3 at 20 awake, "Echo grew!" caption | | |
| P1-9 | Fluency Mural on fallback wall fills green per awake word; on real wall mesh it pins to wall and faces you | | |
| P1-10 | Palm menu > Atlas: awake/total, mastered count, per-district % (text Atlas v1) | | |
| P1-11 | Wake 10/12 home + 4/5 kitchen: "The Cafe is open!" + 12 cafe props appear on table back row, questable | | |
| Perf-P1 | fps / draw calls / triangles with cafe+echo+mural (estimate +14 calls, still <100) | | |

## P2 results (fill in on device / emulator)

| # | Check | Result | Notes |
|---|---|---|---|
| P2-12 | Room with scene labels: ~2s after labels claim, quest order prefers pack words for this room; network off: seed quests continue, no error | | |
| P2-13a | Gaze far target (door/window) + pinch: sprite flies ~0.3s with arc and wakes target on arrival | | |
| P2-13b | Fast hand flick while pinching also throws sprite; slow ray-pinch on near props unchanged | | |
| P2-13c | Aim off-target (>15 deg): no wake, no sprite spam | | |

## Release checklist (v1.0.0)

| # | Check | Result | Notes |
|---|---|---|---|
| R1 | `npm run build` passes; cold start <5s on Quest Browser (time it) | | |
| R2 | Secret scan: no `META_API_KEY`/tokens in repo or `dist/` bundle | | scan run 2026-11-10: clean in src/api/public/docs/packs |
| R3 | All `/api` routes read `META_API_KEY` from server env only | | `api/_shared.ts`, `api/transcribe.ts` only |
| R4 | Production URL opens on fresh Quest Browser, MR + VR entry work | | |
| R5 | After final deploy: auto-deploy disabled (Vercel Git Ignored Build Step `exit 1`) before Nov 18 12:00pm PT | | |


## G. Content / safety spot-check
- English UI everywhere; IPA on tap; helper hints hidden in Immersion mode.
- No brands/logos/identifiable people in art; ages 10+.
- Sound present on every action (pop/snap/whoosh/wake chord/boing) — no haptics reliance.
