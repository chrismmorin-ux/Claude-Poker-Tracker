/**
 * runtimeVersions.js — engine + app version constants for lineage footers.
 *
 * Used by:
 *   - `PrintConfirmationModal` to populate the W-URC-3 `engineVersion` +
 *     `appVersion` fields on `recordPrintBatch` payloads.
 *   - `PrintPreview` to thread the `runtime` prop through `ClassDispatchedTemplate`
 *     so the on-screen 7-field lineage footer shows real values (not the
 *     'unknown-engine' / 'unknown-app' fallbacks from `lineage.js`).
 *   - `predictionAuditWriter.composeModelVersion` — every predictionAudit record
 *     is stamped `range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}` so
 *     calibration analysis can slice by engine era.
 *
 * ENGINE_VERSION bumps INDEPENDENTLY of APP_VERSION (WS-466, 2026-08-13).
 * The original co-versioning premise ("engine and app change together") stopped
 * holding in practice: the engine's math changed three times in eleven days
 * (WS-436 style-tier removal, WS-450 caller's-price seam, WS-451 per-branch
 * rake) while the app architecture stayed at v123 — and none of those bumped
 * this constant, so every predictionAudit record written before 2026-08-13
 * carries `engine-v123` across MULTIPLE incompatible engine eras.
 *
 * EPOCH CAVEAT for readers of historical records: `engine-v123` spans everything
 * from the constant's introduction through WS-451 (2026-08-13). It cannot be
 * re-partitioned; treat it as "epoch before provenance enforcement", not as one
 * engine. `engine-v124` is the first era with the bump gate enforcing lineage.
 *
 * Bump ENGINE_VERSION when engine algorithm behavior changes
 * (gameTree*, exploitEngine/, rangeEngine/, handAnalysis/, weaknessDetector).
 * ENFORCED: `scripts/check-engine-version-bump.mjs` (wired into
 * smart-test-runner) fails the run when engine sources changed after the last
 * ENGINE_VERSION change. Bump APP_VERSION when app architecture changes
 * meaningfully (state shape, persistence schema).
 *
 * Stale-printed-card detection uses `contentHash` (not version), so bumping
 * these does NOT mark prior prints as stale on its own — only the lineage
 * footer string changes.
 */

// v127 (2026-08-16, WS-320 review): names the engine era that arrived with merge 27e4ea39,
// "integrate/orphans-20260807 — 78 commits of recovered orphan-branch work". That merge landed
// real algorithm change on BOTH parents and no bump followed it, so every predictionAudit
// record written since 2026-08-16T05:00 has been stamped v126 while running code v126 never
// saw. Against the first parent: decisionAccumulator.js restructured (−166 lines),
// preflopAdvisor.js, and four handAnalysis modules. Against the second: villainModelData.js
// (258 lines), villainDecisionModel.js (111), villainProfileBuilder.js, bayesianUpdater.js,
// populationPriors.js, crossRangeConstraints.js, lineTaxonomy.js and ~40 more.
//
// THIS IS THE GATE WORKING, NOT FAILING. It was misread once in this session as another
// instance of FIND-140 (a comment-only commit opening a spurious era) on the strength of a
// `git log --since` listing that showed a test-only commit first. Running the gate's OWN
// excluded query returns the merge, not the test commit: the test exclusion is intact. FIND-140
// remains a real defect in the gate's design; it is not what happened here, and the bump is
// genuinely owed.
//
// NUMBERING COLLISION, RECORDED SO IT CANNOT BE LOST: the uncommitted `ws-445-label-ledger`
// worktree also claims v127, on the FIND-140 premise disproved above, and its note asserts
// v126 is held by the "unmerged" ws-481-482-foldcurve branch. That branch merged as 4013fe96
// and v126 is on mainline. Mainline takes v127 because this era is merged and shared; that
// branch must renumber to v128 before it lands. Two eras must not share a name.
//
// v126 (2026-08-15, SPR-186): WS-481 fits the personalized fold curve on the axis it is
// EVALUATED on. `foldCurveAxisFraction` (foldEquityCalculator.js) is now the single
// definition, imported by the training side (decisionAccumulator) and delegated to by the
// consumption side (villainFacingFraction) — previously the curve was fitted on the hand's
// FINAL pot and evaluated on the STREET pot, so a pot-sized flop bet in a hand that reached
// the river trained as ~0.2 instead of 1.0. Priced in RC-FOLD-CURVE-AXIS-2026-08-15.
// WS-482 threads the node's computed pFold through tightenRatesForContinuation and reads the
// shadow 0.45/0.55 fold/continue constants from POPULATION_PRIORS. Its EV delta is ZERO and
// that is the recorded result (RC-CONTINUATION-RATE-THREADING-2026-08-15): the tightened
// rates are dead at both depth-2 consumers (FIND-139). The collateral fix that is NOT inert
// is villainProfileBuilder's POP_ACTIONS_FACING_NONE, which was INVERTED against its own
// definition and is live in the displayed population deviation for every unopened street.
//
// v125 (2026-08-14, WS-442): WS-314 check-raise fold-equity guard (fold-equity-only
// check-raise requires a reliable villain read, mirroring bestResponseToAggression's
// DEC-022 guard; CR fallback fold aligned to MODEL_CONFIDENCE_THRESHOLD +
// POPULATION_PRIORS.raise.fold) and WS-315 blocker tie-break in the final ranking
// (blockerScore.excess breaks EV ties within 1% of pot).
export const ENGINE_VERSION = 'v127';
export const APP_VERSION = 'v123';
