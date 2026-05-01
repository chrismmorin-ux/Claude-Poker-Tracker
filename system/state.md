# System State

Last updated: 2026-05-01 (CWOS audit reconciliation)

---

## Vital Signs

| Area | Status | Check Command | Detail |
|------|--------|---------------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | ~5,400+ tests across ~184 files (Vitest + fake-indexeddb); extension suite 2,249 tests |
| Build | GREEN | `npm run build` | Vite production build clean |
| Git | YELLOW | `git status --short` | 30 changes uncommitted (CWOS adoption + SPR-001 closing); branch `main` |
| Dependencies | NEEDS CHECK | `npm audit` | Not yet verified this cycle |

## Project Phase

| Field | Value |
|-------|-------|
| Current Phase | pre-launch |
| Phase Changed At | 2026-04-30 |
| Previous Phase | foundation |

Master Plan 2026-04-30 ratified the move from foundation to pre-launch — 5-workstream program (TIA, PIO, EAL/engine maturation, SCF, SHC continuation) running in parallel. Charter at `.claude/projects/master-plan-2026-04-30.md`.

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Test count | ~5,400+ | App suite |
| Test count (extension) | 2,249 | ignition-poker-tracker |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | v20 | additive-only migrations |
| Reducers / Contexts / Hooks / Views / Engines | 8 / 12 / 33 / 13 / 4 | |

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 116 |
| In Progress | 4 |
| Done (this session) | 3 |
| Blocked | 0 |

Queue total: 120 items. See `.claude/workstream/queue-index.yaml`.

## Program Health

| Program | Tier | Status | Last Run | Founder Priority |
|---------|------|--------|----------|------------------|
| domain-correctness (Poker Theory Integrity) | critical | ACTIVE | 2026-05-01 (baseline + SPR-001) | 1 |
| methodology-integrity | active | NEW | — | 1 |
| design (5-Gate UX Framework) | active | ACTIVE | 2026-04-21 | 2 |
| change-management | active | NEW | — | 4 |
| launch | active | NEW | — | 4 |
| engineering | watch | NEW | — | 3 |
| anti-hallucination | watch | NEW | — | 3 |

6 of 7 programs have `status: NEW` — they need first audit runs to populate health scores. m5_steady_state milestone tracks this.

## Recent Sessions

| Date | Primary Work | Outcome |
|------|-------------|---------|
| 2026-05-01 | CWOS audit + reconciliation | state.md cleaned, queue index synced, onboarding YAML reconciled |
| 2026-05-01 | SPR-001 — domain-correctness baseline cleanup | WS-118/119/120 closed (POKER_THEORY freshness header + 2 style/stat double-count fixes) |
| 2026-05-01 | CWOS kit-v3.5.0 adoption | 5 capabilities enabled; 115 BACKLOG items migrated to WS-* queue |
| 2026-04-30 | Master Plan ratification | 5-workstream program adopted |
| 2026-04-30 | SHC Gate 5 PR-17 | V-3 §II rejection wiring closed |

Full historical log: `.claude/projects/state-archive-2026-04-30.md`.

## Session Mode Usage

| Mode | Last 30 Days | Last Used |
|------|-------------|-----------|
| Quick Fix | 0 | — |
| Standard | 1 | 2026-05-01 (audit) |
| Strategic | 0 | — |

Updated automatically by session protocol.
