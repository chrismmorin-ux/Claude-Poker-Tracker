# Surface — Live Advice Refinement State

**ID:** `live-advice-refinement-state`
**Parent zone:** Main-app `TableView/LiveAdviceBar` (Row 1, inline badges beside the action label). Extension sidebar `Z2 Decision` inherits the same payload over the wire.
**Product line:** Main-app live in-game surface (TableView) + Ignition extension side panel.
**Tier placement:** Decision-critical. This is not decoration on the advice — it is a statement about whether the advice is finished.
**Last reviewed:** 2026-08-20 (Gate 4 authoring, WS-574 / WS-575, SPR-193)

**Code paths:**
- `src/components/views/TableView/LiveAdviceBar.jsx` (modified — `isProvisional` / `changedFrom` derivation + two Row-1 badges)
- `src/hooks/useLiveActionAdvisor.js` (modified — provisional delivery from `onFastResult`; refined delivery carries `changedOnRefine`)
- `src/hooks/useActionAdvisor.js` (modified — same two-phase shape for the manual what-if panel)
- `src/utils/liveAdvisor/computeHelpers.js` (modified — threads `onFastResult` to `evaluateGameTree`)
- `src/utils/exploitEngine/gameTreeEvaluator.js` (producer — `onFastResult`, `refinementBudgetMs`, `depthParity`)

**Related docs:**
- `docs/standard-of-record/REFINEMENT-CLOCK-CALIBRATION.md` — the logical clock the budget is denominated in
- `src/utils/exploitEngine/CLAUDE.md` § "`evaluateGameTree` is TWO-PHASE (WS-334)"
- `.claude/rules/surfaces-reach-the-table.md` — why a study-only answer is not an answer

---

## Purpose

Say, on the face of the recommendation, whether the engine has finished thinking — and when
finishing changed its mind, say what it changed from.

The surface exists because of a measured defect. `evaluateGameTree` has produced a depth-1
answer before refinement since WS-334, and **no production caller ever took it**. With no fast
path, the refinement clock had to double as a table-latency floor, and at that floor
(`refinementBudgetMs: 2000`) depth-2 never once completed: mean runout coverage 0.380 across 40
boards, with barrel planning (`depth3Barrel`) budget-gated on every board measured. Wiring the
fast path is what lets the budget rise; this surface is what makes the resulting two-stage
answer legible instead of confusing.

## The problem it prevents

**A recommendation that changes under hero's eyes with no signal is a recommendation hero
cannot trust, and trusting it is the entire point of putting it on the table.**

WS-496 measured depth-2 flipping the top action on 35.3% of flops. That is the common case, not
an edge case. Without this surface, hero reads BET, starts reaching for chips, and the bar
silently becomes CHECK.

## JTBD served

Primary:
- `JTBD-MH-02` see whether the recommendation is fresh — **this surface is the direct answer**;
  previously "fresh" could only mean *not stale*, never *not finished*.
- `JTBD-MH-01` see the recommended action for the current street — served *sooner*, because the
  depth-1 answer now renders instead of being computed and discarded.

Secondary:
- `JTBD-MH-10` plain-English "why" — `WAS BET` is a one-word why for the change itself.

## Personas served

- [mid-hand-chris](../personas/situational/mid-hand-chris.md) — primary. Under a clock, at the
  table, deciding. The whole design constraint is that he must be able to tell "act on this now"
  from "this may still move" without reading anything.

---

## Anatomy

Two Row-1 badges, in the existing badge idiom (same shape/scale as `STALE` and `HIGH VARIANCE`).
They are mutually exclusive — `WAS x` renders only once `isProvisional` is false.

```
  provisional (refinement running)
  ┌───────────────────────────────────────────────┐
  │ ★ BET  75% pot  +2.4  [conf]  ⟳ REFINING      │   ← pulsing, bar dimmed to 0.75
  └───────────────────────────────────────────────┘
                    ↓  refinement lands
  refined, decision unchanged
  ┌───────────────────────────────────────────────┐
  │ ★ BET  75% pot  +2.9  [conf]                  │   ← no badge; nothing to report
  └───────────────────────────────────────────────┘

  refined, decision changed
  ┌───────────────────────────────────────────────┐
  │ ★ CHECK  +3.1  [conf]  WAS BET                │   ← amber, persists with this advice
  └───────────────────────────────────────────────┘
```

- **`REFINING`** — blue (`#1e3a5f` / `#7dd3fc`), `animate-pulse`. Present iff the payload is the
  depth-1 answer and refinement is still running.
- **`WAS <ACTION>`** — amber (`#3b2f0b` / `#fcd34d`), static. Present iff refinement moved the
  top action off what the provisional answer recommended.
- **Bar opacity** joins the existing 0.75 "about to change" tier alongside `adviceComputing`.
  Provisional and in-flight-recompute mean the same thing to hero, so they must not look
  different.

## Doctrine rule compliance

- **Spatial regions scale, interactive regions do not** (`layout-doctrine.md`) — both badges are
  non-interactive status text. No touch target is introduced, so `touch-floor.spec.js` is
  unaffected.
- **Diagnostics ship to production** — this renders in the PROD build. It is not behind
  `import.meta.env.DEV`; a state hero cannot see on his own phone is a state that does not exist.

## State / props / context

Derived in `LiveAdviceBar` from the advice payload; the bar holds no state of its own.

| Field | Set by | Meaning |
|---|---|---|
| `isProvisional` | `useLiveActionAdvisor` / `useActionAdvisor` | `true` on the depth-1 delivery, `false` on the refined one |
| `changedOnRefine` | same, refined delivery only | the action the provisional answer recommended, when refinement moved off it; `null` when it agreed |

**The provisional payload OMITS `villainRanges`, `multiwayEquity` and `narrowingLog` — it does
not set them to `null`.** They are computed after the game tree returns, so at fast time they do
not exist. `validateActionAdvice` (`ignition-poker-tracker/shared/wire-schemas.js`) checks these
with `!== undefined`, so an explicit `null` **fails validation** while an absent key passes. A
hard-rejecting Ignition validator silently dropping HUD updates is a failure this repo has
already lived through once, for months.

## Key interactions

- **Refinement starts:** depth-1 answer renders with `REFINING`. Hero can act on it immediately.
- **Refinement lands, agreeing:** badge clears, EV updates. No `WAS` badge — nothing happened
  worth a word.
- **Refinement lands, disagreeing:** action changes and `WAS <old>` appears, persisting with this
  advice until the street or hand advances.
- **Hand/street advances mid-refinement:** the existing `handNumber` mismatch gate
  (`LiveAdviceBar.jsx`) suppresses the bar, and `useAbortControl` prevents a stale fast result
  from overwriting a newer one. Asserted in `useActionAdvisor.test.js` and
  `useLiveActionAdvisor.twoPhase.test.js`.

## Edge cases

- **Two wire pushes per decision — RESOLVED 2026-08-20.** `OnlineAnalysisContext` pushes every
  advice object to the extension, so the panel receives a provisional push and then a refined
  one. Two changes were needed and the first is the one that would have been missed:
  1. `isProvisional` and `changedOnRefine` were **not in `ADVICE_FIELDS`**
     (`ignition-poker-tracker/shared/wire-schemas.js`), so `pick()` stripped them silently and
     the panel could not tell the two pushes apart. This is the same omission that list's own
     `flopBreakdown` comment records — a field left off is dropped with no error anywhere.
  2. `renderVillainRangeSection` treated absent `villainRanges` as "no ranges" and drew the
     GTO / no-aggressor fallback. It now renders a `Refining — ranges arriving` placeholder
     when the payload is provisional, and falls through to the real fallback otherwise.

  The placeholder deliberately mirrors `renderNoAggressorPlaceholder` in structure — same
  wrapper, same mounted legend — so the slot does not resize. **Verified in a real browser**
  via the 16-scenario harness: slot geometry is identical (152×363) across the provisional,
  no-aggressor and populated-grid states, so nothing reflows when ranges arrive.

  Evidence: `docs/design/audits/evidence/2026-08-20-ws574-provisional-range-slot.png` and
  `…-baseline-noaggressor.png`. (The header's clipped `NN% equity` visible in both is
  pre-existing panel styling, present in the untouched baseline fixture — not from this change.)
- **`advice.timestamp` refreshes on the refined delivery,** so `isStale` / `isFading` restart
  their clock from the refined answer rather than the provisional one. That is correct — the
  refined answer is what hero is looking at — but it means the fade window is measured from
  refinement, not from first paint.
- **`refinementBudgetMs: 0`** ("fast answer only") produces a refined delivery with no preceding
  provisional one. `isProvisional` is simply never true; the surface is inert, not broken.

## Test coverage

- `src/hooks/__tests__/useActionAdvisor.test.js` — two-phase delivery, flip reporting, staleness
- `src/hooks/__tests__/useLiveActionAdvisor.twoPhase.test.js` — provisional/refined ordering,
  **field-omission** assertion, hand identity in phase one
- `src/utils/liveAdvisor/__tests__/buildPostflopAdvice.passthrough.test.js` — the callback
  actually reaches the engine
- `ignition-poker-tracker/side-panel/__tests__/z3-range-slot.test.js` — provisional renders the
  refining placeholder and NOT the fallback; a refined payload with genuinely empty ranges still
  gets the fallback (so the guard cannot leak); advice with no phase field is unaffected.
- `…/__tests__/fixtures.js` — `z3_provisionalAdviceRanges`, which joins both the extension suite
  and the visual harness automatically.
- Each of the above was verified to FAIL when its own layer is reverted.
- **Visual verification — extension side: DONE** (harness, evidence above).
  **Main-app `LiveAdviceBar` badges: still render-tested only.** `npm run devshot` confirms the
  app boots clean with 0 page errors but cannot show them: `useAnalysisContext` IS
  `OnlineAnalysisContext`, so the plain dev table has no game-tree advisor to produce a
  provisional payload. The on-device check belongs on the online path.

## Known issues

- Main-app `LiveAdviceBar` badge states have not been seen on a device or in a live spot; they
  are covered by render tests only (see Test coverage).

## Change log

- 2026-08-20 — Created. Gate 4 authoring for WS-574's two-phase wiring and the `WAS x` flip
  callout chosen by founder ruling the same day.
- 2026-08-20 — Extension range slot given its own refining state; wire whitelist extended so the
  phase fields actually reach the panel. Harness-verified, evidence stored.
