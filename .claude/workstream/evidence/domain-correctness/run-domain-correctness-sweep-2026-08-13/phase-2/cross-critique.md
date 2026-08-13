# Phase 2 — Cross-Critique (orchestrator)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD
Author: session orchestrator, over the 6 Phase-1 outputs. Claims below marked [VERIFIED] were checked directly against HEAD by the orchestrator; everything else is comparative analysis of the agents' outputs.

## Headline correction — two agents reported stale state as current

**The failure-engineer (KC1) and product-ux-engineer (HR1) both asserted that refinement is wall-clock (`Date.now()`) gated and therefore non-reproducible under machine load.** Both cited the 2026-08-05 blind-spot evidence file (FIND-051). **This is stale at HEAD.** WS-432 (`52d0cae4`, 2026-08-07) replaced the wall-clock gate with a device-independent logical work-unit meter (`refinementWork.js` — `budgetUnits = refinementBudgetMs * REFINEMENT_UNITS_PER_MS`, gate reads `meter.used` vs `budgetUnits` via `claimStageWorkBudget`). [VERIFIED by orchestrator grep: the only `Date.now()` calls remaining in `gameTreeEvaluator.js` (:903, :1044, :1347, :1422) are diagnostic timers, not gates.]

This is the recall-not-derive failure mode this protocol exists to catch: two fresh-context agents read the prior audit's evidence file and carried its conclusion forward past the commit that fixed it. The performance-engineer, who read the current source and the calibration doc, got it right.

**Consequences for the finding set:**
- FIND-051's *non-determinism* component (identical inputs → different answers under load) appears **FIXED** at HEAD by WS-432. This should be re-ruled, with the depth-2 targeted agent and Result Cards RC-depth-ablation as corroboration.
- What FIND-051 correctly flagged and remains TRUE: no consumer reads `depthReached`/`weightConsumed`/`treeMetadata.latency` before trusting the number (all six lenses converge on this).
- What replaces the non-determinism risk: the performance-engineer's inversion — the budget is now answer-deterministic but wall-clock-unbounded on the target device (desktop-calibrated `REFINEMENT_UNITS_PER_MS = 319`, no mobile recalibration, no worker offload, no yield on the live caller). "Sometimes-wrong, always-fast" became "provably-consistent, possibly very slow," and no one has measured the wall time on the Galaxy A22/S22.
- The session-memory file `project_advice_depth_tracks_machine_load.md` is stale for the same reason and must be updated as part of this run's output.

## Second correction — the product-ux latency number is derived, not measured

Product-ux KC1 states the founder "now waits up to ~2.4s" per postflop decision. That figure is desktop-derived arithmetic (context build + 2000ms nominal budget). Per the performance-engineer, the unit-denominated budget means real wall time on the phone is *unknown* (scales with per-combo throughput; possibly several times longer). The correct claim is "unmeasured, plausibly seconds-scale on target hardware" — stronger as a finding, weaker as a number. Neither agent has an on-device measurement; none exists in the repo.

## Where the experts disagree, and the resolution

1. **Is depth-2/3 reaching the live surface a defect or a decision?** Product-ux KC2 frames it as drift ("unvalidated numbers reaching the founder, contradicting WS-361's open gate"). The strongest, code-anchored form is product-ux's own Dangerous Assumption #2: **DEC-036's recorded belief — "the refined answer reaches no screen yet; wiring is Phase C and design-gated" — is false as shipped**, because every `await evaluateGameTree(...)` caller receives the refined result by default. The design gate protects the wrong half of the feature (the harmless fast answer is gated; the unvalidated refined answer flows). That is a governance-record-vs-code contradiction, which is squarely problem class 8 (theory/spec drift). Resolution: file as drift, anchored on decisions.md:834 vs computeHelpers.js:251.

2. **Severity of the confidence badge (MO-7).** Product-ux treats it as a top-5 concern; failure-engineer files it under hidden risks as a known measurement oversight (MEASUREMENT_OVERSIGHTS.md MO-7). Both agree on the mechanism (DATA tier unreachable — no producer emits a source containing "model"; EST tier unreachable — effectiveN floored at PSEUDOCOUNT=10). It is pre-existing, documented, and previously registered (FIND-049 shape). Resolution: not NEW drift, but this window touched `villainDecisionModel.js` 16 times including the source-emitting lines without fixing the vocabulary mismatch — so it is a missed-adjacent-fix, and the Ignition-vs-main-app vocabulary split (product-ux KC4) IS new information no prior finding records.

3. **The `style` residue.** Architect (KC4), senior (KC2), failure (HR) and security (HR) all found style remnants independently — convergence with different severities. Aligned reading: (a) `modelAudit.js:114` reattachment is documented + regression-tested → cosmetic; (b) `drillModeEngine.js:804-810` carries a comment referencing a deleted table and a dead `style:'reg'` field that silently lands every drill villain on the 0.45 unknown baseline → real cleanup item, missed by the WS-436 close-out pass whose changelog claims "stale docblocks cleaned"; (c) five display-layer `classifyStyle` sites are doctrinally sanctioned (WS-447 display-only) — watch, not fix.

4. **Journal widening (security KC3).** Security flags chrome.storage.session → local as a boundary widening. The in-code comment shows it was deliberate (WS-358, durability across SW restarts). What's genuinely missing is not the decision but the compensating controls (TTL/purge) and — cross-checking against the decision log — whether an ADR records the tradeoff. No other lens looked at it. Keep as a real finding at MEDIUM: deliberate-but-uncompensated.

## What individual experts missed (blind spots surfaced by the others)

- **systems-architect** stayed structural and missed every live-path correctness finding (rake tier, badge, onFastResult) — expected division of labor, but note its "state-layer churn is minimal and clean" claim conflicts with nothing; it simply didn't look at the live advisor path.
- **failure-engineer** missed that its own KC1 was fixed at HEAD (above) — while being the lens whose CLEAN list is otherwise the most rigorous (division guards, sort comparators, reduce initial values all grep-verified).
- **senior-engineer** counted the 8,107-line generated artifact in the production-line total and then corrected for it — fine — but did not notice the perf-engineer's finding that the artifact never reaches the bundle, which moderates its own "9,100 inert lines" framing: the inert surface is ~660 hand-written lines plus a data file that costs nothing at runtime. The *pattern* (shipped-but-inert, 4th recorded instance) stands; the magnitude framing should be corrected in synthesis.
- **security-engineer**'s exportUtils userId finding (KC1) is the only NEW cross-account data-integrity defect in the set and no other lens touched persistence — single-source, needs the facilitator to weigh it without corroboration. Its file:line specifics (exportUtils.js:212/:224 vs :240-244) are concrete enough to verify cheaply at fix time.
- **performance-engineer** framed `OnlineStakesBackfill` as launch cost only; the failure lens would add: the backfill writes `stakes` fields derived from hand data — if the derivation is wrong once, it is persisted and the pass never revisits (self-healing = self-sealing). No agent checked the derivation itself. Facilitator should carry this as an explicit unknown.
- **Nobody read `gameTreeDepth2.js` internals** — the largest single diff, flagged unvalidated by the repo's own doctrine. Failure-engineer declared this honestly. A 7th targeted dispatch (failure lens, depth-2-specific brief) was launched by the orchestrator to close the gap before synthesis; its output is `phase-1/gameTreeDepth2-targeted.md`.

## Convergent findings (3+ independent lenses — highest confidence)

1. `onFastResult` has zero production callers; live callers block synchronously on full refinement with no yield and no UI distinction (product-ux, failure, senior, perf — 4 lenses; matches open FIND-076 but with materially expanded consequence: no paint opportunity + unmeasured mobile wall time).
2. Depth/partiality metadata (`depthReached`, `weightConsumed`, per-stage `ran/partial/gated/error`) is computed and read by no rendered surface (product-ux, failure, perf; DEC-036's own required-reading rule violated by every consumer).
3. Shipped-but-inert instruments, 3 new instances this window: `rakeResolver.tier/reason` (zero readers), `unexploitableFloor.deriveFloor` (zero src/ callers while the known-wrong constant stays live), `equityOperator/equitySkew` (zero importers) (failure, senior, product-ux, architect-adjacent).
4. Style residue cleanup set (4 lenses, above).

## Pre-existing / already-tracked (do NOT double-file)

- MO-2 (decayed-weight vs raw-count confidence), MO-5 (16 uncorrected detectors), MO-7 (badge) — documented in MEASUREMENT_OVERSIGHTS.md; check each has a WS item; file only the NEW facets (Ignition vocabulary split).
- FIND-076 (onFastResult unwired) — open; this sweep expands its consequence record rather than duplicating it.
- run-strategy-profile.mjs unguarded corpus read — named in commit `154d6858`'s own message as flagged-not-fixed; check for an existing WS item before filing.
- Hotspot file growth (architect KC2/KC5, senior KC5) — SYSTEM_MODEL §5.2 already names the files; the NEW fact is the growth rate + stale risk rating.

## Orchestrator contamination declaration

The orchestrator's context contains: the program YAML including FIND-043..054 result summaries, session memory files asserting the wall-clock-gating and river-flip conclusions, and the two sub-CLAUDE.md rule sets. The stale-claim correction above was NOT taken from that context — it was resolved by direct grep at HEAD after the perf-engineer's contrary report. The memory file `project_advice_depth_tracks_machine_load.md` is itself part of the contamination surface and is flagged for update. Briefs given to all 7 agents contained the window, the 9 problem classes, and the mandatory reading list; no prior findings or conclusions were included.
