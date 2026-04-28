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

## SE-04 — Pre-session kinesthetic visualization / rehearsal via physical artifact

> When I prepare for tonight's session, I want a physical artifact I can walk through slowly, touch, mark up with dry-erase, order on a desk, and internalize — so decision patterns become muscle-memory rather than lookup-dependence, and so I walk into the session primed without having been glued to a phone screen.

- **State:** Active (pending Printable Refresher Gate 4 — Phase 1 ships the physical artifact; pre-session integration hooks in Phase 4+).
- **Primary persona:** [Pre-Session Preparer](../../personas/situational/presession-preparer.md). Secondary: [stepped-away-from-hand](../../personas/situational/stepped-away-from-hand.md) in the `pre-session-at-venue` context variant.
- **Autonomy constraint:** opt-in only. No auto-generation of "tonight's pack." User explicitly selects cards for a rehearsal batch. Tone is neutral/supportive per `presession-preparer` mood-awareness requirements — never anxiety-inducing ("tonight's villains are coming!" ✗).
- **Mechanism:** Printable Refresher exports a batch selected by the user for tonight's venue / stakes / game-type. Laminated cards serve kinesthetic rehearsal — physical tactile interaction the in-app view cannot replicate. Distinct mechanism from SE-01 (which is villain-watchlist-specific).
- **Success criteria:**
  - User can produce a pre-session batch in <5 min from card-selection to print-ready PDF.
  - Card layout supports dry-erase annotation (H-PM03 light ink budget + white-space reserved for notes).
  - Print-preview WYSIWYG before commit (H-N03 paper-no-undo safety net).
  - Batch archived in `printBatches` store for stale-diff (CC-83) on next pre-session.
- **Failure modes:**
  - Generic pack auto-pushed — violates autonomy red line #15 (no proactive print-output).
  - "Cards you haven't studied lately" nag — violates red line #5 + #14 (no completion tracking).
  - Cross-contamination into SE-01 watchlist (SE-04 is generic rehearsal; SE-01 is villain-specific — must not merge).
- **Distinct from:**
  - **SE-01** (tonight's watchlist) — SE-01 is villain-conditioned pattern-spotting; SE-04 is generic-principles kinesthetic rehearsal. They can be used together but serve different outcomes.
  - **DS-46** (spaced repetition for charts) — DS-46 is declarative-memory drill mechanism; SE-04 is kinesthetic-memorization via physical object, distinct cognitive modality.
  - **DS-60** (carry-reference-offline) — DS-60 is the reference-carrying JTBD for the off-hand-at-venue window; SE-04 is pre-session rehearsal home-or-venue. Both served by the Printable Refresher surface but distinct situational frames.
- Doctrine basis: Printable Refresher Gate 2 audit Voice 2 §Missing JTBDs PRF-NEW-4; `docs/projects/printable-refresher.project.md` §Risks #4 content-scope phasing notes SE-04 as a Phase-4+ integration hook; `presession-preparer.md` §Goals "rehearse recognition."

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
- 2026-04-24 — Added SE-04 (pre-session kinesthetic visualization / rehearsal via physical artifact). Output of Gate 3 for Printable Refresher project. SE-04 is a parallel-use-case to SE-01 — SE-01 is villain-specific pattern rehearsal; SE-04 is generic-principles kinesthetic rehearsal; users may pair them in one pre-session prep routine. See `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` + `docs/projects/printable-refresher/gate2-voices/02-market-lens.md` §Missing JTBDs PRF-NEW-4.
