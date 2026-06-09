---
name: autopilot
description: "Run autonomous 'Just do it' work for hours — pick, execute, verify, repeat"
user-invocable: true
argument-hint: "<duration: 4h|8h|10h> | stop | status"
---

# /autopilot — Long-Running Autonomous Work (v2, ADR-026)

Schedule hours of autonomous work via Remote Task triggers. The cloud sessions themselves own all runtime state — the local `/autopilot` command does nothing but validate preconditions and register the trigger. Every fire writes one line to an append-only log regardless of outcome, so "what did autopilot do" is answerable from the repo alone.

**Architecture (ADR-026):**
- **Local command:** pre-flight → policy approval → register trigger → exit. No local commits. No state file written locally.
- **First remote cycle self-bootstraps** `.claude/workstream/autopilot.yaml` atomically with its cycle-1 log entry.
- **Every cycle appends to** `.claude/workstream/autopilot-cycles.jsonl` regardless of outcome (bootstrap, guard_rail_exit, work_attempted, work_completed, work_failed, teardown).
- **`scheduled_end_at`** is computed by cycle 1 as `first_cycle_at + duration_hours`. Setup delays never eat into work time.
- **Dynamic scheduling** compresses the happy path (each success schedules the next fire 10–60 min out); hourly cron is the heartbeat fallback.
- **Eligibility filter (preserved):** `status: backlog`, `effort: S`, `type: bug|finding`, no `decision_flags`, ≤2 top-level dirs, no open blockers.

---

## Output Shape

**Autopilot arc:** `<idle | scheduling | running | stopping>` — `<one-clause status>` (e.g., "Active 8h run, cycle 4 of N, 2 items completed").

`<Delta line: what this invocation did — registered trigger for Hh, reported current cycle status, or stopped active autopilot.>`

`<Remainder: cycle ledger table — Cycle / Outcome / WS-ID / Duration — sorted reverse-chronological. Highlight any guard_rail_exit or work_failed rows.>`

### Why this autopilot run?
`<Value-rationale: cite the eligible queue depth (N items match filter), the program(s) the eligible items belong to, and the repo_goal forward-progress they advance. If no eligible items: declare it before scheduling.>`

**Do next:** Numbered options — `1. Approve schedule and step away` / `2. Stop active run` / `3. Adjust duration or filter`.

---

## Step 0: Parse Arguments

Read ``:

- `stop` → jump to **Stop Flow**
- `status` → jump to **Status Flow**
- Matches `<N>h` or `<N>` (integer, 2–12 range) → parse as `duration_hours`. Out of range → show "Duration must be 2-12 hours. Example: `/autopilot 8h`"
- Empty or unrecognized → show usage:
  ```
  Usage:
    /autopilot 8h     Start 8 hours of autonomous work
    /autopilot status  Check progress of active run
    /autopilot stop    Stop the current run
  ```

---

## Step 1: Pre-flight Checks

### 1a. System Health Gate
Read `system/state.md`. If any vital sign is RED:
```
Autopilot blocked: system health is RED.
[Which vital sign failed and its value]
Fix the failing vital sign first, then retry.
```

### 1b. Origin State Check
Check whether an active autopilot run exists on origin:
```bash
git fetch --quiet origin master
git show origin/master:.claude/workstream/autopilot.yaml 2>/dev/null
```
If the file exists with `status: active` AND `last_cycle_at` within the last 2×cron-cadence (by default < 2h), block:
```
Autopilot is already running on origin.
Run: <run_id>
Last cycle: <last_cycle_at>
Use `/autopilot status` for details, or `/autopilot stop` to stop it first.
```
If the file exists with `status: active` but `last_cycle_at` is stale (≥ 2h old) OR the file has `status: completed|abandoned|error`, treat it as recoverable; continue — the new cycle will archive or overwrite during bootstrap.

### 1c. Push-Preflight
Run:
```bash
node kit/scripts/cwos-push-preflight.js --json
```
Exit code 1 → refuse to proceed:
```
Autopilot blocked: working tree or origin state is not push-clean.
[Parsed error from push-preflight output]

/autopilot does not itself commit, but a dirty tree at trigger-register
time means the trigger's cloned checkout may inherit stale context.
Clean up with git status + git commit/stash, or use --allow-paths if
the dirty file is intentionally held locally.
```

### 1d. Count Eligible Items
Read `.claude/workstream/queue-index.yaml`. Filter to items that are ALL of:
- `status: backlog`
- `effort: S`
- `type: bug` OR `type: finding`
- `decision_flags` empty/absent/`[]`
- `blocked_by` empty OR all blockers `status: done`
- `files_involved` spans ≤ 2 distinct top-level directories

If 0 eligible items:
```
Autopilot blocked: no eligible items in the queue.

Queue has <N> backlog items, but none qualify as "Just do it":
- <N> items are effort M or L
- <N> items have decision_flags
- <N> items span 3+ directories
- <N> items are type improvement (not bug/finding)
- <N> items are blocked

To add eligible work: run `/audit` to generate findings, or `/next`
interactively to handle design-first items.
```

### 1e. Estimate Throughput
At roughly one item per cycle with dynamic scheduling (10–60 min between cycles on the happy path, hourly cron on the fallback path), `<duration>h` could run anywhere from `<duration>` to `<6 × duration>` cycles — throughput depends on item complexity. Report `min(eligible_count, 6 × duration)` as an optimistic ceiling.

---

## Step 2: Policy Approval

```
## Autopilot: <duration>h of autonomous work

### How it works (ADR-026 v2)
Each cycle runs as an independent Remote Task session. The first session
bootstraps `.claude/workstream/autopilot.yaml`. Every session appends one
line to `.claude/workstream/autopilot-cycles.jsonl` regardless of
outcome. Happy-path cycles schedule the next fire 10–60 min out via
CronCreate; crashed cycles fall back to the hourly cron heartbeat.

### Eligible items right now: <N>

| # | ID | Title | Type | Score |
|---|-----|-------|------|-------|
| 1 | WS-NNN | ... | bug | NN.N |
...top 6 by priority_score desc...

### Guard rails (auto-stop triggers)
- 3 consecutive failures → stops (error_streak in autopilot.yaml)
- System health turns RED → stops
- Queue empties of eligible items → stops (teardown cycle)
- scheduled_end_at reached → stops (time_expired cycle)

### What autopilot will NOT do
- Execute "Design first" items (effort M/L, decision_flags)
- Make architectural or UX decisions
- Touch blocked items or dependency chains
- Modify files outside the item's listed scope

### Duration budget
Budget starts when cycle 1 begins work — setup time, push-landing delays,
and environment warmup DO NOT eat into your <duration>h.

Approve? (yes / no / adjust duration)
```

**User responses:**
- **yes / approve** → Step 3
- **no** → abort
- **adjust / a number** → ask for new duration, re-run Step 1

---

## Step 3: Register Remote Trigger

Generate `run_id = ap-YYYYMMDD-HHMM` (current UTC).

Use the `/schedule` skill (or `ToolSearch select:RemoteTrigger` followed by a direct `RemoteTrigger action: create` call) to register the trigger.

**Trigger config:**
- Name: `autopilot <run_id>` (run_id in the name so the founder can disable the right one later)
- Cron expression: `0 */1 * * *` (hourly heartbeat; happy-path cycles also schedule themselves)
- Environment: founder's default cloud environment
- Model: `claude-sonnet-4-6`
- Repo: `git remote get-url origin` (normalized, strip `.git`)
- Allowed tools: `Bash, Read, Write, Edit, Glob, Grep`
- Prompt: the complete text from **Scheduled Task Prompt** below, with `<<RUN_ID>>` and `<<DURATION_HOURS>>` substituted with the actual values.

After registration, capture the trigger ID from the response.

**Do NOT commit anything locally.** The redesigned command owns no local state.

---

## Step 4: Confirmation Output

```
## Autopilot Started (ADR-026 v2)

Run ID:    <run_id>
Trigger:   <trigger_id>
Duration:  <duration>h (budget starts at cycle 1)
First fire: within the next 60 minutes (hourly cron heartbeat)

<N> eligible items in queue. Happy-path cycles will self-schedule 10–60 min apart.

Guard rails active:
  3 consecutive failures → auto-stop
  System health RED → auto-stop
  Queue empty → auto-stop (teardown cycle)
  scheduled_end_at reached → auto-stop (time_expired cycle)

Observability:
  `.claude/workstream/autopilot-cycles.jsonl` — every fire writes a line
  `.claude/workstream/autopilot.yaml` — created on first cycle

Check progress:  /autopilot status
Stop early:      /autopilot stop
Manage trigger:  https://claude.ai/code/routines/<trigger_id>

You can close this session — autopilot runs independently on Anthropic's cloud.
```

---

## Stop Flow

When `` is `stop`:

### 1. Read State from Origin
```bash
git fetch --quiet origin master
git show origin/master:.claude/workstream/autopilot.yaml 2>/dev/null
```
If no file or `status` not `active`:
```
No autopilot run is active on origin master.
```
Done.

### 2. Set Stop Flag on Origin
Three paths, pick based on working-tree cleanliness:

**Path A (clean tree):** edit `.claude/workstream/autopilot.yaml` locally, set:
- `stop_requested: true`
- `stopped_at: <now ISO>`
- `stopped_by: user`

Commit + push:
```bash
git add .claude/workstream/autopilot.yaml
git commit -m "autopilot: stop requested by user (<run_id>)"
git push
```

**Path B (dirty tree, stop is urgent):** prompt founder to either stash their dirty changes OR edit the file manually on GitHub's web UI. Print the direct URL.

**Path C (cannot reach origin):** tell the founder their stop cannot propagate until origin is reachable; disable the trigger in the web UI as the fast kill switch.

### 3. Remind About Trigger
```
Autopilot stop flag set. The next scheduled cycle will exit immediately
via Phase 1 guard rail and write a `teardown` line to autopilot-cycles.jsonl.

IMPORTANT: disable the scheduled trigger to stop no-op cycles from firing:
  https://claude.ai/code/routines/<trigger_id>
```

### 4. Show Run Summary
Read `autopilot-cycles.jsonl` filtered to this `run_id`. Display:
```
## Autopilot Run Summary: <run_id>
Started: <bootstrap cycle ts>   Stopped: <stopped_at>
Cycles:  <total>  (completed: <work_completed count>, failed: <work_failed count>, guard-rail exits: <count>)

### Items completed
| ID | Title | Cycle | Ts |
| ... (from outcome=work_completed entries) |

### Items failed
| ID | Title | Reason | Cycle |
| ... (from outcome=work_failed entries) |
```

---

## Status Flow

When `` is `status`:

Read (preferring origin to catch commits from the last cycle):
```bash
git fetch --quiet origin master
git show origin/master:.claude/workstream/autopilot.yaml 2>/dev/null
```

If no file: `No autopilot run configured. Start one with: /autopilot 8h` — done.

Load cycle log via `kit/scripts/core/autopilot-log.js` helpers:
- `tailCycleLog(20)` for recent activity
- `fireCount(run_id)` for cross-checking vs Remote-Trigger run history (AS-801)
- `cyclesForRun(run_id)` for the full run

Display:
```
## Autopilot Status: <status>

Run:               <run_id>
Started:           <first_cycle_at>
Scheduled end:     <scheduled_end_at>
Trigger:           <trigger_id>

### Progress
Cycles:            <cycles_completed>
Items done:        <work_completed count in run>
Items failed:      <work_failed count in run>
Guard-rail exits:  <count>
Error streak:      <error_streak> / <max_error_streak>
Last cycle:        <last entry ts> — <outcome> (<item_id or reason>)

### Items Completed
| ID | Title | Cycle | Ts |
(from outcome=work_completed)

### Items Failed
| ID | Title | Reason | Cycle |
(from outcome=work_failed)

### Recent Cycle Log (tail 20)
| Ts | Cycle | Outcome | Detail |
|----|-------|---------|--------|
(from tailCycleLog(20))

Manage trigger: https://claude.ai/code/routines/<trigger_id>
```

---
---

## Scheduled Task Prompt

> Self-contained prompt for the Remote Task. Substitute `<<RUN_ID>>` and `<<DURATION_HOURS>>` before registering.

```text
You are a CWOS Autopilot Agent running as a scheduled Remote Task. This is a fully autonomous, non-interactive session. Do NOT ask for user input. Make all decisions based on the rules below. If unsure whether to proceed, err on the side of STOPPING SAFELY and logging a cycle-log line explaining why.

Your job: execute EXACTLY ONE cycle of the autopilot loop, then exit. One cycle means: bootstrap if needed → pick one work item → attempt it → log outcome → schedule next if appropriate → commit + push.

Run parameters (baked in by /autopilot at trigger-registration time):
  RUN_ID           = <<RUN_ID>>
  DURATION_HOURS   = <<DURATION_HOURS>>

Constants:
  STATE_FILE       = .claude/workstream/autopilot.yaml
  LOG_FILE         = .claude/workstream/autopilot-cycles.jsonl
  LOG_HELPERS      = kit/scripts/core/autopilot-log.js (require() as needed)

======================================================================
PHASE 0: ALWAYS-APPEND SETUP
======================================================================

Record the cycle-start timestamp as NOW (ISO UTC). EVERY exit path from this session MUST end by appending one line to LOG_FILE before committing + pushing. The helper is:

  const al = require('./kit/scripts/core/autopilot-log');
  al.appendCycleLog({ ts: NOW, run_id: RUN_ID, cycle: CYCLE_NUM, outcome: <...>, reason, item_id, duration_ms });

If LOG_HELPERS is missing (e.g., cloned from an old commit), append a raw JSON line to LOG_FILE manually with the documented shape.

======================================================================
PHASE 1: BOOTSTRAP VS NORMAL
======================================================================

Check whether STATE_FILE exists.

**BOOTSTRAP BRANCH (file does not exist):**
  This is cycle 1. Create STATE_FILE with:
    schema_version: 1
    status: active
    run_id: "<RUN_ID>"
    first_cycle_at: "<NOW>"
    scheduled_end_at: "<NOW + DURATION_HOURS>"
    duration_hours: <DURATION_HOURS>
    max_error_streak: 3
    cycles_completed: 0
    error_streak: 0
    stop_requested: false
  
  Set CYCLE_NUM = 1. Append cycle-log line: { ts: NOW, run_id, cycle: 1, outcome: "bootstrap" }. Proceed to PHASE 3.

**NORMAL BRANCH (file exists):**
  Read STATE_FILE. Set CYCLE_NUM = cycles_completed + 1. Proceed to PHASE 2.

======================================================================
PHASE 2: GUARD RAIL CHECK (normal branch only)
======================================================================

EXIT IMMEDIATELY (append guard_rail_exit cycle-log line, commit, push, exit) if ANY:
- status is not "active" → reason: "status is <status>, not active"
- stop_requested is true → reason: "stop requested by user"
- error_streak >= max_error_streak → reason: "error streak limit (<N>)"
- NOW >= scheduled_end_at → reason: "scheduled end time reached"; also set status=completed, stopped_by=time_expired; commit state change alongside the log line.
- system/state.md has any vital sign RED → reason: "system health RED: <which sign>"

All guards pass? Proceed to PHASE 3.

======================================================================
PHASE 3: STALE CLAIM RECOVERY
======================================================================

Read .claude/workstream/queue-index.yaml. Look for items with status=in_progress AND claimed_by starting with "autopilot-". For each, reset to status=backlog, clear claimed_by/claimed_at/started_at. Run `node kit/scripts/cwos-reconcile.js --quiet`.

======================================================================
PHASE 4: SELECT WORK
======================================================================

Filter eligible items (ALL of):
  - status: backlog
  - effort: S
  - type: bug OR finding
  - decision_flags empty/absent/[]
  - blocked_by empty OR all blockers status: done
  - files_involved spans ≤ 2 distinct top-level directories

Sort eligible by priority_score DESC. Select TOP.

If NO eligible items:
  Append cycle-log: { outcome: "teardown", reason: "queue exhausted of eligible items" }
  Update STATE_FILE: status=completed, stopped_by=queue_empty
  If a dynamic-schedule trigger was previously created, call CronDelete on this run's trigger (the hourly cron heartbeat is deliberately left running so /autopilot status still works until the founder disables it — see PHASE 7).
  Commit everything, push, exit.

======================================================================
PHASE 5: EXECUTE ONE ITEM
======================================================================

Update the item's queue YAML: status=in_progress, claimed_by=autopilot-<RUN_ID>, claimed_at=NOW, started_at=NOW.
Run `node kit/scripts/cwos-reconcile.js --quiet`.

Commit the claim (separate commit from completion; preserves audit trail):
  git add .claude/workstream/queue-index.yaml .claude/workstream/queue/<id>.yaml STATE_FILE LOG_FILE
  (STATE_FILE and LOG_FILE only if this cycle changed them)
  git commit -m "autopilot: claim <id> — <title> [<RUN_ID> c<CYCLE_NUM>]"

Execute:
  1. Read the full WS-NNN.yaml: description, accept_criteria, files_involved.
  2. Read every file in files_involved.
  3. Make the changes required by description + accept_criteria.
  4. Stay in scope: only files in files_involved or closely related in the same dirs.
  5. Do NOT enter plan mode. Do NOT ask for input. Implement directly.

Verify:
  1. Read system/state.md vital-signs commands; run the applicable ones.
  2. Validate YAML of any yaml files touched.
  3. Confirm no surprise files changed (`git status`).

VERIFY FAILED:
  Revert working changes: `git checkout -- <paths>`.
  Reset item: status=backlog, clear claimed_by/claimed_at/started_at.
  Run cwos-reconcile.
  Update STATE_FILE: error_streak++, cycles_completed=CYCLE_NUM.
  If error_streak >= max_error_streak: status=error, stopped_by=guard_rail.
  Append cycle-log: { outcome: "work_failed", reason: "<short why>", item_id, duration_ms }.
  Commit (state + log + any reverted queue yaml), push, exit.

VERIFY PASSED:
  Update item: status=done, completed_at=NOW, completion_notes="Completed by autopilot <RUN_ID> cycle <CYCLE_NUM>".
  Run cwos-reconcile.
  Update STATE_FILE: error_streak=0, cycles_completed=CYCLE_NUM.
  Append cycle-log: { outcome: "work_completed", item_id, duration_ms }.
  Continue to PHASE 6.

======================================================================
PHASE 6: DYNAMIC-SCHEDULE HOOK
======================================================================

Re-check eligible-item count (may have become empty after the item you just finished).

If eligible_count == 0:
  Append cycle-log: { outcome: "teardown", reason: "queue drained" }
  Update STATE_FILE: status=completed, stopped_by=queue_empty.
  Fall through to PHASE 7 (commit + exit). No dynamic reschedule.

If NOW >= scheduled_end_at:
  Update STATE_FILE: status=completed, stopped_by=time_expired.
  Fall through to PHASE 7. No dynamic reschedule.

Otherwise (more work + time remaining):
  Pick a delay: 15 min if queue depth >= 5 eligible items, otherwise 45 min. This is the cadence that compresses the happy path without hammering the API.
  Best-effort: call RemoteTrigger (or equivalent) to CronCreate a one-shot fire at NOW + delay for the same RUN_ID's trigger ID. If CronCreate is not available in this environment, skip — the hourly cron heartbeat still picks up the next cycle.

======================================================================
PHASE 7: COMMIT + PUSH
======================================================================

Stage everything this cycle touched:
  git add STATE_FILE LOG_FILE queue-index.yaml queue/<id>.yaml (or archive path) system/state.md <files changed during item execution>

Commit:
  git commit -m "autopilot cycle <CYCLE_NUM>: <outcome> <item_id or ''> [<RUN_ID>]"

Push. If push rejects with non-fast-forward:
  git pull --rebase
  git push

Output a brief line for Remote Task logs:
  "Autopilot c<CYCLE_NUM> <outcome> <item_id or ''> [<RUN_ID>]. error_streak=<N>. status=<status>."

Exit.
```


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T10:compose-sprint --tag /autopilot --payload '{"command":"/autopilot"}'`

Non-fatal. Do not gate any output on the exit status.
