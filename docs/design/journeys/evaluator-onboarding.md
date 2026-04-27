# Journey — Evaluator Onboarding

**ID:** `evaluator-onboarding`
**Product line:** Main app. Extension (Ignition sidebar) inherits the E-IGNITION variation if/when Q3 re-verdicts (Phase 2+); deferred in Phase 1.
**Primary persona:** [Evaluator](../personas/core/evaluator.md) in [trial-first-session](../personas/situational/trial-first-session.md) or [returning-evaluator](../personas/situational/returning-evaluator.md) state.
**Tier placement:** Free (universal first-run + return-visit flow; applies regardless of paid state).
**Last reviewed:** 2026-04-24 (Gate 4 Batch 2)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Gate 3 (Q10=B keeps Evaluator unified with E-CHRIS/E-SCHOLAR/E-IGNITION as attributes)
- `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q5 (session-scoped free) + §Q10 (evaluator unified)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-10 (pre-paywall friction) + §MPMF-AP-14 NEW (onboarding-lock-in)
- `docs/projects/monetization-and-pmf/assumption-ledger.md` §M13 (first-60-sec wow make-or-break) + §M14 (returning-evaluator conversion)
- `docs/design/jtbd/domains/onboarding.md` §ON-82 (90-sec full tour) + §ON-84 (skip for pros) + §ON-86 (sample data) + §ON-88 (expert-bypass fast orientation)
- `docs/design/jtbd/domains/subscription-account.md` §SA-71 (try-before-paying) + §SA-72 (understand-free-vs-paid)
- `docs/design/surfaces/telemetry-consent-panel.md` (consent panel fires BEFORE onboarding; both are pre-app-routing)
- `docs/design/personas/core/evaluator.md` §Evaluator sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION)
- `docs/design/personas/situational/trial-first-session.md`
- `docs/design/personas/situational/returning-evaluator.md`

---

## Purpose

Bring new and returning evaluators into the app's value quickly, without friction, and without forcing a persona they don't fit. The journey resolves three cognitive states:
- **Category-new evaluator** (never used a poker tracker) — needs full tour (ON-82).
- **Category-experienced evaluator** (knows trackers; first time on THIS app) — needs fast orientation (ON-88).
- **Pro-in-this-app evaluator** (already knows this app from previous install/demo) — needs to skip (ON-84).

Plus two compound cases:
- **At-table evaluator** — installed earlier today; opens app at a live table. Degraded first-experience path accepts less orientation in exchange for immediate value.
- **Returning evaluator** — came back after 2+ day drift. Resume-vs-start-fresh choice at re-entry.

**60-second wow threshold (M13)** is the make-or-break metric. If any variation fails to deliver one useful thing inside 60 seconds, the journey is wrong and triggers re-design.

Non-goals (explicit):
- **Not a signup wall.** Evaluator can complete the entire journey without creating an account. Account creation is offered at paywall-hit moments (J2) or user-initiated feature actions, never as gate.
- **Not a marketing pitch.** No "Welcome! Here's everything the app does!" monologue. Orientation is functional, not promotional.
- **Not a tier-sales surface.** Pricing page is a separate surface (S1); onboarding never embeds commerce pressure.
- **Not a forced path.** Every variation has a Skip button at equal visual weight (ON-84 doctrine).

---

## JTBD served

**Primary:**
- **`JTBD-ON-82`** — 90-second product tour (Variation A — Full tour path).
- **`JTBD-ON-88`** — Expert-bypass fast orientation (Variation B — Fast orientation path).
- **`JTBD-ON-84`** — Skip onboarding (Variation C — Skip path).
- **`JTBD-SA-71`** — Try before paying (all variations — no signup gate).
- **`JTBD-ON-86`** — Sample data for evaluation (shared component; accessible from any variation).

**Secondary:**
- **`JTBD-CC-79`** — Navigation that returns to prior position (Variation E — Returning-evaluator resume).
- **`JTBD-SA-72`** — Understand what's free/paid/why (tier-state indicator visible post-onboarding; not explained during onboarding).

---

## Personas served

**Primary:**
- **`trial-first-session` situational** — variation triggered on first-launch post-install; 5–15 min window; 60-second wow threshold binding.
- **`returning-evaluator` situational** — variation triggered when last-session-gap > 2 days; resume-vs-fresh choice.

**Core personas, by sub-shape attribute in `evaluator.md`:**
- **E-CHRIS** (live-poker player evaluator) — routes to Variation B fast orientation + primes live-hand-entry surface. At-table trial triggers Variation D.
- **E-SCHOLAR** (drills-only evaluator) — routes to Variation B fast orientation + primes drills surface.
- **E-IGNITION** (Chrome-extension evaluator) — Phase 2+ only (deferred per Q3=C). Placeholder variation reserved.

**Other personas relevant (not primary but inherit):**
- **`newcomer`** (truly new to poker) — may fall into Variation A if they're also category-new to trackers. Onboarding.md ON-82/83/86 cover; this journey doesn't redesign newcomer experience.
- **`mid-hand-chris`** / **`between-hands-chris`** — Variation D (at-table) is the only path where these situationals apply during onboarding.

**Explicitly NOT served:**
- **Already-committed users** (Chris, Scholar, any paying user on re-install) — if entitlement state persists in local IDB (no data loss on reinstall), the journey detects prior entitlement and skips onboarding to main app. If IDB was cleared (true fresh install), these users see the journey but typically select Variation C Skip.

---

## The 5 variations

Each variation is a named flow; picker is first-run decision point (plus auto-detect for Variation D/E triggers).

### Variation A — Full tour (ON-82 path)

**Trigger:** User explicitly selects "I'm new to poker trackers — show me around" at the first-run variation picker.

**Flow:**

```
AppRoot mount (post-telemetry-consent-panel dismissal)
 → firstLaunchSeen === true, tier === 'free', no prior onboarding seen
 → Variation picker modal: 3 cards (Full tour / Fast orientation / Skip)
 → User taps "Full tour (3 min)"
 → FullTourFlow state: step 1 of 7
    Step 1: "Here's the table view — where you log hands"
            (1-line explainer + arrow pointing at TableView)
    Step 2: "The exploit engine surfaces recommendations during hands"
            (arrow at LiveAdviceBar slot)
    Step 3: "Drills help you train off-table"
            (arrow at Drills nav entry)
    Step 4: "Your session history lives here"
            (arrow at Sessions nav entry)
    Step 5: "Change anything in Settings; your data stays local"
            (arrow at Settings nav entry)
    Step 6: "Try with sample data or start fresh?"
            (2 buttons: "Load sample hands" / "Start fresh")
    Step 7: "You're set. Hit Continue to begin."
            (single Continue button)
 → On Continue, load routed to main-app TableView (or Drills if Scholar sample selected).
```

**Copy register:** C5 factual. Step copy is ≤ 12 words each. No marketing language.

**Skip affordances:** every step has a "Skip tour" link at equal visual weight. Skipping at any step → go to Step 7's Continue action.

**Time budget:** 90 seconds for user who reads every step; 30 seconds for user who quick-taps through. Both within wow threshold.

---

### Variation B — Fast orientation (ON-88 path)

**Trigger:** User explicitly selects "I've used trackers before — show me this app's layout" at the first-run variation picker.

**Flow:**

```
Variation picker → User taps "Fast orientation (60 sec)"
 → FastOrientationFlow state: single-screen overlay
 → Screen 1: overlay points out 4 key areas:
     - Table view (here)
     - Exploit engine output (here)
     - Drills (here)
     - Settings (here)
 → 3 sub-shape detection hints appear as secondary cards BELOW the overlay:
     "I play live poker" → primes TableView; suggests "Try a live hand"
     "I study with drills" → primes Drills; suggests "Try a drill"
     "I use Ignition" → [Phase 2+ — placeholder] "Sidebar coming"
 → User taps any card → routed directly to that surface with sample-data available
 → OR user taps "Got it" → routed to TableView default (no sub-shape hint)
```

**Copy register:** C5 factual. Sub-shape cards are factual labels, not aspirational.

**Time budget:** ≤ 60 seconds to routed-in-main-app. 60-second wow threshold (M13) binding here.

**Sub-shape persistence:** if user selects a sub-shape card, the choice writes to `settings.onboarding.evaluatorSubShape = 'E-CHRIS' | 'E-SCHOLAR' | 'E-IGNITION'`. This is used later by upgrade-prompt-inline (MPMF-G4-S3) to tailor copy. User can clear this in Settings (or never-picks at all — surface defaults are always available).

**E-IGNITION placeholder:** shown but greyed-out with tooltip "Chrome extension — coming in Phase 2." No deep-link to an unshippable surface.

---

### Variation C — Skip (ON-84 path)

**Trigger:** User explicitly selects "Skip — let me just use it" at the first-run variation picker.

**Flow:**

```
Variation picker → User taps "Skip (straight to app)"
 → Writes `settings.onboarding.skipped = true`
 → Dismiss picker
 → Routed to TableView default (main-app home)
```

**Copy register:** none (Skip is an action, not a sequence).

**Time budget:** < 5 seconds.

**Re-open affordance:** user can re-launch Variation A or B anytime from Settings → Help → "Take the tour." Discoverable but non-intrusive.

---

### Variation D — At-table degraded experience

**Trigger:** auto-detect. User completes first-launch panel + dismisses variation picker (any variation) WHILE an active session is in progress (IDB detects live-session state from extension or prior session).

**Flow:**

```
Variation picker dismissed → about-to-route to app
 → Detect: is there a session active OR was last session < 10 min ago?
 → If yes → AT-TABLE variation:
   - Skip variation picker entirely OR mark it "dismissed-auto"
   - Route DIRECTLY to TableView
   - Suppress all overlays / tooltips / first-run cues
   - Surface a subtle banner at top: "Tour skipped — at-table mode. Tap to resume later."
   - Banner dismissable; re-firable from Settings → Help
```

**Copy register:** C5 factual. Banner copy: "Tour skipped — at-table mode. Tap to resume later." No urgency.

**Time budget:** 0 seconds delay. User sees TableView immediately.

**Rationale:** Per Gate 2 Stage C, some E-CHRIS evaluators trial at-table. Blocking them with onboarding is worse than a degraded first-experience. Pokeri precedent (live iOS tracker) supports at-table trial.

**Degradation scope:**
- Sample-data mode NOT auto-loaded (would confuse an active session).
- Live-exploit engine fires normally (free-tier).
- Tour is re-fireable later (banner + Settings → Help).

---

### Variation E — Returning-evaluator resume

**Trigger:** auto-detect. User opens app after > 2 day gap; `firstLaunchSeen === true`; has prior session data.

**Flow:**

```
AppRoot mount → detect: `daysSinceLastSessionEnd > 2`
 → ResumeOrFreshModal:
     "Welcome back. Your last session: N hands, [X] days ago."
     [ Resume from last session ]  [ Start fresh ]  [ Skip — I know what I'm doing ]
 → User picks "Resume from last session" → opens SessionsView filtered to last session
 → User picks "Start fresh" → opens TableView default
 → User picks "Skip" → opens TableView default (no guidance)
```

**Copy register:** C5 factual. No "we miss you!" (refused per MPMF-AP-04). No "hope you're doing well!" No emotional framing.

**Time budget:** ≤ 15 seconds to choose.

**State preservation invariant:** the user's prior data is NEVER destroyed. "Start fresh" opens TableView; it does NOT clear prior session data. Clearing data requires explicit Settings → Data → Reset action.

---

## Picker UI

First-run variation picker appears AFTER telemetry-consent-panel dismissal. Full-screen modal.

```
┌── How do you want to start? ───────────────────────────┐
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Full tour (3 min)                                  │ │
│  │ New to poker trackers? We'll walk through the 5   │ │
│  │ main screens.                                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Fast orientation (60 sec)                          │ │
│  │ Used trackers before? Just show me this app's     │ │
│  │ layout.                                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Skip — straight to the app                         │ │
│  │ I'll figure it out.                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Picker contract:**
- **3 cards at equal visual weight.** No "recommended" badge, no color distinction. All three are legitimate choices.
- **Card description** is factual (not "recommended for: ..." or "most users choose...").
- **Time estimate in card title** (3 min / 60 sec) is factual expectations-setting.
- **Tapping any card** commits the choice + dismisses picker. No confirmation step.
- **No "back" or close button at picker level.** User must pick. But any of the 3 cards is always acceptable.

---

## Copy discipline

### Forbidden strings (CI-lint at MPMF-G5-CL)

- `"Welcome!"` — aspirational greeting (ok as heading, refused in body copy).
- `"We miss you!"` — re-engagement copy (MPMF-AP-04).
- `"Ready to level up?"` — aspirational pressure (MPMF-AP-07).
- `"unlock your potential"` — aspirational (MPMF-AP-07).
- `"hope you're well"` / `"hope you're doing great"` — emotional framing.
- `"don't miss"` — loss framing.
- `"most users choose"` — social proof (MPMF-AP-02).
- `"act now"` / `"hurry"` / any timer urgency — MPMF-AP-01.

### Permitted patterns

- **Factual labels.** "Full tour (3 min)" / "Fast orientation (60 sec)" / "Skip" — duration + action.
- **Direct descriptions.** "We'll walk through the 5 main screens." / "Just show me this app's layout." — what happens.
- **Neutral greetings.** "Welcome back." (OK, factual). "Your last session: N hands, X days ago." (factual).
- **Action verbs.** "Continue" / "Resume" / "Start fresh" / "Got it" — all factual.

---

## Cross-surface consistency

### Shared components

- **Variation picker modal** (`EvaluatorOnboardingPicker.jsx`) — new at Phase 5.
- **Sample-data loader** (`SampleDataLoader.jsx`, new) — invoked by Variation A Step 6 ("Load sample hands"); loads 2–3 demo hands with realistic villain profiles. Shared with `surfaces/table-view.md` possibly.
- **Resume/fresh modal** (`ResumeOrFreshModal.jsx`, new) — Variation E entry.
- **Banner** (`AtTableBanner.jsx`, new) — Variation D "Tour skipped" banner; shares toast infrastructure.

### Telemetry events

Each variation fires a distinct event for Stream D Phase 1 analysis (assumption M13 + M14):
- `onboarding_variant_a_started` / `onboarding_variant_a_completed` / `onboarding_variant_a_skipped`
- `onboarding_variant_b_started` / `onboarding_variant_b_completed`
- `onboarding_variant_c_selected` (Skip chosen)
- `onboarding_variant_d_auto` (At-table auto-detected)
- `onboarding_variant_e_resume_chosen` / `onboarding_variant_e_fresh_chosen` / `onboarding_variant_e_skipped`

All events respect consent gate — if user opted out of `usageEvents` category, events dropped.

### Sub-shape write

Variation B's sub-shape picker writes to `settings.onboarding.evaluatorSubShape`. Downstream surfaces read this to tailor copy (e.g., upgrade-prompt-inline shows "Pro gives you multi-session villain tracking" for E-CHRIS vs "Pro unlocks advanced drills" for E-SCHOLAR). Never shown to user as a label; purely internal personalization.

User can clear this via Settings → Telemetry → "Clear personalization" (if feature shipped; otherwise via devtools only). This respects red line #9 (incognito) analog.

---

## Anti-patterns refused at this journey

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-04** — Re-engagement push notifications. Variation E returning-evaluator flow does NOT send push notifications or emails inviting users to return. Only surfaces when the user has re-opened the app themselves.
- **MPMF-AP-07** — "Missing out" loss-framing. No "Don't miss the exploit engine!" copy. Copy is factual descriptions only.
- **MPMF-AP-10** — Pre-paywall friction. Onboarding is NOT a paywall. No signup required to progress through any variation. No email capture. No account creation forced.
- **MPMF-AP-14 NEW** — Onboarding-lock-in. Skip is always available at every step of every variation. User can exit to main app at any moment. Tour cannot trap the user.

**New anti-pattern identified during this authoring** (promoted to `anti-patterns.md`):
- **MPMF-AP-14 NEW — Onboarding-lock-in.** Forcing users through a tutorial they didn't ask for, or making Skip difficult to find. Refused.

---

## Red-line compliance checklist (Gate 5 test targets)

Maps to MPMF-G5-RL backlog:

- **#1 Opt-in enrollment for data collection** — onboarding fires AFTER telemetry-consent panel; events in this journey respect consent gate. Test: with `usageEvents` opted out, onboarding events are silent.
- **#2 Full transparency on demand** — each variation card states duration + action factually; no hidden flow.
- **#3 Durable overrides** — Skip is durable (written to IDB); doesn't re-prompt full tour every launch.
- **#4 Reversibility** — any variation re-triggerable via Settings → Help → "Take the tour." Tested.
- **#5 No streaks / shame / engagement-pressure** — no "you haven't finished the tour!" re-prompt. No streak mechanics. No "20% of users skip this tour!" social pressure.
- **#6 Flat-access** — all 3 variation cards at equal visual weight. No "recommended" badge.
- **#7 Editor's-note tone** — all copy factual; forbidden-string list enforced at CI.
- **#8 No cross-surface contamination** — onboarding never renders on live-play. Variation D suppresses all overlays when session is active.
- **#9 Incognito observation mode** — sub-shape write (E-CHRIS/E-SCHOLAR/E-IGNITION) is opt-in; respects telemetry consent gate.
- **#10 No dark-pattern cancellation** — N/A directly (cancellation-specific); but the principle extends: Skip is always one-tap, never interposed.

---

## Known behavior notes

- **First-launch panel (telemetry consent) fires BEFORE this journey.** Order is: AppRoot mount → telemetry panel → variation picker → variation flow → app.
- **Variation D (at-table) is the only auto-detect path.** All others are user-initiated through the picker. Auto-detect reduces friction for the specific case where a user installed earlier and is now at a table.
- **Sample-data mode is a component, not a variation.** Accessible from Variation A Step 6 and from TableView if user routes there without picking sample data first (Settings → Data → "Load sample hands" entry point).
- **Variation E's 2-day threshold is a UI heuristic.** Actual kill-criterion for "is 2 days the right threshold" lives in `assumption-ledger.md` assumption RE1 / M14 — will validate via telemetry.
- **E-IGNITION sub-shape card in Variation B is greyed-out** in Phase 1 per Q3=C. If a user taps it, they see "Chrome extension — Phase 2 feature. For now, main app only." No hidden deep-link.
- **Returning-evaluator conversion rate is assumption M14** — the hypothesis is that returning-evaluator converts at HIGHER rate than first-session. Stream D will measure.

---

## Known issues

None at creation — new journey. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [EV-ONB-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `EvaluatorOnboardingPicker.test.jsx` — 3 cards render; each selects corresponding variation.
- `FullTourFlow.test.jsx` — 7-step progression; skip-at-any-step; sub-shape none.
- `FastOrientationFlow.test.jsx` — 4-point overlay; sub-shape cards (3); sub-shape write on selection.
- `ResumeOrFreshModal.test.jsx` — fires when lastSession > 2 days; 3 buttons; data preservation invariant.
- `AtTableBanner.test.jsx` — auto-detect on active session; dismissable.

### Integration tests (Phase 5)

- `OnboardingJourney.e2e.test.jsx` — fresh-install flow: telemetry panel → picker → full tour → main app.
- `OnboardingReturningEvaluator.e2e.test.jsx` — 2-day gap simulation → ResumeOrFreshModal appears → resume path opens prior session.
- `OnboardingAtTable.e2e.test.jsx` — active session detected → variation D skips picker.
- Red-line assertion suite (MPMF-G5-RL).

### Visual verification

- Playwright MCP 1600×720 screenshot, 5 scenarios:
  1. Variation picker (3 cards).
  2. Full tour step 3 (exploit engine arrow).
  3. Fast orientation overlay with sub-shape cards.
  4. Returning-evaluator resume modal.
  5. At-table banner.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-J1-PICKER`
- `EVID-PHASE5-MPMF-J1-FULL-TOUR-STEP3`
- `EVID-PHASE5-MPMF-J1-FAST-ORIENTATION`
- `EVID-PHASE5-MPMF-J1-RESUME-FRESH`
- `EVID-PHASE5-MPMF-J1-AT-TABLE-BANNER`

---

## Phase 5 code-path plan

**New files (~7):**
1. `src/components/views/EvaluatorOnboardingPicker.jsx`
2. `src/components/views/EvaluatorOnboarding/FullTourFlow.jsx`
3. `src/components/views/EvaluatorOnboarding/FastOrientationFlow.jsx`
4. `src/components/views/EvaluatorOnboarding/ResumeOrFreshModal.jsx`
5. `src/components/views/EvaluatorOnboarding/AtTableBanner.jsx`
6. `src/components/views/EvaluatorOnboarding/SampleDataLoader.jsx`
7. `src/hooks/useEvaluatorOnboarding.js`

**Amended files (~3):**
- `src/reducers/settingsReducer.js` — `onboarding` sub-state (seen variants, skip state, sub-shape).
- `src/utils/persistence/database.js` — IDB migration adds `settings.onboarding` defaults.
- `src/components/views/AppRoot.jsx` — renders picker/variation after telemetry panel.

**Constants:**
- `src/constants/onboardingVariants.js` — variant enum + event names.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Batch 2 artifact (MPMF-G4-J1). 5 variations enumerated (Full tour / Fast orientation / Skip / At-table / Returning-resume) + picker UI + copy discipline + cross-surface consistency + 10-red-line compliance + Phase 5 code-path plan. Surfaced new anti-pattern MPMF-AP-14 (onboarding-lock-in). Zero code changes (journey-spec only).
