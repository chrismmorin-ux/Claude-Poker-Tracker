# JTBD Domain — Session Entry

Jobs around preparation for, and review of, a specific poker session. Distinct from [Drills and Study](./drills-and-study.md) (generic fluency/concept mastery) — Session Entry is *applied preparation* keyed to tonight's specific opponents and closes a feedback loop against what actually happened at the table.

**Primary persona:** [Pre-Session Preparer](../../personas/situational/presession-preparer.md).
**Secondary personas:** [Chris (live player)](../../personas/core/chris-live-player.md), [Rounder](../../personas/core/rounder.md), [Circuit Grinder](../../personas/core/circuit-grinder.md), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md).
**Surfaces:** `PresessionDrillView` (future, Phase 7 of exploit-deviation project), `SessionsView` "drill review" tab (future, Phase 9), TableView session-start entry point.

**Domain origin:** Gate 2 Blind-Spot Roundtable 2026-04-23 for exploit-deviation project (`../../audits/2026-04-23-exploit-deviation-blindspot.md`).

---

## SE-01 — Prepare tonight's watchlist of exploitable patterns

> When I'm about to play a session, I want a ranked watchlist of 3–5 exploitable patterns keyed to the specific villains I expect to face, so I walk into the session primed to recognize and respond to real money opportunities.

- **State:** Proposed (implementation in exploit-deviation project Phase 7).
- **Primary persona:** Pre-Session Preparer.
- **Success criteria:**
  - Watchlist contains 3–5 patterns (not 10+ — cognitive overload) for the typical 15-min prep variant.
  - Patterns are ranked by `recognizability × asymmetricPayoff × posteriorConfidence` (per schema v1.1 §1.10).
  - Each pattern is a `VillainAssumption` with `quality.actionableInDrill === true`.
  - Hero declares time budget (5/15/30 min); card count and depth adapt.
- **Failure modes:**
  - Watchlist based on generic "player type" rather than this villain's actual data.
  - Watchlist doesn't change day-to-day despite new hand data accruing.
  - Recommendations surfaced that are sub-threshold (breaks hard-edge doctrine).
- **Related:** schema v1.1 §1, `canonical-assumptions.md` for example patterns.

## SE-02 — Review drill predictions against session outcomes

> When I finish a session that I prepared for, I want to see which flagged patterns actually fired, which I caught, and which I missed, so I close the feedback loop between rehearsal and live play.

- **State:** Proposed (implementation in exploit-deviation project Phase 9).
- **Primary persona:** Pre-Session Preparer (review mode).
- **Success criteria:**
  - Review displays prediction-vs-outcome grid: for each flagged pattern, did it fire, how many times, did hero catch it, what was the EV impact.
  - Mood-aware framing: stuck hero sees wins highlighted; heater hero sees improvement opportunities. Neutral mood sees balanced view.
  - Deep-link from a missed pattern into the specific hand in SessionsView for full replay context.
  - Calibration data visible: "your fold-to-river read on Dan moved from 17% → 19% with this session's data."
- **Failure modes:**
  - Review feels like punishment when hero is stuck (rubs salt in wounds).
  - Review feels complacent when hero is on heater (misses improvement opportunities).
  - Pattern-outcome attribution wrong — claims a pattern "fired" when it didn't, or vice versa.
- **Integration:** Extends SessionsView with a new tab rather than creating a new routed view.

## SE-03 — Scale commitment to a specific deviation via drill-side dial

> When I disagree with the drill's confidence level on a specific pattern, I want to dial my commitment up or down and watch the recommendation re-converge, so I own the decision and the tool serves me rather than dictates to me.

- **State:** Proposed (implementation in exploit-deviation project Phase 7).
- **Primary persona:** Pre-Session Preparer (preparation mode).
- **Success criteria:**
  - Dial affordance visible on every drill card.
  - Dragging the dial to 0 reveals the balanced-baseline recommendation — honesty check surfaced, user-visible.
  - Dragging the dial to 1.0 shows full commitment.
  - Re-convergence is instant (≤ 300ms from dial change to updated recommendation).
  - Dial position persists with the card — hero's contestability is part of the record, not ephemeral.
- **Failure modes:**
  - Dial ships without re-convergence (hero changes dial, recommendation stays static — trust broken).
  - Dial hidden in drill mode (scope creep from live-hidden policy — they must differ per Theory Roundtable CC-5).
- **Related:** schema v1.1 §1.7 (operator.currentDial / dialFloor / dialCeiling).

---

## Domain-wide constraints

- **Time-budget awareness is mandatory.** Every SE surface respects hero's declared time budget. Do not force extended flows.
- **Tone is supportive, not anxiety-inducing.** Session Entry content primes recognition-primed decision-making; framing that amplifies pressure undermines the priming.
- **Loop closure is the differentiator.** SE without post-session review is incomplete. SE-02 is as important as SE-01.
- **Distinguish from DS domain.** DS-* is generic fluency. SE-* is session-specific application + post-session calibration. Do not merge or redirect across domains.
- **Hard-edge doctrine preserved.** No sub-threshold assumptions surface in SE surfaces (per schema v1.1 §7 + canonical-assumptions.md hard-edge discipline).

---

## Related domains

- [Drills and Study](./drills-and-study.md) — generic fluency (DS-*); distinct mental mode from SE but may share primitives (flashcards, reveal-with-reasoning).
- [Mid-Hand Decision](./mid-hand-decision.md) — live-play surface; MH-12 (citation) + MH-13 (silent override) are complementary to SE-01/02/03.
- [Session Review](./session-review.md) — generic post-session review (SR-*). SE-02 is a *parallel* review flow, not a replacement. SR-23 reviews worst-EV hands; SE-02 reviews drill-prediction accuracy. They can run side-by-side.

---

## Change log

- 2026-04-23 — Created as Gate 3 output of exploit-deviation project Phase 3. SE-01, SE-02, SE-03 authored. New domain registered in `ATLAS.md` same session.
