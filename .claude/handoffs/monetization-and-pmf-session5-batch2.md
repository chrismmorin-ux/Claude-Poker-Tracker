# Handoff — Monetization & PMF · Session 5 Batch 2 (Gate 4 foundation-remainder)

**Session:** 2026-04-24, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 4 Batch 2 — 8 of 16 Gate 4 items complete; Stream D Phase 1 unblocked
**Status:** DRAFT — awaiting owner review

---

## Files I Own (This Session)

- `docs/design/surfaces/telemetry-consent-panel.md` — CREATED (MPMF-G4-S6)
- `docs/design/journeys/evaluator-onboarding.md` — CREATED (MPMF-G4-J1)
- `docs/projects/monetization-and-pmf/anti-patterns.md` — AMENDED (MPMF-AP-13 + MPMF-AP-14)
- `docs/design/surfaces/CATALOG.md` — AMENDED (2 new entries)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Session Log + 3 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (2 MPMF-G4-* rows COMPLETE)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF S4 demoted)
- `.claude/handoffs/monetization-and-pmf-session5-batch2.md` — this file

**No file conflicts.** Other active streams operate in separate directories (EAL `src/utils/anchorLibrary/`, PRF `docs/projects/printable-refresher/`, Shape Language `docs/projects/poker-shape-language/`, LSW `docs/design/audits/line-audits/`).

---

## What this session produced

**2 artifacts + anti-pattern expansion + CATALOG + governance.** Zero code.

### MPMF-G4-S6 — telemetry-consent-panel.md (first-launch + settings mirror)

**Load-bearing for red lines #1 (opt-in enrollment) + #2 (transparency) + #9 (incognito observation mode).**

Two variants sharing `TelemetryCategoryRow` component:
- **First-launch modal** — fires BEFORE main-app routing; 4 category rows with per-category ON/OFF toggle + explicit "NEVER collected" disclosure + footer commitment ("Turning all of these off will not reduce any feature available to you") + single Continue button.
- **Settings mirror** — reproduces same 4 toggles in `SettingsView/TelemetrySection.jsx` card at top-left grid position (≤2 taps from anywhere per H-SC02). "Last updated" timestamp + "View what's never collected" expander.

**Critical structural guarantee: consent gate.** `src/utils/telemetry/consentGate.js` wraps `posthog.capture`; no component has direct PostHog access. Events silently dropped at source if category opted-out. Makes red line #1 unbypassable.

**Extension inheritance:** extension reads consent via WebSocket bridge, never writes or surfaces consent UI of its own (MPMF-P8-EX). If bridge unreachable, extension defaults to `free` tier + no telemetry (graceful degradation).

### MPMF-G4-J1 — evaluator-onboarding.md (5-variation journey)

| Variation | Trigger | Time budget | Skip affordance |
|---|---|---|---|
| A Full tour | User picks "Full tour (3 min)" | 90s full / 30s quick-tap | Skip at every step |
| B Fast orientation | User picks "Fast orientation (60 sec)" | ≤60s (M13 wow threshold) | Sub-shape picker optional |
| C Skip | User picks "Skip" | <5s | — |
| D At-table degraded | Auto-detect active session | 0s delay | Re-fire via Settings→Help |
| E Returning-evaluator resume | Auto-detect >2 day gap | ≤15s to choose | Skip / Start fresh / Resume |

**Sub-shape persistence (Variation B):** selecting E-CHRIS / E-SCHOLAR / E-IGNITION writes `settings.onboarding.evaluatorSubShape` for downstream upgrade-prompt copy tailoring. Per red line #1, no silent persona inference — only explicit declaration writes.

**E-IGNITION placeholder** (Variation B card) — greyed with "Chrome extension — Phase 2 feature" tooltip per Q3=C deferral. No dead deep-link.

**State-preservation invariant (Variation E):** "Start fresh" opens TableView but does NOT clear prior data. Clearing requires explicit Settings → Data → Reset action.

### Anti-patterns expansion (12 → 14)

- **MPMF-AP-13 — Telemetry-consent-nag.** Re-prompting opt-outs / consent-update badges / new-categories-inheriting-prior-consent refused. First-launch panel never re-fires after dismissal. New categories in future releases default to OFF; explicit re-consent required.
- **MPMF-AP-14 — Onboarding-lock-in.** Forced tutorials / hidden Skip / progress-bar pressure refused. Skip always at equal visual weight at every step. Variation D auto-detect SUPPRESSES tour rather than forcing it.

### CATALOG.md entries

- `telemetry-consent-panel` in Top-level views table.
- `evaluator-onboarding` in Inline widgets / journeys section.

---

## What this batch unblocks

### Stream D Phase 1 (PostHog install) — NOW UNBLOCKED

Q8=B verdict already unblocked telemetry architecturally; MPMF-G4-S6 shipping provides the first-launch UX spec + consent-gate contract. Next-plan Gate 5 can install PostHog immediately:
- Apply for PostHog-for-Startups credit ($50K)
- Install `posthog-js` into `src/main.jsx`
- Author `src/utils/telemetry/consentGate.js` + `postHogAdapter.js` per surface spec
- Wire first-launch panel into AppRoot before routing
- Author `src/constants/telemetryEvents.js` per assumption-ledger §Kill-criterion instrumentation targets
- Define TELEMETRY_CATEGORIES constant with 4 entries
- Ship 3-layer instrumentation per charter Stream D (screen-time + action-level + feature-touch)

### Stream E Phase 1 (founding-member outreach) — still blocked

Still blocked on **MPMF-G4-S1 pricing-page** (pricing surface needs to exist before outreach can point evaluators at a public URL). But evaluator-onboarding journey now informs outreach messaging:
- E-CHRIS wedge: "Live-HUD for in-person play"
- E-SCHOLAR wedge: "Drills that explain, not just score"
- E-IGNITION wedge: Phase 2+ deferred (but acknowledged in positioning)

### No Gate 5 code yet

Per approved plan, all Batch 2-5 are design-only. Gate 5 code is a separate plan after Batch 5 closeout.

---

## Remaining Gate 4 scope (8 items across B3-B5)

Per `plans/misty-swimming-rabbit.md`:

### Batch 3 — Journeys (next session recommended)
- **MPMF-G4-J3** `journeys/cancellation.md` — **dark-pattern-free critical**; CI-linted forbidden-copy ladder; load-bearing red line #10
- **MPMF-G4-J2** `journeys/paywall-hit.md` — session-close → paywall-next-open; L4 history-access trigger; H-SC01 defer-to-hand-end
- **MPMF-G4-J4** `journeys/plan-change.md` — SA-76 upgrade/downgrade flows; proration rules
- `anti-patterns.md` expansion — likely adds MPMF-AP-15 silent-plan-change / MPMF-AP-16 deceptive-proration-display

### Batch 4 — Paywall surfaces
- **MPMF-G4-S1** `surfaces/pricing-page.md` — most complex; tier cards + feature comparison + founding-member section
- **MPMF-G4-S2** `surfaces/paywall-modal.md` — L3/L4 trigger; equal-weight "Keep free" button; H-SC01 hand-end deferral
- **MPMF-G4-S3** `surfaces/upgrade-prompt-inline.md` — context-aware dismissibility + H-N07 cooldown + presession suppression

### Batch 5 — Billing + trial-state surfaces + closeout
- **MPMF-G4-S5** `surfaces/billing-settings.md` — SettingsView extension; 6-action panel
- **MPMF-G4-S4** `surfaces/trial-state-indicator.md` — ≤150ms glanceable; H-PLT01 + H-SC02
- Gate 4 closeout: Stream A `G4 [x]`; charter Decisions final entries; `anti-patterns.md` final state; CATALOG finalized

---

## Doctrine + architecture notes for next batches

### Copy-discipline forbidden-string list (accumulated through Batch 2)

Cancellation journey (B3) should expand this list:
- `"Welcome!"` (aspirational greeting in body; OK as heading)
- `"We miss you!"` (re-engagement)
- `"Ready to level up?"` (aspirational pressure)
- `"unlock your potential"` (aspirational)
- `"hope you're well"` / `"hope you're doing great"` (emotional framing)
- `"don't miss"` (loss framing)
- `"most users choose"` (social proof)
- `"act now"` / `"hurry"` (urgency)
- **Batch 3 additions expected:** `"downgrade"` (cancellation AP-06), `"are you sure?"` (retention trap AP-05), `"last chance"` (fake urgency AP-01), `"pause instead — give us another chance"` (retention coercion), `"what went wrong?"` (guilt-framed exit survey).

### Shared component patterns to reuse

- `TelemetryCategoryRow` — per-category toggle with description + optional "NEVER collected" disclosure. Pattern: reusable for any per-category consent/preferences UI.
- `EvaluatorOnboardingPicker` — 3-card equal-weight choice modal. Pattern: reusable for any multi-path decision modal where all paths are legitimate.
- `ResumeOrFreshModal` — 3-choice re-entry modal with state-preservation invariant. Pattern: reusable for any returning-state modal (could serve returning-Chris analog in future if authored).

### Telemetry events for Stream D Phase 1

From S6 + J1 authoring, these events are now needed:
- `first_launch_telemetry_panel_shown`
- `telemetry_category_toggled` (properties: category, newState)
- `first_launch_telemetry_panel_dismissed`
- `onboarding_variant_picker_shown`
- `onboarding_variant_a_started` / `_completed` / `_skipped`
- `onboarding_variant_b_started` / `_sub_shape_selected` (properties: subShape) / `_completed`
- `onboarding_variant_c_selected`
- `onboarding_variant_d_auto` (At-table detected)
- `onboarding_variant_e_resume_chosen` / `_fresh_chosen` / `_skipped`
- `onboarding_return_after_drift` (properties: daysSinceLastSession)

All fire through `consentGate` — dropped if `usageEvents` category opted-out.

---

## Risk log (updates from this batch)

| # | Risk | Status |
|---|---|---|
| R1-R18 | Prior risks | Unchanged |
| **R19 NEW** | **Consent panel during first-launch delays time-to-first-value beyond 60-sec M13 threshold** | ACTIVE — mitigated by fast panel design (all 4 toggles default ON, single Continue button, ≤15s budget for dismiss-with-defaults). Measure via `first_launch_telemetry_panel_shown → first_session_start` interval latency. |
| **R20 NEW** | **Variation D at-table auto-detect misfires for evaluator who hasn't entered any hands** | ACTIVE (low) — detection is based on `hasActiveSessionState OR lastSessionEnd < 10min ago`. False positive possible for second-launch users who loaded sample data in first session. Acceptable cost; Variation D banner is dismissable + tour is re-fireable. |
| **R21 NEW** | **Sub-shape write creates implicit persona commitment** | ACTIVE (low) — mitigated by explicit opt-in (sub-shape only writes on user card tap; default is unset) + clear-path in Settings. Red line #1 respected. |

---

## Ratification checklist (for owner)

Before Batch 3 begins, owner should:

- [ ] Review `telemetry-consent-panel.md` — particularly the 4-category structure + "NEVER collected" disclosure content
- [ ] Review `evaluator-onboarding.md` — particularly Variation B sub-shape picker approach + Variation E returning-evaluator copy
- [ ] Review MPMF-AP-13 + MPMF-AP-14 additions for appropriate scope
- [ ] (Optional) Flag M15 anonymous-first-feasibility for engineering review ahead of Gate 5 — Stripe Checkout anonymous-first flow confirmation

Nothing locks until explicit ratification; all artifacts are amendable at Batch 3-5 boundaries.

---

## Change log

- 2026-04-24 — Session 5 Batch 2. Gate 4 foundation-remainder shipped — 2 artifacts (telemetry-consent-panel + evaluator-onboarding) + 2 anti-pattern additions + CATALOG updates. Stream D Phase 1 PostHog install now fully unblocked. 8 of 16 MPMF-G4-* carry-forwards complete; 8 remaining across B3/B4/B5. Zero code. Zero test regressions.
