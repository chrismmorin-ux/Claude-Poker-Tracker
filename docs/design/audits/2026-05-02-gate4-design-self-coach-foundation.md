# Gate 4 Design — Self-Coach Foundation (SCF)

**Gate:** 4 (Design surfaces)
**Date:** 2026-05-02
**References:**
- [Gate 1 Entry — `audits/2026-05-02-entry-self-coach-foundation.md`](2026-05-02-entry-self-coach-foundation.md)
- [Gate 2 Blind-Spot — `audits/2026-05-02-blindspot-self-coach-foundation.md`](2026-05-02-blindspot-self-coach-foundation.md)
- [Gate 3 Research — `audits/2026-05-02-gate3-research-self-coach-foundation.md`](2026-05-02-gate3-research-self-coach-foundation.md)
- [persona — `personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) §Skill-state attribute, §Autonomy constraint (9 red lines)
- [JTBD domain — `jtbd/domains/coaching.md`](../jtbd/domains/coaching.md) §Self-coach mode (CO-54..57)
- [anti-patterns — `docs/projects/self-coach-foundation/anti-patterns.md`](../../projects/self-coach-foundation/anti-patterns.md) (AP-SCF-01..06 + EAL-inherited AP-01..09)
- [copy-discipline — `docs/projects/self-coach-foundation/copy-discipline.md`](../../projects/self-coach-foundation/copy-discipline.md) (CD-1..5 + CD-2 nuance + CI-lint forbidden-string list)

**Sprint / WS:** SPR-020 / WS-012 (Master Plan §D, D-line first Phase-4 Design gate; A-line PIO-G4 follows in next sprint per A/D alternation).

**Status:** Draft, pending owner ratification.

This document binds the 5 SCF-G3-* carry-forwards (DETECTOR / TIERMAP / SPINE / CO / SCHEMA) into surface-spec form. Gate 5 multi-PR implementation is unblocked when this document is ratified. Two binding architectural constraints from owner clarification (2026-05-02 plan-mode, transcribed below in §Architectural overlap) shape every decision in this gate.

---

## Decisions ratified (executive summary)

Owner-decided in /next plan-mode AskUserQuestion 2026-05-02:

| # | Decision flag | Outcome |
|---|---|---|
| 1 | **SelfCoachView IA & landing pane** | **2-tab: Study / Settings.** Study tab is a sectioned scroll with 3 sections (Hero leaks / Curriculum / Tests history & browse). Settings tab hosts tier-set radio + N05 confirm + opt-in toggles. |
| 2 | **Inline hero-leak annotation in HandReplayView** | **Inline badge under hero action label, tap expands inline to full CD-5 claim card.** Compact ⚑ glyph + leak-name; lowest visual weight; mirrors the existing action-tag pattern. |
| 3 | **Skill-assessment opt-in test entry placement** | **Per-concept `Test myself` button on lesson card** (proximity entry) **+ dedicated Tests browse/history surface as a section within the Study tab** (NOT a separate top-level tab). Reconciled with Decision 1: the Study-tab Tests section is the browse/history surface. |
| 4 | **CO-57 disposition** | **Stays deferred to Gate 4 v2** per Gate 3 ratification. Gate 4 v1 ships 4 surfaces + skillAssessment module + 5 reference lessons + coverage-audit section. Reason: `assumptionEngine/` has no precedent for pre-decision confidence elicitation; surface affordance is net-new high design-effort. |

Inline-handled (recommended-with-rationale per Gate 4 §SCF-G4-* sections; owner amends in review):

5. **Lesson card schema (SCF-G4-S3):** Required fields per CD-5 + AP-SCF-01..06 constraints. Optional `cd5_exempt` manifest flag for opt-in-test result framing. Critical new field: `test_substrate: 'drill' | 'pending'` (gates the Test myself button per coverage-audit).
6. **Leak distillation pipeline UI (SCF-G4-S5):** Per Gate 3 immediate-firing ratification. Inline badge → tap → expanded CD-5 claim card → dismiss / snooze / drill-now affordances. SelfCoachView Hero leaks section is the aggregated inventory.
7. **Curriculum-spine UI render (SCF-G4-S1, Curriculum section):** 3-signal composite formula already specified by Gate 3 SCF-G3-SPINE. Render = ranked concept list with composite-score visible per concept; "Why this concept?" expand reveals per-signal breakdown.
8. **`src/utils/skillAssessment/` module shape (SCF-G4-MOD):** Thin aggregation layer over the existing drill engine. NOT a parallel prediction substrate. Mirrors `chris-live-player.md` §Skill-state attribute shape.
9. **Settings tier-set + N05 confirm (SCF-G4-SETTINGS):** Owner-set radio in v1 per AP-SCF-03 (silent inference refused). N05 confirm copy on tier-downgrade is factual + non-judgmental.
10. **HERO_LEAK_PRIORS + composite-signal weights:** Lock Gate 3 baseline values as v1; specific values amendable during Gate 5 implementation review against owner's actual hand corpus. v1 baseline: 8 starter priors + W_leak/W_drill/W_test/W_recent = 0.5/0.3/0.15/0.05.

---

## Architectural overlap with existing drill engine (binding)

**Owner clarification (2026-05-02 plan-mode, verbatim transcribed for the record):**

> "It might make sense to make drills and tests overlap quite a bit. I don't want to maintain two types of 'predict the correct answer in a learning environment'."
>
> "[Yes overlap, BUT:] I don't want to make the assumption that the drill[s] are encompassing of everything we would want yet. So evaluation of 'what are the right tests' still needs to be done."

**Architectural binding 1 — drills + tests share substrate.** "Test myself on this concept" is an opt-in-test MODE of the existing drill engine (`src/utils/drillContent/scheduler.js` + `library.js` + `lessons.js` + `frameworks.js` for preflop equity decomposition; `src/utils/postflopDrillContent/` for postflop range-vs-board + multiway). It is NOT a new prediction engine. Three deltas vs default drill flow:

| Delta | Default drill | Opt-in-test mode |
|---|---|---|
| Entry path | Scheduler-driven (`pickNextMatchup`) or library browse | Per-concept `Test myself on this` button on lesson card |
| Result framing | CD-2 default — observed/non-graded vocabulary | CD-2 nuance permitted — factual grading vocabulary ("3 of 5 correct") via `cd5_exempt: 'owner-volunteered-test'` manifest flag |
| Persistence tag | `scheduler.frameworkAccuracy[id]` (behavioral signal) | ALSO writes to `userSettings.perDomainMastery[conceptId].testResults[]` (subset signal); does NOT overwrite default drill behavioral tracking |

Same engine. Same drill UX. Same test infrastructure (Vitest fake-IDB, scenario library, framework registry). The `src/utils/skillAssessment/` module is a thin aggregation layer that READS from `scheduler.frameworkAccuracy` + `perDomainMastery.testResults[]` and produces concept-level mastery state for the curriculum-spine composite-signal. It does NOT replace, fork, or mirror the drill engine.

**W_drill vs W_test aggregation rule (v1).** Per the curriculum-spine composite formula authored in Gate 3 SCF-G3-SPINE:

```
nextConcept = argmax(
  W_leak  * leakFrequency[conceptId]
  + W_drill * (1 - drillMastery[conceptId])
  + W_test  * (1 - testResultDelta[conceptId])
  - W_recent * recencyPenalty[conceptId]
)
```

- **W_drill** aggregates ALL drill attempts for the concept's `frameworkIds[]` (scheduler-driven AND opt-in-test).
- **W_test** aggregates ONLY opt-in-test attempts (subset of the above).

Slight intentional double-count: opt-in-test attempts contribute to both W_drill and W_test signals. Rationale: explicit opt-in-test signals owner-stated readiness in addition to behavioral correctness; modest extra weight is intentional. Gate 5 implementation may revisit if signal interaction surfaces issues — see §Open questions §5.

**Architectural binding 2 — drill coverage may NOT be encompassing.** Existing 7 preflop frameworks + 7 postflop frameworks + 6 multiway frameworks (20 total) and 9 preflop lessons + 6 postflop lessons + 6 multiway lessons (21 total) cover hand-vs-hand equity decomposition + range-vs-board postflop reasoning + multiway adjustment. They do NOT cover all the SCF-G3-TIERMAP concepts. Coverage audit below names the gaps. Concepts without drill backing are flagged `test_substrate: 'pending'` on their lesson cards; the `Test myself on this concept` button is rendered but disabled with factual placeholder copy ("Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5"). The lesson body still ships; only the test affordance is gated.

**What "evaluation of what are the right tests" means as deferred work.** Gate 4 v2 / Gate 5 research deliverable: for each gap concept, determine the right test substrate. Three plausible answers: (a) author new drill content extending the existing engine (e.g., new postflop framework for polarization-vs-linear sizing); (b) author a non-drill test shape (multi-step decision tree, prose response, scenario-walkthrough quiz) — which would require a new substrate; (c) the concept is not amenable to a structured test at the user's tier (meta-game / mental-game / study-discipline at Tier 6) and the lesson is read-only with no test affordance ever. Gate 4 names the gaps but does NOT pre-decide the answer.

---

## SCF-G4-COVERAGE — Drill substrate coverage audit (BLOCKING Gate 5 — names test gates)

**Framing.** For each concept in the SCF-G3-TIERMAP (6 tiers × 1-3 concepts; 19 concepts total including suggested additions), determine whether existing drill content (`src/utils/drillContent/` + `src/utils/postflopDrillContent/`) provides a 1:1 match, a partial-related match, or no substrate at all.

**Method.** Read `drillContent/lessons.js` + `drillContent/frameworks.js` + `postflopDrillContent/lessons.js` + `postflopDrillContent/frameworks.js` + `postflopDrillContent/multiwayFrameworks.js`. For each TIERMAP concept, scan lesson titles + framework IDs + summary text for direct or adjacent topical match. Record verdict.

**Coverage map.**

| Tier | Concept (SCF-G3-TIERMAP) | Drill backing | `test_substrate` | Notes |
|------|---|---|---|---|
| 1 (novice) | Pot odds | `drillContent/lessons.js` #pot-odds (frameworkId: decomposition) | `drill` | Direct 1:1 match. Practical-math category. Gate 4 v1 lesson 001. |
| 1 (novice) | Basic open ranges | NO drill | `pending` | `preflopAdvisor.js` is recommendation engine, not drill-shaped. Gap. |
| 1 (novice) | Fold equity | NO drill | `pending` | No fold-equity drill; equity-decomposition lesson is decomposition not fold equity. Gap. |
| 2 (live-rec) | Bluff-catcher framing | `postflopDrillContent/lessons.js` #range-decomposition (adjacent) | `partial` | range-decomposition shows % air → bluff-catching is derived. Lesson 002 may cite as foundation. |
| 2 (live-rec) | Fold equity math | NO drill | `pending` | Same gap as Tier 1 fold equity. |
| 2 (live-rec) | Basic 3-bet decisions | NO drill (preflopAdvisor is not drill-shaped) | `pending` | preflopAdvisor handles 3bet recommendations; no drill substrate exists. Gap. |
| 2 (live-rec) | Value vs bluff threshold (suggested addition; Gate 3 Appendix A walkthrough verdict) | `drillContent/pot-odds` + `postflopDrillContent/range-decomposition` combo | `partial` | Combined teaches the >50% rule but no single drill. |
| 3 (studied-amateur) | Range-vs-range thinking | `postflopDrillContent/lessons.js` #range-decomposition (frameworkId: range_decomposition) | `drill` | Direct match. Gate 4 v1 lesson 002. |
| 3 (studied-amateur) | Polarization vs linear | NO drill | `pending` | range-morphology lesson is adjacent but not polarization-vs-linear sizing. Gap. |
| 3 (studied-amateur) | Board-texture | `postflopDrillContent/lessons.js` #board-tilt + #capped-ranges | `drill` | Direct match. Gate 4 v1 lesson 003. |
| 4 (part-time-grinder) | Exploitative deviations | NO drill | `pending` | exploitEngine generates deviations but not drill-shaped. Gap. |
| 4 (part-time-grinder) | Blocker effects | `drillContent/lessons.js` #straight-coverage + #flush-contention + #broadway-vs-middling (preflop only) | `partial` | Preflop blockers covered; postflop blockers (e.g., nut-flush blocker bluffs on 3-flush boards) NOT covered. Lesson 004 cites preflop coverage; postflop blocker substrate is gap. |
| 4 (part-time-grinder) | Multi-street planning | NO drill | `pending` | Drill engine is single-decision-point per question; multi-street planning is a deeper shape. Gap (`computeDepth2Plan.js` exists in postflopDrillContent but is engine-internal, not surfaced as a drill question). |
| 5 (serious-grinder) | Game-theoretic balancing | NO drill | `pending` | No GTO-baseline drill content. Gap. |
| 5 (serious-grinder) | ICM | NO drill | `pending` | No ICM content anywhere. Gap. |
| 5 (serious-grinder) | Capped-vs-uncapped range theory | `postflopDrillContent/lessons.js` #capped-ranges (frameworkId: capped_range_check) | `drill` | Direct match. Gate 4 v1 lesson 005. |
| 6 (pro) | Leveraging meta-game | NO drill | `pending` | Meta-game not amenable to current drill shape. Gap. |
| 6 (pro) | Mental-game refinements | NO drill | `pending` | Out of scope for poker-decision drill engine. Gap (per Gate 1 — mental game is explicitly out of scope). |
| 6 (pro) | Study-discipline optimization | NO drill | `pending` | Out of scope. Gap. |
| 6 (pro) | GTO solver-baseline review (suggested addition; Gate 3 Appendix A walkthrough verdict) | NO drill | `pending` | Same gap as Tier 5 GTO. |

**Coverage summary.**
- 5 of 19 concepts (26%) **DRILL-BACKED** — direct 1:1 match in v1.
- 4 of 19 concepts (21%) **PARTIAL** — related drill exists; not a 1:1 match.
- 10 of 19 concepts (53%) **PENDING** — no drill substrate; gap concept.

**Gate 4 v1 reference lesson selection.** The 5 drill-backed concepts (one per) become the v1 reference lessons authored under §SCF-G4-LESSONS:

1. **001-pot-odds.md** — Tier 1, drill backing: `drillContent/pot-odds`
2. **002-range-vs-range-thinking.md** — Tier 3, drill backing: `postflopDrillContent/range-decomposition`
3. **003-board-texture.md** — Tier 3, drill backing: `postflopDrillContent/board-tilt + capped-ranges`
4. **004-blocker-effects-preflop.md** — Tier 4, drill backing: `drillContent/straight-coverage + flush-contention + broadway-vs-middling` (preflop scope only; postflop blocker substrate is gap)
5. **005-capped-vs-uncapped-ranges.md** — Tier 5, drill backing: `postflopDrillContent/capped-ranges`

All 5 ship with `test_substrate: 'drill'` and a working `Test myself on this concept` button (Gate 5 implementation wires the button to the drill engine in opt-in-test mode).

**Gate 5 + future-sprint authoring.** The remaining 14 concepts get lesson cards in Gate 5 ongoing authoring. Each ships with `test_substrate: 'pending'` and a disabled Test myself button (factual placeholder copy "Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5"). Concepts at Tier 6 (mental-game / study-discipline / meta-game) may permanently retain `test_substrate: 'pending'` if Gate 4 v2 / Gate 5 research determines no test shape is appropriate at the user's tier — see §Open questions §2.

**Confidence: High.** Coverage map is direct read against the existing drill content modules; gap classification is conservative (partial counted only when the existing drill genuinely covers the conceptual ground at adjacent angle). Lesson v1 selection is unambiguous (1:1 with drill-backed concepts).

---

## SCF-G4-S1 — SelfCoachView surface spec (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/self-coach-view.md` (this gate creates).

**Framing.** SelfCoachView is the host surface for self-coach mode. Per Decision 1 (2-tab IA), it has two top-level tabs:

```
┌──────────────────────────────────────────────┐
│ SelfCoachView                                │
│ [ Study* ][ Settings ]                       │
│ ───────────────────────────────────          │
│ ▾ Hero leaks (4 above n=30 floor)            │
│   ⚑ IP cbet defense — 52% [38%, 66%]/30      │
│   ⚑ Turn double-barrel — 38% [22%, 54%]/34   │
│   …                                           │
│ ▾ Curriculum (next: cbet-defense, T3)        │
│   • Cbet defense fundamentals  [Open][Test]  │
│   • Polarization vs linear     [Open]        │ ← test_substrate: pending; button disabled
│   • Board-texture              [Open][Test]  │
│   …                                           │
│ ▾ Tests history (3 quizzes taken)            │
│   2026-04-29 Cbet defense: 4 of 5 correct    │
│   2026-04-25 Pot odds: 5 of 5 correct        │
│   …                                           │
│   [ Browse all concept quizzes ]             │
└──────────────────────────────────────────────┘
```

**Tabs:**
- **Study** (default landing): sectioned scroll. 3 sections, top-to-bottom: Hero leaks / Curriculum / Tests history & browse.
- **Settings**: tier-set radio + N05 confirm + opt-in toggles (cadence reminder OFF default + future opt-ins).

**Section: Hero leaks** (Study tab).
- Lists every situation key with sample size ≥ 30 hands (n=30 floor per AP-SCF-04).
- Each item: ⚑ glyph + leak-name + situation key + observed rate + credible interval + sample size — all 4 CD-5 fields visible inline ("Hero IP cbet defense — fold-to-cbet rate 52% [38%, 66%] over 30 hands").
- Sub-floor situation keys NOT rendered (factual placeholder elsewhere on demand only).
- Tap on item → expand to full CD-5 claim card with solver baseline + related drill/lesson + "Drill this" affordance navigating to lesson card.
- Aggregated inventory; same data source as HRV inline annotations (§SCF-G4-S2). Source-util-policy whitelisted read.

**Section: Curriculum** (Study tab).
- Header: "Tier (owner-set): {tier}. Next teachable concept: {nextConcept}."
- nextConcept derived from SCF-G3-SPINE composite formula (see Gate 3); ranked concept list per current tier × per-domain mastery × leak-frequency × test results × recency.
- Each item: concept name + drilled state ("Drilled: not yet" or "Drilled (last: 2026-04-28; 5 sessions)") + `[ Open ]` button + `[ Test myself on this ]` button.
- Test button is disabled when `test_substrate: 'pending'` with factual placeholder copy on tap ("Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5").
- "Why this concept?" expand on the next-teachable concept reveals per-signal breakdown of the composite score (W_leak / W_drill / W_test / W_recent contributions).
- Per AP-SCF-05: NO progress bar, NO completion percentage, NO "X / Y mastered." Per-concept binary state + last-drilled-at timestamp only.

**Section: Tests history & browse** (Study tab).
- Top: chronological list of opt-in-test results (most recent first). Each entry: timestamp + concept + factual result ("4 of 5 correct"). Per CD-2 nuance, factual grading vocabulary permitted on this surface (cd5_exempt: 'owner-volunteered-test').
- Bottom: `[ Browse all concept quizzes ]` button → expands to a list of concepts where `test_substrate: 'drill'`, each with retake button. Concepts with `test_substrate: 'pending'` NOT listed in browse (no test exists).
- Per AP-SCF-06: NO study streak, NO "you haven't tested in N days" cadence pressure, NO trending. Last-test timestamp factual only.

**Tab: Settings.**
- Tier-set radio (6 options: novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro). Per AP-SCF-03: owner-set only in v1. Default: unset (forces explicit owner action on first SelfCoachView visit).
- N05 confirm pattern: when owner changes tier downward, surface inline confirmation: "Tier change persisted; observed-play inferences not reset." Factual + non-judgmental + AP-SCF-01-compliant.
- Opt-in toggles: "Test mode" (DEPRECATED — replaced by per-concept buttons; toggle removed per Decision 3); "Cadence reminder" (default OFF; owner sets cadence + reminder time).
- Last-study timestamp: factual ("Last study session: 2026-04-29").

**Anti-pattern compliance walkthrough.**

| AP | SelfCoachView verdict |
|----|----|
| AP-SCF-01 (graded-work-framing on system-imposed) | Compliant. Hero leaks section + Curriculum section use observed/factual vocabulary. Tests history section uses CD-2 nuance (cd5_exempt: 'owner-volunteered-test'). |
| AP-SCF-02 (cross-surface contamination) | Compliant. SelfCoachView is review-mode-only. Source-util-policy whitelisted. Live surfaces blacklisted unchanged. |
| AP-SCF-03 (silent tier inference) | Compliant. Settings tier-set radio is owner-set only; no inference-with-confirmation in v1 (deferred to Phase 2+). |
| AP-SCF-04 (small-sample leak claim) | Compliant. Hero leaks section renders only n≥30 situation keys. Sub-floor surfaces use factual placeholder. |
| AP-SCF-05 (mastery score on curriculum) | Compliant. Per-concept binary state + last-drilled-at timestamp only. No progress bar, no completion %, no X/Y mastered. |
| AP-SCF-06 (streak / engagement-pressure) | Compliant. No streaks, no cadence pressure, no trending. Last-study timestamp factual. |
| AP-01..09 (EAL-inherited) | Compliant transitively. AP-08 binding: tier metadata (owner declaration) and per-domain mastery (drill behavior) NOT arithmetically fused into composite skill score. |

**Copy-discipline compliance walkthrough.**

| CD | SelfCoachView verdict |
|----|----|
| CD-1 (factual, not imperative) | Body copy describes observed conditions ("Observed fold-to-cbet IP rate: 52% [...]"); button labels are navigation, not commands ("Open" / "Test myself on this"); no "should" / "must" / "always" / "never" + hero verb. |
| CD-2 (no self-evaluation framing) | Hero leaks + Curriculum sections — observed/factual vocabulary only. Tests history section — CD-2 nuance applies; factual grading vocabulary ("3 of 5 correct") permitted via cd5_exempt manifest flag. |
| CD-3 (no engagement copy) | No motivational copy, no streaks, no social-proof, no urgency, no nudge framing, no gamification. |
| CD-4 (labels as outputs, never inputs) | No villain-style labels in prescriptive copy. Hero-leak situation keys decompose to game-state inputs (street / texture / position / facing-action). |
| CD-5 (assumptions explicit) | Every hero-leak claim card carries situation-key + sample-size + credible-interval + threshold-floor visibly in body. |

**9 autonomy red lines compliance walkthrough.**

| RL | SelfCoachView verdict |
|----|----|
| #1 (opt-in enrollment) | Compliant. Settings tier-set is unset by default; owner explicit action. Test mode is per-concept opt-in (button tap). |
| #2 (full transparency on demand) | Compliant. Every hero-leak claim card carries CD-5 fields + "Why this concept?" expand for curriculum reasoning. |
| #3 (durable overrides) | Compliant. Owner-set tier persists; never overridden by inference. |
| #4 (reversibility) | Compliant. Tier-set change is one tap; test results can be cleared (Gate 5 implementation detail). Incognito-mode for tests deferred — see §Open questions §6. |
| #5 (no streaks, shame, engagement-pressure) | Compliant. AP-SCF-06 enforced. |
| #6 (flat access) | Compliant. Curriculum-spine ORDERS concepts; doesn't gate. Owner can open any concept regardless of tier. |
| #7 (editor's-note tone) | Compliant. CD-1 + CD-3 enforced. No gamified-infantile language. |
| #8 (no cross-surface contamination) | Compliant. AP-SCF-02 enforced. Live surfaces blacklisted. |
| #9 (incognito observation mode) | N/A — SelfCoachView consumes hero-leak data; doesn't capture observations. Capture surface (HandReplayView Section G) is the upstream owner of red line #9. |

**Confidence: High.** IA decision is owner-ratified; section structure flows directly from Gate 3 SCF-G3-SPINE + AP-SCF-* + CD-* constraints; anti-pattern + copy-discipline + red-line walkthroughs all clear.

---

## SCF-G4-S2 — HandReplayView inline hero-leak annotation (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/hand-replay-view.md` extension (this gate appends a new subsection; existing sections preserved).

**Framing.** Per Decision 2 (inline badge under action label, tap expands inline), HRV gains hero-leak annotations woven into the action timeline. NOT a new ReviewPanel section — the badge appears at the action point inline with the existing hero coaching display.

**Architectural placement.** The annotation lives within `HeroCoachingCard` (the existing hero analysis display in `ReviewPanel.jsx`). When the current step's hero action is an action that fired a hero-leak detector rule (n≥30 sample size on the situation key + severity threshold met), `HeroCoachingCard` renders an additional ⚑ badge under the action label.

**Visual treatment (per owner-chosen preview).**

```
Street: Flop  Pot: $42  K72r

  Hero (BTN): cbet 60% pot
     ⚑ leak: IP cbet defense overfold pattern   ▶ tap

  ▼ EXPANDED (inline, below the badge):
  ┌──────────────────────────────────────────┐
  │ Hero IP cbet defense — fold-to-cbet rate │
  │ 52% [38%, 66%] over 30 hands              │
  │ Solver baseline: 38%                      │
  │ Sample threshold: 30 hands                │
  │ Related drill: cbet-defense               │
  │ [ Drill this ]    [ Dismiss ]    [ Snooze ] │
  └──────────────────────────────────────────┘

  Villain (CO): call
```

- **Collapsed state (default):** ⚑ glyph + "leak: {situation-key + observed-pattern label}" + "▶ tap" affordance. One line; lowest visual weight.
- **Expanded state (tap toggle):** Full CD-5 claim card inline below the badge. All 4 CD-5 fields visible (situation key, sample size, credible interval, threshold floor) + solver baseline + related drill/lesson navigation + 3 affordances:
  - **`Drill this`** → navigates to corresponding lesson card in SelfCoachView Curriculum section. If the lesson has `test_substrate: 'drill'`, the user can immediately tap `Test myself` from the lesson card.
  - **`Dismiss`** → collapses the badge for this hand only (does not suppress future hands' leak annotations on the same situation key — per AP-SCF-03 binding, no durable inference suppression without owner-set Settings opt-out which is Phase 2+).
  - **`Snooze`** → suppresses leak annotations for this situation key for 7 days. Snooze duration is owner-amendable in Settings (Gate 5 implementation detail).
- **Sub-floor situation keys (n<30):** NO badge rendered. Per AP-SCF-04, claim text is forbidden below the floor.

**Per-action gating logic.**
- Badge fires when ALL of: (a) hero action at this timeline step matches a hero-leak detector rule's situation key, (b) sample size ≥ 30 for that situation key, (c) severity exceeds rule-defined threshold (per `weaknessDetector.js` parallel — `severity ∈ [0, 1]`; threshold TBD per stat in HERO_LEAK_PRIORS authoring).
- Multiple leak rules may fire on the same action — render each as a separate badge under the action label.

**Surface placement enforcement (sourceUtilPolicy whitelist).**
- `HandReplayView` review-mode only. Live `OnlineView`, sidebar HUD, `TableView`, `TournamentView`, `ShowdownView` blacklisted (per AP-SCF-02).
- Source-util-policy CI-grep enforcement is Gate 5 deliverable (SCF-G4-SUP).

**Anti-pattern + copy-discipline + red line compliance.** Mirrors SelfCoachView Hero leaks section verdicts (above). Particular focus:
- **AP-SCF-04 binding:** Below-floor situation keys NOT rendered as badges. Compliant.
- **CD-5 binding:** Expanded card carries all 4 fields visibly in body. Compliant.
- **Red line #8 binding:** Annotation only renders within HRV review-mode. Compliant.

**Confidence: High.** Owner-chosen visual is fully specified; placement is the existing `HeroCoachingCard` (no new ReviewPanel section needed); compliance walkthroughs all clear.

---

## SCF-G4-S3 — Lesson card schema (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/lesson-card.md` (this gate creates).

**Framing.** Per Decision 5 (inline-handled), the lesson card schema is constrained by CD-5 + AP-SCF-01..06. Each lesson card is a discrete unit of pedagogy authored against a single concept; the `Test myself` affordance binds to the concept's `frameworkIds[]` (existing drill engine substrate) when `test_substrate: 'drill'`.

**Schema (required fields).**

```yaml
conceptId:        string         # kebab-case stable ID matching filename
title:            string         # human label
tier:             1 | 2 | 3 | 4 | 5 | 6   # SCF-G3-TIERMAP tier
leakTagIds:       string[]       # situation-key tags this lesson addresses (from heroLeakDetector taxonomy)
frameworkIds:     string[]       # drill linkage; empty for test_substrate: pending concepts
test_substrate:   'drill' | 'pending'   # gates the Test myself button
exposition:                      # per-tier prose
  body:           markdown
  worked_example: markdown       # 1-2 worked examples per CD-1
citation:                        # POKER_THEORY.md or analogous canonical source
  source:         string         # e.g., "POKER_THEORY.md §5.5"
  source_line:    integer | null
successCriteria:  markdown       # what does "drilled" / "internalized" look like
versionLineage:                  # audit trail
  version:        integer        # increments on amendment
  authored_at:    date
  amended_at:     date | null
  amendment_reason: string | null
cd5_exempt:       'owner-volunteered-test' | null   # optional; only for opt-in-test result framing
```

**Shape rules.**
- `tier` MUST be one of the 6 enumerated values (SCF-G3-TIERMAP; no out-of-range).
- `leakTagIds[]` populated when the lesson maps directly to a hero-leak situation key (Tier 2-5 lessons typically); may be empty for foundational lessons (Tier 1 pot-odds doesn't tie to a single situation key).
- `frameworkIds[]` is the drill linkage. For `test_substrate: 'drill'` lessons, must reference at least one valid framework ID from `drillContent/frameworks.js` or `postflopDrillContent/frameworks.js`. For `test_substrate: 'pending'` lessons, must be empty array.
- `test_substrate: 'pending'` lessons render `Test myself on this concept` button DISABLED with factual placeholder copy on tap: "Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5."
- `cd5_exempt: 'owner-volunteered-test'` is set on the test-result-display surface manifest, NOT the lesson card itself. The flag whitelists the grading-vocabulary subset on the test surface only.

**Worked example: lesson 001 (pot-odds).**

```yaml
conceptId:     pot-odds
title:         Pot Odds & Break-Even Equity
tier:          1
leakTagIds:    []                # foundational; no specific situation key
frameworkIds:  ['decomposition'] # links to drillContent/frameworks.js DECOMPOSITION
test_substrate: 'drill'
exposition:
  body: |
    Every bet facing you has a break-even equity — the percentage you need to
    win the hand to make the call a zero-EV decision. […]
    (full prose body, ~400 words)
  worked_example: |
    AKs vs JTs: AKs wins 62%. If villain (JTs) jams the pot all-in on a
    flush-draw flop and the math says break-even equity is 40%, hero is
    well above threshold — 62% > 40% is an easy call. […]
citation:
  source:      POKER_THEORY.md §3.2
  source_line: null
successCriteria: |
  Internalized when the user can compute break-even equity for half-pot,
  pot-sized, 1.5×, and 2× bet sizes within 5 seconds without scratch paper.
versionLineage:
  version: 1
  authored_at: 2026-05-02
  amended_at: null
  amendment_reason: null
```

**Worked example: lesson 006 (polarization-vs-linear, Tier 3, gap concept).**

```yaml
conceptId:     polarization-vs-linear
title:         Polarization vs Linear Sizing
tier:          3
leakTagIds:    ['flop-cbet-sizing-tell', 'turn-double-barrel-sizing-tell']
frameworkIds:  []                          # no existing drill framework
test_substrate: 'pending'
exposition:
  body: |
    Polarized ranges (strong + air, no medium) bet bigger; linear ranges
    (medium-to-strong, no air) bet smaller. […]
    (full prose body)
  worked_example: |
    On A92r vs villain who 3-bets BB vs CO open: villain's range is medium
    (suited broadways + medium pairs), so linear sizing fits. […]
citation:
  source: POKER_THEORY.md §6.3
  source_line: null
successCriteria: |
  Internalized when the user can categorize a sizing decision as polarized
  or linear given range shape + board texture within 10 seconds at the table.
versionLineage:
  version: 1
  authored_at: 2026-05-02
  amended_at: null
  amendment_reason: null
```

`Test myself on this concept` button is rendered DISABLED in v1; tap surfaces factual placeholder. Gate 4 v2 / Gate 5 research determines test substrate.

**Anti-pattern + copy-discipline compliance.** Lesson card body copy bound by CD-1 (no imperatives) + CD-3 (no engagement copy). `successCriteria` describes internalization in observable terms, not graded outcomes. `versionLineage` enables AP-SCF-05 mitigation: lesson updates don't surface as "concept reset" or "remastered" — they surface as factual versioning.

---

## SCF-G4-S4 — Skill-assessment-test surface spec (THIN — cross-references drill surfaces)

**Surface artifact:** `docs/design/surfaces/skill-assessment-test.md` (this gate creates).

**Framing.** Per the Architectural overlap binding above, the skill-assessment-test surface is NOT a new prediction engine. It is the opt-in-test MODE of the existing drill surfaces (`postflop-drills.md` / `preflop-drills.md`). This surface doc is THIN and primarily cross-references those existing surface docs, naming only the 3 deltas and surface-specific concerns.

**Three deltas vs default drill flow.** (Repeated from §Architectural overlap for surface-doc readers.)

| Delta | Default drill | Opt-in-test mode |
|---|---|---|
| Entry path | Scheduler-driven (`pickNextMatchup`) or library browse from PreflopDrillsView / PostflopDrillsView | Per-concept `Test myself on this` button on lesson card (in SelfCoachView Curriculum section) |
| Result framing | CD-2 default — observed/non-graded vocabulary | CD-2 nuance permitted — factual grading vocabulary ("3 of 5 correct") via `cd5_exempt: 'owner-volunteered-test'` manifest flag on the result-display surface |
| Persistence tag | `scheduler.frameworkAccuracy[id]` (behavioral signal) | ALSO writes `userSettings.perDomainMastery[conceptId].testResults[]` (subset signal); does NOT overwrite default drill behavioral tracking |

**Coverage in v1 (drill-backed concepts).** Per §SCF-G4-COVERAGE map, 5 concepts have direct drill backing in v1. Each gets an opt-in-test entry path:

| Concept (lesson) | Drill substrate | Test surface flow |
|---|---|---|
| pot-odds | `drillContent` framework: decomposition | Test myself → drill scheduler picks pot-odds matchup library (`drillContent/matchupLibrary.js` filtered by frameworkId) → 5 matchups → factual results → write `testResults[]` |
| range-vs-range-thinking | `postflopDrillContent` framework: range_decomposition | Test myself → postflop scheduler picks range-decomposition scenario library (`postflopDrillContent/scenarioLibrary.js` filtered by frameworkId) → 5 scenarios → factual results → write `testResults[]` |
| board-texture | `postflopDrillContent` frameworks: board_tilt + capped_range_check | Test myself → postflop scheduler picks scenarios spanning both frameworks → 5 scenarios → factual results → write `testResults[]` |
| blocker-effects-preflop | `drillContent` frameworks: straight_coverage + flush_contention + broadway_vs_connector | Test myself → preflop scheduler picks matchups spanning all 3 frameworks → 5 matchups → factual results → write `testResults[]` |
| capped-vs-uncapped-ranges | `postflopDrillContent` framework: capped_range_check | Test myself → postflop scheduler picks capped-ranges scenario library → 5 scenarios → factual results → write `testResults[]` |

**Coverage gap (pending concepts).** 14 concepts have `test_substrate: 'pending'`. The `Test myself on this concept` button is rendered DISABLED on their lesson cards. Tap surfaces factual placeholder copy: "Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5." The lesson body still ships and is fully readable.

**`cd5_exempt: 'owner-volunteered-test'` manifest flag.** When the test-result-display surface (the brief modal or inline result card shown after completing the 5-question quiz) renders, it declares this manifest flag. CI-lint allows the grading-vocabulary subset on this surface only — "{N} of {M} correct" is permitted; "your score" / "your accuracy" / "did you get the right answer" / "test mastery" remain forbidden everywhere. The flag is per-surface-instance; it does NOT propagate to the upstream lesson card or SelfCoachView Tests history list (which uses CD-2 nuance directly per the §SCF-G4-S1 walkthrough).

**Cross-surface relationships.**
- **Parent** (entry-point surfaces): SelfCoachView Curriculum section lesson cards (`Test myself on this` button).
- **Substrate** (delegates to): `postflop-drills.md` + `preflop-drills.md` surfaces (drill execution; same UX as default flow).
- **Persistence destination** (writes to): `userSettings.perDomainMastery[conceptId].testResults[]` (per Gate 3 SCF-G3-SCHEMA).
- **History display** (read by): SelfCoachView Tests history & browse section.

**Anti-pattern compliance.**
- **AP-SCF-01 nuance:** Surface relies on the load-bearing opt-in gate. Test launches ONLY from explicit `Test myself` button tap; cannot auto-launch. Compliant.
- **AP-SCF-04 (n=30 floor):** N/A. Floor applies to leak claim text, not test invocation. Tests can be taken at any sample size.
- **AP-SCF-05 (mastery score):** Tests do NOT collapse into a per-concept mastery score. `testResults[]` is a flat array of factual quiz outcomes; no aggregate "mastery %" rendered. Curriculum-spine W_test signal uses Beta-Binomial CI on the array, NOT a scalar score.
- **AP-SCF-06 (streak / engagement-pressure):** No test streaks, no "you haven't tested in N days" pressure. Owner cadence = passive last-test timestamp only.

---

## SCF-G4-S5 — Leak-distillation pipeline UI (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/leak-distillation.md` (this gate creates).

**Framing.** Leak-distillation is the cross-surface pipeline that converts a fired hero-leak detector rule into an owner-actionable surface element. Per Gate 3 ratification (immediate firing on hand-replay) + Decision 2 (inline badge with inline expansion), the pipeline runs at two surface points:

1. **HandReplayView inline annotation** (per-action, per-leak-rule): immediate badge fire on the action that triggered the rule. See §SCF-G4-S2.
2. **SelfCoachView Hero leaks section** (aggregated inventory): every situation key with sample size ≥ 30 hands listed; tap expands to full CD-5 claim card. See §SCF-G4-S1 Hero leaks section.

**Pipeline stages.**

```
hand reviewed in HandReplayView
       │
       ▼
heroDecisionAccumulator.js buckets per-action observation
(7-dim situation key: street:texture:posCategory:isAgg:isIP:facingAction:contextAction)
       │
       ▼
heroLeakDetector.js evaluates rules at action point
       │
       ├── fires (n≥30 + severity threshold met)
       │     │
       │     ▼
       │   inline badge in HeroCoachingCard at this step
       │   tap → expand inline → full CD-5 claim card + 3 affordances
       │     │
       │     ├── [Drill this] → navigates to lesson card
       │     ├── [Dismiss]    → collapse for this hand only
       │     └── [Snooze]     → suppress for situation key for 7 days
       │
       └── below threshold or below floor → no badge

       ┌──────────────────────────────┐
       │ Aggregate across ALL hands   │
       └──────────────────────────────┘
       │
       ▼
heroLeaks IDB store (composite keypath [playerId, situationKey])
       │
       ▼
SelfCoachView Hero leaks section reads + renders inventory
       │
       ▼
W_leak signal feeds curriculum-spine composite formula
       │
       ▼
SelfCoachView Curriculum section ranks concepts by composite score
```

**Affordance behaviors.**

| Affordance | Behavior | Persistence |
|---|---|---|
| `Drill this` | Navigates to `SelfCoachView` Curriculum section, scrolls to / highlights the lesson card matching the leak's `relatedConceptId`. | None (navigation only). |
| `Dismiss` | Collapses the badge for the current HRV session only. Does NOT suppress future hand-replay reviews on the same situation key. | Session-local state; not persisted. |
| `Snooze` | Suppresses leak annotations for the situation key for 7 days from `snoozedAt`. | Persisted in `heroLeaks[situationKey].snoozedUntil`. Owner can clear snooze in SelfCoachView Hero leaks section (per item; tap on snooze indicator). |

**AP-SCF-03 binding for snooze.** Snooze is per-situation-key, owner-explicit, time-bounded (7 days default; Gate 5 implementation may make duration owner-configurable in Settings). It is NOT durable suppression of inference (which would require Settings opt-out — Phase 2+ work). The 7-day bound prevents accidental permanent silencing.

**SourceUtilPolicy whitelist (per Gate 3 SCF-G3-DETECTOR §sourceUtilPolicy).**
- **Read-allowed:** `HandReplayView` (review-mode), `PlayerAnalysisPanel` (review-mode if hero-leak-aware extension is added Phase 2+; not in v1), `SelfCoachView`.
- **Read-blocked:** `OnlineView`, sidebar HUD, `TableView` chrome, `TournamentView`, `ShowdownView`, all live-decision surfaces.
- CI-grep enforcement at Gate 5 (SCF-G4-SUP — `kit/scripts/sourceUtilPolicy.test.js` analog). Mirrors EAL F6 sourceUtilPolicy infrastructure.

**Confidence: High.** Pipeline shape mirrors EAL anchor-distillation (parallel store + cross-surface read with sourceUtilPolicy whitelist); affordance behaviors are owner-actionable and AP-compliant; immediate-firing decision is Gate 3 ratified.

---

## SCF-G4-MOD — `src/utils/skillAssessment/` module shape (BLOCKING Gate 5)

**Doc artifact:** `docs/projects/self-coach-foundation/skill-assessment-module.md` (this gate creates).

**Framing.** Per Architectural binding 1 (drills + tests share substrate), `src/utils/skillAssessment/` is a thin aggregation layer over the existing drill engine, NOT a parallel prediction engine. It produces concept-level mastery state for the curriculum-spine composite-signal by reading drill behavioral data + opt-in-test results + hero-leak-detector output.

**Module shape (mirrors `chris-live-player.md` §Skill-state attribute, lines 60-79).**

```
src/utils/skillAssessment/
  index.js              — public API (re-exports)
  conceptMastery.js     — produces per-concept mastery state from drill + test data
  composite.js          — implements SCF-G3-SPINE formula (W_leak/W_drill/W_test/W_recent)
  CLAUDE.md             — module-level domain rules + anti-patterns + integration contracts
  __tests__/
    conceptMastery.test.js
    composite.test.js
```

**Per-concept mastery shape (output of `conceptMastery.js`).**

```
{
  conceptId:       'cbet-defense',
  level:           'novice' | 'learning' | 'drilled' | 'fluent',  // discrete band
  confidence:      { lower, upper, mean, level: 0.95 },           // Bayesian CI on level
  lastValidatedAt: 1735776000000,                                  // ms epoch
  trendDirection:  'improving' | 'stable' | 'plateaued' | 'decaying',
  userMuteState:   'none' | 'already-known' | 'not-interested',
  drillStats:      { attempts, accuracy, avgDelta },               // from scheduler.frameworkAccuracy
  testStats:       { attempts, accuracy },                         // from perDomainMastery.testResults[]
  leakFrequency:   number,                                          // from heroLeaks aggregation
}
```

**Read paths.**
- `scheduler.frameworkAccuracy[frameworkId]` — drill behavioral data (W_drill signal source).
- `userSettings.perDomainMastery[conceptId].testResults[]` — opt-in-test results (W_test signal source).
- `heroLeaks` IDB store — leak frequency per situation key, mapped to `conceptId` via `lessonCard.leakTagIds[]` (W_leak signal source).
- `userSettings.perDomainMastery[conceptId].lastDrilledAt` — recency penalty (W_recent signal source).

**Write paths.**
- `userSettings.perDomainMastery[conceptId].testResults[]` — appended to on each opt-in-test completion. Module is the ONLY writer to this field.
- `userSettings.perDomainMastery[conceptId].masteryState` — derived; written on each `conceptMastery.computeFor(conceptId)` call.

**Integration contracts.**

| Module | Read/Write | Interaction |
|---|---|---|
| `drillContent/scheduler.js` | Read | `frameworkAccuracy` map; module aggregates by concept's `frameworkIds[]`. |
| `postflopDrillContent/scheduler.js` (analog) | Read | Same pattern. |
| `exploitEngine/weaknessDetector.js` | Read (parallel reference, not direct dependency) | Module mirrors villain-side rule structure for the hero-leak detector spec; does not import from villain side. |
| `exploitEngine/decisionAccumulator.js` | Read (parallel reference) | Hero-side analog `heroDecisionAccumulator.js` mirrors 7-dim bucketing. |
| `bayesianConfidence.js` | Read | `credibleInterval()` for confidence CI; HERO_LEAK_PRIORS authored alongside STAT_PRIORS. |
| `database.js` (IDB) | Read+Write | `heroLeaks` store (read); `userSettings.perDomainMastery` (read+write). |

**What this module is NOT.**
- NOT a parallel drill engine. Does not pick matchups, does not render drill UI, does not score correctness. Drill engine owns those paths.
- NOT a test executor. The opt-in-test mode is implemented as a flag passed into the existing drill engine (Gate 5 implementation detail in `PostflopDrillsView` / `PreflopDrillsView`).
- NOT a leak detector. The hero-leak detector is `exploitEngine/heroLeakDetector.js` (NEW Gate 5; mirrors `weaknessDetector.js`); this module READS from it.

**Anti-pattern bindings.**
- **AP-08 (signal fusion refusal):** Module MUST NOT arithmetically fuse owner-declared tier metadata + per-domain mastery + leak frequency into a single "skill score." Each remains a separate input to `composite.js`.
- **AP-SCF-03 (silent inference refusal):** Module computes inferred-tier suggestion (Phase 2+; not in v1) but NEVER writes to `userSettings.tier.current`. v1 has no inference; tier is owner-set only.
- **AP-SCF-05 (mastery score refusal):** `level` is a discrete band, not a scalar score. `confidence` is a CI on the level estimate, not "X% mastered." Surface presentation NEVER aggregates `level` across concepts into a global metric.

**Confidence: High.** Module shape mirrors well-established `weaknessDetector.js` + `decisionAccumulator.js` parallel; integration contracts are additive (no breaking changes); anti-pattern bindings clear.

---

## SCF-G4-LESSONS — Lesson authoring template + 5 reference lessons (BLOCKING Gate 5)

**Doc artifact:** `docs/projects/self-coach-foundation/lesson-authoring-template.md` + `docs/projects/self-coach-foundation/lessons/{001-005}-*.md` (this gate creates).

**Framing.** Per Master Plan §D Gate 4 deliverable list, Gate 4 ships a lesson authoring template + 5-10 example lessons. Per §SCF-G4-COVERAGE, 5 reference lessons map directly to the 5 drill-backed concepts (one per). Remaining 14 concepts get lesson cards in Gate 5 ongoing authoring (per the same template + against `test_substrate: 'pending'` flag).

**Reference lessons (this gate).**

1. **001-pot-odds.md** — Tier 1 (novice). Drill-backed: `drillContent/decomposition` (matchupLibrary filtered by pot-odds practical_math category). `test_substrate: 'drill'`. Maps to existing `drillContent/lessons.js#pot-odds` content for exposition base.
2. **002-range-vs-range-thinking.md** — Tier 3 (studied-amateur). Drill-backed: `postflopDrillContent/range_decomposition`. `test_substrate: 'drill'`. Maps to existing `postflopDrillContent/lessons.js#range-decomposition` content for exposition base.
3. **003-board-texture.md** — Tier 3 (studied-amateur). Drill-backed: `postflopDrillContent/board_tilt + capped_range_check`. `test_substrate: 'drill'`. Maps to existing `postflopDrillContent/lessons.js#board-tilt` + `#capped-ranges` content for exposition base.
4. **004-blocker-effects-preflop.md** — Tier 4 (part-time-grinder; preflop scope only — postflop blockers are a gap concept covered separately in Gate 5). Drill-backed: `drillContent/straight_coverage + flush_contention + broadway_vs_connector`. `test_substrate: 'drill'`. Maps to existing `drillContent/lessons.js#straight-coverage` + `#flush-contention` + `#broadway-vs-middling` content for exposition base.
5. **005-capped-vs-uncapped-ranges.md** — Tier 5 (serious-grinder). Drill-backed: `postflopDrillContent/capped_range_check`. `test_substrate: 'drill'`. Maps to existing `postflopDrillContent/lessons.js#capped-ranges` content for exposition base.

**Authoring template structure** (`lesson-authoring-template.md`).
- Schema (mirror of `lesson-card.md` surface fields)
- Field-by-field commentary (what each field is, what authors must populate)
- Worked example (lesson 001 walked through field by field)
- CD-1..5 compliance walkthrough (what authors check before submission)
- AP-SCF-01..06 + AP-01..09 EAL-inherited compliance walkthrough
- 9 autonomy red lines compliance walkthrough
- Audit checklist (8-12 items; pre-merge Gate 5 review uses this)

**Reuse of existing drill content.** The 5 reference lessons reuse exposition prose from existing `drillContent/lessons.js` and `postflopDrillContent/lessons.js` (already-authored, owner-validated content). They add the SCF lesson-card schema overlay (tier, leakTagIds, citation, successCriteria, versionLineage, test_substrate) but do NOT re-author the pedagogical content. This satisfies the owner's "drills + tests overlap; don't maintain two parallel learning environments" binding at the content layer too — lesson prose lives ONCE in the drill module; lesson cards are the SCF-shaped wrapper around it.

**Gate 5 authoring direction.** Lessons 006-019 author against the same template. Tier 6 lessons (006-meta-game / 007-mental-game / 008-study-discipline) likely retain `test_substrate: 'pending'` permanently. Tier 5 / 4 / 3 / 2 gap concepts (polarization-vs-linear, exploitative-deviations, multi-street-planning, ICM, GTO-balancing, GTO-baseline-review, fold-equity, fold-equity-math, basic-3bet, basic-open-ranges) get lesson cards as the substrate question is researched per the deferred §Open question §2.

---

## SCF-G4-SETTINGS — Tier-set radio + N05 confirm pattern (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/self-coach-view.md` Settings tab (this gate creates as part of SelfCoachView).

**Framing.** Per Decision 9 (inline-handled) + AP-SCF-03 (silent tier inference refusal), v1 ships an explicit owner-set tier-set radio in SelfCoachView Settings tab. Inferred tier suggestions are Phase 2+ work.

**Radio structure.**

```
Settings → Tier
  ◯ novice
  ◯ live-rec
  ◯ studied-amateur                      ← currently selected
  ◯ part-time-grinder
  ◯ serious-grinder
  ◯ pro
  Last set: 2026-04-22
```

- 6 mutually-exclusive options (radio, not toggle).
- Default: unset (no radio selected on first visit). Forces explicit owner action before SelfCoachView Curriculum section can render the per-tier next-teachable concept.
- Tier change is one tap. Persists immediately to `userSettings.tier.current`. Logs `userSettings.tier.lastSetAt` + `userSettings.tier.source: 'declared'` (per AP-SCF-03 schema in Gate 3 SCF-G3-SCHEMA).

**N05 confirm pattern (tier downgrade).**

```
[ Settings → Tier ]
  ◯ novice
  ◯ live-rec
  ◉ studied-amateur                      ← was: serious-grinder
  ◯ part-time-grinder
  ◯ serious-grinder
  ◯ pro
  Last set: 2026-05-02

  ⓘ Tier change persisted; observed-play inferences not reset.
```

- Inline confirmation message appears when owner changes tier downward (e.g., from serious-grinder to studied-amateur).
- Copy is factual + non-judgmental + AP-SCF-01-compliant.
- "observed-play inferences not reset" clause makes explicit that the change does NOT trigger a re-baseline of hero-leak history or drill stats — the user's observed performance data persists unchanged.
- Owner CAN reset observed-play inference data via Phase 2+ "reset all SCF data" affordance (red line #4 reversibility) — not in v1 Settings.

**Anti-pattern bindings.**
- **AP-SCF-03 (silent tier inference refusal):** Compliant. v1 has NO inference. v2 inference-with-confirmation pattern: surface "Observed play suggests `studied-amateur` (current declaration: `live-rec`). Confirm or amend?" The system never silently overrides the owner-set value.
- **AP-SCF-05 (mastery score refusal):** Compliant. Tier is a discrete declared state, not a percentile / X-of-Y / progress-bar.

---

## SCF-G4-CARRY-FWD — Gate 3 carry-forward bindings (verification)

**Framing.** Per Gate 3 close-out, the 5 SCF-G3-* carry-forwards (DETECTOR / TIERMAP / SPINE / CO / SCHEMA) were named as BLOCKING Gate 4. This section verifies each carry-forward is bound by a Gate 4 deliverable.

| Carry-forward | Bound by Gate 4 deliverable | Gate 5 implementation work item (unblocked) |
|---|---|---|
| **SCF-G3-DETECTOR** (hero-leak detector schema) | §SCF-G4-MOD `skill-assessment-module.md` integration contracts; §SCF-G4-S2 HRV inline annotation gating logic; §SCF-G4-S5 leak-distillation pipeline. Detector module itself implements at Gate 5 as `src/utils/exploitEngine/heroLeakDetector.js` + `heroDecisionAccumulator.js`. | Gate 5: `heroLeakDetector.js` + `heroDecisionAccumulator.js` implementation; HERO_LEAK_PRIORS authoring in `bayesianConfidence.js`. |
| **SCF-G3-TIERMAP** (per-tier teachable-concept map) | §SCF-G4-COVERAGE coverage audit + §SCF-G4-LESSONS reference lessons. Map ratified at Gate 3 Appendix A; Gate 4 binds it to specific lesson cards. | Gate 5 ongoing: lessons 006-019 author against the map. |
| **SCF-G3-SPINE** (curriculum-spine 3-signal composite) | §SCF-G4-S1 SelfCoachView Curriculum section render + §SCF-G4-MOD `composite.js` formula implementation spec. | Gate 5: `composite.js` implementation; weight tuning against owner's corpus. |
| **SCF-G3-CO** (CO-54..57 state transitions) | Gate 4 surfaces serve CO-54 (HRV inline annotation + SelfCoachView Hero leaks section), CO-55 (SelfCoachView Curriculum section), CO-56 (Calibration Dashboard reuse — separate surface, KEEP SEPARATE per Gate 2 §B Stage B). CO-57 stays Proposed v2-deferred per Gate 4 v2 carry-forward. Companion file `coaching.md` updated with surface placements. | Gate 5: surface implementation; CO-56 Calibration Dashboard parameter wiring. |
| **SCF-G3-SCHEMA** (IDB v22 migration) | §SCF-G4-MOD module spec references the v22 schema (heroLeaks store + userSettings.tier extension + userSettings.perDomainMastery). Schema authored at Gate 3; Gate 4 binds the read+write paths. | Gate 5: IDB v21→v22 migration script per `database.js` dynamic-version pattern. |

All 5 carry-forwards bound. No carry-forward orphaned.

---

## Anti-pattern × surface walkthrough (consolidated matrix)

| Anti-pattern | SelfCoachView | HRV inline annotation | Lesson card | Skill-assessment-test | Leak-distillation |
|---|---|---|---|---|---|
| AP-SCF-01 (graded-work-framing on system-imposed) | Compliant | Compliant | Compliant | Nuance applies (cd5_exempt) | Compliant |
| AP-SCF-02 (cross-surface contamination) | Compliant | Compliant (HRV review-mode only) | N/A | N/A | Compliant (sourceUtilPolicy whitelist) |
| AP-SCF-03 (silent tier inference) | Compliant (Settings owner-set) | N/A | N/A | N/A | N/A |
| AP-SCF-04 (small-sample claim under n=30 floor) | Compliant (sub-floor not rendered) | Compliant (no badge below floor) | N/A | N/A | Compliant |
| AP-SCF-05 (mastery score on curriculum) | Compliant (per-concept binary state) | N/A | Compliant (no mastery score field) | Compliant (testResults[] not aggregated) | N/A |
| AP-SCF-06 (streak / engagement-pressure) | Compliant (no streak, factual timestamps) | N/A | N/A | Compliant (no test streak) | Compliant (snooze is owner-explicit) |
| AP-01 (per-villain-archetype prescription, EAL) | Compliant | Compliant | N/A | N/A | N/A |
| AP-02 (calibration leaderboard) | Compliant | N/A | N/A | N/A | N/A |
| AP-03 (engagement-pressure framing) | Compliant | N/A | N/A | N/A | N/A |
| AP-04 (calibration score) | Compliant | N/A | N/A | Mirrored at AP-SCF-01 nuance scope | N/A |
| AP-05 (retired-anchors-you-might-reconsider) | N/A | N/A | N/A | N/A | Snooze is neutral data presentation, not nudge-to-act |
| AP-06 ("your calibration accuracy" graded-work) | Compliant | Compliant | Compliant | Mirrored at AP-SCF-01 nuance | Compliant |
| AP-07 (cross-surface calibration leakage onto live) | Compliant | Compliant | N/A | N/A | Compliant |
| AP-08 (signal fusion declaration + observation) | Compliant (tier + mastery NOT fused; module §SCF-G4-MOD enforces) | N/A | N/A | N/A | N/A |
| AP-09 (capture framing — "how did this hand go?") | N/A | Compliant ("⚑ leak: …" not "How did this hand go?") | N/A | N/A | Compliant |

All 6 SCF-specific + 9 EAL-inherited anti-patterns × 5 surfaces = 75 cells. All cells: compliant, N/A (genuinely orthogonal), or nuance-applies-with-binding-rule. No violations.

---

## Copy-discipline × surface walkthrough (CD-1..5 manual grep)

CI-grep enforcement is Gate 5 deliverable (SCF-G4-SUP). This gate runs the manual walkthrough.

| CD | SelfCoachView | HRV inline | Lesson card | Skill-assessment-test | Leak-distillation |
|---|---|---|---|---|---|
| CD-1 (factual, not imperative) | ✓ Body copy descriptive; buttons are navigation labels | ✓ "⚑ leak: …" descriptive; affordances are nouns | ✓ exposition prose authored against CD-1 | ✓ "Test myself on this concept" is owner-initiated invitation, not imperative | ✓ "Drill this" / "Dismiss" / "Snooze" are buttons, not commands |
| CD-2 (no self-evaluation framing on system-imposed surfaces) | ✓ Hero leaks + Curriculum sections — observed/factual; ✓ Tests history section — CD-2 nuance via cd5_exempt | ✓ Inline annotation observed/factual | ✓ Lesson body authored against CD-2 | ✓ Result-display surface uses CD-2 nuance via cd5_exempt manifest flag | ✓ Pipeline UI factual |
| CD-3 (no engagement copy) | ✓ No streaks, motivational copy, urgency, or gamification | ✓ Badge is factual marker | ✓ Lesson body authored against CD-3 | ✓ Test result is "{N} of {M} correct" only; no "great job!" | ✓ Snooze is factual time-bound |
| CD-4 (labels as outputs, never inputs) | ✓ Hero-leak situation keys decompose to game-state inputs; no villain-style labels in prescriptions | ✓ Inline annotation cites situation key, not labels | ✓ Lesson body authored against CD-4 | N/A | N/A |
| CD-5 (assumptions explicit: sample-size + situation-key + threshold visible) | ✓ Every leak claim card carries 4 fields visible inline | ✓ Expanded card carries all 4 fields | N/A (lesson card is prose-bound, not claim-bound) | N/A | ✓ Pipeline preserves CD-5 fields throughout |

All cells: compliant or N/A.

---

## 9 autonomy red lines × surface walkthrough

| RL | SelfCoachView | HRV inline | Lesson card | Skill-assessment-test | Leak-distillation |
|---|---|---|---|---|---|
| #1 (opt-in enrollment) | ✓ Settings tier-set unset by default | ✓ Annotation only renders within HRV review-mode | ✓ Lesson is consumed on user navigation | ✓ Test launches ONLY from explicit button tap | ✓ Pipeline runs only on review-mode hands |
| #2 (full transparency on demand) | ✓ "Why this concept?" expand surfaces composite-signal breakdown | ✓ Expanded card carries CD-5 + solver baseline | ✓ versionLineage + citation visible in lesson card | ✓ Test results factual + sample size visible | ✓ Snooze duration + situation key visible per item |
| #3 (durable overrides) | ✓ Owner-set tier persists; never overridden | ✓ Snooze + Dismiss owner-explicit | N/A | N/A | ✓ Snooze persists per situation key |
| #4 (reversibility) | ✓ Tier change one tap; reset Phase 2+ | ✓ Dismiss is collapsible | N/A | N/A (incognito test mode deferred §Open §6) | ✓ Snooze can be cleared |
| #5 (no streaks, shame, engagement-pressure) | ✓ No streaks; factual timestamps | ✓ No badge stacking pressure | ✓ Lesson body authored against this | ✓ No test streaks | ✓ No "you've ignored this leak for X days" pressure |
| #6 (flat access) | ✓ Curriculum-spine ORDERS, never gates | ✓ Annotation is inline read-only | ✓ All lessons accessible regardless of tier | ✓ All drill-backed tests accessible regardless of tier | N/A |
| #7 (editor's-note tone) | ✓ CD-1 + CD-3 enforced | ✓ "⚑ leak: …" factual marker | ✓ Lesson body authored against CD-1 + CD-3 | ✓ Result display "{N} of {M} correct" factual | ✓ Affordance labels factual |
| #8 (no cross-surface contamination) | ✓ Review-mode only; sourceUtilPolicy whitelisted | ✓ HRV review-mode only | N/A (lesson is content) | ✓ Drill surfaces are review-mode aligned | ✓ sourceUtilPolicy CI-grep at Gate 5 |
| #9 (incognito observation mode) | N/A (consumes data, doesn't capture) | N/A (read-only annotation) | N/A | Deferred §Open §6 (test incognito mode) | N/A |

All cells: compliant, N/A, or deferred-with-tracking.

---

## Open questions deferred to Gate 4 v2 / Gate 5

1. **CO-57 confidence-elicitation surface design** — Gate 3 ratified deferral to Gate 4 v2 (this Gate ratifies the deferral). Surface affordance is net-new; assumptionEngine has no precedent for pre-decision elicitation. Future v2 sprint designs the HandReplayView pre-verdict slot + capture flow.

2. **Test shape for gap concepts (10 of 19 SCF-G3-TIERMAP concepts)** — Per §SCF-G4-COVERAGE, 10 concepts have `test_substrate: 'pending'`. The right test substrate (drill authoring extending existing engine vs. non-drill shape: multi-step decision tree, prose response, scenario walkthrough quiz vs. permanent no-test-affordance) is research deferred. Gate 4 v2 / Gate 5 deliverable. Tier 6 concepts (mental-game / study-discipline / meta-game) likely retain `test_substrate: 'pending'` permanently.

3. **HERO_LEAK_PRIORS specific values per stat** — Gate 3 SCF-G3-DETECTOR authored 8 starter priors at total pseudocount 5. Gate 5 implementation review tunes against owner's actual hand corpus. Specific values amendable per-stat; structural shape (Beta(α, β) with weak prior + n≥10 data dominance) is locked.

4. **Composite-signal weights tuning (W_leak / W_drill / W_test / W_recent)** — Gate 3 starter values 0.5 / 0.3 / 0.15 / 0.05. Gate 5 corpus-driven tuning. Gate 4 surface review confirmed structural OK; weight values amendable.

5. **W_drill vs W_test aggregation rule final answer** — v1 spec: W_drill = ALL drill attempts; W_test = ONLY opt-in-test attempts (subset). Slight intentional double-count rewards explicit owner readiness. Gate 5 may revisit if signal interaction shows drift toward over-rewarding tested concepts. Alternative ("W_drill = scheduler-only; W_test = explicit-test-only; no double-count") preserved as fallback.

6. **Incognito test mode** — Owner red line #9 binding for capture surfaces; SCF tests are consumption surfaces (writes to perDomainMastery.testResults[]), not capture. Whether opt-in tests should have a per-test incognito toggle (don't write result to testResults[]; just show factual outcome ephemerally) is Phase 2+ research. v1 always writes result to persistence.

7. **Snooze duration owner-configurability** — v1 default 7 days hardcoded. Gate 5 implementation may surface snooze-duration setting in SelfCoachView Settings tab (e.g., "Default snooze: 7 days [editable]"). v1 ships with hardcoded default for simplicity.

8. **IDB v22 migration script** — schema authored at Gate 3 SCF-G3-SCHEMA; Gate 5 implements per `database.js` v21→v22 dynamic-version pattern. Migration outline in Gate 3 doc.

9. **`src/utils/skillAssessment/` implementation** — module shape spec'd at Gate 4 §SCF-G4-MOD; Gate 5 implements as thin aggregation layer. Test coverage target: ~95% on `composite.js` formula + ~85% on `conceptMastery.js`.

10. **Lessons 006-019 authoring** — Gate 4 ships 5 reference lessons; remaining 14 author against the lesson-authoring-template in Gate 5 ongoing. Pace ~1-3 lessons per session of authoring time.

---

## Change log

- **2026-05-02 — Created.** Gate 4 Design surfaces audit for Self-Coach Foundation per Master Plan §D Phase-4 entry. 4 owner-decided + 6 inline-handled decisions ratified. **Two binding architectural constraints from owner clarification 2026-05-02 plan-mode**: (1) drills + tests share substrate (no parallel prediction engine), (2) drill coverage may NOT be encompassing (coverage-audit names 10 of 19 TIERMAP concepts as `test_substrate: 'pending'`; Gate 4 v2 / Gate 5 research determines test shape for gap concepts). 5 SCF-G3-* carry-forwards (DETECTOR / TIERMAP / SPINE / CO / SCHEMA) ALL bound. 4 new surface specs + 1 surface extension + 2 light surface extensions (drill surfaces gain opt-in-test mode) + 1 module spec + 1 lesson authoring template + 5 reference lessons authored as Gate 4 deliverables. Companion file updates: `coaching.md` (CO-54..56 surface placement; CO-57 stays Proposed v2-deferred), `CATALOG.md` (4 new surface entries), `copy-discipline.md` (cd5_exempt manifest flag wiring), `anti-patterns.md` (AP-SCF-01 nuance scope clarification + AP-SCF-03 Settings tier-set binding). Verification: zero `src/` diff (audit-only). Gate 5 unblocked. Next natural anchor in Master Plan A/D alternation: WS-007 (PIO-G4 Design surfaces, A-line first Phase-4 Design gate).
