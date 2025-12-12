# Local Model Learning & Dashboard System

**Project ID:** 0.003.1212-learning-dashboard
**Status:** In Progress (Phase 3)
**Priority:** P0
**Created:** 2025-12-12
**Owner:** Claude + Local Models

---

## Executive Summary

Build comprehensive logging, learning, and dashboard system to:
1. **Capture all local model execution details** (stdout, stderr, failures, successes)
2. **Identify and track failure patterns** with automated mitigation tracking
3. **Provide single-pane-of-glass visibility** via unified dashboard
4. **Enable continuous learning** from failures to prevent future issues

**Key Metrics:**
- Reduce repeat failures by 80%
- Achieve <5min visibility into system health
- Track token ROI and delegation effectiveness
- Auto-detect failure patterns after 2+ occurrences

---

## Background & Context

### Problem Statement

Currently local model execution data is scattered and incomplete:
- ❌ No comprehensive task execution log (stdout/stderr lost)
- ❌ Failures tracked but root cause unknown ("tests failed" - why?)
- ❌ No pattern recognition (same errors repeat)
- ❌ No mitigation tracking (can't tell if fixes work)
- ❌ Data scattered across 8+ JSON files with no unified view
- ❌ User can't quickly assess system health

### Current Data Sources

1. `.claude/backlog.json` - Task status, completion timestamps, `tests_passed` boolean
2. `.claude/.delegation-violations.json` - Claude bypassing delegation (2 violations)
3. `.claude/metrics/delegation.json` - Delegation decisions (40 "allowed")
4. `.claude/permission-requests.json` - Escalation requests (empty)
5. `.claude/ESCALATION_LOG.md` - Detailed human-readable analysis (1 entry)
6. Dispatcher console output - Success/failure messages (not captured)
7. Local model output - Completely lost

### Known Failure Patterns (from ESCALATION_LOG.md)

**FP-001: File Modification Anti-Pattern**
- Occurrences: 4 tasks (T-DECOMP-001, T-DECOMP-002, T-020-FIX, T-017-FIX)
- Failure rate: 100%
- Root cause: Local models rewrite entire file instead of preserving content
- Mitigation: Type D tasks now blocked by decomposition policy

**FP-002: Constraint Ignoring**
- Occurrences: 2 tasks (T-020-FIX, T-017-FIX)
- Examples: "Pure markdown" → produced JavaScript, "NO dependencies" → kept require()
- Root cause: Training patterns override explicit instructions
- Mitigation: Added `anti_patterns` field to schema

---

## Solution Architecture

### 3-Tier System

**Tier 1: Comprehensive Logging**
- JSONL log file capturing all execution details
- Structured error capture with classification
- Test result parsing and failure analysis

**Tier 2: Learning Engine**
- Pattern recognition from failure signatures
- Mitigation tracking (none/manual/automated)
- Effectiveness measurement

**Tier 3: Unified Dashboard**
- Auto-generated markdown report
- Health score and metrics
- Actionable insights and quick links

---

## Implementation Phases

### Phase 1: Enhanced Logging (P0 - COMPLETE ✅)
**Goal:** Capture all local model execution data in structured format
**Completed:** 2025-12-12

**Deliverables:**
1. `.claude/logs/` directory structure
2. `local-model-tasks.log` (JSONL format)
3. Modified dispatcher with comprehensive logging
4. Test result parser
5. Error classification system

**Tasks:** 8 atomic tasks (see below)

### Phase 2: Learning Engine (P0 - COMPLETE ✅)
**Goal:** Identify and track failure patterns
**Completed:** 2025-12-12

**Deliverables:**
1. `.claude/learning/` directory
2. `failure-patterns.json` with pattern schema
3. Pattern detection script
4. Pre-populated known patterns (FP-001, FP-002)
5. Mitigation effectiveness tracking

**Tasks:** 6 atomic tasks

### Phase 3: Dashboard Generation (P1 - COMPLETE ✅)
**Goal:** Single-pane-of-glass system health view
**Completed:** 2025-12-12

**Deliverables:**
1. `scripts/generate-dashboard.cjs`
2. `.claude/DASHBOARD.md` (auto-generated)
3. Multi-source data aggregation
4. Health score calculation
5. Metrics and trend analysis

**Tasks:** 7 atomic tasks

### Phase 4: Automation & Integration (P2 - COMPLETE ✅)
**Goal:** Auto-classify, auto-detect, auto-update
**Completed:** 2025-12-12

**Deliverables:**
1. LLM-based failure classification
2. Auto-pattern proposal after 2+ similar failures
3. Post-task dashboard update hook
4. `/dashboard` slash command
5. Dashboard link in startup menu

**Tasks:** 5 atomic tasks

---

## Phase 1: Enhanced Logging - Atomic Tasks

### T-LEARN-001: Create logging directory structure
**Description:** Create `.claude/logs/` directory with .gitkeep and README

**Files Touched:**
- `.claude/logs/.gitkeep`
- `.claude/logs/README.md`

**Constraints:**
- README explains log format and retention policy
- .gitkeep ensures directory is tracked in git
- Add to .gitignore: `*.log` (logs are local-only)

**Test Command:**
```bash
test -d .claude/logs && test -f .claude/logs/.gitkeep && test -f .claude/logs/README.md
```

**Priority:** P0
**Estimated Lines:** 30
**Estimated Effort:** 15 mins
**Assigned To:** local:qwen
**Task Complexity Type:** A (Mechanical - create files)
**Edit Strategy:** create_new

---

### T-LEARN-002: Create task execution log schema
**Description:** Define JSONL schema for local-model-tasks.log entries

**Files Touched:**
- `.claude/schemas/task-execution-log.schema.json`

**Constraints:**
- Must include all fields from proposal: timestamp, task_id, model, status, execution, test_result, failure_classification, etc.
- Use JSON Schema format
- Document each field with description
- Include example entry in schema description

**Test Command:**
```bash
node -e "const s = require('./.claude/schemas/task-execution-log.schema.json'); if (!s.properties.failure_classification) process.exit(1);"
```

**Priority:** P0
**Estimated Lines:** 150
**Estimated Effort:** 25 mins
**Assigned To:** local:deepseek
**Task Complexity Type:** B (Template fill - adapt from existing schemas)
**Edit Strategy:** create_new
**Needs Context:**
- `.claude/schemas/local-task.schema.json` (for reference)
- `.claude/schemas/permission-request.schema.json` (for structure patterns)

---

### T-LEARN-003: Add logging functions to dispatcher
**Description:** Add writeTaskLog() function to dispatcher.cjs that appends JSONL entries

**Files Touched:**
- `scripts/dispatcher.cjs`

**Constraints:**
- Function signature: `writeTaskLog(logEntry)` where logEntry matches schema
- Appends to `.claude/logs/local-model-tasks.log` (JSONL - one JSON per line)
- Creates log file if doesn't exist
- Handles errors silently (don't break dispatcher if log write fails)
- Add at top of file after existing constants

**Test Command:**
```bash
node -e "const d = require('./scripts/dispatcher.cjs'); console.log('Dispatcher loads without error')"
```

**Priority:** P0
**Estimated Lines:** 40
**Estimated Effort:** 30 mins
**Assigned To:** local:deepseek
**Task Complexity Type:** C (Creative - new function)
**Edit Strategy:** incremental_edit
**Edit Operations:**
1. Add LOG_FILE constant after line 26: `const LOG_FILE = path.join(process.cwd(), '.claude', 'logs', 'local-model-tasks.log');`
2. Add writeTaskLog function after saveBacklog() function (after line 57)

**Output Template:**
```javascript
// Append task execution log entry (JSONL format)
function writeTaskLog(entry) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {
    // Silent fail - don't break dispatcher
  }
}
```

**Needs Context:**
- `scripts/dispatcher.cjs` lines 1-100 (to see structure and existing functions)

---

### T-LEARN-004: Log task start in assign-next command
**Description:** Call writeTaskLog() when task execution starts in assign-next command

**Files Touched:**
- `scripts/dispatcher.cjs`

**Constraints:**
- Add log entry immediately before calling local model (around line 262)
- Include: timestamp, task_id, model, status="in_progress", execution.start
- Keep existing console.log statements unchanged
- Use try-catch to ensure logging doesn't break execution

**Test Command:**
```bash
grep -q "writeTaskLog.*in_progress" scripts/dispatcher.cjs
```

**Priority:** P0
**Estimated Lines:** 15
**Estimated Effort:** 20 mins
**Assigned To:** local:qwen
**Task Complexity Type:** A (Mechanical - add function call)
**Edit Strategy:** incremental_edit
**Edit Operations:**
1. After line 262 (`console.log('📝 Calling local model...')`) insert:
```javascript
    // Log task start
    try {
      writeTaskLog({
        timestamp: new Date().toISOString(),
        task_id: openTask.id,
        model: execSpec.model,
        status: 'in_progress',
        execution: {
          start: new Date().toISOString(),
          end: null,
          duration_ms: null
        }
      });
    } catch (e) { /* silent */ }
```

**Needs Context:**
- `scripts/dispatcher.cjs` lines 240-280 (assign-next command implementation)

---

### T-LEARN-005: Log task completion in assign-next command
**Description:** Call writeTaskLog() after task execution completes (success or failure)

**Files Touched:**
- `scripts/dispatcher.cjs`

**Constraints:**
- Add log entries in both success and failure paths (after lines 277 and 283)
- Include: execution.end, duration_ms, status (success/failed)
- Calculate duration from task start time
- Capture test_result.exit_code if available

**Test Command:**
```bash
grep -q "writeTaskLog.*success\|failed" scripts/dispatcher.cjs
```

**Priority:** P0
**Estimated Lines:** 30
**Estimated Effort:** 25 mins
**Assigned To:** local:deepseek
**Task Complexity Type:** A (Mechanical - add function calls)
**Edit Strategy:** incremental_edit
**Anti-patterns:**
- "Don't duplicate the entire assign-next function - only add log calls"
- "Don't remove existing console.log statements"

**Needs Context:**
- `scripts/dispatcher.cjs` lines 270-290 (success/failure handling)

---

### T-LEARN-006: Create test result parser utility
**Description:** Create utility to parse test output and extract detailed failure info

**Files Touched:**
- `scripts/utils/test-result-parser.cjs`

**Constraints:**
- Export parseTestOutput(stdout, stderr, exitCode) function
- Return object: { tests_run, tests_passed, tests_failed, failure_summary, error_type }
- Handle vitest output format (our current test runner)
- Handle npm test errors
- Extract first error message (truncate to 500 chars)
- Return null for unparseable output

**Test Command:**
```bash
node -e "const p = require('./scripts/utils/test-result-parser.cjs'); const r = p.parseTestOutput('✓ 5 passed', '', 0); if (r.tests_passed !== 5) process.exit(1);"
```

**Priority:** P0
**Estimated Lines:** 100
**Estimated Effort:** 40 mins
**Assigned To:** local:deepseek
**Task Complexity Type:** C (Creative - parsing logic)
**Edit Strategy:** create_new

**Output Template:**
```javascript
/**
 * Parse test output to extract detailed results
 * @param {string} stdout - Test command stdout
 * @param {string} stderr - Test command stderr
 * @param {number} exitCode - Process exit code
 * @returns {object|null} Parsed test results or null
 */
function parseTestOutput(stdout, stderr, exitCode) {
  // Implementation here
  return {
    tests_run: {number},
    tests_passed: {number},
    tests_failed: {number},
    failure_summary: {string},
    error_type: {string|null}
  };
}

module.exports = { parseTestOutput };
```

---

### T-LEARN-007: Integrate test parser with complete command
**Description:** Use test-result-parser in complete command to log detailed test results

**Files Touched:**
- `scripts/dispatcher.cjs`

**Constraints:**
- Import parseTestOutput at top of file
- Call parser in complete command (around line 360)
- Add parsed results to task log entry
- Include test_result object with all parsed fields
- Keep existing test pass/fail logic unchanged

**Test Command:**
```bash
grep -q "parseTestOutput" scripts/dispatcher.cjs && grep -q "test_result" scripts/dispatcher.cjs
```

**Priority:** P0
**Estimated Lines:** 20
**Estimated Effort:** 20 mins
**Assigned To:** local:qwen
**Task Complexity Type:** A (Mechanical - integrate utility)
**Edit Strategy:** incremental_edit
**Needs Context:**
- `scripts/dispatcher.cjs` lines 340-370 (complete command)
- `scripts/utils/test-result-parser.cjs` (for import and usage)

---

### T-LEARN-008: Create log viewer utility script
**Description:** Create script to view/filter local-model-tasks.log in readable format

**Files Touched:**
- `scripts/view-task-log.cjs`

**Constraints:**
- Read `.claude/logs/local-model-tasks.log` (JSONL)
- Accept filters: --status=[success|failed], --task-id=T-*, --model=[qwen|deepseek], --last=N
- Display in table format with key columns: timestamp, task_id, model, status, duration, tests
- Show full details with --verbose flag
- Handle missing log file gracefully

**Test Command:**
```bash
node scripts/view-task-log.cjs --help | grep -q "status"
```

**Priority:** P1
**Estimated Lines:** 120
**Estimated Effort:** 35 mins
**Assigned To:** local:deepseek
**Task Complexity Type:** C (Creative - CLI tool)
**Edit Strategy:** create_new

---

## Phase 2: Learning Engine - Atomic Tasks

### T-LEARN-009: Create learning directory structure
**Description:** Create `.claude/learning/` with .gitkeep and README

**Files Touched:**
- `.claude/learning/.gitkeep`
- `.claude/learning/README.md`

**Test Command:** `test -d .claude/learning && test -f .claude/learning/README.md`
**Priority:** P0
**Estimated Lines:** 25
**Effort:** 15 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** create_new

---

### T-LEARN-010: Create failure pattern schema
**Description:** Define JSON schema for failure-patterns.json

**Files Touched:**
- `.claude/schemas/failure-pattern.schema.json`

**Constraints:**
- Match structure from proposal (pattern_id, name, description, occurrences, mitigation, etc.)
- Include example pattern in schema description

**Test Command:**
```bash
node -e "const s = require('./.claude/schemas/failure-pattern.schema.json'); if (!s.properties.mitigation_status) process.exit(1);"
```

**Priority:** P0
**Estimated Lines:** 120
**Effort:** 30 mins
**Assigned To:** local:deepseek
**Type:** B
**Strategy:** create_new

---

### T-LEARN-011: Initialize failure-patterns.json with known patterns
**Description:** Create failure-patterns.json with FP-001 and FP-002 pre-populated

**Files Touched:**
- `.claude/learning/failure-patterns.json`

**Constraints:**
- Use data from ESCALATION_LOG.md entry [2025-12-12 11:50]
- FP-001: File Modification Anti-Pattern (4 occurrences, Type D)
- FP-002: Constraint Ignoring (2 occurrences)
- Set mitigation_status appropriately
- Include stats summary

**Test Command:**
```bash
node -e "const f = require('./.claude/learning/failure-patterns.json'); if (f.patterns.length !== 2) process.exit(1);"
```

**Priority:** P0
**Estimated Lines:** 80
**Effort:** 25 mins
**Assigned To:** local:qwen
**Type:** B (Template fill from known data)
**Strategy:** create_new
**Needs Context:**
- `.claude/ESCALATION_LOG.md` lines 1-303

---

### T-LEARN-012: Create pattern detection script
**Description:** Script to detect if new failure matches existing patterns

**Files Touched:**
- `scripts/detect-failure-pattern.cjs`

**Constraints:**
- Export detectPattern(taskLog) function
- Returns matching pattern_id or null
- Match on: error_type, failure signatures, task complexity type
- Simple string matching for MVP (no ML)

**Test Command:**
```bash
node -e "const d = require('./scripts/detect-failure-pattern.cjs'); console.log('Script loads')"
```

**Priority:** P1
**Estimated Lines:** 80
**Effort:** 35 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** create_new

---

### T-LEARN-013: Add pattern detection to dispatcher
**Description:** Call detectPattern() when task fails and update pattern occurrences

**Files Touched:**
- `scripts/dispatcher.cjs`

**Constraints:**
- Import detectPattern at top
- Call in complete command when tests fail (around line 362)
- If pattern detected, increment occurrence count in failure-patterns.json
- Log pattern match to console

**Test Command:**
```bash
grep -q "detectPattern" scripts/dispatcher.cjs
```

**Priority:** P1
**Estimated Lines:** 25
**Effort:** 25 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** incremental_edit

---

### T-LEARN-014: Create pattern effectiveness tracker
**Description:** Script to measure mitigation effectiveness after implementation

**Files Touched:**
- `scripts/track-pattern-effectiveness.cjs`

**Constraints:**
- Read task log after mitigation date
- Count attempts vs failures for pattern
- Calculate effectiveness rate
- Update pattern's effectiveness_rate field

**Test Command:**
```bash
node scripts/track-pattern-effectiveness.cjs --help | grep -q "pattern-id"
```

**Priority:** P2
**Estimated Lines:** 90
**Effort:** 40 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** create_new

---

## Phase 3: Dashboard Generation - Atomic Tasks

### T-LEARN-015: Create dashboard generator script skeleton
**Description:** Create generate-dashboard.cjs with data loading functions

**Files Touched:**
- `scripts/generate-dashboard.cjs`

**Constraints:**
- Load all 8 data sources (backlog.json, task log, patterns, violations, etc.)
- Export loadDashboardData() function
- Handle missing files gracefully
- Return aggregated data object

**Test Command:**
```bash
node -e "const g = require('./scripts/generate-dashboard.cjs'); console.log('Loads')"
```

**Priority:** P1
**Estimated Lines:** 150
**Effort:** 40 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** create_new

---

### T-LEARN-016: Add metrics calculation to dashboard generator
**Description:** Calculate health score, ROI, success rates, etc.

**Files Touched:**
- `scripts/generate-dashboard.cjs`

**Constraints:**
- calculateMetrics(data) function
- Return: health_score (0-100), success_rate, delegation_compliance, token_roi, etc.
- Use formulas from proposal
- Handle division by zero

**Test Command:**
```bash
grep -q "calculateMetrics" scripts/generate-dashboard.cjs
```

**Priority:** P1
**Estimated Lines:** 80
**Effort:** 30 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** incremental_edit

---

### T-LEARN-017: Add markdown generation to dashboard generator
**Description:** Generate markdown from data and metrics

**Files Touched:**
- `scripts/generate-dashboard.cjs`

**Constraints:**
- generateMarkdown(data, metrics) function
- Use exact format from proposal
- Include all sections: Executive Summary, Task Execution, Learning Engine, Projects, Compliance, etc.
- Return markdown string

**Test Command:**
```bash
grep -q "generateMarkdown" scripts/generate-dashboard.cjs
```

**Priority:** P1
**Estimated Lines:** 200
**Effort:** 50 mins
**Assigned To:** local:qwen
**Type:** B (Template fill - structure defined in proposal)
**Strategy:** incremental_edit

---

### T-LEARN-018: Add CLI interface to dashboard generator
**Description:** Add command-line interface for running generator

**Files Touched:**
- `scripts/generate-dashboard.cjs`

**Constraints:**
- #!/usr/bin/env node shebang
- Accept --output flag (default: .claude/DASHBOARD.md)
- Accept --verbose flag for debug output
- Call loadData → calculateMetrics → generateMarkdown → write file
- Print success message with file path

**Test Command:**
```bash
node scripts/generate-dashboard.cjs --help | grep -q "output"
```

**Priority:** P1
**Estimated Lines:** 40
**Effort:** 20 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** incremental_edit

---

### T-LEARN-019: Test dashboard generation manually
**Description:** Run generator and verify output format

**Files Touched:** None (verification task)

**Constraints:**
- Run: `node scripts/generate-dashboard.cjs`
- Verify .claude/DASHBOARD.md created
- Check all sections present
- Verify metrics calculate correctly
- Check markdown syntax valid

**Test Command:**
```bash
test -f .claude/DASHBOARD.md && grep -q "Executive Summary" .claude/DASHBOARD.md
```

**Priority:** P1
**Estimated Lines:** 0
**Effort:** 15 mins
**Assigned To:** human
**Type:** A (Manual verification)

---

### T-LEARN-020: Add dashboard to .gitignore
**Description:** Add DASHBOARD.md to .gitignore (auto-generated, local-only)

**Files Touched:**
- `.gitignore`

**Constraints:**
- Add `.claude/DASHBOARD.md` to .gitignore
- Add comment explaining it's auto-generated

**Test Command:**
```bash
grep -q "DASHBOARD.md" .gitignore
```

**Priority:** P1
**Estimated Lines:** 2
**Effort:** 5 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** incremental_edit

---

### T-LEARN-021: Document dashboard usage
**Description:** Add dashboard section to CLAUDE.md

**Files Touched:**
- `CLAUDE.md`

**Constraints:**
- Add section after "Local Model Delegation" section
- Title: "## System Health Dashboard"
- Explain how to generate and view dashboard
- Link to generate-dashboard.cjs and DASHBOARD.md
- Explain refresh frequency recommendation

**Test Command:**
```bash
grep -q "System Health Dashboard" CLAUDE.md
```

**Priority:** P2
**Estimated Lines:** 30
**Effort:** 15 mins
**Assigned To:** local:qwen
**Type:** B
**Strategy:** incremental_edit

---

## Phase 4: Automation & Integration - Atomic Tasks

### T-LEARN-022: Create failure classifier using LLM
**Description:** Use local LLM to auto-classify failure types from error messages

**Files Touched:**
- `scripts/classify-failure.cjs`

**Constraints:**
- Call local model with error message
- Return classification: type_error, syntax_error, test_failure, constraint_violation, etc.
- Fallback to "unknown" if classification uncertain
- Include confidence score

**Test Command:**
```bash
node scripts/classify-failure.cjs --error "TypeError: Cannot read property 'foo'" | grep -q "type_error"
```

**Priority:** P2
**Estimated Lines:** 100
**Effort:** 45 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** create_new

---

### T-LEARN-023: Create auto-pattern proposer
**Description:** After 2+ similar failures, propose new pattern for review

**Files Touched:**
- `scripts/propose-pattern.cjs`

**Constraints:**
- Scan task log for failures
- Group by error signature
- If 2+ similar failures without pattern, generate proposal
- Output pattern template to stdout for human review
- Don't auto-add to failure-patterns.json (human approval required)

**Test Command:**
```bash
node scripts/propose-pattern.cjs | grep -q "pattern_id"
```

**Priority:** P2
**Estimated Lines:** 120
**Effort:** 45 mins
**Assigned To:** local:deepseek
**Type:** C
**Strategy:** create_new

---

### T-LEARN-024: Add post-task dashboard update hook
**Description:** Create hook to regenerate dashboard after task completion

**Files Touched:**
- `.claude/hooks/dashboard-update.cjs`

**Constraints:**
- PostToolUse hook on dispatcher.cjs Bash calls
- Detect "dispatcher.cjs complete" command
- Run generate-dashboard.cjs silently
- Don't block on errors

**Test Command:**
```bash
grep -q "generate-dashboard" .claude/hooks/dashboard-update.cjs
```

**Priority:** P2
**Estimated Lines:** 50
**Effort:** 25 mins
**Assigned To:** local:qwen
**Type:** B
**Strategy:** create_new
**Needs Context:**
- `.claude/hooks/delegation-check.cjs` (for hook pattern reference)

---

### T-LEARN-025: Create /dashboard slash command
**Description:** Add slash command for quick dashboard viewing

**Files Touched:**
- `.claude/commands/dashboard.md`

**Constraints:**
- Command regenerates dashboard then reads it
- Format: Run generate-dashboard.cjs, then cat .claude/DASHBOARD.md
- Include usage examples

**Test Command:**
```bash
test -f .claude/commands/dashboard.md && grep -q "generate-dashboard" .claude/commands/dashboard.md
```

**Priority:** P2
**Estimated Lines:** 20
**Effort:** 10 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** create_new

---

### T-LEARN-026: Add dashboard to startup menu
**Description:** Add dashboard link to startup-menu.cjs

**Files Touched:**
- `.claude/hooks/startup-menu.cjs`

**Constraints:**
- Add new menu option: "[7] View System Dashboard"
- Trigger /dashboard command when selected
- Insert after existing menu options

**Test Command:**
```bash
grep -q "System Dashboard" .claude/hooks/startup-menu.cjs
```

**Priority:** P2
**Estimated Lines:** 15
**Effort:** 15 mins
**Assigned To:** local:qwen
**Type:** A
**Strategy:** incremental_edit

---

## Task Summary

**Phase 1 (Enhanced Logging):** 8 tasks
- 4 Type A (Mechanical)
- 1 Type B (Template)
- 3 Type C (Creative)

**Phase 2 (Learning Engine):** 6 tasks
- 2 Type A
- 2 Type B
- 2 Type C

**Phase 3 (Dashboard):** 7 tasks
- 3 Type A
- 2 Type B
- 2 Type C

**Phase 4 (Automation):** 5 tasks
- 3 Type A
- 1 Type B
- 1 Type C

**Total:** 26 tasks

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ All task executions logged to `.claude/logs/local-model-tasks.log`
- ✅ Log includes stdout, stderr, test results, failure details
- ✅ Log viewable with `scripts/view-task-log.cjs`
- ✅ No dispatcher functionality broken

**Phase 2 Complete When:**
- ✅ FP-001 and FP-002 tracked in `failure-patterns.json`
- ✅ New failures auto-matched to existing patterns
- ✅ Pattern occurrence counts auto-increment
- ✅ Mitigation effectiveness measurable

**Phase 3 Complete When:**
- ✅ Dashboard auto-generates from all data sources
- ✅ Health score calculates correctly
- ✅ All sections from proposal present
- ✅ Markdown syntax valid

**Phase 4 Complete When:**
- ✅ Failures auto-classified
- ✅ New patterns auto-proposed after 2+ similar failures
- ✅ Dashboard updates after each task completion
- ✅ `/dashboard` command functional

**Overall Success:**
- ✅ User can assess system health in <5 minutes via dashboard
- ✅ Repeat failures reduced by 80% (tracked via patterns)
- ✅ Token ROI visible and trending positive
- ✅ All 26 tasks complete and integrated

---

## Risks & Mitigations

**Risk:** Dispatcher modifications break existing functionality
**Mitigation:** Extensive testing of dispatcher after each change, wrap all logging in try-catch

**Risk:** JSONL log file grows too large
**Mitigation:** Implement log rotation (keep last 1000 entries) in Phase 4

**Risk:** Pattern detection has false positives
**Mitigation:** Require human approval for new patterns, only auto-increment existing patterns

**Risk:** Dashboard generation is slow
**Mitigation:** Cache data sources, only regenerate when data changes

---

## Next Steps

**For this session:**
- ✅ Project file created
- ⏭️ Stop before execution

**For next session:**
1. Read this project file
2. Start Phase 1 execution
3. Execute tasks T-LEARN-001 through T-LEARN-008 via dispatcher
4. Verify logging works end-to-end
5. Proceed to Phase 2

**Commands for next session:**
```bash
# Load Phase 1 tasks
cat docs/projects/0.003.1212-learning-dashboard.project.md | grep -A 100 "T-LEARN-001" # Extract task JSONs

# Or manually create task JSON from task specs above
# Then: node scripts/dispatcher.cjs add-tasks < phase1-tasks.json
```

---

## References

- **Proposal Discussion:** See conversation history (token usage: 77k/200k)
- **Escalation Log:** `.claude/ESCALATION_LOG.md` (known patterns)
- **Existing Schemas:** `.claude/schemas/*.schema.json`
- **Dispatcher:** `scripts/dispatcher.cjs` (task execution)
- **Hooks:** `.claude/hooks/delegation-check.cjs` (violation tracking example)

---

**Project Status:** Ready for execution in new session
**Blocked By:** None
**Blocking:** None
**Last Updated:** 2025-12-12 (session 30 - preparing for new session)
