---
name: engine
description: "Run a named engine — loads from registry, executes, pipes outputs to appropriate pipelines"
user-invocable: true
argument-hint: "<engine-name> [focus area] [--retry run-<id>] [--agent <name>]"
---

# /engine — Run Engine

Execute a registered engine by name. Engines are structured multi-phase processes that produce findings, enhancements, readiness reports, and briefings.

**Engine Categories:**
| Category | Purpose | Impact |
|----------|---------|--------|
| **Analysis** | Find issues, assess quality, detect drift | May change code or state |
| **Enhancement** | Improve quality of decisions, plans, context | No code changes |
| **Preparation** | Ready workspace before a change | Zero impact guaranteed |
| **Briefing** | Build comprehension before action | Ephemeral output only |

## Output Shape

**Engine-run arc:** `<dispatching | researching | synthesizing | findings-filed>` — `<one-clause status>` (e.g., "design-audit run-002, phase 4 of 6, 3 findings drafted").

`<Delta line: what this invocation did — completed phases N–M, filed F findings, generated W work items.>`

`<Remainder: per-phase progress block + findings table — Severity / Title / Linked WS — sorted severity-first. Cite run_id explicitly.>`

### Why this engine ran
`<Value-rationale: cite the program the engine serves, the cadence/protocol that triggered it (sweep / delta / challenge / blind_spot), or the captured concern that prompted it. Reference the program's contract.>`

**Do next:** Single-line action — `Run /next to compose a sprint covering the new findings` (or `Continue engine run` mid-phase).

## Steps

### 0. Read Config

Read `.cwos-config.yaml` from the repo root (if it exists). Extract:
- `engines.default_output` — output format when user doesn't specify (`briefing`, `report`, or `artifacts`)
- `engines.auto_chain` — whether to automatically run chained engines on completion
- `engines.persona_overrides` — per-engine persona disable lists (default: empty/none disabled)
- `ceremony` — if set, applies these defaults:

| Ceremony | default_output | auto_chain |
|----------|---------------|------------|
| minimal | briefing | false |
| standard | briefing | true |
| strategic | report | true |

Explicit `engines.*` values override ceremony defaults. If `.cwos-config.yaml` is missing, use `standard` defaults.

### 1. Parse Arguments
- `$ARGUMENTS` format: `<engine-name> [focus area] [--retry run-<id>] [--agent <name>] [--style <reasoning>] [--tone <tone>] [--output <output>]`
- If no engine name given, list available engines from registry
- If `--retry` is present, skip to **Step 4c (Retry Protocol)** after loading the engine
- Style flags are optional and independently set any of the three style dimensions. Missing dimensions resolve via config or signal detection in Step 2c.

### 2. Load Engine
Read `.claude/workstream/engines/registry.yaml`
Find the engine by name. If not found:
```
Engine "<name>" not found. Available engines:

Analysis:
| Engine | Description |
|--------|-------------|
| eng-engine | Multi-persona engineering roundtable |
| health-check | System health diagnosis |
| preflight | Pre-commit verification |
| [any others registered with category: analysis] |

Enhancement:
| Engine | Description |
|--------|-------------|
| [any registered with category: enhancement] |

Preparation:
| Engine | Description |
|--------|-------------|
| [any registered with category: preparation] |

Run `/engine <name>` to execute one.
```

### 2b. Resolve Engine Components

Read the engine's registry entry. Check for these optional fields:

1. **`extends`** — if present, load the base fragment from `engines/base/<extends>.md`. This provides shared context gathering instructions (e.g., read system files, git log).
2. **`procedure`** — if present, load the procedure file from `engines/procedures/<procedure>.md`. This provides the phase flow structure (e.g., agent dispatch, suite checks).
3. Load the domain engine file from `skill_path`. This provides the domain-specific content (agents, checks, severity map, etc.).

**Assembly order** (Claude reads these in sequence as unified instructions):
1. Base fragment (shared context gathering)
2. Procedure file (phase flow structure)
3. Domain engine file (domain-specific content that fills the procedure's slots)

The domain engine's named sections (e.g., `## Agents`, `## Check Suites`, `## Severity Map`) match what the procedure expects. The procedure references these sections by name.

**Backward compatibility:** If neither `extends` nor `procedure` is set in the registry entry, load ONLY the `skill_path` as a flat engine file. Every existing flat engine continues to work unchanged.

### 2b-i. Validate Domain Engine Contract

If the engine's registry entry declares a `procedure`, validate that the domain engine file contains all required sections BEFORE proceeding to execution. If no `procedure` is declared, skip this step entirely (flat engines have no contract).

**Scan the domain engine file for required section headings by procedure type:**

| Procedure | Required Sections |
|-----------|-------------------|
| `agent-dispatch` | `## Agents`, `## Synthesis`, `## Severity Map`, `## Briefing Template` |
| `suite-check` | `## Check Suites`, `## Severity Map`, `## Briefing Template` |
| `single-pass` | `## Input`, `## Refinement Rules`, `## Output` |

A section is present if the file contains the exact heading text (e.g., `## Severity Map`) on its own line.

**On validation failure — HARD FAIL:**

If any required section is missing, DO NOT proceed. Do NOT create a run workspace or increment any counters. Output:

```
Engine contract violation: [engine-name] declares procedure: [procedure-name] but is missing required sections.

Missing:
- ## [Section Name]

This engine cannot run until it satisfies the [procedure-name] contract.
To fix: add the missing sections to [skill_path].

Required sections for [procedure-name]:
[list all required sections with REQUIRED/OPTIONAL markers]
```

Stop execution. Do not continue to Step 2c or any subsequent steps.

### 2c. Resolve Engine Style

Determine the active style for this run across three independent dimensions: **reasoning**, **output**, and **tone**. Each dimension resolves independently through this cascade:

1. **CLI flags** — if `--style`, `--tone`, or `--output` were passed in Step 1, use those values (highest priority)
2. **Per-engine config** — check `.cwos-config.yaml` → `engines.styles.per_engine.<engine-name>` for dimension overrides
3. **Signal detection** — if `engines.styles.signal_detection` is not `false` in config, evaluate context signals:
   a. Read `engines/styles/signals.yaml` (from HomeBase kit, installed to repo)
   b. For each signal in priority order (lowest number = highest priority), evaluate its `detection` checks:
      - `system_context`: read `system/context.md`, match against signal's pattern
      - `git_branch`: check current branch name
      - `recent_engine`: scan `runs/` manifests for recent engine runs
      - `findings_pattern`: read `findings-index.yaml` for pattern matches
      - `failure_pattern`: read `system/failures.md` for recent entries
      - `engine_name`: match against the current engine being invoked
      - `work_item_flags`: check current sprint/item YAML for decision_flags
      - `user_intent`: match against the focus area argument
      - `run_history`: scan `runs/` manifests for this engine name
      - `queue_state`: read `queue-index.yaml` status counts
      - `invocation_context`: check which command triggered this engine
   c. A signal matches if **any** of its detection checks returns true
   d. Use the first matching signal's `recommended_style` for any dimensions not yet resolved
   e. If a signal matches, present its recommendation to the user:
      ```
      Style suggestion: [plain_language from signal]
      Use this style? (yes / no / customize)
      ```
      - **yes** — apply the signal's recommended style
      - **no** — fall through to catalog defaults
      - **customize** — ask which dimensions to change, keep the rest
   f. If `engines.styles.suppress_signals` lists this signal's ID, skip it
4. **Config defaults** — check `.cwos-config.yaml` → `engines.styles.defaults` for global defaults
5. **Catalog defaults** — use `engines/styles/catalog.yaml` dimension defaults (dispatch / executive / co-founder)

After resolution, record the final style and its source:
```yaml
style:
  reasoning: "<resolved reasoning style>"
  output: "<resolved output style>"
  tone: "<resolved tone style>"
  source: "cli" | "config-per-engine" | "signal:<signal-id>" | "config-default" | "catalog-default"
```

**Style disclosure:** Before proceeding, output a single line to the user:
```
Style: [reasoning] x [output] x [tone] — source: [source value from above]
```
If all three dimensions resolved to defaults (dispatch / executive / co-founder), show: `Style: default (dispatch x executive x co-founder)`. This line is always shown — it makes style activation visible without adding friction.

**Load style fragments:** For each non-default dimension, read the style fragment file from `engines/styles/<dimension>/<style-id>.md`. Extract `## Phase N Injection` sections.

**Compose the style overlay:** Combine all phase injections into a single overlay document:

```markdown
# Style Overlay

The following modifications adjust how you execute the phases defined above.
Apply these as ADDITIONAL instructions layered onto the procedure — do NOT
replace the procedure phases, modify how you execute within them.

## Phase 1 Modifications
[from reasoning style's Phase 1 Injection, if any]

## Phase 2 Modifications
[from reasoning style's Phase 2 Injection, if any]

## Phase 3 Modifications
[from reasoning style's Phase 3 Injection, if any]
[from output style's Phase 3 Injection, if any]
[from tone style's Phase 3 Injection, if any]

## Phase 5 Modifications (Briefing)
[from output style's Phase 5 Injection, if any]
[from tone style's Phase 5 Injection, if any]
```

**Updated assembly order** (Claude reads these in sequence):
1. Base fragment (shared context gathering)
2. Procedure file (phase flow structure)
3. Domain engine file (domain-specific content)
4. **Style overlay** (reasoning + output + tone modifications)

If all three dimensions resolved to defaults (dispatch / executive / co-founder), skip the style overlay entirely — no behavioral change.

### 2d. Resolve Finding Cap & Noise Signal

**Resolve `finding_cap`** for this run (used later in Step 5 to gate finding promotion):

1. Read the engine's registry entry `finding_cap` field. If absent, default to `10`.
2. Store as `run_finding_cap` for use in Step 5.

**Load noise signal** (used to auto-suppress low-score findings when the founder flagged the prior run as noisy):

1. Read `.claude/workstream/engine-noise-signals.yaml`. If the file is missing, treat as no active signal.
2. Find the most recent entry where `engine` matches the current engine AND `active: true`.
3. If found, record `noise_signal_active: true`, `noise_signal_triggered_by: <run-id>`, and `noise_signal_entry_index: <N>` for use in Step 5. The signal applies to **this** run only and will be consumed (cleared) after Step 5 runs.
4. If no active signal, record `noise_signal_active: false`.

No user-facing output — this is silent configuration resolution. The effects surface in Step 9's Output Summary banners when the mechanisms fire.

### 3. Pre-Flight
- Read the engine's `skill_path` from registry
- Verify all `inputs` are available (codebase, system_model, etc.)
- **Counter reconciliation:** Before using `next_run_id`, scan both `runs/run-*.yaml` (legacy flat files) and `runs/run-*/manifest.yaml` (artifact-driven runs) for max existing ID. If config counter <= max, set counter = max + 1. Then increment and use.
- Same reconciliation for `next_finding_id` (scan `findings/FIND-*.yaml`), `next_item_id` (scan `queue/WS-*.yaml`), `next_rec_id` (scan `recommendations/REC-*.yaml`), `next_enh_id` (scan `enhancements/ENH-*.yaml`), and `next_ready_id` (scan `readiness/READY-*.yaml`)
- **Persona check:** If the engine is a library engine, read its `MANIFEST.yaml` from `engines/library/<engine-id>/MANIFEST.yaml`. Extract `personas_required`. For each persona, check if `.claude/agents/<persona-name>.md` exists. If any are missing, warn the user:
  ```
  WARNING: Engine [name] expects personas [missing-list] but they are not installed.
  Engine will run with available personas. Output quality may be reduced.
  To install missing personas: re-run /adopt or trigger deferred install with /engine.
  ```
  Continue execution — do not block.

### 3d. Create Run Workspace

Create the run workspace directory structure:
1. Create `.claude/workstream/runs/run-<run_id>/`
2. Create `.claude/workstream/runs/run-<run_id>/artifacts/`
3. Compute `context_hash`: run `git rev-parse --short HEAD`
4. Write initial `.claude/workstream/runs/run-<run_id>/manifest.yaml`:
```yaml
id: "run-<run_id>"
engine: <engine-name>
category: <analysis|enhancement|preparation|briefing>
focus: "<focus area or 'full'>"
status: running
context_hash: "<git short SHA>"
style:
  reasoning: "<resolved reasoning style>"
  output: "<resolved output style>"
  tone: "<resolved tone style>"
  source: "<cli|config-per-engine|signal:<id>|config-default|catalog-default>"
started_at: "<timestamp>"
completed_at: ""
artifacts: {}
agent_matrix:
  total: 0
  complete: 0
  failed: 0
  skipped: 0
findings_count: 0
items_created: 0
recommendations_count: 0
enhancements_created: 0
readiness_reports: 0
summary: ""
```

### 3e. Check Prior Run Artifacts

Before starting a fresh run, check if the most recent run for this engine has usable artifacts:
1. Find the most recent `run-*/manifest.yaml` where `engine` matches
2. If found AND `context_hash` matches current git HEAD:
   - Check for any artifacts with `status: failed`
   - If failures exist, inform user: "Prior run run-<id> has N complete artifacts still current. Resume from failures instead of re-running everything?"
   - If user says "resume": switch to retry mode (`--retry run-<id>`)
3. If found AND `context_hash` differs: proceed with fresh run (codebase changed since last run)

### 3b. Safety Guarantee (Preparation & Briefing Engines)

If the engine's `impact` is `zero-impact` or `informational`:
- Display the engine's `safety_guarantee` to the user before execution:
  ```
  Safety: <safety_guarantee text>
  ```
- If no `safety_guarantee` is set, use the default: "This engine is read-only. It will not modify any files."

### 3c. Pre-Run Understanding (First-Time or Stale Engines)

If this is the user's **first time** running this specific engine (no prior entries in `runs/` for this engine name), or if the most recent run is **older than 30 days**:
- Run the `engine-briefing` engine to explain why this engine matters for this repo right now
- Keep the briefing to 3-4 sentences — context, not ceremony
- Skip if the user passed `--quiet` or `-q` in arguments

### 4. Execute Engine
Load and execute the engine's skill file. The skill file defines the full protocol — the structure varies by category:

**Analysis engines:** Setup → Parallel Research → Cross-Critique → Synthesis → Backlog → Briefing
**Enhancement engines:** Setup → Parallel Enrichment → Synthesis → Enhancement Output → Briefing
**Preparation engines:** Setup → Parallel Mapping → Verification → Planning → Readiness Report → Briefing
**Briefing engines:** Gather → Relevance Analysis → Understanding Output

Pass the focus area (if provided) as the engine's scope.

### 4a. Artifact Protocol

When executing an engine that dispatches agents, the engine skill file MUST follow this protocol for each agent:

1. **Before dispatch:** Create phase directory if it doesn't exist: `.claude/workstream/runs/run-<id>/artifacts/phase-<N>/`
2. **After agent returns:** Write the agent's output to `.claude/workstream/runs/run-<id>/artifacts/phase-<N>/<agent-name>.yaml` using the artifact schema:
```yaml
agent: "<agent-name>"
persona: "<persona-filename>"
engine: "<engine-name>"
run_id: "run-<id>"
phase: <N>
status: complete | failed | timeout
error: ""
retry_count: 0
started_at: "<timestamp>"
completed_at: "<timestamp>"
duration_seconds: <N>
context_hash: "<git short SHA from manifest>"
input_artifacts: []          # populated for synthesis agents only
output:
  raw_text: |
    <full agent response as markdown>
  key_concerns: []           # structured fields parsed from raw_text
  hidden_risks: []           # (field names vary by engine/persona)
  missing_elements: []
  dangerous_assumptions: []
```
3. **On agent failure:** Still write the artifact file with `status: failed` and `error:` populated. Do NOT skip creating the file — the failure record is valuable.
4. **Update manifest:** After each agent completes, add its entry to `manifest.yaml`'s `artifacts` map:
```yaml
artifacts:
  phase-1/architect:
    status: complete
    path: "artifacts/phase-1/architect.yaml"
  phase-1/senior-engineer:
    status: failed
    path: "artifacts/phase-1/senior-engineer.yaml"
    error: "empty output"
```
5. Update `agent_matrix` counts in manifest.

**Synthesis agents** (any agent that reads prior phase outputs):
- Read artifacts from disk by path, NOT from in-memory variables
- The engine skill file provides artifact file paths in the agent prompt
- After completion, the synthesis agent's artifact records `input_artifacts` listing what it consumed

**Engines without agents** (health-check, preflight, persona-validator):
- Do NOT create artifact directories
- Write only `manifest.yaml` (the run log)
- `artifacts: {}` is valid — these engines remain backward-compatible

### 4b. Persona Resolution Rule

When an engine references a persona by name (e.g., "use architect persona"):
1. Look up the persona file in `.claude/agents/` by **filename** (without extension): `{name}.md`
2. If no filename match, match by the `name` field in the persona file's YAML frontmatter
3. All engine files SHOULD reference personas by filename (e.g., `architect`, `failure-engineer`, `product-ux`)

### 4c. Retry Protocol

When `--retry run-<id>` is present in arguments:

1. Read `manifest.yaml` from the specified run directory
2. Verify the engine name matches

**If `--agent <name>` is specified** (retry one agent):
   a. Find the artifact file for that agent in the manifest's `artifacts` map
   b. If `status: complete`, confirm with user: "This artifact already exists and is complete. Re-run will overwrite it. Continue?"
   c. Re-dispatch only that agent with the same focus area and context from the original run
   d. Write new artifact file, increment `retry_count`
   e. Mark downstream artifacts stale — for each artifact in later phases, check its `input_artifacts`; if any points to the re-run agent's path, set `stale: true` and `stale_reason: "input artifact <path> was re-run"`

**If no `--agent` specified** (retry all failures):
   a. Find all artifacts with `status: failed` in the manifest
   b. Re-dispatch each failed agent
   c. Write new artifact files
   d. Mark downstream artifacts stale if any upstream changed

**After retries complete:**
- If all Phase 1 artifacts now `complete` AND Phase 2/3 artifacts are stale or missing:
  - Ask user: "All research agents now complete. Re-run synthesis (cross-critique + facilitation)?"
  - If confirmed: re-run Phase 2, then Phase 3 (reading updated artifacts from disk)
  - Then re-run Phase 5 (backlog integration) with new facilitator output
- Update manifest: `status`, `agent_matrix`, `completed_at`
- Proceed to Step 5 (Process Outputs) with the updated facilitator artifact

### 5. Process Outputs
For each output the engine produces:

### 5.0 Candidate Filtering & Cap (Analysis Engines)

Before writing any FIND-*.yaml files, collect the full set of **candidate findings** from the synthesis artifact's `output.raw_text` (and any `output.findings` structured array personas produced). Apply two filters in order — suppression first, cap second — so overflow only contains what survived suppression.

**Filter 1 — Noise suppression (one-shot):**

If `noise_signal_active` is true (from Step 2d):
1. Drop any candidate with `priority_score < 50`. The count of dropped findings is `noise_suppressed_count`.
2. After this run's Step 5 completes, write-update `engine-noise-signals.yaml`: set the consumed entry's `active: false`, `cleared_at: <timestamp>`, `cleared_by: run-<current-id>`. The signal is single-use — re-arms only if the founder flags noise again in Step 9b.

If `noise_signal_active` is false, skip this filter entirely; `noise_suppressed_count = 0`.

**Filter 2 — Brief cap:**

1. **Blindspot exemption:** Split candidates into `blindspot_candidates` (where the persona tagged the finding with `blindspot: true`) and `regular_candidates` (everything else). Blindspot findings bypass the cap and are always promoted — this preserves constitutional blind-spot protocol guarantees (design-audit precedent).
2. Sort `regular_candidates` by `priority_score` descending.
3. Take the first `run_finding_cap` entries from `regular_candidates` as `promoted_regular`. The remainder is `overflow_regular`.
4. The **promoted set** = `blindspot_candidates` ∪ `promoted_regular`. Write these to `findings/FIND-*.yaml` per the existing schema below. Apply dedup and auto-promote-to-work-item rules only to the promoted set.
5. The **overflow set** = `overflow_regular`. Write a lightweight index of overflow to `.claude/workstream/runs/run-<id>/findings-overflow.yaml`:

```yaml
engine: <engine-name>
run_id: "run-<id>"
cap: <run_finding_cap>
overflow_count: <N>
noise_suppressed_count: <N>    # 0 if no suppression fired this run
items:
  - persona: "<persona-filename>"
    severity: <severity>
    priority_score: <score>
    title: "<short title>"
    source_artifact: "artifacts/phase-<N>/<persona>.yaml"
```

Do NOT write FIND-*.yaml for overflow candidates. They remain discoverable via the agent artifacts in `runs/run-<id>/artifacts/phase-*/*.yaml` and the overflow index.

**Skip 5.0 entirely** if the engine is not `category: analysis` (enhancement, preparation, briefing engines produce no findings pipeline).

**Track these counters for Step 9 banners:**
- `briefed_count` = len(promoted set)
- `overflow_count` = len(overflow_regular)
- `noise_suppressed_count` = from Filter 1

**Findings:**
- Write to `.claude/workstream/findings/FIND-<next_finding_id>.yaml`:
```yaml
id: "FIND-NNN"
engine: <engine-name>
run_id: "run-NNN"
persona: "<persona-filename>"     # Which agent persona originated this finding
severity: <critical|high|medium|low>
priority_score: <0-100>          # Value-based score (see Priority Scoring below)
milestone_context: "<current milestone> | <note if finding is premature for current milestone>"
recommended_action: "<what to do — 'fix now', 'defer to M4', 'run ux-audit', etc.>"
status: open
title: "<finding title>"
description: "<detailed description>"
evidence:
  file: <path>
  line: <line number>
  snippet: "<relevant code>"
dedup_key: "<unique key for dedup>"
program: "<program-id if evidence.file falls within a program's scope.file_patterns, else empty>"
graduated_to: ""
created_at: "<timestamp>"
```

**Priority Scoring:** Each finding gets a `priority_score` (0-100) based on business value, not just technical severity. Score using these factors:

| Factor | Points | How to Assess |
|--------|--------|---------------|
| Launch relevance | +30 | Is this needed before launch? Would it block or embarrass a launch? |
| User impact | +20 | Does this directly affect end users? |
| Revenue impact | +20 | Does this affect money flow, payments, or conversion? |
| Milestone alignment | +15 | Is this appropriate for the current milestone? (Full points if aligned, partial if premature) |
| Dependency | +15 | Does fixing this unblock other high-value work? |

Findings premature for the current milestone still get scored — they are NOT suppressed. They receive reduced milestone alignment points and a `milestone_context` note explaining when they become relevant. The founder sees everything, ranked by value.

**Recommended action:** Each finding includes a `recommended_action` — the single best thing to do about it. This can be:
- "Fix now" (for aligned, high-priority findings)
- "Defer to M[N]" (for premature findings)
- "Run [engine-name] for deeper analysis" (when the finding suggests a domain needs investigation)
- "Establish [program-name] program" (when the finding reveals an unmonitored domain)
- **Dedup key algorithm:** Generate as lowercase kebab-case: `{engine}-{category}-{file-path}-{line-range}`
  - `{engine}`: the engine name (e.g., `eng-engine`)
  - `{category}`: the finding category (e.g., `security`, `performance`)
  - `{file-path}`: the primary file path, with `/` replaced by `-` and extension removed (e.g., `src-auth-views`)
  - `{line-range}`: the line number or range (e.g., `L42`, `L100-120`). If no specific line, use `general`
  - Example: `eng-engine-security-src-auth-views-L42`
  - Dedup keys MUST be based on the specific code location, not a semantic description. Two different issues at different lines = different keys. Same issue at same location = same key.
  - **Line tolerance:** when checking for matches, treat lines within +/- 10 as the same location
- **Dedup check:** Read `findings-index.yaml`. If a finding with same `dedup_key` exists with `created_at` within `dedup_window_days`, skip. Also check `findings/archive/` for recently archived findings within the window (scan archive only if index has no match). If `findings-index.yaml` is missing, fall back to scanning `findings/FIND-*.yaml` files, then rebuild the index.
- **Index updates are deferred — do NOT hand-patch findings-index.yaml.** Indexes are rebuilt by `cwos-reconcile.js` at the end of Step 6 (Finalize). Hand-patching produces drift; the script regenerates from source.
- Check auto-promote thresholds from `config.yaml` using dual criteria:
  - If severity is `critical` → always promote (regardless of priority_score)
  - If `priority_score >= 70` → promote (high business value regardless of severity)
  - If severity meets config threshold AND `priority_score >= 30` → promote
  - Otherwise → finding stays as finding, not promoted to work item
- **Program assignment:** Check if `evidence.file` falls within any program's `scope.file_patterns` (from `.claude/workstream/programs/prog-*.yaml`). If so, set `program` to that program's ID. If multiple programs match, use the most specific (narrowest scope).

**Work Items:**
- Write to `.claude/workstream/queue/WS-<next_item_id>.yaml`:
```yaml
id: "WS-NNN"
title: "<title>"
type: finding
status: backlog
priority_score: <RICE score>
category: <category>
program: "<program-id if files_involved fall within a program's scope.file_patterns, else empty>"
description: "<description>"
accept_criteria: "<how to verify done>"
effort: <S|M|L>
files_involved: [<paths>]
source:
  engine: <engine-name>
  finding_id: "FIND-NNN"
  run_id: "run-NNN"
  persona: "<persona-filename>"   # Which persona originated the finding
created_at: "<timestamp>"
```
- **Program assignment:** Check if any path in `files_involved` falls within a program's `scope.file_patterns` (from `.claude/workstream/programs/prog-*.yaml`). If so, set `program` to that program's ID. If multiple programs match, use the most specific (narrowest scope).
- **Index updates are deferred — do NOT hand-patch queue-index.yaml.** Indexes are rebuilt by `cwos-reconcile.js` at the end of Step 6 (Finalize).
- Use RICE scoring reference from `system/scoring.md` if available

### 5d. Strategy Recommendations

If the engine or facilitator output includes strategic proposals (new programs, new engines, new invariants, or architecture changes), write each to `.claude/workstream/recommendations/REC-<next_rec_id>.yaml`:

```yaml
id: "REC-NNN"
type: new-program | program-scope-expansion | new-engine | new-invariant | architecture-change
status: pending
title: "<short title>"
rationale: |
  <why this is needed — what pattern of findings triggered it>
proposal:
  # For new-program (v3 schema):
  program_id: "<suggested-id>"
  name: "<name>"
  contract: "<what the founder is delegating — plain language>"
  problem_classes:
    - name: "<class name>"
      description: "<what this covers>"
      examples: ["<specific failure mode>"]
      detection: "<how to detect>"
  scope:
    file_patterns: [<paths>]
  tier_triggers:
    watch: "<condition>"
    active: "<condition>"
    critical: "<condition>"
  suggested_initial_tier: watch | active  # Based on current repo state
  phase_relevance:
    foundation: <critical|high|medium|low|none>
    pre-launch: <critical|high|medium|low|none>
    launch: <critical|high|medium|low|none>
    growth: <critical|high|medium|low|none>
    maturity: <critical|high|medium|low|none>
  # For program-scope-expansion:
  target_program: "<program-id>"
  new_problem_classes:
    - name: "<class name>"
      description: "<what this covers>"
      examples: ["<specific failure mode>"]
      detection: "<how to detect>"
  new_file_patterns: [<paths>]  # Optional scope expansion
  # For new-engine:
  engine_name: "<name>"
  domain: "<what it covers>"
  suggested_personas: [<personas>]
  # For new-invariant:
  invariant_id: "INV-NNN"
  rule: "<what must always be true>"
  check: "<how to verify>"
  # For architecture-change:
  change_description: |
    <what to change and why>
  files_affected: [<paths>]
supporting_findings: ["FIND-NNN", ...]
source:
  engine: <engine-name>
  run_id: "run-NNN"
created_at: "<timestamp>"
```

**Trigger criteria** — propose a recommendation when any of these apply:
- 3+ findings share the same root cause or category → propose a **new program** to monitor that domain. The recommendation MUST include a contract explaining what the founder is delegating and why this needs permanent accountability (not just a one-time fix).
- 2+ findings from a program don't map to existing problem classes → propose **program scope expansion** with new problem classes
- A finding identifies a domain with no engine coverage → propose a **new engine**
- A finding reveals a rule that should always hold → propose a **new invariant**
- Multiple findings suggest the architecture needs a structural change → propose an **architecture change**

Do NOT auto-create programs, engines, or invariants from recommendations. They require user approval via `/workstream approve REC-NNN`.

### 5e. Enhancement Outputs (Enhancement Engines Only)

If the engine's `category` is `enhancement`, process enhancement outputs:

Write to `.claude/workstream/enhancements/ENH-<next_enh_id>.yaml`:
```yaml
id: "ENH-NNN"
engine: <engine-name>
run_id: "run-NNN"
type: enriched-plan | enriched-decision | enriched-context | enriched-other
target: "<what was enhanced — e.g., 'migration plan for auth system'>"
status: pending-review
summary: |
  <brief description of what was enriched and key additions>
enrichments:
  - category: "<e.g., risk-annotation, dependency-mapping, effort-estimate>"
    detail: |
      <the enrichment content>
source_input: "<what the user provided as input>"
personas_consulted: [<list of personas that contributed>]
created_at: "<timestamp>"
```

Index update is deferred — `cwos-reconcile.js` rebuilds `enhancements-index.yaml` at the end of Step 6.

### 5f. Readiness Report Outputs (Preparation Engines Only)

If the engine's `category` is `preparation`, process readiness outputs:

Write to `.claude/workstream/readiness/READY-<next_ready_id>.yaml`:
```yaml
id: "READY-NNN"
engine: <engine-name>
run_id: "run-NNN"
target: "<what we're preparing for — e.g., 'refactor src/auth module'>"
status: ready | blocked | needs-review
preconditions:
  - check: "<description of what was verified>"
    status: pass | fail | unknown
    detail: "<evidence or explanation>"
blast_radius:
  files_affected: [<list of files that will be touched>]
  interfaces_affected: [<list of APIs, types, or contracts that cross boundaries>]
  data_affected: [<list of data stores, tables, or caches involved>]
rollback_plan: |
  <step-by-step rollback procedure, or "N/A" if fully reversible>
migration_steps:
  - step: "<description>"
    risk: low | medium | high
    verification: "<how to verify this step worked>"
safe_stop_points:
  - "<description of a point where work can be paused safely>"
estimated_effort: S | M | L
created_at: "<timestamp>"
```

Index update is deferred — `cwos-reconcile.js` rebuilds `readiness-index.yaml` at the end of Step 6.

**Post-execution safety confirmation** for `zero-impact` engines:
```
Safety confirmed: No files were modified by this engine. All output is informational.
```

### 5g. Understanding Outputs (Briefing Engines Only)

If the engine's `category` is `briefing`, the output is **presented inline** to the user and NOT persisted to any file. Understanding outputs are ephemeral by design — they are contextual and time-sensitive. Persisting them creates stale documents that mislead.

The briefing engine's output is displayed directly in the conversation. No YAML files are written.

### 6. Finalize Run Manifest

Update `.claude/workstream/runs/run-<run_id>/manifest.yaml` (created in Step 3d):
- Set `completed_at` to current timestamp
- Set `status`:
  - `complete` — all dispatched agents succeeded, outputs processed
  - `partial` — some agents failed but synthesis completed with available data
  - `failed` — engine could not produce usable output
- Update counts: `findings_count`, `items_created`, `recommendations_count`, `enhancements_created`, `readiness_reports`
- Update `agent_matrix` with final totals
- Set `summary` with brief description of results

**Engines without agents:** Write manifest with `artifacts: {}` and `agent_matrix` all zeros. The manifest serves as the run log.

**Exception:** Briefing engines (`category: briefing`) do NOT write run manifests. Their output is ephemeral.

**Legacy compatibility:** Old runs stored as flat `run-<id>.yaml` files remain readable. New runs always use the `run-<id>/manifest.yaml` directory format.

### 6a. Reconcile Indexes (MANDATORY)

After all FIND-*.yaml, WS-*.yaml, ENH-*.yaml, READY-*.yaml, REC-*.yaml writes are complete, run:

```
node kit/scripts/cwos-reconcile.js --quiet
```

This rebuilds queue-index, findings-index, sprint-index, enhancements-index, readiness-index, and reconciles all 7 counters in config.yaml. It also runs cross-reference integrity checks. If the script reports integrity violations, STOP and surface them to the user before proceeding to Step 6b.

Do NOT hand-patch any *-index.yaml file. The reconcile script is the only writer.

### 6b. Auto Quality Scoring

After every engine run completes (status `complete` or `partial`), automatically trigger the quality-judge engine to evaluate this run's output quality.

**When to run:**
- Always run for `analysis` engines
- Always run for `enhancement` engines
- Skip for `briefing` engines (ephemeral output, nothing to evaluate)
- Skip for `preparation` engines (readiness reports aren't covered by quality-judge constitutions yet)
- Skip if the current engine IS `quality-judge` (no recursive self-evaluation)

**Execution:**
1. Load `engines/standard/quality-judge.md`
2. Pass the current `run-<id>` as the quality-judge's target run
3. quality-judge runs its full Phase 0-4 flow
4. **Silent mode:** Do not present the quality scorecard to the user. The score file is written to `docs/evolution/quality-scores/score-run-<id>.yaml` and `docs/evolution/quality-trends.yaml` is updated automatically by quality-judge's Phase 3c.

**After quality-judge completes:**
Append a single line to the engine run summary (Step 8 output):
```
Quality score: X.X/10 — saved to docs/evolution/quality-scores/score-run-<id>.yaml
```

**On quality-judge failure:** Log the failure in the run manifest's `summary` field: "Auto quality scoring failed: [error]". Do NOT abort, re-run, or surface the error prominently. Quality scoring is best-effort — the main engine run already completed successfully.

### 7. Check Optimization Signals

After the engine run and quality scoring, check `.claude/workstream/optimization-index.yaml`:
- If **confirmed patterns exist** (status: confirmed, count > 0), append to the briefing:
  ```
  Self-improvement: N confirmed optimization patterns ready to apply.
  Run `/evolve optimize` to review and apply engine/protocol improvements.
  ```
- If this run **generated new optimization signals** (from the procedure's optimization epilogue), note:
  ```
  Optimization: N new signals recorded from this run.
  ```

Also check `docs/evolution/change-impacts.yaml` for any `validation_plan` entries that target this engine:
- If a change was recently applied to this engine and a validation plan exists, compare this run's results to the expected improvement. If improved, generate an `effectiveness` signal and update the original optimization signal to `validated`.

### 8. Check Chains
Read `chains` from the engine's registry entry:
- `on_finding`: if any findings were produced, suggest running chained engines
- `on_complete`: suggest running chained engines regardless

```
Engine [name] complete. N findings, M work items created.

Chained engines available:
- [chained-engine]: [description]
Run chained engine? (yes/no)
```

### 9. Output Summary

Adapt the summary format based on the engine's `category`:

**For analysis engines:**
```
## Engine Run Complete: <engine-name>

Run ID: run-NNN
Focus: <focus or "full">
Duration: Xm
Artifacts: .claude/workstream/runs/run-NNN/

### Agent Matrix
| Phase | Agent | Status |
|-------|-------|--------|
| 1 | architect | complete |
| 1 | senior-engineer | complete |
| ... | ... | ... |

### Results
- Findings: N (critical: X, high: X, medium: X, low: X)
- Work items created: M
- Duplicates skipped: D
- Strategy recommendations: R
[Overflow banner — only if overflow_count > 0:]
- Overflow: K findings below cap stored in runs/run-NNN/findings-overflow.yaml
[Suppression banner — only if noise_suppressed_count > 0:]
- Noise suppression consumed: M findings below priority 50 dropped (signal from run-XXX cleared)

### New Work Items
| ID | Title | Priority | Category | Program |
|----|-------|----------|----------|---------|
| WS-NNN | ... | NN.N | ... | ... |

### Key Findings
[top 3 findings by severity]

### Style
Reasoning: [label] | Output: [label] | Tone: [label]
Source: [source — e.g., "Detected pre-deploy context", "CLI flags", "Config default"]

### Suggestions
(Only shown if recommendations were generated)

| # | Type | Title | Supporting Findings |
|---|------|-------|---------------------|
| REC-NNN | New Program | Error Handling Program | FIND-012, FIND-015 |

These are suggestions, not actions. Say "approve REC-NNN" to act, or "dismiss REC-NNN" to skip.
```

**For enhancement engines:**
```
## Enhancement Complete: <engine-name>

Run ID: run-NNN
Target: <what was enhanced>
Duration: Xm

### What Was Enriched
[Summary of the original input and what was added]

### Key Additions
- [Top enrichments by value — e.g., "3 risks identified", "dependency graph mapped", "effort estimated at M"]

### Enhancement Artifact
Saved to: ENH-NNN
Status: pending-review — review the enriched artifact and apply what's useful.
```

**For preparation engines:**
```
## Preparation Complete: <engine-name>

Run ID: run-NNN
Target: <what we prepared for>
Duration: Xm
Safety: No files were modified.

### Readiness Assessment
Status: <ready | blocked | needs-review>

### Precondition Checklist
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ... | pass/fail/unknown | ... |

### Blast Radius
- Files: N files affected
- Interfaces: N APIs/types cross boundaries
- Data: N stores involved

### Recommended Sequence
[Numbered steps with risk level and verification for each]

### Safe Stop Points
[Where work can be paused without leaving things broken]

Readiness report saved to: READY-NNN
```

**For briefing engines:**
No summary template — the briefing IS the output. It was already presented inline during execution.

### 9b. Finding Feedback Prompt (Analysis Engines Only)

If the engine produced findings, append a compact feedback section after the output summary:

```
### Quick Feedback (optional — improves future engine quality)

Which findings were most valuable to you?
- FIND-042: Auth token storage
- FIND-043: Missing rate limiting
- FIND-044: Stale dependency
- FIND-045: Test coverage gap

Reply naturally: "42 and 43 were useful", "all good", "none were relevant", or just move on.
```

**Rules:**
- Only show for analysis engines that produced 2+ findings
- List findings by ID and short title only (user just read the details above)
- Accept ANY natural language response — parse for finding IDs mentioned positively or negatively
- If user responds: write to `.claude/workstream/findings-feedback.yaml`
- If user ignores it (responds with unrelated work): skip silently, do not re-prompt

**Aggregate noise parsing — write a noise signal for single-cycle suppression on next run:**

Scan the response (lowercase, whitespace-collapsed) for any of these phrase markers:
- `none`, `no`, `not useful`, `noise`, `skip all`, `none useful`, `none were useful`, `none were relevant`
- `few`, `one or two`, `mostly noise`, `most were noise`, `one was useful` (single-positive implies majority-noise)
- `all noise`, `nothing useful`

If a marker is found AND the response does NOT also positively identify most findings by ID, write an aggregate noise signal to `.claude/workstream/engine-noise-signals.yaml` (create the file if missing, preserving the schema header):

```yaml
# Per-engine noise signals captured from /engine Step 9b feedback.
# One-shot: active signals apply to the very next run of that engine, then clear.
signals:
  - engine: "<engine-name>"
    triggered_at: "<timestamp>"
    triggered_by: "run-<id>"
    user_response: "<verbatim phrase the user said>"
    active: true
    cleared_at: null
    cleared_by: null
```

On the next run of the same engine, Step 2d will load this signal and Step 5.0 will drop candidate findings with `priority_score < 50`, then mark the signal `active: false`. Per-finding `signal: useful | not_useful` parsing to `findings-feedback.yaml` is unaffected — both files may be written from a single response.

If the response positively cites most finding IDs (e.g., "42, 43, and 44 were useful, 45 was not"), do NOT write an aggregate noise signal — the founder engaged per-finding, not aggregate.

**Feedback storage** — append to `.claude/workstream/findings-feedback.yaml` (create if missing):
```yaml
# Findings Feedback — user signal on finding quality
# Updated by /engine (explicit) and passively by action tracking

entries:
  - finding_id: "FIND-042"
    engine: "eng-engine"
    persona: "architect"    # Which persona originated this finding
    run_id: "run-NNN"
    style:                  # Style active during this run (enables quality comparison)
      reasoning: "dispatch"
      output: "executive"
      tone: "co-founder"
    signal: useful          # useful | not_useful | skipped
    signal_source: explicit # explicit (user said so) | inferred (action tracking)
    timestamp: "2026-04-08T..."

  - finding_id: "FIND-043"
    engine: "eng-engine"
    persona: "security-engineer"
    run_id: "run-NNN"
    signal: not_useful
    signal_source: explicit
    timestamp: "2026-04-08T..."
```

### 9c. Passive Action Tracking

In addition to explicit feedback, track inferred signals automatically. These are written to the same `findings-feedback.yaml` file with `signal_source: inferred`.

**Positive signals** (finding was useful):
- Finding is promoted to a work item (Step 5 auto-promote) → `signal: useful`
- User manually creates a work item referencing a finding → `signal: useful`
- User says "approve REC-NNN" where the recommendation cites a finding → `signal: useful`

**Negative signals** (finding was noise):
- Finding appears in 2+ consecutive runs of the same engine with no action taken → `signal: not_useful`
- User says "dismiss FIND-NNN" or "skip" during sprint execution → `signal: not_useful`

**Neutral** (no signal):
- Finding is deferred to a later milestone → no entry (deferral is not rejection)
- Finding is deduplicated → no entry (already tracked from prior run)

Passive tracking happens silently throughout the pipeline — no user interaction needed.


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T10:compose-sprint --tag /engine --payload '{"command":"/engine"}'`

Non-fatal. Do not gate any output on the exit status.
