---
name: plan
description: "Multi-agent priority deliberation — 5 expert agents evaluate priorities independently, revise after cross-review, then facilitator synthesizes"
user-invocable: true
argument-hint: "[focus area or constraint]"
---

# /plan — Priority Deliberation Engine

Run a structured multi-agent deliberation to determine what work should be prioritized next. Dispatches 5 expert agents independently, collects their evaluations, re-invokes them with each other's outputs for cross-review, then dispatches a facilitator agent for final synthesis.

**Critical rule:** Every perspective is a SEPARATE AGENT invocation via the Agent tool. Never simulate multiple perspectives in a single context.

## Output Shape

**Deliberation arc:** `<dispatching | cross-reviewing | synthesized>` — `<one-clause status>` (e.g., "5 personas dispatched, awaiting independent evaluations").

`<Delta line: what this invocation did — dispatched N personas, completed cross-review, produced synthesis.>`

`<Remainder: persona-by-persona evaluation table or facilitator synthesis bullets — never prose-only.>`

### Why these priorities?
`<Value-rationale: cite repo_goal, current sprint focus, captured constraints, or surfaced findings. Each persona must reference repo-specific tokens. If no repo-specific token applies, declare it.>`

**Do next:** Numbered options — `1. Approve top priority for /next` / `2. Re-deliberate with new focus` / `3. Promote a non-top item with rationale`.

## Steps

### 1. Collect Project State

Read all context needed for deliberation:

**System State & Meta-System**
- Read `system/state.md` — vital signs, metrics, queue summary
- Read `system/invariants.md` — what must hold true
- Read `system/constraints.md` — hard constraints and assumptions
- Read `system/decisions.md` — settled decisions (do NOT re-litigate without new info)
- Read `system/failures.md` — past failures to avoid repeating
- Read `system/intention.md` — the constitution. Required slices: **Anti-goals** (what CWOS must NOT become), **Failed States** (10 concrete dystopias to avoid), and **INV-F1** (No Unnecessary Burden — the tie-breaker for principle conflicts). Sprint deliberation must check whether any candidate priority maps to an anti-goal or failed state. If a match surfaces, the facilitator (Step 5) must quote the affected clause verbatim and either rule the candidate out or surface it as an explicit decision-flag for founder exemption.

**Current Queue (context-budget-aware)**
- Read `.claude/workstream/queue-index.yaml` for queue summary
- If fewer than 50 items: load full details from `queue/WS-*.yaml` for all items
- If 50+ items: load full details ONLY for the top 20 by priority_score from the index, plus all items with `status: in_progress` or `status: blocked`
- Read `.claude/workstream/findings-index.yaml` for open findings not yet promoted. If index missing, scan `findings/FIND-*.yaml` files.

**Programs**
- Read `.claude/workstream/programs/` — stale programs should become candidates

**Codebase State**
- `git log --oneline -20` for recent trajectory
- `git diff --stat HEAD~5` for recent change surface area

**Project Rules**
- Read `CLAUDE.md` for project purpose and constraints
- Read `system/scoring.md` (if exists) for RICE scoring reference

### 2. Prepare Agent Briefing

Compile the collected state into a briefing document that will be passed to each agent. The briefing includes:
- Project purpose (from CLAUDE.md)
- Current queue state (items, priorities, blocked items)
- System health (vital signs, program staleness)
- Constraints and settled decisions
- Recent trajectory (git log summary)
- RICE scoring reference

### 3. Round 1 — Dispatch 5 Agents in PARALLEL

Launch ALL 5 agents simultaneously using the Agent tool. Each agent receives the same briefing but evaluates through their unique lens.

**Agent 1: Systems Architect** (use `architect` persona from `.claude/agents/`)
> You are evaluating project priorities from an architecture perspective. [Include full briefing]
> Produce your Round 1 output: Top 5 priorities ranked by architectural impact, items to deprioritize, and new items you'd propose.

**Agent 2: Failure Engineer** (use `failure-engineer` persona from `.claude/agents/`)
> You are evaluating project priorities from a failure/resilience perspective. [Include full briefing]
> Produce your Round 1 output: Top 5 priorities ranked by risk reduction, items to deprioritize, and new items you'd propose.

**Agent 3: Product Owner** (use `product-owner` persona from `.claude/agents/`)
> You are evaluating project priorities from a product/user value perspective. [Include full briefing]
> Produce your Round 1 output: Top 5 priorities ranked by user value, items to deprioritize, and new items you'd propose.

**Agent 4: Operations Engineer** (use `operations-engineer` persona from `.claude/agents/`)
> You are evaluating project priorities from an operational reliability perspective. [Include full briefing]
> Produce your Round 1 output: Top 5 priorities ranked by operational risk reduction, items to deprioritize, and new items you'd propose.

**Agent 5: Strategic Thinker** (use `strategic-thinker` persona from `.claude/agents/`)
> You are evaluating project priorities from a strategic ROI perspective. [Include full briefing]
> Produce your Round 1 output: Top 5 priorities ranked by strategic ROI, items to deprioritize, and new items you'd propose.

Wait for all 5 agents to return.

**Validation:** Check that the 5 rankings are genuinely different. If 4+ agents have the same #1 priority, that's consensus (good). If all 5 have identical top 5, the differentiation failed — note this in the synthesis.

### 4. Round 2 — Re-invoke 5 Agents with Cross-Review

Re-invoke each of the 5 agents using the Agent tool. Each agent receives:
- Their own Round 1 output
- ALL other agents' Round 1 outputs
- Instruction: "Review the other 4 perspectives. Revise your priorities based on what you learned. Note where you agree, where you still disagree, and what changed."

Launch all 5 in PARALLEL.

Each agent produces:
```
### [Perspective] — Round 2 Revised

**Revised Top 5 (with changes):**
1. **[Item]** [UNCHANGED / MOVED UP / MOVED DOWN / NEW]
   After reviewing others: [What changed and why]

**Where I agree with others:**
- [Specific agreements with named agents]

**Where I still disagree:**
- [Specific disagreements with named agents and why]
```

Wait for all 5 agents to return.

### 5. Facilitated Synthesis — Dispatch Facilitator Agent

Launch the **roundtable-facilitator** agent (use `facilitator` persona from `.claude/agents/`) with ALL 10 outputs (5 Round 1 + 5 Round 2):

> You are the facilitator for a priority deliberation. You have received 5 independent priority evaluations (Round 1) and 5 revised evaluations after cross-review (Round 2).
>
> Synthesize into:
> - Consensus items (3+ agents agree)
> - Contested items (with resolution or explicit OPEN question for user)
> - Emerging priorities (new items proposed that gained support)
> - Final ranked priority queue with RICE scores
>
> De-duplicate against existing queue items. Use the RICE scoring reference provided.
>
> Format work items for the workstream queue (YAML format with all required fields).
>
> **WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

### 6. Output: Proposed Sprint(s)

The facilitator groups results into 1-2 proposed sprints. Each sprint has a goal, sequenced items, and mode classifications (see `/next` Step 3d for classification rules).

Present the output:

```
## Priority Deliberation Results

### Proposed Sprint: SPR-NNN — [goal]

| # | Title | Mode | Effort | Decisions Needed |
|---|-------|------|--------|-----------------|
| 1 | [consensus item] | Just do it | S | None |
| 2 | [consensus item] | Design first | M | [flags] |
| 3 | [new item proposed] | Just do it | S | None |

Total effort: [sum]
Why this sprint: [consensus rationale]

### Decisions needed before executing:
- #2: [decision description]

### Contested (resolved)
| # | Item | Decision | Dissent |
|---|------|----------|---------|
| 1 | ... | [resolution] | [who disagreed and why] |

### Deprioritized
| Item | Reason |
|------|--------|
| ... | [why] |

### Second Sprint (if enough items)
[Same format — for items that didn't fit in the first sprint but were prioritized]
```

### 7. Apply Results

On user approval of a sprint:
- Create new work items in `.claude/workstream/queue/` (update queue-index.yaml)
- Update priority scores on existing items (update queue-index.yaml)
- Write sprint file to `.claude/workstream/sprints/SPR-NNN.yaml` with all items sequenced and classified
- Update sprint-index.yaml
- Claim all sprint items for current session
- Record the deliberation in `system/decisions.md`
- Update `system/state.md` queue summary
- Reconcile counters in config.yaml before creating new items
- **Begin sprint execution** — proceed to `/next` Step 6 (Execute Sprint)

### Enhancement Available

If the sprint contains plan-first items or total effort > 2 sessions:

> Want a second opinion? Run `/engine plan-enhance` to stress-test this sprint with risk annotations, dependency mapping, and gap detection. (Skip to proceed.)

## Error Handling

- If queue-index.yaml missing: rebuild from individual WS-*.yaml files
- If an agent returns empty output: note which agent failed, proceed with remaining agents
- If fewer than 3 agents return: warn user, synthesis may lack diversity
- If config.yaml malformed: rebuild counters from file scan
- If git commands fail: proceed without git context, note in briefing


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T6:workstream --tag /plan --payload '{"command":"/plan"}'`

Non-fatal. Do not gate any output on the exit status.
