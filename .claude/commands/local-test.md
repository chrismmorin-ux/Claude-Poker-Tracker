---
description: Use Qwen to generate unit tests
argument-hint: [file or function to test]
---

**Using Qwen 2.5 Coder** to generate tests...

$(bash ./scripts/call-local-model.sh qwen "Generate unit tests for: $ARGUMENTS

Please create comprehensive test cases covering normal cases, edge cases, and error conditions. Use a modern testing framework.")
