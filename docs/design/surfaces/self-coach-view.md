# Surface — SelfCoachView

**ID:** `self-coach-view`
**Code paths:**
- `src/components/views/SelfCoachView/` (Phase 5 — not yet implemented; spec'd at SCF Gate 4)
- `src/utils/skillAssessment/` (Phase 5 — thin aggregation layer; see `docs/projects/self-coach-foundation/skill-assessment-module.md`)

**Route / entry points:**
- `SCREEN.SELF_COACH` (Phase 5 — to be added to `uiReducer.js`)
- Opens from: main nav + HRV inline-leak `Drill this` affordance (deep-links to specific lesson card in Curriculum section)
- Closes to: caller (usually main nav or HRV)

**Last reviewed:** 2026-05-02 (created at SCF Gate 4)

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

```
┌──────────────────────────────────────────────┐
│ SelfCoachView                                │
│ [ Study* ][ Settings ]                       │
│ ───────────────────────────────────          │
│                                              │
│ ▾ Hero leaks (4 above n=30 floor)            │
│   ⚑ Hero IP cbet defense — fold-to-cbet     │
│     52% [38%, 66%] over 30 hands             │
│     Solver baseline: 38%                     │
│     [ Drill this ]                           │
│   ⚑ Turn double-barrel — barreling rate     │
│     38% [22%, 54%] over 34 hands             │
│     Solver baseline: 52%                     │
│     [ Drill this ]                           │
│   …                                           │
│                                              │
│ ▾ Curriculum                                 │
│   Tier (owner-set): studied-amateur          │
│   Next teachable: cbet-defense               │
│     [ Why this concept? ▾ ]                  │
│                                              │
│   • Cbet defense fundamentals      [Open][Test] │
│     Drilled (last: 2026-04-28; 5 sessions)   │
│   • Range-vs-range thinking        [Open][Test] │
│     Drilled (last: 2026-04-25; 3 sessions)   │
│   • Polarization vs linear sizing  [Open]    │ ← test_substrate: pending; button disabled
│     Not yet drilled                          │
│   …                                           │
│                                              │
│ ▾ Tests history & browse (3 quizzes)         │
│   2026-04-29  Cbet defense       4 of 5      │
│   2026-04-25  Polarization quiz  3 of 5      │
│   2026-04-22  Pot odds           5 of 5      │
│   [ Browse all concept quizzes ▾ ]           │
│                                              │
└──────────────────────────────────────────────┘
```

**Settings tab:**

```
┌──────────────────────────────────────────────┐
│ SelfCoachView                                │
│ [ Study ][ Settings* ]                       │
│ ───────────────────────────────────          │
│                                              │
│ Tier                                         │
│   ◯ novice                                   │
│   ◯ live-rec                                 │
│   ◉ studied-amateur                          │
│   ◯ part-time-grinder                        │
│   ◯ serious-grinder                          │
│   ◯ pro                                      │
│   Last set: 2026-04-22                       │
│   ⓘ Tier change persists; observed-play     │
│      inferences not reset.                   │
│                                              │
│ Cadence reminder                             │
│   ◉ OFF (default)                            │
│   ◯ ON  Cadence: [ ____ ] day(s)             │
│                                              │
│ Last study session: 2026-04-29               │
│                                              │
└──────────────────────────────────────────────┘
```

- **Study tab (default landing):** sectioned scroll; 3 sections (Hero leaks / Curriculum / Tests history & browse).
- **Settings tab:** Tier-set radio + N05 confirm + cadence reminder opt-in + last-study timestamp.

## State

- **UI (`useUI`):** `currentScreen: SCREEN.SELF_COACH`, active tab (`'study' | 'settings'`).
- **SkillAssessment (`useSkillAssessment` — Phase 5):** per-concept mastery state, curriculum-spine ranked concept list, hero-leak inventory, opt-in-test history.
- **Player (`usePlayer`):** N/A — single-user (`playerId: 'self'`) at v1.
- **IDB reads:**
  - `heroLeaks` store — situation keys + observed rates + credible intervals + sample sizes (Hero leaks section).
  - `userSettings.tier` — current tier + lastSetAt + source (Settings tab + Curriculum section header).
  - `userSettings.perDomainMastery` — per-concept mastery state + testResults[] (Curriculum section + Tests history section).
- **IDB writes:**
  - `userSettings.tier.current` (Settings tab — owner-set).
  - `userSettings.perDomainMastery[conceptId].testResults[]` (appended on opt-in-test completion; via `skillAssessment` module).
- Writes are owner-explicit only. No silent-inference writes (per AP-SCF-03).

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Tab switch** — tap `Study` or `Settings` chip → re-renders body; default landing is Study.
2. **Hero leak item tap** — tap on collapsed leak row → expands inline to full CD-5 claim card with `Drill this` affordance.
3. **`Drill this` (from leak card)** — navigates to lesson card matching `leak.relatedConceptId` in Curriculum section (scrolls to + highlights).
4. **Curriculum item: `Open`** — opens lesson card detail (full exposition prose + worked examples).
5. **Curriculum item: `Test myself on this concept`** — when `test_substrate: 'drill'`, launches drill engine in opt-in-test mode scoped to lesson's `frameworkIds[]`. When `test_substrate: 'pending'`, button is disabled; tap surfaces factual placeholder copy.
6. **`Why this concept?` expand** — surfaces per-signal breakdown of composite score (W_leak / W_drill / W_test / W_recent contributions).
7. **Tests history `Browse all concept quizzes`** — expands to flat list of concepts with `test_substrate: 'drill'`; per-concept `Take quiz` / `Retake` buttons.
8. **Settings tier-set change** — radio tap → persists `userSettings.tier.current`; N05 confirm message renders inline if change is downward.

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

- Component-level tests at Gate 5: `SelfCoachView.test.jsx`, `HeroLeaksSection.test.jsx`, `CurriculumSection.test.jsx`, `TestsHistorySection.test.jsx`, `TierSetRadio.test.jsx`.
- Integration tests at Gate 5: tier-set → curriculum-spine ranking refresh; opt-in-test completion → testResults[] persistence + Tests history append; deep-link from HRV inline annotation `Drill this` → SelfCoachView Curriculum section scroll.
- Visual verification at Gate 5: 1600x720 layout for all 3 Study sections + Settings tab + N05 confirm message inline render.
- Anti-pattern + copy-discipline + 9 red lines walkthroughs in audit doc; Gate 5 PR review re-walks for compliance verification.

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
