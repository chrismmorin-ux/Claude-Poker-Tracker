# Decomposition Policy (Authoritative)

This document defines mandatory rules for atomic task decomposition and local model delegation.

---

## 1. Core Principle

**Local models are the DEFAULT execution environment.**

Claude's role is strictly:
1. **DECOMPOSE** - Break ANY task into atomic pieces
2. **DELEGATE** - Create task specs and execute via local model
3. **REVIEW** - Check output quality, integrate pieces
4. **ESCALATE ONLY IF**: Task fails twice with good specs OR requires real-time debugging

---

## 2. Atomic Criteria

A task is **atomic** if ALL of the following are true:

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

**If ANY criterion fails**: BLOCK immediately, require re-decomposition.

---

## 3. ///LOCAL_TASKS Format

All task decomposition outputs use this JSON format:

```json
///LOCAL_TASKS
[
  {
    "id": "T-P1-001",
    "parent_id": null,
    "title": "Create utility function",
    "description": "Create getValidActions helper that returns valid actions",
    "files_touched": ["src/utils/actionUtils.js"],
    "est_lines_changed": 25,
    "est_local_effort_mins": 15,
    "test_command": "npm test src/utils/__tests__/actionUtils.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "inputs": ["street", "hasBet", "isMultiSeat"],
    "outputs": ["Array of PRIMITIVE_ACTIONS values"],
    "constraints": [
      "Import PRIMITIVE_ACTIONS from constants",
      "Include JSDoc with @param and @returns"
    ],
    "needs_context": [
      {"path": "src/constants/primitiveActions.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```

**Schema**: `.claude/schemas/local-task.schema.json`

---

## 4. Task Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ DECOMPOSE   │ --> │  BACKLOG    │ --> │  EXECUTE    │
│ Claude      │     │ backlog.json│     │ Local Model │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   MERGE     │ <-- │   REVIEW    │ <-- │   RESULT    │
│ Claude      │     │ Claude      │     │ diff + json │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Decompose**: Claude breaks task into atomic subtasks
2. **Backlog**: Tasks written to `.claude/backlog.json`
3. **Execute**: Dispatcher assigns to local model
4. **Result**: Local model returns unified diff + task_result.json
5. **Review**: Claude validates (small token budget)
6. **Merge**: If valid, integrate; if invalid, decompose fixes

---

## 5. needs_context Protocol

Local models request **exact line ranges**, not full files:

```json
"needs_context": [
  {"path": "src/utils/foo.js", "lines_start": 10, "lines_end": 50},
  {"path": "src/constants/bar.js", "lines_start": 1, "lines_end": 30}
]
```

**Rules**:
- Request only what's needed (minimum context)
- If full file needed, justify in constraints
- Claude supplies only requested ranges
- Reject requests without ranges; require re-specification

---

## 6. invariant_test Protocol

Tasks touching **reducers, persistence, hydration, or migrations** MUST auto-generate a paired test task:

```json
"invariant_test": {
  "target": "src/reducers/gameReducer.js",
  "assertions": [
    "State shape unchanged after action",
    "Action sequence produces expected state",
    "Hydration restores identical state"
  ]
}
```

The dispatcher automatically creates a `T-XXX-TEST` subtask for each task with `invariant_test`.

---

## 7. CLAUDE_REQUEST_FOR_PERMISSION Protocol

### When to Use

Use this protocol **only when**:
- Atomic decomposition attempted ≥2 times and failed
- Blocking criteria are fundamental (circular dependencies, no atomic boundary)
- Task genuinely requires real-time debugging or interactive decisions
- Multi-file refactoring with tight coupling cannot be split

**Do NOT use for**:
- Tasks that are just "hard" (decompose harder)
- Laziness or convenience
- Insufficient decomposition attempts
- Tasks that could be atomic with better planning

### Schema Structure

Permission requests use `.claude/schemas/permission-request.schema.json`:

```json
{
  "request_id": "PR-2025-12-11-001",
  "timestamp": "2025-12-11T10:30:00.000Z",
  "task_description": "Refactor multi-reducer action coordination layer",
  "attempted_decomposition": {
    "decomposition_attempts": 2,
    "subtasks_proposed": [
      {
        "title": "Extract coordination logic to separate file",
        "blocking_reason": "Circular dependency - reducers import coordinator, coordinator imports reducers",
        "failed_criteria": ["files_touched", "circular_dependencies"]
      },
      {
        "title": "Inline coordination in each reducer",
        "blocking_reason": "Duplicates 200+ lines across 5 reducers, violates DRY",
        "failed_criteria": ["est_lines_changed"]
      }
    ],
    "why_insufficient": "No atomic boundary exists - coordination logic is inherently cross-cutting across all 5 reducers with shared state"
  },
  "blocking_criteria": ["circular_dependencies", "no_atomic_boundary_exists"],
  "justification": "Task requires simultaneous changes to 5 reducers to maintain state consistency. Any partial implementation breaks invariants.",
  "estimated_complexity": {
    "files_affected": 5,
    "lines_affected": 450,
    "effort_mins": 90,
    "risk_level": "high"
  },
  "requested_by": "claude:sonnet-4.5",
  "status": "pending"
}
```

### Required Evidence

**Must provide**:
1. **attempted_decomposition**: List of ≥1 decomposition attempts with why each failed
2. **blocking_criteria**: Which atomic criteria or constraints prevent decomposition
3. **justification**: Detailed (≥50 chars) explanation of why Claude must handle directly
4. **estimated_complexity**: Honest estimates of scope and risk

**Insufficient justifications** (will be rejected):
- "This is complex"
- "Local model can't handle this"
- "Too many files to split"
- "Would take too long to decompose"

### Review Process

1. **Submit**: Add entry to `.claude/permission-requests.json`
2. **Block**: Hook prevents work until reviewed
3. **Review**: Human or program-manager-agent examines request
4. **Decision**:
   - `approved`: Claude proceeds with conditions (e.g., must write tests after)
   - `rejected`: Request denied, must decompose anyway
   - `redecompose`: Alternative decomposition approach suggested

### File Locations

| File | Purpose |
|------|---------|
| `.claude/permission-requests.json` | Log of all permission requests |
| `.claude/schemas/permission-request.schema.json` | Validation schema |
| `.claude/hooks/permission-request-handler.cjs` | Enforcement hook (PreToolUse) |

### CLI Commands

```bash
# Create permission request template (future)
node scripts/dispatcher.cjs create-permission-request

# View pending permission requests
node scripts/dispatcher.cjs list-permissions --status=pending

# Approve a request (human only)
node scripts/dispatcher.cjs approve-permission PR-2025-12-11-001 --conditions="must write tests"

# Reject with alternative decomposition
node scripts/dispatcher.cjs reject-permission PR-2025-12-11-001 --suggest="Split by reducer, use event bus"
```

### Approval Conditions

Approved requests may include conditions:
- `must write tests after`: Test coverage required post-implementation
- `requires code review`: Human must review before merge
- `document decisions`: Must add architectural decision record
- `pair with human`: Real-time oversight required

### This Halts Execution

**CRITICAL**: Permission requests **BLOCK all work** on related files until reviewed. This is intentional - it forces careful consideration of decomposition alternatives.

---

## 8. Enforcement

### Dispatcher Validation
- **BLOCK** any task failing atomic criteria
- **REJECT** needs_context without line ranges
- **AUTO-CREATE** invariant_test subtasks

### Pre-Assign Audit
Before assigning to local model, dispatcher validates:
1. All atomic criteria pass
2. Required fields present
3. Test command exists

### Recursive Decomposition
If a task fails local execution:
1. Mark as `failed`
2. Re-submit for decomposition (max depth: 3)
3. If still fails at depth 3: escalate to Claude with justification

---

## 9. Troubleshooting

### Task Fails Atomic Validation
- **files_touched > 3**: Split into multiple tasks, one per file group
- **est_lines_changed > 300**: Break into smaller logical units
- **No test_command**: Add verification (even `node -e "require('./file')"`)
- **est_local_effort_mins > 60**: Decompose into phases

### Local Model Output Incomplete
1. Check if context was sufficient (add more via needs_context)
2. Review constraints - were they clear enough?
3. Retry with refined spec
4. If fails twice: escalate to Claude

### Integration Conflicts
- Local model outputs may need Claude to resolve conflicts
- This is expected behavior - Claude's role is integration
- Keep conflict resolution minimal (decompose if complex)

---

## 10. Automatic Execution Protocol (MANDATORY)

**Auto-execution is the DEFAULT and ONLY method for task execution.**

### Core Principle

When ANY task exists (project file, backlog, ad-hoc), Claude MUST:
1. Decompose it into atomic tasks (if not already decomposed)
2. Execute via local models automatically
3. **DO NOT ask** "should I execute these tasks?"
4. **DO NOT explain** what you're doing - just execute silently

### Universal Scope

**ALL tasks must be decomposed and auto-executed:**
- ✅ Tasks in project files (`docs/projects/*.project.md`)
- ✅ Tasks in backlog (`.claude/BACKLOG.md`, `.claude/backlog.json`)
- ✅ Ad-hoc tasks mentioned by user
- ✅ Any task, anywhere, regardless of source

**There are NO exceptions.** If a task exists, it must be decomposed and executed via local models.

### Execution Flow

```
1. Detect task (any source: project, backlog, user request)
2. IF not decomposed: Decompose into atomic tasks per Sections 2-3
3. Create ///LOCAL_TASKS JSON specs
4. Execute via dispatcher: node scripts/dispatcher.cjs add-tasks
5. Report progress ONLY: "Task T-001 completed" or "Task T-001 failed"
6. On failure: Follow Section 9 (recursive decomposition, max depth 3)
7. Update source (project file, backlog) with completion status
8. Continue to next task automatically
```

### Silent Execution

**NO confirmations. NO explanations. Just execute.**

❌ **Do NOT say:**
- "Would you like me to execute these tasks?"
- "Let me explain what I'm going to do..."
- "I'll execute these 6 tasks for you..."

✅ **DO say:**
- "Task T-001 completed"
- "Task T-002 failed: [error message]"
- [Show progress, report results]

### NO Override Mechanism

**Auto-execution is mandatory. Period.**

- NO `/pm-override auto-execute` command
- NO "disable auto-execution" setting
- NO "manual mode" option
- NO asking permission for pre-decomposed tasks

If tasks are decomposed with model assignments, they execute automatically. End of discussion.

### INVALID Justifications for Bypassing Delegation

**CRITICAL:** The following arguments are FORBIDDEN for justifying direct Claude implementation:

❌ **NEVER use these justifications:**
- "To maintain velocity"
- "To save time"
- "To be more efficient"
- "Faster if I do it myself"
- "To maintain momentum"
- "Simpler to implement directly"
- "Quicker this way"

**Why these are INVALID:**
- Token efficiency and velocity **COME FROM** delegation
- Delegation IS the efficiency mechanism
- Bypassing delegation REDUCES velocity, not increases it
- These are rationalizations, not valid technical reasons

**ONLY valid justifications** are documented in Section 7: CLAUDE_REQUEST_FOR_PERMISSION Protocol:
- Task failed twice with well-written specs
- Fundamental atomic boundary violation (with evidence)
- Circular dependencies preventing decomposition (with attempted solutions)
- Real-time debugging required (with specific reason)

**If you find yourself thinking "I can do this faster":**
- STOP immediately
- This is a red flag
- Decompose instead
- The policy exists for a reason

### Historical Anti-Patterns to Avoid

**Before this policy was established**, Claude instances would:
1. See a task that could be decomposed
2. Justify direct implementation with "velocity" arguments
3. Bypass delegation under the guise of "efficiency"
4. Create technical debt and token waste

**Example of what NOT to do:**
```
❌ "I could decompose this into 5 tasks for local models, but that would
   take longer and slow down the project. To maintain velocity, I'll
   implement it directly."
```

**Correct approach:**
```
✅ "Decomposing into 5 atomic tasks for local models:
   - Task T-001 completed
   - Task T-002 completed
   - ..."
```

**Remember:** Every time you bypass delegation with a "velocity" argument, you:
- Waste tokens (defeats the purpose of token budgets)
- Miss opportunities for optimization
- Violate the established workflow
- Create precedent for future violations

### Error Handling

**On task failure, follow this protocol (automatic, no asking):**

1. **First failure:** Recursive decomposition (Section 9)
   - Break failed task into smaller atomic tasks
   - Retry with refined specs
   - Max decomposition depth: 3

2. **Max depth reached:** Follow Section 7 (Permission Request)
   - Document decomposition attempts
   - Provide blocking criteria evidence
   - Request permission with justification

3. **Continue execution:** Don't stop for one failure
   - Log the failure
   - Continue with remaining tasks
   - Report all results at end

### Integration with Existing Sections

This section OVERRIDES any conflicting guidance in earlier sections:
- **Section 4 (Task Lifecycle):** Add auto-execution to workflow
- **Section 7 (Permission Protocol):** Only invoke after recursive decomposition fails
- **Section 9 (Troubleshooting):** Error handling is automatic, not manual

### Compliance Enforcement

**This is not optional guidance. This is mandatory policy.**

- Program Manager agent enforces auto-execution
- Hooks block violations before they occur
- Process Specialist audits compliance post-session
- Non-compliance is treated as a critical workflow violation

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node scripts/dispatcher.cjs add-tasks < tasks.json` | Add tasks to backlog |
| `node scripts/dispatcher.cjs assign-next` | Assign next open task |
| `node scripts/dispatcher.cjs status` | View backlog status |
| `node scripts/dispatcher.cjs audit` | Validate all tasks |

| File | Purpose |
|------|---------|
| `.claude/backlog.json` | Machine-readable task queue |
| `.claude/schemas/local-task.schema.json` | Task validation schema |
| `scripts/dispatcher.cjs` | Task assignment CLI |
| `scripts/execute-local-task.sh` | Local model execution |
