# Session Handoff: sr-6-rebuild-batch-11 (SR-6.14)

**Status:** CLOSED — SR-6.14 shipped 2026-04-15. Z4 deep-analysis split complete.
**Written:** 2026-04-15 | **Closed:** 2026-04-15

## What shipped

### Coordinator state split (batch invariant 1)
- `deepExpanderOpen` → `moreAnalysisOpen` + `modelAuditOpen` (both default false).
- New `lastAutoExpandAdviceAt` (RT-61 advice-identity tracker).
- New `userToggledPlanPanelInHand` (sticky user-intent flag, reset on hand:new).
- Snapshot + renderKey updated (both Open keys hashed separately).
- `clearForTableSwitch` + `hand:new` boundary in `handleLiveContext` both reset all four keys.

### FSM split (batch invariant 1)
- `side-panel/fsms/deep-expander.fsm.js` renamed → `more-analysis.fsm.js` (id `moreAnalysis`).
- New `side-panel/fsms/model-audit.fsm.js` (id `modelAudit`). Parallel state machine.
- Both registered on coordinator in `side-panel.js`.

### Builder split
- `buildDeepExpanderHTML` → `buildMoreAnalysisHTML` (6 sections: range, all-recs, street-tendencies, fold-curve, fold-breakdown, combo-stats, vulnerabilities) + new `buildModelAuditHTML` (Model Audit only).
- `buildMoreAnalysisHTML` `showButton` now reflects content presence (was hardcoded true) — sparse advice correctly returns false.

### Render layer
- `renderDeepExpander` → `renderMoreAnalysis` + new `renderModelAudit`.
- Legacy "auto-open on postflop" removed from 4.2 per batch invariant 2.
- `renderModelAudit` flag-gates via `snap.settings?.debugDiagnostics`:
  - Flag off → both `#model-audit-btn` and `#model-audit-content` `.remove()`d from DOM (not hidden).
  - Flag on → scaffold reinserted via `insertAdjacentHTML` after `#more-analysis-content` (so Z4 row order survives flip-on).
  - Click handler idempotently wired via `dataset.maWired`.
- Shared `wireDeepSectionToggles` helper reuses userCollapsedSections restoration for both collapsibles.

### RT-61 predicate fix (batch invariant 2)
- **Bug found:** pre-SR-6.14 `renderPlanPanel` called `clearTimer` + `scheduleTimer` every render where panel was closed. Since renders fire far more often than every 8 s (push advice, push context, 1 Hz stale-badge timer, user interactions), the timer was perpetually reset and never actually fired.
- **Fix:** re-arm only when `advice._receivedAt !== lastAutoExpandAdviceAt && !isOpen && handPlan && !userToggledPlanPanelInHand`. Tracker is updated when timer arms; hand:new clears it so next hand's advice re-arms.
- User explicit toggle (click) now sets `userToggledPlanPanelInHand = true` → auto-expand suppressed for the rest of the hand per spec §6.1 ("user collapse wins within the hand").

### Stale-tint cross-zone inheritance (batch invariant 5)
- New CSS: `.deep-expander-content.stale` shares the existing `.action-bar.stale / .plan-panel.stale` palette.
- renderAll toggles `.stale` on `#more-analysis-content` and `#model-audit-content` from the same `computeAdviceStaleness(advice, liveCtx)` source.

## Files modified

- `ignition-poker-tracker/side-panel/render-coordinator.js` — 4 new state keys, snapshot + renderKey + clearForTableSwitch + hand:new.
- `ignition-poker-tracker/side-panel/render-orchestrator.js` — `buildDeepExpanderHTML` replaced by `buildMoreAnalysisHTML` + `buildModelAuditHTML`.
- `ignition-poker-tracker/side-panel/side-panel.js` — imports, FSM registration, renderMoreAnalysis, renderModelAudit, renderPlanPanel predicate rewrite, stale toggles, click handlers.
- `ignition-poker-tracker/side-panel/side-panel.html` — ID rename (`deep-expander-*` → `more-analysis-*`), added model-audit scaffold, stale CSS rule.
- `ignition-poker-tracker/side-panel/harness/harness.js` — drives both new collapsibles.
- `ignition-poker-tracker/side-panel/fsms/more-analysis.fsm.js` — renamed from deep-expander.fsm.js (id `moreAnalysis`).
- `ignition-poker-tracker/side-panel/fsms/model-audit.fsm.js` — new (id `modelAudit`).

### Tests
- `side-panel/__tests__/z4-deep-analysis.test.js` — **new, 19 cases**: coordinator state split, independent toggles, clearForTableSwitch + hand:new reset both, renderKey flips on both Open keys + debug flag, FSM registration + distinct ids + tableSwitch collapse, builder output segregation, RT-61 predicate logic (fresh/same-advice/no-handPlan/user-toggled/hand:new-clears) documented end-to-end.
- `side-panel/__tests__/render-orchestrator.test.js` — `buildDeepExpanderHTML` describe block renamed + new `buildModelAuditHTML` describe + null-safety sweep covers both.
- `side-panel/__tests__/fsm.test.js` — `moreAnalysisFsm` + new `modelAuditFsm` describes.
- `side-panel/__tests__/coordinator-dispatch.test.js` — renamed references (`deepExpanderFsm` → `moreAnalysisFsm`, id `'deepExpander'` → `'moreAnalysis'`).
- `side-panel/__tests__/render-coordinator.test.js` — `deepExpanderOpen` renderKey test split into two (moreAnalysisOpen + modelAuditOpen).
- `side-panel/__tests__/message-harness.js` — snapshot shape updated.

## Gate — BACKLOG row

> Flag-off replay: 4.3 absent from DOM; flag-on: 4.3 independent from 4.2.

- ✅ `renderModelAudit` calls `removeModelAuditDom()` when `snap.settings.debugDiagnostics !== true` — both elements removed (`.remove()`), not hidden.
- ✅ `moreAnalysisOpen` and `modelAuditOpen` are distinct coordinator keys; each has its own FSM (`moreAnalysis` / `modelAudit`). Tests pin independence.
- ✅ 1694 → 1765 tests passing (+71). `node build.mjs` clean (6 entry points).

## Not in this PR — deferred

- **Container migration** — Z4 content still lives outside `#zone-z4`. SR-6.16.
- **`.deep-expander-*` CSS class rename** — class names retained for all three collapsibles (More Analysis, Model Audit, plus legacy inner `.deep-section`) to avoid a second CSS pass. SR-6.16.
- **Observer-mode tier release for X.4 Z2 slot** — carried forward from SR-6.15.
- **Harness visual verification** — not run this session (headless env).
- **`render-tiers.js` monolith deletion** — originally flagged for SR-6.16, but those section builders are still the sole implementation of `renderModelAuditSection` + the six More-Analysis sections; the file stays. SR-6.16 scope updated in BACKLOG to reflect.

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one:
   - **SR-6.16 (M)** — Cleanup (scope updated in BACKLOG — now focused on container migration + CSS rename + Observer-mode tier release + stray state sweep). Unblocked now (SR-6.14 shipped).
   - **SR-7 (—)** — Cutover: flip `sidebarRebuild` default to true, delete legacy code paths. Blocked on SR-6.16.

Z2 + Z3 + Z4 are all now spec-aligned at the zone logic level. The remaining zone PRs in program scope were SR-6.10–SR-6.15 (+cleanup); all done.

## Closeout checklist
- [x] Coordinator key split shipped (moreAnalysisOpen, modelAuditOpen, lastAutoExpandAdviceAt, userToggledPlanPanelInHand).
- [x] FSM split shipped (moreAnalysisFsm, modelAuditFsm).
- [x] Builder split shipped (buildMoreAnalysisHTML, buildModelAuditHTML).
- [x] Model Audit flag-gated absence-from-DOM (not `hidden`).
- [x] RT-61 predicate fixed (fresh-advice discriminator + sticky user-intent flag).
- [x] Stale-tint cross-zone inheritance.
- [x] Harness + 19-case z4-deep-analysis.test.js + builder/FSM test updates.
- [x] `npm test` passes (1765).
- [x] `node build.mjs` clean.
- [x] BACKLOG updated — SR-6.14 COMPLETE, SR-6.16 unblocked.
- [x] This handoff closed.
