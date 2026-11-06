# Word: Wake Your Room — Art style sheet

Create before building or generating any assets. One palette, one shape language for Echo, props, UI, stickers, mural tiles.

## Shape language

- Soft stylized low-poly. Rounded, chunky silhouettes; no sharp menace.
- Everything friendly: objects read as toys, not tools.
- Echo: small round spirit, one big eye-spot, stubby wing-nubs. 3 forms evolve by size + crown detail only (silhouette stays readable).
- Props: exaggerated proportions, single dominant color block + one accent.
- UI: rounded tiles, thick outlines, generous padding. Tiles look magnetic (beveled snap edges).

## Palette

| Role | Color | Hex | Use |
|---|---|---|---|
| Hush fog | desaturated blue-gray | `#7A8794` | fog sprites, faded/due words, sleeping objects |
| Hush deep | slate | `#4A5560` | fog shadows, inactive UI |
| Wake warm | amber | `#FFB43A` | wake bloom start, streak flame, mastered gold border |
| Wake bloom | coral | `#FF7A59` | wake spread, combo, correct-hit flash |
| Life green | leaf | `#57C98A` | awake objects, success, mural growth |
| Sky voice | periwinkle | `#7C9EFF` | voice/mic orb, Echo speech, spell tiles (verb) |
| Tile noun | teal | `#2EC4B6` | noun tiles, Atlas stickers |
| Tile gender M | blue outline | `#3A86FF` | masculine agreement snap cue |
| Tile gender F | rose outline | `#FF5D8F` | feminine agreement snap cue |
| Parchment | warm off-white | `#FFF4E0` | quest card, mural canvas, captions bg |
| Ink | deep plum | `#2D2438` | text, outlines (never pure black) |

Awake indicator: color + outline + icon (colorblind-safe, never color alone).

## The Hush vs Wake

- Sleeping/Hush: desaturated, fog sprite overlay (cheap layered sprites, no volumetrics), no motion except slow drift.
- Waking: warm bloom (amber → coral) spreads outward from touch point ~0.6s, then settles to full palette + Life green accent. Pooled particles only (petals/sparks), fade fast.
- Due/faded (review): object desaturates toward Hush fog over days; label legible but gray.

## Typography & captions

- One rounded sans. English UI; target word large, English translation always beside/below.
- Captions: Parchment bg, Ink text, adjustable size. Min size readable on Quest 3S; essential UI within ±25° central cone.

## Audio-visual pairing (no haptics)

- Every action: sound + visual. Poke = soft pop + ring ripple. Snap = click + outline flash.
- Flick = whoosh; correct = chord bloom; wrong = gentle boing + sprite elastic return.
- Wake = unique sound per object + bloom.

## Asset rules

- Instanced low-poly props; one KTX2 texture atlas; baked lighting; no real-time shadows.
- Generated art (Muse Image / SAM 3.1, if verified + used): must match this palette/shape language; record model, prompt, date in `ASSETS.md`; log in `docs/tooling.md`.
- No brands/logos, no identifiable people. Ages 10+.
