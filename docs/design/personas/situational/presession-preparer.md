# Situational Persona — Pre-Session Preparer

**Type:** Situational (cross-persona)
**Applies to:** [Chris (live player)](../core/chris-live-player.md), [Rounder](../core/rounder.md), [Circuit Grinder](../core/circuit-grinder.md), [Hybrid Semi-Pro](../core/hybrid-semi-pro.md), [Weekend Warrior](../core/weekend-warrior.md) (occasional)
**Evidence status:** PROTO → CONFIRMED (PSP-1, PSP-3) / PROTO with v1 fallback (PSP-2) — see Change log 2026-05-19
**Last reviewed:** 2026-05-19 (Gate 3 research SPR-091 / WS-195)
**Owner review:** Confirmed 2026-05-19 — owner ratified time-budget variants (PSP-1) + 48h review window (PSP-3); PSP-2 mood-detection remains proto with v1 user-declared-toggle fallback per Gate 2 Stage C-A6 + WS-201 research deferral.

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

- **[PSP-1] CONFIRMED 2026-05-19** — Three time-budget variants (5/15/30 min) match owner's actual prep cadence. No alternative bucket required for v1. Re-evaluate if usage data reveals a missing variant (e.g., 10-min cab-departure cohort).
- **[PSP-2] PROTO with v1 fallback** — Mood-aware *selection* (not framing) per Gate 2 Stage C-A3 + C-A6. v1 ships **user-declared mood toggle** (explicit stuck / heater / neutral). Auto-detection from session P/L deferred to WS-201 research; if validated, hybrid (auto-detect default + user override) becomes v2.
- **[PSP-3] CONFIRMED 2026-05-19** — 48h review auto-archive window confirmed. Long enough that next-morning review still works; short enough to enforce loop-close before stale-mood drift sets in.

---

## Relationship to post-session-chris (Gate 3 reconciliation, 2026-05-19)

`presession-preparer` and [`post-session-chris`](./post-session-chris.md) are **sibling situational personas**, not nested. They share post-session timing but cover different scopes:

| | `presession-preparer` (review mode) | `post-session-chris` |
|---|---|---|
| **Focus** | Drill-prediction × outcome reconciliation. Did flagged patterns fire? Did hero catch them? Calibration update visible. | General session review. Hand-by-hand replay, villain notes refinement, player record corrections, aggregate stats. |
| **JTBDs** | `JTBD-SE-02` (review drill predictions against session outcomes) + DS-62 prep (recency-weighted next session) | `session-review/*` (placeholder domain — hand-by-hand JTBDs to be authored as audits reach those surfaces) |
| **Trigger** | Hero opens drill-review surface within 48h of session end | Session ended; hero opens any post-session reflective view |
| **Time budget** | ~30s/interaction (per prediction-outcome cell) | 30s–2min/hand (per Constraints) |
| **Mood-coloring** | Critical (Stage C-A3) — stuck/heater bias selection | Lower priority — review pace is generous |

A user may engage *both* personas in one post-session window: open drill-review (presession-preparer review mode) → close → open HandReplay for a specific hand (post-session-chris). The personas overlap in time but not in surface. No file edit needed to `post-session-chris.md` beyond the reconciliation note added 2026-05-19 — both personas remain canonical.

---

## Apprentice-Student depth tolerance (Gate 3 reconciliation, 2026-05-19)

Per Gate 2 audit Stage A-R3: PSD's card-back depth (falsifier headline + citation paragraph + anchor links) was flagged as potentially overshooting [Apprentice-Student](../core/apprentice-student.md) depth tolerance.

**Resolution:** Apprentice remains an `Applies to` persona for `presession-preparer`. Card-back content discipline (per Gate 2 Stage C-A2 + ADR-005): falsifier headline first, citation paragraph second, anchor links last. Skim-tolerant by design. An Apprentice can absorb the headline-only on a 1-min/card budget; citation depth is opt-in via scroll; anchor-trace to source artifact is opt-in via tap (DS-63). The depth is *available*, not *required*. Re-evaluate if Apprentice usage data shows abandonment of the surface, which would be evidence the depth-tolerance flag was correct after all.

---

## Change log

- 2026-04-23 — Created as Gate 3 output of exploit-deviation project Phase 3. Authored same-session as the triggering Gate 2 Blind-Spot Roundtable (`2026-04-23-exploit-deviation-blindspot.md`).
- 2026-05-19 — Owner review CONFIRMED via SPR-091 / WS-195 Gate 3 research. PSP-1 (5/15/30 variants) CONFIRMED. PSP-2 (mood detection) remains PROTO with v1 user-declared-toggle fallback; WS-201 research will determine v2 disposition. PSP-3 (48h review window) CONFIRMED. Added sibling-relationship reconciliation with `post-session-chris` (different scopes, may co-engage). Added Apprentice-Student depth-tolerance resolution. See `docs/design/audits/2026-05-19-research-psd-gate3.md`.
