# Gate 1 Entry — 2026-05-09 — CalibrationDashboardView surface

**Surface working name:** CalibrationDashboardView
**Proposed by:** EAL Master Plan §C Phase 6; surface spec authored at Gate 4 (2026-04-24, EAL-G4-S2). Implementation scope claimed by `WS-169` / `SPR-066` (2026-05-09).
**Gate:** 1 (Entry) — surface-specific. Re-runs Gate 1 narrowly because this is the introduction of a new fullscreen route (`SCREEN.CALIBRATION_DASHBOARD`) that did not exist when the EAL program-level Gate 1 ran (2026-04-23).
**Next gate:** 4 (Design) — surface spec already exists at `docs/design/surfaces/calibration-dashboard.md`. This Gate 1 verdict drives whether Gate 2 (Blind-Spot Roundtable) is required before Gate 4 is amended for today's narrowed implementation slice.
**Status:** YELLOW — verdict ratified at SPR-066/WS-169 plan approval (2026-05-09). Conditions C1 (Gate 4 spec amendment same session), C2 (AP-06/AP-08 DOM-assertion tests in same PR), C3 (sourceUtilPolicy extension) are binding on the implementation closing this gate.

---

## Why this audit exists

The EAL program completed Gates 1–4 across 2026-04-23 → 2026-04-24 (Sessions 1–4). The surface artifact at `docs/design/surfaces/calibration-dashboard.md` was authored at program-level Gate 4 in Session 4; that artifact is current with respect to the 3-tab IA but predates four relevant developments:

1. **PMC absorption-then-release (2026-05-09 morning).** WS-169 was absorbed into the Predictive Model Calibration project at PMC Gate 1 (RED verdict; Phase 5d). The PMC charter proposed expanding the dashboard with per-villain + per-situation tabs driven by a hierarchical Bayesian aggregator over an append-only Prediction Ledger. PMC Gate 2 sprint 2/2 (SPR-065, completed 2026-05-09 17:00–18:00) ratified Devil's-Advocate Concern 1 with a **REPLACEMENT verdict** — `predictionAudit` per-hand IDB field IS PMC; the expanded ledger / aggregator / per-villain + per-situation tab architecture is **CANCELLED**. WS-169 was re-released to EAL Stream D with its **original** 3-tab scope. This audit confirms the Gate 4 spec's 3-tab IA was always the right shape; PMC's expansion was discarded before reaching the spec.

2. **Operator dial slider deferred (2026-05-09 plan-mode founder ratification).** The Gate 4 spec line 131 / 186 / 255 / 319 calls out an operator dial slider (-1 to +1) as part of the per-anchor expanded detail. Founder ratified deferring the dial to a follow-up ticket (WS-176) in this sprint's plan-mode. Retire / Suppress / Reset buttons (existing infra reused) ship in this sprint; the dial does not. Phase 5 closes the surface but defers one micro-control.

3. **Predicates tab data-layer is pending (2026-05-09 plan-mode founder ratification).** Predicate-calibration infrastructure is owned by exploit-deviation; predicates are implicit via `lineSequence: LineStep[]` in EAL but no per-predicate observed-true/false counts are persisted anywhere. The Gate 4 spec line 232–234 already covers the case — "If EAL Phase 5 ships before exploit-deviation Phase 6, the `Predicates` tab renders a 'coming soon' empty state; tabs still render." Founder ratified this disposition for today's slice. The PredicateCalibrationPanel ships as an empty-state shell pending exploit-deviation predicate-calibration.

4. **Evidence-list layout was abstract in the original spec.** Spec line 123–127 + 181 describe the evidence list as a chronological row sequence with origin labels — but does not lock the visual layout (table vs cards vs accordion). Founder ratified **stacked cards** (each evidence row = its own card with origin badge + situation summary + outcome line) in plan-mode. This is layout-locking, not scope-shifting.

These four narrowings warrant an explicit surface-specific Gate 1.

---

## Surface summary (as proposed for WS-169 / SPR-066)

A new fullscreen route at `SCREEN.CALIBRATION_DASHBOARD` with a 3-tab IA (Predicates / Anchors / Primitives — default = Anchors per spec). Anchors tab consumes the existing `useAnchorLibraryView` hook (filter / sort / expansion shape reused), renders per-row predicted-vs-observed + CI + sample size + trend + sparkline via a NEW `selectAllAnchorCalibrations` selector, and offers a deep-dive AnchorDetailPanel (distinct from the existing S20 long-press panel) with model-accuracy prose (AP-06 ladder) + stacked-card evidence list (AP-08 origin-badge-per-row) + Retire / Suppress / Reset action buttons (reuses `useAnchorRetirement` + `RetirementConfirmModal`). Primitives tab renders perception-primitive validity posteriors with dependent-anchor counts. Predicates tab ships as a "pending exploit-deviation" empty-state shell. Enrollment banner renders only when `observation_enrollment_state === 'not-enrolled'`.

Deep-link entry from `AnchorLibraryView.handleOpenDashboard(anchorId)` (currently stubbed with toast at `AnchorLibraryView.jsx:136-140`); replaces the toast with `setCurrentScreen(SCREEN.CALIBRATION_DASHBOARD)` carrying `dashboardAnchorDeepLink: anchorId` payload through a new `SET_CALIBRATION_DASHBOARD` reducer action (mirrors `SET_LESSON_DETAIL` / `SET_PLAYER_PROFILE` precedent).

**Out-of-scope for this surface today (deferred to follow-up tickets):**
- **Operator dial slider** — deferred to WS-176 (granular -1 to +1 override; complex micro-control distinct from Retire/Suppress/Reset; not blocking the dashboard's audit value).
- **Predicates-tab live data** — blocked on exploit-deviation predicate-calibration infrastructure; tab ships with empty-state banner.
- **Live deep-link from LiveAdviceBar badge** — Stream C anchor badge does not deep-link to dashboard in v1; AnchorLibrary entry is the only deep-link source.

---

## Output 1 — Scope classification

**Primary classification:** New fullscreen routed view — `SCREEN.CALIBRATION_DASHBOARD`. The dashboard joins AnchorLibraryView as the second top-level study surface for EAL.

**LIFECYCLE Gate-2 triggers (per `docs/design/LIFECYCLE.md`):**
- New fullscreen surface — YES (new SCREEN.* route)
- New interaction pattern — partially (deep-link auto-expand to anchor row reuses `expandedCardIds` Set pattern from `useAnchorLibraryView`; stacked-card evidence list is a re-use of HandReplay panel patterns; no genuinely new interaction primitive)
- Cross-product-line crossing — NO (main app only, no extension equivalent)
- Underserved persona target — NO (post-session-chris + scholar-drills-only well-served already; dashboard fulfills DS-58 fully where anchor-library serves the summary version)

**Verdict on Gate 2 requirement:** Gate 2 is **NOT required** for this surface. Reasoning:
- EAL program-level Gate 2 ran 2026-04-24 (`audits/2026-04-24-blindspot-exploit-anchor-library.md` + rerun) with explicit Stage E coverage of the calibration-dashboard surface and the graded-work-trap risk it carries (AP-06 copy discipline is the primary design constraint). All 9 EAL red lines + AP-01..08 are bound and have lint/test infrastructure shipped.
- PMC Gate 2 (sprint 1/2 + 2/2; SPR-064 + SPR-065; 2026-05-09) ran adversarial Devil's-Advocate review specifically on the dashboard's expansion. Concern 1 disposed REPLACEMENT — the expansion was rejected. The 3-tab IA that survives is the spec from 2026-04-24, which was Gate-2-cleared at program scope.
- Today's narrowings (operator-dial deferral, Predicates-empty-state, evidence-list-stacked-cards) are scope refinements within an already-Gate-2-cleared design space. None introduces new persona-blindspot risk; none alters the autonomy red lines, the graded-work-trap stance, or the AP-06/AP-08 enforcement.

If owner disagrees: re-run Gate 2 against `docs/design/ROUNDTABLES.md` EAL blind-spot template before authoring the Gate 4 spec amendment. (Recommendation: not warranted.)

---

## Output 2 — Personas served (re-confirmed at surface scope)

**In-scope (primary):**
- [post-session-chris](../personas/situational/post-session-chris.md) — primary; 5–30 min review block; the calibration-audit JTBD is canonical for this persona.
- [chris-live-player](../personas/core/chris-live-player.md) — primary identity (single-user app); post-session calibration audit mode.

**In-scope (secondary):**
- [scholar-drills-only](../personas/situational/scholar-drills-only.md) — secondary; dense interaction with calibration data.

**Out-of-scope (explicitly excluded per `chris-live-player.md` autonomy red lines #5/#7/#8 and Gate 4 spec line 79–82):**
- [mid-hand-chris](../personas/situational/mid-hand-chris.md) — live play; calibration-state MUST NOT contaminate live-table flow (AP-07).
- [presession-preparer](../personas/situational/presession-preparer.md) — drift visibility pre-session introduces decision-hesitation (Gate 2 Stage C #5). When `currentScreen === PRESESSION_DRILL`, the dashboard nav-link is hidden (deep-links from other surfaces still work — deliberate override).
- [newcomer-first-hand](../personas/core/newcomer-first-hand.md) — disqualifying; dashboard is empty / newcomer-banner until threshold crossed.

**Persona sufficiency check:** all in-scope personas are validated and have rich JTBD coverage. No new persona needed for today's slice.

---

## Output 3 — JTBD identified

The surface serves the Gate 4 spec's full JTBD list at the slice level today (predicates-deferred):

**Primary (canonical for today's slice):**
- **JTBD-DS-58** — *Validate-confidence-matches-experience* — Anchors tab + AnchorDetailPanel deep-dive serve the full DS-58 fulfillment (anchor-library transparency panel serves the summary version).
- **JTBD-DS-59** — *Retire-advice-that-stopped-working* — Retire / Suppress / Reset action buttons in AnchorDetailPanel (reuses `useAnchorRetirement` + `RetirementConfirmModal`).

**Secondary (partially served):**
- **JTBD-DS-47** — *Skill map / mastery grid* — dashboard complements anchor-library: library shows "what exists," dashboard shows "how is the model doing."

**Deferred (post-slice):**
- *VillainAssumption predicate calibration* (exploit-deviation JTBDs) — Predicates tab ships as empty-state shell pending exploit-deviation infrastructure.
- **JTBD-SR-32** — *Nominate a played hand for the theoretical corpus* — per-firing evidence list could be a nomination source, but full SR-32 wiring is Phase 2+ (not in WS-169).
- **Operator dial granular override** — micro-control deferred to WS-176; Retire/Suppress/Reset cover the override JTBD coarsely.

---

## Output 4 — Gap analysis

### What infrastructure is ready (the easy part)

- **`useAnchorLibraryView`** — filter / sort / expansion shape (Set<string>) reusable wholesale for AnchorCalibrationPanel; matches the dashboard's per-tab filter persistence requirement. ✓
- **`useAnchorRetirement`** — Retire / Suppress / Reset action wiring with undo toast + dispatch + `RetirementConfirmModal` orchestration. ✓
- **`RetirementConfirmModal`** — shared component already designed for both anchor-library AND calibration-dashboard reuse per journey doc; mounted at dashboard root. ✓
- **`sessionRollupSelectors.js` line 68–95** — AP-08 origin-separation pattern (separate `matcherFired` + `ownerCaptured` arrays, never blended); the new `anchorCalibrationSelectors.js` cites and mirrors this. ✓
- **`retirementCopy.js` line 36–49** — AP-06 `FORBIDDEN_PATTERNS` array + `validateRetirementCopy(text)` function; the new `calibrationCopy.js` cites and mirrors this for model-accuracy prose. ✓
- **`primitiveValidity.js`** — Bayesian posterior math for primitive validity score + CI; PrimitiveCalibrationPanel consumes wholesale. ✓
- **`librarySelectors.js`** — filter selector composition; reused by AnchorCalibrationPanel. ✓
- **Routing precedent** — `lessonConceptId` / `profilePlayerId` deep-link payload pattern in `uiReducer.js` lines 318–330 mirrors directly for `dashboardAnchorDeepLink` + `dashboardReturnScreen`. ✓
- **Tab pattern** — SelfCoachView TabBar + AnalysisView inline-tabs precedent; CalibrationDashboardView replicates inline (no shared `<Tabs>` component). ✓
- **Entitlement gating** — `FEATURE_TIER` map at `src/utils/entitlement/featureMap.js`; `CALIBRATION_DASHBOARD: TIERS.PRO` mirrors `EXPLOIT_ANCHOR_LIBRARY` precedent. ✓

### What is missing (the work)

- **Selectors** — `selectAnchorCalibration` / `selectAllAnchorCalibrations` / `selectPrimitiveValidity` (per-anchor and per-primitive rollups; AP-08 separation enforced).
- **Calibration copy generator** — `buildCalibrationProse` (AP-06 ladder, model-accuracy framing) + `FORBIDDEN_PATTERNS` array + `validateCalibrationProse`.
- **Route + shell** — `SCREEN.CALIBRATION_DASHBOARD` constant, `HASH_TO_SCREEN` entry, lazy-load registration in PokerTracker.jsx, ViewRouter case, `useCalibrationDashboard` orchestration hook, view shell with CalibrationTabs.
- **Anchors panel content** — row layout consuming `useAnchorLibraryView` filters + `selectAllAnchorCalibrations`; click-row → expand AnchorDetailPanel (deep-dive variant distinct from S20).
- **AnchorDetailPanel deep-dive** — model-accuracy prose + full evidence list as stacked cards + primitives list with validity + override action buttons (Retire / Suppress / Reset; NO operator dial).
- **Predicates panel empty-state** — banner: "Predicate calibration ships with the exploit-deviation project. Anchors and primitives use independent infrastructure and are live above."
- **Primitives panel content** — validity posteriors + CI + dependent-anchor counts + invalidation badge.
- **EnrollmentStateBanner** — informational banner when `not-enrolled` (no nag).
- **CalibrationEmptyState** — pre-firing state on Anchors tab.
- **AnchorLibraryView wire-in** — replace toast at line 136–140 with real navigation; drop `aria-disabled="true"` on the deep-link button in `AnchorDetailPanel.jsx` (S20).
- **Tests + Playwright baselines.**

### What is at risk (anti-patterns to avoid)

- **AP-06 — "Your observations accuracy" framing.** Dashboard is the surface where the graded-work trap is strongest (Gate 2 Stage E). Two copy-word changes slide the dashboard from "model accuracy" framing to "your observation accuracy." Mitigation: `calibrationCopy.js` mirrors `retirementCopy.js`'s `FORBIDDEN_PATTERNS` array exactly; CI-grep target; AP-06 DOM-assertion test (renders panel, asserts no FORBIDDEN_PATTERN matches in textContent).
- **AP-08 — Auto-fused signals.** Evidence list MUST show `matcher-system` vs `owner-captured` origin on every row; never sums into a single "evidence count" without origin breakdown. Mitigation: `selectAnchorCalibration` returns separate arrays + separate aggregates (mirrors `sessionRollupSelectors.js` line 68 pattern); AP-08 DOM-assertion test (asserts origin badge present on every evidence card).
- **AP-04 — Calibration score.** No single scalar summarizes anchor / predicate / primitive calibration. Every row is multi-dimensional (observed / predicted / CI / n / trend). Mitigation: panel-row data shape never includes a single-number summary field.
- **AP-05 — Retired-reconsider nudges.** Retired anchors visible via status filter but never surfaced with proactive re-enable UI. Mitigation: filter chips include `retired` as opt-in; no auto-prompt.
- **AP-01 — Anchor leaderboard.** Default sort A-Z; `Largest model deviation` sort option exists but is explicitly labeled as a model-audit tool, not an edge-ranking. Mitigation: sort enum from `anchorSortStrategies.js` is canonical (no `biggest-edge` value).
- **AP-07 — Cross-surface leakage.** Calibration state must never leak to LiveAdviceBar / TableView / SizingPresetsPanel. Mitigation: `sourceUtilPolicy.test.js` extends to forbid `CalibrationDashboardView/*` imports from live-table surfaces (whitelist-only pattern matches existing PIO/SCF guard).
- **Autonomy red line #5** — no shame copy, no streak counters, no engagement-pressure substrate. CalibrationEmptyState copy is factual ("No anchor firings yet. Calibration data accrues as anchors fire in matched hands.") — no "you should fire more anchors" nudge.
- **Autonomy red line #7** — model-accuracy framing throughout; never "your accuracy."
- **Autonomy red line #8** — `presession-preparer` excluded; nav-guard hides dashboard link on PRESESSION_DRILL screen.
- **Autonomy red line #9** — incognito observations (where `contributesToCalibration === false`) filtered from dashboard's evidence list at the selector layer.

---

## Output 5 — Verdict

**Verdict:** YELLOW — proceed to Gate 4 spec amendment + implementation, with three explicit conditions.

**Reasoning:**
1. EAL program completed Gates 1–4 + shipped Phase 6 Streams A/B/C/D (anchor library + matcher + LiveAdviceBar badge + auto-retirement banner + session rollup). The surface-level decisions made today (operator-dial deferral / Predicates-empty-state / evidence-list-stacked-cards) are refinements on top of an already-validated 3-tab design space.
2. All 9 binding EAL constraints (red lines #1–9, AP-01..08) are well-understood and have shipped lint/test infrastructure to enforce. PMC Gate 2 adversarial review (sprint 1/2 + 2/2) ratified the existing 3-tab architecture by REPLACEMENT — the expanded ledger/aggregator architecture was the contested element, and it is dead.
3. Today's deferred items (operator dial, Predicates-tab live data) are real future work but their absence does not make today's slice incoherent — Anchors + Primitives + Predicates-empty-state ships a complete consumer surface for the calibration-audit + override JTBDs. AnchorLibraryView's `handleOpenDashboard` toast is replaced with real navigation, closing the long-deferred deep-link gap.
4. Gate 2 (Blind-Spot Roundtable) is not required: persona-blindspot risk was managed at program-level Gate 2 (2026-04-24) and adversarially re-stress-tested at PMC Gate 2 (2026-05-09); no new persona, no new product line, no new interaction pattern.
5. Gate 4 surface spec exists; it requires AMENDMENT (not full re-author) for today's narrowed slice — operator-dial deferral, evidence-layout lock to stacked cards, Predicates-empty-state explicit copy, and §History note for PMC REPLACEMENT.

**Verdict YELLOW (not GREEN) reasoning:** Three conditions on the verdict are blocking on Gate 4 spec amendment landing in this same session. If amendment doesn't land, downgrade to RED.

**Conditions on the verdict:**
- **C1.** Gate 4 surface spec MUST be amended in the same session (`docs/design/surfaces/calibration-dashboard.md`):
  - Add §History entry for 2026-05-09 PMC REPLACEMENT + WS-169 re-release + this session's narrowings.
  - Annotate operator-dial sections (line 131 / 186 / 255 / 319) with "DEFERRED to WS-176" callout.
  - Lock evidence-list layout to stacked cards in §Anatomy + §AnchorCalibrationPanel.
  - Make Predicates-tab empty-state copy explicit (today's slice) per §Environment assumptions line 234.
- **C2.** AP-06 / AP-08 DOM-assertion tests MUST land in the same PR (component-level enforcement; CI-grep target).
- **C3.** `sourceUtilPolicy.test.js` MUST extend to forbid `CalibrationDashboardView/*` imports from live-table surfaces (mirrors PIO/SCF whitelist-only pattern).

---

## Open questions for owner (none blocking)

1. **Predicates-tab empty-state copy.** Today's slice ships an empty-state shell; the banner copy proposed is "Predicate calibration ships with the exploit-deviation project. Anchors and primitives use independent infrastructure and are live above." Acceptable, or prefer different framing? *Recommendation: ship the proposed copy; revise on first owner walkthrough.*
2. **`Largest model deviation` sort option.** Spec line 220 makes this sort available with explicit labeling. Today's slice can defer to A-Z + `last-fired` only (matches anchor-library) and add the model-deviation sort in a follow-up if usage data shows it's needed. *Recommendation: ship A-Z + last-fired only today; the model-deviation sort is the surface where the leaderboard temptation is real, and shipping it without owner walkthrough on the labeling is risky.*
3. **Operator dial deferral side-effect.** Without the dial, the "granular override" JTBD lives only in the binary Retire/Suppress/Reset actions. Is that acceptable for v1, or should the empty space be backfilled with anything visible (e.g., a placeholder card explaining the dial is coming in WS-176)? *Recommendation: no placeholder — placeholders are aesthetic noise; the dial's absence is invisible to the v1 user who hasn't seen the dial spec.*

These are non-blocking; ship the slice and revisit on first owner walkthrough.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface spec (to be amended this session): [`surfaces/calibration-dashboard.md`](../surfaces/calibration-dashboard.md)
- Anchor library spec (deep-link source): [`surfaces/anchor-library.md`](../surfaces/anchor-library.md)
- EAL program-level Gate 2: [`audits/2026-04-24-blindspot-exploit-anchor-library.md`](2026-04-24-blindspot-exploit-anchor-library.md) (+ rerun)
- EAL Stream C Gate 1 (sibling, 2026-05-09): [`audits/2026-05-09-entry-eal-stream-c-live-anchor-badge.md`](2026-05-09-entry-eal-stream-c-live-anchor-badge.md)
- PMC Gate 2 sprint 2/2 close-out: [`audits/2026-05-09-blindspot-pmc-failure-modes.md`](2026-05-09-blindspot-pmc-failure-modes.md) (REPLACEMENT verdict on dashboard expansion)
- Anchor retirement journey: [`journeys/anchor-retirement.md`](../journeys/anchor-retirement.md)
- Sprint plan: `.claude/workstream/sprints/SPR-066.yaml`
- Implementation plan: `C:/Users/chris/.claude/plans/gleaming-weaving-cook.md`

---

## Change log

- 2026-05-09 — Created. Surface-specific Gate 1 for CalibrationDashboardView fullscreen route; verdict YELLOW with three conditions (C1: Gate 4 amendment same session; C2: AP-06/AP-08 DOM-assertion tests in same PR; C3: sourceUtilPolicy extension). Gate 2 not required (persona-blindspot risk managed at EAL program-level Gate 2 + adversarially re-stress-tested at PMC Gate 2 sprint 2/2). PMC REPLACEMENT verdict (SPR-065) confirmed the 3-tab IA was always correct; expanded ledger / aggregator / per-villain + per-situation tab architecture is dead. Operator dial deferred to WS-176 follow-up. Predicates tab ships as empty-state shell pending exploit-deviation predicate-calibration infrastructure. Evidence-list layout locked to stacked cards.
- 2026-05-09 — Verdict ratified at SPR-066 plan approval. Status flipped OPEN → YELLOW. Implementation proceeding under WS-169 with C1-C3 binding. Plan file: `C:/Users/chris/.claude/plans/validated-gathering-rocket.md`.
