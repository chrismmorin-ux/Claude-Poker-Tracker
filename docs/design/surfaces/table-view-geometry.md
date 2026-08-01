# Gate 4 Phase A — Table View geometry contract

**Item:** `WS-319` · **Sprint:** SPR-162 · **Status:** decision proposed, one founder call outstanding
**Consumed by:** `WS-320` (interaction vocabulary), `WS-313` (surface artifact)
**Supersedes for geometry only:** nothing yet — `surfaces/table-view.md` stays canonical until Phase C.

This phase decides the coordinate system, the touch floor, and overflow behaviour. Everything else in Gate 4 — narrowing, the roster rail, pre-armed defaults, the sizing track — designs *within* what this fixes.

---

## 1 — The measurement that changes the question

Driven at a viewport large enough that `useScale` clamps to **1.0**, so measured px *are* design px:

```
column box    450 × 720 design px
scrollHeight  839          clientHeight 720
                           ── over-subscribed by 119px ──

children:
   48   street tabs
   65   seat indicator
   85   orbit strip (wrapped to 2 rows at 9-handed)
  432   action block  ← 51% of the column
    0   flex-1 spacer
  209   control zone
  ───
  839
```

Two things fall out, and both are load-bearing.

### 1.1 — The spacer is already at zero

`CommandStrip.jsx:1051` has a `<div className="flex-1" />` that pushes the control zone to the bottom. **It measures 0.** There is no slack left to spend.

That kills `WS-311`'s proposed fix (c) — *"collapse the spacer under pressure before any control shrinks"* — outright. The spacer has already collapsed; the compression I measured is what happens *after* it ran out.

### 1.2 — No coordinate-system change makes 839 fit in 720

This is the finding that reframes Phase A. Testing each strategy against the number:

| Strategy | Effect on the 119px overflow |
|---|---|
| **(a) scale-aware floor** — grow design-px targets as `s` falls | **Strictly worse.** Bigger controls, same box. |
| **(c) raise the design-px floor to 44/s_min** | **Strictly worse**, for the same reason. |
| **(b) un-scale the interactive bands** | **Worse in absolute terms.** At the founder's device the column gets 540 real CSS px for 839px of content — 299px over, versus 119 today. |

**None of the three fixes it.** The column is over-subscribed on *content*, and that is independent of the transform. Scale was hiding the problem by shrinking everything below the touch floor; changing the transform stops hiding it.

> And 839 is a **floor**, not a worst case. The measurement was taken in a fresh session with no equity or tendency data, so `LiveAdviceBar` and `PushFoldPanel` rendered nothing. Both add height in real use.

---

## 2 — Decision

**Adopt (b) — un-scale the interactive bands — and add a fourth, non-optional element: the column must shed content or scroll.**

(b) is chosen not because it makes things fit, but because it is the only option under which the touch floor becomes **literally true** rather than nominally true. A 44px control is 44px. That ends the class of defect that let `AUDIT-2026-04-21-TV F8` "fix" a target to 44px and ship it at 28px.

### The contract

**Regions.**
- **The felt scales.** Its meaning *is* its proportions — seat geometry, chip positions, and the spatial map of the table are the information. `SEAT_POSITIONS` stays percentage-based and reflows for free.
- **The command column does not scale.** It lays out in real CSS px at real device size. Nothing about a button's meaning depends on its size relative to the table.
- **A roster rail, if Phase C adds one, does not scale.** It is interactive; same rule.

**Touch floor.** Enforced on **rendered** px, in the un-scaled region, where design px and rendered px are the same number. The Gate 2 pre-commitment is restated:

> ~~All action targets stay ≥44px and equal-area.~~
> **All action targets render at ≥44px on the supported device range, and targets within one action group are equal-area.** Verified by measurement (`npm run devshot`), never by asserting a class string.

**Overflow.** The column gets an explicit scroll region around its **middle band** (seat indicator, orbit strip, action block). The street tabs pin to the top and the control zone pins to the bottom — both `flex-shrink: 0`. So the two things that must never move (street context, and the Next Hand CTA) are always where they were, and only the middle scrolls. That satisfies `glance-return-chris`'s positional-stability contract at the two anchors that matter most, and H-ML05 permits vertical scroll.

**Narrowing (D-2).** Live-players-remaining drives the boundary between the two regions, quantized to street boundaries. Because the column is un-scaled, *widening it genuinely buys usable space* rather than buying a slightly larger picture of the same controls — which is what narrowing was for in the first place.

### What is given up

- **The app stops being one uniformly scaled picture.** Real, and the reason this is a Gate 4 decision rather than a bug fix.
- **The felt and the column no longer share a coordinate system.** Every element that spans them must be re-anchored: `LAYOUT.CONTEXT_MENU_OFFSET_X/Y` (seat context menu is positioned in felt coordinates), the F12 reopen-range affordance (`fixed bottom-4 left-4`), and any roster rail touching the felt edge. Phase C owns those.
- **Vertical scroll appears on a primary path.** Mitigated by pinning the two anchors, but it is a new interaction and Phase B must confirm it does not violate the mid-hand no-interruption contract.

### WS-311 closes here

Under (b) plus the scroll region, the Next Hand CTA is pinned and cannot be clipped. **`WS-311` should be closed by this work, not fixed separately** — fixing it first would be work done twice.

---

## 3 — WS-186 (table flip): deferred, explicitly

Rotation and narrowing are two spatial transforms over the same coordinate system. Under this contract the felt is the only scaled region, so a 180° rotation is a transform *on the felt alone* — which is actually cleaner than today, where it would have had to rotate the whole canvas including the controls.

**But it is deferred behind TVR.** It cannot be specified in parallel, and it should be re-scoped once Phase C fixes the felt's final geometry. Recorded on `WS-186`.

---

## 4 — The consequence Phase C inherits

**839 into 720 (or 540) does not resolve by geometry.** Phase C must reduce the column's content, and the measurement says where the mass is:

| Band | Design px | Note |
|---|---|---|
| action block | **432** | Half the column. Contains presets (68) + custom input (48) + ALL IN (56) + batch row (68) + action buttons (100) |
| control zone | **209** | Clear Seat/Undo, Tag for Review, utility row, Next Hand |
| orbit strip | **85** | Two wrapped rows at 9-handed |

Three levers, in order of promise:

1. **The sizing track consolidates three controls into one.** Preset grid + custom input/GO + ALL IN button (≈190px with gaps) become a single track with an all-in latch. On the prototype that assembly is ≈196px — so this is roughly **height-neutral, not a saving.** Worth stating plainly so Phase C does not bank on space that is not there.
2. **The control zone is the softest 209px.** Tag for Review (48) and the utility row are between-hands actions occupying in-hand real estate. Candidates to move behind a disclosure or onto the felt's freed space.
3. **Progressive disclosure in the action block.** All-in and batch rows are conditional already; making them mutually exclusive with the sizing panel is a real saving but removes a currently-reachable control.

**Recommendation to Phase C: lever 2 first.** It is the largest genuinely-optional block and it does not touch the recording path.

---

## 5 — Verification required before this closes

- [ ] `npm run devshot` at **1600×720** and **1170×540**: Next Hand inside the viewport in every state including 9-handed preflop with sizing open
- [ ] Primary recording controls measure ≥44px **rendered** at both viewports
- [ ] F10 motor separation (Reset Hand vs Next Hand) survives the pinned-control-zone layout
- [ ] Context menu still lands on its seat after the coordinate-system split

---

## Open question for the founder

**Is the un-scaling TableView-only, or app-wide?**

`ScaledContainer` is used by `ShowdownView`, `HandReplayView` and the drill views too. TableView-only is cheaper and lower-risk, but it creates two layout idioms inside one product — which is the drift `sidebar-shell-spec.md` exists to prevent. App-wide is coherent but turns a Gate 4 phase into a cross-surface migration.

**Recommendation: TableView-only now, with the inconsistency recorded as a tracked gap** rather than an accident. The Table View is the only surface used under time pressure with a thumb; the others are read or reviewed. That is a real reason for them to differ, and stating it makes it a decision instead of drift.

---

## Change log

- 2026-08-01 — Phase A drafted under SPR-162. Measured the column at scale 1.0: 839 needed vs 720 available, spacer already at 0. Decision (b) + mandatory content reduction. WS-186 deferred. One founder call outstanding.
