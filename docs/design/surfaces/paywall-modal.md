# Surface — Paywall Modal

**ID:** `paywall-modal`
**Parent surface:** Modal overlay rendered by `PaywallGate` component on feature-gate triggers. Hosted by main-app routing layer, not bound to any single view.
**Product line:** Main app. Extension inherits paid state read-only; extension never renders its own paywall modal.
**Tier placement:** Free (only fires against free-tier users).
**Last reviewed:** 2026-04-25 (Gate 4 Batch 4)

**Code paths (future — Phase 5):**
- `src/components/ui/PaywallModal.jsx` (new — shared modal across Variations A/B/D from paywall-hit.md)
- `src/components/ui/PaywallFallbackInline.jsx` (new — Variation C inline fallback for deep-navigation gates)
- `src/components/ui/PaywallGate.jsx` (new — feature-gate wrapper with H-SC01 check + cooldown + variation routing)
- `src/hooks/usePaywallCooldown.js` (new — H-N07 7-day cooldown state management)
- `src/hooks/useDeferredPaywall.js` (new — H-SC01 hand-end-deferral mechanism)
- `src/utils/entitlement/paywallCopy.js` (new — CI-linted deterministic copy generator)
- `src/utils/entitlement/featureMap.js` (existing per entitlement-architecture.md — feature-to-tier mapping referenced)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #5 (no engagement-pressure) + #6 (flat-access pricing) + #7 (editor's-note tone) + #8 (no cross-surface contamination)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-01 (timer-urgency) + §MPMF-AP-02 (false social-proof) + §MPMF-AP-07 (loss-framing) + §MPMF-AP-09 (fake scarcity) + §MPMF-AP-12 (paywall mid-hand)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §PaywallGate component contract
- `docs/design/journeys/paywall-hit.md` (parent journey — this spec details the modal contract referenced there)
- `docs/design/surfaces/pricing-page.md` (View plans CTA destination)
- `docs/design/heuristics/poker-live-table.md` §H-SC01 (paywall-never-interrupts-active-work — LOAD-BEARING) + §H-N07 (no re-fire after dismissal)
- `docs/design/jtbd/domains/subscription-account.md` §SA-73 (hit-paywall-with-dignity — primary JTBD)

---

## Purpose

The paywall modal is the user-facing artifact of paywall-hit Variations A/B/D. (Variation C uses inline fallback rather than modal — separate component `PaywallFallbackInline.jsx` covered briefly in this spec.) Modal must implement the paywall-hit journey's contract: factually state what's gated, offer "View plans" + "Keep free" at equal visual weight, defer to hand-end on H-SC01 trigger, respect H-N07 7-day cooldown after dismissal.

This surface is where SA-73 (hit-paywall-with-dignity) becomes structural. Drift toward conventional SaaS paywall patterns (urgency, social proof, "Maybe later" pressure-buttons) is the most likely failure mode; CI-linted copy generator + per-line test assertions enforce.

Non-goals (explicit):
- **Not a tier-comparison surface.** Modal mentions Plus/Pro by name but does NOT show the full tier ladder. "View plans" routes to pricing-page.md for comparison.
- **Not a signup surface.** "View plans" → pricing-page → Stripe Checkout chain handles signup. Modal itself never collects email or payment info.
- **Not a feature-tour surface.** Modal explains the SPECIFIC gate that fired, not the entire paid-tier feature set.
- **Not a retention-offer surface.** No "Get 50% off Plus today!" promotions in the paywall flow. Discounts (if any) are pricing-page-level decisions, not per-trigger.
- **Not a multi-variation visual differentiator.** Variations A/B/D share the same modal component; copy props differ. Visual treatment is identical.

---

## JTBD served

**Primary:**
- **`JTBD-SA-73`** — Hit a paywall with dignity (load-bearing — modal is the dignified hit surface)

**Secondary:**
- **`JTBD-SA-72`** — Understand what's free, what's paid, and why (modal explicitly names what IS free + what's gated)

**Not served:**
- **`JTBD-SA-65`** — Tier comparison (pricing-page handles)
- **`JTBD-SA-71`** — Try before paying (Free tier already provides this; modal happens after free value experienced)

---

## Personas served

**Primary:**
- **Free-tier evaluator + free-tier-by-choice user** (any user who triggers a feature gate).

**Secondary:**
- **`post-session-chris`** + **`presession-preparer`** — most common contexts for L4 history-access trigger (Variation A).

**Excluded:**
- **`mid-hand-chris`** — H-SC01 binding: modal NEVER renders during active hand. Trigger fires → defer to hand-end.

---

## Anatomy

```
┌── PaywallModal (Variation A — history-access) ──────────────┐
│                                              ✕ close          │
│                                                                │
│  You're on the free tier.                                      │
│                                                                │
│  Current-session details are always free. Prior sessions      │
│  unlock with Plus.                                             │
│                                                                │
│                                                                │
│   [ View plans ]                          [ Keep free ]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌── PaywallModal (Variation B — usage-threshold) ─────────────┐
│                                              ✕ close          │
│                                                                │
│  You've used 3 of 3 deep analyses this session.                │
│                                                                │
│  Plus unlocks unlimited deep analyses. Quotas reset each       │
│  new session.                                                  │
│                                                                │
│                                                                │
│   [ View plans ]                          [ Keep free ]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌── PaywallModal (Variation D — session-close → next-open) ───┐
│                                              ✕ close          │
│                                                                │
│  This session closed earlier today.                            │
│                                                                │
│  Reopening prior sessions requires Plus. Your data stays       │
│  preserved either way.                                         │
│                                                                │
│                                                                │
│   [ View plans ]                          [ Keep free ]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Modal contract (shared across A/B/D)

- **Title:** variation-specific factual statement of state. NEVER "Upgrade now!" or "Pro feature locked!" framing.
- **Body:** 1-2 lines factual. Names tier (Plus or Pro) + what IS free + what unlocks + reset behavior (where applicable).
- **2 buttons at equal visual weight:**
  - `[ View plans ]` — routes to pricing-page.md.
  - `[ Keep free ]` — dismisses modal; user stays on current view.
- **Equal-weight rule:** same width, same height, same padding, same font weight, same color scheme. The ONLY tonal difference may be primary-vs-secondary surface treatment per design-system convention; both buttons remain ≥44×44 DOM px and visually weighted equivalently. Test target MPMF-G5-RL #6.
- **No "Maybe later" button.** Implies "you should decide now"; refused.
- **No pre-selection / focus on "View plans".** Keyboard tab order: ✕ close → View plans → Keep free; no auto-focus on any button.
- **No countdown / urgency / scarcity framing.** No timer, no "3 days remaining", no "limited offer".
- **No social proof.** No "Join 2,400 players who upgraded".
- **No emotional framing.** No "Don't miss out!" / "Take your game to the next level!" / "Unlock your potential!".
- **Dismissal behavior:** ✕ / `[ Keep free ]` / Escape key — all dismiss; H-N07 cooldown writes (7-day no-re-fire on same surface + same trigger combination).

### Modal sizing + positioning

- **Centered modal** on wide viewport (≥768px); bottom-sheet on narrow viewport (<768px) per existing modal convention.
- **Max-width: 480px** on wide; full-width on narrow.
- **Backdrop:** semi-transparent overlay; tap-outside-modal does NOT dismiss (prevents accidental dismissal when user is reaching for ✕). Escape key dismisses.
- **Animation:** 150ms fade-in from below (bottom-sheet) or center (wide); no aggressive entrance animation. Exit also 150ms fade.

### Variation C inline fallback — `PaywallFallbackInline`

Distinct component from PaywallModal. Renders inline when user navigates INTO a fully-paid surface (e.g., `/anchor-library` for free-tier user). Shape:

```
┌── Anchor Library is a Pro feature ──────────────────────────┐
│                                                              │
│  Preview:                                                    │
│  ┌─ EAL-SEED-01 — Nit overfold scare-river ───────────────┐ │
│  │  [static preview of an anchor card — illustrative]     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  See how anchors work in the full library with Pro.         │
│                                                              │
│   [ Unlock Anchor Library (Pro) ]    [ Back to Settings ]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Inline fallback contract:**
- Renders in place where the gated view's content would have rendered. Header / nav remain accessible.
- **Static preview** of one representative artifact (e.g., one anchor card; one drill question; one game-tree node). Illustrative only — preview is visually distinct (e.g., subtle "Preview" watermark) so user knows it's not interactive.
- **2 buttons equal weight:** "Unlock [feature] (Pro)" → routes to pricing-page; "Back to [previous surface]" → routes back via navigation history.
- No modal overlay; no backdrop. User retains spatial context of where they are.
- No H-N07 cooldown applies (user can re-navigate to gated surface and see fallback again; not a coercive surface).

---

## State

### Hooks consumed

- `useEntitlement()` — for feature-access check via `hasAccessTo(feature)`.
- `useUI()` — for current screen + isHandInProgress() check.
- `usePaywallCooldown()` — checks if (surface × trigger) is in 7-day cooldown.
- `useDeferredPaywall()` — registers deferred paywall for hand-end firing.

### Trigger flow (in PaywallGate component, Phase 5)

```js
function PaywallGate({ feature, fallback, children }) {
  const { hasAccessTo } = useEntitlement();
  const { isHandInProgress } = useUI();
  const { isInCooldown } = usePaywallCooldown();
  const { registerDeferred } = useDeferredPaywall();

  if (hasAccessTo(feature)) return children;

  // user lacks access; would show paywall
  if (isInCooldown(feature)) return null;       // silent no-modal during cooldown

  if (isHandInProgress()) {                       // H-SC01: defer to hand-end
    registerDeferred(feature);
    return null;                                  // show silent toast at action site
  }

  return fallback;                                // shows PaywallModal or PaywallFallbackInline
}
```

### H-SC01 defer-to-hand-end mechanism

`useDeferredPaywall` hook:
- `registerDeferred(feature)` — stores `{ feature, triggeredAt }` in component-level queue.
- Subscribes to `handEnded` event (fired by reducer when hand resolves).
- On `handEnded`: pops deferred queue; if any items, fires the modal for the most-recent one (deferred modals don't stack; only one fires).
- Cleared if user navigates away from live-play surface before hand-end (the deferred trigger is contextual — user no longer "trying" the gated feature once they navigate away).

### H-N07 7-day cooldown

`usePaywallCooldown` hook:
- Reads from `settings.paywall.recentDismissals: Map<surfaceId+triggerType, ISO8601>`.
- `isInCooldown(feature)` returns `true` if dismissal timestamp for current (surface, trigger) is within 7 days.
- Dismissal writes new timestamp.
- Per-device storage; not synced across devices (Phase 1 local-only).
- 7-day default tunable via feature flag for Stream D experimentation.

### Telemetry events (consent-gated per CC-88)

- `paywall_shown` — properties: `variation`, `feature`, `surfaceId`, `triggerType`
- `paywall_dismissed` — properties: same + dismissal-mechanism (button/escape/x)
- `paywall_view_plans_clicked` — properties: same; logged before route to pricing-page
- `paywall_deferred_to_hand_end` — properties: feature, surfaceId
- `paywall_cooldown_blocked` — properties: feature, surfaceId, daysSinceLastDismiss

---

## Props / context contract

### `PaywallModal` props

- `variation: 'A' | 'B' | 'D'`
- `feature: string` (e.g., 'CROSS_SESSION_HISTORY')
- `triggerContext: object` (variation-specific data; e.g., `{ usageRemaining: 0, usageMax: 3 }` for B)
- `onDismiss: () => void` — fires H-N07 cooldown write + modal close
- `onViewPlans: () => void` — fires telemetry + routes to pricing-page

### `PaywallFallbackInline` props

- `feature: string`
- `previewSurface: ReactNode` (static preview component)
- `onUnlock: () => void` — routes to pricing-page
- `onBack: () => void` — routes back via nav history

### `PaywallGate` props

- `feature: string` (from FEATURE_TIER constant)
- `fallback?: ReactNode` (default: PaywallModal Variation A; can override per use-site)
- `children: ReactNode` — content to render when access granted

---

## Key interactions

1. **User performs action that triggers feature gate.** PaywallGate intercepts; runs cooldown check + H-SC01 check.
2. **Cooldown active:** PaywallGate returns null (gated surface stays gated, no modal). User can navigate elsewhere; "Plus required" indicator on gated rows still visible factually.
3. **H-SC01 active (hand in progress):** PaywallGate registers deferred; user sees silent neutral toast at action site ("Feature unlocks at hand-end — limit reached"). Modal does NOT render.
4. **Hand-end fires:** deferred queue pops; PaywallModal Variation B (or A/D as registered) renders.
5. **Modal renders.** Title + body factual. 2 equal-weight buttons.
6. **User taps `[ Keep free ]` / ✕ / Escape:** dismissal fires `onDismiss` → cooldown write → modal close → user back on prior view.
7. **User taps `[ View plans ]`:** telemetry event → routes to pricing-page.md → user evaluates tiers → may convert via Stripe or return to free.
8. **Variation C (inline fallback):** user navigates to fully-paid surface; PaywallFallbackInline renders in place of view content. User sees preview + 2 buttons. Tap "Unlock" → pricing-page; Tap "Back" → navigates back via history.

### Keyboard / accessibility

- Modal is focus-trapped; tab cycles within modal.
- Escape dismisses (writes cooldown).
- Title element has `role="heading"` `aria-level="2"`.
- Buttons have descriptive `aria-label` ("View plans" / "Keep on free tier").
- Modal `role="dialog"` `aria-modal="true"` `aria-labelledby` pointing to title.
- Inline fallback uses `role="region"` with `aria-label="[Feature] paywall"`.

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-01** Timer-urgency banners. No countdown, no "limited time", no "ends soon" language.
- **MPMF-AP-02** Social-proof false counts. No "X players upgraded today" / "Join the pros" framing.
- **MPMF-AP-07** "Missing out" loss-framing. No "Don't miss out on...!" / "Without Plus you can't..." copy.
- **MPMF-AP-09** "Limited-time" fake scarcity. No "Get Plus before tomorrow!" / "Special offer" copy.
- **MPMF-AP-10** Pre-paywall friction. PaywallModal does not require email or signup; user can dismiss freely.
- **MPMF-AP-12** Paywall mid-hand. **Load-bearing refusal.** H-SC01 defer-to-hand-end mechanism enforces structurally.
- **MPMF-AP-13** Telemetry-consent-nag. Paywall-shown event respects consent gate; no separate consent prompt.

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines:

- **#1 Opt-in enrollment for data collection** — telemetry events respect consent gate per CC-88.
- **#2 Full transparency on demand** — modal states tier name + what IS free + what gates. No hidden fees in modal copy. Test: DOM contains required disclosure elements.
- **#3 Durable overrides on billing state** — N/A (informational gate; no billing action).
- **#4 Reversibility** — dismissal is reversible (user can navigate to pricing-page manually anytime). Test: during cooldown, navigate to Settings → Billing → View plans; assert no gate.
- **#5 No streaks / shame / engagement-pressure** — no urgency / no countdown / no streaks. Test: CI-grep refused strings in modal copy.
- **#6 Flat-access** — equal visual weight 2 buttons. **Load-bearing test target.** CSS measurement asserts identical width/height/color/border. Test: MPMF-G5-RL #6 specific assertion suite.
- **#7 Editor's-note tone** — CI-linted forbidden-string check on `paywallCopy.js` generator output. Test: `scripts/check-commerce-copy.sh`.
- **#8 No cross-surface contamination** — modal never renders on TableView during active hand. **Load-bearing.** Test: MPMF-G5-SC — mock mid-hand state + trigger paywall; assert no modal renders + neutral toast fires + deferred state set + modal renders post-hand.
- **#9 Incognito observation mode** — telemetry events respect per-category consent.
- **#10 No dark-pattern cancellation** — N/A directly (paywall-hit is conversion, not cancel).

---

## Cross-surface dependencies

- **`PaywallGate.jsx`** — wrapper that decides when to render this modal. Most active feature-gated surfaces wrap their gated content in PaywallGate.
- **`PricingView`** (S1) — destination of "View plans" CTA.
- **`SettingsView`** — alternative path; user can navigate Settings → Billing → View plans without ever triggering modal.
- **`PaywallFallbackInline`** — Variation C component; rendered inline by PaywallGate for full-surface gates.
- **`useUI`** — provides `isHandInProgress()` for H-SC01 check.
- **`EntitlementContext`** — provides feature-access check.
- **`paywallCopy.js`** — CI-linted copy generator; mirrors EAL `retirementCopy.js` pattern.
- **Toast container (`ToastContext`)** — Variation B mid-hand-deferred state surfaces neutral toast.
- **CI script `check-commerce-copy.sh`** — enforces forbidden-string list across paywall copy + cancellation + plan-change + upgrade-prompt.

---

## Known behavior notes

- **Cooldown is per (surface × trigger), not global.** User dismissing history-access paywall on SessionsView doesn't suppress depth-of-analysis paywall on Anchor Library. Different gates fire independently.
- **Dismissal during cooldown does NOT extend cooldown.** If user revisits gated surface during cooldown (no modal fires), their cooldown timer keeps ticking. Once 7 days pass, next gate trigger fires modal again.
- **"View plans" CTA leaving cooldown unaffected.** User who taps View plans, goes to pricing, returns without converting — modal doesn't re-fire on return because cooldown doesn't reset.
- **Variation B (usage-threshold) shows specific quota numbers.** "3 of 3" is factual; never animated countdown ("3... 2... 1!" forbidden). Numbers are rendered statically.
- **H-SC01 deferred-modal does NOT bypass cooldown.** When deferred modal fires post-hand, it still runs the cooldown check; if cooldown active, modal silently doesn't render.
- **Modal escapes when user navigates away from triggering surface.** If user dismisses modal and immediately navigates to pricing-page → comes back — they're on a different surface; modal won't auto-re-fire.
- **Telemetry properties are minimal.** No PII, no hand content, no specific session details; only feature name + variation + trigger type. Consent-gated per CC-88.
- **Backdrop tap does NOT dismiss.** Prevents accidental dismissal during user's reach-for-✕ action. Only explicit dismissal counts.
- **Animation timing.** 150ms fade is intentional — quick but not jarring. No bounce / scale effects (would feel coercive).

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [PWMODAL-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `PaywallModal.test.jsx` — variations A/B/D render correctly; 2 buttons equal weight (CSS regression); ✕ + escape + Keep free dismiss; View plans routes.
- `PaywallFallbackInline.test.jsx` — Variation C inline render; preview shown; 2 buttons equal weight; back navigation works.
- `PaywallGate.test.jsx` — access-granted renders children; access-denied + cooldown-active returns null; access-denied + isHandInProgress=true defers; access-denied + neither = renders fallback.
- `useDeferredPaywall.test.js` — register, hand-end fires, queue clears on nav-away.
- `usePaywallCooldown.test.js` — 7-day window correct; per-(surface, trigger) keying; cooldown writes on dismissal.
- `paywallCopy.test.js` — generator outputs per variation; CI-grep forbidden strings.

### Integration tests (Phase 5)

- `PaywallModal.e2e.test.jsx` — full Variation A flow: SessionsView → tap prior session → modal → dismiss → cooldown active → re-tap = no modal.
- `PaywallModalDeferral.e2e.test.jsx` — H-SC01: mid-hand quota exhaustion → no modal + neutral toast → end hand → modal fires.
- `PaywallFallbackInline.e2e.test.jsx` — navigate to /anchor-library as free user → inline fallback rendered.
- Red-line #6 assertion (MPMF-G5-RL): CSS measurement verifies button equal weight.
- Red-line #8 assertion (MPMF-G5-SC): mid-hand state + paywall trigger = no modal + deferred state + post-hand modal.

### Visual verification

- Playwright MCP 1600×720 screenshot, 5 scenarios:
  1. PaywallModal Variation A (history-access).
  2. PaywallModal Variation B (usage-threshold with "3 of 3" quota).
  3. PaywallModal Variation D (session-close → next-open).
  4. PaywallFallbackInline Variation C (Anchor Library fallback with preview).
  5. Mid-hand neutral toast (Variation B deferred state).

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S2-VARIATION-A`
- `EVID-PHASE5-MPMF-S2-VARIATION-B`
- `EVID-PHASE5-MPMF-S2-VARIATION-D`
- `EVID-PHASE5-MPMF-S2-INLINE-FALLBACK`
- `EVID-PHASE5-MPMF-S2-MID-HAND-TOAST`

---

## Phase 5 code-path plan

**New files (~7):**
1. `src/components/ui/PaywallModal.jsx`
2. `src/components/ui/PaywallFallbackInline.jsx`
3. `src/components/ui/PaywallGate.jsx`
4. `src/hooks/usePaywallCooldown.js`
5. `src/hooks/useDeferredPaywall.js`
6. `src/utils/entitlement/paywallCopy.js`
7. `scripts/check-commerce-copy.sh` (consolidated CI-lint script for cancellation + plan-change + paywall + upgrade-prompt)

**Amended files (~3):**
- `src/reducers/uiReducer.js` — `handEnded` event added if not present; deferred-paywall hook subscribes.
- `src/utils/telemetry/eventSchema.js` — paywall events added.
- `src/components/views/*` — wrap gated content in PaywallGate at use-sites (SessionsView prior-session rows, deep-analysis surfaces, anchor library route, etc.).

---

## Change log

- 2026-04-25 — v1.0 authored as Gate 4 Batch 4 artifact (MPMF-G4-S2). Detailed surface contract referenced by paywall-hit journey (J2). PaywallModal + PaywallFallbackInline + PaywallGate component contracts + H-SC01 defer-to-hand-end mechanism + H-N07 7-day cooldown spec + 10 red-line compliance with per-line test target + Phase 5 code-path plan ~7 new files. Equal-weight 2-button CSS measurement test (#6 load-bearing). Mid-hand defer-and-fire flow (#8 + H-SC01 load-bearing). Zero code changes (surface-spec only).
