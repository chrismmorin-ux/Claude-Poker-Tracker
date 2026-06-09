---
name: session-start
description: "Begin a new work session with adaptive orientation — lean by default, full when state signals escalation"
user-invocable: true
---

# /session-start — Begin Work Session (Adaptive)

> `/session-start` is **adaptive**: it runs a lean orientation (3 file reads, 8–10 line briefing, no session YAML) by default, and escalates to full strategic orientation only when state signals something that matters — a RED critical program, an empty queue, an abandoned session, an overdue critical-tier protocol, or stale `state.md`. Invoke `/session-start full` (or say "full session") to force the full path regardless of signals.

Orient yourself to the current project state and prepare for productive work.

## Step 0: Read Config

Read `.cwos-config.yaml` from the repo root (if it exists). Extract:
- `ceremony` — determines session protocol level:
  - `minimal` → Quick Fix protocol (skip full orientation, read only state.md)
  - `standard` → Standard protocol (default — read state + recent queue)
  - `strategic` → Strategic protocol (full orientation with all system files)

If `.cwos-config.yaml` is missing, default to `standard`. The user can always override by explicitly requesting `/session-start` (strategic) or just describing work (quick fix).

## Step 0c: Dormant-mode short-circuit (WS-321 Phase B/E)

Read `.cwos-onboarding.yaml`. If top-level `adoption_phase` equals `M0`, the repo is in dormant mode. The standard escalation signals (red programs, empty queue, overdue protocols) are meaningless — programs are inert by design, the queue is closed, and there are no protocols running. Run the **dormant briefing** below and stop. If `adoption_phase` is unset or `M1`–`M5`, skip this step entirely and continue with Step 0b.

### 0c.1 Compute current intention.md content hash

Read `system/intention.md`. Strip HTML comment blocks (`<!-- ... -->`) and whitespace-only lines, trim, and compute SHA-256 of the result. Call this `current_hash`.

Read `m0_dormant.intention_content_hash` from `.cwos-onboarding.yaml`. Call this `prior_hash`.

### 0c.2 Decide what changed

Three states matter:

- **No change** (`current_hash === prior_hash`): nothing to do. Skip to 0c.4 (render briefing).
- **Hash changed AND content is non-placeholder**: founder authored real content. Emit an `intention_edit` event in 0c.3 and update the hash; the briefing in 0c.4 will surface the optional ignition nudge.
- **Hash changed BUT content is still placeholder**: founder edited template comments/examples but didn't author real content. Update the hash silently (no event, no nudge). This avoids re-firing on every session for stale-but-non-canonical edits.

**Non-placeholder heuristic** — mirrors the logic in `cwos-genesis-ignite.js` so a passing intention here means a passing precondition there:

- Extract the `## Principles` and `## Imagined Outcome` sections.
- For Principles: count bullets that are NOT `_placeholder_`, NOT italic-wrapped (`_..._`), NOT containing the word "placeholder" (case-insensitive).
- For Imagined Outcome: count paragraphs that are NOT italic-wrapped and NOT containing "placeholder".
- "Non-placeholder" = at least one Principles bullet OR a non-empty Imagined Outcome paragraph.

### 0c.3 Emit `intention_edit` event AND update hash (only when content is non-placeholder)

If 0c.2 classified as "hash changed AND content is non-placeholder", run BOTH steps:

```bash
node kit/scripts/cwos-event.js append intention_edit \
  --track T20:capture-buffer \
  --tag intention_edit \
  --payload '{"old_hash":"<prior_hash>","new_hash":"<current_hash>","changed_sections":["Imagined Outcome","Principles"]}'
```

Then patch `m0_dormant.intention_content_hash` in `.cwos-onboarding.yaml` to `current_hash` so the next session-start sees no-change state. Both steps are required; emitting the event without updating the hash means the same edit fires repeatedly, polluting the buffer.

If 0c.2 classified as "hash changed BUT content is still placeholder", patch the hash WITHOUT emitting the event.

### 0c.4 Render the lean dormant briefing

Pull capture counts directly from `.claude/workstream/events/current.jsonl` (no bundle in M0):

- `note_added` count, `file_dropped` count, `conversation_summary` count, `implicit_decision` count

Render this shape (substitute real values, no bracketed placeholders in the founder-visible output):

```
## Dormant — kit installed, awaiting intention

Capture so far: <N> notes · <M> file drops · <K> conversation summaries · <D> implicit decisions

<NUDGE_LINE>

When you're ready: /intend
```

`<NUDGE_LINE>` substitution rules — exactly one of these, picked in order:

1. **Hash just changed AND content is non-placeholder** (the founder authored real content this session or between sessions):
   > intention.md has new content. Run /intend to ignite, or keep editing.

2. **Total buffer event count == 0 AND intention.md is still placeholder** (nothing captured yet):
   > Nothing captured yet. Drop a note in notes/, write a paragraph in system/intention.md, or just keep talking.

3. **Otherwise** (capture is happening but no fresh intention edit this run):
   > Capture is active. /intend reads what's accumulated when you're ready.

The wording in option 1 — "Run /intend to ignite, or keep editing" — is load-bearing for AS-114 (the nudge must read as informational, not pressuring). Do not edit this wording without an ADR superseding ADR-047. "Keep editing" is the explicit out — it tells the founder the nudge is not a deadline.

### 0c.5 Stop

Do NOT execute Step 0b through Step 9. Specifically: do NOT run `cwos-session-recovery.js`, do NOT generate a session ID, do NOT scan programs for escalation, do NOT write a session lock file. The dormant phase deliberately doesn't produce session-history artifacts.

## Step 0d: Check Kit Health (passive)

Skipped if the Step 0c dormant short-circuit fired. Otherwise, run:

```
node kit/scripts/cwos-kit-health.js --line --quiet
```

This deterministic check (<500ms target) cross-references `kit/MANIFEST.yaml` + `.cwos-onboarding.yaml#capabilities` against on-disk file presence and Windows hardlink integrity. It is silent on the clean path and emits a single passive line on the degraded path — never blocks the session, never asks for input.

If the script's exit code is `0` (or the script is missing in older kits): no output. Continue to Step 0b.

If exit code is `1`: prepend the script's stdout (a single line beginning with `Kit health: …`) to the briefing. Place it ABOVE everything else as the first user-visible line, then continue with the rest of the session-start output. The line is informational; the founder may keep working without addressing it. WS-379 / `feedback_determinism_first`.

## Step 0b: Determine Session Path

Evaluate six escalation signals. If **any** signal fires, set `path: full` and proceed through Steps 1–9 below. If none fire, set `path: lean` and jump directly to **Step 9-lean: Lean Briefing** — skipping Steps 1–9 entirely.

**Force overrides:**
- `$ARGUMENTS` contains `full` OR `strategic` OR `--full` → `path: full` regardless of signals
- `$ARGUMENTS` contains `lean` OR `--lean` → `path: lean` regardless of signals (escape hatch)

**Signals (any true → escalate to full):**

1. **abandoned_session** — Run `node kit/scripts/cwos-session-recovery.js --auto --quiet 2>&1`. If its output mentions "recovered" one or more abandoned sessions, this signal fires. (This replaces the separate Step 2 invocation in the full path — the recovery check is done once, here.)

2. **red_program** — Scan `.claude/workstream/programs/prog-*.yaml`. If any program with `tier: critical` has `health_score <= 3`, signal fires.

3. **empty_queue** — Read `.claude/workstream/queue-index.yaml`. If `by_status.backlog == 0` (or the field is absent and the items count is 0), signal fires.

4. **overdue_critical_protocol** — For each program with `tier: critical`, check its `last_run_by_protocol` entries against each protocol's `cadence_days`. If any protocol is overdue by **≥ 2× cadence** (e.g., cadence 3 days, last run ≥ 6 days ago), signal fires.

5. **stale_state** — Check `system/state.md` file mtime. If it is more than **7 days old**, signal fires.

6. **exception_sunset** — Run `node kit/scripts/cwos-exception-sunset-check.js --no-emit 2>/dev/null`. Parse the JSON. If `exit_code >= 1` (at_risk or past) OR `transitions.length > 0`, signal fires. Reason: an active exception artifact is approaching or past its sunset_date without a `resolved_at` field, OR a cascading AS-N transition has been triggered. ADR-050's labeled-exception architecture relies on this surface (FIND-272 / WS-413, DEC-029). If `cwos-exception-sunset-check.js` is missing (older kit), the signal does not fire.

**Record the decision:**
- Track which signal(s) fired (may be multiple). The full-path briefing leads with a "Why escalated" line citing them.
- If `path: lean` and no force override was used, note that explicitly so the lean briefing's tail can offer `full session` as the upgrade.

**Important:** Do NOT run Step 1 (Generate Session ID / register lock file) on the lean path. The lean path is orientation-only and writes no state.

## Full Path — Steps 1–9

> Only execute Steps 1 through 9 if Step 0b set `path: full`. On `path: lean`, skip straight to **Step 9-lean** at the bottom of this file.

### 1. Generate Session ID
Create a session ID: `ses-YYYYMMDD-HHMM-XXXX` (date-time + 4 random hex chars)

**Register this session:**
- Create directory `.claude/workstream/.active-sessions/` if it doesn't exist
- Write a lock file: `.claude/workstream/.active-sessions/{session-id}.lock` containing the start timestamp
- Also write to `.claude/workstream/.current-session` for backward compatibility

**Check for concurrent sessions:**
- Scan `.claude/workstream/.active-sessions/` for other `.lock` files
- If other active sessions found: warn the user: "Another session is active: {session-id}. Concurrent sessions share the queue — claimed items are protected."
- This is informational only — concurrent sessions are supported

### 2. Check for Abandoned Sessions

The primary mechanism is the `SessionStart` hook in `.claude/settings.local.json`, which runs `cwos-session-recovery.js --auto --quiet` automatically on fresh Claude Code sessions. Step 0b also invoked this script to evaluate the `abandoned_session` escalation signal — if we reached here via that signal, recovery has already run and the script is a no-op on second invocation. Otherwise this step is the fallback for disabled or missed hooks.

```
node kit/scripts/cwos-session-recovery.js --auto
```

**If the script reports abandoned sessions recovered** (output contains "recovered N abandoned"):
- Surface prominently in the session briefing:
  ```
  Recovered N abandoned session(s). Handoff notes synthesized from git log + sprint index.
  Review: .claude/workstream/sessions/<ses-id>.yaml for what was captured.
  ```
- Check if the synthesized handoff references plan docs or decisions that may need follow-up (the script notes this in RECOVERY NOTES).

**If the script reports "no active sessions" or "none abandoned":** proceed silently.

Recovery is deterministic: the script scans sessions/, computes staleness against `session_abandon_timeout_hours`, synthesizes handoff from git log + sprint-index + claimed_items, sets `status: abandoned`, and removes the lock file. No Claude-side judgment required.

### 2b. Check Autopilot Activity

Read `.claude/workstream/autopilot.yaml` (skip this step if the file doesn't exist).

**If `status: active`:**
Show an inline banner at the top of the session briefing, before any other content:
```
### Autopilot Running
Run <run_id> is active — started <started_at>, ends <scheduled_end_at>.
Progress: <cycles_completed> cycles, <items_completed count> items done, <items_failed count> failed.
Error streak: <error_streak> / <max_error_streak>
Last cycle: <last_cycle_at> — <last_cycle_status> (<last_cycle_item>)

Autopilot claims items with `claimed_by: autopilot-*` — do not manually claim those items.
Run `/autopilot status` for details, `/autopilot stop` to stop.
```

**If `status: completed` or `status: stopped`** and `last_cycle_at` is within the last 24 hours:
Show in the session briefing under a summary heading:
```
### Autopilot Summary (<run_id>)
Ran for ~<duration>h | <cycles_completed> cycles | <items_completed count> items done | <items_failed count> failed
Stopped because: <stopped_by>

Items completed:
- WS-NNN — <title>
- WS-NNN — <title>
...
```

**If `status: error`:**
Show as a warning in the session briefing:
```
### Autopilot Stopped With Errors (<run_id>)
<error_streak> consecutive failures. Last failed item: <last_cycle_item>.
Review `.claude/workstream/autopilot.yaml` cycle_log for failure details.
Run `/autopilot status` for full history.
```

### 2c. Plan-Doc Integrity Check

Run the plan-scanner to catch orphan plan items and decisions before composing any sprint:

```
node kit/scripts/cwos-plan-scan.js --quiet
```

**If output contains `violation(s) found`:** surface in the session briefing:
```
Plan drift detected in docs/*-plan.md — N orphan reference(s). Run
  node kit/scripts/cwos-plan-scan.js
for details. Next /next invocation will be unreliable until resolved
(orphan plan items are invisible to sprint composition).
```

**Otherwise:** silent.

This catches the class of bug from 2026-04-20: a plan doc defining WS-X items that never got materialized as `queue/WS-*.yaml` files, or decisions never promoted to `system/decisions.md`. The scanner runs fast (<500ms) and runs on every session-start as a safety net — `cwos-reconcile.js` also runs it at sprint boundaries (Phase 2b).

### 3. Read System State
Read and internalize:
- `system/state.md` — vital signs, queue summary, program health
- `system/invariants.md` — what must always be true
- `system/decisions.md` — recent decisions (last 5)
- `system/failures.md` — recent failures (last 5)
- `system/context.md` — active business context items (if file exists)
- `CLAUDE.md` — project rules

### 3b. Read Adoption Arc State

Read `.cwos-onboarding.yaml` (or `system/onboarding-state.yaml` if that path is used in this repo). Extract:
- `current_milestone` (M1–M5) and the ordered `milestones` list
- `repo_goal` (captured at /adopt) and `done_looks_like` for the current milestone
- Per-milestone completion markers (which checks have advanced)

If neither file exists: skip this step. The adoption-arc block in Step 9 will emit the fallback line: *Setup hasn't been initialized yet. Run /adopt to get started.*

If `repo_goal` is the placeholder fallback (matches the template default), note it — the Value line in Step 9 must declare the placeholder rather than cite it as if real.

### 3c. Fleet Registry Sync

Reconcile HomeBase's `fleet/registry.yaml` entry for this repo against the declared capability state just read from `.cwos-onboarding.yaml`. The registry was written once at `/adopt` time and never updates afterwards, so repos that advance via `/discover` end up with a stale fleet entry until this step runs.

Invoke the deterministic sync script (quiet unless drift found):

```
node kit/scripts/cwos-registry-sync.js --quiet
```

The script locates HomeBase from the cwd, matches the current repo's entry by `path`, and rewrites `capabilities_enabled` + `maturity` to match the declared state. It preserves all registry comments and sibling entries; idempotent on clean state.

**If it prints a `✓ Fleet registry synced:` line**, surface that notice in the session briefing (Step 9) under the adoption-arc block — it means HomeBase's cross-repo view of this project was out-of-date before this session. Otherwise say nothing.

**If the repo isn't found in the registry** (the script reports "repo not in fleet registry"), note it once: the repo may have been moved or was adopted without fleet registration. Point the founder at `/adopt` or manual registry update. Do not attempt to auto-register.

**Skip this step** if no HomeBase root can be found walking up from cwd (solo-repo usage, not part of a fleet).

### 3d. Detect cross-session stage transition (WS-251 / ADR-035)

Re-use the `.cwos-onboarding.yaml` content read in Step 3b. Compare two fields:

- `stage` (or `declared_stage`) — current declared stage
- `last_recorded_stage` — set by `/session-end` at the prior session's close

If both are non-null AND they differ, surface a one-line prompt at the top of the Step 9 briefing (above the adoption-arc block):

```
📊 Stage changed since last session: <last_recorded_stage> → <stage>.
   Tier defaults refreshed. Run `/stage status` to see current program tiers.
```

If they match, or `last_recorded_stage` is null (first session post-WS-251 or template-default), no prompt.

**Do NOT call `cwos-stage-detect.js` here** — signal-scan latency belongs in `/audit`, which surfaces stage-mismatch as an ephemeral envelope finding (see `kit/commands/audit.md` `compose` subcommand). Step 3d catches *cross-session declaration changes only*; signal-driven escalation is `/audit`'s job.

If `.cwos-onboarding.yaml` is absent or `stage` is null (pre-ADR-035 repo / unconfigured), skip silently.

### 4. Quick Health Check
Run vital sign check commands from `system/state.md`:
- If any check fails → flag as RED
- If tests fail → report which tests

### 5. Review Queue and Active Sprint
Read `.claude/workstream/sprint-index.yaml`. If a sprint has `status: active`:
- Read the sprint file from `.claude/workstream/sprints/SPR-NNN.yaml`
- Note progress: items done vs total, next pending item
- This takes priority over the generic queue review below

Read `.claude/workstream/queue-index.yaml` for queue summary (verify integrity: count entries vs glob of `queue/WS-*.yaml`). If index missing or mismatched, rebuild from files.
- Count by status from the index
- Top 3 unclaimed by priority (from index) — only if no active sprint
- Any blocked items that might be unblockable now (load full YAML for blocked items only)

### 5a-ii. Auto-Promoted Findings Disclosure

Scan `.claude/workstream/queue/WS-*.yaml` for items where ALL of these are true:
- `type: finding`
- `status: backlog`
- `source.engine` is present (came from an engine run, not manually created)
- `created_at` is after the most recent session's `started_at` (from `.claude/workstream/sessions/`)

If any auto-promoted items are found, collect them for the session briefing (output in Step 9). If none found, skip this section entirely — no noise when nothing happened.

### 5b. Coverage Check (periodic)
If it has been > 30 days since the last coverage-detector engine run (check `.claude/workstream/runs/` for most recent coverage-detector run), recommend:
"Coverage check is overdue. Consider running `/engine coverage-detector` or `/audit` to detect blind spots."

### 5c. Convergence Check (periodic)
Read `.claude/workstream/usage.yaml`. If it exists:

**Escalation readiness:** Check `escalation_signals`. If `next_level_ready: true` and `readiness_score >= 0.6`, include in the briefing:
"CWOS is ready for L{N+1}: {recommendation}. Run `/engine convergence` for details, or re-run `/adopt --level L{N+1}` to upgrade."

**Convergence trend:** Check `convergence.trend`. If "declining", include:
"CWOS usage is declining. Consider running `/engine convergence` to identify friction points and improve fit."

**Stale evaluation:** If `escalation_signals.last_evaluated` is > 30 days ago (or empty), recommend:
"Convergence check is overdue. Consider running `/engine convergence` to evaluate system fit."

### 6. Program Accountability Check

**6-pre. Activation Check (installed-but-dormant detection)**

Before scanning individual programs, check whether any program is activated at all. This catches the adoption failure where program YAMLs are installed but `registry.yaml` shows `programs: []` or every entry has `tier: dormant`.

1. Count physically installed programs: files matching `.claude/workstream/programs/prog-*.yaml` (excluding `prog-template.yaml`).
2. Read `.claude/workstream/programs/registry.yaml`. Count entries in `programs:` where `tier` is one of `watch`, `active`, `critical`.
3. **If installed count > 0 AND active count == 0**, flag YELLOW in the session briefing (Step 9 output):

```
⚠ Program Activation Required

[N] program definitions are installed but none are active.
Programs provide AI accountability across sessions — without activation,
CWOS cannot validate or prioritize work.

To activate a program, run:
  /pulse escalate engineering watch          (code quality baseline)
  /pulse escalate domain-correctness active  (core domain logic)

Running /next while no program is active will fail the activation gate.
```

This is a **warning, not a block** — the session continues normally. The hard gate lives in `/next` Step 1d-pre.

**If at least one program is active:** proceed to 6a silently.

Scan `.claude/workstream/programs/prog-*.yaml`:

**6a. Active Programs Summary**
For each program (any status except `retired`). **Exclude programs with `monitor_only: true`** — system programs are handled separately in Step 6f.
- Read tier, health_score, last_run, findings_open, work_items_open
- Determine which protocols are active based on tier (dormant=none, watch=delta, active=delta+sweep+challenge, critical=all)
- Check which protocols are overdue (last protocol run + effective cadence < today)
- Evaluate `tier_triggers` — if conditions for a higher tier are met, flag for escalation alert
- Count work items in queue-index that have `program` matching this program's id

**6b. Escalation Alerts**
For each program where `tier_triggers` suggest the tier should be higher:
- Flag prominently: "Program '{name}' should escalate to {tier} because: {trigger condition}"

For each finding past its `accountability.on_finding.escalation.stale_days`:
- Flag prominently: "Finding {id} from {program} has been unresolved for {days} days"

**6c. Pending Recommendations**
Scan `.claude/workstream/recommendations/REC-*.yaml` for items with `status: pending`.
If any exist, note them for the briefing.

**6d. Active Context**
Read `system/context.md`. If active items exist:
- Count items by type (customer_issue, deadline, opportunity, risk, goal)
- For deadline items: calculate days remaining, flag any within 3 days
- Note which programs are referenced by context items

**6e. Compute Health Scores & Auto-Recommendations**

For each non-dormant program, compute `health_score` using the formula from `kit/templates/system/health-scoring.md`:
1. Determine `rigor_ceiling` from protocol history
2. Compute earned score from four components
3. Apply hard caps and staleness decay
4. Update program file with `health_score`, `health_ceiling`, `health_breakdown`, `health_next_action`

For each program where `health_score < 10` or `health_ceiling < target_ceiling_for_tier`:
1. Check if a `source: auto-recommendation` work item already exists in queue for this program
2. If no existing auto-recommendation:
   - Follow the priority waterfall from health-scoring.md
   - Create a work item:
     ```yaml
     title: "Program health: [specific action from waterfall]"
     type: maintenance
     status: backlog
     source: auto-recommendation
     source_program: <program-id>
     auto_expires: true
     priority_score: <computed per health-scoring.md formula>
     category: program-maintenance
     program: <program-id>
     description: |
       Auto-generated by health scoring system.
       Current health: [score]/10 (ceiling: [ceiling]/10)
       Capping factor: [ceiling_reason]
       Action: [specific command]
       Expected result: [what improves]
     effort: S
     ```
3. If the program's `accountability.on_stale.block_sprint` is true AND program is stale (any protocol overdue by 2x+ cadence):
   - Flag in session briefing: "**Sprint blocked:** [program] requires a protocol run before new work can be composed. Run `/pulse run [program-id]`."
   - `/next` should refuse to compose a sprint until the blocking program is refreshed

For programs overdue by more than 3x cadence:
- Escalate to RED alert in session briefing
- If `accountability.on_tier_change.auto_escalate: true` and a higher tier's trigger is met, auto-escalate the tier

**6f. System Program Check**
Read any programs with `monitor_only: true` (e.g., `prog-optimization.yaml`). If the program is at `watch` tier or above:
- Read `signal_health.confirmed_patterns` and `signal_health.status`
- If `confirmed_patterns > 0` OR `signal_health.status == "red"`, prepare a parenthetical for the output briefing (Step 9):
  `*(System: Optimization monitor — N confirmed patterns ready for /evolve optimize)*`
- If nothing notable (no confirmed patterns, no regression signals), omit entirely — no output.

### 7. Check Previous Session
Read the most recent session file in `.claude/workstream/sessions/`:
- Were there handoff notes?
- Were items left in progress?

### 8. Create Session File
Write `.claude/workstream/sessions/<session-id>.yaml`:
```yaml
id: <session-id>
status: active
started_at: <timestamp>
last_heartbeat: <timestamp>
claimed_items: []
files_locked: []
current_program: ""  # set when user focuses on a program via /next
handoff_notes: ""
context_notes: ""
```

### 9. Output Session Briefing

**Envelope shape:** the Adoption Arc block below is the BoW envelope per `docs/bow-contract.md` (Rendering Primitives §1–§4). Always emit it as the leading block — before System Health, queue, or programs. If the onboarding state file is missing, emit the fallback line and continue.

```
## Session Started: ses-2026-04-23-001

### Where you are: Step 1 of 5 — system files installed, calibration next
**This run:** Diagnostic-only — no state change. (Or: cite a state change if Step 3b detected one — e.g., "Confirmed 1 of 3 invariants this run.")
**To finish step 1:** system/context.md not yet captured · 1 of 3 invariants unconfirmed · 2 vital signs need real commands
**Why it matters here:** Your goal is to ship a self-serve onboarding flow that converts ≥30% of trial signups; step 2 needs context.md so /next can weight items by funnel impact.

Substitution rules — do these BEFORE rendering, so no angle-bracket placeholders appear in the founder-visible output:
- Session ID — substitute the actual session ID (e.g., `ses-2026-04-23-001`) in place of the example.
- "Step N of 5" + status clause — N comes from `.cwos-onboarding.yaml` `current_milestone`; status clause is a one-clause description of where that step stands.
- "To finish step N:" — up to 3 unmet checks for this step, joined with ` · `. If none, replace with "Step N is complete — /next will promote you on next run."
- "Why it matters here:" — one sentence citing the captured `repo_goal`. If `repo_goal` is the placeholder fallback, replace this whole line with: *(No captured repo goal yet — re-run /adopt step 3c to capture one. Value falls back to operational context.)*
- If `.cwos-onboarding.yaml` is missing entirely, replace the whole envelope with a single line: *Setup hasn't been initialized yet. Run /adopt to get started.*

### System Health
| Area | Status |
|------|--------|
| ... | GREEN/YELLOW/RED |

### Queue: N backlog | N in-progress | N blocked

### CWOS Added These Items
[Only shown if Step 5a-ii found auto-promoted items. Omit entirely if none.]

Since your last session, engine runs auto-promoted N items to your queue:
| Item | Source Engine | Urgency | Reason |
|------|-------------|---------|--------|
| [title] | eng-engine | Fix this week | [one-line: why this was promoted — e.g., "priority score 76, security concern in auth module"] |
| [title] | health-check | Worth improving | [one-line reason] |

**Defer all?** Say "defer auto-promoted" to move these to backlog without including in your next sprint. They stay in the queue — you can pick them up later.

### Top Priority
1. WS-NNN — [title] (score: NN.N)
2. WS-NNN — [title] (score: NN.N)

### Previous Session Notes
[handoff notes if any]

### Program Accountability
[If first 3 sessions after M3, OR any program is YELLOW/RED, show context line:]
> Programs are areas of your project under continuous monitoring. YELLOW = checks overdue (run `/pulse run <program>`). RED = critical findings need attention (run `/pulse <program>`).

| Program | Tier | Health | Ceiling | Status | Next Action |
|---------|------|--------|---------|--------|-------------|
| security | CRITICAL | 8/10 | 9 | GREEN | Run blind-spot to reach ceiling 9 |
| engineering | ACTIVE | 5/10 | 7 | YELLOW | Run overdue challenge protocol |
| anti-hallucination | WATCH | 0/10 | 0 | BASELINE | Run baseline to establish ceiling |

[After the table, if any programs are YELLOW or RED:]
Run `/pulse` for the full program dashboard and recommended actions.

[If Step 6f prepared a system program parenthetical, append it here:]
*(System: Optimization monitor — N confirmed patterns ready for /evolve optimize)*
[Omit entirely if nothing notable from Step 6f.]

### Escalation Alerts
[programs where tier should be higher, or findings past escalation threshold]

### Exception Sunset Health
[Only shown if exception_sunset signal fired in Step 0b, OR if any exception artifact is within 30 days of sunset. Source: `node kit/scripts/cwos-exception-sunset-check.js --no-emit` JSON output. WS-413 / FIND-272.]

- Active exceptions: N
- At-risk (≤7 days from sunset): N
- Past sunset (in 7-day grace): N
- Past sunset (RED, grace lapsed): N  ← if >0, block all non-corrective work until resolved
- Cascading transitions queued: N
- Last sunset check: [time_ago]

[If past_grace_lapsed > 0:]
**Action required:** Pick a `sunset_resolution_option` (record / retire / amend) for each lapsed exception and write `resolved_at` to the artifact. The pre-commit hook is BLOCKING commits until this is resolved.

### Active Context
| Type | Item | Urgency | Related Programs | Date |
|------|------|---------|-----------------|------|
| customer_issue | Wrong escrow allocation | high | engineering | — |
| deadline | Demo Thursday | high | ux, engineering | 3d away |
(Only shown if system/context.md has active items. These items boost related work in /next.)

### Pending Recommendations (N awaiting review)
| ID | Type | Title |
|----|------|-------|
| REC-NNN | new-program | ... |
(Only shown if pending recommendations exist. Say "approve REC-NNN" to act, "dismiss REC-NNN" to skip.)

### Project Phase: [phase] (since [date])

### Active Sprint
[Only shown if an active sprint exists]
**SPR-NNN: [goal]**
Progress: N of M items done.
Next up: WS-NNN — [title] ([mode])

Run `/next` to resume this sprint.

[If no active sprint:]
### Ready to work. Run `/next` to compose a sprint, or describe what you'd like to do.

### Engine Style Context
[Only shown if a context signal would trigger a non-default style. Evaluate signals from engines/styles/signals.yaml against current state.]
[Example outputs based on detected signals:]
- [If system/context.md has high-urgency customer_issue:] "Active incident detected — engines will suggest **root-cause analysis** mode (five-whys reasoning, surgeon tone)."
- [If approaching a deadline:] "Deadline approaching — engines will suggest **pre-mortem** mode to catch launch risks."
- [If queue is empty:] "Queue is clear — engines will suggest **scenario planning** mode for strategic exploration."
- [If no signals match:] Omit this section entirely.
[Style preferences can be set in .cwos-config.yaml under `engines.styles`, or overridden per-run with `--style`, `--tone`, `--output` flags.]
```

**Escalation disclosure (full path only):** When Step 0b set `path: full` because of one or more signals, lead the briefing with a one-line "Why escalated" banner before the Adoption Arc block:
```
Escalated to full orientation — red_program: kit-quality health 2/10.
```
Substitute the real signal names and a short reason per signal. Examples:
- `Escalated to full orientation — red_program: kit-quality health 2/10.`
- `Escalated to full orientation — abandoned_session: 1 session recovered from prior run.`
- `Escalated to full orientation — stale_state, empty_queue: state.md is 9 days old; backlog is empty.`

Skip the banner if `path: full` was set via the explicit `full` argument (user chose full; no signal to cite).

---

## Lean Path — Step 9-lean: Lean Briefing

> Only render this if Step 0b set `path: lean`. Steps 1–9 above are skipped entirely.

**What the lean path has already done:**
- Read `.cwos-config.yaml` (Step 0)
- Ran `cwos-session-recovery.js` during signal evaluation (Step 0b, no recovery needed — otherwise `path` would be `full`)

**What the lean path reads now (≤3 files):**
- `system/state.md` — vital signs + project phase
- `.claude/workstream/sprint-index.yaml` — is there an active sprint?
- `.claude/workstream/queue-index.yaml` — top 3 unclaimed by `priority_score`

**What the lean path does NOT do:**
- Does NOT generate a session ID or write a lock file
- Does NOT create a session YAML
- Does NOT invoke the plan-scanner, fleet-registry-sync, or health-check scripts
- Does NOT scan programs, autopilot state, or recommendations
- Does NOT read previous session handoff notes

(If substantive work follows, the preamble's Standard Mode dispatcher will handle session tracking when Claude starts editing files.)

**Lean briefing template (8–10 lines):**

```
## Session Open (lean)

**Phase:** Implementation — shipping the trial onboarding flow
**Vitals:** Build GREEN · Tests GREEN · Hardlinks OK · Queue healthy

[If an active sprint exists — substitute real values:]
**Active sprint:** SPR-066 — Founder-surface polish. Progress: 2 of 3 done. Next: WS-150 — Replace schema-jargon (execute).
Run `/next` to resume.

[If no active sprint but backlog populated — substitute real values:]
**Top 3 unclaimed:**
1. WS-130 — Phase 3: Component-vs-goal alignment check (score 65)
2. WS-090 — Fleet-health meta-engine run (score 64)
3. WS-091 — Program-integrity meta-engine run (score 64)
Run `/next` to compose a sprint.

No escalation signals — say "full session" for deep context (programs, recommendations, history).
```

**Rules for the lean briefing:**
- Never exceed 10 lines of rendered output.
- Never show YAML paths, milestone names, or counter values.
- If the top-3 list is shown, format as single-line items — no sub-bullets.
- The tail line ("No escalation signals — say 'full session'...") is always present; it's the upgrade path signal.

---

## Shadow-event envelope (ADR-018 step 1)

After the briefing renders, run:

```
node kit/scripts/cwos-event.js append command_completed --track T14:session-start --tag /session-start --payload '{"command":"/session-start"}'
```

Non-fatal. Never gate the briefing on its exit status.
