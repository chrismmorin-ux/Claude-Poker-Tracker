# Surface — Settings View

**ID:** `settings-view`
**Code paths:**
- `src/components/views/SettingsView/SettingsView.jsx` (132 lines — thin orchestrator)
- `./DisplaySettings.jsx` — theme / density / scale
- `./GameDefaults.jsx` — default venue / game type / stakes
- `./VenuesManager.jsx` — custom venue CRUD
- `./GameTypesManager.jsx` — custom game-type CRUD
- `./DataAndAbout.jsx` — reset, export, version info
- `./ErrorLogPanel.jsx` — captured errors dump
- `src/components/ui/AccountSection.jsx`, `./EmailVerificationBanner.jsx`
- Contexts: `SettingsContext`, `AuthContext`, `UIContext`, `ToastContext`

**Route / entry points:**
- `SCREEN.SETTINGS`.
- Opens from: bottom-nav / menu; account-related deep links (post-signup, verify-email).
- Closes to: `TableView` via "Back to Table"; `LOGIN` / `SIGNUP` via AccountSection.

**Product line:** Platform (spans main app; distinct from engine / live-table)
**Tier placement:** Free+ (auth + display + venues). Cloud sync / multi-device is Plus+ (paused per F-W3). Cryptographically-signed sessions (F-P18) is Studio.
**Last reviewed:** 2026-04-21

---

## Purpose

Single surface for account, display preferences, venue / game-type catalog, data hygiene (reset / export), and diagnostic error log inspection. Two-column panel grid that avoids burying any category behind a tab.

## JTBD served

Primary:
- `JTBD-SA-64` free tier with real value (surface for tier awareness + upgrade)
- `JTBD-SA-65` tier comparison before purchase (via AccountSection, when wired)
- `JTBD-SA-66` transparent billing + easy pause (paused pending payments infra)
- `JTBD-SA-70` local-only mode (no cloud) with full features
- `JTBD-DE-72` raw JSON / CSV export (in DataAndAbout)
- `JTBD-DE-75` full-archive export on leave
- (platform) manage custom venues / game types used across the app

Secondary:
- `JTBD-CC-81` accessibility modes — DisplaySettings has theme but not full color-blind mode yet (F-P19 proposed)
- `JTBD-MT-60..63` multi-device sync — surface exists but paused per F-W3
- (diagnostics) error-log inspection for support / bug reports

## Personas served

- All personas — platform surface.
- [Chris](../personas/core/chris-live-player.md) — customizes venues / game defaults
- [Traveler](../personas/core/traveler.md) — multi-currency pain point lives here (F-P14)
- [Ringmaster](../personas/core/ringmaster-home-host.md) — custom game types for home games
- [Analyst / API user](../personas/core/analyst-api-user.md) — would use this for future API keys / webhooks (F-P15; not served)
- [Banker / Staker](../personas/core/banker-staker.md) — future signed-session toggles (F-P18; not served)

---

## Anatomy

```
┌────────────────────────────────────────────────┐
│ Settings                         [Back to Table]│
├────────────────────────────────────────────────┤
│ EmailVerificationBanner (when unverified user) │
├────────────────────────────────────────────────┤
│ 2-column grid:                                 │
│   ┌──────────────┐   ┌──────────────┐          │
│   │ Account      │   │ Display      │          │
│   ├──────────────┤   ├──────────────┤          │
│   │ Game Defaults│   │ Venues       │          │
│   ├──────────────┤   ├──────────────┤          │
│   │ Game Types   │   │ Data / About │          │
│   ├──────────────┤   ├──────────────┤          │
│   │ Error Log    │   │              │          │
│   └──────────────┘   └──────────────┘          │
└────────────────────────────────────────────────┘
```

Wrapped in `ScaledContainer` with `LAYOUT.TABLE_WIDTH/HEIGHT`.

## State

- **Settings context (`useSettings`):** `settings`, `isLoading`, `updateSetting`, `resetSettings`, `allVenues`, `allGameTypes`, `allGameTypeKeys`, `addCustomVenue`, `removeCustomVenue`, `addCustomGameType`, `removeCustomGameType`.
- **Auth (`useAuth`):** `user`, `isAuthenticated`, `isInitialized`, `sendVerificationEmail`.
- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`.
- **Toast (`useToast`):** `showSuccess`, `showError`, `showWarning`.
- **Local:** none — view is effectively stateless; each panel owns its own local state.
- Writes: IDB `settings` store via `SettingsContext`; auth side-effects via Firebase (auth paused areas may no-op).

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Back to Table** → `setCurrentScreen(SCREEN.TABLE)`.
2. **AccountSection**: sign in / sign up / sign out / send verification email.
3. **DisplaySettings**: toggle theme / density / scale multiplier.
4. **GameDefaults**: set default venue / game-type / stakes — consumed by `SessionForm`.
5. **VenuesManager** / **GameTypesManager**: add, rename, delete custom entries.
6. **DataAndAbout**: reset settings, trigger export, view version info.
7. **ErrorLogPanel**: inspect captured errors from `errorHandler` + clear.

---

## Known behavior notes

- **Loading guard** renders a "Loading settings..." placeholder while `SettingsContext` hydrates from IDB.
- **Email verification banner** renders above the panel grid when the user is signed in and unverified.
- **Panel composition** — all subpanels receive explicit props (not context) so each is individually testable without mounting the view.
- **Reset settings** is an irreversible destructive action; today relies on explicit dialog in DataAndAbout.
- **Paused surfaces** — F-W3 (Firebase Cloud Sync) — UI here is dormant; infrastructure exists but no active sync toggle.

## Known issues

- **DCOMP-W4-A4 audit shipped 2026-04-22 — verdict YELLOW.** Cleanest W4 surface — no P0 findings. 4 P1: F1 Reset to Defaults lacks toast+undo (two-click-confirm ≠ undo); F2 Hand Simulator Clear silent (non-dev-gated); F3 touch targets (Back/toggles/Add/Reset) measure 32-41px, under ≥44; F4 inputs lack inputMode=decimal/numeric. 5 P2 polish: F5 Backup Frequency disabled-row takes full real-estate; F6 Theme toggle visually-active-styled but disabled; F7 Add-button color inconsistent (purple vs teal); F8 errorReportingEnabled plumbing unclear; F9 AccountSection not dismissible for local-first users. 3 P3/deferred. Full audit: `../audits/2026-04-22-settings-view.md`. Fixes queued as DCOMP-W4-A4-F1..F12.
- Wave 4 audit COMPLETE for settings-view. **ALL 4 W4 AUDITS NOW SHIPPED.**

## Potentially missing

- **Accessibility modes** (F-P19) — color-blind + low-light modes not yet.
- **Multi-currency / FX** (F-P14) — not served; Traveler persona pain.
- **Tax-friendly export** (DE-71) — only raw JSON ships today.
- **API keys / webhooks** (F-P15) — not served; Analyst persona pain.
- **Signed-session toggle** (F-P18) — Studio tier; not served.

---

## Test coverage

- No dedicated view-level test file; each subpanel has its own tests in its directory.
- `SettingsContext` + IDB settings store tested via context + persistence hook tests.

## Related surfaces

- `sessions-view` — consumes venue / game-type defaults.
- `table-view` — consumes display settings (scale, theme).
- Auth views (`LOGIN`, `SIGNUP`, password reset) — routed from AccountSection.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-22 — DCOMP-W4-A4 audit appended. Verdict YELLOW — no P0. 12 findings (4 P1, 5 P2, 3 P3).
- 2026-05-02 — PIO Gate 4 SET subsection appended (SPR-021 / WS-007). New "Privacy" section with master "Photo capture enabled" toggle. Implementation deferred to PIO Gate 5 multi-PR.
- 2026-06-06 — Venue notes (Sessions View Improvement Phase 1). VenuesManager gains a per-venue free-text note. See `../audits/2026-06-06-entry-venue-notes.md` and the section below.
- 2026-06-06 — Portrait-native fluid layout. `SettingsView` dropped `ScaledContainer` / the fixed 1600×720 frame; the 2-column panel grid is now `grid-cols-1 md:grid-cols-2` inside a fluid `max-w-5xl` container so venue/game-default fields stay legible on a phone. `SCREEN.SETTINGS` added to `VIEW_TO_ORIENTATION='portrait'`. See `../audits/2026-06-06-entry-sessions-settings-portrait.md`.
- 2026-06-12 — EAL-G4-SET subsection appended (WS-222 / SPR-124). New "Anchor Calibration" section card with observation-enrollment toggle — the missing UI dispatch site for red line #1's opt-in. Gate 1 audit: `../audits/2026-06-12-entry-anchor-enrollment-settings.md` (GREEN). Implemented same session.
- 2026-06-13 — EAL-G4-RESET subsection appended (WS-221 / SPR-126). New "Reset calibration" danger-zone card below the enrollment toggle — global anchor-library calibration reset (red line #4b, arm b of three-way reversibility). Reuses the shared 2-tap confirm + 12s undo. Gate 1 audit: `../audits/2026-06-13-entry-global-anchor-library-reset.md` (GREEN). Implemented same session.

---

## PIO-G4-SET — Photo-capture master toggle (PIO Gate 4 extension, 2026-05-02)

**Added by:** PIO Gate 4 (WS-007 / SPR-021). See `audits/2026-05-02-gate4-design-player-identification-v2.md` §PIO-G4-SET for the full spec.

**What this adds.** A new "Privacy" section in SettingsView with a master toggle for photo capture availability app-wide. Owner-controlled; default ON. When OFF, all Camera Capture Modal entry buttons (PlayerEditor "Add photo", PlayerProfile camera affordance) are HIDDEN. The toggle is the load-bearing AP-PIO-03 (auto-photo-capture refusal) gate.

**Anatomy:**

```
SettingsView body
…
┌─ Privacy ────────────────────────────────────────┐
│  Photo capture                                   │
│   [ ◉ ON  ◯ OFF ]                                │
│   When enabled, Add Photo buttons appear in      │
│   Player Editor and Player Profile.              │
│   Disable for venues that prohibit photography.  │
└──────────────────────────────────────────────────┘
…
```

- Section header: "Privacy" (new section). Gate 5 implementation may decide to host under existing "General" section if Privacy section feels over-scoped for one toggle (acceptable per `feedback_long_term_over_transition.md` — owner is sole user; downplay transition complexity).
- Toggle: master `[ ◉ ON / ◯ OFF ]` radio-style. Default ON.
- Helper copy: factual; non-judgmental ("disable for venues that prohibit photography" frames the use case without shame on disabled state).

**Persistence.**

Toggle state in `userSettings.photoCaptureEnabled` (boolean). Default `true`. Read by `PlayerEditorView` (controls `[ 📷 Add photo ]` button visibility in PEX subsection) and `PlayerProfileView` (controls camera affordance — Phase 2+ photo replace).

**Per-venue casino-policy blacklist deferred to Phase 2+.**

Per Gate 2 §C ratification, v1 ships master toggle only. Per-venue granularity (e.g., "photos disabled at Bellagio; enabled at Aria") is Phase 2+ feature with venue-tagged toggle state. v1 owner manually flips master toggle per session in restrictive venues.

**Anti-pattern compliance:** AP-PIO-03 binding — toggle is the master gate that operationalizes the auto-photo-capture refusal. When OFF, photo capture is impossible app-wide regardless of any other code path. AP-PIO-04 — helper copy is factual, non-judgmental (no shame on disabled state).

---

## EAL-G4-SET — Anchor-calibration enrollment toggle (Gate 4 extension, 2026-06-12)

**Added by:** WS-222 / SPR-124. Gate 1 audit: [`audits/2026-06-12-entry-anchor-enrollment-settings.md`](../audits/2026-06-12-entry-anchor-enrollment-settings.md) (GREEN). Completes the flow specified at `calibration-dashboard.md` §Enrollment banner — the `[ Open Settings ]` CTA finally has a destination control.

**What this adds.** A new "Anchor Calibration" section card with the global observation-enrollment toggle (Q1-A one-toggle pattern). This is the only UI write path for enrollment — autonomy red line #1's opt-in mechanism. Default not-enrolled.

**Anatomy:**

```
SettingsView body
…
┌─ Privacy ────────────────────────────────────────┐
│  (photo capture — unchanged)                     │
└──────────────────────────────────────────────────┘
┌─ Anchor Calibration ─────────────────────────────┐
│  Observation enrollment                          │
│   When enrolled, hands you record contribute     │
│   observations that calibrate the exploit        │
│   model's anchors against real table data. When  │
│   off, the model runs on seed priors and         │
│   simulator results only. Off by default —       │
│   nothing is collected until you enroll.         │
│   [ Enrolled ]  [ Not enrolled ]                 │
└──────────────────────────────────────────────────┘
…
```

- **Placement:** own section card directly after Privacy (founder decision, SPR-124 plan-mode) — clusters the consent-style opt-ins.
- **Control:** two `aria-pressed` buttons (`Enrolled` / `Not enrolled`), ≥44px touch targets, mirrors PrivacySection pattern. Component: `AnchorCalibrationSection.jsx`.
- **Copy:** generated by `buildEnrollmentSettingsCopy()` in `src/utils/anchorLibrary/calibrationCopy.js` — lives in the AP-06 `FORBIDDEN_PATTERNS` enforcement module. Frames enrollment as contributing observations that calibrate the *model*; never "your accuracy" / evaluation-of-owner framing. No urgency, no nag — not-enrolled is a legitimate resting state (red line #5).

**State + persistence.**

- Persisted source of truth: `settings.anchorCalibration.observationEnrollment` (`'enrolled' | 'not-enrolled'`, default `'not-enrolled'`) in the IDB settings store via the existing `useSettingsPersistence` auto-save.
- Runtime read model: `anchorLibraryReducer` `enrollment.observation_enrollment_state`, synced one-directionally by `useAnchorEnrollmentBridge` (in `useAppState`). All consumers keep reading `isEnrolled()` from `AnchorLibraryContext`.
- Section dispatches `SET_ANCHOR_CALIBRATION_ENROLLMENT` only — never `ENROLLMENT_TOGGLED` directly (the bridge would revert any out-of-band write).
- **Coupling note:** Settings "Reset to defaults" also un-enrolls calibration (bridge propagates the default). Intentional — fails safe per red line #1.

**Red-line / anti-pattern compliance:** red line #1 — this toggle IS the opt-in; nothing is collected until it's flipped. Red line #5 — no engagement-pressure copy. AP-06 — model-accuracy framing enforced via `calibrationCopy.js` + DOM-assertion test.

## EAL-G4-RESET — Global anchor-library calibration reset (Gate 4 extension, 2026-06-13)

**Added by:** WS-221 / SPR-126. Gate 1 audit: [`audits/2026-06-13-entry-global-anchor-library-reset.md`](../audits/2026-06-13-entry-global-anchor-library-reset.md) (GREEN). Delivers red line #4b (three-way reversibility, arm b) — the library-wide counterpart of the per-anchor reset in [`journeys/anchor-retirement.md`](../journeys/anchor-retirement.md).

**What this adds.** A "Reset calibration" danger-zone card below the Anchor Calibration enrollment toggle: one owner action that resets calibration across **every** anchor at once, behind the same 2-tap destructive confirm + 12s undo used for per-anchor actions.

**Anatomy:**

```
┌─ Anchor Calibration ─────────────────────────────┐
│  Observation enrollment   [ Enrolled ][ Not… ]   │
└──────────────────────────────────────────────────┘
┌─ Reset calibration ──────────────────────────────┐
│  Restarts Tier 2 calibration for every anchor    │
│  from seed priors. Observation history is        │
│  preserved but no longer contributes to the      │
│  posteriors. There is a short window to undo.    │
│  [ Reset all calibration ]   N anchors           │
└──────────────────────────────────────────────────┘
```

- **Placement:** own danger-zone card directly after the enrollment card (founder decision, SPR-126 plan-mode). Convention — global "reset all" lives in Settings; per-anchor reset stays on the anchor's own surface (Anchor Library / Calibration Dashboard).
- **Control:** a single red destructive button (`Reset all calibration`), ≥44px, **disabled when 0 anchors or library not yet hydrated** (`!isReady`), with an "N anchors" count hint. Component: `AnchorCalibrationResetSection.jsx` (self-contained container; consumes `useAnchorLibrary` + `useToast` + `useLibraryReset`, precedent: `RefresherSettings`/`AdminSection`).
- **Confirm:** reuses the shared pure-props `RetirementConfirmModal` (destructive path: checkbox "I understand all anchor calibration will be reset" gates the red "Reset all" button). Single source of truth — no journey drift.
- **Copy:** generated by `buildLibraryResetCopy(anchorCount)` in `src/utils/anchorLibrary/retirementCopy.js` — under the AP-06 `FORBIDDEN_PATTERNS` enforcement module + the contract suite's streak/proclamation tone sweeps. Evaluates the model's posteriors, never the owner.

**Behavior + persistence.**

- Dispatches `LIBRARY_CALIBRATION_RESET` (single atomic action) → `anchorLibraryReducer` stamps `operator.{lastOverrideAt,lastOverrideBy:'owner',overrideReason:'manual-library-reset',calibrationResetAt}` on every anchor. **Status unchanged. `anchorObservations` untouched.** Writer registry: W-EA-5.
- **Scope (founder decision):** anchors only — calibration posteriors restart from seed priors; raw observation evidence is preserved (red line #3 durability). The matcher reads `calibrationResetAt` to discount pre-reset observations, exactly as per-anchor reset.
- **Undo:** `useLibraryReset` snapshots the prior anchors dict before dispatch; the 12s undo toast dispatches `LIBRARY_CALIBRATION_RESET { restoreAnchors }` to restore the exact prior state.
- Persisted via the existing `useAnchorLibraryPersistence` debounced auto-save.

**Red-line / anti-pattern compliance:** red line #4b — this IS arm (b) of three-way reversibility. Red line #3 — evidence durability preserved (observations kept; undo restores exactly). Red line #5 / AP-06 — no engagement-pressure or graded-work copy; `buildLibraryResetCopy` is under `FORBIDDEN_PATTERNS` + DOM-assertion sweep.
