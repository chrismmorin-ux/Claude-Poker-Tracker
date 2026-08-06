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
  - If leaving: release the claim (clear `claimed_by` / `claimed_at`), set status back to `backlog` (if in a sprint, set sprint item to `pending`)
- Otherwise, if the item is claimed but was never started → release the claim, set back to `backlog` (if in a sprint, set sprint item to `pending`)

> **A claim is `claimed_by`, never a status.** This step used to say "if
> `status: claimed`" — a value nothing has ever written. `cwos-claims` says so
> in its own header, and the identical bug in `cwos-session-recovery.js` matched
> nothing and released nothing while reporting recovery complete (WS-564: eight
> abandoned records in claude-poker-tracker still held WS-300 and WS-276). The
> script was fixed; this prose was not, until ADR-065.

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

### 5.4. Formalize Detected Decisions — **mostly automatic now (ADR-065)**

Decisions are captured at the moment of detection with `cwos-capture decision`
and drained into `system/decisions.md` by `cwos-reconcile`, which runs from the
SessionStart hook. If you have been capturing as you work, there is nothing to
do here — run `node kit/scripts/cwos-capture.js pending` to confirm.

Why it moved: this step is the reason the passive path never worked. On
2026-08-03 `system/decisions.md` held 47 entries and **zero** were marked
`Detected: implicit` — every one had come through `/decide`. A step that only
executes at a boundary reached 12% of the time does not execute.

**What is still worth doing here:** a last sweep for decisions you made but
never captured — the ones that felt too small to stop for at the time. Capture
them now with `cwos-capture decision`, then let the drain place them. Use the
classification below to pick `--weight`.

For each such decision:

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

**Capture friction when it happens** — `cwos-capture friction "<what fought
back>" --severity <high|medium|low> --component <name>` — for the same reason
decisions moved: reconstructing "what went wrong" from conversation history at
the one moment least likely to be reached is how the record stayed empty.

What remains here is the sweep for anything you hit but did not capture. The
categories below are the ones worth capturing. **The destination is the event
log, in every repo** — `cwos-capture` is `capability: core` since WS-578, so
it is present even in a repo that has enabled nothing else.

1. **Command failures:** Any CWOS command that returned a non-zero exit code or produced an error. Log: command, error, what was done instead.
2. **File not found:** Any attempt to read a file referenced by CWOS infrastructure (registry, config, program definitions) where the file didn't exist. Log: expected path, component.
3. **Manual fixes:** Any time Claude had to modify a kit-installed file to make it work (fixing paths, adjusting commands for platform). Log: what was wrong, what was fixed, component.
4. **Workarounds:** Any time Claude chose an alternative approach because the standard one failed (e.g., Python instead of bash date). Log: standard approach, why it failed, alternative used.
5. **Platform issues:** Any error attributable to the OS/shell (OneDrive locks, Git Bash limitations, path separators). Log: error, cause, workaround.

For each event, one command — no id allocation, no YAML editing, no summary
arithmetic:

```bash
node kit/scripts/cwos-capture.js friction "<what happened>" \
  --severity high|medium|low \
  --component <kit component that caused it> \
  --workaround "<what was done instead, if anything>"
```

`--severity`: **high** if it blocked work, **medium** if a workaround was
needed, **low** if cosmetic. `--component` is optional — a capture with no
component is inferred at aggregation and still counts. Never withhold a
capture because you are unsure what to attribute it to; every field demanded
at capture time is a reason not to capture.

> **Superseded (WS-578).** This step used to say: allocate a sequential
> `fr-NNN` by scanning for the max, append to `.cwos-feedback.yaml`, update
> the summary counts, and skip silently if the file is absent. Every clause
> was a problem. The id scan collides where ids are non-sequential
> (region-desk has `fr-dev-server-zombie` sitting among numbered ones). The
> append is a read-modify-write on a shared file. The summary drifted — 8
> claimed against 11 actual. And "skip silently if absent" meant the repos
> with the least set up recorded nothing at all, which is backwards: those
> are the repos hitting the most friction.
>
> `.cwos-feedback.yaml` is now a generated view (`cwos-feedback-view.js`),
> not a write target.

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

### 5.5d. Record stage marker — **moved to `/session-start` Step 3d (ADR-065)**

`/session-start` now stamps `last_recorded_stage` immediately after it compares
against it. Nothing to do here.

Why it moved: leaving it at session close meant a stage change went unreported
whenever the prior session was not closed by hand — about 88% of the time.
Note it could *not* move into `cwos-reconcile` with the other mechanical steps,
because reconcile runs at SessionStart and would stamp the marker before the
comparison that reads it, permanently suppressing the very transition the marker
exists to detect.

### 5.6. Regenerate System Summary — **no longer this command's job (ADR-065)**

`cwos-reconcile.js` regenerates `.claude/workstream/system-summary.yaml`, and
reconcile runs from the SessionStart hook. Nothing to do here.

Why it moved: this command was the file's only writer, and it runs ~12% of the
time. The summary sat **10 days stale** (last written 2026-07-24) while
`claude-preamble.md` told every Standard-Mode session to read it *first* for
fast orientation. Every field in it is a pure function of reconciled state, so
it never needed a session boundary.

One field is deliberately **not** recomputed by reconcile: `vital_signs_ok` /
`red_vitals`. Reconcile does not run the invariant suite, so it carries the
previous values forward with `vitals_observed_at` stamped beside them rather
than fabricating a green line. If you have just run `/verify` and the vitals
picture changed, update those two fields — that is the only part of this step
that still belongs to a session.

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

> **If this command never runs, this still happens.** `cwos-session-sweep.js`
> closes any session whose process is gone — releasing claims, synthesizing
> handoff notes from git log and sprint state, clearing locks — every 15 minutes
> via the `Fleet-SessionSweep` task, across every repo on the node. A dead PID
> is proof of death and needs no timeout (ADR-065).
>
> So running `/session-end` is a courtesy, not a safety requirement. What it
> still uniquely provides is the part a machine cannot reconstruct from disk:
> the decisions and friction of the conversation itself, and your own words in
> the handoff notes.

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
