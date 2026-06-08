# System State

Last updated: 2026-06-06 (SPR-108 closed — WS-146 5th claim: first multiway-specific leak rule + frequency-of-aggression substrate. Plan-mode found WS-146 hit a substrate boundary (6 prior rules consumed all fold-rate-over-vsBet-defense catalog entries); founder ratified scope expansion M→L+ via AskUserQuestion. Shipped additive decision-bucket substrate + hero-multiway-bluff-frequency. +24 net tests; 11,952 passing; build clean. Caught + corrected queue-index drift (WS-185/WS-155 stale-done; WS-191 soft-blocked).)

> **State-file discipline.** This file is the fast-scan canonical state of the system. It MUST stay readable in one screen.
> - Each row: terse. Detail belongs in linked files (project files, session files, SYSTEM_MODEL.md).
> - **Recent Sessions: last 5 only.** Older sessions go to `.claude/workstream/sessions/` (canonical CWOS form) or `system/state-history.md` (raw archive for sessions never captured as session files).
> - If a section grows past its row count, **prune and archive** — do not let it accumulate. The cumulative session changelog that used to live at the top was archived to `system/state-history.md` on 2026-05-10 because it had ballooned to ~40K tokens.
> - **Append discipline rule (binding):** at `/session-end`, the protocol must enforce this shape. Adding a new Recent Sessions row pushes the oldest to archive.

---

## Vital Signs

| Area | Status | Check | Detail |
|------|--------|-------|--------|
| Tests | GREEN | `bash scripts/smart-test-runner.sh` | 11,952 app passing (488 files; 20 skipped) + 2,249 extension (+24 net via WS-146 SPR-108). 2 pre-existing flakes (date-aged conceptMastery.test.js:120 + slow EV timeout under load) — both outside SPR-108 scope, confirmed reproduce on pre-change main |
| Build | GREEN | `npm run build` | Vite production build clean (9.0s) |
| Git | YELLOW | `git status --short` | Accumulated work uncommitted on `main` (incl. SPR-107) |
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
| Test count (app) | ~11,928 | Vitest (485 files; 20 skipped) |
| Test count (extension) | 2,249 | ignition-poker-tracker |
| Architecture version | v123 | per CLAUDE.md |
| IndexedDB schema | **v27** | Additive-only invariant. **Migration registry** at `src/utils/persistence/migrationRegistry.js` (27 entries + 3 helpers); CI gate `scripts/check-idb-additive.sh`. 23 object stores. v27 = reviewTag field on hands (WS-190). |
| Reducers / Contexts / Hooks / Views / Engines | **13 / 20 / 62 / 20 / 4** | Hooks nearly doubled since 2026-04-21 |
| Persistence modules | 29 | `src/utils/persistence/` |

Architecture detail: `.claude/context/SYSTEM_MODEL.md` (restored from backup 2026-05-10).

## Queue Summary

| Status | Count |
|--------|-------|
| Backlog | 83 |
| In Progress | 4 |
| Done | 79 |
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
| 2026-06-06 | **SPR-108 — SCF first multiway leak rule + frequency-of-aggression substrate (WS-146 5th claim)** | Composed via `/next` after SPR-107. **Premise verification at composition caught queue-index drift** (index `last_updated` 2026-05-30, predates SPR-104/105/106/107): WS-185 (EV-bucket, P14) + WS-155 (HSP-X1, P13) both stale-listed `backlog` but DONE; WS-191 (seat autoselector Phase 2, P20) soft-blocked on uncaptured live-session telemetry (its status_note: "do not anchor until owner has live-session data"); launch P22 program-gated (`domain-correctness blocks:[launch]`) + founder-decision-blocked; EAL P15 all NEEDS-RESCOPE. WS-146 (SCF leak rules, P18, proven 4-claim pattern) selected as top genuinely-ready item. **Plan-mode substrate verification (the SPR-046-blocker guard) found WS-146 hit a boundary:** the 6 prior shipped rules consumed ALL catalog entries fitting the 8-axis fold-rate-over-vsBet-defense substrate; every remaining PLANNED entry needs a new situation-key axis (playersRemaining/sizing/hand-strength) OR a frequency-of-aggression accumulator path (cbet+check route to different `contextAction` buckets — same blocker that deferred `hero-pf-open-overfold` since SPR-046) OR is future-research. **Founder ratified scope expansion M→L+ via AskUserQuestion ("Frequency + multiway axis").** **Shipped (additive, zero migration of 6 shipped rules):** `deriveSituationKey.deriveCbetDecision()` (coarse decision key `flop:cbet-decision:{hu|mw}`, mw=≥2 villains; classifies hero-as-PFA first-in flop acts as aggress/pass) + `heroDecisionAccumulator` parallel `decisionBuckets` (aggressFrequency + Wilson CI) + `heroLeakDetector` `bucketType:'decision'` routing + `leakRules/heroMultiwayBluffFrequency.js` (FIRST decision-bucket/aggression-frequency rule; fires on over-cbetting multiway, baseline ~25% conf 0.70, §7.4 ∏-fold-rate rationale) + solverBaselines `flop:cbet-decision:mw` + tierConceptMap tier-5 umbrella `multiway-cbet-discipline-cluster` + 2 anticipated children + lesson + leak-catalog 6/25→7/25. Player-count dimension lives ONLY in the new bucket type → 6 fold-rate rules + calibrations untouched. **+24 net tests** (14 rule + 6 accumulator decision-bucket + 4 detector); full smart-test-runner **11,952 passing / 20 skipped / 2 pre-existing flakes** (conceptMastery.test.js:120 date-aged + slow-EV-timeout-under-load, BOTH confirmed reproduce on pre-change main via git-stash); production build clean (11.14s); 48 downstream-consumer tests green. First-principles guard preserved (decision label is OUTPUT; rule compares OBSERVED frequency to hardcoded baseline). Substrate now unblocks turn-barrel + RFI-open-fold + HU-cbet frequency rules with NO further substrate work. **HOUSEKEEPING FLAGGED:** queue-index needs reconcile (WS-185/WS-155 stale-backlog) — `cwos-reconcile.js`/`kit/scripts/` absent in repo, done by hand on touched entries only. |
| 2026-06-05 | **SPR-107 — Mid-hand tag-for-review (WS-190); first post-HSP-v2 sprint** | Owner-requested feature (2026-05-12), unblocked when Refactor Sprint charter closed 2026-05-14. Composed via `/next` after the HSP v2 milestone closed (6 sprints); founder selected this direction via AskUserQuestion over SCF leak-rules / EAL test-hardening (launch-prep P22 items all soft-blocked on external decisions). Plan-first: Gate 1 audit (`docs/design/audits/2026-06-05-entry-hand-tag.md`, YELLOW — Gate 2 folded into surface, small blast radius) + Gate 4 surface (`docs/design/surfaces/hand-tag-for-review.md`) authored same session; 3 owner decisions ratified via AskUserQuestion (Review Queue = SessionsView panel; one-tap-only v1, note deferred to v1.1; untag via replay "Reviewed — clear tag" button). **Shipped:** `gameState.reviewTag` + `TOGGLE_REVIEW_TAG` (pure — `taggedAt` via payload) + resets on NEXT/RESET_HAND + GameContext exposure; `usePersistence` threads reviewTag top-level on the hand record (stable object — dedup-snapshot-safe) + restores via hydrate merge; `handsStorage` `updateHandReviewTag` + `getTaggedHands`; **IDB v26→v27** `migrateV27` + DB_VERSION bump + registry entry; ControlZone one-tap affordance + CommandStrip wiring; SessionsView `ReviewQueuePanel` (hidden when empty, newest-tag-first, row→HandReplay); HandReplayView tag badge + clear button. INV-TAG-1/2/3 added. **Premise correction at composition** (verify-at-composition discipline): ticket assumed migration v26, but v26 already existed (SLS Stream D) → shipped as v27; state.md's "v25" was itself drifted. **Bug caught + fixed during impl:** `migrateV27`'s cursor raced `migrateV25`'s cursor over the same `hands` store in one upgrade transaction — v27's stale-snapshot `put` clobbered v25's `predictionAudit` default (a real production corruption hazard, not just a test issue); guarded v27 to skip its pass for `oldVersion < 25` + added regression test. +24 net tests (gameReducer +7, handsStorage +6, migrationV27 +7, ControlZone +4, ReviewQueuePanel +4; usePersistence hydrate assertion updated). Impact zone green; production build clean (9.0s). 2 pre-existing flakes remain (date-aged conceptMastery.test.js:120 + slow EV timeout — both outside scope). **REMAINING:** manual Playwright visual verification at 1600×720 (tag toggle in ControlZone → Sessions Review Queue → replay clear). |
| 2026-06-04 | **SPR-106 — HSP-M1 Full multiway model (WS-154); HSP v2 hard-dep CLOSED** | 6th consecutive HSP v2 sprint, composed and completed same session as SPR-104/105. Plan-mode Phase 1 finding contracted spec scope ~80%: `gameTreeEvaluator` is already fully multiway-aware (`numOpponents` threads through `adjustedRealization` 0.85^(n-1) + `multiwayFoldPct` ∏ formula); buildHeroState already passes correct numOpponents. So no engine work. 3 founder decisions ratified at plan-mode AskUserQuestion: (1) **3-archetype split by potType** (`FLOP_MULTIWAY_SRP` / `_3BP` / `_LIMPED`) + `multiwayHeroRole` descriptor slot for hero-PFR-vs-caller axis (vs spec's 5; the 5-way SRP-hero-role split would have produced near-duplicate template bodies); FLOP_MULTIWAY retained as catch-all. (2) **`equityVsRangeParts` MULTIWAY throw lifted** — returns null role partition + populated `overall` against the supplied range (HU role labels have no defensible N-villain extension); `buildHeroState:519` dead-code guard (`actionContext !== 'MULTIWAY'`, never fired) rephrased to gate on `playersRemaining < 3` per the real concern. (3) **Ship in-sprint, zero child tickets upfront**; turn/river splits + pairwise narrowing primitive captured as `v3_TODO` frontmatter. Delivered: `HERO_STATE_DESIGN.md §7.4 RESOLVED` with 4 subsections mirroring §7.2.1 (taxonomy / already-shipped primitives derivation table citing `adjustedRealization:31` + `multiwayFoldPct:569` / role-partition limitation / first-principles guard binding) + 3 new templates at `docs/design/hero-state-templates/flop/FLOP_MULTIWAY_{SRP,3BP,LIMPED}.md` (all 5 pedagogical structural points; slot-driven; no hardcoded numerics per CONVENTIONS.md) + `FLOP_MULTIWAY` body rewritten as catch-all (v2_TODO → v3_TODO) + `types.js` ARCHETYPE_IDS 44→47 + `MULTIWAY_HERO_ROLES` enum + `Situation.multiwayHeroRole` typedef + `classifyArchetype.js` potType-routed multiway block + `buildHeroState.deriveMultiwayHeroRole()` helper + `ARCHETYPE_FAMILY_MAP` +3 entries + `equityVsRangeParts.js` `skipRolePartition` flag pattern. +18 net new tests across 5 files (8 classifier multiway routing + 5 buildHeroState end-to-end multiway + 1 equityVsRangeParts behavior change + 3 types/loadTemplates v3-catalog assertions + reachability case extensions). 239/239 heroState (+18 vs 221 at SPR-105 close); 21/21 HeroStateSection; 193/193 gameTreeEvaluator paranoia; production build clean (12.41s); smart-test-runner 11,901 passing / 1 pre-existing flake (conceptMastery.test.js:120 date-aged, also flagged at SPR-104) / 20 skipped. First-principles guard preserved end-to-end (archetypeId / multiwayHeroRole / potType are OUTPUTS only; bluff-freq DERIVES from ∏ fold rates; equity DERIVES from 0.85^(n-1); no hardcoded multipliers). **HSP v2 milestone:** of 5 children, WS-150 master + WS-154 multiway + WS-155 X1 composition + WS-211 orchestrator all done; only conditional WS-156 (caching, perf-signal-gated) + WS-157 (LLM authoring, research spike) remain. |
| 2026-06-04 | **SPR-104 + SPR-105 (back-to-back HSP v2 close-out sprints)** | **SPR-104 — WS-211 orchestrator deriveActionContext turn/river precision:** Resumed approved-but-deferred sprint from 2026-05-31 per memory `[[resume-approved-sprints]]`. Path A (heroState-local) shipped per founder ratification — 5 new local helpers (`normalizeActionVerb` + `wasHeroPreflopAggressor` + `heroBetStreet` + `villainBetStreet` + `allPriorPostflopStreetsCheckedThrough`) mirror `skillAssessment/deriveSituationKey.js` without crossing the layer boundary. `deriveActionContext` extended with precision branch for turn/river when `gameState.heroSeat` is present; falls back to v1 heuristic when absent (backward-compat preserved). `buildSituation` derives `sizingFraction` from `pendingBetSize/pot` when caller omits it. +19 tests covering BARREL/VS_BARREL/VS_DONK/PROBE/CBET-delayed turn+river, sizingFraction, backward-compat, 3BP. Vocab-reuse audit recorded — all 4 candidate accumulators REJECTED (layer-inversion). **SPR-105 — WS-155 HSP-X1 Adjustment composition rule:** Plan-mode caught premise issue at start — `villainProfile.vulnerabilities` had no `delta` field; original ticket would have shipped a no-op composer. Founder ratified expanded scope (composer + delta producer end-to-end). NEW `composeAdjustments.js` (~160 LoC) with per-axis rules ratified at plan-mode: sizingMultiplier multiplicative-clamp `[0.6, 2.0]` (POKER_THEORY §3.5 + §4.5.1 derivation); polarize OR; bluffFreq MIN-wins (minimax-regret); actionOverride precedence-by-severity with conservatism tiebreak (fold<check<call<bet<raise). NEW `WEAKNESS_TO_DELTA` producer in `villainProfileBuilder.js` mapping 8 load-bearing classes (calling-station / over-folder / wet-cbet-bluffer / dry-under-bettor / slowplay / weak-showdowner / overvalue-medium / preflop-fold-to-3bet). NEW `ComposedDelta` typedef + `HeroState.composedDelta` exposed (clamp-flag is transparency contract). `HERO_STATE_DESIGN.md §7.2 RESOLVED` with new §7.2.1 per-axis derivation table. +44 tests across 3 files (34 composer + 5 buildHeroState integration + 5 WEAKNESS_TO_DELTA). **Combined session totals:** +63 tests net (heroState 163→221, villainProfileBuilder 43→48); 11,875 app tests green; production builds clean (12.02s + 14.66s). 3 pre-existing flakes documented (date-aged `conceptMastery.test.js:120` + 2 slow EV tests timeout under concurrent load — all reproduce on pre-change main; independent of WS-211/WS-155). First-principles guard preserved: derived `actionContext` + `composedDelta` are OUTPUTS only; never inputs to gameTreeEvaluator. HSP v2 milestone significantly closer — of 5 v2 children (WS-150 master + WS-154 multiway + WS-155 X1 + WS-156 X2 caching + WS-157 X3 LLM), WS-155 done + WS-211 done; WS-154 is lone hard-dep remaining (X2/X3 conditional). |
| 2026-05-30 | **SPR-103 — HSP v2 turn+river close-out (WS-152 + WS-153)** | Closes "archetypes on every street" milestone. WS-152 (plan-first, founder ratified Option B 14-archetype mirror+block-bet pair via AskUserQuestion): 14 river templates at `docs/design/hero-state-templates/river/*.md` + §4.5 doc + §4.5.1 implementation policy; zero src/ diff (types.js/loadTemplates/classifier all deferred to WS-153 per WS-151 precedent). WS-153 (plan-first, Decision #2 architecturally moot per audit — classifier doesn't reconstruct action history): `classifyArchetype` extended turn (12) + river (14), `NotImplementedError` REMOVED; new `sizingFraction` axis drives RIVER_BLOCK_BET / RIVER_VS_BLOCK_BET routing per §4.5.1 (threshold ≤ 0.40); `types.js` ARCHETYPE_IDS 18→44 + ARCHETYPE_FAMILIES 11→29; `loadTemplates` glob `{preflop,flop}→{preflop,flop,turn,river}`; `buildHeroState` ARCHETYPE_FAMILY_MAP +26 entries + sizingFraction passthrough. 4 src files + 3 test files; classifyArchetype tests 32→72 (+40). 163/163 heroState + 772/772 impact-zone (HandReplayView + shapeLanguage + skillAssessment) green; production build clean (15.22s, 44 templates bundled, PWA SW regenerated). First-principles guard preserved (archetypeId OUTPUT only). Follow-up authored: WS-211 (orchestrator deriveActionContext upgrade for precise turn/river routing without explicit caller actionContext). |
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
