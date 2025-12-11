# Session Continuity Advice Command

Analyzes current session state and recommends whether to continue or start a new session.

## Usage

```bash
/session-advice
```

## What It Does

Runs the Session Advisor to analyze:
1. **Token Budget Status** - How many tokens used/remaining
2. **Context Window Estimate** - Rough estimate of context accumulation
3. **Session Duration** - How long the session has been running
4. **Phase Completion** - Whether natural breakpoints exist

Then provides clear recommendation:
- **CONTINUE** - Budget available, work in progress
- **START NEW SESSION** - Natural breakpoint, budget tight, or context heavy

## Output

```
╔═══════════════════════════════════════════════════════════╗
║           SESSION CONTINUITY ADVICE                       ║
╚═══════════════════════════════════════════════════════════╝

📊 Current Session Status:
   Token Budget: 18,500 / 30,000 used (62%)
   Context Estimate: ~55% full
   Session Duration: 85 minutes
   Files Modified: 12

🎯 RECOMMENDATION: **START NEW SESSION**

Reasons:
- Token budget at 62% (consider fresh start)
- Session approaching 90 minutes
- Recent project completion (natural breakpoint)
- Continuation prompt available

📋 To resume work in NEW session:
[Continuation prompt would be shown here]

Benefits:
- Fresh context: ~2,500 tokens to load
- vs accumulated: ~18,500 tokens current
- Savings: ~16,000 tokens
```

## When to Use

Use this command:
- **After completing a project or phase** - Check if you should continue or start fresh
- **Mid-session check** - Wondering if budget is getting tight
- **Before starting major new work** - Decide if fresh session is better
- **After long debugging sessions** - Check for context fatigue

## Decision Criteria

### Recommends CONTINUE if:
✅ Token budget >10,000 remaining
✅ Context window <60% full
✅ Session <90 minutes
✅ Work in progress on current task

### Recommends NEW SESSION if:
🔄 Token budget <5,000 remaining
🔄 Context window >70% full
🔄 Session >120 minutes (fatigue risk)
🔄 Project/phase just completed
🔄 Major context shift needed

## Benefits

1. **Optimize Token Usage** - Start fresh when context is bloated
2. **Prevent Fatigue Errors** - Long sessions increase mistake likelihood
3. **Natural Breakpoints** - Resume cleanly after completion
4. **Clear Guidance** - No guessing, data-driven recommendation

## Implementation

Runs `scripts/session-continuity-advisor.sh` which:
1. Reads `.claude/.pm-state.json` for session metrics
2. Calculates budget, context, duration estimates
3. Applies decision rules
4. Outputs formatted recommendation

## Related Commands

- `/project complete` - Automatically triggers session advice
- `/project phase-complete` - Checks if new session needed for next phase
