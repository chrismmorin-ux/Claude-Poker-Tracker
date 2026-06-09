---
id: dialectical
dimension: reasoning
label: "Thesis vs. antithesis"
description: "Agents argue opposing positions, then a synthesizer reconciles the strongest arguments."
---

# Reasoning Style: Dialectical

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Dialectical (Thesis)**
>
> For each significant concern you identify, present it as a **thesis** — a strong claim
> with supporting evidence. But also present the **antithesis** — the strongest possible
> counter-argument to your own claim.
>
> Structure each concern as:
> 1. **Thesis:** "[Strong claim about what's wrong]"
>    - Evidence: [file:line, code pattern, data]
>    - Why this matters: [impact statement]
> 2. **Antithesis:** "[Strongest counter-argument — why this might be fine]"
>    - Counter-evidence: [what supports the opposing view]
>    - Conditions where the antithesis holds: [when is this NOT a problem?]
> 3. **Your position:** Which side has stronger evidence, and why?
>
> The goal is intellectual honesty — show that you've genuinely considered the opposing
> view, not a straw-man version of it.

## Phase 2 Injection — Cross-Critique Modifier

Append to the cross-critic prompt:

> **Cross-critique approach: Dialectical Arbitration**
>
> Review each expert's thesis/antithesis pairs. Your job is to:
> 1. **Judge the debate** — for each pair, which side has stronger evidence?
> 2. **Find unresolved tensions** — where do two experts' theses directly contradict?
> 3. **Identify weak antitheses** — where did an expert set up a straw man instead of a real counter-argument?
> 4. **Spot consensus** — where do ALL experts agree (both thesis and antithesis) — these are highest-confidence findings

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Dialectical Resolution**
>
> For each finding, produce a **synthesis** that reconciles the thesis and antithesis:
> - If the thesis clearly won: state the finding with high confidence
> - If the antithesis partially held: state the finding with conditions ("This is a problem IF [condition], but acceptable WHEN [condition]")
> - If genuinely unresolved: present it as a decision the founder needs to make, with clear tradeoffs
>
> Never suppress the losing side's argument — note it as context, because conditions may change.
