# Token Optimization Dashboard
**Initialized**: 2025-12-10 | **Budget**: 30,000 tokens/session

## System Status

| Component | Status | File |
|-----------|--------|------|
| Budget enforcement | Active | `.claude/hooks/budget-check.cjs` |
| Metrics collection | Active | `.claude/hooks/metrics-collector.cjs` |
| Delegation blocking | Active | `.claude/hooks/delegation-check-pre.cjs` |
| Efficiency tracking | Active | `.claude/hooks/efficiency-tracker.cjs` |
| Local model execution | Ready | `scripts/execute-local-task.sh` |
| Index generation | Ready | `scripts/generate-index.sh` |

## Index Files

| File | Purpose | Tokens |
|------|---------|--------|
| `.claude/index/STRUCTURE.md` | Directory tree, file counts | ~300 |
| `.claude/index/SYMBOLS.md` | Functions, constants, exports | ~500 |
| `.claude/index/PATTERNS.md` | Code conventions, patterns | ~200 |
| **Total** | | **~1,000** |

vs Raw source reads: ~3,000-5,000 tokens

## Weekly Metrics

Data collected from `.claude/metrics/session-YYYY-MM-DD.json` files.

| Week | Sessions | Avg Tokens | Top Tool | Under Budget | Status |
|------|----------|------------|----------|--------------|--------|
| W50 (Dec 9-15) | - | - | - | - | Collecting |

### Week Detail Template
When analyzing a week, examine session files and calculate:
- **Sessions**: Count of session blocks across daily files
- **Avg Tokens**: Sum of estimatedTokens / session count
- **Top Tool**: Tool with highest token consumption
- **Under Budget**: % of sessions that stayed under 30K

### Trend Analysis
<!-- Updated by /metrics command or manual review -->
- **Improving**: Avg tokens trending down week-over-week
- **Stable**: Within 10% variance
- **Regressing**: Avg tokens trending up

Current Trend: `Baseline` (Week 1 of tracking)

## Targets (30-Day)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Tokens/session | <25,000 | TBD | Pending |
| Summary usage | 90% | TBD | Pending |
| Local model tasks | 15/session | TBD | Pending |
| Scan-before-drill | 85% | TBD | Pending |

## Quick Commands

```bash
# View current session metrics (use /metrics command for formatted view)
cat .claude/metrics/session-$(date +%Y-%m-%d).json | python -m json.tool

# Regenerate indexes
bash scripts/generate-index.sh

# Check local model health
curl -s http://10.0.0.230:1234/v1/models | head -5

# Execute a task spec
bash scripts/execute-local-task.sh .claude/task-specs/T-XXX.json

# View session efficiency
cat .claude/.efficiency-session.json | python -m json.tool

# View budget status
cat .claude/.session-budget.json | python -m json.tool

# List all session metrics files
ls -la .claude/metrics/session-*.json
```

## Log Files

| Log | Location | Purpose |
|-----|----------|---------|
| Session metrics | `.claude/metrics/session-YYYY-MM-DD.json` | Token usage per day |
| Task execution | `.claude/metrics/local-model-tasks.log` | Local model results |
| Efficiency session | `.claude/.efficiency-session.json` | Per-session metrics |
| Budget tracking | `.claude/.session-budget.json` | Token budget state |
| Delegation blocks | `.claude/.delegation-violations.json` | Blocked writes |

## Top Token Consumers (Reference)

Typical token costs by tool (estimated):
| Tool | Typical Cost | Notes |
|------|--------------|-------|
| Task (Explore) | 2,000-5,000 | Agent launch + exploration |
| Read (large file) | 500-2,000 | Depends on file size |
| Read (context file) | 100-200 | Optimized summaries |
| Grep/Glob | 50-200 | Efficient searches |
| Edit | 100-500 | Input + output |

**Optimization tip**: Use context files and index lookups to reduce Read costs by 60-80%.
