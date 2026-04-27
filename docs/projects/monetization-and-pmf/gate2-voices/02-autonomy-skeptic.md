# Gate 2 Voice 02 — Autonomy Skeptic

**Project:** Monetization & PMF
**Date:** 2026-04-24
**Stages covered:** A (persona sufficiency — autonomy angle), E (heuristic pre-check — red lines)

---

## Opening framing

The 9 autonomy red lines in `chris-live-player.md` §Autonomy constraint were written for **skill-gating**. The Monetization project is asking whether they also apply to **commerce-gating** (paywall, trial, cancellation, billing, renewal). The charter parks this as Q1 for Gate 3. My job is to argue for Q1=A (all commerce UX binds the red lines) and to stress-test every paywall-spectrum option against those red lines before Gate 4 surface design proceeds.

If Q1=A wins, this voice's work is mostly done — bundle α is the doctrine-compliant choice, and Gate 4 enforces copy discipline.
If Q1=B (selective), I need to argue which specific red lines bind commerce and which don't.
If Q1=C (skill-only, commerce is free of doctrine), I need to flag which positioning costs follow — the "no streaks, no guilt, two-tap cancel" differentiator is no longer available, and the product becomes a commodity-indistinct-from-GTO-Wizard on commerce UX.

**My strongest prior:** the doctrine IS the product differentiator. Weakening it weakens the one thing that distinguishes this app from the GTO Wizard / Upswing / Run It Once category. Commercial UX that violates the doctrine while marketing claims autonomy-respect is a credibility fracture users will discover on cancellation.

---

## Stage A — Autonomy concerns in persona authoring

### The Evaluator persona is an applied-case of red line #1 (opt-in enrollment)

The Evaluator has never consented to be modeled, tracked, or analyzed. They arrived to evaluate the app. Default behavior for the Evaluator must assume:

- Telemetry consent is not-yet-granted (Q8 verdict applies).
- No account creation forced before free-tier value.
- No data transmission to external servers (PostHog, analytics) until explicit consent.
- All modeling (skill inference, preference tracking, villain profile building) runs local-only until consent.

This means **Stream D (PostHog telemetry) faces a harder UX decision than the charter lets on.** If Q8=B (opt-out with transparency panel), the first-run experience shows the panel before any event fires. That's a red-line-#1-respecting implementation but increases first-run friction. If Q8=A (opt-in), the product collects less data about the Evaluator's journey — exactly the cohort we most need data on.

**Recommendation:** Q8=B with a hard rule — no event fires before the user has either (a) explicitly consented (first-run panel dismissed with consent checkbox ticked) or (b) acknowledged the panel existence (dismissed without interacting with consent checkbox defaults to consent given, with clear "off-switch" path visible). This is the strictest-reasonable posture.

### Returning-evaluator surfaces red line #5 hard

The returning-evaluator persona explicitly notes: "No 'we miss you' copy." But the broader design pattern — push notifications, re-engagement emails, paywall reminders, trial-ending-soon warnings — all of this is *engagement-pressure* that red line #5 forbids.

**Red line #5's explicit mechanism list (for commerce UX applicability):**

- Push notifications → banned from re-engagement. Transactional notifications (payment succeeded, receipt) OK.
- Email re-engagement → banned ("we miss you" / "come back" / "you're missing out"). Transactional emails (receipt, cancellation confirmation) OK.
- In-app banner urgency → banned ("3 days left!"). Factual state indicators OK ("Free tier").
- Streak mechanics → banned. No "3 days in a row using the app" praise or shame.
- Loyalty-reward guilt — "you've been a subscriber for 12 months, don't leave now!" → banned.

**For Gate 4, this means:** no push-notification plumbing gets built, period. Email list for transactional use only. In-app copy reviewed against a forbidden-string grep rule at CI (mirror the EAL `calibrationCopy.js` pattern).

### Trial-first-session exposes red line #7 hard

The 5–15 minute window is the highest-stakes surface for red line #7 (editor's-note tone). The Evaluator hasn't committed. Any cajoling copy — "Start your journey!" / "Become the player you're training to be!" / "Join the pros!" — pushes them away, AND violates the tone rule. This is the situational where copy-discipline is most load-bearing.

Commerce copy that safely respects #7:
- "This is the app. Here's what it does." (factual)
- "These are the plans. Here's what each includes." (factual)
- "Continue with Plus for full session history." (opt-in ask)

Commerce copy that violates #7:
- "Ready to level up?" (cajoling)
- "Unlock your potential." (aspirational pressure)
- "Don't let your poker skills plateau." (shame/fear)

**Gate 4 must author a commerce-copy-register doc** that lists the forbidden copy ladder (mirrors EAL `anti-patterns.md`). First-run onboarding, upgrade prompts, pricing page headline, cancellation confirm — each has its own copy example with ✓/✗.

### Evaluator and autonomy-aware paywalls

The paywall-spectrum doc's L1 (first-launch paywall) is already noted as disqualified under red line #1 spirit. I agree. L2 (feature-first-open paywall) is borderline — my stance: L2 is acceptable if (a) the feature has been demonstrated in sample-data mode first, AND (b) the paywall copy is C6 (editor's-note). Absent either, L2 violates the autonomy contract.

L3 (usage-threshold) and L4 (history-access) are the cleanest — felt-loss is tied to user's own accumulated state, not to product-manufactured urgency.

L7 (time-trial end) is disqualified under Q1=A. Under Q1=B, it's conditionally acceptable IF the timer is non-urgent (no countdown animation, no flashing). Under Q1=C, L7 is freely usable but I flag it as positioning-cost.

---

## Stage E — The red lines applied to commerce UX

### Proposed 10 commerce red lines (derived from the 9 autonomy red lines + one new)

Enumerating what Gate 4 should enforce, assuming Q1=A:

1. **Opt-in enrollment for data collection** (inherits #1). Telemetry gated on user consent; no events fire before consent; consent is per-category (usage events vs. session replay vs. error tracking) and reversible.
2. **Full transparency on demand** (inherits #2). Billing settings always show: current tier, next billing date, amount, cancellation path, data export path — no hidden fees, no obscured dates.
3. **Durable overrides on billing state** (inherits #3). User cancels → app fully respects cancellation; no "we've paused your cancellation" dark patterns; cancelled users are not re-prompted to re-subscribe for ≥ 90 days.
4. **Reversibility** (inherits #4). Cancellation reversible before billing period ends; data retention preserved; refund policy explicit; data export on leaving is one-click.
5. **No streaks / shame / engagement-pressure notifications** (inherits #5). Push notifications banned for monetization. Renewal reminders factual + transactional only. No "don't lose your streak" / "you'll miss your stats."
6. **Flat-access pricing page** (inherits #6's spirit). Pricing page shows all tiers with clear feature comparison. No "most popular" social-proof nudges (unless factually true and editor's-note framed). No "limited time" banners.
7. **Editor's-note tone** (inherits #7). Every commerce surface has copy reviewed against forbidden-string list at CI.
8. **No cross-surface commerce contamination** (inherits #8). Free-tier indicator never interrupts live-play surfaces. Upgrade CTAs never appear on TableView during active hands. Sidebar commerce state separate from main-app commerce state (Ignition SKU doesn't leak into main-app paywall UX).
9. **Incognito observation mode** (inherits #9). Telemetry events respect per-event opt-out. User can use any feature without that use being transmitted; explicit per-event opt-out available.
10. **★ NEW — No dark-pattern cancellation.** Cancellation is ≤ 2 taps from billing settings. No exit-survey interposition. No "pause your subscription instead?" unless offered equally alongside cancel. Cancellation confirmation is factual, not guilt-framed.

### Applied to paywall-spectrum bundles

**Bundle α (doctrine-clean + session-scoped):**
- Red lines 1–10: all respected. ✓
- Conversion cost: moderate. Per industry data, loses the 2.5× urgency-trigger bump.
- My recommendation: accept the conversion cost. Differentiation > marginal conversion rate.

**Bundle β (conventional freemium with 14-day trial + renewal reminders):**
- Red line #5 violated (timer + urgency). ❌
- Red line #7 violated (renewal-reminder copy typically cajoling). ❌
- Red line #10 violated (typical SaaS cancellation retention flows). ❌
- Under Q1=A: disqualified.
- Under Q1=B: requires case-by-case exemption per red line; opens drift risk.
- Under Q1=C: no doctrine bind, but then the positioning differentiator is lost.

**Bundle γ (Scholar mastery-ladder):**
- Red line #5 edge case (M3 mastery-framing could cross into streak-mechanics). ⚠️
- Red line #7 mostly respected if framed "continue at your pace."
- My recommendation: acceptable if streak-celebration copy is forbidden. Gate 4 copy-discipline enforces.

**Bundle δ (founding-member + indefinite free):**
- Red lines all respected. ✓
- Scarcity is *transactional* (capped at 50 founding members), not engagement-coercive. ✓
- My recommendation: strong alignment.

**Bundle ε (Ignition SKU):**
- Red lines 1–9 respected.
- Red line #8 specifically requires clean separation — Ignition commerce state doesn't contaminate main-app commerce UX, and vice versa.
- My recommendation: acceptable; Gate 4 spec addresses #8 specifically.

### Anti-pattern refusal list (for Gate 4)

Enumerate explicit refusals in `docs/projects/monetization-and-pmf/anti-patterns.md` at Gate 4, mirroring EAL's format:

- **MPMF-AP-01 — Timer-urgency banners** ("3 days left!"). Refuse. Red line #5.
- **MPMF-AP-02 — Social-proof false counts** ("2,400 pros use Pro"). Refuse. Red line #7 (factuality).
- **MPMF-AP-03 — Streak celebrations** ("You're on a 7-day streak!"). Refuse. Red line #5.
- **MPMF-AP-04 — Re-engagement push notifications** ("Come back to your analysis!"). Refuse. Red line #5.
- **MPMF-AP-05 — Cancellation retention traps** ("Are you sure? You'll lose…"). Refuse. Red line #10.
- **MPMF-AP-06 — Downgrade-framing on cancellation** (calling cancellation "downgrade"). Refuse. Red line #7.
- **MPMF-AP-07 — "Missing out" loss-framing** ("Don't miss out on Pro features!"). Refuse. Red line #7.
- **MPMF-AP-08 — Dark-pattern checkout** (pre-checked upsell boxes, unclear prices). Refuse. Red line #2.
- **MPMF-AP-09 — "Limited-time" discounts** (fake scarcity). Refuse. Red line #5.
- **MPMF-AP-10 — Pre-paywall friction** (forced tutorial, forced account, forced email) before free-tier value delivered. Refuse. Red line #1.
- **MPMF-AP-11 — Silent auto-renewal** (renewal without advance notification). Refuse. Red line #2.
- **MPMF-AP-12 — Paywall mid-hand** (feature gate fires during active live-play). Refuse. Red line #8 + project-specific H-SC01.

### The Q1 verdict interacts with every bundle

I want to make this explicit in the audit:

| Bundle | Q1=A | Q1=B | Q1=C |
|---|---|---|---|
| α doctrine-clean | ✓ Recommended | ✓ Allowed | ✓ Allowed but loses positioning |
| β conventional | ❌ Disqualified | ⚠️ Case-by-case | ✓ Allowed |
| γ Scholar-ladder | ✓ Allowed (streak refused) | ✓ Allowed | ✓ Allowed |
| δ founding-indefinite | ✓ Recommended seed | ✓ Allowed | ✓ Allowed |
| ε Ignition-separate | ✓ Allowed | ✓ Allowed | ✓ Allowed |

Q1=A narrows the decision to α / δ / ε. Q1=B adds γ. Q1=C adds β but doesn't invalidate α.

**My advocacy:** pitch Q1=A forcefully at Gate 3. The positioning wedge is non-trivial and the conversion cost of the doctrine-clean bundle is recoverable via M1 marketing theme (which directly markets the doctrine as a product feature).

---

## Summary of recommendations (my voice)

1. **Q1=A is the doctrine-consistent answer.** Argue forcefully at Gate 3.
2. **Author 10 commerce red lines inline in charter §Acceptance Criteria** (mirror EAL pattern where charter expanded from placeholder to enumerated red lines).
3. **Author `anti-patterns.md`** at Gate 4 with 12 initial refusals (list above) — not exhaustive; extend as surfaces design.
4. **CI-lint forbidden copy strings.** Mirror EAL's `calibrationCopy.js` pattern. Key files that need the lint: pricing page, paywall modal, upgrade prompts, cancellation journey, renewal email templates (if any).
5. **Q8=B with transparency panel.** No events fire before user has seen the panel.
6. **No push notifications for monetization, period.** Transactional email only. Gate 4 spec documents this as binding.
7. **Cancellation journey gets dedicated doc** with copy-discipline ladder.
8. **Ignition commerce state isolated** from main-app commerce state at the reducer level.

**Overall verdict from my voice:** YELLOW, conditional on Q1 verdict. If Q1=A lands, project is on solid autonomy footing. If Q1=B/C, this voice escalates to RED at Gate 2 re-run — doctrine-diluted commerce UX is worse than no doctrine at all (the credibility fracture on cancellation is the specific failure mode).
