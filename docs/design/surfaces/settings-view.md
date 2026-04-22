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
