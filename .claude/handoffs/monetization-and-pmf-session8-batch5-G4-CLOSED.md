# Handoff — Monetization & PMF · Session 8 Batch 5 (Gate 4 CLOSED)

**Session:** 2026-04-25, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** **Gate 4 CLOSED** — 16 of 16 carry-forwards complete across 5 batches; Gate 5 implementation unblocked
**Status:** DRAFT — awaiting owner ratification of Gate 4 closure

---

## Files I Own (This Session)

- `docs/design/surfaces/billing-settings.md` — CREATED (MPMF-G4-S5; LOAD-BEARING red lines #2 + #10)
- `docs/design/surfaces/trial-state-indicator.md` — CREATED (MPMF-G4-S4; LOAD-BEARING H-PLT01 + H-SC02 + H-SC01)
- `docs/design/surfaces/CATALOG.md` — AMENDED (2 new entries; Gate 4 final state)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Stream A `G4 [x]` + Session Log + 6 final Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (2 MPMF-G4-S* rows COMPLETE; Stream A status update)
- `.claude/STATUS.md` — AMENDED (top entry signaling Gate 4 CLOSED; prior PRF S8 demoted)
- `.claude/handoffs/monetization-and-pmf-session8-batch5-G4-CLOSED.md` — this file

**No file conflicts.** PRF S8 ran in parallel earlier today; separate file trees.

---

## Gate 4 final summary — 16 of 16 carry-forwards across 5 batches

| Batch | Items | Description |
|---|---|---|
| **B1** doctrine + foundation (2026-04-24) | ACP / W / HT / AL / EA / ES | 6 items: charter Acceptance Criteria expansion + WRITERS.md + heuristics H-SC01/02 + assumption-ledger 15 falsifiable + entitlement-architecture + Bundle ε structural |
| **B2** foundation-remainder (2026-04-24) | S6 / J1 + AP-13/14 | 2 items + 2 anti-patterns: telemetry-consent-panel + evaluator-onboarding journey + telemetry-consent-nag + onboarding-lock-in refusals |
| **B3** journeys (2026-04-24) | J2 / J3 / J4 + AP-15/16 | 3 items + 2 anti-patterns: paywall-hit + cancellation (LOAD-BEARING red line #10) + plan-change (DISTINCT from cancellation) + silent-plan-change-on-cancellation + deceptive-proration-display refusals |
| **B4** paywall surfaces (2026-04-25) | S1 / S2 / S3 | 3 items: pricing-page (most complex) + paywall-modal (referenced by J2; H-SC01 mechanism) + upgrade-prompt-inline (proactive embed across 5 host contexts) |
| **B5** billing surfaces + closeout (2026-04-25) | S5 / S4 + Stream A G4 [x] | 2 items + closeout: billing-settings (LOAD-BEARING red lines #2 + #10) + trial-state-indicator (LOAD-BEARING H-SC02) + Gate 4 closure |

**Total artifacts shipped (Gate 4):**
- 6 surfaces in `docs/design/surfaces/` (telemetry-consent-panel + pricing-page + paywall-modal + upgrade-prompt-inline + billing-settings + trial-state-indicator)
- 4 journeys in `docs/design/journeys/` (evaluator-onboarding + paywall-hit + cancellation + plan-change)
- 2 H-SC heuristics added to `docs/design/heuristics/poker-live-table.md`
- 5 doctrine docs in `docs/projects/monetization-and-pmf/` (anti-patterns 16 refusals + WRITERS 5 writers + assumption-ledger 15 assumptions + entitlement-architecture + gate3-owner-interview)
- 1 CATALOG.md update with 6 new entries

**Anti-patterns final state:** 16 refusals across 5 categories — retention-traps / downgrade-framing / engagement-pressure / dark-pattern-checkout / silent-state-changes.

**Cross-surface architectural invariants ratified:**
1. Telemetry-consent panel fires BEFORE main-app routing — structural guarantee for red line #1
2. PaywallModal (reactive blocker) vs UpgradePromptInline (proactive embed) DISTINCT patterns — different copy generators / telemetry / suppression rules
3. Cancellation / paywall-hit / plan-change DISTINCT journeys with DISTINCT modals + writers + CI-linted copy generators
4. Billing-settings hosts cancellation J3 + plan-change J4 entry points with equal-weight Cancel button (refuses BOTH visual-emphasis AND de-emphasis)
5. Trial-state-indicator persistent across all views with adaptive opacity (60% mid-hand) + tier-aware tap routing

---

## What this session produced

### MPMF-G4-S5 — billing-settings.md

**SettingsView extension. LOAD-BEARING for red lines #2 (transparency) + #10 (no dark-pattern cancellation).**

4-card layout: PlanCard / PaymentMethodCard / NextBillCard / Actions section.

**4 tier-state variants:**
- **Paid-active** — full panel with all 4 cards + 3 actions (View plans / Export / Cancel)
- **Cancelled-grace** — Plan card shows "Pro · Cancelling" with Reactivate replacing Change-plan; Payment + Next-charge hidden; only Export action
- **Free** — minimal: Plan card with View-plans link; Export-data only action
- **Founding-lifetime** — special: Plan card "Lifetime — Pro features"; Payment card "kept for records only" with Remove option; Cancel routes to J3 Variation B with non-refundable disclosure

**Critical structural rules:**
- Cancel button at equal visual weight (NOT visually emphasized OR de-emphasized — refuses BOTH dark-pattern designs)
- ≤2-tap from Settings nav to Cancel modal (SA-74 binding)
- Reactivate Pro symmetric ≤2-tap reverse action
- PendingPlanChangeIndicator with single-tap reversal (no confirmation modal — reversal is itself reverse)
- CardDeclineGraceIndicator subtle ⚠️ (no animation / no countdown / no urgency)
- Stripe Customer Portal external for payment-method updates (no inline payment form per MPMF-AP-08)

### MPMF-G4-S4 — trial-state-indicator.md

**Persistent chip in main-nav. LOAD-BEARING for H-PLT01 + H-SC02 + H-SC01.**

7 variant states:
- Free / Plus / Pro / Lifetime (basic tier display)
- "{tier} · Cancelling" (cancellation grace status modifier)
- "{tier} ⚠️" (card-decline grace icon)
- Multi-state (cancellation + card-decline simultaneously rare; both modifiers visible)

**Tap routing tier-aware:**
- Free → pricing-page (S1) — natural next step is to see plans
- Paid (active or pending) → BillingSettings (S5) with `#billing` hash anchor
- Card-decline grace → BillingSettings (S5) with `#billing#payment-method` direct-scroll to PaymentMethodCard

**Mid-hand H-SC01 behavior:**
- 60% opacity (does not vanish — preserves transparency)
- Tappable but deferred routing (queue intent + neutral toast "Tier info opens at hand-end")
- Routing fires automatically post-hand
- ⚠️ icon NEVER animates / pulses / changes color during live hand

**Refused:**
- Animations (pulsing / blinking / color-shift)
- Badge counters / red dots / "needs attention" indicators (the ⚠️ for card-decline is a single static emoji, not animated badge)
- Red color treatment on cancellation status
- Streak framing ("X days as Pro!" forbidden)
- First-launch coachmark / tooltip (chip just appears, glanceable by design)

### CATALOG.md final state

```
Inline widgets:
- live-exploit-citation, bucket-ev-panel-v2, presession-drill, hand-replay-observation-capture (existing)
- evaluator-onboarding (B2)
- cancellation, paywall-hit, plan-change (B3 journeys)
- printable-refresher-card-templates (PRF parallel work)
- paywall-modal, upgrade-prompt-inline (B4)
- billing-settings, trial-state-indicator (B5) ← this session

Top-level views:
- ...existing 12 views...
- anchor-library, calibration-dashboard, session-review-anchor-rollup (EAL)
- printable-refresher (PRF)
- telemetry-consent-panel (B2)
- pricing-page (B4) ← Gate 4 added
```

---

## What's NOW unblocked (for next plan — Gate 5 implementation)

### Phase 5 code work — full scope

**Reducers + state:**
- `entitlementReducer.js` — tier + cancellation + pending-plan-change + card-decline state machine
- IDB v19 migration with `subscription` store (additive, ~5 writers per WRITERS.md)
- `EntitlementContext` provider mounting near AppRoot

**Hooks (8):**
- `useEntitlement` — feature access via featureMap
- `useTelemetryConsent` — Q8=B opt-out flow
- `useEvaluatorOnboarding` — variation router
- `usePaywallCooldown` — H-N07 7-day per (surface × trigger)
- `useDeferredPaywall` — H-SC01 mid-hand defer mechanism
- `useUpgradePromptVisibility` — 6-rule suppression
- `useTrialStateIndicator` — composite chip state
- `useBillingSettings` — composite billing context

**UI Components (7+):**
- `PaywallGate` (orchestrator: feature + cooldown + H-SC01 check)
- `PaywallModal` + `PaywallFallbackInline` (Variations A/B/D/C)
- `UpgradePromptInline` (5 host contexts)
- `TrialStateIndicator` (chip)
- `CancellationConfirmModal` (J3 — 3 variations)
- `PlanSelectModal` + `PlanChangeConfirmModal` (J4 — upgrade/downgrade)
- `ReactivationConfirmModal` (cancellation reversal)
- `FirstLaunchTelemetryPanel` + `TelemetrySection` (Q8=B)
- `EvaluatorOnboardingPicker` + 5 variation flows

**View Components (5+):**
- `PricingView/` (TierCard×4 + FeatureComparisonTable + FoundingMemberSection + PricingFAQ)
- `SettingsView/BillingSettings/` (PlanCard + PaymentMethodCard + NextBillCard + BillingActionRow + CardDeclineGraceIndicator)
- `SettingsView/TelemetrySection.jsx` (mirror panel)

**CI-linted copy generators (6):**
- `cancellationCopy.js` (~20 forbidden-string patterns; mirrors EAL retirementCopy.js)
- `paywallCopy.js` (per-variation outputs)
- `planChangeCopy.js` ("Change to X" never "Downgrade")
- `pricingCopy.js` (tier descriptions + FAQ + founding-member section)
- `upgradePromptCopy.js` (sub-shape-tailored variants)
- `billingCopy.js` (status strings + grace-period messages)
- `indicatorCopy.js` (minimal chip text)

**CI Script:**
- `scripts/check-commerce-copy.sh` — consolidated CI-lint forbidden-string check across all 6 generators

**Stripe integration:**
- Test-mode Customer + Subscription configuration
- Webhook handler (`webhookHandler.js`) for `checkout.session.completed` / `invoice.payment_succeeded` / `customer.subscription.deleted` / `customer.subscription.updated` / `invoice.payment_failed`
- Stripe Customer Portal redirect for payment-method updates

**PostHog integration (Stream D Phase 1):**
- `posthog-js` install
- `consentGate.js` wrapping all event capture
- `postHogAdapter.js`
- Event schema v1 covering all surface telemetry events (telemetry-consent / onboarding / paywall / upgrade-prompt / cancellation / plan-change / pricing / billing / indicator)
- 3-layer instrumentation per charter Stream D (screen-time + action-level + feature-touch)

**Test assertions (Gate 5 MPMF-G5-RL + MPMF-G5-CL + MPMF-G5-SC):**
- All 10 commerce red lines have per-line in-app test assertions
- CI-linted forbidden-copy-strings check
- H-SC01 paywall-never-fires-mid-hand specific test
- H-N07 cooldown durability test
- Equal-weight button CSS measurement test (red line #6)
- Atomicity tests for W-SUB-3 cancellation (I-WR-3)
- Founding-cap race-condition test (I-WR-4)

### Stream D Phase 1 (PostHog install) — independently unblocked
Already documented; can proceed in parallel with Gate 5 main-app code.

### Stream E Phase 1 (founding-member outreach) — unblocked
Pricing-page surface ships. Outreach can begin pointing at it via Reddit / Twitter / poker-content-community channels per Session 1 GROWTH voice + assumption M8 + M12.

---

## Risk log (final state for Gate 4 phase)

| # | Risk | Status |
|---|---|---|
| R1-R28 | Prior risks | Carry forward to Gate 5 plan |
| **R29 NEW** | **Gate 5 implementation scope is large (~30+ new files + amendments)** | ACTIVE — recommend batching Gate 5 in 4-5 batches mirroring B1-B5 doctrine pattern: G5-B1 entitlement-foundation (reducer + context + IDB) → G5-B2 telemetry-foundation (PostHog + consent gate) → G5-B3 commerce-components (PaywallGate + Modal + UpgradePromptInline + TrialStateIndicator) → G5-B4 commerce-views (PricingView + BillingSettings + cancellation/plan-change journeys) → G5-B5 evaluator-onboarding + Stream E launch readiness. |
| **R30 NEW** | **Cross-batch test regression risk during Gate 5** | ACTIVE — mitigated by additive-only architecture (existing 7000+ tests should not regress); each Gate 5 batch runs full test suite before merging. |
| **R31 NEW** | **Stripe integration complexity may surface assumption M15 (anonymous-first feasibility) violations** | ACTIVE — engineering-review-of-Stripe-Checkout-anonymous-first scheduled at Gate 5 G5-B1 kickoff. If infeasible, pricing-page + evaluator-onboarding may need redesign OR switch to Paddle/LemonSqueezy. |
| **R32 NEW** | **Founding-Lifetime cap-50 enforcement requires server-side webhook handler at G5-B1** | ACTIVE — I-WR-4 invariant requires server-side check-before-write. Phase 1 architecture could use Stripe metadata + serverless Lambda OR simple cached value in Stripe customer dashboard manually checked. Decision at G5-B1 implementation. |

---

## Ratification checklist (for owner)

Before next plan (Gate 5 implementation) begins, owner should:

- [ ] **Owner ratification of Gate 4 closure** — review this handoff + Stream A `G4 [x]` flip + 16 carry-forwards complete
- [ ] Confirm tentative pricing numbers locked-in for Gate 5 ($17 Plus / $29 Pro / $299 Founding-Lifetime) OR override
- [ ] Confirm Stripe as Phase 1 payment processor OR override (Paddle / LemonSqueezy alternatives ready if Q7 legal scoping requires for Phase 2+ Ignition)
- [ ] Schedule Q7 legal-scoping session if Phase 2+ Ignition lane is anticipated within 6 months
- [ ] Apply for PostHog-for-Startups credit ($50K) before Stream D Phase 1 install
- [ ] Begin Stream E Phase 2 outreach planning (Reddit r/poker, Twitter poker community, YouTube/Twitch creator relationships per assumption M12)

---

## Next plan recommendation

Per project charter §"What comes after this plan":

**Plan: Gate 5 Implementation** — multi-batch (B1-B5) mirroring Gate 4 doctrine-first pattern.

**Batch sequencing:**
1. **G5-B1 Entitlement Foundation** — entitlementReducer + EntitlementContext + IDB v19 migration + Stripe webhook handler infrastructure + I-WR-3 atomicity + I-WR-4 cap enforcement
2. **G5-B2 Telemetry Foundation** — PostHog install + consentGate + 3-layer event schema + first-launch panel + Settings mirror panel
3. **G5-B3 Commerce Primitives** — PaywallGate + PaywallModal + PaywallFallbackInline + UpgradePromptInline + TrialStateIndicator + supporting hooks (useDeferredPaywall / usePaywallCooldown / useUpgradePromptVisibility / useTrialStateIndicator)
4. **G5-B4 Commerce Views** — PricingView (with FoundingMemberSection cap-fetch) + BillingSettings 4-tier-state-variants + CancellationConfirmModal (J3 — 3 variations) + PlanSelectModal+PlanChangeConfirmModal (J4) + ReactivationConfirmModal + 6 CI-linted copy generators + scripts/check-commerce-copy.sh
5. **G5-B5 Evaluator Onboarding + Stream E Readiness** — EvaluatorOnboardingPicker + 5 variation flows + sample-data mode + Stream E founding-member outreach kickoff readiness

Full plan to be drafted at next plan-mode session.

---

## Change log

- 2026-04-25 — Session 8 Batch 5. Gate 4 final 2 surfaces (billing-settings + trial-state-indicator) + Gate 4 closeout. **All 16 of 16 Gate 4 carry-forwards COMPLETE.** Stream A `G4 [x]`. CATALOG.md final state with 6 surface entries + 4 journey entries from MPMF. Anti-patterns final state 16 refusals. 6 final Decisions Log entries. Gate 5 fully unblocked. Stream D Phase 1 + Stream E Phase 1 unblocked. Zero code. Zero test regressions.
