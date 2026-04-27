# Handoff — Monetization & PMF · Session 7 Batch 4 (Gate 4 paywall surfaces)

**Session:** 2026-04-25, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 4 Batch 4 — 14 of 16 Gate 4 items complete; 2 remaining (S4 trial-state-indicator + S5 billing-settings) for B5 closeout
**Status:** DRAFT — awaiting owner review

---

## Files I Own (This Session)

- `docs/design/surfaces/pricing-page.md` — CREATED (MPMF-G4-S1)
- `docs/design/surfaces/paywall-modal.md` — CREATED (MPMF-G4-S2)
- `docs/design/surfaces/upgrade-prompt-inline.md` — CREATED (MPMF-G4-S3)
- `docs/design/surfaces/CATALOG.md` — AMENDED (3 new entries)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Session Log + 4 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (3 MPMF-G4-S* rows COMPLETE)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF S6 demoted)
- `.claude/handoffs/monetization-and-pmf-session7-batch4.md` — this file

**No file conflicts.** PRF S6 ran in parallel (PRF Gate 4 CLOSED in their session); separate file trees so coexisting cleanly.

---

## What this session produced

**3 surface specs + CATALOG entries + governance.** Zero code. Zero test regressions.

### MPMF-G4-S1 — pricing-page.md

**Most complex Gate 4 surface.** Top-level routed view at `SCREEN.PRICING`. Public commercial artifact translating doctrine into transparent commerce.

**4 TierCards at equal visual weight (red line #6 load-bearing):**
- Free: $0 — hand entry, live exploit engine, end-of-session recap, sample data mode
- Plus: $17/mo or $179/yr — Free + cross-session villain tracking, full history, basic drills
- Pro: $29/mo or $299/yr — Plus + game tree deep analysis, exploit anchor library, calibration dashboard, advanced drills, printable refresher
- Founding-Lifetime: $299 once, cap 50 — Pro features + locked at today's price + all future Pro upgrades

**Critical structural rules:**
- NO "Most Popular" / "Best Value" / "Recommended" badges
- All 4 cards rendered with same width / height / padding / background / button size
- Tier ordering by price (factual ascending), not ranked promotion
- "Pricing-tentative" banner persistent until Stream D Phase 4 telemetry validates

**FoundingMemberSection** with factual cap-remaining count + non-refundable disclosure inline + "transactional cap, not a timer" explicit AP-01 anti-anti-pattern disclosure.

**7-entry FAQ accordion** answers: cancel-anytime / data-on-downgrade / Founding-Lifetime explained / Ignition-sidebar Phase-2+ deferred (no email capture) / telemetry-opt-out / no-paid-trial-Free-IS-the-trial / how-to-switch-tiers.

**Footer doctrine line:** "No streaks. No guilt. Cancel in two taps." — M1 marketing wedge as explicit pricing-page footer (permitted under Q1=A as positioning-wedge).

**Sub-shape tailoring** invisible-to-user (gentle feature-list reordering per E-CHRIS / E-SCHOLAR / E-IGNITION attribute; never gates content; never shows "We see you're a..." copy).

### MPMF-G4-S2 — paywall-modal.md

**Detailed surface contract** for the modal referenced by paywall-hit journey J2.

**PaywallModal** (Variations A/B/D shared component):
- 2 buttons at equal visual weight: `[View plans]` + `[Keep free]`
- CSS measurement test target: same width, same height, same padding, same color treatment
- NO "Maybe later" button (suggests pressure-to-decide-now)
- NO countdown / urgency / scarcity framing
- NO pre-selection on either button
- Backdrop-tap does NOT dismiss (prevents accidental dismissal during reach-for-✕)
- 150ms fade animation (quick, non-aggressive)

**PaywallFallbackInline** (Variation C — depth-of-analysis surfaces):
- Inline render in place of gated view content (NOT modal blocker)
- Static preview of representative artifact + 2 buttons (Unlock / Back)
- Spatial context preserved; no backdrop overlay

**PaywallGate orchestrator** (component contract):
- `hasAccessTo(feature)` check first; render children if access granted
- Cooldown check via `usePaywallCooldown` (H-N07 7-day per surface×trigger×user×device)
- H-SC01 isHandInProgress() check; if true, register deferred + return null + neutral toast at action site
- Otherwise render fallback (modal or inline)

**useDeferredPaywall hook** for H-SC01 mid-hand mechanism:
- Register on mid-hand trigger
- Subscribe to handEnded reducer event
- On hand-end: pop deferred queue + fire most-recent (deferred modals don't stack)
- Cleared if user navigates away from live-play surface before hand-end

**5 telemetry events all consent-gated:**
- paywall_shown / paywall_dismissed / paywall_view_plans_clicked / paywall_deferred_to_hand_end / paywall_cooldown_blocked

### MPMF-G4-S3 — upgrade-prompt-inline.md

**Proactive counterpart** to PaywallModal's reactive trigger.

**5 host contexts:**
| Context | Variant | When suppressed |
|---|---|---|
| session-recap (post-cashout) | Compact | Returning-evaluator first 2h |
| post-hand-review (HandReplayView) | Compact | Active hand (H-SC01) |
| settings-billing (SettingsView) | Expanded (multi-line) | Already paid user |
| session-list-row (free-tier badges) | Badge variant | None — always visible |
| drills-list (Scholar context) | Compact | None |

**6 suppression rules:**
1. Mid-hand H-SC01
2. Presession-preparer surfaces
3. Returning-evaluator first-2-hour-window
4. Newcomer (<25 hands)
5. Paid-tier (entitlement check returns null component)
6. Cooldown active (per host context, 7-day H-N07)

**Sub-shape-tailored copy** invisible-to-user:
- E-CHRIS: "Plus unlocks cross-session villain tracking + history."
- E-SCHOLAR: "Plus unlocks basic drills + cross-session history."
- E-IGNITION: "Online sidebar coming Phase 2. Plus unlocks cross-session features for the main app."
- No-sub-shape default: "Plus unlocks cross-session villain tracking + history."

**Inline-prompt-specific anti-patterns refused (visual/animation rules):**
- Pulsing / blinking / color-shift animation
- Auto-scrolling to bring prompt into view
- Confirm-dismissal sub-prompt on ✕ tap
- Re-rendering at different position after dismissal

**4 telemetry events** including `upgrade_prompt_suppressed` with reason — useful for assumption M6 (doctrine-as-positioning-wedge) kill-criterion validation.

### CATALOG.md entries

- `pricing-page` (top-level view; SCREEN.PRICING route)
- `paywall-modal` (inline widget — modal overlay)
- `upgrade-prompt-inline` (inline widget — embedded across 5 host contexts)

---

## Cross-surface architectural invariants ratified

### S2 (PaywallModal) vs S3 (UpgradePromptInline) — DISTINCT patterns

| Aspect | PaywallModal (S2) | UpgradePromptInline (S3) |
|---|---|---|
| Trigger | Reactive — fires when feature gate hit | Proactive — embedded on contextual surfaces |
| Behavior | Blocks user action (modal overlay) | Inline content; no blocking |
| Sub-shape tailoring | None — same copy for all evaluators | Yes — E-CHRIS/E-SCHOLAR/E-IGNITION |
| Cooldown key | (surface × trigger × user × device) | (host context × user × device) |
| Animation | 150ms fade | None (no animation) |
| Copy generator | paywallCopy.js | upgradePromptCopy.js |
| Telemetry events | 5 events | 4 events |
| Backdrop | Yes (semi-transparent overlay) | No |
| Dismissal cooldown | 7 days | 7 days |
| Routing destination | pricing-page (View plans) | pricing-page (See plans) |

**Architectural ratification:** these surfaces are NOT unified into one component, NOT redirected-to-each-other. Modal blocks; inline lives quietly. Conflation would extend MPMF-AP-15 silent-plan-change-on-cancellation analog into "every gate becomes a banner" anti-pattern.

### Pricing-page non-coercion rules

- Pricing-tentative banner committed in Phase 1 — refuses "act now before prices change!" anti-pattern (MPMF-AP-09)
- Cap-remaining count is real (transactional scarcity), not timer (MPMF-AP-01 anti-anti-pattern)
- Founding-Lifetime non-refundable disclosure inline (preempts MPMF-AP-08 hidden-fee surprise)
- Sub-shape tailoring invisible (refuses "We see you're a..." persona-as-input anti-pattern)
- Footer doctrine line ("No streaks. No guilt. Cancel in two taps.") permitted under Q1=A as positioning-wedge marketing
- A/B testing categorically refused for conversion-coercion variants (urgency timer / Most Popular badge / inflated social proof); permitted for doctrine-explicit-vs-doctrine-implicit copy (M6 kill-criterion)

---

## What this batch unblocks

### Gate 5 implementation work — paywall component contracts ready

All 3 surfaces specify concrete component contracts for Gate 5 code:
- `PaywallGate.jsx` (MPMF-G5-PG implementation) — feature-access + cooldown + H-SC01 check
- `PaywallModal.jsx` + `PaywallFallbackInline.jsx` — variation routing
- `useDeferredPaywall.js` + `usePaywallCooldown.js` — H-SC01 + H-N07 hooks
- `UpgradePromptInline.jsx` + `useUpgradePromptVisibility.js` — proactive widget + 6 suppression rules
- `PricingView/` directory with TierCard / FeatureComparisonTable / FoundingMemberSection / PricingFAQ
- `paywallCopy.js` + `upgradePromptCopy.js` + `pricingCopy.js` (CI-linted deterministic generators)

### Stream E Phase 1 (founding-member outreach) — NOW UNBLOCKED

Pricing-page surface ships → outreach can begin. Founding-Lifetime cohort section lives there with cap-remaining UI. Outreach links can point at pricing-page directly.

Note: still requires founding-member-pricing infrastructure (Stripe product/price config + cap-enforcement webhook) at Gate 5 — but the SURFACE side is unblocked.

### Remaining Gate 4 (B5 only)

Just 2 surfaces + closeout:
- **MPMF-G4-S5** `surfaces/billing-settings.md` — SettingsView extension; 6-action panel (plan card / payment method / next-bill / update-payment / change-plan / cancel / data-export)
- **MPMF-G4-S4** `surfaces/trial-state-indicator.md` — ≤150ms glanceable chip in nav
- Gate 4 closeout — Stream A `G4 [x]`; CATALOG finalized; Decisions Log final entries

---

## Pricing numbers committed (tentative)

Per plan §P4 risk: pricing numbers committed in pricing-page surface as tentative ranges.

| Tier | Monthly | Annual | One-time |
|---|---|---|---|
| Free | $0 | — | — |
| Plus | $17/mo | $179/yr (saves $25) | — |
| Pro | $29/mo | $299/yr (saves $49) | — |
| Founding-Lifetime | — | — | $299 (cap 50) |

**These are tentative.** Pricing-tentative banner persistent on pricing-page. Final numbers lock at Stream D Phase 4 retro after 30-60 days of telemetry validates assumption M4 (Pro $25-35/mo WTP) + M9 (category WTP cap ~$35/mo). Owner can override these numbers; surface spec is structural, not number-locked.

---

## Risk log (updates from this batch)

| # | Risk | Status |
|---|---|---|
| R1-R24 | Prior risks | Unchanged |
| **R25 NEW** | **Pricing-tentative banner ignored / unread by users → post-launch price changes feel like surprise** | ACTIVE — mitigated by banner persistence + 60-day expectations-setting + email-on-pricing-change-if-it-happens. Acceptable cost of being honest about uncertainty. |
| **R26 NEW** | **Founding-Lifetime cap-fill race condition leaves user with refunded payment + no Lifetime + frustration** | ACCEPTED — mitigated by I-WR-4 server-side hard cap + factual refund message ("Cap filled while you were checking out — refunded. Pro pricing available."). UI cap-remaining is best-effort; small chance of brief stale display before cap-filled state propagates. |
| **R27 NEW** | **Sub-shape tailoring drift toward visible / coercive use** | ACTIVE (low) — mitigated by explicit "invisible-to-user" doctrine in surface specs + no telemetry-feedback-loop on sub-shape conversion (refuses "users with E-CHRIS sub-shape converted X% better — let's emphasize live-play copy more!" optimization that becomes coercive). |
| **R28 NEW** | **Equal-weight CSS measurement test brittleness** | ACTIVE (medium) — pixel-perfect CSS regression tests are notoriously brittle. Mitigation: tolerance threshold (e.g., ±2px) + visual-snapshot diff in addition to pixel measurement. Test target MPMF-G5-RL #6 spec at Gate 5. |

---

## Ratification checklist (for owner)

Before Batch 5 begins, owner should:

- [ ] Review `pricing-page.md` — particularly tier-card layout + FoundingMemberSection cap framing + FAQ entries + footer doctrine line
- [ ] Confirm tentative pricing numbers ($17 Plus / $29 Pro / $299 Founding-Lifetime) OR override
- [ ] Review `paywall-modal.md` — particularly equal-weight 2-button rule + H-SC01 defer-to-hand-end mechanism + 7-day cooldown duration
- [ ] Review `upgrade-prompt-inline.md` — particularly 6 suppression rules (especially returning-evaluator-2h-window) + sub-shape-tailored copy approach
- [ ] (Optional) Decide founding-member refund/transfer policy edge cases for pricing-page FAQ expansion in B5 if needed

Nothing locks until explicit ratification; amendable at B5 boundary.

---

## Change log

- 2026-04-25 — Session 7 Batch 4. Gate 4 paywall surfaces shipped — pricing-page (most complex) + paywall-modal (PaywallModal + Inline + Gate component) + upgrade-prompt-inline (proactive embed across 5 host contexts) + CATALOG updates. 14 of 16 MPMF-G4-* carry-forwards complete; 2 surfaces + closeout remaining in B5. Cross-surface S2-vs-S3 distinct patterns architectural invariant ratified. Tentative pricing committed with banner. Stream E Phase 1 unblocked. Zero code. Zero test regressions.
