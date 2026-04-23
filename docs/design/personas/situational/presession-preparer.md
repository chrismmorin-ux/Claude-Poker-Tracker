# Situational Persona — Pre-Session Preparer

**Type:** Situational (cross-persona)
**Applies to:** [Chris (live player)](../core/chris-live-player.md), [Rounder](../core/rounder.md), [Circuit Grinder](../core/circuit-grinder.md), [Hybrid Semi-Pro](../core/hybrid-semi-pro.md), [Weekend Warrior](../core/weekend-warrior.md) (occasional)
**Evidence status:** PROTO — derived from Gate 2 Blind-Spot Roundtable 2026-04-23 for exploit-deviation project
**Last reviewed:** 2026-04-23
**Owner review:** Pending

---

## Snapshot

Hero is about to play. Not "about to study" — *about to play*. The session starts in 5, 15, or 30 minutes, and hero wants to prime their pattern recognition for the specific opponents they expect to face tonight. Generic chart fluency is irrelevant — this is specific preparation, specific villains, specific exploit opportunities.

Unlike the [Study Block](./study-block.md) situational persona (which is conceptual/generic — "improve my preflop charts"), Pre-Session Preparer is *applied* — "tonight at 7pm I'm playing 2/5 at the Bellagio against the regulars I've tagged; show me the 3–5 patterns worth watching."

After the session, the same person returns in *review mode* — did the flagged patterns actually fire? Did hero catch them? Which predictions were wrong? This loop-closing review IS part of the Pre-Session Preparer's job, not a separate persona.

---

## Situation trigger

### Preparation mode (pre-session)

- Hero declares a session is imminent (explicit "prepare next session" action), OR
- Hero opens the app within a configurable window before a scheduled session (when scheduling exists), OR
- Hero opens the app from a casino-proximity geofence (future — not v1).

Exits prep mode when: hero starts the session, or explicitly exits, or window closes.

### Review mode (post-session)

- Session ends (cash-out, tournament elimination, manual session-close).
- Hero opens "drill review" within 48h of session end.

Exits review mode when: review completed, or explicit dismiss, or > 48h elapses (review auto-archives).

---

## Context (deltas from core personas)

- **Time pressure:** Variable — three sub-variants (5 min / 15 min / 30 min). Drill surface adapts cadence and depth to declared time budget.
- **Attention:** Focused but mildly adrenalized. Session is about to start; thoughts drift toward the game. App must hold focus without adding cognitive weight.
- **Cognitive load:** Low-moderate. All cycles available in principle; in practice hero is somewhat distracted by session anticipation.
- **Mood:** Anticipatory. Historically: may be stuck from prior sessions (fear baseline elevated), on a heater (confidence elevated), or neutral. Content tone should be *supportive* not anxiety-inducing.
- **Device:** Phone primarily (walking to venue), desktop occasionally (home before leaving).

### Review-mode context

- **Time pressure:** Low — hero opts into review.
- **Attention:** Focused.
- **Mood:** Outcome-colored. Stuck hero should not be rubbed in salt; heater hero should not be complacently congratulated. Review surface calibrates.

---

## Goals

### Preparation mode

- **Get tonight's watchlist** — 3–5 exploitable patterns keyed to expected villains, ranked by recognizability × expected dividend × confidence.
- **Rehearse recognition** — see each pattern as a flash card, answer, see the reveal, internalize the trigger condition.
- **Scale personal commitment** — adjust dial per assumption if hero disagrees with the model's confidence; watch the recommendation re-converge.
- **Walk into the session primed** — know what to look for, know the response, know how confident to be in each.

### Review mode

- **Know which flagged patterns fired** — "you flagged 5 patterns; 3 came up in the session, you caught 2, missed 1."
- **Close the feedback loop** — learn whether the predictions were calibrated; update hero's own priors.
- **Adjust tomorrow's drill** — did this session surface a pattern the drill missed? Should the watchlist differ next time?

---

## Frustrations (JTBD killers for this situation)

### Preparation mode

- **Generic content when I want specific.** "Here's a 3-bet chart drill" — wrong. I want *tonight's villains*.
- **Too much content for my time budget.** 20 flashcards for a 5-min prep is overwhelming; 3 for a 30-min prep is shallow.
- **Anxiety-inducing framing.** "You face 12 exploitable villains tonight" primes aggression-spiral, not careful play.
- **Citation that's too dense to absorb in prep time.** Paragraph-long reasoning loses me.
- **No way to contest a recommendation.** The drill says "always bet" on this spot, but I think it's villain-dependent. Let me dial it down.

### Review mode

- **Review that's hand-by-hand when I want prediction-vs-outcome.** SessionsView already does hand review. I want *drill accuracy review* — different cut.
- **Mood-blind review.** Telling stuck-me "you missed 4 patterns, add more practice" feels like punishment. Telling heater-me "you caught 5 of 5" misses that one spot where I could still improve.

---

## Non-goals

- **Deep concept study.** That's [Study Block](./study-block.md). Pre-Session Preparer is primed rehearsal, not instruction.
- **In-hand advice.** That's [Mid-Hand Chris](./mid-hand-chris.md). Prep ends when cards are dealt.
- **Session management.** Setup, stacks, buy-ins — that's [Chris (core)](../core/chris-live-player.md) at session-start. Prep is a separate surface.

---

## Constraints

- **Time budget per card (preparation mode):** 90s – 3 min depending on time variant (5/15/30 min). Five cards in 5 min = 1 min/card. Fifteen cards in 30 min = 2 min/card with contestability.
- **Time budget per interaction (review mode):** ~30s per prediction outcome.
- **Error tolerance:** Moderate. Misclick on flashcard reveal is frustrating but not catastrophic; "retry later" queue mitigates.
- **Visibility tolerance:** High in prep mode. Citation depth is welcome in drill.
- **Recovery expectation:** Retry-later queue for missed cards; no destructive actions on primary path.

---

## Related JTBD

### Session entry (primary domain for this persona)

- `JTBD-SE-01` Prepare tonight's watchlist of exploitable patterns keyed to expected villains
- `JTBD-SE-02` Review drill predictions against session outcomes (loop-close)
- `JTBD-SE-03` Scale commitment to a specific deviation via drill-side dial

### Drills and study (tangential)

- `JTBD-DS-44` Correct-answer reasoning (drill-shared)
- `JTBD-DS-46` Spaced repetition (may apply if predicted patterns persist across sessions)

---

## What a surface must offer this persona

### Preparation mode

1. **Time-budget-aware card count.** 3 cards for 5-min budget, 5–7 cards for 15-min, 10–15 cards for 30-min.
2. **Specific-villain framing.** "Tonight vs Dan, Mike, Sara — here are the patterns."
3. **Supportive tone.** Language emphasizes recognition and correct response, not aggression or domination.
4. **Compressed reveal then optional depth.** Single-line citation on reveal; tap-to-expand for deeper reasoning.
5. **Contestability dial.** Adjustable commitment per card, visible recommendation re-convergence as dial moves.
6. **Retry-later queue** for missed cards — hero sees them again before exiting the drill.
7. **Clean hand-off to session start.** When hero starts the session, the drill's watchlist remains accessible (priming doesn't evaporate).

### Review mode

1. **Prediction-vs-outcome grid.** "Pattern A: flagged. Fired? Yes × 3. Hero caught? 2 of 3. Missed: hand #14."
2. **Mood-aware framing.** Stuck hero sees wins highlighted. Heater hero sees improvement opportunities.
3. **Deep-link to specific hands.** Tap a missed pattern → jump to that hand in SessionsView for full replay context.
4. **Calibration update visible.** "Your fold-to-river read on Dan moved from 17% → 19% with this session's data."

---

## What a surface must NOT do

- **Force a time budget.** Hero picks 5/15/30 min; don't default to 15 without asking.
- **Assume villains.** "Expected villains" must be hero-declared or session-template-recalled, never auto-assumed.
- **Inject anxiety.** Never frame the drill as "your opponents are coming to get you." Frame as "here are the patterns tonight."
- **Conflate with Study Block.** This is not generic chart drill. Do not redirect to DS-* content when SE-* is requested.
- **Surface destructive actions.** Drill has no destructive paths. Review may deep-link to hand deletion but that's outside drill scope.
- **Lock hero into a commitment.** Dial exists so hero can override. Hidden dial (live sidebar) is acceptable under time pressure; visible dial (drill) is mandatory.

---

## Proto-persona caveats

- **[PSP-1]** Three time-budget variants (5/15/30 min) are assumption, not observation. Verify by asking owner or users: do these buckets match actual prep behavior, or are the natural durations different?
- **[PSP-2]** Mood-aware review framing assumes reliable stuck/heater detection from session P/L. May need explicit hero mood declaration as fallback.
- **[PSP-3]** Loop-close window of 48h is arbitrary. May be shorter (12h — "review before next session") or longer (1 week — "review before deciding what to drill next"). Data-driven calibration needed.

---

## Change log

- 2026-04-23 — Created as Gate 3 output of exploit-deviation project Phase 3. Authored same-session as the triggering Gate 2 Blind-Spot Roundtable (`2026-04-23-exploit-deviation-blindspot.md`).
