# DCOMP Wave 3 — Drills Audit + WIP-Tab Fate Decision

**Date:** 2026-06-13
**Auditor:** Claude (main) — code-trace audit
**Work item:** WS-083 (legacy DCOMP-W3)
**Program:** design
**Scope:** Audit the preflop/postflop drill surfaces, resolve the "WIP tab fate decision," and determine Gate 2 disposition.

## Summary

**The central premise of WS-083 — "WIP/stub drill tabs awaiting an owner ship/hide/retire decision" — is substantially MOOT.** The drill tabs that the 2026-04-21 design INVENTORY flagged as stubs/WIP have all since been built out into functional, navigable surfaces backed by real content catalogs. There are **no orphaned WIP tabs** left to decide the fate of.

The only genuinely-open clause of WS-083's accept criteria is **"Gate 2 for drills"** — a blind-spot roundtable that was never run for the drills surface. Per founder decision (2026-06-13), WS-083 is closed as substantially complete and Gate 2 is filed as a separate scoped ticket (**WS-229**).

---

## Drill surface inventory (verified against code, 2026-06-13)

| Surface | Tabs | State | Reachable in nav |
|---------|------|-------|------------------|
| **PostflopDrillsView** | Line, Explorer, Estimate Drill, Framework Drill, Library, Lessons (6) | All functional | ✅ via SessionsView (`SessionsView.jsx:596`) |
| **PreflopDrillsView** | Shape, Recipe Drill, Explorer, Estimate Drill, Framework Drill, Library, Lessons, Math (8) | All functional | ✅ via SessionsView (`SessionsView.jsx:589`) |
| **PresessionDrillView** | (whole view) | Built (Phase A / A+), feature-flagged off | ❌ `ENABLE_PRESESSION_DRILL = false` |

### Tab-level maturity (no stubs remain)

**Postflop** (`src/components/views/PostflopDrillsView/`):
- **Line** — branching DAG walkthroughs (`LineMode` → `LineWalkthrough`); content: `lines.js` (76 line/node id-entries).
- **Explorer** — Range Lab custom painter + flop breakdown (329 lines; matured through Range Lab Phase 1/2/2b).
- **Estimate Drill** — question generator + scoring + persistence (`usePostflopDrillsPersistence`).
- **Framework Drill** — multi-select grading.
- **Library** — scenario browser grouped by framework; content: `scenarioLibrary.js` (33 scenario id-entries).
- **Lessons** — curated lesson pages with click-to-reveal `RangeFlopBreakdown`; content: `lessons.js` (12 lesson id-entries). **Not a stub** (the 2026-04 ledger's "stub" label is stale).

**Preflop** (`src/components/views/PreflopDrillsView/`):
- **Shape / Recipe** — mature interactive UIs (Recipe 492 lines).
- **Explorer** — hand-vs-hand exact equity + framework breakdown (delegates to `MatchupBreakdown`).
- **Estimate / Framework / Library** — grading, classification, curated matchup browser.
- **Lessons** — curated lesson pages. **Not a stub.**
- **Math** — 5 interactive combinatorics calculators (pair-up, flush, straight, pot odds, runouts) via `calculatorRegistry.js`. **Not a stub.**

### Why the line-count heuristic misleads here
Several mode files are short (Postflop Line 73, Library 74; Preflop Explorer 77) yet fully functional — they are thin orchestrators delegating to rich subcomponents (`LineWalkthrough`, `RangeFlopBreakdown`, `MatchupBreakdown`). Short ≠ stub. Conversely the catalogs they render (`lessons.js`, `scenarioLibrary.js`, `lines.js`) are well-populated, confirmed by opening the content files rather than only stat-ing them.

---

## WIP-tab fate decision — RESOLVED (moot)

WS-083 anticipated an owner ship/hide/retire decision over WIP drill tabs. **No such tabs remain:**
- Every tab in both shipped drill views is functional with real content and is reachable in nav.
- The one flagged-off surface, **PresessionDrill**, is not orphaned WIP — it is an active design-gated project (**PSD**) with live queue tickets: WS-199 (Gate 4 surface spec), WS-200 (mobile-portrait variant), WS-201 (mood-detection research). Its flag is off because it is mid-lifecycle, not because its fate is undecided.

**Decision (founder, 2026-06-13):** No per-tab fate action required. The maturation of the surfaces resolves the premise.

---

## Gate 2 disposition

"Gate 2 for drills" (blind-spot roundtable per `docs/design/ROUNDTABLES.md`) was never run for the drills surface. Founder elected to **close WS-083 and track Gate 2 as a separate scoped item** → **WS-229**. This separates the completed audit from the still-open roundtable rather than holding WS-083 open indefinitely.

---

## Outcome

- **WS-083:** closed (substantially complete — audit delivered, WIP-tab premise resolved by maturation).
- **WS-229 (new):** Gate 2 blind-spot roundtable for the drills surface.
- **PSD project tickets (WS-199/200/201):** unchanged — they own the Presession Drill surface's lifecycle.
