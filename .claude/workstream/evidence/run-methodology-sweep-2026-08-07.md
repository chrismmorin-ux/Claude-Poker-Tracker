# methodology-integrity/sweep — run evidence (2026-08-07)

Engine: eng-engine (6 personas: systems-architect, senior-engineer, failure-engineer,
performance-engineer, security-engineer, product-ux-engineer → orchestrator cross-critique →
roundtable-facilitator with independent verification). Orchestrator: ses-20260807-0535-df53cf18.
Repo at HEAD 18f49f22 (scripts/backtest read from clean worktree snapshot). First protocol run
in this program's life. Findings filed as FIND-074..084; WS-371 ticket updated; FIND-046 rewritten.

## Facilitator verification verdicts (load-bearing claims re-checked at HEAD)

- **Unseeded MC inside depth-1 — CONFIRMED with scope correction.** `gameTreeEvaluator.js:1119`
  passes no `rng`; `handVsRange` defaults to `Math.random` (`monteCarloEquity.js:316`); Step 8
  (:1115-1147) mutates `candidate.ev` BEFORE `assembleResult('fast')`/`onFastResult` (:1446-1457);
  the `dominantMargin` gate (:1096-1098) refines 3 candidates exactly when the top two are close.
  CORRECTION: the seeded seam already exists — `scripts/backtest/heroPolicy.mjs:300-302` injects
  `makeSeededEquityFn` (WS-433's `seededEquity.mjs`) via `equityFn`. Production-path defect; the
  fix is wiring, not building. Studies run WITH seeding did not measure this.
- **weightConsumed unread — CONFIRMED in app, PARTIALLY REFUTED in scripts.** Zero consumers in
  src/ (components/hooks). But `dumpGameTreeEV.mjs:219` persists it (WS-403/408/409 quoted values
  by hand). Narrower true finding: `decisionRecord.mjs:157` carries `ranStages` but drops
  `weightConsumed`; `depthAblationReport.mjs` (DEC-036's evidence source) has zero references —
  no AUTOMATED analysis conditions on completeness.
- **WS-371 "still live" — REFUTED.** The panel cited `weaknessDetector.js:464` and
  `villainObservations.js:328` — line numbers from the WS-371 ticket body that do not exist at
  HEAD. Both consumers were rewritten: `villainObservations.js:80` ("foldTo3BetMin: 60 removed
  (WS-371)"), `weaknessDetector.js:478-490` (rule renamed `pf-overfolds-vs-preflop-raise`, bar
  from `FIELD_FOLD_VS_PREFLOP_RAISE`); the n back-computation removed (`villainObservations.js:400-403`).
  Residual: `tendencyCalculations.js:342-343` still computes a field NAMED foldTo3Bet on the
  facedRaisePreflop denominator; `handhqReferencePool.js` mirrors it in 14 rows; no extractor
  computes true fold-vs-3-bet (corpus value exists: 49.9% vs misnamed 82.3%). The TICKET is stale,
  not the code — the exact failure dispatch-dont-assert names (ticket-in-context reproduced as
  fresh measurement).
- **FIND-046 "scope matches zero files" — REFUTED as stated.** 6/13 methodology patterns match;
  the 7 dead ones are all redundant with surviving directory globs (same shape in
  prog-domain-correctness: 9 dead, redundant, plus nonexistent `src/utils/refresher/**`). The
  REAL hole: `src/utils/decisionSystems/**`, `src/utils/standardOfRecord/**`, and
  `scripts/backtest/**` are in NO program's scope at all — which is how `wilsonCI.js` shipped
  against this program's own anti-invariant unnoticed.
- Origin-check gap CONFIRMED (blast radius: same-document script, not open internet — `event.source
  !== window` already excludes cross-frame). `bootstrapMeanCI` untested CONFIRMED (evCost.test.js
  has 18 tests, zero on the CI estimator).
- NOT REPORTED AS CLEAN: userId isolation on stat stores was not verified by any lens.

## Findings index (filed 2026-08-07)

| ID | Sev | Subject | Routed |
|----|-----|---------|--------|
| FIND-074 | HIGH | Depth-1 advice nondeterministic in app; seeded seam exists, unwired | methodology; escalation appended to FIND-051 (WS-432 must add this source) |
| FIND-075 | HIGH | Refinement completeness measured, persisted nowhere analysis reads; absent from DEC-036's evidence generator | methodology; update-note for WS-431/361/410 |
| FIND-076 | MEDIUM | onFastResult zero production callers (WS-334 two-phase design inert) | engineering (shipped-but-inert family) |
| FIND-077 | HIGH | Four confidence vocabularies, no reconciliation, no methodology version stamp on stored outputs; exploitValidator thresholds changed in a bare comment | methodology (this is the never-produced baseline inventory) |
| FIND-078 | MEDIUM | wilsonCI canonical against the program's own frequentist anti-invariant | methodology |
| FIND-079 | HIGH | getBaseChart silent all-zero grid for unrecognized position (WS-302 unfalsifiable-prior family; onward can-never-recover half UNCONFIRMED — falsifier named) | methodology → domain-correctness |
| FIND-080 | HIGH | PRIOR_SUPPORT_LAMBDA/tau argmax-selected on EVAL with no CALIB/HELDOUT split, in the file that mandates one for a sibling parameter | methodology |
| FIND-081 | MEDIUM | Fold-equity underived constants; OBS_PRIOR_WEIGHT=15 vs PRIOR_WEIGHT=10 divergent pseudocounts | methodology → domain-correctness |
| FIND-082 | MEDIUM | bootstrapMeanCI has no coverage test; HIERARCHY_ORDER has no executable falsifier | methodology |
| FIND-083 | MEDIUM | Capture-integrity cluster: no event.origin check; no cross-writer captureId dedup; captureId degrades to Date.now() on reconnect/partial | security (origin) + engineering (dedup) |
| FIND-084 | MEDIUM | Live surface strips conditioning: 3-tier badge no n; useActionAdvisor discards treeMetadata; .toFixed(2) bb precision theater | engineering/design |

WS-371: staleness update appended to the ticket (reprice to residual; dedupe with WS-254).
FIND-046: rewritten in place per the verified scope audit.

## Self-repair — exact scope fixes (apply before next run)

prog-methodology-integrity.yaml — DELETE 7 dead redundant patterns
(`src/utils/bayesianConfidence*.js`, `src/utils/villainDecisionModel/**`,
`src/utils/gameTreeEvaluator*.js`, `src/utils/decisionAccumulator*.js`,
`src/utils/weaknessDetector*.js`, `src/utils/handReviewAnalyzer*.js`,
`src/utils/heroAnalysis*.js`, `src/utils/significance*.js`) and ADD:
`src/utils/pokerCore/**`, `src/utils/decisionSystems/**`, `src/utils/standardOfRecord/**`,
`src/utils/tendencyCalculations.js`, `src/utils/heroState/**`, `scripts/backtest/**`,
`scripts/foldCurve/**`, `scripts/__tests__/**`, `docs/standard-of-record/**`.

prog-domain-correctness.yaml — delete its 9 dead redundant patterns + nonexistent
`src/utils/refresher/**` (keep `src/utils/potCalculator.js` as an exact path).

Also: prog-methodology-integrity.yaml:233-255 has `assumptions:`/`market_dynamics:` commented
out — schema v4 requires them at tier active; the program cannot pass `cwos-asn-validate.js`.
First AS-N candidate: "every load-bearing statistical constant has a recorded derivation or is
marked founder-estimate" (falsified by FIND-081's count ≥5 in one file).

## Trend result (stamped)

First run of this program, and it found the program's own instrument bent before it found
anything else: scope patterns half stale, and the three directories holding the most advanced
statistics in the repo (decisionSystems/, standardOfRecord/, scripts/backtest/) in no program's
scope at all — which is how a frequentist Wilson interval shipped as the canonical accumulator
tool against this program's own written anti-invariant. The load-bearing new defect: the fast
advice the founder acts on at the table is not deterministic — the depth-1 path runs an unseeded
Monte-Carlo refinement, hardest exactly when the top two actions are close — and the seeded seam
that fixes it already exists on the backtest path, never wired to the app. Second theme from
every lens independently: the engine carefully measures how much work completed (weightConsumed)
and no consumer reads it — not the UI, not the decision record, not the ablation report behind
the depth-2 decisions. Verification also overturned a headline claim: WS-371's defect is fixed
in code with only a stale P0 ticket and a misnamed stat remaining — the expert reproduced the
ticket's line numbers rather than reading HEAD. Net read: the methods are more carefully built
than they are wired, versioned, or scoped; the recurring shape is a good instrument whose output
nothing reads.
