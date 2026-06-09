---
id: competing-hypotheses
dimension: reasoning
label: "Competing hypotheses"
description: "Generate multiple explanations, build an evidence matrix, then systematically eliminate."
---

# Reasoning Style: Analysis of Competing Hypotheses

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Analysis of Competing Hypotheses (ACH)**
>
> For the most significant issue in your domain, apply the ACH method:
>
> 1. **Define the question:** What is the key problem or decision in your domain?
>    (e.g., "Why is the API slow?" or "What architecture should we use for X?")
>
> 2. **Generate hypotheses:** List 3-5 competing explanations or approaches.
>    Each must be distinct and plausible — no straw men.
>
> 3. **Collect evidence:** List 5-8 pieces of evidence from the codebase
>    (file patterns, metrics, code structure, test results, dependencies).
>
> 4. **Build the evidence matrix:**
>    | Evidence | H1 | H2 | H3 | H4 |
>    |----------|----|----|----|----|
>    | [evidence item] | ++ | -- | ? | + |
>
>    Key: ++ strongly supports, + supports, ? neutral, - weakens, -- strongly contradicts
>
> 5. **Eliminate:** Which hypotheses have the most contradicting evidence?
>    Cross them out with reasoning.
>
> 6. **Surviving hypothesis:** Which explanation best fits ALL the evidence?
>    Rate your confidence: high / medium / low.
>
> The goal is to DISPROVE hypotheses, not confirm your favorite. The last one standing wins.

## Phase 2 Injection — Cross-Critique Modifier

Append to the cross-critic prompt:

> **Cross-critique approach: Evidence Audit**
>
> Review each agent's ACH matrix. Check for:
> 1. **Missing evidence** — what data points did they not consider?
> 2. **Misclassified evidence** — did they mark something as ++ when it's actually neutral?
> 3. **Premature elimination** — did they eliminate a hypothesis that the evidence doesn't actually contradict?
> 4. **Cross-domain evidence** — does one agent's evidence support or contradict another agent's hypothesis?

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Hypothesis Consolidation**
>
> 1. Merge overlapping hypotheses across agents into unified hypotheses
> 2. Combine evidence matrices — a hypothesis that survives elimination from multiple domains is high-confidence
> 3. Present the surviving hypotheses ranked by evidence strength
> 4. For each surviving hypothesis, state what specific action it implies
> 5. If multiple hypotheses survive: frame as a decision for the founder with clear next steps to gather more evidence
