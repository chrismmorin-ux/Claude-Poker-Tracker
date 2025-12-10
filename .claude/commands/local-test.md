---
description: Use Qwen to generate unit tests
argument-hint: [file or function to test]
---

**Using Qwen 2.5 Coder** to generate tests...

$(bash ./scripts/call-local-model.sh qwen "Generate unit tests for: $ARGUMENTS

Please create comprehensive test cases covering normal cases, edge cases, and error conditions. Use a modern testing framework.

IMPORTANT: After completing this task, append your status to .claude/BACKLOG.md in the 'Local Model Updates' section:
### [TIMESTAMP] Task Completed
- **Task ID**: (if assigned)
- **Status**: completed | failed | blocked
- **Output**: Test file created
- **Notes**: Any issues or follow-up needed")
