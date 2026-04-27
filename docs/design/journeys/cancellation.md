# Journey — Cancellation (dark-pattern-free)

**ID:** `cancellation`
**Product line:** Main app. Extension inherits cancellation state read-only via WebSocket bridge per entitlement-architecture.
**Primary persona:** Any paying user (Chris / Scholar / Evaluator-converted / founding-member).
**Tier placement:** Plus+ (only applies when user has paid state to cancel).
**Last reviewed:** 2026-04-24 (Gate 4 Batch 3)
**Criticality:** **HIGHEST autonomy-stakes surface in the project.** Cancellation is where industry SaaS monetization integrity most commonly fails. Under Q1=A verdict, red line #10 (no dark-pattern cancellation) is load-bearing here; CI-linted forbidden-copy ladder is mandatory at Gate 5.

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red line #10 (NEW no dark-pattern cancellation) + #3 (durable override) + #4 (reversibility) + #7 (editor's-note tone)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-05 (cancellation retention traps) + §MPMF-AP-06 ("downgrade" framing) + §MPMF-AP-11 (silent auto-renewal)
- `docs/projects/monetization-and-pmf/WRITERS.md` §W-SUB-3 (cancellation-writer) + §I-WR-3 (cancellation atomicity)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Cancellation section
- `docs/design/jtbd/domains/subscription-account.md` §SA-74 (cancel-without-friction — primary JTBD; load-bearing red line #10)
- `docs/design/jtbd/domains/subscription-account.md` §SA-66 (transparent billing + easy pause)
- `docs/design/surfaces/billing-settings.md` (Gate 4 Batch 5 — cancellation entry point lives here)
- `docs/projects/exploit-anchor-library/journeys/anchor-retirement.md` (structural precedent — multi-variation journey with CI-linted copy ladder)

---

## Purpose

Cancellation is the moment where user autonomy is most fragile and industry products most commonly fail. Per Q1=A doctrine scope verdict: **cancellation is cancellation.** No exit-survey interposition, no "are you sure?" guilt traps, no "pause instead — give us another chance" dark patterns, no "downgrade" status framing, no retention flows that reframe the user's decision. ≤ 2 taps from billing settings to cancellation complete.

This is the journey where the product's stated differentiator ("No streaks. No guilt. Cancel in two taps.") becomes either a marketing truth or a marketing lie. Drift here is catastrophic to the positioning wedge.

Non-goals (explicit):
- **Not a retention surface.** Cancellation does NOT try to convince the user to stay. Alternative options (pause, change plan) are offered alongside equal-weight but are NEVER interposed between the cancel button and the confirmation.
- **Not a data-deletion surface.** Cancellation preserves local IDB data per SA-70. Data export is a separate billing-settings action. Server-side data (if any — Phase 1 is local-only) is not deleted on cancellation; requires explicit separate request per data-rights policy.
- **Not a refund surface.** Refund requests are handled out-of-band via support channel (Phase 1 founding-member lifetime has no refund policy by design; monthly subscriptions are cancel-at-end-of-period with no proration refund).
- **Not a re-subscribe surface.** Cancelled users can re-subscribe anytime via pricing-page; the cancellation journey itself does not offer re-subscription prompts or reminders. Per red line #3 + MPMF-AP-05, no re-prompting for ≥ 90 days post-cancel.

---

## JTBD served

**Primary:**
- **`JTBD-SA-74`** — Cancel without friction (load-bearing for red line #10)

**Secondary (related but not primary):**
- **`JTBD-SA-66`** — Transparent billing + easy pause (pause is offered alongside cancel — two distinct actions)
- **`JTBD-SA-70`** — Local-only mode with full features (data preservation on cancel respects this)

**NOT served (explicit non-goals):**
- **`JTBD-SA-76`** — Plan change (upgrade/downgrade is a separate journey at J4)
- Refund requests (out-of-band)
- Data deletion (separate Settings → Data action)

---

## Personas served

**Primary:**
- **Any paying user** — Chris (Plus/Pro), Scholar (Plus), founding-member, converted Evaluator. All experience the same journey.
- **`post-session-chris`** — most likely cancellation context (bankroll reassessment, quarter-end financial review, rage-quit after losing session). Journey must survive all three emotional states equally.

**Secondary:**
- **`between-hands-chris`** / **`mid-hand-chris`** — cancellation journey NEVER fires during live play. Entry point (billing-settings) is only reachable via Settings nav; Settings itself is accessible between hands but cancellation flow is multi-step and assumes off-table context.

**Explicitly excluded:**
- **`newcomer-first-hand`** — shouldn't be encountering cancellation yet (free tier doesn't have cancellation path).
- **Unpaid evaluators** — not applicable; evaluator cannot cancel what they haven't paid for. Evaluator "leaves" simply by closing the app.

---

## The cancellation flow — 4 variations

All 4 variations share the **same confirmation sheet** at the final step. Variations differ in entry point + pre-state.

### Variation A — Standard cancellation (most common path)

**Trigger:** User with active paid subscription navigates to `SettingsView → Billing → Cancel` button.

**Flow:**

```
Settings → Billing section
 → User taps "Cancel" button (primary action in the billing-settings "Cancel subscription" row)
 → CancellationConfirmModal opens
 → User taps "Confirm cancellation" button
 → W-SUB-3 cancellation-writer fires Stripe API + IDB update atomically
 → Success toast: "Cancelled. You'll keep access through [date]."
 → Modal dismisses; user returns to BillingSettings with updated state
```

**Tap count:** exactly 2 taps from BillingSettings to cancellation complete (Cancel button → Confirm cancellation button). Matches SA-74 JTBD binding.

**No interposition:**
- Cancel button → Confirm modal (no exit-survey between).
- Confirm modal shows: current plan + end-of-access date + what's preserved + 3 equal-weight buttons (Confirm cancellation / Pause instead / Keep subscription).
- "Pause instead" button does NOT pre-select. No visual boost. No "Recommended" badge.

---

### Variation B — Founding-member lifetime cancellation

**Trigger:** Founding-member user attempts to cancel their lifetime tier.

**Flow difference from Variation A:**
- Confirm modal copy acknowledges the unique nature: "This is a Founding-Member lifetime plan. There's no recurring charge. Cancelling means you'll no longer have lifetime access; going forward you'll be on the free tier."
- No Stripe API call (no subscription to cancel — it's a one-time purchase).
- `W-SUB-3` writes `canceledAt = now()` + `accessThrough = now()` (immediate, no billing-period-end grace since no billing period).
- Success toast: "Lifetime access cancelled. You're on the free tier now."
- **No refund** for the $299 payment (documented at purchase-time; lifetime is non-refundable by design).

**Alternative offered:** "Keep lifetime access" button (default dismiss), since there's no "pause" concept for lifetime. 2 equal-weight buttons in the confirm modal.

**This is the only cancellation variation where "change plan to Plus/Pro subscription" might make sense as a third option** — but Gate 4 decision: do NOT offer this automatically, as it reintroduces "downgrade" framing (MPMF-AP-06). User who wants to move from lifetime to subscription can cancel + resubscribe separately.

---

### Variation C — Cancellation during card-decline grace period

**Trigger:** User's card declined; in 7-day grace period (entitlement-architecture §Grace periods); user navigates to cancel during grace.

**Flow difference from Variation A:**
- Confirm modal shows additional info line: "Note: your card was declined on [date]. If you'd rather update your card than cancel, tap Update payment method." (Offered, not interposed.)
- 3 buttons: Confirm cancellation / Update payment method / Keep subscription.
- Confirm path proceeds identically to Variation A but without Stripe recurring-charge cancellation (the subscription is already in failed-payment state; Stripe reflects this).

**Red-line compliance:** this variation is the ONE place where the user might benefit from being reminded about the card-decline context. Copy is factual; "Update payment method" button is equal weight; no coercion.

---

### Variation D — Cancellation via "I'm done with the app" path

**Trigger:** User uses a "delete my account" or "I'm leaving" affordance (Phase 2+ only — Phase 1 has no account system).

**Status:** DEFERRED to Phase 2+ (when account system exists). Phase 1 cancellation works via Variation A/B/C only; "I'm done with the app" path is equivalent to cancelling + uninstalling (local-only data stays in device until user clears IDB).

**Placeholder note:** when Phase 2+ authoring picks this up, design goal is: cancellation + data-export + server-side-account-deletion in sequence, with each step opt-in separately. NOT a single nuclear button (prevents accidental data loss).

---

## The CancellationConfirmModal — shared across Variations A/B/C

Single modal component. Variation-specific copy passed as props.

```
┌── Cancel [tier name] ────────────────── (✕ close) ──┐
│                                                      │
│  You're cancelling: [tier name]                      │
│  You'll keep access through: [date]                  │
│                                                      │
│  What stays preserved:                               │
│  · Your hand history (local)                         │
│  · Your villain profiles (local)                     │
│  · Your session data (local)                         │
│  · Your settings + preferences                       │
│                                                      │
│  What changes after [date]:                          │
│  · Cross-session history access ends                 │
│  · Paid features gate to the free tier               │
│  · You can resubscribe any time (no penalty)         │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  [ Confirm cancellation ]                     │   │
│  │  [ Pause instead (1 month) ]                  │   │
│  │  [ Keep subscription ]                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Modal contract:**

- **Title:** "Cancel [tier name]" (factual; not "Are you sure?" or "Don't leave us!").
- **Summary section** — 2 lines stating what user is cancelling + end-of-access date. No emotional framing.
- **"What stays preserved"** — factual list. Reassures the user their data isn't held hostage.
- **"What changes after [date]"** — factual list. Includes "You can resubscribe any time (no penalty)" because otherwise users fear burned bridges.
- **3 buttons at equal visual weight** — Confirm cancellation / Pause instead / Keep subscription. NONE is pre-selected. NONE has a color/size boost. Order is fixed: Confirm first (the user's stated intent), Pause second (alternative), Keep third (least-change).
- **"Pause instead" behavior:** if user taps this, opens a separate PauseSubscriptionModal (Phase 2+; Phase 1 shows "Pause coming soon — contact support if you need to pause now" and defers to support). Not in this journey's scope.
- **"Keep subscription" button:** dismisses the modal with no state change. Returns to BillingSettings. No "Glad you're staying!" toast (refuses coercive framing).
- **No exit survey.** An optional feedback prompt MAY appear AFTER cancellation completes (toast with "Quick feedback? →" link) — NEVER before the cancel action completes.
- **No "Wait! Here's 50% off!" offer.** Retention discounts are NOT part of Phase 1 cancellation flow. (If Phase 2+ considers retention offers, they are a separate decision requiring Q1 scope re-verdict.)

---

## Copy-discipline ladder — forbidden vs permitted strings

This journey has the strictest CI-linted copy-discipline in the project. Gate 5 `scripts/check-commerce-copy.sh` enforces these patterns via deterministic copy generator `src/utils/entitlement/cancellationCopy.js` (mirrors EAL `retirementCopy.js` + `calibrationCopy.js` pattern).

### Forbidden strings (CI-lint refused)

**Retention-trap patterns (MPMF-AP-05):**
- ✗ `"Are you sure?"` — interposes uncertainty before the user's decision
- ✗ `"Wait!"` / `"Hold on!"` — attention-grab coercion
- ✗ `"Don't leave us"` / `"We'll miss you"` / `"Come back soon"` — emotional guilt
- ✗ `"You'll lose all your..."` — loss framing (even if true, factual variant is preferred)
- ✗ `"Are you sure you want to cancel?"` — confirmation-creep

**Downgrade-framing patterns (MPMF-AP-06):**
- ✗ `"Downgrade to free"` — status-ladder language
- ✗ `"Step down"` / `"Reduce your access"` / `"Remove features"` — loss framing on status
- ✗ `"Lose your premium benefits"` — emotional hook
- ✗ `"Your Pro membership will end"` (soft violation if "membership" implies ongoing community loss)

**Retention-offer patterns (Phase 1 refused):**
- ✗ `"Special 50% off if you stay"` — price coercion
- ✗ `"Try Plus for half off"` — bait-and-switch
- ✗ `"One-time offer"` / `"Limited time save"` — fake urgency (MPMF-AP-01 + MPMF-AP-09)

**Emotional-framing patterns (MPMF-AP-07):**
- ✗ `"What went wrong?"` in confirmation (OK in optional post-cancel survey)
- ✗ `"Don't give up on your game"` / `"Your poker journey isn't over"` — aspirational guilt

**Proactive-retention patterns (NEW MPMF-AP-15):**
- ✗ `"Pause your subscription instead — we've already paused it for you, just confirm"` — default-pre-selected pause (retention via friction reversal)
- ✗ Any pre-checked alternative action that requires explicit opt-out

### Permitted strings (Factual C5 + editor's-note C6 registers)

**Confirmation copy:**
- ✓ `"Cancel [tier]. You'll keep access through [date]."`
- ✓ `"You're cancelling: [tier name]"`
- ✓ `"Confirm cancellation"`
- ✓ `"You can resubscribe any time (no penalty)"`
- ✓ `"What stays preserved"` / `"What changes after [date]"` (factual section headers)

**Alternative-offer copy:**
- ✓ `"Pause instead (1 month)"` (factual alternative, clearly labeled)
- ✓ `"Keep subscription"` (factual "don't cancel" option without emotional pressure)
- ✓ `"Update payment method"` (Variation C — factual troubleshooting offer)

**Post-cancel success copy:**
- ✓ `"Cancelled. You'll keep access through [date]."` (factual success confirmation)
- ✓ `"Lifetime access cancelled. You're on the free tier now."` (Variation B success)
- ✓ `"Quick feedback? →"` (optional post-cancel survey hint; never blocking)

---

## State + mutations

### Reducer actions

- `CANCELLATION_CONFIRM_MODAL_OPEN` — triggered by Cancel button tap; sets `isCancellationModalOpen: true`.
- `CANCELLATION_CONFIRM_MODAL_CLOSE` — dismisses modal (via ✕ / Keep subscription / escape key).
- `CANCELLATION_SUBMIT` — triggers W-SUB-3 writer; sets `isCancellationInFlight: true`.
- `CANCELLATION_SUCCESS` — updates `subscription` store + shows success toast.
- `CANCELLATION_FAILURE` — shows error toast ("We couldn't reach the billing system; try again."); retains `tier` unchanged per I-WR-3 atomicity.

### W-SUB-3 cancellation-writer contract (per WRITERS.md)

- **Atomicity (I-WR-3):** Stripe cancellation API call + IDB write complete together, or neither does. No partial-cancel state possible.
- **Fields written:** `canceledAt = now()`, `accessThrough = end_of_current_billing_period` (or `now()` for founding-member lifetime).
- **Post-write side effects:** entitlement context re-hydrates; UI reflects new state immediately.

### Post-cancel state

- **Until `accessThrough` date:** `tier` remains; user has full paid access. No degraded UI, no teaser pressure, no upsell banners.
- **At `accessThrough` date:** scheduled action (or on-app-launch check) writes `tier = 'free'`; features gracefully gate via PaywallGate component.
- **No re-subscription prompts for ≥ 90 days post-cancel** (red line #3 durable override + MPMF-AP-05 refusal).
- **Data retention:** local IDB data preserved indefinitely per SA-70. User can export via Settings → Data → Export at any time (before or after cancellation).

---

## Anti-patterns refused at this journey

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-05 — Cancellation retention traps.** "Are you sure?" / exit-survey-before-confirm / "pause instead" pre-selected / "50% off to stay" — all refused. Confirmation modal has no interposition between user tap and cancellation write.
- **MPMF-AP-06 — "Downgrade" framing on cancellation.** "Downgrade to free" / "step down" / status-ladder language refused. Factual: "Cancel [tier]. You'll keep access through [date]. You can come back any time."
- **MPMF-AP-07 — "Missing out" loss-framing.** No "Don't lose your premium benefits!" / "Your journey isn't over!" copy.
- **MPMF-AP-11 — Silent auto-renewal.** Inverse applies here — cancellation must NOT silently fail or partial-succeed. Atomicity invariant I-WR-3 enforces.

**New anti-pattern surfaced during this authoring (promoted to `anti-patterns.md`):**
- **MPMF-AP-15 NEW — Silent-plan-change on cancellation.** Offering "pause instead" with pre-selected default / auto-switching tier on cancellation attempt / any flow that commits to a plan change without explicit user confirmation. Refused.

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines enumerated; each has a testable assertion on this journey:

- **#1 Opt-in enrollment** — N/A (cancellation is user-initiated, opt-in by definition).
- **#2 Full transparency on demand** — confirmation modal shows: tier being cancelled / end-of-access date / what's preserved / what changes / re-subscribe statement. All factual. Test: DOM contains each required section.
- **#3 Durable overrides on billing state** — cancelled state honored for ≥ 90 days without re-subscribe prompt. Test: scheduled action 90 days post-cancel; assert no re-prompt code path fires.
- **#4 Reversibility** — cancellation reversible before `accessThrough` date. Test: cancel → re-subscribe flow within billing period restores `tier` without new payment.
- **#5 No streaks / shame / engagement-pressure** — no "you've been a member for X months — don't leave now!" copy. Test: CI-grep refused strings in cancellation surface.
- **#6 Flat-access** — N/A (not a browse/compare surface).
- **#7 Editor's-note tone** — CI-linted forbidden-string check enforces factual copy register. Test: `scripts/check-commerce-copy.sh` on cancellation surface.
- **#8 No cross-surface contamination** — cancellation flow renders in Settings/Billing only; never on live-play. Test: H-SC01 assertion — cancellation modal cannot mount during `isHandInProgress() === true`.
- **#9 Incognito observation mode** — telemetry events for cancellation (cancellation-confirmed / cancellation-cancelled / cancellation-failed) respect consent gate. Test: with `usageEvents` opted-out, zero cancellation telemetry.
- **#10 ★ NEW No dark-pattern cancellation** — ≤ 2-tap path + no exit-survey-before-confirm + 3 equal-weight buttons + factual copy + atomic writer. **Load-bearing.** Test: MPMF-G5-RL specific assertion suite — tap count, button weight (CSS size/color parity), exit-survey absence before write, forbidden-string absence in DOM.

---

## Cross-surface consistency

### Shared components

- **`CancellationConfirmModal.jsx`** (new at Phase 5) — shared across Variations A/B/C. Variation-specific copy passed as props.
- **`BillingCancelAction.jsx`** (new at Phase 5) — the entry-point button in `BillingSettings.jsx`. Single primary action per row; no disambiguation sub-menu.

### CI-linted copy generator

- `src/utils/entitlement/cancellationCopy.js` (Phase 5) — deterministic generator from (tier, variation, state) → copy strings. Mirrors EAL `retirementCopy.js` pattern:
  - Generator output passes through `scripts/check-commerce-copy.sh` forbidden-string grep at CI.
  - Runtime LLM generation refused (non-deterministic; harder to test).
  - Single source of truth for all cancellation copy — UI components import from generator, never hardcode strings.

### Cross-journey consistency

- **Plan-change journey (J4) shares no confirm modal** with cancellation — these are DISTINCT actions. Plan-change is SA-76, cancellation is SA-74. Conflating them is the anti-pattern.
- **Paywall-hit journey (J2) shares no confirm modal** with cancellation — paywall-hit is a conversion moment (free → paid); cancellation is the reverse.

### Post-cancel state propagation

- Entitlement context (`EntitlementContext`) re-hydrates on W-SUB-3 success.
- `PaywallGate` components re-render with new access rules (no-op until `accessThrough`; then gates activate).
- Extension (`ignition-poker-tracker/`) observes via WebSocket bridge; updates its own UI to reflect new tier.
- Tier-state-indicator chip in nav updates factually ("Cancelled — access through [date]").

---

## Known behavior notes

- **Cancellation during active session:** user in live-play cannot open Settings easily; practically, cancellation is a between-hands or post-session action. H-SC01 guarantees cancellation flow never fires mid-hand even if user somehow navigates there.
- **Cancellation by accidental-tap:** the confirmation modal protects against single-tap-accidental-cancellation. The 2-tap flow (Cancel button → Confirm cancellation button) is the minimum safe threshold per industry norms while respecting SA-74's "without friction" directive.
- **Cancellation while card is already declined (Variation C):** user might panic-cancel seeing the grace-period warning. Variation C offers the update-card alternative factually without guilt-trapping.
- **Post-cancel 90-day re-prompt ban:** after 90 days, user may see re-subscribe offers via normal pricing-page navigation, but never via push notification or email (MPMF-AP-04 binds forever).
- **Lifetime-member cancellation (Variation B):** there's no billing-period-end grace because there's no billing period; `accessThrough = now()`. Some users may be surprised by immediate tier-drop; copy explicitly states this.
- **Feedback collection:** optional post-cancel survey is offered via toast "Quick feedback? →" link. User can ignore. Cancellation completes regardless. Collected feedback goes to a free-form notes field in a separate feedback store (Phase 2+).

---

## Known issues

None at creation — new journey. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [CANCEL-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `CancellationConfirmModal.test.jsx` — 3 buttons render at equal visual weight; no pre-selection; ✕ dismisses; Confirm triggers W-SUB-3.
- `BillingCancelAction.test.jsx` — tap opens modal; ≥ 44×44 DOM px target.
- `cancellationCopy.test.js` — generator outputs for each (tier, variation) combination; CI-grep on generator output.
- `W-SUB-3.test.js` — atomicity: Stripe call + IDB write together or neither; fail-state preserves prior tier.

### Integration tests (Phase 5)

- `Cancellation.e2e.test.jsx` — full flow: BillingSettings → Cancel → Confirm → success toast → tier reflects updated state.
- `CancellationVariationB.e2e.test.jsx` — founding-member specific copy + immediate access-end.
- `CancellationVariationC.e2e.test.jsx` — card-decline grace-period variant.
- Red-line #10 assertion suite (MPMF-G5-RL) — tap count ≤ 2, no exit-survey-before-confirm, 3-button equal-weight visual parity, forbidden-string absence.

### Visual verification

- Playwright MCP 1600×720 screenshot, 5 scenarios:
  1. BillingSettings → Cancel button hover state.
  2. CancellationConfirmModal (Variation A) default state.
  3. CancellationConfirmModal (Variation B) founding-member copy.
  4. CancellationConfirmModal (Variation C) card-decline grace.
  5. Post-cancel BillingSettings showing "Cancelled — access through [date]" state.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-J3-CANCEL-BUTTON`
- `EVID-PHASE5-MPMF-J3-CONFIRM-VARIATION-A`
- `EVID-PHASE5-MPMF-J3-CONFIRM-VARIATION-B`
- `EVID-PHASE5-MPMF-J3-CONFIRM-VARIATION-C`
- `EVID-PHASE5-MPMF-J3-POST-CANCEL-STATE`

---

## Phase 5 code-path plan

**New files (~5):**
1. `src/components/ui/CancellationConfirmModal.jsx`
2. `src/components/views/SettingsView/BillingCancelAction.jsx`
3. `src/utils/entitlement/cancelSubscription.js` (W-SUB-3 writer)
4. `src/utils/entitlement/cancellationCopy.js` (CI-linted deterministic copy generator)
5. `scripts/check-commerce-copy.sh` (CI-lint script covering cancellation + plan-change + paywall + upgrade-prompt copy)

**Amended files (~3):**
- `src/reducers/entitlementReducer.js` — cancellation action types + state transitions.
- `src/components/views/SettingsView/BillingSettings.jsx` — hosts BillingCancelAction.
- `src/utils/telemetry/eventSchema.js` — cancellation event definitions (cancelled-confirmed, cancelled-cancelled, cancelled-failed).

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Batch 3 artifact (MPMF-G4-J3). 4 variations (A Standard / B Founding-member / C Card-decline grace / D Phase-2+ placeholder) + shared CancellationConfirmModal + copy-discipline ladder with ~20 forbidden-string patterns + CI-linted deterministic copy generator plan + 10 red-line compliance with per-line test target + Phase 5 code-path plan. Surfaced new anti-pattern MPMF-AP-15 (silent-plan-change-on-cancellation). Load-bearing for red line #10. Zero code changes (journey-spec only).
