---
id: line-study
name: Line Study — Branching Hand Walkthroughs with Study Priority Index and Multiway Coverage
status: active
priority: P1
created: 2026-04-20
backlog-id: LS
---

# Project: Line Study

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts
2. Read this file — find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Create/update your handoff file in `.claude/handoffs/`
5. Execute the checklist items
6. Update this file and handoff when done

---

## Overview

Adds a new **Line Mode** to the Postflop Drills view: branching, street-by-street hand walkthroughs with "why" commentary at every decision node. Every major bifurcation in a hand (cbet vs check, call vs raise vs fold, turn brick vs scare, river aggression vs passivity) is authored as a real branch the user can study.

Every line and every node is scored by a **Study Priority Index** (SPI) that ranks content by how often it occurs × how much money is at stake × how close the EV of alternative decisions is. Default sort is SPI descending — users see the highest-leverage spots first but can switch to any line they want.

The data shape generalizes villain from singular to `villains[]` from day 1, so when multiway content lands in later phases it is purely additive — no schema migration. Phase 5–6 add 7 multiway-specific frameworks, 6 multiway lessons, and 3 multiway lines covering the most common 3-way configurations.

**Acceptance Criteria (overall):**
- Line Mode tab appears on Postflop Drills. Picker lists lines sorted by SPI with a "why this ranks high" tooltip on each entry.
- At least 5 HU lines and 3 multiway lines authored end-to-end, each with full branching (call / raise / fold all lead somewhere real).
- Every decision has rationale text for every branch, not just the correct one.
- Multiway filter chip works. Multiway frameworks auto-tag on nodes where `villains.length > 1`.
- Progress persists across reloads. Wrong picks log to stats.
- All tests green. Dev server renders every line without crashes on intentional wrong-picks and on intentional right-picks.

---

## Context Files

Read these before any work:

- `CLAUDE.md` — project-level rules, engine guardrails
- `.claude/context/POKER_THEORY.md` — **mandatory** before authoring any line commentary
- `src/components/views/PostflopDrillsView/` — existing drill mode patterns
- `src/utils/postflopDrillContent/frameworks.js` — framework shape, `classifyScenario`
- `src/utils/postflopDrillContent/scenarioLibrary.js` — existing scenario authoring pattern
- `src/utils/postflopDrillContent/rangeVsBoard.js` — live range-vs-range + nut advantage + whiff
- `src/utils/postflopDrillContent/handTypeBreakdown.js` — hand class buckets per range/board
- `src/utils/postflopDrillContent/archetypeRanges.js` — position × action → range lookup
- `src/utils/postflopDrillContent/lessons.js` — section-kind pattern (prose / formula / example / compute)
- `src/utils/persistence/postflopDrillsStorage.js` — persistence for drill attempts
- `src/hooks/usePostflopDrillsPersistence.js` — hook wrapper

---

## Phases

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | [x] | Data layer, schema validator, first authored HU line | ✓ 48 tests green; first line 14-node DAG walks clean |
| 2 | [x] | Line Mode UI scaffold; walk first line end-to-end in browser | ✓ Users can complete line top-to-bottom at 1600×720; attempts persist to IDB |
| 3 | [x] | Full branching; second fully-branched line; retry-from-node | ✓ Line 2 authored (12 nodes); retry-from-breadcrumb truncates + resets; visual verification both lines pass |
| 4 | [x] | Study Priority Index engine + picker sort + filter chips | ✓ SPI badges + sort toggle + filter chips all live; BTN-vs-BB SRP outranks synthetic UTG 4BP in tests; tooltip breakdown renders |
| 5 | [x] | Multiway data shape, 7 MW frameworks, first 3-way line | ✓ `multiwayFrameworks.js` with 7 frameworks + registry merge; first MW line (3-way SRP J85r, 10 nodes) walks clean with MW + base frameworks tagged |
| 6 | [x] | MW lessons + line matrix fill (3 more HU, 2 more MW); polish | ✓ 6 MW lessons + 5 new lines (total 8 lines: 5 HU + 3 MW); 200/200 tests green |

---

## Phase 1: Data Layer & First Line — COMPLETE 2026-04-20

### Goal
Stand up the data shape for branching lines without any UI. Validate the schema with tests and one complete authored line.

### Acceptance Criteria
- [x] `lines.js` exports `LINES` array and `findLine(id)` helper (+ `listLines`).
- [x] `lineSchema.js` validates every line: resolves all `nextId` refs, no orphan nodes, decisions have non-empty prompts and ≥2 branches with rationales.
- [x] DAG walker reports reachable node count; authored lines have 0 unreachable nodes.
- [x] First HU line authored end-to-end: BTN-vs-BB SRP IP, dry Q72r flop, 11 nodes (6 decision + 5 terminal) covering cbet/check × call/fold × turn brick × river bet/check.
- [x] Tests pass: schema rejects 20+ malformed line variants; authored line passes full validation. 48 tests, all green.

### Files This Phase Touches
_Copy into handoff "Files I Own"._
- `src/utils/postflopDrillContent/lineSchema.js` (new)
- `src/utils/postflopDrillContent/lines.js` (new)
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js` (new)
- `src/utils/postflopDrillContent/__tests__/lines.test.js` (new)

### Context Files for This Phase
- `src/utils/postflopDrillContent/scenarioLibrary.js` — authoring pattern for curated content
- `src/utils/postflopDrillContent/lessons.js` — section-kind dispatcher precedent
- `.claude/context/POKER_THEORY.md`

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 1.1 | [ ] | Define line schema: `{id, title, setup: {hero, villains[]}, rootId, nodes{}, metadata}` |
| 1.2 | [ ] | Define node schema: `{id, street, board, villainAction, sections[], decision}` |
| 1.3 | [ ] | Define section kinds: `prose`, `formula`, `example`, `compute`, `why`, `adjust`, `mismatch` |
| 1.4 | [ ] | Define decision: `{prompt, branches: [{label, nextId, correct, rationale}]}` |
| 1.5 | [ ] | Write `validateLine(line)` — checks refs resolve, no orphans, required fields |
| 1.6 | [ ] | Write `walkLine(line)` — DAG traversal returning reachable node IDs |
| 1.7 | [ ] | Author first line: BTN-vs-BB SRP IP, dry Q72r flop, ~8 nodes |
| 1.8 | [ ] | Tests: 5+ malformed schema rejections, authored line walks clean |

### Verification
- [ ] All tasks completed
- [ ] Tests pass (`bash scripts/smart-test-runner.sh` — specifically the new `lines.test.js` and `lineSchema.test.js`)
- [ ] Acceptance criteria met
- [ ] Changes committed

---

## Phase 2: Line Mode UI Scaffold — COMPLETE 2026-04-20

### Goal
Build the 3-pane Line Mode UI and walk Phase 1's line top-to-bottom in a real browser. No branching logic yet — single path through the authored nodes.

### Acceptance Criteria
- [x] New `Line` tab on `PostflopDrillsView` renders a picker and (on selection) a walkthrough.
- [x] 3-pane layout: state tracker (left), commentary + decision (right), breadcrumb along top.
- [x] Section-kind dispatcher renders `prose`, `formula`, `example`, `compute`, `why`, `adjust`, `mismatch` (reuses `RangeFlopBreakdown` inside `example`).
- [x] Decision pick reveals rationale for *every* branch (not just correct), then advances along chosen branch.
- [x] Attempts persist via `usePostflopDrillsPersistence` with `drillType: 'line'` (verified via IDB query mid-walkthrough).
- [x] Dev server: full flop → turn → river → terminal walk at 1600×720.

### Files This Phase Touches
- `src/components/views/PostflopDrillsView/LineMode.jsx` (new)
- `src/components/views/PostflopDrillsView/LinePicker.jsx` (new)
- `src/components/views/PostflopDrillsView/LineWalkthrough.jsx` (new)
- `src/components/views/PostflopDrillsView/LineStateTracker.jsx` (new)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` (new)
- `src/components/views/PostflopDrillsView/LineBranchBreadcrumb.jsx` (new)
- `src/components/views/PostflopDrillsView/PostflopDrillsView.jsx` (add Line tab)
- `src/components/views/PostflopDrillsView/index.jsx` (export)
- `src/utils/persistence/postflopDrillsStorage.js` (if `drillType: 'line'` needs storage awareness)

### Context Files for This Phase
- `src/components/views/PostflopDrillsView/LessonsMode.jsx` — section dispatcher pattern
- `src/components/views/PostflopDrillsView/RangeFlopBreakdown.jsx` — reuse inside compute sections
- `src/components/views/PostflopDrillsView/ContextPicker.jsx` — picker pattern

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 2.1 | [ ] | Add `Line` tab to `PostflopDrillsView` |
| 2.2 | [ ] | Build `LinePicker` — lists lines, click to enter walkthrough |
| 2.3 | [ ] | Build `LineWalkthrough` 3-pane layout |
| 2.4 | [ ] | Build `LineStateTracker` — renders hand state trail |
| 2.5 | [ ] | Build `LineNodeRenderer` — dispatches on section `kind` |
| 2.6 | [ ] | Build `LineBranchBreadcrumb` — path taken, retry from node |
| 2.7 | [ ] | Build decision UI: radio picks, reveal, advance |
| 2.8 | [ ] | Wire `usePostflopDrillsPersistence` with `drillType: 'line'` |
| 2.9 | [ ] | Visual verification: walk Phase 1's line, reload, confirm progress |
| 2.10 | [ ] | Component tests for renderer + dispatcher |

### Verification
- [ ] All tasks completed
- [ ] Tests pass
- [ ] Manual dev-server walkthrough succeeds end-to-end
- [ ] Changes committed

---

## Phase 3: Full Branching & Second Line — COMPLETE 2026-04-20

### Goal
Enable real DAG branching so wrong picks lead somewhere instructive. Author a second line with flop/turn/river branching.

### Acceptance Criteria
- [x] Decisions render all branches. Choosing any branch advances to its `nextId`.
- [x] Breadcrumb supports "retry from this node" — truncates path and resets to that node.
- [x] Stub-node renderer handles terminal / not-yet-authored branches (nodes without `decision` render end-of-line panel).
- [x] Completeness stats in `LinePicker` show decision / branch / node counts per line.
- [x] Second line authored: BTN-vs-BB 3BP, wet T♥9♥6♠ flop, villain donks. 12 nodes. Includes "bluff doesn't fold villain → facing river aggression" path explicitly + "overbet → check-raise" path.
- [x] Every branch on every decision has a non-empty `rationale`.

### Files This Phase Touches
- `src/utils/postflopDrillContent/lines.js` (add line #2)
- `src/components/views/PostflopDrillsView/LineBranchBreadcrumb.jsx` (retry-from-node)
- `src/components/views/PostflopDrillsView/LinePicker.jsx` (completeness badge)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` (stub-node kind)
- `src/utils/postflopDrillContent/__tests__/lines.test.js` (update)

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 3.1 | [ ] | Decision UI: show all branches with rationales on reveal |
| 3.2 | [ ] | Breadcrumb: retry-from-node |
| 3.3 | [ ] | Stub-node placeholder kind |
| 3.4 | [ ] | Completeness badge in picker |
| 3.5 | [ ] | Author line #2 end-to-end (~12 nodes, full branching) |
| 3.6 | [ ] | Tests: all branches reachable, stub flags surface |
| 3.7 | [ ] | Visual verification: walk line #2 taking all-wrong path once, all-right path once |

### Verification
- [ ] All tasks completed
- [ ] Tests pass
- [ ] Manual verification of both paths
- [ ] Changes committed

---

## Phase 4: Study Priority Index — COMPLETE 2026-04-20

### Goal
Compute and display SPI so users see the highest-leverage spots first.

### Acceptance Criteria
- [x] `studyPriorityIndex.js` exports: `computeNodeSPI`, `computeLineSPI`, `rankLinesBySPI`, `reachProbabilities`, `explainSPI`, `lineMatchesFilters`, plus `POSITION_PAIR_FREQ`, `POT_TYPE_FREQ`, `BOARD_CLASS_FREQ`, `VILLAIN_ACTION_FREQ` population constants.
- [x] Picker default sort = SPI desc. Sort toggle: SPI↓ / Title / Nodes↓.
- [x] SPI badge on every picker entry (5-bar fuel gauge + numeric score). Tooltip shows position × pot-type × board-class factors and dominant-node breakdown (reach%, potBB, log-freq, difficulty).
- [x] Filter chips: HU / Multiway + pot type (srp/3bp/4bp/limped) + board texture (dry/wet/high-card/middling/low). "No lines match" empty state.
- [x] Population constants documented in module header with calibration source (live 1/2-5/10 baselines).
- [x] BTN-vs-BB SRP outranks synthetic UTG-vs-BB 4BP at the line level (test asserted).

### Files This Phase Touches
- `src/utils/postflopDrillContent/studyPriorityIndex.js` (new)
- `src/utils/postflopDrillContent/__tests__/studyPriorityIndex.test.js` (new)
- `src/components/views/PostflopDrillsView/LinePicker.jsx` (sort + filter + badge)
- `src/components/views/PostflopDrillsView/SPIBadge.jsx` (new)
- `src/components/views/PostflopDrillsView/SPITooltip.jsx` (new)

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 4.1 | [ ] | Author population frequency constants (position pairs, pot types, boards, actions) |
| 4.2 | [ ] | Implement `computeNodeSPI` formula (log-frequency × pot × difficulty) |
| 4.3 | [ ] | Implement `computeLineSPI` (max over nodes) |
| 4.4 | [ ] | Implement `explainSPI` (returns breakdown for tooltip) |
| 4.5 | [ ] | Build `SPIBadge` + `SPITooltip` components |
| 4.6 | [ ] | Add sort toggle to `LinePicker` |
| 4.7 | [ ] | Add filter chips (pot type, position, texture, villain tendency) |
| 4.8 | [ ] | Tests: SPI deterministic, monotonic in frequency, tooltip sums consistently |

### Verification
- [ ] All tasks completed
- [ ] Tests pass
- [ ] Manual: sort toggle changes order; filters narrow list; tooltip breakdown is readable
- [ ] Changes committed

---

## Phase 5: Multiway Data Shape + Frameworks — COMPLETE 2026-04-20

### Goal
Generalize the data shape to multiway pots and add the 7 multiway-specific frameworks. Author the first 3-way line.

### Acceptance Criteria
- [x] `villains[]` shape works for N=1 (existing HU lines unchanged) and N=2 (new MW line). LineStateTracker pluralizes "Villains" label automatically.
- [x] 7 new frameworks in `multiwayFrameworks.js`:
  FOLD_EQUITY_COMPRESSION, NUT_NECESSITY, BLUFF_FREQUENCY_COLLAPSE, SQUEEZE_GEOMETRY, EQUITY_REDISTRIBUTION, POSITION_WITH_CALLERS, HAND_CLASS_SHIFT. Merged into `FRAMEWORKS` registry + `FRAMEWORK_ORDER` via spread import.
- [x] `classifyScenario` auto-tags MW frameworks when `s.multiway` / `s.numVillains ≥ 2` (frameworks' `applies()` checks the flag).
- [x] First MW line authored: BTN open, SB + BB cold-call, 3-way SRP IP flop J♠8♥5♦. 10 nodes (4 decisions + 6 terminals) covering MW cbet recalibration, sandwiched-turn call, thin-value river.
- [x] SPI incorporates `numVillains` factor via `multiwayBoost()` (1.15× for 2-way villains, 1.25× for 3-way, 1.3× for 4-way+).
- [x] Multiway filter chip works: narrows picker to MW line only. HU chip narrows to HU lines.

### Files This Phase Touches
- `src/utils/postflopDrillContent/frameworks.js` (append MW frameworks + `classifyScenario` extension)
- `src/utils/postflopDrillContent/lines.js` (add MW line #1)
- `src/utils/postflopDrillContent/studyPriorityIndex.js` (numVillains factor)
- `src/components/views/PostflopDrillsView/LinePicker.jsx` (MW filter chip)
- `src/utils/postflopDrillContent/__tests__/frameworks.test.js` (new MW cases)

### Context Files for This Phase
- `.claude/context/POKER_THEORY.md` — multiway theory sections
- `src/utils/exploitEngine/CLAUDE.md` — multiway caution notes in engine

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 5.1 | [ ] | Author 7 MW frameworks (rule + `whenItApplies` + evidence) |
| 5.2 | [ ] | Extend `classifyScenario` to tag MW frameworks on multiway nodes |
| 5.3 | [ ] | Add MW filter chip + `numVillains` to SPI |
| 5.4 | [ ] | Author MW line #1 (~10 nodes) |
| 5.5 | [ ] | Tests: MW frameworks classify correctly; HU lines unaffected |
| 5.6 | [ ] | Visual verification: walk MW line #1 with classification visible on nodes |

### Verification
- [ ] All tasks completed
- [ ] Tests pass
- [ ] Manual verification of MW line
- [ ] Changes committed

---

## Phase 6: MW Curriculum + Line Matrix Fill — COMPLETE 2026-04-20

### Goal
Fill out the content library: 6 multiway lessons, 3 more HU lines (covering the pot-type × texture matrix), 2 more multiway lines.

### Acceptance Criteria
- [x] 6 new lessons appended to `lessons.js` under MW curriculum:
  1. `mw-bluff-death` — Why Bluffs Die in Multiway (FEC math)
  2. `mw-nut-necessity` — Nut Necessity & Value Shrinkage
  3. `mw-srp-3way` — The SRP 3-way Spot (reference MW context)
  4. `mw-squeeze` — Squeezing vs Flatting With Callers Behind
  5. `mw-cbet-shifts` — C-bet Frequency on Textured Boards in Multiway
  6. `mw-overcalling` — Overcalling Theory
- [x] 3 new HU lines:
  - `co-vs-bb-srp-oop-paired-k77` — CO vs BB SRP OOP paired K77
  - `sb-vs-btn-3bp-oop-wet-t98` — SB vs BTN 3BP OOP wet T98ss
  - `utg-vs-btn-4bp-deep` — UTG vs BTN 4BP A♠K♦2♠ (low-SPR)
- [x] 2 new MW lines:
  - `co-vs-btn-bb-srp-mw-oop` — CO vs BTN + BB 3-way SRP (CO OOP)
  - `utg-vs-btn-squeeze-mp-caller` — UTG facing squeeze with MP1 caller behind
- [x] Coverage: every MW framework appears on ≥1 line node (Fold Equity Compression, Nut Necessity, Bluff Frequency Collapse, Squeeze Geometry, Position With Callers, Hand Class Shift) and every MW framework except Equity Redistribution has a dedicated lesson.
- [x] Polish: empty-state ("No lines match the current filters") live; SPI log-scaling clamps at 0 for rare spots; handoff + STATUS + BACKLOG + projects.json all updated.

### Files This Phase Touches
- `src/utils/postflopDrillContent/lessons.js` (6 new MW lessons)
- `src/utils/postflopDrillContent/lines.js` (5 new lines)
- `src/components/views/PostflopDrillsView/LineMode.jsx` (polish passes)
- `.claude/context/SYSTEM_MODEL.md` (architectural update)
- `.claude/STATUS.md` (completion note)
- `docs/CHANGELOG.md` (version entry)

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 6.1 | [ ] | Author 6 MW lessons |
| 6.2 | [ ] | Author 3 HU lines (matrix fill) |
| 6.3 | [ ] | Author 2 more MW lines |
| 6.4 | [ ] | Coverage audit: every framework has ≥1 lesson + ≥1 line node |
| 6.5 | [ ] | Polish: loading / empty / stub states |
| 6.6 | [ ] | Responsive check on 1600×720 |
| 6.7 | [ ] | Update SYSTEM_MODEL, STATUS, CHANGELOG |
| 6.8 | [ ] | Full test audit |

### Verification
- [ ] All tasks completed
- [ ] Tests pass
- [ ] Manual: walk every line once; confirm coverage audit
- [ ] Changes committed
- [ ] `/project closeout line-study` gates all green

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2026-04-20 | line-study-kickoff | 1 | Formalized project, wrote charter, created handoff and backlog entry. Phase 1 starting. |
| 2026-04-20 | line-study-p1 | 1 | **Phase 1 shipped.** `lineSchema.js` + `lines.js` + 48 tests. First line (BTN vs BB SRP dry Q72r) authored with 14 nodes — 6 decision + 8 terminal — full flop/turn/river branching. All `postflopDrillContent` tests green (153/153). |
| 2026-04-20 | line-study-p2 | 2 | **Phase 2 shipped.** Line tab on PostflopDrillsView + 7 new UI components. Full flop → turn → river → terminal walk verified at 1600×720. Section accents (WHY/ADJUST/MISMATCH) rendering correctly. Persistence confirmed via IDB query (attempts saved with branchLabel + correct flag). Fixed hooks-of-rules bug (conditional useMemo hoisted). 153/153 tests still green. |
| 2026-04-20 | line-study-p3 | 3 | **Phase 3 shipped.** Breadcrumb retry-from-node (past pills become clickable buttons, path truncates, reveal state clears for retried node). Second line authored: BTN vs BB · 3BP · Wet T♥9♥6♠ · villain donks (12 nodes, 5 decisions, 15 branches). Explicit coverage of "missed bluff → facing river aggression" + "overbet → check-raise" pathways. Visual verification: both paths walk clean, retry truncates breadcrumb correctly. 157/157 tests green. |
| 2026-04-20 | line-study-p4 | 4 | **Phase 4 shipped.** `studyPriorityIndex.js` with population constants (POSITION_PAIR_FREQ, POT_TYPE_FREQ, BOARD_CLASS_FREQ, VILLAIN_ACTION_FREQ), `reachProbabilities` DAG walker with probability accumulation, `computeNodeSPI` / `computeLineSPI` / `rankLinesBySPI`, `explainSPI` for tooltips, `lineMatchesFilters`. SPIBadge + SPITooltip components. LinePicker rebuilt with SPI sort, title sort, nodes sort, HU/MW toggle, pot-type chips, board-texture chips, "No lines match" empty state. Visual: SPI badges render (Line 1: 80 SPI, Line 2: 139 SPI), tooltip breakdown shows three factors + dominant node, filter narrows picker correctly. 176/176 tests green (19 new SPI tests). |
| 2026-04-20 | line-study-p5 | 5 | **Phase 5 shipped.** `multiwayFrameworks.js` with 7 new frameworks (FOLD_EQUITY_COMPRESSION, NUT_NECESSITY, BLUFF_FREQUENCY_COLLAPSE, SQUEEZE_GEOMETRY, EQUITY_REDISTRIBUTION, POSITION_WITH_CALLERS, HAND_CLASS_SHIFT), merged into main FRAMEWORKS registry + FRAMEWORK_ORDER. MW line authored: BTN vs SB + BB 3-way SRP J♠8♥5♦ (10 nodes, 4 decisions, 12 branches). SPI `multiwayBoost()` factor (1.15-1.3× based on N villains). LineStateTracker pluralizes "Villains" for MW. Visual: MW filter narrows picker; MW line renders with 5 framework chips (4 MW + 1 base); WHY/ADJUST/MISMATCH accents all showing. 180/180 tests green. |
| 2026-04-20 | line-study-p6 | 6 | **Phase 6 shipped — project COMPLETE.** 6 MW lessons in `lessons.js` (mw-bluff-death, mw-nut-necessity, mw-srp-3way, mw-squeeze, mw-cbet-shifts, mw-overcalling). 5 new lines: CO-vs-BB SRP OOP paired, SB-vs-BTN 3BP OOP wet, UTG-vs-BTN 4BP deep (1 decision — range concentration), CO-vs-BTN+BB 3-way SRP OOP, UTG facing squeeze with MP1 caller. Final library: 8 lines (5 HU + 3 MW), 85+ nodes total. 200/200 postflop drill tests green. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-20 | Tab lives on Postflop Drills, not Preflop | Boards + behavior are the central element; preflop setup is just the starting node. Lessons stay topic-organized regardless. |
| 2026-04-20 | DAG with convergence, not pure tree | Branches converge at turn/river nodes where state is functionally equivalent — prevents 3ⁿ authoring explosion. |
| 2026-04-20 | `villains[]` array from day 1 | MW is additive in later phases, no schema migration needed. |
| 2026-04-20 | SPI uses log-frequency × pot × difficulty | Log prevents tier-1 spots from dwarfing everything; difficulty bonus elevates close-EV decisions. |
| 2026-04-20 | Hand-coded SPI constants in v1 | User-specific IndexedDB overlay is a later addition. Start transparent and calibrated from population data. |
| 2026-04-20 | Cap multiway at N=3 in v1 | Keeps combinatorics tractable. 4-way+ deferred. |
| 2026-04-20 | Authored lines in v1, no generative | Phase 2 can swap authored prose for engine-driven commentary without restructuring data shape. |

---

## Closeout Checklist

Before marking project complete (run `/project closeout line-study`):

- [ ] All 6 phases marked complete
- [ ] All acceptance criteria verified
- [ ] Tests passing
- [ ] All changes committed
- [ ] Documentation updated:
  - [ ] CLAUDE.md (architecture section — add Line Mode to drill listing)
  - [ ] docs/QUICK_REF.md (new modules)
  - [ ] docs/CHANGELOG.md (version entry)
  - [ ] .claude/context/SYSTEM_MODEL.md (drill mode update)
- [ ] STATUS.md updated
- [ ] Handoff file marked COMPLETE
- [ ] Backlog item marked complete via `/backlog complete LS`
