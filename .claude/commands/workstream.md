---
name: workstream
description: "Project coordination — manage sessions, work queue, findings, and engine pipelines"
user-invocable: true
argument-hint: "<subcommand> [args]"
---

# /workstream — Project Coordination System

Workstream coordinates work across sessions using file-based state in `.claude/workstream/`. It manages a structured work queue (YAML per item), a finding pipeline (engine outputs to actionable items), and session continuity.

## Output Shape

**Workstream arc:** `<queue | findings | sprints | sessions>` — `<one-clause status of the named sub-arc>` (e.g., "Queue sub-arc: 24 backlog, 1 in_progress, 3 blocked").

`<Delta line: what this invocation did — listed N items, claimed WS-NNN, resolved FIND-NNN, archived sprint, etc.>`

`<Remainder: sub-arc-specific table — queue items / findings / sprints / sessions — sorted by priority_score or recency. Cite sub-arc explicitly in the heading.>`

### Why this view
`<Value-rationale: cite the program(s) the items belong to, the sprint they're claimed by, or the repo_goal they advance. When listing findings, cite originating engine + run_id. If nothing matches the filter: declare it.>`

**Do next:** Single-line action — `Run /next to compose a sprint from the top backlog items` (or sub-arc-specific guidance, e.g., `Resolve blockers on WS-NNN before composing next sprint`).

**State directory:** `.claude/workstream/`
**Current session ID:** Read from `.claude/workstream/.current-session`
**Queue index:** `.claude/workstream/queue-index.yaml` (fast-scan summary, maintained on every write)
**Shadow index:** `.claude/workstream/shadow-index.yaml` (used when `backlog.source` is `markdown` or `github-issues` in `.cwos-config.yaml`)

### Preferred read path (ADR-020 step 2)

For queue / findings / sprints lookups, prefer the typed-API CLI:

```bash
node kit/scripts/cwos-state-store.js queue by-status backlog
node kit/scripts/cwos-state-store.js queue by-program kit-quality
node kit/scripts/cwos-state-store.js findings by-status open
node kit/scripts/cwos-state-store.js findings by-severity critical
node kit/scripts/cwos-state-store.js sprints active
```

The T6:workstream reducer keeps `state/{queue,findings,sprints}.json`
in sync with the YAML files. Deterministic O(1) reads per
feedback_determinism_first.md. Fallback: read the YAML indexes
directly (pre-step-2 repos).

### Shadow Backlog Mode

When `.cwos-config.yaml` has `backlog.source` set to `markdown` or `github-issues`, the work queue is read from an external source (BACKLOG.md or GitHub Issues) instead of `queue/WS-*.yaml` files. CWOS tracks sprint state in `shadow-index.yaml` without modifying the source.

In shadow mode:
- `status` shows shadow index stats instead of queue index
- `queue` lists shadow items instead of WS-* items
- `claim`, `release`, `start`, `done` operate on shadow items (by `SH-NNN` ID)
- `create` still creates a WS-* YAML item (for CWOS-native items alongside shadow items)
- `findings` and `pipeline` are unaffected — they always produce WS-* items

---

## Counter Reconciliation

Before using any counter from `config.yaml` (`next_item_id`, `next_finding_id`, `next_run_id`, `next_rec_id`):
1. Scan existing files (glob `queue/WS-*.yaml`, `findings/FIND-*.yaml`, `runs/run-*.yaml`, `recommendations/REC-*.yaml`)
2. Extract the max numeric ID from filenames
3. If `config.yaml` counter is <= max found ID, set counter = max + 1
4. Then increment and use

This prevents duplicate IDs from crashes, manual edits, or concurrent writes.

## Queue Index Maintenance

After EVERY write operation to `queue/` (create, claim, release, start, done, block):
1. Read `queue-index.yaml`
2. Update the affected item's entry (or add new entry for create)
3. Write `queue-index.yaml`

If `queue-index.yaml` is missing or corrupted: rebuild by scanning all `queue/WS-*.yaml` files and extracting summary fields.

**Integrity check:** On every read of `queue-index.yaml`, count index entries and glob `queue/WS-*.yaml` (exclude `queue/archive/`). If counts don't match, rebuild the index from files before proceeding.

## Findings Index Maintenance

After EVERY write operation to `findings/` (create, promote, dismiss, resolve, archive):
1. Read `findings-index.yaml`
2. Update the affected finding's entry (or add new entry for create, or remove for archive)
3. Write `findings-index.yaml`

If `findings-index.yaml` is missing or corrupted: rebuild by scanning all `findings/FIND-*.yaml` files and extracting summary fields `{id, engine, severity, status, dedup_key, title, program, created_at}`.

---

## Subcommands

Parse `$ARGUMENTS` to determine which subcommand to run. If no subcommand given, default to `status`.

| Subcommand | Usage |
|---|---|
| `status` | Current session + queue overview |
| `claim <id>` | Claim a work item |
| `release [id]` | Release item(s) back to backlog |
| `start <id>` | Move claimed item to in_progress |
| `done <id> [notes]` | Mark item complete |
| `block <id> <reason>` | Mark item blocked |
| `next` | Auto-pick and claim highest priority unclaimed item |
| `resume [session-id]` | Resume a previous session's work |
| `end [notes]` | End current session with handoff notes |
| `findings [severity] [status]` | List findings |
| `queue [status] [type] [category] [program]` | List/filter work items |
| `pipeline <engine>` | Run engine, process output into findings/items |
| `create <title>` | Manually create a new work item |
| `programs` | List all programs with health scores and staleness |
| `recommendations [pending\|approved\|dismissed]` | List strategy recommendations |
| `approve <REC-id>` | Approve and create from a recommendation |
| `dismiss <REC-id> [reason]` | Dismiss a recommendation |
| `gc [--dry-run]` | Run garbage collection manually |
| `phase [phase-name]` | View or change project lifecycle phase |
| `sprint` | Show active sprint status |
| `sprint plan` | Manually trigger sprint composition |
| `sprint skip <WS-id>` | Skip an item in the active sprint |
| `sprint cancel` | Cancel active sprint, release items to backlog |
| `sprint history` | List past sprints |

---

## Sprint Subcommands

### `sprint` (no args) — Show active sprint
Read `sprint-index.yaml`. Find sprint with `status: active`. If none:
```
No active sprint. Run `/next` to compose one.
```
If found, read the sprint file and display:
```
## Active Sprint: SPR-NNN — [title]

Goal: [goal]
Progress: N of M items done

| # | Title | Mode | Status |
|---|-------|------|--------|
| 1 | [title] | Just do it | ✓ Done |
| 2 | [title] | Design first | ▶ Next |
| 3 | [title] | Just do it | ○ Pending |

Run `/next` to resume, or `/sprint cancel` to abandon.
```

### `sprint plan` — Manually compose a sprint
Run the sprint composition logic from `/next` Steps 2-4, but with user-directed focus:
- Ask: "What area should this sprint focus on? (program name, or 'auto' for highest priority)"
- Compose and present sprint for approval

### `sprint skip <WS-id>` — Skip an item in the active sprint
Read active sprint. Find the item matching `<WS-id>`:
- Set sprint item `status: skipped`, `notes: "Skipped by user"`
- Release queue item: `status: backlog`, clear `claimed_by`
- Update sprint-index and queue-index
- If this was the last pending item: check if sprint is now complete

### `sprint cancel` — Cancel the active sprint
Read active sprint. For each item:
- `status: done` items stay done (work already completed)
- `status: pending` or `in_progress` items: release to `status: backlog`, clear `claimed_by` and `sprint_id`
Set sprint `status: abandoned`. Update sprint-index and queue-index.
```
Sprint SPR-NNN cancelled. N items completed, M items released back to backlog.
```

### `sprint history` — List past sprints
Read sprint-index.yaml. Show all sprints sorted by created_at descending:
```
## Sprint History

| ID | Goal | Status | Items | Completed |
|----|------|--------|-------|-----------|
| SPR-003 | ... | active | 3/5 | — |
| SPR-002 | ... | completed | 4/4 | 2026-04-07 |
| SPR-001 | ... | abandoned | 2/5 | 2026-04-06 |
```

---

## Sprint Index Maintenance

After EVERY write operation to `sprints/` (create, update, complete, abandon):
1. Read `sprint-index.yaml`
2. Update the affected sprint's entry
3. Write `sprint-index.yaml`

If `sprint-index.yaml` is missing: rebuild by scanning `sprints/SPR-*.yaml`.

---

## Session Identity

On every invocation, read `.claude/workstream/.current-session` to get the current session ID. If the file doesn't exist, warn and suggest running `/session-start`.

Update the session's `last_heartbeat` in its YAML file on every invocation.

---

## Subcommand: `status` (default)

1. Read current session file from `sessions/{current-session-id}.yaml`
2. Scan `sessions/` for all active sessions
3. Read `queue-index.yaml` for queue summary (count by status, top 5 unclaimed by priority). If index missing, rebuild from `queue/WS-*.yaml` files.
4. Scan `findings/` for open findings — count by severity (only active findings, not `findings/archive/`)
5. Check for abandoned sessions

**Output:**
```
## Workstream Status

### Current Session
- **ID:** ses-YYYYMMDD-HHMM-XXXX
- **Started:** YYYY-MM-DD HH:MM (Xh Ym ago)
- **Claimed items:** WS-NNN, WS-NNN
- **Files locked:** path/to/file, ...

### Queue Summary
| Status | Count |
|---|---|
| Backlog | N |
| Claimed | N |
| In Progress | N |
| Done | N |
| Blocked | N |

### Top 5 Unclaimed (by priority)
| Rank | ID | Title | Score | Type |
|---|---|---|---|---|
| 1 | WS-NNN | ... | NN.N | ... |
```

---

## Subcommand: `claim <id>`

1. Read `queue/WS-<id>.yaml`
2. Verify status is `backlog` (not already claimed)
3. Update: `status: claimed`, `claimed_by: <session-id>`, `claimed_at: <timestamp>`
4. Add to session's `claimed_items` list
5. Add item's `files_involved` to session's `files_locked`
6. Output confirmation with item details

---

## Subcommand: `release [id]`

1. If id provided: release that specific item
2. If no id: release ALL items claimed by current session
3. Update item: `status: backlog`, remove `claimed_by` and `claimed_at`
4. Remove from session's `claimed_items` and `files_locked`

---

## Subcommand: `start <id>`

1. Verify item is claimed by current session
2. Update: `status: in_progress`, `started_at: <timestamp>`
3. Output: item details, accept criteria, files involved

---

## Subcommand: `done <id> [notes]`

1. Verify item is `in_progress` and claimed by current session
2. Update: `status: done`, `completed_at: <timestamp>`, `completion_notes: <notes>`
3. Move the item file from `queue/WS-<id>.yaml` to `queue/archive/WS-<id>.yaml`
4. Remove the item's entry from `queue-index.yaml` (archived items are not indexed)
5. Remove from session's `claimed_items` and `files_locked`
6. Output: confirmation, suggest running `/verify`

---

## Subcommand: `block <id> <reason>`

1. Verify item is claimed by current session
2. Update: `status: blocked`, `blocked_reason: <reason>`, `blocked_at: <timestamp>`
3. Remove from session's `claimed_items` (but keep record)
4. Output: confirmation, suggest alternatives

---

## Subcommand: `next`

Same behavior as `/next` command. See next.md.

---

## Subcommand: `resume [session-id]`

1. If session-id provided: read that session's file
2. If no session-id: find most recent non-current session
3. Read session's `handoff_notes` and `context_notes`
4. List items that were claimed/in-progress when session ended
5. Offer to re-claim those items

---

## Subcommand: `end [notes]`

Same behavior as `/session-end`. See session-end.md.

---

## Subcommand: `findings [severity] [status]`

1. Read `findings-index.yaml` for fast summary. If index missing, rebuild from individual `FIND-*.yaml` files.
2. Filter by severity and/or status if provided
3. Sort by severity (critical first), then by date
4. Load full YAML only for items to display
5. Output table:

```
| ID | Engine | Severity | Status | Title | Program | Date |
|---|---|---|---|---|---|---|
| FIND-NNN | eng-engine | high | open | ... | security | YYYY-MM-DD |
```

---

## Subcommand: `queue [status] [type] [category] [program]`

1. Read `queue-index.yaml` (with integrity check). If missing, rebuild from `queue/WS-*.yaml` files.
2. Filter by status, type, category, and/or program if provided
3. Sort by priority_score descending
4. Output table:

```
| ID | Title | Status | Priority | Type | Category | Program | Effort |
|---|---|---|---|---|---|---|---|
| WS-NNN | ... | backlog | NN.N | finding | security | engineering | M |
```

---

## Subcommand: `pipeline <engine>`

1. Run the specified engine via `/engine <name>`
2. Process all outputs through the finding pipeline
3. Report: findings created, items promoted, items added

---

## Subcommand: `create <title>`

1. Get next item ID from `config.yaml`, increment counter
2. Ask for: description, type, category, effort, priority score, files involved, accept criteria
3. Write `queue/WS-<id>.yaml`:

```yaml
id: "WS-NNN"
title: "<title>"
type: manual
status: backlog
priority_score: <score>
category: <category>
description: "<description>"
accept_criteria: "<criteria>"
effort: <S|M|L>
files_involved: [<paths>]
source:
  type: manual
  created_by: user
created_at: "<timestamp>"
```

4. Output confirmation

---

## Subcommand: `programs`

Same behavior as `/pulse` with no args. See pulse.md.

---

## Subcommand: `recommendations [pending|approved|dismissed]`

1. Scan `.claude/workstream/recommendations/REC-*.yaml`
2. Filter by status if provided (default: `pending`)
3. Sort by created_at descending
4. Output table:

```
| ID | Type | Title | Supporting Findings | Created |
|----|------|-------|---------------------|---------|
| REC-NNN | new-program | Error Handling Program | FIND-012, FIND-015 | 2d ago |
```

---

## Subcommand: `approve <REC-id>`

1. Read `recommendations/REC-<id>.yaml`
2. Based on `type`:
   - **new-program:** Create `programs/prog-<program_id>.yaml` using v3 schema. Populate contract, problem_classes, scope, tier_triggers from the proposal. Set `status: NEW`, `tier` to `suggested_initial_tier` (or `watch` if not specified). Register in `registry.yaml`. Then prompt: "New program '{name}' created at {tier} tier. Run `/pulse run {id} baseline` to establish the baseline."
   - **program-scope-expansion:** Add new problem_classes and file_patterns to the target program. Note what was added.
   - **new-engine:** Add entry to `engines/registry.yaml` with suggested fields. Note: engine skill file still needs to be built via `/build-engine`
   - **new-invariant:** Append invariant to `system/invariants.md` using the proposal's rule and check fields
   - **architecture-change:** Create a work item (WS-NNN) of type `improvement` with the change description
3. Update recommendation: `status: approved`, `approved_at: <timestamp>`
4. Output confirmation with what was created

---

## Subcommand: `dismiss <REC-id> [reason]`

1. Update recommendation: `status: dismissed`, `dismissed_at: <timestamp>`, `dismiss_reason: <reason>`
2. Move to `recommendations/archive/`
3. Output confirmation

---

## Subcommand: `gc [--dry-run]`

Run the full garbage collection procedure on demand.

1. Read GC thresholds from `config.yaml` `gc` section (use defaults if missing: findings 30d, runs 90d, sessions 30d)
2. Run value graduation check (see `/audit` Step 9.5b) before archiving findings
3. Archive findings: `status: open` AND older than `gc.finding_archive_days` AND not promoted → move to `findings/archive/`
4. Archive findings: `status: dismissed` or `status: resolved` → move to `findings/archive/`
5. Archive runs: older than `gc.run_archive_days` AND all findings resolved/archived → move to `runs/archive/`
6. Archive sessions: `status: completed` AND older than `gc.session_archive_days` → move to `sessions/archive/`
7. Update `findings-index.yaml` (remove archived entries)
8. If `--dry-run`: list what WOULD be archived/graduated without making changes

**Output:**
```
### Garbage Collection
| Artifact | Scanned | Archived | Graduated | Retained |
|----------|---------|----------|-----------|----------|
| Findings | N | N | N | N |
| Runs | N | N | — | N |
| Sessions | N | N | — | N |
```

---

## Subcommand: `phase [phase-name]`

View or change the project's lifecycle phase. Phase affects program staleness thresholds, RICE scoring, and `/pulse` display.

### No argument: show current phase

1. Read `system/state.md`, extract the Project Phase table
2. Read all programs from `.claude/workstream/programs/prog-*.yaml`
3. For each program with `phase_relevance`, calculate effective staleness at current phase:
   - critical = base_threshold x 0.5
   - high = base_threshold x 1.0
   - medium = base_threshold x 2.0
   - low = base_threshold x 4.0
4. Output:

```
## Project Phase: [current-phase]
Changed: [date or "since setup"]

### Program Relevance at This Phase
| Program | Relevance | Base Staleness | Effective Staleness |
|---------|-----------|---------------|-------------------|
| security | critical | 7d | 3.5d |
| engineering | high | 14d | 14d |
| ux | low | 14d | 56d |

### Phase Transition Options
Current: [phase] → Next likely: [next-phase]
Run `/workstream phase <phase-name>` to transition.
```

### With argument: transition to new phase

1. Validate `phase-name` is one of: `foundation`, `pre-launch`, `launch`, `growth`, `maturity`
2. Read current phase from `system/state.md`
3. If same as current: "Already in [phase]. No change."
4. Update `system/state.md` Project Phase table: Current Phase, Phase Changed At, Previous Phase
5. For each program:
   - Read `phase_relevance` for the new phase
   - If relevance is `none`: flag for deprecation (do NOT auto-delete, just warn)
   - Recalculate effective staleness — flag programs now stale under the new threshold
6. Record as decision in `system/decisions.md`
7. Output:

```
## Phase Transition: [old-phase] → [new-phase]

### Staleness Changes
| Program | Old Threshold | New Threshold | Now Stale? |
|---------|--------------|---------------|------------|
| security | 14d | 3.5d | YES |

### Tier Escalation Review
[Programs whose tier_triggers may now be met due to the phase change]
- e.g., "security should escalate to ACTIVE — trigger 'Application is deployed to production' is met"

### Suggestions
- **Deprecate:** [programs with relevance: none at new phase]
- **Escalate tiers:** [programs whose tier should increase based on the new phase context]
- **Consider adding:** [programs appropriate for the new phase that don't exist yet — explain what domain would benefit from permanent accountability]

Decision recorded as DEC-NNN.
```

---

## Work Item YAML Format

```yaml
id: "WS-NNN"
title: "Short descriptive title"
type: finding | task | bug | improvement | manual
status: backlog | claimed | in_progress | review | done | blocked
priority_score: 24.0  # RICE score
category: architecture | security | performance | ux | data-integrity | testing | infrastructure | documentation
program: ""  # program ID — links to parent program (e.g., "engineering", "security")
capability: ""  # capability dimension (ADR-016): core | workstream | engines | governance | autonomous
                # Derived from program + category by cwos-index.deriveCapability() if absent.
                # Drives /next scoring against .cwos-onboarding.yaml capabilities block.
description: |
  Detailed description of what needs to be done
accept_criteria: "How to verify this is done"
effort: S | M | L
files_involved:
  - path/to/file1
  - path/to/file2
blocked_by: []        # list of WS-NNN IDs
enables: []           # list of WS-NNN IDs this unblocks
sprint_id: ""         # SPR-NNN if assigned to a sprint, empty otherwise
decision_flags: []    # decisions user must make before execution
                      # e.g., ["UX: layout choice", "Architecture: sync vs async"]
source:
  engine: <engine-name>
  finding_id: "FIND-NNN"
  run_id: "run-NNN"
claimed_by: ""
claimed_at: ""
started_at: ""
completed_at: ""
completion_notes: ""
blocked_reason: ""
created_at: "<timestamp>"
```

## Finding YAML Format

```yaml
id: "FIND-NNN"
engine: <engine-name>
run_id: "run-NNN"
severity: critical | high | medium | low
status: open | promoted | dismissed | resolved
title: "Finding title"
description: "Detailed description"
evidence:
  file: path/to/file
  line: 142
  snippet: "relevant code"
dedup_key: "unique-key-for-dedup"
program: ""  # program ID if evidence.file falls within a program's scope_paths
promoted_to: "WS-NNN"  # if promoted
graduated_to: ""  # FAIL-NNN or INV-NNN if graduated to durable knowledge before archival
created_at: "<timestamp>"
```

---

## Shadow-event envelope (ADR-018 step 1)

At the end of your final output (whatever sub-operation ran — queue,
findings, sprint, etc.), run:

```
node kit/scripts/cwos-event.js append command_completed --track T6:workstream --tag /workstream --payload '{"command":"/workstream"}'
```

Non-fatal. Per-mutation events (queue writes, finding updates, etc.)
fire from the invoked scripts, not from this command.
