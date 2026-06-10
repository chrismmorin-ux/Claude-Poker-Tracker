# System State

Last updated: 2026-06-09 (SPR-110 closed — WS-164 PIO recognition scoring + confidence, unblocked core. First PIO-line sprint since SPR-041 (rotated off 6× WS-146). Founder ratified replace-scorePlayerMatch-contract-additively + ship-audit-defaults-PlayersView-only via AskUserQuestion. Shipped §PIO-G4-PVA weighted scorer (active-dim renormalization + computeStability scaling) + ConfidenceBar (AP-PIO-04 neutral) + PlayersView rank-by-score wiring + schema doc + DEC-019. +36 net tests; 12,103 passing; build clean; Playwright-verified at 1600×720. Premise corrections: scorePlayerMatch pre-existed (extended additively); audit weights sum 0.95 not "1.00" (kept verbatim; renormalization moots it). Deferred: Table-Build CandidateColumn live-rerank (Gate 5 not ticketed). Queue drift reconciled: WS-185/WS-155 index backlog→done.)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 12,286 app passing (503 files; 20 skipped; 1 todo) + 2,249 extension (+33 net via WS-025 SPR-115). 1 flake this run: `gameTreeHelpers.test.js:277` miniRolloutEquity (Monte Carlo; passes 52/52 isolated) |
| Build | GREEN | `npm run build` | Vite production build clean |
| Git | GREEN | `git status --short` | Clean. SPR-109 + SPR-110 committed `6d42a6f` (2026-06-09) on `main` |
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
| Test count (app) | ~12,103 | Vitest (496 files; 20 skipped) |
| Test count (extension) | 2,249 | ignition-poker-tracker |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v27** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (27 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. v27 = reviewTag field on hands (WS-190). |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 20 / 4** | Hooks nearly doubled since 2026-04-21 |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 51 |
| In Progress | 3 |
| Done | 140 |
| Completed | 7 |
| Deferred | 16 |
| Decomposed | 1 |
| Dismissed | 1 |
| Review | 1 |
| **Total** | **220** |

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
| 2026-06-10 | **SPR-115 — EAL autonomy red-lines contract suite (WS-025) + engineering cap-breach root fix** | `/next` initially composed a distorted sprint (WS-058 "Phase 3", floored 8→18 by the engineering cap-breach — 3rd occurrence of `[[feedback_cap_breach_distorts_composition]]`). Founder chose the root fix: **deferred 11 stale engineering items** (HRP paused-project streams WS-068..073 per owner Option C directive; Range Lab stretch phases WS-058/059/060; US-2 refit WS-062; event-driven WS-156) with per-item `deferred_reason` + revival triggers; 18→7 open vs cap 15; breach flag cleared by reconcile; `item_deferred` events emitted. Recompose anchored WS-025 (P15, legacy EAL-G5-RL). **Premise verified at composition:** all 9 red lines documented in the 2026-04-24 Gate-2 audit; two gaps found — red line #4b (global library reset) NEVER BUILT, and `ENROLLMENT_TOGGLED` has NO UI dispatch site (owner cannot actually enroll; fails safe). Founder ratified test-what-exists scope. **Shipped:** `src/components/views/AnchorLibraryView/__tests__/autonomyRedLines.test.jsx` — consolidated contract guard, one describe block per red line (33 tests + 1 `it.todo` for #4b), pure test addition, zero production changes. Asserts: not-enrolled default + I-WR-5/6 writer forcing (RL-1); 6-section transparency panel + primitive names (RL-2); override durability through unrelated dispatches + retired/suppressed never fire on `DEFAULT_LIVE_STATUSES` via SEED-01 canonical situation (RL-3); destructive 2-tap reset + re-enable reversibility (RL-4a/c); AP-06 + suite-local streak patterns over every deterministic copy string + rendered DOM (RL-5); empty-filter passes all 5 statuses + per-status card tags (RL-6); proclamation-pattern sweep + model-not-owner framing (RL-7); AP-07 badge leak check + study-vs-live one-directional render from identical data (RL-8); incognito primary-visible/forced-locked/writer-boundary-wins (RL-9). **Mutation spot-check:** flipping enrollment default failed exactly RL-1 — suite guards. Note: file lives under AnchorLibraryView/__tests__ (not utils/) because only the vitest `component` project has jsdom+jest-dom setup. **Queued:** WS-221 (global library reset — design-gated destructive action) + WS-222 (enrollment toggle UI — red line #1 completion). Full suite 12,286 passing / 20 skipped / 1 todo; 1 unrelated Monte Carlo flake (`gameTreeHelpers.test.js:277` miniRolloutEquity, passes isolated). |
| 2026-06-09 | **SPR-110 — PIO recognition scoring + confidence (unblocked core, WS-164)** | Composed via `/next` after SPR-109. **Anchor chosen after verifying the backlog** (verify-at-composition): launch P22 ×6 genuinely soft-blocked (founder Q7 legal / Q8 analytics-vendor + un-ticketed MPMF Gate 4 surfaces); domain-correctness test trio WS-020/023/025 NEEDS-RESCOPE; WS-150 master effectively done. WS-164 was top genuinely-shippable feature — rotates off six consecutive WS-146 claims. Plan-first; 2 founder decisions via AskUserQuestion (replace scorePlayerMatch contract additively; ship audit defaults PlayersView-only). **Shipped:** `src/utils/playerMatching/scorePlayerMatch.js` (NEW — §PIO-G4-PVA weighted score over modern fields + active-dim renormalization + `computeStability` scaling when sightings supplied + §PIO-G4-DISAMB confidence band; retains highlight metadata, additive; `usePlayerFiltering` re-exports) + `ConfidenceBar.jsx` (NEW, 10-segment bar + factual label; AP-PIO-04 neutral copy, DOM-lint enforced) + PlayersView/PlayerRow rank-by-score + ConfidenceBar wiring (first consumer; PlayersView-internal) + `recognition-confidence-schema.md` (NEW). **DEC-019** recorded (active-dim renormalization + verbatim audit weights + additive contract). **Premise corrections:** scorePlayerMatch pre-existed as an unused highlight primitive (grep-confirmed zero consumers) → extended additively; Explore agent claimed files that initial Glob false-negatived → deterministically re-verified via `find` before trusting; audit weight vector text "=1.00" vs listed values summing to 0.95 → kept verbatim (renormalization moots the sum). **Queue drift reconciled at composition:** WS-185 + WS-155 index `backlog` but ticket files `done` → fixed to done; WS-150 left backlog (master tracking parent). **+36 net tests** (scorePlayerMatch 23 + ConfidenceBar 8 + usePlayerFiltering +2 + PlayersView ranking +2); full app **12,103 passing / 20 skipped / 0 failed**; build clean. **Playwright at 1600×720:** seeded two same-name "Michael" distractors → search "Mi" ranked both (strong match, 100%) above substring-only "Tight Mike" (weak match, 0%); factual labels, no forbidden AP-PIO-04 copy, 0 console errors; test players removed afterward. AP-PIO-05/01 confirmed (scorer imports only playerFilterRange + computeStability; no path to tendencyMap/exploit engine). **Deferred:** Table-Build CandidateColumn live-rerank (Gate 5 not ticketed — scorer + ConfidenceBar reusable for that thin wire); corpus-tuned weights; PlayersView skin/hair/hat query dims. WS-164 marked done with deferral note. kit/scripts absent → bookkeeping by hand. |
| 2026-06-08 | **SPR-109 — SCF turn-barrel + RFI open-fold frequency rules (WS-146 6th claim)** | Resumed an approved-but-never-executed sprint (status:approved, items_done:0, completed_at:null) per memory `[[resume-approved-sprints]]` — `/next` correctly resumed rather than stacking. Single plan-first item. **Substrate re-verification (SPR-046-blocker guard) PASSED in plan mode:** both candidate rules derive cleanly from existing `deriveSituationKey` primitives on the SPR-108 decision-bucket substrate; zero migration of the 6 shipped 8-axis fold-rate rules. Founder ratified shipping **BOTH** via AskUserQuestion. **Shipped (additive):** `DECISION_DERIVERS` registry generalization of `heroDecisionAccumulator` + `deriveTurnBarrelDecision` + `deriveRfiDecision` (existing `flop:cbet-decision` byte-identical) + **hero-turn-barrel-frequency** (over-frequency; `turn:barrel-decision:hu`; baseline ~0.50; mirrors heroMultiwayBluffFrequency; turn-barrel catalog 0→1) + **hero-pf-open-overfold** (**FIRST under-frequency decision-bucket rule**; `preflop:rfi-decision:{EARLY\|MIDDLE\|LATE\|BUTTON}`; position-split baselines 0.15/0.19/0.26/0.42; folded-to-hero first-in, limp+blinds excluded v1; **resolves the deferral open since SPR-046**; preflop fold-equity category CLOSED 4/4) + 2 umbrellas (`rfi-discipline-cluster` tier 2 w/ SITUATION_KEY_TO_CONCEPT resolution + `turn-barrel-discipline-cluster` tier 5) + 6 sub-concepts + 2 CD-5-compliant lessons + 5 solver baselines + catalog 7/25→9/25 (duplicate hero-pf-open-overfold entries reconciled). **DEC-018** recorded (under-frequency rules invert the detect gate: delta=baseline−observed, CI UPPER must clear baseline — parallels hero-oop-3bet-underfold's under-fold pattern). **+60 net tests** (heroTurnBarrelFrequency 14 + heroPfOpenOverfold 17 + accumulator derivers 17 + count bumps); skillAssessment **316/316**; full app **12,067 passing / 20 skipped / 1 load-flake** (RangeLabExplorer PostflopDrillsView UI timeout under concurrent load, passes isolated in 2.8s, outside impact zone); production build clean (6.40s). First-principles guard preserved (aggress/pass labels OUTPUT-only; observed-vs-baseline; no label-as-input). No new UI surface — fired leaks render generically via existing CD-5 fields. WS-146 stays in_progress (ongoing authoring ticket). **Substrate now unblocks HU under-cbet mirror + multiway turn barrel with no further substrate work.** kit/scripts/ absent → reconcile/GC degraded gracefully; sprint+queue+index bookkeeping done by hand. |
| 2026-06-06 | **SPR-108 — SCF first multiway leak rule + frequency-of-aggression substrate (WS-146 5th claim)** | Composed via `/next` after SPR-107. **Premise verification at composition caught queue-index drift** (index `last_updated` 2026-05-30, predates SPR-104/105/106/107): WS-185 (EV-bucket, P14) + WS-155 (HSP-X1, P13) both stale-listed `backlog` but DONE; WS-191 (seat autoselector Phase 2, P20) soft-blocked on uncaptured live-session telemetry (its status_note: "do not anchor until owner has live-session data"); launch P22 program-gated (`domain-correctness blocks:[launch]`) + founder-decision-blocked; EAL P15 all NEEDS-RESCOPE. WS-146 (SCF leak rules, P18, proven 4-claim pattern) selected as top genuinely-ready item. **Plan-mode substrate verification (the SPR-046-blocker guard) found WS-146 hit a boundary:** the 6 prior shipped rules consumed ALL catalog entries fitting the 8-axis fold-rate-over-vsBet-defense substrate; every remaining PLANNED entry needs a new situation-key axis (playersRemaining/sizing/hand-strength) OR a frequency-of-aggression accumulator path (cbet+check route to different `contextAction` buckets — same blocker that deferred `hero-pf-open-overfold` since SPR-046) OR is future-research. **Founder ratified scope expansion M→L+ via AskUserQuestion ("Frequency + multiway axis").** **Shipped (additive, zero migration of 6 shipped rules):** `deriveSituationKey.deriveCbetDecision()` (coarse decision key `flop:cbet-decision:{hu|mw}`, mw=≥2 villains; classifies hero-as-PFA first-in flop acts as aggress/pass) + `heroDecisionAccumulator` parallel `decisionBuckets` (aggressFrequency + Wilson CI) + `heroLeakDetector` `bucketType:'decision'` routing + `leakRules/heroMultiwayBluffFrequency.js` (FIRST decision-bucket/aggression-frequency rule; fires on over-cbetting multiway, baseline ~25% conf 0.70, §7.4 ∏-fold-rate rationale) + solverBaselines `flop:cbet-decision:mw` + tierConceptMap tier-5 umbrella `multiway-cbet-discipline-cluster` + 2 anticipated children + lesson + leak-catalog 6/25→7/25. Player-count dimension lives ONLY in the new bucket type → 6 fold-rate rules + calibrations untouched. **+24 net tests** (14 rule + 6 accumulator decision-bucket + 4 detector); full smart-test-runner **11,952 passing / 20 skipped / 2 pre-existing flakes** (conceptMastery.test.js:120 date-aged + slow-EV-timeout-under-load, BOTH confirmed reproduce on pre-change main via git-stash); production build clean (11.14s); 48 downstream-consumer tests green. First-principles guard preserved (decision label is OUTPUT; rule compares OBSERVED frequency to hardcoded baseline). Substrate now unblocks turn-barrel + RFI-open-fold + HU-cbet frequency rules with NO further substrate work. **HOUSEKEEPING FLAGGED:** queue-index needs reconcile (WS-185/WS-155 stale-backlog) — `cwos-reconcile.js`/`kit/scripts/` absent in repo, done by hand on touched entries only. |
| 2026-06-05 | **SPR-107 — Mid-hand tag-for-review (WS-190); first post-HSP-v2 sprint** | Owner-requested feature (2026-05-12), unblocked when Refactor Sprint charter closed 2026-05-14. Composed via `/next` after the HSP v2 milestone closed (6 sprints); founder selected this direction via AskUserQuestion over SCF leak-rules / EAL test-hardening (launch-prep P22 items all soft-blocked on external decisions). Plan-first: Gate 1 audit (`docs/design/audits/2026-06-05-entry-hand-tag.md`, YELLOW — Gate 2 folded into surface, small blast radius) + Gate 4 surface (`docs/design/surfaces/hand-tag-for-review.md`) authored same session; 3 owner decisions ratified via AskUserQuestion (Review Queue = SessionsView panel; one-tap-only v1, note deferred to v1.1; untag via replay "Reviewed — clear tag" button). **Shipped:** `gameState.reviewTag` + `TOGGLE_REVIEW_TAG` (pure — `taggedAt` via payload) + resets on NEXT/RESET_HAND + GameContext exposure; `usePersistence` threads reviewTag top-level on the hand record (stable object — dedup-snapshot-safe) + restores via hydrate merge; `handsStorage` `updateHandReviewTag` + `getTaggedHands`; **IDB v26→v27** `migrateV27` + DB_VERSION bump + registry entry; ControlZone one-tap affordance + CommandStrip wiring; SessionsView `ReviewQueuePanel` (hidden when empty, newest-tag-first, row→HandReplay); HandReplayView tag badge + clear button. INV-TAG-1/2/3 added. **Premise correction at composition** (verify-at-composition discipline): ticket assumed migration v26, but v26 already existed (SLS Stream D) → shipped as v27; state.md's "v25" was itself drifted. **Bug caught + fixed during impl:** `migrateV27`'s cursor raced `migrateV25`'s cursor over the same `hands` store in one upgrade transaction — v27's stale-snapshot `put` clobbered v25's `predictionAudit` default (a real production corruption hazard, not just a test issue); guarded v27 to skip its pass for `oldVersion < 25` + added regression test. +24 net tests (gameReducer +7, handsStorage +6, migrationV27 +7, ControlZone +4, ReviewQueuePanel +4; usePersistence hydrate assertion updated). Impact zone green; production build clean (9.0s). 2 pre-existing flakes remain (date-aged conceptMastery.test.js:120 + slow EV timeout — both outside scope). **REMAINING:** manual Playwright visual verification at 1600×720 (tag toggle in ControlZone → Sessions Review Queue → replay clear). |
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
