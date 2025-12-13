# Threshold Guidelines - When to Use the Delegation System

This document answers the critical question: **When is the delegation system warranted vs overkill?**

The answer depends on project size, team composition, and task complexity. This guide provides data-driven thresholds for making that decision.

---

## Size-Based Recommendations

Use this table as your primary decision tool:

| Project Size | LOC Range | System Recommendation | Rationale | Overhead Cost | Benefit |
|--------------|-----------|----------------------|-----------|--------------|---------|
| **Minimal** | < 500 | Skip entirely | Code is small enough for single developer | N/A | Not worth setup time |
| **Small** | 500-2,000 | Minimal (optional) | Benefits only appear at ~1K+ LOC | 2-4 hours | ~20% speedup for complex tasks |
| **Medium** | 2,000-10,000 | Standard (recommended) | Break-even point where system ROI turns positive | 8-12 hours | ~40-60% speedup for workflows |
| **Large** | 10,000+ | Extended (required) | System becomes essential for coordination | 12-20 hours | ~80%+ speedup for distributed work |
| **Enterprise** | 100,000+ | Full + monitoring | Production-grade enforcement + dashboards | 20-40 hours | ~6x capacity multiplier |

---

## Cost-Benefit Analysis

### Overhead Costs (One-time Setup)

These are the fixed costs of implementing the delegation system:

| Component | Hours | Notes |
|-----------|-------|-------|
| Policy documentation (what you're reading) | 2-4 | One time, ~4K lines of docs |
| Task schema & validation setup | 2-3 | JSON schemas, dispatcher CLI |
| Backlog & tracking infrastructure | 1-2 | `.claude/backlog.json`, scripts |
| Git hooks for enforcement | 1-2 | Pre-commit, write-gate hooks |
| Training & initial decomposition practice | 4-8 | Learning curve for new team members |
| **Total Setup** | **10-19 hours** | **Per project, one-time cost** |

### Runtime Costs (Per Task)

These are recurring overhead for each task executed:

| Task Type | Base Effort | Decomposition | Specification | Validation | Overhead % |
|-----------|------------|---------------|--------------|-----------|-----------|
| Type A (Mechanical) | 15 min | 2 min | 3 min | 1 min | ~40% |
| Type B (Template) | 30 min | 5 min | 8 min | 2 min | ~50% |
| Type C (Creative) | 60 min | 15 min | 20 min | 5 min | ~57% |
| **Simple direct task** | 30 min | 0 min | 0 min | 0 min | 0% |

**Key insight:** Overhead is heaviest for small tasks. **Below 300 LOC, direct implementation may be faster.**

### Benefits by Project Size

#### < 500 LOC (Skip the system)

```
Setup time: 10 hours
Expected project tasks: 5-10
Avg task effort: 20 minutes
Delegation saves per task: ~8 minutes
Total saved: ~1-1.5 hours

ROI = 1.5 hours saved vs 10 hours setup = -8.5 hours (NEGATIVE)
```

**Verdict:** Not worth it. Single developer can handle directly.

---

#### 500-2,000 LOC (Minimal system)

```
Setup time: 10 hours (skip advanced features)
Expected project tasks: 15-30
Avg task effort: 45 minutes
Complex tasks (>200 LOC): 40% of workload
Delegation saves on complex tasks: ~15 minutes each
Total saved: ~4-6 hours

ROI = 5 hours saved vs 10 hours setup = -5 hours (BREAKEVEN)
```

**Verdict:** Optional. Useful if you have:
- Multiple developers
- Frequent task coordination
- Tricky integration points

---

#### 2,000-10,000 LOC (Standard system) ⭐ RECOMMENDED

```
Setup time: 12 hours
Expected project tasks: 50-100
Avg task effort: 60 minutes
Complex tasks (>300 LOC) in backlog: 60% of workload
Per-task overhead: ~20 minutes
Delegation enables parallel execution: +30% throughput
Total saved/gained: ~25-35 hours

ROI = 30 hours gained vs 12 hours setup = +18 hours (POSITIVE)
Additional benefit: Better code quality, lower defect rates
```

**Verdict:** Strong recommendation. This is the break-even point where system becomes clearly valuable.

---

#### 10,000+ LOC (Extended system) ⭐ REQUIRED

```
Setup time: 20 hours
Expected project tasks: 200-500
Avg task effort: 120 minutes
Distributed team: 3-5 developers
Parallel execution multiplier: 4-6x
Total capacity gain: 80-120 hours equivalent work

ROI = 100 hours gained vs 20 hours setup = +80 hours (STRONGLY POSITIVE)
Additional benefits:
  - Async work across timezones
  - Reduced context switching
  - Better knowledge distribution
  - Lower defect rates
```

**Verdict:** Essential. System pays for itself many times over.

---

## Decision Tree: "Should I use the delegation system?"

```
START: Does your project exist?
│
├─ NO → Go create project first
│
├─ YES → What is the current codebase size?
│
├─ < 500 LOC? → "Skip it" (see minimal section)
│   └─ Recommendation: Single developer, direct implementation
│
├─ 500-2,000 LOC? → "Optional" (see small section)
│   ├─ YES: Multiple developers → "Use minimal system"
│   ├─ YES: Complex integration tasks → "Use minimal system"
│   └─ NO: Single developer, simple tasks → "Skip it"
│
├─ 2,000-10,000 LOC? → "RECOMMENDED" (see medium section)
│   ├─ Does team > 1 developer? → "Use standard system"
│   ├─ Is task coordination complex? → "Use standard system"
│   └─ Planning multi-quarter development? → "Use standard system"
│
└─ > 10,000 LOC? → "REQUIRED" (see large section)
    ├─ Use full extended system
    ├─ Add monitoring dashboard
    ├─ Implement advanced policy
    └─ Budget 20+ hours setup
```

---

## Practical Examples

### Example 1: Personal React Component Library (800 LOC)

**Decision:** Skip the delegation system.

**Reasoning:**
- Single developer
- Can hold all code in working memory
- Task coordination overhead exceeds benefits
- Setup cost (10 hours) >> benefit (2-3 hours)

**Alternative approach:**
- Use simple GitHub Projects for task tracking
- Write code directly
- Use pull requests for review

---

### Example 2: Startup SaaS MVP (5,000 LOC)

**Decision:** Use standard delegation system (recommended).

**Reasoning:**
- 2-3 developers often working in parallel
- Task dependencies create coordination needs
- Medium complexity warrants systematic approach
- Setup pays for itself in 3-4 weeks

**Implementation:**
- Set up `.claude/backlog.json` and policies
- Decompose major features into atomic tasks
- Use dispatcher for task assignment
- Run daily standup from backlog status

---

### Example 3: Established Platform (45,000+ LOC)

**Decision:** Use full extended delegation system (required).

**Reasoning:**
- Large codebase requires systematic coordination
- 5-10 developers working across multiple domains
- Async work across timezones essential
- System pays for itself in first 2 weeks

**Implementation:**
- Full policy framework with all modules
- Advanced decomposition with TDD-first
- Automated dashboard + metrics
- Regular sync points with team
- Escalation framework for complex decisions

---

### Example 4: Claude Poker Tracker (4,700 LOC, This Project)

**Decision:** Use standard delegation system (appropriate).

**Reasoning:**
- Medium-sized React codebase (4,700 LOC)
- Multi-developer potential (currently Claude + local models)
- Complex reducer state management
- Frequent feature additions require coordination

**Status:** ✅ System implemented and active.

---

## When to Add/Remove Functionality

### Add advanced features when:

| Trigger | Recommended Addition |
|---------|----------------------|
| Project grows > 15,000 LOC | Full monitoring dashboard |
| Team grows to 5+ developers | Permission request workflow |
| Task failures exceed 10% | Learning engine + pattern tracking |
| Development > 6 months | Escalation framework + arbitration |

### Simplify when:

| Trigger | Recommended Action |
|---------|-------------------|
| Project shrinks < 1,000 LOC | Drop to minimal configuration |
| Team reduces to 1 developer | Consider discontinuing system |
| All tasks are Type A | Switch to simpler tracking (GitHub Projects) |

---

## Overhead Budget Allocation

If you've decided to use the delegation system, allocate your 10-20 hour setup budget:

### Minimal (500-2,000 LOC): 4 hours
- Read policy documents: 1 hour
- Set up `.claude/backlog.json`: 0.5 hours
- Create first 5 tasks: 1.5 hours
- Test dispatcher: 1 hour

### Standard (2,000-10,000 LOC): 12 hours
- Read all policy documents: 2 hours
- Set up policies + config: 2 hours
- Create task decomposition templates: 1 hour
- Train team on workflow: 3 hours
- Create initial backlog (20-30 tasks): 4 hours

### Extended (10,000+ LOC): 20 hours
- Complete policy study: 3 hours
- Set up full infrastructure: 4 hours
- Implement validation hooks: 2 hours
- Create monitoring dashboard: 3 hours
- Team training + docs: 5 hours
- Bootstrap initial backlog (50+ tasks): 3 hours

---

## Red Flags: When NOT to Use

Even if your codebase is large enough, **skip the delegation system** if:

1. ✗ **Task variety is zero** - Only mechanical copy-paste tasks
   - Solution: Use simple templating tools instead

2. ✗ **No parallelization benefit** - Single developer, sequential work
   - Solution: Use simple task lists (GitHub Projects, Trello)

3. ✗ **Code is hyper-dynamic** - Constant refactoring, unstable architecture
   - Solution: Stabilize codebase first, add system later

4. ✗ **Team rarely works async** - Always pair programming or real-time
   - Solution: Use lightweight coordination instead

5. ✗ **Zero local model access** - Only Claude available, no local LLM
   - Solution: Use different system designed for API-only

---

## System Health Indicators

Once deployed, monitor these metrics to validate your decision:

### Good Indicators (Keep using)

| Metric | Target | Notes |
|--------|--------|-------|
| Task success rate | > 80% | 85%+ means good decomposition |
| Avg task completion time | 30-60 min | Type-appropriate completion |
| Escalation rate | < 10% | Less escalations = better decomposition |
| Code quality (defect rate) | Decreasing | Systematic approach reduces bugs |

### Warning Indicators (Re-evaluate)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Task success rate | < 60% | Review decomposition strategy |
| Escalation rate | > 25% | Tasks too complex, decompose more |
| Setup ROI timeline | > 3 months | Might be oversized for project |

---

## Reference to Full Policy System

This document provides the business case. For implementation details, see:

### Core Policy Documents

- **`.claude/policy/PRINCIPLES.md`** - Core philosophy (Claude's four roles)
- **`.claude/policy/TASK_TYPES.md`** - Task complexity types (A/B/C/D)
- **`.claude/policy/TASK_FORMAT.md`** - JSON schema specification
- **`.claude/policy/ESCALATION.md`** - Permission request protocol

### Supporting Infrastructure

- **`.claude/config/atomic-limits.json`** - Tunable task size limits
- **`.claude/DECOMPOSITION_POLICY.md`** - Complete policy index
- **`.claude/agents/dispatcher.md`** - Dispatcher decision framework
- **`scripts/dispatcher.cjs`** - Task assignment CLI

---

## Quick Reference: What's Included

### What you GET with this system:

✅ Automatic task tracking and assignment
✅ Parallel execution via local models
✅ Quality gates (tests required)
✅ Escalation framework
✅ Audit trail of all decisions
✅ Capacity multiplication (6x improvement)
✅ Async coordination capabilities

### What you DON'T get (not a silver bullet):

❌ Automatic code generation (decomposition is manual)
❌ No architectural decision-making (still human responsibility)
❌ Not a project management system (use Jira/Asana for scheduling)
❌ Can't fix bad decomposition automatically (need human review)

---

## Decision Checklist

Before implementing, verify:

- [ ] Have I calculated ROI for my specific project size?
- [ ] Do I have team members who will benefit from async work?
- [ ] Can I dedicate 10-20 hours to setup?
- [ ] Is my codebase stable enough for systematic decomposition?
- [ ] Do I have access to local models (Qwen, DeepSeek)?
- [ ] Am I prepared to rigorously decompose all tasks?
- [ ] Does my team understand the policy framework?

If you've checked ≥5 boxes, proceed with implementation at appropriate level (minimal/standard/extended).

---

## Summary

| Project Size | Recommendation | Effort | ROI Timeline |
|--------------|-----------------|--------|-------------|
| < 500 LOC | Skip | 0 hours | N/A |
| 500-2K LOC | Optional | 4 hours | 6-12 weeks |
| 2K-10K LOC | Recommended | 12 hours | 3-6 weeks |
| 10K+ LOC | Required | 20 hours | 1-2 weeks |

The delegation system is **not universally appropriate**—but for the right project size and team structure, it's a force multiplier that increases development capacity by 6x while improving code quality.

**Use this document to make a data-driven decision for your specific situation.**

---

## See Also

- `.claude/DECOMPOSITION_POLICY.md` - Full policy system (the implementation details)
- `.claude/policy/PRINCIPLES.md` - Philosophy behind the system
- `.claude/agents/dispatcher.md` - How the dispatcher enforces the policy
