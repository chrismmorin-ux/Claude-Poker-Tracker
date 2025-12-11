# Process System Audit Command

Analyzes macro-level system health across multiple dimensions: subagent effectiveness, command utilization, context architecture, hook ROI, and trend analysis.

## Usage

```bash
/process-system-audit [area]
```

**Areas:**
- `subagents` - Subagent effectiveness tracking (DeepSeek/Qwen/Claude success rates)
- `commands` - Command utilization and redundancy analysis
- `context` - Context architecture validation and efficiency
- `hooks` - Hook system ROI analysis and consolidation opportunities
- `trends` - 30-day improvement trends across all metrics
- `all` - Complete system health report (default)

## What It Does

### Subagents Analysis
Compares DeepSeek vs Qwen vs Claude effectiveness:
- First-pass test success rates
- Average token usage per task
- Common failure patterns
- Task classification recommendations

**Output Example:**
```
DeepSeek: 75% first-pass rate, avg 1,200 tokens
- Best for: Pure utilities (<100 lines)
- Struggles with: React components, import paths

Qwen: 88% first-pass rate, avg 1,500 tokens
- Best for: Refactoring, medium components
- Struggles with: Over-complex solutions

Recommendation: Route simple_utility to Qwen for higher quality
```

### Commands Analysis
Identifies underutilized or redundant commands:
- Invocation frequency (30-day window)
- Command recommendation adoption rates
- Chaining opportunities (manual sequences)
- Confusion patterns (similar commands)

**Output Example:**
```
/local-refactor: 0 invocations in 30 days
/local-code: 2 invocations in 30 days
/route: Suggestions followed 15% of time

Recommendation: Merge /local-* into /delegate-auto
Recommendation: Improve /route advice specificity
```

### Context Analysis
Validates tiered context loading system:
- Index usage rate (SYMBOLS.md before search)
- Context file read frequency vs source files
- Token savings from context files
- Context accuracy (staleness detection)

**Output Example:**
```
SYMBOLS.md referenced: 20% of searches
Context files read: 35% of file access
Source files read directly: 65% of file access
Token savings: ~400 tokens/session from context

Recommendation: Index underutilized, consider auto-update
Recommendation: Promote context files in pre-search hooks
```

### Hooks Analysis
Calculates ROI for each hook:
- Firing frequency
- Advice adoption rate
- Tokens saved vs overhead
- "Crying wolf" detection

**Output Example:**
```
test-gate-enforcer:
  Fires: 8 times/session
  Adoption: 95% (tests run before commit)
  Token savings: ~8,000 tokens/session
  ROI: 16x overhead

docs-sync.cjs:
  Fires: 50 times/session
  Adoption: 10% (advice ignored)
  Token savings: ~200 tokens/session
  ROI: 0.4x overhead (negative value)

Recommendation: Reduce docs-sync trigger sensitivity
```

### Trends Analysis
Shows 30-day improvement trends:
- Delegation compliance rate
- Error recurrence rate
- Token efficiency (tokens/task)
- Process maturity score (0-10)

**Output Example:**
```
30-Day Trends:
- Delegation compliance: 5% → 68% (+63% ✅)
- Error recurrence: 15% → 8% (-7% ✅)
- Tokens/task: 3,200 → 2,100 (-34% ✅)
- Process maturity: 3.2 → 6.8 (+3.6 ✅)

Overall: System maturing rapidly
Recommendation: Consider reducing enforcement friction
```

## Implementation

The command calls Python analysis scripts that:
1. Read metrics from `.claude/metrics/*.json`
2. Parse git logs for error patterns
3. Analyze session transcripts for patterns
4. Calculate trends over 7-day, 30-day, 90-day windows
5. Generate actionable recommendations

## Data Sources

- `.claude/metrics/subagent-effectiveness.json` - Task outcomes by model
- `.claude/metrics/command-usage.json` - Command invocation tracking
- `.claude/metrics/hook-activity.json` - Hook firing and adoption
- `.claude/metrics/delegation.json` - Delegation compliance
- Git logs - Error patterns and fixes
- Session transcripts - Usage patterns

## When to Use

Run this audit:
- **Weekly**: Quick check (`/process-system-audit trends`)
- **Monthly**: Full audit (`/process-system-audit all`)
- **After major changes**: Validate impact
- **Before proposing new rules**: Check current system health

## Strategic Value

This command transforms the Process Specialist from tactical (fixing individual errors) to strategic (optimizing the entire system). It provides data-driven insights on which process investments have the highest ROI.
