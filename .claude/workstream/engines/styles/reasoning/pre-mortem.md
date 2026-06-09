---
id: pre-mortem
dimension: reasoning
label: "Pre-mortem"
description: "Assume the project has failed — work backward to identify what caused the failure."
---

# Reasoning Style: Pre-Mortem

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Pre-Mortem**
>
> Shift your perspective: it is 6 months from now. This project has suffered a serious failure
> in your domain of expertise (the kind that makes the founder lose sleep). Your job is to
> write a **failure narrative** — a plausible story of how it happened.
>
> Structure your analysis as:
> 1. **The failure event:** What went wrong? Be specific — name the module, the scenario, the trigger.
> 2. **The chain of events:** How did we get there? What early warning signs were visible today?
> 3. **What we missed:** What assumption are we making right now that turned out to be wrong?
> 4. **The cost:** What did this failure cost — users lost, revenue impact, recovery time?
> 5. **Current evidence:** What in the codebase TODAY supports this failure scenario?
>
> Be vivid and specific, not abstract. "The payment webhook handler silently drops events
> when the queue backs up" is useful. "There might be reliability issues" is not.
>
> Write 2-3 distinct failure narratives, each in your domain of expertise.

## Phase 2 Injection — Cross-Critique Modifier

Append to the cross-critic prompt:

> **Cross-critique approach: Failure Plausibility Review**
>
> You have received failure narratives from multiple experts. Your job is to:
> 1. **Rate plausibility** of each narrative (high / medium / low) based on current codebase evidence
> 2. **Find compound failures** — where two experts' narratives could chain together into something worse
> 3. **Identify the single most likely failure** across all narratives — the one with the strongest
>    current evidence and highest potential impact
> 4. **Flag missing failure modes** — what categories of failure did NO expert write about?
