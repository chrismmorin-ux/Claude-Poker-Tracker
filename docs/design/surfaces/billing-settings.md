# Surface — Billing Settings

**ID:** `billing-settings`
**Parent surface:** Section within `SettingsView`. NOT a standalone routed view; renders as a card in the existing SettingsView grid alongside AccountSection / DisplaySettings / GameDefaults / VenuesManager / GameTypesManager / DataAndAbout / ErrorLogPanel / TelemetrySection.
**Product line:** Main app. Extension never embeds billing-settings UI; users manage billing through main-app only.
**Tier placement:** Free+ (universal — section visible to all users; content adapts to current tier state). Free-tier users see "Free tier" plan card + "View plans" upgrade affordance; paid users see full 6-action panel.
**Last reviewed:** 2026-04-25 (Gate 4 Batch 5)

**Code paths (future — Phase 5):**
- `src/components/views/SettingsView/BillingSettings.jsx` (new — section card; replaces or extends current "DataAndAbout" billing-adjacent content)
- `src/components/views/SettingsView/BillingSettings/PlanCard.jsx` (new — current-tier card with status)
- `src/components/views/SettingsView/BillingSettings/PaymentMethodCard.jsx` (new — last-4 + expiry display + Update action)
- `src/components/views/SettingsView/BillingSettings/NextBillCard.jsx` (new — date + amount + plan name)
- `src/components/views/SettingsView/BillingSettings/BillingActionRow.jsx` (new — shared row component for Update / Change / Cancel / Export actions)
- `src/components/views/SettingsView/BillingSettings/PendingPlanChangeIndicator.jsx` (existing per plan-change journey J4 — referenced)
- `src/components/views/SettingsView/BillingSettings/CardDeclineGraceIndicator.jsx` (new — visible during grace period only)
- `src/hooks/useBillingSettings.js` (new — composite hook: tier + paymentMethod + nextBill + cardDeclineState)
- `src/utils/entitlement/billingCopy.js` (new — CI-linted deterministic copy generator for status strings + grace-period messages)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #2 (transparency) + #3 (durable override) + #4 (reversibility) + #7 (editor's-note tone) + #10 (no dark-pattern cancellation)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-04 (re-engagement push) + §MPMF-AP-05 (cancellation retention traps) + §MPMF-AP-06 (downgrade framing) + §MPMF-AP-08 (dark-pattern checkout) + §MPMF-AP-11 (silent auto-renewal) + §MPMF-AP-15 (silent plan-change) + §MPMF-AP-16 (deceptive proration)
- `docs/projects/monetization-and-pmf/WRITERS.md` §W-SUB-2 (payment-success) + §W-SUB-3 (cancellation) + §W-SUB-4 (plan-change)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Card decline grace-period section
- `docs/design/jtbd/domains/subscription-account.md` §SA-66 (transparent billing + easy pause) + §SA-74 (cancel without friction)
- `docs/design/jtbd/domains/billing-management.md` §SA-76 (switch tiers) + §SA-77 (manage payment method) + §SA-78 (know when billed)
- `docs/design/journeys/cancellation.md` (J3 entry point — Cancel button lives here)
- `docs/design/journeys/plan-change.md` (J4 entry point — Change plan button lives here)
- `docs/design/surfaces/pricing-page.md` (View plans link from BillingSettings)
- `docs/design/heuristics/poker-live-table.md` §H-SC02 (trial-state-legible-outside-settings — billing-settings is the canonical destination for tap-to-deep-dive)

---

## Purpose

The single source of truth UI for ongoing subscription state — what tier you're on, when you'll be billed, how to update payment, how to change or cancel. Per red line #2 (transparency on demand) + SA-66/74/76/77/78: every billing-relevant fact must be visible here without further navigation. No hidden fees. No "click here for details" obscured timing. No retention dark patterns at the entry-point.

This is the **canonical billing state surface**. trial-state-indicator (S4) chips link here. paywall-modal (S2) "View plans" routes via pricing-page (S1) which links here. cancellation journey (J3) entry button lives here. plan-change journey (J4) entry button lives here. data-export action lives here.

Per Q1=A doctrine: every action surface here implements its corresponding journey's contract. No new dark patterns at the entry-point. No "Are you sure you want to cancel?" before the user has tapped Cancel.

Non-goals (explicit):
- **Not a routed top-level view.** Renders inside SettingsView; shares its grid layout + scroll + scaling.
- **Not a payment-collection surface.** Payment update routes to Stripe Customer Portal (or equivalent); this surface only displays current state + entry-point buttons.
- **Not a tier-comparison surface.** "View plans" routes to pricing-page (S1) for comparison.
- **Not a cancellation-execution surface.** Cancel button opens CancellationConfirmModal (J3); modal handles execution.
- **Not a plan-change-execution surface.** Change-plan button opens PlanSelectModal → PlanChangeConfirmModal (J4).

---

## JTBD served

**Primary:**
- **`JTBD-SA-66`** — Transparent billing + easy pause (canonical surface)
- **`JTBD-SA-74`** — Cancel without friction (entry point — Cancel button)
- **`JTBD-SA-76`** — Switch between plan tiers (entry point — Change plan button)
- **`JTBD-SA-77`** — Manage payment method without churning (Payment method card + Update action)
- **`JTBD-SA-78`** — Know when I'll be billed and for how much (Next bill card)

**Secondary:**
- **`JTBD-SA-72`** — Understand what's free, what's paid, and why (Plan card displays current tier explicitly)
- **`JTBD-CC-79`** — Navigation that returns to prior position (cancellation/plan-change modals dismiss back to BillingSettings)

**Not served:**
- **`JTBD-SA-65`** — Tier comparison (pricing-page handles)
- **`JTBD-SA-71`** — Try before paying (Free-tier visitors see this section but with a different layout — see §State below)
- **`JTBD-CC-88`** — Telemetry transparency (separate `TelemetrySection` in SettingsView)

---

## Personas served

**Primary:**
- **Any paying user** — main audience.
- **`post-session-chris`** + **`presession-preparer`** — most common contexts for self-service billing review.

**Secondary:**
- **Free-tier user** — sees a simplified version of BillingSettings with "Free tier" plan card + "View plans" link to pricing-page; no other actions visible (nothing to manage on free tier).
- **Founding-member lifetime user** — sees Plan card with "Lifetime — paid once" + special handling: no Next-bill card (no recurring billing); no Change-plan button (lifetime cannot be downgraded to subscription per Gate 4 decision); Cancel button still present (Variation B in cancellation journey).

**Excluded:**
- **`mid-hand-chris`** — billing-settings never auto-fires during live play. User can navigate manually via Settings nav, but H-SC01 binding ensures cancellation/plan-change confirmation modals can't render mid-hand even if user taps the button.

---

## Anatomy

### Paid-user variant (Plus / Pro / Founding-Lifetime)

```
┌── Billing & Plan ─────────────────────────────────────────────────────┐
│                                                                          │
│  ┌── Current plan ─────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Pro                                          [ Change plan ]      │  │
│  │  $29 / month, billed monthly                                       │  │
│  │  Member since January 12, 2026                                     │  │
│  │                                                                    │  │
│  │  [+] Pending: Change to Plus on Feb 14, 2026                       │  │
│  │      [ Cancel pending change ]                                     │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌── Payment method ───────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Visa ending 4242                            [ Update method ]     │  │
│  │  Expires 12/27                                                     │  │
│  │                                                                    │  │
│  │  [⚠️] Card declined on Jan 28, 2026                                 │  │
│  │      Update by Feb 4, 2026 to avoid losing access.                 │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌── Next charge ──────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  $29.00 on February 14, 2026                                       │  │
│  │  Pro tier · billed monthly                                         │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌── Actions ──────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [ View plans ]                                                    │  │
│  │  [ Export data ]                                                   │  │
│  │  [ Cancel subscription ]                                           │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Last billing event: January 14, 2026 — $29.00 charged successfully     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Free-tier variant

```
┌── Billing & Plan ─────────────────────────────────────────────────────┐
│                                                                          │
│  ┌── Current plan ─────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Free tier                                                         │  │
│  │  Unlimited current-session features. Cross-session features       │  │
│  │  unlock with Plus or Pro.                                          │  │
│  │                                                                    │  │
│  │  [ View plans ]                                                    │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌── Actions ──────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [ Export data ]                                                   │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Free tier has NO Payment method card (no method on file), NO Next charge card (no charge scheduled), NO Cancel action. View plans + Export data are the only buttons.

### Cancelled-user variant (within billing-period grace)

User has cancelled but hasn't reached `accessThrough` date yet — full Pro access still active.

```
┌── Billing & Plan ─────────────────────────────────────────────────────┐
│                                                                          │
│  ┌── Current plan ─────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Pro · Cancelling                                                  │  │
│  │  Access through February 14, 2026                                  │  │
│  │  After that date, you'll move to the Free tier. Your data stays.  │  │
│  │                                                                    │  │
│  │  [ Reactivate Pro ]                                                │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Payment method + Next charge cards hidden (no upcoming charge).        │
│                                                                          │
│  ┌── Actions ──────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [ Export data ]                                                   │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

"Reactivate Pro" reverses cancellation by writing `canceledAt = null`, `accessThrough = null` and re-enabling Stripe subscription auto-renew. ≤2-tap reverse (Reactivate button → Confirm reactivation in 1 modal — symmetric reversibility per red line #4).

NO upsell banner. NO "We hate to see you go" copy. NO "Special 50% off if you stay!" offers. Just factual state + reversal affordance.

### Founding-member lifetime variant

```
┌── Billing & Plan ─────────────────────────────────────────────────────┐
│                                                                          │
│  ┌── Current plan ─────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Founding-Lifetime · Pro features                                  │  │
│  │  Paid once on January 12, 2026 — $299                              │  │
│  │  Lifetime access. Includes all current and future Pro features.    │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌── Payment method ───────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Visa ending 4242 (no longer charged — lifetime plan)              │  │
│  │  Card on file is kept only for record-keeping.                     │  │
│  │  [ Remove card from records ]                                      │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Next charge card hidden (no recurring billing).                        │
│                                                                          │
│  ┌── Actions ──────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  [ Export data ]                                                   │  │
│  │  [ Cancel lifetime access ]                                        │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

NO Change-plan button (lifetime cannot be downgraded to subscription per Gate 4 decision). NO View-plans button (already at top tier). Cancel routes to cancellation Variation B (immediate access-end, non-refundable disclosure surfaced in modal).

### PlanCard component contract

- **Tier name** (heading) — `Free tier` / `Plus` / `Pro` / `Founding-Lifetime · Pro features`. Adds suffix `· Cancelling` for cancelled state.
- **Price line** — factual: `$29 / month, billed monthly` / `$179 / year, billed yearly` / `$299 paid once on [date] — Lifetime` / `Free`.
- **Member-since line** — paid users only: `Member since January 12, 2026`. Free users: omitted.
- **PendingPlanChangeIndicator** (paid-with-pending-downgrade only) — inline expandable row: `Pending: Change to Plus on Feb 14, 2026` + `[ Cancel pending change ]` action.
- **CardDeclineGraceIndicator** — appears in PaymentMethodCard, NOT PlanCard. Shows if `cardDeclineGraceActive: true` with date + grace deadline + factual call-to-action.
- **Action button** — paid users: `[ Change plan ]` (routes to PlanSelectModal J4). Free users: `[ View plans ]` (routes to pricing-page S1). Cancelled-grace users: `[ Reactivate {tier} ]` (cancellation reversal).
- **Cancelled-state copy** — "Access through {accessThrough date}. After that date, you'll move to the Free tier. Your data stays." Factual; never "We hate to see you go."

### PaymentMethodCard component contract

- **Card name + last-4** — `Visa ending 4242`. Brand-specific (Mastercard, Amex, etc.). Mask all but last-4.
- **Expiry** — `Expires 12/27`. Factual; warning state if expiring within 60 days (`Expires 03/26 — update soon`).
- **Update action** — `[ Update method ]` routes to Stripe Customer Portal (or equivalent payment-update flow). NOT inline payment form (Stripe handles full PCI compliance).
- **CardDeclineGraceIndicator** — visible only during grace period. Shows decline date + grace deadline + factual update call-to-action: `Card declined on Jan 28, 2026. Update by Feb 4, 2026 to avoid losing access.` ⚠️ icon for visual signal but no animation / no urgency timer / no countdown.
- **Founding-member lifetime card on file** — Special copy: "Card on file is kept only for record-keeping." + Remove-card affordance (lifetime users can opt out of having card stored since not needed for billing).
- **Free-tier and cancelled-grace state** — PaymentMethodCard hidden entirely (no card, or card no longer relevant).

### NextBillCard component contract

- **Amount** — `$29.00` (factual, two-decimal). Includes any taxes if applicable: `$29.00 + $2.50 sales tax = $31.50`.
- **Date** — `on February 14, 2026` (full month name + day + year for clarity).
- **Plan + cadence** — `Pro tier · billed monthly`.
- **Hidden states:** Free tier (no charge); cancelled-grace (no upcoming charge); founding-lifetime (no recurring billing).
- **No "in 7 days" relative timer.** Absolute date only — refuses MPMF-AP-01 timer-urgency anti-pattern.

### Actions section component contract

Action buttons rendered as full-width rows (`BillingActionRow` shared component). Order is fixed per tier-context:

**Paid user (active):**
1. View plans (link, lower visual weight than the buttons below)
2. Export data
3. Cancel subscription (last; equal visual weight to other buttons — red line #6 + #10)

**Free user:**
1. Export data (only action)

**Cancelled-grace user:**
1. Export data (only — Cancel and View-plans hidden during cancelling-grace)

**Founding-lifetime user:**
1. Export data
2. Cancel lifetime access

**Equal visual weight rule.** All action buttons within Actions section have identical width, height, font-weight, border treatment. Cancel is NOT visually de-emphasized (intentionally — refuses dark pattern of making cancel hard to find). NOT visually emphasized either (refuses scare-pattern of red-coding cancel button to make user hesitate).

### Last billing event line (footer)

Bottom of section: `Last billing event: January 14, 2026 — $29.00 charged successfully`. One line. Factual receipt-summary. Tap → opens billing history (Phase 2+ feature; for Phase 1 just shows last 1 event).

Free-tier and cancelled-grace + first-billing-pending users: footer hidden.

---

## State

### Hook — `useBillingSettings()`

Composite hook reading from EntitlementContext + IDB:

```js
const {
  tier,                       // 'free' | 'plus' | 'pro' | 'founding-lifetime'
  cohort,                     // 'standard' | 'founding-50'
  memberSinceDate,            // ISO8601 | null (null for free)
  paymentMethod,              // { brand, last4, expiryMonth, expiryYear } | null
  nextBillDate,               // ISO8601 | null
  nextBillAmount,             // number (cents) | null
  cancellation: {
    isCancelled,              // boolean
    canceledAt,               // ISO8601 | null
    accessThrough,            // ISO8601 | null
    isInGracePeriod,          // boolean (canceled + accessThrough is in future)
  },
  pendingPlanChange: {
    isActive,                 // boolean
    targetTier,               // string | null
    effectiveDate,            // ISO8601 | null
  },
  cardDecline: {
    isActive,                 // boolean (card declined + still in grace)
    declinedAt,               // ISO8601 | null
    graceUntil,               // ISO8601 | null
  },
  lastBillingEvent: {         // null if no events yet (founding lifetime first-payment, free-tier always)
    date,                     // ISO8601
    amount,                   // cents
    status,                   // 'success' | 'declined' | 'refunded'
  },
} = useBillingSettings();
```

### Reducer actions consumed

- `SUBSCRIPTION_HYDRATED` — initial load from IDB.
- `PAYMENT_SUCCESS_RECEIVED` — webhook from Stripe; updates `paymentMethod`, `nextBillDate`, `nextBillAmount`.
- `CANCELLATION_SUCCESS` — fires `canceledAt` + `accessThrough` (per W-SUB-3 from cancellation journey).
- `PENDING_PLAN_CHANGE_SET` — fires `pendingPlanChange.isActive = true` (per W-SUB-4 from plan-change journey downgrade variant).
- `CARD_DECLINE_DETECTED` — fires `cardDecline.isActive = true` + `graceUntil = declinedAt + 7d`.
- `CARD_DECLINE_RESOLVED` — fires `cardDecline.isActive = false` (after successful re-charge).

### Surface mutations (entry points to journeys)

This surface is the entry point for cancellation + plan-change + payment-method-update. Mutations don't fire from this surface directly; they fire from the journey modals it routes to.

- `[Cancel subscription]` button → opens CancellationConfirmModal (J3 Variation A or B).
- `[Change plan]` button → opens PlanSelectModal (J4).
- `[Cancel pending change]` button → directly fires `PENDING_PLAN_CHANGE_CLEARED` reducer action + Stripe API to un-schedule. NO confirmation modal (reversal is itself a reverse action; symmetric to red line #4).
- `[Update method]` button → routes to Stripe Customer Portal (external surface).
- `[Reactivate {tier}]` button (cancelled-grace) → opens minimal ReactivationConfirmModal (1-modal symmetric reverse of cancellation).
- `[View plans]` button → routes to PricingView (S1).
- `[Export data]` button → triggers data-export flow (separate from this surface; existing functionality).
- `[Remove card from records]` button (founding-lifetime) → confirms removal + deletes paymentMethod from IDB + removes from Stripe customer record.

### Telemetry events (consent-gated)

- `billing_settings_viewed` — properties: tier, hasCardDeclineGrace, hasPendingPlanChange, isCancellationGrace
- `billing_action_tapped` — properties: action ('cancel' | 'change-plan' | 'update-method' | 'view-plans' | 'export-data' | 'reactivate' | 'cancel-pending')
- `card_decline_grace_indicator_shown` — properties: daysUntilGraceEnd

---

## Props / context contract

### `BillingSettings` props

None — section component reads from contexts.

### `PlanCard` props

- `tier: string`
- `cohort: 'standard' | 'founding-50'`
- `memberSinceDate?: string`
- `priceMonthly?: number` (cents)
- `priceAnnual?: number`
- `priceOnce?: number`
- `cancellation: object`
- `pendingPlanChange: object`
- `onChangePlanClick: () => void`
- `onViewPlansClick: () => void`
- `onReactivateClick: () => void`
- `onCancelPendingClick: () => void`

### `PaymentMethodCard` props

- `paymentMethod: { brand, last4, expiryMonth, expiryYear } | null`
- `cardDecline: object`
- `tier: string` (for founding-lifetime variant copy)
- `onUpdateClick: () => void`
- `onRemoveCardClick?: () => void` (founding-lifetime only)

### `NextBillCard` props

- `nextBillDate: string`
- `nextBillAmount: number` (cents)
- `tier: string`
- `billingCadence: 'monthly' | 'yearly'`

### `BillingActionRow` props

- `label: string`
- `onClick: () => void`
- `variant?: 'primary' | 'destructive'` — destructive used for Cancel; same visual weight, different semantic for screen readers (`aria-label="Cancel subscription, destructive action"`)

---

## Key interactions

1. **Mount.** Read entitlement state + billing context; render variant matching current tier state (paid-active / paid-pending / paid-cancelling / free / founding-lifetime).
2. **Tap [Change plan].** Opens PlanSelectModal (J4). Modal handles all subsequent flow.
3. **Tap [Cancel subscription].** Opens CancellationConfirmModal Variation A (or B for founding-lifetime). Modal handles confirmation + W-SUB-3 write.
4. **Tap [Cancel pending change].** Directly fires reducer action + Stripe un-schedule API. No confirmation modal. Updates UI: PendingPlanChangeIndicator disappears + new state reflects.
5. **Tap [Update method].** Routes to Stripe Customer Portal (external; user returns to BillingSettings after portal interaction).
6. **Tap [Reactivate Pro] (cancelled-grace).** Opens ReactivationConfirmModal — single-step factual confirmation: "Reactivate Pro? You'll resume billing at $29/mo on March 14, 2026 (your previous renewal date). Confirm." Confirm fires reverse-cancellation action.
7. **Tap [View plans].** Routes to PricingView (S1).
8. **Tap [Export data].** Triggers data-export download (existing functionality).
9. **Tap [Remove card from records] (founding-lifetime).** Inline confirm: "Remove your saved card? Your lifetime access continues unchanged." Confirm fires remove action.
10. **CardDeclineGraceIndicator surface.** Renders inline within PaymentMethodCard when `cardDecline.isActive === true`. Tap on indicator opens [Update method] flow same as button.
11. **Pending plan-change reactivity.** If user upgrades while cancelled (cancellation reversal + immediate upgrade), pending state updates correctly without flicker.
12. **Founding-lifetime cancel.** Opens CancellationConfirmModal Variation B with non-refundable disclosure visible inline. User confirms → immediate access-end (no grace period for lifetime).

### Keyboard / accessibility

- Section has `role="region"` `aria-label="Billing and plan"`.
- Each card (PlanCard / PaymentMethodCard / NextBillCard) has `role="region"` with descriptive aria-label.
- All action buttons are `<button>` elements with `aria-label` matching button text + `aria-describedby` for grace-period indicators where applicable.
- ⚠️ icon on CardDeclineGraceIndicator has `aria-hidden="true"` (decorative); accompanying text is the accessible content.
- "Cancel subscription" button has `aria-label="Cancel subscription, destructive action"` for screen-reader semantic clarity.
- Tab order: Plan card → Plan card actions → Payment method card → Payment method actions → Next charge card → Actions section (top-down).

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-04** Re-engagement push notifications. No proactive nudges from BillingSettings to "update your card" / "review your plan" — only inline indicators when state warrants.
- **MPMF-AP-05** Cancellation retention traps. Cancel button opens CancellationConfirmModal directly with no interposition. NO "Are you sure you want to cancel?" pre-confirmation modal.
- **MPMF-AP-06** "Downgrade" framing. Plan card uses tier-name only ("Pro") without "current premium tier" status framing. Change-plan button is neutral; downgrade copy lives in the journey modal (J4) and refuses status-ladder language.
- **MPMF-AP-07** "Missing out" loss-framing. Free-tier variant says "Cross-session features unlock with Plus or Pro" — factual; NOT "You're missing cross-session features!"
- **MPMF-AP-08** Dark-pattern checkout. Update-method routes to Stripe Customer Portal (external trusted surface); no inline payment form that could hide fees.
- **MPMF-AP-11** Silent auto-renewal. Next charge card displays date + amount + plan + cadence before any auto-renewal occurs. Refuses silent surprise.
- **MPMF-AP-15** Silent plan-change. Cancel pending change action has no confirmation modal but is itself a REVERSAL action (un-schedule) — no risk of confusion with cancellation.
- **MPMF-AP-16** Deceptive proration. NextBillCard shows actual amount with sales tax disclosure where applicable. No hidden fees.
- **Cancel-button-hard-to-find anti-pattern.** Refused: Cancel is in Actions section at equal visual weight, NOT hidden behind 3+ taps. SA-74 ≤2-tap rule satisfied (Settings → Billing → Cancel = 2 taps from anywhere; modal confirm = 3rd tap to commit).

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines:

- **#1 Opt-in enrollment for data collection** — telemetry events respect consent gate per CC-88.
- **#2 Full transparency on demand** — **LOAD-BEARING here.** Plan + payment method + next charge + last billing event ALL visible without further navigation. Test: DOM contains current tier name + price + cadence + next bill date + amount.
- **#3 Durable overrides on billing state** — cancellation honored without dark-pattern reversal prompts. Test: render cancelled-grace state; assert NO upsell banners NO retention nudges NO "are you sure?" patterns.
- **#4 Reversibility** — Reactivate Pro affordance available during cancellation grace (single-modal symmetric reverse). Cancel pending plan-change is single-action reversal. Test: simulate cancel + grace + reactivate flow restores tier.
- **#5 No streaks / shame / engagement-pressure** — no "you've been a Pro member for X months — keep it up!" framing. No streak counters. No "save 50% if you stay!" retention offers. Test: CI-grep refused strings in billingCopy.js.
- **#6 Flat-access** — actions section buttons at equal visual weight (View plans / Export / Cancel all same size + style). Test: CSS measurement confirms equality.
- **#7 Editor's-note tone** — billingCopy.js CI-linted forbidden-string check. Test: `scripts/check-commerce-copy.sh` on BillingSettings strings.
- **#8 No cross-surface contamination** — billing-settings never renders on TableView / never auto-fires during live play. H-SC01 binding: cancellation modal can't render mid-hand even if Cancel tapped (deferred to hand-end).
- **#9 Incognito observation mode** — telemetry events respect per-category consent.
- **#10 No dark-pattern cancellation** — **LOAD-BEARING here.** Cancel button entry point is at equal visual weight, ≤2-tap from anywhere, opens modal directly without interposition. Test target MPMF-G5-RL #10 specific assertion suite — tap count ≤2 from Settings nav, equal-weight button visual parity, no exit-survey-before-confirm in modal.

---

## Cross-surface dependencies

- **`SettingsView`** — hosts BillingSettings as section card in existing grid layout. No structural changes to SettingsView; just adds one more card.
- **`pricing-page` (S1)** — destination of [View plans] link.
- **`paywall-modal` (S2)** — its [View plans] CTA may chain through pricing-page back here for paying users.
- **`upgrade-prompt-inline` (S3)** — settings-billing host context renders expanded variant of upgrade prompt at top of free-tier BillingSettings.
- **`cancellation` journey (J3)** — entry point lives here; CancellationConfirmModal opens from Cancel button.
- **`plan-change` journey (J4)** — entry point lives here; PlanSelectModal opens from Change-plan button.
- **`evaluator-onboarding` journey (J1)** — Variation E (returning-evaluator) may suggest BillingSettings via "View plans" path for evaluators considering upgrade.
- **`trial-state-indicator` (S4)** — chip in nav tap-routes to BillingSettings (this is the "≤2 taps from anywhere" canonical destination per H-SC02).
- **Stripe Customer Portal (external)** — destination of [Update method] action.
- **EntitlementContext** — primary state source.
- **Toast container** — minor success toasts on Cancel-pending / Reactivate / Remove-card actions.

---

## Known behavior notes

- **Cancellation grace period UX during the access window.** From `canceledAt` to `accessThrough`, user has full Pro features but `tier === 'pro'` AND `cancellation.isCancelled === true`. UI shows "Pro · Cancelling" status. Reactivate Pro button replaces Change-plan button. After `accessThrough` passes, scheduled action degrades tier to `free`, BillingSettings flips to free-tier variant.
- **Pending plan-change reactivity.** Pending downgrade can be cancelled via inline button without modal — direct reverse action. If user re-cancels via main Cancel button while a downgrade is pending, the cancellation supersedes (cancel takes effect at access-through; pending-downgrade becomes moot).
- **Card decline grace period.** 7-day grace from decline to tier-degrade. CardDeclineGraceIndicator visible throughout. Past 7 days, tier auto-drops to free + indicator changes to "Card declined — moved to Free tier on [date]. Reactivate by updating your card." Grace period configurable via constant.
- **Founding-lifetime card-on-file edge case.** Lifetime users had to provide a card at purchase but no recurring charges happen. After purchase, card is kept for record-keeping only. Remove-card action allows users to clear it (e.g., expired card no longer relevant).
- **Free-tier user upgrade attempt.** Free user taps [View plans] → routes to pricing-page. Returning from pricing-page (without converting) returns user to SettingsView (not BillingSettings card scrolled into view; user-initiated re-scroll). Returning after Stripe Checkout converts → return URL routes to BillingSettings with new tier hydrated.
- **Last billing event line.** Phase 1 shows only the most recent event (factual single line). Phase 2+ may add billing history table; out of Phase 1 scope.
- **Pending plan-change copy.** "Pending: Change to Plus on Feb 14, 2026" — avoids "downgrade" word per MPMF-AP-06.
- **Stripe Customer Portal redirect handling.** When user updates payment method via Stripe Portal, Stripe webhook fires `customer.updated` event; W-SUB-2 receives webhook + updates IDB; UI re-hydrates on next render.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [BS-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `BillingSettings.test.jsx` — renders correct variant per tier state (paid-active / cancelled-grace / free / founding-lifetime); each variant shows correct cards.
- `PlanCard.test.jsx` — variations per tier; pending plan-change indicator; cancelled-grace copy.
- `PaymentMethodCard.test.jsx` — masked card display; expiry warning; card-decline grace indicator.
- `NextBillCard.test.jsx` — date formatting; amount + tax display.
- `BillingActionRow.test.jsx` — equal visual weight (CSS regression test); destructive variant aria-label.
- `useBillingSettings.test.js` — composite hook returns correct state per IDB content.
- `billingCopy.test.js` — generator outputs; CI-grep refused strings (no "downgrade" / no "are you sure" / no urgency).

### Integration tests (Phase 5)

- `BillingSettings.e2e.test.jsx` — paid user navigation: Settings → Billing → Cancel → CancellationConfirmModal (verify ≤2-tap rule).
- `BillingSettingsCancellationGrace.e2e.test.jsx` — cancel + verify cancelled-grace variant + Reactivate flow restores.
- `BillingSettingsPendingPlanChange.e2e.test.jsx` — schedule downgrade + verify pending indicator + cancel pending + verify state restore.
- `BillingSettingsCardDecline.e2e.test.jsx` — simulate card decline + verify grace indicator + update card + verify grace clears.
- `BillingSettingsFreeTier.e2e.test.jsx` — free user variant has only [View plans] + [Export data] actions.
- Red-line #2 transparency assertion suite (MPMF-G5-RL) — DOM contains all required state fields without further navigation.
- Red-line #10 dark-pattern assertion suite (MPMF-G5-RL) — Cancel button equal weight + ≤2-tap from Settings nav + no interposition before confirm modal.

### Visual verification

- Playwright MCP 1600×720 screenshot, 6 scenarios:
  1. Paid-active variant (Pro tier, no pending changes, normal state).
  2. Paid-active with pending plan-change (downgrade Pro → Plus scheduled).
  3. Paid-active with card-decline grace indicator.
  4. Cancelled-grace variant (Pro · Cancelling with Reactivate button).
  5. Free-tier variant (minimal: View plans + Export data only).
  6. Founding-lifetime variant (Lifetime · Pro features + special copy).

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S5-PAID-ACTIVE`
- `EVID-PHASE5-MPMF-S5-PENDING-CHANGE`
- `EVID-PHASE5-MPMF-S5-CARD-DECLINE`
- `EVID-PHASE5-MPMF-S5-CANCELLED-GRACE`
- `EVID-PHASE5-MPMF-S5-FREE-TIER`
- `EVID-PHASE5-MPMF-S5-FOUNDING-LIFETIME`

---

## Phase 5 code-path plan

**New files (~9):**
1. `src/components/views/SettingsView/BillingSettings.jsx`
2. `src/components/views/SettingsView/BillingSettings/PlanCard.jsx`
3. `src/components/views/SettingsView/BillingSettings/PaymentMethodCard.jsx`
4. `src/components/views/SettingsView/BillingSettings/NextBillCard.jsx`
5. `src/components/views/SettingsView/BillingSettings/BillingActionRow.jsx`
6. `src/components/views/SettingsView/BillingSettings/CardDeclineGraceIndicator.jsx`
7. `src/components/ui/ReactivationConfirmModal.jsx` (cancellation reversal modal)
8. `src/hooks/useBillingSettings.js`
9. `src/utils/entitlement/billingCopy.js`

**Amended files (~3):**
- `src/components/views/SettingsView/SettingsView.jsx` — add BillingSettings card to existing grid.
- `src/reducers/entitlementReducer.js` — `PENDING_PLAN_CHANGE_CLEARED` + `CARD_DECLINE_RESOLVED` + `CANCELLATION_REVERSED` action types.
- `src/utils/telemetry/eventSchema.js` — billing-settings events.

---

## Change log

- 2026-04-25 — v1.0 authored as Gate 4 Batch 5 artifact (MPMF-G4-S5). SettingsView extension; 4-card layout (PlanCard / PaymentMethodCard / NextBillCard / Actions) with 4 tier-state variants (paid-active / cancelled-grace / free / founding-lifetime). LOAD-BEARING for red lines #2 (transparency on demand) + #10 (no dark-pattern cancellation). 10 red-line compliance with per-line test target + Phase 5 code-path plan ~9 new files. Cross-surface entry point for cancellation J3 + plan-change J4 journeys. Equal-weight action buttons (Cancel NOT visually de-emphasized OR emphasized — refuses both anti-patterns). Stripe Customer Portal external for payment-method updates (no inline payment form). Founding-lifetime variant special handling (no Change-plan; Cancel routes to Variation B with non-refundable disclosure). Zero code changes (surface-spec only).
