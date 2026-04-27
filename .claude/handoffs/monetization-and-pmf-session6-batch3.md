# Handoff — Monetization & PMF · Session 6 Batch 3 (Gate 4 journeys)

**Session:** 2026-04-24, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 4 Batch 3 — 11 of 16 Gate 4 items complete; 5 surfaces + closeout remaining
**Status:** DRAFT — awaiting owner review

---

## Files I Own (This Session)

- `docs/design/journeys/cancellation.md` — CREATED (MPMF-G4-J3; LOAD-BEARING red line #10)
- `docs/design/journeys/paywall-hit.md` — CREATED (MPMF-G4-J2; includes H-SC01 defer-to-hand-end mechanism spec)
- `docs/design/journeys/plan-change.md` — CREATED (MPMF-G4-J4; SA-76 upgrade/downgrade with proration)
- `docs/projects/monetization-and-pmf/anti-patterns.md` — AMENDED (MPMF-AP-15 + MPMF-AP-16)
- `docs/design/surfaces/CATALOG.md` — AMENDED (3 new journey entries)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Session Log + 5 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (3 MPMF-G4-J* rows COMPLETE)
- `.claude/STATUS.md` — AMENDED (top entry; prior B2 demoted)
- `.claude/handoffs/monetization-and-pmf-session6-batch3.md` — this file

**No file conflicts.** Other active streams operate in separate directories.

---

## What this session produced

**3 journey specs + anti-pattern expansion + CATALOG + governance.** Zero code.

### MPMF-G4-J3 — cancellation.md (LOAD-BEARING red line #10)

Highest-autonomy-stakes surface in the entire project. Every structural choice here is a direct refusal of industry dark-pattern convention.

**4 variations:**
- **A Standard** — ≤2-tap flow: Cancel button → CancellationConfirmModal → Confirm cancellation. Success toast factual.
- **B Founding-member lifetime** — immediate access-end; no Stripe subscription to cancel; non-refundable by design. Copy explicitly names the lifetime nature.
- **C Card-decline grace period** — offers "Update payment method" as equal-weight alternative. Factual troubleshooting info, no guilt.
- **D Phase-2+ account-deletion path** — deferred placeholder; noted for future authoring.

**CancellationConfirmModal structural rules:**
- 3 buttons at equal visual weight: Confirm cancellation / Pause instead / Keep subscription
- NONE pre-selected; NONE has size/color boost
- NO exit-survey interposed between Cancel tap and confirm
- "Pause instead" is offered, NOT interposed (Phase 2+ feature; Phase 1 defers to support)
- No "Wait! Here's 50% off" retention offers

**Copy-discipline — ~20 forbidden-string patterns enumerated:**
- Retention traps: "Are you sure?" / "Wait!" / "Don't leave us" / "We'll miss you" / "You'll lose all your..."
- Downgrade framing: "Downgrade to free" / "Step down" / "Lose your premium benefits"
- Retention offers: "Special 50% off if you stay" / "Try Plus for half off"
- Emotional framing: "What went wrong?" in confirm / "Your poker journey isn't over"
- Pre-selection patterns: "Pause your subscription instead — we've already paused it for you"

**CI-linted `cancellationCopy.js` generator plan** — deterministic output; mirrors EAL `retirementCopy.js`; forbidden-string grep at CI.

**Post-cancel durability:** ≥90 days no re-subscribe prompts per red line #3. Data preservation per SA-70.

### MPMF-G4-J2 — paywall-hit.md

**4 variations:**
- **A History-access (L4)** — free user taps prior session; modal shows "Current-session always free; prior sessions unlock with Plus."
- **B Usage-threshold (L3)** — quota exhaustion (e.g., "3 of 3 deep analyses this session"). **H-SC01 binding:** mid-hand defers to hand-end.
- **C Depth-of-analysis (L6)** — navigation into paid-tier surface (Anchor Library / Calibration Dashboard). Inline fallback with static preview, NOT blocking modal.
- **D Session-close → paywall-next-open (Q5=A specific)** — session-close free; paywall fires on next re-open to avoid "finishing session = pay up" conflation.

**H-SC01 defer-to-hand-end structural mechanism:**
- `isHandInProgress()` check on paywall trigger.
- If active hand: silently no-op + neutral toast "Feature unlocks at hand-end".
- Post-hand boundary: deferred modal fires.
- Deferred modals don't stack; most-recent trigger fires.
- Test target: MPMF-G5-SC (in-app assertion suite).

**H-N07 7-day cooldown:**
- Per (surface × trigger × user × device).
- Dismissed modal does NOT re-fire for 7 days.
- Gated surface continues to show "Plus required" indicator factually (indicator has no cooldown; only modal does).

**PaywallModal structural rules:**
- 2 equal-weight buttons: View plans / Keep free
- NO "Maybe later" (suggests pressure-to-decide-now)
- NO countdown / urgency / scarcity framing
- CI-linted `paywallCopy.js` deterministic generator

### MPMF-G4-J4 — plan-change.md (DISTINCT from J3 cancellation)

**SA-76 upgrade + downgrade flows.** Explicit architectural invariant: plan-change ≠ cancellation.

**3 variations:**
- **A Upgrade** (e.g., Plus → Pro) — immediate with prorated charge disclosed UPFRONT before Confirm tap. "Change to Pro" copy NEVER "Upgrade!" exclamation.
- **B Downgrade** (e.g., Pro → Plus) — effective at current-billing-period-end; NO refund for unused days at higher tier (industry norm); explicit data-preservation assurance. "Change to Plus" copy NEVER "Downgrade".
- **C Lateral** (Phase-2+ placeholder) — same-price tier switch; deferred.

**Proration rules:**
- Upgrade: Stripe proration calculated; user sees exact $X today + $Y next full charge.
- Downgrade: no refund; user keeps current tier through `accessThrough` date.
- Disclosure refused: hiding proration / opaque "prorated amount" / "save $X!" downgrade framing without clarifying no-refund.

**PlanChangeConfirmModal rules:**
- "Change to [tier]" factual verb (NEVER "Upgrade" or "Downgrade").
- "What changes immediately" / "What changes on [date]" factual feature-access lists.
- "Your data stays preserved. Upgrading later restores full access without re-import." — preempts loss-aversion panic on downgrade.
- 2 equal-weight buttons: Confirm change / Keep current tier.

**PendingPlanChangeIndicator** for scheduled-downgrade reversal — user can cancel pending change before effective-date.

**Founding-member edge case:** plan-change affordance disabled (lifetime already includes Pro features; nonsensical to "upgrade"; "downgrade" reintroduces status framing).

### Anti-patterns expansion (14 → 16)

- **MPMF-AP-15 — Silent-plan-change-on-cancellation.** Pre-selecting pause or switch as default / conflating cancel intent with plan-change / ambiguous single-UI-element submissions / "Save money by downgrading to free" flows that trigger cancel without clarifying.
- **MPMF-AP-16 — Deceptive-proration-display.** Hiding prorated charge amount / "save $X!" downgrade framing without no-refund clarification / opaque proration math behind tooltips.

Anti-patterns.md now at 16 refusals (up from 14 after Batch 2).

### CATALOG.md entries

- `cancellation` (LOAD-BEARING marker)
- `paywall-hit`
- `plan-change`

---

## Cross-journey architectural invariants

**The project's strongest refusal:** cancellation / paywall-hit / plan-change are 3 DISTINCT journeys.

| Aspect | Cancellation (J3) | Paywall-hit (J2) | Plan-change (J4) |
|---|---|---|---|
| Primary JTBD | SA-74 | SA-73 | SA-76 |
| Direction | Paid → Free (or end lifetime) | Free → Paid (conversion moment) | Paid → Paid (tier migration) |
| Entry point | BillingSettings Cancel button | Automatic on feature-gate trigger | BillingSettings Change-plan button |
| Modal | CancellationConfirmModal | PaywallModal | PlanChangeConfirmModal |
| Writer | W-SUB-3 | W-SUB-2 (on Confirm upgrade from modal) | W-SUB-4 |
| Copy generator | cancellationCopy.js | paywallCopy.js | planChangeCopy.js |
| Load-bearing red line | #10 (no dark-pattern cancellation) | #5 + #7 + H-SC01 | #2 transparency + #4 reversibility |

**Conflation attempts refused:**
- "Downgrade to free" path that looks like plan-change but is actually cancellation (MPMF-AP-06 + MPMF-AP-15).
- "Pause instead" pre-selected on cancellation modal (MPMF-AP-05 + MPMF-AP-15).
- Plan-change modal that offers "Cancel instead" as third button (plan-change scope is between-paid-tiers ONLY).
- Paywall-hit modal that offers "Pause instead" (paywall is free→paid; pause is paid→paid-at-lower; different journey).

---

## What this batch unblocks

### Gate 4 Batch 4 + Batch 5 (surfaces) — next session

All 3 journeys reference surfaces that ship in B4/B5:
- `journeys/cancellation.md` references `surfaces/billing-settings.md` (B5) for entry point
- `journeys/paywall-hit.md` references `surfaces/paywall-modal.md` (B4) for shared modal spec
- `journeys/plan-change.md` references `surfaces/billing-settings.md` (B5) for entry + `surfaces/pricing-page.md` (B4) for comparison

Surfaces now have concrete journey contracts to reference.

### Gate 5 code unblocked for these journey-specific writers

- `W-SUB-3 cancelSubscription.js` (MPMF-G5-PG implementation)
- `W-SUB-4 changePlan.js` (MPMF-G5-ER implementation)
- `cancellationCopy.js` + `paywallCopy.js` + `planChangeCopy.js` (MPMF-G5-CL implementation)
- `PaywallGate.jsx` H-SC01 mechanism (MPMF-G5-SC test target)

### Stream D Phase 1 (PostHog) still independently unblocked

Paywall-hit journey specifies event schema: `paywall_shown` / `paywall_dismissed` / `paywall_upgrade_clicked` / `paywall_deferred_to_hand_end`. All respect consent gate per CC-88.

### Stream E Phase 1 (founding-member outreach) still blocked on B4 pricing-page

Cancellation journey covers founding-member-specific cancel (Variation B), but outreach needs public pricing-page surface first.

---

## Remaining Gate 4 (5 items across B4-B5)

Per `plans/misty-swimming-rabbit.md`:

### Batch 4 — Paywall surfaces (next session recommended)
- **MPMF-G4-S1** `surfaces/pricing-page.md` — most complex Gate 4 surface; tier cards + feature comparison + founding-member section + FAQ
- **MPMF-G4-S2** `surfaces/paywall-modal.md` — detailed surface spec referenced by paywall-hit journey
- **MPMF-G4-S3** `surfaces/upgrade-prompt-inline.md` — context-aware inline widget + H-N07 cooldown + presession suppression

### Batch 5 — Billing + trial-state + closeout
- **MPMF-G4-S5** `surfaces/billing-settings.md` — SettingsView extension; 6-action panel
- **MPMF-G4-S4** `surfaces/trial-state-indicator.md` — ≤150ms glanceable chip
- Gate 4 closeout — Stream A `G4 [x]`; final Decisions; CATALOG finalized

---

## Doctrine + architecture notes for next batches

### Copy-discipline forbidden-string list (accumulated through Batch 3)

Now covers 3 journeys. B4 surface specs should reference the accumulated list. Notable additions from B3:
- Cancellation-specific: "Are you sure?" / "Wait!" / "Don't leave us" / "We'll miss you" / "50% off to stay" / "What went wrong?" / "pause instead — we've already paused"
- Plan-change-specific: "Downgrade" (noun or verb) / "Step down" / "Save money by downgrading" / "Lose access to..." / "Special upgrade price" / "Most users choose Pro"
- Paywall-specific: "Maybe later" / "Upgrade now!" / "Don't miss out" / "Limited time" / "You're missing"

**Full CI-lint forbidden-string list should be compiled at B5 for `scripts/check-commerce-copy.sh`.**

### Shared component patterns to reuse in B4 surfaces

- **Confirmation modal pattern** (CancellationConfirmModal / PlanChangeConfirmModal) — 2-3 equal-weight buttons, no pre-selection, factual titles + body, explicit data-state disclosure. Pattern reusable for pricing-page signup-confirmation if needed.
- **H-SC01 defer-to-hand-end mechanism** (`PaywallGate` with `isHandInProgress()` check) — any future UI element that might interrupt active work inherits this.
- **H-N07 cooldown pattern** (`usePaywallCooldown` hook) — reusable for upgrade-prompt-inline (B4) to prevent re-nag.
- **CI-linted deterministic copy generator** (cancellationCopy / paywallCopy / planChangeCopy) — pattern for any commerce copy.

### Open items for Gate 4 B4 pricing-page

Session 4 handoff flagged the "founding-member refund/transfer policy" as open. Pricing-page surface in B4 should address:
- What happens if founding-member wants to stop using the app? (Cancellation Variation B handles — non-refundable; lifetime access ends.)
- Can founding-member transfer to another account? (Unclear; Gate 4 decision.)
- Can founding-member upgrade to Ignition SKU (Phase 2+)? (Likely yes since bundle ε is strict-superset; but Phase 2+ decides.)

### Pricing numbers tentative for B4

Per plan P4 risk: pricing-page may demand tier numbers not yet committed. Recommended placeholder ranges:
- Free: $0
- Plus: $15–19/mo (center: $17)
- Pro: $25–35/mo (center: $29)
- Founding-Lifetime: $299 one-time

Commit for Gate 4 spec; mark as "pricing-tentative — finalized at Stream E launch based on telemetry."

---

## Risk log (updates from this batch)

| # | Risk | Status |
|---|---|---|
| R1-R21 | Prior risks | Unchanged |
| **R22 NEW** | **Pricing-page surface (B4) demands tier pricing numbers before telemetry validates WTP (M4 + M9)** | ACTIVE — mitigated by committing ranges with "pricing-tentative" label; finalize pre-launch. Owner can override specific numbers. |
| **R23 NEW** | **CI-linted copy generators add complexity to Gate 5 implementation beyond EAL analog** | ACTIVE (medium) — 3 generators (cancellation + paywall + plan-change) + upgrade-prompt-inline generator in B4 = 4 total. Plus scripts/check-commerce-copy.sh consolidating forbidden-string list. Acceptable scope; mirrors EAL pattern at ~3x volume. |
| **R24 NEW** | **Cancellation journey tap count sensitivity** | ACTIVE (low) — 2-tap is the floor for red line #10 compliance. Design tests should verify tap count doesn't drift above 2 via accidental interposition (e.g., "confirm destination page" that adds a tap). |

---

## Ratification checklist (for owner)

Before Batch 4 begins, owner should:

- [ ] Review cancellation.md — particularly 3-button equal-weight modal + ~20 forbidden-string patterns for appropriateness
- [ ] Review paywall-hit.md — particularly H-SC01 defer-to-hand-end mechanism + H-N07 7-day cooldown period appropriateness
- [ ] Review plan-change.md — particularly "Change" verb usage (never "Downgrade") + proration disclosure rules
- [ ] Review MPMF-AP-15 + MPMF-AP-16 additions for scope
- [ ] (Optional) Commit pricing numbers for B4 pricing-page OR flag "use tentative ranges"

Nothing locks until explicit ratification; amendable at B4/B5 boundaries.

---

## Change log

- 2026-04-24 — Session 6 Batch 3. Gate 4 journeys batch shipped — 3 journey specs (cancellation load-bearing red-line-#10 / paywall-hit with H-SC01 defer-to-hand-end / plan-change distinct-from-cancellation) + 2 new anti-patterns (MPMF-AP-15/16) + CATALOG updates. 11 of 16 MPMF-G4-* carry-forwards complete; 5 surfaces remaining across B4/B5. Zero code. Zero test regressions.
