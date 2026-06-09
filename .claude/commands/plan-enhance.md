---
name: plan-enhance
description: "Enrich a rough plan with risk annotations, dependency mapping, effort estimates, and gap detection"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: plan-enhance` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Plan Enhancement Engine

You are taking a rough plan and making it better. Not replacing it — enriching it. The user's plan is the starting point. Your job is to add what's missing: risks they haven't considered, dependencies they haven't mapped, effort they haven't estimated, and gaps they haven't seen.

## Input

$ARGUMENTS — either:
- A file path to a plan document (e.g., "plan.md", ".claude/workstream/recommendations/REC-005.yaml")
- Inline text describing the plan
- A reference to a recent conversation plan (e.g., "the migration plan we discussed")

If no argument given, ask: "What plan would you like me to enhance? Paste it, point me to a file, or describe it."

---

## PHASE 0 — GATHER CONTEXT

1. Read the plan from arguments (file or inline text)
2. Read `system/constraints.md` — hard constraints that limit options
3. Read `system/decisions.md` — settled decisions (don't propose alternatives to these)
4. Read `system/invariants.md` — rules that must hold during execution
5. Read `CLAUDE.md` — project patterns and architecture
6. Run `git log --oneline -10` — recent trajectory for effort calibration

Parse the plan into discrete steps. If the plan is vague ("improve the auth system"), note that the enhancement will focus on making it concrete.

---

## PHASE 1 — PARALLEL ENRICHMENT

Launch 4 agents in parallel using the Agent tool. Each agent receives the full plan text.

### Agent 1: Dependency Mapper (architect persona)

> **Task:** Map the dependency structure of this plan.
>
> For each step in the plan:
> 1. What MUST be done before this step can start? (hard dependencies)
> 2. What SHOULD be done first but isn't strictly required? (soft dependencies)
> 3. What can be done IN PARALLEL with this step? (no dependencies)
> 4. What does this step BLOCK? (what can't start until this is done)
>
> Also identify:
> - MISSING STEPS — things the plan assumes are done but doesn't mention
> - ORDERING ISSUES — steps that are in the wrong sequence
> - PARALLELIZATION OPPORTUNITIES — steps listed sequentially that could run concurrently
>
> Output: Dependency DAG (directed acyclic graph) as a structured list showing the critical path and parallel tracks.

### Agent 2: Risk Annotator (failure-engineer persona)

> **Task:** Annotate each plan step with risk analysis.
>
> For each step:
> 1. What could go WRONG? (specific failure modes, not generic "something could break")
> 2. How LIKELY is failure? (based on the codebase complexity and the step's nature)
> 3. What's the BLAST RADIUS if it fails? (contained to one file? Breaks the whole app?)
> 4. What's the ROLLBACK? (can this step be undone? How?)
> 5. What's the MITIGATION? (how to reduce risk before attempting this step)
>
> Also identify:
> - RISK CLUSTERS — multiple steps that share a failure mode (fix the root cause, not each step)
> - POINT OF NO RETURN — the step after which rolling back the whole plan becomes costly
> - HIDDEN ASSUMPTIONS — things the plan takes for granted that might not be true
>
> Output: Risk-annotated plan with severity per step (low/medium/high) and the overall risk profile.

### Agent 3: Effort Estimator (senior-engineer persona)

> **Task:** Estimate effort for each plan step.
>
> For each step:
> 1. How much CODE needs to change? (lines, files, modules — from the codebase)
> 2. How much TESTING is needed? (new tests, updated tests, manual verification)
> 3. How much UNCERTAINTY is there? (well-understood change vs exploratory)
> 4. Size: S (< 30 min), M (30 min - 2 hours), L (2+ hours), XL (4+ hours)
>
> Also estimate:
> - TOTAL EFFORT for the full plan
> - CRITICAL PATH DURATION (elapsed time if parallelized optimally)
> - COMPLEXITY HOTSPOTS — steps that are disproportionately complex for their description
>
> Output: Effort-annotated plan with per-step and total estimates.

### Agent 4: Gap Detector (performance-engineer persona)

> **Task:** Find what the plan is missing.
>
> Check for:
> 1. VERIFICATION GAPS — steps with no "how do we know this worked?"
> 2. PERFORMANCE IMPLICATIONS — will this plan degrade performance? Add latency? Increase memory?
> 3. MONITORING GAPS — will we know if something goes wrong after the plan executes?
> 4. DOCUMENTATION GAPS — will the codebase be understandable after these changes?
> 5. MIGRATION GAPS — if this changes data structures, is there a migration plan?
> 6. COMMUNICATION GAPS — does anyone else need to know about these changes? (API consumers, etc.)
>
> Output: List of gaps with suggested additions to the plan.

Wait for all 4 agents to complete. Collect their outputs.

---

## PHASE 2 — SYNTHESIS

Combine all four agent outputs into an enhanced plan. Do NOT use adversarial cross-critique — this is additive enrichment, not evaluation.

For each original plan step, produce:
- The original step description (preserved)
- Dependencies (from Agent 1)
- Risk level and mitigation (from Agent 2)
- Effort estimate (from Agent 3)
- Gaps to address (from Agent 4)

Add new steps that agents identified as missing. Mark them clearly as "[ADDED]" so the user can see what's new vs original.

Produce the enhanced plan with:
- Dependency-ordered sequence (respecting the DAG)
- Parallel tracks identified
- Critical path highlighted
- Total effort estimate
- Overall risk profile

---

## PHASE 3 — ENHANCEMENT OUTPUT

Produce the enhancement artifact in the standard format (processed by `/engine` Step 5e):

- `type`: `enriched-plan`
- `target`: description of the original plan
- `summary`: what was enriched and key additions
- `enrichments`: list of categories (risk-annotation, dependency-mapping, effort-estimate, gap-detection)
- `personas_consulted`: [architect, failure-engineer, senior-engineer, performance-engineer]

---

## PHASE 4 — BRIEFING

Present the enhanced plan to the user as "here's your plan, but better."

Structure:
1. **Your plan, enhanced:** Brief acknowledgment of what they started with
2. **Key additions:** The 3 most important things the enhancement added (not all of them — highlight what matters most)
3. **Risk summary:** Overall risk profile in one sentence
4. **Effort summary:** Total estimate and critical path duration
5. **The enhanced plan itself:** The full enriched plan with annotations

Don't overwhelm — if the plan had 5 steps and the enhancement added 3 gaps plus risk annotations, present it as a clean enriched plan, not a wall of analysis.

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
