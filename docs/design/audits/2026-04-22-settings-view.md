# Audit — 2026-04-22 — settings-view

**Scope:** Surface — `settings-view`
**Auditor:** Claude (main) via code inspection + Playwright walk at 1600×720.
**Method:** Direct Gate-4 heuristic audit (no Gate-2 roundtable — not cross-product, no new persona discovery). Nielsen-10 + Mobile-Landscape + Poker-Live-Table heuristics + destructive-action + touch-target lens.
**Status:** Draft.

---

## Executive summary

**Verdict: YELLOW.** Lower severity than W4-A1/A2/A3 — Settings has fewer high-consequence mutations to begin with. But consistent with the pattern: destructive actions (Reset to Defaults, Clear Test Data variants) lack the toast+undo pattern Wave 1 established; most toggle buttons measure 32–36px tall (below ≥44 H-ML06); input fields lack `inputMode="decimal"`/`"numeric"` (H-ML08 pattern from Wave 1 SV-F2 not propagated); and there are polish items around "(coming soon)" dead affordances + inconsistent accent colors for add-actions. No P0 findings. 4 P1 + 5 P2 + 4 P3. Cleanest W4 surface so far.

---

## Scope details

- **Surface audited:** `settings-view` (`SettingsView.jsx` 132 lines + 6 sub-panels totaling ~941 lines)
- **Personas audited against:** All — platform surface; primary scrutiny Chris (venue/game customization), Traveler (multi-currency absence), Ringmaster (custom game types), Analyst (API keys absence)
- **Heuristic sets applied:** Nielsen-10 + Mobile-Landscape + Poker-Live-Table
- **Out of scope:** `LOGIN`/`SIGNUP` auth views (separate surfaces); `ErrorLogPanel` deep-dive (covered by its own sub-panel tests); paused Firebase surfaces (F-W3); Studio-tier deferred features

## Artifacts referenced

- `src/components/views/SettingsView/SettingsView.jsx` + 6 sub-panels
- `src/components/ui/AccountSection.jsx`, `EmailVerificationBanner.jsx`
- `docs/design/surfaces/settings-view.md`
- `docs/design/heuristics/nielsen-10.md`, `mobile-landscape.md`

---

## Findings

### F1 — Reset to Defaults: two-click confirm ≠ undo

- **Severity:** 3 (P1)
- **Situations affected:** Any user adjusting display/theme/defaults + changing mind after confirm
- **JTBD impact:** None named explicitly; reset is an escape-hatch not a JTBD
- **Heuristics violated:** H-N3 user control + freedom (no recovery after commit), Wave-1 pattern (TV-F1, SV-F1 all landed on toast+undo; Settings was not included in Wave 1)
- **Evidence:** `DataAndAbout.jsx:78-88` — `showResetConfirm` flag flips on first click; second click commits; toast-warning shown after but no undo payload.
- **Observation:** Two-click-confirm is defensive but not reversible. Settings values pre-reset are lost; the user can only recover by re-configuring manually. Not as consequential as deleting a session/player (partially mitigated by default-ness of settings) but still consistent-pattern to apply Wave-1 toast+undo.
- **Recommended fix:** Capture pre-reset settings snapshot on confirm; write defaults; show 12s toast "Settings reset to defaults — Undo". Undo restores snapshot. Reuse the TV-F1 undo-token shape.
- **Effort:** S.
- **Risk:** Low — settings shape is small; snapshot is trivial.
- **Proposed backlog item:** `DCOMP-W4-A4-F1 — Reset Settings → toast+undo` (P1)

### F2 — Clear Test Data / Clear Range Data / Clear Sim: silent destructive with no undo

- **Severity:** 3 (P1)
- **Situations affected:** Any dev-tool interaction during testing
- **JTBD impact:** Not user-facing — only relevant in DEV builds (`import.meta.env.DEV` gate)
- **Heuristics violated:** H-N5 error prevention
- **Evidence:** `DataAndAbout.jsx:51-58, 64-68` — clearTestData, clearRangeTestData, simClear all commit silently on single click; only a success toast is shown after.
- **Observation:** Dev-only per the `import.meta.env.DEV` gate (line 228), so prod users never see. But **the Hand Simulator Clear button is NOT dev-gated** (line 212-218) — it's visible in production. A non-dev user who "simulated 50 hands to try it out" then clicks Clear to remove them gets no confirmation, no undo.
- **Recommended fix:** Add toast+undo to the non-dev-gated "Clear Sim" button. Dev tools can stay as-is (dev audience is tolerant; undo overhead not worth it).
- **Effort:** S — one button + reuse undo token from F1.
- **Proposed backlog item:** `DCOMP-W4-A4-F2 — Hand Simulator Clear → toast+undo` (P1)

### F3 — Touch targets under ≥44×44 across 7 primary toggles + Back to Table

- **Severity:** 3 (P1)
- **Situations affected:** All personas at 1600×720 reference device
- **JTBD impact:** SA-64 Free tier (display customization), Chris venue/game defaults setup — all rate-limited by sub-minimum targets
- **Heuristics violated:** H-ML06
- **Evidence:** DOM-measured via Playwright:
  - Back to Table: 40×117 (h<44)
  - Dark / Light: 36×58-60 (h<44; both disabled "coming soon")
  - Small / Medium / Large (Card Size): 36×62-75 (h<44, active)
  - Add (Custom Venue, purple): 41×56 (h<44)
  - Daily / Weekly / Manual (Backup Frequency): 32×50-63 (h<44; all disabled)
  - Reset to Defaults: 36×126 (h<44, active)
- **Observation:** Sign In + Create Account correctly measure 44×352 ✓ — so the pattern is known in the codebase but not applied uniformly. Bundle-fix with a scan+replace of `py-1.5` / `py-2` with `min-h-[44px]` on interactive elements in SettingsView.
- **Recommended fix:** Standardize button padding to yield ≥44px min-height. Bundle: Back to Table, DisplaySettings toggles (Card Size), VenuesManager Add, DataAndAbout Reset + Confirm/Cancel buttons inside the reset flow.
- **Effort:** S — mechanical Tailwind class swaps across 4-5 files.
- **Risk:** Very low.
- **Proposed backlog item:** `DCOMP-W4-A4-F3 — SettingsView touch targets ≥44×44` (P1)

### F4 — Buy-in + sim-count inputs lack inputMode

- **Severity:** 3 (P1)
- **Heuristics violated:** H-ML08 (Wave-1 pattern from SV-F2, TV-F9 — `inputMode="decimal"` for monetary; `inputMode="numeric"` for integer)
- **Evidence:** DOM-measured: Custom Game Type "Buy-in" input (type=text, inputMode=none); Hand Simulator "Hands" count (type=number, inputMode=none).
- **Recommended fix:** Buy-in → `inputMode="decimal"`; sim count → `inputMode="numeric"`. Android compact keypad appears for both.
- **Effort:** S — two attribute additions.
- **Proposed backlog item:** `DCOMP-W4-A4-F4 — Settings inputs inputMode` (P1)

### F5 — Backup Frequency shows 3 disabled buttons with "(coming soon)" at full height

- **Severity:** 2 (P2)
- **Heuristics violated:** H-N4 consistency + standards (dead affordances visible); H-N8 aesthetic + minimalist design (chrome for features that don't exist)
- **Evidence:** `DataAndAbout.jsx:99-113` — Daily/Weekly/Manual buttons rendered with `disabled` + full panel header "Backup Frequency (coming soon)". Still takes full horizontal space in the panel.
- **Observation:** "(coming soon)" is a tolerable pattern for visible roadmap, but taking 3 button widths + label of real-estate for it is excessive. Same row could be compressed to a single informational line (e.g., "Automatic backups — coming soon") until the feature ships.
- **Recommended fix:** Replace the 3 disabled-button row with a single-line informational card when the feature is paused. Restore the full selector when F-P18 / backup infra lands.
- **Effort:** S — one small component edit.
- **Proposed backlog item:** `DCOMP-W4-A4-F5 — Backup Frequency disabled-row compression` (P2)

### F6 — Theme toggle (Dark / Light) also shows "(coming soon)" with active-looking buttons

- **Severity:** 2 (P2)
- **Heuristics violated:** H-N4 consistency + standards
- **Evidence:** From screenshot — Dark / Light buttons are visually active-styled (blue active, gray inactive), but the panel label reads "Theme (coming soon)". The buttons are likely `disabled` (not interactively functional) but visually suggest they work.
- **Observation:** Mixed signal — visually the toggle says "I work"; the label says "I don't." A user tapping Light expects something to happen.
- **Recommended fix:** Gray out the entire toggle set (reduce opacity to 0.5, add `cursor-not-allowed`) to match the other "(coming soon)" patterns in the view. Or compress to a single info line like F5.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A4-F6 — Theme toggle visual-disabled state` (P2)

### F7 — Inconsistent accent colors for Add actions

- **Severity:** 2 (P2)
- **Heuristics violated:** H-N4
- **Evidence:** VenuesManager Add button = purple (`rgb(147, 51, 234)`); GameTypesManager Add button (from screenshot) = teal. Both are primary "Add" actions on sibling panels with identical purpose.
- **Observation:** App uses blue for primary nav CTAs (Sign In), gold (`#d4a847`) for emphasis + section headers. No established pattern for "Add" in the design tokens. Two neighboring panels picking different accent colors is arbitrary.
- **Recommended fix:** Pick one canonical Add color (blue `rgb(37, 99, 235)` matches Sign In; matches the primary-action pattern). Apply to both. Consider adding to `designTokens.js` as `ADD_BUTTON_COLOR`.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A4-F7 — Add-button color consistency` (P2)

### F8 — `errorReportingEnabled` checkbox privacy-implication not surfaced

- **Severity:** 2 (P2)
- **Heuristics violated:** H-N10 help + documentation (consent context for data collection should be clear)
- **Evidence:** `DataAndAbout.jsx:119-128` — checkbox labeled "Enable error reporting (helps improve the app)". No info about what data is sent, where it goes, retention policy, or how to disable.
- **Observation:** For a local-first app with no cloud sync active, "error reporting" likely means nothing ships anywhere right now (errors go to `logger.error` + local ErrorLogPanel). But the label implies external reporting to a user. **Either:** the reporting doesn't actually go anywhere and the checkbox should be removed/renamed OR it does and needs a privacy note. Requires owner clarification on actual behavior.
- **Recommended fix:** Audit the `errorReportingEnabled` plumbing; either remove the toggle if it's vaporware, rename if it's local-only, or add a one-liner explaining where data goes.
- **Effort:** S — investigation + one-line copy fix.
- **Proposed backlog item:** `DCOMP-W4-A4-F8 — errorReportingEnabled clarity + plumbing audit` (P2)

### F9 — Cold-start auth state (AccountSection) renders even when guest — primary action is Sign In

- **Severity:** 2 (P2)
- **Heuristics violated:** None strictly; design choice.
- **Evidence:** AccountSection renders "You're using Poker Tracker as a guest" + prominent Sign In (blue) + Create Account buttons. For a non-cloud-sync user (local-first JTBD SA-70), this is noise on every Settings visit.
- **Observation:** The banner correctly signposts "sync available if you sign in." But for Chris who chose local-first intentionally, there's no way to dismiss the prompt. Every Settings visit re-pitches auth.
- **Recommended fix:** Add a "I'll stay local" dismissal with localStorage persistence. Once dismissed, compress AccountSection to a small "Sign in" link in the panel footer.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A4-F9 — AccountSection dismissible for local-first users` (P2)

### F10 — "(coming soon)" as a pattern has no canonical treatment

- **Severity:** 1 (P3)
- **Evidence:** Theme, Backup Frequency, Error Reporting all use "(coming soon)" but each renders differently (disabled toggles vs disabled buttons vs active checkbox). Inconsistent.
- **Recommended fix:** Add a design-token convention for "coming soon" — either a compact info card pattern or a consistent disabled visual. Candidate for a shared `<ComingSoonNotice feature="X" />` component.
- **Effort:** S-M.
- **Proposed backlog item:** `DCOMP-W4-A4-F10 — ComingSoonNotice shared component` (P3)

### F11 — No search within settings panels

- **Severity:** 1 (P3)
- **Evidence:** 7 panels, multiple sub-controls. No find-in-settings affordance.
- **Observation:** Settings isn't large enough to warrant search today. Flagged for future if panel count grows.
- **Proposed backlog item:** Deferred / discovery.

### F12 — DataAndAbout panel grows unbounded with dev-gated dev-tools

- **Severity:** 1 (P3)
- **Evidence:** DataAndAbout in dev builds adds a 4-button grid (Seed Basic / Clear Basic / Seed Range / Clear Range) + Hand Simulator (2 buttons + count input). Panel becomes tall at ~400+ lines of content. In a 2-column grid at 1600×720 viewport, this is the tallest panel.
- **Observation:** Dev-only, so prod is clean. Consider moving dev-tools to a separate collapsible sub-panel.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A4-F12 — DataAndAbout dev-tools collapse` (P3)

### F13 — Traveler persona pain (multi-currency, F-P14) still not served

- **Severity:** 1 (P3, known gap from surface artifact)
- **Proposed backlog item:** Discovery entry / feature request — matches surface artifact's "Potentially missing" list.

---

## Observations without fixes

- **Panel composition** (explicit props, not context) is a clean testability pattern — don't regress.
- **Loading guard** ("Loading settings...") is a good defensive pattern — keep.
- **Email verification banner** renders conditionally — good.
- **Gold header pattern** (`#d4a847`) is consistently applied across panel titles — honors `designTokens.GOLD`.

## Open questions for the owner

- Does `errorReportingEnabled` currently do anything? (F8 requires investigation to finalize.)
- Is the Theme toggle genuinely paused vs an oversight? (F6 treatment depends.)
- Is auth pursuit (Sign In pitch on every Settings visit) intentional? (F9 dismissibility depends.)

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F3 — Touch targets ≥44×44 across ~7 controls | 3 | S | P1 |
| 2 | F4 — Settings inputs inputMode=decimal/numeric | 3 | S | P1 |
| 3 | F1 — Reset to Defaults → toast+undo | 3 | S | P1 |
| 4 | F2 — Hand Simulator Clear → toast+undo | 3 | S | P1 |
| 5 | F5 — Backup Frequency disabled-row compression | 2 | S | P2 |
| 6 | F6 — Theme toggle visual-disabled state | 2 | S | P2 |
| 7 | F7 — Add-button color consistency | 2 | S | P2 |
| 8 | F8 — errorReportingEnabled clarity + plumbing | 2 | S | P2 |
| 9 | F9 — AccountSection dismissible for local-first | 2 | S | P2 |
| 10 | F10 — ComingSoonNotice shared component | 1 | S-M | P3 |
| 11 | F12 — DataAndAbout dev-tools collapse | 1 | S | P3 |
| 12 | F11, F13 — deferred (search; Traveler multi-currency) | 1 | varies | discovery |

---

## Backlog proposals

```
- [P1] [DCOMP-W4-A4 F1] Reset to Defaults → toast+undo
- [P1] [DCOMP-W4-A4 F2] Hand Simulator Clear → toast+undo (non-dev-gated path)
- [P1] [DCOMP-W4-A4 F3] SettingsView touch targets ≥44×44 across Back/toggles/Add/Reset
- [P1] [DCOMP-W4-A4 F4] inputMode=decimal on Buy-in; inputMode=numeric on sim count
- [P2] [DCOMP-W4-A4 F5] Backup Frequency disabled-row → single info line
- [P2] [DCOMP-W4-A4 F6] Theme toggle visual-disabled state (opacity + cursor)
- [P2] [DCOMP-W4-A4 F7] Add-button color consistency (Venues + GameTypes)
- [P2] [DCOMP-W4-A4 F8] errorReportingEnabled clarity + plumbing audit
- [P2] [DCOMP-W4-A4 F9] AccountSection dismissible for local-first users
- [P3] [DCOMP-W4-A4 F10] ComingSoonNotice shared component
- [P3] [DCOMP-W4-A4 F12] DataAndAbout dev-tools collapsible
```

---

## Severity rubric

Standard template rubric — see `docs/design/audits/_template.md`.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft. Lightest W4 audit — no P0 findings. Pattern of pre-Wave-1 code + design-token gaps still present but consequences low (settings are user-controlled defaults, not high-consequence destructive actions). Cleanest-W4-surface verdict.
