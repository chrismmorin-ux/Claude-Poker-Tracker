# Surface — Upgrade Prompt Inline

**ID:** `upgrade-prompt-inline`
**Parent surface:** Inline widget embedded in multiple views (settings, session recap, post-hand review). Hosted by host views; not a standalone routed surface.
**Product line:** Main app. Extension never embeds upgrade prompts of its own.
**Tier placement:** Free tier user (only fires for users who can upgrade — paid users see no prompts).
**Last reviewed:** 2026-04-25 (Gate 4 Batch 4)

**Code paths (future — Phase 5):**
- `src/components/ui/UpgradePromptInline.jsx` (new — shared widget; rendered by multiple host surfaces)
- `src/hooks/useUpgradePromptVisibility.js` (new — H-N07 cooldown + presession suppression + sub-shape tailoring)
- `src/utils/entitlement/upgradePromptCopy.js` (new — CI-linted deterministic copy generator with sub-shape variants)
- `src/constants/upgradePromptContexts.js` (new — frozen list of valid host contexts: 'session-recap' / 'post-hand-review' / 'settings-billing' / 'session-list-row')

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #5 (no engagement-pressure) + #7 (editor's-note tone) + #8 (no cross-surface contamination)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-01 (timer-urgency) + §MPMF-AP-04 (re-engagement push) + §MPMF-AP-07 (loss-framing) + §MPMF-AP-13 (consent-nag) + §MPMF-AP-14 (onboarding-lock-in spirit)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Feature map
- `docs/design/surfaces/pricing-page.md` (CTA destination)
- `docs/design/surfaces/paywall-modal.md` (sibling — DISTINCT pattern: paywall is reactive blocker; upgrade-prompt-inline is proactive embed)
- `docs/design/journeys/evaluator-onboarding.md` §Sub-shape (E-CHRIS / E-SCHOLAR / E-IGNITION attribute consumed for tailored copy)
- `docs/design/heuristics/poker-live-table.md` §H-N07 (no re-fire after dismissal) + §H-SC01 (never on live-play)
- `docs/design/jtbd/domains/subscription-account.md` §SA-72 (understand-free-vs-paid)

---

## Purpose

Upgrade-prompt-inline is the proactive counterpart to paywall-modal's reactive trigger. While paywall-modal fires WHEN a user hits a feature gate, upgrade-prompt-inline lives quietly in contextual locations where a free-tier user might naturally consider upgrading (e.g., scrolling past a high-EV hand in session recap, ending a long session). It must be:

- **Subtle.** Inline placement; visually quiet; no animation that grabs attention.
- **Context-aware.** Appears in surfaces where upgrade is genuinely relevant; suppressed in surfaces where it would be intrusive (presession-preparer, mid-hand, returning-evaluator-first-impression).
- **Sub-shape-tailored.** E-CHRIS sees live-play-relevant copy; E-SCHOLAR sees drill-relevant copy; E-IGNITION sees online-sidebar-coming placeholder.
- **Cooldown-respecting.** Once dismissed, does NOT re-fire on same host surface for 7 days (H-N07).
- **Dismissable structurally.** Same dismiss is durable; no "you missed the dismiss button" recovery.

This surface is where soft-conversion happens (vs. paywall-modal's hard-trigger conversion). Drift toward conventional banner-ad patterns (animation, color-pulses, sticky behavior, "X" close that re-renders elsewhere) is the failure mode; CI-linted copy + visual-regression tests enforce.

Non-goals (explicit):
- **Not a feature-tour surface.** Upgrade-prompt does NOT showcase Pro features. CTA points to pricing-page; pricing-page handles tier comparison.
- **Not a checkout surface.** No payment collected inline.
- **Not a sticky / persistent surface.** Each host surface decides whether to render it; once dismissed, gone for cooldown duration.
- **Not a notification surface.** No toast variant. No push notification triggers. No email trigger.
- **Not a marketing-pitch surface.** No "Did you know..?" / "Pro tip!" framing. Factual statements only.
- **Not a re-engagement surface.** Doesn't fire for returning-evaluator first re-open (suppressed for 24h post-return); never fires for users who explicitly opted out via Settings.

---

## JTBD served

**Primary:**
- **`JTBD-SA-72`** — Understand what's free, what's paid, and why (inline prompt is one of the surfaces communicating this in context)

**Secondary:**
- **`JTBD-SA-71`** — Try before paying (prompt acknowledges user is on free tier without coercing upgrade)

**Not served:**
- **`JTBD-SA-65`** — Tier comparison (pricing-page handles)
- **`JTBD-SA-73`** — Paywall hit (paywall-modal handles; this is the proactive counterpart)
- **`JTBD-SA-74/76/77/78`** — Billing-state JTBDs (BillingSettings handles)

---

## Personas served

**Primary:**
- **Free-tier evaluator** in `post-session-chris` situational state — most receptive context (just finished a session; reviewing recap).
- **Free-tier-by-choice user** — already-decided users who chose to stay free; respect their decision (cooldown + dismissal durability).

**Secondary:**
- **`scholar-drills-only`** in `study-block` situational — may see prompt in drill-completion contexts.

**Excluded:**
- **`mid-hand-chris`** — H-SC01 binding: prompt NEVER renders on TableView during active hand.
- **`presession-preparer`** — prompt SUPPRESSED on session-prep surfaces (per Gate 2 Stage C #5 — presession context demands focus, not commerce intrusion).
- **`returning-evaluator`** in first-2-hour return window — prompt suppressed (re-engagement context conflicts with red-line #5; let user re-orient before any commerce intrusion).
- **All paid-tier users** — prompt never renders for users above current free tier; entitlement check at component-mount returns null.
- **`newcomer-first-hand`** — prompt suppressed until newcomer-hand-threshold (≥25 hands) crossed.

---

## Anatomy

```
┌── UpgradePromptInline (post-session-recap context) ────────────────────────┐
│                                                                              │
│  Plus unlocks cross-session villain tracking + history.                     │
│  $17/mo · See plans                                                          │
│                                                                       ✕    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Compact one-line variant** for embedded contexts (above; default).

```
┌── UpgradePromptInline (settings-billing context) ──────────────────────────┐
│                                                                       ✕    │
│  Plus tier                                                                  │
│  · Cross-session villain tracking                                           │
│  · Full history                                                             │
│  · Basic drills                                                             │
│                                                                              │
│  $17/mo · See plans                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Expanded variant** for settings/billing context where vertical space allows.

### Universal contract

- **Headline (compact):** factual statement of value. NOT "Upgrade now!" / "Don't miss out!". E.g., "Plus unlocks cross-session villain tracking + history." Sub-shape-tailored:
  - **E-CHRIS:** "Plus unlocks cross-session villain tracking + history."
  - **E-SCHOLAR:** "Plus unlocks basic drills + cross-session history."
  - **E-IGNITION:** "Online sidebar coming Phase 2. Plus unlocks cross-session features for the main app."
  - **No-sub-shape (default):** "Plus unlocks cross-session villain tracking + history."

- **Price + CTA:** factual price ("$17/mo") + neutral CTA ("See plans" — links to pricing-page).
- **Dismiss (✕):** top-right or right-aligned. Dismissal writes 7-day cooldown for this host surface + this prompt context.
- **No animation.** No fade-in pulse, no slide-up, no color-shift. Just renders inline like any other static content.
- **No close-and-reappear-elsewhere pattern.** If user dismisses on session-recap surface, the prompt may STILL appear on settings-billing surface (different surface = different cooldown). But on the dismissed surface, it does NOT shift positions or re-render after a delay.
- **Visual weight:** muted. Neutral background tone (not high-contrast); body text at standard size; CTA link styled as link (not button); no exclamation marks; no emoji.
- **Sizing:** ≥44 DOM-px height for tappable area; full-width within host surface column; respects `useScale` per existing convention.

### Host context variants

The widget renders in different host surfaces with subtle context-specific copy:

| Host surface | Context tag | Headline (default sub-shape) | When suppressed |
|---|---|---|---|
| Session recap (post-cashout) | `session-recap` | "Plus unlocks cross-session villain tracking + history." | Returning-evaluator first 2h |
| Post-hand review (HandReplayView) | `post-hand-review` | "Plus saves villain reads across sessions." | Active hand (H-SC01) |
| Settings → Billing section | `settings-billing` | (Expanded variant; full feature list) | Already paid user |
| Sessions list (free user; row indicator) | `session-list-row` | (Compact "Plus required" indicator on prior-session rows; clickable to paywall-modal) | None (always visible to free) |
| Drills list (Scholar context) | `drills-list` | "Plus unlocks the full drill library + saved progress." | None |

**Suppression list:**
- Mid-hand (H-SC01)
- Presession-preparer surfaces
- Returning-evaluator first 2-hour window
- Newcomer (<25 hands)
- Paid tier (renders nothing)
- After dismissal in current host context (7-day cooldown)

---

## State

### Hooks consumed

- `useEntitlement()` — checks if user is free-tier; if paid, hook returns null (component renders nothing).
- `useUpgradePromptVisibility(hostContext)` — composite check: cooldown + persona-state + presession-context + newcomer-threshold. Returns `{ shouldRender, reason }`. Reason useful for telemetry.
- `useEvaluatorSubShape()` — reads `settings.onboarding.evaluatorSubShape` for tailored copy.
- `useUI()` — `isHandInProgress()` for H-SC01 check.

### Cooldown state

`settings.upgradePromptCooldowns: Map<hostContext, ISO8601>`. Per-context cooldown. Dismissing on `session-recap` doesn't suppress `settings-billing` context.

### Telemetry events (consent-gated)

- `upgrade_prompt_shown` — properties: `hostContext`, `subShape`, `tier` (always 'free' since prompt only fires for free-tier)
- `upgrade_prompt_dismissed` — properties: same + cooldown-set (boolean — confirms write succeeded)
- `upgrade_prompt_cta_clicked` — properties: `hostContext` + routing destination ('pricing-page')
- `upgrade_prompt_suppressed` — properties: `hostContext` + suppression reason ('presession' / 'returning-evaluator-window' / 'cooldown' / 'newcomer-threshold')

These help validate assumption M6 (doctrine-as-positioning-wedge) — if upgrade-prompt-inline has high suppression rate AND low click-through, that's evidence the doctrine-respecting design is functional.

---

## Props / context contract

### `UpgradePromptInline` props

- `hostContext: 'session-recap' | 'post-hand-review' | 'settings-billing' | 'session-list-row' | 'drills-list'` — required; identifies the host surface for cooldown-keying + copy variant
- `compact?: boolean` (default true) — compact vs expanded variant. Most contexts compact; settings-billing uses expanded.
- `onDismiss?: () => void` — optional dismissal callback for host surface to know prompt was hidden (e.g., re-flow layout)
- `onCtaClick?: () => void` — optional CTA-click callback before route to pricing-page

### Context consumed

- `useEntitlement()` — current tier (renders nothing for paid)
- `useUpgradePromptVisibility(hostContext)` — composite visibility check
- `useEvaluatorSubShape()` — sub-shape attribute for tailored copy
- `useUI()` — `isHandInProgress()` H-SC01 check

---

## Key interactions

1. **Component mounts in host surface.** Reads visibility hook; if `shouldRender === false`, renders null + fires `upgrade_prompt_suppressed` telemetry event with reason.
2. **Visibility check passes:** renders the prompt at standard inline placement.
3. **User taps CTA "See plans":** fires `upgrade_prompt_cta_clicked` telemetry → routes to pricing-page.md.
4. **User taps ✕ dismiss:** fires `upgrade_prompt_dismissed` → writes cooldown to `settings.upgradePromptCooldowns[hostContext] = now()` → component unmounts → host surface re-flows.
5. **User dismisses + re-visits same host surface within 7 days:** visibility hook returns `shouldRender = false, reason = 'cooldown'` → prompt suppressed; no telemetry "shown" event fires.
6. **User dismisses + visits different host surface (e.g., dismissed `session-recap` → opens `settings-billing`):** different cooldown key → prompt renders normally on the new surface.
7. **User progresses from free to paid (anywhere):** entitlement context updates; prompt component re-renders; entitlement check returns null → no prompt regardless of host context. No "Thanks for upgrading!" banner replaces it (refused as engagement-pressure).
8. **Returning-evaluator opens app within 2-hour window:** visibility hook checks `lastReturnAfterDriftAt`; if within 2h, suppresses with reason `'returning-evaluator-window'`. After 2h elapsed, normal cooldown rules apply.
9. **Mid-hand surface:** prompt component on TableView/SessionRecap (if attempted) — visibility hook returns `false, 'h-sc01-active-hand'` → null render. No deferral mechanism here (unlike paywall-modal); this is proactive content, not blocking — simply doesn't appear during hand.

### Keyboard / accessibility

- `role="region"` `aria-label="Upgrade prompt"` (so screen readers announce its purpose).
- ✕ dismiss button: `aria-label="Dismiss upgrade prompt"` ≥44×44 DOM px touch target.
- "See plans" CTA: standard `<a>` or `<button>` semantics.
- Compact variant: single line; tab order: CTA → dismiss.
- Expanded variant: tab order: dismiss → headline (read by screen reader) → feature list → CTA.

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-01** Timer-urgency banners. No countdown, no "limited time" within prompt copy.
- **MPMF-AP-02** Social-proof false counts. No "X users upgraded today" framing.
- **MPMF-AP-04** Re-engagement push notifications. Prompt is inline-only; no push channel for upgrade-prompt content.
- **MPMF-AP-07** "Missing out" loss-framing. No "Don't miss..." copy.
- **MPMF-AP-13** Telemetry-consent-nag analog — once dismissed, prompt does NOT re-prompt within 7-day cooldown. Different from "you've had it dismissed for 30 days, reconsider?" anti-pattern (refused).
- **MPMF-AP-14** Onboarding-lock-in analog — no progress-bar pressure ("you're 75% to upgrading!" forbidden); no requirement to act before continuing.

**Inline-prompt-specific anti-patterns refused (not formal MPMF-AP entries; visual/animation rules):**
- ✗ Pulsing / blinking / color-shift animation on the prompt to draw attention
- ✗ Auto-scrolling to bring prompt into view if user scrolled past
- ✗ "Confirm dismissal" sub-prompt on ✕ tap (single-tap dismiss; trust the user)
- ✗ Re-rendering at different position after dismissal (the prompt is gone from this surface for cooldown duration; doesn't move to top of screen / bottom / sidebar)

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines:

- **#1 Opt-in enrollment for data collection** — telemetry events respect consent gate.
- **#2 Full transparency on demand** — prompt clearly states tier name + price + factual feature description.
- **#3 Durable overrides on billing state** — N/A (not a billing action).
- **#4 Reversibility** — dismissal cooldown is reversible (user can navigate to pricing-page anytime; cooldown only suppresses re-rendering of this prompt).
- **#5 No streaks / shame / engagement-pressure** — no animation; no countdown; no "you've been on free for X days" pressure. Test: visual-regression test confirms no animation; CI-grep refused strings.
- **#6 Flat-access** — N/A directly (single-CTA prompt; no tier comparison).
- **#7 Editor's-note tone** — CI-linted forbidden-string check on `upgradePromptCopy.js` generator. Test: `scripts/check-commerce-copy.sh`.
- **#8 No cross-surface contamination** — prompt suppressed on TableView during active hand (H-SC01) + on presession-preparer surfaces. Test: mock active-hand state + render any host surface; assert no prompt renders.
- **#9 Incognito observation mode** — telemetry events respect consent gate.
- **#10 No dark-pattern cancellation** — N/A (proactive surface, not cancellation).

---

## Cross-surface dependencies

- **Host surfaces (5)** — `SessionsView` recap (session-recap context), `HandReplayView` review panel (post-hand-review context), `SettingsView/BillingSettings` (settings-billing context, expanded variant), `SessionsView` row indicators (session-list-row context, compact "Plus required" badge variant), drill views (drills-list context).
- **`PricingView`** (S1) — destination of CTA.
- **`useUI`** — `isHandInProgress()` H-SC01 check.
- **`EntitlementContext`** — entitlement check.
- **`upgradePromptCopy.js`** — CI-linted copy generator.
- **`scripts/check-commerce-copy.sh`** — enforces forbidden-string list for upgrade-prompt copy along with cancellation + plan-change + paywall.

---

## Known behavior notes

- **Per-host-context cooldown is by design.** User dismissing on `session-recap` shouldn't preclude prompt on `settings-billing` — different contexts, different commercial moments.
- **Sub-shape tailoring is invisible to user.** No "We see you're a live player — here's the live-tracking pitch!" copy. Tailoring is just word-choice in the headline; user sees one tailored headline, never compares variants.
- **Newcomer-threshold integration.** Prompt component checks `userHandsSeenCount` against `CONSTANTS.UPGRADE_PROMPT_NEWCOMER_THRESHOLD` (default 25, mirroring EAL-G4-NC); below threshold, suppressed with reason `'newcomer-threshold'`.
- **Returning-evaluator 2-hour window.** Window is measured from `lastReturnAfterDriftAt` (set by evaluator-onboarding journey Variation E). If user has multiple drift-returns, each resets the 2h timer.
- **Telemetry "shown" events count actual renders, not theoretical opportunities.** Suppressed instances fire `upgrade_prompt_suppressed` with reason — useful for measuring how often suppressions happen vs renders.
- **No A/B testing of prompt copy initially.** Per Q1=A doctrine — won't experiment with conversion-coercive variants. May A/B test "doctrine-explicit copy" vs "factual baseline" per assumption M6 kill-criterion (Stream D Phase 2+).
- **Settings-billing expanded variant is the only multi-line variant.** All other contexts use compact single-line variant.
- **Session-list-row context is special.** It's not a full UpgradePromptInline; it's a "Plus required" badge on prior-session rows for free-tier users. Tap → opens PaywallModal Variation A (history-access). Treated as a context here for cooldown unification purposes.
- **No "ask me later" affordance.** Dismissal is dismissal; cooldown is fixed at 7 days. No "remind me in 30 days" / "remind me at next session-end" choice — would create cognitive overhead + opportunity for dark patterns.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future findings:
- [UPI-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `UpgradePromptInline.test.jsx` — compact + expanded variants render; sub-shape-tailored copy correct; ✕ dismisses + writes cooldown; CTA routes to pricing-page.
- `useUpgradePromptVisibility.test.js` — all suppression reasons (cooldown / mid-hand / presession / returning-evaluator-window / newcomer-threshold / paid-tier) return correct values.
- `upgradePromptCopy.test.js` — generator outputs per (subShape, hostContext) combination; CI-grep refused strings.

### Integration tests (Phase 5)

- `UpgradePromptInline.e2e.test.jsx` — render in session-recap context → dismiss → cooldown active → re-render same surface = suppressed.
- `UpgradePromptCrossSurface.e2e.test.jsx` — dismiss on session-recap → navigate to settings-billing → prompt renders on different context.
- `UpgradePromptMidHand.e2e.test.jsx` — mock active hand state; assert no prompt renders on host surfaces during hand.
- `UpgradePromptPresession.e2e.test.jsx` — mock presession-preparer state; assert prompt suppressed on session-prep surfaces.
- Red-line #5 visual-regression test: no animation on prompt mount/render.

### Visual verification

- Playwright MCP 1600×720 screenshot, 5 scenarios:
  1. Compact variant in session-recap context (E-CHRIS sub-shape).
  2. Compact variant in session-recap context (E-SCHOLAR sub-shape — drill-relevant copy).
  3. Compact variant in session-recap context (no-sub-shape default).
  4. Expanded variant in settings-billing context.
  5. Session-list-row "Plus required" badge variant.

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S3-COMPACT-CHRIS`
- `EVID-PHASE5-MPMF-S3-COMPACT-SCHOLAR`
- `EVID-PHASE5-MPMF-S3-COMPACT-DEFAULT`
- `EVID-PHASE5-MPMF-S3-EXPANDED`
- `EVID-PHASE5-MPMF-S3-SESSION-ROW-BADGE`

---

## Phase 5 code-path plan

**New files (~4):**
1. `src/components/ui/UpgradePromptInline.jsx`
2. `src/hooks/useUpgradePromptVisibility.js`
3. `src/utils/entitlement/upgradePromptCopy.js`
4. `src/constants/upgradePromptContexts.js`

**Amended files (~5):**
- `src/components/views/SessionsView/SessionRecap.jsx` (or equivalent post-cashout surface) — embed UpgradePromptInline.
- `src/components/views/HandReplayView/ReviewPanel.jsx` — embed below VillainAnalysisSection (or beside Section G capture per sibling-component layout).
- `src/components/views/SettingsView/BillingSettings.jsx` — embed expanded variant.
- `src/components/views/SessionsView/SessionRow.jsx` — render "Plus required" badge variant for free-tier users on prior-session rows.
- `src/components/views/PostflopDrillsView/DrillsList.jsx` (or equivalent) — embed compact variant for Scholar context.
- `src/utils/telemetry/eventSchema.js` — upgrade-prompt events.

---

## Change log

- 2026-04-25 — v1.0 authored as Gate 4 Batch 4 artifact (MPMF-G4-S3). Inline widget shared across 5 host contexts (session-recap / post-hand-review / settings-billing / session-list-row / drills-list) with compact + expanded variants. Sub-shape-tailored copy (E-CHRIS / E-SCHOLAR / E-IGNITION). H-N07 7-day cooldown per host context. Suppression rules: H-SC01 mid-hand + presession-preparer + returning-evaluator-2h-window + newcomer-threshold + paid-tier + cooldown. 10 red-line compliance with per-line test target + Phase 5 code-path plan ~4 new files + 5 host surface integrations. Inline-prompt-specific anti-patterns refused (animation / auto-scroll / confirm-dismissal / re-rendering-elsewhere). Zero code changes (surface-spec only).
