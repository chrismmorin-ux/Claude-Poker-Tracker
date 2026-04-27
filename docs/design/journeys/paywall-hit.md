# Journey — Paywall Hit

**ID:** `paywall-hit`
**Product line:** Main app. Extension inherits entitlement state read-only; extension-side paywall-hit variation deferred to Phase 2+ when Ignition SKU ships.
**Primary persona:** Free-tier user (Evaluator or free-tier-by-choice user).
**Tier placement:** Free (the journey only fires against free-tier users hitting gated surfaces).
**Last reviewed:** 2026-04-24 (Gate 4 Batch 3)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red line #5 (no engagement-pressure) + #7 (editor's-note tone) + #8 (no cross-surface contamination)
- `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q5 (session-scoped free — verdict A)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-01 (timer-urgency) + §MPMF-AP-12 (paywall mid-hand)
- `docs/projects/monetization-and-pmf/paywall-spectrum.md` §Dimension 1 — Paywall location (L3 usage-threshold / L4 history-access / L6 depth-of-analysis)
- `docs/design/jtbd/domains/subscription-account.md` §SA-73 (hit-paywall-with-dignity — primary JTBD)
- `docs/design/jtbd/domains/subscription-account.md` §SA-71 (try-before-paying) + §SA-72 (understand-free-vs-paid)
- `docs/design/surfaces/paywall-modal.md` (Gate 4 Batch 4 — surface rendered by this journey)
- `docs/design/heuristics/poker-live-table.md` §H-SC01 (paywall-never-interrupts-active-work — LOAD-BEARING)
- `docs/design/personas/situational/trial-first-session.md` (evaluator first-session context)
- `docs/design/personas/situational/returning-evaluator.md` (returning-evaluator on next-session-open)

---

## Purpose

Define the user-facing flow when a free-tier user encounters a feature-gate. Under Q5=A verdict (session-scoped free), the primary paywall trigger is **history-access** — free users see their current session fully, but opening a prior session's detail requires paid tier. Secondary triggers are usage-threshold (Plus/Pro features accessed beyond free-tier cap) and depth-of-analysis (game-tree + exploit-anchor surfaces that are entirely paid-tier).

Per SA-73 JTBD and red line #10: a paywall hit is a moment of potential trust damage. The journey must:
- Never interrupt active work (H-SC01 binding).
- Be factually honest — the user is NOT being punished; they're hitting a tier boundary.
- Respect the user's time — one modal, equal-weight "Keep free" vs "Upgrade" buttons, no dark-pattern coercion.
- Treat the hit as an information event, not a conversion-pressure event.

Non-goals (explicit):
- **Not a conversion-optimization surface.** The paywall modal states facts; it does NOT maximize-upgrade-clicks via color/copy/timing manipulation.
- **Not a first-run ceremony.** First-launch telemetry panel + evaluator-onboarding handle first-time-in-app UX. Paywall-hit is only for users who have already engaged with free-tier value.
- **Not a reminder surface.** Once dismissed, paywall re-fire respects H-N07 cooldown (≥ 7 days on same surface). No nagging.
- **Not a feature-advertising surface.** Paywall modal names what's gated + offers upgrade path; it does NOT list-every-Pro-feature or run a sales pitch.

---

## JTBD served

**Primary:**
- **`JTBD-SA-73`** — Hit a paywall with dignity (load-bearing; factual framing + equal-weight buttons + H-SC01)

**Secondary:**
- **`JTBD-SA-71`** — Try before paying (paywall hit demonstrates the boundary, which is part of the try-evaluation loop)
- **`JTBD-SA-72`** — Understand what's free/paid/why (hit moment is the most concrete instance of this JTBD)

**NOT served:**
- **`JTBD-SA-74`** — Cancel (separate journey at J3)
- **`JTBD-SA-76`** — Plan change (separate journey at J4)

---

## Personas served

**Primary:**
- **Free-tier Evaluator** in trial-first-session / returning-evaluator state. Paywall hit is a common event for this persona.
- **Free-tier-by-choice user** (paid user who downgraded to free, OR never paid but has been active for months). Same journey; same dignity.

**Secondary:**
- **`post-session-chris`** — most common context for history-access trigger (reviewing sessions).
- **`presession-preparer`** — may hit paywall reviewing prior-session villain data; presession context suppresses upgrade CTAs elsewhere but paywall-hit can still fire here (transparency on what's gated is needed even in presession).

**Explicitly excluded:**
- **`mid-hand-chris`** — H-SC01 binding: paywall NEVER fires during active hand. If trigger fires mid-hand (e.g., quota exhaustion), defer to hand-end.
- **`newcomer-first-hand`** — no paywall fires until newcomer crosses the hand-threshold (inherits EAL's 25-hand threshold analog). Free tier's value is demonstrable first.

---

## The 4 trigger variations

All variations render the same `paywall-modal.md` surface (Gate 4 Batch 4); variations differ in what gate was hit + what copy context the modal shows.

### Variation A — History-access gate (most common, L4 trigger)

**Trigger:** Free-tier user attempts to open a prior-session detail view (any session not the current-active session).

**Flow:**

```
SessionsView / list of sessions
 → User taps a prior session's card
 → Entitlement check: isAtLeast('plus') for 'CROSS_SESSION_HISTORY' feature
 → False for free-tier → PaywallGate blocks render
 → PaywallModal opens with Variation A copy:
    "You're on the free tier. Current-session details are always free.
     Prior sessions unlock with Plus."
    [ View plans ]    [ Keep free ]
 → User taps [ View plans ] → routes to pricing-page.md (MPMF-G4-S1)
 → OR User taps [ Keep free ] → modal dismisses; user stays on SessionsView
 → Dismissal writes H-N07 cooldown: this surface won't re-fire paywall for same user for ≥ 7 days
```

**Copy register:** C5 factual. Mentions what IS free ("Current-session details are always free") before stating what's gated. Frames Plus as additive, not punitive.

**Time budget:** ≤ 5 seconds to read + decide. Modal intentionally short.

---

### Variation B — Usage-threshold gate (L3 trigger, Plus/Pro features metered)

**Trigger:** Free-tier user hits a per-session or per-month quota on a free-tier-metered feature (e.g., "3 deep analyses per session" — charter §Acceptance Criteria free-tier shape). Triggered on the action that would exceed quota.

**Flow:**

```
User performs action (e.g., open deep analysis for 4th hand in session)
 → Entitlement check: getRemainingUsage('deep_analysis') === 0
 → PaywallGate intercepts action
 → **H-SC01 CHECK:** isHandInProgress() === true → DEFER to hand-end
    (modal does NOT fire mid-hand; user's action quietly no-ops with toast
     "Deep analysis limit reached — unlocks at hand-end")
 → H-SC01 check passes (user is between hands / post-session) → PaywallModal opens:
    "You've used 3 of 3 deep analyses this session. Plus unlocks unlimited.
     Quotas reset each new session."
    [ View plans ]    [ Keep free ]
```

**Copy register:** C5 factual. States quota explicitly ("3 of 3"), reassures about reset behavior ("resets each new session"), frames Plus as quota removal.

**H-SC01 binding:** mid-hand trigger defers to hand-end. User sees a neutral toast ("limit reached — unlocks at hand-end") with no modal interruption.

---

### Variation C — Depth-of-analysis gate (L6 trigger, entirely paid feature)

**Trigger:** Free-tier user attempts to navigate to a surface that is entirely paid-tier (Game Tree Deep Analysis, Exploit Anchor Library, Calibration Dashboard).

**Flow:**

```
User navigates to gated surface (e.g., Settings → Anchor Library)
 → Entitlement check: hasAccessTo('EXPLOIT_ANCHOR_LIBRARY') === false
 → PaywallGate shows fallback (not modal):
    Inline placeholder: "Anchor Library is a Pro feature. Preview:"
    [optional: static preview of an anchor card — illustrative]
    [ Unlock Anchor Library (Pro) ]    [ Back to Settings ]
```

**Copy register:** C5 factual. Inline placeholder instead of modal (user navigated INTO the surface; blocking modal on navigation is more disruptive than inline fallback with preview).

**Why fallback, not modal:** navigation is a deliberate action; blocking with modal is friction. Inline fallback respects the user's navigation intent while clearly stating what's gated.

---

### Variation D — Session-close → paywall-next-open (Q5=A pattern)

**Trigger:** Free-tier user closes a session (CashOutModal or equivalent session-end action). On NEXT app-open or next-session-open, the session-end recap is accessible but opening it requires Plus.

**Flow:**

```
Session N closes → free user's session data persists locally but history-access gate applies
 → Later: user opens app for next session OR re-opens SessionsView
 → Session N shows in list with small "Plus required to reopen" indicator
 → User taps Session N → Variation A fires (same PaywallModal)
```

**Copy register:** same as Variation A. The "Plus required to reopen" indicator on the list row is the passive prompt; the modal is the interactive decision point.

**Why not fire modal at session-close:** session-close is a moment of completion, not failure. Firing paywall at session-close would conflate "I finished my session" with "I'm being asked to pay" — bad emotional framing. Defer paywall to user's next navigation decision.

---

## The PaywallModal — shared across Variations A/B/D (Variation C uses inline fallback)

Full spec at `surfaces/paywall-modal.md` (Gate 4 Batch 4). This journey specifies the contract.

### Modal contract (spec summary — detailed at surface level)

- **Title:** variation-specific + tier-gated ("You're on the free tier" / "You've used 3 of 3 deep analyses this session" / etc.).
- **Body:** 1-2 lines factual. What's gated + what IS free + what Plus unlocks. Mentions Plus tier by name.
- **2 buttons, equal visual weight:**
  - Primary action label: `[ View plans ]` — routes to pricing-page.md.
  - Secondary action label: `[ Keep free ]` — dismisses modal; user stays on current view.
- **No "Maybe later"** button (suggests user is being pressured now).
- **No pre-selected button** (no visual focus on View plans).
- **No countdown timer or urgency banner** (MPMF-AP-01 refused).
- **Dismissal behavior:** `[ Keep free ]` or ✕ or escape key — all dismiss; H-N07 cooldown starts (7-day no-re-fire on same surface + same trigger).

### PaywallGate component contract (Gate 5)

- `<PaywallGate feature={FEATURE_TIER.CROSS_SESSION_HISTORY} fallback={<PaywallModal variation="A" />}>`
- If user has access → render children.
- If not → render fallback (modal or inline-placeholder per variation).
- H-SC01 check: if `isHandInProgress() === true`, fallback does NOT render modal; instead renders a neutral in-place toast ("Feature unlocks at hand-end") and defers modal to hand-end boundary.

---

## H-SC01 binding — defer-to-hand-end mechanism

**Critical invariant:** paywall NEVER interrupts an active hand.

### Detection

`isHandInProgress()` returns true when:
- Any `TableView` has hero with active hole cards + unresolved action.
- Any `OnlineView` reports active hand via extension WebSocket bridge.

### Deferral logic

When paywall trigger fires while `isHandInProgress() === true`:
1. Action being performed (e.g., 4th deep-analysis tap) silently no-ops.
2. Neutral toast: "Feature unlocks at hand-end — limit reached" (factual; no upgrade nudge).
3. Hand-end event (any of: `recordAction('fold')`, `recordAction('allIn')` resolved, showdown complete, hand marked complete) fires a post-hand check.
4. Post-hand check: if any deferred paywall triggers queued, fire the corresponding modal NOW (hand-end boundary = between-hands-chris situational — cognitive budget permits).
5. Deferred modals do not stack; only the most-recent deferred trigger fires.

### Gate 5 test assertion

- `MPMF-G5-SC` test: mock `isHandInProgress() === true` + call any paywall trigger; assert modal does NOT render. End hand; assert modal THEN renders.

---

## Post-paywall-hit cooldown (H-N07 binding)

Once user dismisses a paywall modal for a specific surface + trigger combination:
- **7-day cooldown** before same surface + trigger fires again.
- **Per-user, per-device** cooldown state (stored in `settings.paywall.recentDismissals` with 7-day expiry).
- Different surfaces / triggers are independent — user dismissing history-access paywall doesn't affect depth-of-analysis paywall for different surface.
- After 7 days, the gate is "cold" — next attempt fires modal again (user has had time to reconsider).

**Rationale:** red line #5 (no engagement-pressure) + industry H-N07 heuristic (repeated dismissal annoying). 7 days is the default; Gate 5 can tune via feature flag if telemetry shows wrong interval.

**User-facing signal:** the gated surface continues to show "Plus required" indicator factually (no cooldown on the indicator; only on the modal interruption). User sees what's gated; user chooses when to act.

---

## Copy-discipline — forbidden vs permitted strings

Journey inherits all `anti-patterns.md` forbidden-string patterns. Specific to paywall-hit:

### Forbidden (CI-lint refused)

- ✗ `"Upgrade now!"` (urgency — MPMF-AP-01)
- ✗ `"Don't miss out"` (loss framing — MPMF-AP-07)
- ✗ `"Limited time"` (fake scarcity — MPMF-AP-09)
- ✗ `"Pros use Plus"` (social proof — MPMF-AP-02)
- ✗ `"You're missing"` / `"Without Plus you can't"` (deprivation framing)
- ✗ `"Ready to level up?"` (aspirational pressure — MPMF-AP-07)
- ✗ `"Maybe later"` button label (implies pressure-to-decide-now)

### Permitted (C5 factual + C6 editor's-note)

- ✓ `"You're on the free tier."` (factual state)
- ✓ `"Prior sessions unlock with Plus."` (factual mechanism; Plus named by tier)
- ✓ `"Quotas reset each new session."` (factual reassurance)
- ✓ `"Plus unlocks unlimited."` (factual benefit)
- ✓ `"Current-session details are always free."` (factual what-IS-free)
- ✓ `"View plans"` / `"Keep free"` (neutral button labels)
- ✓ `"Feature unlocks at hand-end — limit reached."` (factual deferral toast)

---

## Anti-patterns refused at this journey

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-01** — Timer-urgency banners. Paywall modal has no countdown, no "expires in X hours" language.
- **MPMF-AP-02** — Social-proof false counts. No "2,400 pros use Pro" in modal.
- **MPMF-AP-07** — "Missing out" loss-framing. "You're missing..." copy refused.
- **MPMF-AP-09** — "Limited-time" fake scarcity. No discount codes, no "save 50%" overlays.
- **MPMF-AP-12** — Paywall mid-hand. **Load-bearing refusal.** H-SC01 defer-to-hand-end enforced.

---

## Red-line compliance checklist (Gate 5 test targets)

- **#1 Opt-in enrollment for data collection** — telemetry events for paywall-hit (paywall_shown / paywall_dismissed / paywall_upgrade_clicked) respect consent gate.
- **#2 Full transparency on demand** — modal states tier name + what IS free + what's gated + reset behavior. Test: DOM contains each required section.
- **#3 Durable overrides** — H-N07 cooldown durable (7 days); no re-prompt during cooldown. Test: dismiss modal; re-trigger; assert no modal within 7-day window.
- **#4 Reversibility** — dismissal is reversible (user can navigate to pricing-page manually even during cooldown). Test: during cooldown, navigate to Settings → Billing → View plans; assert no gate.
- **#5 No streaks / shame / engagement-pressure** — no urgency copy; no "act now"; no repeated re-firing. CI-lint.
- **#6 Flat-access** — "Keep free" button at equal visual weight to "View plans". Test: CSS measurement — identical size/color/weight.
- **#7 Editor's-note tone** — CI-linted forbidden-string check on paywall modal copy. Test: `scripts/check-commerce-copy.sh` on paywall-hit copy.
- **#8 No cross-surface contamination** — paywall modal never renders on TableView during active hand (H-SC01). Test: mock mid-hand state; trigger paywall; assert no modal.
- **#9 Incognito observation mode** — telemetry events for paywall-hit respect per-category consent. Test: with `usageEvents` opted-out, zero paywall telemetry events.
- **#10 No dark-pattern cancellation** — N/A (not a cancellation flow), but sibling principle applies: dismissal is ≤ 1-tap (Keep free button), no interposition.

---

## Cross-surface consistency

### Shared components

- **`PaywallModal`** (Gate 4 Batch 4 surface + Gate 5 component) — shared across Variations A/B/D.
- **`PaywallFallbackInline`** (Gate 5 component) — Variation C inline fallback for deep-navigation gates.
- **`PaywallGate`** (Gate 5 HOC) — wraps any feature-gated render; handles H-SC01 check + cooldown state + fallback rendering.

### CI-linted copy generator

- `src/utils/entitlement/paywallCopy.js` (Gate 5) — deterministic generator from (variation, feature, tier) → copy strings. Mirrors EAL `retirementCopy.js` pattern.

### Cross-journey boundaries

- **Cancellation journey (J3) shares no modal with paywall-hit.** Distinct actions; conflating them is anti-pattern.
- **Plan-change journey (J4) shares no modal with paywall-hit.** Plan-change is between-paid-tiers; paywall-hit is free-to-paid. Distinct flows.
- **Upgrade-prompt-inline (Gate 4 Batch 4 surface) is different from PaywallModal.** Upgrade-prompt is proactive (embedded in post-session recap, upsell moments); paywall-modal is reactive (blocks a specific action). Can coexist; different copy generators.

---

## Known behavior notes

- **Free-tier indicator and paywall hit interact:** H-SC02 (trial-state-legible-outside-settings) ensures user knows they're free-tier BEFORE hitting paywall. Ideally paywall hits are never a surprise.
- **H-N07 cooldown is per-device:** if user has two devices (phone + tablet), each has independent cooldown state. Not synced per Phase 1 local-only architecture.
- **Variation D (session-close) timing:** recap at session-close is free (Q5=A session-scoped); the paywall only fires on later re-open. This is intentional — user completes session successfully without commercial friction.
- **Newcomer hand-threshold:** user with < 25 hands seen (inherits EAL-G4-NC pattern) sees no paywall even if they trigger one — gate returns "Free tier" access transparently. 25-hand threshold editable constant.
- **Depth-of-analysis preview (Variation C):** the static preview on the fallback is illustrative, not interactive. User cannot "try" the gated feature by tapping the preview.
- **Upgrade click telemetry:** `paywall_upgrade_clicked` event fires when user taps "View plans"; funnel analysis in PostHog correlates modal variation → click-through → pricing-page → conversion.

---

## Known issues

None at creation — new journey. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [PWH-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `PaywallGate.test.jsx` — renders children when access granted; renders fallback when denied; H-SC01 check defers modal mid-hand.
- `PaywallModal.test.jsx` — 2 buttons equal weight; ✕ + escape dismiss; variation-specific copy.
- `PaywallFallbackInline.test.jsx` — Variation C render; navigation back intact.
- `paywallCopy.test.js` — generator outputs per variation; CI-grep forbidden strings.
- `H-N07-cooldown.test.js` — dismissal writes cooldown; same surface doesn't re-fire within 7 days.

### Integration tests (Phase 5)

- `PaywallHitVariationA.e2e.test.jsx` — SessionsView → tap prior session → modal appears → dismiss → cooldown active.
- `PaywallHitVariationB.e2e.test.jsx` — exhaust quota → modal at hand-end (mid-hand deferred).
- `PaywallHitVariationC.e2e.test.jsx` — navigate to Anchor Library as free user → inline fallback with preview.
- `PaywallHitVariationD.e2e.test.jsx` — session-close flow → next-open → modal fires on list-tap.
- `H-SC01.e2e.test.jsx` (MPMF-G5-SC) — mid-hand state + paywall trigger + assert no modal; complete hand + assert modal fires post-hand.

### Visual verification

- Playwright MCP 1600×720 screenshot, 4 scenarios:
  1. PaywallModal Variation A (history-access).
  2. PaywallModal Variation B (usage-threshold with quota numbers).
  3. PaywallFallbackInline Variation C (depth-of-analysis preview).
  4. SessionsView list with "Plus required" indicator on prior session rows.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-J2-VARIATION-A`
- `EVID-PHASE5-MPMF-J2-VARIATION-B`
- `EVID-PHASE5-MPMF-J2-VARIATION-C-INLINE`
- `EVID-PHASE5-MPMF-J2-SESSIONS-LIST-INDICATOR`

---

## Phase 5 code-path plan

**New files (~4):**
1. `src/components/ui/PaywallModal.jsx` (spec at G4-S2)
2. `src/components/ui/PaywallFallbackInline.jsx`
3. `src/utils/entitlement/paywallCopy.js`
4. `src/hooks/usePaywallCooldown.js` (H-N07 state management)

**Amended files (~3):**
- `src/components/ui/PaywallGate.jsx` (MPMF-G5-PG) — add H-SC01 check + variation routing.
- `src/reducers/entitlementReducer.js` — paywall-shown / paywall-dismissed action types.
- `src/utils/telemetry/eventSchema.js` — paywall event definitions.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Batch 3 artifact (MPMF-G4-J2). 4 variations (A History-access / B Usage-threshold / C Depth-of-analysis inline fallback / D Session-close → next-open) + shared PaywallModal contract + H-SC01 defer-to-hand-end mechanism + H-N07 7-day cooldown + 10 red-line compliance with per-line test target + Phase 5 code-path plan. Zero code changes (journey-spec only).
