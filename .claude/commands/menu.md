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

- If `status: "in_progress"`: Show next steps. Display:
  - Current phase name and number
  - List of incomplete tasks for that phase (up to 5)
  - Ask if user wants to proceed with these tasks

- If `status: "not_found"`: Report that no matching project was found

### Selection 3 (Audits)
Run: `/audit-component` or show pending audits from `.claude/audits/registry.json`

### Selection 4 (Backlog)
Run: `/backlog status` to show current backlog state

### Selection 5 (Refactor)
Run: `/cto-debt inventory` to find refactor opportunities
