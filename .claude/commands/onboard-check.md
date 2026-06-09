---
name: onboard-check
description: "Re-evaluate onboarding progress and get the next concrete step to advance"
user-invocable: true
---

# /onboard-check — Refresh Onboarding State

> **User-invocable refresh.** `/status` and `/session-start` surface *cached* adoption-arc state from `.cwos-onboarding.yaml`. This command re-runs the check logic, updates the cache, and emits a BoW-envelope output naming what advanced, what remains, and the single most useful next step. Plain-language milestone framing is expected in the output — the earlier "never surface milestone names" rule is retired per ADR-015.

## Steps

### 1. Read Onboarding State

Read `.cwos-onboarding.yaml`. If it doesn't exist or `m5_steady_state.status` is `complete`, return nothing — onboarding is done.

### 2. Find Current Milestone

Walk milestones in order: m1 → m2 → m3 → m4 → m5. The current milestone is the first where `status` is not `complete`.

### 3. Evaluate Checks

Run the checks for the current milestone. Each check is a simple verification:

#### M1: Core Install
- `preamble_installed`: CLAUDE.md contains `<!-- CWOS Preamble End -->`
- `commands_installed`: `.claude/commands/` contains at least `status.md`
- `system_skeleton_created`: `system/` directory exists with `state.md`
- `gitignore_allows_system`: `.gitignore` does NOT contain `system/` as an ignore pattern
- `cwos_version_written`: `.cwos-version` exists at repo root

If any M1 check fails, something went wrong with `/adopt`. Log friction and suggest re-running adoption.

#### M2: System Population
- `vital_signs_configured`: Read `system/state.md`. The vital signs table has no placeholder text like `<test command>`, `<build command>`, `UNKNOWN`, or `—` in the Command column.
- `vital_signs_passing`: Run at least one vital sign check command from `system/state.md`. If it exits 0, pass.
  - **Platform safety (win32):** Do NOT use `date -d`, `set -euo pipefail`, or `$$` for PID. Use Python for datetime operations.
- `invariants_populated`: Read `system/invariants.md`. At least 1 row in the invariants table has real content (not HTML comments or template placeholders).
- `constraints_populated`: Read `system/constraints.md`. At least 1 row in the hard constraints table has real content.
- `context_has_active_item`: Read `system/context.md`. At least 1 item exists under "Active Items" (not just the template comment).

#### M3: Workstream Active
- `queue_has_items`: `.claude/workstream/queue/` contains >= 3 `WS-*.yaml` files
- `queue_index_valid`: Count entries in `queue-index.yaml` matches glob count of `queue/WS-*.yaml` (tolerance: +/- 1)
- `programs_scope_valid`: Read at least 1 `prog-*.yaml`. Glob its `scope.file_patterns` — at least 1 pattern matches real files in the repo.

#### M4: First Engine Run
- `engine_run_completed`: `.claude/workstream/runs/` contains at least 1 `RUN-*.yaml`
- `findings_exist`: `.claude/workstream/findings/` contains at least 1 `FIND-*.yaml`
- `engine_registry_valid` **(WS-373 / INV-F2 — VISIBLE):** Read `.claude/workstream/engines/registry.yaml`. For every uncommented engine entry, verify `skill_path` points to a file that exists. If any don't, do BOTH of:
  1. Remove the phantom entry from the registry.
  2. **Surface to founder VERBATIM** (do not silently swallow):
     > "Phantom cleanup: removed N engine registry entries with missing skill files: [list of removed names]. Their capability flag has been flipped to `installed: false`. Run `/engine <real-engine>` to verify operational coverage, or `/adopt --repair` to attempt restoration."
  3. For each phantom engine, flip the matching `deferred_commands.<cap>.installed` flag in `.cwos-onboarding.yaml` to `false` (capability flag must reflect actual file presence — without this step the AI keeps dispatching against a phantom).

  Per FIND-RUN017-2 / INV-F2: if any phantoms are detected and removed, log friction AND keep the founder-facing line above visible in the M4 output. The friction-log entry alone is not sufficient observability.

### 4a. Re-validate All Capability Flags (WS-373 Defect 2 fix)

After the M4 phantom-cleanup pass, walk **every** `deferred_commands.<cap>` group in `.cwos-onboarding.yaml`. For each group whose `installed: true`:

1. Read the kit MANIFEST or the capability's expected source path (e.g. `engines/` for `engines:`, `personas/` for `personas:`).
2. Check that at least one backing file exists at the expected location.
3. If no backing file exists: flip the flag back to `installed: false` and add a one-line note to the friction log.

Surface verbatim to the founder if any flags flipped:

> "Re-validated N capability flags; flipped M back to `installed: false`: [list]. These capabilities were marked installed but their backing files are missing. Re-run `/adopt` (idempotent) to recover."

This closes the second half of the INV-F2 violation: the flag drifts true after a file gets removed downstream of adoption (e.g. manual cleanup, OneDrive sync deletion). Without this re-validation pass, the flag remains a misleading provenance signal.

#### M5: Steady State
- `all_programs_audited`: Every `prog-*.yaml` with `status: active` has `last_run.date` not null
- `session_handoff_written`: At least 1 file in `.claude/workstream/sessions/` has `status: completed` and non-empty `handoff_notes`

### 4. Update Check Results

For each check evaluated, update `.cwos-onboarding.yaml` with the current result (true/false). If all checks for a milestone pass, set `status: complete` and `completed_at` to current timestamp.

### 4b. Milestone Transition Briefing

If a milestone was just completed in Step 4 (status changed from non-complete to `complete`), run the `milestone-briefing` engine for the NEXT milestone before returning any suggestion. This gives the user context about what's coming before they see the first suggestion for the new milestone.

- Load and execute `.claude/commands/milestone-briefing.md` with the next milestone as argument
- The briefing is presented inline (ephemeral) — no files are written
- If the completed milestone is M5 (steady state), instead of skipping, show:
  ```
  You've reached steady state — onboarding is complete!
  
  One thing that's now available: `/autopilot`. When your queue has small 
  "Just do it" items (bug fixes, findings), you can schedule hours of 
  autonomous work. Run `/autopilot 8h`, approve once, and Claude works 
  through items overnight — one per hour, each verified and committed.
  ```

The briefing addresses: what just happened (momentum), what comes next (specifics), what doesn't change (stability), and that it's OK if it feels new (comfort). This understanding-first approach means users accept the onboarding process because they grasp WHY each step matters, not because they were asked nicely.

### 4c. M3 Program Introduction (runs ONCE)

If M3 was just completed (status changed to `complete` this evaluation) OR M3 is complete but `programs_introduced` is `false`:

1. Read all `prog-*.yaml` files in `.claude/workstream/programs/`
2. For each program, extract `name`, `tier`, and — if present — the full `capability_brief` block (value, problems_prevented, cost, first_output, activation_command). If absent, fall back to first sentence of `contract`.
3. Output the program introduction. Programs with `capability_brief` render their value proposition; programs without fall back to the short contract line:

```
## Your Programs Are Active

Your project now has **programs** — areas under permanent, automated monitoring.
Each one watches a specific domain so nothing drifts silently between sessions.

[For each program WITH capability_brief, render a full block:]
### [Program Name]  ([tier])

**What it does:** [capability_brief.value]

**Problems it prevents:**
- [capability_brief.problems_prevented[0]]
- [capability_brief.problems_prevented[1]]
- [capability_brief.problems_prevented[2]]
  (truncate to 3 bullets in the intro; the full list is in `docs/programs/<id>.md`)

**Cost:** [capability_brief.cost.activation] to activate. [capability_brief.cost.ongoing] to maintain.

**First output after activation:**
- [capability_brief.first_output[0]]
- [capability_brief.first_output[1]]
  (truncate to 2 bullets)

**To activate:** `[capability_brief.activation_command]`

[For each program WITHOUT capability_brief, one-liner:]
- **[Program Name]** ([tier]) — [First sentence of contract]

Programs run checks on a regular cadence. When they find something, it
becomes a work item in your queue automatically. You don't need to remember
to check these areas — the programs handle it.

Run `/pulse` anytime to see the full program dashboard.
```

4. Set `programs_introduced: true` in `.cwos-onboarding.yaml`

### 4d. Silent Scope Calibration (M3+)

Per WS-126: the founder must never be asked technical questions at M3. Scope calibration is run silently here — mismatches are captured as flags in `.cwos-onboarding.yaml` and surfaced later via `/pulse` as a plain yes/no question, not as a configuration task.

**If M3 is complete AND programs exist:**

1. Invoke the scope-check script:
   ```
   node kit/scripts/cwos-scope-check.js
   ```
   Parse the JSON output. For each program where `needs_review: true`, record the program id.

2. Update `.cwos-onboarding.yaml`:
   - `programs_scope_needs_review: [<list of program ids with match_count === 0>]` (empty list if none)
   - `programs_scope_last_checked: <timestamp>`

3. Check `domain-correctness` specifically: if the program file still contains `[CUSTOMIZE]` placeholders in `problem_classes`, set `domain_correctness_needs_customization: true` in `.cwos-onboarding.yaml`.

4. **Do not prompt the founder.** M3 advances regardless.

5. If any flags were set, `/pulse` will surface the question on its next invocation, framed in plain language ("Some programs aren't watching any files in your repo. Want me to refresh?" / "The domain-correctness program checks generic placeholders — want me to tailor it?"). The founder never sees file patterns, globs, or YAML.

### 4e. Baseline Activation Nudge (conditional — M4+)

If M4 has completed AND any installed program with `status: active` has never been baselined (`last_run_by_protocol.baseline.date` is null), surface one nudge per session. Rotate through unaudited programs so the founder sees each once, not the same one repeatedly.

**Selection:** pick the program with the highest `founder_priority` that has no baseline AND has a `capability_brief` (briefs gate the nudge — programs without briefs stay silent to avoid noise).

**Prompt:**

```
### One program is installed but hasn't run yet

**[Program Name]** — [capability_brief.value]

Activating it catches: [comma-separated first 2 items from problems_prevented]

Cost: [capability_brief.cost.activation]

Run `[capability_brief.activation_command]` when ready. This nudge skips if you run a different command next — no commitment.
```

**Rotation rules:**
- Track `last_nudged_at` per program in `.cwos-onboarding.yaml` under `program_nudges`
- Do not nudge the same program twice in a row
- If all unaudited programs have been nudged once, cycle through again (the founder may have skipped for a reason; a reminder is fair)
- Skip nudging if the founder declined this program's activation in a prior session (record `declined_at` in `.cwos-onboarding.yaml`, re-prompt once every 14 days)

### 5. Emit BoW Envelope Output

Per `docs/bow-contract.md` rendering primitives (§1–§5), render:

```
## Where you are: Step 1 of 5 — system files installed, calibration next
**This run:** Advanced 2 of 3 checks this run: vital signs captured, first invariant confirmed.
**Just advanced:** Step 1 → Step 2. See briefing below.
**To finish step 2:** system/context.md not yet captured · 1 of 3 invariants unconfirmed
**Why it matters here:** Your goal is to ship a self-serve onboarding flow that converts ≥30% of trial signups. Step 2's unmet check on context.md blocks goal-weighted prioritization in /next.

**Do next:** Run /session-start and answer the context-capture prompt.
```

Substitution rules — do these BEFORE rendering, so no angle-bracket placeholders appear in the founder-visible output:
- "Step N of 5" + status clause — N from `.cwos-onboarding.yaml` `current_milestone`; clause is a one-clause status for that step.
- "This run:" — either "Advanced N of M checks this run: [list what flipped to pass]" or "Diagnostic-only — no checks changed state since last run." (Omit the example text.)
- "Just advanced:" — include this line ONLY if Step 4 flipped a milestone. Format: `Step N → Step N+1`. Otherwise omit the line entirely.
- "To finish step N:" — up to 3 unmet checks in plain language, joined with ` · `. If none, replace with "Step N is complete — /next will promote you on next run."
- "Why it matters here:" — one sentence citing `repo_goal`. If `repo_goal` is the placeholder fallback, replace this whole line with: *(No captured repo goal yet — re-run /adopt step 3c. The suggestion below still holds regardless.)*
- "Do next:" — one concrete suggestion from the milestone's `suggestions` list whose related check is failing, in plain language.
- If `.cwos-onboarding.yaml` is missing entirely, replace the whole envelope with a single line: *Setup hasn't been initialized yet. Run /adopt to get started.*

**Rules for the Do next line:**
- Pick the first suggestion whose related check is failing
- Plain language, not YAML field names or milestone IDs
- Frame as concrete action: "Run `/session-start` and answer the context-capture prompt" — not "Want me to..."
- If the user declined this suggestion in a prior session (check session notes), skip to the next suggestion
- If NO suggestions remain (all done or declined), emit: `**Do next:** No unmet checks in this milestone. Run /onboard-check again after your next work session to advance.`

If Step 4b emitted a milestone-transition briefing, append it after the envelope block (not inside it — the briefing is a distinct piece of pedagogy).

### 6. Log Friction (if any)

If any check reveals a kit deficiency (not "not done yet" but "broken"):
- Phantom engine in registry → log to `.cwos-feedback.yaml` friction_log
- Missing command file referenced by preamble → log
- Platform-specific failure → log with platform field


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T1:capture --tag /onboard-check --payload '{"command":"/onboard-check"}'`

Non-fatal. Do not gate any output on the exit status.
