---
name: status
description: "System health dashboard — vital signs, queue summary, program health, and recent sessions"
user-invocable: true
---

# /status — System Health Dashboard

Display the current health state of this project across all dimensions.

## Steps

### Pre-Phase (Deterministic Data Gathering)

Check if `.cwos/scripts/cwos-status-pre.js` exists:
- **If found:** Run `node .cwos/scripts/cwos-status-pre.js` via Bash tool
  - The script outputs a YAML context bundle to stdout (runs in <100ms)
  - If `meta.fatal: false` in output: **skip Steps 1-6 below**, use the bundle data for Step 7
  - If the script errors or `meta.fatal: true`: fall back to Steps 1-6 below
- **If not found:** Continue with Steps 1-6 below (legacy mode)

### 0b. Read Adoption Arc State

Read `.cwos-onboarding.yaml` (or `system/onboarding-state.yaml`). Extract `current_milestone`, `repo_goal`, `done_looks_like` for the current milestone, and the unmet checks for that milestone. Used by the Adoption Arc block at the top of Step 7 output.

If neither file exists: emit the fallback line (*Setup hasn't been initialized yet. Run /adopt to get started.*) in the output and continue with the rest of the dashboard.

If `repo_goal` matches the placeholder template default: declare it explicitly in the Value line rather than citing a fake goal.

### 1. Read System State [SKIPPED if pre-phase succeeded]
- Read `system/state.md` for the last-known state
- Note when it was last updated — if > 24h, flag as STALE

### 2. Check Vital Signs [SKIPPED if pre-phase succeeded]
Read the vital signs table from `system/state.md`. For each entry that has a `Check Command`:

**Placeholder guard:** If the Check Command contains angle-bracket placeholders (e.g., `<your build command>`, `<run tests>`), do NOT execute it. Mark that vital sign as `UNCONFIGURED` instead of running it. Never pass a placeholder string to Bash for execution.

For commands that are real (no placeholders):
- Run the check command
- Compare result to expected status
- Update the status (GREEN / YELLOW / RED)

If any vital sign is RED, highlight it prominently at the top of output.
If any vital signs are UNCONFIGURED, show them separately: "N vital sign(s) not yet configured — edit `system/state.md` to replace placeholder commands with real ones."

### 3. Queue Summary [SKIPPED if pre-phase succeeded]
Read `.claude/workstream/queue-index.yaml` for queue summary. If index missing, rebuild from individual `WS-*.yaml` files.
- Count items by status from the index: `backlog`, `claimed`, `in_progress`, `review`, `done`, `blocked`
- List top 3 unclaimed items sorted by `priority_score` descending (from index — no need to read full YAML)
- Flag any items that have been `in_progress` for > 48h

### 4. Program Health [SKIPPED if pre-phase succeeded]
Scan `.claude/workstream/programs/` for all `prog-*.yaml` files:
- For each program, check staleness:
  - Read `scope_paths` from the program file
  - Run `git log --oneline --since="<last_reviewed>" -- <scope_paths>` 
  - If changes found since last review → mark STALE
  - If `last_reviewed` is older than `staleness_threshold_days` → mark STALE
- Count: total programs, healthy, stale, red

### 5. Active Sessions [SKIPPED if pre-phase succeeded]
Scan `.claude/workstream/sessions/` for sessions with `status: active`:
- List each with claimed items and duration

### 6. Recent Findings [SKIPPED if pre-phase succeeded]
Scan `.claude/workstream/findings/` for findings with `status: open`:
- Count by severity (critical, high, medium, low)
- List any critical findings

### 6b. Value & Convergence Summary [SKIPPED if pre-phase succeeded]
Read `.claude/workstream/usage.yaml` (if it exists):
- Show value ledger highlights: findings caught, items completed, regressions prevented
- Show convergence trend (embedding / stable / declining / unused)
- If escalation is recommended, show the recommendation
- If convergence is declining, flag it

### 7. Output Dashboard

**Envelope shape:** the Adoption Arc block below is the BoW envelope per `docs/bow-contract.md` (Rendering Primitives §1–§5). Always emit it first, then the dashboard. Status rarely advances state, so the Delta line defaults to the diagnostic-only declaration. The dashboard `Top Priority` row already covers Next-Action (#5); no separate next-action block needed unless `ACTION REQUIRED` fires.

```
## System Health Dashboard

### Where you are: Step 1 of 5 — system files installed, calibration next
**This run:** Diagnostic-only — no state change. Read system files, ran vital sign checks, scanned programs and findings.
**To finish step 1:** system/context.md not yet captured · 1 of 3 invariants unconfirmed · 2 vital signs need real commands
**Why it matters here:** Your goal is to ship a self-serve onboarding flow that converts ≥30% of trial signups; the open RED on `system/context.md` blocks goal-weighted prioritization in /next.

Substitution rules — do these BEFORE rendering, so no angle-bracket placeholders appear in the founder-visible output:
- "Step N of 5" — N comes from `.cwos-onboarding.yaml` `current_milestone` (1–5).
- After the em-dash — a one-clause status for that step (e.g., "system files installed, calibration next").
- "To finish step N:" — list up to 3 unmet milestone checks in plain language, joined with ` · `. If none, replace this whole line with "Step N is complete — /next will promote you on next run."
- "Why it matters here:" — one sentence tying current health-drag to the captured `repo_goal`. If `repo_goal` is the placeholder fallback, replace this whole line with: *(No captured repo goal yet — re-run /adopt step 3c. Value falls back to vital-sign and finding state below.)*
- If `.cwos-onboarding.yaml` is missing entirely, replace the whole envelope with a single line: *Setup hasn't been initialized yet. Run /adopt to get started.*

Last state update: YYYY-MM-DD (Xh ago) [CURRENT | STALE]

### Vital Signs
| Area | Status | Detail |
|------|--------|--------|
| ... | GREEN/YELLOW/RED | ... |

### Queue
| Status | Count |
|--------|-------|
| Backlog | N |
| In Progress | N |
| Done (30d) | N |
| Blocked | N |

### Top Priority (unclaimed)
| # | ID | Title | Score |
|---|-----|-------|-------|
| 1 | WS-NNN | ... | NN.N |

### Programs (areas under continuous monitoring)
| Program | Tier | Health | Last Run | Status |
|---------|------|--------|----------|--------|
| ... | ... | ... | ... | GREEN/YELLOW/RED |

Run `/pulse` for the full program dashboard, or `/pulse run <program>` to refresh a stale one.

#### Unbaselined Programs (YELLOW active signal — fleet-wide)

{For each `prog-*.yaml` in `.claude/workstream/programs/` where `monitor_only` is not true AND `last_run_by_protocol.baseline.date` is null, render a YELLOW Case-B block using the program's own `capability_brief`. This is **mandatory** — silent availability is not adoption (feedback_no_silent_install_no_user_invention; ADR-028; INV-041).}

For each unbaselined program:

```
⚠ {program.name} installed but never baselined

{capability_brief.value}

Problems it catches: {capability_brief.problems_prevented[0]} • {capability_brief.problems_prevented[1]}

To activate ({capability_brief.cost.activation}): `{capability_brief.activation_command}`
```

{Sort the unbaselined-program blocks by tier (`critical` → `active` → `watch`) so the highest-stakes unactivated programs surface first. If a program has no `capability_brief` block, that's an INV-041 violation — render a fallback line "Program {id} missing capability_brief — run /audit" instead of suppressing it.}

{If no programs are unbaselined, omit this entire sub-section — every installed program has run at least once.}

### Design Maturity (4 UX surfaces) — prog-design-specific Case A

{prog-design has additional rendering on top of the fleet-wide Case B above. Read `.claude/workstream/programs/prog-design.yaml`. If `surface_scorecard` has non-null levels (Case A), render this sub-section. Otherwise it was already covered by the fleet-wide unbaselined block above — skip.}

`<composite>` <trend-arrow> — <asymmetry note if spread ≥2 levels, else omit>

- End-user: L<n> <trend> • Operator: L<n> <trend> • Builder: L<n> <trend> • AI-conv: L<n> <trend>

{Composite format: `E<n> O<n> B<n> A<n>` (never averaged — minimum across surfaces for advisory number if shown). Trend arrows: ▲ up / ▬ flat / ▼ down / • new. If any surface level is null (never audited), show "—". If MAINTENANCE DEBT asymmetry flag is present in latest synthesis, include a one-line risk callout.}

### Load-Bearing Assumptions (AS-N)
{If `.claude/workstream/meta/mda-metrics.yaml` exists, read `asn_coverage` block and summarize inline; otherwise omit this section. Also run `node kit/scripts/cwos-asn-validate.js --all > /tmp/asn.json 2>&1` and count stage-7 stale findings.}

- Coverage: <programs_with_asn_block>/<total_programs_active_or_critical> active/critical programs • <adrs_with_asn_block>/<total_adrs_impact_high> impact:high ADRs
- Lifecycle: <active_count> active • <at_risk_count> at_risk • <validated_count> validated (terminal) • <contradicted_count> contradicted (terminal)
- Stale revisit: <stale_count> AS-Ns overdue — run `/audit` to disposition

{If coverage is <100%, add a yellow signal line: "⚠ <n> capability artifacts missing AS-N blocks. Run `node kit/scripts/cwos-asn-validate.js --all` for the list."}

{If stale_count > 0, add a yellow signal line: "⚠ <n> AS-Ns overdue for revisit — run `/audit`."}

### Open Findings
- Critical: N | High: N | Medium: N | Low: N

### Active Sessions
- [session-id] — claimed: WS-NNN (Xh active)

### CWOS Value (since adoption)
| Metric | Count |
|--------|-------|
| Findings caught | N |
| Items completed | N |
| Regressions prevented | N |
| Decisions preserved | N |
| Convergence | {trend} |
{If escalation recommended:}
💡 Ready for L{N+1}: {recommendation}

### System Health
{Only rendered when optimization program tier >= watch. Omit entirely if dormant or not installed.}
{Read prog-optimization.yaml signal_health fields.}
Optimization Monitor: {indicator} {one-line status}
{indicator: green = no confirmed patterns | yellow = N confirmed patterns, run /evolve optimize | red = validation failures or regression detected}
{Example: "Optimization Monitor: green — 5 signals collected, 0 confirmed patterns"}

### Recent Activity
{Only rendered when data.recent_commands is present (ADR-020 step 2 state store). Omit if null.}
{Renders the last N commands from the typed-API read path stateStore.envelope.recent(5).}
{For each: one line — "✓ /tag  started_at → completed_at" for completed, "↻ /tag  started_at" for active/in-progress.}
{If data.recent_commands.active_count > 0, note it: "N command(s) active."}
```

If any vital sign is RED or any critical finding is open, end with:
```
⚠ ACTION REQUIRED: [describe what needs attention]
```

## Shadow-event envelope (ADR-018 step 1)

At the end of your final summary, run:

```
node kit/scripts/cwos-event.js append command_completed --track T0:envelope --tag /status --payload '{"command":"/status"}'
```

This appends a `command_completed` event to the shadow log so the
rendered event view records the invocation. Failure is non-fatal (the
CLI exits 0 on any error) — do not gate any command output on its
success.
