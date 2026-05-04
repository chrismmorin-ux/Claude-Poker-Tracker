# `src/utils/skillAssessment/` — module shape spec

**Created:** 2026-05-02 (SCF Gate 4 / WS-012 / SPR-020)
**Status:** Draft, pending owner ratification at SCF Gate 4 review.
**Implementation:** SCF Gate 5 multi-PR (deferred).

**Sibling docs:**
- [Gate 4 audit — `audits/2026-05-02-gate4-design-self-coach-foundation.md`](../../design/audits/2026-05-02-gate4-design-self-coach-foundation.md) §SCF-G4-MOD
- [`anti-patterns.md`](anti-patterns.md) (AP-SCF-01..06)
- [`copy-discipline.md`](copy-discipline.md) (CD-1..5 + CD-2 nuance)
- Persona — [`personas/core/chris-live-player.md`](../../design/personas/core/chris-live-player.md) §Skill-state attribute (lines 60-79; pre-specified the per-domain mastery shape this module mirrors)

---

## Why this module exists

Self-coach mode (SCF) needs concept-level mastery state to feed the curriculum-spine composite formula and to render the SelfCoachView Curriculum section. That mastery state derives from THREE existing data sources:

1. Drill scheduler behavioral data (`scheduler.frameworkAccuracy`)
2. Opt-in-test results (`userSettings.perDomainMastery[conceptId].testResults[]`)
3. Hero-leak detector output (`heroLeaks` IDB store)

`skillAssessment/` is the thin aggregation layer that produces concept-level mastery state from those three sources. It is **NOT** a parallel prediction engine. It does not pick matchups, render drill UI, score correctness, or own the leak detection pipeline. Those paths live in their existing modules (`drillContent/`, `postflopDrillContent/`, `exploitEngine/heroLeakDetector.js`).

This is the architectural binding from owner clarification 2026-05-02 plan-mode (Gate 4 §Architectural overlap §): "I don't want to maintain two types of 'predict the correct answer in a learning environment'." The module reads from existing engines, aggregates by concept, exposes a stable API to SelfCoachView and the curriculum-spine composite formula. That is its entire scope.

---

## Module structure

```
src/utils/skillAssessment/
  index.js              — public API (re-exports from submodules)
  conceptMastery.js     — produces per-concept mastery state from drill + test data
  composite.js          — implements SCF-G3-SPINE 4-signal composite formula
  CLAUDE.md             — module-level domain rules + anti-patterns + integration contracts
  __tests__/
    conceptMastery.test.js
    composite.test.js
```

---

## Per-concept mastery shape

Mirrors `chris-live-player.md` §Skill-state attribute (lines 60-79). Output of `conceptMastery.computeFor(conceptId)`:

```javascript
{
  conceptId:       'cbet-defense',
  level:           'novice' | 'learning' | 'drilled' | 'fluent',  // discrete band
  confidence:      {                                                 // Bayesian CI on level
    lower: 0.42,
    upper: 0.78,
    mean:  0.61,
    level: 0.95
  },
  lastValidatedAt: 1735776000000,                                    // ms epoch
  trendDirection:  'improving' | 'stable' | 'plateaued' | 'decaying',
  userMuteState:   'none' | 'already-known' | 'not-interested',
  drillStats:      { attempts, accuracy, avgDelta },                 // from scheduler.frameworkAccuracy
  testStats:       { attempts, accuracy },                           // from perDomainMastery.testResults[]
  leakFrequency:   number,                                            // from heroLeaks aggregation (0..1)
}
```

**Field semantics:**

- **`level`** — discrete mastery band, NOT a scalar score (per AP-SCF-05). Threshold logic per stat in `conceptMastery.js`. Default thresholds: `novice` (attempts < 5), `learning` (attempts >= 5 + accuracy < 0.7), `drilled` (attempts >= 5 + accuracy >= 0.7 + accuracy < 0.9), `fluent` (attempts >= 10 + accuracy >= 0.9). Owner-amendable in Gate 5 implementation review.
- **`confidence`** — Bayesian credible interval on the level estimate. Computed via `bayesianConfidence.credibleInterval()` over the combined drill + test attempt count. Wider CI = lower confidence (more attempts needed).
- **`trendDirection`** — derived by comparing recent-attempt accuracy to prior-window accuracy. `improving` (recent > prior + 0.05), `decaying` (recent < prior - 0.05), `stable` (within ±0.05), `plateaued` (no attempts in last 30 days).
- **`userMuteState`** — owner-set in SelfCoachView Curriculum section per-concept context menu (Phase 2+). v1 always `'none'`.
- **`drillStats.attempts/accuracy`** — read from `scheduler.frameworkAccuracy` aggregated across the concept's `frameworkIds[]`.
- **`testStats.attempts/accuracy`** — read from `userSettings.perDomainMastery[conceptId].testResults[]`. `accuracy` = sum(correct) / sum(total) across all test results.
- **`leakFrequency`** — read from `heroLeaks` store aggregated by situation keys mapped to `conceptId` via `lessonCard.leakTagIds[]`. Range [0, 1].

---

## Curriculum-spine composite formula (`composite.js`)

Implements the SCF-G3-SPINE formula authored at Gate 3:

```javascript
nextConcept = argmax(
  W_leak  * leakFrequency[conceptId]
  + W_drill * (1 - drillMastery[conceptId])
  + W_test  * (1 - testResultDelta[conceptId])
  - W_recent * recencyPenalty[conceptId]
)
```

**Weight constants (v1 baseline per Gate 3):**

```javascript
const W_LEAK   = 0.5;
const W_DRILL  = 0.3;
const W_TEST   = 0.15;
const W_RECENT = 0.05;
```

**Signal sources (rule):**

| Signal | Aggregation | Read source |
|---|---|---|
| `leakFrequency` | Sum of `heroLeaks` `severity` for situation keys in `lessonCard.leakTagIds[]`, normalized to [0,1] | `heroLeaks` IDB store |
| `drillMastery` | Beta-Binomial mean of drill behavioral accuracy aggregated across `frameworkIds[]` (ALL attempts: scheduler-driven + opt-in-test) | `scheduler.frameworkAccuracy` |
| `testResultDelta` | Beta-Binomial mean of opt-in-test accuracy ONLY (subset of drill attempts) | `userSettings.perDomainMastery[conceptId].testResults[]` |
| `recencyPenalty` | Exponential decay; recent activity (drilled or tested in last 7 days) penalizes 0.5; older activity decays toward 0 | `userSettings.perDomainMastery[conceptId].lastDrilledAt` |

**W_drill vs W_test aggregation rule (v1).** Per Gate 4 §Architectural overlap binding:
- `W_drill` aggregates ALL drill attempts (scheduler-driven AND opt-in-test).
- `W_test` aggregates ONLY opt-in-test attempts (subset).

Slight intentional double-count: opt-in-test attempts contribute to both signals. Rationale: explicit opt-in-test signals owner-stated readiness in addition to behavioral correctness; modest extra weight is intentional. Gate 5 may revisit if signal interaction surfaces issues.

---

## Read paths

| Source | Read access | Use |
|---|---|---|
| `scheduler.frameworkAccuracy[frameworkId]` | Read-only | Drill behavioral data (`drillStats` + W_drill signal) |
| `userSettings.perDomainMastery[conceptId].testResults[]` | Read-only | Opt-in-test results (`testStats` + W_test signal) |
| `userSettings.perDomainMastery[conceptId].lastDrilledAt` | Read-only | Recency penalty signal |
| `heroLeaks` IDB store | Read-only | Leak frequency signal (`leakFrequency` + W_leak signal) |
| `userSettings.tier.current` | Read-only | Filters concept list to current tier × per-domain mastery |
| `lessonCard.leakTagIds[]` | Read-only (via lesson-card content loader) | Maps situation keys to conceptIds for W_leak aggregation |
| `lessonCard.frameworkIds[]` | Read-only | Maps `frameworkAccuracy` slice to conceptId for W_drill aggregation |

## Write paths

| Destination | Write rule | Owner |
|---|---|---|
| `userSettings.perDomainMastery[conceptId].testResults[]` | Append on each opt-in-test completion | This module |
| `userSettings.perDomainMastery[conceptId].masteryState` | Derived; written on each `conceptMastery.computeFor(conceptId)` call | This module |
| `userSettings.perDomainMastery[conceptId].lastDrilledAt` | Updated on each drill completion (scheduler-driven OR opt-in-test) | Drill engine writes; this module reads |
| `userSettings.tier.current` | NEVER written by this module | SelfCoachView Settings tab (owner-set) |
| `heroLeaks` store | NEVER written by this module | `heroLeakDetector.js` (Phase 5) |
| `scheduler.frameworkAccuracy` | NEVER written by this module | Drill engine (existing) |

---

## Integration contracts

| Module | Read/Write | Interaction |
|---|---|---|
| `drillContent/scheduler.js` | Read | `frameworkAccuracy` map; this module aggregates by concept's `frameworkIds[]`. |
| `postflopDrillContent/scheduler.js` (analog) | Read | Same pattern; postflop drill engine has parallel `frameworkAccuracy` shape. |
| `exploitEngine/heroLeakDetector.js` | Parallel reference, NOT direct dependency | This module mirrors villain-side rule structure; does not import from villain side. |
| `exploitEngine/decisionAccumulator.js` | Parallel reference | Hero-side analog `heroDecisionAccumulator.js` (NEW Gate 5) mirrors 7-dim bucketing. |
| `bayesianConfidence.js` | Read | `credibleInterval()` for confidence CI; HERO_LEAK_PRIORS authored alongside STAT_PRIORS. |
| `database.js` (IDB) | Read+Write | `heroLeaks` store (read); `userSettings.perDomainMastery` (read+write). |
| `lesson-card` content loader | Read | Lesson card YAML front-matter (`leakTagIds`, `frameworkIds`, `tier`, `test_substrate`). |

---

## What this module is NOT

- **NOT a parallel drill engine.** Does not pick matchups, does not render drill UI, does not score correctness. Drill engine owns those paths.
- **NOT a test executor.** Opt-in-test mode is implemented as a flag passed into the existing drill engine (Gate 5 implementation detail in `PostflopDrillsView` / `PreflopDrillsView`). This module just reads the resulting `testResults[]` for aggregation.
- **NOT a leak detector.** The hero-leak detector is `exploitEngine/heroLeakDetector.js` (NEW Gate 5; mirrors `weaknessDetector.js`); this module READS from the resulting `heroLeaks` IDB store for the W_leak signal.
- **NOT a tier inference engine.** Per AP-SCF-03, tier is owner-set only in v1. This module computes inferred-tier suggestions in Phase 2+ but NEVER writes to `userSettings.tier.current`.

---

## Anti-pattern bindings

| AP | Binding for this module |
|---|---|
| AP-08 (signal fusion) | Module MUST NOT arithmetically fuse owner-declared tier metadata + per-domain mastery + leak frequency into a single "skill score." Each remains a separate input to `composite.js`. SelfCoachView Curriculum section presents per-concept mastery state independently. |
| AP-SCF-03 (silent inference) | Module computes inferred-tier suggestion (Phase 2+; not in v1) but NEVER writes to `userSettings.tier.current`. v1 has no inference; tier is owner-set only. |
| AP-SCF-05 (mastery score) | `level` is a discrete band, not a scalar score. `confidence` is a CI on the level estimate, not "X% mastered." Surface presentation NEVER aggregates `level` across concepts into a global metric. |

---

## Test coverage targets (Gate 5)

- **`composite.js`** — ~95% coverage; 4-signal formula edge cases (zero leak frequency, zero drill attempts, only test attempts, tier-not-set) all asserted.
- **`conceptMastery.js`** — ~85% coverage; threshold logic + trend direction + per-concept aggregation paths covered.
- **Integration test** — feeding synthetic drill + test + leak data through aggregation produces expected SelfCoachView Curriculum ordering.

---

## CLAUDE.md (module-level rules — to be authored at Gate 5 implementation)

When implementing the module at Gate 5, author `src/utils/skillAssessment/CLAUDE.md` with:

- Module purpose (one paragraph; aggregation NOT engine)
- Anti-patterns specific to this module (no signal fusion; no tier inference write; no mastery score surfacing)
- Integration contract (what it reads from where; what it writes to where)
- Pure-module rule (no imports from UI / state / context layers; testable in isolation with fake-IDB)
- Test pattern (synthetic drill + test + leak fixtures → expected mastery + composite output)

Mirrors `exploitEngine/CLAUDE.md` + `rangeEngine/CLAUDE.md` style.

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). Module shape spec'd as thin aggregation layer over existing drill engine + heroLeaks store; mirrors `chris-live-player.md` §Skill-state attribute. NOT a parallel prediction engine. W_drill vs W_test aggregation rule v1 baseline locked. Anti-pattern bindings (AP-08, AP-SCF-03, AP-SCF-05) explicit. Implementation deferred to SCF Gate 5.
