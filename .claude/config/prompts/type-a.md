// .claude/config/prompts/type-a.md

# Type A: Mechanical Edit (BEST for local models)

## Characteristics:
- Delete specific lines
- Replace exact strings
- Insert content at specific locations
- Copy-paste with minimal changes
- No semantic understanding required

## Examples:
- Remove dependency: Delete lines 4-6 containing `require('showdown')`
- Fix typo: Replace "processs" with "process" in line 42
- Add import: Insert `const path = require('path');` after line 3

## When to use:
- Ideal for local models when using `edit_strategy: "incremental_edit"`
- Provide explicit line numbers and exact content
- Use `edit_operations` array for structured edits

## Success criteria: Local models can execute with >90% reliability

---

**Prompt Template:**
