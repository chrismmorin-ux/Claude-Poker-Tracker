---
name: welcome
description: "First-session guided walkthrough after CWOS adoption — shows what's set up and what to do first"
user-invocable: true
---

# /welcome — First Session Guided Walkthrough

> **Auto-trigger:** This command runs automatically when `.cwos-version` exists but `usage.yaml` shows `welcome_completed` is false or missing. After running once, it sets `welcome_completed: true` so it never auto-triggers again.

## Steps

### 0b. Read Adoption Arc State

Read `.cwos-onboarding.yaml` (or `system/onboarding-state.yaml`). Extract:
- `current_milestone` (M1–M5) and ordered `milestones` list
- `repo_goal` and `done_looks_like` for the current milestone
- Unmet checks for current and upcoming milestones
- `repo_name` / archetype (if present) for prose substitution

If `repo_goal` matches the template placeholder default, flag it — Step 0c must emit the soft-fail line instead of citing the placeholder as real.

If neither state file exists: skip the envelope (Step 0c), emit the fallback line, and proceed with the tour.

### 0c. Emit Adoption Arc Envelope (leading block)

Per `docs/bow-contract.md` rendering primitives (§1–§5), emit a plain-English envelope **before** the welcome message. The envelope describes where the founder is in setup (steps 1–5) using natural language, never schema tokens.

Render exactly this shape, substituting real values inline (no leftover brackets in the output):

```
## Where you are: Step 1 of 5 — system files installed, calibration next
**This run:** /adopt just installed Level 2 with 5 engines and 3 personas. /welcome reads that state and walks you through it.
**To finish step 1:** capture vital signs · pin 3 invariants · note 2 active constraints
**What's next:** Step 2 captures vital signs and invariants. Step 3 scopes programs. Step 4 runs your first engine. Step 5 is steady state.
**Why it matters here:** Your goal is to ship a self-serve onboarding flow that converts ≥30% of trial signups. CWOS prioritizes work against that goal every time you run /next.
```

Substitution rules (do these BEFORE rendering — no angle-bracket placeholders may appear in the founder-visible output):
- "Step N of 5" — N comes from `.cwos-onboarding.yaml` `current_milestone` (1–5).
- "Level X with Y engines and Z personas" — read `.cwos-version` and the engine/persona registries.
- "To finish step N:" — list at most 3 unmet milestone checks in plain language; if all complete, replace this whole line with "Step N is complete — moving to step N+1 next session."
- "What's next:" — describe steps N+1 through 5, one clause each.
- "Why it matters here:" — one sentence citing `repo_goal` from the onboarding file. If `repo_goal` is the placeholder fallback, replace this whole line with: *(No captured repo goal yet — when you next run /adopt, step 3c captures one. Until then, I'll prioritize against vital-sign health and open findings instead of goal alignment.)*
- If `.cwos-onboarding.yaml` is missing entirely, replace the whole envelope with a single line: *Setup hasn't been initialized yet. Run /adopt to get started.*

### 1. Welcome Message

Output:
```
Welcome to <repo_name or "your project">'s operating system. This is your first session since CWOS was set up.
Let me walk you through what's here and what to do first.
```

Substitute `<repo_name>` from the onboarding state if available. Fall back to "your project" only if unset.

### 2. Show What Was Installed

Read `.cwos-version`. Render the "What's Set Up" block, substituting real values before display so no angle-bracket placeholders appear in the founder output. Use this shape:

```
## What's Set Up

**Adoption Level:** L2
**Engines installed:** 5 (health-check, engine, product-ideation, optimization-feedback, meta-engine)
**Personas available:** 3

### Commands You Can Use
- `/status` — See how your project is doing at a glance
- `/next` — Get the most important thing to work on
- `/pulse` — Check the health of your project's key areas
- `/plan` — Get a strategic recommendation for what to build next
```

### 3. Run Quick Health Check

Read the vital signs table from `system/state.md`. For each entry that has a `Check Command`:

**Placeholder guard:** If the Check Command contains angle-bracket placeholders (e.g., `<your build command>`, `<run tests>`), do NOT execute it. Instead, count it as "not yet configured."

For commands that are real (no placeholders): run them silently.

Report in plain language:
- If unconfigured vital signs exist: "**N vital sign(s) aren't configured yet** — these are placeholder commands that need real values. Run `/status` after setting them up in `system/state.md`."
- If all configured checks pass: "Your project is healthy — tests pass, code is clean, and the build succeeds."
- If some configured checks fail: "A few things need attention: [plain-language description of what's failing and what it means for users]."

### 4. Show Queue Preview

Read `queue-index.yaml`:
- If items exist: "I found **N work items** in your queue. Here are the top 3 by priority:"
  - Show each with plain-language title, business impact, and effort estimate
  - When describing business impact, cite `repo_goal` where the item relates to it (e.g., "Directly supports your goal of ≥30% trial conversion"). Do not fabricate a connection — cite only when the item's description or files_involved actually ties to the goal.
- If queue is empty: "Your queue is empty. Run `/audit` to discover what needs attention, or just describe what you want to work on."

### 5. Run Bootstrap Engine (conditional)

Check if `.claude/commands/health-check.md` exists:
- If YES: Run the `health-check` engine. Report in plain language: "I ran a quick health check and found: [summary]"
- If NO: Skip. Say: "We'll set up analysis engines in a later session as I learn more about your project."

This step is conditional because not every enabled capability unlocks all engines, and the engine command file must actually exist (no phantom engines).

### 5.5 Preview What's Coming (conditional)

Check `.cwos-onboarding.yaml`:
- If M3 milestones are NOT complete (programs not yet established):

Output:
```
## What's Ahead

As I learn more about your project over the next few sessions, I'll set up 
**programs** — areas of your project that get permanent, automated monitoring. 
Think of them like having specialists who watch security, code quality, and 
whatever matters most for YOUR specific project — and tell you when something 
needs attention. No setup needed from you.

You'll see them when they're ready. Run `/pulse` anytime to check their status.

And once your queue is full of small fixes and findings, you'll be able to use 
`/autopilot` to schedule hours of autonomous work — Claude picks items, executes 
them, verifies the results, and repeats. You approve once, then walk away.
```

- If M3 IS complete (programs exist): skip this step entirely.

### 6. Explain the Daily Flow

Output:
```
## How to Work With This System

**Most of the time, just describe what you want.** Say "fix the login page" or
"add a dark mode toggle" and Claude handles the rest — tracking, verification,
and handoff notes for next time.

**Daily (5 min):** Open <repo_name or "your project"> and describe what you want,
or run `/next` to pick up the most important thing.

**Weekly (30 min):** Run `/session-start` for a full strategic session.
Review what's been done, plan what's next.

**When something breaks:** Just describe it. "The checkout page is broken"
or "users can't log in." Claude will fix it and record the failure pattern
so it doesn't happen again.
```

### 6b. Close With a Numbered Next-Action Ladder

Per BoW envelope §5, end the response with concrete options, not generic advice:

```
## Right now you can
1. Run `/status` — see the full health dashboard, with the arc state you saw above.
2. Run `/next` — compose your first sprint. Items will be prioritized against your goal of shipping a self-serve onboarding flow that converts ≥30% of trial signups.
3. Describe what you want to work on in plain language — Claude will pick it up from here.
```

For line 2 of the block: if `repo_goal` is set, render "Items will be prioritized against your goal of [the captured goal]." Otherwise render "Items will be prioritized by operational health until you capture a repo goal."

If a vital sign is RED or a critical finding exists, promote that to option 1 and demote the others.

### 7. Set Welcome Flag

Update `.claude/workstream/usage.yaml`:
- Set `welcome_completed: true`
- Set `welcome_completed_at: <current timestamp>`


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T1:capture --tag /welcome --payload '{"command":"/welcome"}'`

Non-fatal. Do not gate any output on the exit status.
