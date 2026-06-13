# System State

Last updated: 2026-06-13 (SPR-126 closed — WS-221 global anchor-library calibration reset (red line #4b), design-gated destructive action. New Settings danger-zone control + LIBRARY_CALIBRATION_RESET reducer action (W-EA-5) + useLibraryReset hook. Contract-suite it.todo cleared → 0 todo.)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 12,407 app passing (511 files; 20 skipped; **0 todo** — WS-221 cleared the last it.todo) + 2,348 extension (80 files). Known load flakes only (WS-220 RangeLabExplorer; gameTreeDepth2; AnchorObservationModal) — all green isolated |
| Build | GREEN | `npm run build` | Vite production build clean (9.97s; PWA 66 entries) |
| Git | GREEN | `git status --short` | SPR-126 (WS-221) committed `09c6917` (2026-06-13) on `main`. Pre-existing unrelated edits (ignition extension ×2, RangeLabExplorer test) left uncommitted. |
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
| Test count (app) | ~12,349 | Vitest (507 files; 20 skipped; 1 todo) |
| Test count (extension) | 2,348 | ignition-poker-tracker (80 files) |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v27** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (27 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. v27 = reviewTag field on hands (WS-190). |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 19 / 4** | PrototypeFinderView deleted 2026-06-12 (WS-225) |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 40 |
| In Progress | 3 |
| Done | 152 |
| Completed | 7 |
| Deferred | 20 |
| Decomposed | 1 |
| Dismissed | 1 |
| Review | 1 |
| **Total** | **225** |

> 2026-06-10: engineering cap-breach (18 open vs cap 15) cleared by deferring 11 stale legacy items (HRP paused streams WS-068..073, Range Lab stretch phases WS-058..060, US-2 refit WS-062, event-driven WS-156) — all reversible with revival triggers in each YAML.

> **CWOS-ops pending — WS-212:** this repo is on **kit 3.5.0**; HomeBase is **3.8.0** and the `kit/scripts/` suite (`cwos-reconcile.js` et al.) was never installed (arrived in 3.6.0). Root cause of the recurring manual index-reconcile each session (friction fr-011…fr-014). Fix runs **from a HomeBase session** — `/adopt "<this repo>" --update`, then optional in-repo `/kit-upgrade`. See `WS-212` for the full runbook.

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
| 2026-06-13 | **SPR-126 — WS-221 global anchor-library calibration reset (red line #4b, design-gated destructive action)** | `/next` composed single-item plan-first sprint. Founder decisions (plan-mode): placement = Settings danger zone (not Calibration Dashboard); scope = anchors only (stamp `calibrationResetAt` across all anchors, preserve observations — red line #3 durability). **Shipped:** `LIBRARY_CALIBRATION_RESET` reducer action (reset + undo-restore paths, W-EA-5 writer registered in writers.js + WRITERS.md lockstep) + `buildLibraryResetCopy()` (AP-06-clean, count-aware) + `useLibraryReset` orchestrator (parallels useAnchorRetirement; 12s undo via prior-snapshot restore) + new self-contained `AnchorCalibrationResetSection.jsx` mounted propless in SettingsView (reuses shared `RetirementConfirmModal` 2-tap destructive confirm). **Design gates:** Gate 1 entry audit `2026-06-13-entry-global-anchor-library-reset.md` (GREEN, Gate 2 not triggered — reuses existing interaction pattern); Gate 4 surface update `settings-view.md` §EAL-G4-RESET + journey Variation C2 in `anchor-retirement.md`. **Contract suite:** `autonomyRedLines.test.jsx` it.todo for #4b replaced with 4 passing assertions + library-reset copy added to tone sweeps. New tests: useLibraryReset (14) + AnchorCalibrationResetSection (10) + reducer (6) + retirementCopy (3). Full suite 12,407/511 files green, **0 todo** (was 1); build clean (PWA 65 entries); Playwright-verified at portrait (section enabled with seeded anchor; 2-tap modal gated). |
| 2026-06-12 | **SPR-123 — resumed orphaned approved sprint: WS-227 tournament-zone builders + WS-225 PrototypeFinderView deletion** | `/next` gate showed no active sprint and composed a NEW sprint with the same two items — but premise check found WS-227 ALREADY SHIPPED (commit `513f284`, prior session: buildTournamentBarHTML/buildTournamentDetailHTML in render-orchestrator.js, single-source TOURNEY_ZONE_COLORS/ICM_ZONES, 27 zone-tournament tests, comment-debt cleanup) and WS-225 sitting UNCOMMITTED in the working tree. Root cause: prior session approved SPR-123 (status:approved), executed item 1, half of item 2, ended mid-sprint — and the gate only resumes status:active sprints (**2nd bite of `[[resume-approved-sprints]]` / fr-012, new variant: approved AND partially executed**). Discarded the duplicate composition, resumed SPR-123. **WS-227 verified:** extension suite 2,348/2,348 (80 files); harness rebuilt + Playwright re-verified betweenHandsTournament + zx_x5e critical-urgency (zero undefined/null/NaN; prior session's own Playwright run confirmed at 21:33-35Z artifacts). **WS-225 finished + committed (`e8e6c86`):** view + mockPlayers deleted (−1,694 lines), SCREEN.PROTOTYPE_FINDER route/hash/orientation wiring + AdminSection sandbox entry removed (decision noted: empty Admin section hides entirely), 4 extracted-primitive doc headers updated, zero dangling refs, build clean (PWA 66→64 entries). Full suite 12,348/507 — single failure is the documented load-flake class (component project green isolated). Both items closed via `done`; queue Backlog 41 / Done 151. |
| 2026-06-12 | **SPR-122 — shared IDB transaction helpers (WS-226) + refactor-candidate scan queued WS-225/227** | Founder-requested refactor scan (2 cto-agent reviewers: main app + extension) produced 3 queue items: WS-225 PrototypeFinderView deletion (P12/S), WS-226 persistence tx-helper dedup (P14/M), WS-227 extension tournament-zone pure-builder extraction (P13/M); second-tier findings (CommandStrip, AnchorObservationModal, diagnostics panel) deliberately NOT queued (opportunistic-only per scan verdict). `/next` anchored WS-226 (plan-first). **Founder decision (Medium): durable writes** — write helpers resolve on `tx.oncomplete` (after commit), not `request.onsuccess`; closes the resolve-then-rollback window (quota-at-commit class). **Shipped (commit `77d065e`):** 5 helpers in database.js (readTx/writeTx/updateTx/cursorTx/atomicTx; contract: raw-DOMException rejection — QuotaExceededError name-checks survive; helpers never log — modules' createPersistenceLogger try/catch owns swallow-vs-propagate) + all 19 persistence modules migrated behind unchanged public signatures (95/97 raw `db.transaction` sites collapsed; net −884 lines). Documented exceptions: batchUpdateSeatPlayers (bespoke abort-tracking) + deletePlayer (parallel cursor cascade) + migrations.js (versionchange, out of scope). NEW dbTransactions.test.js (19 tests: ConstraintError raw-error contract, updateTx rollback proof, atomicTx cross-store atomicity proof). Full suite 12,349/507 files green; build clean; only documented load flakes (all green isolated; AnchorObservationModal timeout added to the known list). SYSTEM_MODEL §1 persistence row updated (v27 + helper contract). |
| 2026-06-11 | **SPR-121 — extension WS replay seam test (WS-217) + HUD-drop fold bug FOUND AND FIXED** | `/next` composed single-item sprint (WS-216's extension twin, same seam audit); premise verified at composition — files + dataQuality string-vs-object mismatch confirmed, BUT spike-data/ contains NO raw WS frames (HTTP log only; 6th occurrence of `[[feedback_verify_ticket_premise_at_composition]]`, content-assumption variant). **Founder ratified "Both":** replay frames reconstructed in the documented wire format from SPIKE_REPORT-derived FULL_HAND_SEQUENCE now; WS-224 queued for real-capture swap. **Shipped (commit `000f4a5`):** `ws-replay-seam.test.js` (NEW, 10 tests, zero mocks) — encode→parseWsBatch round-trip (incl. whole-street Atmosphere batching), full-hand replay through real HSM (zero errors, record emitted, cards/pot/pfAggressor decoded), street-by-street render via the REAL wire transform (`buildLiveContext`) into `buildUnifiedHeaderHTML` + `renderStreetCard` with/without advice (no undefined/null/[object Object]/raw-pid/NaN), msgAdvice↔ADVICE_FIELDS wire-contract round-trip (flopBreakdown incident class now fails loudly) + producer-shape dataQuality pin. msgAdvice factory + 2 sibling fixtures fixed to object-shaped dataQuality. **PRODUCTION BUG caught on the test's first run (founder-ratified fix-now):** HSM `getLiveHandContext` emitted activeSeatNumbers with dealt-in semantics (folds never removed) while the STP-1 R-10.1 validator requires active∩folded=∅ — `validateMessage` gate in the SW silently DROPPED every live-context push from the first fold onward (HUD frozen mid-hand since STP-1; invisible because all fixtures were hand-built disjoint — exactly the fixture-vs-producer class WS-217 targets). **Decision (Medium):** subtraction at the context boundary only; internal activeSeats keeps dealt-in semantics (folded ⊆ active stays the `_verifyIntegrity` contract); all renderers + main-app consumers verified compatible (app filters folds itself). Extension suite 2,321/2,321 green (79 files). Visual harness not needed (no renderer changes; fixtures already disjoint). |
| 2026-06-11 | **SPR-120 — full-chain analytics seam test (WS-216)** | `/next` composed single-item sprint from the 2026-06-10 seam audit; premise verified at composition (analysisPipeline.test.js confirmed mocking all 13 sub-modules; all 4 chain files exist). **Shipped (commit `361cc97`):** `src/hooks/__tests__/analysisPipeline.seam.test.js` (NEW, 4 tests, zero mocks) — realistic 9-handed hand via real gameReducer dispatches (15 actions: open-raise + call + 7 folds, flop c-bet called, turn/river check through) driven through the REAL usePersistence hook (its inline auto-save payload construction IS the seam; unmount-flush triggers the debounced save without fake timers), fake-indexeddb round-trip, buildTimeline shape pins (15 entries, string seats, 9/2/2/2 street partition), and buildPlayerStats/derivePercentages: raiser VPIP/PFR/cbet 100, caller VPIP 100/PFR 0, preflop folder VPIP 0 but sampleSize 1 (pins fold-counts-toward-denominator semantic). Real reconstructPredictionAudit runs in-chain (null engineCtxGetterRef fallback). **Test-infra discovery (documented in file header):** usePersistence calls `initDB()` directly on mount — connection outside the getDB() pool, unreachable by closeDB(), blocks per-test deleteDatabase() wipes forever → single-save beforeAll lifecycle; states precomputed by folding dispatches through reducers outside React to avoid one flush-save per live dispatch. Full suite 12,330 passing / 506 files; only known load flakes (WS-220 RangeLabExplorer verbatim; gameTreeDepth2 once, green isolated + on re-run). |
<!-- 2026-06-10 SPR-119 (anchor-owned predicate registry + two-validator inheritance, WS-218; DEC-020) row pushed to archive 2026-06-13 (SPR-126 close-out). Canonical record in sprint-index.yaml + SPR-119 sprint file. -->
<!-- (SPR-119 detail: ANCHOR_PREDICATE_KEYS anchor-owned registry; validator.js additive inheritance + validateAnchorFull; all 4 seeds to full v1.1; commit a2cf5c4.) -->
<!-- 2026-06-10 SPR-118 (range-profile rules re-gated on observed frequency, WS-223 + WS-215; "observed frequency everywhere" theory decision) row pushed to archive 2026-06-12 (SPR-123 close-out). Canonical record in sprint-index.yaml + SPR-118 sprint file. -->
<!-- 2026-06-10 SPR-117 (rangeEngine→exploitEngine seam-test family WS-214 + bucketQueryUtils contract fix; WS-223 finding; 3 LAZY placeholders deferred) row pushed to archive 2026-06-12 (SPR-122 close-out). Canonical record in sprint-index.yaml + SPR-117 sprint file. -->
<!-- 2026-06-10 SPR-116 (YAML reader inline-comment hardening WS-213 + stale HSP-v2 umbrella close-out, WS-150 closed) row pushed to archive 2026-06-11 (SPR-121 close-out). Canonical record in sprint-index.yaml + SPR-116 sprint file. -->
<!-- 2026-06-10 SPR-115 (EAL autonomy red-lines contract suite WS-025 + engineering cap-breach root fix, 11 stale items deferred) row pushed to archive 2026-06-11 (SPR-120 close-out). Canonical record in sprint-index.yaml + SPR-115 sprint file. -->
<!-- 2026-06-09 SPR-110 (PIO recognition scoring + confidence, WS-164; DEC-019) row pushed to archive 2026-06-10 (SPR-119 close-out). Canonical record in sprint-index.yaml + SPR-110 sprint file. -->
<!-- 2026-06-08 SPR-109 (SCF turn-barrel + RFI open-fold frequency rules, WS-146 6th claim) row pushed to archive 2026-06-10 (SPR-118 close-out). Canonical record in sprint-index.yaml + SPR-109 sprint file. -->
<!-- 2026-06-06 SPR-108 (SCF first multiway leak rule + frequency-of-aggression substrate, WS-146 5th claim) row pushed to archive 2026-06-10 (SPR-117 close-out). Canonical record in sprint-index.yaml + SPR-108 sprint file. -->
<!-- 2026-06-05 SPR-107 (mid-hand tag-for-review WS-190; IDB v27) row pushed to archive 2026-06-10 (SPR-116 close-out). Canonical record in sprint-index.yaml + SPR-107 sprint file. -->
<!-- 2026-06-04 SPR-106 (HSP-M1 full multiway model, WS-154; HSP v2 hard-dep closed) row pushed to archive 2026-06-10 (SPR-115 close-out). Canonical record in sprint-index.yaml + SPR-106 sprint file. -->
<!-- 2026-06-04 SPR-104 + SPR-105 (back-to-back HSP v2 close-out — WS-211 orchestrator turn/river precision + WS-155 HSP-X1 adjustment composition) row pushed to archive 2026-06-09 (SPR-110 close-out). Canonical record in sprint-index.yaml + SPR-104/SPR-105 sprint files. -->
<!-- 2026-05-30 SPR-103 (HSP v2 turn+river close-out, WS-152 + WS-153) row pushed to archive 2026-06-08 (SPR-109 close-out). -->
<!-- 2026-05-21 SPR-100 (Range Lab Phase 2 equity histogram + subrange filters, WS-057) row pushed to archive 2026-06-06 (SPR-108 close-out). -->
<!-- 2026-05-16 SPR-083 (Postflop EV-bucket partition display fix, WS-185) row pushed to archive 2026-06-05 (SPR-107 close-out). -->
<!-- 2026-05-15 SPR-082 (SLS Stream B1 Range Silhouette WS-041) row pushed to archive 2026-06-04 (SPR-106 close-out). -->
<!-- 2026-05-14 SPR-077 (seat-autoselector Phase 1 telemetry, WS-189) row pushed to archive 2026-05-31 (SPR-104 compose-and-queue). -->
<!-- 2026-05-13 SPR-076 CameraCaptureModal row pushed to archive 2026-05-30 (SPR-103 close-out). -->
<!-- 2026-05-13 SPR-075 row pushed to archive 2026-05-21 (SPR-100 close-out). -->
<!-- 2026-05-11 Refactor Sprint Item 3 row pushed to archive 2026-05-16 (SPR-083 close-out). Canonical record at .claude/workstream/sessions/session-2026-05-11-refactor-sprint-item-3.yaml. -->

## Session Mode Usage

| Mode | Last 30 Days | Last Used |
|------|-------------|-----------|
| Quick Fix | 0 | — |
| Standard | 1 | 2026-05-01 (audit) |
| Strategic | 2 | 2026-05-11 (refactor sprint Item 3) |

Updated automatically by session protocol.
