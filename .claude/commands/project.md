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
5. Display:
   - Project overview
   - Current phase details
   - Next actions to take
6. Read any "Context Files" listed in the project

### If argument starts with "complete":
1. Extract the project ID
2. Find the project in `.claude/projects.json`
3. Verify all phases are marked complete in the project file
4. If not all complete, show what remains
5. If all complete:
   - Move from "active" to "completed" array in projects.json
   - Set completedAt date
   - Ask if user wants to archive now

### If argument starts with "archive":
1. Extract the project ID
2. Find the project in completed array
3. Move the project file from `docs/projects/` to `docs/archive/`
4. Update the file path in projects.json
5. Mark archived: true

### If argument is "list":
1. List all files in `docs/projects/` (active)
2. List all files in `docs/archive/` (archived)

## Important

- Always update `.claude/projects.json` after any changes
- Always update `lastUpdated` timestamp in projects.json
- Keep project files in sync with registry
- Use TodoWrite to track multi-step operations
