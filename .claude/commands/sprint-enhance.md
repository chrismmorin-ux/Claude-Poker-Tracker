---
name: sprint-enhance
description: "Refine a composed sprint — tighten sequencing, flag risks, rebalance effort, improve coherence"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: sprint-enhance` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Sprint Enhancement Engine

You are refining a sprint that's already been composed. Not replacing it — making it better. The sprint exists, the items are selected, the goal is written. Your job is to find what `/next` couldn't see: sequencing risks, effort imbalances, coherence gaps, and missed dependencies between items.

## Input

$ARGUMENTS — either:
- A sprint file path (e.g., `.claude/workstream/sprints/SPR-005.yaml`)
- The text "current" or "active" — read the active sprint from `sprint-index.yaml`
- Inline sprint data passed from the `/next` choice point (the sprint hasn't been written to disk yet)

If no argument given, check for an active sprint. If none, ask: "Which sprint should I refine?"

---

## Additional Context

1. Read the sprint file (or parse inline data)
2. For each item in the sprint, read the full work item YAML from `.claude/workstream/queue/`
3. Read `system/context.md` if it exists — active deadlines, risks, opportunities
4. Read `.cwos-config.yaml` — ceremony level, sprint caps

Parse the sprint into:
- **Goal** — what the sprint achieves
- **Items** — ordered list with mode, effort, dependencies, decision flags
- **Total effort** — sum of item efforts
- **Program focus** — if any

---

## Agents

### Agent 1: Sequencing Analyst (systems-architect persona)

> **Task:** Analyze the sprint's item order for sequencing problems.
>
> For each item in the sprint:
> 1. Does this item depend on another sprint item that comes AFTER it? (ordering violation)
> 2. Does this item produce outputs that a LATER item needs? (confirm dependency is respected)
> 3. Could this item be parallelized with adjacent items? (opportunity to note, not reorder)
> 4. Is this item's `mode` correct? (should "just do it" items actually be "design first" given what precedes them?)
>
> Also check:
> - **Quick wins misplaced:** Are there S-effort execute items buried after L-effort plan-first items? Quick wins early build momentum.
> - **Risk frontloading:** Are the riskiest items early enough that failure is cheap? Or is the highest-risk item last, where failure wastes the whole sprint?
> - **Decision clustering:** Are plan-first items grouped such that the user can make all decisions in one pass, or are they scattered?
>
> Output: Resequenced item order (if changes needed) with justification for each move. If the current order is good, say so and explain why.

### Agent 2: Risk Assessor (failure-engineer persona)

> **Task:** Identify risks in this sprint that `/next` composition couldn't see.
>
> For each item:
> 1. What could go wrong during execution? (specific to THIS item's files and scope)
> 2. If this item fails, does it cascade to other sprint items?
> 3. Are there items that share files — could changes in one break the other?
> 4. Does the effort estimate feel right given the `files_involved` and `accept_criteria`?
>
> For the sprint as a whole:
> - **Blast radius check:** If the sprint is abandoned mid-execution, is the codebase in a consistent state? Or do items 1-3 create a half-done situation?
> - **Safe stop points:** Where can execution stop and the codebase remains shippable?
> - **Hidden coupling:** Items that look independent but touch shared state or shared files
>
> Output: Risk annotations per item (low/medium/high), safe stop points, and any items that should be reordered or split for safety.

### Agent 3: Effort & Coherence Analyst (senior-engineer persona)

> **Task:** Check the sprint's effort balance and thematic coherence.
>
> Effort analysis:
> 1. Do the effort estimates match reality? (Read `files_involved` for each item — is an "S" item actually touching 5 files across 3 directories?)
> 2. Is total effort realistic for one sprint? (check against ceremony config caps)
> 3. Are there items that should be split? (an M that's really two S's)
> 4. Are there items that should be merged? (two S's that touch the same files and could be one pass)
>
> Coherence analysis:
> 1. Does the sprint goal accurately describe what these items achieve together?
> 2. Is there an item that doesn't belong — it's in the sprint but doesn't contribute to the goal?
> 3. Is there a missing item — something implied by the goal that isn't in the sprint?
> 4. Would the sprint benefit from a different goal framing?
>
> Output: Effort adjustments (if any), items to split/merge (if any), coherence assessment, goal refinement (if needed).

---

## Synthesis

Combine the three analyses into a refined sprint. For each change:
- What specifically changed (reordered, re-estimated, split, merged, reframed)
- Why (the analysis that motivated it)

**Do NOT add items.** This engine refines what's there — it doesn't expand scope. If an agent identified a missing item, note it as a recommendation but don't add it to the sprint.

**Do NOT remove items.** If an item doesn't fit, flag it for the user's decision but keep it in the sprint.

Produce a `refinement_summary`:
- Changes applied (count and list)
- Risk profile (overall sprint risk: low/medium/high)
- Safe stop points (item numbers where pausing is clean)
- Confidence: how much better is the refined sprint? (marginal / meaningful / significant)

---

## Severity Map

| Level | Founder Label | Criteria |
|-------|--------------|----------|
| CRITICAL | **Fix before executing** | Ordering violation that would cause data loss or unrecoverable state; item depends on a missing prerequisite |
| HIGH | **Resequence this sprint** | Items in wrong order causing significant rework; effort estimates off by >2x; missing safe stop point before high-risk item |
| MEDIUM | **Worth adjusting** | Sequencing inefficiency; coherence gap between items; effort imbalance across the sprint |
| LOW | **Nice to have** | Minor reordering opportunity; goal framing improvement; parallelization suggestion |

---

## Briefing Template

```
### Sprint Refined: SPR-NNN — [goal]

**Confidence:** [marginal / meaningful / significant] improvement

**Changes (N):**
- [change — e.g., "Moved WS-042 before WS-038 (dependency: 042 produces the interface 038 consumes)"]
- [change — e.g., "Re-estimated WS-041 from S to M (touches 4 files across auth/ and api/)"]
- [change — e.g., "Grouped decision points: items #2 and #4 now adjacent for single decision pass"]

**Risk Profile:** [low/medium/high]
- Safe stop points: after items #[N], #[M]
- Highest risk: item #[X] — [why]

**Refined Sprint:**
| # | Title | Mode | Effort | Risk | Notes |
|---|-------|------|--------|------|-------|
| 1 | [title] | [mode] | [effort] | [risk] | [any change note] |

Approve refined sprint? (yes / revert to original / adjust)
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
