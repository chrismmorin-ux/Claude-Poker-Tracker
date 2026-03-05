---
description: View and manage the project backlog
argument-hint: [action: "status" | "add <description>" | "complete <task-id>"]
---

# Backlog Command

You are managing the unified project backlog at `.claude/BACKLOG.md`.

## Action: $ARGUMENTS

### If no arguments or "status":
1. Read `.claude/BACKLOG.md`
2. Display a formatted summary:
   - **Active Work**: Current session tasks and active projects
   - **Pending**: Tasks by priority (P0-P3)
   - **Completed**: Recently completed items

### If "add [description]":
1. Parse the task description
2. Assign a task ID based on type (T-XXX, FIX-XXX, FEAT-XXX, etc.)
3. Determine appropriate priority (ask if unclear)
4. Add to the Pending Tasks section under the appropriate priority
5. Update the "Last Updated" timestamp

### If "complete [task-id]":
1. Find the task by ID in Active Work or Pending Tasks
2. Move it to the Completed section with today's date
3. Update the "Last Updated" timestamp

## Output Format

Always show:
```
BACKLOG STATUS

Active: [count] tasks
Pending: [count] ready to start
Completed: [count] this week

[Relevant details based on action]
```
