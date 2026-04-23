# Gate 1 Entry — 2026-04-22 — Range Lab

**Feature working name:** Range Lab
**Proposed by:** Chris (owner) — 2026-04-22, pivoting from a Flopzilla-integration proposal to an in-app build
**Gate:** 1 (Entry) — mandatory
**Next gate:** 2 (Blind-Spot Roundtable) — required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact; no code written

---

## Feature summary (as proposed)

Owner rejected the earlier Flopzilla-integration proposal in favor of building equivalent (and better) capabilities natively. The ambition is to match Flopzilla's study capabilities — interactive range building, range-on-board decomposition, subrange filtering, equity distribution, range comparison, hand-history paste-to-analyze — and go beyond via archetype-conditioned overlays, tendency-auto-populated ranges, multi-street dynamic narrowing, weakness annotations, and EV overlays that Flopzilla cannot offer because it lacks our data context.

---

## Critical scope-shifting discovery

Before writing this Gate 1, I surveyed what we already ship. Finding:

**`PostflopDrillsView` → Explorer mode already implements ~70% of the "Range Lab" concept.** Specifically:

- `ExplorerMode.jsx` composes `ContextPicker` + `BoardPicker` + `RangeFlopBreakdown`
- Renders tier summary, hand-type panel (with combo count / weighted % / average outs), nut region Δ, framework chips
- Supports Monte Carlo equity vs an opposing archetype range (`runMc` toggle)
- Serves JTBD **DS-51** ("Understand villain's range shape on any flop before deciding") as `Active`

What Explorer mode **does not** offer, and which Flopzilla does:

1. **Interactive range paint** — user selects from pre-built archetype ranges via `ContextPicker`, cannot paint arbitrary custom ranges
2. **Turn / river support** — `BoardPicker` is 3-card (flop) only
3. **Subrange filter toggles** — no "show only flushes" / "show only TP+" controls
4. **Range comparison overlay** — two ranges cannot be diffed visually on one grid
5. **Equity distribution histogram** — tier bars exist; a continuous equity histogram does not
6. **Hand-history paste → per-street range evolution** — no UI flow
7. **Save custom range to `rangeProfiles`** — not possible without paint + save (and reverse-serializer is missing — see Gate 4 prerequisites)

**Implication for scope:** This is not a greenfield "new surface" project. It is primarily an **expansion of Explorer mode** plus a small number of new adjacent capabilities.

---

## Output 1 — Scope classification

**Primary classification:** Surface-bound expansion of `postflop-drills` / ExplorerMode, with two cross-cutting additions (new paint interaction pattern; new serializer utility).

**Secondary classification considerations:**

- **"New interaction pattern"** (interactive range paint) — per LIFECYCLE table, this triggers Gate 2 even when added to an existing surface.
- **Drills Consolidation — HELD** (per `surfaces/postflop-drills.md` Known Issues and 2026-04-21 owner decision). Any structural change to PostflopDrillsView's tab layout or the decision to add a new tab cannot proceed until the `StudyView` consolidation question is resolved. **Range Lab's execution plan must stay inside ExplorerMode's existing tab bounds**, or wait. Do not scaffold a new tab.
- **Cross-surface ripples** likely via cross-linking from `line-walkthrough` (LSW line audits would benefit from "inspect this node in Range Lab") and `hand-replay-view` ("inspect this decision's ranges"). These are additive entry points, not scope changes to those surfaces.

**NOT a full new routed view.** A `SCREEN.RANGE_LAB` top-level route is explicitly **rejected** by this Gate 1 unless Drills Consolidation resolves against StudyView and Range Lab needs its own home.

---

## Output 2 — Personas identified

### In scope (Range Lab primary users)

| Persona | Role | Core/Situational |
|---|---|---|
| [Chris (owner)](../personas/core/chris-live-player.md) | Primary user; content author for LSW line audits | Core |
| [Scholar (drills-only)](../personas/core/scholar-drills-only.md) | Deep-study archetype; paints custom villain ranges | Core |
| [Rounder](../personas/core/rounder.md) | Serious live-cash player; occasional study block | Core |
| [Apprentice](../personas/core/apprentice-student.md) | Student doing focused study | Core |
| [Coach](../personas/core/coach.md) | Builds teaching ranges for students; validates curriculum ranges | Core |
| [Hybrid semi-pro](../personas/core/hybrid-semi-pro.md) | Mixed live+online study | Core |
| [Study-block](../personas/situational/study-block.md) | Cross-persona situational — the specific off-table focused block | Situational — primary |
| [First-principles learner](../personas/situational/first-principles-learner.md) | Learning-by-explanation mode; already cited by postflop-drills | Situational — primary |
| [Post-session Chris](../personas/situational/post-session-chris.md) | Reviewing a just-finished session; may paint the villain's range retrospectively | Situational — secondary |

### Out of scope (explicitly excluded)

- [Mid-hand Chris](../personas/situational/mid-hand-chris.md) — live play. Range Lab is **not** a live-play surface.
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — explicit non-goal; 10-second windows are too tight for range exploration.
- [Multi-tabler](../personas/core/multi-tabler.md) — live online grinder. Range Lab is study-only.
- [Newcomer](../personas/core/newcomer.md) — Range Lab is an advanced tool.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: GREEN — no new core persona needed.** The existing 6-core × 3-situational cast covers every archetype that would realistically use Range Lab. One **situational gap flagged for Gate 2 scrutiny, not for Gate 3**:

- **"Line-audit author"** — the workflow the LSW project currently executes via web-search validation (e.g., `btn-vs-bb-3bp-ip-wet-t96.md`) would directly benefit from Range Lab as a validation tool. This is not a new persona; it is **Coach-persona's content-authoring situation already implicitly covered by `study-block`**. Flagged so Stage A of Gate 2 can confirm no split is needed.

---

## Output 3 — JTBD identified

### Already served by Explorer mode (inherited)

- **DS-48** — Understand villain's range composition as the decision driver — *Active*
- **DS-49** — See weighted-total EV decomposition for a decision — *Active*
- **DS-50** — Walk a hand line branch-by-branch with consequences shown — *Active* (via Line mode; Range Lab supports via cross-linking)
- **DS-51** — Understand villain's range shape on any flop before deciding — *Active*

### Partially served; Range Lab extends

- **DS-44** — Correct-answer reasoning (not just score) — Range Lab has no grading but augments reasoning via post-hoc range inspection
- **DS-45** — Custom drill from own hand history — *Proposed*; Range Lab's hand-paste flow is adjacent to this outcome
- **MH-06** — Multiway range-vs-ranges equity on flop — Range Lab provides the study-mode version (not live version)

### Proposed (new — flagged for Gate 3 authoring if Gate 2 confirms YELLOW)

1. **DS-52 (proposed)** — *Build a custom range from scratch for a teaching point or hypothesis*
   > When I'm studying a specific villain type or exploring a what-if range, I want to paint an arbitrary 13×13 range with per-combo weights, so I can analyze a scenario the pre-built archetype library doesn't cover.
   - Personas: Scholar, Coach, Chris
   - Distinct from CO-50 (*Save pattern as reusable lesson*) which is a coaching save-action; DS-52 is the authoring verb.

2. **DS-53 (proposed)** — *Compare two ranges on the same board to see where they diverge*
   > When I'm studying an archetype shift or a line disagreement, I want to overlay two ranges on one matrix and see delta highlighting, so I can see exactly which combos differ.
   - Personas: Scholar, Coach, Chris
   - No clean existing atlas entry.

3. **DS-54 (proposed)** — *Inspect range evolution across turn and river for a given line*
   > When I'm studying a multi-street line, I want to see how villain's range narrows on each street given the actions taken and cards revealed, so I internalize the board-to-range dynamic.
   - Personas: Scholar, Coach, Rounder, Chris
   - Today: DS-51 only implicitly covers the flop. DS-50's line-walkthrough shows narration, not range visualization across streets.

4. **DS-55 (proposed)** — *Validate authored drill content against first-principles math*
   > When I author a decision node (LSW line audit), I want to drop the node's villain range + board + hero combo into a side-by-side inspector and verify the bucket weights, equities, and EV terms match my authored claims, so line content does not ship with silently-wrong numbers.
   - Personas: Coach, Chris-as-author
   - Directly accelerates LSW-A2..A8 audit workflow currently done by web search.

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: YELLOW — 4 proposed new JTBDs.** Two are extensions of existing atlas entries (DS-52 extends DS-51 to arbitrary ranges; DS-54 extends DS-51/DS-50 to multi-street). Two are genuinely new (DS-53 comparison, DS-55 content-validation). All land cleanly inside the `drills-and-study` domain; no new domain needed.

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|---|---|---|
| Personas | 🟢 GREEN | No new persona required; situational gap flagged for Gate 2 stress check only |
| JTBD | 🟡 YELLOW | 4 proposed additions to `drills-and-study` (DS-52/53/54/55). No new domain. |
| Interaction pattern | 🟡 YELLOW | Interactive range paint is new — not present anywhere in codebase |
| Surface structure | 🟡 YELLOW | Drills Consolidation HOLD constrains placement; must stay inside ExplorerMode |
| Cross-surface ripples | 🟢 GREEN (pending confirmation at Gate 2 Stage D) | Additive entry points from Line + HandReplay; no breaking contracts |

### Overall Gate 1 verdict: 🟡 **YELLOW**

**Gate 2 (Blind-Spot Roundtable) is required.** Primary reasons:

1. New interaction pattern (range paint) — Gate 2 mandatory per LIFECYCLE.
2. 4 new JTBDs proposed — Gate 2 Stage B must confirm scope or request decomposition before Gate 3 authors them.
3. Cross-surface entry points need Stage D validation.

### Gate 2 scope (pre-loaded for next session)

Five stages of roundtable to run:

- **Stage A — Persona sufficiency:** Confirm Coach's "line-audit author" situation doesn't warrant a split.
- **Stage B — JTBD coverage:** Validate DS-52/53/54/55 framings and check for decomposition opportunities (e.g., is DS-54 really one job or three?).
- **Stage C — Situational stress:** Walk `study-block` + `first-principles-learner` + `post-session-chris` through the painted-range workflow. Where does touch-input for 169 cells at 1600×720 fail?
- **Stage D — Cross-surface:** Does sidebar need a counterpart? (Almost certainly no — study-only.) Does the LSW line-walkthrough "inspect in Range Lab" cross-link imply any schema coupling?
- **Stage E — Heuristic pre-check:** Nielsen undo (paint action reversibility), PLT destructive-absorption (paint wipe), ML06 touch-target (13×13 cell minimums at scale 1.0).

---

## Required follow-ups (blocking Gate 4)

- [ ] **Gate 2 — Blind-Spot Roundtable** — run before any design spec. Output at `docs/design/audits/YYYY-MM-DD-blindspot-range-lab.md`.
- [ ] **Gate 3 — Research (conditional on Gate 2 verdict)** — if Gate 2 is YELLOW/RED, author DS-52/53/54/55 as `Proposed` in `drills-and-study.md` with full definitions; possibly observe how Chris uses Flopzilla today (owner interview) to calibrate the paint + filter + histogram workflows.
- [ ] **Gate 4 — Design** — surface artifact update to `surfaces/postflop-drills.md` documenting Explorer-mode expansion; **NOT** a new `surfaces/range-lab.md` file (unless Drills Consolidation resolves against StudyView and Range Lab gets its own home).
- [ ] **Prerequisite outside gate ceremony (Phase 0 engineering, authorized post-Gate 4):** build `rangeToString(Float64Array): string` in `src/utils/pokerCore/rangeMatrix.js` as the reverse of existing `parseRangeString()`. Needed for save/load of custom painted ranges. ~100 LOC + tests. Not UX-touching in itself; can be authored whenever without blocking on gates.

---

## Open questions for owner (before Gate 2)

1. **Phasing preference.** My earlier analysis proposed Phases 0–5 with Phase 3 as the "AI-native differentiators" (archetype overlays, tendency auto-populate, weakness annotations). Do you want Gate 2 to stress-test **all** phases, or scope Gate 2 to Phases 0–2 (parity-with-Flopzilla) with differentiator phases roundtabled later when closer to build?
2. **Coach-as-user weighting.** Coach is a core persona but PROTO-unverified. If Range Lab is pitched at Coach as a meaningful audience, we should either (a) cite Coach only as a secondary design target or (b) triage up the Coach validation schedule. Flag: the LSW-author workflow argument is strong regardless of Coach-as-external-persona, because Chris-as-author is the real validated user for that loop.
3. **Drills Consolidation collision.** Range Lab pushes toward more capability inside ExplorerMode. If `StudyView` consolidation resolves against merging, Range Lab becomes a cleaner standalone candidate. Do you want a decision on StudyView before Gate 2 runs, or is Gate 2 allowed to assume "stay inside ExplorerMode" as a constraint?
4. **Mobile scope.** 13×13 paint on 1600×720 is tight but viable; smaller viewports will need a different interaction (long-press, modal-per-row, or desktop-only gating). Is mobile-parity a hard requirement or a later stretch?

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface this expands: [`surfaces/postflop-drills.md`](../surfaces/postflop-drills.md)
- JTBD domain affected: [`jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md)
- Drills Consolidation HOLD context: [`.claude/context/DRILL_VIEWS.md`](../../../.claude/context/DRILL_VIEWS.md)
- Project charter: [`docs/projects/range-lab.project.md`](../../projects/range-lab.project.md)

---

## Change log

- 2026-04-22 — Created. Pivoted from Flopzilla-integration proposal. Explorer-mode overlap discovered and scope narrowed accordingly.
