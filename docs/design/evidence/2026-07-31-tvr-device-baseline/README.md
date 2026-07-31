# Evidence — 2026-07-31 — TVR device baseline (founder's phone)

**Source:** founder device screenshots, supplied 2026-07-31 during the Table View Redesign kickoff.
**Device frame:** 2340×1080 physical, Android (Samsung), Chrome. Status bar + gesture-nav bars visible; the browser viewport is roughly x 82→2200 physical.
**Why this matters:** the Gate 1 audit could not boot the app (Firebase credentials absent), so every claim in it was derived from code. These screenshots are the first observed evidence and they **confirm two predictions and produce two new findings the code read did not reach.**

---

## Files

| File | Shows |
|---|---|
| `01-homebase.jpg` | Homebase dashboard — entry point, renders correctly |
| `02-table-preflop-nexthand-clipped.jpg` | **Table, preflop, UTG to act — the gold "Next Hand" CTA is clipped by the viewport bottom edge** |
| `03-table-flop.jpg` | Table, flop, SB to act — Next Hand fully visible (fewer rows render) |
| `04-card-selector-mic-overlap.jpg` | Card selector overlay — **floating BOARD/mic button overlaps the A♣/K♣ region of the card grid** |
| `05-showdown.jpg` | Showdown view — 9 seats × 2 card slots + Muck/Won per seat |
| `06-rotate-gate-portrait.jpg` | `RotateDeviceHint` blocking the app in portrait |
| `07-rotate-gate-persists-landscape.jpg` | **The same gate still painted in a landscape (2340×1080) frame** |
| `08-local-repro-1600x720-nexthand-below-fold.png` | **Local repro at exactly 1600×720** — Next Hand is entirely below the fold |
| `09-local-repro-rotate-gate-portrait.png` | Local repro of the rotate gate at a 720×1600 viewport |
| `10-card-selector-device-scale-1170x540.png` | Card selector at device-equivalent scale (0.695) — grid cells measure 79×92 rendered px |
| `11-sizing-controls-device-scale.png` | Sizing presets / custom input / GO at device scale — the input (229×33) and GO (45×33) are **below the touch floor** |

---

## How to reproduce all of this locally

The app was believed unrunnable in this environment. It is not. It is IndexedDB-first
with an existing guest mode, so no Firebase project is needed — the only blocker was
that `initializeApp()` throws at module scope on absent config.

```bash
npm run env:local     # once — gitignored placeholder config
npm run dev           # terminal 1
npm run devshot       # terminal 2 — screenshots + rendered-size measurements
npm run devshot:portrait
```

`scripts/devshot.mjs` reports the `ScaledContainer` scale factor and the **rendered**
size of controls, and asserts whether the Next Hand CTA is inside the viewport.

---

## EVID-1 — CommandStrip over-subscription CONFIRMED *(was predicted, now observed)*

`02-table-preflop-nexthand-clipped.jpg`: at preflop with a seat selected, the command column renders street tabs → seat indicator → **orbit strip** → Call/Fold → sizing presets → custom+GO → ALL IN → Rest Fold → Tag for Review → Deselect/Absent/Reset Street/Reset Hand → and the gold **Next Hand CTA is cut off by the bottom of the screen.**

Compare `03-table-flop.jpg` (flop): no orbit strip renders, and Next Hand sits fully visible with margin.

This is exactly the failure predicted in [entry audit §E2](../../audits/2026-07-31-entry-table-view-redesign.md) — the column has no `overflow-y`, children use `height` with default `flex-shrink: 1`, and the sum exceeds 720. **The primary CTA of the surface is unreachable in the single most common state of the app.** Ticket: `WS-311` (upgraded from "not visually confirmed" to CONFIRMED, P1 → P0).

**Reproduced locally at the design resolution** (`08-local-repro-1600x720-nexthand-below-fold.png`), which makes the finding stronger than the device screenshots alone:

```
viewport:                       1600 × 720   (the app's own design canvas)
ScaledContainer scale factor:   0.95
Next Hand CTA:                  411 × 65 rendered px
Next Hand bottom edge:          807px  vs viewport 720px  → CLIPPED by 87px
```

This is **not** a small-screen edge case and **not** device-specific — the command column does not fit at the resolution the entire app is designed against, in the *default* state of a new hand (one seat selected, preflop, 9-handed, no all-in row, no sizing editor).

## EVID-2 — The uniform scale transform nullifies the 44px touch floor *(NEW — code read could not reach this)*

`useScale.js` computes `s = min(vw·0.95/1600, vh·0.95/720, 1)` and `ScaledContainer` applies it as a single CSS `transform: scale(s)` over the whole 1600×720 canvas.

Measuring the rendered canvas in these screenshots: the 1600-design-px canvas spans ≈2118 physical px, so `s × DPR ≈ 1.26`. Since the width term binds, `s = viewport_CSS_width × 0.95 / 1600` — **and every design-px value inside the canvas is deflated by `s`.**

The consequence is independent of the exact DPR:

| DPR | CSS viewport width | resulting `s` | a "44px" target renders at |
|---|---|---|---|
| 2.0 | ~1059 | 0.63 | **~28 CSS px** |
| 1.5 | ~1412 | 0.84 | **~37 CSS px** |

Either way the H-ML06 44px minimum **is not met anywhere in the app on the founder's own device**, and the 100px action buttons render at 63–84px.

**Measured locally at 1600×720, DPR 1:** scale factor **0.95** → a declared 44px target renders at **~41.8px**. The `0.95` margin in `useScale` is unconditional, so **nothing in this app is ever at its declared size** — not even at the exact design resolution on a desktop. The device case only makes it worse.

This nullifies a whole class of prior work: `AUDIT-2026-04-21-TV F8` "bump recent-player rows to 44px" raised a number inside a canvas that is then uniformly shrunk. The 2026-04-21 audit anticipated the mechanism ("at scale <1.0, 40 DOM-px becomes <40 visual") but treated it as hypothetical; it is the actual operating condition. **Touch-target discipline cannot be enforced by editing px values inside a uniformly scaled canvas.** Ticket: `WS-316`.

## EVID-3 — Orientation gate blocks entry and does not visibly recover *(NEW)*

`06` shows `RotateDeviceHint` (`hidden portrait:flex fixed inset-0 z-[200]`) filling the screen in portrait. There is no dismiss, no "continue anyway", no partial render behind it — it is a hard block on entering the app.

`07` shows the same gate still painted inside a **landscape** 2340×1080 frame, with the icon positioned as though the layout box were still portrait (lower-left rather than centred). Founder report: *"in order to launch correctly, the app has to be loaded in landscape."*

**Mechanism not established — but the search space is now narrower.** Tested locally with `npm run devshot:portrait` (Chromium, 720×1600 → resized to 1600×720):

```
rotate gate visible in portrait:   true
gate still visible after resize:   FALSE   ← cleared correctly
```

A pure viewport change re-evaluates the `portrait:` variant and dismisses the overlay exactly as designed. **The CSS media query is not the bug** — anyone who "fixes" it will be fixing something that works.

Remaining candidates are all device-specific: OS-level rotation lock (auto-rotate off, in which case the copy "turn your phone sideways" is actively wrong); `screen.orientation.lock()` interacting with physical orientation in an installed PWA; Android Chrome not re-evaluating on `orientationchange` the way a desktop resize does; or the gate clearing while the *scale* fails to recover. **Reproduction on the founder's device is step 1 of the ticket, not an assumption in it.** Ticket: `WS-315`.

## EVID-6 — The card grid is NOT undersized; its risk is homogeneity *(measured 2026-07-31)*

Measured in response to the founder's press-hold-to-zoom proposal:

| Viewport | scale | card-grid cell, rendered | header BOARD/HOLE slot |
|---|---|---|---|
| 1600 × 720 (design canvas) | 0.950 | **108 × 126 px** | ~38 × 55 px |
| 1170 × 540 (≈ device, DPR 2) | 0.695 | **79 × 92 px** | **~28 × 40 px** |

The grid cells are roughly **twice the 44px floor** — `CardSelectorPanel` is a full-screen overlay whose cells use `flex-1` in both axes, so it already claims maximum area. **A target-size argument for the card grid is not supported.**

The sub-floor targets in that surface are the header `CardSlot`s (~28×40 at device scale), but they are largely bypassed: entry from the felt pre-sets the slot index and `useCardSelection` auto-advances then auto-closes, so a flop costs ~4 taps (1 open + 3 cards) and only the opening tap lands small.

**The real risk in the card grid is homogeneity, not size** — 52 near-identical cells where a perfectly accurate tap can still hit the wrong card, and confirmation arrives only after the write. That is a feedback-timing defect, and it is what `WS-317` (confirm-before-commit) addresses. See [Gate 1 entry](../../audits/2026-07-31-entry-confirm-before-commit.md).

**Also confirms EVID-2's device estimate:** measured scale at a 1170×540 CSS viewport is **0.695**, matching the DPR-2 prediction. A declared 44px target therefore renders at **~30.6px** on the founder's device — now measured rather than inferred.

## EVID-7 — Sizing-entry physical budget *(measured 2026-07-31)*

Measured for the action-entry exploration ([`explorations/action-entry-sizing.md`](../../explorations/action-entry-sizing.md)), at 1170×540 / scale 0.695:

| Element | Declared | Rendered | vs 44px floor |
|---|---|---|---|
| Command column | 450 × 720 | **313 × 500** | — |
| Sizing preset (×4) | 100 × 68 | **69 × 47** | ✅ just clears |
| Action button | 213 × 100 | **148 × 69** | ✅ |
| Custom amount input | 330 × 48 | **229 × 33** | ❌ **below floor** |
| GO button | ~65 × 48 | **45 × 33** | ❌ **below floor** |
| Preset row span | — | **288 px** | slider travel budget |

**Two new floor violations** on the only path to an arbitrary bet amount — the custom input and GO. Recording a non-preset size is currently the least reliable interaction in the surface, and it also requires a keyboard that occludes the table.

**288px is the constraint that governs any slider proposal.** At a $100 pot that is ~$0.61/px (fine); at a $2000 pot it is ~$12/px, or ±$60 at realistic finger precision (unusable). A plain linear slider therefore breaks down at large pots — which is why progressive precision is a requirement of the founder's concept, not a refinement of it.

## EVID-4 — Floating voice button overlaps the card grid *(NEW, minor)*

`04-card-selector-mic-overlap.jpg`: the circular BOARD/mic control sits above the card-selector overlay and covers the A♣ and K♣ cells of the clubs row. Both are selectable cards. Also visible in `02`/`03`, where it overlaps the felt's lower-left. Folded into `WS-313` (Gate 4) as a z-order / placement item rather than filed separately.

## EVID-5 — Observations for the redesign (no ticket)

- The felt interior is a large expanse of unbroken green; the "35–40% of the region carries no information" estimate from the code read is, if anything, conservative.
- The decorative `TABLE` label occupies a prominent block of the lower felt — confirms it as the obvious sacrifice for the roster rail (Gate 2 C5).
- Nine seats render as small anonymous numbered squares. The player-entry cost is visible: an entire table of unidentified seats, each needing the long-press → menu → scroll → tap path.
- The left icon rail (10 items) consumes real width alongside the 450px command column, further squeezing the felt.

---

## Change log

- 2026-07-31 — Created from founder device screenshots during TVR kickoff. 2 predictions confirmed, 3 new findings.
- 2026-07-31 — EVID-6 added: card-grid and header-slot sizes measured at two viewports in response to the founder's press-hold proposal. Confirms the device scale factor at 0.695 (44px → ~30.6px rendered).
- 2026-07-31 — Local reproduction added (`scripts/devshot.mjs`). EVID-1 reproduced at the design resolution (stronger than the device finding); EVID-2 measured at DPR 1 (scale 0.95, 44px → 41.8px); EVID-3 narrowed — the CSS media query is confirmed NOT to be the cause.
