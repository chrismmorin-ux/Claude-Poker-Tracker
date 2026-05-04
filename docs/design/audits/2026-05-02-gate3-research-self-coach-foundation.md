# Gate 3 Research — Self-Coach Foundation (SCF)

**Gate:** 3 (Research)
**Date:** 2026-05-02
**References:**
- [Gate 1 Entry — `audits/2026-05-02-entry-self-coach-foundation.md`](2026-05-02-entry-self-coach-foundation.md)
- [Gate 2 Blind-Spot — `audits/2026-05-02-blindspot-self-coach-foundation.md`](2026-05-02-blindspot-self-coach-foundation.md)
- [persona — `personas/core/chris-live-player.md`](../personas/core/chris-live-player.md)
- [JTBD domain — `jtbd/domains/coaching.md`](../jtbd/domains/coaching.md) §Self-coach mode (CO-54..57)

**Sprint / WS:** SPR-018 / WS-011 (Master Plan §D, D-line first Phase-3 Research gate; A-line PIO-G3 follows in next sprint per A/D alternation)

**Status:** Draft, pending owner ratification.

This document specifies the 5 SCF-G3-* carry-forwards from Gate 2 (`DETECTOR`, `TIERMAP`, `SPINE`, `CO`, `SCHEMA`) — all named as **BLOCKING Gate 4** — plus one binding amendment to AP-SCF-01 surfaced by owner decisions in this sprint. Gate 4 (Design surfaces — SelfCoachView, leak-panel embed, schema delta) is unblocked when this document is ratified.

---

## Decisions ratified (executive summary)

Owner-decided in /next plan-mode AskUserQuestion 2026-05-02:

| # | Decision flag | Outcome |
|---|---|---|
| 1 | **Skill-assessment shape** | Observed PRIMARY (drill performance + hero-leak frequency in hands) **+ opt-in owner-volunteered tests**. Critical AP-SCF-01 nuance — see §AP-SCF-01 amendment below. |
| 2 | **Lesson surface placement** | **Both** inline (HandReplayView contextual leak annotations, review-mode only) **and** dedicated SelfCoachView (post-session host + curriculum browse + opt-in test surface). Two surfaces serve mid-review + post-session personas. |
| 3 | **Leak-firing frequency** | **Every leak fired immediately on hand-replay.** Per-action hero-leak detector + inline annotation at the relevant action point. Aggregated inventory also lives in dedicated SelfCoachView. Owner explicitly chose this over the aggregated-post-session option per Q4 stance "knowing leak frequency is very valuable". |
| 4 | **Curriculum-spine format** | **Three-signal hybrid**: hand-authored DAG (skeleton, prereq coherence) + observed drill mastery (`scheduler.frameworkAccuracy`) + observed-leak-frequency (heroLeakDetector output) + opt-in owner-volunteered test results. Within-tier ordering composite-signal weighted; weights authored below in §SCF-G3-SPINE. |

Inline-handled (recommended-with-rationale; owner amends in review):

5. **Per-tier teachable-concept map (SCF-G3-TIERMAP):** Ratify SCF-G1 draft as starting point; embed scenario walkthrough in Appendix A; owner amends specific cells.
6. **Hero-leak detector schema (SCF-G3-DETECTOR):** Mirror villain-side `weaknessDetector.js` + `decisionAccumulator.js`; Beta-Binomial CI via `bayesianConfidence.js`; n≥30 hard floor (Gate 2 ratified); per-stat priors authored below.

---

## SCF-G3-DETECTOR — Hero-leak detector schema (BLOCKING Gate 4)

**Framing.** Specify the module structure, rule shape, situation-key bucketing, and Bayesian confidence parameterization for the hero-side analog of `weaknessDetector.js`. Gate 2 §B confirmed parallel-store decision; Gate 3 specifies the schema sufficient for Gate 4 surface design + Gate 5 implementation.

**Evidence.**

- **Villain-side rule structure (`weaknessDetector.js`).** Output shape: `{ id, category, label, description, severity (0-1), confidence (Bayesian), sampleSize, evidence: { metric, observed, profitable, delta }, situationKeys[] }`. Rules evaluate percentiles on `decisionSummary.buckets` aggregated by situation key.
- **Situation-key 7-dim bucketing (`decisionAccumulator.js`).** Format: `"{street}:{texture}:{posCategory}:{isAgg}:{isIP}:{facingAction}:{contextAction}"`. Recency-weighted accumulation (halflife=50 hands); MIN_BUCKET_SAMPLE=3 before aggregate metrics computed.
- **Bayesian credible interval (`bayesianConfidence.js:301`).** `credibleInterval(k, n, priorAlpha, priorBeta, level=0.95)` returns `{ lower, upper, mean, level }`. Posterior Beta is `Beta(priorAlpha + k, priorBeta + (n - k))`. STAT_PRIORS at lines 25-35 give villain-side examples like `foldToCbet: Beta(4.5, 5.5)` (mean 45%, total pseudocount 10).

**Recommendation.**

- **Modules (NEW, Gate 5):** `src/utils/exploitEngine/heroLeakDetector.js` + `src/utils/exploitEngine/heroDecisionAccumulator.js`. Mirror villain-side responsibility split: accumulator buckets per-action observations; detector applies rules over aggregated buckets.
- **Situation-key bucketing:** Copy 7-dim `street:texture:posCategory:isAgg:isIP:facingAction:contextAction` verbatim. Halflife=50 hands. MIN_BUCKET_SAMPLE=3 (matches villain-side floor; n≥30 floor for *displaying* leak claims is separate gate at the surface level).
- **Hero-leak rule output:** Identical shape to villain-side weakness output. `severity` ∈ [0, 1] computed as `(observed - profitable) / max(observed, profitable)` clamped. `confidence` is the credible-interval width inverted (tighter CI = higher confidence). `evidence.metric` names the stat (e.g., `foldToCbet`); `observed` and `profitable` are user-facing rates; `delta` is signed gap.
- **Per-stat priors (HERO_LEAK_PRIORS, NEW):** Author in `src/utils/bayesianConfidence.js` alongside existing STAT_PRIORS, or split to `heroLeakPriors.js` if it grows. Initial set, weak prior (total pseudocount 5, data dominates by n≈10):

```
foldToCbetIP:    Beta(2.25, 2.75)   // pop ~45%, pseudo=5
foldToCbetOOP:   Beta(2.50, 2.50)   // pop ~50%, pseudo=5
threeBetIP:      Beta(0.50, 4.50)   // pop ~10%, pseudo=5
threeBetOOP:     Beta(0.40, 4.60)   // pop ~8%,  pseudo=5
vpipUTG:         Beta(0.60, 4.40)   // pop ~12%, pseudo=5
vpipBTN:         Beta(2.20, 2.80)   // pop ~44%, pseudo=5
turnDoubleBarrel:Beta(2.00, 3.00)   // pop ~40%, pseudo=5
checkRaiseFlop:  Beta(0.40, 4.60)   // pop ~8%,  pseudo=5
```

Initial set ratified for Gate 5 implementation. Owner amends per-stat values during Gate 4 surface review if the surface walk-through surfaces a stat that needs different prior.

- **n≥30 hard floor** (Gate 2 §C ratified). No hero-leak claim text rendered when bucket sampleSize < 30. Below-floor surfaces render `"Insufficient sample (need {30 - n} more hands)"` factual placeholder per AP-SCF-04.
- **sourceUtilPolicy whitelist** (Gate 2 §D ratified). `heroLeaks` IDB store reads ONLY from whitelisted surfaces: `HandReplayView` (review-mode), `PlayerAnalysisPanel` (review-mode), `SelfCoachView`. Blacklist: `OnlineView`, sidebar HUD, `TableView` chrome, `TournamentView`, `ShowdownView`, all live-decision surfaces. CI-grep enforcement at Gate 5 mirrors EAL F6 sourceUtilPolicy.

**Confidence: High.** Mirroring villain-side gives strong precedent + battle-tested patterns. Per-stat priors are starter values; Gate 4 surface review tunes against owner's actual hand corpus.

---

## SCF-G3-TIERMAP — Per-tier teachable-concept map ratification (BLOCKING Gate 4)

**Framing.** SCF-G1 §Per-tier teachable-concept map drafted a 6-tier × 1-3-concepts-per-tier table. Gate 3 ratifies via owner introspection embedded in Appendix A.

**Recommendation.** Ratify Gate 1 draft as starting point. Owner walks Appendix A scenario table during Gate 3 review; amendments captured per cell in delta table below.

**Confidence: Medium.** Map is owner-introspection-bound; literature does not specify the right concept-per-tier ordering for live poker. The structural choice (6 tiers × 1-3 concepts × monotonic prereq) is high-confidence; the specific concept assignments are owner-amendable.

(Appendix A — Per-Tier Teachable-Concept Map Walkthrough — at end of this document.)

---

## SCF-G3-SPINE — Curriculum-spine format (BLOCKING Gate 4)

**Framing.** How should the curriculum decide "next concept to study" given the user's current state? Gate 1 §Q5 named three options: hand-authored DAG / observed leak frequency / hybrid. Gate 2 §C recommended hybrid; Gate 3 owner answer expanded to **four-signal** composite (DAG + drill mastery + leak frequency + test results).

**Evidence.**

- **Drill scheduler (`scheduler.js:27-65`).** Existing input contract: `library` (drill array), `frameworkAccuracy` (per-framework `{accuracy, attempts, avgDelta, deltaSamples}`), `recentIds`. Cold-start uniform; warm-start `frameworkWeight = 1.5 - accuracy` clamped [0.5, 2.5] + recency penalty 0.3×.
- **Lessons + frameworks corpus (`lessons.js` + `frameworks.js`).** 10 lessons + 9 frameworks. Each lesson has `id` + `frameworkId`; lessons are concept-prose + computation surface. No existing concept-prereq structure.
- **Owner stance (Q4 answer).** "observed, test based, and computed from leak frequency. Knowing their leak frequency is very valuable." Three-signal hybrid expanded beyond Gate 2's two-signal recommendation.

**Recommendation.**

- **DAG skeleton (NEW, Gate 5):** Author at `src/utils/drillContent/curriculumSpine.js`. Each node: `{ conceptId, frameworkIds[], tier, prereqIds[], domain }`. DAG enforces prereq coherence (don't suggest polarization before pot odds).
- **Within-tier ordering — composite signal:**

```
nextConcept = argmax(
  W_leak  * leakFrequency[conceptId]            // high leak freq → study now
  + W_drill * (1 - drillMastery[conceptId])     // low mastery → study now
  + W_test  * (1 - testResultDelta[conceptId])  // failed last test → study now
  - W_recent * recencyPenalty[conceptId]        // recently studied → defer
)
```

Initial weights: `W_leak = 0.5`, `W_drill = 0.3`, `W_test = 0.15`, `W_recent = 0.05` (additive). Owner amends weights during Gate 4 surface review based on the dominant signal preferences. Test signal opt-in only — when no test results exist for a concept, `testResultDelta` term is zero (drops to two-signal effective scoring).

- **Scheduler integration contract:** `drillContent/scheduler.js` `frameworkWeight()` signature gains optional `tier` + `perDomainMastery` + `leakFrequencyMap` parameters (all default `undefined` → backward-compat preserved). When all three params are supplied, scheduler weights drills within the curriculum-spine-recommended concept; when not supplied, scheduler behaves as today. Additive change; no breaking.
- **Composite-signal data sources:**
  - `leakFrequency`: from `heroLeakDetector` output (per-conceptId aggregation across situation keys mapped to concept domain)
  - `drillMastery`: existing `scheduler.frameworkAccuracy` (already computed)
  - `testResultDelta`: from `userSettings.perDomainMastery[conceptId].testResults[]` (NEW; opt-in test surface populates)
  - `recencyPenalty`: existing `scheduler.recentIds` reuse

**Confidence: Medium-High.** Three-signal composite is owner-driven; DAG-as-skeleton is well-precedented; scheduler additive integration is structurally clean. Specific weights are starter values needing Gate 4 walk-through tuning.

---

## SCF-G3-CO — CO-54..57 from Proposed → Active (BLOCKING Gate 4)

**Framing.** Gate 2 §B ratified CO-56 ↔ DS-58 reconciliation (KEEP SEPARATE). Gate 3 promotes CO-54/55/56 from `Proposed` to `Active`, with CO-56 wording amendment. CO-57 stays `Proposed` per Gate 2 §Q3 deferral (Gate 4 v2; assumptionEngine has no precedent for pre-decision confidence elicitation).

**Recommendation.**

- **CO-54 (see-leak-without-being-graded):** State `Proposed` → **`Active`**. AP-SCF-01 nuance applied (see §AP-SCF-01 amendment below). Forbidden-string list unchanged at the system-imposed-grading scope.
- **CO-55 (learn-next-concept-im-ready-for):** State `Proposed` → **`Active`**. Spine signals ratified per SCF-G3-SPINE composite-signal formula. Red line #6 binding (suggest, never gate).
- **CO-56 (validate-im-improving):** State `Proposed` → **`Active`**. **Wording amendment** per Gate 2 §B Stage B verdict — success criterion gets clause: *"— with non-graded framing per AP-SCF-01 (system-imposed-grading refused; owner-volunteered tests permitted)."* CO-56 reuses the parameterized credible-interval-over-time infrastructure shared with DS-58; data sources are distinct (hero behavioral metric vs anchor-claim referent).
- **CO-57 (self-rate-confidence-on-a-line):** State stays **`Proposed`**. Per Gate 2 §Q3 deferral, Gate 4 v2. Note added in coaching.md: *"deferred to Gate 4 v2 per SCF Gate 3 Open Questions §1; assumptionEngine has no existing precedent for pre-decision confidence elicitation; the surface affordance is net-new and high design-effort cost."*

**Confidence: High.** State transitions follow Gate 2 closure verdicts; CO-56 wording amendment is one clause; CO-57 deferral is owner-aware (Q3 of Gate 1 + Stage B of Gate 2 + Gate 4 v2 carry-forward).

---

## SCF-G3-SCHEMA — IDB v22 migration spec (BLOCKING Gate 4)

**Framing.** Specify the schema delta sufficient for Gate 4 to reference. Gate 5 implements migration script per existing `database.js` v21→v22 pattern.

**Recommendation.**

**New IDB store: `heroLeaks`** (v22)

```
keypath: [playerId, situationKey]    // composite; playerId always 'self' for v1
indexes:
  by_playerId:    on .playerId
  by_situationKey: on .situationKey
  by_severity:    on .severity        // for severity-sorted leak inventory views

record shape:
  {
    playerId: 'self',                 // v1 single-user; v2 may broaden
    situationKey: 'flop:wet:BTN:agg:ip:none:cbet',
    occurrences: 47,
    observedRate: 0.62,               // raw observed
    credibleInterval: {                // from bayesianConfidence.credibleInterval()
      lower: 0.48,
      upper: 0.76,
      mean: 0.62,
      level: 0.95
    },
    severity: 0.42,                   // computed by heroLeakDetector
    confidence: 0.71,                 // CI-width-derived
    evidence: { metric, observed, profitable, delta },
    lastUpdatedAt: 1735776000000      // ms epoch
  }
```

**`userSettings` extension** (additive on existing `userSettings` keypath)

```
tier: {
  current: 'studied-amateur',         // 6-tier ladder per chris-live-player.md §Skill-ladder
  target: 'serious-grinder',
  lastSetAt: 1735776000000,
  source: 'declared' | 'inferred-confirmed'   // AP-SCF-03 binding
}

perDomainMastery: {
  [conceptId]: {
    masteryState: 'novice' | 'learning' | 'drilled' | 'fluent',
    lastDrilledAt: 1735776000000,
    drillCount: 12,
    testResults: [                    // OPT-IN owner-volunteered tests; empty array if no tests taken
      { takenAt, score: { correct, total }, conceptVersion }
    ]
  }
}
```

**Migration outline.** Per `database.js` v21→v22 pattern (additive, no breaking):
1. Open IDB at v22 (`max(currentVersion + 1, 22)` per dynamic-version pattern from EAL Gate 4 P3 §2).
2. Create `heroLeaks` store with composite keypath + 3 indexes.
3. `userSettings` records extended additively — existing records work unchanged; new fields populated lazily on next write.
4. No data backfill needed — first hero-leak detector run populates `heroLeaks`; first tier-set populates `userSettings.tier`.

**Confidence: High.** Schema mirrors EAL `anchorObservations` precedent (Gate 4 §D parallel-store). Migration pattern is well-established (EAL did v18→v19 the same way).

---

## AP-SCF-01 nuance amendment — system-imposed vs owner-volunteered grading

**Framing.** Owner Q1 answer (skill-assessment shape) introduced a critical nuance: "lets do both observed, test based. The user can volunteer to be graded, that is an extremely reasonable thing." This narrows AP-SCF-01's refusal scope.

**Re-stated refusal scope.** AP-SCF-01 refuses **system-imposed** grading on hero-leak surfaces. **Owner-volunteered** tests on opt-in test surfaces are PERMITTED — the grading happens because the user explicitly asked for it. The opt-in gate is the load-bearing autonomy contract.

**Forbidden patterns (system-imposed):** "how did you do?", "your score: X", "you got Y wrong", any auto-rendered grading framing on review-mode surfaces (HandReplayView leak annotations, SelfCoachView leak inventory, between-hands leak count card).

**Permitted patterns (owner-volunteered):** "Test myself on this concept" button → quiz surface → factual results display ("3 of 5 correct"). The button must be user-initiated; the quiz cannot auto-launch.

**Companion file updates (this Gate 3 deliverable):**
- `docs/projects/self-coach-foundation/copy-discipline.md` CD-2 — add subsection "Allowed: owner-volunteered test surfaces" with explicit examples. Forbidden examples preserved. CI-lint forbidden-string list unchanged (the strings are still forbidden; the surfaces using them are now narrower).
- `docs/projects/self-coach-foundation/anti-patterns.md` AP-SCF-01 — refusal scope re-stated; "Allowed alternative" gains "Owner-volunteered test surfaces" entry with example UX.

**Confidence: High.** Owner explicitly stated this is "an extremely reasonable thing"; the autonomy frame holds (user choice → grading is permitted); the system-imposed forbidden surfaces remain intact.

---

## Open questions deferred to Gate 4

1. **CO-57 confidence-elicitation interaction pattern (Gate 4 v2).** No `assumptionEngine` precedent for pre-decision confidence elicitation. Gate 4 v2 designs the surface; Gate 5 implements.
2. **Per-stat HERO_LEAK_PRIORS tuning.** Initial values authored above; Gate 4 surface walk may surface stats needing different prior.
3. **Composite-signal weights (W_leak / W_drill / W_test / W_recent).** Initial values 0.5 / 0.3 / 0.15 / 0.05; Gate 4 walks owner through weight-sensitivity scenarios.
4. **SelfCoachView surface placement & nav (per Gate 2 SCF-G4-S1 carry-forward).**
5. **Inline leak annotation visual treatment in HandReplayView (per Gate 2 SCF-G4-S2 carry-forward).**
6. **Settings tier-set radio + N05 confirm-on-tier-downgrade (per Gate 2 SCF-G4-TIER carry-forward).**
7. **Drill scheduler tier-aware weighting integration (per Gate 2 SCF-G4-SCH carry-forward).**

---

## Appendix A — Per-Tier Teachable-Concept Map Walkthrough

**Format:** For each tier, walk one concrete play-review scenario and ask: "Given this player's current mastery state, which concepts should be next?" Owner amends inline in delta table at end of appendix.

### Tier 1 — novice

**Scenario:** Player just learned hand rankings; sitting in BTN with K9o; villain UTG opens 3bb; player calls ("I have a king").

**Gate 1 draft says next concepts:** Pot odds, basic open ranges, fold equity.

**Walkthrough verdict:** Map cell holds. Pot odds is the dominant teachable signal here (call with K9o is a pot-odds question). Fold equity is secondary (relevant when the player might raise; novice likely calls or folds).

### Tier 2 — live-rec

**Scenario:** Player open-raises QJs UTG+1, gets called by BTN, c-bets 60% pot on K72r flop, BTN calls. Player gives up turn.

**Gate 1 draft says next concepts:** Bluff-catcher framing, fold equity math, basic 3-bet decisions.

**Walkthrough verdict:** Map cell mostly holds. The cbet→give-up pattern surfaces value-bet-vs-bluff frame as missing — could amend to add "value vs bluff threshold (>50% equity rule)" as a 4th candidate. Owner amends per preference.

### Tier 3 — studied-amateur

**Scenario:** Player 3-bets AKs from BB vs CO open; CO calls. Flop comes A92r. Player overbets pot (110%); CO calls. Turn brick. Player checks; CO bets pot. Player snap-calls.

**Gate 1 draft says next concepts:** Range-vs-range thinking, polarization vs linear, board-texture.

**Walkthrough verdict:** Map cell holds. The overbet → snap-call pattern surfaces range-protection-on-turn as the dominant gap (player should have continued betting turn for range protection). Polarization vs linear is the framework that names this. Board-texture is adjacent (A92r is dry; range-advantage matters).

### Tier 4 — part-time-grinder

**Scenario:** Player flat-calls AA in CO vs UTG open; flop comes T87dd; villain c-bets pot. Player raises to 3x.

**Gate 1 draft says next concepts:** Exploitative deviations, blocker effects, multi-street planning.

**Walkthrough verdict:** Map cell holds. The flat-AA-then-raise-flop pattern surfaces multi-street planning as dominant (the line is internally inconsistent — flat preflop signals trap, raise flop signals not-trap). Exploitative deviations is upstream (deciding flat over 3bet preflop).

### Tier 5 — serious-grinder

**Scenario:** Player on BTN with mid-stack 60bb in MTT; CO opens 2.2bb; player 3-bets 5.5bb with A5s. SB cold-4-bets 14bb. CO folds. Player calls.

**Gate 1 draft says next concepts:** Game-theoretic balancing, ICM, capped-vs-uncapped range theory.

**Walkthrough verdict:** Map cell holds. The cold-4-bet-call pattern with A5s at 60bb is ICM-loaded (calling 8.5bb to win 22bb when blocking value combos and getting good price; ICM-aware would size differently). Capped-vs-uncapped is adjacent (SB's cold-4-bet range is uncapped).

### Tier 6 — pro

**Scenario:** Player at $5/$10 cash; 200bb deep; villain LAG flat-calls UTG raise 3x with hand range that includes suited connectors; flop comes 654ss. Player has KK.

**Gate 1 draft says next concepts:** Leveraging meta-game, mental-game refinements, study-discipline optimization.

**Walkthrough verdict:** Pro-tier scenario tests less concrete-concept-application and more meta-game (the spot is a study-position; concrete play is well-trodden). Map cell holds at the meta-game level. Could amend to add "GTO solver-baseline review" as a teachable for the study-discipline axis.

### Delta table (owner amendments captured here)

| Tier | Cell amendment | Reason |
|------|---------------|--------|
| 2 — live-rec | (suggested addition: "value vs bluff threshold (>50% equity rule)") | Surfaces value-vs-bluff frame from c-bet→give-up scenario |
| 6 — pro | (suggested addition: "GTO solver-baseline review") | Study-discipline axis needs concrete artifact |
| (other tiers — no amendment proposed; map holds) | — | — |

**Owner amends additional cells during ratification review; this delta table captures the canonical amendments.**

---

## Change log

- 2026-05-02 — Created. Gate 3 Research for Self-Coach Foundation per Master Plan §D Phase-3 entry. 5 SCF-G3-* carry-forwards from Gate 2 specified (DETECTOR / TIERMAP / SPINE / CO / SCHEMA). 4 owner-decided + 2 inline-handled decision flags ratified. **Critical AP-SCF-01 nuance** — system-imposed grading refused; owner-volunteered tests permitted (opt-in gate is the load-bearing autonomy contract). Companion docs updated: `coaching.md` (CO-54/55/56 Active; CO-56 wording amendment; CO-57 stays Proposed deferred to Gate 4 v2), `copy-discipline.md` (CD-2 nuance for owner-volunteered tests), `anti-patterns.md` (AP-SCF-01 re-statement). Gate 4 unblocked. Next natural anchor in Master Plan A/D alternation: WS-006 (PIO-G3 Research, A-line).
