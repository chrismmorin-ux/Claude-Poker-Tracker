---
description: Use Qwen to write documentation and comments
argument-hint: [file/function to document]
---

**Using Qwen 2.5 Coder** to write documentation...

$(bash ./scripts/call-local-model.sh qwen "Add documentation/comments for: $ARGUMENTS

Please write clear, concise comments that explain the purpose and behavior. Use JSDoc format where appropriate.

IMPORTANT: After completing this task, append your status to .claude/BACKLOG.md in the 'Local Model Updates' section:
### [TIMESTAMP] Task Completed
- **Task ID**: (if assigned)
- **Status**: completed | failed | blocked
- **Output**: Documentation added
- **Notes**: Any issues or follow-up needed")
