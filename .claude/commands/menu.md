---
description: Show the session startup menu with projects, audits, and backlog status
---

Run the startup menu script and display the output to help the user choose what to work on:

```bash
node scripts/menu.cjs
```

After running, summarize the menu options shown and ask the user which they'd like to pursue.

---

## Handling User Selection

When the user responds with a number (1-5) or describes what they want to do:

### Selection 1 or 2 (Project)
Run the project analyzer to determine next steps:
```bash
node scripts/project-analyzer.cjs <selection-number>
```

Based on the analyzer output:

- If `status: "complete"`: Project is ready for closeout. Present options IN THIS ORDER:
  1. **Verify first** (default) - Check unchecked items to confirm files exist and functionality works, then close out
  2. **Close out now** - Mark complete, move remaining unchecked items to backlog as appropriate priority tasks
  3. **Mark blocked** - If closeout is blocked by something (e.g., needs testing infrastructure, waiting on dependency), mark project as BLOCKED with reason
  4. **Deprioritize** - Push project back in queue (change priority from P1 to P2, or sequence number), so next menu shows a different project first
  5. **Work on something else** - Leave project as-is for now, but show the next project or backlog options

- If `status: "in_progress"`: Check for pre-decomposed atomic tasks:
  1. **Read the project file** to check if tasks have model assignments (deepseek/qwen/claude)
  2. **If tasks have model assignments** (pre-decomposed):
     - Display current phase name and tasks
     - **Automatically execute via local models** - Do NOT ask for confirmation
     - Create task spec JSON files in `.claude/task-specs/<project-name>/`
     - Execute each task: `bash scripts/execute-local-task.sh <spec-file>`
     - Update project file task status as tasks complete
     - Run tests if specified in execution order
  3. **If tasks lack model assignments** (not decomposed):
     - Display current phase and tasks
     - Follow decomposition policy: classify tasks, decompose if needed
     - Do NOT offer to execute directly unless policy authorizes it

- If `status: "not_found"`: Report that no matching project was found

### Selection 3 (Audits)
Read `.claude/audits/registry.json` and analyze pending audits:

```bash
node -e "const r=require('./.claude/audits/registry.json'); const p=r.audits.filter(a=>a.status==='pending'); console.log(JSON.stringify({total:p.length,high:p.filter(a=>['high','critical'].includes(a.severity)).length,audits:p.slice(0,5)},null,2))"
```

Based on the output:
- If **no pending audits**: Report "No pending audits. All clear!"
- If **pending audits exist**: Show summary and present options:
  1. **Review highest severity first** - Read the most critical/high audit file and show findings
  2. **List all pending** - Show full list with severity and summary
  3. **Action an audit** - Mark a specific audit as actioned
  4. **Skip audits** - Return to menu or work on something else

For each audit review:
- Read the audit file from `.claude/audits/<filename>`
- Summarize key findings and recommendations
- Ask if user wants to action it (mark as addressed) or defer

### Selection 4 (Backlog)
Read `.claude/BACKLOG.md` and show actionable status:

Present options:
1. **Show full backlog** - Display all tasks by priority with counts
2. **P0/P1 tasks only** - Focus on urgent/high priority items
3. **Add a task** - Prompt for task description, assign ID and priority
4. **Complete a task** - Mark a task as done
5. **Return to menu** - Go back to main options

When showing backlog, group by:
- **Active Projects**: Link to project files with phase status
- **P0 (Urgent)**: Tasks needing immediate attention
- **P1 (High)**: Important tasks to do soon
- **P2-P3 (Normal/Low)**: Tasks that can wait

### Selection 5 (Refactor Opportunities)
This is a discovery action. Run CTO-level analysis to find improvement areas:

1. First, scan for common refactor signals:
   ```bash
   # Check for large files (>400 lines)
   find src -name "*.js" -o -name "*.jsx" | xargs wc -l | sort -rn | head -10
   ```

2. Present options:
   1. **Large file analysis** - Identify files over 400 lines that could be split
   2. **Duplicate code scan** - Find similar patterns across files
   3. **TODO/FIXME scan** - Find commented technical debt
   4. **Test coverage gaps** - Identify untested modules
   5. **Run full /cto-debt inventory** - Comprehensive analysis

Based on findings, present actionable recommendations:
- If refactor opportunity found: Ask to add to backlog or start working
- If nothing significant: Report "Codebase looks clean!" and suggest returning to menu

---

## Edge Cases & General Guidance

### User Types Free Text Instead of Number
- Parse intent: "work on firebase" → Selection 2 (if firebase-auth is next project)
- Parse intent: "check my tasks" → Selection 4 (Backlog)
- Parse intent: "any issues to fix?" → Selection 3 (Audits) or 5 (Refactor)
- If unclear, ask for clarification with numbered options

### Empty States
- **No projects**: Offer to create a new project or show backlog
- **No audits**: Report clean state, suggest other options
- **No backlog tasks**: Celebrate! Suggest refactor scan or new project

### Returning to Menu
When an action is complete (e.g., project closed out, audit reviewed):
- Offer to return to menu with `/menu`
- Or suggest next logical action based on what was just done

### Session Context
The menu should be aware of:
- Current time (morning = fresh start suggestions, late = wrap-up suggestions)
- Files already modified this session (from `.claude/.pm-state.json`)
- Token budget status (from same file)

If token budget is high (>70%), suggest:
- Smaller tasks from backlog
- Quick audit reviews
- Commit and wrap-up

### Error Handling
If any script or command fails:
1. Report the error clearly
2. Suggest manual alternative (e.g., "Try reading the file directly")
3. Offer to return to menu
