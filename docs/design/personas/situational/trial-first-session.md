# Persona — Trial First Session (Situational)

**Type:** Situational sub-persona of [Evaluator](../core/evaluator.md)
**Evidence status:** Owner-Confirmed (structural) — PROTO-evidential (unverified; awaiting Stream D telemetry)
**Last reviewed:** 2026-04-24
**Owner review:** Confirmed 2026-04-24 at Monetization & PMF Gate 3 (structural shape ratified; evidential assumptions TFS1–TFS4 remain proto pending telemetry)

---

## Snapshot

The Evaluator in their very first interaction with the app. Five-to-fifteen-minute window. They installed, opened, and are now deciding in real time whether this is worth continuing with. This is the thinnest, most fragile slice of the Evaluator's journey — one bad moment ends it.

Most first sessions happen on a phone, not at a poker table. The evaluator is in evaluation mode, not play mode.

---

## Context

- **Trigger:** Fresh install or first website visit post-signup (or pre-signup if free-tier has no account gate).
- **Environment:** Anywhere. Most commonly: home (couch, desk), in transit (commute), sometimes in a poker room parking lot before a session. Often quiet-ish; occasionally noisy but not game-pressure.
- **Duration:** **5–15 minutes**. Outside of poker tooling norms this may feel short, but B2C first-session attention is this short.
- **Device:** 70%+ phone, 30% desktop (estimated; to be validated by acquisition data).
- **Intent:** "Let me see if this app is worth keeping."
- **Cognitive state:** Evaluation + light curiosity. Not committed, not hostile. Ready to be impressed or to bounce.

---

## Time / attention budget

- **First 5 seconds:** do they understand what the app is?
- **First 60 seconds:** do they see one "wow" moment?
- **First 5 minutes:** do they finish a meaningful unit of value (a sample hand, a drill, a session recap)?
- **First 15 minutes:** are they coming back?

If the 5-second check fails, 95% bounce. If the 60-second check fails, 70% bounce. The funnel is steep.

---

## Goals

- **Get oriented fast.** Understand what the app does and how the main screen works within the first few seconds.
- **See one useful thing.** The exploit engine makes a call, a drill teaches something, a session recap explains something — anything where they go "huh, that's new."
- **Try a feature they specifically came for.** If E-CHRIS, they want to see a live recommendation. If E-SCHOLAR, they want to try a drill. If E-IGNITION, they want the sidebar to capture a hand.
- **Not feel hustled.** No premature upsell, no account-wall, no popups covering the feature they were using.

## Frustrations

- **Forced onboarding tour that won't let them skip.** Assumption: kills session by minute 2.
- **Modal stack.** Dismissing 3 modals to see the main UI is bounce-territory.
- **Paywall before value.** If the feature that drew them in is locked in the free tier, they leave.
- **Jargon without definitions.** SPR, MDF, ICM, 3-bet-range shown without tooltip = "this isn't for me."
- **Nothing happens.** The most common first-session failure: user opens app, doesn't know what to do, closes it.

## Non-goals

- **Full feature exploration.** They don't want a product tour; they want to try the thing.
- **Account setup.** Defer as long as possible.
- **Pricing commitment.** They will look at pricing but won't buy in this session unless something extraordinary happens.

---

## Constraints specific to this persona

- **Time pressure:** Very high. 5–15 minutes before attention saturates.
- **Error tolerance:** Near zero. A crash = session over and probably uninstall.
- **Visibility tolerance:** High for core nav, moderate for feature discovery. The main screen must read in a glance.
- **Recovery expectation:** Skip, back, undo must be one tap away always.

---

## What this persona exposes about paywall design

Trial-first-session is the persona that paywall placement gets tested against. Specifically:

1. **L1 (first-launch paywall)** is disqualified against this persona outright. There is no felt value at first launch.
2. **L2 (feature-first-open paywall)** must be editor's-note (C6) or the user bounces. Assume hostile first encounter if cold.
3. **L3 (usage-threshold paywall)** does not usually fire in the first session — the thresholds are too low. Good, because this persona is pre-conversion.
4. **L7 (time-trial paywall)** is irrelevant to this persona (they haven't even reached the timer yet) but its *visibility* in the UI matters. A "14 days remaining" banner in trial-first-session feels coercive.

---

## Required UX patterns (seed for Gate 4)

These are hypotheses for Gate 4 surface specs:

- **First-run landing state** — the app opens to a screen that does one thing: shows the app's value in one sentence + one button.
- **No onboarding tour by default; one-tap tour available.** Skip is equal visual weight (ON-84 precedent + ON-87 expert-bypass pattern).
- **Sample data mode** (ON-86 JTBD) — 2–3 demo hands loaded with realistic villain profiles so the exploit engine fires on a known input without the user needing to enter anything. Labeled as sample explicitly.
- **Account creation deferred** — evaluator can use the app in anonymous mode for full first session. Account creation prompted only at (a) action requiring persistence (save villain profile across sessions) or (b) paywall hit (convert to paid).
- **Pricing visible but not intrusive.** A small link in nav / footer. No "upgrade" banner competing with the feature they're trying.

---

## Related JTBD

- **SA-71** — Try the product before paying
- **SA-72** — Understand what's free, what's paid, and why
- **ON-82** — 90-second product tour
- **ON-83** — First-hover jargon explanations
- **ON-86** — Sample data for evaluation
- **ON-88** — Expert-bypass onboarding for category-experienced evaluators

## Related core persona

- [Evaluator](../core/evaluator.md)

---

## Proto-persona caveat

- **[TFS1]** 5–15 minute window is the canonical first-session length for this category. Basis: B2C SaaS onboarding norms. Verify: PostHog first-session duration data post-launch.
- **[TFS2]** 60-second wow moment is the make-or-break threshold. Basis: landing-page conversion research. Verify: first-session bounce correlation with sub-60s time-to-first-value.
- **[TFS3]** Anonymous mode for first session is feasible given the IDB-first architecture. Basis: no account system exists today; local-only mode is JTBD SA-70 Active. Verify: engineering feasibility check at Gate 4/5.
- **[TFS4]** Paywall in first session = near-100% bounce. Basis: freemium industry data. Verify: post-launch A/B on paywall-delay.

---

## Change log

- 2026-04-24 — Created in Session 1 of monetization-and-pmf project. PROTO; specifies the 5–15 minute first-encounter slice of the Evaluator's journey.
- 2026-04-24 (later same day — Session 3b) — **Ratified to Owner-Confirmed (structural)** at Monetization & PMF Gate 3. Owner ratified structural shape: 5–15 min window, 60-second wow threshold, off-table default assumption, at-table degraded path acceptable. Evidential assumptions TFS1–TFS4 remain proto pending Stream D telemetry (first-session duration distribution, bounce-correlation with sub-60s time-to-first-value, anonymous-mode feasibility, paywall-in-first-session bounce rate). Full Verified pending.
