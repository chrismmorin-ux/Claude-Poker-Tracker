# Surface — Skill-Assessment Test (opt-in-test mode of drill engine)

**ID:** `skill-assessment-test`
**Code paths:** delegates entirely to existing drill surfaces — see `postflop-drills.md` and `preflop-drills.md`.

**Route / entry points:**
- Per-concept `Test myself on this concept` button on lesson card (in SelfCoachView Curriculum section).
- Browse path: SelfCoachView Tests history & browse section → `Browse all concept quizzes` → per-concept `Take quiz` / `Retake` button.

**Last reviewed:** 2026-05-02 (created at SCF Gate 4)

---

## Purpose

Opt-in-test mode of the existing drill engine. NOT a new prediction engine. Per the owner's architectural binding (Gate 4 §Architectural overlap):

> "It might make sense to make drills and tests overlap quite a bit. I don't want to maintain two types of 'predict the correct answer in a learning environment'."

This surface doc is THIN. It cross-references `postflop-drills.md` / `preflop-drills.md` for the drill UX itself, and names only the 3 deltas that distinguish opt-in-test mode from the default scheduler-driven drill flow.

## JTBD served

Primary:
- **CO-55** *learn-next-concept-im-ready-for* — explicit owner-volunteered tests are one of the 4 spine signals (W_test) feeding curriculum-spine ranking.

Secondary:
- **CO-54** *see-leak-without-being-graded* — opt-in-test results are owner-volunteered, satisfying AP-SCF-01 nuance scope (PERMITTED on opt-in test surfaces; the load-bearing autonomy contract).
- **CO-56** *validate-im-improving* — test-history-over-time signal contributes to CO-56's "did my play change?" referent.

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) in self-coach mode.
- [study-block](../personas/situational/study-block.md) — generous-budget dedicated study time.

NOT served: `between-hands-chris`, `mid-hand-chris` (drill surfaces are review-mode aligned; opt-in-test mode does not change that).

---

## Three deltas vs default drill flow

| Delta | Default drill | Opt-in-test mode |
|---|---|---|
| **Entry path** | Scheduler-driven (`pickNextMatchup`) or library browse from `PreflopDrillsView` / `PostflopDrillsView` | Per-concept `Test myself on this concept` button on lesson card (in SelfCoachView Curriculum section); browse via SelfCoachView Tests history `Browse all concept quizzes` |
| **Result framing** | CD-2 default — observed/non-graded vocabulary | CD-2 nuance permitted — factual grading vocabulary ("3 of 5 correct") via `cd5_exempt: 'owner-volunteered-test'` manifest flag on the result-display surface |
| **Persistence tag** | `scheduler.frameworkAccuracy[id]` (behavioral signal) | ALSO writes `userSettings.perDomainMastery[conceptId].testResults[]` (subset signal); does NOT overwrite default drill behavioral tracking |

Same engine. Same drill UX. Same test infrastructure (Vitest fake-IDB, scenario library, framework registry). The `src/utils/skillAssessment/` module aggregates from both signal sources (see `docs/projects/self-coach-foundation/skill-assessment-module.md`).

## Anatomy

```
Lesson card:
  Lesson: Cbet defense fundamentals
  Drilled: not yet — Last opened: —
  [ Open lesson ]   [ Test myself on this ]
                        │
                        ▼ tap
  ┌──────────────────────────────────────────┐
  │ Concept quiz: cbet defense                │
  │ Question 3 of 5: …                        │
  │ (delegates to drill UX — same component   │
  │  tree as PostflopDrillsView, just         │
  │  scoped to lesson.frameworkIds[])         │
  │                                            │
  │ ─────────────────────────────────────     │
  │ Result: 4 of 5 correct                    │
  │ (cd5_exempt: 'owner-volunteered-test'     │
  │  manifest flag; factual grading           │
  │  vocabulary permitted on this surface)    │
  │                                            │
  │ [ Close ]   [ Take again ]                │
  └──────────────────────────────────────────┘
```

**Result-display surface (the only NEW UI element introduced for opt-in-test mode):**

- Renders only after the 5-question quiz completes.
- Shows factual count: "{N} of {M} correct".
- Optional: per-question correct/incorrect breakdown ("You answered: A. Correct answer: B." for each question — permitted under cd5_exempt 'owner-volunteered-test' manifest).
- 2 affordances: `Close` (returns to lesson card) and `Take again` (relaunches drill engine in opt-in-test mode for same concept).

## State

- **Drill engine state:** owned by drill surfaces (`postflop-drills.md` / `preflop-drills.md`); not duplicated here.
- **Opt-in-test mode flag:** local UI state (`drillMode: 'default' | 'opt-in-test'`); set on entry from `Test myself` button; cleared on `Close`.
- **`testConceptId`:** lesson conceptId at entry; threaded through to result-write step.
- **`testFrameworkIds[]`:** lesson `frameworkIds[]` at entry; passed to drill engine to scope matchup picking.
- **IDB writes** (on quiz completion):
  - `userSettings.perDomainMastery[conceptId].testResults[]` — append `{ takenAt, score: { correct: N, total: M }, conceptVersion: lesson.versionLineage.version }`
  - `scheduler.frameworkAccuracy[frameworkId]` — same write as default drill (behavioral signal contribution); aggregation includes opt-in-test attempts per the W_drill rule (Gate 4 §Architectural overlap).

## Props / context contract

`Test myself` button on lesson card invokes:
```
onLaunchTest(conceptId, frameworkIds): void
```
SelfCoachView mediator wires this to:
1. Set `drillMode: 'opt-in-test'`, `testConceptId`, `testFrameworkIds[]` in skillAssessment context.
2. Navigate to `SCREEN.PREFLOP_DRILLS` or `SCREEN.POSTFLOP_DRILLS` based on framework's parent module.
3. Drill view reads `drillMode` flag → renders result-display surface with `cd5_exempt` manifest on completion → writes `testResults[]` after.

## Key interactions

1. **Entry from lesson card `Test myself`** — sets test mode + scope, routes to drill view.
2. **Drill execution** — same UX as default drill; owner answers 5 questions.
3. **Quiz completion → result-display surface** — factual count rendered with cd5_exempt manifest.
4. **`Take again`** — relaunches drill engine in opt-in-test mode for same concept.
5. **`Close`** — clears test mode state, navigates back to SelfCoachView Curriculum section (or to wherever the entry came from — Tests history browse path returns to history).

## `cd5_exempt: 'owner-volunteered-test'` manifest flag

Result-display surface declares this manifest flag. CI-lint allows the grading-vocabulary subset on this surface only:
- Permitted: "{N} of {M} correct" / "Correct answer: B" / per-question breakdown
- Forbidden everywhere (no exemption): "your score" / "your accuracy" / "did you get the right answer" / "test mastery" / streak framing

The flag is per-surface-instance. It does NOT propagate to upstream lesson card or SelfCoachView Tests history list. Gate 5 implementation enforces via `cd5_exempt` field on surface manifest object passed to the CI-lint runner.

## Anti-pattern compliance

| AP | Verdict |
|---|---|
| AP-SCF-01 nuance | Compliant. Test launches ONLY from explicit `Test myself` button tap; cannot auto-launch. Result-display surface uses cd5_exempt manifest flag for grading vocabulary; system-imposed surfaces (lesson card body, Tests history list) do NOT carry the exemption. |
| AP-SCF-04 (n=30 floor) | N/A. Floor applies to leak claim text rendering, not test invocation. Tests can be taken at any sample size. |
| AP-SCF-05 (mastery score) | Compliant. `testResults[]` is a flat array of factual quiz outcomes; no scalar "mastery %" rendered on this surface or upstream. Curriculum-spine W_test signal uses Beta-Binomial CI on the array shape, NOT a scalar score. |
| AP-SCF-06 (streak / engagement-pressure) | Compliant. No test streaks, no "you haven't tested in N days" pressure. Owner cadence = passive last-test timestamp on Tests history section only. |

## Copy-discipline compliance

- **CD-1 (factual, not imperative)** — `Test myself on this concept` is owner-initiated invitation, not imperative. `Take again` / `Close` are buttons, not commands.
- **CD-2 nuance** — result-display surface uses cd5_exempt manifest; permitted vocabulary subset enumerated above.
- **CD-3 (no engagement copy)** — no "great job!", no "you crushed it", no "keep going!" framing.

---

## Coverage in v1 (drill-backed concepts)

Per Gate 4 §SCF-G4-COVERAGE, 5 concepts have `test_substrate: 'drill'` and a working `Test myself` affordance:

| Concept (lesson) | Drill substrate | Test surface flow |
|---|---|---|
| pot-odds | `drillContent` framework: decomposition | Test myself → drill scheduler picks pot-odds matchups → 5 questions → result modal → write testResults[] |
| range-vs-range-thinking | `postflopDrillContent` framework: range_decomposition | Test myself → postflop scheduler picks range-decomposition scenarios → 5 questions → result modal → write testResults[] |
| board-texture | `postflopDrillContent` frameworks: board_tilt + capped_range_check | Test myself → postflop scheduler spans both frameworks → 5 questions → result modal → write testResults[] |
| blocker-effects-preflop | `drillContent` frameworks: straight_coverage + flush_contention + broadway_vs_connector | Test myself → preflop scheduler spans 3 frameworks → 5 questions → result modal → write testResults[] |
| capped-vs-uncapped-ranges | `postflopDrillContent` framework: capped_range_check | Test myself → postflop scheduler picks capped-ranges scenarios → 5 questions → result modal → write testResults[] |

## Coverage gap (pending concepts)

14 concepts have `test_substrate: 'pending'`. The `Test myself on this concept` button is rendered DISABLED on their lesson cards. Tap surfaces factual placeholder copy: "Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5."

Gap concepts span Tiers 1-6: open-ranges, fold-equity (Tier 1); fold-equity-math, basic-3bet (Tier 2); polarization-vs-linear (Tier 3); exploitative-deviations, multi-street-planning (Tier 4); GTO-balancing, ICM (Tier 5); meta-game, mental-game, study-discipline, GTO-baseline-review (Tier 6).

The right test substrate for these concepts is research deferred to Gate 4 v2 / Gate 5 (Gate 4 audit doc Open question §2). Three plausible answers per gap: (a) author new drill content extending the existing engine; (b) author non-drill test shape (multi-step decision tree, prose response, scenario walkthrough); (c) the concept is not amenable to a structured test at the user's tier (Tier 6 meta-game / mental-game / study-discipline) and the lesson is read-only with no test affordance ever.

---

## Known behavior notes

- **Drill scheduler scoping** — opt-in-test mode does not invoke `pickNextMatchup` directly; instead, it filters the matchup library to only matchups whose `primary` (preflop) or `frameworkId` (postflop) is in `testFrameworkIds[]`. Within that filtered subset, picks 5 (with recency penalty so retakes don't repeat the previous attempt's questions).
- **No interrupting the test** — once entered, the drill view in opt-in-test mode does not show its default scheduler-driven progression chrome (no "next matchup" button between questions). 5-question quiz runs straight through to result modal.
- **Test substrate flag check on entry** — the SelfCoachView mediator MUST verify `lesson.test_substrate === 'drill'` before invoking `onLaunchTest`. If the lesson schema is somehow corrupted (test_substrate: drill but frameworkIds[] empty), the mediator surfaces an error toast, not a launch.

## Known issues

(None — surface is spec'd at SCF Gate 4; first audit findings will land at Gate 5 implementation review.)

## Potentially missing

- **Per-test incognito mode** — owner red line #9 binding for capture surfaces (capture writes to anchor IDB). SCF tests are CONSUMPTION surfaces (write to perDomainMastery.testResults[]), not capture. Whether opt-in tests should have a per-test incognito toggle (don't write result; just show factual outcome ephemerally) is Phase 2+ research. v1 always writes result to persistence.
- **Test result detail review** — v1 result-display surface shows factual count only (and per-question correct/incorrect breakdown if owner taps). v2 may add "review my answers vs solver baselines" expansion. Not in v1 to keep the surface minimal.

---

## Test coverage

- Drill engine tests at Gate 5: `drillContent/__tests__/scheduler.test.js` already exists; opt-in-test mode adds new test cases verifying frameworkIds filter scope + recency penalty inheritance.
- New at Gate 5: `skillAssessment/__tests__/conceptMastery.test.js` verifies `testResults[]` aggregation produces correct W_test signal.
- New at Gate 5: `__tests__/optInTestMode.test.jsx` integration — entry from lesson card → drill view → quiz → result modal → testResults[] persistence.
- Manifest CI-lint at Gate 5: confirmed `cd5_exempt: 'owner-volunteered-test'` is the ONLY non-null cd5_exempt value in any SCF surface manifest. No exemption creep.

## Related surfaces

- `lesson-card` — entry-point parent (`Test myself` button).
- `self-coach-view` — host (Curriculum section + Tests history & browse section).
- `postflop-drills` / `preflop-drills` — substrate (drill engine; gains opt-in-test mode subsection — see those surface docs for the 3-delta extension).
- `skill-assessment-module.md` (project doc) — aggregation layer reads `testResults[]` per `userSettings.perDomainMastery[conceptId]`.

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). THIN surface doc per Decision 3 reconciliation + owner architectural overlap binding. 3 deltas vs default drill flow named explicitly; substrate delegates entirely to existing drill surfaces. Coverage in v1: 5 drill-backed concepts; 14 pending. cd5_exempt manifest flag pattern for result-display surface specified.
