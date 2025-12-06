---
description: Use Qwen to write documentation and comments
argument-hint: [file/function to document]
---

**Using Qwen 2.5 Coder** to write documentation...

$(bash ./scripts/call-local-model.sh qwen "Add documentation/comments for: $ARGUMENTS

Please write clear, concise comments that explain the purpose and behavior. Use JSDoc format where appropriate.")
