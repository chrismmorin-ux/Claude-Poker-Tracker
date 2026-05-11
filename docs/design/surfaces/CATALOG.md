# Surface Catalog

Index of every UX surface in the app that has (or should have) a surface artifact. A surface is any bounded region of the UI the user can interact with: a view, a menu, a panel, a modal, an inline widget.

`●` = documented, `◐` = stub, `○` = identified but not yet documented.

---

## Top-level views (routed via `SCREEN.*`)

| ID | Name | Code | State |
|----|------|------|-------|
| table-view | Table View | `src/components/views/TableView/` | ● (DCOMP-W0 S1) |
| showdown-view | Showdown | `src/components/views/ShowdownView/` | ● (DCOMP-W0 S1) |
| stats-view | Stats | `src/components/views/StatsView.jsx` | ● (DCOMP-W0 S1) |
| sessions-view | Sessions | `src/components/views/SessionsView/` | ● (DCOMP-W0 S1) |
| players-view | Players | `src/components/views/PlayersView.jsx` | ● (DCOMP-W0 S1) |
| player-picker | Player Picker | `src/components/views/PlayerPickerView/` | ● (Session 2) |
| player-editor | Player Editor | `src/components/views/PlayerEditorView/` | ● (Session 2) |
| settings-view | Settings | `src/components/views/SettingsView/` | ● (DCOMP-W0 S1) |
| analysis-view | Analysis | `src/components/views/AnalysisView/` | ● (DCOMP-W0 S2) |
| hand-replay-view | Hand Replay | `src/components/views/HandReplayView/` | ● (DCOMP-W0 S2) |
| tournament-view | Tournament | `src/components/views/TournamentView/` | ● (DCOMP-W0 S2) |
| online-view | Online | `src/components/views/OnlineView/` | ● (DCOMP-W0 S2) |
| preflop-drills | Preflop Drills | `src/components/views/PreflopDrillsView/` | ● (DCOMP-W0 S2) |
| postflop-drills | Postflop Drills | `src/components/views/PostflopDrillsView/` | ● (DCOMP-W0 S2) |
| anchor-library | Anchor Library | `src/components/views/AnchorLibraryView/` (Phase 5) | ● (EAL Gate 4 S4 — spec; not yet implemented) |
| calibration-dashboard | Calibration Dashboard | `src/components/views/CalibrationDashboardView/` (Phase 5/6) | ● (EAL Gate 4 S4 + EDEV Phase 6 — cross-project spec; not yet implemented) |
| session-review-anchor-rollup | Session Review (Anchor Rollup) | `src/components/views/SessionReviewView/` (Phase 5) | ● (EAL Gate 4 S5 — spec; not yet implemented) |
| printable-refresher | Printable Refresher | `src/components/views/PrintableRefresherView/` (Phase 5) | ● (PRF Gate 4 S1 — spec; not yet implemented; first explicit `currentIntent: 'Reference'` surface) |
| telemetry-consent-panel | Telemetry Consent Panel | `src/components/views/FirstLaunchTelemetryPanel.jsx` + `SettingsView/TelemetrySection.jsx` (Phase 5) | ● (MPMF Gate 4 B2 — spec; not yet implemented; first-launch panel + settings mirror; Q8=B opt-out with transparency) |
| pricing-page | Pricing Page | `src/components/views/PricingView/` (Phase 5) — TierCard×4 + FeatureComparisonTable + FoundingMemberSection + FAQ | ● (MPMF Gate 4 B4 — spec; not yet implemented; 4 tiers Free/Plus/Pro/Founding-Lifetime cap-50; pricing-tentative pending Stream D telemetry) |
| billing-settings | Billing Settings | `src/components/views/SettingsView/BillingSettings/` (Phase 5) — section card with PlanCard + PaymentMethodCard + NextBillCard + Actions | ● (MPMF Gate 4 B5 — spec; not yet implemented; SettingsView extension; 4 tier-state variants; entry point for cancellation J3 + plan-change J4 journeys; LOAD-BEARING red lines #2 + #10) |
| self-coach-view | Self-Coach View | `src/components/views/SelfCoachView/` (Phase 5) — 2-tab Study/Settings; Study has 3 sections (Hero leaks / Curriculum / Tests history & browse) | ● (SCF Gate 4 S1 — spec; not yet implemented; CO-54 + CO-55 surface; review-mode-only; sourceUtilPolicy whitelisted) |
| player-profile | Player Profile / Sighting History | `src/components/views/PlayerProfileView/` (Phase 5) — fullscreen route `SCREEN.PLAYER_PROFILE`; per-attribute stability section + sighting log section | ● (PIO Gate 4 S1 — spec; not yet implemented; PM-13/14/15 surface; review-mode-only; sourceUtilPolicy whitelisted; n≥5 sighting floor) |
| study-home | Study Home (cross-project) | `src/components/views/StudyHomeView/` (Phase 5) — new route `SCREEN.STUDY_HOME`; three-intent body (Reference/Deliberate/Discover); flat-index + intent-mode body + transparency footer | ● (SLS Gate 4 SPR-073 — spec; not yet implemented; parent cross-project surface; first instance of Q1 verdict realization) |
| shape-skill-map | Shape Skill Map (transparency) | `src/components/views/SettingsView/ShapeSkillMapPanel/` (Phase 5) — Settings-routed; 10 descriptor rows; single-scrollable IA; expandable W_drill+W_recent+declared composition with W_leak/W_test placeholders | ● (SLS Gate 4 SPR-074 — spec; not yet implemented; canonical transparency surface; renders red lines #2/#3/#4 as the binding host) |
| lesson-runner | Lesson Runner (drill / lesson) | `src/components/views/LessonRunnerView/` (Phase 5) — new route `SCREEN.LESSON_RUNNER` + intent route param; shared shell w/ 3 variants (Reference read-only / Deliberate graded / Discover graded+seeder-context); only surface writing `RECORD_DRILL_OUTCOME` | ● (SLS Gate 4 SPR-074 — spec; not yet implemented; intent-as-route per study-home three-intent taxonomy; I-SM-3 reducer enforcement is defense-in-depth third layer) |

## Menus and overlays

| ID | Name | Code | State |
|----|------|------|-------|
| seat-context-menu | Seat Context Menu | `src/components/views/TableView/SeatContextMenu.jsx` | ● (Session 2) |
| showdown-overlay | Showdown Overlay | (within ShowdownView) | ○ |
| toast-container | Toast | `src/components/ui/Toast/` | ○ |

## Sidebar (extension)

The Ignition extension sidebar is its own surface system with dedicated doctrine at `docs/SIDEBAR_DESIGN_PRINCIPLES.md`. DCOMP-W5 (2026-04-22) integrated the sidebar into the framework via 5 zone-level surface artifacts + 1 overview. Each artifact cross-maps framework heuristics (Nielsen-10, Poker-Live-Table) to sidebar doctrine rules rather than duplicating.

| ID | Name | Code | State |
|----|------|------|-------|
| sidebar-zones-overview | DCOMP-W5 overview + heuristic cross-map | (docs) | ● (DCOMP-W5) |
| sidebar-zone-0 | Zone 0 — Chrome + Diagnostics | extension | ● (DCOMP-W5) |
| sidebar-zone-1 | Zone 1 — Table Read | extension | ● (DCOMP-W5) |
| sidebar-zone-2 | Zone 2 — Decision | extension | ● (DCOMP-W5) |
| sidebar-zone-3 | Zone 3 — Street Card | extension | ● (DCOMP-W5) |
| sidebar-zone-4 | Zone 4 — Deep Analysis | extension | ● (DCOMP-W5) |

## Inline widgets (within views)

| ID | Name | Parent | State |
|----|------|--------|-------|
| live-exploit-citation | Live Exploit Citation | sidebar-zone-2 + TableView/LiveAdviceBar | ● (exploit-deviation Phase 5) |
| bucket-ev-panel-v2 | Bucket EV Panel v2 | PostflopDrillsView / LineWalkthrough | ● (LSW-G4) |
| presession-drill | Presession Drill | PresessionDrillView | ● (exploit-deviation Phase 6) |
| hand-replay-observation-capture | Hand-Replay Observation Capture (Tier 0) | HandReplayView / ReviewPanel Section G | ● (EAL Gate 4 S3) |
| evaluator-onboarding | Evaluator Onboarding (first-run flow) | `src/components/views/EvaluatorOnboarding*` (Phase 5) — variation picker + 5 flows | ● (MPMF Gate 4 B2 — journey spec; not yet implemented; 5 variations: Full tour / Fast orientation / Skip / At-table / Returning-resume) |
| cancellation | Cancellation (dark-pattern-free) | `src/components/ui/CancellationConfirmModal.jsx` + `BillingCancelAction.jsx` (Phase 5) — shared confirm modal across 3 variations | ● (MPMF Gate 4 B3 — journey spec; not yet implemented; LOAD-BEARING for red line #10; ≤2-tap flow + CI-linted forbidden-copy ladder) |
| paywall-hit | Paywall Hit | `PaywallModal.jsx` + `PaywallFallbackInline.jsx` + `PaywallGate.jsx` (Phase 5) — 4 variations | ● (MPMF Gate 4 B3 — journey spec; not yet implemented; H-SC01 defer-to-hand-end + H-N07 7-day cooldown) |
| plan-change | Plan Change (upgrade + downgrade) | `PlanSelectModal.jsx` + `PlanChangeConfirmModal.jsx` (Phase 5) — upgrade + downgrade variations | ● (MPMF Gate 4 B3 — journey spec; not yet implemented; proration rules + data-preservation + distinct-from-cancellation) |
| paywall-modal | Paywall Modal | `src/components/ui/PaywallModal.jsx` + `PaywallFallbackInline.jsx` + `PaywallGate.jsx` (Phase 5) | ● (MPMF Gate 4 B4 — spec; not yet implemented; 3 modal variations A/B/D + inline-fallback variation C; H-SC01 defer-to-hand-end + H-N07 7-day cooldown) |
| upgrade-prompt-inline | Upgrade Prompt Inline | `src/components/ui/UpgradePromptInline.jsx` (Phase 5) — embedded across 5 host contexts | ● (MPMF Gate 4 B4 — spec; not yet implemented; compact + expanded variants; sub-shape tailoring; H-N07 cooldown + presession suppression) |
| trial-state-indicator | Trial State Indicator | `src/components/ui/TrialStateIndicator.jsx` (Phase 5) — chip in main-nav region | ● (MPMF Gate 4 B5 — spec; not yet implemented; persistent chip across all views; ≤150ms glanceable per H-PLT01; ≤2-tap to BillingSettings per H-SC02 LOAD-BEARING; mid-hand 60% opacity + deferred routing per H-SC01) |
| printable-refresher-card-templates | Printable Refresher Card Templates (4 class-specific layouts) | `src/components/views/PrintableRefresherView/CardTemplates/` (Phase 5) — Preflop / Math / Equity / Exceptions + shared LineageFooter + CardCornerStamp + CardTitle | ● (PRF Gate 4 S2 — spec; not yet implemented; rendered within CardDetail + PrintPreview + printed output) |
| lesson-card | Lesson Card | `src/components/views/SelfCoachView/CurriculumSection/LessonCardItem.jsx` + `LessonCardDetail.jsx` (Phase 5) — schema instantiation; YAML front-matter + Markdown body authored at `docs/projects/self-coach-foundation/lessons/` | ● (SCF Gate 4 S3 — spec; not yet implemented; building block of Curriculum section; `Test myself` button gated by `test_substrate: 'drill' \| 'pending'`) |
| skill-assessment-test | Skill-Assessment Test (opt-in-test mode of drill engine) | thin surface — delegates to `postflop-drills` / `preflop-drills` with 3 deltas (entry path / result framing / persistence tag) | ● (SCF Gate 4 S4 — spec; not yet implemented; cd5_exempt: 'owner-volunteered-test' manifest flag on result-display surface; AP-SCF-01 nuance binding) |
| leak-distillation | Leak-Distillation Pipeline | `src/utils/exploitEngine/heroLeakDetector.js` + `heroDecisionAccumulator.js` + `heroLeaks` IDB store (Phase 5) — cross-surface pipeline; HRV inline annotation + SelfCoachView Hero leaks section as the two surface presentations | ● (SCF Gate 4 S5 — spec; not yet implemented; sourceUtilPolicy whitelist; Drill this / Dismiss / Snooze affordances on expanded card; immediate-firing per Gate 3) |
| camera-capture-modal | Camera Capture Modal | `src/components/views/CameraCaptureModal/` (Phase 5) — 2-stage modal: capture → accept; auto-crop center 1:1; atomic-txn binding to Player record per PIO-G3-PHOTO | ● (PIO Gate 4 S2 — spec; not yet implemented; Settings master toggle gates entry button availability app-wide; AP-PIO-03 binding load-bearing; never auto-launches) |
| voice-card-entry | Voice Card Entry (PTT widget + parser pipeline) | `src/hooks/useVoiceCardEntry.js` + `src/utils/voiceCardEntry/` + `src/components/ui/VoicePttButton.jsx` + `VoiceConfirmationChips.jsx` (Phase 5) — adds PTT affordance to TableView (board entry) + ShowdownView (villain showdown); Web Speech only; 6 founder ratifications binding (R1 Web-Speech-only / R2 board+showdown scope / R3 ship-or-drop / R4 swipe-to-cycle correction / R5 extended-grammar w/ villain tokens / R6 strict no-op on blank) | ● (VCE Gate 4 — spec; not yet implemented; ship-or-drop spike behind Settings feature flag, OFF default; 5 open decisions D-1..D-5 pending owner ratification before Gate 5) |

PIO Gate 4 surface extensions (existing surfaces gain new subsections per `audits/2026-05-02-gate4-design-player-identification-v2.md`):
- `table-build` — PIO-G4-PVA (CandidateColumn ranking math) + PIO-G4-DISAMB (PossibleMatchesPanel confidence bar)
- `player-editor` — PIO-G4-PEX (5 new attribute sections + camera entry button; surviving edit-mode only)
- `players-view` — PIO-G4-PV (new attribute filters; row-tap routes to player-profile)
- `settings-view` — PIO-G4-SET (Privacy section: photo-capture master toggle)

Add as audits surface them.

---

## Conventions

- **ID:** kebab-case, matches filename under `surfaces/`.
- **Name:** user-facing label if any, else descriptive.
- **Code:** primary file or directory. Surface artifacts may reference multiple files.

## Rules for adding a new surface

1. Create a `surfaces/<id>.md` from the template before authoring an audit that references it.
2. Link the surface from any JTBD it serves.
3. If the surface is part of a routed screen, add it to the top-level views list.
4. Update the state marker when documenting moves from ○ to ● completeness.

---

## Change log

- 2026-04-21 — Created. Initial catalog of known surfaces.
- 2026-05-11 — Added `voice-card-entry` (VCE Gate 4 spec — cross-surface PTT widget + parser pipeline; spike behind feature flag).
- 2026-04-21 — DCOMP-W0 session 1: flipped 6 surfaces to ● (table-view, showdown-view, stats-view, sessions-view, players-view, settings-view). 5 remaining in top-level views: analysis-view, hand-replay-view, tournament-view, online-view, preflop-drills, postflop-drills.
- 2026-04-21 — DCOMP-W0 session 2: remaining 6 top-level views flipped to ● (analysis-view, hand-replay-view, tournament-view, online-view, preflop-drills, postflop-drills). **All 14 main-app top-level views now at Tier A.** Remaining ○: showdown-overlay, toast-container (inline widgets — defer to audit-time discovery).
- 2026-04-24 — Added Inline Widgets table with 4 documented inline surfaces: live-exploit-citation (exploit-deviation Phase 5), bucket-ev-panel-v2 (LSW-G4), presession-drill (exploit-deviation Phase 6), hand-replay-observation-capture (EAL Gate 4 S3, this session). Inline widgets row moved from prose to table.
- 2026-04-24 — Added 2 top-level view entries at spec-level (not yet implemented): `anchor-library` (EAL Gate 4 S1) + `calibration-dashboard` (EAL Gate 4 S2 — cross-project with Exploit Deviation Phase 6, one-view-with-tabs architecture ratified).
- 2026-04-24 — Added `session-review-anchor-rollup` top-level view at spec-level (EAL Gate 4 S5). New route `SCREEN.SESSION_REVIEW` — not SessionsView extension (rationale in spec). Auto-opens post-CashOut; deep-linkable from SessionCard.
- 2026-04-24 — Printable Refresher project opened. Gate 2 SHIPPED (audit: `../audits/2026-04-24-blindspot-printable-refresher.md`); Gate 3 IN PROGRESS (Q1 + Q3 answered, 7 remaining). Surface spec for `printable-refresher` is a Gate 4 deliverable — not yet in the CATALOG table above (add at Gate 4 S1 per EAL precedent pattern). Project file: `../../projects/printable-refresher.project.md`. New cross-persona situational authored same-session: `../personas/situational/stepped-away-from-hand.md`.
- 2026-04-24 — Added `printable-refresher` top-level view at spec-level (PRF Gate 4 S1). New route `SCREEN.PRINTABLE_REFRESHER` standalone-routed with `parentSurface: 'study-home (pending)'` reference. First explicit `currentIntent: 'Reference'` surface under Shape Language three-intent taxonomy — reducer-boundary write-silence (red line #11) is the crystallizing invariant for future Reference-mode surfaces. Spec covers 5 sub-views (catalog + card-detail + lineage-modal + print-preview + print-confirmation + suppression-confirm). Phase 5 implementation cascade: ~18 new files across views / hooks / utils / manifests / styles; PRF-G5-PDF Playwright cross-browser snapshot matrix.
- 2026-04-24 — Added `printable-refresher-card-templates` inline widget at spec-level (PRF Gate 4 S2). 4 class-specific layout templates (Preflop / Math / Equity / Exceptions) + shared Regions 1-6 anatomy (title / primary-content / derivation / lineage-footer-line-1 / lineage-footer-line-2 / card-corner-physical-version-stamp). Region 6 is the H-PM07 laminate cross-reference affordance (rotated 90°, 7pt greyscale, inside the 0.25" safe-trim margin). `TEMPLATE_BY_CLASS` map dispatches manifest.class → React template component.
- 2026-05-11 — Added 3 top-level view entries at spec-level for SLS Gate 4: `study-home` (SPR-073 parent cross-project surface), `shape-skill-map` (SPR-074 transparency screen, Settings-routed), `lesson-runner` (SPR-074 drill / lesson surface, intent-as-route shared shell with 3 variants). SLS Gate 4 closed by SPR-073 + SPR-074; all 4 SLS Gate 4 design artifacts (study-home + shape-language-study-home embed + shape-skill-map + lesson-runner + shape-language-enrollment journey + shape-mastery contract + redline-conformance audit) now in place. Streams B/D unblocked.
