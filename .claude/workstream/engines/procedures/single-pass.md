# Procedure: Single Pass

A lightweight phase flow for micro and light engines that refine an artifact without the overhead of parallel agent dispatch. This procedure defines the STRUCTURE — the domain engine defines the CONTENT (what to check, what heuristics to apply, what the output looks like).

This procedure expects the domain engine to define these named sections:

| Section | Required | Purpose |
|---------|----------|---------|
| `## Input` | **REQUIRED** | What artifact type this engine accepts and how to parse it |
| `## Refinement Rules` | **REQUIRED** | The heuristics, checks, or enrichments to apply |
| `## Output` | **REQUIRED** | What the refined artifact looks like |
| `## Briefing Template` | OPTIONAL | How to present changes to the user; if absent, use default |

---

## Sizing

Engines using this procedure come in two sizes:

**Micro** (0 agents, ~5 sec):
- Single-pass heuristic application — no agent dispatch
- Read artifact, apply rules, output refined artifact
- Example: invariant precision check, config fitness

**Light** (1 agent, ~30 sec):
- Single expert agent applies the refinement rules
- Read artifact, dispatch one agent with full context, output refined artifact
- Example: work item enrichment, commit review

The domain engine declares its size in the MANIFEST.yaml. The procedure adapts:
- `size: micro` — skip agent dispatch, apply rules directly
- `size: light` — dispatch one agent with the refinement rules as its prompt

---

## PHASE 0 — GATHER CONTEXT

1. Read the input artifact (from arguments — file path, inline text, or pipeline reference)
2. Read `system/constraints.md` — hard constraints that limit options
3. Read `system/decisions.md` — settled decisions to respect
4. Read `CLAUDE.md` — project patterns

For micro engines, skip steps 2-3 if the refinement rules don't reference system state.

Parse the artifact into a structure the refinement rules can operate on. If the artifact is malformed or empty, report the issue and abort.

---

## PHASE 1 — REFINE

Read the domain engine's `## Refinement Rules` section.

**For micro engines (size: micro):**

Apply each rule from `## Refinement Rules` directly to the parsed artifact. Rules are heuristic checks — they don't require expert judgment, just pattern matching and structural analysis.

For each rule:
1. Check: does this rule apply to the artifact?
2. If yes: what specific change does it suggest?
3. Record: rule name, what was found, what was changed

**For light engines (size: light):**

Launch one agent using the Agent tool. The agent receives:
- The full artifact text
- The refinement rules from the domain engine
- Relevant context from Phase 0

The agent applies the rules with judgment — not just pattern matching but expert-informed refinement. Write the agent's output as the refined artifact.

---

## PHASE 2 — OUTPUT

Produce the refined artifact. The output format follows the domain engine's `## Output` section.

**Key principle: the refined artifact replaces the original at the same choice point.** The user sees the improved version and makes the same decision (approve, adjust, etc.) they would have made before refinement.

Track what changed:
```yaml
refinement:
  engine: "<engine-name>"
  size: micro | light
  changes_applied: <count>
  changes:
    - rule: "<rule-name>"
      description: "<what changed>"
    - rule: "<rule-name>"
      description: "<what changed>"
  unchanged: "<what was already good>"
```

---

## PHASE 3 — BRIEFING (optional)

If the domain engine has a `## Briefing Template`, present the changes. If not, use this default:

```
### Refined: [artifact type]

**Changes (N):**
- [change 1 — what improved and why]
- [change 2 — what improved and why]

**Unchanged:** [what was already solid]
```

Keep it brief. The user is mid-workflow — they want to see the improved artifact and move on, not read an analysis report.

---

## PHASE 4 — OPTIMIZATION EPILOGUE

**Reference:** `engines/standard/optimization-feedback.md` for signal types and schema.

Single-pass engines are lightweight — signal generation is rare but valuable when it happens.

### Signal Triggers for Single-Pass

| Condition | Signal Type | Target |
|-----------|------------|--------|
| Refinement produced zero changes (artifact already optimal) | `plateau` | The source engine that created the artifact |
| Refinement added information that should have been in the original | `prompt_gap` | The source engine |
| Same refinement rule fires on 3+ consecutive artifacts | `convergence` | The source engine's output template |

### Signal Generation

For each triggered condition:
1. Write signal to `.claude/workstream/optimization-index.yaml`
2. Assign next `OPT-NNN` ID, set `confidence: low`, `status: pending`
3. Update summary counters
4. Check for pattern emergence (2+ signals → `confirmed`)
