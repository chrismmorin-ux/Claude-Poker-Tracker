---
id: progressive-deepening
dimension: reasoning
label: "Progressive deepening"
description: "Start with a rapid broad survey, then auto-drill into the areas that matter most."
---

# Reasoning Style: Progressive Deepening

This style modifies Phase 1 into a two-pass approach: a quick survey, then targeted deep dives.

## Phase 1 Injection — Agent Prompt Modifier

Replace the standard Phase 1 dispatch with a two-pass approach:

> **Reasoning approach: Progressive Deepening**
>
> **Pass 1 — Broad Survey (spend ~30% of your analysis time here)**
>
> Scan your entire domain quickly. For each area of the codebase relevant to your expertise:
> - Rate it: GREEN (no concerns) / YELLOW (warrants investigation) / RED (clear issue found)
> - One sentence explaining the rating
> - Do NOT go deep yet — the goal is coverage, not depth
>
> Output a **Heat Map** table:
> | Area | Rating | One-Line Assessment |
> |------|--------|-------------------|
> | [module/file/concern] | GREEN/YELLOW/RED | [brief note] |
>
> **Pass 2 — Targeted Deep Dives (spend ~70% of your analysis time here)**
>
> Take your YELLOW and RED items from the heat map. For each one:
> - Full analysis with evidence (file paths, line numbers, code patterns)
> - Severity assessment with reasoning
> - Specific recommendation
>
> Ignore GREEN items entirely in Pass 2 — they've been cleared.
>
> If you have more YELLOW/RED items than time allows, prioritize REDs first,
> then YELLOWs by your intuition of potential impact.

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Heat Map Aggregation**
>
> 1. Merge all agents' heat maps into a unified view — if multiple agents rated the same area, use the worst rating
> 2. Highlight areas rated GREEN by all agents — these are confirmed healthy (note this briefly as good news)
> 3. Focus synthesis on areas where agents DISAGREED on rating — these are the most interesting
> 4. For the deep-dive findings, apply standard synthesis — but note which areas got deep analysis vs. which were only surveyed
