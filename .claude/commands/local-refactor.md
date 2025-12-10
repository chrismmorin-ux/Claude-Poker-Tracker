---
description: Use Qwen for refactoring tasks (rename, extract, restructure)
argument-hint: [refactoring description]
---

**Using Qwen 2.5 Coder** for refactoring...

$(bash ./scripts/call-local-model.sh qwen "Refactoring task: $ARGUMENTS

Please provide clean, well-structured code that follows best practices. Focus on improving code organization and readability.

IMPORTANT: After completing this task, append your status to .claude/BACKLOG.md in the 'Local Model Updates' section:
### [TIMESTAMP] Task Completed
- **Task ID**: (if assigned)
- **Status**: completed | failed | blocked
- **Output**: Description of changes made
- **Notes**: Any issues or follow-up needed")
