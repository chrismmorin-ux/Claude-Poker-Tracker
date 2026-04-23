---
id: range-lab
name: Range Lab — In-App Flopzilla-Class Study Surface
status: gate-1-complete
priority: P2
created: 2026-04-22
backlog-id: RL
---

# Project: Range Lab

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts
2. Read this file — find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Create/update your handoff file in `.claude/handoffs/`
5. Execute the checklist items
6. Update this file and handoff when done

---

## Overview

Replace the earlier Flopzilla-integration proposal with a native in-app range study tool that matches Flopzilla's parity capabilities and exceeds them via our Bayesian/tendency pipeline.

**Scope note from Gate 1:** The project is primarily an **expansion of Explorer mode** inside `PostflopDrillsView`, not a new routed view. Explorer already ships ~70% of the Flopzilla-parity capability. Range Lab adds: interactive range paint, turn/river board support, subrange filtering, equity histogram, range comparison overlay, hand-history paste → per-street evolution, and (phase 3) archetype-conditioned overlays, tendency-auto-populated ranges, and weakness annotations.

**Acceptance Criteria (overall):**

- User can paint an arbitrary 13×13 range with per-combo weights, on any street (flop/turn/river), and see range composition + per-bucket equity + filter/histogram views.
- LSW line-audit workflow uses Range Lab in place of external web-search validation for ≥80% of decision-node checks.
- Parity-with-Flopzilla features (paint, turn/river, filters, histogram, comparison, hand paste) ship in Phase 0–2.
- AI-native differentiators (archetype overlays, tendency-auto-populate, weakness annotations, EV overlay, multi-street dynamic narrowing) ship in Phase 3–5.
- No regressions to existing ExplorerMode rendering, test coverage, or JTBD DS-48/49/50/51 assertions.

---

## Context Files

Files to read before starting work (depends on phase — see each phase):

**Always:**
- `docs/design/audits/2026-04-22-entry-range-lab.md` — Gate 1 artifact (this project's design charter)
- `docs/design/LIFECYCLE.md` — design gate discipline
- `.claude/context/SYSTEM_MODEL.md` §1 — architecture
- `CLAUDE.md` Design Program Guardrail

**Existing surfaces this extends:**
- `src/components/views/PostflopDrillsView/ExplorerMode.jsx` + `ContextPicker.jsx` + `BoardPicker.jsx` + `RangeFlopBreakdown.jsx`
- `docs/design/surfaces/postflop-drills.md`

**Engine to extend:**
- `src/utils/pokerCore/rangeMatrix.js` — prerequisite: build `rangeToString()` reverse serializer
- `src/utils/pokerCore/equityDecomposition.js` — already exports `decomposeHandVsHand` (10-bucket)
- `src/utils/pokerCore/monteCarloEquity.js` — already exports `handVsRange`
- `src/utils/exploitEngine/gameTreeEquity.js` — `computeComboEquityDistribution`, `exactEnumerateEquity`, `miniRolloutEquity`
- `src/utils/exploitEngine/archetypeRangeBuilder.js` — for archetype overlays (Phase 3)
- `src/utils/exploitEngine/villainProfileBuilder.js` — for tendency-auto-populate (Phase 3)
- `src/utils/postflopDrillContent/bucketTaxonomy.js` — 22 poker-native hand types

**Design program blockers:**
- Drills Consolidation HOLD: do NOT scaffold `StudyView` or a new routed view. Range Lab stays inside ExplorerMode until owner decides on StudyView consolidation.

---

## Phases

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| Gate 1 | ✅ | Scope + personas + JTBD + gap analysis | Artifact at `docs/design/audits/2026-04-22-entry-range-lab.md`. Verdict YELLOW → Gate 2 required. |
| Gate 2 | [ ] | Blind-Spot Roundtable | Artifact at `docs/design/audits/YYYY-MM-DD-blindspot-range-lab.md`. Five stages complete. Overall verdict GREEN/YELLOW/RED. |
| Gate 3 | [ ] | Research (conditional) | JTBD additions DS-52/53/54/55 authored in `drills-and-study.md` as `Proposed`. Owner interview if needed. |
| Gate 4 | [ ] | Design | `surfaces/postflop-drills.md` updated with Range Lab capabilities section + design spec inline. |
| Phase 0 | ✅ | `rangeToString()` serializer | Shipped 2026-04-22. 42 new tests; 373/373 postflopDrillContent regression; 216/216 pokerCore regression. |
| Phase 1 | [ ] | Interactive paint + turn/river | ExplorerMode gains a "Custom" range mode (alongside ContextPicker archetype mode); `BoardPicker` extends to 5-card support; painted range persists for session. |
| Phase 2 | [ ] | Subrange filter + histogram + comparison | Three new primitives wired into `RangeFlopBreakdown` (or sibling components). |
| Phase 3 | [ ] | AI-native differentiators | Archetype overlay (fish/reg/pro), tendency-auto-populate, weakness annotations. |
| Phase 4 | [ ] | Hand-history paste → evolution | Paste flow + multi-street range narrowing viz. |
| Phase 5 | [ ] | Save custom ranges + cross-surface cross-links | `rangeProfiles` writes from Range Lab; "Inspect in Range Lab" entry points on `LineWalkthrough` nodes and HandReplay decisions. |

Phases 0–2 deliver Flopzilla parity. Phase 3 is where the "better than Flopzilla" claim cashes in. Phases 4–5 are stretch.

---

## Phase Gate 2: Blind-Spot Roundtable <- CURRENT

### Goal

Run the 5-stage blind-spot roundtable before any design spec is written. Output a GREEN/YELLOW/RED verdict and specific follow-ups for Gate 3 (research) or Gate 4 (design).

### Acceptance Criteria

- [ ] Roundtable artifact authored at `docs/design/audits/YYYY-MM-DD-blindspot-range-lab.md`
- [ ] All 5 stages completed (A: persona, B: JTBD, C: situational, D: cross-surface, E: heuristic)
- [ ] Overall verdict stated with rationale
- [ ] Required follow-ups list populated
- [ ] Gate 1 YELLOW items specifically addressed: the 4 proposed JTBDs (DS-52/53/54/55), the paint interaction pattern, the Drills Consolidation collision, the mobile viewport question.

### Files This Phase Touches

_List files so other sessions know to avoid them. Copy to your handoff "Files I Own"._

- `docs/design/audits/YYYY-MM-DD-blindspot-range-lab.md` (new)
- `.claude/handoffs/range-lab-gate2.md` (new)
- This project file (status update)

### Context Files for This Phase

- `docs/design/audits/2026-04-22-entry-range-lab.md` — Gate 1 artifact with all the framing
- `docs/design/ROUNDTABLES.md` — 5-stage template
- `docs/design/personas/core/scholar-drills-only.md`, `coach.md`, `chris-live-player.md`
- `docs/design/personas/situational/study-block.md`, `first-principles-learner.md`, `post-session-chris.md`
- `docs/design/jtbd/domains/drills-and-study.md`
- `docs/design/surfaces/postflop-drills.md`
- `src/components/views/PostflopDrillsView/ExplorerMode.jsx` (for Stage C walkthrough grounding)

### Tasks

| Task | Status | Description |
|------|--------|-------------|
| G2.1 | [ ] | Stage A — Persona sufficiency (confirm Coach line-audit-author situation) |
| G2.2 | [ ] | Stage B — JTBD coverage (validate DS-52/53/54/55 framings; check for decomposition) |
| G2.3 | [ ] | Stage C — Situational stress test (walk study-block, first-principles-learner, post-session through paint + filter + histogram at 1600×720 and narrower) |
| G2.4 | [ ] | Stage D — Cross-surface (sidebar need? LineWalkthrough cross-link schema implications?) |
| G2.5 | [ ] | Stage E — Heuristic pre-check (N3 undo of paint; PLT06 destructive absorption; ML06 touch targets for 169 cells) |
| G2.6 | [ ] | Overall verdict + follow-ups |
| G2.7 | [ ] | Update this project file status to `gate-2-complete` |

### Verification

- [ ] All 5 stages have an output of ✅ / ⚠️ / ❌
- [ ] At least one observation-without-fix captured per stage (methodology anti-pattern: "boilerplate passes")
- [ ] Gate 1's 4 open questions for owner either answered by this gate or escalated clearly

---

## Phase Gate 3: Research (conditional)

### Goal

If Gate 2 is YELLOW or RED, author new JTBD entries and gather any market/observational evidence needed.

### Acceptance Criteria

- [ ] Proposed JTBDs (DS-52/53/54/55) either authored as `Proposed` in `drills-and-study.md` OR explicitly rejected with rationale
- [ ] Owner interview on Flopzilla usage patterns captured as evidence (if Gate 2 surfaces this as needed)
- [ ] Any new personas authored (unlikely per Gate 1, but reserved)

### Tasks

| Task | Status | Description |
|------|--------|-------------|
| G3.1 | [ ] | Author/reject DS-52/53/54/55 |
| G3.2 | [ ] | Owner interview: walk through a typical Flopzilla workflow; capture verbatim in `docs/design/evidence/LEDGER.md` |
| G3.3 | [ ] | Update Gate 2 verdict against updated framework; confirm GREEN before Gate 4 |

---

## Phase Gate 4: Design

### Goal

Produce the design spec that Phase 0–5 engineering implements against.

### Acceptance Criteria

- [ ] `docs/design/surfaces/postflop-drills.md` updated with a new "Range Lab capability" section covering paint mode, turn/river, filters, histogram, comparison, archetype overlay, hand-paste — as authored in Phase 1–5 scope
- [ ] Interaction spec for paint (touch vs click; modifier keys; long-press semantics; mobile adaptation)
- [ ] Visual spec for filter toggles, histogram, comparison overlay (sketches or reference screenshots acceptable)
- [ ] Explicit mobile-vs-desktop decision documented

### Tasks

| Task | Status | Description |
|------|--------|-------------|
| G4.1 | [ ] | Update `surfaces/postflop-drills.md` with Range Lab section |
| G4.2 | [ ] | Paint interaction spec |
| G4.3 | [ ] | Filter/histogram/comparison visual specs |
| G4.4 | [ ] | Mobile decision (in-scope with adaptation vs desktop-only) |
| G4.5 | [ ] | Cross-link entry points from LineWalkthrough + HandReplay (if Phase 5 is scoped into Range Lab vs later) |

---

## Phase 0: `rangeToString()` serializer

### Goal

Build the reverse of `parseRangeString()` so arbitrary Float64Array ranges can be serialized to canonical notation (`AA,KK-QQ,AKs,98s+,...`). Prerequisite for save/load of custom painted ranges.

### Acceptance Criteria

- [ ] `rangeToString(range: Float64Array, opts?): string` exported from `src/utils/pokerCore/rangeMatrix.js`
- [ ] Round-trip `parseRangeString(rangeToString(x))` equals `x` for canonical inputs
- [ ] Handles: pocket pairs, suited/offsuit combos, `+` notation for chains, per-combo weights, sparse ranges
- [ ] 20+ unit tests covering edge cases (empty range, full range, single combo, mixed weights, gap notation)
- [ ] Pure function; no React or state dependencies

### Files This Phase Touches

- `src/utils/pokerCore/rangeMatrix.js`
- `src/utils/pokerCore/__tests__/rangeMatrix.serializer.test.js` (new)

### Verification

- [ ] `bash scripts/smart-test-runner.sh` passes
- [ ] Full suite regression confirms no existing callers of `parseRangeString()` affected

---

## Phase 1–5

Deferred. Detailed specs author at Gate 4 time, not now.

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2026-04-22 | range-lab-gate1 | Gate 1 | Authored Gate 1 entry artifact. Verdict YELLOW → Gate 2 required. Discovered Explorer-mode 70% overlap; scope narrowed to surface-bound expansion. Charter created. |
| 2026-04-22 | range-lab-p0 | Phase 0 | Shipped `rangeToString(range, opts)` in `src/utils/pokerCore/rangeMatrix.js` + extended `parseRangeString` to accept `:weight` suffix (additive). 42 new tests (inc. round-trip sweep over PREFLOP_CHARTS + 13 canonical inputs). 373/373 postflopDrillContent + 216/216 pokerCore regression green. Parallel to gates — not UX-touching. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-22 | Build Range Lab natively instead of integrating Flopzilla | Owner pivoted; earlier analysis showed we already have ~65–70% of engine; differentiators (archetype overlays, tendency-derived ranges, weakness annotations, EV overlay) are impossible under Flopzilla-as-peer-app because Flopzilla lacks our data context |
| 2026-04-22 | NO new routed view; expand ExplorerMode | Drills Consolidation HOLD prevents new tabs/views. Explorer already implements ~70% of parity. Preserves the Chris cognitive model of "PostflopDrills = range study". |
| 2026-04-22 | NO live-play surface integration | Explicit non-goal. Range Lab is study-only; Table/LiveAdviceBar/ignition-sidebar are excluded. |
| 2026-04-22 | `rangeToString()` is the critical prerequisite | Blocks save/load; engine-layer and independently useful; not UX-touching so no gate. |

---

## Closeout Checklist

Before marking project complete (run `/project closeout range-lab`):

- [ ] All phases marked complete
- [ ] All acceptance criteria verified (owner-signed visual verification on ExplorerMode expanded)
- [ ] Tests passing (`bash scripts/smart-test-runner.sh`)
- [ ] All changes committed
- [ ] Documentation updated:
  - [ ] `CLAUDE.md` architecture section if PostflopDrillsView signature changed materially
  - [ ] `docs/QUICK_REF.md` for new utils (`rangeToString`)
  - [ ] `docs/CHANGELOG.md` version entry
  - [ ] `.claude/context/SYSTEM_MODEL.md` if module boundaries shifted
- [ ] `STATUS.md` updated
- [ ] Handoff files marked COMPLETE
- [ ] Backlog item RL marked complete via `/backlog complete RL`
