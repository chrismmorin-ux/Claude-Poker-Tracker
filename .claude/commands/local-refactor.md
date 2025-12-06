---
description: Use Qwen for refactoring tasks (rename, extract, restructure)
argument-hint: [refactoring description]
---

**Using Qwen 2.5 Coder** for refactoring...

$(bash ./scripts/call-local-model.sh qwen "Refactoring task: $ARGUMENTS

Please provide clean, well-structured code that follows best practices. Focus on improving code organization and readability.")
