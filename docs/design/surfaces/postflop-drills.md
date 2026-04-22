# Surface — Postflop Drills

**ID:** `postflop-drills`
**Code paths:**
- `src/components/views/PostflopDrillsView/PostflopDrillsView.jsx` (87 lines — tab orchestrator)
- Shipped modes: `./LineMode.jsx` (Line Study — shipped 2026-04-20), `./ExplorerMode.jsx`
- WIP modes (F-W1): `./EstimateMode.jsx`, `./FrameworkMode.jsx`, `./LibraryMode.jsx`, `./LessonsMode.jsx`
- Line Study support: `./LinePicker.jsx`, `./LineWalkthrough.jsx`, `./LineNodeRenderer.jsx`, `./LineBranchBreadcrumb.jsx`, `./LineStateTracker.jsx`, `./SPIBadge.jsx`, `./SPITooltip.jsx`
- Explorer support: `./BoardPicker.jsx`, `./ContextPicker.jsx`, `./RangeFlopBreakdown.jsx`
- Core modules: `src/utils/drillContent/lines.js`, `./lineSchema.js`, `./studyPriorityIndex.js`, `./multiwayFrameworks.js`
- `src/utils/persistence/postflopDrillsStorage.js` — IDB per-drill-type history + aggregates

**Route / entry points:**
- `SCREEN.POSTFLOP_DRILLS` (routed via `uiReducer`).
- Opens from: floating button in `sessions-view`; direct nav.
- Closes to: `SCREEN.SESSIONS` via "Back to Sessions" button.

**Product line:** Main app
**Tier placement:** Plus+ (shipped). Advanced / full Line curriculum: Pro (per INVENTORY F-09).
**Last reviewed:** 2026-04-21

---

## Purpose

Postflop range-vs-board + line-study trainer. Six tabs. Shipped today: **Line** (branching street-by-street walkthroughs with Study Priority Index + multiway coverage, 8 lines / 85+ nodes / 14 frameworks — closed 2026-04-20) and **Explorer** (pick preflop context + flop → full range breakdown + framework tags). WIP / stubs (F-W1): **Estimate**, **Framework**, **Library**, **Lessons**. The range-shape recognition surface: what does villain's range look like on this flop, and how does it evolve across streets?

## JTBD served

Primary:
- `JTBD-DS-43` 10-minute quick drill (Line: pick by SPI)
- `JTBD-DS-44` correct-answer reasoning — built into Line node reveals
- `JTBD-MH-06` multiway range-vs-ranges equity on flop (Explorer + Line multiway)
- (line-study JTBD, implicit) walk a hand line branch-by-branch with consequences shown
- (range-shape recognition, implicit) understand villain's range before deciding how to play

Secondary:
- `JTBD-MH-09` SPR-aware strategy cues — surfaced as SPI annotations
- `JTBD-DS-45` custom drill from own history — not served (F-P13 proposed)
- `JTBD-DS-47` skill map — not served

## Personas served

- [Scholar (drills only)](../personas/core/scholar-drills-only.md) — primary
- [Study block](../personas/situational/study-block.md) — situational primary
- [Apprentice](../personas/core/apprentice-student.md) — primary learner
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — session warm-up + targeted leak work
- [Coach](../personas/core/coach.md) — could assign Line Study lines as homework (proposed CO-51)

---

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ Postflop Drills — range-vs-board trainer   [Back to Sessions]│
├──────────────────────────────────────────────────────────────┤
│ Tab bar:                                                     │
│   [Line] [Explorer] [Estimate Drill] [Framework Drill]       │
│   [Library] [Lessons]                                        │
├──────────────────────────────────────────────────────────────┤
│ Mode content:                                                │
│                                                              │
│   Line:     LinePicker (SPI sort + filters) → LineWalkthrough│
│             LineBranchBreadcrumb  ·  LineStateTracker        │
│             LineNodeRenderer (prose + why + adjust + mismatch│
│               + branch rationale)                            │
│                                                              │
│   Explorer: ContextPicker → BoardPicker → RangeFlopBreakdown │
│             (framework tags + range shapes + decompositions) │
│                                                              │
│   Estimate / Framework / Library / Lessons:                  │
│             WIP scaffolds / stubs (F-W1)                     │
└──────────────────────────────────────────────────────────────┘
```

## State

- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`.
- **Local:** `activeTab` (defaults to `'explorer'`).
- **Line Mode local state:** selected line, current node, path so far, filters (HU/MW, pot-type, board-texture).
- **Explorer local state:** preflop context (position / pot type / aggressor), board (3 cards), breakdown view.
- Writes: drill attempts + aggregates to IDB per-tab (`drillType='line'` for Line Mode, `drillType='recipe'` for Recipe-style, etc.). See `.claude/context/DRILL_VIEWS.md` §3.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Line → pick line in LinePicker** → LineWalkthrough renders from root node.
2. **Line → at decision node: tap a branch** → see full rationale (prose / why / adjust / mismatch accents) → advance.
3. **Line → breadcrumb click** → retry from a past node; path truncates + reveal clears.
4. **Line → SPI badge tap** → SPITooltip shows three-factor breakdown (reach probability × consequence × population-error) + dominant-node.
5. **Explorer → pick preflop context + flop** → full range-breakdown output.
6. **Switch tab** → current mode state is discarded (tabs are not cross-pinned).

---

## Known behavior notes

- **Line Study infrastructure (2026-04-20):** schema + validator + DAG walker (`walkLine`, `lineStats`), SPI module (`studyPriorityIndex.js`), 8 authored lines (5 HU + 3 MW), 14 frameworks (7 base + 7 MW), 6 MW lessons. 200/200 postflop drill tests green at close.
- **Multiway frameworks** merged into the main registry; MW filter in LinePicker narrows to MW lines.
- **Chrome budget** — ≤180 px at 1600×720 (RT-105). Current chrome ~120 px.
- **Hook hoisting rule** applies (RT-104 / DRILL_VIEWS.md §2).
- **Aggregate shape mismatch** vs preflop aggregate documented (RT-100 / DRILL_VIEWS.md §4) — postflop lacks `avgDelta` / `deltaSamples`.
- **Prototype-pollution hardening** applied to aggregation (RT-96) — `Object.create(null)`.

## Known issues

- **F-W1** — Estimate / Framework / Library / Lessons tabs are scaffolds or stubs.
- **Drills Consolidation Proposal — HELD** (6 layout/refactor items deferred 2026-04-21 pending owner decision on `StudyView` consolidation). Do NOT scaffold `StudyView` without explicit go-ahead.
- Wave 3 audit (drills) will Gate-2 roundtable: Scholar persona is unserved today, WIP tab fate must be decided, and potential consolidation trade-offs are real.

## Potentially missing

- **Custom drill from own history** (F-P13 / DS-45) — not served.
- **Spaced repetition** (DS-46) — not served.
- **Skill map / mastery** (F-P12 / DS-47) — not served.
- **Cross-surface coaching deep-link** (CO-51) — proposed; would flow from analysis-view / hand-replay-view to a targeted Line or Explorer scenario.
- **Performance telemetry** on drill completion — no aggregate view of "what am I bad at" across both drill views.

---

## Test coverage

- `studyPriorityIndex`, `lines`, `lineSchema`, `multiwayFrameworks` all have unit tests — 200/200 passing as of Line Study close.
- Explorer + Line picker components have component-level tests.
- Persistence shape documented; aggregate functions tested.

## Related surfaces

- `sessions-view` — entry.
- `preflop-drills` — sibling; mirrors tab structure with preflop-native modes.
- `analysis-view` — source of weaknesses the drills *could* target if F-P13 ships.
- `hand-replay-view` — candidate source of "study this line" deep-links.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
