# Local Models Guide - Decomposition & Delegation Workflow

**Policy**: ALL tasks MUST be decomposed into atomic pieces for local model execution.
**Authority**: `.claude/DECOMPOSITION_POLICY.md` Section 10 (read this first)

**CRITICAL UPDATE**: Auto-execution is now MANDATORY. Claude executes tasks automatically without asking.

---

## Quick Start

### Auto-Execution Workflow (PRIMARY)

**When you encounter ANY task** (project file, backlog, ad-hoc):
1. **Decompose** (if not already atomic)
2. **Execute automatically** via local models
3. **Report progress only**: "Task T-001 completed"
4. **Continue** to next task
5. **NO asking** "should I execute?"

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ DETECT TASK │ --> │  DECOMPOSE  │ --> │ AUTO-EXECUTE│
│ Any source  │     │ If needed   │     │ Local Model │
│             │     │ (automatic) │     │ (automatic) │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ INTEGRATE   │ <-- │  CONTINUE   │ <-- │  REPORT     │
│ Claude      │     │ Next task   │     │ Progress    │
│             │     │ (automatic) │     │ only        │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Manual Workflow (FALLBACK ONLY)

Use only when auto-execution infrastructure is unavailable:

### Basic Example

```bash
# 1. Claude creates ///LOCAL_TASKS JSON
cat << 'EOF' > tasks.json
///LOCAL_TASKS
[
  {
    "id": "T-001",
    "title": "Create formatCurrency utility",
    "description": "Format number as USD currency string",
    "files_touched": ["src/utils/formatCurrency.js"],
    "est_lines_changed": 15,
    "est_local_effort_mins": 10,
    "test_command": "npm test src/utils/__tests__/formatCurrency.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "constraints": ["Export named function", "Include JSDoc"],
    "needs_context": [],
    "invariant_test": null
  }
]
EOF

# 2. Add to backlog (validates atomic criteria)
cat tasks.json | node scripts/dispatcher.cjs add-tasks

# 3. Assign and execute
node scripts/dispatcher.cjs assign-next  # Marks in_progress, outputs task JSON

# 4. Complete task
node scripts/dispatcher.cjs complete T-001 --tests=passed
```

---

## Atomic Criteria (MANDATORY)

ALL tasks must meet these limits:

| Criterion | Limit | Enforcement |
|-----------|-------|-------------|
| `files_touched` | ≤ 3 | BLOCK if exceeded |
| `est_lines_changed` | ≤ 300 | BLOCK if exceeded |
| `test_command` | Required | BLOCK if missing |
| `est_local_effort_mins` | ≤ 60 | BLOCK if exceeded |

**If ANY criterion fails**: Task is BLOCKED. Must re-decompose.

---

## ///LOCAL_TASKS Format

### Required Fields

```json
{
  "id": "T-XXX-001",           // Pattern: T-[A-Z0-9]+-\d{3}
  "title": "One-line desc",     // Imperative: "Create X", "Update Y"
  "description": "Details",     // What to create/modify
  "files_touched": ["path"],    // Max 3 files
  "est_lines_changed": 50,      // Max 300
  "est_local_effort_mins": 20,  // Max 60
  "test_command": "npm test",   // REQUIRED for verification
  "assigned_to": "local:qwen",  // local:deepseek | local:qwen
  "priority": "P1",             // P0 | P1 | P2 | P3
  "status": "open"              // open | in_progress | done | failed
}
```

### Optional Fields

```json
{
  "parent_id": "project-name",     // Groups related tasks
  "inputs": ["param1", "param2"],  // Task inputs
  "outputs": ["Return type"],      // Task outputs
  "constraints": ["Rule 1"],       // Implementation constraints
  "needs_context": [               // Exact context protocol (see below)
    {"path": "src/file.js", "lines_start": 10, "lines_end": 50}
  ],
  "invariant_test": {              // Auto-test protocol (see below)
    "target": "src/reducers/gameReducer.js",
    "assertions": ["State shape preserved"]
  }
}
```

---

## Dispatcher CLI Commands

### Task Management

```bash
# Add tasks from ///LOCAL_TASKS JSON (stdin or file)
cat tasks.json | node scripts/dispatcher.cjs add-tasks

# Assign next open task (priority order: P0 > P1 > P2 > P3)
node scripts/dispatcher.cjs assign-next

# View backlog status
node scripts/dispatcher.cjs status

# Mark task complete
node scripts/dispatcher.cjs complete T-XXX-001 --tests=passed
node scripts/dispatcher.cjs complete T-XXX-001 --tests=failed  # Auto-redecomposes

# Re-decompose failed task manually
node scripts/dispatcher.cjs redecompose T-XXX-001
```

### Auditing & Context

```bash
# Audit all tasks for atomic criteria violations
node scripts/dispatcher.cjs audit

# Extract and preview context for a task
node scripts/dispatcher.cjs extract-context T-XXX-001
```

### Permission Escalation

```bash
# Create permission request for non-atomic task
node scripts/dispatcher.cjs create-permission-request

# List permission requests
node scripts/dispatcher.cjs list-permissions
node scripts/dispatcher.cjs list-permissions --status=pending

# Approve/reject permission
node scripts/dispatcher.cjs approve-permission REQ-001 --conditions="Must add tests"
node scripts/dispatcher.cjs reject-permission REQ-001 --suggest="Split into 3 tasks"
```

---

## Protocol 1: needs_context (Exact Context Provision)

**Problem**: Local models get overwhelmed by full files.
**Solution**: Request exact line ranges needed.

### Usage

```json
{
  "needs_context": [
    {"path": "src/utils/actionUtils.js", "lines_start": 10, "lines_end": 50},
    {"path": "src/constants/gameConstants.js", "lines_start": 1, "lines_end": 30}
  ]
}
```

### Benefits
- Reduces context size by ~80%
- Focuses model on relevant code
- Avoids import path confusion

### Extraction

```bash
# Manual extraction via context-provider
node scripts/dispatcher.cjs extract-context T-XXX-001
```

---

## Protocol 2: invariant_test (Auto-Test Generation)

**Problem**: Changes to critical files (reducers, persistence) break state integrity.
**Solution**: Automatically create paired test tasks.

### Automatic Trigger

When a task touches these files, dispatcher auto-creates a test task:
- `src/reducers/*.js` - State reducers
- `src/utils/persistence.js` - IndexedDB operations
- `src/utils/hydration.js` - State hydration
- `src/contexts/*.jsx` - Context providers

### Specification

```json
{
  "id": "T-P1-001",
  "description": "Update gameReducer to support undo",
  "files_touched": ["src/reducers/gameReducer.js"],
  "invariant_test": {
    "target": "src/reducers/gameReducer.js",
    "assertions": [
      "State shape preserved after undo",
      "No side effects on other state",
      "History array maintains immutability"
    ]
  }
}
```

Dispatcher auto-creates: `T-P1-001-TEST` using `.claude/templates/invariant-test.template.js`

---

## Protocol 3: CLAUDE_REQUEST_FOR_PERMISSION (Escalation)

**When**: Atomic decomposition is truly impossible (rare).
**Process**: Request user permission with justification.

### Permission Request Schema

```json
{
  "request_id": "REQ-001",
  "requested_by": "claude",
  "task_summary": "Refactor PokerTracker.jsx to extract ViewRouter",
  "reason": "atomic_violation",
  "violations": {
    "files_touched": 8,
    "est_lines_changed": 450,
    "complexity": "Requires understanding full component tree"
  },
  "justification": "Splitting would create incomplete, non-functional pieces",
  "alternatives_tried": [
    "Split by view (7 tasks) - each requires full context",
    "Split by concern (props, handlers, state) - breaks functionality"
  ],
  "effort_estimate": "2-3 hours",
  "user_decision": "pending"
}
```

### Commands

```bash
# Create request
node scripts/dispatcher.cjs create-permission-request

# User approves
node scripts/dispatcher.cjs approve-permission REQ-001 --conditions="Add tests after"

# User rejects
node scripts/dispatcher.cjs reject-permission REQ-001 --suggest="Use EnterPlanMode first"
```

---

## Model Selection Guide

### DeepSeek Coder 7B v1.5
**Use for**: New code generation

| Task Type | Max Lines | Strengths | Weaknesses |
|-----------|-----------|-----------|------------|
| Utility functions | 200 | Pure logic, algorithms | Import paths, exports |
| Simple components | 150 | Standard React patterns | Props design |
| Data transforms | 100 | Array/object operations | Business logic |

**Common Fixes**:
- Import paths (count directories explicitly)
- Export style (specify "named export: export const")
- Props vs constants (pass as parameters)

### Qwen 2.5 Coder 7B
**Use for**: Refactoring, tests, docs

| Task Type | Max Lines | Strengths | Weaknesses |
|-----------|-----------|-----------|------------|
| Refactoring | 300 | Mechanical changes | Novel patterns |
| Test generation | Unlimited | Comprehensive coverage | Edge case creativity |
| Documentation | Unlimited | JSDoc, comments | Architecture understanding |

**Common Fixes**:
- Overly verbose comments
- Missing edge cases in tests

---

## Troubleshooting

### Task Blocked - Atomic Criteria Violated

```bash
# Check what failed
node scripts/dispatcher.cjs audit

# Re-decompose
# Option 1: Manual split
# Create 2-3 smaller tasks that each meet criteria

# Option 2: Request permission
node scripts/dispatcher.cjs create-permission-request
```

### Task Failed - Tests Don't Pass

```bash
# Automatic redecomposition (first failure)
node scripts/dispatcher.cjs complete T-XXX-001 --tests=failed
# Dispatcher auto-redecomposes with depth=1

# Manual redecomposition (second failure)
node scripts/dispatcher.cjs redecompose T-XXX-001
# Creates 2-3 subtasks with better specs
```

### Recursive Decomposition Depth Limit

**Max Depth**: 3 levels
**Triggered**: Task fails 3 times with auto-redecomposition

```bash
# Error: "Max decomposition depth (3) reached"
# Solution: Request Claude permission for complex task
node scripts/dispatcher.cjs create-permission-request
```

---

## Best Practices

### 1. Decompose Before You Start
```
❌ Start coding, realize it's complex, try to delegate mid-way
✅ Read task → decompose into atoms → add to backlog → execute
```

### 2. Use needs_context Aggressively
```
❌ Include entire 500-line file as context
✅ Request lines 120-180 where target function lives
```

### 3. Test Commands Are Non-Negotiable
```
❌ "test_command": ""  (BLOCKED)
✅ "test_command": "npm test src/path/__tests__/file.test.js"
```

### 4. Group Related Tasks
```json
{
  "parent_id": "primitive-actions-ui",  // Groups all 18 tasks
  "id": "T-P1-001"
}
```

### 5. Review Before Completing
```bash
# Don't blindly mark complete
# 1. Read generated file
# 2. Run test_command
# 3. Verify meets constraints
# THEN: dispatcher.cjs complete T-XXX-001 --tests=passed
```

---

## Integration with Existing Workflow

### Slash Commands

- `/local-code` - Updated to use ///LOCAL_TASKS
- `/local-refactor` - Updated to use ///LOCAL_TASKS
- `/local-test` - Updated with invariant_test protocol
- `/local-doc` - Updated with needs_context
- `/cto-decompose` - Outputs ///LOCAL_TASKS format

### Project Files

- `docs/projects/TEMPLATE.project.md` - Shows ///LOCAL_TASKS in Phase sections
- `.claude/BACKLOG.md` - References machine-readable `.claude/backlog.json`

### Hooks

- `.claude/hooks/decomposition-validator.cjs` - Enforces atomic criteria
- `.claude/hooks/permission-request-handler.cjs` - Blocks work without permission

---

## Migration from Old Format

### Old Task Spec (DEPRECATED)
```json
{
  "task_id": "T-001",
  "model": "deepseek",
  "output_file": "src/utils/foo.js",
  "context_files": ["src/bar.js"]
}
```

### New ///LOCAL_TASKS Format
```json
{
  "id": "T-001",
  "assigned_to": "local:deepseek",
  "files_touched": ["src/utils/foo.js"],
  "needs_context": [
    {"path": "src/bar.js", "lines_start": 1, "lines_end": 50}
  ]
}
```

**Key Differences**:
- `needs_context` replaces `context_files` (more precise)
- `files_touched` replaces `output_file` (multi-file support)
- Atomic criteria validation (automatic BLOCK)
- Backlog integration (dispatcher.cjs)

---

## See Also

- `.claude/DECOMPOSITION_POLICY.md` - Full authoritative policy
- `.claude/schemas/local-task.schema.json` - JSON Schema validation
- `scripts/dispatcher.cjs` - Task management CLI
- `scripts/context-provider.cjs` - Context extraction
- `scripts/invariant-test-generator.cjs` - Auto-test creation
- `.claude/templates/invariant-test.template.js` - Test template
