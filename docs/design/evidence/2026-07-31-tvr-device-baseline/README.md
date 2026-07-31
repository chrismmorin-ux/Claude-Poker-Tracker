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

---

## EVID-1 — CommandStrip over-subscription CONFIRMED *(was predicted, now observed)*

`02-table-preflop-nexthand-clipped.jpg`: at preflop with a seat selected, the command column renders street tabs → seat indicator → **orbit strip** → Call/Fold → sizing presets → custom+GO → ALL IN → Rest Fold → Tag for Review → Deselect/Absent/Reset Street/Reset Hand → and the gold **Next Hand CTA is cut off by the bottom of the screen.**

Compare `03-table-flop.jpg` (flop): no orbit strip renders, and Next Hand sits fully visible with margin.

This is exactly the failure predicted in [entry audit §E2](../../audits/2026-07-31-entry-table-view-redesign.md) — the column has no `overflow-y`, children use `height` with default `flex-shrink: 1`, and the sum exceeds 720. **The primary CTA of the surface is unreachable in the single most common state of the app.** Ticket: `WS-311` (upgraded from "not visually confirmed" to CONFIRMED, P1 → P0).

## EVID-2 — The uniform scale transform nullifies the 44px touch floor *(NEW — code read could not reach this)*

`useScale.js` computes `s = min(vw·0.95/1600, vh·0.95/720, 1)` and `ScaledContainer` applies it as a single CSS `transform: scale(s)` over the whole 1600×720 canvas.

Measuring the rendered canvas in these screenshots: the 1600-design-px canvas spans ≈2118 physical px, so `s × DPR ≈ 1.26`. Since the width term binds, `s = viewport_CSS_width × 0.95 / 1600` — **and every design-px value inside the canvas is deflated by `s`.**

The consequence is independent of the exact DPR:

| DPR | CSS viewport width | resulting `s` | a "44px" target renders at |
|---|---|---|---|
| 2.0 | ~1059 | 0.63 | **~28 CSS px** |
| 1.5 | ~1412 | 0.84 | **~37 CSS px** |

Either way the H-ML06 44px minimum **is not met anywhere in the app on the founder's own device**, and the 100px action buttons render at 63–84px.

This nullifies a whole class of prior work: `AUDIT-2026-04-21-TV F8` "bump recent-player rows to 44px" raised a number inside a canvas that is then uniformly shrunk. The 2026-04-21 audit anticipated the mechanism ("at scale <1.0, 40 DOM-px becomes <40 visual") but treated it as hypothetical; it is the actual operating condition. **Touch-target discipline cannot be enforced by editing px values inside a uniformly scaled canvas.** Ticket: `WS-316`.

## EVID-3 — Orientation gate blocks entry and does not visibly recover *(NEW)*

`06` shows `RotateDeviceHint` (`hidden portrait:flex fixed inset-0 z-[200]`) filling the screen in portrait. There is no dismiss, no "continue anyway", no partial render behind it — it is a hard block on entering the app.

`07` shows the same gate still painted inside a **landscape** 2340×1080 frame, with the icon positioned as though the layout box were still portrait (lower-left rather than centred). Founder report: *"in order to launch correctly, the app has to be loaded in landscape."*

**Mechanism not yet established** — candidates include a stale paint across the rotation, an OS-level rotation lock, or an interaction with `screen.orientation.lock()` in `useScreenOrientationLock`. `07` alone is consistent with a mid-rotation composite and must not be over-read. **Reproduction is step 1 of the ticket, not an assumption in it.** Ticket: `WS-315`.

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
