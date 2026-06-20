# skillAssessment/ — Domain Rules

**MANDATORY**: Before editing or adding ANY file in this directory, read:
1. `docs/projects/self-coach-foundation/anti-patterns.md` (AP-SCF-04 sample-size floor)
2. `docs/projects/self-coach-foundation/copy-discipline.md` (CD-5 4-field claim discipline)
3. `docs/design/audits/2026-05-02-gate4-design-self-coach-foundation.md` (architecture spec)
4. `docs/projects/self-coach-foundation/leak-catalog.md` (the queue of leak types)

This module is the SCF (Self-Coach Foundation) skill-assessment framework. It detects hero-side leaks across the user's own hand history and surfaces them in HandReplay review (per SCF Gate 4 spec) without grading or shame.

## Module map

| File | Purpose |
|------|---------|
| `heroDecisionAccumulator.js` | Generic hero-side situation-key bucketer. Mirrors `exploitEngine/decisionAccumulator.js` but groups HERO actions instead of villain. Rule-agnostic. |
| `deriveSituationKey.js` | Pure helper that turns `{hand, actionEntry, heroSeat, buttonSeat}` into the 8-axis situation key string. Shared by accumulator + tests. Format: `street:texture:posCategory:isAgg:isIP:facingAction:contextAction:preflopAggressor`. The 8th axis (`pfa`/`pfc`/`na`) was added in WS-146 SPR-040 to distinguish hero's preflop role on postflop streets. |
| `heroLeakDetector.js` | Registry-pattern detector. Auto-loads all rules from `leakRules/` via `import.meta.glob`. Iterates rules against accumulator buckets, returns fired leaks. |
| `heroLeakDetectionPipeline.js` | Async orchestrator: loads hands → accumulates → detects → persists via `replacePlayerLeaks()`. |
| `solverBaselines.js` | Extensible lookup table from situation key → solver baseline rate. v1 hardcoded; future rules add entries. |
| `leakRules/` | One file per leak rule. Each exports a standard interface (see `_template.js`). Auto-registered. |
| `leakRules/_template.js` | Authoring template for new rules. Copy + edit when shipping a catalog entry. |
| `lessonRegistry.js` | Lesson loader. `import.meta.glob` of `docs/projects/self-coach-foundation/lessons/*.md`. `getLesson(conceptId)` returns `{meta, sections, path}`. Per WS-148 / SPR-033: lesson filenames are `{conceptId}.md` (no numeric prefix). |
| `tierConceptMap.js` | Concept registry: every concept ID with its `kind` + `tier` + `parent` + `children`. Source of truth for the 3-kind concept architecture. Per WS-148 / SPR-033. |
| `conceptMastery.js` | `computeConceptMastery(userId, conceptId)` — per-concept mastery state computation routed by concept-kind. Reads heroLeaks store + drill scheduler + perDomainMastery test results. Per WS-148. |
| `composite.js` | `computeComposites` + `pickNextTeachableConcept`. SCF G4 §SPINE composite-signal formula with user-configurable weights + toggles. Per WS-148. |
| `learningStateDescriber.js` | `describeLearningState(masteries, options)` → user-facing descriptor with transparent composition (CD-5). Forbidden-rank-label lint enforced. Per WS-148. |

## Core principles

### 1. Registry pattern; rules are content, not code

New leak rules add a single file to `leakRules/`. Detector code does NOT change. This separates the "framework" (built once) from the "content" (added forever). Mirrors the templates pattern from WS-138 (HSP narrative templates).

### 2. n≥30 sample-size floor (AP-SCF-04)

**Below n=30 hands on the situation key, NO leak fires.** Binomial 95% MoE at p=0.5 is ±18% at n=30, ±25% at n=15. Below the floor, credible interval is too wide to claim meaningfully. Rules MUST enforce this in their `detect()` function (the framework also enforces at the detector level as defense-in-depth).

### 3. CD-5 4-field claim discipline

Every leak that fires MUST carry these 4 fields for downstream surfaces to render:
1. **Situation key** (e.g., "Hero IP cbet defense")
2. **Sample size** + observed rate + credible interval (e.g., "52% [38%, 66%] over 30 hands")
3. **Solver baseline** (e.g., "38%")
4. **Threshold floor** (e.g., "30 hands")

Surfaces (HeroCoachingCard, SelfCoachView) display all 4 in the expanded card body — not in tooltips, not in collapsed badges. CD-5 is the verifiability contract.

### 4. Hero-leak claim text is NEVER graded

Per `chris-live-player.md` autonomy red line #5 (no shame / engagement-pressure) + CD-3 (no engagement copy):

- ✅ "fold-to-cbet rate 52% over 30 hands; solver baseline 38%" (factual, neutral)
- ❌ "you're folding too much" (graded)
- ❌ "you've ignored this leak for X days" (engagement-pressure)
- ❌ "you missed +1.2bb" (score)
- ❌ "level up your cbet defense" (engagement-pressure)

Surfaces lint-test this. The framework provides factual fields; surfaces compose neutral copy from them.

### 5. Source-util-policy whitelist (no live-surface contamination)

Per `chris-live-player.md` autonomy red line #8 + SCF Gate 4 §SCF-G4-SUP:

**Read-allowed surfaces:** `HandReplayView` (review-mode only), `SelfCoachView` (all tabs), `HomebaseView` (study-queue **count only** — see scope note).

`HomebaseView` scope (added 2026-06-20, plan shimmying-moseying-lantern, founder-approved): the Homebase dashboard's "Study queue" card reads `useSelfCoachMastery` solely to display a COUNT of concepts needing work (`composites.filter(c => c.compositeScore > 0).length`) and deep-link into `SelfCoachView`. It MUST NOT render per-concept mastery, leak detail, grades, or tier labels — that is `SelfCoachView`'s job. Homebase is the app-entry/review hub, not a live-play surface, so a study-orientation count is consistent with red line #8 (no LIVE-surface contamination); the count-only ceiling keeps it from becoming a second mastery surface.

**BLACKLISTED surfaces:** `OnlineView`, sidebar HUD, `TableView`, `TournamentView`, `ShowdownView`. These MUST NOT import from `skillAssessment/` or read from `heroLeaks` IDB store.

CI-grep enforcement is a future ticket. Until then, code review enforces. Adding any new consumer requires updating this whitelist + the SCF Gate 4 audit.

## Anti-patterns (things to avoid)

### DO NOT bypass the n≥30 floor

Even for testing or "preview" surfaces. Below 30 the claim is statistically meaningless and surfacing it normalizes acting on weak signal.

### DO NOT add point-estimate-only displays

Always render rate + credible interval together. Surfaces relying only on point estimate violate `hero-ignoring-credible-interval` leak (this catalog entry is itself catalogued — meta).

### DO NOT compute solver baselines on-the-fly per render

Hardcoded lookup is fast + deterministic. Computed baselines (gameTreeEvaluator integration) are deferred to a future sprint with measured perf justification. v1 keeps the path simple.

### DO NOT use leak rule IDs as decision inputs to other rules

Rules MUST be independent. A rule's `detect()` reads from the accumulator bucket + solver baseline; it does NOT read from other rules' fired-state. Otherwise rule ordering creates spaghetti.

### DO NOT extend leak rules to live surfaces without explicit founder + audit approval

Red line #8 is non-negotiable. If a future use case needs live-surface integration, it requires a new audit + design framework gate, not a code change.

## Concept-kind architecture (WS-148 / SPR-033)

Three concept kinds live in `tierConceptMap.js`:

| Kind | When to use | Mastery source |
|------|-------------|----------------|
| `general-skill` | Coarse foundational concept teaching a transferable skill across many situation keys. Drill-backed. Don't split per the granularity floor. | drill scheduler `frameworkAccuracy` + perDomainMastery test results |
| `rule-anchored-umbrella` | One per leak rule (or rule cluster). The rule's `relatedConceptId` binds here. The lesson body lists sub-concepts. | aggregated from children + parent-rule fire-state |
| `rule-anchored-specific` | Leaf concept; one per baseline-distinct situation-key region (granularity floor). Has umbrella `parent`. | heroLeaks store entry for the matching situation key (resolved via `tierConceptMap.SITUATION_KEY_TO_CONCEPT`) |

The granularity floor (per `feedback_scf_high_granularity.md`) binds **only rule-anchored concepts**. General-skill concepts stay coarse — splitting them would fragment foundational teaching.

When adding a new leak rule (see checklist below) that fires across multiple baseline-distinct situation keys: register an umbrella + N specific children in `tierConceptMap.js`. Add the situation-key → specific-concept entries to `SITUATION_KEY_TO_CONCEPT`. The rule's `relatedConceptId` always points at the umbrella.

## Adding a new leak rule

1. Look up the next entry in `docs/projects/self-coach-foundation/leak-catalog.md` by coverage gap + complexity tier (Simple > Medium > Complex).
2. Decide concept-kind layout:
   - **Single situation key** → register one `rule-anchored-umbrella` concept in `tierConceptMap.js` (no sub-concepts yet — split later when rule splits).
   - **Multiple baseline-distinct keys** → register one umbrella + N `rule-anchored-specific` children. Add entries to `SITUATION_KEY_TO_CONCEPT` mapping each key → its specific child.
3. Copy `leakRules/_template.js` to `leakRules/<rule-id>.js`.
4. Define `id`, `label`, `matchesBucket`, `detect`, `solverBaselineKey`, `relatedConceptId` (= umbrella ID), `threshold`.
5. Add solver baseline entries to `solverBaselines.js`.
6. Author the umbrella lesson at `docs/projects/self-coach-foundation/lessons/<umbrella-conceptId>.md` (filename = `{conceptId}.md`, no numeric prefix). Body enumerates sub-concepts.
7. Sub-concept lessons land later (WS-149 ongoing); registering the IDs in `tierConceptMap` is sufficient to establish the granularity floor.
8. Author tests at `__tests__/<rule-id>.test.js` (rule signature compliance + boundary cases + n≥30 enforcement). The `migration.test.js` cross-reference test catches drift between rules + registry + lessons.
9. Update catalog entry: status `PLANNED` → `SHIPPED`, add `ship_sprint`. Note the bound umbrella conceptId in the `Related concept` field.
10. Run `npx vitest run src/utils/skillAssessment/`.
