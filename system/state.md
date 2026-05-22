# System State

Last updated: 2026-05-21 (SPR-100 — Range Lab Phase 2: equity histogram + subrange filters shipped; WS-057 closed)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 11,771 app (483 files) + 2,249 extension tests |
| Build | GREEN | `npm run build` | Vite production build clean |
| Git | YELLOW | `git status --short` | Refactor Sprint changes uncommitted on `main` |
| Dependencies | NEEDS CHECK | `npm audit` | Last verified: never since CWOS adoption (2026-05-01) |

## Project Phase

| Field | Value |
|-------|-------|
| Current phase | pre-launch |
| Phase changed at | 2026-04-30 (foundation → pre-launch) |
| Refactor Sprint | **CLOSED 2026-05-14** (opened 2026-05-10; all 7 items done across SPR-077..080) |
| Active program | **Master Plan 2026-04-30** resumed — `.claude/projects/master-plan-2026-04-30.md` |
| Recent close-outs | Refactor Sprint: SYSTEM_MODEL.md restore + state.md reshape + persistence migration registry + decisionSystems extraction (anchorLibrary migrated) + useLiveActionAdvisor split + queue triage + persistence/cache audit (12 failure modes + 18 cache surfaces + 4 ADRs + 5 INV-PERSIST + 6 new TDs) |

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Test count (app) | 11,771 | Vitest (483 files; 20 skipped) |
| Test count (extension) | 2,249 | ignition-poker-tracker |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v25** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (25 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. TD-16 resolved 2026-05-11. |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 20 / 4** | Hooks nearly doubled since 2026-04-21 |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 84 |
| In Progress | 4 |
| Done | 78 |
| Completed | 7 |
| Decomposed | 2 |
| Tracking parent | 1 |
| **Total** | **176** |

See `.claude/workstream/queue-index.yaml`. **Refactor Sprint anchor:** feature work paused; Items 1+2+3 DONE; Items 4 (decision-system extraction, NEXT), 5 (useLiveActionAdvisor split), 6 (queue triage) drive the next ~3–6 sessions.

## Program Health

| Program | Tier | Status | Last Run | Priority |
|---------|------|--------|----------|----------|
| domain-correctness (Poker Theory Integrity) | critical | ACTIVE | 2026-05-01 | 1 |
| methodology-integrity | active | NEW | — | 1 |
| design (5-Gate UX Framework) | active | ACTIVE | 2026-04-21 | 2 |
| **engineering** (Refactor Sprint active) | watch | ACTIVE | 2026-05-10 | 3 |
| anti-hallucination | watch | NEW | — | 3 |
| change-management | active | NEW | — | 4 |
| launch | active | NEW | — | 4 |

5 of 7 programs have `status: NEW` — first audit runs pending. Refactor Sprint moved engineering from NEW → ACTIVE on 2026-05-10.

## Recent Sessions

> Last 5 only. Older sessions: `system/state-history.md` (raw, 2026-04-30 → 2026-05-10) and `.claude/workstream/sessions/` (2 canonical session files).

| Date | Primary Work | Outcome |
|------|-------------|---------|
| 2026-05-21 | **SPR-100 — Range Lab Phase 2: equity histogram + subrange filters (WS-057)** | Continuation of SPR-099 (Phase 1). Founder scoped "Flopzilla parity" (3 features) → shipped equity histogram (vs random hand) + subrange filters; range comparison deferred to Phase 2b. NEW `rangeEquityHistogram.js` (pure `filterCombosByGroups` + async `computeEquityHistogram`, DI'd equityFn reusing `handVsRange` — one equity source; bins are equity OUTPUTS, AP-RL-01-clean; INV-LSW-RL-EQUITY-PARITY untouched) + `SubrangeFilter.jsx` + `EquityHistogram.jsx` (manual Compute + stale-guard) wired into ExplorerMode Custom layout only. 25 new tests; full suite 11,771 pass / 20 skip / 0 fail (+25 net, 0 regressions); build clean (10.5s); Playwright-verified 1600×720 (paint→filter→Compute; mean 81% full range, 89% top-pair subrange; 0 console errors). Phase 2b (range comparison) + WS-058 (Phase 3 turn/river evolution) remain. |
| 2026-05-16 | **SPR-083 — Postflop EV-bucket partition display fix (WS-185)** | Owner-reported 2026-05-11 bug: postflop lesson EV-bucket displays drifted to 100.1% due to independent per-bucket rounding. Bucket classification RATIFIED 2026-05-12 (partitions = HSP-4-class + win/tie/lose; overlapping + non-partition displays excluded). Plan-mode audit found WS-185's listed `files_involved` did NOT match real partition displays in code — owner ratified broader scope (4 actual partition surfaces). Shipped: NEW `src/utils/pokerCore/percentGroup.js` largest-remainder sum-preserving formatter (26 util tests) + threading into MatchupBreakdown / VillainRangeDecomposition / WeightedTotalTable / ActionRecommendationStrip + 22 new partition-sum=100 invariant assertions across 4 new test files + compute invariant test on `equityDecomposition.js` (winRate+tieRate+loseRate=1.0±1e-9). Inline "(sums to 100%)" label on 3 partition surfaces; ActionRecommendationStrip omits label (2-value thin strip). Scope correction: `equityVsRangeParts.js` compute test from WS-185 acceptance criteria NOT added — those values are per-role hero equities, not a partition. 11,442 tests green; build clean. |
| 2026-05-15 | **SPR-082 — SLS Stream B1 (Range Silhouette) shipped end-to-end (WS-041)** | First per-shape classifier consuming SPR-081 Stream D foundation. New `src/utils/shapeLanguage/` — `silhouetteClassifier.js` (discriminated-union output `{label,confidence,prototypeScores,features,components?}`; softmax over 5 prototypes + COMPOUND_DELTA=0.15) + `silhouettePrototypes.js` (5 calibrated signatures) + `gridFeatures.js` (10 pure feature extractors) + `lessonRegistry.js` (SLS markdown loader) + domain-rule CLAUDE.md. Lesson 1 authored at `docs/projects/poker-shape-language/lessons/silhouette.md` (5 prototypes + 7 drill spots). HandReplay embed `RangeSilhouetteSection.jsx` wired in ReviewPanel between HeroStateSection and VillainAnalysisSection (read-only descriptor row, no shapeMastery writes). 85 new tests green (37+23+11+14). INV-SLS-CLASSIFIER-1..5 added. Build clean. Stream A Gate 5 in progress; Streams B2-B9 + remaining lessons + other surface embeds deferred. Session-2 reconciliation: prior session 2026-05-14 shipped full 5-prototype + compound architecture before interrupt; current owner ratified accepting shipped code over reverting to a smaller 3-class baseline. |
| 2026-05-14 | **SPR-077 — Seat autoselector Phase 1 telemetry (WS-189)** | Dev-mode telemetry on `getFirstActionSeat()` + every `useAutoSeatSelection` firing. Zero behavior change. New `src/utils/dev/seatSelectionTelemetry.js` (no-op outside `import.meta.env.DEV`). INV-SEAT-SELECTION-1..7 authored — encodes ratified M2 multi-seat contract (override only on street change; cancel-tap stays intact; canonical action order). 5 new tests + 11079 tests pass. Build clean. WS-191 stub authored, soft-blocked on ≥3 owner-captured live observations. |
| 2026-05-13 | SPR-076 — CameraCaptureModal FSM rewrite (WS-184) | All 5 camera-capture bugs (A-E) closed via useReducer FSM. NEW `downscaleImageBlob.js` (1500×1500 max edge at file-pick — root-cause fix). 21 new tests; build clean. Enables WS-187. |
<!-- 2026-05-13 SPR-075 row pushed to archive 2026-05-21 (SPR-100 close-out). -->
<!-- 2026-05-11 Refactor Sprint Item 3 row pushed to archive 2026-05-16 (SPR-083 close-out). Canonical record at .claude/workstream/sessions/session-2026-05-11-refactor-sprint-item-3.yaml. -->

## Session Mode Usage

| Mode | Last 30 Days | Last Used |
|------|-------------|-----------|
| Quick Fix | 0 | — |
| Standard | 1 | 2026-05-01 (audit) |
| Strategic | 2 | 2026-05-11 (refactor sprint Item 3) |

Updated automatically by session protocol.
