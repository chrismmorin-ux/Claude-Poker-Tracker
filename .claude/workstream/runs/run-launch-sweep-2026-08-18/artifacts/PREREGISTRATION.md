# Pre-registration — written BEFORE any expert result was seen
run_id: run-launch-sweep-2026-08-18
written_at: 2026-08-18 23:2x, immediately after dispatch, before first agent returned

## Predictions (score each SUPPORTED / REFUTED after phase-1 lands)

P1. H2 will be SUPPORTED: `required_program_health: 60` is compared against health
    scores on a 0-10 scale, so the launch gate is arithmetically incapable of ever
    returning READY. Confidence: high.
    FALSIFIER: an expert shows the comparison never executes, or shows a normalisation
    step converting 0-10 to 0-100 somewhere in cwos-pulse.js / the launch aggregation.

P2. H1 will be SUPPORTED: with blocking_programs `[]`, the verdict is produced by
    inspection and is therefore the same every run regardless of product state.
    FALSIFIER: an expert finds a real, product-grounded blocker that would have
    produced NOT READY even with a correctly wired gate.

P3. H3 will be SUPPORTED: a shippable subset exists (the founder uses this at a table
    today), and the aggregate verdict has been hiding it.
    FALSIFIER: product-ux runs the app and finds a core flow actually broken end-to-end.

P4. The test suite will PASS. ~40 files are uncommitted but the founder ships working
    trees routinely here.
    FALSIFIER: senior-engineer reports failures.

P5. The single highest-severity finding of this run will come from security-engineer,
    on the six never-triaged findings in the dormant security program OR on the
    extension's host permissions.
    FALSIFIER: the top finding comes from any other persona.

P6. At least one expert will REFUTE at least one of H1-H4. If all six agree with all
    four hypotheses, the brief encoded the answer and this run is contaminated —
    I wrote H1-H4 and I am the least trustworthy input in this window.
    FALSIFIER: unanimous agreement across all six on all four. That outcome means
    the run is INVALID as evidence, not that the hypotheses are confirmed.

## Contamination I am naming unprompted
- I authored H1-H4. They are my hypotheses, not measurements. The brief tells experts
  they may refute; whether that is enough is itself tested by P6.
- I supplied the program-health table in the brief. Experts inheriting those numbers
  are not independently confirming them. Only claims where an expert opened the file
  themselves count as independent.
- Four prior sweeps concluded NOT READY. That is in my context and in the program YAML
  the experts read. Convergence on NOT READY is therefore weak evidence.
