# Journey — Plan Change (Upgrade + Downgrade)

**ID:** `plan-change`
**Product line:** Main app. Extension inherits new tier state read-only via WebSocket bridge after plan change completes.
**Primary persona:** Any paying user considering tier migration.
**Tier placement:** Plus+ (only applies when user has paid state to change).
**Last reviewed:** 2026-04-24 (Gate 4 Batch 3)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red line #2 (transparency) + #3 (durable override) + #4 (reversibility) + #7 (editor's-note tone)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-06 ("downgrade" framing) + §MPMF-AP-08 (dark-pattern checkout)
- `docs/projects/monetization-and-pmf/WRITERS.md` §W-SUB-4 (plan-change-writer)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Data flow scenario "plan change"
- `docs/design/jtbd/domains/billing-management.md` §SA-76 (switch-between-plan-tiers — primary JTBD)
- `docs/design/surfaces/billing-settings.md` (Gate 4 Batch 5 — plan-change entry point)
- `docs/design/surfaces/pricing-page.md` (Gate 4 Batch 4 — tier reference)
- `docs/design/journeys/cancellation.md` (J3 — DISTINCT journey; plan-change is NOT cancellation)

---

## Purpose

Allow paying users to move between paid tiers (upgrade or downgrade) without friction, without losing data, and without "downgrade" status-framing language. Per SA-76 JTBD + red line #4 (reversibility) + MPMF-AP-06 refusal: tier-change is a factual transaction, not a status judgment.

Key design principles:
- **Upgrade is immediate with prorated charge.** User sees the prorated amount upfront, confirms, and new tier activates right away.
- **Downgrade is effective at next billing period.** User keeps current tier's access until their paid-through date, then drops to new tier. Rationale: they already paid for the current billing period; honor it.
- **Data is preserved across tier changes.** Downgrading to a lower tier makes some features inaccessible, but the underlying data (villain profiles, session history, hand notes) remains intact. Upgrading restores access to those features without re-importing data.
- **Plan-change is NOT cancellation.** Separate journey (J3). Conflating them invites dark patterns.

Non-goals (explicit):
- **Not a cancellation flow.** Users wanting to drop to free-tier go through J3 cancellation. Plan-change is between-paid-tiers only.
- **Not a founding-member-switch flow.** Founding-member lifetime cannot downgrade to a subscription (no "save money by switching to Plus" anti-pattern). Founding members who want to leave the app entirely go through J3 cancellation (Variation B).
- **Not a pricing-comparison surface.** For tier comparison, user navigates to pricing-page.md (MPMF-G4-S1). Plan-change modal shows ONLY the target tier's price + effective-date; full tier comparison is a separate click.
- **Not a retention surface.** No "save 50% on Plus instead of cancelling!" offer. Plan-change is for users who WANT to change; no persuasion.

---

## JTBD served

**Primary:**
- **`JTBD-SA-76`** — Switch between plan tiers (load-bearing; proration transparency + data preservation + distinct-from-cancellation)

**Secondary:**
- **`JTBD-SA-66`** — Transparent billing + easy pause (plan-change is adjacent; upgrade shows prorated amount factually; downgrade shows effective-date factually)

**NOT served:**
- **`JTBD-SA-74`** — Cancel (separate journey J3)
- **`JTBD-SA-77`** — Payment method management (card update is distinct; triggered separately — does NOT fire plan-change flow)
- **`JTBD-SA-65`** — Tier comparison before purchase (pricing-page handles comparison; plan-change assumes user has already decided target tier)

---

## Personas served

**Primary:**
- **Any paying user** — Chris (upgrading Plus → Pro or downgrading Pro → Plus), Scholar (Plus → Plus-rarely-changes), founding-member (rarely changes; grandfathered).
- **`post-session-chris`** — most common plan-change context (quarterly bankroll review / feature-need reassessment).

**Secondary:**
- **`presession-preparer`** — edge case; plan-change flow should NOT surface here via upgrade-prompt (that's J2 paywall-hit territory). Plan-change is user-initiated only.

**Explicitly excluded:**
- **Free-tier users** — cannot use plan-change (no current paid tier to change from). Free → paid is pricing-page → Stripe checkout, not plan-change flow.
- **Founding-member lifetime users** attempting to switch to subscription — NOT supported (would require cancel + resubscribe). Rationale: avoids "save money by switching" anti-pattern + lifetime is non-refundable by design.
- **`mid-hand-chris`** — plan-change flow never fires mid-hand (H-SC01 analog). Plan-change is multi-step and off-table only.

---

## The plan-change flow — 3 variations

All 3 share the `PlanChangeConfirmModal` (distinct from CancellationConfirmModal and PaywallModal). Variations differ by direction (upgrade / downgrade) + current tier context.

### Variation A — Upgrade (Plus → Pro, or Free → Plus/Pro via direct-from-free path)

**Trigger:** User navigates to `SettingsView → Billing → Change plan` → selects target higher tier.

**Flow:**

```
BillingSettings "Change plan" action
 → PlanSelectModal (factual list of tiers: Free / Plus / Pro / Founding-Lifetime)
    Current tier highlighted with "Current" chip; other tiers tappable
 → User taps "Pro" (higher tier)
 → PlanChangeConfirmModal opens:
    "Change to Pro"
    "Effective: Now"
    "You'll be charged: $[prorated amount] today"
    "Your next full charge: $[new tier price] on [next billing date]"
    "What changes immediately:
     · Game tree deep analysis unlocks
     · Exploit Anchor Library unlocks
     · Advanced drills unlock
     · All Plus features remain"
    [ Confirm upgrade ]  [ Keep Plus ]
 → User taps "Confirm upgrade"
 → W-SUB-4 plan-change-writer fires Stripe subscription-update API + IDB update atomically
 → Success toast: "Upgraded to Pro. All features available now."
 → Modal dismisses; user returns to BillingSettings with updated state
```

**Copy register:** C5 factual. "Change to Pro" (not "Upgrade to Pro" exclamation; factual verb). Prorated amount shown upfront (no surprise at next charge). "What changes immediately" section is factual capability list.

**Tap count:** 3 taps from BillingSettings (Change plan → Select tier → Confirm upgrade).

---

### Variation B — Downgrade (Pro → Plus)

**Trigger:** User navigates to `SettingsView → Billing → Change plan` → selects target lower tier.

**Flow:**

```
BillingSettings "Change plan" action
 → PlanSelectModal (factual list of tiers)
 → User taps "Plus" (lower tier from Pro)
 → PlanChangeConfirmModal opens:
    "Change to Plus"
    "Effective: [current billing period end date]"
    "You'll keep Pro access until then. No additional charge today."
    "Your next charge: $[Plus price] on [next billing date]"
    "What changes on [effective date]:
     · Game tree deep analysis ends
     · Exploit Anchor Library read-only (data preserved; you can resubscribe anytime)
     · Advanced drills end
     · All Plus features continue"
    "Your data stays preserved. Upgrading to Pro later restores full access without re-import."
    [ Confirm change ]  [ Keep Pro ]
 → User taps "Confirm change"
 → W-SUB-4 plan-change-writer fires Stripe subscription-update API (scheduled effective at period end) + IDB update atomically
 → Success toast: "Plan changed. Plus takes effect on [date]."
 → Modal dismisses; user returns to BillingSettings
```

**Copy register:** C5 factual. **"Change to Plus" NOT "Downgrade to Plus"** (MPMF-AP-06 refused). "What changes on [effective date]" section factually lists feature access differences. **"Your data stays preserved"** line is critical — preempts loss-aversion panic.

**Tap count:** 3 taps (same as upgrade; flow symmetric).

**Effective-date policy:** downgrade takes effect at CURRENT billing period end. User paid for the current period at the higher tier; they get it. No refund proration for unused days at higher tier (would add complexity + could be gamed; industry norm is honor-what's-paid-for).

---

### Variation C — Lateral change (same-price tier switch — Phase 2+ scenario)

**Trigger:** User wants to switch between tiers at the same price level (e.g., if Plus had two flavors: "Plus-live-focused" vs "Plus-study-focused" at same price point — hypothetical Phase 2+ feature).

**Status:** DEFERRED to Phase 2+. Phase 1 has no same-price lateral options. Placeholder noted here for framework completeness.

**Phase 2+ design note:** lateral change would be immediate-effective (no proration complexity), data-preservation invariant intact. PlanChangeConfirmModal would show "Change to [new tier name]. Effective: Now. No charge change." Sharing same pattern as Variations A/B but without proration display.

---

## The PlanChangeConfirmModal — shared across Variations A/B

Single modal component. Variation-specific copy passed as props (direction: `upgrade` | `downgrade` | `lateral`; target tier; effective date; proration amount).

### Modal contract

- **Title:** "Change to [target tier name]" (factual verb "Change"; never "Upgrade" exclamation or "Downgrade" status-language).
- **Effective-date line:** "Effective: Now" (Variation A) / "Effective: [date]" (Variation B).
- **Charge line (Variation A only):** "You'll be charged: $[prorated amount] today" + "Your next full charge: $[new tier price] on [date]".
- **Charge line (Variation B):** "No additional charge today" + "Your next charge: $[Plus price] on [date]".
- **"What changes immediately / on [date]" section** — factual bullet list of feature access deltas. Factual, not aspirational ("Game tree unlocks" ✓ / "Level up your game!" ✗).
- **Data-preservation assurance** (Variation B specifically): "Your data stays preserved. Upgrading to [higher tier] later restores full access without re-import." Preempts loss-aversion.
- **2 buttons, equal visual weight:**
  - `[ Confirm change ]` (or "Confirm upgrade" on Variation A) — primary action.
  - `[ Keep [current tier] ]` — dismiss; no state change.
- **No pre-selection.** No visual boost. No "Recommended" badge.
- **No "Are you sure?" re-confirmation.** Same 2-tap principle as cancellation (except plan-change is 3 taps total from BillingSettings because of the PlanSelectModal intermediate step; acceptable because the intermediate step is the tier choice, not a confirmation trap).

### Why 3 taps for plan-change vs 2 for cancellation

Cancellation is binary: the user knows they want to cancel; 2 taps is the floor. Plan-change involves choosing a target tier from multiple options; the intermediate "choose tier" step is substantive, not friction. SA-76 doesn't mandate 2-tap; it mandates "without friction" — 3 taps with one being a meaningful choice is compliant.

---

## Proration rules

### Upgrade proration (Variation A)

- User currently on Plus at $19/mo; halfway through billing period.
- User upgrades to Pro at $29/mo.
- Stripe calculates prorated charge: ($29 - $19) × remaining-days / total-days-in-period = prorated upgrade cost.
- User sees exact amount in modal BEFORE confirming.
- On confirm: Stripe charges prorated amount + switches subscription to Pro immediately. Next full charge is $29 at next billing date.

### Downgrade proration (Variation B)

- User currently on Pro at $29/mo; halfway through billing period.
- User downgrades to Plus at $19/mo.
- NO refund for remaining Pro days (per industry norm). User keeps Pro access until billing-period end.
- At billing-period end: Stripe subscription auto-switches to Plus; charges $19 at that point.
- User sees NO charge in modal; sees effective-date + next-charge info.

### Founding-member upgrade/downgrade (edge case)

- Founding-member lifetime has no billing period; upgrading "from founding-lifetime to Pro subscription" is nonsensical (lifetime already includes all Pro features per bundle structure).
- Founding-member wanting to "downgrade" — meaningless; they have lifetime access.
- Plan-change flow detects founding-lifetime tier and disables the "Change plan" action entirely (or shows it as "Lifetime plan — no change available"). Cancellation journey (J3) handles lifetime-leave case.

---

## Copy-discipline — forbidden vs permitted strings

Inherits all commerce-UX copy patterns. Specific to plan-change:

### Forbidden (CI-lint refused)

- ✗ `"Downgrade to Plus"` (status language — MPMF-AP-06)
- ✗ `"Step down to a lower tier"` (status ladder)
- ✗ `"Reduce your access"` (deprivation framing)
- ✗ `"Upgrade to unlock your potential"` (aspirational pressure — MPMF-AP-07)
- ✗ `"Join Pro"` (community-based persuasion)
- ✗ `"Most users choose Pro"` (social proof — MPMF-AP-02)
- ✗ `"Special upgrade price"` / `"Limited upgrade offer"` (fake scarcity — MPMF-AP-09)
- ✗ `"Lose access to..."` — loss framing (factual variant preferred)
- ✗ `"Save money by downgrading!"` (retention-via-cost-framing — NEW anti-pattern surfaced; see MPMF-AP-16)

### Permitted (Factual C5 + editor's-note C6)

- ✓ `"Change to [tier]"` — neutral action verb
- ✓ `"Effective: [date]"` — factual schedule
- ✓ `"You'll be charged: $X today"` — factual proration disclosure
- ✓ `"Your next full charge: $X on [date]"` — factual next-billing disclosure
- ✓ `"What changes immediately"` / `"What changes on [date]"` — factual section header
- ✓ `"Your data stays preserved"` — factual reassurance
- ✓ `"Confirm change"` / `"Keep [current tier]"` — neutral button labels

---

## State + mutations

### Reducer actions

- `PLAN_SELECT_MODAL_OPEN` — triggered by "Change plan" action in BillingSettings.
- `PLAN_SELECT_MODAL_CLOSE` — dismissed without tier selection.
- `PLAN_CHANGE_CONFIRM_MODAL_OPEN` — user selected target tier.
- `PLAN_CHANGE_CONFIRM_MODAL_CLOSE` — dismissed (Keep current / ✕ / escape).
- `PLAN_CHANGE_SUBMIT` — triggers W-SUB-4 writer.
- `PLAN_CHANGE_SUCCESS` — updates `subscription` store with new tier (immediate for upgrade) or scheduled change (downgrade).
- `PLAN_CHANGE_FAILURE` — error toast; retains current tier.

### W-SUB-4 plan-change-writer contract

- **Atomicity:** Stripe subscription-update API + IDB write complete together or neither.
- **Variation A (upgrade):** `tier` updated immediately; `nextBillAt` reset to (existing date); `nextBillAmount` updated to new tier price.
- **Variation B (downgrade):** `tier` stays current; scheduled change at `accessThrough` / `nextBillAt` date; IDB stores `pendingTierChange` field with target tier + effective-date.
- **Post-write side effects:** entitlement context re-hydrates; UI reflects new state (immediately for upgrade; with "Changing to Plus on [date]" indicator for downgrade).

### Post-downgrade-scheduled state

- BillingSettings shows: current tier (Pro) + "Changing to Plus on [date]" indicator.
- User can reverse the pending change (click "Cancel pending change" affordance) — sets `pendingTierChange = null` before effective-date. Reverted via Stripe API un-schedule.
- At effective-date: scheduled job (or on-app-launch check) applies the pending change + clears `pendingTierChange`.

---

## Anti-patterns refused at this journey

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-06** — "Downgrade" framing. "Downgrade to Plus" forbidden. Factual "Change to Plus" used throughout.
- **MPMF-AP-07** — "Missing out" loss-framing. "Lose access to..." variants refused; factual feature-access lists used.
- **MPMF-AP-08** — Dark-pattern checkout. Proration amount disclosed upfront before Confirm tap; no hidden fees.
- **MPMF-AP-11** — Silent auto-renewal. Variation B downgrade schedule is explicit; user sees effective-date.

**New anti-pattern surfaced during this authoring (promoted to `anti-patterns.md`):**
- **MPMF-AP-16 NEW — Deceptive-proration-display.** Hiding proration amount OR showing only monthly-price after upgrade without acknowledging the prorated charge today / showing ambiguous "You'll save $X" on downgrade without acknowledging no refund for current-period-at-higher-tier. Refused.

---

## Red-line compliance checklist (Gate 5 test targets)

- **#1 Opt-in enrollment** — telemetry for plan-change events respects consent gate.
- **#2 Full transparency on demand** — modal shows exact proration + effective-date + feature deltas + data-preservation statement. Test: DOM contains each required section.
- **#3 Durable overrides** — scheduled downgrade can be reversed before effective-date; Stripe subscription reflects reversion. Test: schedule downgrade → cancel pending → assert Stripe state.
- **#4 Reversibility** — load-bearing here. Upgrade reversible (downgrade back to Plus immediately eligible; Stripe proration handles). Downgrade reversible before effective-date. Test: upgrade then immediately downgrade within same billing period.
- **#5 No streaks / shame / engagement-pressure** — no urgency on plan-change; no "limited-time upgrade offer."
- **#6 Flat-access** — PlanSelectModal shows all tiers at equal visual weight (tier user is on gets "Current" chip factually; other tiers tappable without pressure ranking).
- **#7 Editor's-note tone** — CI-linted forbidden-string check on plan-change surface. Test: `scripts/check-commerce-copy.sh`.
- **#8 No cross-surface contamination** — plan-change modal never renders on live-play.
- **#9 Incognito observation mode** — telemetry events respect consent gate.
- **#10 No dark-pattern cancellation** — plan-change is NOT cancellation; conflation refused. Downgrade is tier-migration, not cancel-then-rejoin dark pattern.

---

## Cross-surface consistency

### Shared components

- **`PlanSelectModal`** (new at Phase 5) — tier selection step; shared between Variation A/B.
- **`PlanChangeConfirmModal`** (new at Phase 5) — confirmation step; distinct from CancellationConfirmModal + PaywallModal.
- **`PendingPlanChangeIndicator`** (new at Phase 5) — shown in BillingSettings when `pendingTierChange !== null`; clickable to cancel pending change.

### CI-linted copy generator

- `src/utils/entitlement/planChangeCopy.js` (Gate 5) — deterministic generator from (direction, currentTier, targetTier, prorationAmount, effectiveDate) → copy strings. Refuses forbidden patterns.

### Cross-journey boundaries

- **Cancellation journey (J3) is DISTINCT.** Plan-change cannot be used to cancel; cancellation cannot be used to change tier. Separate entry points (Cancel button vs Change plan button in BillingSettings). Separate modals, separate writers (W-SUB-3 vs W-SUB-4), separate copy generators.
- **Paywall-hit journey (J2) is DISTINCT.** Paywall-hit is free → paid; plan-change is paid-tier to paid-tier.
- **BillingSettings surface (Gate 4 Batch 5)** hosts both entry points (Change plan button + Cancel button) as sibling actions with equal visual weight.

---

## Known behavior notes

- **Founding-member upgrade is meaningless:** lifetime already includes Pro features. UI hides/disables plan-change affordance for founding-lifetime users. Edge-case gracefully handled.
- **Downgrade during card-decline grace period:** if user's card is in grace + they try to downgrade, Variation B applies normally — scheduled at effective-date. Card-decline resolution is orthogonal (user must still update payment for next charge to succeed; cancellation journey J3 Variation C handles card-decline + cancel interaction).
- **Pending downgrade + tier-gated feature:** during the scheduled-downgrade window, user still has current-tier access. Features work normally until effective-date. No "sunset period" degradation.
- **Pending downgrade reversal:** user changes mind; taps "Cancel pending change" in BillingSettings → `pendingTierChange` cleared → Stripe scheduled change reversed.
- **Upgrade telemetry:** `plan_change_upgrade_confirmed` event fires with properties `fromTier`, `toTier`, `prorationAmount`. Informs M4 assumption (Pro-tier WTP $25-35/mo) validation via conversion funnel.
- **No "wait 30 days before you can downgrade" restriction.** User can upgrade and downgrade freely within same billing period. Stripe handles proration correctly.

---

## Known issues

None at creation — new journey. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [PLAN-CH-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `PlanSelectModal.test.jsx` — tier list renders; current tier marked; tap opens confirm modal.
- `PlanChangeConfirmModal.test.jsx` — Variation A proration display; Variation B effective-date display; equal-weight buttons.
- `planChangeCopy.test.js` — generator outputs; CI-grep forbidden strings (esp. "downgrade").
- `W-SUB-4.test.js` — atomicity (Stripe + IDB); upgrade applies immediately; downgrade schedules at period-end.
- `PendingPlanChangeIndicator.test.jsx` — shows when pending; cancel-pending action reverses.

### Integration tests (Phase 5)

- `PlanChangeUpgrade.e2e.test.jsx` — Plus → Pro full flow with proration.
- `PlanChangeDowngrade.e2e.test.jsx` — Pro → Plus; pending state visible; effective-date applies correctly.
- `PlanChangeReversal.e2e.test.jsx` — schedule downgrade → cancel pending → tier remains Pro.
- Red-line #6 assertion suite (equal-weight buttons).

### Visual verification

- Playwright MCP 1600×720 screenshot, 4 scenarios:
  1. PlanSelectModal with 4 tiers + Current chip on Plus.
  2. PlanChangeConfirmModal Variation A (upgrade Plus → Pro with proration).
  3. PlanChangeConfirmModal Variation B (downgrade Pro → Plus with effective-date).
  4. BillingSettings with PendingPlanChangeIndicator.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-J4-PLAN-SELECT`
- `EVID-PHASE5-MPMF-J4-VARIATION-A-UPGRADE`
- `EVID-PHASE5-MPMF-J4-VARIATION-B-DOWNGRADE`
- `EVID-PHASE5-MPMF-J4-PENDING-INDICATOR`

---

## Phase 5 code-path plan

**New files (~5):**
1. `src/components/ui/PlanSelectModal.jsx`
2. `src/components/ui/PlanChangeConfirmModal.jsx`
3. `src/components/views/SettingsView/PendingPlanChangeIndicator.jsx`
4. `src/utils/entitlement/changePlan.js` (W-SUB-4 writer)
5. `src/utils/entitlement/planChangeCopy.js` (CI-linted deterministic copy generator)

**Amended files (~3):**
- `src/reducers/entitlementReducer.js` — plan-change action types + pendingTierChange state.
- `src/components/views/SettingsView/BillingSettings.jsx` — hosts Change-plan entry button + pending-indicator.
- `src/utils/telemetry/eventSchema.js` — plan-change event definitions.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Batch 3 artifact (MPMF-G4-J4). 3 variations (A Upgrade / B Downgrade / C Lateral Phase-2+ placeholder) + shared PlanSelectModal + PlanChangeConfirmModal + PendingPlanChangeIndicator + proration rules (upgrade immediate prorated / downgrade effective-at-period-end no-refund) + data-preservation assurance + copy-discipline refusing "downgrade" status language + 10 red-line compliance with per-line test target + Phase 5 code-path plan. Surfaced new anti-pattern MPMF-AP-16 (deceptive-proration-display). Zero code changes (journey-spec only).
