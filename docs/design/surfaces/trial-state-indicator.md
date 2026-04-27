# Surface — Trial State Indicator

**ID:** `trial-state-indicator`
**Parent surface:** Inline chip embedded in app navigation/chrome. Renders within the existing top-nav region.
**Product line:** Main app. Extension reads tier state via WebSocket bridge but renders its own (separate) state-indicator per ignition-poker-tracker conventions; this spec covers main-app only.
**Tier placement:** Free+ (universal — all tiers see indicator; copy adapts to tier).
**Last reviewed:** 2026-04-25 (Gate 4 Batch 5)

**Code paths (future — Phase 5):**
- `src/components/ui/TrialStateIndicator.jsx` (new — chip rendered in main-nav)
- `src/components/AppRoot.jsx` (existing — gains TrialStateIndicator slot in nav region)
- `src/hooks/useTrialStateIndicator.js` (new — composite visibility + content hook)
- `src/utils/entitlement/indicatorCopy.js` (new — CI-linted deterministic copy generator)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #2 (transparency) + #5 (no engagement-pressure) + #7 (editor's-note tone) + #8 (no cross-surface contamination)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-01 (timer-urgency) + §MPMF-AP-12 (paywall mid-hand)
- `docs/design/surfaces/billing-settings.md` (S5 — destination of indicator tap)
- `docs/design/surfaces/pricing-page.md` (S1 — alternative destination if user is free-tier)
- `docs/design/heuristics/poker-live-table.md` §H-PLT01 (sub-second glanceability) + §H-SC01 (paywall-never-interrupts-active-work) + §H-SC02 (trial-state-legible-outside-settings — LOAD-BEARING here)
- `docs/design/jtbd/domains/subscription-account.md` §SA-72 (understand-what's-free-what's-paid-and-why)
- `docs/design/personas/situational/mid-hand-chris.md` (binding constraint — never interrupt during active hand)

---

## Purpose

A persistent, ≤150ms-glanceable chip in the app's main navigation that tells the user their current tier state at any moment. Per H-SC02 (trial-state-legible-outside-settings — LOAD-BEARING for this surface): a user must be able to verify their tier in ≤ 2 taps from anywhere. This indicator is the **canonical 1-tap path** to BillingSettings + the **0-tap glanceable** signal of tier state.

This is the simplest commerce surface in Gate 4 — minimal anatomy, minimal interaction. But it's load-bearing for two key heuristics + two red lines:

- **H-PLT01:** ≤150ms readable on any surface (read-and-go)
- **H-SC02:** ≤ 2 taps from anywhere to deep-dive billing
- **Red line #2:** transparency on demand (state always visible)
- **Red line #8:** no cross-surface contamination (suppressed during live play to avoid distraction; not removed entirely — adapts)

Non-goals (explicit):
- **Not a paywall trigger.** Tapping the indicator NEVER triggers a paywall modal. It routes to BillingSettings or pricing-page (depending on tier) — surfaces that show tier info, not gates.
- **Not a CTA banner.** No "Upgrade!" copy. No urgency. No animation. Indicator is informational.
- **Not a notification.** No badge counters / red dots / "needs attention" indicators (with one exception: card-decline grace state shows a subtle ⚠️ icon — see §State below).
- **Not a streak / engagement indicator.** Refuses any "X days as Pro!" / streak / loyalty framing.
- **Not a marketing surface.** Indicator copy is purely factual tier name (and minimal status modifiers).

---

## JTBD served

**Primary:**
- **`JTBD-SA-72`** — Understand what's free, what's paid, and why (load-bearing — primary purpose)

**Secondary:**
- **`JTBD-SA-78`** — Know when I'll be billed and for how much (indirect — chip routes to BillingSettings where Next charge card lives)

**Not served:**
- Anything else. This surface has narrow scope by design.

---

## Personas served

**Primary:**
- **All personas, all tiers.** Universal indicator.

**Secondary specifics:**
- **Free-tier evaluator** — sees "Free" chip; tap routes to pricing-page (alternative destination — see §State).
- **Paid users** — see tier name chip ("Plus" / "Pro" / "Founding"); tap routes to BillingSettings.

**Behavior modifications:**
- **`mid-hand-chris`** — chip remains visible BUT becomes lower-opacity / minimum-visual-weight during active hand (per red line #8 — does not interrupt + does not vanish). Tap during active hand opens deferred indicator action (defer to hand-end OR no-op if user just glances away).
- **`presession-preparer`** — chip visible normally; presession context doesn't suppress this indicator (factual tier display is informational, not commerce intrusion).

---

## Anatomy

```
┌── Main app navigation (top region) ───────────────────────────────────┐
│                                                                          │
│   [App logo/menu]    ...other nav items...           [tier-chip]        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

Tier chip variants (rendered at standard size, top-right):

  ┌───────┐
  │ Free  │       Free tier
  └───────┘

  ┌───────┐
  │ Plus  │       Plus tier
  └───────┘

  ┌──────┐
  │ Pro  │        Pro tier
  └──────┘

  ┌────────┐
  │ Pro ⚠️ │       Pro tier with card-decline grace active
  └────────┘

  ┌────────────────┐
  │ Pro · Cancelling │   Pro tier, cancellation grace active
  └────────────────┘

  ┌──────────┐
  │ Lifetime │     Founding-Lifetime tier
  └──────────┘
```

### Chip contract

- **Position:** top-right of main nav region. Persistent across all routed views (TableView / SessionsView / SettingsView / PricingView / etc.).
- **Size:** standard chip — approximately 64-96px wide × 28-32px tall depending on text content. ≥44 DOM-px touch target via padding/margin (chip itself smaller than touch target by design — visual-vs-tappable distinction).
- **Glanceability target:** ≤150ms readable per H-PLT01. Single word for tier name; single status modifier max ("· Cancelling" / "⚠️").
- **Color treatment:** muted background (matches secondary-button tier in design system); body text standard weight (NOT bold; not all-caps for emphasis). Background is subtle — designed to be present but not attention-grabbing.
- **Tap target:** entire chip is tappable. Tap routes to destination per tier state (see §State).
- **Accessibility:** `<button>` element with `aria-label` like "Tier: Pro. Tap to manage billing." for screen readers. Chip has `role="status"` so changes announce on state shifts (e.g., grace-period activation).

### Variant matrix

| Tier state | Display text | Status icon | Tap destination |
|---|---|---|---|
| Free | "Free" | none | pricing-page (S1) |
| Plus | "Plus" | none | BillingSettings (S5) |
| Pro | "Pro" | none | BillingSettings (S5) |
| Founding-Lifetime | "Lifetime" | none | BillingSettings (S5) |
| Any paid + card-decline grace | "{tier} ⚠️" | ⚠️ inline | BillingSettings (S5) — scrolled to PaymentMethodCard |
| Any paid + cancellation grace | "{tier} · Cancelling" | none | BillingSettings (S5) |
| Any paid + pending plan-change | "{tier}" (no modifier in chip) | none | BillingSettings (S5) — pending indicator visible there |

**Rationale for icons:**
- ⚠️ on card-decline: surfaced because user action is needed within grace period to maintain access. Not animated; not red. Subtle attention signal.
- "· Cancelling" status text instead of icon: more informative; no urgency framing.
- Pending plan-change NOT shown in chip: would clutter glanceability; full info available in BillingSettings on tap.

### H-SC01 mid-hand behavior

During active hand (`isHandInProgress() === true`):

- Chip remains visible at lower opacity (e.g., 60%) — does not vanish (red line #8: no cross-surface contamination spirit applies BOTH ways — don't intrude AND don't withhold info).
- Chip remains tappable but with deferred-action behavior:
  - Tap during active hand → no immediate route; queue intent + neutral toast: "Tier info opens at hand-end."
  - At hand-end: queued routing fires (opens BillingSettings or pricing-page).
- ⚠️ icon (card-decline) NEVER animates / pulses / draws attention during live hand.
- "· Cancelling" status modifier rendered in chip during live hand same as off-table.

**Rationale:** mid-hand-chris persona's 1.5s glance budget — chip presence at 60% opacity is information without distraction; tappable so user can express intent; deferred so action doesn't disrupt hand. Refuses both "remove indicator entirely during hand" (loses transparency) and "intrusive modal during hand" (loses focus).

### Newcomer behavior

For newcomers below the 25-hand threshold (`userHandsSeenCount < 25`):

- Chip displays "Free" exactly the same as any free-tier user.
- Tap routes to pricing-page same as any free user.
- No special newcomer-suppression. Tier transparency applies regardless of newcomer state — knowing what's free vs paid is part of orientation.

This differs from upgrade-prompt-inline (S3) which DOES suppress for newcomers — because upgrade-prompt is conversion-pressure and trial-state-indicator is informational.

---

## State

### Hook — `useTrialStateIndicator()`

```js
const {
  display,            // 'Free' | 'Plus' | 'Pro' | 'Lifetime'
  statusModifier,     // null | '· Cancelling' | '⚠️'
  tapDestination,     // 'pricing-page' | 'billing-settings' | 'billing-settings-payment'
  ariaLabel,          // 'Tier: Pro. Tap to manage billing.'
  isMidHandDeferred,  // boolean (controls 60% opacity + deferred routing)
} = useTrialStateIndicator();
```

Reads from:
- `EntitlementContext` — current tier
- `BillingContext` — cancellation state, card-decline state
- `useUI()` — `isHandInProgress()`

### Routing destinations

- **Free tier** → `SCREEN.PRICING` (pricing-page S1) — natural next step is to see plans.
- **Paid tier (active or cancelled-grace or pending)** → `SCREEN.SETTINGS` with hash anchor `#billing` — navigates to SettingsView and scrolls to BillingSettings card.
- **Paid tier with card-decline grace** → `SCREEN.SETTINGS#billing#payment-method` — navigates + scrolls + focuses PaymentMethodCard within BillingSettings.

### Telemetry events (consent-gated)

- `tier_indicator_tapped` — properties: tier, statusModifier, midHandDeferred (boolean), routedTo
- `tier_indicator_state_changed` — fires once when chip state transitions (e.g., cancellation grace activates) — diagnostic; helps validate state-clear discipline (red line spirit + R-8.1 state-symmetry from sidebar program)

---

## Props / context contract

### `TrialStateIndicator` props

None — self-contained chip. Reads from contexts.

### Context consumed

- `useEntitlement()` — current tier
- `useBillingSettings()` (or sub-selectors) — cancellation/card-decline state
- `useUI()` — `isHandInProgress()` for mid-hand state
- `useUI()` — for routing dispatch on tap

---

## Key interactions

1. **Mount.** Read entitlement + billing state; render chip with appropriate display + statusModifier.
2. **State change.** Cancellation activates → chip flips to "{tier} · Cancelling" without animation. Card decline → chip adds ⚠️ icon. Plan upgrade → chip flips to new tier name. All transitions are synchronous; no fade/slide animation.
3. **Tap (off-table).** Routes to destination per `tapDestination`. Telemetry event fires. User lands on new view.
4. **Tap (mid-hand).** Queues intent; shows neutral toast "Tier info opens at hand-end."; at hand-end, queued routing fires automatically. User can dismiss queued action via cancel-toast affordance or by completing the hand.
5. **Visual transition mid-hand → off-table.** Opacity smoothly transitions from 60% to 100% on hand-end. 200ms transition; not flashy.
6. **Mid-hand visual.** 60% opacity + same content. Not removed; not greyed out so much that user can't read it; not animated.
7. **Edge case: tier change during active hand.** E.g., card-decline grace expires mid-hand and tier auto-degrades to free. Chip updates synchronously; no notification fires; user sees the change reflected on next glance. (No proactive disruption — H-SC01 binding.)

### Keyboard / accessibility

- `<button>` element with `aria-label` describing tier + tap action.
- `aria-live="polite"` on chip so screen readers announce state changes (e.g., grace activation) without interrupting.
- Tab order: chip is one of the last items in main nav (after primary nav buttons).
- Keyboard activation (Enter/Space) routes same as tap.
- During mid-hand state, `aria-disabled` is NOT set (chip is still keyboard-activatable; deferred-routing applies regardless of input mechanism).

---

## Anti-patterns refused at this surface

- **MPMF-AP-01** Timer-urgency banners. Card-decline grace shows ⚠️ icon — NOT a countdown. Detail is in BillingSettings ("Update by Feb 4, 2026 to avoid losing access" — factual deadline, not animated countdown).
- **MPMF-AP-02** Social-proof false counts. N/A (single-user indicator).
- **MPMF-AP-03** Streak celebrations. NO "X days as Pro!" / "You've been here Y months!" framing. Refused.
- **MPMF-AP-12** Paywall mid-hand. Chip itself doesn't paywall, but its tap-routing during active hand defers per H-SC01 (mid-hand deferred-routing).

**Surface-specific anti-pattern refusals:**
- ✗ Animated chip (pulsing / blinking on grace-period activation) — refused. State change is synchronous, no draw-attention animation.
- ✗ Red color on cancellation indicator — refused. Cancellation is user choice; no shame/warning color treatment.
- ✗ Removing chip during live play — refused. Transparency principle requires persistent visibility (with opacity adjustment for context).
- ✗ Tap-to-paywall — refused. Tap routes to informational destinations (BillingSettings or pricing-page); never directly opens paywall modal.

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines:

- **#1 Opt-in enrollment for data collection** — telemetry events respect consent gate.
- **#2 Full transparency on demand** — **LOAD-BEARING.** Tier always visible without further navigation (chip is glanceable from any view). Test: render any view in test; assert chip is in DOM with current tier text.
- **#3 Durable overrides** — N/A (informational; not actionable for billing-state changes).
- **#4 Reversibility** — N/A (no commerce action taken from this surface).
- **#5 No streaks / shame / engagement-pressure** — chip never shows duration / streaks / pressure framing. Test: CI-grep refused strings; visual-regression test confirms no animation.
- **#6 Flat-access** — chip uses muted styling (does not visually rank tier as "premium" or "basic" via color/treatment). Cancellation-grace visual treatment is factual ("· Cancelling" text) not punitive (red color refused).
- **#7 Editor's-note tone** — minimal copy by design; CI-linted via `indicatorCopy.js` (very small surface to lint).
- **#8 No cross-surface contamination** — **LOAD-BEARING.** Chip persists during live play but at 60% opacity + deferred-routing on tap. Test: H-SC01 assertion — mock active-hand state + tap chip + assert no immediate route + neutral toast fires + queued action.
- **#9 Incognito observation mode** — telemetry events respect per-category consent.
- **#10 No dark-pattern cancellation** — chip's cancellation-grace treatment ("· Cancelling") is factual; tap routes to BillingSettings showing factual cancelled-grace state with Reactivate option (no retention dark patterns at indicator level).

---

## Cross-surface dependencies

- **`AppRoot`** (Phase 5) — adds TrialStateIndicator slot in main-nav region.
- **`SettingsView` (S5 BillingSettings)** — primary tap destination for paid users.
- **`PricingView` (S1)** — primary tap destination for free users.
- **`useUI()`** — routing + isHandInProgress() check.
- **`EntitlementContext`** — tier source.
- **`BillingContext`** (or sub-context) — cancellation + card-decline state.
- **Toast container** — neutral mid-hand-deferred toast.
- **`indicatorCopy.js`** — CI-linted minimal copy generator.

---

## Known behavior notes

- **Persistent across all routed views.** Including TableView during active hand (60% opacity), HandReplayView, AnalysisView, etc. Removed only in surfaces where main nav itself is removed (e.g., full-screen modal overlays).
- **No first-launch onboarding tour for the chip.** It just appears. User discovers via natural glancing. No tooltip / arrow / "click here to manage billing" coachmark.
- **Edge case: brand new install with anonymous user.** Chip displays "Free" from first launch (via Q8=B / migration-seed default). No special "uninitialized" state.
- **Card-decline grace ⚠️ icon — minimum viable warning.** Single emoji; no animation; no color change; subtle attention signal. Decoded by users as "something needs attention but it's not urgent". Tap reveals full detail.
- **Cancellation-grace "· Cancelling" status modifier** — clearer than icon for this state because cancellation is explicit user action; status confirms their state. Avoids ambiguity vs. card-decline ⚠️.
- **Multi-state precedence** (rare): if both card-decline AND cancellation-grace are active simultaneously, chip shows "{tier} · Cancelling ⚠️" — both modifiers visible. BillingSettings on tap shows full state.
- **No badge counter on chip.** "3 items need attention!" red-dot counter pattern refused — would create urgency anxiety.
- **State-clear discipline.** When tier changes (cancellation completes → tier degrades to free), chip updates synchronously via reducer hydration. No stale state. R-8.1 cross-store invariant analog applies.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [TSI-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `TrialStateIndicator.test.jsx` — renders correct text per tier; status modifier per state; tap fires correct routing.
- `useTrialStateIndicator.test.js` — composite hook returns correct values per (tier, cancellation, card-decline, mid-hand) state matrix.
- `indicatorCopy.test.js` — generator outputs; CI-grep refused strings.

### Integration tests (Phase 5)

- `TrialStateIndicator.persistence.e2e.test.jsx` — chip visible across all routed views (TableView / SessionsView / SettingsView / etc.).
- `TrialStateIndicator.midHand.e2e.test.jsx` — mid-hand state shows 60% opacity; tap defers; hand-end fires queued routing.
- `TrialStateIndicator.stateChange.e2e.test.jsx` — simulate cancellation activation; assert chip flips to "· Cancelling" without animation.
- `TrialStateIndicator.cardDecline.e2e.test.jsx` — simulate card decline; assert ⚠️ icon appears; tap routes to PaymentMethodCard within BillingSettings.
- Red-line #2 transparency assertion (MPMF-G5-RL): chip in DOM on every routed view.
- Red-line #8 H-SC01 assertion (MPMF-G5-SC): mid-hand tap → no route + neutral toast + post-hand queued route.

### Visual verification

- Playwright MCP 1600×720 screenshot, 6 scenarios:
  1. Free chip in nav.
  2. Plus chip in nav.
  3. Pro chip in nav (active state).
  4. "Pro · Cancelling" chip in nav.
  5. "Pro ⚠️" chip in nav (card-decline grace).
  6. Mid-hand state — chip at 60% opacity in TableView nav.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S4-FREE`
- `EVID-PHASE5-MPMF-S4-PRO`
- `EVID-PHASE5-MPMF-S4-CANCELLING`
- `EVID-PHASE5-MPMF-S4-CARD-DECLINE`
- `EVID-PHASE5-MPMF-S4-MID-HAND-OPACITY`
- `EVID-PHASE5-MPMF-S4-LIFETIME`

---

## Phase 5 code-path plan

**New files (~3):**
1. `src/components/ui/TrialStateIndicator.jsx`
2. `src/hooks/useTrialStateIndicator.js`
3. `src/utils/entitlement/indicatorCopy.js`

**Amended files (~2):**
- `src/components/AppRoot.jsx` — add TrialStateIndicator slot in main-nav region.
- `src/utils/telemetry/eventSchema.js` — indicator events.

---

## Change log

- 2026-04-25 — v1.0 authored as Gate 4 Batch 5 artifact (MPMF-G4-S4). Persistent chip in main-nav region. ≤150ms-glanceable per H-PLT01. ≤2-tap to BillingSettings per H-SC02 LOAD-BEARING. 60% opacity + deferred routing during active hand per H-SC01 LOAD-BEARING. Status modifiers: "· Cancelling" + ⚠️ for card-decline grace; multi-state precedence handled. NO animations / NO badge counters / NO red color treatment / NO streak framing. 10 red-line compliance with per-line test target + Phase 5 code-path plan ~3 new files. Free tier routes to pricing-page; paid tiers route to BillingSettings (with hash anchor for card-decline → PaymentMethodCard direct-scroll). Zero code changes (surface-spec only).
