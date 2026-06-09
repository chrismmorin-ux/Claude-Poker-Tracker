---
id: options-matrix
dimension: output
label: "Options matrix"
description: "Structured comparison of approaches with pros, cons, effort, and risk for each."
---

# Output Style: Options Matrix

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Output stance: Options Matrix**
>
> For each significant finding or decision point, generate 2-4 distinct options for how
> to address it. Each option should be genuinely viable — no straw men.
>
> For each option, assess:
> - **Pros:** What does this option do well?
> - **Cons:** What are the downsides?
> - **Effort:** S / M / L
> - **Risk:** Low / Medium / High (risk of the fix itself causing problems)
> - **Reversibility:** Easy to undo / Hard to undo / Irreversible
>
> Do NOT recommend one option over others. Present the information and let the founder decide.
> If pressed, you may note which option has the lowest risk or lowest effort, but frame it
> as a data point, not a recommendation.

## Phase 5 Injection — Briefing Format Modifier

Modify the briefing format:

> **Output format: Options Matrix**
>
> For each finding that requires a decision:
> ```
> ### [Finding title]
>
> **The situation:** [2-3 sentences describing the issue]
>
> | | Option A: [name] | Option B: [name] | Option C: [name] |
> |---|---|---|---|
> | **What** | [description] | [description] | [description] |
> | **Pros** | [list] | [list] | [list] |
> | **Cons** | [list] | [list] | [list] |
> | **Effort** | S/M/L | S/M/L | S/M/L |
> | **Risk** | Low/Med/High | Low/Med/High | Low/Med/High |
> | **Reversible?** | Yes/No | Yes/No | Yes/No |
>
> **Key tradeoff:** [One sentence capturing the essential tension between options]
> ```
>
> For findings that do NOT require a decision (clear single fix), present them normally
> without a matrix — don't force options where one answer is obviously right.
