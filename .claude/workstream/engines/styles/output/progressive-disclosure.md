---
id: progressive-disclosure
dimension: output
label: "Progressive disclosure"
description: "Three layers of depth — headline, evidence, then full implementation detail."
---

# Output Style: Progressive Disclosure

## Phase 5 Injection — Briefing Format Modifier

Replace the standard briefing format with a three-layer structure:

> **Output format: Progressive Disclosure (3 layers)**
>
> Present findings in three layers. The user reads Layer 1 to decide what to drill into.
>
> **Layer 1 — Headlines (everyone reads this)**
> ```
> ## Engine Run: [name] | [date] | [focus]
>
> ### At a Glance
> - [N] findings: [X critical, Y high, Z medium]
> - Top concern: [one sentence — the single most important finding]
> - Recommended action: [one sentence]
>
> ### Findings Summary
> | # | Finding | Priority | Severity | Action |
> |---|---------|----------|----------|--------|
> | 1 | [short title] | [score] | [sev] | [action] |
> | 2 | ... | ... | ... | ... |
> ```
>
> **Layer 2 — Evidence (for findings the user wants to understand)**
> For each finding, under a collapsible heading:
> ```
> ### Finding 1: [title]
>
> **What:** [2-3 sentence description of the issue]
> **Why it matters:** [business impact in plain language]
> **Evidence:** [file:line — specific code reference]
> **Confidence:** [high/medium/low with brief reasoning]
> ```
>
> **Layer 3 — Implementation (for findings the user wants to act on)**
> For each finding, under a deeper heading:
> ```
> #### Implementation Detail: Finding 1
>
> **Recommended fix:** [specific code change description]
> **Files to modify:** [list of file paths]
> **Estimated effort:** [S/M/L]
> **Verification:** [how to confirm the fix worked]
> **Risks of the fix:** [what could go wrong with the fix itself]
> ```
>
> Rule: Layer 1 must be scannable in under 60 seconds. Layer 2 adds 1-2 minutes per finding.
> Layer 3 is a reference document for execution.
