# Session Handoff: sr-6-rebuild-batch-12 (SR-6.16)

**Status:** CLOSED — SR-6.16 shipped 2026-04-15. Scope reduced; SR-6.17 filed.
**Written:** 2026-04-15 | **Closed:** 2026-04-15

## What shipped

Cleanup items 3, 4, 5, 6 from the original plan. Items 1+2 (DOM container migration) **dropped** after discovering a shell-visibility blocker — documented below and filed as SR-6.17.

### 1. Shell-visibility blocker (scope reduction)
`#hud-content-v2` (`side-panel.html:1712`) is hidden when `!hasTableHands` (`side-panel.js:1801`). Moving any zone DOM into the v2 shell would also hide it when flag=off (legacy path), breaking the currently-shipping sidebar. Z0 (pipeline-health, no-table) + X.3 must stay visible with no table, so even the shell's advertised purpose is broken. DOM migration for all zones requires a shell visibility redesign → filed as SR-6.17 (blocks SR-7).

### 2. `.deep-expander-*` → `.collapsible-*` rename
9 class refs + 2 comment refs across `side-panel.html` + `side-panel.js`:
- `.deep-expander-btn` / `-chevron` / `-content` → `.collapsible-*`
- Section-header comment updated ("DEEP EXPANDER" → "COLLAPSIBLE")
- No tests or harness referenced the old class names (grep-clean).

### 3. Strict Rule V on `.villain-tab`
`render-street-card.js:754` — `isFocused = vr.seat === focusedVillain || vr.seat === advice?.villainSeat` → **`isFocused = vr.seat === focusedVillain`**. Advice villain that isn't focused now emits `.advice-match` instead of `.active`. Rationale: `.active` must not lie about which seat's range is on screen when user pinned a different seat.

New CSS rule (`side-panel.html:950`): `.villain-tab.advice-match:not(.active)` — gold-dim border, gold text, no fill.

New tests in `render-street-card.test.js`:
- Only focused seat gets `.active`; advice villain (different) gets `.advice-match`.
- No `.advice-match` emitted when focused equals advice villain.

### 4. Observer-mode tier release verification (X.6)
BACKLOG said "X.4" — user-confirmed typo for X.6. New `__tests__/zx-observer-mode.test.js` (4 cases):
- `classifyBetweenHandsMode` returns `OBSERVING` when hero folded (past mode-A window).
- `buildBetweenHandsHTML('OBSERVING')` emits `SCOUTING — Seat N` + `bh-scout` / `mode-observing`.
- `buildUnifiedHeaderHTML` emits `uh-observing` + `Observing` text for heroFolded fixture.
- Negative case: hero still in hand → not OBSERVING.

### 5. Orphan-state audit (no migration)
Three IIFE-scope `let`s examined (`tourneyLogVisible`, `activePidFilter`, `diagVisible`). All three are correctly scoped as UI preferences local to their handlers — none participate in renderAll's snapshot/renderKey, none need table-switch reset. Each annotated in place with a justification comment so a future reader doesn't re-raise the concern. No coordinator changes.

### 6. `render-tiers.js` retention
Explicit keep — its section builders are still the sole implementation for the 6 More-Analysis sections + Model-Audit section (confirmed against `render-orchestrator.js` `buildMoreAnalysisHTML` + `buildModelAuditHTML`).

## Files modified

- `ignition-poker-tracker/side-panel/side-panel.html` — class rename (3 classes) + new `.villain-tab.advice-match:not(.active)` rule + section header comment.
- `ignition-poker-tracker/side-panel/side-panel.js` — class rename in `MODEL_AUDIT_*_HTML` templates + 3 orphan-state justification comments.
- `ignition-poker-tracker/side-panel/render-street-card.js` — `isFocused` strict-match + `.advice-match` class emission.
- `ignition-poker-tracker/side-panel/__tests__/render-street-card.test.js` — 2 new test cases.
- `ignition-poker-tracker/side-panel/__tests__/zx-observer-mode.test.js` — **new**, 4 cases.
- `.claude/BACKLOG.md` — SR-6.16 COMPLETE, new SR-6.17, SR-7 blocker updated.

## Gate — BACKLOG row

Original gate: "No dead code in side-panel modules; all render functions map 1:1 to an SR-4 spec row."

- ✅ No dead code (render-tiers.js explicitly retained; CSS class rename removes the "deep-expander" misnomer; `.villain-tab.active` now maps 1:1 to Rule V focused seat).
- ✅ 1771 tests passing (+7 new, 0 regressions). Build clean (6 entry points).
- ⚠️ 1:1 spec mapping — SR-6.17 is required to complete this (all-zone DOM migration); SR-6.16 got the logic-level cleanup only.

## Deferred to SR-6.17 (filed)

- All-zone DOM migration (Z0, Z1, Z2, Z3, Z4, Zx) into `#zone-z*` containers.
- Shell visibility redesign — either move Z0/Zx zones outside `#hud-content-v2`, or make the shell always-shown with per-zone visibility. Recommendation: (b) matches R-1.3 no-reflow.
- Flag-on functional parity verification against all 16 harness fixtures.

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one:
   - **SR-6.17 (L)** — Shell visibility redesign + all-zone DOM migration. Blocks SR-7. Recommended: start with a design memo on visibility model before touching DOM.
   - **SR-7 (—)** — Cutover + post-mortem. Still blocked on SR-6.17.

## Closeout checklist

- [x] `.deep-expander-*` → `.collapsible-*` rename shipped.
- [x] Strict Rule V + `.advice-match` shipped + 2 tests.
- [x] X.6 observer mode verification shipped (4 tests).
- [x] Orphan-state audited + annotated (no migration needed).
- [x] `render-tiers.js` retention confirmed + documented.
- [x] `npm test` passes (1771).
- [x] `node build.mjs` clean.
- [x] BACKLOG updated — SR-6.16 COMPLETE, SR-6.17 filed, SR-7 blocker re-pointed.
- [x] This handoff closed.
