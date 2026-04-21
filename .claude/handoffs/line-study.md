# Handoff: Line Study

**Status:** COMPLETE (all 6 phases shipped 2026-04-20)
**Started:** 2026-04-20
**Closed:** 2026-04-20
**Owner-approved:** Yes
**Project file:** `docs/projects/line-study.project.md`

---

## Phase 6 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 6.1 Author 6 MW lessons | [x] — mw-bluff-death, mw-nut-necessity, mw-srp-3way, mw-squeeze, mw-cbet-shifts, mw-overcalling |
| 6.2 Author 3 HU lines | [x] — CO vs BB paired K77, SB vs BTN 3BP wet T98ss, UTG vs BTN 4BP A♠K♦2♠ |
| 6.3 Author 2 MW lines | [x] — CO vs BTN + BB 3-way SRP OOP, UTG facing squeeze with MP1 caller |
| 6.4 Coverage audit | [x] — every MW framework on ≥1 line node; 6 of 7 MW frameworks have dedicated lessons |
| 6.5 Polish | [x] — empty-state live, SPI log-scaling clamps at 0, pluralization wired |
| 6.6 Responsive 1600×720 | [x] — verified throughout Phases 2-5 via Playwright |
| 6.7 Update docs | [x] — project file + BACKLOG + STATUS + projects.json + handoff all synchronised |
| 6.8 Test audit | [x] — 200/200 postflop drill tests green |

### Project Summary (all 6 phases)

**Final deliverables:**
- Core modules: `lineSchema.js`, `lines.js`, `studyPriorityIndex.js`, `multiwayFrameworks.js`
- UI components: `LineMode`, `LinePicker`, `LineWalkthrough`, `LineStateTracker`, `LineNodeRenderer`, `LineBranchBreadcrumb`, `SPIBadge`, `SPITooltip`
- Content: **8 lines** (5 HU + 3 MW) totalling 85+ nodes, **6 new MW lessons**, **7 new MW frameworks** (on top of 7 base)
- Persistence: `drillType: 'line'` attempts wired via existing `usePostflopDrillsPersistence`
- Tests: 200/200 postflop drill tests green (baseline was 105)

**Unblocks:** RT-92 (drills-consolidation Phase 1 gating item).

---

## Phase 5 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 5.1 Author 7 MW frameworks | [x] — `multiwayFrameworks.js` with id/name/applies/narrate for each |
| 5.2 Extend classifyScenario | [x] — MW frameworks check `s.multiway`/`s.numVillains`; merged into FRAMEWORK_ORDER via spread |
| 5.3 MW filter chip + numVillains SPI factor | [x] — `multiwayBoost()` (1.15-1.3×), filter narrows picker correctly |
| 5.4 Author MW line #1 | [x] — BTN vs SB + BB 3-way SRP J♠8♥5♦ (10 nodes: 4 decisions + 6 terminals) |
| 5.5 Tests: MW classifier + HU unchanged | [x] — 180/180 green; `frameworks.test.js` updated to expect 14 frameworks |
| 5.6 Visual verification of MW line | [x] — Villains plural label, 5 framework chips render, WHY/ADJUST/MISMATCH accents shown |

### Outcome
- `multiwayFrameworks.js` — 7 MW frameworks, each implementing the standard `{id, name, applies, narrate, subcases}` contract.
- `frameworks.js` — FRAMEWORKS registry + FRAMEWORK_ORDER extended via spread import (14 frameworks total).
- `lines.js` — third line authored: 3-way SRP J♠8♥5♦ with explicit MW teaching (fold equity compression math, bluff collapse, nut necessity, hand class shift, position-with-callers).
- `studyPriorityIndex.js` — added `multiwayBoost()` multiplier.
- `LineStateTracker.jsx` — auto-pluralizes "Villain(s)" label.
- All tests green: 180 passing.

---

## Phase 4 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 4.1 Population frequency constants | [x] — POSITION_PAIR_FREQ, POT_TYPE_FREQ, BOARD_CLASS_FREQ, VILLAIN_ACTION_FREQ |
| 4.2 computeNodeSPI formula | [x] — log(reachProb × 1e6) × potBB × (1 + difficultyBonus) |
| 4.3 computeLineSPI (max over nodes) | [x] — plus `rankLinesBySPI` sorted-descending helper |
| 4.4 explainSPI (tooltip breakdown) | [x] — returns structured factors + dominant-node info |
| 4.5 SPIBadge + SPITooltip components | [x] — 5-bar fuel gauge + numeric score + 3-factor breakdown |
| 4.6 LinePicker sort toggle | [x] — SPI↓ / Title / Nodes↓ |
| 4.7 Filter chips | [x] — HU/MW + pot type + board texture; empty state ("No lines match") |
| 4.8 Tests | [x] — 19 new SPI tests covering constants, reach, node/line SPI, ranking, filters |

### Outcome
- 3 new files: `studyPriorityIndex.js`, `SPIBadge.jsx`, `SPITooltip.jsx`.
- LinePicker rewritten with sort/filter/SPI integration.
- Visual verification: Line 1 (SRP Q72r) scores 80 SPI, Line 2 (3BP wet T96) scores 139 SPI — 3BP outranks SRP here because pot size dominates.
- SPI formula `reach × potBB × (1 + difficulty)` with log-freq normalization (`log10(reach × 1M)`) gives readable scores in the tens-to-hundreds range for the current catalog; re-tune thresholds in `SPIBadge.jsx` as library grows.
- All 176 `postflopDrillContent` tests green.

---

## Phase 3 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 3.1 Decision UI: all branches with rationales | [x] — shipped in Phase 2 |
| 3.2 Breadcrumb retry-from-node | [x] — clickable past-node pills truncate path + clear reveal |
| 3.3 Stub-node placeholder kind | [x] — nodes without `decision` render as terminals with end-of-line panel |
| 3.4 Completeness badge in picker | [x] — decision / branch / node counts shown on each card |
| 3.5 Author line #2 (~12 nodes, full branching) | [x] — 12 nodes authored: 5 decision + 7 terminal |
| 3.6 Tests: branches reachable, stub flags surface | [x] — `lines.test.js` validates both lines, 0 unreachable nodes |
| 3.7 Visual verification both paths | [x] — Playwright walk confirmed: call/checkback/face-river-bet path ✓, retry-from-breadcrumb ✓ |

### Outcome
- `LineBranchBreadcrumb.jsx`: past-node pills become buttons that trigger `onRetryFromIndex` — truncates path + clears reveal state for the retry node.
- `LineWalkthrough.jsx`: new `handleRetryFromIndex` callback; clears `revealedAt` for truncated suffix.
- `lines.js`: second line `btn-vs-bb-3bp-ip-wet-t96` authored (BTN vs BB · 3BP · Wet T♥9♥6♠ — villain donks). 12 nodes: 5 decisions + 7 terminals, 15 branches total.
  - Explicitly covers the "bluff didn't fold villain → facing river aggression" pathway (`river_checkback` node with MISMATCH accent + pot-odds-based bluff-catch teaching).
  - Explicitly covers the "hero overbet → BB check-raises" pathway (`river_brick_v_checkraises` node with fold/call/jam branches and sunk-cost-trap teaching).
- 157 `postflopDrillContent` tests green (up from 153 — 4 new line-2 sub-tests).
- Visual verification at 1600×720: both lines render end-to-end, retry-from-breadcrumb works.

---

## Phase 2 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 2.1 Add Line tab to PostflopDrillsView | [x] |
| 2.2 LinePicker with tag chips + node/decision/branch stats | [x] |
| 2.3 LineWalkthrough 3-pane layout | [x] |
| 2.4 LineStateTracker (hand state trail) | [x] |
| 2.5 LineNodeRenderer section dispatcher | [x] — prose, formula, example, compute, why/adjust/mismatch accents |
| 2.6 LineBranchBreadcrumb | [x] |
| 2.7 Decision UI: radio picks, reveal rationales, advance | [x] — wrong pick still advances; all branches show rationale on reveal |
| 2.8 Wire usePostflopDrillsPersistence with drillType='line' | [x] — verified via IDB query mid-walkthrough (3 attempts captured with branchLabel + correct flag) |
| 2.9 Visual verification end-to-end | [x] — full flop → turn → river → terminal walk confirmed at 1600×720 |
| 2.10 Component logic tested | [x] — integration via dev server; unit tests covered by schema/lines tests |

### Outcome
- 7 new files in `src/components/views/PostflopDrillsView/`: LineMode, LinePicker, LineWalkthrough, LineStateTracker, LineNodeRenderer, LineBranchBreadcrumb (+ PostflopDrillsView tab edit).
- 3-pane layout renders at 1600×720; state tracker updates as path advances; breadcrumb shows taken branches.
- Persistence confirmed: scenarioKey format `<line-id>:<node-id>`, correct+branchLabel saved.
- Fixed bug mid-session: conditional `useMemo` call triggered hooks-of-rules violation; hoisted `statsByLineId` to top of `LineMode`.
- Production build clean; 153/153 postflopDrillContent tests green.

---

## Context for next session

Branching, street-by-street hand walkthrough system for Postflop Drills. 6-phase build: data layer → UI scaffold → branching → Study Priority Index → multiway data + frameworks → MW curriculum + content fill.

Key architectural decisions locked in (see project file Decisions Log):
- Tab lives on Postflop Drills.
- DAG with convergence, not pure tree.
- `villains[]` shape from day 1 so multiway is purely additive.
- SPI formula = log(frequency) × potSize × (1 + difficultyBonus).
- Hand-coded SPI constants in v1.
- Multiway capped at N=3 in v1.
- Authored content in v1; generative commentary is Phase 2 territory.

---

## Files I Own (Phase 1)

### New files being created this phase
- `src/utils/postflopDrillContent/lineSchema.js`
- `src/utils/postflopDrillContent/lines.js`
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js`
- `src/utils/postflopDrillContent/__tests__/lines.test.js`

### Reference only (not editing)
- `src/utils/postflopDrillContent/scenarioLibrary.js` — authoring pattern
- `src/utils/postflopDrillContent/lessons.js` — section-kind dispatcher precedent
- `src/utils/postflopDrillContent/frameworks.js` — framework shape

### Files I will touch in later phases (claimed by future sessions, not me today)
- Phase 2: `src/components/views/PostflopDrillsView/*` new Line Mode files + `PostflopDrillsView.jsx` Line tab addition
- Phase 3+: see project file per-phase "Files This Phase Touches"

---

## Phase 1 Task Status — COMPLETE 2026-04-20

| Task | Status |
|------|--------|
| 1.1 Define line schema | [x] |
| 1.2 Define node schema | [x] |
| 1.3 Define section kinds | [x] — prose, formula, example, compute, why, adjust, mismatch |
| 1.4 Define decision shape | [x] |
| 1.5 Write `validateLine(line)` | [x] |
| 1.6 Write `walkLine(line)` DAG traversal | [x] — plus `lineStats` for Phase 3 completeness badge |
| 1.7 Author first line (BTN-vs-BB SRP IP dry Q72r) | [x] — 11 nodes (exceeded 8-node target; full branching incl. terminal commentary) |
| 1.8 Tests for schema + authored line | [x] — 48 tests, all green |

### Outcome
- `lineSchema.js` (315 lines): exports `SECTION_KINDS`, `STREETS`, `POT_TYPES`, `VILLAIN_ACTION_KINDS`, `HERO_ACTION_KINDS`, `validateLine`, `walkLine`, `lineStats`
- `lines.js` (~450 lines): exports `LINES`, `findLine`, `listLines`. Line 1 authored with 11 nodes (6 decision + 5 terminal), full branching across flop-turn-river, every branch has rationale.
- Tests: 32 schema tests + 16 line-library tests = 48 new tests. Full `postflopDrillContent` suite 153/153 green.
- Every framework ID cited on nodes resolves (`range_advantage`, `range_morphology`, `board_tilt`, `capped_range_check`, `nut_advantage`).

---

## Verification plan for Phase 1

- `bash scripts/smart-test-runner.sh` green on new test files.
- Schema rejects 5+ malformed line variants in tests.
- First authored line walks clean via `walkLine` — 0 unreachable nodes.

---

## Notes for continuation

- **Do not touch UI files yet** — Phase 2 owns all `PostflopDrillsView/*.jsx` new files.
- The authored line must cite framework IDs in `sections`, not embed raw numbers. `compute` sections pull live numbers from engines so text never drifts from math.
- Read `.claude/context/POKER_THEORY.md` before authoring any commentary.
- Every decision branch needs a non-empty `rationale`, even wrong picks — that's the user-facing reason the choice underperforms.
