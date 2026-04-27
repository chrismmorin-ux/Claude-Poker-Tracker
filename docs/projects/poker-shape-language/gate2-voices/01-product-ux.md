# Product/UX Lead — Gate 2 Voice: Adaptive Lesson Seeding

Scope audited: the 10-descriptor Shape Language curriculum (Silhouette, Equity-Distribution Curve, Spire+Polarization, Sizing Curve Tag, Saddle, Basin+Sankey, Ridgeline+Ribbon, Contour Tree, Equity Basin Map, Hand Trajectory) surfaced adaptively across HandReplay, SessionsView, PresessionDrillView, LiveAdviceBar, SizingPresetsPanel. "Adaptive seeding" = per-descriptor skill-state inference that orders/chooses/surfaces lessons.

## Stage A — Persona sufficiency
**Verdict:** ⚠️ (leaning ❌ on one dimension)

**Findings:**
- **`chris-live-player` has no skill-progression attribute.** The core persona is framed as an *already-competent* live player compensating for memory limits — "He knows the app; any first-run friction is pure cost." It is silent on "Chris in month 6 of learning Shape Language when his Saddle-recognition is mastered but his Ribbon reading is cold." Adaptive seeding *requires* this attribute; today there is nowhere to hang it.
- **`scholar-drills-only` covers self-directed study but not *progression-over-time*.** The persona captures session-shape ("30 min on the subway") and mood ("daily streak"), but not a longitudinal skill-state per concept. It treats mastery as a frustration ("feel fluency — know they're improving objectively") without modeling how the app knows.
- **`apprentice-student` is the closest fit but carries a coach dependency.** Apprentice progresses "through assigned drills" — external authority sets the curriculum. Adaptive seeding has *no coach*; the system itself is the seeding authority. This is a new archetype: self-directed, system-paced, no-coach learner. Apprentice-minus-coach is not a trivial subset.
- **`coach` is irrelevant to v1.** Coach uses student progression data; coach does not consume their own skill-seeded lesson order. If the feature later exports skill-state to coaches (Coach dashboard), that is a separate scope and should be explicitly out of Gate 1 v1.
- **`newcomer` is a *disqualifying* persona for this feature.** Newcomers explicitly cannot absorb Shape Language vocabulary (Silhouette, Saddle, Ribbon) — the Cognitive Scientist's chunkability argument in the roundtable presupposes a working-memory budget Newcomer doesn't have. If adaptive seeding activates for Newcomer, it fails H-N10 + H-PLT01.
- **`first-principles-learner` situational is the closest match** — it models range-first-habit-formation *as a process over time*, with an explicit exit condition ("when the learner can articulate the reasoning without the surface's assistance"). Adaptive seeding is the same shape across 10 descriptors. But it is *situational*, not a core attribute, so it doesn't get consulted on non-study surfaces (LiveAdviceBar, mid-hand).
- **Missing archetype: the plateaued learner.** Nothing in the cast captures "6 weeks stuck on Sizing Curve Tag — the seeding algorithm must respond." Is this a demotivation risk? A signal to switch descriptors? Persona silence = design silence.
- **Missing archetype: the skill-refresher.** Returning after a break — skills decayed. The seeding model's assumption that prior mastery persists is a load-bearing one that current personas don't stress-test.

**Recommended follow-ups:**
- Add **skill-state as a persona attribute** on `chris-live-player`, `scholar-drills-only`, `apprentice-student`: per-descriptor `{level, confidence, lastTouched, trendDirection}`. This is a Gate 3 research item — what *are* the stable skill levels for Shape Language? (Pre-prototype, Novice, Practicing, Reliable, Mastered? Fewer?)
- Author a new core persona: **`self-directed-curriculum-learner`** (working title). Owner in month 6 is this persona. Key attributes: no external coach, continuous (not bursty) practice, heterogeneous skill-state across the 10 descriptors, sensitivity to plateau/stuck signals.
- Author two situational sub-personas: **`plateaued-learner`** and **`returning-learner`** (skills decayed, needs re-calibration).
- Explicitly **exclude Newcomer from seeding v1.** Gate 4 must state this as a design constraint; Newcomer's `mid-hand` situational cannot be exposed to Shape Language vocabulary.

## Stage C — Situational stress
**Verdict:** ❌

**Findings:**
- **`mid-hand-chris` is the most hostile context for this feature and the roundtable's `LiveAdviceBar` embed ignores that.** Time budget < 1.5s; "No layout changes during a hand." A seeding nudge ("now watching for your Saddle recognition") inserted mid-hand violates H-PLT01, H-PLT07, and the `mid-hand-chris` constraint "The shape of the screen should not move unless the hand state changes." **Structural mismatch**, not a tuning issue. The LiveAdviceBar embed for adaptive seeding must reduce to *passive* state (the descriptor badge appears because the classifier fires, not because the seeding system chose this hand as a teaching opportunity). Teaching opportunities never interrupt mid-hand.
- **`between-hands-chris` (30–90s) is plausible but narrow.** A 5-second "we noticed a Spire on Seat 4 — want to log the recognition?" prompt is acceptable *if* it can be dismissed with a single corner-of-screen tap and never blocks player swap. But the feature description does not scope this; seeding that fires in this window must respect that the primary between-hands job is villain-read logging and player swap, not lesson consumption.
- **`seat-swap-chris` is a destructive-action-adjacent context the seeding system will probably ignore and break.** If seeding surfaces a descriptor-lesson prompt inside or near the seat context menu (to teach "Spire on new villain"), it will sit adjacent to Clear Player and compound the known H-PLT06 misclick risk documented in [EVID-2026-04-21-CLEAR-PLAYER]. Any seeding anchor must be explicitly banned from seat-swap surfaces.
- **`post-session-chris` is the feature's right home for heavy lessons** but the feature proposal as written ("we noticed you struggled with Saddles") is framed as a *grade report* rather than a *review tool*. The post-session persona wants drill-down paths, comparison to in-session advice, retroactive corrections — not quizzing. The framing is a persona violation even though the surface is correct.
- **`study-block` (10-min subway, 30-min morning coffee) is the feature's primary home** and the feature proposal underuses it. Study-block explicitly wants "targeted-weakness drill as the default path — no friction to start." This *is* adaptive seeding's ideal situational. But there is a subtler failure: **study-block with a hard end ("I have 10 minutes before my stop")**. Seeding must complete a coherent unit in the declared window — not leave the learner mid-concept when they close the app.
- **`presession-preparer` is the *critical* stress-test persona.** The owner might open the app 15 min before a session expecting tonight's-villain-specific prep (per that persona's primary need). Adaptive seeding that delivers a *general* Shape Language lesson instead of tonight's-villain Shape recognition is a direct persona collision. Which wins? The roundtable proposal doesn't resolve it, and this is the single highest-risk clash in the situational cast.
- **`newcomer-first-hand` must be an explicit block on the feature.** The feature cannot fire while this persona applies. Today there is no machinery to detect "first hand" vs "hand #647" — the feature inherits this gap.
- **Skill-model persistence across phone-sleep + seat-swap context switches** (per H-PLT05, H-PLT08) is uncovered. If the skill-model lives in IndexedDB-backed state (per project convention), good. If it lives in transient reducer state, phone sleep mid-assessment-drill loses progress — critical failure.

**Recommended follow-ups:**
- Gate 3 research must specify **a whitelist of situations where seeding can surface, not a blacklist.** Mid-hand, seat-swap, newcomer-first-hand are never whitelisted. Study-block + post-session + presession-preparer (with tonight's-villain resolution) are the only three v1 hosts.
- Add design constraint: **the `presession-preparer` vs `adaptive-seeding` arbitration rule** — presession wins by default; adaptive seeding appends tonight-adjacent patterns only.
- Add design constraint: **time-budget-aware seeding.** Per study-block and presession patterns, surface a lesson *unit* that completes in the declared window.
- Verify skill-model is IndexedDB-persisted with the same resilience pattern as hand data (per PERSISTENCE_OVERVIEW.md); Gate 3 must document this invariant.

## Stage E — Heuristic pre-check
**Verdict:** ⚠️

**Findings:**
- **H-N03 (user control & freedom) — undo on mastery declarations.** If the user or system marks "Saddle: mastered" and the assessment was wrong, the seeding algorithm will starve that descriptor of practice. Declaration must be revocable indefinitely, not via a 5-s toast. Spec this as a "recalibrate this descriptor" action on the skill-map.
- **H-N03 — undo on algorithmic inference.** Even more subtle: the system *infers* mastery from successful drill outcomes. The user must be able to dispute the inference ("I got lucky on those three, keep drilling me"). Without this, seeding becomes a black box.
- **H-N05 (error prevention) — ambiguous "skip" vs "mastered."** A user tapping "skip" on a drill they found too easy may get interpreted as mastery; a user tapping skip because they're tired gets interpreted the same way. Disambiguate at tap time.
- **H-PLT07 (state-aware primary action) — seeding's primary action changes by situation.** In study-block the primary action is "start today's drill." In post-session the primary is "review what fired." In presession it's "tonight's watchlist." If seeding presents *one* fixed primary action across surfaces, it violates PLT07. This is a design requirement.
- **H-ML06 (touch targets ≥44×44 scaled).** Skill-map visualizations (10 descriptors × levels) on a 1600×720 viewport under the `useScale` transform will compress sub-44-px per cell unless explicitly designed against it. Flag pre-emptively; Gate 4 must show the scaled-measurement math.
- **H-PLT01 (sub-second glanceability).** If adaptive seeding embeds on LiveAdviceBar, the seeded badge cannot compete with the primary recommendation. Silhouette/Spire/Saddle glyphs are Shape Language *artifacts*, not seeding surfaces; the seeding *algorithm* should never render on LiveAdviceBar — only the descriptor output does. Gate 4 must draw this line.
- **H-N10 (help & documentation).** Shape Language vocabulary is new to the owner in month 1. Seeding that surfaces "your Basin recognition is weak" to a learner who hasn't met the Basin descriptor yet fails H-N10. Seeding must be aware of descriptor-introduction order and never refer to un-introduced descriptors.
- **H-PLT04 (socially discreet).** A "you are learning" indicator at the live table is a violation — conspicuous to tablemates. Seeding artifacts on LiveAdviceBar must be indistinguishable at a glance from normal advice.

**Recommended follow-ups:**
- Gate 4 design spec must include: recalibrate-descriptor action, disambiguated skip-vs-mastered controls, surface-specific primary-action map, scaled-viewport measurement for skill-map, descriptor-introduction-order invariant ("never reference un-introduced concepts"), and a LiveAdviceBar-stays-invisible rule for seeding internals.
- Add to surface spec: seeding's on-screen footprint is *descriptor badges* (existing plan) — not a new "learning" overlay. The algorithm is headless on live surfaces.
