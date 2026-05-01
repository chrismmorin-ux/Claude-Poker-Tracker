---
name: engine-briefing
description: "Explains why a specific engine matters for this repo at this moment — relevance, not generic description"
user-invocable: false
---

# Engine Understanding Briefing

You are explaining to the user why a specific engine matters for their project RIGHT NOW. Not a generic description of what the engine does — a personalized explanation of why running it at this moment creates value.

## Input

`$ARGUMENTS` — the engine name about to be run (e.g., "eng-engine", "refactor-prep").

---

## PHASE 0 — GATHER CONTEXT

Read these to understand the current state:

1. `.claude/workstream/engines/registry.yaml` — get the engine's description, category, and outputs
2. The engine's skill file (from `skill_path` in registry) — first 30 lines to understand its purpose
3. `system/state.md` — current vital signs and project health
4. `.claude/workstream/runs/` — scan for prior runs of this engine. Note: when was it last run? What did it find?
5. `git log --oneline -20` — recent changes since the last run of this engine
6. `git diff --stat` against the last run date (if available) — what's changed in the codebase

---

## PHASE 1 — RELEVANCE ANALYSIS

Answer these questions (internally — don't present them as a list):

### Why Now?
- Has the codebase changed since the last run in ways this engine would catch?
- Are there open findings in this engine's domain that might have been addressed?
- Has enough time passed that drift could have occurred?
- Is the user about to do something (refactor, deploy, upgrade) where this engine's insights would help?

### What Will It Find?
- Based on the repo's current state, what's the most likely output?
- Are there known areas of concern this engine would examine?
- What's the expected signal-to-noise ratio? (First runs tend to find more.)

### What Will the User Need to Decide?
- Will this engine produce findings that need triage?
- Will it suggest work items the user needs to prioritize?
- Will it produce a readiness report the user should review before proceeding?

### Data Relevance Check

Launch the **data-strategist** persona as an agent with this mandate:

> Given the engine about to be run and the current repo state, evaluate:
>
> 1. Does this engine examine data flows, storage, or integrity? If so, what data-specific issues might it find based on the current codebase?
> 2. Are there data quality concerns (staleness, inconsistency, missing validation) that would make this engine run more valuable right now?
> 3. If this engine does NOT directly examine data, are there data-adjacent concerns it might surface indirectly?
>
> Produce: 0-1 sentences about data relevance. If the engine has no data dimension, produce nothing (do not force a data angle where none exists). This feeds into a 2-4 sentence briefing, so brevity is essential.

If the data-strategist produces relevant output, weave it into the OUTPUT section as additional context. If the engine has no data dimension, omit entirely — do not pad the briefing.

---

## OUTPUT

Present as 2-4 sentences of natural conversation. Connect the engine to their reality:

**Pattern:** "[What's changed in your project] + [what this engine will examine] + [what you'll get out of it]"

**Examples of good briefings:**
- "You've added 3 new API endpoints since the last engineering review. This will examine those for security boundaries, error handling, and architectural fit. Expect findings you can act on or dismiss — takes about 5 minutes."
- "This is your first time running the financial audit. It'll check your payment flows for precision issues, reconciliation gaps, and edge cases in how money moves through your system. It may find things that have been silently wrong."
- "The refactor prep engine maps everything connected to the code you're about to change. You'll get a dependency graph, test coverage gaps, and a safe order to make changes — no code is touched."

**Never say:** "This engine runs a 6-phase analysis..." or "The eng-engine uses 6 personas to..." — that's implementation detail, not value.
