# Situational Sub-Persona — First-Principles Learner

**Type:** Situational (cross-persona)
**Applies to:** Apprentice (primary), Scholar (primary), Rounder transitioning from hero-first to range-first cognition, Coach's student during curriculum's range-abstraction unit
**Evidence status:** PROTO
**Last reviewed:** 2026-04-22

---

## Snapshot

The learner is past the mechanics of poker (knows the ranking of hands, knows position names, can compute pot odds on demand) and is now specifically building the **range-vs-range abstraction** as a habit. They're not memorizing charts — they're trying to *see* villain's range first as the organizing cognitive frame for every decision. Their entry mental model is hero-first ("I have AT on K72; what do I do?"); they're trying to replace it with range-first ("BB called my cbet on Q72 — their range is now polarized toward medium pairs and broadway kickers that missed; given JT in that context, I should..."). The habit is load-bearing for higher-stakes play, and nothing in their prior exposure — whether casual poker, HU simulators, or YouTube content — has taught range-first framing in repeatable drill form.

---

## Situation trigger

- Opening Line Study in Postflop Drills (specifically — Explorer's range-breakdown serves a different concept).
- Between sessions, actively studying a recent hand they misplayed.
- Working through a coach's assigned drill where the correct answer surprised them and they want to understand *why*.
- Exits when: the learner can articulate the range-first reasoning for the decision aloud or in writing without the surface's assistance. At that point the habit is internalized and they move on to the next concept.

## Context

- **Time pressure:** None. This is off-table study, ~20-60 min per session.
- **Attention:** Focused. Willing to read multi-paragraph prose, engage with arithmetic, tap-and-expand disclosures.
- **Cognitive load:** Moderate. Bucket-taxonomy vocabulary (topPairGood, flushDraw, gutshot-with-overcard, backdoorFlushDraw) is still being learned; the student is consciously translating.
- **Device:** Phone for short blocks (10-min read/review), desktop for longer sessions (table-walkthrough, arithmetic-in-head).
- **Prerequisite knowledge:** Understands equity, pot odds, MDF at definitional level. Can read GTO-Wizard-style charts. Has NOT yet internalized the range-first decision frame.

## Primary need

The surface must **organize around villain's range as the primary visual + cognitive unit**, with the learner's own hand as the secondary anchor (not the other way around). Specifically:

1. **Range decomposition visible first.** The student reads left-to-right / top-to-bottom and encounters villain's range breakdown before anything else.
2. **Arithmetic traceability.** Not "the answer is X at Y EV" — "here's how X and Y come from the range breakdown, group by group."
3. **Variant recognition across lines.** The same cognitive pattern (bluff-catch = compare value region to bluff region; thin-value = compare beat to pay ratio) applies across different spots; the surface must make the pattern portable, not teach it only in the current line.

## Secondary needs

- **Range-narrowing made explicit.** Students who are new to range-first thinking have trouble seeing how a range evolves across streets. "Villain called flop → their range now excludes X and concentrates on Y" is the narrative thread.
- **Confidence / uncertainty display.** The learner is calibrating their own prior accuracy against solver-informed truth. When the surface says "62% vs Reg, 58% vs Fish," the variance band helps them understand the tool's accuracy, not over-trust specific digits.
- **Glossary access without full-page context switches.** Bucket labels they haven't fully learned yet should have tap-for-definition without losing the current reasoning thread.

## What a surface must offer

1. **Villain-range decomposition above the hero view**, not below and not collapsed. This is I-DM-1 from the bucket-ev-panel-v2 spec. The visual hierarchy trains the habit.
2. **Decision-kind-aware framing.** Bluff-catch spots render with value/bluff split made visible; thin-value spots render with beat/pay split made visible. The teaching payload is in the primitive rendering, not in a readable-but-skip-safe summary string.
3. **Arithmetic terms visible.** Weighted-total EV shown as `Σ(weight × per-group EV) = total`, not just as a final number.
4. **Street narrowing trace.** On non-root nodes, show the range evolution from the prior street's action. This is axis-5 from the v2 spec; it's the narrative thread of multi-street learning.
5. **Inline bucket-label glossary** with tap-for-definition to bridge the vocabulary gap without disrupting the cognitive thread.

## What a surface must NOT do

- **Show hero's answer before the range decomposition.** Puts the student in hero-first framing and undermines the habit they're here to build.
- **Hide the arithmetic.** The student has to be able to see *why* a 75% bet has a higher EV than a 33% bet against this specific range, not just *that* it does.
- **Bury the range narrowing.** On river nodes where narrowing spans 3 streets, the trace is the pedagogy — condensing it to "post-flop-action range" is structurally insufficient.
- **Over-rely on authored prose for the teaching insight.** A student reading "you should call because X" teaches "I need to memorize that." The primitive rendering should surface the insight (via polar-split, beat/pay split, arithmetic decomposition) so the student *sees* it, not *reads* someone else's explanation.

---

## Related JTBD

- `JTBD-DS-48` understand villain's range composition as decision driver (primary outcome)
- `JTBD-DS-49` weighted-total EV decomposition (primary outcome)
- `JTBD-DS-44` correct-answer reasoning (applies but insufficient — DS-44 is neutral on hero-first vs range-first framing; DS-48/49 specify range-first)
- `JTBD-DS-51` range-shape recognition (sibling outcome in Explorer)

## Related core personas

- [Apprentice](../core/apprentice-student.md) — primary. This situational narrows Apprentice's study context to the range-abstraction internalization phase specifically.
- [Scholar](../core/scholar-drills-only.md) — primary. Scholar's drill-heavy approach dovetails with the repeated-exposure need here.
- [Rounder](../core/rounder.md) — secondary. Rounders coming from simulator training often have hero-first habits from HU-vs-HU bot play; this situational captures their un-learning window.
- [Coach](../core/coach.md) — indirect. A coach teaching range-first to a student is effectively using this surface through this lens.

## Distinct from `study-block`

`study-block.md` captures the time-and-attention shape of an off-table study session (quiet hour, phone or desktop, focused). `first-principles-learner.md` captures the *cognitive goal* of a specific class of study block: range-first habit formation. A study-block session can be any of (a) drill practice, (b) hand review, (c) first-principles learning. This situational is exclusively (c).

---

## Missing features

- [DISC] Inline bucket-label glossary with tap-for-definition (open question Q1 in bucket-ev-panel-v2 spec).
- [DISC] Range-first teaching across Explorer surface (today Explorer is hero-range-first, not villain-range-first — a parallel gap to the one v2 panel closes in Line Study).
- [DISC] Cross-line pattern recognition hint — "this is a bluff-catch; the same structure appeared in Line K77 you studied last week." Deferred pedagogy enhancement.
- [DISC] Self-assessment prompt — "before revealing, predict which villain group you're most crushed by." Converts passive reading into active prediction. Not in v1 scope but a candidate v1.1 enhancement.

---

## Proto caveats

- **[P1]** Apprentice's published persona file treats range-first cognition as an implicit secondary outcome; explicit recognition here as a distinct situational could eventually warrant a sub-persona split if the audience grows. For now, treat as a lens over Apprentice + Scholar, not a new core persona.
- **[P2]** Habit-formation duration assumption (weeks-to-months of repeated exposure) is not validated with real learner data; based on cognitive-science generalization rather than poker-specific evidence.

---

## Change log

- 2026-04-22 — Created (LSW-J2). Referenced from `bucket-ev-panel-v2.md` as primary paradigm-sensitive persona. Supports `JTBD-DS-48` + `JTBD-DS-49` from the same ticket batch.
