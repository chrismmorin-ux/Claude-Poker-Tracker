# Assumption Ledger — Monetization & PMF

**Project:** Monetization & PMF
**Authored:** 2026-04-24 Session 4 Batch 1 (Gate 4)
**Purpose:** Enumerate the load-bearing falsifiable assumptions that monetization design rests on. Each has a specific kill-criterion + instrumented event target. After 30-60 days of Stream D telemetry, each assumption is kill-or-keep verdicted.

**Source seeds:**
- M1–M8 from Session 1 roundtable (8-voice panel)
- M9–M12 from Session 2 Gate 2 Market voice
- M13–M15 NEW at Gate 4 authoring (this session)

Total: **15 falsifiable assumptions** — within the 12–15 target range from Gate 2 audit follow-up.

---

## How to read this ledger

Each assumption has:
- **Claim:** what we're asserting to be true.
- **Why it matters:** which downstream design decision hinges on this.
- **Kill-criterion:** the specific metric + threshold that would falsify it.
- **Instrumented event:** the PostHog event (or aggregation) that measures the kill-criterion.
- **Soak window:** how long we need to observe before verdicting.
- **Owner lens:** which roundtable voice advocated this assumption.

**Verdict states:**
- `ACTIVE` — in force; decisions downstream depend on this.
- `UNDER_TEST` — soak window started; telemetry accumulating.
- `KILLED` — kill-criterion met; downstream decisions revisited.
- `CONFIRMED` — kill-criterion checked AND not met within soak window; assumption upgraded.

All 15 assumptions start at `ACTIVE` pending Stream D Phase 1 install.

---

## The 15 assumptions

### M1 — Chris and Scholar are distinct personas justifying tier differentiation

**Claim:** Chris-shape live players and Scholar-shape drill-only users are behaviorally distinct; a single tier ladder that serves both segments is achievable but not optimal — they may warrant different commercial narratives long-term.

**Why it matters:** Q6 verdict (C=defer Scholar fork) rests on this being testable. If telemetry shows users cluster distinctly, Scholar fork re-opens. If users mix both behaviors, Scholar is not a separate market.

**Kill-criterion:** After 60 days post-launch, if <20% of active users cluster purely in Chris-shape or Scholar-shape behavioral signature (defined via PostHog cohort: active-session events + drill-started events distribution), the persona distinction is insufficient — collapse to unified tier.

**Instrumented event:** `session_started` (Chris signature) + `drill_started` (Scholar signature) + dwell-time correlation per user. Clustering via PostHog cohort filter.

**Soak window:** 60 days from first non-founding-member signup.

**Owner lens:** UX-RES voice (Session 1). Q6 verdict hinges.

**Verdict state:** ACTIVE.

---

### M2 — Live post-hand replay is a core job, not a nice-to-have

**Claim:** Users who just played a live hand want to review it within minutes of completion; the "replay the hand you just played" feature is a core JTBD, not a peripheral one.

**Why it matters:** If true, bundle α free-tier gates on cross-session history; post-hand replay within current session is free (teaser for cross-session in paid). If false, the session-scoped free tier's value proposition weakens.

**Kill-criterion:** If <30% of active-session users open the replay surface within 5 minutes of hand completion, demote replay from core to peripheral.

**Instrumented event:** `replay_opened` with `latency_from_hand_end_ms` property. Histogram across users.

**Soak window:** 30 days.

**Owner lens:** P-STRAT voice (Session 1). Informs free-tier value messaging.

**Verdict state:** ACTIVE.

---

### M3 — Session-scoped free tier drives conversion to paid

**Claim:** A free tier that provides unlimited value *within* a session but loses persistence at session-close creates felt-loss sufficient to drive 5%+ conversion within 30 days of a user hitting their 10th session.

**Why it matters:** Q5=A verdict is load-bearing. If the session-scoped gate doesn't drive conversion, the free tier is too generous and needs tightening OR the gate moves to a different dimension (usage quota per Q5=B).

**Kill-criterion:** If <5% of free-tier users convert to paid within 30 days of their 10th session, the gate is insufficient — re-open Q5.

**Instrumented event:** `session_count_per_user` + `upgrade_action_taken` event. Cohort analysis on users with ≥ 10 sessions.

**Soak window:** 30 days post first-cohort-of-10-session users.

**Owner lens:** PRICE voice (Session 1). Q5 verdict hinges.

**Verdict state:** ACTIVE.

---

### M4 — Users will pay $25–35/mo for Pro tier

**Claim:** The Pro-tier price point is at or below WTP ceiling for the Chris-shape core buyer; signup-to-paid conversion at $29/mo landing-page price hits ≥2%.

**Why it matters:** If Pro is overpriced, the tier ladder becomes {Free, Plus} + founding-lifetime only — structurally different pricing story. If underpriced, revenue is left on the table.

**Kill-criterion:** If landing-page signup-to-paid conversion is <2% at $29/mo at 30-day soak, re-anchor price (lower OR narrower tier definition).

**Instrumented event:** PostHog funnel — `landing_page_visit` → `signup_action` → `payment_success`. Paid-tier conversion rate per 30-day rolling window.

**Soak window:** 30 days post founding-member cap + public-tier launch.

**Owner lens:** PRICE voice. Market anchor from $15-50/mo category band.

**Verdict state:** ACTIVE.

---

### M5 — Ignition sidebar is a separate buyer, not a different mode of the same user

**Claim:** Users who pay for Ignition SKU are structurally different from users who pay for main-app Pro; overlap is <60%.

**Why it matters:** Q3=C defers this, but eventual Q3 re-verdict depends on measuring the overlap. If Ignition users are mostly main-app Pro users, Ignition is an upsell tier; if they're distinct, Ignition is a separate SKU.

**Kill-criterion:** When Q3 re-opens (Phase 2+), if >60% of Ignition trials also have >10 main-app live sessions in the prior 30 days, collapse Ignition into a top tier of the main ladder (not separate SKU).

**Instrumented event:** Cross-domain user-ID linkage; `extension_installed` vs `session_started` activity overlap per user.

**Soak window:** 60 days after Q3 re-opens.

**Owner lens:** P-STRAT voice. Q3 re-verdict hinges.

**Verdict state:** ACTIVE (deferred — not testable until Phase 2+).

---

### M6 — Doctrine (red lines #5/#7/#10) is a positioning wedge, not a cost

**Claim:** Explicit "no streaks, no guilt, two-tap cancel" copy on landing pages + in-app doesn't hurt acquisition; it differentiates against GTO Wizard/Upswing/Run It Once.

**Why it matters:** Q1=A is load-bearing. If doctrine framing doesn't move conversion, it's neutral (no cost). If it actively hurts acquisition, doctrine has a measurable price the owner needs to know.

**Kill-criterion:** A/B test: landing-page variant A with doctrine framing explicit vs variant B without. If A's signup-to-paid conversion is statistically ≥20% lower than B after 500+ visitors each cohort, doctrine has a real price (owner re-weighs).

**Instrumented event:** PostHog feature flag + funnel per cohort.

**Soak window:** 30 days after each cohort reaches 500 visitors.

**Owner lens:** BEHAV voice (Session 1) + Autonomy voice (Session 2).

**Verdict state:** ACTIVE.

---

### M7 — Drills and live play are the same user's two modes, not two different users

**Claim:** Most paying users engage both live-play and drill features within 30 days of paying; the single-persona multi-mode pattern dominates.

**Why it matters:** Reverse-direction of M1. If true, unified tier ladder serves both; Scholar fork is over-engineering. If false, Scholar fork is warranted.

**Kill-criterion:** If <25% of paying users use both live-session features AND drill features within 30 days, the two modes are distinct user segments — Scholar persona is a separate product worth separate commercial treatment.

**Instrumented event:** Per-user feature-adoption matrix. `session_started` + `drill_started` co-occurrence within 30-day window.

**Soak window:** 30 days.

**Owner lens:** UX-RES voice. Inverse of M1 signal.

**Verdict state:** ACTIVE.

---

### M8 — Founding-member lifetime seeds >20 paid users within 30 days of outreach

**Claim:** Reddit / Twitter / poker-content-community outreach to offer $299 founding-lifetime yields ≥20 signups within 30 days of kickoff.

**Why it matters:** Q4=A + Q2=B verdicts require this working. If <20 signups in 30 days, outreach channel is wrong OR pricing is wrong OR founding-member framing doesn't resonate.

**Kill-criterion:** <20 founding-member sales within 30 days of Stream E Phase 2 outreach launch → re-evaluate channel, price, OR positioning.

**Instrumented event:** `founding_member_signup` with referrer property (tracks acquisition channel).

**Soak window:** 30 days post-outreach-kickoff.

**Owner lens:** GROWTH voice (Session 1). Informs Q2 sequencing validation.

**Verdict state:** ACTIVE (not yet triggered — Stream E Phase 2 not launched).

---

### M9 — Category WTP for live-tracker is capped at ~$35/mo

**Claim:** Live-poker tracker category (Pokeri, Poker Copilot, PT4 annualized, HM3) has WTP ceiling around $35/mo for single-tool buyers; above that, buyers migrate to training sites or cross-category bundles.

**Why it matters:** Sets Pro-tier upper bound. If category ceiling is actually higher, we're under-pricing. If lower, we're over-pricing.

**Kill-criterion:** If Pro-tier conversion is <2% at $29/mo AND >5% at $19/mo (via A/B test), category ceiling is closer to $19-25; re-anchor.

**Instrumented event:** PostHog price-A/B experiment.

**Soak window:** 30 days at each price point.

**Owner lens:** Market voice (Gate 2 audit).

**Verdict state:** ACTIVE.

---

### M10 — Scholar-shape evaluator won't pay for another tool when GTO Wizard exists

**Claim:** Users whose primary use case is study/drills already pay for GTO Wizard or Upswing; adding a drill-only subscription requires 3-10× differentiation to displace.

**Why it matters:** If true, Scholar is cannibalized and Scholar fork is pointless. If false, Scholar is an addressable market.

**Kill-criterion:** If >20% of our paying users also subscribe to GTO Wizard (via survey during first 30 days paid), our Scholar position is complementary, not displacing — Scholar fork viable as complementary tool. If <5%, we're either displacing or non-Scholar.

**Instrumented event:** Voluntary post-signup survey question ("Do you use other poker tools? Which?").

**Soak window:** 60 days post first-paid cohort.

**Owner lens:** Market voice. Q6 re-verdict hinges.

**Verdict state:** ACTIVE.

---

### M11 — Ignition-shape evaluator is willing to pay $69–99/mo for sidebar

**Claim:** Online grinders on Ignition specifically are willing to pay $69-99/mo IF the sidebar demonstrably exceeds Hand2Note on capture quality + live-HUD-for-live-poker nuance.

**Why it matters:** Q3 re-verdict (Phase 2+) requires price validation; if Ignition audience unwilling at that band, bundle ε pricing is wrong.

**Kill-criterion:** When Ignition SKU launches (Phase 2+), if conversion of extension-installed users to paid at $79/mo is <2% within 30 days, pricing is too high OR differentiation unclear.

**Instrumented event:** `ignition_payment_success` / `ignition_extension_installed` ratio.

**Soak window:** 30 days after Ignition SKU launch (Phase 2+).

**Owner lens:** Market voice. Informs bundle ε viability.

**Verdict state:** ACTIVE (deferred until Phase 2+).

---

### M12 — Poker-content-community channels are the primary acquisition lane; paid ads are not

**Claim:** Acquisition happens via Reddit r/poker, r/pokerstrategy, Twitter poker community, YouTube / Twitch poker-content creators. Paid ads (Facebook, Google, poker-site display) are not cost-effective given category size + content-gated audience.

**Why it matters:** Informs Stream E Phase 2 outreach strategy. If true, invest in content partnerships + community presence. If false, paid-ads test is warranted.

**Kill-criterion:** Paid-ads test (Facebook + Google) runs for 30 days; if CAC is <$20, paid-ads viable at some scale. If CAC is >$100 OR signups ≤ 5, paid-ads confirmed unviable for Phase 1.

**Instrumented event:** Per-channel attribution via UTM parameters + PostHog referrer tracking.

**Soak window:** 30 days of paid-ads test (optional — run only if organic acquisition stalls).

**Owner lens:** Market voice. Informs GROWTH strategy.

**Verdict state:** ACTIVE.

---

### M13 — Evaluator first-60-second wow moment is the make-or-break threshold — NEW

**Claim:** Trial-first-session persona's bounce rate is strongly correlated with whether the user sees ONE useful thing within 60 seconds of first launch.

**Why it matters:** Bundle α + δ + evaluator-onboarding journey all assume first-60-second wow is achievable. If bounce is uncorrelated with time-to-first-value, the design effort on sample-data + on-boarding optimization is misallocated.

**Kill-criterion:** Correlation analysis between first-session duration and session-to-second-session return rate. If users who spent >60s AND <60s have statistically indistinguishable 7-day return rates, first-60-second wow is NOT the make-or-break — re-think onboarding priorities.

**Instrumented event:** `first_session_duration_ms` + `session_2_within_7d` cohort flag.

**Soak window:** 30 days, 200+ first-session users.

**Owner lens:** BEHAV voice (Session 1) + UX-RES voice. Informs MPMF-G4-J1 evaluator-onboarding journey design priorities.

**Verdict state:** ACTIVE.

---

### M14 — Returning-evaluator second-visit conversion probability exceeds first-session — NEW

**Claim:** A user who returns 2+ days after first install converts to paid at higher rate than a user on first visit; the returning-evaluator state is a pre-conversion funnel stage, not a drift loss.

**Why it matters:** Returning-evaluator persona + SA-71 (try-before-paying) JTBD assume this. If returning-evaluators convert at LOWER rates than first-session, the "come back and try again" framing is wrong — we should push harder on first-visit.

**Kill-criterion:** 30-day conversion rate of users whose first-to-second session gap is >2 days, compared to users who converted in first session. If <50% as likely, returning-evaluator is drift-loss, not funnel stage.

**Instrumented event:** Per-user first-session timing + first-conversion timing + session-count.

**Soak window:** 60 days for sufficient cohort size.

**Owner lens:** UX-RES voice + BEHAV voice. Informs MPMF-G4-J1 returning-evaluator path design.

**Verdict state:** ACTIVE.

---

### M15 — Anonymous-first mode is feasible (IDB + Stripe Checkout) — NEW

**Claim:** The technical architecture supports anonymous-first evaluation (no account required before free-tier value) + account-creation only at paywall/purchase moment. No fundamental blocker in IDB or Stripe Checkout flow.

**Why it matters:** Red line #1 + ON-88 + SA-71 all require anonymous-first. If the technical stack forces account creation earlier, the design loses a load-bearing autonomy property.

**Kill-criterion:** Engineering review at Gate 5 confirms or denies. If Stripe Checkout requires pre-checkout account creation in a way that violates red line #1, either (a) switch payment processor, (b) redesign flow, or (c) accept the compromise and update SA-71 surface spec.

**Instrumented event:** Not applicable — engineering review, not telemetry.

**Soak window:** Before Gate 5 implementation kickoff.

**Owner lens:** TELEM voice (Session 1) + Market voice. Informs payment-processor selection at MPMF-G5-PP.

**Verdict state:** ACTIVE — engineering verdict pending.

---

## Composite dashboard

Stream D Phase 2 dashboard surfaces all 15 assumptions in one view:

- **Active count:** 15
- **Under test:** 0 (pending Stream D Phase 1 install)
- **Killed:** 0
- **Confirmed:** 0

Weekly review cadence. Monthly kill-or-keep decision per assumption. Killed assumptions trigger relevant project re-opens (e.g., M3 killed → Q5 re-open; M8 killed → Q2/Q4 re-open).

---

## Kill-criterion instrumentation targets

Every assumption has a specific PostHog event or aggregation that measures the kill-criterion. At Stream D Phase 1 install (MPMF-G5-PH), these events are authored in `src/constants/telemetryEvents.js`:

```js
export const TELEMETRY_EVENTS = {
  // Assumption M1 / M7 — persona clustering
  SESSION_STARTED: 'session_started',
  DRILL_STARTED: 'drill_started',

  // Assumption M2 — post-hand replay engagement
  REPLAY_OPENED: 'replay_opened',

  // Assumption M3 — session-scoped free tier conversion
  UPGRADE_ACTION_TAKEN: 'upgrade_action_taken',

  // Assumption M4 / M9 — pricing conversion
  LANDING_PAGE_VISIT: 'landing_page_visit',
  SIGNUP_ACTION: 'signup_action',
  PAYMENT_SUCCESS: 'payment_success',

  // Assumption M8 — founding-member conversion
  FOUNDING_MEMBER_SIGNUP: 'founding_member_signup',

  // Assumption M13 / M14 — evaluator first-session + returning dynamics
  FIRST_SESSION_START: 'first_session_start',
  FIRST_SESSION_END: 'first_session_end',
  RETURN_AFTER_DRIFT: 'return_after_drift',

  // Assumption M6 — doctrine-A/B landing page
  LANDING_VARIANT_A_DOCTRINE: 'landing_variant_a_doctrine',
  LANDING_VARIANT_B_STANDARD: 'landing_variant_b_standard',
};
```

Full schema authored at MPMF-G5-PH.

---

## Relationship to other assumption patterns

This ledger follows the pattern established by other projects:
- Printable Refresher (PRF) keeps assumptions implicit in roundtable voices — less formalized ledger.
- Exploit Anchor Library (EAL) tracks anchor-level calibration assumptions (retirement condition met) via Tier 2/3 math, not a separate ledger.
- Monetization & PMF's ledger is the most formal — 15 explicit assumptions with kill-criteria — because commerce decisions have the highest reversibility cost (wrong pricing = lost revenue + brand damage).

Future projects installing similar commerce infrastructure can reuse this pattern (kill-criterion + instrumented event + soak window + owner lens).

---

## Change log

- 2026-04-24 — Session 4 Batch 1. Created. 15 assumptions (M1–M8 Session 1 roundtable + M9–M12 Gate 2 Market voice + M13–M15 Gate 4 authoring). Each with kill-criterion + instrumented event + soak window + owner lens. Verdict states start ACTIVE pending Stream D Phase 1 install. Weekly/monthly review cadence at Stream D Phase 4 per charter.
