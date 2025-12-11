# Program Manager Status Dashboard

Display real-time session status including token budget, delegation compliance, and enforcement state.

## Instructions

Run the PM dashboard script to get current session state:

```bash
bash scripts/pm-dashboard.sh
```

Then analyze the output and provide recommendations based on:

1. **Token Budget Status**
   - NORMAL (0-80%): Continue working
   - WARNING (80-93%): Suggest delegating or wrapping up
   - CRITICAL (93%+): Recommend immediate wrap-up

2. **Delegation Compliance**
   - 70%+: Good - system working as intended
   - 50-70%: Needs attention - review [CLAUDE] tag usage
   - <50%: Critical - investigate barriers to delegation

3. **Files Modified**
   - <4: No EnterPlanMode required
   - 4+: Verify EnterPlanMode was used

4. **Proactive Recommendations**
   Based on session state, suggest:
   - Delegation opportunities
   - Test generation batching
   - Project file creation
   - Session checkpoints

## Output Format

Present the dashboard output followed by actionable recommendations tailored to current state.

## Related Commands

- `/pm-override` - Bypass enforcement for specific categories
- `/process-audit` - Full workflow analysis (post-session)
- `/efficiency-analysis` - Token efficiency review
