# Project Management Command

Manage projects across chat sessions. Argument: $ARGUMENTS

## Usage

```
/project status              - Show all projects with completion status
/project start <name>        - Create a new project from template
/project resume <id>         - Load project context and continue work
/project complete <id>       - Mark project complete and prompt for archive
/project archive <id>        - Move completed project to archive
/project list                - List all project files
```

## Instructions

Based on the argument "$ARGUMENTS", perform ONE of the following:

### If argument is "status" or empty:
1. Read `.claude/projects.json`
2. Display a formatted table showing:
   - Active projects with completion percentage
   - Pending projects
   - Recently completed projects (last 5)
3. For active projects, show the current phase

### If argument starts with "start":
1. Extract the project name from the argument
2. Copy `docs/projects/TEMPLATE.project.md` to `docs/projects/<name>.project.md`
3. Update the template with:
   - Generate a kebab-case ID from the name
   - Set created date to today
   - Set status to "active"
4. Add the project to `.claude/projects.json` active array
5. Open the new project file for the user to fill in

### If argument starts with "resume":
1. Extract the project ID from the argument
2. Find the project in `.claude/projects.json`
3. Read the project file
4. Identify the current phase (marked with `← CURRENT` or first incomplete `[ ]`)
5. Check for pre-decomposed tasks with model assignments
6. **If tasks have model assignments: AUTO-EXECUTE** (per DECOMPOSITION_POLICY.md Section 10)
   - DO NOT ask "should I proceed?"
   - Execute tasks automatically via local models
   - Report progress only: "Task T-001 completed"
7. If tasks lack model assignments: decompose per policy, then auto-execute
8. Display:
   - Project overview
   - Current phase details (if not auto-executing)
9. Read any "Context Files" listed in the project (if needed)

### If argument starts with "complete":
1. Extract the project ID
2. Find the project file in `docs/projects/`
3. Verify all phases are marked complete in the project file
4. If not all complete, show what remains and ask to continue
5. If all complete, perform full closeout:
   - Update project status to "Complete" in the project file
   - Move from "active" to "completed" array in projects.json (if exists)
   - Set completedAt date
   - **Auto-archive**: Move project file to `docs/archive/` with naming: `archived.XXX.MMDD-<name>.project.md`
   - Update BACKLOG.md: move project to "Completed Projects" section
   - Report: "Project archived to docs/archive/<filename>"

### If argument starts with "archive":
1. Extract the project ID
2. Find the project file (check both `docs/projects/` and completed array)
3. Move the project file to `docs/archive/` with naming: `archived.XXX.MMDD-<name>.project.md`
4. Update the file path in projects.json if present
5. Mark archived: true
6. Report the archive location

### If argument is "list":
1. List all files in `docs/projects/` (active)
2. List all files in `docs/archive/` (archived, naming: `archived.XXX.*`)

## Important

- Always update `.claude/projects.json` after any changes
- Always update `lastUpdated` timestamp in projects.json
- Keep project files in sync with registry
- Use TodoWrite to track multi-step operations
