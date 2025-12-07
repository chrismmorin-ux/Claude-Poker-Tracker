---
description: Decompose a feature or initiative into tasks with the CTO-Agent
argument-hint: [feature or initiative description]
---

Use the **cto-agent** subagent to decompose this work into a structured task backlog.

## Initiative to Decompose

$ARGUMENTS

## Requirements

1. Read `engineering_practices.md` for standards and role definitions
2. Read `CLAUDE.md` for current architecture context
3. Analyze the initiative and break it down into:
   - Independent, parallelizable tasks where possible
   - Clear dependencies between tasks
   - Appropriate owner assignments (senior, junior, ai:less-capable, ai:research)

## Expected Output

For each task, produce JSON in this format:

```json
{
  "id": "<short-id>",
  "title": "<one-line>",
  "summary": "<one-paragraph>",
  "type": "<feature|bug|refactor|investigation|research|ops|doc>",
  "priority": "<P0|P1|P2>",
  "owner": "<senior|junior|ai:less-capable|ai:research|ai:capable>",
  "inputs": ["required files, APIs, data"],
  "outputs": ["PR, doc, tests, metrics"],
  "acceptance_criteria": ["1.", "2.", "3."],
  "estimated_effort": {"developer_days": "X", "ai_tokens": "low|medium|high"},
  "risk": "<low|medium|high>",
  "dependencies": ["task-ids"],
  "workflow_guidance": "step-by-step for junior/ai:less-capable owners"
}
```

Also provide:
- A dependency graph (which tasks block which)
- Critical path identification
- Total effort estimate
- Key risks and mitigations
