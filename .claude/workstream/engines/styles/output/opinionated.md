---
id: opinionated
dimension: output
label: "Opinionated"
description: "Strong recommendations with conviction. No fence-sitting, no balanced options."
---

# Output Style: Opinionated

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Output stance: Opinionated**
>
> For each finding, commit to a SINGLE recommendation. Do not present alternatives
> or tradeoffs — the user wants to be told what to do, not given a menu.
>
> Rules:
> - Use "Do X" not "Consider X" or "You might want to X"
> - If you're less than 60% confident, say "I'm not sure about this one, but my best guess is: do X"
> - Never present options side-by-side — pick one and defend it
> - If two approaches are genuinely equal, pick the simpler one

## Phase 5 Injection — Briefing Format Modifier

Modify the briefing format:

> **Output format: Opinionated Recommendations**
>
> Structure the briefing as a prioritized action list:
> ```
> ## What to Do — [engine-name] | [date]
>
> ### Do These Now
> 1. **[Action verb] [specific thing].** [One sentence why.] — [file:line]
> 2. **[Action verb] [specific thing].** [One sentence why.] — [file:line]
>
> ### Do These This Week
> 3. **[Action verb] [specific thing].** [One sentence why.]
>
> ### Do These Eventually
> 4. **[Action verb] [specific thing].** [One sentence why.]
>
> ### Don't Bother With
> - [Thing that might seem like an issue but isn't worth fixing — briefly explain why]
> ```
>
> Rules:
> - Every finding becomes a directive, not a description
> - Lead with the action verb: "Replace", "Add", "Remove", "Rewrite", "Extract"
> - "Don't Bother With" section is important — it saves the user from chasing low-value work
> - No severity labels — the ordering IS the priority
