---
id: range-lab
name: Range Lab — In-App Flopzilla-Class Study Surface
status: gate-4-complete
priority: P2
created: 2026-04-22
last_gate_close: 2026-05-20
backlog-id: RL
---

> **Gate 2 closed 2026-05-20 (SPR-093 / WS-053).** Verdict 🟡 YELLOW with
> 6 conditions for Gate 4. All 4 Gate-1 open owner questions resolved
> inline. 7 follow-up tickets authored (WS-202..WS-208). See
> [Gate 2 audit](../design/audits/2026-05-20-blindspot-range-lab.md).
>

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
| Gate 3 | ✅ | Research (conditional) | Done 2026-05-20 (SPR-097 / WS-054). JTBDs authored in `drills-and-study.md` as `Proposed` — **re-numbered DS-64/65/66/67** (proposed DS-52/53/54/55 were squatted by Shape Language). Owner interview waived (Gate 2 resolved owner questions inline). |
| Gate 4 | ✅ | Design | Done 2026-05-20 (SPR-098 / WS-055). `surfaces/postflop-drills.md` Range Lab capability section authored: Explorer Custom-mode paint, interaction spec (ADR-007/008), partial-fill weight rendering, E-A4..E-A11, AP-RL-01 + parity bindings, Phase-5 cross-link contract, landscape-v1 mobile decision. **Phases 1-2 (WS-056/057) unblocked.** |
| Phase 0 | ✅ | `rangeToString()` serializer | Shipped 2026-04-22. 42 new tests; 373/373 postflopDrillContent regression; 216/216 pokerCore regression. |
| Phase 1 | [ ] | Interactive paint + turn/river | ExplorerMode gains a "Custom" range mode (alongside ContextPicker archetype mode); `BoardPicker` extends to 5-card support; painted range persists for session. |
| Phase 2 | [ ] | Subrange filter + histogram + comparison | Three new primitives wired into `RangeFlopBreakdown` (or sibling components). |
| Phase 3 | [ ] | AI-native differentiators | Archetype overlay (fish/reg/pro), tendency-auto-populate, weakness annotations. |
| Phase 4 | [ ] | Hand-history paste → evolution | Paste flow + multi-street range narrowing viz. |
| Phase 5 | [ ] | Save custom ranges + cross-surface cross-links | `rangeProfiles` writes from Range Lab; "Inspect in Range Lab" entry points on `LineWalkthrough` nodes and HandReplay decisions. |

Phases 0–2 deliver Flopzilla parity. Phase 3 is where the "better than Flopzilla" claim cashes in. Phases 4–5 are stretch.

---

## Phase Gate 2: Blind-Spot Roundtable ✅ COMPLETE 2026-05-20 (SPR-093)

### Goal

Run the 5-stage blind-spot roundtable before any design spec is written. Output a GREEN/YELLOW/RED verdict and specific follow-ups for Gate 3 (research) or Gate 4 (design).

### Outcome

Verdict 🟡 **YELLOW** (supersedes Gate 1 YELLOW). All 4 Gate-1 open owner questions resolved inline. 7 follow-up tickets authored. **Anti-pattern AP-RL-01 (no bucket-label-driven range narrowing)** authored to `.claude/context/POKER_THEORY.md` §7.6 — binds DS-54 implementation discipline.

### Artifact

- [`docs/design/audits/2026-05-20-blindspot-range-lab.md`](../design/audits/2026-05-20-blindspot-range-lab.md) — full 5-stage audit + verdict + follow-ups

### Anti-pattern surfaced (AP-RL-01)

Range-narrowing decisions (turn/river range evolution given betting line) MUST be computed per-combo — equity update conditional on villain's action profile + board card — NOT from bucket-label heuristics. Full doctrine: [`.claude/context/POKER_THEORY.md §7.6 (AP-RL-01)`](../../.claude/context/POKER_THEORY.md#76-range-narrowing-per-combo-derivation-not-bucket-heuristics-ap-rl-01). Bound from `src/utils/rangeEngine/CLAUDE.md` Anti-patterns section. Enforcement at Gate 4 surface spec (WS-055) + future CI lint pattern.

### Founder ratifications (SPR-093 + SPR-094 plan-mode)

- **Voice set:** 6 RL-native voices (Range-Paint Interaction Designer + Solver/GTO Theorist + Engine-Performance Skeptic + Surface-Boundary Architect + Cross-Surface Architect + First-Principles Auditor)
- **Gate-1-followup scope:** bundled into Gate 2 stage outputs (not forked to Gate 3 ticket)
- **Q1 Phasing:** Phases 0-2 bundled as v1; Phase 3+ surface-contracted, implementation-deferred
- **Q2 Coach weighting:** Coach secondary, Chris-as-author primary validated user for DS-55
- **Q3 Drills Consolidation:** Already moot (REJECTED 2026-04-22; Finding 0)
- **Q4 Mobile scope:** Landscape v1; mobile-portrait variant deferred to WS-208
- **Paint primitive:** tap-to-toggle + long-press-for-weight ([ADR-007](../adr/ADR-007-rl-paint-primitive.md))
- **Undo stack:** per-stroke ([ADR-008](../adr/ADR-008-rl-undo-stack.md))
- **AP-RL-01 home:** POKER_THEORY.md §7.6

---

## Phase Gate 3: Research (conditional)

### Goal

If Gate 2 is YELLOW or RED, author new JTBD entries and gather any market/observational evidence needed.

### Acceptance Criteria

- [ ] Proposed JTBDs (DS-52/53/54/55) either authored as `Proposed` in `drills-and-study.md` OR explicitly rejected with rationale
- [ ] Owner interview on Flopzilla usage patterns captured as evidence (if Gate 2 surfaces this as needed)
- [ ] Any new personas authored (unlikely per Gate 1, but reserved)

### Outcome ✅ COMPLETE 2026-05-20 (SPR-097 / WS-054)

Four JTBDs authored as `Proposed` in `docs/design/jtbd/domains/drills-and-study.md`, **re-numbered to DS-64/65/66/67** after a composition-time premise check caught that the Gate-1/Gate-2 proposed IDs (DS-52/53/54/55) were squatted by the Poker Shape Language project (committed 2026-04-23, one day after RL Gate 1). Same failure class as PSD's DS-62/63 re-number.

- **DS-64** — Paint a custom range from scratch (Phase 1-2; ADR-007/008 paint+undo).
- **DS-65** — Compare two ranges with delta highlighting (Phase 1-2; ≥1-decimal fidelity).
- **DS-66** — Per-street range evolution from the betting line (Phase 3+; **AP-RL-01 binding** — per-combo narrowing, no bucket-label heuristics).
- **DS-67** — Validate authored drill/line-study content against the engine (Phase 3+; **INV-LSW-RL-EQUITY-PARITY binding** — the contract that lets RL replace external validation).

ATLAS registry updated (added DS-64..67; backfilled missing DS-62/63; added a DS-registry collision-prevention note). Owner Flopzilla-workflow interview (G3.2) **waived** — Gate 2 resolved all 4 open owner questions inline (Q1 phasing, Q2 Coach, Q3 drills-consolidation, Q4 mobile). With JTBDs now framework-canonical, the Gate 2 YELLOW conditions are satisfied for Gate 3 → framework confirmed **GREEN** for Gate 4 entry.

### Tasks

| Task | Status | Description |
|------|--------|-------------|
| G3.1 | ✅ | Authored DS-64/65/66/67 (re-numbered from squatted DS-52/53/54/55) |
| G3.2 | ✅ (waived) | Owner Flopzilla-workflow interview waived — Gate 2 resolved owner questions inline; founder ratified waive at SPR-097 plan-mode |
| G3.3 | ✅ | Framework confirmed GREEN for Gate 4 — JTBDs canonical, Gate 2 conditions satisfied |

---

## Phase Gate 4: Design

### Goal

Produce the design spec that Phase 0–5 engineering implements against.

### Acceptance Criteria

- [x] `docs/design/surfaces/postflop-drills.md` updated with a new "Range Lab" capability section covering paint mode, turn/river, filters, histogram, comparison + Phase-3+ evolution/validate (surface-contracted)
- [x] Interaction spec for paint (tap-to-toggle + long-press-for-weight per ADR-007; per-stroke undo per ADR-008; partial-fill-height weight rendering; scale-aware ergonomics)
- [x] Visual spec for filter toggles, histogram, comparison (Anatomy ASCII + sub-capability table + E-A specs)
- [x] Explicit mobile-vs-desktop decision documented (landscape v1; portrait → WS-208)

### Outcome ✅ COMPLETE 2026-05-20 (SPR-098 / WS-055)

Range Lab capability section authored in `surfaces/postflop-drills.md` as an **Explorer expansion** (Custom range-source toggle — NOT a new tab/view, honoring Gate 1 + the Drills Consolidation hold; founder-ratified at SPR-098 plan-mode). Two Gate-4 design decisions ratified: (1) structural placement = Custom toggle inside Explorer; (2) partial-weight cell rendering = **partial-fill height**. Covered: paint interaction (ADR-007), per-stroke undo + Clear-all confirmation (ADR-008), state-aware primary action (E-A4), surface elements (E-A5 first-use hint / E-A6 fractional equity / E-A7 dirty indicator / E-A10 histogram debounce), sub-capability phase split (DS-64/65 = Phase 1-2; DS-66/67 = Phase 3+ surface-contracted), **AP-RL-01 binding** (E-A11, per-combo narrowing + CI-lint forbidden surfaces), **INV-LSW-RL-EQUITY-PARITY binding**, Phase-5 cross-link contract (E-A8 unsaved-paint guard), Gate-5 test-coverage expectations, adjacent-surface dependencies. Zero `src/` diff (docs-only). LSW/HandReplay cross-link affordances deferred to Phase 5 (not authored this gate). **All design gates complete — Phases 1-2 implementation (WS-056/057) unblocked.**

### Tasks

| Task | Status | Description |
|------|--------|-------------|
| G4.1 | ✅ | Updated `surfaces/postflop-drills.md` with Range Lab capability section |
| G4.2 | ✅ | Paint interaction spec (ADR-007 tap-toggle + long-press-weight; per-stroke undo ADR-008; partial-fill rendering; scale-aware) |
| G4.3 | ✅ | Filter/histogram/comparison specs (Anatomy + sub-capability table + E-A6/E-A10) |
| G4.4 | ✅ | Mobile decision — landscape v1; portrait variant → WS-208 |
| G4.5 | ✅ (contracted) | Cross-link entry points surface-contracted in postflop-drills (LSW + HandReplay `Inspect in Range Lab` + E-A8 guard); affordances authored at Phase 5 |

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
| 2026-05-20 | SPR-097 / WS-054 | Gate 3 | Authored DS-64/65/66/67 (Proposed) in `drills-and-study.md` + registered in `jtbd/ATLAS.md`. Premise corrected at composition: proposed DS-52/53/54/55 were squatted by Shape Language — re-numbered. Backfilled DS-62/63 + added DS-registry note. Owner interview waived. Gate 3 → complete; Gate 4 (WS-055) unblocked. Zero src/ diff (docs-only). |
| 2026-05-20 | SPR-098 / WS-055 | Gate 4 | Authored Range Lab capability section in `surfaces/postflop-drills.md` as Explorer Custom-mode expansion (no new tab/view). 2 founder decisions ratified: placement = Explorer Custom toggle; partial-weight rendering = partial-fill height. Covered paint UX (ADR-007/008), E-A4..E-A11, AP-RL-01 + parity bindings, Phase-5 cross-link contract, landscape-v1 mobile decision, Gate-5 test expectations. JTBD list + Anatomy + State updated. Gate 4 → complete; all design gates done; Phases 1-2 (WS-056/057) unblocked. Zero src/ diff. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-22 | Build Range Lab natively instead of integrating Flopzilla | Owner pivoted; earlier analysis showed we already have ~65–70% of engine; differentiators (archetype overlays, tendency-derived ranges, weakness annotations, EV overlay) are impossible under Flopzilla-as-peer-app because Flopzilla lacks our data context |
| 2026-04-22 | NO new routed view; expand ExplorerMode | Drills Consolidation HOLD prevents new tabs/views. Explorer already implements ~70% of parity. Preserves the Chris cognitive model of "PostflopDrills = range study". |
| 2026-04-22 | NO live-play surface integration | Explicit non-goal. Range Lab is study-only; Table/LiveAdviceBar/ignition-sidebar are excluded. |
| 2026-04-22 | `rangeToString()` is the critical prerequisite | Blocks save/load; engine-layer and independently useful; not UX-touching so no gate. |
| 2026-05-20 | RL JTBDs re-numbered DS-52/53/54/55 → DS-64/65/66/67 | The Gate-1 proposed IDs were committed by Poker Shape Language Gate 3 one day later (2026-04-23). DS-IDs are append-only and not reserved until they land in the ATLAS registry; re-numbering to the next free block is the canonical fix (precedent: PSD DS-62/63). |
| 2026-05-20 | Owner Flopzilla-workflow interview (G3.2) waived | Gate 2 (SPR-093) resolved all 4 open owner questions inline (phasing, Coach weighting, drills-consolidation, mobile). No new evidence needed to author the JTBDs; founder ratified the waive at SPR-097 plan-mode. |
| 2026-05-20 | Range Lab is an Explorer Custom-mode toggle, not a new tab/view | Gate 1 ratified "expand ExplorerMode, no new routed view"; Drills Consolidation hold remains rejected. Founder reconfirmed at SPR-098 plan-mode. Keeps the Chris cognitive model "PostflopDrills = range study" and avoids re-opening the consolidation decision. |
| 2026-05-20 | Partial-weight cells render as partial-fill height | ADR-007 explicitly deferred this to Gate 4. Fill-height (bottom-up proportional to weight) reads as a tiny bar chart, keeps weight legible without an extra glyph, and scales to mobile cell sizes — vs weight-badge (noisy at ~30px) or hatch (aliases at small sizes). Founder-ratified at SPR-098 plan-mode. |

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
