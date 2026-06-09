---
id: risk-register
dimension: output
label: "Risk register"
description: "Formal risk table with likelihood, impact, mitigation, and owner — shareable with stakeholders."
---

# Output Style: Risk Register

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Output stance: Risk Register**
>
> For each finding, classify using formal risk assessment criteria:
> - **Likelihood:** Rare (< 5%) / Unlikely (5-25%) / Possible (25-50%) / Likely (50-75%) / Almost Certain (> 75%)
> - **Impact:** Negligible / Minor / Moderate / Major / Severe
> - **Risk Level:** Likelihood x Impact (use standard risk matrix: Low / Medium / High / Critical)
> - **Mitigation status:** Unmitigated / Partially mitigated / Fully mitigated
>
> Be calibrated — not everything is "Likely" and "Severe". Overrating risks
> reduces trust in the register.

## Phase 5 Injection — Briefing Format Modifier

Replace the standard briefing format with a formal risk register:

> **Output format: Risk Register**
>
> ```
> ## Risk Register — [engine-name] | [date] | [focus]
>
> **Assessment scope:** [what was evaluated]
> **Assessor:** CWOS [engine-name] engine
> **Next review:** [30 days from now]
>
> ### Risk Summary
> | Level | Count |
> |-------|-------|
> | Critical | N |
> | High | N |
> | Medium | N |
> | Low | N |
>
> ### Risk Register
> | ID | Risk Description | Likelihood | Impact | Level | Mitigation | Status | Owner | Evidence |
> |----|-----------------|-----------|--------|-------|------------|--------|-------|----------|
> | R-001 | [description] | [L] | [I] | [level] | [what to do] | [status] | [suggested owner] | [file:line] |
> | R-002 | ... | ... | ... | ... | ... | ... | ... | ... |
>
> ### Critical & High Risks — Detail
> [For each Critical or High risk, provide:]
> #### R-001: [title]
> - **Description:** [full description]
> - **Root cause:** [underlying cause]
> - **Current controls:** [what's already in place, if anything]
> - **Recommended mitigation:** [specific action]
> - **Residual risk after mitigation:** [what level remains]
> - **Evidence:** [file:line with code reference]
>
> ### Recommendations
> | Priority | Action | Risks Addressed | Effort |
> |----------|--------|----------------|--------|
> | 1 | [action] | R-001, R-003 | S/M/L |
> | 2 | [action] | R-002 | S/M/L |
> ```
>
> Rules:
> - Every claim must cite evidence (file path and line number minimum)
> - Use formal language — this document may be shared with non-technical stakeholders
> - Include an "Owner" column even if it's always "Founder" — establishes accountability
> - Risk IDs (R-001) are local to this register, not CWOS finding IDs (note the mapping)
