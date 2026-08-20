# ASTRAL BASTION — public/assets slots

Generated: 2026-08-20 16:56 (UTC+8 / Taipei)

## Image generation status

**GenerateImage failed for every slot.** The Cursor MCP server `cursor` / tool `GenerateImage` is not available in this executor (GetMcpTools: server not found; CallMcpTool: "MCP server cursor is not available here"). No new AI images were produced.

All required paths below are **filled with series fallbacks** so the game is never a black box. No 0-byte files. Pillow wrote WebP (cwebp not installed). Other games under `/workspace` were not modified.

## Legend

| Kind | Meaning |
|---|---|
| `copied` | Direct series art, cropped/resized to slot aspect, saved as webp |
| `derived` | Composited / color-graded from series art (still not GenerateImage) |
| `generated` | New image from GenerateImage — **none** |

---

## Characters (`public/assets/characters/<id>/`)

Aspect: full 3:4, portrait 1:1, cutin 16:9, skin 3:4.

Sources unless noted: `/workspace/astral-frontier/assets/characters/<id>/{full,portrait}.png`

| Path | Kind | Source / notes |
|---|---|---|
| `characters/rin/full.webp` | copied | frontier `rin/full.png`, 3:4 crop |
| `characters/rin/portrait.webp` | copied | frontier `rin/portrait.png`, 1:1 face crop |
| `characters/rin/cutin.webp` | copied | frontier `rin/full.png`, 16:9 cinematic crop |
| `characters/rin/skin.webp` | copied | bloom `costumes/rin/shrine_night/full.png` (alt shrine costume, same face/hair/moonblade) |
| `characters/mio/full.webp` | copied | frontier `mio/full.png`, 3:4 crop |
| `characters/mio/portrait.webp` | copied | frontier `mio/portrait.png`, 1:1 face crop |
| `characters/mio/cutin.webp` | copied | frontier `mio/full.png`, 16:9 crop |
| `characters/mio/skin.webp` | derived | color-grade of mio full (no dedicated series skin) |
| `characters/alyssa/full.webp` | copied | frontier `alyssa/full.png`, 3:4 crop |
| `characters/alyssa/portrait.webp` | copied | frontier `alyssa/portrait.png`, 1:1 face crop |
| `characters/alyssa/cutin.webp` | copied | frontier `alyssa/full.png`, 16:9 crop |
| `characters/alyssa/skin.webp` | derived | color-grade of alyssa full |
| `characters/eve/full.webp` | copied | frontier `eve/full.png`, 3:4 crop |
| `characters/eve/portrait.webp` | copied | frontier `eve/portrait.png`, 1:1 face crop |
| `characters/eve/cutin.webp` | copied | frontier `eve/full.png`, 16:9 crop |
| `characters/eve/skin.webp` | derived | color-grade of eve full |
| `characters/ren/full.webp` | copied | frontier `ren/full.png`, 3:4 crop |
| `characters/ren/portrait.webp` | copied | frontier `ren/portrait.png`, 1:1 face crop |
| `characters/ren/cutin.webp` | copied | frontier `ren/full.png`, 16:9 crop |
| `characters/ren/skin.webp` | derived | color-grade of ren full |
| `characters/aria/full.webp` | copied | frontier `aria/full.png`, 3:4 crop |
| `characters/aria/portrait.webp` | copied | frontier `aria/portrait.png`, 1:1 face crop |
| `characters/aria/cutin.webp` | copied | frontier `aria/full.png`, 16:9 crop |
| `characters/aria/skin.webp` | derived | color-grade of aria full |

---

## Enemies (`public/assets/enemies/`) — 3:4, dark void, cover-fit (no letterbox)

| Path | Kind | Source / notes |
|---|---|---|
| `enemies/shade.webp` | copied | bloom `enemies/void_apostle.png` (humanoid moonlight shade, claws) |
| `enemies/runner.webp` | copied | bloom `enemies/neon_scav.png` (lean fast wraith-runner) |
| `enemies/shield_drone.webp` | copied | bloom `enemies/alley_drone.png` (floating cyan drone) |
| `enemies/wraith.webp` | copied | frontier `enemies/wraith.webp` (translucent phase ghost) |
| `enemies/jammer.webp` | copied | frontier `enemies/hexsniper.webp` (tech unit fallback; no bat-jammer in series) |
| `enemies/bomb_carrier.webp` | copied | bloom `enemies/salary_drone.png` (hulking pack carrier) |
| `enemies/executioner.webp` | copied | frontier `enemies/executioner.webp` (elite armored, huge cleaver) |

---

## Boss (`public/assets/boss/`)

| Path | Kind | Source / notes |
|---|---|---|
| `boss/yamato-phase1.webp` | copied | frontier `boss/yamato-full.png`, 3:4 crop (intact colossus) |
| `boss/yamato-phase2.webp` | derived | same crop, cracked/burning crimson leyline grade |

---

## Scenes (`public/assets/bg/`) — 16:9

| Path | Kind | Source / notes |
|---|---|---|
| `bg/title.webp` | copied | frontier `bg/hero.png` (moonlit Tokyo + leyline, no UI text) |
| `bg/battlefield.webp` | copied | frontier `bg/battle.png` (S-curve elevated highway + leylines) |
| `bg/moonlight.webp` | copied | frontier `events/shrine.png` (moonlight leyline shrine road) |
| `bg/gate.webp` | derived | battlefield + shrine blend with a single luminous torus portal overlay |
| `bg/collection.webp` | copied | frontier `events/rest.png` (moonlight terrace / archive-adjacent) |

---

## Link CG (`public/assets/links/`) — 16:9, two characters

| Path | Kind | Source / notes |
|---|---|---|
| `links/rin-mio.webp` | copied | frontier `links/rin-mio.png` (Moonfox Requiem original CG) |
| `links/alyssa-eve.webp` | derived | side-by-side composite of alyssa + eve full (Iron Horizon fallback) |
| `links/ren-aria.webp` | derived | side-by-side composite of ren + aria full (Crimson Phantom fallback) |

---

## Extra (not in required slot list)

| Path | Notes |
|---|---|
| `bg/title.png` | Present on disk (~2.6 MB). Not written by this art pipeline; left in place. |

---

## Failures

1. **GenerateImage unavailable** — 0 of 41 required slots are newly generated originals.
2. **No dedicated series skins** for mio / alyssa / eve / ren / aria — used color-graded full as `skin.webp`.
3. **No bat-like jammer sprite** in series art — used frontier hexsniper as the closest tech unit.
4. **Series character art is cinematic (scenic backgrounds)**, not isolated transparent/void as the bible prefers. Fallbacks keep the original key art rather than faking a void cutout.
5. **Full-body 3:4 crops** are mid/3-quarter shots because source key art is 3:2 landscape, not true head-to-toe.

When GenerateImage becomes available, overwrite these in-place. Game code reads:

- `/assets/characters/<id>/{portrait,full,cutin,skin}.webp`
- `/assets/enemies/<id>.webp`
- `/assets/boss/yamato-phase{1,2}.webp`
- `/assets/bg/{title,battlefield,moonlight,gate,collection}.webp`
- `/assets/links/{rin-mio,alyssa-eve,ren-aria}.webp`
