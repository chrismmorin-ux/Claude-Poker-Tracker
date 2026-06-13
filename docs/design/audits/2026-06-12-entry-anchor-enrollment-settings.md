# Gate 1 Entry — 2026-06-12 — Anchor-calibration enrollment toggle (SettingsView)

**Surface working name:** Anchor Calibration section in SettingsView (+ EnrollmentStateBanner CTA wiring)
**Proposed by:** WS-222 (authored during SPR-115 / WS-025 recon, 2026-06-10). Implementation claimed by SPR-124 (2026-06-12).
**Gate:** 1 (Entry) — surface-bound addition to an existing surface (`settings-view`).
**Next gate:** 4 (Design) — surface artifact updates to `surfaces/settings-view.md` + `surfaces/calibration-dashboard.md`, same session.
**Status:** GREEN — verdict at SPR-124 plan approval (2026-06-12). Founder decisions locked in plan-mode: own "Anchor Calibration" section card placed after Privacy; full-explainer copy.

---

## Why this audit exists

The `ENROLLMENT_TOGGLED` reducer action (Q1-A global enrollment toggle for the anchor-calibration loop) has no UI dispatch site. The Calibration Dashboard's `EnrollmentStateBanner` was specified (calibration-dashboard.md v1.1 §Enrollment banner) with an `[ Open Settings ]` CTA "linking to enrollment toggle" — but the toggle was never built, and the CTA prop was never wired, so the owner currently cannot enroll at all. The system fails safe (default not-enrolled; red line #1 holds structurally), but the opt-in the red line promises is unreachable. WS-222 completes the flow.

This is the inverse of the anti-pattern the design program exists to prevent ("feature went to dev, design phase was skipped"): here the design phase ran (dashboard spec names Settings as the enrollment-toggle location at §Cross-surface dependencies — "Settings (future)"), and the dev slice that should have realized it was never scheduled. Gate 1 re-runs narrowly to confirm the existing persona/JTBD model covers the Settings-side control.

## Output 1 — Scope classification

**Primary classification:** Surface-bound addition — one new section card in the existing `settings-view` surface, plus prop wiring on an existing component (`EnrollmentStateBanner`) in `calibration-dashboard`. No new route, no new interaction primitive (two-button `aria-pressed` toggle mirrors the existing PrivacySection pattern), no product-line crossing, no underserved-persona target.

**Gate 2 triggers:** none fire. The enrollment flow's blind-spot risk (graded-work trap, engagement-pressure, consent semantics) was adversarially reviewed at EAL program-level Gate 2 (`2026-04-24-blindspot-exploit-anchor-library.md`) and the dashboard-side Gate 1 (`2026-05-09-entry-calibration-dashboard.md`). The Settings toggle is the consent mechanism those reviews assumed.

**Verdict on Gate 2 requirement:** NOT required.

## Output 2 — Personas served

- [chris-live-player](../personas/core/chris-live-player.md) — primary; carries red line #1 ("Opt-in enrollment required — no silent skill inference. Using the app is not consent to be modeled."). This change is that red line's completion.
- [post-session-chris](../personas/situational/post-session-chris.md) — arrives at the toggle via the dashboard banner CTA during post-session review.
- Out-of-scope: mid-hand-chris (AP-07 — no live-table surface touched), newcomer-first-hand (Settings section is inert until calibration features matter).

## Output 3 — JTBD identified

- **JTBD-DS-58** — *validate-confidence-matches-experience* — enrollment is the data-consent gate for the observation-driven half of the dashboard.
- **Subscription-account domain policy** — "Opt-in enrollment is required before evaluation features run" (explicit red line #1 inheritance in `jtbd/domains/subscription-account.md`).

## Output 4 — Gap analysis

**Ready:** `ENROLLMENT_TOGGLED` reducer case + validation (anchorLibraryReducer.js); `isEnrolled()` selector (AnchorLibraryContext); `EnrollmentStateBanner` with conditional CTA (zero changes needed); PrivacySection as the section-card pattern; settings store auto-save persistence (useSettingsPersistence).

**Missing (the work):** `DEFAULT_SETTINGS.anchorCalibration` field + `SET_ANCHOR_CALIBRATION_ENROLLMENT` action; `AnchorCalibrationSection.jsx`; `buildEnrollmentSettingsCopy()` in calibrationCopy.js (AP-06 enforcement module); `useAnchorEnrollmentBridge` (settings → anchor-lib reconciling sync; settings store is persisted source of truth per the Q1-A comments in useAnchorLibraryPersistence.js); CTA prop wiring in CalibrationDashboardView.

**At risk:**
- **AP-06 graded-work trap** — toggle copy must frame enrollment as contributing observations that calibrate the *model*, never as enabling evaluation *of the owner*. Mitigation: copy lives in `calibrationCopy.js` under existing `FORBIDDEN_PATTERNS` enforcement + DOM-assertion test.
- **Red line #5 (no engagement pressure)** — no nag, no "enroll now" urgency; the not-enrolled state is a fully legitimate resting state. Helper copy states "Off by default — nothing is collected until you enroll" factually.
- **Consent coupling** — Settings "Reset to defaults" now also un-enrolls (bridge propagates the default). Fails safe per red line #1; recorded as an explicit decision.

## Output 5 — Verdict

**GREEN.** All personas and JTBD covered by existing models; the change completes an already-Gate-4-specified flow rather than introducing new design space. Gate 4 obligation: update `surfaces/settings-view.md` (new section spec) + `surfaces/calibration-dashboard.md` (CTA now wired) in the same session — done as companion edits to this audit.

**Founder decisions locked (SPR-124 plan-mode, 2026-06-12):**
1. Placement: own "Anchor Calibration" section card, directly after Privacy.
2. Copy: full explainer — "When enrolled, hands you record contribute observations that calibrate the exploit model's anchors against real table data. When off, the model runs on seed priors and simulator results only. Off by default — nothing is collected until you enroll." Buttons: `Enrolled` / `Not enrolled`.

## Links

- Work item: `.claude/workstream/queue/WS-222.yaml` (sprint SPR-124)
- Surface artifacts amended: [`surfaces/settings-view.md`](../surfaces/settings-view.md), [`surfaces/calibration-dashboard.md`](../surfaces/calibration-dashboard.md)
- Dashboard-side Gate 1: [`2026-05-09-entry-calibration-dashboard.md`](2026-05-09-entry-calibration-dashboard.md)
- EAL program Gate 2: [`2026-04-24-blindspot-exploit-anchor-library.md`](2026-04-24-blindspot-exploit-anchor-library.md)

## Change log

- 2026-06-12 — Created. Verdict GREEN; Gate 2 not required; founder placement + copy decisions recorded. Implementation proceeding under WS-222 / SPR-124.
