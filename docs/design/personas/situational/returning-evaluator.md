# Persona — Returning Evaluator (Situational)

**Type:** Situational sub-persona of [Evaluator](../core/evaluator.md)
**Evidence status:** Owner-Confirmed (structural) — PROTO-evidential (unverified; awaiting Stream D telemetry)
**Last reviewed:** 2026-04-24
**Owner review:** Confirmed 2026-04-24 at Monetization & PMF Gate 3 (structural shape ratified; evidential assumptions RE1–RE4 remain proto pending telemetry)

---

## Snapshot

An Evaluator who tried the app at least once, drifted away (didn't convert, didn't fully uninstall), and came back days or weeks later. Their cognitive state is neither first-impression nor committed-user — it's "does this still make sense for me?"

This is the persona that decides the second-chance conversion: the ones the first session didn't land for, but who remembered the app and came back. Losing them at this step costs a reachable conversion.

Distinct from `returning-after-break` (situational in the Chris/Scholar domain, which is about skill-state retention after time away from *play*). Returning-evaluator hasn't *committed* yet; they're still evaluating.

---

## Context

- **Trigger:** Opening the app after 2+ days of non-use in the evaluation period. Or clicking a re-engagement email / notification. Or returning from a poker session and thinking "let me check that app I installed."
- **Environment:** Similar to trial-first-session but with *memory* — they remember what the app looked like, have opinions from first session.
- **Duration:** **3–10 minutes** typically. Shorter than first session because they're trying to re-orient, not learn from scratch.
- **Device:** Same device usually (install persists).
- **Intent:** "Does this still make sense for me? Has anything changed? Did I miss something?"
- **Cognitive state:** Neutral-to-mildly-skeptical. They didn't convert on first try; something cost them. The app gets a second chance.

---

## Goals

- **Re-orient quickly.** Remember where they left off. What was the last thing they did?
- **Pick up a thread.** Not start over — continue something started before.
- **See if something changed.** New feature? Better onboarding? Different pricing?
- **Decide whether to convert or uninstall.** The third visit is often make-or-break.

## Frustrations

- **Having to redo first-run setup.** They already did this; asking again is an insult.
- **Not remembering what their "previous state" was.** The app should show them.
- **Losing prior input.** If they entered hands last session and those are gone, the evaluator takes it as a signal the app is unserious about their time.
- **Aggressive re-engagement copy.** "We miss you!" in the UI triggers red-line-#5 violations and is a reason to uninstall.
- **Changed app they don't recognize.** Big UX shifts between visits feel like instability.

## Non-goals

- **Learning the app from scratch.** They already did this.
- **Exhaustive feature tour.** Again.
- **New-user celebrations.** They're not a new user; treating them as one is insulting.

---

## Constraints specific to this persona

- **Time pressure:** Moderate (3–10 min, slightly relaxed vs. first session because they chose to come back).
- **Error tolerance:** Low — they already have some evaluation-period skepticism.
- **Visibility tolerance:** High for "what changed since I was last here" cues; low for marketing re-pitch.
- **Recovery expectation:** "Resume from where I was" behavior expected. Session-scoped work from prior visit should be reachable.

---

## Signals this persona would generate in telemetry

(For Stream D persona-inference dashboard.)

- Non-first-time app open with > 2 day gap since last open.
- Browser / device remembered; no fresh-install signature.
- Initial dwell on a view they used last session (suggests re-orient pattern).
- Pricing page re-visit within first 3 minutes (suggests "did price change" evaluation).
- Feature abandonment rate in this session < first-session baseline (slight commitment increase).

These signals differentiate returning-evaluator from trial-first-session in PostHog cohorts and let the product respond differently.

---

## What this persona exposes about design

1. **Session-resume is an Evaluator feature, not just a Chris feature.** The hands they entered in their first session should not have vanished. SA-70 (local-only mode) supports this, but the UI needs to *show* them their previous state explicitly.
2. **"What's new since you were last here" affordance.** Subtle. Non-intrusive. Version-aware. Only surfaced if there was actually meaningful change. Otherwise silent.
3. **No "we miss you" copy.** Returning-evaluator is a persona where red-line #5 has real bite — re-engagement language crosses the guilt/pressure line.
4. **The second chance is the full value moment.** Some first-session failures are recoverable in session 2 if the returning-evaluator is met with the feature they tried last time + a subtle hint at one they didn't.

---

## Required UX patterns (seed for Gate 4)

- **State preservation across evaluator sessions** — hands entered, villain profiles drafted, drill progress. Preserve by default; offer clear "start over" only as opt-in.
- **"Last session: N hands" affordance** on app open — factual, no emotional framing. Like a phone showing "last used 3 days ago."
- **No re-engagement notifications or emails unless opt-in.** Red line #5 binds strictly; push notifications are the single largest engagement-pressure surface in consumer apps.
- **Pricing page unchanged from first visit** — price stability is trust. If pricing has genuinely changed, a small factual note ("We updated pricing on [date]").

---

## Related JTBD

- **SA-71** — Try the product before paying
- **SA-72** — Understand what's free, what's paid, and why
- **CC-79** — Navigation that returns to prior position (existing)
- **CC-77** — State recovery to exact position after crash (existing; applies to graceful session resume, not just crash)

## Related core persona

- [Evaluator](../core/evaluator.md)

## Related but distinct

- [Returning after break](./returning-after-break.md) — that persona is about Chris/Scholar returning to *active use* after time away from poker. Returning-evaluator hasn't committed to use; they're still deciding.

---

## Proto-persona caveat

- **[RE1]** 2-day drift threshold is representative of evaluator attrition. Basis: consumer-app re-engagement data norms. Verify via PostHog cohort retention curves.
- **[RE2]** Returning-evaluator has moderate conversion probability (higher than first-session, lower than Chris). Basis: SaaS funnel assumption. Verify: second-session conversion rate once data accumulates.
- **[RE3]** State preservation across sessions is expected even for unpaid / unauthenticated users. Basis: IDB-first architecture + red line #9 (reversibility). Verify: engineering feasibility + doctrine compliance review at Gate 4.
- **[RE4]** Re-engagement push notifications net-negative for this persona. Basis: autonomy red line #5. Verify: A/B test if notifications are ever seriously considered (expected: disqualified at Q1 verdict).

---

## Change log

- 2026-04-24 — Created in Session 1 of monetization-and-pmf project. PROTO; fills the drift-then-return slice of the Evaluator's journey that first-session doesn't cover.
- 2026-04-24 (later same day — Session 3b) — **Ratified to Owner-Confirmed (structural)** at Monetization & PMF Gate 3. Owner ratified structural shape: 2+ day drift threshold, resume-vs-start-fresh re-entry choice, no re-engagement push copy, state-preservation across evaluator sessions. Evidential assumptions RE1–RE4 remain proto pending Stream D telemetry (2-day threshold validation via cohort retention curves, second-session conversion probability, state-preservation-for-unpaid feasibility, push-notification net-effect). Full Verified pending.
