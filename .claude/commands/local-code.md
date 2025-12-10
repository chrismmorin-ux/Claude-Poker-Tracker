---
description: Use DeepSeek to generate new code/boilerplate
argument-hint: [description of code to generate]
---

**Using DeepSeek Coder** to generate code...

$(bash ./scripts/call-local-model.sh deepseek "Generate code for: $ARGUMENTS

Please create clean, production-ready code following modern best practices and coding standards.

IMPORTANT: After completing this task, append your status to .claude/BACKLOG.md in the 'Local Model Updates' section:
### [TIMESTAMP] Task Completed
- **Task ID**: (if assigned)
- **Status**: completed | failed | blocked
- **Output**: Description of what was created
- **Notes**: Any issues or follow-up needed")
