# Agent Usage Guide

This guide tells you **when to use which agent** and **what to expect**.

**IMPORTANT**: All task decomposition commands output tasks that **auto-execute automatically** per DECOMPOSITION_POLICY.md Section 10. There is NO asking for confirmation.

## Quick Decision Tree

```
Starting new work?
├─ Simple bug fix (1-2 files)     → Just fix it, run npm test
├─ New feature (3+ files)         → /cto-decompose "<description>"
├─ Refactoring existing code      → /cto-review <area> first
├─ Not sure what approach to use  → /route "<description>"
└─ Research/exploration only      → Use Task tool with Explore agent

After writing code?
├─ Changed 3+ files               → /review staged
├─ New React component            → /audit-component <filepath>
├─ New hook or utility            → /gen-tests <filepath>
├─ Changed a reducer              → npm test (mandatory)
└─ Changed constants              → Schema tests will catch drift

Before committing?
├─ Tests must pass                → npm test (enforced by quality-gate hook)
└─ Docs may need update           → docs-sync hook will warn

End of session or encountering issues?
├─ Recurring errors               → /process-fix last
├─ Session review                 → /process-review session
├─ Context feels bloated          → /process-slim analyze
└─ Full process audit             → /process-audit full
```

---

## Decomposition Policy (MANDATORY FOR ALL AGENTS)

**ALL agents must decompose work into atomic tasks for local model execution.**

### Atomic Criteria

Every task must meet these limits:

| Criterion | Limit | Enforcement |
|-----------|-------|-------------|
| `files_touched` | ≤ 3 | BLOCK if exceeded |
| `est_lines_changed` | ≤ 300 | BLOCK if exceeded |
| `test_command` | Required | BLOCK if missing |
| `est_local_effort_mins` | ≤ 60 | BLOCK if exceeded |

**If ANY criterion fails**: Task is BLOCKED. Must re-decompose or request permission.

### Output Format: ///LOCAL_TASKS

All task decomposition must use this JSON format:

```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "title": "Create utility function",
    "description": "Detailed description",
    "files_touched": ["src/utils/file.js"],
    "est_lines_changed": 50,
    "est_local_effort_mins": 20,
    "test_command": "npm test src/utils/__tests__/file.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "constraints": ["Rule 1", "Rule 2"],
    "needs_context": [],
    "invariant_test": null
  }
]
```

### Permission Escalation

If atomic decomposition is truly impossible:

```bash
node scripts/dispatcher.cjs create-permission-request
```

**See**: `.claude/DECOMPOSITION_POLICY.md` for full policy.

---

## Available Agents

### 1. CTO Agent
**When to use:** Strategic decisions, task planning, architecture questions

**Commands:**
- `/cto-decompose "<feature description>"` - Break work into tasks
- `/cto-review <area>` - Architecture review of a specific area
- `/cto-debt [area]` - Technical debt analysis

**Example:**
```
/cto-decompose "Add export functionality to let users backup their data"
```

**Output:** JSON task list with:
- Task IDs and priorities
- Owner assignments (who should do it)
- Acceptance criteria
- Dependencies between tasks

**Good for:**
- Planning multi-day features
- Understanding technical debt
- Making architecture decisions
- Getting a second opinion on approach

---

### 2. Code Reviewer Agent
**When to use:** After making significant code changes

**Command:**
- `/review staged` - Review git staged changes
- `/review all` - Review all uncommitted changes
- `/review file:src/path/to/file.js` - Review specific file

**Example:**
```
/review staged
```

**Output:**
- Risk level (low/medium/high)
- Critical issues (must fix)
- Important issues (should fix)
- Minor suggestions (nice to have)

**Checks for:**
- Magic strings (should use constants)
- Missing useCallback dependencies
- State mutation (should use dispatch)
- Import breaks
- Security issues (XSS, etc.)
- Console.log left in code

---

### 3. Component Auditor Agent
**When to use:** After creating or significantly modifying React components

**Command:**
- `/audit-component <filepath>` - Audit specific component
- `/audit-component full` - Audit all components
- `/audit-component views` - Audit view components only
- `/audit-component ui` - Audit UI components only

**Example:**
```
/audit-component src/components/views/PlayersView.jsx
```

**Output:**
- Props analysis (too many? drilling?)
- Performance issues (missing memoization)
- State management concerns
- Accessibility gaps

---

### 4. Test Generator Agent
**When to use:** After creating new hooks, utilities, or reducers

**Command:**
- `/gen-tests <filepath>` - Generate tests for file
- `/gen-tests <module>` - Generate tests for module

**Example:**
```
/gen-tests src/hooks/usePlayerFiltering.js
```

**Output:** Complete test file ready to run

**Note:** Review generated tests - they may need adjustment for edge cases specific to your code.

---

### 5. Process Specialist Agent
**When to use:** Workflow optimization, error prevention, context efficiency, process compliance

**Commands:**
- `/process-audit [quick|full|errors|context|delegation]` - Comprehensive process audit
- `/process-fix [error description|last]` - Analyze error and create preventions
- `/process-slim [analyze|recommend|apply]` - Reduce context file sizes
- `/process-review [session|commit|last-N-commits]` - Review work for compliance

**Example:**
```
/process-audit quick       # Fast compliance check
/process-fix last          # Analyze most recent error
/process-slim analyze      # Check context efficiency
/process-review session    # Review this session's work
```

**Output:**
- Compliance scores (delegation, context, errors, docs)
- Recurring error patterns with specific preventions
- Token savings recommendations
- Specific file changes to implement

**Good for:**
- End-of-session reviews
- After encountering recurring errors
- Optimizing context/token usage
- Improving delegation compliance
- Continuous process improvement

---

### 6. Local Model Commands (Token-Saving)
**When to use:** Simple, well-defined tasks that don't need full Claude reasoning

**Commands:**
- `/route "<task>"` - Get recommendation on which approach to use
- `/local "<task>"` - Auto-route to best local model
- `/local-code "<task>"` - Generate new code (DeepSeek)
- `/local-refactor "<task>"` - Refactor existing code (Qwen)
- `/local-doc "<task>"` - Generate documentation (Qwen)
- `/local-test "<task>"` - Generate tests (Qwen)

**Good candidates for local models:**
- Pure utility functions (<80 lines)
- Simple React components (<100 lines, <5 props)
- Renaming/extracting code
- Adding JSDoc comments
- Generating boilerplate

**NOT good for local models:**
- State management (reducers, contexts)
- Complex hooks with side effects
- Multi-file changes
- Anything needing project context

**After local model output:**
1. Review for correctness
2. Fix import paths (commonly wrong)
3. Verify export style matches project (named exports)
4. Run tests

---

## Common Workflows

### Workflow A: Simple Bug Fix
```
1. Find and fix the bug
2. npm test
3. Commit
```
No agents needed - just fix it and verify with tests.

### Workflow B: New Feature (Medium Size)
```
1. /cto-decompose "description of feature"
2. Review task breakdown
3. Work through tasks one at a time
4. After 3+ files changed: /review staged
5. npm test
6. Commit
```

### Workflow C: Large Refactor
```
1. /cto-review <area being refactored>
2. Review findings and decide approach
3. /cto-decompose "refactor plan based on review"
4. Work through tasks
5. /review staged after significant changes
6. npm test (frequently)
7. Commit in logical chunks
```

### Workflow D: New Component
```
1. Write the component
2. /audit-component <filepath>
3. Address any issues found
4. /gen-tests <filepath>
5. Review and run generated tests
6. npm test
7. Commit
```

### Workflow E: Token-Conscious Work
```
1. /route "description of what I need"
2. If recommended: use /local-* command
3. Review and fix output
4. npm test
5. Commit
```

---

## What Agents Check

| Check | Code Reviewer | Component Auditor | Schema Tests |
|-------|---------------|-------------------|--------------|
| Magic strings | ✓ | | |
| useCallback deps | ✓ | ✓ | |
| State mutation | ✓ | | |
| Console.log | ✓ | | |
| Component size | | ✓ | |
| Prop drilling | | ✓ | |
| Memoization | | ✓ | |
| Version sync | | | ✓ |
| Constants complete | | | ✓ |
| State schemas | | | ✓ |
| Test coverage | | | ✓ |

---

## When NOT to Use Agents

- **Simple typo fixes** - Just fix and commit
- **Single-line changes** - Just do it
- **Documentation-only changes** - Just do it
- **Adding comments** - Just do it
- **Exploratory questions** - Use Task tool with Explore agent directly

---

## PR and Merge Rules

**Agents MUST:**
- Create a Pull Request for any change touching 3+ files
- Request human review before merging
- Never force-push or rewrite shared history

**Agents MUST NOT:**
- Merge their own PRs without human approval
- Push directly to `main` branch
- Bypass CI checks or quality gates

These rules ensure human oversight on all significant changes.

---

## Troubleshooting

### "The agent didn't help"
- Be more specific in your prompt
- Include file paths when relevant
- Mention constraints or requirements

### "Local model output was wrong"
This is expected - local models lack project context:
1. Fix import paths
2. Fix export style
3. Add missing constants
4. Still saves tokens overall

### "Test enforcement is blocking my commit"
Run `npm test` first. Tests must pass before commits.

### "Too many hook suggestions"
We reduced hooks from 14 to 6. If still noisy, the remaining hooks are:
- `quality-gate` - Blocks commits without tests (necessary)
- `git-guard` - Prevents dangerous git commands (necessary)
- `secrets-scan` - Prevents credential leaks (necessary)
- `edit-tracker` - Tracks changes for quality gate (necessary)
- `test-tracker` - Records test runs (necessary)
- `docs-sync` - Warns about doc drift (informational)

Only `docs-sync` is purely advisory - the rest enforce quality.

---

## Summary

| Task | Agent/Command |
|------|---------------|
| Break down feature into tasks | `/cto-decompose` |
| Review architecture | `/cto-review` |
| Analyze tech debt | `/cto-debt` |
| Review code changes | `/review staged` |
| Audit React component | `/audit-component` |
| Generate tests | `/gen-tests` |
| Simple code generation | `/local-code` |
| Simple refactoring | `/local-refactor` |
| Get recommendation | `/route` |
| Process compliance audit | `/process-audit` |
| Fix/prevent errors | `/process-fix` |
| Reduce context bloat | `/process-slim` |
| Review session work | `/process-review` |

When in doubt, use `/route "<description>"` to get a recommendation.
For process issues, use `/process-audit quick` to identify problems.
