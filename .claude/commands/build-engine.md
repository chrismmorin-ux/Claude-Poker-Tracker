---
name: build-engine
description: "Create a new engine — multi-step wizard that builds skill file, personas, and registry entry"
user-invocable: true
argument-hint: "[engine name]"
---

# /build-engine — Create a New Engine

Multi-step wizard to create a new engine. Engines are structured multi-phase processes. Choose a category to determine the engine's structure and outputs.

## Output Shape

**Engine-build arc:** `<purpose | personas | structure | scaffolded | registered>` — `<one-clause status>` (e.g., "Personas drafted; awaiting confirmation before scaffolding").

`<Delta line: what this invocation did — defined purpose, drafted N personas, scaffolded skill file, or registered in engines/registry.yaml.>`

`<Remainder: wizard checklist — Step 1 ✓ Purpose / Step 2 ✓ Personas / Step 3 ☐ Structure / etc. Highlights the active step.>`

### Why this engine?
`<Value-rationale: cite the program the engine serves, the failure-mode token motivating it, or the repo_goal it advances. If no repo-specific token applies, declare it.>`

**Do next:** Numbered options — `1. Confirm and advance to next step` / `2. Revise current step` / `3. Cancel build`.

## Steps

### Step 1: Define Purpose

If `$ARGUMENTS` provides a name, use it. Otherwise ask:

**Questions:**
- What should this engine be called? (short, kebab-case: e.g., `ux-audit`, `data-quality`)
- What does this engine detect, analyze, or produce?
- What problem does it solve that existing engines don't?

Check `.claude/workstream/engines/registry.yaml` — ensure no name collision.

### Step 1b: Select Category

**Ask:** What kind of engine is this?

| Category | Purpose | Phase Structure | Output Types |
|----------|---------|-----------------|-------------|
| **Analysis** | Find issues, assess quality, detect drift | Research → Cross-Critique → Synthesis → Backlog → Briefing | Findings, work items, reports |
| **Enhancement** | Improve quality of decisions, plans, or context | Enrichment → Synthesis → Enhancement Output → Briefing | Enhanced artifacts, reports |
| **Preparation** | Ready workspace before a change (zero impact) | Mapping → Verification → Planning → Readiness Report → Briefing | Readiness reports |
| **Briefing** | Build comprehension before action (ephemeral) | Gather → Relevance Analysis → Understanding Output | Inline briefing only |

The selected category constrains subsequent steps:
- **Enhancement:** Skip severity mapping (Step 5). Outputs default to `[enhancement, report]`. Phase template uses "Enrich" framing, not "Critique."
- **Preparation:** Force `impact: zero-impact`. Add `safety_guarantee` prompt. Outputs default to `[readiness-report, report]`. Phase template emphasizes mapping and verification. Skill file must only use Read, Glob, Grep, and read-only Bash commands.
- **Briefing:** Skip findings/work-items/severity (Steps 4-5). Output is `[understanding]` only. Phase template emphasizes narrative and context. No run log is written.

### Step 2: Define Inputs

**Ask:** What does this engine need to analyze?

Common input types:
| Input | Description |
|-------|-------------|
| `codebase` | Full codebase access |
| `system_model` | system/state.md, invariants, constraints |
| `git_history` | Recent commits and diffs |
| `git_diff` | Current unstaged/staged changes only |
| `running_app` | Access to running application (via Playwright/curl) |
| `specific_files` | Specific directories or files (specify which) |
| `external_data` | External APIs or data sources |

### Step 3: Define Personas

**Ask:** What expert perspectives should evaluate?

Present available personas from `.claude/agents/`:
```
Core personas (available):
- systems-architect
- senior-engineer  
- failure-engineer
- performance-engineer
- security-engineer
- product-ux-engineer
- roundtable-facilitator (always included for synthesis)

Domain personas (if installed):
- [list any domain personas in .claude/agents/]

Or: define a new persona inline.
```

For new personas, gather:
- Name and role description
- What they look for (their "lens")
- What context files they should read (minimum 2, must include `system/invariants.md` or `CLAUDE.md`)
- At least 3 evaluation categories with 3+ specific checks each (12+ total)
- A known blind spot (what this persona might miss)
- Output format (Key Concerns, Hidden Risks, Missing Elements, Dangerous Assumptions)

**Step 3b: Validate new personas** against `kit/templates/persona-quality-checklist.md`:
- Minimum 12 specific checks across 3+ categories
- No generic phrases ("ensure quality", "check for issues", "review code")
- CORE CONTEXT lists >= 2 files
- If validation fails: prompt for improvements before proceeding

### Step 4: Define Outputs

**Ask:** What should this engine produce? (Available outputs depend on category selected in Step 1b)

| Output | Description | Available For |
|--------|-------------|---------------|
| `finding` | Issues discovered, fed into finding pipeline | Analysis |
| `work-item` | Actionable tasks, added to workstream queue | Analysis |
| `report` | Summary document for human review | Analysis, Enhancement, Preparation |
| `fix` | Automatic code fixes applied directly | Analysis |
| `state-update` | Updates to system/state.md | Analysis, Enhancement |
| `enhancement` | Enriched artifact (plan, decision, context) | Enhancement |
| `readiness-report` | Precondition checklist, blast radius, rollback plan | Preparation |
| `understanding` | Inline briefing, ephemeral (not persisted) | Briefing |

### Step 5: Configure Severity Mapping

**Ask:** How do this engine's internal severity levels map to the standard levels?

Default mapping (can be customized):
```yaml
CRITICAL: critical
HIGH: high
MEDIUM: medium
LOW: low
```

### Step 6: Configure Chains

**Ask:** Should other engines run after this one?

- `on_finding`: engines to run when findings are produced
- `on_complete`: engines to always run after this one completes

### Step 7: Associate with Program (Optional)

**Ask:** Should this engine be tied to a governance program?

If yes:
- Select existing program from `.claude/workstream/programs/`
- Or create a new program definition

### Step 7b: Style Defaults (Optional)

**Ask:** Should this engine have default style preferences?

Show available options from `engines/styles/catalog.yaml`:

```
Style dimensions (all optional — leave blank to use system defaults):

Reasoning: [dispatch, pre-mortem, dialectical, five-whys, delphi,
            progressive-deepening, inversion, competing-hypotheses, scenario-planning]

Output:    [executive, progressive-disclosure, opinionated, options-matrix,
            narrative, risk-register]

Tone:      [co-founder, mentor, surgeon, auditor, socratic, consultant]
```

If the user selects any preferences:
- Add them to the registry entry (Step 8c) under `style_defaults`
- Add them to `.cwos-config.yaml` under `engines.styles.per_engine.<engine-name>`

If the user skips: no style defaults are set. The engine uses signal detection and catalog defaults.

**Guidance based on category:**
- Analysis engines: suggest reasoning style based on purpose (e.g., incident-response → five-whys)
- Enhancement engines: suggest output style (e.g., decision-enhance → options-matrix)
- Preparation engines: suggest tone (e.g., refactor-prep → consultant)
- Briefing engines: suggest tone (e.g., mentor for educational briefings)

### Step 8: Generate Engine

Create the following files:

**8a. Skill File** (`.claude/commands/<engine-name>.md`):

```markdown
---
name: <engine-name>
description: "<description>"
user-invocable: false
---

# <Engine Name>

<Description of what this engine does>

## PHASE 0 — SETUP

Read context files:
- system/state.md
- system/invariants.md
- [other inputs as configured]
- CLAUDE.md

Determine focus area from arguments.

## PHASE 1 — INDEPENDENT RESEARCH (PARALLEL)

Launch [N] expert agents in parallel using the Agent tool:

[For each selected persona:]
> **[Persona Name]**: Analyze [focus area] through your expert lens.
> Read your context files, then produce your structured output
> (Key Concerns, Hidden Risks, Missing Elements, Dangerous Assumptions).
> Be specific — reference file paths and line numbers.

## PHASE 2 — CROSS-CRITIQUE

With all Phase 1 outputs collected, identify:
1. What experts got WRONG
2. What they MISSED
3. Where their assumptions break

## PHASE 3 — FACILITATED SYNTHESIS

Launch the facilitator agent with all Phase 1 + Phase 2 outputs:
- Consensus findings (3+ experts agree)
- Key disagreements (with resolution or OPEN RISK)
- Ranked systemic weak points (severity x likelihood x blast radius)

## PHASE 4 — BACKLOG INTEGRATION

Process facilitator output:
- Create findings in .claude/workstream/findings/
- Auto-promote per config.yaml thresholds
- Create work items in .claude/workstream/queue/
- De-duplicate against existing items

## PHASE 5 — EXECUTIVE BRIEFING

Present results in non-technical summary:
- Top risks in plain language
- What was found and why it matters
- What actions are recommended
- What the user should approve or decide
```

**8b. New Persona Files** (if any were defined inline):
Write to `.claude/agents/<persona-name>.md` with standard format.

**8c. Registry Entry**:
Add to `.claude/workstream/engines/registry.yaml`:
```yaml
<engine-name>:
  skill_path: <path to skill file>
  category: <analysis|enhancement|preparation|briefing>
  impact: <changes-code|changes-state|zero-impact|informational>
  safety_guarantee: "<for zero-impact engines only>"
  trigger: manual
  inputs: [<selected inputs>]
  outputs: [<selected outputs>]
  chains:
    on_finding: [<chained engines>]    # analysis only
    on_complete: [<chained engines>]   # analysis only
  finding_severities:                  # analysis only
    <configured mapping>
  style_defaults:                      # optional — from Step 7b
    reasoning: "<style or omit>"
    output: "<style or omit>"
    tone: "<style or omit>"
  description: "<description>"
```

**8d. Program Definition** (if associated):
Write/update `.claude/workstream/programs/prog-<program>.yaml`

### Step 9: Confirm

```
## Engine Created: <engine-name>

Files created:
- <skill file path>
- [persona files if any]
- Registry entry added

To run: `/engine <engine-name> [focus area]`
To test: `/engine <engine-name> full` (dry run recommended)
```


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T0:envelope --tag /build-engine --payload '{"command":"/build-engine"}'`

Non-fatal. Do not gate any output on the exit status.
