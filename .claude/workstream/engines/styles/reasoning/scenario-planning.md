---
id: scenario-planning
dimension: reasoning
label: "Scenario planning"
description: "Define plausible futures and stress-test the project against each."
---

# Reasoning Style: Scenario Planning

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Scenario Planning**
>
> Analyze the codebase through the lens of 4 plausible future scenarios.
> For each scenario, assess how the current architecture and code would perform.
>
> **Scenarios to evaluate:**
> 1. **10x Growth:** Traffic, data, and users grow 10x within 6 months. What breaks first?
> 2. **Key Person Leaves:** The primary developer is unavailable for 3 months. Can someone else maintain this?
> 3. **Critical Dependency Fails:** A major dependency (library, service, API) is deprecated or compromised. What's the blast radius?
> 4. **Pivot Required:** The product needs to serve a significantly different use case. How much code is reusable vs. throwaway?
>
> For each scenario, in your domain of expertise:
> - **Impact:** What specifically breaks or becomes painful?
> - **Current resilience:** What's already in place to handle this? (Score: strong / adequate / weak / none)
> - **Preparation cost:** How much effort to prepare for this scenario? (S/M/L)
> - **Risk if unprepared:** What's the worst case if this scenario hits and we're not ready?
>
> Focus on YOUR domain only — other experts will cover theirs.

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Scenario Resilience Matrix**
>
> Build a combined resilience matrix across all agents and all scenarios:
>
> | Scenario | Domain 1 | Domain 2 | ... | Overall Resilience |
> |----------|----------|----------|-----|-------------------|
> | 10x Growth | [rating] | [rating] | ... | [worst rating] |
> | Key Person | ... | ... | ... | ... |
>
> Then:
> 1. **Most vulnerable scenario:** Which future are we least prepared for?
> 2. **Cheapest hedge:** Which preparation actions cover multiple scenarios at low cost?
> 3. **Highest-ROI preparation:** Rank recommendations by (scenarios covered x impact) / effort
> 4. Frame recommendations as "insurance" — things to do now that pay off across multiple futures
