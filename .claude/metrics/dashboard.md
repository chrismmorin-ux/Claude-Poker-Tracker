# Token Optimization Dashboard
**Initialized**: 2025-12-10 | **Budget**: 30,000 tokens/session

## System Status

| Component | Status | File |
|-----------|--------|------|
| Budget enforcement | Active | `.claude/hooks/budget-check.cjs` |
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

## Weekly Metrics (Placeholder)

| Week | Avg Tokens/Session | Summary % | Local Tasks | Status |
|------|-------------------|-----------|-------------|--------|
| W1 (baseline) | TBD | TBD | TBD | Tracking |

## Targets (30-Day)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Tokens/session | <25,000 | TBD | Pending |
| Summary usage | 90% | TBD | Pending |
| Local model tasks | 15/session | TBD | Pending |
| Scan-before-drill | 85% | TBD | Pending |

## Quick Commands

```bash
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
```

## Log Files

| Log | Location | Purpose |
|-----|----------|---------|
| Task execution | `.claude/metrics/local-model-tasks.log` | Local model results |
| Efficiency session | `.claude/.efficiency-session.json` | Per-session metrics |
| Budget tracking | `.claude/.session-budget.json` | Token budget state |
| Delegation blocks | `.claude/.delegation-violations.json` | Blocked writes |
