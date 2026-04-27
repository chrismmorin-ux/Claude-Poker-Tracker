# Surface — Telemetry Consent Panel

**ID:** `telemetry-consent-panel`
**Parent surface:** Two entry points — first-launch modal overlay (pre-main-app) + mirror panel in `SettingsView`. This spec covers both.
**Product line:** Main app. Extension inherits consent state read-only via WebSocket bridge per entitlement-architecture; extension never surfaces its own consent UI.
**Tier placement:** Free+ (consent is universal; applies regardless of paid state).
**Last reviewed:** 2026-04-24 (Gate 4 Batch 2)

**Code paths (future — Phase 5 of monetization-and-pmf project):**
- `src/components/views/FirstLaunchTelemetryPanel.jsx` (new — first-launch modal variant)
- `src/components/views/SettingsView/TelemetrySection.jsx` (new — settings mirror variant)
- `src/components/ui/TelemetryCategoryRow.jsx` (new — per-category toggle row, shared by both variants)
- `src/hooks/useTelemetryConsent.js` (new — consent-state hook; reads from `settings` IDB store)
- `src/utils/telemetry/consentGate.js` (new — event-emitter gate; no event fires if category opted-out)
- `src/utils/telemetry/postHogAdapter.js` (new — wraps `posthog-js` with consent gate)
- `src/constants/telemetryCategories.js` (new — frozen category enum + labels)
- `src/reducers/settingsReducer.js` (existing — extended with `SET_TELEMETRY_CONSENT` action per category)

**Related docs:**
- `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red line #1 (opt-in enrollment) + #2 (transparency on demand) + #9 (incognito observation mode non-negotiable)
- `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q8 (telemetry consent default — verdict B opt-out with first-launch transparency panel)
- `docs/projects/monetization-and-pmf/anti-patterns.md` §MPMF-AP-04 (re-engagement push notifications refused) + §MPMF-AP-10 (pre-paywall friction refused) + §MPMF-AP-13 NEW (telemetry-consent-nag refused)
- `docs/projects/monetization-and-pmf/assumption-ledger.md` §M6 (doctrine-as-positioning-wedge — consent UX is part of the wedge) + §M13 (first-60-sec wow — consent panel must not interfere)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` §Extension side (extension reads consent via bridge; never writes)
- `docs/design/jtbd/domains/cross-cutting.md` §CC-88 (honest telemetry transparency — primary JTBD)
- `docs/design/personas/core/evaluator.md` §Autonomy constraint inheritance
- `docs/design/personas/situational/trial-first-session.md` §Frustrations ("Signup walls before first value")
- `docs/design/surfaces/hand-replay-observation-capture.md` §Modal — Incognito toggle (structural-guarantee pattern; inherited here for per-category toggle permanence)
- `docs/design/heuristics/poker-live-table.md` §H-SC02 (trial-state-legible-outside-settings — consent state mirrors this principle for data-collection state)

---

## Purpose

Make it structurally impossible for telemetry events to fire without the user knowing what's being collected and having a one-tap off-switch always available. Per Q8=B, telemetry defaults to ON for new installs, but:
- A first-launch panel names every collection category + what is NOT collected (no PII, no dollar amounts, no hand content) + provides one-tap per-category off-switches before the user proceeds into the app.
- A mirror panel in `SettingsView` reproduces the first-launch state with the same toggles; reversible at any time.
- Consent state gates the telemetry event-emitter at the source — events of an opted-out category are dropped before transmission, never sent-then-discarded.

This surface is **load-bearing for three autonomy red lines** (#1 opt-in enrollment + #2 transparency on demand + #9 incognito observation mode non-negotiable) and for the Evaluator persona's first-impression invariant: the evaluator must see exactly what the app collects before any event fires.

Non-goals (explicit):
- **Not a feature-gate surface.** Consent is orthogonal to tier. Free-tier and paid-tier users see the same consent panel.
- **Not a re-prompt surface.** Once shown, the first-launch panel does NOT re-fire (MPMF-AP-13 NEW refuses telemetry-consent-nag).
- **Not a marketing surface.** No copy like "Help us improve!" / "Join the community by sharing data!" The copy is factual — what's collected, what's not, how to opt out.
- **Not a progressive-consent surface.** No "Unlock X feature by enabling telemetry." Consent is never coupled to commerce or feature access.

---

## JTBD served

Primary:
- **`JTBD-CC-88`** — Have the app observe my usage honestly and transparently. The panel + mirror are the entire surface path for this JTBD.

Secondary:
- **`JTBD-SA-71`** — Try the product before paying (Evaluator). First-launch panel is part of pre-value ceremony; must be fast (~30s to dismiss-or-configure) to respect the 60-second wow threshold per M13.
- **`JTBD-SA-72`** — Understand what's free/paid/why. Not direct (telemetry is orthogonal to tier), but inherits the transparency principle.

Not served (explicit non-goals):
- **`JTBD-MH-*`** — mid-hand. Consent panel never surfaces on live-play.
- **`JTBD-DS-*`** — drills/study. Consent is not feature-specific.

---

## Personas served

**Primary:**
- **`evaluator` (core)** — first-launch panel is the evaluator's first commerce-adjacent touchpoint. Must not feel like a signup wall. ≤ 30 second to dismiss-or-configure budget.
- **`trial-first-session`** — binding for the 60-second wow threshold (M13). Panel must not delay first value by more than ~15 seconds for users who dismiss with defaults.
- **`returning-evaluator`** — Settings mirror panel accessible in ≤ 2 taps; allows configuration adjustment on return visit. First-launch panel does NOT re-fire for returning-evaluator (seen-already state stored in IDB).

**Secondary:**
- **`chris-live-player`** — owner uses Settings panel to verify + configure own telemetry posture; will likely opt into all categories to contribute to dogfood data.
- **`post-session-chris` / `between-hands-chris` / `mid-hand-chris`** — consent panel never fires in these contexts (H-SC01 extension: consent UX is never an interruption).

**Explicitly excluded:**
- **`mid-hand-chris`** — consent panel cannot render on live-play surfaces; cannot interrupt a hand. First-launch timing is pre-any-main-app-surface; if triggered on app re-install during live session (edge case), panel defers until session close (H-SC01 + red line #8).

---

## Anatomy

### First-launch variant — `FirstLaunchTelemetryPanel`

Full-screen modal on first install (no background; app not yet loaded behind it). Shows BEFORE any other UI including onboarding. Single dismiss path (the Continue button) writes consent state + sets "first-launch seen" flag + closes panel + loads app.

```
┌── Telemetry & Privacy ──────────────────────────────────┐
│                                                          │
│  Before you use the app, here's what it collects and    │
│  what you can turn off. You can change any of these     │
│  later in Settings.                                      │
│                                                          │
│  ┌── Usage events ────────────────────── [ON ]───────┐ │
│  │ Which screens you visit, which features you use,   │ │
│  │ how long you dwell. Helps us improve what works.   │ │
│  │ NEVER collected: account names, hand content,      │ │
│  │ dollar amounts, personal info.                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Session replay ─────────────────── [ON ]───────┐ │
│  │ Anonymized recording of how you interact with     │ │
│  │ the app — taps, swipes, form entries. Used to     │ │
│  │ find where users get stuck. NEVER collected:      │ │
│  │ text you type into hand notes or villain profiles,│ │
│  │ passwords, payment info.                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Error tracking ──────────────────── [ON ]───────┐ │
│  │ If the app crashes, we log what went wrong.       │ │
│  │ Helps us fix bugs fast.                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Feature flags ───────────────────── [ON ]───────┐ │
│  │ Lets us ship new features to a subset of users to │ │
│  │ test. You'll never be forced into an experiment   │ │
│  │ that changes your core experience.                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  You can change any of this in Settings → Telemetry.    │
│  Turning all of these off will not reduce any feature   │
│  available to you.                                       │
│                                                          │
│                                         [ Continue ]    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Panel contract:**

- **Title:** "Telemetry & Privacy" (factual; not "Welcome!" or "Help us improve!").
- **Intro copy:** "Before you use the app, here's what it collects and what you can turn off. You can change any of these later in Settings." (Factual C5 register.)
- **4 category rows** — each with a clear ON/OFF toggle + description of what's collected + explicit disclosure of what's NOT collected + behavior after opt-out. Order is fixed (no "recommended" ranking — all are equal).
- **Footer assurance:** "You can change any of this in Settings → Telemetry. Turning all of these off will not reduce any feature available to you." This is critical — commits in copy that telemetry is orthogonal to commerce (anti-MPMF-AP-13).
- **Continue button:** single primary action. Always enabled (consent defaults are ON per Q8=B; user may toggle before tapping). Button label is "Continue" (factual; not "Got it!" or "I agree!" — doctrine is opt-out, not consent-in-exchange-for-access).
- **No "skip" or "remind me later" option.** User makes a verdict (even if the verdict is "accept defaults and continue") before entering the app.
- **No dark patterns.** Toggles default ON (per Q8=B verdict) but are equal visual weight whether ON or OFF. The Continue button does not change label based on toggles ("Continue with tracking" / "Continue without tracking" would be dark-pattern framing — avoided).

### Settings mirror variant — `TelemetrySection`

Located in `SettingsView` grid, alongside existing AccountSection + DisplaySettings + GameDefaults. Always accessible in ≤ 2 taps (Settings → Telemetry section is at the top-left of the grid for H-SC02 compliance + discoverability).

```
┌── SettingsView — TelemetrySection slot ─────────────────┐
│                                                          │
│  Telemetry & Privacy                                     │
│  Change what the app collects about your usage.          │
│                                                          │
│  Usage events                                [ON ]────   │
│  Screens visited, features used, dwell time.             │
│                                                          │
│  Session replay                              [ON ]────   │
│  Anonymized interaction recording.                       │
│                                                          │
│  Error tracking                              [ON ]────   │
│  Crash reports when the app breaks.                      │
│                                                          │
│  Feature flags                               [ON ]────   │
│  Opt-in feature experiments.                             │
│                                                          │
│  [ View what's never collected ]                         │
│                                                          │
│  Last updated: 2026-04-24 11:42 AM                       │
└──────────────────────────────────────────────────────────┘
```

**Mirror contract:**

- **Same 4 category rows** as first-launch; states persisted across launches.
- **"View what's never collected" expander** — on tap, expands inline or opens a small drawer listing: account names / hand content / dollar amounts / personal info / passwords / payment info / villain-profile text / incognito observations.
- **"Last updated" timestamp** — informational (transparency). When user toggles any category, this timestamp updates.
- **No "reset to defaults" button** — dark-pattern vector. If user wants all-ON, they toggle each individually. Removes the "reset → back to defaults → dark-pattern subtle re-enable" anti-pattern.

### TelemetryCategoryRow — shared component

Used in both variants:

```
┌── category name (bold) ────────────────── [ON ]────┐
│ description (14pt regular, 2 lines max)             │
│ [optional: NEVER collected disclosure for sensitive │
│  categories — usage-events + session-replay only]   │
└─────────────────────────────────────────────────────┘
```

- **Toggle:** standard ON/OFF affordance (not a checkbox — semantic toggle for "active/inactive" state). ≥ 44×44 DOM px touch target (H-ML06).
- **Tap anywhere on row** flips the toggle (large-target pattern for accessibility + thumb-reach).
- **Toggle change triggers** immediate write to `settings` store via debounced reducer action (400ms debounce per existing settings-write pattern). No "Save" button required at section level.
- **Visual distinction** between ON and OFF is color + position (classic toggle); equal weight (no "ON is brighter" or "OFF is warning-colored" dark pattern).

---

## State

### Consent state — `settings.telemetry` (new sub-object in existing `settings` IDB store)

```js
{
  firstLaunchSeenAt: string | null,   // ISO8601; null until first-launch panel dismissed
  categories: {
    usageEvents: boolean,     // Q8=B default true
    sessionReplay: boolean,   // Q8=B default true
    errorTracking: boolean,   // Q8=B default true
    featureFlags: boolean,    // Q8=B default true
  },
  lastUpdatedAt: string,      // ISO8601
}
```

### Hook — `useTelemetryConsent()`

```js
const {
  firstLaunchSeen,      // boolean — has the user seen the first-launch panel?
  categories,           // { usageEvents, sessionReplay, errorTracking, featureFlags }
  isCategoryEnabled,    // (category) => boolean
  setCategoryEnabled,   // (category, enabled) => void — writes to IDB via reducer
  markFirstLaunchSeen,  // () => void — writes firstLaunchSeenAt = now()
} = useTelemetryConsent();
```

### Event-emitter gate — `src/utils/telemetry/consentGate.js`

Every PostHog event fires through this gate:

```js
export function emitEvent(category, eventName, properties) {
  const consent = getTelemetryConsent();  // synchronous read from in-memory mirror
  if (!consent.categories[category]) return;  // silent drop
  posthog.capture(eventName, properties);
}
```

**Critical:** the gate is the structural guarantee for red line #1. Events cannot bypass it because the `posthog.capture` call is wrapped at import time — no component can call `posthog.capture` directly.

### First-launch trigger

Check `firstLaunchSeenAt === null` at app root mount → if true, mount `FirstLaunchTelemetryPanel` as the FIRST surface (before routing, before any context that writes events). Panel is dismissed via `markFirstLaunchSeen()` which sets `firstLaunchSeenAt = now()` + dismounts the panel.

---

## Props / context contract

### `FirstLaunchTelemetryPanel` props

None — self-contained. Reads from `useTelemetryConsent()` and `useUI()` for routing dismissal.

### `TelemetrySection` (Settings mirror) props

None — self-contained in SettingsView grid.

### `TelemetryCategoryRow` props

- `category: 'usageEvents' | 'sessionReplay' | 'errorTracking' | 'featureFlags'`
- `label: string` — display name from `src/constants/telemetryCategories.js`
- `description: string`
- `neverCollected?: string[]` — optional list of explicitly-not-collected items (for usage-events + session-replay)
- `enabled: boolean`
- `onToggle: (category, newState) => void`

### Context consumed

- `useTelemetryConsent()` — category state + setters.
- `useUI()` — for modal dismissal on first-launch variant.

---

## Key interactions

### First-launch flow

1. App first-install → main.jsx renders `<AppRoot>` → `useTelemetryConsent()` hydrates from IDB → `firstLaunchSeen === false`.
2. AppRoot renders `<FirstLaunchTelemetryPanel>` BEFORE any routing — no other UI is visible. No telemetry events fire during this phase (gate blocks everything regardless of consent state since `firstLaunchSeen` is still false).
3. User sees 4 category rows + intro + footer + Continue button. All 4 toggles default ON per Q8=B.
4. User toggles any category (optional). Toggle writes immediately via debounced reducer action.
5. User taps Continue → `markFirstLaunchSeen()` fires → `firstLaunchSeenAt = now()` → panel unmounts → routing resumes → main app loads.
6. From this point, telemetry events fire through the consent gate per current category state.

### Settings mirror flow

1. User navigates to `SettingsView` (main nav → Settings).
2. TelemetrySection renders as a grid card (top-left position for discoverability).
3. User sees current category state + can toggle. Toggle writes immediately; no save button; "Last updated" timestamp updates.
4. User can expand "View what's never collected" for full disclosure.

### Per-event gating (runtime)

1. Any code calls `emitEvent('usageEvents', 'session_started', { sessionId })`.
2. `consentGate.emitEvent` reads current consent state from in-memory mirror (hydrated from IDB at boot, updated on reducer action).
3. If `categories.usageEvents === false`, event is silently dropped. No PostHog call. No error.
4. If `categories.usageEvents === true`, PostHog adapter is invoked with the event.

### Edge cases

- **User opts out all 4 categories:** app functions fully; no events fire; no nag UI; no "are you sure?" dialog. This is the expected respectful path.
- **Consent state changes mid-session:** toggle fires → reducer writes → in-memory mirror updates → next `emitEvent` call uses new state. No need to "flush" anything.
- **Extension reads consent via WebSocket bridge:** extension requests consent state on connection; uses it to gate its own (if any) event emission. Extension NEVER writes consent state — MPMF-P8-EX rule.
- **First-launch panel interrupted by OS-level event (phone sleep during first launch):** panel remains; state preserved; on resume, panel is still the active surface. User finishes or dismisses.
- **User clears IDB / reinstalls app:** first-launch panel fires again on next install. This is correct behavior — consent is tied to the install, and a fresh install is a new consent context.

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **MPMF-AP-04 — Re-engagement push notifications.** No push channel for monetization exists. Telemetry consent never pushes a notification to the user asking them to re-enable.
- **MPMF-AP-10 — Pre-paywall friction.** First-launch panel is NOT a paywall; it's a consent panel. Consent is not coupled to paid access. User who opts out of all telemetry can still use the free tier fully.
- **MPMF-AP-13 NEW — Telemetry-consent-nag.** Once dismissed, the first-launch panel does not re-fire. No "you haven't enabled session replay — try it?" prompts. No "help us by enabling X" nudges. Mirror panel in Settings is the only ongoing touch point.

New anti-patterns identified during this authoring (promoted to `anti-patterns.md`):
- **MPMF-AP-13 NEW — Telemetry-consent-nag.** Re-prompting users to reconsider opt-outs. Refused.

---

## Red-line compliance checklist (Gate 5 test targets)

All 10 commerce red lines enumerated; each has a testable assertion on this surface. Map to MPMF-G5-RL backlog:

- **#1 Opt-in enrollment for data collection** — STRUCTURAL. Consent gate blocks all events until `firstLaunchSeen === true` + category enabled. Test: mount AppRoot with fresh IDB; spy on `posthog.capture`; assert zero calls before panel dismissed.
- **#2 Full transparency on demand** — STRUCTURAL. Both variants list every category + "NEVER collected" disclosure. Test: DOM contains all 4 category labels + disclosure items.
- **#3 Durable overrides on billing state** — N/A directly (billing-specific). But consent-state overrides are durable — once user opts out, no code path re-enables without explicit user toggle.
- **#4 Reversibility** — Settings mirror provides full reversal path; ≤ 2 taps from anywhere. Test: from any main route, count taps to reach TelemetrySection.
- **#5 No streaks / shame / engagement-pressure** — No notification re-prompts; no badges; no "you've been off telemetry for 30 days!" messages. Test: no notification code paths reference telemetry state.
- **#6 Flat-access** — N/A (access-level concern; applies to tier, not consent).
- **#7 Editor's-note tone** — Copy is factual; no "please help us!" or "join our mission!" framing. Test: CI-grep refused strings against Panel copy.
- **#8 No cross-surface contamination** — Panel never renders on live-play. Extension reads consent but doesn't surface consent UI itself. Test: H-SC01 assertion — panel cannot mount during `isHandInProgress() === true`.
- **#9 Incognito observation mode non-negotiable** — Each category toggle is the incognito gate for that category. Always visible. Always reversible. Test: assert each toggle is reachable in the DOM regardless of tier / entitlement state.
- **#10 No dark-pattern cancellation** — N/A (cancellation-specific). But the principle extends: opting out of telemetry is cancellation-grade simple — one toggle, immediate, no "are you sure?" dialog.

---

## Known behavior notes

- **Consent-default rationale inline in copy.** The footer line "Turning all of these off will not reduce any feature available to you" is doctrinally important — commits that telemetry is orthogonal to commerce in the product's honest posture.
- **Session replay "NEVER collected" disclosure** is important for trust — poker data is high-sensitivity; explicit disclosure that villain-profile text + hand notes are never in replay data preempts the biggest objection.
- **"Feature flags" description** reassures users they won't be force-experimented-on against their will for core features. Crucial for experimenters-are-users M6 assumption validation.
- **Consent state persists across tier changes.** Upgrading to Pro doesn't silently re-enable previously opted-out telemetry categories.
- **PostHog-for-Startups credit applies** — $50K credit covers expected Phase 1 volume. Gate 5 applies for the credit before first install.

---

## Known issues

None at creation — new surface. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation.

Placeholder for future audit findings:
- [TCP-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target)

- `FirstLaunchTelemetryPanel.test.jsx` — renders all 4 categories; Continue writes `firstLaunchSeenAt`; toggle writes via reducer.
- `TelemetrySection.test.jsx` — renders; toggle updates "Last updated" timestamp.
- `TelemetryCategoryRow.test.jsx` — tap-anywhere toggle; ≥ 44×44 size.
- `useTelemetryConsent.test.js` — hydrates from IDB; defaults match Q8=B verdict; setters write.
- `consentGate.test.js` — `emitEvent` drops events when category opted-out; passes through when enabled.

### Integration tests (Phase 5)

- `FirstLaunch.e2e.test.jsx` — fresh-install flow: IDB empty → app loads → panel shows → user toggles → Continue → app enters main route.
- Red-line assertion suite (MPMF-G5-RL) — 10 assertions per red-line compliance checklist above. Specifically: no-events-before-dismissed, consent-gate-blocks, opt-out-immediate.

### Visual verification

- Playwright MCP 1600×720 screenshot, 4 scenarios:
  1. First-launch panel with all defaults (4 categories ON).
  2. First-launch panel with user-toggled configuration (2 categories OFF).
  3. Settings mirror with mixed state.
  4. Settings mirror with expander open ("View what's never collected").

### Playwright evidence pending

- `EVID-PHASE5-MPMF-S6-FL-DEFAULT` — first-launch with defaults.
- `EVID-PHASE5-MPMF-S6-FL-TOGGLED` — first-launch with opt-outs.
- `EVID-PHASE5-MPMF-S6-SETTINGS-MIRROR` — Settings mirror panel.
- `EVID-PHASE5-MPMF-S6-NEVER-COLLECTED` — expander disclosure.

---

## Cross-surface dependencies

- **`SettingsView`** — hosts Settings mirror variant. Adds `TelemetrySection` card to existing grid at top-left position for H-SC02 compliance.
- **`AppRoot`** — renders first-launch variant BEFORE routing when `firstLaunchSeen === false`.
- **All views using telemetry events** — events pass through `consentGate`; consumers don't know about the gate (transparent to caller).
- **Extension (`ignition-poker-tracker/`)** — reads consent state via existing WebSocket bridge; uses it to gate its own event emission. Extension NEVER surfaces consent UI of its own (MPMF-P8-EX rule).
- **`settings` IDB store** — extended with `telemetry` sub-object. Additive migration; no schema break.

---

## Phase 5 code-path plan

**New files (~8):**
1. `src/components/views/FirstLaunchTelemetryPanel.jsx`
2. `src/components/views/SettingsView/TelemetrySection.jsx`
3. `src/components/ui/TelemetryCategoryRow.jsx`
4. `src/hooks/useTelemetryConsent.js`
5. `src/utils/telemetry/consentGate.js`
6. `src/utils/telemetry/postHogAdapter.js`
7. `src/constants/telemetryCategories.js`
8. Test files for each of the above.

**Amended files (~3):**
- `src/reducers/settingsReducer.js` — new action types + state shape extension.
- `src/utils/persistence/database.js` — IDB migration includes `settings.telemetry` sub-object default population.
- `src/components/views/SettingsView/SettingsView.jsx` — grid gains TelemetrySection card.

**Package.json:**
- `posthog-js` dependency added (or equivalent).

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Batch 2 artifact (MPMF-G4-S6). Full anatomy + state + interactions + 10-red-line compliance checklist + anti-pattern refusal cross-references + Phase 5 code-path plan + test-coverage spec. Surfaced new anti-pattern MPMF-AP-13 (telemetry-consent-nag). Zero code changes (surface-spec only).
