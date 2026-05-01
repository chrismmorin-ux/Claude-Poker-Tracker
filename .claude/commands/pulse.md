---
name: pulse
description: "Program health overview — accountability status, protocol history, tier management for all programs"
user-invocable: true
argument-hint: "[program-id | 'run' <program-id> [protocol] | 'escalate' <program-id> <tier>]"
---

# /pulse — Program Accountability Dashboard

Programs are permanent accountability structures — domains the founder has delegated to the AI. This command shows their status, runs their protocols, and manages their tiers.

## Subcommands

Parse `$ARGUMENTS`:
- No args → show all programs overview
- `<program-id>` → detailed status for one program
- `run <program-id>` → execute the next due protocol for the program
- `run <program-id> <protocol>` → execute a specific protocol (baseline, sweep, delta, challenge, blind_spot)
- `escalate <program-id> <tier>` → change a program's tier (dormant, watch, active, critical)

## Overview (no args)

### Preferred read path (ADR-020 step 2)

For program enumeration + health snapshot, prefer the typed-API CLI:

```bash
node kit/scripts/cwos-state-store.js programs all          # every program, all fields
node kit/scripts/cwos-state-store.js programs by-tier critical
node kit/scripts/cwos-state-store.js programs active       # excludes dormant
```

The T11:vital-signs reducer keeps `state/programs.json` in sync with
`programs/registry.yaml` + `prog-*.yaml`. This is the deterministic
O(1) read path per feedback_determinism_first.md. Fallback (pre-step-2
repos): scan the YAML files directly.

### Steps

1. Scan `.claude/workstream/programs/prog-*.yaml` for all programs. **Partition into two groups:**
   - `product_programs` — programs where `monitor_only` is absent or false (default)
   - `system_programs` — programs where `monitor_only: true` (e.g., optimization)
   System programs are rendered separately in Step 5 and skip health scoring, auto-recommendations, and sprint-block evaluation.
2. Read current project phase from `system/state.md` Project Phase table
3. For each **product** program:
   - Read tier, last_run_by_protocol, findings_open, phase_relevance
   - Look up this program's relevance at the current phase from `phase_relevance`
   - Determine which protocols are active based on current tier:
     - dormant: none
     - watch: delta only
     - active: delta + sweep + challenge
     - critical: all (delta + sweep + challenge + blind_spot)
   - Calculate effective cadence: `protocol.cadence_days * phase_multiplier`
     - critical=0.5x, high=1x, medium=2x, low=4x
   - Check which protocols are overdue: for each active protocol, read `last_run_by_protocol.{protocol}.date` and compare against `date + effective_cadence < today`. Each protocol uses its OWN last run date, not the most recent run across all protocols.
   - Evaluate `tier_triggers` — flag if current tier should be higher
   - **Compute health_score** using the formula from `kit/templates/system/health-scoring.md`:
     a. Determine `rigor_ceiling` from the highest-rigor analysis completed (see ceiling table)
     b. Compute `earned_score` from four weighted components: finding_health(0.35), protocol_currency(0.25), problem_class_coverage(0.25), maturity_progress(0.15)
     c. Apply hard caps (CRITICAL finding → max 4, 3+ HIGH → max 6, stale+block_sprint → 2)
     d. Apply staleness decay (drop 1 per cadence period past 2x overdue, floor 1)
     e. Store computed values in `health_score`, `health_ceiling`, `health_breakdown`, `health_ceiling_reason`
   - **Generate auto-recommendation** if no `source: auto-recommendation` item exists for this program in queue:
     a. Follow the priority waterfall from health-scoring.md (baseline → critical findings → overdue → next rigor step → coverage gaps → maturity)
     b. Compute priority_score: `(target_ceiling - health_score) * tier_weight * phase_relevance_multiplier`
     c. Write work item to queue with `source: auto-recommendation`, `auto_expires: true`
   - Determine display status:
     - GREEN: health_score >= 7 + no overdue protocols
     - YELLOW: health_score 4-6 OR has overdue protocols
     - RED: health_score <= 3 OR critical findings open
     - BASELINE: only baseline protocol has run (awaiting first sweep)
     - DORMANT: tier is dormant (program exists but not active)
   - Read `founder_priority` from program registry
4. Sort by: tier descending (critical first), then founder_priority ascending, then phase relevance
5. Output:

```
## Your Project's Programs
**Project Phase: [phase]** (since [date])

Programs are the areas of your project under permanent, automated monitoring.
Each one watches a domain and runs checks on a regular cadence.

**GREEN** = healthy and up to date  |  **YELLOW** = checks overdue  |  **RED** = critical findings  |  **BASELINE** = just established

[After the user has seen /pulse 3+ times (check usage.yaml pulse_count), condense 
the above to just the table — omit the explanation paragraph and legend.]

### Active Programs
| Program | Tier | Status | Health | Ceiling | Overdue | Open | Next Action |
|---------|------|--------|--------|---------|---------|------|-------------|
| security | CRITICAL | GREEN | 8/10 | 9 | — | 3 | Run blind-spot to reach ceiling 9 |
| financial-accuracy | ACTIVE | YELLOW | 5/10 | 7 | challenge (5d) | 1 | Run overdue challenge protocol |
| engineering | ACTIVE | GREEN | 7/10 | 8 | — | 2 | Run quality-judge to reach ceiling 9 |

### Dormant/Watch Programs
| Program | Tier | Trigger to Escalate | Last Checked |
|---------|------|---------------------|--------------|
| compliance | DORMANT | "App is publicly accessible" | never |

### Tier Escalation Alerts
[Programs where tier_triggers suggest the tier should be higher than current]
- **financial-accuracy**: Currently WATCH, but trigger for ACTIVE is met: "Application processes real money"
  → Run `/pulse escalate financial-accuracy active` to escalate

### Stale Findings (unresolved past escalation threshold)
[Findings from any program that have exceeded accountability.on_finding.escalation.stale_days]

### Recommended Actions
[For each program with overdue protocols, generate a concrete action:]
1. **[program name]** — [protocol] is [N]d overdue. Run: `/pulse run [program-id]`
2. **[program name]** — tier should escalate. Run: `/pulse escalate [program-id] [tier]`

[If no programs have overdue protocols or escalation alerts:]
All programs are on track. No action needed.

[If 3+ protocols are overdue across programs:]
Multiple programs need attention. Consider running `/audit programs` for a comprehensive refresh.

[Always, as a closing one-liner after the Recommended Actions:]
*Burden detection:* `/engine preflight` Suite 10 audits engines and programs for zero-run install cost (INV-F1). Run it when the `Overdue` column stays red for multiple programs — a structural signal that something's installed but not exercised.

### Prune Candidates (conditional — WS-130)

Run `component-alignment` with `--scope installed` to surface components that don't align with `repo_goal` (enforces P3, prevents tool-shaped-hammer carryover). See `engines/standard/component-alignment.md` for the full engine contract.

**Skip this block entirely if:**
- `.cwos-onboarding.yaml` is missing, OR
- `goal_is_placeholder: true` OR `repo_goal` is empty/null, OR
- no product programs or capability groups are active (nothing installed to score), OR
- the engine's last cached run is fresh (within the last 3 /pulse invocations via `usage.yaml.pulse_count` — re-scoring on every /pulse is wasteful). On a fresh hit, re-render the cached briefing output. On a stale hit, invoke the engine.

**When rendered:**

1. Build the candidate unit list from installed state:
   - All **product programs** from `registry.yaml` with `tier != dormant` (use the same list `/pulse` already computed in Step 3; system programs with `monitor_only: true` are excluded).
   - All **capability groups** whose state is `enabled` in `.cwos-onboarding.yaml.capabilities`.
   - **Engines** registered in `.claude/workstream/engines/registry.yaml` — scored at per-engine granularity since the founder has seen runs and can now judge each one.

2. Invoke the engine with `--scope installed` and the built unit list. Render the Case-B briefing output verbatim (see `engines/standard/component-alignment.md` → Briefing Template → Case B).

3. Cache the output in a local variable for the rest of the /pulse overview render. Store the run timestamp in `.cwos-onboarding.yaml` (`last_component_alignment_at` and `last_component_alignment_pulse_count`) for the freshness check.

**Display rules:**
- If the engine returned `skip_count == 0` AND `review_count == 0`: suppress this section entirely. An all-keep result is a healthy signal, not worth screen real estate.
- If `skip_count == 0` AND `review_count > 0`: render only the one-line "Say 'show review candidates' to see them" hint, no table.
- If `skip_count > 0`: render the full table from the engine briefing.

**Founder response handling:**
- `show review candidates` → re-render the engine output with the review band expanded.
- `skip <name>, <name>` response is NOT handled here — /pulse is read-only. Removal is out of scope for WS-130. If the founder says "remove X", respond: "Removal isn't wired up yet — for now, dormant a program via `/pulse escalate <id> dormant`, or flip a capability to `declined` in `.cwos-onboarding.yaml`."

### Scope check (conditional — WS-126)

Read `.cwos-onboarding.yaml`. Skip this block entirely if the file is missing.

**Suppression rules:**
- If `programs_scope_deferred` is set and the timestamp is within the last 7 `/pulse` invocations (check `usage.yaml.pulse_count` delta since the deferral), skip the block.
- Otherwise evaluate whether to render.

**Render the block if:**
- `programs_scope_needs_review` is a non-empty list, OR
- `domain_correctness_needs_customization` is true

**Block content — keep the founder framing, never show patterns/globs/YAML:**

If `programs_scope_needs_review` is non-empty:
```
### Scope check
A few programs aren't watching any files in your repo yet. Want me to refresh their coverage? (yes / no / not now)
```

On `yes` → invoke `node kit/scripts/cwos-scope-check.js --fix`. Parse the `fix_log` from its JSON output:
- For each entry with `action: patched`: clear that program id from `programs_scope_needs_review`.
- For each entry with `action: fallback` (no archetype patterns resolved): leave it in the list but render an additional line, one per affected program:
  ```
  Program `<name>` isn't watching any files yet. Say "wire up `<name>`" when you want to enable it.
  ```
  This is the DF-2 escape — we don't pester; the founder opts in explicitly.
- Re-render the program table to show updated state.

On `no` or `not now` → set `programs_scope_deferred: <current-pulse-count>` in `.cwos-onboarding.yaml`. Suppress the block for the next 7 `/pulse` invocations.

If `domain_correctness_needs_customization: true`:
```
### Domain correctness
The domain-correctness program is installed but checks generic placeholders. Want me to tailor it to your project? About 5 minutes. (yes / no / not now)
```

On `yes` → perform the per-repo customization (rewrite `prog-domain-correctness.yaml` problem_classes with domain-specific examples, set tier). Clear `domain_correctness_needs_customization`. This is the step 4d logic moved out of M3 and gated on explicit founder consent.

On `no` or `not now` → set `domain_correctness_deferred: <current-pulse-count>`. Suppress for the next 7 `/pulse` invocations.

### Uncustomized-contract check (conditional — WS-152)

Scan every `prog-*.yaml` (exclude `monitor_only: true` system programs). For each, read the `contract:` field and detect the substring `[CUSTOMIZE:`. Collect the list of program ids whose contract still contains placeholder content.

**Suppression rule:**
- If `.cwos-onboarding.yaml` has `customization_declined_at` set AND the founder has seen fewer than 3 `/pulse` invocations since that timestamp (check `usage.yaml.pulse_count` delta), skip the block.
- Re-prompt every 3 invocations, not forever — the signal shouldn't fade.

**Block content (render only if the uncustomized list is non-empty AND not suppressed):**

```
### Program customization
<N> program(s) still have placeholder contract text: <comma-separated program ids>.
A program's contract is the plain-language promise it makes to you. Placeholder text can't promise anything.

Want to customize them now? About <N × 2> minutes. (yes / no / not now)
```

On `yes` → walk each uncustomized program one-by-one. For each: show the current template contract, ask the founder to describe the domain-specific promise in plain language, rewrite the `contract:` field. Clear `customization_declined_at` + `customization_declined_count` in `.cwos-onboarding.yaml` on completion.

On `no` or `not now`:
1. Set `customization_declined_at: <current-timestamp>` in `.cwos-onboarding.yaml`.
2. Increment `customization_declined_count` (initialize to 1 if absent).
3. If `customization_declined_count >= 3`, INV-034 will escalate from WARN to FAIL on the next `cwos-verify` run. Surface a one-liner: `_After 2 more declines, cwos-verify will start failing INV-034 on uncustomized programs — this is how CWOS nags without pestering every session._`

---

### System Programs
[Only rendered if system_programs is non-empty. These monitor the tool itself, not your product.]
[Omit the explanation after the user has seen /pulse 3+ times.]

System programs monitor CWOS health. They never generate work items or enter sprints.

| Program | Tier | Status | Signals | Confirmed | Applied | Next Review |
|---------|------|--------|---------|-----------|---------|-------------|
| Optimization Monitor | WATCH | green | 5 | 0 | 0 | /evolve report |

[Status colors for system programs:]
[green = no confirmed patterns, system is self-improving normally]
[yellow = confirmed patterns awaiting /evolve optimize]
[red = validation failures, regression detected, or signal stagnation]
[dormant = tier is dormant, not yet active — omit from table entirely]

[For each system program, read signal_health fields instead of standard health_score.]
[Do NOT compute health_score, health_ceiling, or auto-recommendations for system programs.]
```

## Detail (program-id)

1. Read `prog-<id>.yaml` fully
2. Compute health_score using the formula (same as overview Step 3)
3. Show:
   - **Founder Contract** — render the plain-language promise from the `contract:` field.

     **Uncustomized-contract guard (WS-152):** if the raw `contract:` field contains the substring `[CUSTOMIZE:` (case-sensitive), do NOT display the raw text. It is template placeholder content, not a trusted promise. Instead render:

     ```
     > **This program hasn't been customized yet.**
     > The contract text you'd normally see here is still template placeholder content.
     > Run `/onboard-check` to finish setting it up (~2 min).
     ```

     Suppresses the "trusted-contract theater" failure mode where the founder reads `[CUSTOMIZE: replace with domain-specific promise]` as if it were a real commitment.
   - Tier, status, maturity level

   - **Health Score Breakdown**:
     ```
     ### Health Score: N/10
     
     **Ceiling: N/10** — [ceiling_reason]
     
     | Component | Weight | Raw | Weighted |
     |-----------|--------|-----|----------|
     | Finding health | 35% | X.XX | X.XX |
     | Protocol currency | 25% | X.XX | X.XX |
     | Problem class coverage | 25% | X.XX | X.XX |
     | Maturity progress | 15% | X.XX | X.XX |
     | **Subtotal** | | | **X.XX** |
     | **x Ceiling (N)** | | | **N → N** |
     [If hard caps applied: "Hard cap: [reason]"]
     
     **How to improve:**
     1. [highest-priority action from waterfall]
     2. [second-priority action if applicable]
     ```

   - **Problem Classes** with last-checked date for each

   - **Load-Bearing Assumptions (AS-N)** [only if program has `assumptions:` block; schema v4+]:
     ```
     ### AS-N Status
     | ID | Type | Status | Severity | Revisit | Claim (first 80 chars) |
     |----|------|--------|----------|---------|------------------------|
     | AS-NN | strategic | active | critical | 2026-07-22 | "Anthropic will not ship..." |

     <count> AS-Ns total: <active> active • <at_risk> at_risk • <validated> validated • <contradicted> contradicted • <proposed> proposed • <retired> retired
     ```
     If any AS-N has `status: at_risk` OR revisit date passed with `status: active`, render a "⚠ <n> AS-N(s) need /audit review" banner.
     Validator check inline: run `node kit/scripts/cwos-asn-validate.js --program .claude/workstream/programs/prog-<id>.yaml` and show exit code; if non-zero, render "⚠ Validator exit N: run `cwos-asn-validate.js --program` for details."

   - **Capability Brief — Case A vs Case B (every program):**
     Read `last_run_by_protocol.baseline.date` from the program YAML. Branch:

     **Case A — baseline has run (date is non-null):** Skip the Not-Yet-Activated block; proceed to Protocol Status below. (prog-design adds the per-surface scorecard sub-section after this branch — see "Per-Surface Scorecard" below.)

     **Case B — baseline has NEVER run (date is null):**

     Render using the program's `capability_brief` block. **This is mandatory** — silent availability is not adoption (feedback_no_silent_install_no_user_invention; ADR-028; INV-041).

     ```
     ### {program.name} — Not Yet Activated ⚠

     **What it does:** {capability_brief.value}

     **Problems it catches:**
     - {capability_brief.problems_prevented[0]}
     - {capability_brief.problems_prevented[1]}
     - {capability_brief.problems_prevented[2]}
     - {capability_brief.problems_prevented[3]}
     - {capability_brief.problems_prevented[4]}    {only render entries that exist; lists are 3-5 long}

     **Cost:** {capability_brief.cost.activation} to activate. {capability_brief.cost.ongoing} to maintain.

     **First output after activation:**
     - {capability_brief.first_output[0]}
     - {capability_brief.first_output[1]}
     - {capability_brief.first_output[2]}
     - {capability_brief.first_output[3]}    {only render entries that exist}

     **To activate:** `{capability_brief.activation_command}`

     {if capability_brief.requires_user_input is true, append:}
     **Note:** This program needs your input to produce useful output (domain context, policies, or rules). The first run will surface what it needs.
     ```

     If `capability_brief` is absent, that's an INV-041 violation — fall back to: "No baseline yet for {program.id}, and no capability_brief is defined (INV-041 violation — run /audit). Activate with `/pulse run {program.id} baseline`."

   - **[prog-design only] Per-Surface Scorecard (Case A):**
     If `prog-design` and baseline has run, also render this sub-section after Case A branch above. Read `surface_scorecard` block.

     ```
     ### 4-Surface Scorecard
     | Surface | Level | Confidence | Trend | Last Audit |
     |---------|-------|------------|-------|------------|
     | End-user | L<n> | <h/m/l> | <arrow> | <date> |
     | Operator | L<n> | <h/m/l> | <arrow> | <date> |
     | Builder | L<n> | <h/m/l> | <arrow> | <date> |
     | AI-conversation | L<n> | <h/m/l> | <arrow> | <date> |

     **Composite:** `E<n> O<n> B<n> A<n>` (minimum: L<min>)
     ```
     If spread between highest and lowest surface is ≥2 levels, render MAINTENANCE DEBT callout with concrete cost (e.g., "Maintaining shadcn/ui + Django template CSS in parallel — every design change requires two updates"). Pulled from latest synthesis in `evidence_dir`.

     If any surface has confidence=low, show: "*Rubric-improvement items logged for surfaces where rubric didn't discriminate cleanly.*"

     **Projected maturity (if findings closed since last audit):**
     Walk open findings under `program: design` tagged per surface. For each surface:
     - Find the findings that gate level N→N+1 (identified by the engine in synthesis's convergence_path block)
     - Count closed vs. open among those findings
     - If all gating findings for surface X are closed: render "**Projected next baseline:** <surface> will advance L<n>→L<n+1> on next /pulse run design."
     - If some closed: "**Partial progress:** <surface> has <m>/<n> gating findings closed for L<n+1>."
     - If none closed: no projection line (avoid noise).

   - **Protocol Status** for each protocol (read from `last_run_by_protocol.{protocol}`):
     - Last run date (per-protocol), next due date, status (on-time/overdue/not-yet-active)
     - Which tier activates this protocol
     - Rigor level contributed to ceiling
   - Open findings linked to this program (from `findings-index.yaml` where `program` matches)
   - Open work items linked to this program (from `queue-index.yaml` where `program` matches)
   - **Accountability status**: any stale findings past escalation threshold
   - Protocol history (last 5 runs from `evidence.protocol_history`)
   - Interconnections: what feeds in, what this blocks

## Run (run program-id [protocol])

**Sprint block escape hatch:** If a program with `block_sprint: true` has gone stale, `/next` cannot compose sprints. Running `/pulse run <program-id>` clears the block by executing the overdue protocol — this is the ONLY way to unblock sprints when a blocking program is stale.

1. Read program's current tier
2. If no protocol specified, determine the most overdue protocol that is active at the current tier:
   - If baseline has never run → run baseline
   - Else pick the protocol with the oldest overdue date
3. If a specific protocol is requested, verify it's active at the current tier. If not, warn but allow override.
4. Execute the protocol:
   - Read the protocol definition from the program file
   - Run the specified engine with the protocol's focus and any `prompt_additions`
   - Scope the engine run to the program's `scope.file_patterns`
   - For challenge and blind_spot protocols, include `prompt_additions` in the engine prompt
5. After the run:
   - Update `last_run_by_protocol.{protocol}` with date, engine, run_id, result (write to the specific protocol's slot, not a shared field)
   - Add entry to `evidence.protocol_history` with fields: `date` (YYYY-MM-DD), `protocol` (which protocol ran), `run_id`, `engine` (which engine executed), `findings` (count), `work_items` (count created), `result` (one-line summary), `health_score` (score at time of run)
   - **Recompute health score** using the formula from `kit/templates/system/health-scoring.md`:
     a. Update `health_ceiling` based on the protocol that just ran (see rigor ceiling table)
     b. Recount findings_open and work_items_open
     c. Compute all four formula components
     d. Apply hard caps and staleness decay
     e. Write `health_score`, `health_ceiling`, `health_ceiling_reason`, `health_breakdown`, `health_next_action`, `health_updated_at`
   - **Refresh auto-recommendation**: expire any existing `source: auto-recommendation` backlog item for this program, generate new one using the priority waterfall (if score < 10 or ceiling < target)
   - Re-evaluate tier_triggers — if a higher tier is now warranted, flag it
   - If accountability rules dictate (on_finding, on_stale), create work items

## Escalate (escalate program-id tier)

1. Read current program tier
2. Validate requested tier is one of: dormant, watch, active, critical
3. If escalating UP:
   - Change tier immediately
   - Note which new protocols are now active
   - If baseline hasn't run yet, flag: "Baseline protocol should run first — use `/pulse run {id} baseline`"
4. If de-escalating DOWN:
   - Require confirmation: "De-escalating {program} from {current} to {requested}. Protocols [{list}] will stop running. Confirm? (y/n)"
   - Only de-escalate after confirmation
5. Update program file and registry
6. Log tier change in `evidence.protocol_history`


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T12:program-management --tag /pulse --payload '{"command":"/pulse"}'`

Non-fatal. Do not gate any output on the exit status.
