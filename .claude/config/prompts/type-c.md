// .claude/config/prompts/type-c.md

# Type C: Creative Generation (RISKY for local models)

## Characteristics
- Write new logic from requirements
- Design data structures
- Choose algorithms
- Make architectural decisions

## Examples
- Implement new feature from description
- Design API interface
- Write complex business logic

## Success Criteria
- Expected success rate: ~50% (RISKY task type)
- Requires extensive specification and examples
- Escalate after 2 consecutive failures

---

## Prompt Template

### Task Title
{{TASK_TITLE}}

### File Path
{{FILE_PATH}}

### Requirements
{{REQUIREMENTS}}

### Examples
{{EXAMPLES}}

### Constraints
{{CONSTRAINTS}}

### Additional Context
{{CONTEXT}}

---

## Edit Strategy
Use `edit_strategy: "create_new"` for Type C tasks:
- Write complete new file or module section
- Do not rely on incremental edits
- Provide full implementation from requirements

---

## Important Notes

### Expected Failure Rate
This task type has an estimated 50% failure rate. This is normal for creative generation tasks with local models. Please:
- Provide extensive examples and context
- Be explicit about requirements and constraints
- Include reference implementations if available

### Fallback Instructions
If this task fails (max 2 attempts with corrections):
1. **First failure**: Review requirements, add clarifications, retry
2. **Second failure**: Escalate to Claude Opus 4.5 for semantic understanding
   - File: Create escalation request to `.claude/permission-requests.json`
   - Include: Full task context, both attempt outputs, and analysis of why they failed
   - Reason: "Type C task (creative generation) exceeded local model retry threshold"

### Quality Checklist
- [ ] Requirements are complete and unambiguous
- [ ] Examples cover main use cases
- [ ] Constraints are explicit (especially negative cases)
- [ ] Context includes relevant architectural decisions
- [ ] Output is syntactically valid code
- [ ] Implementation follows project patterns
- [ ] Edge cases are handled

---

## Usage Example

```json
{
  "type": "local_task",
  "task_id": "T-DEV-XXX",
  "title": "Design user settings reducer",
  "assigned_to": "local:qwen",
  "edit_strategy": "create_new",
  "prompt_file": ".claude/config/prompts/type-c.md",
  "template_vars": {
    "TASK_TITLE": "Design user settings reducer",
    "FILE_PATH": "src/reducers/settingsReducer.js",
    "REQUIREMENTS": "...",
    "EXAMPLES": "...",
    "CONSTRAINTS": "...",
    "CONTEXT": "..."
  },
  "max_retries": 2,
  "escalation_on_failure": true
}
```
