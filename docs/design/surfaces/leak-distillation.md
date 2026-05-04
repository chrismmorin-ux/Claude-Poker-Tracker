# Surface — Leak Distillation Pipeline

**ID:** `leak-distillation`
**Code paths:**
- `src/utils/exploitEngine/heroLeakDetector.js` (Phase 5; mirrors `weaknessDetector.js`)
- `src/utils/exploitEngine/heroDecisionAccumulator.js` (Phase 5; mirrors `decisionAccumulator.js`)
- `src/utils/skillAssessment/` (Phase 5; aggregation layer; see `docs/projects/self-coach-foundation/skill-assessment-module.md`)
- IDB store: `heroLeaks` (Phase 5; v22 schema per Gate 3 SCF-G3-SCHEMA)

**Route / entry points:**
- Implicit (pipeline runs as side-effect of HandReplayView mount on review-mode hands).
- Surface presentations:
  - HandReplayView inline annotation (per-action ⚑ badge in `HeroCoachingCard`) — see `hand-replay-view.md` for the inline placement detail.
  - SelfCoachView Hero leaks section (aggregated inventory) — see `self-coach-view.md`.

**Last reviewed:** 2026-05-02 (created at SCF Gate 4)

---

## Purpose

The cross-surface pipeline that converts a fired hero-leak detector rule into an owner-actionable surface element. Per Gate 3 ratification (immediate firing on hand-replay) + Decision 2 (inline badge with inline expansion), the pipeline runs at two surface points and persists aggregated state in the `heroLeaks` IDB store.

This is NOT a discrete UI surface in the conventional sense — it's a flow contract that binds three layers (detector engine + IDB store + two consumer surfaces). This surface doc names the flow stages, the affordance behaviors, and the source-util-policy whitelist enforcement.

## JTBD served

Primary:
- **CO-54** *see-leak-without-being-graded* — the pipeline is the primary delivery mechanism for hero-leak observations to the owner.

Secondary:
- **CO-55** *learn-next-concept-im-ready-for* — pipeline-aggregated leak frequency feeds W_leak signal in curriculum-spine composite formula.
- **CO-56** *validate-im-improving* — pipeline produces the credible-interval-over-time data that Calibration Dashboard reuses for hero behavioral change view.

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) in self-coach mode (review-mode-only consumer).
- [post-session-chris](../personas/situational/post-session-chris.md) (review-mode aggregated inventory consumer).

NOT served: `mid-hand-chris`, `between-hands-chris` on live game surfaces (per AP-SCF-02 cross-surface contamination refusal — sourceUtilPolicy blacklist enforced).

---

## Pipeline stages

```
hand reviewed in HandReplayView
       │
       ▼
┌──────────────────────────────────────────────────┐
│ heroDecisionAccumulator.js                        │
│ buckets per-action observation                    │
│ situation key (7-dim):                            │
│   {street}:{texture}:{posCategory}:               │
│   {isAgg}:{isIP}:{facingAction}:{contextAction}   │
│ recency-weighted accumulation (halflife=50 hands) │
│ MIN_BUCKET_SAMPLE=3 before aggregate metrics      │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ heroLeakDetector.js                               │
│ evaluates rules at action point                   │
│ rule output:                                      │
│   { id, category, label, severity, confidence,   │
│     sampleSize, evidence, situationKeys[] }      │
│ priors: HERO_LEAK_PRIORS (Beta(α, β) per stat)   │
└──────────────────────────────────────────────────┘
       │
       ├── fires (n≥30 + severity > threshold)
       │     │
       │     ▼
       │   ┌──────────────────────────────────────┐
       │   │ HRV inline annotation                 │
       │   │ ⚑ badge in HeroCoachingCard at step  │
       │   │ tap → expand inline → CD-5 claim card │
       │   │ + 3 affordances:                      │
       │   │   [ Drill this ] → SelfCoachView →    │
       │   │                    lesson card        │
       │   │   [ Dismiss ]    → collapse for hand  │
       │   │   [ Snooze ]     → 7-day suppression  │
       │   └──────────────────────────────────────┘
       │
       └── below threshold or below n=30 floor → no badge
                (AP-SCF-04 binding: factual placeholder
                 only on aggregated inventory surface
                 if at all)

       ┌──────────────────────────────────────────┐
       │ Aggregate across ALL review-mode hands   │
       └──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ heroLeaks IDB store (v22)                         │
│ keypath: [playerId, situationKey]                 │
│ indexes: by_playerId, by_situationKey,            │
│          by_severity                              │
│ record:                                            │
│   { playerId: 'self', situationKey,               │
│     occurrences, observedRate,                    │
│     credibleInterval: { lower, upper, mean },     │
│     severity, confidence, evidence,               │
│     snoozedUntil: number | null,                  │
│     lastUpdatedAt }                                │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ SelfCoachView Hero leaks section                  │
│ reads heroLeaks store filtered by:                │
│   sampleSize >= 30 (AP-SCF-04 floor)             │
│   AND (snoozedUntil < now OR snoozedUntil IS NULL)│
│ renders inventory ranked by severity desc         │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ skillAssessment/composite.js                      │
│ W_leak signal = leakFrequency aggregated by       │
│ conceptId via lessonCard.leakTagIds[]             │
│ feeds curriculum-spine ranking in                 │
│ SelfCoachView Curriculum section                  │
└──────────────────────────────────────────────────┘
```

## Affordance behaviors (HRV inline annotation expanded card)

| Affordance | Behavior | Persistence |
|---|---|---|
| `Drill this` | Navigates to SelfCoachView Curriculum section, scrolls to + highlights the lesson card matching the leak's `relatedConceptId` (resolved via leak rule's `evidence.metric` → conceptId mapping in HERO_LEAK_PRIORS authoring). | None (navigation only). |
| `Dismiss` | Collapses the badge for the current HRV session only. Does NOT suppress future hand-replay reviews on the same situation key. | Session-local state; not persisted. |
| `Snooze` | Suppresses leak annotations for this situation key for 7 days from `snoozedAt`. Affects both HRV inline annotation AND SelfCoachView Hero leaks section render. | Persisted in `heroLeaks[situationKey].snoozedUntil`. Owner can clear snooze in SelfCoachView Hero leaks section (per item; tap on snooze indicator). |

**Snooze semantics (AP-SCF-03 binding).** Snooze is per-situation-key, owner-explicit, time-bounded (7 days default). It is NOT durable suppression of inference (which would require Settings opt-out — Phase 2+ work). The 7-day bound prevents accidental permanent silencing. Owner can clear snooze any time via SelfCoachView Hero leaks section (tap on snoozed item → "Clear snooze" affordance).

## SourceUtilPolicy whitelist

Per Gate 3 SCF-G3-DETECTOR §sourceUtilPolicy. CI-grep enforcement at Gate 5 (SCF-G4-SUP — `kit/scripts/sourceUtilPolicy.test.js` analog mirrors EAL F6 sourceUtilPolicy infrastructure).

**Read-allowed (heroLeaks IDB store):**
- `HandReplayView` (review-mode only)
- `PlayerAnalysisPanel` (review-mode only; if hero-leak-aware extension is added Phase 2+; not in v1)
- `SelfCoachView`

**Read-blocked (CI-fails if any of these read from heroLeaks):**
- `OnlineView`
- Sidebar HUD (extension)
- `TableView` chrome
- `TournamentView`
- `ShowdownView`
- All live-decision surfaces

CI-grep test pattern: scan source files for `heroLeaks` import / db.heroLeaks reference; cross-reference filename to whitelist; fail on read from blacklisted surface.

## State

- **`heroDecisionAccumulator`:** in-memory bucket map keyed by 7-dim situation key. Accumulator hydrates from per-hand action data on HandReplayView mount; recency-weighted halflife=50 hands.
- **`heroLeakDetector`:** stateless rule evaluator. Reads from accumulator buckets + HERO_LEAK_PRIORS via bayesianConfidence credibleInterval; emits leak rule outputs.
- **`heroLeaks` IDB store:** persistent. Updated on detector fire (atomic transaction; upsert by [playerId, situationKey]).
- **HRV badge state:** local per-hand UI state (collapsed / expanded / dismissed-this-hand).
- **SelfCoachView Hero leaks section state:** read-only render of heroLeaks store filtered by sample size + snooze.

## Anti-pattern compliance

| AP | Verdict |
|---|---|
| AP-SCF-01 (graded-work-framing on system-imposed) | Compliant. All claim text uses observed/factual vocabulary per CD-1 + CD-5. |
| AP-SCF-02 (cross-surface contamination) | Compliant. sourceUtilPolicy whitelist enforced at Gate 5 CI-grep. |
| AP-SCF-03 (silent tier inference) | Compliant. Pipeline does NOT infer or write to `userSettings.tier.current`. Snooze is owner-explicit + time-bounded. |
| AP-SCF-04 (small-sample claim) | Compliant. n=30 floor enforced at SelfCoachView Hero leaks section render filter; HRV badge gating logic also requires sampleSize >= 30. |
| AP-SCF-05 (mastery score on curriculum) | Compliant. Pipeline does NOT compute aggregate mastery scores. W_leak signal feeds composite formula but is one input among four; never surfaced as scalar. |
| AP-SCF-06 (streak / engagement-pressure) | Compliant. Snooze is neutral data presentation, not nudge-to-act. No "you've ignored this leak for X days" pressure ever. |
| AP-05 (retired-anchors-you-might-reconsider) | Compliant. When a snooze expires and the leak re-surfaces, no "you snoozed this — reconsider?" prompt. Just factual re-rendering. |
| AP-09 (capture framing — "how did this hand go?") | Compliant. Inline annotation copy: "⚑ leak: {situation-key + observed-pattern}", never "how did you handle this?" |

## Copy-discipline compliance

- **CD-1 (factual, not imperative)** — affordance labels are nouns/verbs ("Drill this" / "Dismiss" / "Snooze"), not commands. Pipeline body copy descriptive only.
- **CD-2 (no self-evaluation framing)** — pipeline never asks "did you handle this?" / "rate your decision". Annotation marks observed pattern + factual rate.
- **CD-3 (no engagement copy)** — no "great job!", no streaks, no urgency, no nudge framing.
- **CD-4 (labels as outputs, never inputs)** — situation keys decompose to game-state inputs (street / texture / position / facing-action). No villain-style labels in claim copy.
- **CD-5 (assumptions explicit)** — every claim card carries situation-key + sample-size + credible-interval + threshold-floor visibly in body (4 fields) per the standard claim card template in `copy-discipline.md`.

## 9 autonomy red lines compliance

| RL | Verdict |
|---|---|
| #1 (opt-in enrollment) | Compliant. Pipeline runs only on review-mode hands; HRV is the explicit review-mode entry. |
| #2 (full transparency on demand) | Compliant. Expanded card surfaces all 4 CD-5 fields + solver baseline + related drill/lesson navigation. |
| #3 (durable overrides) | Compliant. Snooze is owner-explicit + persistent until cleared or expired (7d default). |
| #4 (reversibility) | Compliant. Dismiss is collapsible; snooze is clearable. Reset-all-leak-history Phase 2+. |
| #5 (no streaks, shame, engagement-pressure) | Compliant. AP-SCF-06 enforced. No "you've had this leak for X sessions" framing. |
| #6 (flat access) | N/A directly (pipeline produces output; consumer surfaces gate access). Compliant transitively. |
| #7 (editor's-note tone) | Compliant. CD-1 + CD-3 enforced. Annotation uses factual marker (⚑ glyph), not gamified vocabulary. |
| #8 (no cross-surface contamination) | Compliant. sourceUtilPolicy whitelist enforces structural segregation; CI-grep at Gate 5. |
| #9 (incognito observation mode) | N/A (pipeline consumes review-mode data; doesn't capture observations). Capture surface (HRV Section G EAL) is the upstream owner of red line #9. |

---

## Known behavior notes

- **Pipeline runs on every HandReplayView mount for review-mode hands.** Detector evaluation is fast (rule evaluation against pre-bucketed accumulator); no perceptible latency on HRV navigation.
- **Snooze expiry is checked on read, not write.** The `snoozedUntil` field is read-time-evaluated against `Date.now()` in both HRV badge gating logic and SelfCoachView Hero leaks section filter. No background scheduler.
- **HERO_LEAK_PRIORS is the source-of-truth for which stats produce leaks.** Initial 8 priors (per Gate 3 SCF-G3-DETECTOR): foldToCbetIP, foldToCbetOOP, threeBetIP, threeBetOOP, vpipUTG, vpipBTN, turnDoubleBarrel, checkRaiseFlop. Gate 5 implementation may add more per owner's hand-corpus review.
- **Severity threshold for badge fire** — TBD per stat in Gate 5 implementation. Default proposal: severity > 0.3 (clamped [0,1]) AND credible-interval lower bound deviates from solver baseline by > 5pp.

## Known issues

(None — pipeline is spec'd at SCF Gate 4; first findings will land at Gate 5 implementation review.)

## Potentially missing

- **Snooze duration owner-configurability** (v1 hardcoded 7d; Gate 5 may surface in SelfCoachView Settings).
- **Per-leak-rule disable** (owner toggles off specific leak rules). v2 if needed.
- **Phase 2+ Settings reset-all-leak-history** (red line #4 reversibility full data wipe).

---

## Test coverage

- Detector unit tests at Gate 5: `heroLeakDetector.test.js` — rule evaluation against synthetic accumulator buckets covering all 8 initial HERO_LEAK_PRIORS.
- Accumulator unit tests at Gate 5: `heroDecisionAccumulator.test.js` — 7-dim situation-key bucketing + recency-weighted halflife.
- Integration tests at Gate 5: HRV mount → accumulator hydration → detector fire → badge render → expand → affordance flow.
- IDB tests at Gate 5: heroLeaks store CRUD + snooze persistence + read filter (snoozedUntil < now).
- sourceUtilPolicy CI-grep test at Gate 5: scan source files for heroLeaks import; verify only whitelisted surfaces import.

## Related surfaces

- `hand-replay-view` — primary consumer (HRV inline annotation rendered via HeroCoachingCard extension).
- `self-coach-view` — secondary consumer (Hero leaks section renders aggregated inventory).
- `lesson-card` — destination of `Drill this` affordance (deep-link to matching lesson card via relatedConceptId mapping).
- `calibration-dashboard` — sibling pipeline (CO-56 hero behavioral change view reuses Calibration Dashboard primitives — KEEP SEPARATE per SCF Gate 2 §B Stage B verdict; pipeline runs in parallel, not fused).

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). Pipeline shape mirrors EAL anchor-distillation (parallel store + cross-surface read with sourceUtilPolicy whitelist). Affordance behaviors per Decision 2 + Gate 3 immediate-firing ratification. Anti-pattern + copy-discipline + 9 red lines walkthroughs all clear. Implementation deferred to Gate 5 multi-PR.
