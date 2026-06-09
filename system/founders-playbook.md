# Founder's Playbook

How to get the most out of CWOS as a solo non-technical founder.

## The One Rule

**Just describe what you want in plain English.** You never need to learn commands, read YAML, or understand code. Claude handles the technical side — you provide the direction.

## Daily (5 minutes)

Open your project. Do one of these:
- **Describe what you want:** "Fix the login page" or "Make the homepage faster"
- **Ask what's next:** Run `/next` to get the highest-priority item
- **Check status:** Run `/status` to see if anything needs attention

That's it. Claude tracks what was done, verifies it works, and writes handoff notes for next time.

## Weekly (30 minutes)

Pick your most important project. Run `/session-start` for a full strategic session:
1. Claude reviews everything — code health, programs, queue, recent activity
2. Run `/plan` to get a strategic recommendation for the next work bundle
3. Update context if anything changed: "We have a demo next week" or "A customer reported X"
4. Work through the recommended items
5. Run `/session-end` to close cleanly

## Monthly (1 hour)

Review the big picture:
- Run `/audit` on your top 2-3 projects to catch drift and staleness
- Run `/pulse` to see program health across your projects
- Consider: are any projects ready for the next capability? (e.g., enabling `engines` once `workstream` is solid, or `governance` once engines run regularly)
- Update `system/constraints.md` if business assumptions changed

## When Something Breaks

Just describe it:
- "The checkout page is broken"
- "Users can't log in"
- "The site is slow"

Claude will:
1. Diagnose the issue
2. Fix it
3. Verify the fix works
4. Record the failure pattern so it doesn't happen again
5. Update the queue and state

## What NOT to Worry About

- **YAML files** — Claude manages these. You never need to edit them.
- **Program health scores** — Claude monitors and creates work items when things go stale.
- **Engine configuration** — Pre-configured for your project type.
- **Counter IDs** — Managed automatically.
- **Session handoffs** — Claude writes these for you.

## When to Use Which Command

| You want to... | Say or run... |
|----------------|---------------|
| Fix a specific bug | Just describe it |
| See project health | `/status` |
| Get the next task | `/next` |
| Do a deep work session | `/session-start` |
| Plan what to build next | `/plan` |
| Check program health | `/pulse` |
| Find hidden problems | `/audit` |
| Run a specific analysis | `/engine <name>` |
| Record a big decision | `/decide` |
| End a session cleanly | `/session-end` |
