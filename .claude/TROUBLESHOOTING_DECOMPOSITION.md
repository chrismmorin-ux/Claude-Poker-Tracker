# Troubleshooting Decomposition Issues

This guide helps diagnose and fix common problems with atomic task decomposition and local model delegation.

---

## Quick Diagnostics

### Run Health Check
```bash
node scripts/decomposition-health.cjs
```

### Check Task Validity
```bash
node scripts/dispatcher.cjs audit
```

### View Backlog Status
```bash
node scripts/dispatcher.cjs status
```

---

## Common Issues

### 0. Auto-Execution Not Triggering

#### Symptom
```
Tasks exist but Claude asks "should I execute?" instead of executing automatically
```

#### Root Cause
Workflow violation - auto-execution is MANDATORY per DECOMPOSITION_POLICY.md Section 10

#### Solution
**This is a CRITICAL policy violation.** Auto-execution is not optional.

**If you see Claude asking "should I execute?":**
1. Report this as a workflow compliance failure
2. Reference DECOMPOSITION_POLICY.md Section 10
3. Tasks with model assignments MUST auto-execute
4. NO asking, NO confirmation required

**Correct behavior:**
- Detect task → decompose (if needed) → execute automatically
- Report progress only: "Task T-001 completed"
- Continue to next task without asking

### 1. Task Fails Atomic Validation

#### Symptom
```
ERROR: Task T-XXX-001 fails atomic criteria:
- files_touched: 5 (limit: 3)
- est_lines_changed: 450 (limit: 300)
```

#### Root Cause
Task scope is too large for atomic decomposition.

#### Solution
Break into smaller tasks:

**Bad (Non-Atomic):**
```json
{
  "title": "Refactor authentication system",
  "files_touched": ["auth.js", "login.jsx", "signup.jsx", "settings.jsx", "reducer.js"],
  "est_lines_changed": 450
}
```

**Good (Atomic):**
```json
[
  {
    "id": "T-001",
    "title": "Extract auth logic to utility",
    "files_touched": ["auth.js", "utils/authHelpers.js"],
    "est_lines_changed": 120
  },
  {
    "id": "T-002",
    "title": "Update login view to use new auth util",
    "files_touched": ["login.jsx"],
    "est_lines_changed": 45
  },
  {
    "id": "T-003",
    "title": "Update signup view to use new auth util",
    "files_touched": ["signup.jsx"],
    "est_lines_changed": 50
  }
]
```

**Decomposition Strategies:**
- **By file**: One task per file group (max 3 files)
- **By feature**: Split large features into incremental steps
- **By layer**: Separate utility/component/reducer changes
- **By phase**: Implement in progressive stages

---

### 2. Local Model Output Incomplete

#### Symptom
```
Task T-XXX-001 completed but output missing expected changes
```

#### Root Cause
Insufficient context provided via `needs_context`.

#### Solution
Add more specific context:

**Bad (Too Vague):**
```json
"needs_context": []
```

**Good (Specific Line Ranges):**
```json
"needs_context": [
  {"path": "src/utils/actionUtils.js", "lines_start": 1, "lines_end": 50},
  {"path": "src/constants/primitiveActions.js", "lines_start": 10, "lines_end": 85}
]
```

**Extract Context:**
```bash
node scripts/dispatcher.cjs extract-context T-XXX-001
```

---

### 3. Task Fails Test Validation

#### Symptom
```
Task T-XXX-001 failed: test command exited with code 1
```

#### Root Cause
- Test command is incorrect
- Implementation doesn't meet test requirements
- Missing dependencies

#### Solution A: Fix Test Command
```json
// Bad
"test_command": "npm test"

// Good
"test_command": "npm test src/utils/__tests__/actionUtils.test.js"
```

#### Solution B: Auto-Redecompose
```bash
# Dispatcher automatically triggers redecomposition on test failure
node scripts/dispatcher.cjs complete T-XXX-001 --patch=result.diff --tests=failed
# → Automatically redecomposes into smaller subtasks
```

#### Solution C: Manual Redecompose
```bash
node scripts/dispatcher.cjs redecompose T-XXX-001 --reason="Test failure: missing edge case handling"
```

---

### 4. Circular Dependencies Block Decomposition

#### Symptom
```
Cannot decompose: File A imports B, B imports A
```

#### Root Cause
Tight coupling prevents atomic separation.

#### Solution A: Introduce Abstraction Layer
```
Before: A ↔ B (circular)
After:  A → Interface ← B (decoupled)
```

#### Solution B: Request Permission
```bash
node scripts/dispatcher.cjs create-permission-request
# Fill out template with:
# - attempted_decomposition (list ≥2 attempts)
# - blocking_criteria (circular_dependencies)
# - justification (detailed explanation)
```

**Permission Request Template:**
```json
{
  "request_id": "PR-2025-12-12-001",
  "task_description": "Refactor circular dependency between A and B",
  "attempted_decomposition": {
    "decomposition_attempts": 2,
    "subtasks_proposed": [
      {
        "title": "Extract shared logic to C",
        "blocking_reason": "Shared logic is tightly coupled to both A and B state",
        "failed_criteria": ["circular_dependencies"]
      }
    ],
    "why_insufficient": "No atomic boundary exists - A and B share mutable state"
  },
  "blocking_criteria": ["circular_dependencies"],
  "justification": "Requires simultaneous refactor of both files to maintain invariants"
}
```

---

### 5. Recursive Decomposition Hits Max Depth

#### Symptom
```
ERROR: Task T-XXX-001 exceeded MAX_DECOMPOSITION_DEPTH (3)
Cannot redecompose further - escalating to Claude
```

#### Root Cause
Task is fundamentally non-atomic or poorly specified.

#### Solution A: Review Task Specification
Check if:
- Constraints are too vague
- Required context is missing
- Inputs/outputs are unclear

#### Solution B: Escalate to Claude
After 3 failed decomposition attempts, Claude intervention is required:
```bash
# Manual escalation
node scripts/dispatcher.cjs escalate T-XXX-001
```

Claude will:
1. Review decomposition history
2. Identify specification issues
3. Either fix the spec or implement directly with justification

---

### 6. Permission Request Denied

#### Symptom
```
Permission request PR-XXX rejected:
"Insufficient decomposition attempts - try splitting by file"
```

#### Root Cause
Escalation was premature or insufficient evidence provided.

#### Solution
Follow suggested decomposition approach:
```bash
node scripts/dispatcher.cjs reject-permission PR-XXX --suggest="Split by file, use event bus"
```

**Required Evidence for Approval:**
- ≥2 decomposition attempts documented
- Clear blocking criteria (circular deps, no atomic boundary, etc.)
- Detailed justification (≥50 chars)
- Honest complexity estimates

**Insufficient Justifications (Will Be Rejected):**
- "This is complex"
- "Local model can't handle this"
- "Too many files to split"

**Sufficient Justifications:**
- "Files A, B, C share mutable state that must be updated atomically to prevent race conditions"
- "Refactoring requires simultaneous changes to 5 reducers - any partial implementation breaks state invariants"

---

### 7. Invariant Test Auto-Generation Fails

#### Symptom
```
Task T-XXX-001 touches reducer but no invariant test created
```

#### Root Cause
File doesn't match critical file patterns.

#### Solution
Verify file is in critical files list:
```javascript
// scripts/invariant-test-generator.cjs
const CRITICAL_FILES = {
  reducer: /src\/reducers\/.*\.js$/,
  persistence: /src\/utils\/persistence\/.*\.js$/,
  hydration: /src\/utils\/(hydration|dehydration).*\.js$/,
  context: /src\/contexts\/.*\.jsx$/
};
```

If missing, add `invariant_test` manually:
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

---

### 8. Dispatcher Commands Fail

#### Symptom
```bash
$ node scripts/dispatcher.cjs add-tasks < tasks.json
ERROR: Invalid task format - missing required field 'test_command'
```

#### Root Cause
Task doesn't match `local-task.schema.json`.

#### Solution
Validate against schema:
```bash
# Check if tasks.json is valid
node -e "
const schema = require('./.claude/schemas/local-task.schema.json');
const tasks = require('./tasks.json');
const Ajv = require('ajv');
const ajv = new Ajv();
const validate = ajv.compile(schema);
console.log(validate(tasks) ? 'VALID' : JSON.stringify(validate.errors, null, 2));
"
```

**Common Missing Fields:**
- `test_command` (required)
- `assigned_to` (required, pattern: `local:(deepseek|qwen)`)
- `priority` (required, enum: P0/P1/P2/P3)
- `files_touched` (required, array, maxItems: 3)

---

### 9. Integration Conflicts After Merge

#### Symptom
```
Multiple tasks completed but integration produces merge conflicts
```

#### Root Cause
Tasks modified overlapping code regions.

#### Solution
Sequence dependent tasks:
```json
[
  {
    "id": "T-001",
    "title": "Create utility function",
    "files_touched": ["utils/helpers.js"]
  },
  {
    "id": "T-002",
    "title": "Use utility in component",
    "parent_id": "T-001",  // ← Depends on T-001
    "files_touched": ["components/MyComponent.jsx"]
  }
]
```

**Dispatcher respects dependencies:**
```bash
# T-001 must complete before T-002 can be assigned
node scripts/dispatcher.cjs assign-next  # Assigns T-001
node scripts/dispatcher.cjs complete T-001 --patch=result.diff
node scripts/dispatcher.cjs assign-next  # Now assigns T-002
```

---

### 10. needs_context Requests Rejected

#### Symptom
```
ERROR: needs_context missing line ranges
```

#### Root Cause
Context request didn't specify exact lines.

#### Solution
**Bad (Rejected):**
```json
"needs_context": [
  {"path": "src/utils/foo.js"}  // ❌ No line ranges
]
```

**Good (Accepted):**
```json
"needs_context": [
  {"path": "src/utils/foo.js", "lines_start": 10, "lines_end": 50}  // ✅
]
```

---

## Debugging Workflows

### Workflow A: Task Failing Repeatedly

1. **Check decomposition depth:**
   ```bash
   node scripts/dispatcher.cjs status | grep "depth:"
   ```

2. **Review failure history:**
   ```bash
   cat .claude/backlog.json | jq '.tasks[] | select(.id=="T-XXX-001") | .decomposition_history'
   ```

3. **Redecompose with better spec:**
   ```bash
   node scripts/dispatcher.cjs redecompose T-XXX-001 --reason="Add missing context for edge cases"
   ```

4. **If depth ≥ 3, escalate:**
   ```bash
   node scripts/dispatcher.cjs escalate T-XXX-001
   ```

---

### Workflow B: Low Decomposition Compliance

1. **Run audit:**
   ```bash
   node scripts/audit_decomposition.cjs
   ```

2. **Review violations:**
   ```bash
   cat .claude/audits/atomicity_report.json | jq '.violations'
   ```

3. **Fix violations:**
   - Update task specs to meet atomic criteria
   - Re-add corrected tasks to backlog

4. **Verify:**
   ```bash
   node scripts/dispatcher.cjs audit  # Should show 95%+ compliance
   ```

---

### Workflow C: Permission Request Process

1. **Create request:**
   ```bash
   node scripts/dispatcher.cjs create-permission-request > PR-001.json
   ```

2. **Fill template with evidence:**
   - Document ≥2 decomposition attempts
   - List blocking criteria
   - Provide detailed justification

3. **Submit:**
   ```bash
   cat PR-001.json | node scripts/dispatcher.cjs request-permission
   ```

4. **Wait for review:**
   ```bash
   node scripts/dispatcher.cjs list-permissions --status=pending
   ```

5. **If approved, proceed:**
   ```bash
   # Claude implements with conditions
   # If conditions: "must write tests after"
   # → Write tests immediately after implementation
   ```

6. **If rejected, follow suggestion:**
   ```bash
   # Rejection includes alternative decomposition approach
   # Re-attempt with suggested method
   ```

---

## Health Check Interpretation

```bash
node scripts/decomposition-health.cjs
```

**Output:**
```
Decomposition Health Report
==========================
Backlog Status: 15 open, 42 done, 3 failed
Atomic Compliance: 94% (3 violations)
Average Decomposition Depth: 1.2
Max Depth Reached: 2/3
Permission Requests: 1 pending, 0 approved, 2 rejected

WARNINGS:
⚠ Task T-P2-003 exceeds est_lines_changed (350 > 300)
⚠ Task T-P5-007 missing test_command

RECOMMENDATIONS:
→ Redecompose T-P2-003 into 2 smaller tasks
→ Add test_command to T-P5-007 or use "node -e \"require('./file')\""
```

**Action Items:**
1. Fix violations immediately
2. Aim for 95%+ compliance
3. Keep average depth < 1.5

---

## Prevention Strategies

### 1. Start with Smaller Tasks
Better to over-decompose than under-decompose. Err on the side of too many small tasks.

### 2. Use needs_context Aggressively
Request exact context upfront - saves redecomposition cycles.

### 3. Add Invariant Tests for Critical Files
Always specify `invariant_test` for:
- Reducers
- Persistence layer
- Hydration/dehydration
- Context providers

### 4. Document Decomposition Decisions
In `constraints`, explain why tasks are split a certain way:
```json
"constraints": [
  "Split by file to avoid circular dependency",
  "Utility must be created before component uses it"
]
```

### 5. Run Health Check Regularly
```bash
# Add to pre-commit hook
node scripts/decomposition-health.cjs
```

---

## Emergency Procedures

### System Appears Broken
1. **Verify schemas:**
   ```bash
   node -e "require('./.claude/schemas/local-task.schema.json')"
   node -e "require('./.claude/schemas/backlog.schema.json')"
   ```

2. **Check backlog integrity:**
   ```bash
   cat .claude/backlog.json | jq . > /dev/null && echo "VALID" || echo "INVALID"
   ```

3. **Reset if corrupted:**
   ```bash
   cp .claude/backlog.json .claude/backlog.json.backup
   node scripts/dispatcher.cjs audit --fix
   ```

### All Tasks Failing
1. **Check environment:**
   ```bash
   node --version  # Should be v16+
   npm list ajv    # Should be installed
   ```

2. **Review recent changes:**
   ```bash
   git log --oneline -10 --
.claude/schemas/ scripts/
   ```

3. **Rollback if needed:**
   ```bash
   git checkout HEAD~1 -- .claude/schemas/local-task.schema.json
   ```

---

## Getting Help

### Internal Resources
- **Policy Doc:** `.claude/DECOMPOSITION_POLICY.md`
- **Workflow Guide:** `.claude/context/WORKFLOW.md`
- **Local Models Guide:** `.claude/LOCAL_MODELS_GUIDE.md`

### Commands
- `/process-audit decomposition` - Comprehensive analysis
- `/cto-decompose <task>` - Get decomposition recommendation

### Human Escalation
When all else fails, document:
1. Task specification (full JSON)
2. Decomposition attempts (≥2)
3. Error messages
4. Expected vs actual behavior

Then request human review with context.

---

## Metrics to Track

### Weekly Health Metrics
- **Decomposition Compliance:** Target ≥95%
- **Average Task Depth:** Target <1.5
- **Permission Request Rate:** Target <5% of tasks
- **Auto-Redecomposition Success:** Target ≥80%
- **Test Pass Rate:** Target ≥90%

### Red Flags
- Compliance <90% → Review decomposition practices
- Avg depth >2.0 → Tasks too complex or specs too vague
- Permission requests >10% → May indicate resistance to decomposition
- Test pass rate <80% → Context or constraints insufficient

---

## See Also

- `.claude/DECOMPOSITION_POLICY.md` - Full policy reference
- `scripts/dispatcher.cjs` - CLI tool reference
- `scripts/audit_decomposition.cjs` - Audit tool
- `.claude/schemas/local-task.schema.json` - Task schema
