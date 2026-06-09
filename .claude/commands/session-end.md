---
name: session-end
description: "End the current session cleanly — update state, record outcomes, write handoff notes"
user-invocable: true
argument-hint: "[--force] [handoff notes]"
---

# /session-end — End Work Session

Close the current session cleanly, ensuring all state is current and handoff notes are written.

## Arguments

- `--force` — Skip verification (Steps 3-4). Use when verification is failing and you need to end the session anyway. Releases all claims unconditionally.
- Everything else is treated as handoff notes.

## Steps

### 0a. Dormant-mode capture (WS-321 Phase B)

Read `.cwos-onboarding.yaml`. If top-level `adoption_phase` equals `M0`, the repo is in dormant mode (kit installed, programs inert, queue closed). The standard session-end ceremony does not apply — there's no sprint to close, no claimed items to release, no programs to refresh. Instead, run the **dormant capture pass** below and stop:

1. **Diff the working tree to find new founder content.** Use `git status --porcelain` to enumerate untracked + modified files. Filter to files under:
   - `notes/` (any file) — emits `note_added`
   - `system/` (any file NOT named `intention.md` — that file is template-shipped at scaffold time and tracked separately via `intention_edit` in /session-start Step 0c) — emits `file_dropped`

2. **For each `notes/` file**, emit a `T20:capture-buffer` event with `track_tag: note_added`:
   ```bash
   node kit/scripts/cwos-event.js append note_added \
     --track T20:capture-buffer \
     --tag note_added \
     --payload '{"path":"<relative-path>","byte_size":<bytes>,"first_line":"<first-non-empty-line, ≤200 chars>","content_hash":"<sha256-hex>"}'
   ```

3. **For each non-template `system/` file**, emit `track_tag: file_dropped`:
   ```bash
   node kit/scripts/cwos-event.js append file_dropped \
     --track T20:capture-buffer \
     --tag file_dropped \
     --payload '{"path":"<relative-path>","byte_size":<bytes>,"first_line":"<first-non-empty-line, ≤200 chars>"}'
   ```

4. **Emit one `conversation_summary` event** capturing the session in plain prose (target 100-400 chars). Frame it as "what the founder was thinking about / shaping / deciding this session" — this is what the ignition proposal will read to infer archetype and principles. Do NOT manufacture content if the session was empty (e.g., founder ran one command and left); in that case skip step 4 entirely.
   ```bash
   node kit/scripts/cwos-event.js append conversation_summary \
     --track T20:capture-buffer \
     --tag conversation_summary \
     --payload '{"summary_text":"<prose summary>","turn_count":<N>,"session_id":null}'
   ```

5. **For any `implicit_decision` patterns** detected during the session (the same patterns Step 5.4 below uses — "let's use X", "we'll go with Y", "decided to skip Z"), emit one event per decision:
   ```bash
   node kit/scripts/cwos-event.js append implicit_decision \
     --track T20:capture-buffer \
     --tag implicit_decision \
     --payload '{"decision_text":"<quoted decision>","source_path":"<file-or-null>","line_no":<N-or-null>}'
   ```

6. **Render a one-line dormant summary** to the founder:
   ```
   Session captured: <N> notes · <M> file drops · <K> conversation summary · <D> implicit decisions. Capture buffer: events/current.jsonl. Run /intend when ready to ignite.
   ```

7. **Stop.** Do NOT execute Steps 1–9 below. Specifically: no session.yaml write, no claim release, no decisions.md append (decisions during M0 go through capture-buffer, not the canonical decisions.md surface — that's the feed-forward contract), no usage.yaml mutation, no handoff_notes file. The dormant phase deliberately doesn't produce session-history artifacts; the capture buffer is the only post-session signal.

If `adoption_phase` is unset or `M1`–`M5`, skip this step entirely and continue with the Preferred read path / Step 1 below.

### Preferred read path (ADR-020 step 2)

For claimed-item summary + recent envelope context, prefer the typed-API CLI:

```bash
node kit/scripts/cwos-state-store.js queue by-status claimed
node kit/scripts/cwos-state-store.js envelope recent 10
```

The T6:workstream + T0:envelope reducers keep state files in sync.
Deterministic reads per feedback_determinism_first.md. Fallback:
queue-index.yaml + raw event log (pre-step-2 repos).

### 1. Get Session Context
Read `.claude/workstream/.current-session` for session ID.
Read the session file from `.claude/workstream/sessions/<session-id>.yaml`.

### 2. Check Active Sprint
Read `.claude/workstream/sprint-index.yaml`. If a sprint has `status: active`:
- Read the sprint file
- Count items done, pending, in_progress, skipped
- If ALL items are `done` or `skipped`: mark sprint `status: completed`, `completed_at: <timestamp>`
- If items remain `pending` or `in_progress`:
  - Sprint stays `active`
  - For `in_progress` items: ask user "WS-NNN is in progress. Mark done, or leave for next session?"
  - For `pending` items: leave in sprint, they'll resume next session
  - Add sprint reference to handoff notes: "Sprint SPR-NNN has N items remaining"
- (sprint-index is regenerated by cwos-reconcile in Step 5.7 — do not hand-patch)

### 2b. Check Work Item Status
For each item in `claimed_items` (including sprint items):
- If `status: done` → good
- If `status: in_progress` → ask: "WS-NNN is still in progress. Mark as done, or leave for next session?"
  - If leaving: release claim, set back to `backlog` (if in a sprint, set sprint item to `pending`)
- If `status: claimed` (never started) → release, set back to `backlog` (if in a sprint, set sprint item to `pending`)

### 3. Run Verification (skip if --force)
If `--force` is NOT set:
- Run `/verify` to check that everything is healthy
- Tests pass, build succeeds, no invariant violations
- Report any issues
- If verification fails: warn user, suggest `--force` if they need to end anyway

If `--force` IS set: skip verification entirely, proceed to state update.

### 4. Update System State
Regenerate `system/state.md`:
- Update vital signs from verification results
- Update queue summary counts
- Update program health (if any programs were touched)
- Check if any program protocol becomes overdue TODAY or within the next 3 days:
  - If so, add to handoff notes: "[Program] [protocol] check is due [today/in N days]. Next session should run `/pulse run [program-id]`."
- Add this session to recent sessions table
- Set `Last updated: <today> (<session description>)`

### 5. Write Handoff Notes
Update the session file:
```yaml
status: completed
ended_at: <timestamp>
handoff_notes: |
  <$ARGUMENTS if provided, otherwise auto-generate from work done>
  Items completed: [list]
  Items remaining: [list]
  Key findings: [any notable discoveries]
  Next recommended action: [what should the next session do first]
  Autopilot eligible: [count items with status:backlog, effort:S, type:bug|finding, no decision_flags — if 5+, add: "Consider /autopilot <N>h to run these autonomously"]
context_notes: |
  <any context the next session needs to know>
```

### 5.4. Formalize Detected Decisions

Review the conversation for decisions flagged by the Decision Detection Protocol (inline "Decision noted:" and "Decision with trade-offs:" callouts). Also scan for any implicit decisions that weren't flagged inline — choices made during implementation that match the decision signal patterns in the preamble.

For each detected decision:

1. **Classify weight:**
   - **Heavy** — Affects multiple features, hard to reverse, establishes precedent
   - **Medium** — Shapes one feature's behavior, reversible but costly
   - **Light** — Minor UX or implementation choice, easily changed

2. **For Heavy and Medium decisions:**
   - Check `system/decisions.md` for duplicates or related existing decisions
   - Assign next `DEC-NNN` ID
   - Append to `system/decisions.md`:
     ```markdown
     ### DEC-NNN: [Title]
     **Date:** YYYY-MM-DD | **Status:** Accepted | **Detected:** implicit
     **Decision:** [What was decided]
     **Reasoning:** [Why this choice was made — include the trade-off if any]
     **Context:** [What work prompted this — item ID, bug fix, feature]
     ```
   - Note: Implicit decisions use a shorter format than `/decide` ADRs. They capture the WHAT and WHY without requiring full options-considered analysis.

3. **For Light decisions:**
   - Include in handoff notes under a "Decisions made" subsection (no `decisions.md` entry)

4. **Update telemetry:**
   - Count all formalized decisions (Heavy + Medium) toward `decisions_recorded` in usage.yaml
   - This ensures the value ledger reflects decisions captured passively, not just via `/decide`

5. **Output** (as part of session summary):
   - If any Heavy/Medium decisions were recorded: list them briefly
   - If zero decisions detected: note "No product-shaping decisions detected this session"

### 5.5. Update Usage Telemetry

Update `.claude/workstream/usage.yaml` with this session's activity:

**Command counts:** Increment counters for each command used during this session (review conversation history for command invocations).

**Session type:** Increment `strategic_sessions` (since session-end implies a formal session).

**Engine runs:** For any engines run during this session, update `engine_runs` entries with incremented run count, today's date, and finding/item counts.

**Value ledger updates:**
- `total_items_completed` += items marked done this session
- `total_items_created` += new items created this session
- `total_findings_caught` += new findings generated this session
- `decisions_recorded` += new decisions logged this session
- `sessions_with_handoff` += 1 (this session has handoff notes)
- `regressions_prevented` += count of findings that matched `system/failures.md` patterns
- `invariant_violations_caught` += count of invariant violations detected this session
- `drift_corrections` += count of state drift issues fixed this session

**Feature engagement:** Update `feature_engagement` entries — set `used: true` and `last_used: today` for any features exercised this session.

**Weekly snapshot:** If the current week's snapshot doesn't exist in `convergence.weekly_snapshots`, create it. Update its counts.

### 5.5b. Friction Logging (silent — no output to user)

Review the current session's conversation for friction events and log to `.cwos-feedback.yaml`:

1. **Command failures:** Any CWOS command that returned a non-zero exit code or produced an error. Log: command, error, what was done instead.
2. **File not found:** Any attempt to read a file referenced by CWOS infrastructure (registry, config, program definitions) where the file didn't exist. Log: expected path, component.
3. **Manual fixes:** Any time Claude had to modify a kit-installed file to make it work (fixing paths, adjusting commands for platform). Log: what was wrong, what was fixed, component.
4. **Workarounds:** Any time Claude chose an alternative approach because the standard one failed (e.g., Python instead of bash date). Log: standard approach, why it failed, alternative used.
5. **Platform issues:** Any error attributable to the OS/shell (OneDrive locks, Git Bash limitations, path separators). Log: error, cause, workaround.

For each event:
- Generate sequential `fr-NNN` ID (scan existing friction_log for max)
- Set `session_id` to current session
- Set `severity`: high if it blocked work, medium if workaround needed, low if cosmetic
- Set `component` to the kit component that caused it (e.g., session-start, engine-registry, queue-index)
- Append to `.cwos-feedback.yaml` `friction_log`
- Update `summary` counts

If `.cwos-feedback.yaml` doesn't exist, skip this step silently.

### 5.6a. Reconcile Findings & Health Scores (safety net)

Catch any finding→health drift that Step 6b of `/next` missed (e.g., items completed outside of `/next`, manual queue edits, or items completed before this step existed).

1. Scan `queue-index.yaml` for all items with `status: done` AND a `finding_id` field
2. For each, check `findings-index.yaml` — if the finding's `status` is still `open`:
   - Update the finding file: `status: resolved`, `resolved_at: <completed_at from work item>`, `resolved_by: <work-item-id>`
   - (findings-index will be regenerated by cwos-reconcile in Step 5.7)
   - Add the finding's `program` to a `programs_to_recalc` set
3. For each program in `programs_to_recalc`:
   - Recount `findings_open` and `work_items_open` from current state
   - Recompute `health_score` using `kit/templates/system/health-scoring.md`
   - Update the program file
4. If any findings were reconciled, log to session notes: "Reconciled N stale findings across M programs"

This step is idempotent — if `/next` Step 6b already resolved everything, this finds nothing to do.

### 5.5d. Record stage marker (WS-251 / ADR-035)

If `.cwos-onboarding.yaml#stage` is non-null, copy its value into `last_recorded_stage` so the next session's `/session-start` Step 3d can detect cross-session declaration changes.

```bash
# Pragmatic: read current stage, write into last_recorded_stage. No-op if stage is null.
node -e '
const fs=require("fs"), p=".cwos-onboarding.yaml";
if (!fs.existsSync(p)) process.exit(0);
let txt=fs.readFileSync(p,"utf8");
const m=txt.match(/^stage:\s*"?([SN]\d)"?/m);
if (!m) process.exit(0);
const re=/^(last_recorded_stage:[ \t]*)([^\n#]*?)([ \t]*(?:#[^\n]*)?)$/m;
if (re.test(txt)) { txt=txt.replace(re,`$1"${m[1]}"$3`); fs.writeFileSync(p,txt); }
'
```

Silent — the stage marker is housekeeping, not founder-facing.

### 5.6. Regenerate System Summary

Rebuild `.claude/workstream/system-summary.yaml` for fast orientation in future Standard Mode sessions:
- `vital_signs_ok`: true if all vital sign checks pass, false otherwise
- `red_vitals`: list of failing vital sign names
- `queue_counts`: count items by status from `queue-index.yaml`
- `top_3_unclaimed`: top 3 backlog items by priority_score from index
- `stale_programs`: scan `programs/prog-*.yaml` for programs past `staleness_threshold_days`
- `active_context_count`: count active items in `system/context.md`
- `critical_findings`: count open findings with severity critical from `findings-index.yaml`
- `convergence_trend`: from `usage.yaml` convergence section
- `last_updated`: current timestamp

### 5.6b. Optimization Signal Summary

Check `.claude/workstream/optimization-index.yaml` for signals generated during this session:
1. Read `signals` array and filter for entries where `source_run` matches a run executed during this session (compare timestamps against session start time)
2. Count new signals and note their types
3. If count > 0, prepare a `### System Learning` subsection for Step 7 output
4. If count == 0, skip — no output

### 5.7. Reconcile + Quick GC

Run reconcile first (rebuilds all indexes + counters from source files, runs integrity checks):

```
node kit/scripts/cwos-reconcile.js --quiet
```

If integrity violations are reported, surface them in the session handoff notes.

Then run lightweight GC (archives completed artifacts past threshold; cwos-gc.js calls reconcile internally after archival):

```
node kit/scripts/cwos-gc.js
```

GC reads thresholds and entity types from `config.yaml`. Skip graduation checks (handled by `/audit`).

### 6. Clean Up
- Remove `.claude/workstream/.active-sessions/{session-id}.lock` (if it exists)
- Remove `.claude/workstream/.current-session` (backward compatibility)
- Release any file locks

### 7. Output Summary

```
## Session Complete: <session-id>

### Duration: Xh Ym
### Work Done
- [list of completed items with outcomes]

### Remaining
- [items released back to queue]

### Handoff Notes
[notes for next session]

### System State: Updated ✓
### Verification: PASS / FAIL [details]

{If Step 5.6b found signals:}
### System Learning
This session produced N optimization signal(s) — [brief description, e.g., "1 calibration_drift on eng-engine, 1 coverage_gap on security personas"].
Run `/evolve report` to see accumulated patterns.
{Omit entirely if zero signals this session.}
```

---

## Shadow-event envelope (ADR-018 step 1)

After the session-complete summary renders, run:

```
node kit/scripts/cwos-event.js append command_completed --track T15:session-end --tag /session-end --payload '{"command":"/session-end"}'
```

Non-fatal. Per-mutation events (queue updates, sprint completion,
handoff notes) fire from the invoked scripts, not from this command.
