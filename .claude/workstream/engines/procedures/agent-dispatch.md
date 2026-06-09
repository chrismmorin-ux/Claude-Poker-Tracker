# Procedure: Agent Dispatch

A phase flow for engines that dispatch parallel persona agents, perform cross-critique, and synthesize results. This procedure defines the STRUCTURE — the domain engine defines the CONTENT (which agents, what prompts, what severity means).

This procedure expects the domain engine to define these named sections:

| Section | Required | Purpose |
|---------|----------|---------|
| `## Agents` | **REQUIRED** | List of agents with persona name and prompt template |
| `## Synthesis` | **REQUIRED** | Instructions for the facilitator/synthesis agent |
| `## Severity Map` | **REQUIRED** | Domain-specific severity vocabulary (used in Phase 4 backlog integration) |
| `## Briefing Template` | **REQUIRED** | How to present results to the user (Phase 5) |
| `## Cross-Critique` | OPTIONAL | Custom cross-critique instructions; if absent, use default |

---

## MODEL TIER DEFAULTS

These defaults are derived from benchmark experiments (Series 1, 9 experiments, ~50 agent runs). They apply to all engines using this procedure unless explicitly overridden.

| Role | Default Model | Floor | Rationale |
|------|--------------|-------|-----------|
| Expert agents (Phase 1) | sonnet | haiku | Sonnet achieves detection parity with Opus on known patterns (BM-004). Haiku is acceptable but not recommended. |
| Cross-critic (Phase 2) | opus | sonnet | Cross-critique is the highest-value phase — model capability matters here. |
| Synthesis/facilitator (Phase 3) | opus | sonnet | Haiku synthesis overcalibrates and introduces errors (BM-007). **Never use Haiku for synthesis.** |

If a domain engine specifies `model` overrides, they must respect the floor constraints above. A synthesis agent configured below its floor is a configuration error — warn and use the floor model instead.

---

## PANEL COMPOSITION DEFAULTS

**Minimum viable panel (budget trio):** `[architect, security-engineer, product-ux]`

When a domain engine defines fewer than 3 expert agents, use the budget trio as the default. These three personas cover the widest analytical surface with minimal overlap (BM-001, BM-006).

**Mandatory persona:** `product-ux` must be included in every analysis panel. This persona finds a genuinely different class of issue (client-facing vs server-side) that technical-only panels miss (BM-001: 3 unique findings, BM-006: 5 unique findings).

**Persona reduction ordering:** When reducing panel size (e.g., for cost or latency), remove overlapping perspectives first:
1. Drop `senior-engineer` first (highest overlap with architect)
2. Drop `performance-engineer` next (overlap with architect on scalability)
3. Keep `product-ux` last (lowest overlap, highest unique-finding rate)

---

## PERSONA RESOLUTION RULE (ADR-044)

Each engine prose persona reference (e.g., `architect`, `mission-advocate`) resolves to **`.claude/agents/<name>.md`** — and only there. The frontmatter `name:` field MUST equal the filename basename MUST equal the engine prose reference. No fallback path. No fuzzy matching. A missing agent file is a **hard error** that blocks the engine run; the orchestrator MUST NOT silently fall back to SDK default resolution.

The graph-closure test (`kit/scripts/__tests__/engine-persona-graph.test.js`) and pre-commit hook (`kit/scripts/git-hooks/pre-commit-graph-closure.sh`) enforce this at commit time.

**Note on namespaces:** The `roundtable-*` agents in `.claude/agents/` (e.g., `roundtable-architect`) belong to the `multi-persona-roundtable` Skill at `.claude/skills/multi-persona-roundtable/`. They are a **separate namespace** from the eng-engine flow and are dispatched only by that skill. Engine prose in `engines/standard/`, `engines/library/`, and `engines/homebase-only/` MUST NOT reference `roundtable-*` agents — use the unprefixed core persona name (e.g., `facilitator`, not `roundtable-facilitator`).

---

## PHASE 1 — DISPATCH EXPERT AGENTS (PARALLEL)

Read the domain engine's `## Agents` section.

**Persona filtering:** Before dispatching, check `.cwos-config.yaml` for `engines.persona_overrides.<engine-name>.disabled`. Remove any listed agents from the dispatch set. For each skipped agent:
- Add a skipped entry to the manifest's `artifacts` map:
  ```yaml
  phase-1/<agent-name>:
    status: skipped
    reason: "disabled in .cwos-config.yaml"
  ```
- Do NOT create an artifact file for skipped agents
- Include skipped agents in the Phase 5 briefing (see below)

If `persona_overrides` is missing or empty, dispatch all agents as normal.

For each remaining agent:

1. Record `started_at` before dispatch
2. Launch the agent in parallel using the Agent tool. Each agent's persona is in `.claude/agents/`. Pass the agent's prompt template from the domain engine, including the focus area.
3. **Artifact path on re-fires (WS-311 AC e).** The default Phase-1 artifact path is `<run_workspace>/phase-1/<agent-name>.yaml`. If the agent is being **re-fired** (e.g., the original dispatch returned empty / wrong subagent_type and a replacement is being run), do NOT overwrite the original artifact. Compute the next free generation suffix and write to `<run_workspace>/phase-1/<agent-name>.r<n>.yaml` (where `n` is the lowest integer ≥ 1 such that the path does not yet exist). Run-017 demonstrated the failure live: a `general-purpose` re-fire silently overwrote the native `security-engineer.md` from four minutes earlier. The suffix preserves both. The same convention applies to any companion `.md` exported via `--artifact-path`.
4. When the agent returns, write to the resolved path (per step 3) using the artifact schema:
   ```yaml
   agent: "<agent-name>"
   persona: "<persona-filename>"
   engine: "<engine-name>"
   run_id: "run-<id>"
   phase: 1
   status: complete | failed | timeout
   error: ""
   retry_count: 0
   started_at: "<timestamp>"
   completed_at: "<timestamp>"
   duration_seconds: <N>
   context_hash: "<from Phase 0>"
   input_artifacts: []
   output:
     raw_text: |
       <full agent response as markdown>
     key_concerns: []
     hidden_risks: []
     missing_elements: []
     dangerous_assumptions: []
   ```
5. Update the manifest punchlist via the deterministic CLI (WS-305). After each agent returns:

   ```bash
   node kit/scripts/cwos-engine-manifest.js update \
     --run-id run-<id> --phase 1 --agent <name> --status <complete|empty-failed|timeout> \
     --bytes <artifact-byte-count> --artifact-path artifacts/phase-1/<name>.md \
     --subagent-type "<dispatch-origin>" --completed-at "<ISO>"
   ```

   For a re-fired agent, `--artifact-path` should be the resolved suffixed path (e.g., `artifacts/phase-1/<name>.r1.md`), not the original.

   The CLI rewrites `manifest.yaml` atomically and recomputes `actual_complete` / `actual_empty` counters. Do NOT edit `manifest.yaml` by hand — the validator (`cwos-engine-manifest validate`) blocks engine-completion at commit time on schema drift.

   For mid-run "still writing but not yet complete" status, call with `--status writing` (avoids false-positive empty-failed when slow-native subagents take 20+ min). When marking a re-fired dispatch as discarded, use `cwos-engine-manifest refire --run-id <r> --agent <name> --reason <s>` to record it under `discarded_redundant_dispatches`.

Launch ALL agents in parallel — do not wait for one before starting another.

### Error Handling

- If an agent returns empty output: write artifact with `status: failed`, `error: "empty output"`
- If fewer than 3 agents produce `status: complete` artifacts: warn user that synthesis may lack diversity, proceed with available artifacts
- If no agents return usable output: write all artifacts as `status: failed`, set manifest `status: failed`, create a single finding noting the failure, abort
- User can retry failed agents with `/engine <name> --retry run-<id> --agent <agent-name>`

---

## PHASE 2 — CROSS-CRITIQUE (MANDATORY FOR 3+ AGENTS)

**This phase is mandatory when 3 or more expert agents produced `status: complete` artifacts in Phase 1.** Cross-critique is the highest-value structural element — it resolves contradictions, surfaces hidden promotions, and catches shared blind spots that no individual expert can detect (BM-002: +0.98 quality delta). Skipping it for panels of 3+ agents is a configuration error.

For panels with fewer than 3 complete agents, cross-critique is recommended but optional. Proceed to Phase 3 if skipped.

Launch the **cross-critic** agent (from `.claude/agents/cross-critic.md`). Build input by reading Phase 1 artifacts FROM DISK:

1. List all `.yaml` files in `<run_workspace>/phase-1/`
2. For each file with `status: complete`: read the `output.raw_text` field
3. For each file with `status: failed`: note the skipped agent

Check the domain engine for a `## Cross-Critique` section. If present, use those instructions. If absent, use this default:

> You are the Cross-Critic. You have received independent analyses from the expert agents listed below. Your job is to find:
> 1. What each expert got WRONG
> 2. What they MISSED
> 3. Where their assumptions break at scale or in production
> 4. Where experts contradict each other
> 5. Shared blind spots (things ALL experts missed)
> 6. Severity recalibrations (issues rated differently by different experts)
>
> Be ruthless. The value is in the spaces BETWEEN their analyses.

Pass all Phase 1 artifact outputs, labeled by agent name. Write output to `<run_workspace>/phase-2/cross-critic.yaml` with `input_artifacts` listing the Phase 1 paths consumed. Update the manifest:

```bash
node kit/scripts/cwos-engine-manifest.js update \
  --run-id run-<id> --phase 2 --agent cross-critic --status complete \
  --bytes <artifact-byte-count> --artifact-path artifacts/phase-2/cross-critic.yaml \
  --subagent-type "<dispatch-origin>"
```

### Error Handling

- If the cross-critic returns empty: write artifact with `status: failed`. Proceed to synthesis with Phase 1 artifacts only. Mark via `cwos-engine-manifest update --phase 2 --agent cross-critic --status empty-failed --reason "Cross-critique returned empty — proceeding with Phase 1 artifacts only"`.

---

## PHASE 3 — FACILITATED SYNTHESIS

Read the domain engine's `## Synthesis` section for the synthesis prompt.

Launch the synthesis/facilitator agent. Build input by reading artifacts FROM DISK:

1. Read all `status: complete` artifacts from `<run_workspace>/phase-1/` — extract `output.raw_text`
2. Read `<run_workspace>/phase-2/cross-critic.yaml` — extract `output.raw_text` (if `status: complete`)
3. If cross-critic artifact is missing or `status: failed`, proceed with Phase 1 artifacts only

Pass all artifact contents labeled by phase and agent name, along with the synthesis instructions from the domain engine.

**Priority scoring instruction (always include in the synthesis prompt):**

> For each finding, calculate a `priority_score` (0-100) based on business value:
> - Launch relevance (+30): Is this needed before launch?
> - User impact (+20): Does this directly affect end users?
> - Revenue impact (+20): Does this affect money flow?
> - Milestone alignment (+15): Is this appropriate for the current milestone? (Current milestone: [from Phase 0 context])
> - Dependency (+15): Does fixing this unblock other work?
>
> Findings premature for the current milestone are NOT suppressed — score them normally but give reduced milestone alignment points. Add `milestone_context` noting when they become relevant.
>
> For each finding, include a `recommended_action`: the single best thing to do about it (fix now, defer to M[N], run another engine, establish a program).
>
> After all findings are scored, recommend a **single next action** — the highest-value thing the user should do next. This could be: fix the top finding, run another engine for deeper analysis, establish a program for an unmonitored domain, or an architecture change. Frame it as a business outcome, not a technical task.

**No-Loss Finding Preservation (MANDATORY):**

> Every issue identified by ANY expert in Phase 1 or the cross-critic in Phase 2 MUST appear in the structured `findings` list in your output YAML — not only in the narrative briefing. Do NOT drop findings because they are low-priority, out-of-scope, or redundant with existing work. Instead, mark each finding with a `disposition`:
>
> - `work_item_now`: actionable in the current sprint — will become a WS-*.yaml
> - `deferred`: valid but not current priority — stays as FND-*.yaml, can be promoted later
> - `duplicate_of: FND-NNN`: merge with an existing finding (record reason)
> - `invalidated_by_cross_critique`: the cross-critic showed this was wrong (record reason)
> - `already_known`: matches a known failure in `system/failures.md` (record reference)
>
> If you have 22 expert issues, you must emit 22 findings entries. The founder decides what becomes a work item; the engine does not filter its own output. Invalidated findings are preserved with a disposition so future runs don't re-discover them and waste the founder's time.

Write output to `<run_workspace>/phase-3/facilitator.yaml` with `input_artifacts` listing all consumed paths. Update the manifest:

```bash
node kit/scripts/cwos-engine-manifest.js update \
  --run-id run-<id> --phase 3 --agent facilitator --status complete \
  --bytes <artifact-byte-count> --artifact-path artifacts/phase-3/facilitator.yaml \
  --subagent-type "<dispatch-origin>"
```

**Critical:** Synthesis agents read artifacts from disk, NOT from in-memory variables. This ensures reproducibility and enables retry.

---

## PHASE 4 — BACKLOG INTEGRATION

Read the facilitator's output from `<run_workspace>/phase-3/facilitator.yaml`:

### 4a. Create Findings (No-Loss)
For EVERY finding in the facilitator's structured output (not just top-tier), create a FND-NNN.yaml in `.claude/workstream/findings/`:
- Assign severity using the domain engine's `## Severity Map`
- Generate dedup_key from the finding's essence
- Check dedup window (config.yaml dedup_window_days) — if duplicate, set `disposition: duplicate_of: FND-NNN` and link
- Record the `disposition` field from the facilitator (work_item_now | deferred | duplicate_of | invalidated_by_cross_critique | already_known)

**Conservation invariant:** If Phase 1 + Phase 2 surfaced N distinct issues, Phase 4a MUST produce N findings files. A finding count drop between phases is a bug — log a warning and abort. Low-priority findings live in findings/ with `disposition: deferred`; they are not lost to the narrative briefing.

### 4b. Create Work Items
For each finding with `disposition: work_item_now`:
- Get next item ID from config.yaml
- Create `WS-NNN.yaml` in queue/
- Set source: `engine: <engine-name>, run_id: <run_id>, finding: FND-NNN`
- Link the finding: update FND-NNN.yaml with `work_item: WS-NNN`

Findings with `disposition: deferred` do NOT create work items but are tracked in `findings-index.yaml` with their priority score. The `/next` command can promote deferred findings to work items when they become relevant.

### 4c. Update System State
Apply any system model updates the facilitator identified:
- New invariants -> append to `system/invariants.md`
- New failure modes -> append to `system/failures.md`
- State updates -> update `system/state.md`

### 4d. Strategy Recommendations
Review for patterns warranting structural responses (3+ findings same root cause, domain with no engine coverage, etc.). Write to `.claude/workstream/recommendations/REC-<id>.yaml`.

### 4e. Mark Phase 4 + Stamp Manifest Counts

```bash
node kit/scripts/cwos-engine-manifest.js update --run-id run-<id> --phase 4 --phase-status complete
```

Counts (`findings_raw_count`, `findings_after_synthesis`, `work_items_to_create`) are stamped during `cwos-engine-manifest complete` in /engine Step 6 — do not stamp them mid-phase.

---

## PHASE 5 — BRIEFING

Read the domain engine's `## Briefing Template` section. Present results using that template.

**Important:** Sort findings by `priority_score` descending (highest business value first), NOT by severity. Show `milestone_context` for any findings that are premature for the current milestone. End the briefing with the recommended next action from the synthesis phase.

If any agents were skipped due to `persona_overrides` config, append to the briefing:

```
### Excluded Personas
The following personas were disabled in .cwos-config.yaml and did not participate in this run:
- [list each skipped persona name]

To re-enable, remove them from `engines.persona_overrides.<engine>.disabled` in .cwos-config.yaml.
```

After the briefing is written, mark phase 5:

```bash
node kit/scripts/cwos-engine-manifest.js update --run-id run-<id> --phase 5 --phase-status complete
```

---

## PHASE 6 — OPTIMIZATION EPILOGUE

**Reference:** `engines/standard/optimization-feedback.md` for signal types and schema.

After the briefing, evaluate whether this run produced optimization signals about the *process itself*. This phase is automatic for all agent-dispatch runs but signal generation is conditional — most runs produce zero signals.

### 6a. Check for Signal Triggers

Scan the run artifacts for these conditions:

| Condition | Signal Type | Target |
|-----------|------------|--------|
| Cross-critic recalibrated 2+ findings in same direction | `calibration_drift` | This engine |
| Cross-critic identified shared blind spots | `coverage_gap` | Each persona that missed it |
| External context was manually injected | `process_friction` | This engine's protocol |
| Run re-discovered a finding already in findings-index | `waste` | This engine's dedup logic |
| 50%+ of findings rated MEDIUM or lower | `effectiveness` (low) | This engine + protocol |
| Protocol is blind_spot, challenge, or meta-engine | Generate `protocol-feedback.yaml` | This engine |

### 6b. Generate Signals

For each triggered condition, write a signal to `.claude/workstream/optimization-index.yaml`:
- Assign next `OPT-NNN` ID from the index's `next_signal_id`
- Set `confidence: low` (single observation)
- Set `status: pending`
- Update the index summary counters

### 6c. Check for Pattern Emergence

After writing new signals, scan all `pending` signals in the index:
- Group by `target_object.id` + `signal_type`
- If 2+ signals share the same group from different `source_run` values → promote to `confirmed`
- Create a `confirmed_patterns` entry with the grouped signal IDs
- Update summary counters

### 6d. Deep Protocol Reflection (conditional)

If the current protocol is `blind_spot`, `challenge`, or `meta-engine`:
- Execute the Protocol Reflection step defined in the domain engine's `## Protocol Reflection` section (if present)
- Write `protocol-feedback.yaml` to `<run_workspace>/phase-3/`
- Extract individual signals from the protocol feedback and add to the optimization index

If the domain engine has no `## Protocol Reflection` section, skip this step.

### 6e. Mark Phase 6

```bash
node kit/scripts/cwos-engine-manifest.js update --run-id run-<id> --phase 6 \
  --phase-status <complete|skipped> --reason "<one-liner explaining outcome>"
```

For `mode=decide` baseline runs, this is typically `--phase-status skipped --reason "decide protocol — no optimization signals expected"`.

---

## BRIEFING DEFAULT TEMPLATE

If the domain engine has no `## Briefing Template`, use this default:

```
## Engine Run Complete: <engine-name>

### Run: run-NNN | Focus: [area] | Date: YYYY-MM-DD | Milestone: [current]

### Key Findings (by business value)
| # | Finding | Priority | Severity | Milestone Context |
|---|---------|----------|----------|-------------------|
| 1 | [title] | [score]/100 | [sev] | [context or "—"] |
| 2 | ... | ... | ... | ... |

### Work Items Created
| ID | Title | Priority Score | Effort | Category |
|----|-------|---------------|--------|----------|

### What Needs Your Decision
[Items requiring user input or approval]

### Recommended Next Action
[Single highest-value action — framed as a business outcome]
```
