---
description: View and manage the project backlog
argument-hint: [action: "status" | "add" | "complete" | "delegate" | task description]
---

# Backlog Command

You are managing the unified project backlog at `.claude/BACKLOG.md`.

## Action: $ARGUMENTS

### If no arguments or "status":
1. Read `.claude/BACKLOG.md`
2. Display a formatted summary:
   - **Active Work**: Current session tasks and active projects
   - **Delegated**: Tasks assigned to local models awaiting completion
   - **Pending**: Tasks by priority (P0-P3)
   - **Local Model Updates**: Any unprocessed updates from local models
3. If there are unprocessed local model updates, incorporate them into the appropriate sections

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

### If "delegate [task-id] [model]":
1. Find the task by ID
2. Move it to the "Delegated to Local Models" section
3. Set status to "delegated"
4. Suggest the appropriate `/local-*` command
5. Output the `///LOCAL_TASKS` JSON block for the delegation

### If task description (no keyword):
1. Analyze the task
2. **Decompose into atomic tasks** (per DECOMPOSITION_POLICY.md Section 10)
3. **Auto-execute via local models** - NO asking for confirmation
4. If task is already atomic and has no model assignment:
   - Assign model per policy (deepseek/qwen)
   - Create ///LOCAL_TASKS JSON
   - Execute automatically
5. Report progress only: "Task T-001 completed"

## Local Model Update Processing

When you see entries in the "Local Model Updates" section:
1. Parse each update
2. Find the corresponding task in "Delegated to Local Models"
3. If status is "completed":
   - Move task to "Completed" section
   - Note any output files
4. If status is "failed" or "blocked":
   - Update status in Delegated section
   - Add notes about what went wrong
5. Clear processed updates from the Local Model Updates section

## Output Format

Always show:
```
📋 BACKLOG STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Active: [count] tasks
🟡 Delegated: [count] awaiting local model completion
🟢 Pending: [count] ready to start
📦 Completed: [count] this week

[Relevant details based on action]
```
