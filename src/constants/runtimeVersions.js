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

// v125 (2026-08-14, WS-442): WS-314 check-raise fold-equity guard (fold-equity-only
// check-raise requires a reliable villain read, mirroring bestResponseToAggression's
// DEC-022 guard; CR fallback fold aligned to MODEL_CONFIDENCE_THRESHOLD +
// POPULATION_PRIORS.raise.fold) and WS-315 blocker tie-break in the final ranking
// (blockerScore.excess breaks EV ties within 1% of pot).
export const ENGINE_VERSION = 'v125';
export const APP_VERSION = 'v123';
