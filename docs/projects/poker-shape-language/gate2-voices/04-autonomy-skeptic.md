# Autonomy Skeptic — Gate 2 Voice: Adaptive Lesson Seeding

## Framing

The owner is a sophisticated adult who built his own tracker and directs his own development. He did not enroll in a course. Any seeding system that treats use-of-app as consent-to-be-quizzed imports the ed-tech failure mode Duolingo is currently notorious for — mascot-shame, streak-coercion, "how do you say 'quitter'" notifications — into a surface whose entire value depends on the owner trusting the app's numbers at a live table. Trust asymmetry kills the feature: if the app forms silent opinions about him, the Bayesian villain reads beside those opinions lose credibility by association.

## Stage A — Persona gap from the skeptic lens

**Verdict:** ⚠️

**Findings:**
- `chris-live-player.md` has autonomy *signals* (frustration with "overly generic advice," goal to "extend the app himself," "trust the app enough to rely on it") but no explicit skeptic/refuser archetype.
- `analyst-api-user.md` is the closest match — lists "opinionated analysis they disagree with and can't override" as a top frustration, wants raw data access, resists closed systems. But Analyst is a future-user persona, not the owner, and is framed around data portability rather than pedagogical consent.
- `scholar-drills-only.md` explicitly *wants* daily streak and gamification — the opposite disposition. The persona set currently skews pro-personalization.
- No persona captures: "the learner who wants to drive the curriculum themselves," "the learner who distrusts algorithmic assessment," or "the sophisticated user who treats recommendations as hypotheses."

**Recommended follow-ups:**
- Do **not** create a full new persona. The honest answer is that *this owner* occupies the skeptic position by default and the skeptic stance belongs as a **cross-cutting design constraint** (like the existing "one-handed thumb reach" constraint) applied to every feature, not as a named user.
- Add a `chris-live-player.md` amendment: "Autonomy constraint — the app may not form persistent opinions about the owner's skill without an explicit enrolled-state toggle. Recommendations are hypotheses, not verdicts." One paragraph. Reference it from the Shape Language spec.
- If the Scholar persona ever graduates from PROTO, re-examine whether its "daily streak / gentle gamification" goal conflicts with this constraint for the drills module. Flag now.

## Stage E — Agency/autonomy heuristic pre-check

**Verdict:** ❌ (as currently sketched — fixable with the red lines below)

**Consent & disclosure:** The roundtable doc does not describe an opt-in gesture for adaptive seeding. The ambient assumption is that interacting with PresessionDrillView is sufficient consent to be modeled. That assumption is wrong for this user. There must be an explicit "start a study program" act that flips an *enrolled* flag; outside enrolled state, drill interactions are ephemeral and produce no skill inference.

**Transparency:** The system must never be a black box in this area. The owner must be able to open one screen and see: (a) the inferred skill estimate per descriptor, (b) the evidence list that produced it (which drill, when, what he answered), (c) the next-lesson justification in one English sentence ("Showing Saddle because your last 4 Saddle drills were correct-but-slow — moving to mixed-descriptor"). This is "why this recommendation" parity with the existing villain-model transparency pattern. If the adaptive layer is opaque, it violates the trust model the app already established.

**Override / dissent:** Every recommendation needs a one-tap "show me something else" and a one-tap "I already know this — skip." The override must be *durable* (the system does not re-recommend for N sessions) and must not trigger a counter-adaptive "he's avoiding this because he's weak at it" inference. Duolingo's infamous mistake is learning that users who skip are anxious and pushing harder; this design must learn the opposite reflex — trust the owner's self-assessment as a higher-credibility signal than drill performance.

**Reversibility:** Three escape hatches, all required: (1) per-descriptor reset ("forget what you learned about my Silhouette skill"), (2) global model reset ("wipe the curriculum state entirely"), (3) *incognito drill mode* — a toggle where a drill session produces no model update regardless of outcome. The third is the non-obvious one and the most important: the owner must be able to practice without being graded.

**Anti-streak anti-shame:** No streaks. No notifications about missed days. No sad mascot, no "how do you say quitter," no "you haven't studied in 3 days" push. The documented Duolingo pattern of aversive-emotion-on-disengagement is exactly what gets imported if seeding gets a "keep it up!" surface. Engagement gaps are valid — the owner plays 3-6 hour live sessions; some weeks there is no study time and that is healthy. ([Deceptive Patterns — Duolingo](https://www.deceptive.design/brands/duolingo), [Design Buddy: Duolingo's unethical design](https://designbuddy.substack.com/p/monthly-issue-may-2024))

**Anti-filter-bubble:** Adaptive seeding must not hide descriptors the model thinks are "too advanced." The ed-tech literature on adaptive systems trapping learners below grade level is real ([Common Sense Education — Filter Bubble Trouble](https://www.commonsense.org/education/digital-citizenship/lesson/filter-bubble-trouble)). The lesson index must always be fully browsable — every descriptor clickable from a flat list regardless of inferred readiness. Adaptivity determines *default order*, never *access*.

**Language / tone:** No badges. No "Silhouette Master" titles. No celebratory animations on completion. Descriptor names (Saddle, Basin, Spire) are geometric and adult — keep the copy at that register. Progression messages read like editor's notes ("Next: Polarization Bar — this pairs with Spire, which you already have.") not like a chatbot.

## Red lines — non-negotiable design constraints

- **Opt-in enrollment required.** Skill inference only runs inside an explicit, named study program the owner started. Drill interactions outside that state are ephemeral.
- **Full transparency screen.** Per-descriptor skill estimate + evidence list + next-lesson justification, always one tap away. If the system thinks something, the owner can read it verbatim.
- **Durable override.** Skipping a lesson or declaring mastery is respected for N sessions and does not trigger adversarial re-inference.
- **Three-way reversibility.** Per-descriptor reset, global reset, and *incognito drill* (practice without being graded).
- **No streaks, no shame, no notifications.** Zero engagement-pressure mechanics. Missing a week is not a failure state.
- **Flat lesson index always accessible.** Adaptivity sets default order only; every descriptor is reachable manually at any inferred skill level.
- **No gamified-infantile language.** Editor's-note tone. No badges, no mascots, no celebratory copy.
- **No cross-surface contamination.** Table-mode LiveAdviceBar never shades its recommendations based on inferred-weakness-in-descriptor-X. Study inference stays in the study surface. ([Self-Determination Theory — Ryan & Deci](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf): controlled motivation undermines autonomous engagement.)

## Yellow lines — design trade-offs to be conscious of

- **Cold-start without history.** With no inferred state, seeding must fall back to a transparent heuristic (descriptor dependency graph: Equity Curve before Spire; Silhouette before Narrowing Ribbon) rather than demanding a diagnostic quiz. The skeptic's nightmare is a 10-question placement test on day one.
- **"Skip as signal" ambiguity.** A skip could mean "I know this" or "I'm avoiding this because it's hard." The design must ask the owner to disambiguate *once* (one-time tap on the skip: "already know" vs. "not today") rather than inferring silently. ([PokerCoaching — Fake Solver Era](https://pokercoaching.com/blog/we-are-in-the-fake-poker-solver-era/): poker culture already distrusts tools that tell players what they know.)
- **Spaced repetition bleed.** SR is legitimately useful and the Scholar persona wants it; but the same mechanic applied to the owner without consent becomes Anki reset-shame. Gate SR behind the same enrolled-flag and make intervals visible and editable.
- **Future-user drift.** Today the app has one user; a future Scholar persona will *want* streaks and badges. When that moment comes, the gamification must be a separate, opt-in "Scholar mode" — it must not be the default surface or retrofit onto the owner's experience.
- **"Adaptive" as marketing temptation.** Resist the framing that more adaptivity = more value. For this owner, *less* adaptivity with more transparency is the higher-value product.

Sources:
- [Deceptive Patterns — Duolingo brand page](https://www.deceptive.design/brands/duolingo)
- [Design Buddy: Duolingo's unethical design?](https://designbuddy.substack.com/p/monthly-issue-may-2024)
- [Self-Determination Theory — Ryan & Deci 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)
- [Frontiers in Psychology — SDT and self-directed e-learning](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1545980/full)
- [Common Sense Education — Filter Bubble Trouble](https://www.commonsense.org/education/digital-citizenship/lesson/filter-bubble-trouble)
- [PMC — Rethinking Filter Bubbles and Echo Chambers](https://pmc.ncbi.nlm.nih.gov/articles/PMC8923337/)
- [PokerCoaching — We Are In The Fake Poker Solver Era](https://pokercoaching.com/blog/we-are-in-the-fake-poker-solver-era/)
