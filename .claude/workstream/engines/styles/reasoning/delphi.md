---
id: delphi
dimension: reasoning
label: "Delphi method"
description: "Independent assessment, then revision after seeing anonymized peer reasoning."
---

# Reasoning Style: Delphi Method

This style maps cleanly onto the existing agent-dispatch procedure by using the three phases for the three Delphi steps:

- **Phase 1** = Round 1 (independent assessment by each expert)
- **Phase 2** = Round 2 (each expert revises after seeing anonymized peer output — uses the cross-critic agent slot, but dispatches ALL original agents again in parallel, each receiving the anonymized Phase 1 outputs)
- **Phase 3** = Convergence synthesis (facilitator analyzes how ratings shifted)

## Phase 1 Injection — Agent Prompt Modifier (Round 1)

Append to each agent's dispatch prompt:

> **Reasoning approach: Delphi Method — Round 1 (Independent Assessment)**
>
> Give your independent assessment. For each concern you identify, provide ALL of these fields:
> 1. **Finding:** Describe the issue
> 2. **Severity rating:** Rate as critical / high / medium / low
> 3. **Confidence:** Rate your confidence as high / medium / low with a brief justification
> 4. **Priority score estimate:** Give your best estimate (0-100) using the standard factors
> 5. **Evidence strength:** Rate the evidence as strong / moderate / weak
>
> Important: This is your INDEPENDENT view. Do not hedge or qualify for imagined disagreements.
> State your honest assessment based on the evidence you see.
>
> Format each finding as a structured block so it can be compared across experts:
> ```
> FINDING: [title]
> SEVERITY: [critical/high/medium/low]
> CONFIDENCE: [high/medium/low] — [justification]
> PRIORITY: [0-100]
> EVIDENCE: [strong/moderate/weak] — [file:line reference]
> DESCRIPTION: [2-3 sentences]
> ```

## Phase 2 Injection — Delphi Round 2 (Replaces Cross-Critique)

**IMPORTANT: This style REPLACES the standard cross-critique phase.** Instead of launching the cross-critic agent, re-dispatch ALL Phase 1 agents in parallel. Each receives:

1. Their OWN Phase 1 artifact (read from `<run_workspace>/phase-1/<agent-name>.yaml`)
2. ANONYMIZED Phase 1 artifacts from all OTHER agents (read from disk, strip the `agent` and `persona` fields — label as "Expert A", "Expert B", etc.)

Write Round 2 artifacts to `<run_workspace>/phase-2/<agent-name>-revision.yaml` (NOT `cross-critic.yaml`). Each artifact's `input_artifacts` lists the Phase 1 paths it consumed.

Append to each re-dispatched agent's prompt:

> **Delphi Round 2 — Informed Revision**
>
> Below are your Round 1 findings AND the anonymized findings from your peers.
> Peer identities are hidden — focus on their reasoning, not who said it.
>
> For each finding that appeared in YOUR Round 1 assessment:
> 1. **Original rating:** Your Round 1 severity/confidence/priority
> 2. **Peer range:** The range of ratings from other experts for similar findings
> 3. **Revised rating:** Your updated assessment after considering peer reasoning
> 4. **Rationale for change (or no change):** Why you moved or held firm
>
> For findings that appeared in PEER assessments but NOT yours:
> 1. **Peer finding:** What they found (quote the finding block)
> 2. **Your response:** Do you agree it's an issue? Rate severity/confidence
> 3. **Why you missed it:** What blind spot in your expertise explains the gap?
>
> Rules:
> - You MAY change your assessment — this is not weakness, it's calibration
> - You MAY hold firm — explain why the peer reasoning doesn't apply
> - Convergence is not the goal — honest assessment is
>
> Use the same structured format as Round 1 for your revised findings.

Update the manifest after Round 2:
- Each agent gets a `phase-2/<agent-name>-revision` entry (status: complete/failed)
- `agent_matrix` counts include both Round 1 and Round 2 agents
- Do NOT add a `phase-2/cross-critic` entry — the cross-critic is replaced by this round

## Phase 3 Injection — Synthesis Modifier

Append to the synthesis/facilitator prompt:

> **Synthesis approach: Delphi Convergence Analysis**
>
> You have two rounds of expert assessments. For each finding:
>
> 1. **Convergence score:** What percentage of experts agree on severity after Round 2?
>    (e.g., "4/5 experts rate this HIGH after revision" = 80% convergence)
> 2. **Drift direction:** Did ratings move up or down between rounds?
>    - Up = initially underestimated (experts became MORE concerned after seeing peers)
>    - Down = initially overestimated (experts became LESS concerned)
>    - Stable = independent assessments already aligned
> 3. **Holdouts:** If any expert held firm against the group in Round 2, preserve their
>    reasoning as a **minority report** — dissenting views have signal value
> 4. **Final severity:** Weight by convergence:
>    - 80%+ convergence → high confidence in the consensus severity
>    - 50-80% convergence → moderate confidence, note the spread
>    - <50% convergence → flag as uncertain, present the range
> 5. **Calibration insight:** Note systematic patterns:
>    - "Security concerns were rated higher after revision" = experts initially underrate security
>    - "Performance ratings converged quickly" = high agreement on performance issues
>
> Read Round 1 artifacts from `phase-1/` and Round 2 artifacts from `phase-2/` to
> compare the evolution of each expert's position.
