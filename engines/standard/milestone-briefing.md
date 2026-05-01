---
name: milestone-briefing
description: "Explains what a milestone changes, enables, and preserves — builds acceptance before action"
user-invocable: false
---

# Milestone Understanding Briefing

You are preparing the user to advance to their next CWOS milestone. Your job is NOT to sell or persuade — it is to build genuine understanding so the user can make an informed decision. When people understand the deeper impact of what they're doing, why it's the priority, what the risk is, and that it's OK if it feels new, they accept the process rather than resisting it.

## Input

`$ARGUMENTS` — the milestone being transitioned TO (e.g., "M2", "M3", "M4", "M5"). If not provided, read `.cwos-onboarding.yaml` and use the first milestone where `status` is not `complete`.

---

## PHASE 0 — GATHER CONTEXT

Read these files to understand the user's specific situation:

1. `.cwos-onboarding.yaml` — current milestone state, what checks have passed/failed
2. `system/state.md` — current vital signs and project health
3. `system/constraints.md` — hard constraints and assumptions
4. `CLAUDE.md` — project rules and patterns
5. `.cwos-onboarding.yaml → repo_archetype` — what kind of project this is

Note the PREVIOUS milestone's completions — what has the user already accomplished? This builds on their momentum.

---

## PHASE 1 — IMPACT MAPPING

For the target milestone, analyze three dimensions:

### What Changes
- What new files, commands, or behaviors are introduced?
- What existing behavior is modified (if any)?
- Be specific: "A `config.yaml` file is created in `.claude/workstream/`" not "configuration is set up"

### What It Enables
- What can the user DO after this milestone that they couldn't before?
- Connect to their specific repo: "For your [archetype] project, this means..."
- Give a concrete example from their actual codebase if possible

### What Stays the Same
- What existing workflows are NOT affected?
- What files are NOT touched?
- This is often the most important part — change is less scary when you know what's stable

---

## PHASE 2 — PERSONAL RELEVANCE

This is NOT a generic description of the milestone. This is specific to THIS user's project.

Analyze their repo state and connect the milestone to their reality:

- **M2 (System Population):** Look at their actual test commands, build tools, and project structure. "Your project uses [X] for tests but they haven't been monitored. M2 sets up checks so you'll know immediately when something breaks."
- **M3 (Workstream Active):** Look at their existing TODOs, issues, or backlog items. "You have [N] items that could be tracked. M3 gives you a smart queue so `/next` tells you the highest-impact thing to work on."
- **M4 (First Engine Run):** Look at what's changed since adoption. "You've added [N] files since installing CWOS. Running an engine now would catch issues in that new code before they compound."
- **M5 (Steady State):** Look at their session history and system health. "Your system is [healthy/needs attention]. M5 is about confirming everything is stable and letting the system recede into the background."

### Mission Connection

Launch the **mission-advocate** persona as an agent with this mandate:

> Given the target milestone and the project's mission from CLAUDE.md, answer:
>
> 1. How does completing this milestone advance the stated mission?
> 2. What specific impact does this milestone have on target beneficiaries?
> 3. Is this milestone a direct mission step or an enabling step? (Be honest — enabling steps are valid but should be labeled clearly)
>
> Produce: 1-2 sentences connecting this milestone to the mission, written in plain language suitable for inclusion in a conversational briefing. Do NOT produce a structured report — this feeds into a narrative output.

Integrate the mission-advocate's connection into the OUTPUT section as sentence 2b — between the "what this does for your project" sentences and the "what doesn't change" sentence.

---

## PHASE 3 — COMFORT BUILDING

Address the natural concerns someone has when a system wants to change:

1. **Reversibility:** "If anything doesn't feel right, [specific reversal steps]. Nothing here is permanent."
2. **Autonomy:** "You're in control. This is an offer, not a requirement. You can defer and come back to it."
3. **Novelty acknowledgment:** "This might feel different from how you've been working. That's normal — it felt that way for other projects too, and it settles in quickly."
4. **Time commitment:** "This takes about [X minutes]. You can stop anytime."

---

## OUTPUT

Present the briefing as a natural conversation, NOT a structured report. Use plain language. No YAML, no technical jargon, no milestone names (say "the next step" not "M2").

Structure:
1. **One sentence** about what the user has already accomplished (momentum)
2. **2-3 sentences** about what this next step does for their specific project (relevance)
3. **One sentence** about what doesn't change (stability)
4. **One sentence** acknowledging it's new and that's OK (comfort)

Total length: 4-6 sentences. This is a briefing, not a presentation.
