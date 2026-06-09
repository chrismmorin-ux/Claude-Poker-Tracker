---
name: traction
description: "Strategic priority engine — RICE-scored prioritization with phase multipliers, bottleneck detection, and parallel work stream identification"
user-invocable: false
default_mode: explore
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: traction` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: explore`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Traction Engine

Strategic prioritization that goes beyond simple priority scoring. Identifies bottlenecks, finds parallel work streams, detects quick wins, and aligns backlog with the project's current strategic phase.

## Focus Area

$ARGUMENTS (filter by category/program, or "full" for entire backlog)

---

## PHASE 0 — GATHER CONTEXT

1. Read `system/state.md` — current state, metrics, recent sessions
2. Read `system/constraints.md` — resource constraints, timeline pressures
3. Read `system/decisions.md` — strategic decisions that constrain priorities
4. Read `CLAUDE.md` — project purpose and goals
5. Scan `.claude/workstream/queue/` — all current work items
6. Scan `.claude/workstream/findings/` — open findings not yet in queue
7. Scan `.claude/workstream/programs/` — program health and staleness
8. Run `git log --oneline -20` — recent work trajectory

---

## PHASE 1 — STRATEGIC PHASE (Read Persisted)

Read the project phase from `system/state.md` Project Phase table.

If no phase is set (empty or "foundation" default), fall back to detection:

| Phase | Signals | Priority Bias |
|-------|---------|---------------|
| **Foundation** | < 3 months old, core features incomplete, no users | Architecture, core features, testing infrastructure |
| **Pre-Launch** | Core works, needs polish, no real users yet | UX polish, security hardening, documentation, deployment |
| **Launch** | Real users arriving, feedback coming in | Bug fixes, UX friction, onboarding, monitoring |
| **Growth** | Stable user base, feature requests | New features, performance, integrations, analytics |
| **Maturity** | Feature-complete, focus on reliability | Tech debt, security audits, performance optimization |

If detected phase differs from persisted phase, note this in the report:
"Detected phase signals suggest [detected]. Persisted phase is [persisted]. Consider running `/workstream phase [detected]` to update."

Apply phase multiplier to scoring:
- Items aligned with current phase: 1.5x
- Items neutral to phase: 1.0x
- Items misaligned with phase: 0.5x

---

## PHASE 1b — CONTEXT INTEGRATION

Read `system/context.md`. If active items exist:

For each backlog item being scored in PHASE 2:
1. Check if item's `files_involved` or `program` overlaps with any context item's `Related Files` or `Related Programs`
2. If match found, apply context boost on top of phase multiplier:
   - `customer_issue`: 2.0x
   - `deadline`: scale by proximity (7d=1.5x, 3d=2.0x, 1d=3.0x, overdue=4.0x)
   - `opportunity`: 1.5x
   - `risk`: 1.5x
   - `goal`: 1.2x
3. Take the highest single boost (do not stack)
4. Note context influences in the PHASE 6 report

Context items are situational boosts, not persistent scoring changes. The base RICE score remains unchanged; context boost is a separate multiplier.

---

## PHASE 2 — RICE SCORING

For each backlog item and open finding, calculate RICE score:

```
RICE = (Reach x Impact x Confidence) / Effort x Phase_Multiplier
```

| Factor | Scale | Description |
|--------|-------|-------------|
| **Reach** | 1-10 | How many users/components affected |
| **Impact** | 1-5 | How much improvement per affected unit (1=minimal, 5=massive) |
| **Confidence** | 0.5-1.0 | How sure are we about reach and impact? |
| **Effort** | 1-10 | Person-sessions to complete (1=trivial, 10=multi-week) |

---

## PHASE 2b — STRATEGIC LENS (2 PARALLEL AGENTS)

Launch two agents in parallel to pressure-test the RICE scores against strategic and mission context.

### Agent 1: Strategic Review
Launch the **strategic-thinker** persona as an agent with this mandate:

> Review the RICE-scored backlog from Phase 2. For each top-10 item:
> 1. Does the quantitative score match strategic reality? (Flag mismatches)
> 2. Is this the right time for this item given project phase and dependencies?
> 3. Does this item unlock other high-value work not captured in RICE?
> 4. What's the opportunity cost of doing this instead of alternatives?
>
> Produce: A list of score adjustments (item ID, RICE score, strategic adjustment +/- with rationale) and a sequencing recommendation.

### Agent 2: Mission Alignment Check
Launch the **mission-advocate** persona as an agent with this mandate:

> Review the RICE-scored backlog from Phase 2. For each top-10 item:
> 1. Does this directly advance the stated mission in CLAUDE.md?
> 2. Is this infrastructure that ENABLES mission work? (acceptable but label it)
> 3. Does the overall priority queue serve beneficiaries or developer comfort?
> 4. Are there high-impact mission-aligned items missing from the backlog?
>
> Produce: Mission alignment flags (item ID, alignment: direct/enabling/neutral/drift, rationale) and a list of mission gaps.

### Integration
Apply adjustments from both agents as qualitative modifiers in the Phase 6 report. Where strategic-thinker and mission-advocate disagree (e.g., strategic says "defer" but mission says "urgent"), flag the tension for user decision.

---

## PHASE 3 — BOTTLENECK ANALYSIS (Theory of Constraints)

Identify the current bottleneck — the single constraint limiting overall project throughput:

1. **What's blocking the most items?** Scan for shared `blocked_by` dependencies
2. **What's the riskiest assumption?** Cross-reference constraints.md with queue items
3. **What program is most stale?** The neglected area is often the bottleneck
4. **What would a user complain about first?** The user-facing bottleneck

The bottleneck item gets a 2.0x multiplier on top of RICE score.

---

## PHASE 4 — WORK STREAM IDENTIFICATION

Group items into parallel work streams that don't conflict:

```
Stream A: [items that share no files_involved]
Stream B: [items that share no files_involved with Stream A]
Stream C: [remaining items]
```

For each stream, identify:
- **Quick wins:** Items with RICE > 15 and effort S (can be done in < 1 hour)
- **Anchors:** Items with RICE > 20 and effort M/L (substantial but high-value)
- **Dependencies:** Items that must be done before other items can start

---

## PHASE 5 — GAP ANALYSIS

Check for missing work:

1. **Information gaps:** Items where we need to research before we can act (create research tasks)
2. **Program gaps:** Programs with no recent engine runs (suggest running engines)
3. **Verification gaps:** Completed items without verification (suggest running /verify)
4. **Coverage gaps:** Areas of the codebase with no queue items or program coverage

---

## PHASE 6 — REPORT

```
## Traction Report

### Project Phase: [PHASE] (multiplier applied)
### Bottleneck: [what's constraining progress]

### Priority Queue (re-scored)
| Rank | ID | Title | RICE | Phase Mult | Final Score | Stream |
|------|-----|-------|------|-----------|-------------|--------|
| 1 | WS-NNN | ... | NN.N | 1.5x | NN.N | A |
| 2 | WS-NNN | ... | NN.N | 1.0x | NN.N | A |
| ... | | | | | | |

### Quick Wins (do these first)
| ID | Title | Score | Effort |
|----|-------|-------|--------|
| WS-NNN | ... | NN.N | S |

### Parallel Streams Available
- **Stream A:** [focus area] — [N items, estimated N sessions]
- **Stream B:** [focus area] — [N items, estimated N sessions]

### Bottleneck Resolution
[Specific recommendation to unblock the constraint]

### Gaps Identified
- [Information gaps, program gaps, verification gaps]

### Recommended Session Plan
1. First: [quick wins — clear these in < 1 hour]
2. Then: [bottleneck item — highest leverage]
3. Then: [top RICE item from primary stream]
```

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
