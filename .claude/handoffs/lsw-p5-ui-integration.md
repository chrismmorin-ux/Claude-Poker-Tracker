# Handoff — LSW-P5 (UI integration)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream P (Hand Plan Layer)
**Sub-charter:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md`
**BACKLOG:** LSW-P5 → COMPLETE; **Stream P foundational (P1/P2/P4/P5) CLOSED.** Stream P content (P3/P6/P7) remains DEFERRED to LSW-v2.

---

## What shipped

### Components (NEW, 2 files)

**`src/components/views/PostflopDrillsView/panels/RuleChipModal.jsx`** (~120 LOC)
- Shared modal reading `getRuleChip(chipId)` from `planRules.js`.
- Renders chip `label` (title) + `shortBody` (italic lead) + `fullBody` (body) + `citations` list (source / anchor / optional note).
- Dismissal: Esc key, backdrop tap, close button. Body click does not propagate to backdrop.
- aria-modal=true with aria-label: `Rule: {chip.label}`.
- Unknown chip ID surfaces a recoverable error banner instead of a blank modal — catches authoring drift the same way the schema validator catches it at build time.
- z-index 50 (above other modals).

**`src/components/views/PostflopDrillsView/panels/HandPlanSection.jsx`** (~280 LOC)
- Composition root. Mirrors BucketEVPanelV2's engine-call pattern with cancellation.
- Exports `selectActivePlanSource({ hasAuthored, hasEngine, toggleOn })` — pure helper returning `'authored-only' | 'engine-only' | 'both' | 'none'`.
- Reads `node.comboPlans[activeBucket]` (active bucket = `heroView.bucketCandidates[0]` for v1 single-combo).
- Per-combo override dispatch via `heroView.combos[0]` lookup in `entry.overrides` — the override entry replaces the bucket entry when present.
- **Q2=C conditional default visibility**: authored present → engine hidden; authored absent → engine shown. `sessionStorage['handPlanShowSolver']` toggle persists user preference across nodes.
- Engine call **skipped when authored present + toggle off** — no MC compute on taught nodes.
- Rule chip pills ≥32×32 DOM-px (≥44×44 effective at 1600×720 scale per H-PLT01).
- Engine errorState renders graceful "Solver plan unavailable" with optional `recovery` copy. Covers MW (LSW-G6 deferred) case, malformed input case, and engine-internal case.
- v1 `nextStreetPlan` stub renders inline copy: *"Forward-look (turn / river plan) ships with depth-2 injection (LSW-D1)."*
- Chip-tap opens shared `<RuleChipModal>` via local `useState(openChipId)`.

### Wire-up (MODIFIED, 1 file)

**`src/components/views/PostflopDrillsView/LineNodeRenderer.jsx`** (+5 lines)
- Added `<HandPlanSection node={node} line={line} archetype={archetype} />` between `<BucketEVPanelV2>` and the sections render block.
- Gated on `hasHeroView` (mirrors BucketEVPanelV2 gating) — section omits entirely on terminal/non-heroView nodes.

### Tests (NEW, 2 files, 33 cases)

| File | Cases | Coverage |
|------|-------|----------|
| `RuleChipModal.test.jsx` | 11 | render gating (chipId null/undefined), known chip body + citations, dismissal (close button + backdrop + Esc + body-click no-propagation), unknown-chip error banner |
| `HandPlanSection.test.jsx` | 22 | `selectActivePlanSource` table (5 cases), render gating (1), engine-only path (5), authored-only path (6 incl. override pickup + chip pill render + engine-skip-when-authored), both-path with sessionStorage seeding (2), chip-modal integration (2), engine errorState (1) |

### Visual verification (1600×720, Playwright)

Evidence in `docs/design/audits/evidence/`:
- `lsw-p5-jt6-flop-root-hand-plan-section.png` — full-page screenshot
- `lsw-p5-jt6-flop-root-engine-plan-detail.png` — Hand Plan section in viewport (Reg archetype)
- `lsw-p5-jt6-flop-root-fish-archetype.png` — Hand Plan section after Fish toggle (Reg → Fish, EV +14.92bb → +15.18bb proves engine re-fires on archetype change)
- `lsw-p5-jt6-turn-after-call-no-plan.png` — turn_after_call (no heroView) confirms section omits entirely

Walked: JT6 flop_root with Reg + Fish archetypes; turn_after_call to verify gating. Section renders cleanly with templated reason, 3-row action table (Call UNSUPPORTED · Raise to 9bb BEST highlighted emerald · Fold), EV CI bounds, caveats row, and forward-look stub. Layout doesn't crowd at 1600×720.

---

## Verification

```
npx vitest run src/components/views/PostflopDrillsView/panels/__tests__/RuleChipModal.test.jsx
→ 11/11 green

npx vitest run src/components/views/PostflopDrillsView/panels/__tests__/HandPlanSection.test.jsx
→ 22/22 green

npx vitest run src/components/views/PostflopDrillsView src/utils/postflopDrillContent
→ 24 files, 495/495 green
```

Test count progression across Stream P:
- Pre-Stream-P: 373
- Post-P1: 390 (+17)
- Post-P2: 415 (+25)
- Post-P4: 448 (+33)
- **Post-P5: 495 (+47)**

Total Stream P test gain: **+122**.

---

## Doctrine choices worth surfacing

1. **Per-node, not per-branch.** The BACKLOG entry said "plan section under each branch," but the spec doc's pedagogical reading is one plan per node — authored plans are bucket-keyed (one per bucket, not per action), and the engine plan already enumerates per-action EVs in a single table. Slotting one section per node, between BucketEVPanelV2 and the Sections render, gives the cleanest information flow: range → plan → prose context → decision branches.

2. **Engine call duplicated with BucketEVPanelV2 (deferred refactor).** Both panels independently call `computeBucketEVsV2` on the same input. v1 accepts the 2× MC cost (~150-300ms each on JT6). A future refactor can lift the engine call into `LineNodeRenderer` and pass the result down to both panels via props. Tracked for post-v1 cleanup but not blocking — the optimization is one prop drill away.

3. **Engine-skip when authored + toggle off.** When the line has an authored plan and the user hasn't toggled "Show solver plan" on, HandPlanSection skips the engine call entirely (`needsEngine = !hasAuthored || toggleOn`). This means taught nodes only pay MC compute when the student opts in. With v1 having zero authored plans this saves nothing today; the optimization is structural for when P3 lands.

4. **Unknown-chip ID renders a banner, not a blank modal.** Catching authoring drift at modal-open time (chip referenced from `comboPlans` but missing from `PLAN_RULE_CHIPS`) — the schema validator already rejects this at build time, but the modal's defensive banner means even if a build-time slip-through occurs, the error is human-readable rather than silent.

5. **Chip modal not user-reachable in v1.** Since no node has `comboPlans` populated yet (P3 deferred to LSW-v2), the live UI never shows a chip pill, so the modal can't be opened through normal interaction. The 11 unit tests + 2 integration tests via HandPlanSection cover the full chip-tap → modal → dismissal flow. When P3 starts authoring chips into lines.js, the modal becomes user-reachable automatically — no UI changes required.

6. **`nextStreetPlan` stub copy is explicit about LSW-D1.** Rather than hide the missing forward-look, the section names the dependency. The student sees "Forward-look ships with depth-2 injection (LSW-D1)" — honest, scoped, and it cues that this is a v1 ship with known follow-on work, not a complete picture.

---

## Files I owned this session

- **NEW:** `src/components/views/PostflopDrillsView/panels/RuleChipModal.jsx`
- **NEW:** `src/components/views/PostflopDrillsView/panels/HandPlanSection.jsx`
- **NEW:** `src/components/views/PostflopDrillsView/panels/__tests__/RuleChipModal.test.jsx`
- **NEW:** `src/components/views/PostflopDrillsView/panels/__tests__/HandPlanSection.test.jsx`
- **MODIFIED:** `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` (+5 LOC)
- **MODIFIED:** `.claude/BACKLOG.md` — LSW-P5 → COMPLETE.
- **MODIFIED:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md` — foundational sub-streams CLOSED; closeout checklist marked done.
- **NEW (evidence):** 4 Playwright screenshots in `docs/design/audits/evidence/lsw-p5-jt6-*.png`.

---

## Stream P foundational closeout

All 4 foundational sub-streams (P1/P2/P4/P5) are closed. Stream P content sub-streams (P3/P6/P7) remain DEFERRED to LSW-v2 per Q4=C hybrid placement.

**v1 owner-visible behavior:**
- Every Line Study decision node with `heroView` renders a Hand Plan section.
- The section shows an engine-derived solver plan (per-action EV table, best-action highlighted, templated reason, confidence caveats).
- The section gracefully omits on nodes without `heroView` (terminals, un-migrated nodes).
- Multiway nodes will render a "Solver plan unavailable" empty state when LSW-G6 ships and they get heroView.
- Authored plans are v2-deferred — the schema + UI are in place to receive them when LSW-v2 starts.

**Soft dependency on LSW-D1:** the engine-derived plan inherits the `v1-simplified-ev` caveat on every node today. When LSW-D1 (depth-2 injection) ships, the caveat clears automatically. D1 can also wire `evaluateGameTree.recommendations[].handPlan` into the drill engine to populate the `nextStreetPlan` field — at which point the v1 forward-look stub copy ("Forward-look ships with depth-2 injection") gets replaced with real turn / river plan branches.

---

## Open questions still deferred (carried from prior handoffs)

1. Per-archetype plan splits — defer to LSW-v2 P3 authoring.
2. MW empty-state copy is in place but generic — can be tightened with concrete LSW-G6 timeline copy when MW shipping is closer.
3. Modal stacking precedence (chip-tap from inside compute calculator modal) — chip modal lives at z-50; calculator modals (when implemented at modal level) should sit at z-40 or below. Currently no calculator-as-modal pattern exists; defer.

---

## Next-session pickup

**No Stream P work remaining for v1.** Foundational closure means Stream P parks until LSW-v2 kicks off (post-LSW-v1 closeout).

**LSW phases unblocked next** by Stream P closure:
- **Phase 5 (Stream D1 — depth-2 injection)** can now ship knowing the Hand Plan UI consumes its `handPlan` field cleanly.
- **Phase 6 (Stream B3 — rivers)** continues per existing plan.

Recommend the parent LSW project decide next priority via `/backlog prioritize` or owner directive — the choice is between continuing per-line audits (LSW-A5/A6/A7/A8), shipping LSW-D1 to clear the v1-simplified-ev caveat universally, or pivoting to a different program entirely.
