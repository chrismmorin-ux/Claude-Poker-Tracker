# Gate 2 Voice 01 — Product / UX Lead

**Project:** Monetization & PMF
**Date:** 2026-04-24
**Stages covered:** A (persona sufficiency), C (situational stress), E (heuristic pre-check)

---

## Opening framing

This project does something the existing design framework has never done: it creates a cohort of users who have not yet committed to the app. Everything before today was designed for already-committed users. The Evaluator persona and its 2 situational sub-personas try to model the uncommitted cohort — but authoring a persona from zero, without a single evidence ledger entry, is load-bearing on assumption. My stance: the personas are structurally plausible, but the design needs to acknowledge how thin the evidence is and plan to ratify via telemetry, not vibes.

Separately, the paywall-spectrum design doc is excellent cataloging work but its top recommendation (bundle α) is stated with more confidence than the data supports. I want to push on two things: (1) is the Evaluator truly one persona, and (2) does the recommended bundle survive Stage C situational walkthroughs.

---

## Stage A — Persona sufficiency

### Is the Evaluator one persona or three?

The Session 1 author flagged 3 sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) inside the Evaluator core persona and parked the fold-or-split decision for this session. My read:

- **E-CHRIS vs E-SCHOLAR have materially different first-60-seconds wow moments.** E-CHRIS wants to see a live exploit recommendation fire at a table; E-SCHOLAR wants to do a drill better than GTO Wizard's. Different onboarding copy, different sample data, different paywall trigger locations. Treating them as one persona underspecifies first-run UX.
- **E-IGNITION is structurally different.** The surface is the extension sidebar, not the main app. Commercial lane is separate. This evaluator installs a Chrome extension, not a mobile app. Trial-first-session for E-IGNITION happens mid-online-session, which conflicts with the current `trial-first-session.md` assumption that trial happens off-table. 
- **Unified parent makes sense for the cognitive-shape attributes** (the "don't know the domain yet" + "one bounce from gone" + "will not read documentation" framing), but the *goals*, *frustrations*, and *tier fit* diverge.

**Recommendation:** split E-IGNITION out as a separate core persona (different device, different commercial lane, different situational). Keep E-CHRIS and E-SCHOLAR as attributes-of or situational variants of the unified Evaluator — they share first-run surface area.

**Alternative path:** keep all three as situational sub-personas of the unified Evaluator core. The Evaluator parent doc describes the universal cognitive shape; the situationals specify the shape of the problem-they-arrived-with. This is cheaper to author, matches the existing core/situational pattern, and doesn't over-fragment the persona cast.

I lean toward the alternative: `evaluator.md` as core (unified), plus `evaluator-ignition-mode.md` as a situational that captures the Chrome-extension specifics. E-CHRIS and E-SCHOLAR don't need files because they're already captured in `trial-first-session.md` (which works for both) and in each core persona's Tier-fit note.

### Missing evaluator shapes?

- **Coach-shape evaluator.** The `coach.md` core persona exists but is scoped to already-using-the-app coaches. A coach considering the app for their students — different cognitive shape. **Realistic audience size: near-zero.** No surfaces target Coach JTBDs today. Accept: defer Coach-evaluator to when Coach features ship.
- **Banker / Staker evaluator.** The `banker-staker.md` persona exists for staking flows. An evaluator from staker community — evaluating for tracking horses. **Realistic audience: near-zero** in Phase 1. Accept: defer.
- **Analyst / API-user evaluator.** The `analyst-api-user.md` persona exists for data-export flows. An evaluator looking for a data source. **Realistic audience: non-zero** (poker-data community). Accept: defer but flag for Gate 3 ON-88 (expert-bypass) JTBD to acknowledge this shape exists.
- **Home-host evaluator (Ringmaster-shape).** Evaluator looking to track home-game sessions. **Realistic audience: modest.** Accept: defer. Home-game features (SG-54..59) are all Proposed.

**Verdict:** one new situational (evaluator-ignition-mode) if we want E-IGNITION explicit. Otherwise Evaluator + existing two situationals are sufficient for Phase 1. Defer Coach/Staker/Analyst/Ringmaster evaluator shapes until their respective features ship.

### Stage A output

⚠️ **Patch needed** — small. Add `evaluator-ignition-mode.md` situational OR keep 3-sub-shape attributes in unified Evaluator with explicit Ignition-specific first-run path documented at Gate 4. Neither requires core-persona fork.

---

## Stage C — Situational stress test

### Walking each situational against the paywall-spectrum bundles

**`trial-first-session` (5–15 min window):**
- Against **bundle α (session-scoped free)**: ✓ works. Evaluator opens app, enters 3–5 hands in sample data or their own, sees recap at session close, hits soft "keep it? Plus preserves across sessions" offer. No urgency. No timer. No first-60-second bounce risk from paywall — the paywall doesn't intrude.
- Against **bundle β (14-day trial)**: ❌ works for conversion, fails for persona. Evaluator sees "14 days remaining" banner on view and bounces because they didn't sign up for a timer. If Q1=A, bundle β is disqualified by doctrine; if Q1=B/C, bundle β is still hostile to this persona's "not committed yet" cognitive state.
- Against **bundle δ (founding-member + indefinite-free)**: ✓ cleanest for this persona. First-run feels ungated; founding offer appears as optional sidebar, not interrupt.

**`returning-evaluator` (2+ day drift return):**
- Critical UX invariant: **state preservation across evaluator sessions** is non-negotiable. The current IDB-first architecture supports this (SA-70 Active). But the paywall bundle must not gate re-entry to prior state.
- Bundle α: ✓ works but exposes the "history gate" concern — if returning-evaluator's previous session is now locked behind history-gate, they see the gate before they see the value. Order matters: show them their previous session's data on open, gated cleanly ("your last session is preserved; reopen with Plus" or similar editor's-note framing).
- Bundle β: risky. If their 14-day trial expired between sessions, they return to a degraded experience without having consented to that state.
- **Recommendation:** returning-evaluator always opens to a re-orient state that shows "last session: N hands" factually, never to a paywall modal. Paywall accessed via primary action (clicking locked feature), not as entrance hurdle.

### Cross-persona concern: does anyone trial the app AT a live table?

The `trial-first-session` persona assumes the first trial happens off-table ("home, couch, desk, commute, parking lot"). **But if E-CHRIS evaluators are our biggest commercial lane**, then first-trial-at-table is plausible: the player installed earlier today and tries it at tonight's session.

At-table trial creates conflict:
- `trial-first-session` says 5–15 min window, moderate attention, two-handed, home-like context.
- `mid-hand-chris` says 1.5s glance budget, single-handed, dealer-pressured context.

**These are incompatible.** A user cannot be both situationals simultaneously. Resolution: if the user opens the app at a table for the first time, the app must adapt — either defer sample data + feature discovery to later, OR the live advice engine must render in an immediately-useful-without-orientation way.

**Realistic design decision:** assume trial-first-session is off-table. If E-CHRIS evaluators trial at-table, they experience a frustrating first session (landing page + tour + sample data doesn't fit). Accept this cost, or build an at-table-evaluator path at Gate 4 (probably: sample-data mode auto-dismissed if real-hand-entry detected).

### Cross-persona concern: returning-evaluator vs state-clear invariants

SR-program's 11 state-clear asymmetries enumerate how state leaks between screens. An evaluator returning after drift might encounter stale state from their first session (draft villain profiles, in-progress hand entries, cached advice) — and not know which is fresh vs. stale.

**Recommendation:** returning-evaluator sees explicit "resume from last session" vs "start fresh" choice at re-entry. This respects state-clear discipline without making the user's previous work invisible.

### Stage C output

⚠️ **Targeted adjustments.** No structural mismatches. Four Gate 4 constraints:

1. Returning-evaluator's re-entry must show previous state factually, not through a paywall interrupt.
2. Trial-first-session is assumed off-table; at-table evaluator accepts degraded first experience (or Gate 4 spec authors an at-table-evaluator path).
3. Cancellation flow is a dedicated journey artifact; cancel-intent on any screen triggers it.
4. Returning-evaluator encounters explicit "resume vs. start fresh" choice on re-entry to avoid state-clear confusion.

---

## Stage E — Heuristic pre-check

### Nielsen 10

- **H-N01 (visibility of system status):** free-tier indicators must not be badges that scream "FREE" on every screen. A subtle state indicator in settings-adjacent area is sufficient. Bundle α candidate CTA register C5/C6 respects this; bundle β's urgency patterns violate.
- **H-N03 (user control & freedom):** cancellation must be ≤ 2 taps from settings, with no "are you sure?" dark patterns. SA-74 JTBD encodes this. Gate 4 journey `cancellation.md` enforces.
- **H-N05 (error prevention on upgrade flow):** upgrade CTA must have confirmation *only* if the action is billing-sensitive. Clicking "upgrade" → pricing page is fine (no confirmation needed); clicking "upgrade" → auto-charge is not (confirmation required).
- **H-N06 (recognition > recall):** tier names must be immediately readable. "Plus" and "Pro" are category-standard. "Ultra / Elite" overloads the GTO Wizard namespace (they use those). Avoid.
- **H-N07 (flexibility and efficiency):** power users shouldn't see repeated upgrade prompts after one dismissal. Once a free-tier user has dismissed an upgrade prompt, it should not re-fire for ≥ 7 days on the same surface.

### Poker-Live-Table heuristics

- **H-PLT01 (sub-second glanceability):** any paywall-state indicator on live-play surfaces (TableView, LiveAdviceBar) must not take >150ms to read. "Free" or "Plus" chip in top-right is sufficient; a colored banner is not.
- **H-PLT06 (misclick absorption):** upgrade CTA must NOT be in thumb-reach zone for destructive mid-hand actions. Top-right placement (out of thumb arc) is safer than bottom-center.
- **H-PLT07 (state-aware primary action):** upgrade CTA placement adapts — off-table it can be primary; during a live hand, it must be tertiary or absent.

### Mobile-Landscape heuristics

- **H-ML06 (touch targets ≥ 44×44):** pricing page buttons, paywall modal CTAs, cancellation confirm button — all scaled-measurement checked at Gate 4.
- **H-ML04 (scale interaction):** pricing comparison table at 1600×720 with `useScale` — does it fit? Gate 4 to mock and scaled-measure.

### Poker-specific heuristics

- **H-P01 (EV framing over marketing framing):** price copy in C5/C6 register should reference EV ("recovers a bb/hour misread") not "unlock premium." Bundle α's M2 messaging theme respects this.
- **H-P02 (stakes-agnostic):** pricing page should not assume a stake level in copy. "For live cash + tournament players" is fine; "For high-stakes players" excludes.

### Session-continuity heuristics (project-specific for this feature)

- **H-SC01 (paywall never interrupts active work):** the paywall must never fire mid-hand. Even if a free-tier user hits a quota limit mid-hand, they complete the hand first; paywall fires at hand-end or session-end. This adds to bundle α's story (U1 per-session limits that reset on session start).
- **H-SC02 (trial state legible outside settings):** a free-tier user who is unsure which tier they're on should be able to check in ≤ 2 taps from anywhere. Settings → Billing → tier card.

### Anti-pattern refusals (preemptive — Gate 4 must enforce)

1. **"Your free session ends in 3 minutes."** Timer-urgency mid-session. Refuse.
2. **"You've used 48/50 hands this month — upgrade now!"** Usage-quota with animated urgency. Refuse. Factual "48/50" text is fine; animation + "now!" is not.
3. **"Cancel — are you sure? You'll lose all your villain data."** Guilt trip. Refuse. Honest statement: "Cancel Plus. Your data stays in your device."
4. **"Downgrade"** framing on cancellation. Refuse. Cancellation is cancellation.
5. **"We miss you!"** Re-engagement copy on returning-evaluator. Refuse.
6. **"Join 2,400 pro players."** Social proof with false or irrelevant number. Refuse. If we have 2,400 users, "we're a community of live grinders" framing is acceptable; fake numbers are not.

### Stage E output

⚠️ **Specific adjustments needed** but no structural heuristic incompatibility. The paywall-spectrum doc's bundle α respects these heuristics; bundles β/γ have violations that need copy-discipline enforcement.

**Critical follow-up:** anti-pattern refusal list must be authored at Gate 4 (mirror EAL's `anti-patterns.md` pattern). Without explicit refusal, future contributors introduce drift.

---

## Summary of recommendations (my voice)

1. **Keep Evaluator unified at core level; add one situational `evaluator-ignition-mode.md` for the Chrome-extension first-run.** OR keep 3-sub-shape attributes in unified Evaluator and spec at Gate 4. Either works; fork at core-persona level is overkill.
2. **Returning-evaluator must get explicit "resume vs. start fresh" choice** at re-entry.
3. **Paywall never interrupts active work** — H-SC01 new heuristic for this project.
4. **Cancellation is its own journey** — `journeys/cancellation.md` at Gate 4 with copy-discipline enforcement.
5. **Anti-pattern refusal list at Gate 4** (mirror EAL pattern).
6. **Q1 doctrine scope verdict is the unlock for Stage E** — my heuristic analysis above is Q1=A-assuming; Q1=B/C weakens several refusals.

**Overall verdict from my voice:** YELLOW. Not RED — the existing work is structurally sound; refinements at Gate 3 + Gate 4 close the gaps.
