---
description: Manage projects across sessions with multi-session safety
argument-hint: ["status" | "start <name>" | "resume <id>" | "closeout <id>" | "list"]
---

# Project Management Command

Manage projects across chat sessions with multi-session coordination. Argument: $ARGUMENTS

## Session Start Protocol (MANDATORY before any action)

Before executing any subcommand:
1. Read `.claude/STATUS.md` — understand current state
2. Read ALL files in `.claude/handoffs/` — know what other sessions own
3. Check for file ownership conflicts with your intended work

---

## Usage

```
/project status              - Show dashboard from STATUS.md
/project start <name>        - Create new project, claim files, update all tracking
/project resume <id>         - Orient from handoffs + project file, then continue
/project closeout <id>       - Verify completion, archive, release claims
/project list                - List all active and archived project files
```

## Instructions

Based on the argument "$ARGUMENTS", perform ONE of the following:

### If "status" or empty:

1. Read `.claude/STATUS.md`
2. Read ALL files in `.claude/handoffs/`
3. Read `.claude/BACKLOG.md` for item counts
4. Display formatted dashboard:

```
PROJECT DASHBOARD
=================

Active Sessions: [count]
[Table of active sessions from handoffs]

Backlog: [IN_PROGRESS count] active, [NEXT count] ready, [BLOCKED count] blocked
Recently Completed: [last 5 from STATUS.md]

Alerts:
- [Any stale sessions, conflicts, or risks]
```

### If "start <name>":

1. Extract the project name
2. Generate a kebab-case ID
3. **Check for file conflicts**: read all ACTIVE handoffs, ensure no overlap with files this project will touch
4. Copy `docs/projects/TEMPLATE.project.md` to `docs/projects/<id>.project.md`
5. Update the template with project name, ID, today's date, status "active"
6. Add project to `.claude/projects.json` active array
7. Add a backlog item to `.claude/BACKLOG.md` in the NOW section with status IN_PROGRESS
8. Create a handoff file in `.claude/handoffs/<id>.md` with ACTIVE status
9. Update `.claude/STATUS.md` Active Sessions table
10. Open the new project file for the user to review

### If "resume <id>":

1. **Read ALL handoff files first** — understand what other sessions are doing and which files are owned
2. Find the project in `.claude/projects.json`
3. Read the project file
4. If a handoff file exists for this project, read it for context from the last session
5. Identify the current phase (first incomplete phase)
6. Check for file conflicts between this project's files and other ACTIVE sessions
7. If conflicts found: report them and ask user how to proceed
8. If no conflicts: create/update a handoff file for this session, claim relevant files
9. Display:

```
RESUMING: [Project Name]
Phase: [current] of [total] ([percentage]%)

Last Session Context:
[Summary from handoff file, or "No previous handoff found"]

Current Phase: [phase name]
Goal: [phase goal]
Next steps: [from handoff or phase checklist]

File Conflicts: [none | list of conflicts]
```

### If "closeout <id>":

1. Find the project file
2. **Run verification gate:**
   - [ ] All phases marked complete in project file
   - [ ] Tests passing (check last known test status from handoff)
   - [ ] Acceptance criteria met for each phase (review against project file)
   - [ ] All changes committed (check git status)
   - [ ] System Model current (any architectural changes reflected in SYSTEM_MODEL.md)
3. If any gate fails: show what's incomplete and ask user whether to proceed anyway
4. If all gates pass (or user approves):
   - Move from "active" to "completed" in `.claude/projects.json` with completedAt date
   - Move project file to `docs/archive/`
   - Update `.claude/BACKLOG.md` — move related items to DONE (or note in archive)
   - Update `.claude/STATUS.md` — remove from Active Sessions, add to Recently Completed
   - Mark handoff file status as COMPLETE, clear "Files I Own"
   - Display completion summary

### If "list":

1. List all files in `docs/projects/` (active)
2. List all files in `docs/archive/` (archived)
3. Show which projects have ACTIVE handoff files

## Important

- Always update `.claude/projects.json` after any changes
- Always update `.claude/STATUS.md` after any changes
- Always check handoff files for file ownership conflicts before starting work
- Keep project files in sync with registry and backlog
- The owner is non-technical — write all output in plain English
