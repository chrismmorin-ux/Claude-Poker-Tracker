---
description: Analyze and reduce context file sizes to minimize token usage
argument-hint: ["analyze" | "recommend" | "apply"]
---

Use the **process-specialist** subagent to analyze and reduce context overhead.

## Mode: $ARGUMENTS

- **analyze** (default): Measure all context files, identify redundancy, report sizes
- **recommend**: Analyze + provide specific consolidation/trimming recommendations
- **apply**: Recommend + implement the changes (with user approval)

## Analysis Targets

1. **CLAUDE.md** (~41KB currently)
   - What sections are essential for every task?
   - What sections could be on-demand only?
   - What is duplicated elsewhere?

2. **.claude/context/*.md** (~2KB total)
   - Are these being used effectively?
   - Should more content move here from CLAUDE.md?
   - Are they up to date?

3. **.claude/*.md guides** (~6KB total)
   - AGENT_GUIDE.md, LOCAL_MODELS_GUIDE.md
   - Could these be consolidated?
   - Are they duplicating CLAUDE.md content?

4. **docs/*.md** files
   - What's essential vs reference-only?
   - Could quick-reference cards replace full docs?

## Context Layering Target

```
Layer 0: Essential (~500 tokens) - Every session
  - Project type, key commands, critical rules

Layer 1: Quick Start (~500 tokens) - Most sessions
  - File structure overview, common patterns

Layer 2: Task-Specific (~500 tokens) - On-demand
  - Reducer details, hook patterns, etc.

Layer 3: Full Reference (on-demand) - Rare
  - Complete documentation
```

## Output Format

```markdown
## Context Efficiency Report

### Current State
| File | Lines | Bytes | Tokens (est) | Essential % |
|------|-------|-------|--------------|-------------|
| CLAUDE.md | X | X | X | X% |
| ... | ... | ... | ... | ... |

### Redundancy Analysis
| Content | Found In | Recommendation |
|---------|----------|----------------|
| [topic] | file1, file2 | Keep in X, remove from Y |

### Recommended Actions
1. [Action with estimated token savings]
2. ...

### New Structure (if apply mode)
[Proposed file changes]
```

Goal: Reduce context loaded per session by 50% without losing essential information.
