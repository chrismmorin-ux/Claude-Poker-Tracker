# JTBD Domain — Mid-Hand Decision

Jobs that must complete *during* a hand, under time pressure. The domain with the tightest latency budget and the most severe cost of failure.

**Primary personas:** All table-playing personas. Acute for [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md), [Multi-Tabler](../../personas/core/multi-tabler.md), [Online MTT Shark](../../personas/core/online-mtt-shark.md), [Circuit Grinder](../../personas/core/circuit-grinder.md).

**Surfaces:** `TableView/LiveAdviceBar`, sidebar Zone 2 (Decision).

---

## MH-01 — See the recommended action for the current street

> When I face a decision on any street, I want the recommended action (fold / call / raise + size) at a glance, so I can decide before the clock.

- **Success:** recommendation visible within 1s of street update; confidence visible; update is binding to current hand state.
- **Failure:** stale advice (from prior hand) shown as if current.

## MH-02 — Know whether the recommendation is fresh

> When I glance at the advice, I want to know immediately if it reflects the current state, so I don't act on stale info.

- **Success:** freshness indicator binary and unmistakable. Stale is visually degraded.
- **Failure:** "213 state invariant violations in 30s" badge showing without affecting what I read (the 2026-04-16 regression).

## MH-03 — Check bluff-catch frequency on current villain

> When I'm considering a call on a river bet, I want villain's bluff-catch frequency and sizing tell, so I pick real spots.

## MH-04 — Get sizing suggestion tied to villain's calling range

> When sizing a value bet, I want a suggested sizing that matches the call-range width of this villain, so I extract max.

## MH-05 — Respond to a check-raise with value/bluff mix

> When facing a check-raise, I want villain's CR frequency + mix (value / bluff / merge), so I respond correctly.

## MH-06 — Multiway range-vs-ranges equity on flop

> When multiway on the flop, I want the equity distribution across live ranges, so I cbet-or-give-up with accurate knowledge of how much I own.

## MH-07 — Short-stack push/fold with ICM

> When short-stacked preflop, I want a push/fold chart with ICM applied, so I act within 3 seconds.

- See also [push-fold-short-stack situational](../../personas/situational/push-fold-short-stack.md).

## MH-08 — Incorporate blockers in fold-equity math

> When I have a blocker to villain's value range, I want the fold-equity math to reflect it, so I bluff with the right combos.

## MH-09 — SPR-aware strategy cues

> When deep OOP, I want SPR-zone-aware cues (MICRO / LOW / MEDIUM / HIGH / DEEP), so I avoid bad-SPR traps.

## MH-10 — Plain-English "why" for a recommendation

> When my hand is marginal, I want a one-line reason for the rec (not just verdict), so I learn while playing.

- See also [Newcomer](../../personas/core/newcomer.md) and [Apprentice](../../personas/core/apprentice-student.md) personas.

## MH-11 — Validate that the displayed pot is correct before sizing

> When I am about to size a bet, I want to trust the pot number on screen matches the physical pot; if it doesn't, I want a one-tap path to correct it without losing the hand in progress.

- State: **Active** (JTBD) / partially served — `handlePotCorrection` exists on TableView; the outcome (trust before acting) was never named as a job. Surfaced via [blind-spot audit 2026-04-21 table-view §B2](../../audits/2026-04-21-blindspot-table-view.md).
- Primary persona: [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md) (highest cost of wrong pot at sizing time).
- Secondary: all table-playing personas; [Ringmaster-in-hand](../../personas/situational/ringmaster-in-hand.md) (host reconstructing pot from rebuys / add-ons).
- Success criteria: visible pot value matches physical pot within user's tolerance for reconstruction error; mismatch is resolvable in <5 seconds without leaving the live surface.
- Failure modes: silent pot drift from missed action entry; side-pot reconstruction obscured; no way to flag "I don't trust this" without a modal.
- Primary surface: `TableView/PotDisplay`.

## MH-12 — See the specific assumption(s) cited as backing for a recommendation

> When the app recommends a non-balanced action, I want to see the specific behavioral assumption(s) about villain that justify the deviation, rendered in a form I can read in ≤ 1.5 seconds, so I trust or override with full context.

- State: **Proposed** (implementation in exploit-deviation project Phase 9).
- Primary persona: [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md) (highest stakes for trust).
- Secondary: all table-playing personas who benefit from auditable recommendations.
- Success criteria:
  - Citation compressed to **single line** always-visible in sidebar ("villain folds rivers 17% • why →").
  - Tap-to-expand reveals three-line reasoning.
  - Every cited assumption references a `VillainAssumption.id` + `narrative.citationShort` (schema v1.1 §1.8).
  - Fresh/stale behavior honored per sidebar doctrine freshness-sidecar invariant.
- Failure modes:
  - Citation rendered in verbose form that exceeds 1.5s read budget.
  - Citation displayed for assumptions that aren't `actionableLive` per schema v1.1 §1.10.
  - Citation references stale evidence without staleness indication.
- Surface origin: Gate 2 Blind-Spot Roundtable 2026-04-23 (`../../audits/2026-04-23-exploit-deviation-blindspot.md` Stage B).

## MH-13 — Dismiss or downrank a live-cited assumption in the moment

> When I see a live citation that I disagree with in the moment, I want to silently override the recommendation without fighting the app, so my instinct is respected and the tool stays a tool.

- State: **Proposed** (implementation in exploit-deviation project Phase 9).
- Primary persona: [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md).
- Success criteria:
  - Hero can take any action regardless of the citation — no blocking modal, no "are you sure", no friction.
  - Overrides are recorded silently for post-session review (drives `dialOverrideRate` metric in `calibration.md` §3.2).
  - Dial affordance itself is NOT visible in live per Theory Roundtable CC-5 — override is via just playing the alternative action.
- Failure modes:
  - App fights hero's action with a warning or confirmation.
  - Override not recorded, so calibration metric can't learn from it.
  - Dial made visible in live, adding cognitive load under time pressure.
- Distinct from MH-10 ("plain-English why") — MH-10 is about *understanding* the recommendation; MH-13 is about *silently disagreeing* with it.
- Surface origin: Gate 2 Blind-Spot Roundtable 2026-04-23 (`../../audits/2026-04-23-exploit-deviation-blindspot.md` Stage B).

---

## Domain-wide constraints

- **Latency:** ≤ 300ms from street change to rec update.
- **Freshness:** must honor the sidebar doctrine's freshness-sidecar invariant.
- **Reliability:** no recommendation is worse than a wrong recommendation.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-23 — Added MH-12 (citation for live recommendations) + MH-13 (silent override during live) as output of Gate 2 Blind-Spot Roundtable for exploit-deviation project. See `../../audits/2026-04-23-exploit-deviation-blindspot.md`.
