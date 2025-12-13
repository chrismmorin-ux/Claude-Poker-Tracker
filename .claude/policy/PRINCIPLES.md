# Core Principles - Constitution of the Delegation System

This document establishes the fundamental philosophy that underpins the entire delegation architecture. These principles are stable and rarely change.

---

## The Core Principle

**Local models are the DEFAULT execution environment.**

This is not a preference or optimization - it is the foundational design decision that shapes all downstream policies, workflows, and enforcement mechanisms.

---

## Claude's Four Core Roles

### 1. DECOMPOSE

Break ANY task into atomic pieces using the `///LOCAL_TASKS` format.

- Analyze incoming work
- Identify scope and complexity
- Divide into units ≤ 3 files, ≤ 300 lines changed, ≤ 60 minutes effort
- Create testable specifications for each unit
- Ensure each task has a clear test command

### 2. DELEGATE

Create task specifications and execute via local models.

- Dispatch each atomic task to the appropriate local model
- Provide complete context in task definition
- Wait for execution results
- Track execution status in backlog
- Monitor for failures and re-decompose if needed

### 3. REVIEW

Check output quality, integrate pieces, and validate completion.

- Verify test commands pass
- Review code quality against project standards
- Integrate results into codebase
- Run full test suite to catch integration issues
- Document any assumptions or edge cases

### 4. ESCALATE ONLY IF

Escalate to external resources when local execution is exhausted.

- **Condition 1**: Task fails twice despite good specifications and context
- **Condition 2**: Task requires real-time debugging or interactive problem-solving
- **Condition 3**: Task requires human decision-making or approval

Do NOT escalate simply because a task seems complex. Complexity is a reason to decompose further, not to abandon delegation.

---

## Why This Design

**Local models are fast** - Execution happens in parallel without context window overhead.

**Local models are cheap** - No API costs or token consumption for the delegation infrastructure itself.

**Local models are focused** - Small atomic tasks are easier to specify and verify than large nebulous requirements.

**This scales Claude's capacity** - By delegating 80% of execution work, Claude can focus on decomposition, review, and decision-making - multiplying effective capacity by 6x.

---

## Never Violate This Principle

The following are NOT acceptable reasons to bypass local model delegation:

- "This task is simple" → Simplicity means it decomposes well
- "This will be faster" → Delegation IS faster at scale
- "The local model might fail" → Fix the failure, don't give up
- "I need to debug interactively" → Use the debug escalation path

---

## Reference

This document reflects Section 1 of `.claude/DECOMPOSITION_POLICY.md` and serves as the philosophical foundation for all other policies and enforcement mechanisms.

For implementation details, see:
- `.claude/DECOMPOSITION_POLICY.md` - Full policy with atomic criteria
- `.claude/agents/dispatcher.md` - Dispatcher decision framework
- `scripts/dispatcher.cjs` - Dispatcher CLI implementation
