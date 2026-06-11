# System State

Last updated: 2026-06-10 (SPR-118 closed — WS-223+WS-215 range-profile rules re-gated on OBSERVED frequency (founder-ratified evidence contract); range-never-3bets un-deadened; seam KNOWN-GAP test flipped to firing assertion. Commit 35dc234.)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 12,304+ app passing (505 files; unit+hooks 10,157/0 failed + component 2,147; +2 net via SPR-118) + 2,249 extension. 1 flake (full-suite-load only): RangeLabExplorer paint timeout (passes isolated); WS-220 tracks it |
| Build | GREEN | `npm run build` | Vite production build clean |
| Git | GREEN | `git status --short` | SPR-118 committed `35dc234` (2026-06-10) on `main` |
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
| Test count (app) | ~12,311 | Vitest (505 files; 20 skipped; 1 todo) |
| Test count (extension) | 2,249 | ignition-poker-tracker |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v27** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (27 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. v27 = reviewTag field on hands (WS-190). |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 20 / 4** | Hooks nearly doubled since 2026-04-21 |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 44 |
| In Progress | 3 |
| Done | 145 |
| Completed | 7 |
| Deferred | 20 |
| Decomposed | 1 |
| Dismissed | 1 |
| Review | 1 |
| **Total** | **221** |

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
| 2026-06-10 | **SPR-118 — range-profile rules re-gated on observed frequency (WS-223 + WS-215)** | `/next` composed the natural cluster: WS-223 (dead never-3bets rule, P27, from SPR-117's seam finding) + WS-215 (the broader width-as-frequency incoherence, same-day seam audit, unblocked by WS-214). Both premises verified at composition. Joint plan-mode design; **founder theory decision recorded: "Observed frequency everywhere"** — all 3 range-profile rules trigger AND test on observed action frequencies (`noRaiseFreqs`/`facedRaiseFreqs` + exact `actionCounts` k); posterior range WIDTHS (prior-mass-bearing) demoted to range-estimation/display, never evidence; `testProportionRaw`'s Beta posterior kept as the confidence gate (priors live INSIDE the test — "Bayesian, not frequentist" restored; width pseudo-counts had double-smoothed the prior). **Shipped (commit `35dc234`):** rangeRules.js EVIDENCE CONTRACT header + `observedCount()` helper (exact actionCounts k, freq-reconstruction fallback, clamped) + 3 rules re-gated with per-rule contract comments (open-wider-than-gto / never-3bets / cold-call-too-wide; showdown-mismatch + limp-open-overlap documented as width-free/grid-by-design); statBasis copy now cites observed numbers. Seam family: KNOWN-GAP test **flipped to assert never-3bets FIRES** on real producer output (16 facedRaise, 0 observed 3-bets, prior mass still in width — regression to width-gating fails loudly); new low-sample prior-dominated no-fire guard (75% observed over n=8 stays silent); orchestration block asserts never-3bets survives generateExploits. Fixture surgery per WS-214 lesson: rangeRules.test.js `makeSummaryEntry` + 4 generateExploits.test.js summaries now mirror the REAL producer contract (widths AND freqs); one unrealistic fixture (1%-over-30 threeBet) corrected to producer-emittable values. **Verification:** unit+hooks 10,157/0 failed; component 2,147 passed with only the pre-existing WS-220 flake. domain-correctness health 2/7 unchanged (delta/challenge protocols never run — founder-surfaced last session, still open). |
| 2026-06-10 | **SPR-117 — rangeEngine→exploitEngine seam-test family (WS-214) + bucketQueryUtils unit-contract fix** | `/next` initially anchored WS-091 "Future content-fix batches per audit" — **premise check (5th occurrence of `[[feedback_verify_ticket_premise_at_composition]]`) found WS-091/094/096 are LAZY ticket-generation placeholders** (legacy LSW-F*/G*/H* meta-rules, no concrete findings attached) that had topped the queue at P12 since the 2026-05-01 migration. Founder chose defer-and-recompose: 3 placeholders deferred (rule recorded as superseded by program `on_finding` accountability in prog-domain-correctness.yaml), recomposed on WS-214 (concrete, authored same-day from the cross-stream seam audit). **Shipped:** `rangeExploitSeam.test.js` (NEW, 12 tests, RT-108 real-producer pattern) — real `buildRangeProfile`→`getRangeWidthSummary`→`runRangeProfileRules` firing (`range-cold-call-too-wide-LATE` + tight/sample-floor controls), real `getSubActionSummary`→`runSubActionRules` (limp-fold-exploitable, limp-reraise-trap suppressing limp-range-capped, limp-range-capped at 2× floor), full `generateExploits` production-path mirror (real `buildPlayerStats`+`derivePercentages`), and units block pinning segmentation 0–100 contract through `accumulateDecisions`→`aggregateSegmentation`→`derivePersonalizedMultipliers` incl. the `/100` conversion at villainDecisionModel.js:354 (**verified CORRECT during planning** — exploration agent had mis-flagged it as a bug; blend-betweenness asserted against ACTION_MULTIPLIERS). `bucketQueryUtils.test.js` fixtures converted 0–1→0–100 with contract-pinning test. **FINDING → WS-223 (P27):** `range-never-3bets-position-*` gates on Bayesian range WIDTH (`facedRaise.threeBet === 0`) which always carries population-prior mass — **dead code on real producer output**; the rule means `facedRaiseFreqs.threeBet`; pinned as KNOWN-GAP test to flip when fixed. Full suite 12,311 passing / 1 pre-existing WS-220 flake (green isolated). Commit `a2fb6a6`. **Health note:** canonical compute now scores domain-correctness 2/7 (`block_sprint + stale` cap) because delta/challenge protocols have never run at critical tier — surfaced to founder. |
| 2026-06-10 | **SPR-116 — YAML reader inline-comment hardening (WS-213) + stale HSP-v2 umbrella close-out** | `/next` composed WS-150 (HSP-v2 master, L, 3 sessions vs 2-session cap). **Premise check (4th occurrence of `[[feedback_verify_ticket_premise_at_composition]]`, new variant: stale umbrella)** found 5/7 children already shipped (WS-151..155 done SPR-102..106), WS-156 deferred by design, only optional P3 spike WS-157 open — umbrella was winning composition at score 14 while ~90% done. Founder chose Option A: **WS-157 re-deferred** with rationale (event-driven on long-tail production evidence, mirrors WS-156), **WS-150 closed** via item_closed event `ev-1781129963371` (HSP-v2 program complete), recomposed SPR-116 on **WS-213**. **Shipped:** quote-aware `stripInlineComment()` in `kit/scripts/lib/cwos-utils.js` (parseScalar + parseMapping afterColon) — root fix for the SPR-113 cap-breach class; `#` in quoted spans preserved, block-scalar content untouched, leading-# unchanged; bonus: quoted-scalar-with-trailing-comment now unquotes, inline arrays with trailing comments no longer corrupt last element; `toInt()` consumer guard retained as defense-in-depth. 12 regression tests `scripts/__tests__/cwos-utils-yaml.test.js` (incl. exact SPR-113 reproduction). Gate/candidates verified parsing caps as numbers post-change. Full suite 12,297 passing / 2 pre-existing full-suite-load flakes (gameTreeDepth2 green isolated; src/ has zero kit imports). Commits `c1ed1a3` + `35c0f29`. **Friction logged:** approve doesn't claim queue items; gate invisible to status:approved sprints (fr-012 still live). |
| 2026-06-10 | **SPR-115 — EAL autonomy red-lines contract suite (WS-025) + engineering cap-breach root fix** | `/next` initially composed a distorted sprint (WS-058 "Phase 3", floored 8→18 by the engineering cap-breach — 3rd occurrence of `[[feedback_cap_breach_distorts_composition]]`). Founder chose the root fix: **deferred 11 stale engineering items** (HRP paused-project streams WS-068..073 per owner Option C directive; Range Lab stretch phases WS-058/059/060; US-2 refit WS-062; event-driven WS-156) with per-item `deferred_reason` + revival triggers; 18→7 open vs cap 15; breach flag cleared by reconcile; `item_deferred` events emitted. Recompose anchored WS-025 (P15, legacy EAL-G5-RL). **Premise verified at composition:** all 9 red lines documented in the 2026-04-24 Gate-2 audit; two gaps found — red line #4b (global library reset) NEVER BUILT, and `ENROLLMENT_TOGGLED` has NO UI dispatch site (owner cannot actually enroll; fails safe). Founder ratified test-what-exists scope. **Shipped:** `src/components/views/AnchorLibraryView/__tests__/autonomyRedLines.test.jsx` — consolidated contract guard, one describe block per red line (33 tests + 1 `it.todo` for #4b), pure test addition, zero production changes. Asserts: not-enrolled default + I-WR-5/6 writer forcing (RL-1); 6-section transparency panel + primitive names (RL-2); override durability through unrelated dispatches + retired/suppressed never fire on `DEFAULT_LIVE_STATUSES` via SEED-01 canonical situation (RL-3); destructive 2-tap reset + re-enable reversibility (RL-4a/c); AP-06 + suite-local streak patterns over every deterministic copy string + rendered DOM (RL-5); empty-filter passes all 5 statuses + per-status card tags (RL-6); proclamation-pattern sweep + model-not-owner framing (RL-7); AP-07 badge leak check + study-vs-live one-directional render from identical data (RL-8); incognito primary-visible/forced-locked/writer-boundary-wins (RL-9). **Mutation spot-check:** flipping enrollment default failed exactly RL-1 — suite guards. Note: file lives under AnchorLibraryView/__tests__ (not utils/) because only the vitest `component` project has jsdom+jest-dom setup. **Queued:** WS-221 (global library reset — design-gated destructive action) + WS-222 (enrollment toggle UI — red line #1 completion). Full suite 12,286 passing / 20 skipped / 1 todo; 1 unrelated Monte Carlo flake (`gameTreeHelpers.test.js:277` miniRolloutEquity, passes isolated). |
| 2026-06-09 | **SPR-110 — PIO recognition scoring + confidence (unblocked core, WS-164)** | Composed via `/next` after SPR-109. **Anchor chosen after verifying the backlog** (verify-at-composition): launch P22 ×6 genuinely soft-blocked (founder Q7 legal / Q8 analytics-vendor + un-ticketed MPMF Gate 4 surfaces); domain-correctness test trio WS-020/023/025 NEEDS-RESCOPE; WS-150 master effectively done. WS-164 was top genuinely-shippable feature — rotates off six consecutive WS-146 claims. Plan-first; 2 founder decisions via AskUserQuestion (replace scorePlayerMatch contract additively; ship audit defaults PlayersView-only). **Shipped:** `src/utils/playerMatching/scorePlayerMatch.js` (NEW — §PIO-G4-PVA weighted score over modern fields + active-dim renormalization + `computeStability` scaling when sightings supplied + §PIO-G4-DISAMB confidence band; retains highlight metadata, additive; `usePlayerFiltering` re-exports) + `ConfidenceBar.jsx` (NEW, 10-segment bar + factual label; AP-PIO-04 neutral copy, DOM-lint enforced) + PlayersView/PlayerRow rank-by-score + ConfidenceBar wiring (first consumer; PlayersView-internal) + `recognition-confidence-schema.md` (NEW). **DEC-019** recorded (active-dim renormalization + verbatim audit weights + additive contract). **Premise corrections:** scorePlayerMatch pre-existed as an unused highlight primitive (grep-confirmed zero consumers) → extended additively; Explore agent claimed files that initial Glob false-negatived → deterministically re-verified via `find` before trusting; audit weight vector text "=1.00" vs listed values summing to 0.95 → kept verbatim (renormalization moots the sum). **Queue drift reconciled at composition:** WS-185 + WS-155 index `backlog` but ticket files `done` → fixed to done; WS-150 left backlog (master tracking parent). **+36 net tests** (scorePlayerMatch 23 + ConfidenceBar 8 + usePlayerFiltering +2 + PlayersView ranking +2); full app **12,103 passing / 20 skipped / 0 failed**; build clean. **Playwright at 1600×720:** seeded two same-name "Michael" distractors → search "Mi" ranked both (strong match, 100%) above substring-only "Tight Mike" (weak match, 0%); factual labels, no forbidden AP-PIO-04 copy, 0 console errors; test players removed afterward. AP-PIO-05/01 confirmed (scorer imports only playerFilterRange + computeStability; no path to tendencyMap/exploit engine). **Deferred:** Table-Build CandidateColumn live-rerank (Gate 5 not ticketed — scorer + ConfidenceBar reusable for that thin wire); corpus-tuned weights; PlayersView skin/hair/hat query dims. WS-164 marked done with deferral note. kit/scripts absent → bookkeeping by hand. |
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
