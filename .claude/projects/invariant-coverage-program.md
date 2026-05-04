# Invariant Coverage Program (ICP)

**Charter — 2026-05-01**

## Origin

SPR-002 / WS-001 (TableView Invariant Audit, Master Plan Phase 1) shipped a 41-row matrix-fixture and surfaced an infrastructure-shaped finding: **no production-code-adjacent decision surface in this repo had matrix-fixture coverage** before SPR-002. Two user-reported bugs (BUG-OWNER-1 multi-seat illegal CHECK; BUG-OWNER-2 post-fold next-to-act bet missing) shipped silently because no enumerable invariant test existed for action-availability. The owner's read — "I bet there are more examples" — was structurally correct: the absence of the pattern is the bug.

The reconnaissance for this program spanned all 13 UI views, 4 engines, and 8 reducers + persistence v1→v22. Findings:

- **2 narrow matrix-fixture precedents existed** before SPR-002 (`src/utils/citedDecision/__tests__/baselineSynthesis.test.js`; `src/utils/printableRefresher/__tests__/contentDrift.test.js`). Neither covers user-facing decision flows.
- **Sidebar (extension) has `STATE_FIELD_SCOPES.md` + `state-clear-symmetry.test.js`** built post-incident per `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`. The main app has the same failure class (`.claude/failures/STATE_CLEAR_ASYMMETRY.md`) but no registry, no enforcement test.
- **Engine tests are dense (~5,400 tests) but shallow in shape** — hand-written `it()` per scenario, no `it.each` over importable fixture arrays. Corner cases are missed by structure, not by sample size.
- **Highest-risk surfaces** with concrete failure-mode evidence:
  - `OnlineView` — zero tests, owns sidebar visibility gates per CLAUDE.md (live-table bridge)
  - `gameReducer:UNDO_BATCH` — branching without combo tests; cross-couples with `playerReducer.seatPlayers` and `uiReducer.selectedPlayers`
  - `exploitEngine:detectWeaknesses` + `computePreflopAdvice` — POKER_THEORY guardrails (style+stat double-counting, first-principles decisions) lack invariant tests despite being in the doctrine

## Goal

Codify the matrix-fixture pattern as a reusable repo-local artifact, seed audits on the highest-risk surfaces across all three categories (UI / engine / reducer), install a main-app `STATE_FIELD_SCOPES` enforcement test that mirrors the sidebar's, and wire matrix-coverage into the `prog-engineering` health metric so coverage doesn't decay.

After ICP completes, every new decision surface in the repo requires either a matrix fixture or a documented `spec_gap` row — the gap that allowed BUG-OWNER-1 and BUG-OWNER-2 to ship silently is closed structurally.

## Sprint program (5 sprints, ~10-13 sessions)

| Sprint | Scope | Primary surface | Effort |
|--------|-------|-----------------|--------|
| **ICP-1** | Pattern codification (doc + shared runner helper) **+** seed audit on `gameReducer:UNDO_BATCH` (proves pattern transfers off UI) | reducer | M+S = ~2 sessions |
| **ICP-2** | OnlineView audit — extension-connectivity gates, version-mismatch banner, advice freshness, detail-panel visibility | UI | ~2 sessions |
| **ICP-3** | exploitEngine `detectWeaknesses` + `computePreflopAdvice` audit — 9 weakness rules, 4-tier fold% priority, style+stat double-counting guard | engine | ~2-3 sessions |
| **ICP-4** | Main-app `STATE_FIELD_SCOPES` registry + enforcement test mirroring `ignition-poker-tracker/side-panel/STATE_FIELD_SCOPES.md` + `state-clear-symmetry.test.js`; closes the `STATE_CLEAR_ASYMMETRY` failure-class structurally | cross-cutting | ~2 sessions |
| **ICP-5** | Persistence migration chain matrix (v1→v22 round-trip + idempotency) **+** wire ICP into `prog-engineering` health metric (matrix-coverage manifest at `.claude/workstream/coverage/invariant-matrices.yaml`; auto-staleness check) | persistence + governance | ~2-3 sessions |

## Sequencing rationale

- **ICP-1** validates the pattern on a non-UI surface so the template doesn't accidentally codify view-shaped assumptions.
- **ICP-2** transfers the pattern to a high-blast-radius production surface with the easiest user-facing story.
- **ICP-3** transfers it to engine code (densest decision space) and aligns with the critical-tier `prog-domain-correctness`.
- **ICP-4** addresses the cross-cutting state-clear-symmetry gap that no single audit can catch.
- **ICP-5** closes persistence chain risk and installs governance so the program self-perpetuates.

## Binding decisions (set 2026-05-01)

These are decisions that are LOCKED for the program lifetime. Sprints can negotiate within them but not reverse them without an explicit re-charter.

1. **Pattern doc lives at `.claude/context/INVARIANT_MATRIX_PATTERN.md`** — joins POKER_THEORY.md, SYSTEM_MODEL.md, STATE_SCHEMA.md as architectural reference. Repo-local; not pushed to HomeBase.
2. **Shared runner helper lives at `src/test/invariantMatrix.js`** — joins `src/test/utils.js` and `src/test/setup.js`. Vitest-compatible; importable from any test file.
3. **Status semantics are fixed at 4 values:** `matches` / `pinned_bug` / `spec_gap` / `regression_pinned`. Defined in SPR-002; reused by every ICP audit. Adding a 5th status requires re-charter.
4. **Audits are AUDIT-ONLY** — no production code changes during the audit sprint that surfaces a bug. Bug fixes happen in follow-up sprints (mirrors Master Plan WS-001 → WS-003 separation).
5. **Each audit produces a row count + status breakdown headline** in WS notes. The breakdown is the audit signal; bug count alone is misleading because spec_gap rows are also findings.

## Tracked initiatives across sprints

- **Tech-debt registry update:** SYSTEM_MODEL.md §11 should gain an "Invariant Coverage" subsection enumerating each matrix and its scope. Update in ICP-5 when the manifest exists.
- **Failure-library cross-references:** Each ICP sprint that closes (or fails to close) a failure-library entry must update the relevant file in `.claude/failures/`. Specifically, ICP-4 should mark `STATE_CLEAR_ASYMMETRY.md` as "structurally closed for main app."
- **Program governance:** `prog-engineering` is currently `tier: watch` with `health_score: null`. ICP-5 raises it to `tier: active` and seeds the health score using matrix-coverage as one input.

## Out of scope (explicit non-goals)

- **Bug-fixing the surfaces being audited.** ICP audits pin bugs; fix waves are separate workstreams (Master Plan WS-003, future engine fix sprints, etc.).
- **Refactoring decision functions to be more testable.** If a surface needs a selector extraction or DOM-mount harness to be auditable cleanly, that's flagged as an audit-surface remediation finding and queued separately — not done inside the ICP sprint.
- **Adding property-based testing or fuzz coverage.** ICP is matrix-fixture (enumerable corners) only. Property-based coverage is a different program with different ergonomics.
- **Migrating existing per-action `it()` reducer tests to fixture form.** Existing tests stay. Matrix tests are ADDITIVE — they pin combinatorial corners and cross-coupling. Per-action tests still cover happy-path behavior. Both are kept.

## Done definition for the program

ICP is complete when:
1. All 5 sprints have shipped.
2. `.claude/workstream/coverage/invariant-matrices.yaml` exists with ≥4 entries (TableView + gameReducer-undo + OnlineView + exploitEngine + persistence-migrations).
3. Main-app `STATE_FIELD_SCOPES.md` exists with enforcement test passing.
4. `prog-engineering` health metric includes matrix-coverage as a tracked input.
5. `.claude/context/INVARIANT_MATRIX_PATTERN.md` is referenced from CLAUDE.md so future audits start from the doc.
6. `.claude/failures/STATE_CLEAR_ASYMMETRY.md` updated to mark the main-app gap as structurally closed.

After completion, this charter becomes a historical reference. Active maintenance moves to `prog-engineering` with the manifest as the live coverage signal.
