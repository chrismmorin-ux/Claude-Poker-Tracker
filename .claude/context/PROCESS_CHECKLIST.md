# Process Compliance Checklist

Quick reference for workflow compliance. Use with `/process-audit` for detailed analysis.

## Before Starting Work

- [ ] Read BACKLOG.md to understand current priorities
- [ ] Check for active projects (`/project status`)
- [ ] Use `/route <task>` if unsure about approach
- [ ] For 3+ file tasks: `/cto-decompose` first
- [ ] Create project file for multi-session work

## During Implementation

### Delegation (Target: 70%+ delegated)
- [ ] Simple utilities (<80 lines) → `/local-code`
- [ ] Simple components (<100 lines, <5 props) → `/local-code`
- [ ] Refactoring → `/local-refactor`
- [ ] Documentation → `/local-doc`
- [ ] Tests → `/local-test`
- [ ] Only Claude: reducers, complex hooks, multi-file integration

### Context Efficiency
- [ ] Read `.claude/context/*.md` BEFORE full source files
- [ ] Use Explore agent for open-ended searches
- [ ] Parallel reads for independent files
- [ ] Don't re-read files already in context

### Error Prevention
- [ ] Read files before editing (never edit unread files)
- [ ] Check import paths match project conventions
- [ ] Use constants from `src/constants/` (no magic strings)
- [ ] useCallback for handlers, include all deps
- [ ] Run tests after reducer/hook changes

## After Implementation

- [ ] `/review staged` after 3+ file changes
- [ ] Run `npm test` before committing
- [ ] Update docs if structure changed
- [ ] Update BACKLOG.md with completed items
- [ ] Mark project phases complete

## Error Indicators

Watch for these patterns (run `/process-fix` if seen):

| Pattern | Indicates | Action |
|---------|-----------|--------|
| Multiple "fix:" commits in a row | Recurring error | Analyze and prevent |
| Same import paths fixed repeatedly | Missing context | Add to templates |
| Test failures after changes | Missing validation | Add pre-commit check |
| Reading 10+ files before acting | Context inefficiency | Use summaries |
| Claude doing local-model tasks | Delegation failure | Strengthen hooks |

## Metrics to Track

| Metric | Target | How to Check |
|--------|--------|--------------|
| Delegation rate | 70%+ | `git log` + project files |
| Fix commit ratio | <10% | `git log --grep="fix:"` |
| Context files read | Summaries first | Session analysis |
| Test pass rate | 100% before commit | `npm test` |

## Quick Commands

```bash
/process-audit quick    # Fast compliance check
/process-audit full     # Comprehensive audit
/process-fix last       # Analyze last error
/process-slim analyze   # Check context sizes
/process-review session # Review this session
```
