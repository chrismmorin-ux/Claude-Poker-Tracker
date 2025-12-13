# Escalation & Permission Protocol

Comprehensive guide to requesting permission when atomic decomposition is not feasible.

---

## When to Use This Protocol

Use the **CLAUDE_REQUEST_FOR_PERMISSION** protocol **only when**:
- Atomic decomposition attempted **≥2 times** and failed
- Blocking criteria are **fundamental** (circular dependencies, no atomic boundary)
- Task genuinely requires **real-time debugging** or **interactive decisions**
- **Multi-file refactoring** with tight coupling **cannot be split**

### Do NOT Use For

- Tasks that are just "hard" → decompose harder
- Laziness or convenience → justify properly
- Insufficient decomposition attempts → attempt more
- Tasks that could be atomic with better planning → plan better

---

## Permission Request Schema

Permission requests use `.claude/schemas/permission-request.schema.json`.

### Minimal Example

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
    "why_insufficient": "No atomic boundary exists - coordination logic is inherently cross-cutting across all 5 reducers with shared state dependencies"
  },
  "blocking_criteria": ["circular_dependencies", "no_atomic_boundary_exists"],
  "justification": "Task requires simultaneous changes to 5 reducers to maintain state consistency. Any partial implementation breaks invariants. Coordination state is mutually dependent across all reducers.",
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

---

## Required Evidence

**You MUST provide all of the following:**

### 1. Attempted Decomposition

```json
"attempted_decomposition": {
  "decomposition_attempts": 2,
  "subtasks_proposed": [
    {
      "title": "Subtask A title",
      "blocking_reason": "Why this subtask cannot meet atomic criteria",
      "failed_criteria": ["files_touched", "circular_dependencies"]
    }
  ],
  "why_insufficient": "Detailed explanation of why atomic decomposition is fundamentally not feasible"
}
```

**Minimum requirement:** List ≥1 decomposition attempts with clear explanation of why each failed.

### 2. Blocking Criteria

List **which atomic criteria or constraints** prevent decomposition:

- `files_touched` - Cannot split without exceeding 3-file limit across all subtasks
- `est_lines_changed` - Cannot reduce scope below 300 lines minimum
- `test_command` - No atomic verification possible for partial implementation
- `est_local_effort_mins` - Unavoidable 60+ minute task for single logical unit
- `circular_dependencies` - Circular imports prevent file separation
- `requires_real_time_debugging` - Issue requires interactive decision making
- `requires_interactive_decisions` - Cannot pre-specify all decisions
- `requires_multi_file_refactoring` - Tight coupling between multiple files
- `no_atomic_boundary_exists` - Task is inherently cross-cutting

### 3. Justification

**Minimum:** 50 characters. **Recommended:** 200-500 characters.

Explain **WHY Claude must handle this directly** and what would break if decomposed.

### 4. Estimated Complexity

```json
"estimated_complexity": {
  "files_affected": 5,
  "lines_affected": 450,
  "effort_mins": 90,
  "risk_level": "high"
}
```

- `files_affected`: Integer (1+)
- `lines_affected`: Integer (1+)
- `effort_mins`: Integer (1+)
- `risk_level`: "low" | "medium" | "high" | "critical"

---

## Insufficient Justifications (WILL BE REJECTED)

❌ **Do NOT use:**
- "This is complex"
- "Local model can't handle this"
- "Too many files to split"
- "Would take too long to decompose"
- "To maintain velocity"
- "To save time"
- "Simpler to implement directly"

These are rationalizations, not evidence-based technical reasons.

---

## Review Process

### 1. Submit Request

Add entry to `.claude/permission-requests.json` with all required fields.

### 2. Blocking Behavior

Work is **BLOCKED** on related files until reviewed. This is intentional—it forces careful decomposition consideration.

### 3. Review

Human or program-manager-agent examines:
- Decomposition evidence (≥2 attempts documented?)
- Blocking criteria (are they fundamental or just inconvenient?)
- Justification quality (specific to your situation?)
- Complexity estimates (honest assessment?)

### 4. Decision

Reviewer sets `status` to one of:

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `approved` | Request accepted | Proceed with work |
| `rejected` | Request denied | Must decompose anyway |
| `redecompose` | Alternative suggested | Try suggested approach, resubmit |

---

## Approval Conditions

If approved, request may include conditions you must fulfill:

- `must write tests after` - Test coverage required post-implementation
- `requires code review` - Human must review before merge
- `document decisions` - Add architectural decision record
- `pair with human` - Real-time oversight required
- Custom conditions per reviewer assessment

**Failure to meet conditions = work rejected and reverted.**

---

## File Locations

| File | Purpose |
|------|---------|
| `.claude/permission-requests.json` | Log of all requests (master list) |
| `.claude/schemas/permission-request.schema.json` | Validation schema |
| `.claude/hooks/permission-request-handler.cjs` | Enforcement hook (PreToolUse) |
| `.claude/agents/dispatcher.md` | Dispatcher decision framework |

---

## CLI Commands

```bash
# Create permission request template
node scripts/dispatcher.cjs create-permission-request

# View pending permission requests
node scripts/dispatcher.cjs list-permissions --status=pending

# Approve a request (human only)
node scripts/dispatcher.cjs approve-permission PR-2025-12-11-001 --conditions="must write tests"

# Reject with alternative decomposition
node scripts/dispatcher.cjs reject-permission PR-2025-12-11-001 --suggest="Split by reducer, use event bus"

# View request details
node scripts/dispatcher.cjs view-permission PR-2025-12-11-001
```

---

## Enforcement & Validation

### Dispatcher Validation

Before accepting a permission request, Dispatcher validates:

1. ✅ `decomposition_attempts` ≥ 2 (documented evidence)
2. ✅ `blocking_criteria` list is not empty
3. ✅ `justification` is ≥ 50 characters
4. ✅ `estimated_complexity` values are reasonable
5. ✅ `subtasks_proposed` shows actual decomposition work (not excuses)

**Automatic rejection if any validation fails.**

### Pre-Approval Audit

Before marking as `approved`, reviewer verifies:
- Decomposition attempts are genuine (not token checks)
- Blocking criteria are fundamental (not preference-based)
- Justification is specific to THIS task (not generic)
- Complexity estimates are realistic

---

## Recursive Decomposition

If a task fails during local model execution:

1. **Mark as `failed`** in backlog
2. **Re-submit for decomposition** (automatic)
3. **Retry with refined specs** (max decomposition depth: 3)
4. **If still fails at depth 3:**
   - Create permission request with failure evidence
   - Include actual error logs from failed attempts
   - Justify why depth-3 decomposition still cannot solve it

**Do NOT escalate without trying all decomposition depths.**

---

## Troubleshooting

### Task Fails Atomic Validation

| Error | Solution |
|-------|----------|
| `files_touched > 3` | Split into multiple tasks, one per file group |
| `est_lines_changed > 300` | Break into smaller logical units with clear boundaries |
| `No test_command` | Add verification (even `node -e "require('./file')"`) |
| `est_local_effort_mins > 60` | Decompose into phases or parallel subtasks |

### Local Model Output Incomplete

1. **Check context:** Was all necessary context provided via `needs_context`?
2. **Review constraints:** Were they clear and unambiguous?
3. **Retry:** Submit with refined spec and better context
4. **Escalate:** If fails twice, create permission request with evidence

### Integration Conflicts

Local model outputs may need Claude to resolve conflicts. This is expected behavior:
- **Keep conflict resolution minimal** (decompose if complex)
- Claude's role is integration, not re-implementation
- If conflicts are large, decompose more granularly

---

## Example: Multi-Reducer Refactoring

### Task
"Refactor game state management to use event sourcing pattern"

### Attempt 1: Extract event bus

```json
{
  "title": "Extract event bus to separate file",
  "blocking_reason": "Event bus must be imported by all 5 reducers, but reducers must emit events to bus - circular dependency",
  "failed_criteria": ["circular_dependencies"]
}
```

### Attempt 2: Migrate one reducer at a time

```json
{
  "title": "Migrate gameReducer to event sourcing",
  "blocking_reason": "Requires coordinated changes to all calling code (5+ files). Cannot migrate one reducer in isolation without breaking state sync",
  "failed_criteria": ["files_touched", "no_atomic_boundary_exists"]
}
```

### Final Request

At this point (2 failed attempts), you can submit permission request with:
- `decomposition_attempts: 2`
- `blocking_criteria: ["circular_dependencies", "no_atomic_boundary_exists"]`
- `justification: "Event sourcing pattern requires coordinated state emission across all reducers. Partial migration breaks synchronization invariants. Circular dependency between bus and reducers prevents file-level decomposition."`

---

## Key Principles

1. **Prove your work:** Show actual decomposition attempts, not hypothetical reasoning
2. **Be honest:** Admit if something is just hard, not impossible
3. **Justify specifically:** Generic reasoning gets rejected
4. **Provide evidence:** Include error messages, blocking code references
5. **Plan for review:** Assume human reviewer is skeptical—earn trust

Remember: This protocol is designed to protect code quality by enforcing rigorous decomposition. The high bar is **intentional**.

---

## See Also

- `.claude/DECOMPOSITION_POLICY.md` - Full decomposition requirements
- `.claude/agents/dispatcher.md` - Dispatcher decision framework
- `.claude/schemas/permission-request.schema.json` - Schema specification
