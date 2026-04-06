---
description: Show plain-English project dashboard for the owner
argument-hint: ["" | "refresh"]
---

# Status Dashboard Command

You are showing the project owner a clear, plain-English view of what's happening across all sessions and workstreams.

## Action: $ARGUMENTS

### If no arguments or "refresh":

1. Read `.claude/STATUS.md`
2. Read ALL files in `.claude/handoffs/` to get live session data
3. Read ALL files in `.claude/programs/` for program health
4. Run `git status` for uncommitted changes
5. Run `git log --oneline -5` for recent commits
6. Read `.claude/BACKLOG.md` for active item counts
7. If `.claude/health-snapshots.json` exists, read it for trend data

6. Present the dashboard in this format:

```
PROJECT DASHBOARD
=================

ACTIVE SESSIONS
[For each ACTIVE handoff file:]
  Session: [name]
  Working on: [backlog item + plain description]
  Files owned: [count] ([list if ≤5])
  Started: [date]
  Status: [ACTIVE / STALE (>6h old)]

WHAT'S BEEN DONE RECENTLY
[From STATUS.md Recently Completed + git log]
  - [item] — [date]

WHAT NEEDS YOUR ATTENTION
[Items requiring owner action:]
  - [X] items in REVIEW status (need your approval or rejection)
  - [Stale sessions that may be dead]
  - [Uncommitted changes at risk]
  - [File ownership conflicts between sessions]

BACKLOG SNAPSHOT
  In Progress: [count] items
  Ready (NEXT): [count] items
  Blocked: [count] items
  Paused: [count] items

PROGRAM HEALTH
  Security:        [GREEN/YELLOW/RED] — [one-line summary from program file]
  Engine Accuracy: [GREEN/YELLOW/RED] — [one-line summary]
  UI Quality:      [GREEN/YELLOW/RED] — [one-line summary]
  Test Health:     [GREEN/YELLOW/RED] — [one-line summary]

HEALTH
  Tests: [last known count] passing [trend vs previous snapshot if available]
  Uncommitted files: [count from git status]
  Last eng-engine audit: [date]
  Stale docs: [list any with last-verified-against-code > staleness-threshold-days]
```

### If "refresh":

Same as above, but also:
1. Check each ACTIVE handoff — if >6 hours old, flag as potentially stale
2. Check `last-verified-against-code` frontmatter in all `.claude/context/*.md` files — flag any where today minus the date exceeds `staleness-threshold-days`
3. Update `.claude/STATUS.md` with refreshed data
4. Show any discrepancies between STATUS.md and actual handoff/backlog state

## Important

- **Write for a non-technical owner** — no jargon, no file paths unless necessary. "The NaN bug fix" not "safeDiv() guard in gameTreeEquity.js".
- **Highlight action items** — what does the owner need to decide or approve?
- **Flag risks prominently** — uncommitted work, stale sessions, conflicts.
- **Keep it short** — this is a glance, not a report. Details are in handoff files and backlog.
