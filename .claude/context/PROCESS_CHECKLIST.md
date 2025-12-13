# Process Compliance Checklist

Quick reference for workflow compliance. Use with `/process-audit` for detailed analysis.

## Before Starting Work

- [ ] Read BACKLOG.md to understand current priorities
- [ ] Check for active projects (`/project status`)
- [ ] Use `/route <task>` if unsure about approach
- [ ] For 3+ file tasks: `/cto-decompose` first
- [ ] Create project file for multi-session work

## During Implementation

### File Modification Approval
- [ ] Route modifications through Task(dispatcher) - dispatcher evaluates
- [ ] Check `.claude/permission-requests.json` for escalation status
- [ ] Wait for human approval before escalated tasks execute
- [ ] Never attempt direct Write/Edit on assigned files (hooks block these)

### Delegation (Target: 70%+ delegated)
- [ ] Simple utilities (<80 lines) → `/local-code` or dispatcher
- [ ] Simple components (<100 lines, <5 props) → `/local-code` or dispatcher
- [ ] Refactoring → `/local-refactor` or dispatcher
- [ ] Documentation → `/local-doc` or dispatcher
- [ ] Tests → `/local-test` or dispatcher
- [ ] Only Claude: reducers, complex hooks, multi-file integration via dispatcher

### Dispatcher Workflow
- [ ] Decompose into atomic tasks (create ///LOCAL_TASKS JSON)
- [ ] Execute via: `node scripts/dispatcher.cjs assign-next`
- [ ] Check status: `node scripts/dispatcher.cjs status`
- [ ] Monitor logs: `.claude/logs/local-model-tasks.log`
- [ ] Escalate failures: `node scripts/dispatcher.cjs create-permission-request <task-id> <reason>`
- [ ] Approve pending: `bash scripts/approve.sh` (human action)

### Context Efficiency
- [ ] Read `.claude/context/*.md` BEFORE full source files
- [ ] Use Explore agent for open-ended searches
- [ ] Parallel reads for independent files
- [ ] Don't re-read files already in context

### Error Prevention
- [ ] Create task in backlog.json before requesting modifications
- [ ] Verify task assignment (local model vs human vs escalated)
- [ ] Check import paths match project conventions
- [ ] Use constants from `src/constants/` (no magic strings)
- [ ] useCallback for handlers, include all deps
- [ ] Run tests after reducer/hook changes

## After Implementation

- [ ] All dispatcher tasks completed or escalated
- [ ] Check `.claude/dispatcher-state.json` for task audit trail
- [ ] Verify permission approvals logged in `.claude/permission-requests.json`
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
| Tasks stuck in backlog | Missing dispatcher workflow | Check task assignments |
| Permission requests expired | Approval bottleneck | Run `bash scripts/approve.sh` |
| Failed local model tasks | Decomposition issue | Review task constraints |
| Direct Write/Edit attempts on assigned files | Hook bypass attempt | Task already has assignment |

## Metrics to Track

| Metric | Target | How to Check |
|--------|--------|--------------|
| Delegation rate | 70%+ | `git log` + project files |
| Fix commit ratio | <10% | `git log --grep="fix:"` |
| Context files read | Summaries first | Session analysis |
| Test pass rate | 100% before commit | `npm test` |
| Dispatcher task completion | 100% | `node scripts/dispatcher.cjs status` |
| Permission request approval time | <1 hour | `.claude/permission-requests.json` |
| Local model task success rate | 95%+ | `.claude/logs/local-model-tasks.log` |

## Dispatcher Commands

```bash
# Task management
node scripts/dispatcher.cjs assign-next              # Execute next task
node scripts/dispatcher.cjs status                   # Check all task status
node scripts/dispatcher.cjs create-permission-request <task-id> <reason>  # Escalate task

# Approval (human use)
bash scripts/approve.sh                              # Interactive approval menu
bash scripts/approve-menu.sh                         # Menu for specific tasks

# Monitoring
cat .claude/dispatcher-state.json | jq .             # View decision audit trail
tail -f .claude/logs/local-model-tasks.log           # Monitor execution live
```

## Quick Commands

```bash
/process-audit quick    # Fast compliance check
/process-audit full     # Comprehensive audit
/process-fix last       # Analyze last error
/process-slim analyze   # Check context sizes
/process-review session # Review this session
```
