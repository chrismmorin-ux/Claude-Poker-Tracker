# Program Management Agent - Real-Time Workflow Enforcement

**Status**: Complete
**Created**: 2025-12-11
**Owner**: System Optimization
**Priority**: High

---

## Executive Summary

Implement a **Program Management Agent** that provides real-time enforcement of workflow compliance during sessions. This agent acts as a session supervisor, blocking non-compliant actions *before* they happen, unlike the Process Specialist which analyzes *after* the fact.

**Key Distinction**:
| Agent | Scope | Timing | Action |
|-------|-------|--------|--------|
| **Program Manager** | Real-time enforcement | During session | Blocks violations |
| **Process Specialist** | System optimization | Post-session | Recommends improvements |

---

## Problem Statement

### Problem 1: 0% Delegation Despite Working Infrastructure
**Evidence**: Process Specialist review showed zero tasks delegated despite:
- `execute-local-task.sh` working correctly (346 lines, robust)
- LM Studio running at 10.0.0.230:1234
- DeepSeek Coder 7B and Qwen 2.5 Coder 7B available

**Root Causes**:
1. Manual task spec creation takes 2-5 minutes (friction too high)
2. Task categories too narrow (80-line limit excludes 70%+ of work)
3. Slash commands use console output instead of file creation
4. Opt-in model fails (must explicitly choose to delegate)

### Problem 2: No Real-Time Enforcement
**Evidence**: Hooks warn but don't block, violations continue:
- Token budget exceeded 2.87x (86k vs 30k target)
- EnterPlanMode skipped for 8-file modification
- Project file not created for multi-phase work

**Root Causes**:
1. Warnings are ignored (no consequences)
2. Easy to bypass by not creating project file
3. No session-level supervisor tracking compliance
4. Passive monitoring, not active enforcement

### Problem 3: Time Creeps Into Planning
**Evidence**: Despite rule "time is NOT a factor", estimates appear in plans:
- "Week 1-2: Phase 1"
- "This will take about 2 hours"

**Root Causes**:
1. No enforcement mechanism for token-only planning
2. Default behavior includes time estimates
3. No block when time mentioned

### Problem 4: Poor Real-Time Visibility
**Evidence**: Must check multiple files to know session state:
- `.claude/.pm-state.json` for tokens
- `.claude/metrics/delegation.json` for compliance
- Git log for files modified

**Root Causes**:
1. No unified dashboard
2. No proactive warnings
3. Status buried in separate files

---

## Solution: Program Management Agent

### Core Capabilities

1. **Session Supervision**
   - Track all tool uses in real-time
   - Maintain session state (tokens, files, delegation)
   - Provide `/pm-status` dashboard

2. **Reverse-Default Delegation**
   - Assume ALL tasks delegate unless marked `[CLAUDE]`
   - Auto-generate task specs (no manual creation)
   - Expanded categories (200-line utilities, 150-line components)

3. **Blocking Enforcement**
   - Block writes that should delegate (no `[CLAUDE]` tag)
   - Block multi-file work without EnterPlanMode
   - Block at token budget threshold
   - Block planning with time estimates

4. **Real-Time Visibility**
   - Token budget bar chart
   - Delegation compliance rate
   - Files modified count
   - Warnings and blocks displayed

---

## Phases

### Phase 1: PM Agent Core & State Tracking ✅ COMPLETE

**Goal**: Create the PM agent with session state tracking and dashboard

**Tasks**:
- [x] Create `.claude/agents/program-manager.md` - Agent definition
- [x] Create `.claude/commands/pm-status.md` - Dashboard command
- [x] Create `.claude/.pm-state-template.json` - State structure
- [x] Create `.claude/hooks/pm-session-tracker.cjs` - Track all tool uses
- [x] Create `scripts/pm-dashboard.sh` - Generate dashboard output

**PM State Structure**:
```json
{
  "sessionId": "uuid-v4",
  "startTime": "2025-12-11T18:00:00Z",
  "tokenBudget": {
    "total": 30000,
    "used": 0,
    "remaining": 30000,
    "percentUsed": 0,
    "warningThreshold": 24000,
    "blockThreshold": 28000
  },
  "delegation": {
    "tasksSeen": 0,
    "tasksDelegated": 0,
    "tasksBlocked": 0,
    "tasksBypassedWithTag": 0,
    "complianceRate": 0.0
  },
  "filesModified": [],
  "currentProject": null,
  "currentPhase": null,
  "warnings": [],
  "blocks": [],
  "lastToolUse": null
}
```

**Dashboard Output (`/pm-status`)**:
```
╔═══════════════════════════════════════════════════════════╗
║           PROGRAM MANAGER - SESSION STATUS                ║
╚═══════════════════════════════════════════════════════════╝

📊 TOKEN BUDGET
████████████░░░░░░░░░░░░░░░░░░ 12,500 / 30,000 (42%)
└─ 17,500 remaining (~5 typical tasks)
└─ Warning at 24,000 | Block at 28,000

📋 DELEGATION COMPLIANCE
██████████████████░░░░░░░░░░░░ 6 / 8 tasks (75%)
├─ Delegated: 6 tasks (saved ~15k tokens)
├─ Blocked: 1 task (missing [CLAUDE] tag)
└─ Bypassed: 1 task (had [CLAUDE] tag)

📁 FILES MODIFIED: 12 files
├─ src/components/: 5 files
├─ src/utils/: 4 files
└─ tests/: 3 files

🎯 CURRENT CONTEXT
├─ Project: ui-overhaul
├─ Phase: Phase 3 - Pattern Recognition
└─ Duration: 45 minutes

⚠️  ACTIVE WARNINGS
└─ Token budget at 42%, consider wrapping up

✅ SESSION STATUS: Good
```

**Files to Create**:
| File | Purpose |
|------|---------|
| `.claude/agents/program-manager.md` | Agent definition with all capabilities |
| `.claude/commands/pm-status.md` | Dashboard command documentation |
| `.claude/.pm-state-template.json` | Initial state structure |
| `.claude/hooks/pm-session-tracker.cjs` | PostToolUse hook for state updates |
| `scripts/pm-dashboard.sh` | Generate formatted dashboard |

---

### Phase 2: Reverse-Default Delegation ✅ COMPLETE

**Goal**: Flip delegation to opt-out (delegate unless `[CLAUDE]`)

**Tasks**:
- [x] Create `scripts/task-classifier-v3.sh` - Expanded categories
- [x] Create `scripts/auto-generate-task-spec.sh` - No manual creation
- [x] Create `.claude/hooks/delegation-enforcer.cjs` - Blocks non-compliant writes
- [x] Update `.claude/commands/local.md` - Use new auto-delegation
- [x] Create `[CLAUDE]` tag detection and bypass logic
- [x] Create `.claude/templates/task-spec-template.json` - Template with examples
- [x] Register hooks in `.claude/settings.json`

**Expanded Task Categories**:
```
CURRENT (too narrow):
├─ simple_utility: <80 lines → DELEGATE
├─ simple_component: <80 lines → DELEGATE
├─ refactor: any size → DELEGATE
├─ complex: >80 lines → CLAUDE
└─ claude_required: marked → CLAUDE

EXPANDED (captures 70%+ more):
├─ simple_utility: <200 lines, pure functions → DELEGATE
├─ simple_component: <150 lines, standard patterns → DELEGATE
├─ medium_component: <300 lines, hooks/state → DELEGATE
├─ refactor: any size, clear scope → DELEGATE
├─ complex: >300 lines or novel patterns → CLAUDE
└─ claude_required: [CLAUDE] tag present → CLAUDE
```

**Auto-Spec Generation Flow**:
```
1. Write tool called for new file
2. PM agent intercepts (PreToolUse)
3. Classify task automatically:
   - File type (utility, component, test)
   - Estimated lines
   - Complexity indicators
4. If should delegate:
   a. Generate task spec JSON automatically
   b. Route to appropriate model (DeepSeek/Qwen)
   c. Execute via execute-local-task.sh
   d. Return result (success or fallback to Claude)
5. If [CLAUDE] tag present:
   a. Allow write
   b. Log bypass reason
```

**Files to Create**:
| File | Purpose |
|------|---------|
| `scripts/task-classifier-v3.sh` | New classifier with expanded categories |
| `scripts/auto-generate-task-spec.sh` | Auto-create task specs from context |
| `.claude/hooks/delegation-enforcer.cjs` | PreToolUse hook that blocks/delegates |
| `.claude/templates/task-spec-template.json` | Template for auto-generated specs |

---

### Phase 3: Blocking Enforcement Hooks ✅ COMPLETE

**Goal**: Replace warnings with blocks that require explicit override

**Tasks**:
- [x] Create `.claude/hooks/pm-multi-file-gate.cjs` - Require EnterPlanMode for 4+ files
- [x] Create `.claude/hooks/pm-token-enforcer.cjs` - Block at 28k, warn at 24k
- [x] Create `.claude/hooks/pm-time-estimate-detector.cjs` - Block time in planning
- [x] Create `.claude/hooks/pm-project-required.cjs` - Require project file for multi-phase
- [x] Register all hooks in `.claude/settings.json`

**Enforcement Rules**:

| Rule | Trigger | Action | Override |
|------|---------|--------|----------|
| Delegation Required | Write without [CLAUDE] | Block → Auto-delegate | Add [CLAUDE] tag |
| EnterPlanMode Required | 4+ files without plan | Block | Use EnterPlanMode |
| Token Budget Exceeded | >28,000 tokens | Block | User approval |
| Token Budget Warning | >24,000 tokens | Warn | Continue |
| Time Estimate Detected | "week", "hour", "day" in plan | Block | Remove time references |
| Project Required | Multi-phase without project | Block | Create project file |

**Hook Implementation Pattern**:
```javascript
// pm-delegation-enforcer.cjs
module.exports = async function(event, context) {
  const { tool, input } = event;

  // Only check Write/Edit tools
  if (!['Write', 'Edit'].includes(tool)) {
    return { allow: true };
  }

  // Check for [CLAUDE] bypass tag
  if (hasClaudeTag(context)) {
    logBypass(input.file_path, 'CLAUDE tag present');
    return { allow: true };
  }

  // Classify the task
  const classification = classifyTask(input);

  if (classification.shouldDelegate) {
    // Auto-generate spec and delegate
    const spec = autoGenerateSpec(input, context);
    const result = await executeLocalTask(spec);

    if (result.success) {
      return {
        allow: false,
        message: `✅ Task delegated to ${spec.model}. File created successfully.`
      };
    } else {
      // Fallback to Claude
      logDelegationFailure(spec, result.error);
      return { allow: true, message: '⚠️ Delegation failed, falling back to Claude' };
    }
  }

  return { allow: true };
};
```

**Files to Create**:
| File | Purpose |
|------|---------|
| `.claude/hooks/pm-multi-file-gate.cjs` | Block 4+ files without EnterPlanMode |
| `.claude/hooks/pm-token-enforcer.cjs` | Enforce token budget |
| `.claude/hooks/pm-time-estimate-detector.cjs` | Block time estimates in plans |
| `.claude/hooks/pm-project-required.cjs` | Require project for multi-phase |

---

### Phase 4: Integration & Visibility ✅ COMPLETE

**Goal**: Unified dashboard, proactive suggestions, full integration

**Tasks**:
- [x] Register all new hooks in settings.json
- [x] Add proactive suggestions to /pm-status (enhanced dashboard script)
- [x] Create `/pm-override` command for explicit bypasses
- [x] Document all commands and hooks
- [x] pm-status.md already exists from Phase 1

**Proactive Suggestions**:
```
🎯 RECOMMENDATIONS:
├─ Token budget at 60%: Consider delegating remaining UI tasks
├─ 3 similar files modified: Use /gen-tests to batch test generation
├─ Phase 2 complete: Run /project phase-complete to checkpoint
└─ Session >90 min: Consider starting fresh (use /session-advice)
```

**Override Command (`/pm-override`)**:
```bash
/pm-override delegation   # Allow Claude to write without delegation
/pm-override budget       # Allow exceeding token budget (this task only)
/pm-override time         # Allow time estimates in planning

# All overrides are logged and included in Process Specialist review
```

**Files to Create/Update**:
| File | Purpose |
|------|---------|
| `.claude/settings.json` | Register all new hooks |
| `.claude/commands/pm-override.md` | Override command documentation |
| `.claude/context/PM_STATE.md` | Auto-generated context summary |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Delegation Compliance | 0% | 70%+ | Tasks delegated / delegable tasks |
| Task Spec Creation Time | 2-5 min | <30 sec | Time from task to spec |
| Token Budget Compliance | 33% | 90%+ | Sessions within budget |
| Time Estimates in Plans | Common | Zero | Plans with time references |
| EnterPlanMode Usage | Low | 100% for 4+ files | Multi-file work with plan |

---

## Expected Impact

### Token Savings
- **Delegation at 70%**: ~18k tokens/session saved
  - 7 tasks delegated × 2.5k tokens/task
- **Budget enforcement**: Prevents 2-3x overruns
- **EnterPlanMode**: Prevents wrong approaches (~5k saved)

### Quality Improvements
- **Forced decomposition**: Better task planning
- **Local model coverage**: More work validated by tests
- **Explicit decisions**: [CLAUDE] tags create audit trail

### Visibility Improvements
- **Real-time dashboard**: Know session state instantly
- **Proactive warnings**: Issues surfaced before problems
- **Override logging**: All bypasses tracked for review

---

## Implementation Notes

### [CLAUDE] Tag Usage
```markdown
When a task MUST be done by Claude (not delegated):
1. Add [CLAUDE] tag to task description in BACKLOG.md
2. Or include [CLAUDE] in commit message
3. Or use /pm-override delegation

Examples requiring [CLAUDE]:
- Novel architecture decisions
- Complex debugging requiring full context
- Security-sensitive code review
- Tasks requiring web search or external APIs
```

### Fallback Behavior
```
If local model delegation fails:
1. Log failure reason to .claude/metrics/delegation-failures.log
2. Warn user about fallback
3. Allow Claude to complete task
4. Include in Process Specialist review for pattern analysis
```

### Hook Execution Order
```
PreToolUse hooks (in order):
1. pm-session-tracker.cjs (update state)
2. pm-delegation-enforcer.cjs (check delegation)
3. pm-multi-file-gate.cjs (check plan requirement)
4. pm-token-enforcer.cjs (check budget)
5. pm-time-estimate-detector.cjs (check for time)
6. pm-project-required.cjs (check project file)
```

---

## Testing Plan

### Phase 1 Tests
- [ ] PM state initializes correctly on session start
- [ ] /pm-status displays accurate dashboard
- [ ] State updates after each tool use

### Phase 2 Tests
- [ ] Task classifier v3 correctly expands categories
- [ ] Auto-spec generation creates valid specs
- [ ] Delegation enforcer blocks writes without [CLAUDE]
- [ ] [CLAUDE] tag bypasses correctly

### Phase 3 Tests
- [ ] Multi-file gate blocks without EnterPlanMode
- [ ] Token enforcer blocks at 28k, warns at 24k
- [ ] Time estimate detector catches "week", "hour", "day"
- [ ] Project required gate blocks multi-phase without project

### Phase 4 Tests
- [ ] All hooks registered and firing
- [ ] /pm-override works for all categories
- [ ] Proactive suggestions appear correctly
- [ ] End-to-end delegation flow works

---

## Rollout Strategy

1. **Week 1 (Phase 1)**: Core PM agent, state tracking, dashboard
   - No enforcement, just visibility
   - Validate state tracking accuracy

2. **Week 2 (Phase 2)**: Reverse-default delegation
   - Start with warnings only
   - Validate auto-spec generation quality

3. **Week 3 (Phase 3)**: Enable blocking enforcement
   - Gradual rollout (start with delegation enforcer)
   - Monitor for false positives

4. **Week 4 (Phase 4)**: Full integration
   - All hooks active
   - Proactive suggestions enabled
   - Documentation complete

---

## File Checklist

### Create (14 files)
- [ ] `.claude/agents/program-manager.md`
- [ ] `.claude/commands/pm-status.md`
- [ ] `.claude/commands/pm-override.md`
- [ ] `.claude/.pm-state-template.json`
- [ ] `.claude/hooks/pm-session-tracker.cjs`
- [ ] `.claude/hooks/delegation-enforcer.cjs`
- [ ] `.claude/hooks/pm-multi-file-gate.cjs`
- [ ] `.claude/hooks/pm-token-enforcer.cjs`
- [ ] `.claude/hooks/pm-time-estimate-detector.cjs`
- [ ] `.claude/hooks/pm-project-required.cjs`
- [ ] `scripts/pm-dashboard.sh`
- [ ] `scripts/task-classifier-v3.sh`
- [ ] `scripts/auto-generate-task-spec.sh`
- [ ] `.claude/templates/task-spec-template.json`

### Update (2 files)
- [ ] `.claude/settings.json` (register hooks)
- [ ] `.claude/commands/local.md` (use auto-delegation)

---

## Continuation Prompt

When starting a new session to implement this project:

```
Continue implementing the Program Management Agent from docs/projects/program-manager.project.md

This project creates real-time workflow enforcement with:
1. Session state tracking and /pm-status dashboard
2. Reverse-default delegation (delegate unless [CLAUDE])
3. Blocking enforcement hooks
4. Real-time visibility and proactive suggestions

Start with Phase 1: PM Agent Core & State Tracking
- Create .claude/agents/program-manager.md
- Create .claude/commands/pm-status.md
- Create PM state tracking hook

Context files to read:
- .claude/context/CONTEXT_SUMMARY.md
- docs/projects/program-manager.project.md
- .claude/agents/process-specialist.md (for comparison)

The Process Specialist enhancement (macro analysis) and project closeout automation
are already complete. This project adds the real-time enforcement layer.
```

---

## Related Work

- ✅ **Process Specialist Enhancement** (complete): Macro-level analysis, 7 new capabilities
- ✅ **Project Closeout Automation** (complete): 4 auto-generated artifacts, session advisor
- 🔄 **Program Management Agent** (this project): Real-time enforcement

These three components work together:
- **Program Manager**: Enforces rules in real-time during sessions
- **Process Specialist**: Analyzes patterns and recommends system improvements
- **Closeout Automation**: Captures learnings and generates continuation prompts
