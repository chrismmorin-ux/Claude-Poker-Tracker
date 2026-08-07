# Gate 1 Entry — 2026-07-31 — Confirm-before-commit (press-hold-release selection)

**Surface working name:** A cross-surface selection primitive — press → magnify/preview → adjust → release to commit
**Proposed by:** Founder, 2026-07-31 — *"I think we should have the card selector as a click and hold to zoom, and release to lock in the selected card. We gain some misclick defense and not having to find the place to hover with a finger then precise touch and visual confirmation after. This sort of thing needs to be looked at all over the interface."*
**Gate:** 1 (Entry)
**Next gate:** 2 (Blind-Spot Roundtable) — **required.**
**Status:** **YELLOW** — the direction is sound and the founder's generalisation is correct, but the stated *mechanism* is not what the measurements support, and there is a hard gesture-vocabulary collision.

---

## Output 0 — The premise, measured

The founder gave two reasons. **They do not hold equally, and the difference matters for where this ships.**

### Reason 1 — "misclick defense" (as a target-size argument): **NOT SUPPORTED for the card grid**

Measured with `npm run devshot` at two viewports:

| Viewport | scale | card-grid cell, rendered |
|---|---|---|
| 1600 × 720 (design canvas) | 0.950 | **108 × 126 px** |
| 1170 × 540 (≈ founder's device, DPR 2) | 0.695 | **79 × 92 px** |

A 79 × 92 px target is roughly **twice the 44px floor**. The card grid is one of the few surfaces in this app that is *not* undersized — `CardSelectorPanel` is a full-screen overlay whose grid cells use `flex-1` in both axes, so it already claims maximum area (the comment at `CardSelectorPanel.jsx:11` says exactly that, and it is true).

**Where the size problem actually is, in this same surface:** the BOARD / HOLE `CardSlot` targets in the header measure **~28 × 40 px at device scale** — those are the sub-floor targets. But they are largely bypassed in practice: entry from the felt pre-sets the slot index, and `useCardSelection` **auto-advances** to the next slot and **auto-closes** at street end. So a flop costs ~4 taps (1 to open + 3 cards), not 6, and only the opening tap lands on a small target.

### Reason 2 — "not having to find the place, then precise touch, then visual confirmation *after*": **SUPPORTED, and it is the real finding**

This is not about size. It is about **when feedback arrives relative to commitment.**

Today, every selection in this app is: **aim → commit → verify.** The user discovers what they selected only after it is written. In a 13 × 4 grid of 52 near-identical cells, that is a genuine defect *independent of target size* — A♠ and A♥ are adjacent, similar, and equally large, so a perfectly accurate tap can still land on the wrong card, and nothing tells you until it is done.

The founder is asking for **aim → verify → commit.** That is a different and better framing than "make things bigger", and it is why the generalisation to "all over the interface" is correct.

**Restating the principle for the design language:**

> **Confirm-before-commit.** Where a target is *dense*, *homogeneous*, or *consequential*, the interface must show what will happen before it happens, with the commit point decoupled from the initial touch point.

Press-hold-magnify-release is **one implementation** of that principle, not the principle itself. Framing it as the principle is what makes it auditable across surfaces.

---

## Output 1 — Scope classification

**System-coherence audit** (per `LIFECYCLE.md`, the 2026-04-27 category). All the surfaces exist; what is inconsistent is a *concept* — when confirmation happens relative to commitment. Precedent: the Sidebar Holistic Coherence project.

Also **surface addition** in the narrow sense: a magnifier/preview overlay is a new UI element.

**New interaction primitive:** yes — *held-gesture selection with in-flight preview*. No precedent in this repo. Every existing gesture is discrete (tap) or opens-a-thing (long-press).

### Gate 2 triggers — three fire
- New interaction primitive ✅
- Cross-surface / design-language change ✅
- Founder explicitly asked for it to be examined interface-wide ✅

---

## Output 2 — The blocking risk: **the long-press vocabulary is already spent**

This is the finding that most threatens the proposal, and it is the direct answer to *"this sort of thing needs to be looked at all over the interface."*

Press-and-hold **already has a meaning** in this app, in three places, and that meaning is **"open a different control"** — not "refine this one":

| Surface | Gesture | Current meaning |
|---|---|---|
| `SizingPresetsPanel.jsx:63-67` + `CommandStrip.jsx:607-620` | 500ms hold on a sizing preset | Opens the sizing **editor** |
| `SeatComponent.jsx:100` | native long-press (`onContextMenu`) | Opens the seat **context menu** |
| `PotDisplay.jsx:21-31` | long-press on the pot | Enters pot **edit** mode (shipped as AUDIT-2026-04-21-TV F9) |

If hold means *"magnify and commit this"* on the card grid and *"open a separate editor"* on the sizing presets two inches away, the gesture vocabulary is incoherent — and incoherent gesture vocabularies are learned as "hold does something unpredictable", which is worse than either meaning alone.

**This must be resolved before the pattern spreads, not after.** Options for Gate 2/4:
1. Reserve **hold** for confirm-before-commit and migrate the three "open a thing" cases to a different affordance (an explicit ⋯ / edit control). Cleanest vocabulary; costs three migrations and re-opens settled UX.
2. Distinguish by **target class** — hold-on-a-value-in-a-set = refine; hold-on-a-single-control = open. Defensible but subtle, and subtle gesture rules fail under time pressure.
3. Scope confirm-before-commit to **dense grids only** (card selector, orbit strip, recents) where no competing hold meaning exists. Narrowest, safest, ships soonest.

**Recommendation to evaluate first: option 3**, then reassess. It delivers the founder's actual example, avoids re-litigating three shipped decisions, and generates real usage evidence before committing the whole vocabulary.

---

## Output 3 — Where the principle applies (and where it must not)

Screening every recording surface by the three qualifying properties — **dense**, **homogeneous**, **consequential**:

| Surface | Dense | Homogeneous | Rendered size @0.695 | Verdict |
|---|---|---|---|---|
| Card grid (52 cells) | ✅ | ✅ | 79×92 — large | **Strong fit** — the founder's example. Size is fine; homogeneity is the risk. |
| Orbit strip (9 positions) | ✅ | ✅ | ~25×25 — **below floor** | **Strongest fit** — dense, homogeneous *and* undersized. Also already destructive (tap-ahead auto-folds). |
| Recent-players list | ✅ | ✅ | ~31px rows | **Good fit** — homogeneous text rows; wrong-player assignment is the worst silent data error (see `PM-16`). |
| Seats on the felt (9) | ➖ | ➖ spatially distinct | ~39×39 | **Weak** — position disambiguates; low confusion risk. |
| Sizing presets (4) | ➖ | ➖ distinct amounts | ~47×47 | **Blocked** — hold is already taken here. |
| Action buttons (Fold/Call/Raise) | ❌ | ❌ distinct colour+label | ~69px | **NO — actively harmful.** See below. |
| Next Hand | ❌ | ❌ | 411×65 | **NO.** |

### The must-not case, stated explicitly

**Do not put a hold gesture on the primary action buttons.** Three reasons, each sufficient:

1. **It taxes the fast path.** A hold delay on every seat-action is paid dozens of times per orbit, directly against `HE-23` (record a full orbit without falling behind the dealer). The preflop path is already near-optimal at ~4 taps; adding a hold would make the one thing that works worse.
2. **They are not confusable.** Fold/Call/Raise differ in colour, label and position. Confirm-before-commit solves *recognition* failures; there is no recognition failure here.
3. **It conflicts with the pre-arm direction (`HE-22`).** A pre-armed action is *already* a confirm-before-commit mechanism — it shows the proposal before the tap. Stacking a hold on top would mean confirming a confirmation.

---

## Output 4 — Personas and JTBD

**Personas:** [`glance-return-chris`](../personas/situational/glance-return-chris.md) — **the critical one**. A held gesture requires *sustained* screen attention for its whole duration; this persona's defining trait is that attention is intermittent. A hold interrupted by a look-away must fail safe. [`mid-hand-chris`](../personas/situational/mid-hand-chris.md), [`newcomer-first-hand`](../personas/situational/newcomer-first-hand.md) (a hidden gesture is undiscoverable — needs a visible affordance or a tap fallback).

**JTBD:** `HE-11` (entry), `HE-12` (undo — confirm-before-commit is *prevention*, and should reduce HE-12 traffic; that reduction is the measurable success signal), `HE-22` (pre-arm — overlaps, must not stack), `HE-23` (orbit throughput — the constraint this must not violate), `PM-16` (roster maintenance — recents list).

**Gap analysis:** **YELLOW.** No new persona needed. One JTBD gap: nothing covers *"see what I'm about to commit before I commit it"* as a job — it is currently an implicit quality attribute. Given `HE-22` was just authored for the adjacent case (the app proposing), this may fold into HE-22's success criteria rather than needing its own ID. Gate 2 decides.

---

## Output 5 — Unresolved design questions for Gate 2/4

1. **Cancellation.** "Release to commit" means once you press, you *will* commit something. That is *worse* misclick defence for an accidental press. Requires an explicit escape — drag outside the grid to cancel, with the preview clearly showing the cancelled state. **Non-negotiable; the proposal is unsafe without it.**
2. **Tap must keep working.** Hold-only would tax every confident selection. Recommend the iOS-keyboard model: **tap commits immediately; hold engages the magnifier.** Two paths, no mode, no delay for users who know where they are aiming.
3. **Occlusion.** The finger covers the target. The magnifier must render offset (conventionally above), and the canvas is only 720px tall — there may be no room above a bottom-row card.
4. **Interrupted hold.** If attention leaves mid-hold (`glance-return-chris`), what happens on return? A hold that silently committed, or one that timed out, are both bad. Probably: hold persists indefinitely until release or cancel.
5. **Does this subsume part of `WS-316`?** Possibly — confirm-before-commit is a **third strategy** for the touch-floor problem, alongside scale-aware floors and un-scaling the command column. It does not raise target size; it removes the *need* for precision. For dense grids that may be the better answer. **The three strategies must be evaluated together at Gate 4, not separately.**

---

## Verdict

**YELLOW — proceed to Gate 2.**

The founder's conclusion is right and his generalisation instinct is right. The premise needs correcting: for the card grid specifically this is **not** a target-size fix (79×92px is generous) — it is a **feedback-timing** fix, and that reframing is what makes the principle auditable across every surface rather than being a one-off zoom feature.

The gesture-vocabulary collision is the real obstacle and it is exactly the "look at it all over the interface" work he asked for.

**Sequencing:** this is a direct input to **Gate 4 (`WS-313`)**, which is open. It should be designed *with* the redesign, not bolted on after — it interacts with `WS-316` (touch floor), `HE-22` (pre-arm), and the roster rail.

---

## Links

- Ticket: `WS-317`
- Evidence: [`evidence/2026-07-31-tvr-device-baseline/`](../evidence/2026-07-31-tvr-device-baseline/README.md) — file `10-card-selector-device-scale-1170x540.png`, measurements above
- Project: `.claude/projects/table-view-redesign-2026-07-31.md`
- Related: `WS-316` (touch floor — overlapping answer space), `WS-313` (Gate 4)

## Change log

- 2026-07-31 — Drafted from founder proposal. YELLOW. Premise corrected by measurement; gesture collision identified as the blocking risk.
