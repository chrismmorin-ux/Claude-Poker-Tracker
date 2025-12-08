---
description: Analyze work session efficiency and suggest workflow improvements
argument-hint: ["quick" | "detailed" | default balanced analysis]
---

# Efficiency Analysis

Analyzing your work session for efficiency improvements...

## Analysis Scope: $ARGUMENTS

Use the **cto-agent** subagent to perform a comprehensive workflow efficiency analysis.

## Data Sources

1. **Session Metrics** - Read `.claude/.efficiency-session.json` for:
   - Edit velocity and patterns (files, lines, timestamps)
   - File churn indicators (repeated edits to same files)
   - Read patterns (sequential vs parallel)
   - Agent invocations during session
   - Tool usage counts

2. **Review Session** - Read `.claude/.edit-review-session.json` for:
   - Total edits and lines changed
   - Whether code review was suggested/run

3. **Project Context** - Read `CLAUDE.md` sections on:
   - Local model decision tree
   - When to use specialized agents
   - Token optimization guidelines

## Analysis Checklist

### Agent Usage Analysis
- [ ] Were appropriate agents invoked (code-reviewer, component-auditor, Explore)?
- [ ] Was the Task tool used when Explore agent would be faster?
- [ ] Were specialized agents used proactively vs reactively?

### Local Model Opportunities
- [ ] Could any tasks have been delegated to `/local-code`, `/local-refactor`, `/local-doc`, `/local-test`?
- [ ] Were simple utility functions written by Claude that local models could handle?
- [ ] Were PropTypes or mechanical updates done by Claude instead of `/local-refactor`?

### Token Efficiency
- [ ] Were file reads done in parallel or sequentially?
- [ ] Was the Explore agent used for codebase understanding?
- [ ] Were full files read when Grep could find specific patterns?
- [ ] Were edits batched or made individually?

### Code Quality Process
- [ ] Was `/review staged` run after significant changes?
- [ ] Was `/audit-component` run after modifying React components?
- [ ] Were docs updated when source files changed?

### File Churn Analysis
- [ ] Which files were edited multiple times (refactoring candidates)?
- [ ] Were there cascading fixes indicating unclear design?
- [ ] Should any high-churn files be refactored?

## Output Format

Provide a structured report:

### 1. Efficiency Score (1-10)
Rate the session based on workflow adherence and optimization opportunities.

### 2. Key Findings
| Category | Finding | Impact |
|----------|---------|--------|
| Agent Usage | ... | High/Medium/Low |
| Local Models | ... | ... |
| Token Efficiency | ... | ... |
| Code Quality | ... | ... |

### 3. Quick Wins
List 1-3 things that could immediately improve efficiency in future sessions.

### 4. High-Churn Files
List files that were edited 3+ times (candidates for refactoring or clearer design).

### 5. Missed Agent Opportunities
Specific instances where an agent should have been invoked but wasn't.

### 6. Recommended Actions
Prioritized list of workflow improvements:
1. [Highest priority action]
2. [Next priority action]
3. ...

## Analysis Modes

- **quick**: Summary of key issues only (5-10 lines)
- **detailed**: Full analysis with all sections above
- **(default)**: Balanced analysis with findings and recommendations

## Example Usage

```bash
/efficiency-analysis              # Default balanced analysis
/efficiency-analysis quick        # Quick summary
/efficiency-analysis detailed     # Full deep-dive
```
