# Surface — Calibration Dashboard

**ID:** `calibration-dashboard`
**Parent surface:** top-level routed view (`SCREEN.CALIBRATION_DASHBOARD`, new route added in exploit-deviation Phase 6 OR exploit-anchor-library Phase 5 — whichever ships first).
**Cross-project shared surface:** this dashboard is authored **jointly by Exploit Deviation and Exploit Anchor Library**. Both projects proposed the same `CalibrationDashboardView/`; per S3 handoff cross-project coordination flag + §Cross-project coordination below, this spec ratifies the **one-view-with-tabs** architecture (not two separate views).
**Product line:** Main app. No extension-side equivalent.
**Tier placement:** Pro (inherits the calibration-framework's Pro gating). Flag-gated via `ENABLE_CALIBRATION_DASHBOARD`.
**Last reviewed:** 2026-04-24 (Gate 4, Session 4)

**Code paths (future — Phase 6 exploit-deviation / Phase 5 exploit-anchor-library):**
- `src/components/views/CalibrationDashboardView/CalibrationDashboardView.jsx` (new — route root with tabs)
- `src/components/views/CalibrationDashboardView/CalibrationTabs.jsx` (new — tab navigation: `predicates` | `anchors` | `primitives`)
- `src/components/views/CalibrationDashboardView/PredicateCalibrationPanel.jsx` (new — exploit-deviation side; per-predicate table)
- `src/components/views/CalibrationDashboardView/AnchorCalibrationPanel.jsx` (new — exploit-anchor-library side; per-anchor table + expanded detail)
- `src/components/views/CalibrationDashboardView/PrimitiveCalibrationPanel.jsx` (new — perception-primitive validity posterior; shared between both projects since primitives can invalidate both exploit-deviation assumptions AND EAL anchors in principle)
- `src/components/views/CalibrationDashboardView/AnchorDetailPanel.jsx` (new — per-anchor deep-dive: sparkline + evidence list + override controls)
- `src/components/views/CalibrationDashboardView/EnrollmentStateBanner.jsx` (new — informational banner when `not-enrolled`; no nag)
- `src/components/views/CalibrationDashboardView/CalibrationEmptyState.jsx` (new — pre-firing state per tab)
- `src/hooks/useCalibrationDashboard.js` (new — tab state + selected-anchor state + deep-link handling)
- `src/utils/anchorLibrary/anchorCalibrationSelectors.js` (new — `selectAnchorCalibration(anchors)`, `selectPrimitiveValidity(primitives)`, split by signal source per AP-08)

**Related docs:**
- `docs/projects/exploit-deviation/calibration.md` §8 (Reporting — dashboard spec; this surface extends that reporting design)
- `docs/projects/exploit-deviation/schema.md` v1.1 (calibration fields inherited)
- `docs/projects/exploit-anchor-library/schema-delta.md` §3 + §7 (anchor calibration extensions)
- `docs/projects/exploit-anchor-library/WRITERS.md` §`exploitAnchors` (W-EA-3 study-override-writer — invoked by override actions here)
- `docs/projects/exploit-anchor-library/anti-patterns.md` §AP-04 (no scalar score), §AP-05 (no unretire nudges), §AP-06 (graded-work trap), §AP-08 (no auto-fused signals)
- `docs/projects/exploit-anchor-library/gate3-owner-interview.md` §Q2 (opt-out incognito affects data visibility)
- `docs/design/personas/core/chris-live-player.md` §Autonomy constraint red lines #2, #5, #7
- `docs/design/surfaces/anchor-library.md` (index surface; deep-links here)
- `docs/design/journeys/anchor-retirement.md` (override actions originate here or on anchor-library)

---

## Purpose

The deep-dive calibration surface. Answers the load-bearing question of DS-58: **"Does the model's prediction match my actual observations?"** — evaluated **at the model**, never at the observer. Surfaces observed-vs-predicted rate, credible interval, per-firing evidence list, trend arrow, sparkline, retirement state, perception-primitive validity, and override actions (retire / suppress / reset / operator dial adjustments).

This surface is where **the graded-work trap is strongest** (Gate 2 Stage E). Two copy-word changes slide the dashboard from "model accuracy" framing to "your observation accuracy." AP-06 copy-discipline is enforced as primary design constraint on every text node in this view. Journey doc `anchor-retirement.md` carries the rule.

**One dashboard, three tabs.** Predicate-level (exploit-deviation) + anchor-level (exploit-anchor-library) + primitive-level (cross-project) share this view. The decision and rationale are in §Cross-project coordination below.

Non-goals (explicit):
- **Not a grading surface.** Never evaluates Chris's observations. Never shows "your accuracy" / "your score" / "your calibration." Model-accuracy framing throughout.
- **Not a scalar score.** No single number summarizes anchor / predicate / primitive calibration. AP-04 refused.
- **Not a leaderboard.** Anchors are listed alphabetically OR in the owner-set order from Anchor Library filters — not by "biggest gap" or equivalent competitive-framing default.
- **Not a nudge surface.** No "retired anchors to reconsider" (AP-05). No "you haven't checked the dashboard in N days" (AP-02 / AP-03).
- **Not a live-surface.** `mid-hand-chris` excluded entirely (red line #8 + AP-07).
- **Not a drill surface.** Drills live on PresessionDrillView; dashboard is observational.

---

## JTBD served

Primary:
- **`JTBD-DS-58`** — Validate-confidence-matches-experience (observed-vs-predicted transparency). The full DS-58 fulfillment lives here (anchor-library transparency panel serves the summary version).
- **`JTBD-DS-59`** — Retire-advice-that-stopped-working. Override actions for retirement / suppression / reset are primary affordances.
- **(exploit-deviation)** Every `VillainAssumption` predicate-level calibration JTBD from `exploit-deviation/calibration.md` §8 — inherited via predicates tab.

Secondary:
- **`JTBD-DS-47`** — Skill map / mastery grid. Dashboard is the complement to anchor-library's grid view — library shows "what exists," dashboard shows "how is the model doing."
- **`JTBD-SR-32`** — Nominate a played hand for the theoretical corpus (Proposed). Dashboard's per-firing evidence list is a natural nomination source (deferred to Phase 2+ for full SR-32 wiring).

Not served (explicit non-goals):
- **`JTBD-DS-57`** — Capture-the-insight. Dashboard is read-side + override-side; capture lives on `hand-replay-observation-capture`.
- **`JTBD-MH-*`** — live mid-hand jobs.

---

## Personas served

**Primary:**
- **`post-session-chris`** — primary consumer. Post-session review is the canonical context — "what happened tonight, which anchors fired, which predictions matched observation."
- **`scholar-drills-only`** — dense interaction with predicate + anchor calibration data; study-block context.

**Secondary:**
- **`chris-live-player`** (when post-session) — inherits post-session-chris's relationship with this surface.

**Explicitly excluded:**
- **`mid-hand-chris`** — no live-surface access (red line #8).
- **`presession-preparer`** — **excluded from dashboard deep-dive** (Gate 2 Stage C #5 — drift visibility pre-session introduces decision-hesitation). Presession-preparer gets a filtered view of anchor-library without drift; they do NOT enter this dashboard from the presession flow. Explicit nav-guard: when `currentScreen === PRESESSION_DRILL`, the dashboard nav-link is hidden. Deep-links from other surfaces still work (deliberate override).
- **`newcomer-first-hand`** — disqualifying; dashboard is empty / newcomer-banner until threshold crossed.

---

## Anatomy

```
┌── CalibrationDashboardView ─────────────────────────────────┐
│  [← Back]  Calibration Dashboard                (Esc key)   │
├─────────────────────────────────────────────────────────────┤
│  Enrollment banner (only if not-enrolled):                  │
│   ℹ  Enrollment off — dashboard shows the model's seed      │
│      priors + Tier 1 simulator results. Observation-driven  │
│      calibration data accrues when enrolled.                │
│      [ Open Settings ]                                      │
├─────────────────────────────────────────────────────────────┤
│  Tabs:  [ Predicates ]  [ Anchors ]  [ Primitives ]         │
├─────────────────────────────────────────────────────────────┤
│  (Anchors tab shown as default for EAL scope example)       │
│                                                             │
│  ┌── AnchorCalibrationPanel ────────────────────────────── ┐│
│  │  Sort: [ A-Z ▾ ]   Filter: [ active ▾ ]                 ││
│  │  ┌── anchor row ─────────────────────────────────────── ││
│  │  │  Nit Over-Fold to River Overbet (4-Flush)           ││
│  │  │  ● active · river · overfold                         ││
│  │  │  Observed: 74%  ·  Predicted: 68%  ·  Δ +6 pt        ││
│  │  │  CI: [62%, 84%] (n=34)  ·  sparkline ═╱══╲═╱═        ││
│  │  │  Trend: stable (since last 10 firings)               ││
│  │  │  [ Details ▼ ]                                       ││
│  │  └──────────────────────────────────────────────────── ││
│  │  ┌── (expanded detail — click Details) ─────────────── ││
│  │  │  Model-accuracy summary:                             ││
│  │  │   The model predicts this archetype 68% of the time.││
│  │  │   Observed 74% (±10%) across 34 firings.            ││
│  │  │   Prediction falls within the credible interval     ││
│  │  │   — model is well-calibrated for this anchor.        ││
│  │  │                                                      ││
│  │  │  Perception primitives driving prediction:           ││
│  │  │   · PP-01 (Nit re-weights aggressively on scare)    ││
│  │  │     Primitive validity: 0.78 (CI [0.62, 0.91])      ││
│  │  │                                                      ││
│  │  │  Evidence list (chronological, last 10):             ││
│  │  │   · 2d ago  · matcher-observed  · +0.42 bb/pot      ││
│  │  │   · 4d ago  · owner-captured    · (qualitative)     ││
│  │  │   · 5d ago  · matcher-observed  · +0.38 bb/pot      ││
│  │  │   ... (up to 10 most recent; full list in modal)    ││
│  │  │                                                      ││
│  │  │  Override actions:                                   ││
│  │  │   [ Retire ]  [ Suppress ]  [ Reset calibration ]    ││
│  │  │   [ Adjust operator dial ] (slider, -1 to +1)        ││
│  │  └──────────────────────────────────────────────────── ││
│  │  ┌── next anchor row ... ────────────────────────────── ││
│  │  ...                                                   ││
│  └────────────────────────────────────────────────────── ──┘│
└─────────────────────────────────────────────────────────────┘
```

### Tabs — `CalibrationTabs`

3 tabs:

1. **Predicates** (exploit-deviation) — per-`VillainAssumption` calibration. Predicate rows show Tier 1 scenario pass/fail + Tier 2 calibration gap + sample-size-warning flag + activation rate + dial-override rate + status. Full spec in `exploit-deviation/calibration.md` §8.1.
2. **Anchors** (exploit-anchor-library) — per-`ExploitAnchor` calibration. Anchor rows show observed rate + predicted rate + credible interval + sample size + trend + sparkline. Expanded detail panel per row with evidence list + primitives + override actions.
3. **Primitives** (cross-project) — per-`PerceptionPrimitive` validity posterior. Primitive rows show validity score + credible interval + dependent-anchor-count + dependent-anchor names. Cross-anchor invalidation (I-EAL-9) is the key surface here — if a primitive's validity crosses below 0.5, all dependent anchors are flagged.

Default tab on entry:
- **Nav-referrer** → Anchors tab.
- **Deep-link from anchor-library** → Anchors tab + scrolled/expanded to the deep-linked anchor.
- **Deep-link from exploit-deviation briefing** → Predicates tab + scrolled to relevant predicate.
- **localStorage-persisted** — last-viewed tab remembered across sessions.

### Enrollment banner — `EnrollmentStateBanner`

Rendered only when `observation_enrollment_state === 'not-enrolled'`:

- **Informational only.** Not a nag; no repeated prompts. Single-render per view visit; no dismiss button (banner is state-driven, not interaction-driven).
- **Copy:** `"Enrollment off — dashboard shows the model's seed priors + Tier 1 simulator results. Observation-driven calibration data accrues when enrolled."` — factual, no urgency.
- **Action:** `[ Open Settings ]` button linking to enrollment toggle.
- **No negative copy:** never `"Enable calibration to see your data!"` or `"Dashboard is empty — enroll now."` Both violate red line #5 + red line #7.

### Anchors panel — `AnchorCalibrationPanel`

**Collapsed row layout (per anchor):**
- Archetype name (truncated if wide).
- Status dot + chip.
- Street + polarity chips (compact).
- **Observed: X%  ·  Predicted: Y%  ·  Δ ±Z pt** — the model-accuracy framing. Observed first (that's the ground), predicted second (that's the claim), delta last.
- **CI: [a%, b%] (n=N)** — credible interval + sample size.
- **Sparkline** — observed-rate trace over last 20 firings. ~40px wide × 12px tall. Dots at each firing; line connecting.
- **Trend: {stable / improving / drifting}** — text only, no arrow colorized by "good/bad" (matched stable is good when n is sufficient; drifting is expected while n is low; the words are neutral).
- **[ Details ▼ ]** — button to expand inline detail.

**Expanded detail layout:**
- **Model-accuracy summary prose** — 2–3 sentence natural-language rendering. Copy generator follows AP-06 ladder strictly:
  - ✓ `"The model predicts this archetype 68% of the time. Observed 74% (±10%) across 34 firings. Prediction falls within the credible interval — model is well-calibrated for this anchor."`
  - ✗ `"Your observations match the model's prediction 76% of the time."` (grades the observer)
  - ✗ `"You have observed this 34 times — good data accumulation."` (engagement-pressure coded as praise)
  - Copy generator lives in `src/utils/anchorLibrary/calibrationCopy.js` (Phase 5).
- **Perception primitives driving prediction** — list of `perceptionPrimitiveIds` with each primitive's validity posterior + CI. Tap on primitive → navigate to Primitives tab scrolled to that primitive.
- **Evidence list (chronological, last 10)** — per-firing rows with origin (`matcher-observed` vs `owner-captured`), timestamp (relative), metric (EV delta for matcher observations; "qualitative" for owner-captured with no numeric). **AP-08 signal-separation is enforced at render level** — origin is always visible; rows are never summed into a single "observation count." Full list beyond 10 → modal with virtualized scroll.
- **Override actions — 3 primary:**
  - `[ Retire ]` — enters retirement journey at step 2 (confirm with status-transition summary).
  - `[ Suppress ]` — enters retirement journey at step 2 with suppress flow.
  - `[ Reset calibration ]` — enters retirement journey at step 2 with reset flow (destructive; 2-tap confirm; undo available for 12s).
- **Adjust operator dial** — slider from -1 to +1 (inherited from `VillainAssumption.operator.currentDial`). Granular override short of retirement. Changes trigger W-EA-3 single-transaction write.

### Predicates panel — `PredicateCalibrationPanel`

Full spec inherited from `exploit-deviation/calibration.md` §8.1. Column layout:

- Predicate ID + title.
- Tier 1 scenario: ✓ / ✗ / ⊘ (not-run).
- Tier 2 gap: numeric with sample-size-warning flag if n < 20.
- Activation rate.
- Dial-override rate.
- Status chip.

Row expansion: same pattern as anchors — model-accuracy prose + evidence list + override actions.

### Primitives panel — `PrimitiveCalibrationPanel`

- Primitive name + ID.
- Validity posterior score + CI.
- Dependent anchor count (from `dependentAnchorCount` invariant I-EAL-9).
- Dependent anchor list (tap each → Anchors tab scrolled to that anchor).
- Status: `load-bearing` (validity ≥ 0.5) / `at-risk` (0.3-0.5) / `invalidated` (below 0.3).
- Cross-anchor invalidation visualization: when a primitive is `at-risk` or `invalidated`, dependent anchors are highlighted (amber / red border on their rows in Anchors tab).

---

## State

- **UI (`useUI`):** `currentScreen === SCREEN.CALIBRATION_DASHBOARD`; `anchorDeepLink?` / `predicateDeepLink?` / `primitiveDeepLink?` optional payloads from deep-link entry.
- **Anchor library (`useAnchorLibrary`):** anchors with `validation` + `evidence` fields populated.
- **Assumption engine (`useAssumptionEngine`):** `VillainAssumption` predicates + calibration metrics (cross-project).
- **Dashboard state (`useCalibrationDashboard`):**
  - `activeTab: 'predicates' | 'anchors' | 'primitives'` — localStorage-persisted.
  - `sort: 'alphabetical' | 'last-fired' | 'sample-size' | 'calibration-gap'` — persisted per tab.
    - **NOTE:** `calibration-gap` sort is allowed on this surface (not on anchor-library) because the dashboard's purpose IS model-accuracy audit. It is NOT "biggest edge" (AP-01 refused); it is "largest calibration gap," which serves the model-audit JTBD. Label explicitly: `"Largest model deviation"` (clarifies that big = needs-attention, not big = best).
  - `filter: { status: [], tier: [] }` — persisted per tab.
  - `expandedRowIds: Set<string>` — session-scoped.

### Mutations

- **Override actions** (Retire / Suppress / Reset / operator dial) → W-EA-3 `study-override-writer` single-transaction per anchor. For predicates: equivalent writer in exploit-deviation.
- **Tab / sort / filter changes** → localStorage write (100ms debounce).
- **Nothing else** — this is read-side + limited-override-write surface.

### Environment assumptions

- Both `AnchorLibraryProvider` and `AssumptionProvider` (exploit-deviation) mounted at app root.
- If EAL Phase 5 ships before exploit-deviation Phase 6, the `Predicates` tab renders a "coming soon" empty state; tabs still render.
- If exploit-deviation Phase 6 ships before EAL Phase 5, the `Anchors` + `Primitives` tabs render "coming soon"; tabs still render.

---

## Props / context contract

### `CalibrationDashboardView` props
- `scale: number` — viewport scale.

### Context consumed
- `useAnchorLibrary()`, `useAssumptionEngine()` (cross-project), `useCalibrationDashboard()`, `useUI()`.

---

## Key interactions

1. **Tab switch.** Tap tab → panel swaps. Tab state persists to localStorage.
2. **Sort change.** Per-tab sort dropdown. Default A-Z; `Largest model deviation` available explicitly (with clarifying label).
3. **Expand row.** Tap `[ Details ▼ ]` → inline expansion with prose + evidence + primitives + override actions. Multiple rows expandable; independent state.
4. **Deep-link from anchor-library.** On entry, auto-scroll to deep-linked anchor's row + auto-expand detail.
5. **Override action.** Tap `[ Retire ]` / `[ Suppress ]` / `[ Reset calibration ]` → enters retirement journey at step 2. Full journey in journey doc.
6. **Operator dial adjust.** Slider drag → debounced 300ms → W-EA-3 write. Visual dial position reflects current value from `operator.currentDial`.
7. **Primitive deep-link (Anchors → Primitives).** Tap primitive name in anchor's expanded detail → switch to Primitives tab + scroll to that primitive.
8. **Anchor deep-link (Primitives → Anchors).** Tap dependent anchor name in primitive's row → switch to Anchors tab + scroll-expand to anchor.
9. **Back navigation.** Back button / Escape → caller. If deep-link entry, return to caller.

### Keyboard / accessibility
- Tabs are standard role="tab" with arrow-key navigation.
- Row expansion has `aria-expanded`.
- Sparklines have accessible text alternatives (`"Observed rate over last 20 firings: trend stable between 62% and 78%"`).
- Override action buttons grouped with ARIA-labelled button group.
- Evidence rows are ARIA-labelled with origin + timestamp + metric combined.

---

## Cross-project coordination (resolves S3 handoff open decision)

**Question.** Exploit Deviation proposed `CalibrationDashboardView/` for predicate-level calibration (Phase 6+). Exploit Anchor Library proposed the same path for anchor-level calibration (Phase 5). Should this be one view with tabs, or two sibling views?

**Decision: ONE view with tabs.** Rationale:

1. **Cognitive model unity.** The owner opens "the calibration dashboard" — cognitively a single destination. Forcing them to pick `predicates-dashboard` vs `anchors-dashboard` adds a decision-point at every entry that provides no value (they'll check both anyway during post-session review).
2. **Dashboard sprawl prevention.** Multi-project dashboards tend to proliferate. Precedent: sidebar's 6-zone architecture explicitly rejected per-project sidebar zones after Shape Language Gate 2 for the same reason.
3. **Primitives are genuinely cross-project.** A `PerceptionPrimitive` can invalidate EAL anchors AND (in principle, once exploit-deviation grows primitive usage) predicates. The primitives tab is structurally shared; splitting would duplicate.
4. **Shared copy-discipline.** Both projects enforce AP-06 model-accuracy framing. One view with shared copy generator (`calibrationCopy.js`) prevents drift between the two.
5. **Code-path cohesion.** `CalibrationDashboardView.jsx` + tabs is ~400 LOC; two separate views would be ~700 LOC with duplicated banners + tab navigation + empty states + enrollment-banner logic. Tax for the split is real.

**Decision flags for owner override at S4 review.** If owner prefers two views on autonomy grounds (harder to conflate the two calibration signals), the spec is reversible — split `CalibrationDashboardView/AnchorCalibrationPanel.jsx` into `AnchorCalibrationDashboardView.jsx` as a sibling. All the rest of the spec is unchanged. Owner-interview-style flag — this is NOT settled on evidence alone.

**Implementation order.** Whichever project ships first owns the `CalibrationDashboardView/` skeleton + tab navigation + enrollment banner. Second project adds its tab. Coordination for DB_VERSION (per EAL-G4-DB) similarly follows the `max(current+1, target)` pattern.

---

## Anti-patterns refused at this surface

- **AP-01 — Anchor leaderboard.** Default sort A-Z. `Largest model deviation` sort option exists BUT is explicitly labeled as a model-audit tool, not an edge-ranking.
- **AP-02 — "Your top exploit tonight" auto-surfacing.** Dashboard is opened, never pushed. No banner on TableView saying "check the dashboard." No toast after session-end.
- **AP-03 — Anchor streaks.** No consecutive-session tracking. Sparkline is raw observational data.
- **AP-04 — Calibration score.** No single scalar. Every row is multi-dimensional (observed / predicted / CI / n / trend).
- **AP-05 — Retired-reconsider nudges.** Retired anchors visible via status filter but never surfaced with proactive re-enable UI.
- **AP-06 — "Your observations accuracy" framing.** Copy generator enforces model-accuracy ladder on every prose generation. Journey doc carries the rule to retirement flow.
- **AP-07 — Cross-surface leakage.** This surface IS calibration-state-heavy (by design); assertion: no `TableView` / `LiveAdviceBar` / `SizingPresetsPanel` components render here.
- **AP-08 — Auto-fused signals.** Evidence list shows `matcher-observed` vs `owner-captured` origin on every row; never sums into a single "evidence count" without origin breakdown. Assertion: `evidenceListOriginVisibleCount === evidenceListRowCount`.

---

## Red-line compliance checklist (Gate 5 → EAL-G5-RL)

- **#1 Opt-in enrollment** — dashboard renders even when `not-enrolled` (seed priors + Tier 1 simulator results visible); no silent enrollment.
- **#2 Full transparency on demand** — every row has `[ Details ▼ ]`; evidence list + primitives list + override actions reachable. No "pro tier" gating on transparency data (pro-tier is for the surface existence, not for transparency depth).
- **#3 Durable overrides** — retirement action → durable status change; no auto-surfaced reconsideration.
- **#4 Three-way reversibility** — Retire / Suppress / Reset all available per anchor.
- **#5 No streaks / engagement-pressure** — no streak UI, no "days since last check" nagging.
- **#6 Flat access** — retired anchors visible (filterable but not hidden by default).
- **#7 Editor's-note tone** — model-accuracy prose is factual. Empty states avoid praise/pressure.
- **#8 No cross-surface contamination** — assert no live-surface components; assert calibration state never leaks to `LiveAdviceBar`.
- **#9 Incognito observation mode** — evidence list respects `contributesToCalibration` flag on each observation; incognito observations do NOT appear in the matcher-vs-captured evidence list on this surface (they remain visible on the anchor's capture-side in HandReplayView). DOM assertion: no evidence row has `contributesToCalibration: false`.

---

## Known behavior notes

- **Empty state per tab** — before any firings accumulate, Anchors tab shows `"No anchor firings yet. Calibration data accrues as anchors fire in matched hands."` Factual, no engagement-pressure nudge.
- **Sparkline at n < 5** — shows "Insufficient data for sparkline (n=3)" instead of attempting to render with too few points.
- **Trend calculation** — requires n ≥ 10 firings; text is `"(collecting data)"` until threshold crossed.
- **Operator dial drag** — visual state updates on drag; persistence debounced 300ms; final write on release. Undo toast for 12s after explicit release (no undo for mid-drag drags).
- **Incognito observations** — filtered from the dashboard's evidence list because `contributesToCalibration: false` is authoritative. This is red line #9's structural guarantee at the read side. The observation is still visible on the hand-replay-view's AnchorObservationList (its capture-side), but never here.
- **Primitive invalidation ripple visualization** — when user taps "What does this mean?" on an at-risk primitive, a modal shows the list of dependent anchors and the penalty factor that will apply. No auto-retire happens from the dashboard; the penalty is scheduled for next session-close per schema-delta §3.3.1.

---

## Known issues

None at creation — new surface.

Placeholder for future audit findings:
- [CD-TBD-*] — findings as they surface.

---

## Test coverage

### Unit tests (Phase 5/6 target)
- `CalibrationTabs.test.jsx` — tab switching, default tab resolution, deep-link handling.
- `AnchorCalibrationPanel.test.jsx` — row layout, expanded detail, model-accuracy copy assertion (AP-06 compliance), operator-dial drag.
- `PredicateCalibrationPanel.test.jsx` — (exploit-deviation side; inherited from their project test plan).
- `PrimitiveCalibrationPanel.test.jsx` — validity display, dependent-anchor deep-links, invalidation-ripple visualization.
- `calibrationCopy.test.js` — AP-06 copy-ladder enforcement: forbidden strings never generated.
- `anchorCalibrationSelectors.test.js` — incognito observations filtered out (red line #9 assertion).
- `useCalibrationDashboard.test.js` — tab + sort + filter persistence.

### Integration tests (Phase 5/6)
- `CalibrationDashboardView.e2e.test.jsx` — full flow: nav entry → tab switch → row expand → override action → journey entry.
- Red-line assertion suite (EAL-G5-RL) — 9 assertions.

### Visual verification (Playwright)
- `EVID-PHASE5-EAL-S2-ANCHORS-TAB` — default Anchors tab with 4 seed anchors.
- `EVID-PHASE5-EAL-S2-ANCHOR-EXPANDED` — one anchor expanded with model-accuracy prose.
- `EVID-PHASE5-EAL-S2-PRIMITIVES-TAB` — Primitives tab with validity posteriors.
- `EVID-PHASE5-EAL-S2-AT-RISK-PRIMITIVE` — at-risk primitive + dependent-anchor highlight.
- `EVID-PHASE5-EAL-S2-NOT-ENROLLED` — enrollment banner visible, seed-prior-only data.
- `EVID-PHASE6-EDEV-S2-PREDICATES-TAB` — (coordination with exploit-deviation).

---

## Cross-surface dependencies

- **`anchor-library`** — origin for deep-links to this surface.
- **`anchor-retirement` journey** — target for all override actions.
- **`hand-replay-observation-capture`** — source of owner-captured observations visible in evidence list (origin=owner-captured rows).
- **(exploit-deviation side)** `PresessionDrillView`, briefings-queue — may deep-link here from predicate-level details.
- **Settings (future)** — enrollment toggle; dashboard reads state.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 4 artifact (EAL-G4-S2). Cross-project one-view-with-tabs architecture ratified (flagged reversible for owner override). Full anatomy + 3-tab spec + model-accuracy copy discipline + 9 red-line compliance assertions + AP-01..08 anti-pattern cross-references + Phase 5/6 code-path plan + 6 Playwright evidence placeholders. Zero code.
