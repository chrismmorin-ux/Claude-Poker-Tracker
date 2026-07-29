# System State

Last updated: 2026-07-27 (PWA stale-chunk recovery — founder-reported E401 crash diagnosed, fixed, swept; PR #3 + PR #4 merged and deployed; auto-update confirmed working on device. Unqueued work, no sprint.)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 2026-07-26: **full app suite 12,768/12,768** (533 files, 20 skipped, exit 0) at `8abbda1` — the tree merged as `57ef88d`. +24 tests this session (chunkRecovery, ViewLoadingFallback, persistenceHealth, HealthIndicator save-fault + build-scoping, useBuildVersion foreground re-check). CI ran it green twice (PR #3, PR #4). Extension suite untouched (2,375 as of 2026-07-22). |
| Build | GREEN | `npm run build` | Main-app build clean 2026-07-26 (PWA 63 precache entries). Deploy `57ef88d` succeeded 2026-07-27 15:34 UTC incl. the workflow's own "Verify deployment" step. Extension build clean as of 2026-07-22. |
| Git | GREEN | `git status --short` | Clean. `origin/main` at **`57ef88d`** (PR #4 merge). PR #3 (`963f1ec`) and PR #4 both merged + deployed. The prior SPR-145/WS-236 uncommitted work was committed by the founder before this session. |
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
| Test count (app) | **12,768** | Vitest (533 files; 20 skipped; 0 todo). Verified 2026-07-26. |
| Test count (extension) | 2,375 | ignition-poker-tracker (83 files) |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v27** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (27 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. v27 = reviewTag field on hands (WS-190). |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 19 / 4** | Unchanged. 2026-07-26 added 2 utils (`chunkRecovery`, `persistenceHealth`) + 1 ui component (`ViewLoadingFallback`), no new reducer/context/hook/view. |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 21 |
| In Progress | 3 |
| Blocked | 1 |
| Done | 44 |
| Completed | 7 |
| Deferred | 43 |
| Decomposed | 1 |
| Dismissed | 1 |
| Review | 1 |
| **Total (live index)** | **122** |

> 2026-07-27: totals dropped 225 → 122 because `cwos-gc.js` archived 22 queue items, 9 findings and 101 sprints and rebuilt the indexes — **archived, not deleted**. Canonical records remain in the archive; the live index is now the working set only. GC also surfaced 4 graduation candidates for LLM review (theory-spec drift, first-principles decision modeling, range estimation correctness, game tree EV correctness — 3–6 resolved findings each against a threshold of 3); handle via `/audit`.

> 2026-06-10: engineering cap-breach (18 open vs cap 15) cleared by deferring 11 stale legacy items (HRP paused streams WS-068..073, Range Lab stretch phases WS-058..060, US-2 refit WS-062, event-driven WS-156) — all reversible with revival triggers in each YAML.

> **CWOS-ops — WS-212 partially stale (corrected 2026-07-27):** `kit/scripts/` **is** installed — `cwos-reconcile.js`, `cwos-gc.js`, `cwos-state-store.js` and `cwos-event.js` all exist and were used this session, so the "never installed" claim no longer holds and the manual index-reconcile friction (fr-011…fr-014) should be gone. The kit-version claim (3.5.0 vs HomeBase 3.8.0) was NOT re-verified — check before closing WS-212.

See `.claude/workstream/queue-index.yaml`. **Refactor Sprint anchor:** feature work paused; Items 1+2+3 DONE; Items 4 (decision-system extraction, NEXT), 5 (useLiveActionAdvisor split), 6 (queue triage) drive the next ~3–6 sessions.

## Program Health

| Program | Tier | Status | Last Run | Priority |
|---------|------|--------|----------|----------|
| domain-correctness (Poker Theory Integrity) | critical | ACTIVE | 2026-07-22 (sweep+delta+challenge; spec PROMOTED) | 1 |
| methodology-integrity | active | NEW | — | 1 |
| design (5-Gate UX Framework) | active | ACTIVE | 2026-04-21 | 2 |
| **engineering** (Refactor Sprint active) | watch | ACTIVE | 2026-05-10 | 3 |
| anti-hallucination | watch | NEW | — | 3 |
| change-management | active | NEW | — | 4 |
| launch | active | ACTIVE | 2026-07-22 (sweep: NOT READY, correct) | 4 |

5 of 7 programs have `status: NEW` — first audit runs pending. Refactor Sprint moved engineering from NEW → ACTIVE on 2026-05-10.

## Recent Sessions

> Last 5 only. Older sessions: `system/state-history.md` (raw, 2026-04-30 → 2026-05-10) and `.claude/workstream/sessions/` (2 canonical session files).

| Date | Primary Work | Outcome |
|------|-------------|---------|
| 2026-07-27 | **PWA stale-chunk recovery — founder-reported E401 crash: diagnose → fix → sweep → 2 PRs merged + deployed → auto-update confirmed on device** | Unqueued: founder reported "error when trying to select a player from the table screen" with a screenshot (E401, 4:49 PM CDT 07-25). Entered Quick Fix, escalated to Standard on file 2. **Root cause was four things lining up**, not one: views are code-split with hashed names → the 1:43 PM deploy replaced `dist/` and `PlayerFinderView-DyXyQHTf.js` stopped existing; Workbox (`skipWaiting`+`clientsClaim`) had already activated the new worker and deleted the old precache, so the chunk was gone from cache AND server while the page ran the old bundle; `firebase.json` rewrites unmatched paths to `/index.html` so it returned HTML/200 and the import failed on MIME rather than 404; and **`useBuildVersion` compared the server to itself** (seeded `current` from the first `/version.json` poll, which always reports the server's newest) so the update banner was structurally incapable of firing. All three exits were closed: Try Again re-throws (React.lazy caches the rejection), Reload Page is answered from the worker's own precache, and Force Update lives behind `SettingsView`'s lazy chunk — the same failure. **PR #3 (`963f1ec`, 5 commits):** `chunkRecovery.js` self-heals a missing chunk with one guarded `hardRefresh()`; both boundaries classify chunk failures as **E405** with a plain-language surface rendered from the main bundle; `useBuildVersion` seeds from `BUILD_SHA` and re-checks on visibilitychange/focus/online; `requestSwUpdate()` asks the browser for a newer worker (nothing did before); `OnlineView` mismatch reload → `hardRefresh()` (same defect, found by the sweep); health pill deep-links into Settings' Error Log via new `settingsFocus` UI state (mirrors `dashboardAnchorDeepLink`); root `ErrorBoundary` now persists to the readable log; entries stamp `BUILD_SHA` not the frozen `'v122'`; pill counts only errors from the running build (founder hit this — a day-old error kept a red alert up through Force Update). **PR #4 (`57ef88d`, 1 commit):** closed the two gaps #3 deliberately left open — `persistenceHealth.js` + **E307** so the four persistence hooks still degrade-and-continue but no longer *silently* (`HealthIndicator` shows "Not saving — data at risk" at the top of its fault precedence, above sync), and `ViewLoadingFallback` so a **stalled** (not failed) chunk explains itself at 6s with Back to Home and adds Update App at 18s — deliberately **never** auto-clearing caches, because doing that on a weak connection strips the offline copy exactly when the network can't replace it. **Decisions: DEC-025** (a recovery control must live in the eager bundle, never behind the thing it recovers), **DEC-026** (staleness compares the running artifact to the server, never the server to itself), **DEC-027** (degrade-and-continue kept for persistence, but it must announce itself), **DEC-028** (a stalled load explains and offers choices, never auto-clears). Failure mode: `.claude/failures/STALE_CHUNK_DEAD_END.md` (full arc incl. what was deliberately *not* done). Design: Gate 1 GREEN surface-bound, no Gate 2 — `navigation-ia.md`'s own rule ("an operator/health signal → extend HealthIndicator") is the warrant; its change log carries personas/JTBD + the new fault precedence. **Verified:** full suite **12,768/533 files** green, build clean, CI green twice; Playwright repro of both the missing-chunk and stalled-chunk cases plus `indexedDB` killed pre-boot (pill in ~3s) and the pill→Error Log landing. **Production:** deploy `57ef88d` 07-27 15:34 UTC with "Verify deployment" passing, and the founder confirmed the phone reached `57ef88d` **with no manual Force Update** — first real-world proof the auto-update path works end to end. Session file: `.claude/workstream/sessions/session-2026-07-26-pwa-stale-chunk-recovery.yaml`. |
| 2026-07-22 | **Gate unblock (4 protocol runs) + SPR-146 — first domain-spec PROMOTED + doc/guard fixes** | Founder ran `/next` → gate blocked on stale sweeps; approved running them. **Protocol runs (all stamped):** domain-correctness **sweep** (domain-audit engine, run-sweep-2026-07-22 — drift CLEAN over ecd20b8..5aa1419; WS-235 poolBaseline math verified sound; Phase 0b drafted first domain spec, 16 rules) + **delta** (same window/evidence) + **challenge** (adversarial: math held — no double-counting, exact-mean cap, leave-one-out sound; FIND-029 confirmed fixed; FIND-030 closed as fixed-in-5aa1419 — but landed **FIND-037 HIGH** online sessions hardcode gameType→ALL online play pools into ONE segment (WS-260) + **FIND-038 HIGH** sizingTells circular — correlates vs model's own avgSegmentation, never handShown, while UI says "confirmed by showdowns" (WS-261) + FIND-039 MEDIUM free-text stake-label fragmentation (→WS-260)); **launch sweep** (inline meta-aggregation: NOT READY unchanged/correct; self-compliance decay 4→1 flagged as next /pulse candidate; FIND-LA-001 blocking_programs still unwired). **SPR-146 (composed+approved+DONE):** WS-257 POKER_THEORY v1.3 §6.5a documents the 3-tier prior hierarchy; WS-258 runWithStatPriors thenable guard + 5 tests (statRules 93/93, poolBaseline 16/16, generateExploits 33/33 green); WS-259 founder reviewed + **PROMOTED `docs/domain-spec.md`** (14 rules final: live/online separation RATIFIED High — "live and online are very distinctly different… mass data analysis supports this"; WEAKNESS-map grep clean→High; calibration rule expanded to 3 surfaces + PMC ledger enforcement; PRIOR_WEIGHT + study↔engine rules removed — sweep-cadence/deferred). Next domain run engages true Phase-1 rule-vs-code drift. **New founder-direction ticket WS-262:** mass population data acquisition spike (aggregate counts, Reference-class, sequence w/ WS-260). Kit quirk noted: health clamps to 2 via baseline default-cadence staleness (health-scoring.js isStale; gate unaffected). Evidence: `.claude/workstream/evidence/domain-correctness/run-sweep-2026-07-22/`. **Uncommitted** (rides atop WS-236 uncommitted work). Queue next: WS-260/261 (the 2 HIGHs) + WS-262. |
| 2026-07-22 | **SPR-145 resumed + closed — WS-236 HUD villain-stat attribution + parallel stats-engine parity (FIND-024 / DP-008)** | SPR-145 was approved 2026-06-22 but never executed (3rd bite of `[[resume-approved-sprints]]` / fr-012 — gate still only resumes status:active); resumed per the rule. Sibling SPR-143 (WS-234 PJX Gate 3) stays deferred — blocked on founder running the calibration instrument. **Shipped:** (1) seat popover builder extracted from the side-panel IIFE to `render-orchestrator.js` (pure/testable per extension architecture) and upgraded — header now shows the `Nh` observed-count even when no style label exists (previously hidden below the 20-hand style threshold — exactly the small-sample case where attribution matters most), and the Stats section label carries a DATA/PARTIAL/EST sample-quality badge (thresholds 15/5 mirroring LiveAdviceBar DP-004; single source `sampleQualityTier` in `shared/stats-engine.js`; deliberately NOT the closed conf-tier register, which is scoped to model outputs per shell-spec §III.5). (2) NEW parity seam test `src/utils/__tests__/statsEngineParity.seam.test.js` (21 tests, zero mocks) pins the extension's parallel stats engine to canonical `tendencyCalculations.js` semantics — and caught two REAL divergences on first run: extension counted a raiser-facing-a-re-raise into `facedRaisePreflop` (inflating the 3-bet denominator) and required the folder to have raised for `foldTo3Bet`. Extension aligned to canonical; one extension test updated (it had pinned the divergent semantics — fixture-asserts-wrong-invariant class). **Domain flag for founder:** the canonical `foldTo3Bet` counts ANY fold facing a raise (incl. fold-to-open), and limp-reraise is NOT counted as a 3-bet — both now parity-pinned across engines but the definitions themselves deserve a domain-correctness review ticket. **Design gates:** Gate 1 GREEN (`2026-07-22-entry-hud-villain-stat-attribution.md`, Gate 2 not triggered — no new interaction primitive); Gate 4 §Z1-POPOVER-ATTR added to `sidebar-zone-1.md`. **Verified:** extension suite 2,375/2,375 (83 files, +27 new); parity + tendency targeted main-app run 90/90; extension build clean; harness + Playwright visual verification (fullNineHanded arc regression-free, all 3 badge tiers rendered, nullEdges degrades clean; artifacts in `.playwright-mcp/`). FIND-024 auto-resolved via item close. **Uncommitted** — founder to commit. **Gate blocks outstanding:** domain-correctness sweep 22d overdue + launch sweep 20d overdue block NEW sprint composition — run `/pulse run domain-correctness sweep` + `/pulse run launch sweep`. |
| 2026-06-20 | **SPR-137/138/139 — domain-correctness first-principles cluster (3 sprints) + data-quality cap fix + findings reconcile** | Founder asked to work domain-correctness; `/next` kept auto-anchoring data-quality cap-breach items, so each sprint overrode the anchor to the real domain-correctness work. **WS-247 (SPR-137, plan-first):** removed the `heroEquity≥0.65` pre-gate in `bestResponseToAggression` that suppressed all +EV bluff/semi-bluff raises (FIND-029); now computes raiseEV unconditionally, sources no-model fold-to-raise from canonical `POPULATION_PRIORS.raise.fold`, and gates *fold-equity-driven* raises on a reliable read (founder ratified Option 1 — value raises always allowed, bluff-raises need a model). **DEC-022** + AS-N. **WS-244 (SPR-138):** routed two `STYLE_FOLD_DEFAULTS[style]` raw lookups (multiwayFoldPct + decisionTreeBuilder Priority 2) through the existing logistic machinery (style as prior); behavior-preserving at the curve midpoint, sizing-sensitive elsewhere (FIND-006/007). **WS-245 (SPR-139):** confidence-gated two display verdicts — `assessEV`→'unknown' below 10 hands; PIP deviations carry a confidence badge (FIND-009/010). Kept PIP confidence a PARALLEL `pipConfidence` map (not the ticket's nested shape) because nesting would break `runPipRules`; relocated `bayesianSampleConfidence` to pokerCore. **DEC-024.** **Then:** data-quality `max_open_items` 3→5 (**DEC-023**) — all 4 open items legitimate, cap was miscalibrated and floored real work above domain-correctness; verified `breached_programs:[]`. Reconciled FIND-007/010 (secondary findings on WS-244/245) to resolved — cleared the ungoverned-findings alert. Verified: `src/utils` 8,756 green (+9 new tests), build + preflight clean. domain-correctness health 6→8. **Uncommitted** — founder to commit. |
| 2026-06-13 | **SPR-126 — WS-221 global anchor-library calibration reset (red line #4b, design-gated destructive action)** | `/next` composed single-item plan-first sprint. Founder decisions (plan-mode): placement = Settings danger zone (not Calibration Dashboard); scope = anchors only (stamp `calibrationResetAt` across all anchors, preserve observations — red line #3 durability). **Shipped:** `LIBRARY_CALIBRATION_RESET` reducer action (reset + undo-restore paths, W-EA-5 writer registered in writers.js + WRITERS.md lockstep) + `buildLibraryResetCopy()` (AP-06-clean, count-aware) + `useLibraryReset` orchestrator (parallels useAnchorRetirement; 12s undo via prior-snapshot restore) + new self-contained `AnchorCalibrationResetSection.jsx` mounted propless in SettingsView (reuses shared `RetirementConfirmModal` 2-tap destructive confirm). **Design gates:** Gate 1 entry audit `2026-06-13-entry-global-anchor-library-reset.md` (GREEN, Gate 2 not triggered — reuses existing interaction pattern); Gate 4 surface update `settings-view.md` §EAL-G4-RESET + journey Variation C2 in `anchor-retirement.md`. **Contract suite:** `autonomyRedLines.test.jsx` it.todo for #4b replaced with 4 passing assertions + library-reset copy added to tone sweeps. New tests: useLibraryReset (14) + AnchorCalibrationResetSection (10) + reducer (6) + retirementCopy (3). Full suite 12,407/511 files green, **0 todo** (was 1); build clean (PWA 65 entries); Playwright-verified at portrait (section enabled with seeded anchor; 2-tap modal gated). |
<!-- 2026-06-12 SPR-123 (resumed orphaned approved sprint: WS-227 tournament-zone builders + WS-225 PrototypeFinderView deletion, commit e8e6c86; 2nd bite of resume-approved-sprints/fr-012) row pushed to archive 2026-07-27 (PWA stale-chunk recovery close-out). Canonical record in sprint-index.yaml + SPR-123 sprint file. -->
<!-- 2026-06-12 SPR-122 (shared IDB tx helpers WS-226, 19 modules migrated, −884 lines, commit 77d065e; durable-writes founder decision) row pushed to archive 2026-07-22 (SPR-146 close-out). Canonical record in sprint-index.yaml + SPR-122 sprint file. Original row: -->
<!-- | 2026-06-12 | **SPR-122 — shared IDB transaction helpers (WS-226) + refactor-candidate scan queued WS-225/227** | Founder-requested refactor scan (2 cto-agent reviewers: main app + extension) produced 3 queue items: WS-225 PrototypeFinderView deletion (P12/S), WS-226 persistence tx-helper dedup (P14/M), WS-227 extension tournament-zone pure-builder extraction (P13/M); second-tier findings (CommandStrip, AnchorObservationModal, diagnostics panel) deliberately NOT queued (opportunistic-only per scan verdict). `/next` anchored WS-226 (plan-first). **Founder decision (Medium): durable writes** — write helpers resolve on `tx.oncomplete` (after commit), not `request.onsuccess`; closes the resolve-then-rollback window (quota-at-commit class). **Shipped (commit `77d065e`):** 5 helpers in database.js (readTx/writeTx/updateTx/cursorTx/atomicTx; contract: raw-DOMException rejection — QuotaExceededError name-checks survive; helpers never log — modules' createPersistenceLogger try/catch owns swallow-vs-propagate) + all 19 persistence modules migrated behind unchanged public signatures (95/97 raw `db.transaction` sites collapsed; net −884 lines). Documented exceptions: batchUpdateSeatPlayers (bespoke abort-tracking) + deletePlayer (parallel cursor cascade) + migrations.js (versionchange, out of scope). NEW dbTransactions.test.js (19 tests: ConstraintError raw-error contract, updateTx rollback proof, atomicTx cross-store atomicity proof). Full suite 12,349/507 files green; build clean; only documented load flakes (all green isolated; AnchorObservationModal timeout added to the known list). SYSTEM_MODEL §1 persistence row updated (v27 + helper contract). | -->
<!-- 2026-06-11 SPR-121 (extension WS replay seam test WS-217 + HUD-drop fold bug fix; commit 000f4a5) row pushed to archive 2026-07-22 (SPR-145 close-out). Canonical record in sprint-index.yaml + SPR-121 sprint file. -->
<!-- 2026-06-11 SPR-120 (full-chain analytics seam test, WS-216; analysisPipeline.seam.test.js, 4 zero-mock tests; commit 361cc97) row pushed to archive 2026-06-20 (SPR-137/138/139 close-out). Canonical record in sprint-index.yaml + SPR-120 sprint file. -->
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
