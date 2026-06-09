---
id: five-whys
dimension: reasoning
label: "Five whys"
description: "Drill from symptom to root cause by iterating 'why' at each layer."
---

# Reasoning Style: Five Whys

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Five Whys**
>
> For each concern you identify, apply the Five Whys method:
>
> 1. **Symptom:** State what you observed (the surface-level problem)
> 2. **Why-1:** Why does this symptom exist? → [answer]
> 3. **Why-2:** Why does that answer exist? → [answer]
> 4. **Why-3:** Why does THAT exist? → [answer]
> 5. **Why-4:** Why? → [answer]
> 6. **Root cause:** The deepest structural reason you can identify
>
> Rules:
> - Each "why" must be grounded in codebase evidence (file, line, pattern), not speculation
> - If you hit a dead end before level 5, say so — not every issue has 5 layers
> - Stop at the level where the fix would resolve the symptom AND prevent recurrence
> - Frame your finding around the ROOT CAUSE, not the symptom
>
> Present your output with a **Root Cause Chain** for each major finding:
> ```
> Symptom: [what you see]
>   → Why: [level 1 — evidence: file:line]
>     → Why: [level 2 — evidence: file:line]
>       → Why: [level 3 — evidence: file:line]
>         → ROOT CAUSE: [the structural issue]
> ```

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Root Cause Clustering**
>
> After reviewing all agent outputs:
> 1. **Cluster findings** that share the same root cause (even if the surface symptoms differ)
> 2. **Rank root causes** by how many symptoms they explain — a root cause that resolves 4 symptoms is more valuable than one that resolves 1
> 3. For the top 3 root causes, propose a **single structural fix** that resolves multiple symptoms
> 4. Distinguish between root causes you can fix (code/architecture) vs. constraints you must work around (external dependencies, platform limits)
> 5. If multiple agents traced to the same root cause independently, boost its confidence
