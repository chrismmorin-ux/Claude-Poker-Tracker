# Surface — SelfCoachView

**ID:** `self-coach-view`
**Code paths:**
- `src/components/views/SelfCoachView/` (Phase 5 — not yet implemented; spec'd at SCF Gate 4)
- `src/utils/skillAssessment/` (Phase 5 — thin aggregation layer; see `docs/projects/self-coach-foundation/skill-assessment-module.md`)

**Route / entry points:**
- `SCREEN.SELF_COACH` (Phase 5 — to be added to `uiReducer.js`)
- Opens from: main nav + HRV inline-leak `Drill this` affordance (deep-links to specific lesson card in Curriculum section)
- Closes to: caller (usually main nav or HRV)

**Last reviewed:** 2026-05-06 (Phase-5a slice update — see Change log)
**Created:** 2026-05-02 (SCF Gate 4)
**Phase-5a scope (WS-159 / SPR-042):** Curriculum tab + Settings tab only. Hero-leaks + Tests-history sections + Cadence-reminder controls deferred to follow-up tickets per surface-specific Gate 1 entry audit (`audits/2026-05-06-entry-self-coach-view.md`).

---

## Purpose

The host surface for self-coach mode. Surfaces hero-leak detector output, curriculum-spine ranking, and opt-in-test history in one review-mode-only view that the user navigates to deliberately. Does NOT live on live surfaces (per AP-SCF-02 cross-surface contamination refusal). Is the consumer-side counterpart to the HandReplayView inline annotation pipeline (`leak-distillation.md`).

## JTBD served

Primary:
- **CO-54** *see-leak-without-being-graded* — Hero leaks section is the aggregated inventory display; per AP-SCF-01 nuance, system-imposed surfaces use observed/factual vocabulary only.
- **CO-55** *learn-next-concept-im-ready-for* — Curriculum section ranks per current tier × per-domain mastery × leak frequency × test results.

Secondary:
- **CO-56** *validate-im-improving* — Trend display on Hero leaks section (drift arrow + sample-size-aware confidence). Reuses Calibration Dashboard primitives (KEEP SEPARATE per Gate 2 §B Stage B verdict — distinct referent).

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) in self-coach mode (primary).
- [post-session-chris](../personas/situational/post-session-chris.md) (secondary — generous-budget review block).
- [study-block](../personas/situational/study-block.md) (secondary — dedicated study-time use).

NOT served: `mid-hand-chris` (excluded per red line #8); `between-hands-chris` (excluded — leak count card lives on HRV review-mode chrome only, not on live game surfaces).

---

## Anatomy

### Phase-5a (WS-159 / SPR-042) — shipping today

**Curriculum tab (default landing):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ SelfCoachView                                                       │
│ [ Curriculum* ][ Settings ]                                         │
│ ──────────────────────────────────────────────────────────────────  │
│                                                                     │
│ Currently focused on cbet-defense-cluster                           │
│ Next teachable: ip-cbet-defense-medium-LATE   [ Why ▾ ]             │
│                                                                     │
│ ── Tier 1 ──                                                        │
│ ◆ pot-odds (general)              drill 0.5     composite 0.25      │
│                                                                     │
│ ── Tier 2 ──                                                        │
│ ▶ bb-defense-cluster (umbrella)   leak ●        composite 0.50      │
│                                                                     │
│ ── Tier 3 ──                                                        │
│ ▼ cbet-defense-cluster (umbrella) leak ●●       composite 0.71      │
│     ip-cbet-defense-dry-LATE      leak ●        composite 0.40      │
│     ip-cbet-defense-medium-LATE   leak ●        composite 0.45      │
│     ip-cbet-defense-wet-LATE      —             composite 0.10      │
│     ip-cbet-defense-dry-MIDDLE    —          [Lesson coming] 0.08   │
│     ip-cbet-defense-medium-MIDDLE —          [Lesson coming] 0.08   │
│     ip-cbet-defense-wet-MIDDLE    —          [Lesson coming] 0.08   │
│ ▶ oop-cbet-defense-cluster        leak ●        composite 0.55      │
│ ◆ range-vs-range-thinking (general) drill 0.6   composite 0.30      │
│ ◆ board-texture (general)         drill 0.7     composite 0.25      │
│                                                                     │
│ ── Tier 4 ──                                                        │
│ ▶ flop-vs-donk-defense-cluster    leak ●        composite 0.60      │
│ ◆ blocker-effects-preflop (general) —           composite 0.15      │
│                                                                     │
│ ── Tier 5 ──                                                        │
│ ◆ capped-vs-uncapped-ranges (general) —         composite 0.10      │
│                                                                     │
│ [tap a composite badge to inspect; tap a row to drill]              │
└─────────────────────────────────────────────────────────────────────┘
```

**Composition inspector (inline expand-on-click on a composite badge):**

```
  ip-cbet-defense-medium-LATE      composite 0.45  [▲ collapse]
  ┌─────────────────────────────────────────────────────────────┐
  │ Concept                                                     │
  │   ip-cbet-defense-medium-LATE (rule-anchored-specific)      │
  │   Tier 3 · parent: cbet-defense-cluster                     │
  │                                                             │
  │ Signals contributing                                        │
  │   leak    (W=0.5) × severity 0.6  =  0.30                   │
  │   drill   (W=0.3) × (1 − 0.5)     =  0.15                   │
  │   test    (W=0.15) × (1 − 0.0)    =  0.15  [no test data]   │
  │   recent  (W=0.05) × penalty 0.0  = −0.00                   │
  │   ────────────────────────────────────────                  │
  │   composite                       =  0.60                   │
  │   normalized to [0,1]             =  0.45                   │
  │                                                             │
  │ Sample basis                                                │
  │   leak: 30 hands (above n=30 floor; 95% CI [38%, 66%])      │
  │   drill: 4 attempts; last 2026-05-04                        │
  │   test: pending (test_substrate not yet authored)           │
  │   recency penalty: linear decay over 30 days                │
  │                                                             │
  │ Methodology note                                            │
  │   composite = Σ(W_i × signal_i) − W_recent × recencyPenalty │
  │   See `src/utils/skillAssessment/composite.js` for details. │
  └─────────────────────────────────────────────────────────────┘
  [ Drill this ]
```

**Settings tab:**

```
┌─────────────────────────────────────────────────────────────────┐
│ SelfCoachView                                                   │
│ [ Curriculum ][ Settings* ]                                     │
│ ──────────────────────────────────────────────────────────────  │
│                                                                 │
│ Owner tier (authoring metadata only)                            │
│   ◯ (unset)                                                     │
│   ◯ novice                                                      │
│   ◯ live-rec                                                    │
│   ◉ studied-amateur                                             │
│   ◯ part-time-grinder                                           │
│   ◯ serious-grinder                                             │
│   ◯ pro                                                         │
│   ⓘ Authoring metadata only; never rendered as rank elsewhere. │
│                                                                 │
│ Signal toggles                                                  │
│   [ON]  Leak signal      (heroLeaksStore observations)          │
│   [ON]  Drill signal     (per-concept drill mastery)            │
│   [ON]  Test signal      (per-concept opt-in test results)      │
│   [ON]  Recency penalty  (linear decay on stale signals)        │
│                                                                 │
│ Signal weights (composite formula; discrete 0.1 steps)          │
│   W_leak     [——●—————]  0.5                                    │
│   W_drill    [—●———————]  0.3                                   │
│   W_test     [●————————]  0.15                                  │
│   W_recent   [●————————]  0.05                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Curriculum tab (default landing):** descriptor header (sentence summary + "next teachable" recommendation badge with `[Why ▾]` expansion) → tier-grouped concept tree. Umbrellas (▶/▼ glyph) collapse-expand on tap; general-skills (◆ glyph) sit at their tier inline; sub-concepts (• glyph; rendered greyed with `[Lesson coming]` tag when no lesson file exists) appear under their umbrella when expanded. Empty-lesson rows have Drill-this disabled.
- **Settings tab:** owner-tier radio (7 options: unset + 6 enum values) + 4 signal toggles (button-pair pattern, `aria-pressed`) + 4 discrete-step sliders (`step="0.1"`, `min="0"`, `max="1"`).
- **Composition inspector:** inline expand-on-click pattern matching `HeroCoachingCard` CD-5 structure at `src/components/views/HandReplayView/HeroCoachingCard.jsx:129-213`. Reveals 4 fields (Concept / Signals contributing / Sample basis / Methodology note).

### Phase-5b+ (deferred — surface vision retained for follow-up tickets)

The original SCF Gate 4 spec proposed a 3-section Study tab (Hero leaks / Curriculum / Tests history & browse) plus cadence-reminder controls in Settings. Today's Phase-5a slice ships only the Curriculum + Settings shape. The deferred sections retain their canonical IA per the original spec for follow-up tickets:

- **Hero leaks aggregation section** (deferred — Phase 5b): roll-up of fired leaks above n=30 floor with `[Drill this]` affordances. `HeroCoachingCard` already shows the same data inline in HandReplay; Phase-5a defers the aggregation surface until usage data shows the count-summary is missed.
- **Tests history & browse section** (deferred — Phase 5c, blocked on test substrate): chronological per-concept quiz results + "Browse all concept quizzes" expansion. All `lessonRegistry` entries today have `test_substrate: pending`; section unships until substrate authoring lands.
- **Cadence-reminder controls** (deferred — Phase 5b): opt-in cadence-reminder toggle in Settings. Per surface-specific Gate 1 entry audit (2026-05-06): nudging the user to study would violate the spirit of autonomy red line #5; user navigates to SelfCoachView deliberately.

## State

- **UI (`useUI`):** `currentScreen: SCREEN.SELF_COACH`, active tab (`'curriculum' | 'settings'` — local view state, NOT in `uiReducer`).
- **Settings (`useSettings`):** `settings.selfCoach.signalToggles` / `signalWeights` / `ownerTier` (action types: `SET_SELF_COACH_SIGNAL_TOGGLE` / `SET_SELF_COACH_SIGNAL_WEIGHT` / `SET_SELF_COACH_OWNER_TIER` — wired at `src/reducers/settingsReducer.js:155-209`).
- **SCF infra reads (Phase-5a):**
  - `tierConceptMap.CONCEPT_REGISTRY` + helpers (`getAllConceptIds`, `getChildrenOf`, `getParentOf`, `listConceptsForTier`).
  - `conceptMastery.listAllConceptMastery(userId)` → array of per-concept signal vectors (`{leakSignal, drillSignal, testSignal, recencyPenalty, meta}`).
  - `composite.computeComposites(masteries, {weights, toggles})` → scored array.
  - `composite.pickNextTeachableConcept(userId, options)` → recommendation.
  - `learningStateDescriber.describeLearningState(masteries, {granularity:'general', weights, toggles})` → `{summary, focusConcepts, composition}`.
  - `lessonRegistry.getLesson(conceptId)` (per-row lesson lookup; null when no lesson authored → triggers greyed + "Lesson coming" rendering).
- **Player (`usePlayer`):** N/A — single-user (`playerId: 'self'`) at v1.
- **IDB reads (transitive via skillAssessment modules; SelfCoachView is whitelisted consumer):**
  - `heroLeaks` store (via `conceptMastery`).
  - `drillResults` (via `conceptMastery` for drill signal aggregation).
  - `settings.selfCoach.*` (via `useSettings` hook → `settingsStore` IDB-persisted).
- **IDB writes (Phase-5a):**
  - `settings.selfCoach.signalToggles[name]` (Settings tab toggle dispatch).
  - `settings.selfCoach.signalWeights[name]` (Settings tab slider dispatch; clamped 0–1, snapped to 0.1 step).
  - `settings.selfCoach.ownerTier` (Settings tab radio dispatch; null + 6 enum values).
- Writes are owner-explicit only. No silent-inference writes (per AP-SCF-03). No SCF data writes from this surface other than settings — leak fire-state, drill results, and test results are produced by their respective producer surfaces (HandReplay, drill engine).
- **Phase-5b+ deferred state:** Tests-history reads (`testResults[]`) + cadence-reminder writes are deferred per Phase-5a scope.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions (Phase-5a)

1. **Tab switch** — tap `Curriculum` or `Settings` button → re-renders body; default landing is Curriculum. Local view state only (no URL/uiReducer change).
2. **Umbrella expand/collapse** — tap an umbrella row's name or `▶`/`▼` glyph → toggles `expanded` in local state for that umbrella; children render below when expanded. Independent per-umbrella.
3. **Composition inspector open/close** — tap a row's composite-score badge → inline-expand-on-click reveals the 4-field CD-5 inspector below the row. Tap again to collapse. Mirrors `HeroCoachingCard.jsx:129-213` pattern. Test IDs: `data-testid="cd5-field-{concept,signals,sample,methodology}"`.
4. **`Drill this`** — tap on a row with a non-null `getLesson(conceptId)` result → navigates to `LessonDetailView` with `conceptId` param (existing route used by HeroCoachingCard's Drill-this affordance). Disabled / hidden on rows where `getLesson(conceptId)` returns null.
5. **`Why ▾` (next-teachable badge)** — tap → expands the descriptor's `composition` object as a CD-5 inspector at the header level (same shape as the per-concept inspector, but scoped to the descriptor's top-N focus concepts).
6. **Settings — owner-tier change** — radio tap → dispatches `SET_SELF_COACH_OWNER_TIER` with the selected value (or null for unset). Only place in the app where rank labels render. No N05-confirm message in Phase-5a; ownerTier is authoring metadata and reversible by the same radio.
7. **Settings — signal toggle** — tap a toggle button → dispatches `SET_SELF_COACH_SIGNAL_TOGGLE` with `{name, enabled}`. Curriculum tab composites recompute via the shared `useSelfCoachMastery` hook on next render.
8. **Settings — signal weight slider** — drag/tap a slider → dispatches `SET_SELF_COACH_SIGNAL_WEIGHT` with `{name, weight}` snapped to 0.1 step. Composites recompute identically to toggle.

**Phase-5b+ deferred interactions:** Hero-leak item tap-to-expand, Tests-history list, Tests-browse expansion, cadence-reminder toggle.

---

## Known behavior notes

- **n=30 floor enforcement** — Hero leaks section MUST NOT render any situation key with sample size < 30 hands (per AP-SCF-04). Sub-floor situation keys can be surfaced in Phase 2+ debug view with explicit factual placeholder, not in v1.
- **Source-util-policy whitelist** — SelfCoachView is a whitelisted read source for the `heroLeaks` store. CI-grep enforcement at Gate 5 (SCF-G4-SUP).
- **Curriculum section default state** — when `userSettings.tier.current` is unset (first visit before owner uses Settings), Curriculum section renders empty state copy: "Set your tier in Settings to see your next-teachable concept." Per AP-SCF-03, no inferred-tier suggestion in v1.
- **Tests section sort** — chronological (most recent first). No streak ordering, no by-concept aggregation, no progress-bar.
- **Opt-in-test launch flow** — per-concept `Test myself` button → drill engine pickMatchup with frameworkId filter → 5 questions → factual result modal ("4 of 5 correct") → write to `userSettings.perDomainMastery[conceptId].testResults[]` → return to lesson card.

## Known issues

(None — surface is spec'd at SCF Gate 4; first audit findings will land at Gate 5 implementation review.)

## Potentially missing

- **Inferred-tier-with-confirmation** (Phase 2+ per AP-SCF-03 Allowed alternative — surface "Observed play suggests `studied-amateur`. Confirm or amend?")
- **Per-test incognito mode** (Phase 2+ — see Gate 4 audit doc Open question §6)
- **Snooze-duration owner-configurability** (v1 hardcoded 7-day default; Gate 5 may surface in Settings)
- **Reset-all-SCF-data affordance** (Phase 2+ per red line #4 reversibility — full data wipe)

---

## Test coverage

**Phase-5a (this slice):**
- `SelfCoachView.test.jsx` — shell render, tab switching, back-nav.
- `CurriculumTab.test.jsx` — descriptor header, next-teachable badge, tier-grouped tree, umbrella expand/collapse, empty-lesson greyed rendering, Drill-this disabled on empty-lesson rows.
- `CompositionInspector.test.jsx` — CD-5 4-field discipline (`data-testid="cd5-field-*"`), expand-on-click, signal-contribution math reflection.
- `SettingsTab.test.jsx` — owner-tier radio dispatch, signal-toggle dispatch, signal-weight slider dispatch with discrete-step snap enforcement.
- `SelfCoachView.copy-discipline.test.jsx` — forbidden-rank-label lint (Curriculum tab DOM scrape; rank labels render only inside the owner-tier radio); engagement-pressure copy lint (no `wrong|missed|score|streak|level up|grade|great job|well done|excellent|you (are|need|should|must)` matches anywhere); tier-as-rank lint (tier indicators stay as "Tier N" form, never expand to rank words).
- Source-util-policy `src/utils/persistence/__tests__/sourceUtilPolicy.test.js` — verify SelfCoachView is NOT in the blacklisted live-table surface list; running the test post-impl confirms boundary preserved.
- Playwright visual regression `tests/playwright/self-coach-view.spec.js` — chromium-only (matches SPR-041 PRF-style precedent): `curriculum-tab-collapsed`, `curriculum-tab-cbet-expanded`, `composition-inspector-open`, `settings-tab` baselines @ 1600×720.

**Phase-5b+ deferred coverage:** Hero-leaks aggregation tests, Tests-history tests, cadence-reminder tests, integration tests for HRV→SelfCoachView deep-link scroll.

- Anti-pattern + copy-discipline + 9 red lines walkthroughs in surface-specific Gate 1 audit (`audits/2026-05-06-entry-self-coach-view.md`); PR review re-walks for compliance verification.

## Related surfaces

- `hand-replay-view` — upstream (HRV inline annotations feed Hero leaks section via shared `heroLeaks` IDB store; HRV `Drill this` affordance deep-links to SelfCoachView Curriculum section).
- `lesson-card` — child surface (Curriculum section items expand to lesson card detail; Tests history section references concept IDs from lesson cards).
- `skill-assessment-test` — opt-in-test mode of drill surfaces; entry from lesson card `Test myself` button.
- `leak-distillation` — pipeline UI (the cross-surface flow that produces the Hero leaks section data + HRV inline annotations).
- `postflop-drills` / `preflop-drills` — drill surfaces gain opt-in-test mode for the 5 drill-backed concepts.
- `settings-view` — N/A direct — SCF Settings is a tab within SelfCoachView, not a section in the global SettingsView. (Gate 4 decision: SCF Settings is co-located with the SCF data it gates.)
- `calibration-dashboard` — CO-56 hero behavioral change view reuses Calibration Dashboard primitives (parameterized credible-interval-over-time + drift arrow). KEEP SEPARATE per SCF Gate 2 §B Stage B verdict.

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). 2-tab IA (Study / Settings) per Decision 1; Study tab is sectioned scroll with 3 sections (Hero leaks / Curriculum / Tests history & browse). Per-concept `Test myself` button on lesson card + dedicated Tests section in Study tab per Decision 3 reconciliation. CO-57 stays Proposed v2-deferred per Decision 4. Anti-pattern + copy-discipline + 9 autonomy red lines walkthroughs all cleared. Implementation deferred to Gate 5 multi-PR.
- 2026-05-06 — Phase-5a slice update (WS-159 / SPR-042). Tab labels renamed (Study → Curriculum, scope-to-the-section-that-ships). Curriculum mockup updated to tree IA (umbrella → expand → children) per founder decision; flat-list mockup retained for Phase-5b reference. Settings tab extended with Signal toggles (4 booleans) + Signal weight sliders (4 discrete 0.1 steps); ownerTier radio kept (now 7 options including unset). Composition inspector spec'd with full CD-5 4-field structure mirroring `HeroCoachingCard.jsx:129-213`. State section rewritten to reflect post-WS-148 settings shape. Hero-leaks aggregation + Tests-history-and-browse + cadence-reminder controls explicitly DEFERRED to Phase-5b+ follow-up tickets (rationale: `audits/2026-05-06-entry-self-coach-view.md`). Test-coverage section split Phase-5a (today) vs Phase-5b+ (deferred). All 8 binding constraints (red lines #5/#8, AP-SCF-01/03, AP-06, descriptor-not-rank, owner-volunteered grading, source-util-policy) re-verified against today's slice — all hold.
