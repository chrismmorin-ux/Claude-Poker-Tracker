# Launch Readiness Sweep — expert briefing
run_id: run-launch-sweep-2026-08-18
protocol: sweep (cadence 7d, 11d stale, min_tier active)
engine: eng-engine
focus: Full launch readiness assessment
problem_classes: ALL

## What this program is
`launch` (`.claude/workstream/programs/prog-launch.yaml`) is a temporary GATE program.
It does not monitor code (`scope.file_patterns: []`). It aggregates health from other
programs and answers one question: ARE WE READY TO LAUNCH?

Its three declared problem classes:
1. Blocking Program Health — all programs that must be healthy before launch actually are
2. Core User Flows — primary user journeys work end-to-end
3. Operational Readiness — monitoring, alerting, incident response in place

## What the product actually is
Local-first client-side React + Vite + Tailwind poker tracker. IndexedDB (v13-v20 range
depending on source; VERIFY, do not assume). Firebase used ONLY for optional sign-in/sync
— guest mode works with no credentials. No server. No payments. No auth requirement.
Plus a Chrome MV3 extension in `ignition-poker-tracker/`.
Mobile target: Samsung Galaxy S22, landscape canvas 1600x720 under a CSS transform scale.

This architecture RESHAPES operational readiness. Traffic scaling, payment-provider
outage, and server-restart data loss are largely N/A. What replaces them is
IndexedDB migration robustness, offline correctness, and data loss on the founder's
own device. Do not import a SaaS launch checklist.

## THE HYPOTHESIS UNDER TEST — stated as the correction, not as the founder's claim
The last FOUR sweeps (2026-06-21, 07-22, 08-03, and the 06-09 baseline) all returned
"NOT READY" and all annotated it as "correct — mid-development". All four were recorded
in protocol_history as "Inline meta-aggregation, no new findings." Three of them produced
literally zero findings.

Treat that as a possible instrument failure, not as a settled verdict. Specifically test:

  H1. The NOT READY verdict is a self-perpetuating artifact. `launch_gate.blocking_programs`
      is `[]` (empty) and has been for all four sweeps (FIND-LA-001). The gate has NO
      contract to evaluate against, so it reports by inspection and returns the same
      answer every time. A gate that cannot say YES is not a gate.
  H2. `required_program_health: 60` is compared against program health scores that are
      on a 0-10 scale. Check this. If the scales do not match, the gate is arithmetically
      incapable of ever passing, and every "NOT READY" for four runs was meaningless.
  H3. A shippable subset exists that the aggregate verdict is hiding. The founder uses
      this app at a live poker table TODAY. "Not ready to launch" and "not usable" are
      different claims. Which flows are actually ready?
  H4. Program health of 0 means NEVER RUN, not BROKEN. Ten of sixteen programs sit at 0.
      An aggregate that treats never-measured as failing produces a number about the
      measuring apparatus, not about the product.

You are NOT required to agree with any of H1-H4. Refute them if the evidence refutes them.
An expert who returns "the prior verdict was right and here is the evidence" is doing the
job. An expert who returns the prior verdict because it was in the brief has failed.

## Current measured program state (from `cwos-pulse.js overview`, computed 2026-08-19)
Cap breaches (5): strategy-of-record 27/10, design 19/8, data-provenance 8/5,
data-quality 7/5, infrastructure 4/3.
Ungoverned findings (1): domain-correctness run-2026-08-13 claims 16 WS items, 0 exist.
Scores: domain-correctness 2/10 (CRITICAL tier, 50 open findings, 60/60 WIP),
self-compliance 2/10, data-provenance 4/8, design 3/8, methodology-integrity 2/8,
strategy-of-record 2/8, launch 1/8, change-management 0, guide-authority 0,
anti-hallucination 0, engineering 0, claims-policy 0, compliance 0, data-quality 0,
infrastructure 0, security 0 (6 open findings, never run).

Note security: DORMANT tier, 0/0, SIX open findings, never run. Interrogate that.
Note domain-correctness: 50 open findings and 60/60 WIP against a CRITICAL-tier program.

## Your job
Read the context files named in your own agent definition, then analyze LAUNCH READINESS
through your expert lens. Ground every claim in a file path and line number you actually
opened. Do NOT propose solutions in this phase.

Produce exactly these sections:
  - Key Concerns
  - Hidden Risks
  - Likely Missing Elements
  - Dangerous Assumptions
  - Verdict on H1-H4 (support / refute / cannot determine, WITH the evidence)

Severity vocabulary: CRITICAL / HIGH / MEDIUM / LOW.

## Hard constraints on your output
- A file:line you did not open is a fabrication. Open it or do not cite it.
- "Health 0" claims must distinguish never-run from measured-failing.
- If you find a limitation, the default is that it gets REMOVED, not planned around.
  An analysis that ends in a narrower scope than it started has failed
  (`.claude/rules/improvement-default.md`).
- Write your findings to a file in the run workspace phase-1 dir AND return them.
