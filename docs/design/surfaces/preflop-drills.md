# Surface — Preflop Drills

**ID:** `preflop-drills`
**Code paths:**
- `src/components/views/PreflopDrillsView/PreflopDrillsView.jsx` (92 lines — tab orchestrator)
- `./ShapeMode.jsx`, `./RecipeMode.jsx`, `./ExplorerMode.jsx` (primary shipped mode), `./EstimateMode.jsx`, `./FrameworkMode.jsx`, `./LibraryMode.jsx`, `./LessonsMode.jsx`, `./MathMode.jsx`
- `./HandPicker.jsx`, `./MatchupBreakdown.jsx`, `./EquityDecompositionPanel.jsx`
- `./LessonCalculators.jsx` (imports from `utils/drillContent/calculatorRegistry.js` per RT-95)
- `src/utils/drillContent/*` — lesson content, calculator registry, framework definitions
- `src/utils/persistence/preflopDrillsStorage.js` — IDB per-drill-type history + aggregates

**Route / entry points:**
- `SCREEN.PREFLOP_DRILLS` (routed via `uiReducer`).
- Opens from: floating button in `sessions-view`; direct nav.
- Closes to: `SCREEN.SESSIONS` via "Back to Sessions" button.

**Product line:** Main app
**Tier placement:** Free+ (Explorer). Advanced tabs: Plus → Pro (per INVENTORY F-W2; not shipped).
**Last reviewed:** 2026-04-21

---

## Purpose

Preflop equity + range trainer. Eight tabs, each targeting a different learning dimension. Shipped today: **Shape**, **Recipe Drill**, **Explorer**, and drill content for **Math**. WIP / stubs: **Estimate**, **Framework Drill**, **Library**, **Lessons** in their full form (F-W2). The surface is the mental-model building ground between live sessions — build the intuition before the table extracts rent for not having it.

## JTBD served

Primary:
- `JTBD-DS-43` 10-minute quick drill on today's weak concept (Explorer + Recipe)
- `JTBD-DS-44` correct-answer reasoning (not just score) (built into Explorer results + Lesson content)
- `JTBD-MH-08` incorporate blockers in fold-equity math (Math tab)

Secondary:
- `JTBD-DS-45` custom drill from own hand history — not served (F-P13 proposed)
- `JTBD-DS-46` spaced repetition — not served
- `JTBD-DS-47` skill map / mastery — not served

## Personas served

- [Scholar (drills only)](../personas/core/scholar-drills-only.md) — primary; this persona exists specifically for the drill views
- [Study block](../personas/situational/study-block.md) — situational primary
- [Apprentice](../personas/core/apprentice-student.md) — primary learner
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — occasional session warm-up
- [Newcomer](../personas/core/newcomer.md) — partial (Lessons tab would be primary if shipped)

---

## Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ Preflop Drills — exact equity trainer   [Back to Sessions] │
├────────────────────────────────────────────────────────────┤
│ Tab bar:                                                   │
│   [Shape] [Recipe Drill] [Explorer] [Estimate Drill]       │
│   [Framework Drill] [Library] [Lessons] [Math]             │
├────────────────────────────────────────────────────────────┤
│ Mode content (one of the 8 modes renders)                  │
│                                                            │
│   Explorer: HandPicker × 2  →  MatchupBreakdown            │
│             + EquityDecompositionPanel                     │
│   Recipe:   stepwise recipe card walk-through              │
│   Shape:    range-shape recognition exercises              │
│   Math:     formula walk-throughs (LessonCalculators)      │
│   Estimate / Framework / Library / Lessons:                │
│             WIP — Explorer / stub modes                    │
└────────────────────────────────────────────────────────────┘
```

## State

- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`.
- **Local:** `activeTab` (defaults to `'shape'`).
- **Per-mode internal state:** each mode owns its picker / query / result state locally. Persistence to IDB via `preflopDrillsStorage` — history keyed by `drillType`.
- Writes: drill attempts + aggregates to IDB per-tab (see `.claude/context/DRILL_VIEWS.md` §3 for the `drillType → store → identifier field` mapping).

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Switch tab** → mount the selected mode; prior mode's local state is discarded (no cross-tab pin today).
2. **Explorer**: pick Hand A + Hand B → see exact equity breakdown with framework tags and equity-decomposition panel.
3. **Recipe Drill**: stepwise through a recipe scenario → chooses branch → graded + reasoning.
4. **Shape**: range-shape recognition tasks.
5. **Math**: calculator-backed formula walkthrough; `LessonCalculators.jsx` reconciles registered calculators against drill content.

---

## Known behavior notes

- **Only Explorer is fully specced** per F-W2 inventory flag. Recipe Drill and Shape have shipped working scaffolds; other tabs vary in completeness.
- **Calculator registry** (`utils/drillContent/calculatorRegistry.js`) — added 2026-04-21 (RT-95) to break the utils→views import cycle that previously violated INV-08.
- **Chrome budget** — documented ≤180 px at 1600×720 target (RT-105 / DRILL_VIEWS.md §1). Current chrome ~120 px.
- **Hook hoisting rule** — IDB-loading hooks must live in the top-level view, not conditionally in tab branches (RT-104 / DRILL_VIEWS.md §2).
- **Aggregate shape mismatch** between preflop and postflop aggregates documented (RT-100 / DRILL_VIEWS.md §4) — preflop has `avgDelta` / `deltaSamples` that postflop lacks.

## Known issues

- **F-W2** — advanced tabs (Estimate / Framework / Library / Lessons) stubbed. Tier-placement decision pending.
- Wave 3 audit (drills) will Gate-2 roundtable because the WIP-tab decision is a product decision, not a compliance one. Audit will surface the decision; owner approves finish-vs-retire-vs-defer.

## Potentially missing

- **Custom drill from own history** (F-P13 / DS-45) — proposed; not served.
- **Spaced repetition** (DS-46) — not served.
- **Skill map / mastery** (F-P12 / DS-47) — not served.
- **Cross-tab continuity** — a Math drill finding a leak doesn't seed an Explorer hand.
- **Connection to live advice** — no "practice this concept" deep-link from LiveAdviceBar to Explorer.

---

## Test coverage

- Drill content + calculators have unit tests in `utils/drillContent/__tests__/`.
- Persistence hardened 2026-04-21 for prototype pollution (RT-96) — `Object.create(null)` in both aggregate builders.
- Some mode components are thin over engine — tested via utility test suites.

## Related surfaces

- `sessions-view` — entry.
- `postflop-drills` — sibling.
- `analysis-view` — source of weaknesses the drills *could* target if F-P13 ships.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
