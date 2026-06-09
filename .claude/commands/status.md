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

### 0c. Dormant-mode short-circuit (WS-321)

Determine `adoption_phase`:
- **If pre-phase bundle is present:** read `data.adoption_phase.adoption_phase` from the bundle.
- **Legacy mode (no bundle):** read `.cwos-onboarding.yaml` directly and look at the top-level `adoption_phase` field. If the field is missing or null, treat as `M1`.

If `adoption_phase` equals `M0`, the repo was scaffolded by `/genesis` and is in dormant mode (kit installed, programs inert, queue closed, awaiting intention). **Render the Dormant View below and stop** — do NOT render Steps 1–7 of the standard dashboard. Standard sections (vital signs, queue, programs, findings, sessions) are meaningless during dormant mode and rendering them framed as "missing config" reproduces the failure mode `/genesis` was designed to avoid.

**Dormant View shape:**

```
## Where you are: Dormant — kit installed, awaiting intention

CWOS infrastructure is in place but inert. No programs are active, the queue is closed, and engines won't run. This is by design — the repo will spring to life once you declare what it's for.

**Capture so far:** {N} notes · {M} file drops · {K} conversation summaries · {D} implicit decisions
{If total == 0: "_(nothing captured yet — drop a note in `notes/`, write a paragraph in `system/intention.md`, or just keep talking)_"}

**Intention:** system/intention.md is {placeholder | filled in}
{If placeholder: "_(write a paragraph in any section to start shaping the bundle /intend will propose)_"}
{If filled in: "_(non-comment content present — `/intend` will use it as the seed for the ignition bundle)_"}

**When you're ready:**
- Run `/intend` to ignite — proposes archetype, programs, invariants, and a first sprint based on what you've captured
- Or just write more in `intention.md`; I'll detect it on the next session-start and offer to ignite

Started dormant: {entered_at relative — "3 days ago", "today", etc.}
```

**Substitution rules:**
- `{N} notes`, `{M} file drops`, etc. — pull from `data.adoption_phase.capture_counts.by_tag` (keys: `note_added`, `file_dropped`, `conversation_summary`, `implicit_decision`). If any key is missing from `by_tag`, render its count as 0.
- `{D} implicit decisions` — `capture_counts.by_tag.implicit_decision || 0`.
- `total` — `capture_counts.total`.
- `placeholder | filled in` — heuristic: if `m0_dormant.intention_template_present` is true AND `m0_dormant.intention_content_hash` matches the original placeholder hash, render "placeholder". Otherwise "filled in".
- `{entered_at relative}` — humanize `m0_dormant.entered_at` ISO timestamp.

**Integrity warning:** If any of `m0_dormant.kit_files_installed`, `m0_dormant.capture_buffer_present`, or `m0_dormant.intention_template_present` is `false`, prepend a single line ABOVE the Dormant View:

```
⚠ Dormant infrastructure damaged — {comma-separated list of failed flags}. Run `/genesis --repair` (TODO Phase F) or re-run `/genesis` to restore.
```

After rendering the Dormant View, append the shadow-event envelope (Step 8 below) and stop.

### 0d. Kit Health (skipped if dormant short-circuit fired)

Run the deterministic check:

```
node kit/scripts/cwos-kit-health.js --json
```

This produces a JSON document of shape:

```json
{
  "ok": true | false,
  "degraded": true | false,
  "coverage": { "core": {"expected": N, "present": N, "missing": [...]},  ... },
  "gaps": [ {"capability": "...", "destination": "...", "reason": "missing|hardlink-broken"} ],
  "hardlinks": {"checked": N, "broken": N, "broken_paths": [...]},
  "drift": {"kit_version_installed": "X.Y.Z", "kit_version_homebase": "X.Y.Z", "version_lags": false},
  "elapsed_ms": N
}
```

Render a **Kit Health** section in the dashboard:

- Header: `### Kit Health`
- One-line summary using per-capability coverage where `expected > 0`, e.g.
  - Clean: `core 19/19 · workstream 7/7 · engines 5/5 — clean`
  - Degraded: `core 19/19 · workstream 6/7 · engines 5/5 — 1 gap`
- If `degraded`, append a one-line follow-up:
  > ⚠ Run /audit for details, /adopt --repair to fix.
- **Always** emit a one-line kit-version header (WS-404 — drift must be impossible to ignore, so it shows on every run, not only when behind). Read `drift.kit_version_installed`, `drift.kit_version_homebase`, `drift.lag_severity`:
  - If `lag_severity` is `none`: `CWOS kit: {kit_version_installed} ✓ current` (omit the arrow when installed == homebase; if `kit_version_installed` is null — pre-stamp repo — render `CWOS kit: unknown → {kit_version_homebase}` instead).
  - If `lag_severity` is `patch` / `minor` / `major`: `CWOS kit: {kit_version_installed} → {kit_version_homebase} ⚠ {lag_severity} behind — run /fleet-update to refresh.`
  - The `/fleet-update` suggestion fires for ANY non-`none` severity (a single patch or a minor+ both qualify under WS-404 AC #3).
- If `onboarding_missing` is true (WS-407 — an adopted repo whose `.cwos-onboarding.yaml` is absent), append:
  > ⚠ `.cwos-onboarding.yaml` is missing — upgrade-path tooling falls back to defaults until it's restored. Run /kit-upgrade to backfill it.

If the script is missing (older kit) or the JSON unparseable, render a single line: `Kit Health: check unavailable (kit script missing).` Do not gate the rest of the dashboard on this section.

WS-379 / `feedback_determinism_first` — script before AI; surface the gap, don't ask the founder to remember to look.

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

**Pending migrations:** {Count `.claude/workstream/queue/WS-*.yaml` files with `category: migration` AND `status: backlog`. If count > 0, render: "N migration item(s) auto-generated by cwos-migrate-watch — run `/next` to address, or `node kit/scripts/cwos-migrate-watch.js --list` to inspect." (WS-376 / FIND-251). If count is 0, omit this line entirely.}

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

If `data.deferred_scope` is non-null (WS-322 Phase C), surface a single yellow line BEFORE the ACTION REQUIRED block:

```
⚠ Deferred scope: N item(s) eligible for re-eval, M still blocked. Run /pulse to triage.
```

Substitution rules:
- `N` = `data.deferred_scope.eligible` (only render line if ≥ 1 OR `still_blocked` ≥ 1)
- `M` = `data.deferred_scope.still_blocked`
- If `eligible` is 0 and `still_blocked` is ≥ 1, soften wording: *"N deferred item(s) waiting on triggers — visible in /pulse."*
- If `eligible` is ≥ 1 the line should be prominent (eligible items are the actionable signal)

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
