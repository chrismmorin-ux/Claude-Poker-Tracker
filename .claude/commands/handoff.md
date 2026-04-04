---
description: Write or manage session handoff files for multi-session continuity
argument-hint: ["" | "status" | "cleanup"]
---

# Session Handoff Command

You are managing per-session handoff files in `.claude/handoffs/`.

Each Claude session gets its own handoff file so multiple sessions can run concurrently without conflicts. Handoff files track what each session is working on, which files it owns, and what the next session should know.

## Action: $ARGUMENTS

### If no arguments (write/update handoff):

1. Determine a short session ID from the current work (e.g., `rt2-nan-firewall`, `pm-overhaul`)
2. Run `git status` to capture uncommitted changes
3. Write `.claude/handoffs/<session-id>.md` with this structure:

```markdown
# Session Handoff: <session-id>
Status: ACTIVE | Written: <date>

## Backlog Item
<ID and description of what this session is working on>

## What I Did This Session
<Bullet list of concrete accomplishments>

## Files I Own (DO NOT EDIT)
<List of files this session is actively modifying — other sessions must not touch these>

## Uncommitted Changes
<From git status — list modified/new files not yet committed>

## What's Next
<Specific next steps for this or the next session to pick up>

## Gotchas / Context
<Non-obvious things the next session needs to know — architectural decisions, edge cases found, things NOT to do>

## System Model Updates Needed
<Did this session change architecture, add invariants, discover coupling, or make decisions that should be reflected in SYSTEM_MODEL.md? If yes, list what needs updating.>

## Test Status
<Last test run results — passing count, any failures>
```

4. If completing work, set Status to `COMPLETE` and clear "Files I Own"
5. Update `.claude/STATUS.md` Active Sessions table to reflect this session
6. If a backlog item was completed, run `/backlog complete <id>` logic

### If "status":

1. Read ALL files in `.claude/handoffs/`
2. Display a summary table:

```
SESSION HANDOFFS

| Session | Status | Working On | Files Owned | Age |
|---------|--------|-----------|-------------|-----|
| rt2-nan | ACTIVE | RT-2 NaN firewall | 3 files | 2h |
| pm-over | COMPLETE | PM overhaul | 0 files | 1d |

ALERTS:
- [session-id] is ACTIVE but 6+ hours old (possibly dead session)
- [file.js] is owned by multiple sessions (CONFLICT)
```

3. Flag stale sessions: ACTIVE status but handoff file >6 hours old
4. Flag file conflicts: same file listed in "Files I Own" by multiple ACTIVE sessions

### If "cleanup":

1. Read all files in `.claude/handoffs/`
2. Delete files where Status is `COMPLETE` and file is >7 days old
3. Report what was cleaned up

## Important

- **Every session should write a handoff** — even if work is incomplete. Session death without a handoff loses all context.
- **"Files I Own" is a coordination signal** — before editing any file, check all ACTIVE handoffs. If another session owns a file, DO NOT edit it. Report the conflict to the user.
- **Keep handoff files concise** — they're working documents, not documentation. Focus on what the NEXT session needs to know.
- **Update STATUS.md** after writing a handoff — the owner dashboard should always reflect current session state.
