---
name: audit
description: "System self-audit — detect drift, staleness, invariant violations, and failure patterns"
user-invocable: true
argument-hint: "[focus: drift|invariants|programs|failures|all]"
---

# /audit — System Self-Audit

Comprehensive self-audit of the project's health across multiple dimensions. Generates findings and work items for anything that needs attention.

## Output Shape

**Audit arc:** `<scanning | findings-generated>` — `<one-clause summary>` (e.g., "All 4 focus areas scanned, 3 new findings filed").

`<Delta line: what this invocation produced — N findings filed, M work items created. If clean: "Diagnostic-only — no state change.">`

`<Remainder: findings table — Severity / Focus / Title / Linked WS / Linked invariant — sorted severity-first. Truncate to top 10 if longer; cite total.>`

### Why these findings matter
`<Value-rationale: cite the invariant or program each finding maps to, the repo_goal at risk, or the captured failure-mode token. If no real findings, cite the cleanest signal that confirms health.>`

**Do next:** Single-line action — `Run /next to compose a sprint covering the new work items` (or `No action required — system clean.` when zero findings).

## Steps

### 0. Read Config
Read `.cwos-config.yaml` from the repo root (if it exists). Extract:
- `paths.system_dir` — where system files live (default: `system`)

Use this value to resolve all `system/` paths in the steps below.

### 1. Parse Focus
- `$ARGUMENTS` can be: `drift`, `invariants`, `programs`, `failures`, `constitutional`, or `all` (default)
- If no argument, run all checks
- If argument is `constitutional`: delegate to `/engine constitutional-audit` and stop. The constitutional audit is a dedicated engine (not a subcheck of this command) that scores the repo against `system/intention.md` — principles, founder invariants, failed states, plus the 21 system invariants already covered by cwos-verify. Output is trend-tracked in `docs/evolution/compliance-trends.yaml`.

### 2. Drift Detection

Check for drift between documented state and actual state:

**System Model Drift**
- Compare `system/state.md` vital signs to actual check results
- Flag any discrepancies (documented GREEN but actually failing)
- Check `Last updated` timestamp — flag if > 48h old

**Architecture Drift**
- If `system/invariants.md` lists architectural rules, spot-check them:
  - Grep for patterns that should or shouldn't exist
  - Check module boundaries are respected
- Flag any violations as findings

**Decision Drift**
- Scan `system/decisions.md` for decisions older than 90 days
- Flag for re-evaluation (circumstances may have changed)

**Documentation Drift**
- Check that files referenced in CLAUDE.md actually exist
- Check that commands referenced in CLAUDE.md have corresponding command files

**Canonical Location Drift**
- Use the configured `system_dir` from Step 0 (default: `system`) as the canonical location
- Check for system files at legacy locations:
  - `docs/INVARIANTS.md`, `INVARIANTS.md`, `.claude/invariants.md` → should be at `{system_dir}/invariants.md`
  - `docs/CONSTRAINTS.md`, `CONSTRAINTS.md` → should be at `{system_dir}/constraints.md`
  - `docs/failures.md`, `FAILURES.md` → should be at `{system_dir}/failures.md`
  - Any `.claude/skills/` directory → should be migrated to `.claude/commands/`
- If legacy files found: create a finding (severity: medium, category: DRIFT)
- Check CLAUDE.md and `.claude/` files for references to legacy paths → flag for rewrite

### 3. Invariant Verification

Read `system/invariants.md`. For each invariant:
- If it has a `check_command`: run it, report pass/fail
- If it has a `check_pattern` (grep): run the grep, verify expectation
- If it's manual-only: note as "unverified — needs manual check"

Create findings for any invariant violations (severity: high).

### 4. Program Accountability Audit

Scan `.claude/workstream/programs/prog-*.yaml`:
For each program:

**4a. Protocol Overdue Check:**
- For each protocol in the program, check if it's active at the current tier
- For active protocols: is last run + effective cadence (cadence_days * phase_multiplier) < today?
- If overdue: create finding with severity based on how far overdue (1x = medium, 2x = high, 3x+ = critical)

**4b. Tier Trigger Evaluation:**
- Evaluate each `tier_triggers` condition against current repo state
- If a higher tier's trigger is met but the program is at a lower tier:
  - If `accountability.on_tier_change.auto_escalate: true`: escalate the tier automatically, create finding noting the change
  - Otherwise: create finding recommending escalation

**4c. Scope Drift:**
- Run `git log --oneline --since="<last_run.date>" -- <scope.file_patterns>`
- If significant changes found since last protocol run: flag as needing protocol run
- Check for new files matching `scope.file_patterns` that weren't there at last baseline

**4d. Problem Class Coverage:**
- If baseline has run: check which problem classes have NEVER produced a finding
- These are either genuinely clean or unchecked — flag for verification via challenge protocol

**4e. Stale Findings:**
- Check all findings linked to this program against `accountability.on_finding.escalation.stale_days`
- If any are past threshold: apply `escalate_priority_bump` and flag in audit output

**4f-AS. Load-Bearing Assumption Freshness Sweep (G3):**

Run the AS-N / Market Dynamics validator in sweep mode:

```
node kit/scripts/cwos-asn-validate.js --all
```

Parse the JSON output. For findings with `exit_code == 4` (stale):

- Display: `"AS-NN in <artifact> is overdue for revisit (due: YYYY-MM-DD)."`
- Offer four dispositions (founder must type one, not just hit Enter —
  defense against AS-M6, rubber-stamping risk):
  - **(a) mark at_risk** — transitions status to `at_risk`. Append to
    `.claude/workstream/meta/mda-metrics.yaml` `fires:` log.
  - **(b) refresh with new revisit date** — requires a one-sentence note
    on what evidence cleared the signal. Appends to `asn_transitions:`.
  - **(c) validate if no trigger observed** — transitions to `validated`
    (terminal). Only valid if all falsification windows have passed.
  - **(d) skip for now** — no transition; AS-N remains active and overdue.
    Will resurface next audit.

For AS-Ns already at `status: at_risk`:

- Display: `"AS-NN is at_risk since <date>."`
- Offer:
  - **(a) confirm contradicted** — transitions to `contradicted` (terminal).
    Append to `fires:` and require reason text.
  - **(b) re-activate with new evidence** — requires one-sentence note.
  - **(c) retire** — requires reason text (archived artifact / parent killed /
    risk accepted — the last requires a DEC link).
  - **(d) keep at_risk** — no transition.

Findings for unretrofitted artifacts (exit codes 1, 2, 3) are advisory
only — they surface as findings but do not prompt for disposition, since
they represent backlog already routed to prog-product-evolution via the
reconciler's Phase 2d warnings.

**4f. Scope Coverage Check:**
- Scan the repo for top-level code directories (directories containing source files)
- Collect all `scope.file_patterns` from all active programs
- For each code directory, check if at least one program's file_patterns could match files in it
- **Exclude from scanning:** `node_modules/`, `.git/`, `.claude/`, `__pycache__/`, `dist/`, `build/`, `.next/`, `venv/`, `.venv/`, `env/`, `.cwos-snapshots/`, `sim/` (sim repos), any directory in `.gitignore`
- **Exclude from flagging:** `test/`, `tests/`, `__tests__/`, `spec/`, `docs/`, `doc/`, `scripts/` (operational, not domain logic)
- For uncovered directories that contain 3+ source files:
  - Create a finding (severity: medium, category: SCOPE-GAP)
  - Include: directory path, file count, suggested program assignment (match by domain keywords — e.g., `payments/` → prog-financial, `auth/` → prog-security)
  - Finding description should explain: "This directory has [N] source files but no program monitors it. Changes here won't trigger protocol runs or health score updates."
- **Output section in audit report:**
```
### Scope Coverage
| Directory | Files | Covered By | Status |
|-----------|-------|-----------|--------|
| backend/apps/payments/ | 12 | prog-financial | ✓ |
| backend/apps/subscriptions/ | 8 | — | GAP |
| frontend/src/lib/calculators/ | 4 | — | GAP |
```

### 5. Failure Pattern Analysis

Read `system/failures.md`:
- Group failures by `root_cause_category`
- If any category has 3+ entries: create finding for "recurring failure pattern"
- Check if fixes were applied (cross-reference with queue done items)
- Flag any failures without prevention measures
- Cross-reference with `findings-index.yaml` for open findings by category

### 6. Queue Health

Read `.claude/workstream/queue-index.yaml` for queue summary (verify integrity: count entries vs glob of `queue/WS-*.yaml`). If index missing or mismatched, rebuild from files.

Check queue health from the index:
- Items `in_progress` for > 48h without update → finding
- Items `blocked` for > 7 days → finding
- Items with `priority_score` > 20 that are unclaimed → flag as urgent
- Duplicate items (similar titles in index) → flag for consolidation
- Load full details only for flagged items

### 7. Introspective Questioning (via Engine Dispatch)

If focus is `all`, run the **drift-detector** engine which dispatches 3 expert agents for introspective questioning (scale analysis, assumption testing, hostile user walkthrough, pattern detection, missing engine detection, code review embarrassments).

Do NOT duplicate the introspective questions here — the drift-detector engine handles this with proper agent dispatch.

### 8. Coverage Assessment (via Engine Dispatch)

If focus is `all`, run the **coverage-detector** engine which dispatches 3 agents to analyze:
- Tech stack vs engine/persona coverage
- Architecture drift since last coverage check
- Growth patterns vs program monitoring coverage

Flag any coverage gaps as findings. Recommend new engines, personas, or programs.

### 8b. Convergence Assessment (via Engine Dispatch)

If focus is `all`, run the **convergence** engine which analyzes:
- Usage patterns and feature engagement
- Value delivered vs friction created
- Adoption trajectory and escalation readiness
- Whether CWOS is embedding deeper or being ignored

The convergence engine updates usage.yaml telemetry and generates recommendations for improving system fit.

### 9. Generate Findings & Work Items

For all issues discovered:
- Create findings in `.claude/workstream/findings/`
- Update `findings-index.yaml` with new entries
- Auto-promote critical/high findings to work items in queue (update queue-index.yaml)
- Follow standard finding format from `/engine`
- Reconcile counters in config.yaml before creating items (scan existing files for max ID)

### 9.5. Garbage Collection

Run lightweight GC to archive stale ephemeral artifacts. Read thresholds from `config.yaml` `gc` section (use defaults if missing: findings 30d, runs 90d, sessions 30d).

**Never GC these (DURABLE tier):** `system/decisions.md`, `system/failures.md`, `system/invariants.md`, `system/constraints.md`, `programs/*.yaml`, `queue-index.yaml`, `findings-index.yaml`, `config.yaml`

#### 9.5a. Value Graduation Check (before archiving)

For each finding about to be archived, check graduation criteria:

**Rule 1: Category Pattern → failures.md**
- Group all findings (active + about-to-archive) by `{category}-{file-pattern}` where file-pattern is the directory portion of `evidence.file`
- If `gc.graduation_threshold` (default 3) or more findings share the same group:
  - Create a new entry in `system/failures.md` with the cluster's category, highest severity, and synthesized root cause
  - Mark all findings in the cluster with `graduated_to: "FAIL-NNN"` before archiving

**Rule 2: Rediscovery Pattern → invariants.md**
- For each finding about to be archived, check: does a finding with the same `dedup_key` exist in `findings/archive/` from a DIFFERENT `run_id`?
- If the same issue was found in `gc.recurrence_threshold` (default 2) or more separate runs:
  - Create a new entry in `system/invariants.md` derived from the finding (what condition must hold to prevent this?)
  - Mark findings with `graduated_to: "INV-NNN"`

**Rule 3: Area Clustering → program recommendation**
- Group findings by the top-level directory of `evidence.file`
- If 3+ findings cluster in a directory NOT covered by any existing program's `scope.file_patterns`:
  - Create a strategy recommendation (REC-NNN) of type `new-program`
  - Include: suggested contract (what the founder would be delegating), initial problem classes (derived from the clustered findings), suggested tier triggers
  - This flows into the recommendations pipeline from `/engine` Step 5d
  - The recommendation should explain WHY this domain needs permanent accountability, not just that findings exist

**Rule 4: Program problem class gap → scope expansion recommendation**
- For each active program, check if findings exist that don't map to any defined problem class
- If 2+ findings from the same program don't match existing problem classes:
  - Create REC-NNN of type `program-scope-expansion`
  - Suggest new problem classes to add to the program

Rules 1-2 auto-execute. Rules 3-4 are advisory only.

#### 9.5b. Archive Findings
- If `status: open` AND `created_at` older than `gc.finding_archive_days` AND NOT promoted → move to `findings/archive/`
- If `status: dismissed` or `status: resolved` → archive immediately
- Remove archived entries from `findings-index.yaml`

#### 9.5c. Archive Run Logs
- If `completed_at` older than `gc.run_archive_days` AND all findings from this run are resolved/archived → move to `runs/archive/`

#### 9.5d. Archive Sessions
- If `status: completed` AND older than `gc.session_archive_days` → move to `sessions/archive/`
- NEVER archive `status: active` sessions

#### 9.5e. GC Report
Add a GC section to the audit report:
```
### Garbage Collection
| Artifact | Scanned | Archived | Graduated | Retained |
|----------|---------|----------|-----------|----------|
| Findings | N | N | N | N |
| Runs | N | N | — | N |
| Sessions | N | N | — | N |
```

### 10. Output Audit Report

```
## System Audit Report

Audit date: YYYY-MM-DD
Focus: [all | specific area]

### Summary
| Area | Issues Found | Critical | High | Medium | Low |
|------|-------------|----------|------|--------|-----|
| Drift | N | ... | ... | ... | ... |
| Invariants | N | ... | ... | ... | ... |
| Programs (areas under permanent monitoring) | N | ... | ... | ... | ... |
| AS-N freshness (G3 pull) | N | ... | ... | ... | ... |
| Failures | N | ... | ... | ... | ... |
| Queue | N | ... | ... | ... | ... |
| Introspective | N | ... | ... | ... | ... |

### Critical Issues (immediate action)
[list with details]

### Work Items Created
| ID | Title | Priority | Source |
|----|-------|----------|--------|
| WS-NNN | ... | NN.N | audit/[area] |

### Recommendations
[top 3 recommendations for project health]
```


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T11:vital-signs --tag /audit --payload '{"command":"/audit"}'`

Non-fatal. Do not gate any output on the exit status.
