# Token Phase Tracking System Design

## Overview

Track token usage across different project phases to identify where tokens are spent and optimize workflows.

## Phases Defined

| Phase | Description | Tool Indicators |
|-------|-------------|-----------------|
| `preparation` | Reading context, index files | Read on `.claude/index/*`, `.claude/context/*` |
| `exploration` | Searching codebase | Task(Explore), Grep, Glob |
| `planning` | Designing implementation | EnterPlanMode, ExitPlanMode, Task(Plan) |
| `research` | External information gathering | WebSearch, WebFetch |
| `file_reading` | Reading source files | Read (non-context files) |
| `execution` | Writing/editing code | Write, Edit, NotebookEdit |
| `testing` | Running tests | Bash(*test*), Task(test-gen) |
| `commits` | Git operations | Bash(git*), Task(code-reviewer) |
| `other` | Unclassified operations | Everything else |

## State Schema Addition

```json
{
  "tokensByPhase": {
    "preparation": { "toolCalls": 0, "estimatedTokens": 0 },
    "exploration": { "toolCalls": 0, "estimatedTokens": 0 },
    "planning": { "toolCalls": 0, "estimatedTokens": 0 },
    "research": { "toolCalls": 0, "estimatedTokens": 0 },
    "file_reading": { "toolCalls": 0, "estimatedTokens": 0 },
    "execution": { "toolCalls": 0, "estimatedTokens": 0 },
    "testing": { "toolCalls": 0, "estimatedTokens": 0 },
    "commits": { "toolCalls": 0, "estimatedTokens": 0 },
    "other": { "toolCalls": 0, "estimatedTokens": 0 }
  },
  "phaseTransitions": []
}
```

## Token Estimation Strategy

Since hooks don't have direct token access, estimate based on tool type:

| Tool | Estimated Tokens |
|------|------------------|
| Read (small file) | 200 |
| Read (medium file) | 800 |
| Read (large file) | 2000 |
| Grep | 300 |
| Glob | 100 |
| Write | 500 |
| Edit | 300 |
| WebSearch | 1500 |
| WebFetch | 2000 |
| Task (agent) | 3000 |
| Bash | 200 |

## Phase Detection Algorithm

```javascript
function detectPhase(tool, input) {
  // Preparation: reading context/index files
  if (tool === 'Read') {
    const path = input?.file_path || '';
    if (path.includes('.claude/index/') || path.includes('.claude/context/')) {
      return 'preparation';
    }
    return 'file_reading';
  }

  // Exploration
  if (tool === 'Grep' || tool === 'Glob') return 'exploration';
  if (tool === 'Task' && input?.subagent_type === 'Explore') return 'exploration';

  // Planning
  if (tool === 'EnterPlanMode' || tool === 'ExitPlanMode') return 'planning';
  if (tool === 'Task' && input?.subagent_type === 'Plan') return 'planning';

  // Research
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'research';

  // Execution
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') return 'execution';

  // Testing
  if (tool === 'Bash') {
    const cmd = input?.command || '';
    if (cmd.includes('test') || cmd.includes('jest') || cmd.includes('vitest')) {
      return 'testing';
    }
    // Commits
    if (cmd.includes('git')) return 'commits';
  }
  if (tool === 'Task' && input?.subagent_type === 'test-gen') return 'testing';
  if (tool === 'Task' && input?.subagent_type === 'code-reviewer') return 'commits';

  return 'other';
}
```

## Dashboard Output Enhancement

```
TOKEN USAGE BY PHASE
├─ preparation:   ████░░░░░░░░░░░░  1,200 tokens (8%)
├─ exploration:   ██████░░░░░░░░░░  2,400 tokens (16%)
├─ planning:      ████████░░░░░░░░  3,000 tokens (20%)
├─ file_reading:  ██████████░░░░░░  4,500 tokens (30%)
├─ execution:     ██████░░░░░░░░░░  2,100 tokens (14%)
├─ testing:       ████░░░░░░░░░░░░  1,200 tokens (8%)
├─ commits:       ██░░░░░░░░░░░░░░    600 tokens (4%)
└─ other:         ░░░░░░░░░░░░░░░░      0 tokens (0%)

PHASE INSIGHTS
⚠️  file_reading consuming 30% - consider using index files first
✅ planning at 20% - good investment for complex tasks
```

## Audit Report Enhancement

Add new section:

```markdown
## Token Usage by Phase

| Phase | Tool Calls | Est. Tokens | % of Total |
|-------|------------|-------------|------------|
| preparation | 5 | 1,200 | 8% |
| exploration | 12 | 2,400 | 16% |
| ...

### Phase Analysis

**Highest consumption**: file_reading (30%)
- Consider: Read index files before source files
- Consider: Use Grep to find specific sections before full file reads

**Recommendations based on phase patterns**:
- R-PHZ-001: High exploration (>25%) - Create better index files
- R-PHZ-002: Low preparation (<5%) - Read context files first
- R-PHZ-003: High file_reading (>40%) - Use scan-then-drill pattern
```

## Implementation Files

1. `.claude/hooks/pm-session-tracker.cjs` - Add phase detection and tracking
2. `scripts/pm-dashboard.sh` - Add phase breakdown display
3. `scripts/pm-audit-capture.sh` - Add phase analysis section
4. `.claude/.pm-state-template.json` - Add tokensByPhase structure
