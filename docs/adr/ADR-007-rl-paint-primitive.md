# ADR-007: Range Lab Paint Primitive — Tap-to-Toggle + Long-Press-for-Weight

## Status
Accepted

## Date
2026-05-20

## Context

Range Lab (RL) adds an interactive 13×13 paintable range grid to Explorer mode (per Gate 1 — `surfaces/postflop-drills.md` Range Lab section forthcoming). The paint primitive is the foundational interaction that every other RL JTBD depends on (DS-52 paint, DS-53 compare, DS-54 multi-street evolution, DS-55 validate authored content). Gate 1 audit (2026-04-22) flagged the interaction pattern as YELLOW (new interaction primitive, not present anywhere in codebase); Gate 2 Blind-Spot Roundtable (2026-05-20, `docs/design/audits/2026-05-20-blindspot-range-lab.md`) confirmed YELLOW and routed the primitive choice to this ADR.

Three primitive options were enumerated by the Range-Paint Interaction Designer voice in Gate 2 Stage B + Stage E:

1. **Tap-to-toggle + long-press-for-weight** — Tap a cell = include @ 100% / exclude (binary toggle). Long-press = open weight slider in-place.
2. **Tap-and-hold-for-weight** — Tap = include @ 100%. Press-and-hold = enter weight slider directly (no two-step grammar).
3. **Slider-per-cell** — Every cell always shows a tiny slider. Tap = full; drag horizontal = partial weight.

The choice shapes WS-055 Gate 4 surface spec (paint UX section), WS-203 Undo Stack ADR (per-stroke granularity assumes per-cell action atomicity), and WS-208 mobile-portrait surface variant (small-cell ergonomics).

## Decision

**Use tap-to-toggle + long-press-for-weight.**

- **Tap a cell:**
  - Cell empty → cell becomes included @ 100% weight
  - Cell included → cell becomes excluded (weight = 0)
  - One tap = one undo-stack entry (see ADR-008)
- **Long-press a cell** (≥ 400ms; standard threshold per existing app gestures):
  - Opens an in-place weight slider over the cell
  - Slider shows current weight; user adjusts; `Apply` commits; `Cancel` reverts
  - Apply = one undo-stack entry (regardless of prior weight)

**Cell rendering:** unweighted cells render as included @ 100% (full color). Weighted cells (`0 < w < 1`) render with partial fill height OR a small weight badge — exact visual treatment is a Gate 4 surface decision, not an ADR concern.

**Scale-aware ergonomics (per Gate 2 C-A3 + E-A9):** at `scale × cellWidth < 44 DOM-px`, the paint mode switches to long-press-required for *all* actions (tap is too easy to misfire at small cell sizes). Optional grid-zoom modal for mobile-portrait per WS-208.

## Alternatives Considered

### Tap-and-hold-for-weight

- **Pros:**
  - Faster for weight-aware users (skips the binary-toggle intermediate)
  - Single gesture grammar (tap vs hold)
  - Fewer total taps for partial-weight authoring
- **Cons:**
  - Conflates two semantically different actions under timing alone — "I want this cell included" and "I want to set its specific weight" become indistinguishable until the hold-threshold fires
  - Misclick risk: accidental long-press triggers weight slider when user meant single tap (especially on mobile-portrait where finger pressure varies)
  - Loses the "binary first, partial as opt-in" cognitive layering that matches typical user mental model (include this hand → maybe later tune the weight)
  - H-PLT06 misclick absorption is harder: a misfired hold opens a modal that demands explicit dismiss

### Slider-per-cell

- **Pros:**
  - Most explicit — current weight always visible
  - No hidden modes (everything is a slider)
- **Cons:**
  - 169 sliders simultaneously visible — surface chrome is overwhelming and visually noisy
  - Cell width at 1.0 scale ≈ 30px; a slider plus tap target inside a 30px cell is infeasible at usable density
  - Mobile-portrait infeasible (cells compress further)
  - "Tap = full" is still a binary action layered on top of the always-present slider — semantically equivalent to tap-to-toggle but with worse visual density
  - Drag horizontal inside a 30px cell is imprecise

### Hybrid (mode toggle in toolbar — "Paint Mode" vs "Weight Mode")

- **Pros:** Mode-explicit; no gesture overload
- **Cons:** Adds a mode-bar control that users must remember; modes are notoriously bad UX for primary interaction; defers the decision instead of answering it; per `feedback_long_term_over_transition.md` the right call is to pick one and ship it

## Consequences

### Positive
- Matches existing app gesture vocabulary (tap = primary action, long-press = secondary)
- Weight granularity is opt-in — typical user (full-include) never encounters the slider
- Cognitive layering aligns with mental model: include first, refine later
- Mobile-portrait scales cleanly (per WS-208 reflow) — the same gesture grammar works at smaller cell sizes once long-press-required mode engages
- Aligns with H-N03 undo + H-PLT06 misclick absorption (tap is reversible; long-press requires intentional hold)
- Establishes a primitive that future PIO-line surfaces or other range-display surfaces can inherit if they need painting (per Gate 2 Stage E First-Principles Auditor's H-N04 consistency note)

### Negative
- Two-step grammar (toggle then long-press) is slower than tap-and-hold for users who routinely author partial-weight ranges
- The long-press → slider modal flow has more touch surface than an inline gesture
- Cell rendering for weighted-but-included cells (`0 < w < 1`) needs a visual treatment distinct from both empty and full — adds rendering complexity vs slider-per-cell's uniform treatment

### Mitigations
- Scale-aware ergonomics (per C-A3 + E-A9): below the 44 DOM-px floor, switch to long-press-required for all actions — prevents tap misfires at small scales without losing the gesture grammar
- "Clear all" is a separate destructive action with confirmation modal (per Gate 2 E-A3) — bypasses both undo stack and paint gestures
- First-use inline hint (per Gate 2 E-A5): 2-line state hint ("Tap to include; long-press for weight") fades after first paint completed; never reappears
- Cell rendering for partial-weight cells — Gate 4 surface spec picks a treatment (partial fill, weight badge, or hatched pattern); not an ADR concern but the design space is small and tractable

## References

- Gate 1 audit: [`../design/audits/2026-04-22-entry-range-lab.md`](../design/audits/2026-04-22-entry-range-lab.md) §"Output 4 — Gap analysis verdict" (Interaction pattern: YELLOW)
- Gate 2 audit: [`../design/audits/2026-05-20-blindspot-range-lab.md`](../design/audits/2026-05-20-blindspot-range-lab.md) Stage B (DS-52 primitive options) + Stage E (E-A1 layout invariants + E-A9 scale-aware ergonomics)
- Surface this will be cited from: [`../design/surfaces/postflop-drills.md`](../design/surfaces/postflop-drills.md) — Gate 4 Range Lab section (WS-055, forthcoming)
- Companion ADR: [`./ADR-008-rl-undo-stack.md`](./ADR-008-rl-undo-stack.md) — per-stroke undo granularity assumes per-cell action atomicity defined here
- Sprint: SPR-094. Ticket: WS-202.
- Founder-ratified at SPR-094 plan-mode (2026-05-20): tap-to-toggle + long-press-for-weight per Gate 2 recommendation; alternatives explicitly rejected.
