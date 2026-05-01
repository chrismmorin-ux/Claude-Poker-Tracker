---
name: eng-engine
description: "Multi-persona engineering roundtable — 6 expert agents perform adversarial technical audit with cross-critique and facilitated synthesis"
procedure: agent-dispatch
extends: context-gather
user-invocable: false
---

# Engineering Roundtable

You are orchestrating a multi-expert engineering panel. This is NOT brainstorming — it is rigorous, adversarial, systems-level analysis.

## Focus Area

$ARGUMENTS

If no argument given, default to "full" (entire codebase).

---

## Additional Context

After the base context gather, also read:

1. `system/failures.md` — known failure modes (check for recurrence)
2. `.claude/workstream/queue/` — scan for existing work items (avoid duplicates)
3. Run `git diff --stat HEAD~5` — recent change surface area

4. Set `run_workspace` = `.claude/workstream/runs/run-<run_id>/artifacts/`
5. Create phase directories: `run_workspace/phase-1/`, `run_workspace/phase-2/`, `run_workspace/phase-3/`

---

## Agents

Launch ALL 6 expert agents in parallel. Each agent has its own persona definition in `.claude/agents/`.

For each agent, pass this briefing in the prompt:

> **Focus area:** [the focus area from arguments or "full"]
>
> Read the context files listed in your agent definition, then analyze the focus area through your expert lens. Produce your structured output (Key Concerns, Hidden Risks, Likely Missing Elements, Dangerous Assumptions). Be specific — reference file paths and line numbers. Do NOT propose solutions yet.

The 6 agents to launch:

1. **architect** — architecture, invariants, coupling, module boundaries
2. **senior-engineer** — implementation quality, maintainability, testing, DX
3. **failure-engineer** — failure modes, edge cases, cascading failures, data corruption
4. **performance-engineer** — latency, throughput, resource usage, scalability
5. **security-engineer** — attack surface, trust boundaries, data protection
6. **product-ux** — user experience, accessibility, usability, consistency

---

## Cross-Critique

The cross-critique is the highest-leverage quality lever in this engine — `project_engine_benchmarks` measured a +0.98 quality lift "for free." But cross-critic prompts that are too generic flatline into formulaic boilerplate; the same six bullets get rephrased per run instead of producing genuine adversarial pressure (FAIL-014). The block below is intentionally structured + seeded with blind context to force divergence.

> You are the Cross-Critic. You have received independent analyses from the expert agents listed below. **Your output must be adversarial, not aggregating.** If your output reads like a summary of the expert findings, you've failed.
>
> **Mandatory checklist** — your response must address each of the following explicitly. If a section is genuinely empty, write "None — verified by [reasoning]." Do not omit a section.
>
> 1. **Wrongness audit.** For each expert, name ≥1 specific claim that is wrong, weakly-supported, or unjustified. Cite file path + line. If you can't find one for an expert, that expert was either right OR you didn't read carefully — assume the latter unless you can demonstrate otherwise.
> 2. **Missing dimension.** Identify ≥1 dimension that no expert examined. Examples of dimensions experts often skip: time-to-detect (not just severity), cost-of-being-wrong (not just probability), recovery cost (not just failure cost), founder cognitive load (not just code complexity), drift over time (not just current state). Frame the dimension you bring as one that *must* be addressed for the audit to be complete.
> 3. **Severity recalibration.** Find ≥1 finding where two experts implicitly disagreed on severity. Force the disagreement explicit: "X rated this high; Y rated the same surface medium. The right answer is [pick] because [evidence]."
> 4. **Shared blind spot.** What did *all* experts miss? This is the question with the highest expected value. Common shared blind spots in this codebase: failure modes that span multiple personas' boundaries; assumptions about how the founder will use the output; non-obvious feedback loops (e.g. an engine that improves the system in a way that makes future runs harder).
> 5. **Alteration mandate.** You must alter ≥10% of the findings: at least one finding modified (severity / scope / wording), one removed (duplicate / wrong), one added (the missing dimension you named in #2). If the input has 8 findings, that's at minimum 1 modified + 1 removed + 1 added. Document each alteration as a separate diff entry.
> 6. **Blind-context seed.** Address this fact that the experts did NOT see: read `system/intention.md` Failed States #3 and #10. For each finding the experts produced, ask: "If this finding gets resolved, does it move the system toward Failed State #3 or #10, or away from it?" Surface any finding that, while technically correct, would push the system toward self-aggrandizing complexity. Mark these `direction: away-from-goal` in the alteration diff.
>
> Be ruthless. The value is in the spaces BETWEEN their analyses, and in the constitutional check the experts didn't run. The synthesis phase reads your output and trusts it — if you boilerplate, the entire run flatlines.

---

## Synthesis

> Here are the expert analyses and the cross-critique results (read from run artifacts). Perform synthesis:
>
> Phase 3: Consensus areas, key disagreements, unknowns, ranked weak points, forced resolution of all disagreements.
>
> Phase 4: Top risks, structural improvements, work item proposals (YAML format for workstream queue), system model updates, state update recommendations.
>
> De-duplicate against existing queue items using `.claude/workstream/queue-index.yaml`.
> Dedup key algorithm: lowercase kebab-case of `{engine}-{category}-{file-path}-{line-range}`.
>
> Every work item must include: title, type, priority_score (RICE), category, program, description, accept_criteria, effort, files_involved.
>
> Additionally, look for patterns across findings that suggest structural responses rather than individual fixes. When you see 3+ findings clustering around a theme, propose a strategy recommendation (new program, engine, invariant, or architecture change) instead of — or in addition to — individual work items. Include the list of finding IDs that support each recommendation.
>
> **Blindspot tagging:** Set `blindspot: true` on any finding generated during a `blind_spot`, `meta-engine`, or `challenge` protocol, OR whenever the finding represents a structural gap that normal checks by definition would miss. Blindspot findings bypass the per-run `finding_cap` (see `/engine` § 5.0) so constitutional blind-spot protocols always surface their full set, even on noisy days.

---

## Protocol Reflection (Deep Runs Only)

**Activation:** This phase runs ONLY for deep protocol runs — `blind_spot`, `meta-engine`, or `challenge` protocols. Skip for `baseline`, `delta`, and `sweep`. This section is invoked by the agent-dispatch procedure's Phase 6d (Optimization Epilogue).

> You just completed a deep analysis run. Now step back and evaluate the PROCESS, not the product.
>
> Read the cross-critic's `shared_blind_spots` and `severity_recalibrations` from phase-2.
> Read the facilitator's findings from phase-3.
>
> Answer these questions:
>
> 1. **Prompt gaps:** Did any expert consistently miss a category of issue? What prompt addition would have caught it?
> 2. **Missing context:** Was external information (web research, user feedback, production data) manually injected that should be a standard protocol step?
> 3. **Severity calibration:** Did the cross-critic recalibrate 2+ findings in the same direction? What does that pattern say about the expert prompts?
> 4. **Structural blind spots:** Did all 6 experts share a blind spot? What does that reveal about the persona set — is a 7th persona needed, or do existing personas need broader scope?
> 5. **Protocol coverage:** Did the protocol's focus questions miss an important dimension? What question should be added?
>
> Produce a `protocol-feedback.yaml` artifact in `run_workspace/phase-3/` using the schema defined in `engines/standard/optimization-feedback.md`. Extract individual signals and write to `.claude/workstream/optimization-index.yaml`.
>
> **Rules:**
> - Only propose changes supported by evidence from THIS run — not speculation
> - Proposed prompt text must be specific enough to copy-paste into the engine or protocol definition
> - If no improvements are warranted, write `no_changes_needed: true` and explain why

---

## Severity Map

| Internal Level | Founder Label | Criteria |
|----------------|---------------|----------|
| CRITICAL | **Fix before you ship** | Security vulnerability, data corruption risk, system down |
| HIGH | **Fix this week** | Significant bug, architectural violation, test gap in critical path |
| MEDIUM | **Worth improving** | Code quality issue, minor bug, maintainability concern |
| LOW | **Nice to have** | Style issue, minor improvement, documentation gap |

Use the "Founder Label" in all default output. The internal level is used for RICE scoring and work item classification only.

---

## Briefing Template (Founder-Native Default)

```
## What I Found

### Launch Readiness: [SAFE / CAUTION / NOT SAFE]
[One sentence: can you ship today based on what I found?]
- SAFE: No critical or high-severity issues found
- CAUTION: High-severity issues found but manageable — not blocking launch
- NOT SAFE: Critical issues that must be fixed before shipping

### Top 3 Things That Matter
1. **[title]** — [one sentence: what's wrong and what it means for your users/business]
   Urgency: [Fix before you ship / Fix this week / Worth improving]

2. **[title]** — [one sentence]
   Urgency: [label]

3. **[title]** — [one sentence]
   Urgency: [label]

[If more findings exist: "Plus N more items added to your work queue — run /status to see them all."]
[If any findings are premature for current milestone: "Items marked * become relevant at M[N]"]

### What Needs Your Decision
[Only shown if any items need user input — in plain language, not technical jargon]

### What I Did
- Created N work items in your queue
- [Any system updates: invariants, failures recorded]

### What To Do Next
[Single action, framed as outcome: "Fix the auth bug so users can log in reliably" not "Address WS-042"]
```

### Technical Detail (--technical flag)

When the user passes `--technical` or requests full detail, use this expanded format instead:

```
## Engineering Roundtable Results

### Run: run-NNN | Focus: [area] | Date: YYYY-MM-DD | Milestone: [current]

### All Findings
| # | Finding | Priority | Severity | Why It Matters | Action |
|---|---------|----------|----------|----------------|--------|
| 1 | [title] | [score]/100 | CRITICAL/HIGH/MEDIUM/LOW | [impact] | [action] |

### Work Items Created
| ID | Title | Priority Score | Effort | Category | Program |
|----|-------|---------------|--------|----------|---------|
| WS-NNN | ... | NN.N | S/M/L | ... | ... |

### System Updates Applied
[Invariants added, failures recorded, state updated]
```
