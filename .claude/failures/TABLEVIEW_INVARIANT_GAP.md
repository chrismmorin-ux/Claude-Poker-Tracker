# TABLEVIEW_INVARIANT_GAP

**Status:** RESOLVED (program-wide fix wave). Pinned_bug rows closed by FW-1 (Sprints A+B, 2026-05-01). Failure file authored 2026-05-02 by SPR-011 / WS-003.

## Pattern

TableView's action-availability surface (which buttons the CommandStrip renders for a given seat) is the convergence of three independent code paths:

1. **`actionUtils.getValidActions(currentStreet, hasBet, isMultiSeat)`** — base primitive returning `[CHECK, BET, FOLD]` or `[CALL, RAISE, FOLD]` etc.
2. **`CommandStrip.jsx` rendering pipeline** (lines 317-328) — applies BB-option / SB-completing transforms, hand-over guard, folded-seat guard.
3. **`sequenceUtils` predicates** (`hasBetOrRaiseOnStreet`, `hasSeatFolded`, `wouldBeColdCall`, etc.) — read action history.

For ~3 years this surface had **no pinned spec**. Behavior was specified only by the union of the implementation and a small handful of per-action unit tests. The implementations had drifted: each fix to one path sometimes broke a downstream invariant in another, with no automated guard against regressions of the *interaction* (only the local predicate).

The Invariant Coverage Program (ICP, started 2026-05-01) introduced an **audit-only matrix** as the formal spec: a fixture of `(active_seats × street × prior_action × hero_role × game_state) → expected_action_options` rows, each pinned with a status (`matches` / `pinned_bug` / `spec_gap` / `regression_pinned`). A status-aware test harness consumes the matrix and asserts the appropriate semantic per row. The matrix itself is `audit-only` — bugs surfaced get `pinned_bug` rows that document reality (`actual_today: [...]`) until a separate fix wave migrates them to `matches`.

## Symptoms

The audit (SPR-002, 2026-05-01) authored the initial 41-row matrix at `src/components/views/TableView/__tests__/actionInvariants.fixture.js` and surfaced:

**A. Five newly-discovered candidate bugs** in production (CommandStrip / actionUtils / reducer interactions):

| Bug ID | Surface | Symptom |
|--------|---------|---------|
| BUG-CANDIDATE-SHOWDOWN-BUTTONS | actionUtils | `getValidActions` returned `[CALL, RAISE, FOLD]` for `street: 'showdown'` instead of `[]` |
| BUG-CANDIDATE-SB-COMPLETING | CommandStrip | SB completing into limpers got `[CALL, RAISE, FOLD]` instead of the BB-option-style `[CHECK, RAISE, FOLD]` |
| BUG-CANDIDATE-FOLDED-SEAT-ACTS | CommandStrip | Re-selecting a seat that had folded earlier in the hand still rendered action buttons |
| BUG-CANDIDATE-HAND-OVER-BUTTONS | CommandStrip | When ≤1 active seat remained (others absent or folded), buttons still rendered for the surviving seat |
| BUG-CANDIDATE-PLURAL-HANDS | OnlineView | Cosmetic copy: "1 hands analyzed" instead of "1 hand analyzed" (bundled into FW-1 for breadth) |

**B. Two owner-named regressions** (BUG-OWNER-1, BUG-OWNER-2) pinned as `regression_pinned` rows — bugs the owner had reported and seen fixed, kept under harness assertion to detect re-regression.

**C. Two more candidate bugs** surfaced by ICP-2 (OnlineView audit, SPR-006) and ICP-3 (exploitEngine audit, SPR-007):

| Bug ID | Surface | Symptom |
|--------|---------|---------|
| BUG-CANDIDATE-UNDO-STREET-DESYNC | gameReducer | UNDO_LAST_ACTION rewound the action queue but left `currentStreet` ahead of the rewound state |
| BUG-CANDIDATE-PFA-POSITION-VOCAB | preflopAdvisor | PFA used position label vocabulary inconsistent with what callers passed (`BTN` / `UTG` vs internal `LATE` / `EARLY`) |

**D. Five structural infrastructure gaps** in the production code that the matrix could not fully assert against (rows pinned as `spec_gap`):

1. **No all-in detection** — `potCalculator` doesn't track stack sizes; `getValidActions` returns `[CALL, RAISE, FOLD]` even when villain has shoved (RAISE is illegal). `INV-S-003`, `INV-S-004`.
2. **No straddle representation** — `PRIMITIVE_ACTIONS` has no `STRADDLE` constant; `actionSequence` cannot record a posted straddle; `isBBOption` transform fires incorrectly when straddle is in play. `INV-S-007`, `INV-S-008`, plus 7 more rows pinned by SPR-010 / WS-002 (`INV-S-010`..`INV-S-017`) per owner-decided scope (UTG + BTN, UTG > BTN precedence, no re-straddle).
3. **No dead-money handling** — when a seat is absent but their blind already posted (dead money in pot), `getBigBlindSeat` skips absent seats and returns the next active seat as BB, losing the dead-money fact. `INV-S-005`.
4. **No per-seat selection guards** — multi-seat selection scenarios produce undefined behavior when seats have heterogeneous action histories. (Not exhaustively row-pinned; surfaced in audit-time discussion.)
5. **No SHOVE primitive** — short-stack push-fold scenarios get no special label; RAISE is the only path. `INV-S-004` documents the gap.

## Root cause

**Spec without pin = drift.** Action-availability is a multi-input boolean array; the production code's rules emerge from the *interaction* of getValidActions + CommandStrip transforms + sequenceUtils predicates. Per-rule unit tests exist (46 tests on gameReducer, 48 on preflopAdvisor) and pass in isolation, but the *composite* shape — "what buttons render when the seat is in state X with history Y" — was not asserted anywhere as a single value, so:

- A fix to one path could inadvertently change the composite shape of another (the SB-completing bug is a near-miss of this class — the WS-129 fix wave deliberately re-derived the harness from the actual code path it asserts against to prevent harness/code drift).
- Structural gaps (no STRADDLE primitive, no all-in awareness) couldn't be flagged because no test ever stated the spec they were violating.

The ICP audit pattern surfaces this gap class explicitly: each row of the matrix is a *spec assertion* about the composite. Once pinned, drift is detected by harness on every test run. spec_gap rows are the audit's way of saying "here's a scenario the code structurally cannot represent yet — fix needs production work, not harness work".

## Fix

**Sprint chain across the FW-1 program:**

| Sprint | Item | Closure |
|--------|------|---------|
| SPR-002 | WS-001 | Initial 41-row matrix authored. 5 candidate bugs + 5 structural gaps pinned. |
| SPR-003 | WS-121, WS-122 | Pattern codification — `INVARIANT_MATRIX_PATTERN.md` + shared runner `src/test/invariantMatrix.js`. ICP charter at `.claude/projects/invariant-coverage-program.md`. gameReducer UNDO audit (22-row companion fixture). |
| SPR-006 | WS-127 | ICP-2: 29-row OnlineView DOM-mount audit. 22 matches + 1 pinned_bug (BUG-CANDIDATE-PLURAL-HANDS) + 6 spec_gap. |
| SPR-007 | WS-128 | ICP-3: 30-row exploitEngine audit. 21 matches + 1 pinned_bug (BUG-CANDIDATE-PFA-POSITION-VOCAB) + 5 spec_gap + 3 regression_pinned. |
| SPR-008 | WS-129 | FW-1 Sprint A: TableView 4-bug fix wave. actionUtils SHOWDOWN branch returns `[]`; CommandStrip `isSBCompleting` transform; folded-seat guard; hand-over guard. |
| SPR-009 | WS-130, WS-131, WS-132 | FW-1 Sprint B: gameReducer UNDO street-rewind; preflopAdvisor `normalizePositionToCategory` helper; OnlineView pluralization. |
| SPR-010 | WS-002 | TIA Phase 2: STRADDLE COVERAGE section + 7 new spec_gap rows per owner-decided scope (UTG+BTN, UTG>BTN, no re-straddle). |
| SPR-011 | **WS-003 (this)** | Admin close-out: failure file (this document) + status reconciliation. |

**Final matrix shape (post-SPR-011):**

| Status | Count | Meaning |
|--------|-------|---------|
| matches | 30 | Spec === actual; production code correct. |
| pinned_bug | 0 | All audit-surfaced bugs closed by FW-1. |
| spec_gap | 14 | Structural gaps; require production code changes (STRADDLE primitive, all-in awareness, dead-money handling, SHOVE labeling, per-seat guards) — separate fix-wave program. |
| regression_pinned | 3 | Owner-named regressions kept under harness; must stay fixed. |
| **Total** | **47** | |

## Prevention

**Pattern is now established and documented for repo-wide application:**

- **`.claude/context/INVARIANT_MATRIX_PATTERN.md`** — pattern doc; defines status taxonomy + harness contract + audit-only convention ("WS-001 is audit-only. WS-003 fix wave consumes pinned_bug rows.").
- **`src/test/invariantMatrix.js`** — shared runner that consumes any fixture conforming to the row schema and applies the status-aware assertions.
- **ICP-1..ICP-3 cycle** establishes the pattern for high-blast-radius surfaces (TableView, OnlineView, exploitEngine). ICP-4..ICP-5 queued for STATE_FIELD_SCOPES enforcement + persistence migration chain.
- **CLAUDE.md Poker Analysis Guardrail** + **Design Program Guardrail** are now mandatory reads before touching analysis or UX surfaces, sitting alongside this matrix pattern as the primary defenses against drift.

**Specific behaviors prevented going forward:**

- Re-introduction of any pinned_bug row would fail its harness assertion (`actual_today` recorded → next code change either matches or breaks the lock).
- Re-introduction of regression_pinned row failures fires the same alarm.
- New decision points must add matrix rows before merging (spec-first discipline).
- Structural gaps (the 14 surviving spec_gap rows) are explicit todo-list for any future fix wave: `actionInvariants.fixture.js`'s STRADDLE COVERAGE section header documents the production code paths the fix wave must touch.

## Open structural gaps (not blocking close-out)

The 14 surviving spec_gap rows document production-code work that requires more than a fix wave — these are program-of-work items that introduce new primitives or stack-aware logic, NOT bug fixes. Tracked as future scope:

| Gap | Rows | Production scope |
|-----|------|-----|
| Straddle primitive + action order | 9 (INV-S-007, S-008, S-010..S-017) | Add `STRADDLE` to `PRIMITIVE_ACTIONS`; represent posted straddle in `actionSequence`; `getNextSeat` straddler-last rule; `isBBOption` recognition; `potCalculator` extra-blind starting pot; game config `straddleMode` flag; UI surface (TableHeader / SeatComponent). Owner scope: UTG+BTN only, UTG>BTN, no re-straddle. |
| All-in detection | 2 (INV-S-003, S-004) | Stack-aware `getValidActions`; `potCalculator` stack tracking; SHOVE primitive. |
| Dead-money handling | 1 (INV-S-005) | Schema for "seat absent but blind posted"; `getBigBlindSeat` dead-money branch. |
| (per-seat selection guards) | 0 explicit rows; surfaced as discussion | Multi-seat selection invariants; not exhaustively row-pinned in initial audit. |
| SHOVE labeling | covered by INV-S-004 | Stack-aware short-stack push-fold rendering. |
| Other special_state | 2 (INV-S-006 sit-out matches; INV-S-009 mucked-seat matches; some included in matches set) | Already supported. |

These are out-of-scope for WS-003 (which was scoped as a fix wave for pinned_bug rows). They will be addressed by future workstream items as the live tracker encounters real hands that need them.

---

**Lessons summary for future repo-wide application:**

1. **Pin specs as data, not as test logic.** Matrix-as-fixture lets the spec be human-readable, diffable, and reviewable independently of the harness that consumes it.
2. **Status-aware harness > skip-or-pass.** Differentiating `matches` / `pinned_bug` / `spec_gap` / `regression_pinned` lets the harness express exactly what the matrix is saying about each row.
3. **`audit-only` discipline is critical.** The audit matrix is the spec; bugs go in as `pinned_bug` rows, not as fixes. A separate fix-wave sprint consumes those rows. This separation prevents the audit from becoming a stealth refactor.
4. **Re-derive harness from actual code path on every fix wave.** WS-129 explicitly noted "harness mirrors CommandStrip.jsx:317-328 logic" and was re-derived after each FW-1 fix to prevent harness/code drift.
