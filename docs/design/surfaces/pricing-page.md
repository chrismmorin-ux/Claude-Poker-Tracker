# Surface — Pricing Page

**ID:** `pricing-page`
**Parent surface:** Top-level routed view + embedded section in `SettingsView` (linked from BillingSettings + multiple paywall trigger paths).
**Product line:** Main app. Phase 1 covers main-app tiers only (Free / Plus / Pro / Founding-Lifetime). Ignition SKU section deferred per Q3=C; placeholder reserved for Phase 2+.
**Tier placement:** Free+ (universal — visible to evaluators, free-tier users, paid users; content adapts to current tier state).
**Last reviewed:** 2026-04-25 (Gate 4 Batch 4)

**Code paths (future — Phase 5):**
- `src/components/views/PricingView/PricingView.jsx` (new — top-level routed view at `SCREEN.PRICING`)
- `src/components/views/PricingView/TierCard.jsx` (new — single tier card; 4 instances rendered)
- `src/components/views/PricingView/FeatureComparisonTable.jsx` (new — side-by-side feature matrix)
- `src/components/views/PricingView/FoundingMemberSection.jsx` (new — cohort-cap section)
- `src/components/views/PricingView/PricingFAQ.jsx` (new — FAQ accordion)
- `src/components/views/SettingsView/BillingSettings.jsx` (existing — gains "View plans" link to PricingView)
- `src/hooks/usePricingPageView.js` (new — state for FAQ expansion + sub-shape tailoring)
- `src/utils/entitlement/founderCapStatus.js` (new — fetches current founding-member count from server / IDB cache)
- `src/constants/pricingTiers.js` (new — frozen tier definitions: id / displayName / monthlyPrice / annualPrice / features)
- `src/utils/entitlement/pricingCopy.js` (new — CI-linted deterministic generator for tier copy + FAQ + founding-member section)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #2 (transparency) + #5 (no engagement-pressure) + #6 (flat-access pricing) + #7 (editor's-note tone)
- `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q4 ($299 lifetime cap 50) + §Q5 (session-scoped free)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-01 (timer-urgency) + §MPMF-AP-02 (false social-proof) + §MPMF-AP-09 (fake scarcity) + §MPMF-AP-16 (deceptive proration)
- `docs/projects/monetization-and-pmf/paywall-spectrum.md` §5 compatible bundles (α + δ recommended under Q1=A)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Feature map + tier ordering
- `docs/projects/monetization-and-pmf/assumption-ledger.md` §M4 (Pro WTP $25-35/mo) + §M8 (founding-member outreach yield) + §M9 (category WTP cap)
- `docs/design/jtbd/domains/subscription-account.md` §SA-65 (tier comparison) + §SA-71 (try-before-paying) + §SA-72 (understand-free-vs-paid)
- `docs/design/journeys/evaluator-onboarding.md` (sub-shape attribute consumed for tailored copy)
- `docs/design/journeys/paywall-hit.md` (paywall modal links here via "View plans" CTA)
- `docs/design/journeys/plan-change.md` (PlanSelectModal links here for tier reference info)
- `docs/design/journeys/cancellation.md` (post-cancel state may surface "View plans" link for re-subscribe path; respects ≥90-day cooldown)
- `docs/design/heuristics/poker-live-table.md` §H-PLT01 (sub-second glanceability) + §H-SC02 (trial-state-legible)

---

## Purpose

The pricing page is the public commercial artifact — the surface that translates the project's doctrine into transparent commerce decisions a user can make calmly. It is the most-visited paid-context surface (every evaluator who clicks "View plans" arrives here; every existing user reviewing tier options arrives here; every founding-member outreach link points here).

Per Q1=A doctrine scope, this surface is the load-bearing test of whether the autonomy contract scales to commerce. Bundle α + δ are the authoritative tier shape (per paywall-spectrum.md). Founding-Lifetime cap-50 is structural scarcity, not coercive (per Q4=A).

The page must serve four distinct cognitive states with the same content:
- **Evaluator (E-CHRIS / E-SCHOLAR / E-IGNITION sub-shapes)** — comparing the app's offering to category alternatives (GTO Wizard / Upswing / Hand2Note / etc.).
- **Free-tier user** — considering upgrade after experiencing free value.
- **Paid user** — reviewing current tier vs alternatives (potential plan-change J4 entry).
- **Founding-member** — verifying their cohort status + remaining cap count.

All four see the same page; tailoring is via small contextual elements (current-tier indicator, sub-shape-aware feature emphasis), never via separate URLs or hidden sections.

Non-goals (explicit):
- **Not a checkout surface.** Tapping "Get Pro" routes to Stripe Checkout (or equivalent payment processor flow); pricing-page itself never collects payment. Separation prevents pricing-page from becoming a high-friction conversion surface.
- **Not a marketing landing page.** No hero video, no "transform your game" pitch, no testimonials. Pricing-page is post-discovery; user has already decided to evaluate the app.
- **Not a plan-change-execution surface.** Plan-change is its own journey (J4) with PlanSelectModal + PlanChangeConfirmModal. Pricing-page may link TO plan-change for paid users but does NOT execute the change inline.
- **Not a comparison-with-competitors surface.** No "vs GTO Wizard" tables. Doctrine refuses competitive disparagement; product stands on its own factual description.

---

## JTBD served

**Primary:**
- **`JTBD-SA-65`** — Tier comparison before purchase (load-bearing — primary content of the page is the comparison)
- **`JTBD-SA-71`** — Try the product before paying (free tier card explicitly named first; "Continue with Free" affordance equal-weight to paid CTAs)
- **`JTBD-SA-72`** — Understand what's free, what's paid, and why (feature comparison table is the most explicit instance of this JTBD)

**Secondary:**
- **`JTBD-SA-75`** — Evaluate the sidebar separately from the main app (Phase 2+ — Ignition section deferred; placeholder copy explains "Online sidebar coming Phase 2; subscribe for updates")
- **`JTBD-SA-78`** — Know when I'll be billed and for how much (each tier card shows monthly / annual prices factually + "billed monthly" or "billed yearly — saves $X" disclosure)

**Not served:**
- **`JTBD-SA-74`** — Cancel without friction (separate journey; not on pricing-page)
- **`JTBD-SA-76`** — Switch between plan tiers (separate journey; pricing-page may link to plan-change but does not execute)
- **`JTBD-SA-77`** — Manage payment method (BillingSettings only)
- **`JTBD-CC-88`** — Honest telemetry (separate surface — telemetry-consent-panel)

---

## Personas served

**Primary:**
- **`evaluator`** in trial-first-session OR returning-evaluator state — the most common visitor cohort.
- **Any paying user** — existing customers reviewing tiers.

**Secondary:**
- **`chris-live-player`** (owner) — uses pricing-page for self-verification + walking-through with potential users.
- **`scholar-drills-only`** (Scholar persona) — sees the same tier ladder; "Plus" tier is their commercial fit per persona note.

**Explicitly excluded:**
- **`mid-hand-chris`** — pricing-page never auto-fires during live play. User can navigate there manually but H-SC01 ensures no proactive upgrade-prompt routes here mid-hand.
- **`newcomer-first-hand`** — newcomers see pricing-page on demand but no proactive routing happens until newcomer-hand-threshold (≥25 hands per EAL precedent) crossed.

---

## Anatomy

```
┌── Pricing — Choose what fits your game ─────────────────────────────────────┐
│                                                                              │
│  Current tier indicator (top-right): [ Free ] / [ Plus ] / [ Pro ] / etc.    │
│                                                                              │
│  ┌── Tier cards (4-up grid; stacks on narrow viewport) ───────────────────┐ │
│  │                                                                          │ │
│  │  ┌── Free ────┐  ┌── Plus ───────┐  ┌── Pro ────────┐  ┌── Founding ──┐ │ │
│  │  │            │  │               │  │               │  │  Lifetime    │ │ │
│  │  │   $0       │  │   $17/mo      │  │   $29/mo      │  │  $299 once   │ │ │
│  │  │            │  │   billed      │  │   billed      │  │  one-time    │ │ │
│  │  │            │  │   monthly     │  │   monthly     │  │  payment     │ │ │
│  │  │            │  │   $179/yr     │  │   $299/yr     │  │              │ │ │
│  │  │            │  │   saves $25   │  │   saves $49   │  │              │ │ │
│  │  │            │  │               │  │               │  │  Cap: 23 of  │ │ │
│  │  │            │  │               │  │               │  │  50 remaining│ │ │
│  │  │            │  │               │  │               │  │              │ │ │
│  │  │  · Hand    │  │  · All Free   │  │  · All Plus   │  │  · All Pro   │ │ │
│  │  │    entry   │  │  · Cross-     │  │  · Game tree  │  │  · Locked at │ │ │
│  │  │  · Live    │  │    session    │  │    deep       │  │    today's   │ │ │
│  │  │    exploit │  │    villain    │  │    analysis   │  │    feature   │ │ │
│  │  │    engine  │  │    tracking   │  │  · Exploit    │  │    set + all │ │ │
│  │  │  · End-of- │  │  · Full       │  │    Anchor     │  │    future    │ │ │
│  │  │    session │  │    history    │  │    Library    │  │    upgrades  │ │ │
│  │  │    recap   │  │  · Basic      │  │  · Calibration│  │              │ │ │
│  │  │  · Sample  │  │    drills     │  │    Dashboard  │  │              │ │ │
│  │  │    data    │  │               │  │  · Advanced   │  │              │ │ │
│  │  │    mode    │  │               │  │    drills     │  │              │ │ │
│  │  │            │  │               │  │  · Printable  │  │              │ │ │
│  │  │            │  │               │  │    Refresher  │  │              │ │ │
│  │  │            │  │               │  │               │  │              │ │ │
│  │  │ [ Continue │  │ [ Get Plus ]  │  │ [ Get Pro ]   │  │ [ Get        │ │ │
│  │  │   with     │  │               │  │               │  │   Lifetime ] │ │ │
│  │  │   Free ]   │  │               │  │               │  │              │ │ │
│  │  └────────────┘  └───────────────┘  └───────────────┘  └──────────────┘ │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ── Pricing-tentative note ──                                                │
│  These prices are tentative for the launch cohort. Final pricing locks       │
│  after our first 60 days of telemetry.                                       │
│                                                                              │
│  ── Detailed feature comparison ──                                           │
│  [ Show detailed feature comparison ▾ ]   (expander)                         │
│                                                                              │
│  ── Frequently asked questions ──                                            │
│  [ + ] Can I cancel anytime?                                                 │
│  [ + ] What happens to my data if I downgrade or cancel?                     │
│  [ + ] How does the Founding-Lifetime tier work?                             │
│  [ + ] What about the online (Ignition) sidebar?                             │
│  [ + ] What's collected for telemetry? Can I opt out?                        │
│  [ + ] Is there a free trial of paid tiers?                                  │
│  [ + ] How do I switch between paid tiers?                                   │
│                                                                              │
│  ── Footer ──                                                                │
│  These prices are in USD. Shown without sales tax (added at checkout where   │
│  applicable). Billing handled by Stripe.                                     │
│                                                                              │
│  No streaks. No guilt. Cancel in two taps.                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### TierCard component

Each of the 4 tier cards has the same structural template:

- **Tier name** (heading) — `Free` / `Plus` / `Pro` / `Founding Lifetime`. No "Most Popular" / "Best Value" / "Recommended" badges (MPMF-AP-02 refused).
- **Price** — `$0` / `$17/mo` / `$29/mo` / `$299 once`. Annual price shown as secondary line for Plus/Pro: "billed monthly" + "$179/yr saves $25" / "$299/yr saves $49". No fake discounts ("$49 → $29!" style refused per MPMF-AP-09).
- **Cap-remaining indicator** — Founding-Lifetime card only: "Cap: 23 of 50 remaining" (factual count). When cap fills, card shows "Cap reached" + "Get Lifetime" button disables; copy becomes "Founding-Lifetime is no longer available. Plus and Pro remain." NO "limited time!" urgency.
- **Feature list** — bullet list of what's included. Uses inheritance language: "All Free" + tier-specific additions. Factual feature names (e.g., "Cross-session villain tracking"); avoids aspirational ("Become a better player").
- **Primary CTA** — `[ Continue with Free ]` / `[ Get Plus ]` / `[ Get Pro ]` / `[ Get Lifetime ]`. ALL FOUR buttons at equal visual weight (same size, same color tone, no boost). Order: Free first (cheapest), Lifetime last (most committed).
- **Current-tier indicator** — if user's current tier matches this card, it shows "Your current tier" chip + the CTA changes to neutral text (e.g., "You're on Plus" — no tap action). Adjacent cards remain tappable for upgrade/downgrade routing to plan-change journey J4.

### Feature comparison table (collapsed by default)

`[ Show detailed feature comparison ▾ ]` expander reveals a wide table:

| Feature | Free | Plus | Pro | Founding |
|---|---|---|---|---|
| Hand entry | ● | ● | ● | ● |
| Live exploit engine | ● | ● | ● | ● |
| End-of-session recap | ● | ● | ● | ● |
| Sample data mode | ● | ● | ● | ● |
| Cross-session history | — | ● | ● | ● |
| Cross-session villain tracking | — | ● | ● | ● |
| Basic drills | — | ● | ● | ● |
| Game tree deep analysis | — | — | ● | ● |
| Exploit Anchor Library | — | — | ● | ● |
| Calibration Dashboard | — | — | ● | ● |
| Advanced drills | — | — | ● | ● |
| Printable Refresher | — | — | ● | ● |
| Future Pro upgrades | — | — | ● | ● |
| Locked at today's price + features | — | — | — | ● |
| Online sidebar (Phase 2+) | — | — | — | — |

Last row "Online sidebar (Phase 2+)" is row-spanning placeholder; entire row dashed. Footer note: "Online sidebar shipping in a later phase. Will be a separate add-on." NO link, NO email-capture. Q3=C deferral acknowledged factually.

### Founding-Lifetime cohort section

Below tier cards (or inline within Founding-Lifetime card; layout decision at Phase 5):

```
┌── Founding-Lifetime — first 50 members ─────────────────────────┐
│                                                                  │
│  $299 paid once. Lifetime access at the Pro tier + every future │
│  upgrade we ship. Your price never changes.                      │
│                                                                  │
│  Cap: 23 of 50 founding members. When the cap fills, this tier  │
│  is no longer available; Plus and Pro continue normally.         │
│                                                                  │
│  This is a transactional cap, not a timer — there's no countdown│
│  pressure. You can take your time.                               │
│                                                                  │
│  Non-refundable by design. If you stop using the app, your      │
│  $299 stays paid; lifetime access ends with cancellation per    │
│  the cancellation flow.                                          │
│                                                                  │
│  [ Get Lifetime — 23 of 50 remaining ]                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Cohort section rules:**
- Cap-remaining count is fetched live (or near-live; ≤5 min cache) from `founderCapStatus.js`. Shows actual count, not estimated.
- "Transactional cap, not a timer" line — explicitly denies timer urgency framing per MPMF-AP-01.
- Non-refundable disclosure inline — preempts post-purchase surprise.
- Cancellation behavior linked to journey J3 Variation B (founding-member cancel — immediate access-end, no Stripe sub).
- When cap fills (50 of 50): copy becomes "Cap reached. Founding-Lifetime is no longer available. Plus and Pro remain." Button disables. No "join waitlist" affordance — cap is hard.

### Pricing-tentative note

Persistent banner above feature-comparison expander:

```
These prices are tentative for the launch cohort. Final pricing locks
after our first 60 days of telemetry.
```

Per plan §Risk P4 — pricing numbers are not yet validated; M4 + M9 assumptions need 30-60 days of soak. Banner is factual, not coercive ("act now before prices change!" forbidden — that would be MPMF-AP-09).

### Frequently asked questions

7 FAQ entries (accordion; tap to expand):

1. **Can I cancel anytime?** "Yes. Cancellation is two taps from billing settings, no exit survey, no retention dark patterns. Your data stays preserved locally."
2. **What happens to my data if I downgrade or cancel?** "Your data stays. Downgrading makes higher-tier features inaccessible but preserves villain profiles, hand history, and notes. Upgrading later restores feature access without re-import. Cancellation preserves data through your billing-period end; after that, the app continues to work in free-tier mode with all your local data."
3. **How does the Founding-Lifetime tier work?** "$299 paid once gets you lifetime Pro-tier access + every future Pro upgrade we ship. Capped at 50 members. Non-refundable. Cancellation ends lifetime access immediately (no Stripe subscription to wind down)."
4. **What about the online (Ignition) sidebar?** "Phase 2 feature. We're focused on the main-app first. Subscribe-for-updates option is not available — we'll announce on our public release notes when it ships."
5. **What's collected for telemetry? Can I opt out?** "Telemetry consent is asked at first launch. You can opt out per-category (usage events, session replay, error tracking, feature flags) at any time in Settings → Telemetry. Turning all of these off does not reduce any feature available to you."
6. **Is there a free trial of paid tiers?** "No paid trial — the Free tier IS the trial. It has unlimited hand entry, live exploit engine, end-of-session recap, and sample data mode. Cross-session features unlock with Plus."
7. **How do I switch between paid tiers?** "Settings → Billing → Change plan. Upgrades are immediate with prorated charge shown upfront. Downgrades take effect at your next billing period (you keep current-tier access until then). Your data stays preserved across changes."

FAQs use C5 factual register throughout. No "Don't worry — you can always..." emotional reassurance language; statements stand on their own.

### Footer

- Currency disclosure: "These prices are in USD. Shown without sales tax (added at checkout where applicable). Billing handled by Stripe."
- Doctrine line: "**No streaks. No guilt. Cancel in two taps.**" — the M1 marketing wedge as explicit footer text. Permitted under Q1=A: this is the doctrine-as-marketing positioning, not a coercive claim.

---

## State

### Hooks consumed

- `useEntitlement()` — current tier; conditionally renders "Your current tier" chip + adjusts CTA labels.
- `useTelemetryConsent()` — for FAQ #5 link target.
- `usePricingPageView()` — local state: comparison-table-expanded boolean, FAQ-expanded-set, sub-shape attribute (`evaluator.evaluatorSubShape` if set).
- `useFounderCapStatus()` — fetches cap-remaining (returns `{ filled: number, total: number, available: boolean }`).

### Tier definition source

`src/constants/pricingTiers.js` — frozen constant with `{ id, displayName, monthlyPrice, annualPrice, features, ctaLabel, isLifetime }` per tier. Single source of truth; pricing changes require schema-version bump per WRITERS.md §I-WR-5 analog. Phase 1 numbers (tentative): Free $0 / Plus $17/mo $179/yr / Pro $29/mo $299/yr / Founding-Lifetime $299 once. **Pricing-tentative; finalized at Stream E launch based on Stream D telemetry (assumption M4 + M9 validation).**

### Sub-shape tailoring (E-CHRIS / E-SCHOLAR / E-IGNITION)

If `settings.onboarding.evaluatorSubShape` is set (from Variation B fast-orientation per evaluator-onboarding.md):
- Feature list ordering on tier cards subtly emphasizes that sub-shape's relevant features (Live exploit engine first for E-CHRIS; Drills first for E-SCHOLAR; Online sidebar placeholder featured for E-IGNITION even though deferred).
- Tier card itself is unchanged in structure; only feature-list ordering tilts.
- Sub-shape NEVER hides features — full list is always visible. Tailoring is gentle re-ordering, not gating.

### No A/B test infrastructure for pricing

Per Q1=A doctrine and assumption M6 (doctrine-as-positioning-wedge): the pricing page is NOT A/B-tested for conversion-optimization-via-coercion. A future A/B test of doctrine-explicit-vs-doctrine-implicit copy may run (per assumption-ledger M6 kill-criterion); but variations like "show fake countdown timer" / "use 'Most Popular' badge" / "social proof inflated counts" are categorically refused — they're anti-patterns, not test variants.

---

## Props / context contract

### `PricingView` props

None — top-level routed view; reads from contexts.

### `TierCard` props

- `tier: 'free' | 'plus' | 'pro' | 'founding-lifetime'`
- `displayName: string`
- `priceMonthly: number | null` (null for free / lifetime)
- `priceAnnual: number | null`
- `priceOnce: number | null` (only for lifetime)
- `features: string[]` (sub-shape-tailored ordering applied at view layer)
- `ctaLabel: string`
- `isCurrentTier: boolean`
- `isCapAvailable: boolean` (lifetime only)
- `capRemaining: { filled: number, total: number } | null`
- `onCtaTap: () => void`

### `FeatureComparisonTable` props

- `expanded: boolean`
- `onToggleExpanded: () => void`

### `FoundingMemberSection` props

- `capStatus: { filled, total, available }`
- `currentTier: string`

### `PricingFAQ` props

- `expandedSet: Set<string>`
- `onToggle: (faqId) => void`

---

## Key interactions

1. **Land on PricingView.** Read entitlement state; show "Your current tier" chip in top-right if applicable; render 4 tier cards.
2. **Tap "Continue with Free" CTA (Free card).** If unauthenticated evaluator: dismisses pricing-page, routes to main-app TableView with free-tier active. If authenticated free-tier user: dismisses; no-op (already on free).
3. **Tap "Get Plus" / "Get Pro" / "Get Lifetime" CTA.** Routes to Stripe Checkout for the selected tier. Pre-checkout state preserved (return-from-Stripe lands back on a confirmation route, not pricing-page).
4. **Tap Founding-Lifetime CTA when cap full.** No-op; button is disabled. Chip on card reads "Cap reached" instead of CTA.
5. **Tap "Show detailed feature comparison".** Expander reveals comparison table; CTA label inverts to "Hide detailed comparison".
6. **Tap FAQ row.** Accordion expands inline; tap again to collapse. Multiple FAQs can be open simultaneously.
7. **Pricing-tentative banner persists through all interactions.** No dismiss button (it's structural disclosure, not a notification).
8. **Current-tier user (Plus/Pro/Lifetime) tapping a different tier's CTA.** Routes to PlanChangeConfirmModal (J4) with that target tier pre-selected. Pricing-page does NOT execute the change inline.
9. **Cancelled user (within ≥90-day no-resubscribe window) lands on pricing-page.** Shows full content; no "Welcome back!" or "We've been waiting!" copy. Footer doctrine line ("No streaks. No guilt. Cancel in two taps.") subtly reinforces. No proactive re-subscribe prompt.

### Keyboard / accessibility

- All 4 tier cards keyboard-navigable; tab order: Free → Plus → Pro → Founding-Lifetime.
- CTA buttons are `<button>` elements with `aria-label` matching button text.
- Feature comparison expander uses `aria-expanded`.
- FAQ accordions use `aria-expanded` per row.
- Cap-remaining live region has `aria-live="polite"` so screen readers announce updates if cap count changes (rare but possible during long page-dwell).
- "Pricing-tentative" banner has role="note".

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-01** Timer-urgency banners. No countdown timers, no "ends in X" language. Cap-remaining is factual count, not timer.
- **MPMF-AP-02** Social-proof false counts. No "2,400 pros use Pro" / "Most popular!" badges.
- **MPMF-AP-03** Streak celebrations. N/A on this surface (no usage history shown).
- **MPMF-AP-06** "Downgrade" framing. Tier cards listed in price order with no status-ladder language. Switching to a lower tier is "Change to Plus" not "Downgrade to Plus" — even on this informational surface.
- **MPMF-AP-07** "Missing out" loss-framing. No "Don't miss the Game Tree!" / "Unlock your potential!" copy.
- **MPMF-AP-08** Dark-pattern checkout. CTA routes to Stripe Checkout (separate surface); pricing-page itself doesn't collect payment. No pre-checked add-ons; no hidden fees (sales tax disclosure factual in footer).
- **MPMF-AP-09** "Limited-time" fake scarcity. Cap-remaining is REAL scarcity (transactional cap of 50). Banner explicitly states "transactional cap, not a timer" to prevent misreading. No "save 50% today only!" promotions.
- **MPMF-AP-15** Silent plan-change. Tier-card CTAs route to plan-change journey (J4) — they do NOT execute change inline.
- **MPMF-AP-16** Deceptive proration. No proration math on this surface; user lands on PlanChangeConfirmModal (J4) for proration disclosure.

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines:

- **#1 Opt-in enrollment for data collection** — pricing-page doesn't collect data; telemetry events for page-view respect consent gate.
- **#2 Full transparency on demand** — every tier shows price, billing cadence, what's included. No fees hidden. Pricing-tentative disclosure visible. Test: DOM contains all required disclosure elements.
- **#3 Durable overrides on billing state** — N/A directly (informational surface); but for cancelled users in ≥90-day cooldown, surface respects cooldown by not surfacing proactive re-subscribe prompts.
- **#4 Reversibility** — N/A directly; tier cards link to plan-change (J4) which IS reversible.
- **#5 No streaks / shame / engagement-pressure** — no "limited time!" / "act now!" / countdown / streak content. Test: CI-grep refused strings.
- **#6 Flat-access pricing page** — **load-bearing here.** All 4 tiers shown with equal visual weight. NO "Most Popular" / "Recommended" badges. Tier ordering by price (lowest → highest) is factual ordering, not ranked promotion. Test: CSS measurement — all tier cards same width, no color/border boost on any.
- **#7 Editor's-note tone** — CI-linted forbidden-string check on pricing-page copy. Test: `scripts/check-commerce-copy.sh` on pricingCopy.js generator output. M1 doctrine line in footer is permitted (it's the positioning wedge, not coercion).
- **#8 No cross-surface contamination** — pricing-page never embedded in TableView during active hand. H-SC01 binding: navigation to pricing-page during active hand is blocked OR defers (Gate 4 decision: probably allow navigation since user-initiated, but suppress proactive routing).
- **#9 Incognito observation mode** — pricing-page-view event respects consent gate.
- **#10 No dark-pattern cancellation** — for cancelled users in cooldown: no proactive re-subscribe nudges. Test: render pricing-page with `cancellationCooldownActive === true` state; assert no "We'd love to have you back!" copy in DOM.

---

## Cross-surface dependencies

- **`AppRoot`** — adds `SCREEN.PRICING` route in screen reducer.
- **`SettingsView/BillingSettings.jsx`** — gains "View plans" link routing to PricingView.
- **`PaywallModal`** (S2) — "View plans" CTA routes to PricingView.
- **`UpgradePromptInline`** (S3) — "Learn more" CTA routes to PricingView.
- **`SessionsView`** — "Plus required" indicator on prior-session rows links to PricingView for free-tier users.
- **`EntitlementContext`** — current-tier indicator + sub-shape consumption.
- **Stripe Checkout** — external surface; CTA buttons route to Stripe with tier ID + return URL pre-configured.
- **`founderCapStatus.js`** — server endpoint (Phase 5) returns cap-remaining count; client caches ≤5min.

---

## Known behavior notes

- **Cap-remaining race condition** — two users tap "Get Lifetime" simultaneously when 1 of 50 remaining. Per WRITERS.md §I-WR-4, server-side check-before-write enforces hard cap; second user gets refunded with factual message ("Cap filled while you were checking out — refunded. Pro pricing available."). Pricing-page UI may briefly show "1 of 50 remaining" stale; cap-remaining is best-effort display, not authoritative — Stripe + I-WR-4 are authoritative.
- **Pricing changes require version-bump.** Hard-coding tier prices in `pricingTiers.js` constant means changes are PR-reviewable + version-trackable. No runtime price changes possible (refuses dark-pattern "your price went up — accept or lose access" auto-modification).
- **Sub-shape tailoring is invisible to user.** No "We see you're a live player — here's the Pro tier!" copy. Tailoring is gentle feature-ordering only.
- **FAQ entries are static; cap-remaining is dynamic.** FAQ content lives in `pricingCopy.js` generator; cap-remaining count fetches live.
- **Pricing-tentative banner removal trigger.** Once Stream D Phase 4 telemetry validates M4 + M9 assumptions and pricing locks, banner copy changes to "These prices reflect our launch validation." OR banner removed entirely. Decision at Stream D Phase 4 retro.
- **Current-tier indicator on returning user.** Paid user revisiting pricing-page sees "Your current tier" chip on their tier's card; CTA on that card replaces with "You're on [tier]" neutral text. Adjacent tier CTAs remain active for upgrade/downgrade routing.
- **Founding-Lifetime cap-fill scenario UX.** When cap-remaining transitions from 1 to 0 mid-page-view (rare): tier card updates via cap-status hook reactivity; CTA disables; copy updates. No flashing or alarming animation; quiet transition.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [PRICING-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `TierCard.test.jsx` — 4 instances render correctly per tier; equal visual weight (CSS regression test); current-tier chip when applicable.
- `FeatureComparisonTable.test.jsx` — expand/collapse; 14 features × 4 tiers grid renders correctly.
- `FoundingMemberSection.test.jsx` — cap-remaining display; cap-filled state; CTA disable; non-refundable disclosure visible.
- `PricingFAQ.test.jsx` — 7 entries; accordion expand/collapse; multi-open allowed.
- `pricingCopy.test.js` — generator outputs; CI-grep refused strings (no "limited time" / "most popular" / countdown patterns).

### Integration tests (Phase 5)

- `PricingView.e2e.test.jsx` — full page render for evaluator (no current tier), free-tier user, Plus user, Pro user, founding-member.
- `PricingView.cap-fill.e2e.test.jsx` — mock cap-status transition during page-dwell; assert UI updates correctly.
- `PricingView.sub-shape-tailoring.e2e.test.jsx` — mock E-CHRIS / E-SCHOLAR / E-IGNITION sub-shape; assert feature ordering tilts correctly.
- Red-line #6 assertion suite (MPMF-G5-RL) — equal-weight tier cards (CSS measurement: width, border, background, button size all equal).
- Red-line #5 assertion: no countdown, no urgency, no streak content (DOM grep for refused patterns).

### Visual verification

- Playwright MCP 1600×720 screenshot, 6 scenarios:
  1. PricingView default state (4 tier cards, current-tier=free, cap-remaining=23/50).
  2. PricingView with current-tier=Plus (chip on Plus card, CTAs adjusted).
  3. PricingView with cap-filled state (Founding-Lifetime CTA disabled, "Cap reached" copy).
  4. PricingView with feature comparison expanded (full 14-row table visible).
  5. PricingView with 3 FAQs expanded (accordion behavior).
  6. PricingView for cancelled-user-in-cooldown (no proactive re-subscribe nudges).

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S1-DEFAULT`
- `EVID-PHASE5-MPMF-S1-CURRENT-TIER-PLUS`
- `EVID-PHASE5-MPMF-S1-CAP-FILLED`
- `EVID-PHASE5-MPMF-S1-COMPARISON-EXPANDED`
- `EVID-PHASE5-MPMF-S1-FAQ-EXPANDED`
- `EVID-PHASE5-MPMF-S1-CANCELLED-USER`

---

## Phase 5 code-path plan

**New files (~9):**
1. `src/components/views/PricingView/PricingView.jsx`
2. `src/components/views/PricingView/TierCard.jsx`
3. `src/components/views/PricingView/FeatureComparisonTable.jsx`
4. `src/components/views/PricingView/FoundingMemberSection.jsx`
5. `src/components/views/PricingView/PricingFAQ.jsx`
6. `src/hooks/usePricingPageView.js`
7. `src/hooks/useFounderCapStatus.js`
8. `src/utils/entitlement/founderCapStatus.js` (client-side fetcher; server endpoint Phase 5 separate)
9. `src/constants/pricingTiers.js`
10. `src/utils/entitlement/pricingCopy.js`

**Amended files (~3):**
- `src/constants/uiConstants.js` — `SCREEN.PRICING` constant.
- `src/reducers/uiReducer.js` — pricing-page navigation handling.
- `src/components/views/SettingsView/BillingSettings.jsx` — "View plans" link.

**External:**
- Server endpoint for founder-cap-status (could be Stripe metadata + serverless function, or simple cached value in IDB updated via webhook).
- Stripe product/price configuration matching `pricingTiers.js`.

---

## Change log

- 2026-04-25 — v1.0 authored as Gate 4 Batch 4 artifact (MPMF-G4-S1). Most-complex Gate 4 surface; full anatomy + 4 TierCards + feature-comparison table + Founding-Lifetime cohort section + 7-entry FAQ + pricing-tentative banner + footer doctrine line + sub-shape tailoring + cap-remaining race-condition handling + 10 red-line compliance with per-line test target + Phase 5 code-path plan ~10 new files. Tentative pricing committed: Free $0 / Plus $17/mo $179/yr / Pro $29/mo $299/yr / Founding-Lifetime $299 once cap 50. Marked "pricing-tentative" pending Stream D Phase 4 telemetry validation. Zero code changes (surface-spec only).
