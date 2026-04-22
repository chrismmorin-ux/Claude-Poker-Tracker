# Audit — 2026-04-22 — analysis-view

**Scope:** Surface — `analysis-view` (two-tab orchestrator: Player Analysis + Hand Review)
**Auditor:** Claude (main) via code inspection at 1600×720 reference
**Method:** Direct Gate-4 heuristic audit. No Gate-2 roundtable — analysis-view does not introduce a novel product line or persona class beyond what hand-replay-view's Gate-2 already covered; personas served (Chris, Rounder, Hybrid Semi-Pro, Apprentice, Coach, Multi-Tabler) are continuous with surfaces already framework-integrated.
**Status:** Draft.

---

## Executive summary

**Verdict: RED.** One P0 — `confirm('Delete this hand? This cannot be undone.')` in `HandReviewPanel.jsx:43` is the **same destructive-action anti-pattern** that Wave 1 and DCOMP-W4 systematically eliminated elsewhere. It persisted here because AnalysisView wasn't in either wave's scope. Secondary concerns: extreme information density across the view (`px-2 py-1`, `text-[10px]`, `text-xs` throughout) means few touch targets meet ≥44×44, and the 516-LOC PlayerAnalysisPanel is the densest non-audited component in the codebase. 1 P0, 5 P1, 4 P2, 3 P3.

---

## Findings

### F1 — `confirm()` on hand delete (destructive-action anti-pattern)

- **Severity:** 4 (P0)
- **Situations affected:** Post-session-chris cleaning up junk-imports; Coach removing a hand from a student's queue
- **JTBD impact:** SR-23 / SR-24 side effect (user's intent is review, delete is an adjacent action that becomes catastrophic via this path)
- **Heuristics violated:** H-N5 (error prevention), H-N3 (user control + freedom), Wave-1 established pattern
- **Evidence:** `src/components/views/AnalysisView/HandReviewPanel.jsx:43` — `if (!confirm('Delete this hand? This cannot be undone.')) return;` with subsequent IDB delete.
- **Observation:** Exact same anti-pattern class as TV-F1 / SV-F1 / PlayersView-F2 / TournamentView-F1, all fixed in prior waves. Copy literally says "cannot be undone" which — per SessionsView-F1 precedent — is the leak: the action CAN be undone, the current implementation just doesn't.
- **Recommended fix:** SV-F1 deferred-delete pattern. Snapshot hand record before optimistic-filter + setTimeout commit. Undo restores. 12s toast.
- **Effort:** S-M (hand record may have side effects on `tendencyMap` + `weaknessesDetected` caches — verify; if just an IDB entry with no cross-store references, S).
- **Proposed backlog item:** `DCOMP-W2-A2-F1 — HandReview delete → toast+undo deferred-delete` (P0)

### F2 — Touch targets uniformly below ≥44×44

- **Severity:** 3 (P1)
- **Heuristics violated:** H-ML06
- **Evidence:** Grep confirms `px-2 py-1`, `px-3 py-1` / `py-1.5`, `py-0.5` patterns across index.jsx (tab buttons), HandBrowser.jsx (filter chips, hand-list rows, Open/Delete buttons at lines 220/228), HandWalkthrough.jsx (step-back/step-forward buttons at lines 152/159), PlayerAnalysisPanel.jsx (seat-tab buttons at 204/220/269).
- **Specific high-impact items:**
  - HandBrowser hand-list row buttons (Open / Delete) are `text-[10px] font-semibold py-1` — ~12px tall.
  - HandWalkthrough step-back/step-forward buttons — `text-xs px-3 py-1` — ~24px tall.
  - Index tab buttons — `text-sm px-3 py-1.5` — ~32px tall.
- **Recommended fix:** Systematic `min-h-[44px]` pass across AnalysisView. Bundle with F3 below.
- **Effort:** M — touches 5 sub-components; mechanical but broad.
- **Proposed backlog item:** `DCOMP-W2-A2-F2 — AnalysisView touch targets ≥44×44` (P1)

### F3 — Text-size density (text-[10px] + text-xs) degrades at reference viewport

- **Severity:** 3 (P1)
- **Heuristics violated:** H-PLT-03 (dim-light readable), H-ML02 (density vs chrome)
- **Evidence:** Multiple `text-[10px]` and `text-xs` (12px) across HandBrowser + HandWalkthrough + PlayerAnalysisPanel badges.
- **Observation:** Information density is intentionally high (this is a deep-analysis surface) but at 1600×720 reference device with typical field-lighting, ≤12px text strains read-speed. The HandBrowser hand-list cards especially.
- **Recommended fix:** Minimum text size ≥12px (`text-xs`) for all body text; ≥14px (`text-sm`) for primary information (hand ID, pot, hero hand). `text-[10px]` permitted only for tertiary badges (action-class chip on a dense row).
- **Effort:** M — find/replace with visual verification.
- **Proposed backlog item:** `DCOMP-W2-A2-F3 — AnalysisView text-size floor` (P1)

### F4 — HandBrowser filter discoverability

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N7 (flexibility + efficiency — filters exist but aren't obviously filters), H-ML01 (discoverability)
- **Evidence:** `HandBrowser.jsx:98-145` — street/position/opponent-style filter inputs rendered inline at top of browser, but the filter controls are styled identically to other list chrome (same color, same density). Coach / Apprentice new to the surface won't discover them quickly.
- **Recommended fix:** Visual segregation — a subtle `border-b` + `text-gray-400` uppercase label "Filters" above the filter row. Bonus: show active-filter count ("Showing 47 of 200 hands · 2 filters active") so the state of the filter is visible even when controls are scrolled past.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A2-F4 — HandBrowser filter segregation + active-filter count` (P1)

### F5 — "All sessions" filter mode is expensive on large archives

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N1 (visibility of system status — user doesn't know this is expensive)
- **Evidence:** Surface artifact line 115: "HandBrowser filters are in-memory over the current session's hands by default; 'all sessions' mode exists but is expensive on large archives."
- **Recommended fix:** When "all sessions" mode is toggled on AND the archive is large (>500 hands), show a progress toast + the filter run asynchronously. Alternatively: persist filter results across session switches so repeat filters are cached.
- **Effort:** M.
- **Proposed backlog item:** `DCOMP-W2-A2-F5 — all-sessions filter progress + cache` (P1)

### F6 — PlayerAnalysisPanel 516-LOC density (decomposition candidate)

- **Severity:** 2 (P2)
- **Heuristics violated:** Maintainability (not user-facing)
- **Evidence:** Surface artifact line 111 pre-flags.
- **Recommended fix:** Decompose into `WeaknessesSection.jsx` + `VillainProfileSection.jsx` + `RangeProfileSection.jsx` + container. Target: no file > 200 LOC.
- **Effort:** M.
- **Proposed backlog item:** `DCOMP-W2-A2-F6 — PlayerAnalysisPanel decomposition` (P2)

### F7 — SR-88 cross-player similar-spot search not served

- **Severity:** 2 (P2)
- **Evidence:** Surface artifact line 125. "Similar spot across history" is per-player only today.
- **Recommended fix:** Out of W2 scope; flag as discovery candidate. Matches DISC-11 (ARCHIVED per H1 triage).
- **Proposed backlog item:** Pointer to DISC-11.

### F8 — F-W4 hand-significance indicator not surfaced here either

- **Severity:** 2 (P2)
- **Evidence:** Surface artifact line 128; same as hand-replay-view F2 finding but from the HandBrowser side.
- **Recommended fix:** In HandBrowser hand-list row, render the significance badge alongside hand-id / pot. Unlocks Study-block scan-browse. Pair with W2-A1-F2 (HandReplayView header badge).
- **Effort:** S (same module consumption, different surface).
- **Proposed backlog item:** `DCOMP-W2-A2-F8 — HandBrowser hand-significance badge per row` (P2)

### F9 — Export specific hand/review missing

- **Severity:** 2 (P2)
- **Evidence:** Surface artifact line 130.
- **Recommended fix:** Add small "Export" affordance per hand row. Minimum: `application/json` single-hand export. Sharing link (SR-27) is its own bigger scope.
- **Effort:** S (JSON export) → M (share-link infrastructure).
- **Proposed backlog item:** `DCOMP-W2-A2-F9 — Single-hand export affordance` (P2)

### F10 — SR-26 flag-disagreement + SR-27 share-link unserved

- **Severity:** 1 (P3)
- **Evidence:** Both are proposed; W2-A1 recommendation was to land flag/annotate at HandReplayView — analysis-view is adjacent.
- **Recommended fix:** Bundle with W2-A1-F3.
- **Proposed backlog item:** Merge into `DCOMP-W2-A1-F3` scope.

### F11 — Villain-profile-first paradigm shipped — document as pattern

- **Severity:** 1 (P3)
- **Evidence:** Surface artifact line 112 documents the 2026-03-26 paradigm shift ("profile first, advice second"). Codified in code but not in a framework-level pattern doc.
- **Recommended fix:** Contract doc at `docs/design/contracts/profile-first-paradigm.md` formalizing when to use this pattern. Not urgent but stops pattern-drift.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A2-F11 — profile-first-paradigm contract doc` (P3)

### F12 — Tab state not persisted across nav

- **Severity:** 1 (P3)
- **Heuristics violated:** H-N7 (flexibility / efficiency)
- **Evidence:** `activeTab` is local to AnalysisView; reset to `'player'` on remount unless `initialTab` prop overrides. User on Hand Review tab who backs out and re-enters loses the tab choice.
- **Recommended fix:** Persist `activeTab` to localStorage (match SV-F7 filter-pill pattern).
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A2-F12 — AnalysisView tab persistence` (P3)

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — HandReview delete → toast+undo | 4 | S-M | P0 |
| 2 | F2 — Touch targets ≥44×44 (systematic) | 3 | M | P1 |
| 3 | F3 — Text-size floor | 3 | M | P1 |
| 4 | F4 — HandBrowser filter segregation + count | 3 | S | P1 |
| 5 | F5 — All-sessions filter progress + cache | 3 | M | P1 |
| 6 | F6 — PlayerAnalysisPanel decomposition | 2 | M | P2 |
| 7 | F7 — SR-88 cross-player (DISC-11 pointer) | 2 | — | discovery |
| 8 | F8 — HandBrowser hand-significance badge | 2 | S | P2 |
| 9 | F9 — Single-hand export affordance | 2 | S-M | P2 |
| 10 | F10 — SR-26 / SR-27 (merge W2-A1-F3) | 1 | — | merged |
| 11 | F11 — profile-first-paradigm contract doc | 1 | S | P3 |
| 12 | F12 — Tab persistence | 1 | S | P3 |

---

## Backlog proposals

```
- [P0] [DCOMP-W2-A2 F1] HandReviewPanel delete confirm() → SV-F1 deferred-delete toast+undo
- [P1] [DCOMP-W2-A2 F2] AnalysisView touch targets ≥44×44 systematic pass
- [P1] [DCOMP-W2-A2 F3] AnalysisView text-size floor (≥12px body, ≥14px primary)
- [P1] [DCOMP-W2-A2 F4] HandBrowser filter segregation + active-filter count
- [P1] [DCOMP-W2-A2 F5] All-sessions filter progress toast + cache
- [P2] [DCOMP-W2-A2 F6] PlayerAnalysisPanel decomposition
- [P2] [DCOMP-W2-A2 F8] HandBrowser hand-significance badge per row
- [P2] [DCOMP-W2-A2 F9] Single-hand export affordance
- [P3] [DCOMP-W2-A2 F11] profile-first-paradigm contract doc
- [P3] [DCOMP-W2-A2 F12] AnalysisView tab persistence (localStorage)
```

---

## Observations without fixes

- Villain-profile-first is correctly the primary, recommendations secondary (2026-03-26 paradigm) — keep.
- Async `useHandReplayAnalysis` guard (`isComputing`) is correctly placed — keep.
- The split into Player Analysis + Hand Review tabs is a clean cognitive-domain separation — keep.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft.
