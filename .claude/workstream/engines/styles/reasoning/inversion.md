---
id: inversion
dimension: reasoning
label: "Inversion"
description: "Ask 'what would guarantee failure?' then check which failure recipes are already partially baked."
---

# Reasoning Style: Inversion

## Phase 1 Injection — Agent Prompt Modifier

Append to each agent's dispatch prompt:

> **Reasoning approach: Inversion**
>
> Instead of looking for bugs or issues directly, answer this question:
>
> **"If you wanted to GUARANTEE this project fails in your domain of expertise,
> what recipe would you follow?"**
>
> Write a **Failure Recipe** — a step-by-step guide to sabotaging this project:
>
> 1. **Ingredient 1:** [What you'd do to cause failure — e.g., "Remove all input validation"]
>    - **Already present?** [YES / PARTIALLY / NO]
>    - **Evidence:** [If yes/partially — where in the codebase is this ingredient already present?]
>    - **Severity if exploited:** [What happens if this ingredient activates?]
>
> 2. **Ingredient 2:** [Next sabotage step]
>    - **Already present?** ...
>    (continue for 5-8 ingredients)
>
> Rules:
> - Be creative and adversarial — think like someone trying to cause maximum damage
> - "Already present: PARTIALLY" is the most interesting category — it means the failure path is open but not yet triggered
> - Focus on ingredients that compound — which combinations create cascading failures?
> - End with: "The shortest path to failure from here is: [1-2 sentence summary]"
